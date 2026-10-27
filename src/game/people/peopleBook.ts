import { getPerson, personOfOpponent, personOfSpeaker, PEOPLE } from '../../data/people.ts';
import { getTournament, type OpponentDefinition } from '../../data/tournaments.ts';
import type { SaveData } from '../save/saveData.ts';

/**
 * 名刺図鑑（2026-10-27 指示書「人物の名前・名刺図鑑・カード図鑑」）と、カード図鑑の NEW の印。DOM 非依存。
 *
 * - 名刺の登録：街の人＝初めて話したとき、対戦する人＝初めて対戦したとき（勝ち負けは問わない）。一度登録したら消えない
 * - 対戦成績：その人との勝ち・負け（引き分けは数えない）
 * - もらったカード：ダンジョンの人から勝って手に入れた技カード（名刺に、手に入れたことのあるモンスターの技だけ出す）
 * - カード図鑑の NEW：持っていて、まだ図鑑の詳しい画面で見ていないカード
 */

export interface PersonRecord {
  readonly wins: number;
  readonly losses: number;
  /** 最後に対戦したときの相手のモンスター（ダンジョンのバトラーは対戦ごとに編成が変わることがある） */
  readonly monsters: readonly string[];
  /** その人から手に入れたことのあるカード */
  readonly cards: readonly string[];
}

export interface PeopleBook {
  /** 名刺を登録した人の ID（登録した順） */
  readonly met: readonly string[];
  readonly records: Readonly<Record<string, PersonRecord>>;
}

export const EMPTY_PEOPLE_BOOK: PeopleBook = { met: [], records: {} };
const EMPTY_RECORD: PersonRecord = { wins: 0, losses: 0, monsters: [], cards: [] };

export function isMet(save: SaveData, personId: string): boolean {
  return save.peopleBook.met.includes(personId);
}

export function personRecord(save: SaveData, personId: string): PersonRecord {
  return save.peopleBook.records[personId] ?? EMPTY_RECORD;
}

/** 名刺を登録する（もう登録していれば何もしない） */
export function meetPerson(save: SaveData, personId: string): SaveData {
  if (!getPerson(personId) || isMet(save, personId)) return save;
  return { ...save, peopleBook: { ...save.peopleBook, met: [...save.peopleBook.met, personId] } };
}

/** 会話の名前の札が出たとき（街の人の登録） */
export function meetSpeaker(save: SaveData, speaker: string): SaveData {
  const person = personOfSpeaker(speaker);
  return person ? meetPerson(save, person.id) : save;
}

function updateRecord(save: SaveData, personId: string, fn: (r: PersonRecord) => PersonRecord): SaveData {
  const records = { ...save.peopleBook.records, [personId]: fn(personRecord(save, personId)) };
  return { ...save, peopleBook: { ...save.peopleBook, records } };
}

/** 対戦が終わったとき：相手が人物なら登録して、勝ち負けを数える */
export function recordPersonBattle(save: SaveData, opponent: OpponentDefinition, winner: 'player' | 'opponent' | 'draw'): SaveData {
  const person = personOfOpponent(opponent);
  if (!person) return save;
  return updateRecord(meetPerson(save, person.id), person.id, (r) => ({
    ...r,
    wins: r.wins + (winner === 'player' ? 1 : 0),
    losses: r.losses + (winner === 'opponent' ? 1 : 0),
    monsters: [...opponent.monsters],
  }));
}

/** その人から手に入れたカードを覚える（ダンジョンで勝ってもらった技カード） */
export function recordPersonCard(save: SaveData, opponent: OpponentDefinition, cardId: string): SaveData {
  const person = personOfOpponent(opponent);
  if (!person) return save;
  return updateRecord(save, person.id, (r) => (r.cards.includes(cardId) ? r : { ...r, cards: [...r.cards, cardId] }));
}

/** 登録の数（○／28人） */
export function metCount(save: SaveData): number {
  return PEOPLE.filter((p) => isMet(save, p.id)).length;
}

/* ---------- カード図鑑の NEW ---------- */

export function isCardNew(save: SaveData, cardId: string): boolean {
  return (save.collection[cardId] ?? 0) > 0 && !save.cardsSeen.includes(cardId);
}

/** 図鑑の詳しい画面で見た（NEW を消す） */
export function markCardSeen(save: SaveData, cardId: string): SaveData {
  return save.cardsSeen.includes(cardId) ? save : { ...save, cardsSeen: [...save.cardsSeen, cardId] };
}

/** 持っているカードの ID（新しいセーブ・前のセーブでは、いま持っているカードは見たことにする） */
export function ownedCardIds(collection: Readonly<Record<string, number>>): string[] {
  return Object.entries(collection).filter(([, n]) => n > 0).map(([id]) => id);
}

/* ---------- 前のセーブの救済・読み込み ---------- */

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/**
 * 前のセーブ：大会の記録から、対戦したはずの相手を登録する（街の人は話したか分からないので登録しない）。
 * - 優勝したことがある大会：全回戦の相手を登録。優勝の回数＝その相手に勝った回数（負けは分からないので 0）
 * - 参加したことがある大会：1回戦の相手を登録
 * - 進行中・結果待ちの大会：戦った回戦（負けたならその回戦も）の相手を登録
 */
export function rescuePeopleBook(raw: Raw): PeopleBook {
  const met: string[] = [];
  const records: Record<string, PersonRecord> = {};
  const add = (opponent: OpponentDefinition, wins: number): void => {
    const person = personOfOpponent(opponent);
    if (!person) return;
    if (!met.includes(person.id)) met.push(person.id);
    const r = records[person.id] ?? EMPTY_RECORD;
    records[person.id] = { ...r, wins: Math.max(r.wins, wins), monsters: [...opponent.monsters] };
  };
  const tournaments = isObject(raw.tournaments) ? raw.tournaments : {};
  for (const [id, rec] of Object.entries(tournaments)) {
    const def = getTournament(id);
    if (!def || !isObject(rec)) continue;
    const wins = count(rec.wins);
    if (wins > 0) for (const r of def.rounds) add(r, wins);
    else if (count(rec.entries) > 0 && def.rounds[0]) add(def.rounds[0], 0);
  }
  const active = raw.activeTournament;
  if (isObject(active) && typeof active.tournamentId === 'string') {
    const def = getTournament(active.tournamentId);
    const round = count(active.round);
    const fought = active.status === 'lost' || active.status === 'won' ? round + 1 : round;
    if (def) for (const r of def.rounds.slice(0, fought)) add(r, 0);
  }
  return { met, records };
}

export function normalizePeopleBook(v: unknown): PeopleBook {
  if (!isObject(v)) return EMPTY_PEOPLE_BOOK;
  const met = Array.isArray(v.met) ? [...new Set(v.met.filter((x): x is string => typeof x === 'string' && getPerson(x) !== undefined))] : [];
  const records: Record<string, PersonRecord> = {};
  if (isObject(v.records)) {
    for (const [id, r] of Object.entries(v.records)) {
      if (!getPerson(id) || !isObject(r)) continue;
      const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);
      records[id] = { wins: count(r.wins), losses: count(r.losses), monsters: strings(r.monsters), cards: [...new Set(strings(r.cards))] };
    }
  }
  return { met, records };
}
