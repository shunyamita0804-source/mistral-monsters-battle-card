import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPlayCard, skillsOf } from '../src/data/cards.ts';
import { BOOSTERS, type BoosterKey } from '../src/data/introV2.ts';
import { AJ_QA_SKILLS, AJ_SKILLS } from '../src/data/skillRebuildAJ.ts';
import type { CpuSkill } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, badStatusKinds, cardUsability, createBattle, findMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/**
 * 指示書 BH【5】の試遊（数字は報告するだけ。カード・ルールの数字は変えない）。PLAYTEST=回数（ふだんは 1）・PLAYTEST_OUT に JSON。
 * 1. 1体入れ替え（指示書 AJ・AX と同じやり方：入れられる箱 × 3か所 × 相手の3箱 × 先攻・後攻 × 回数）：クヨウ・ハクラン・シシエン・ジオル。レア抜き・レアあり。腕前 A どうし
 * 2. 状態を使う相手との相性：ヒョウズク（凍る）・ノビトン（まきつく）・ソラモ（すなかけ）の入ったデッキ（16枚ずつ・レアあり）が相手。
 *    クヨウ入り（3箱 × 3か所）と入れ替え前の3箱の勝つ割合（腕前 A どうし・先攻後攻）
 * 3. 新しい効果：1対戦あたりの使った回数（おはらい・まよけのふだ・みがわり）・消した悪い状態の数・防いだ数・代わりに受けたダメージ
 */
const GAMES = Number(process.env.PLAYTEST ?? 1);
const KEYS = BOOSTERS.map((b) => b.key);
const MAX_STEPS = 6000;
const SUBJECTS = (process.env.PLAYTEST_SUBJECTS ?? 'mon-kuyo,mon-hakuran,mon-shishien,mon-geol').split(',');
const SKILL: CpuSkill = (process.env.PLAYTEST_SKILL ?? 'A') as CpuSkill;
const KUYO = 'mon-kuyo';
const WAVE = 'skl-radiel-06';
const STATUS_MONSTERS = ['mon-soramo', 'mon-nobiton', 'mon-hyouzuku'] as const;

type Pick = { readonly id: string; readonly copies: number }[];

function rows(monsterId: string) {
  return AJ_SKILLS[monsterId] ?? AJ_QA_SKILLS[monsterId] ?? [];
}

/** 入れ替えの16枚（axPlaytest16 と同じ：レア抜き〔またはレアあり〕を1枚ずつ、足りない分は安い攻撃からもう1枚ずつ） */
export function bhPlaytest16(monsterId: string, withRare: boolean): Pick {
  const rare = new Set(rows(monsterId).filter((r) => r.rare).map((r) => r.id));
  const cards = skillsOf(monsterId).filter((k) => withRare || !rare.has(k.id));
  const counts: Record<string, number> = Object.fromEntries(cards.map((k) => [k.id, 1]));
  let n = cards.length;
  const attacks = cards.filter((k) => k.effect.type === 'attack').sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
  for (let round = 0; n < 16 && round < 2; round++) {
    for (const k of attacks) {
      if (n >= 16) break;
      counts[k.id] = (counts[k.id] ?? 0) + 1;
      n++;
    }
  }
  return cards.map((k) => ({ id: k.id, copies: counts[k.id] ?? 1 }));
}

/** 状態を使う相手のデッキ：ソラモ・ノビトン・ヒョウズク（16枚ずつ・レアあり）＋ ソラモのいる箱のサポート */
export function statusDeck(): Deck {
  const box = BOOSTERS.find((b) => b.monsters.includes('mon-soramo'));
  if (!box) throw new Error('ソラモの箱');
  const base = boosterDeck(box.key);
  const own = new Set(base.monsters.flatMap((m) => skillsOf(m).map((k) => k.id)));
  const supports = base.skills.filter((id) => !own.has(id));
  const skills = STATUS_MONSTERS.flatMap((m) => bhPlaytest16(m, true).flatMap((c) => Array<string>(c.copies).fill(c.id)));
  return { monsters: [...STATUS_MONSTERS], skills: [...skills, ...supports].slice(0, base.skills.length) };
}

interface Count {
  games: number;
  winsA: number;
  deckOut: number;
  turns: number;
  purify: number;
  purified: number;
  /** おはらいでライフが戻った量（BH の直し） */
  purifyHealed: number;
  /** 悪い状態が無く、回復だけに使った回数 */
  purifyHealOnly: number;
  charm: number;
  blocked: number;
  standIn: number;
  standInDamage: number;
  /** 2026-11-05 指示書 BI：ラディエル（しんぱんのせんこく・最後の審判・天の恵み・天の恵みで増えたマナ・てんのはどう〔7マナ〕を使えた手番・使った回数） */
  verdict: number;
  judgment: number;
  grace: number;
  graceMana: number;
  waveUsable: number;
  waveUsed: number;
}
const empty = (): Count => ({ games: 0, winsA: 0, deckOut: 0, turns: 0, purify: 0, purified: 0, purifyHealed: 0, purifyHealOnly: 0, charm: 0, blocked: 0, standIn: 0, standInDamage: 0, verdict: 0, judgment: 0, grace: 0, graceMana: 0, waveUsable: 0, waveUsed: 0 });

const BLOCKED_PREFIX = 'まよけのふだが防いだ';

/** a（player）と b（opponent）の1対戦。数えるのは player の側の新しい効果 */
function play(a: Deck, b: Deck, seed: number, first: Side, c: Count): void {
  let s: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b }, seed, first);
  let watch: { uid: string; life: number } | null = null;
  let purifyWatch: { uid: string; life: number } | null = null;
  let waveTurn = -1;
  let graceBefore: number | null = null;
  for (let i = 0; i < MAX_STEPS && s.phase !== 'ended'; i++) {
    const side = actingSide(s);
    if (!side) break;
    const action = chooseAction(s, side, 'normal', SKILL);
    if (!action) break;
    let standIn = false;
    // てんのはどう（7マナ）を使えた手番：自分の手番の攻撃のはじめ（まだだれも動いていない）に、手札のてんのはどうが使えるか
    if (side === 'player' && s.phase === 'main' && s.active === 'player' && s.turn !== waveTurn && s.sides.player.monsters.every((m) => !m.acted)) {
      waveTurn = s.turn;
      if (s.sides.player.hand.some((h) => h.cardId === WAVE && cardUsability(s, 'player', h.uid).usable)) c.waveUsable++;
    }
    if (side === 'player' && action.type === 'useCard' && s.phase === 'main') {
      const used = s.sides.player.hand.find((x) => x.uid === action.cardUid);
      const k = used ? getPlayCard(used.cardId) : null;
      if (k?.kind === 'skill' && k.effect.type === 'seal' && k.effect.manaDrain) c.verdict++;
      if (k?.kind === 'skill' && k.effect.type === 'lastJudgment') c.judgment++;
      if (k?.kind === 'skill' && k.effect.type === 'heavenGrace') {
        c.grace++;
        graceBefore = s.sides.player.manaPile.length - k.cost;
      }
      if (used?.cardId === WAVE) c.waveUsed++;
      const hand = s.sides.player.hand.find((x) => x.uid === action.cardUid);
      const card = hand ? getPlayCard(hand.cardId) : null;
      if (card?.kind === 'skill' && card.effect.type === 'purify') {
        c.purify++;
        const tm = action.targetUid ? findMonster(s, action.targetUid)?.monster : undefined;
        const kinds = badStatusKinds(s, tm).length;
        c.purified += kinds;
        if (kinds === 0) c.purifyHealOnly++;
        purifyWatch = tm ? { uid: tm.uid, life: tm.life } : null;
      }
      if (card?.kind === 'skill' && card.effect.type === 'wardCharm') c.charm++;
    }
    if (side === 'player' && action.type === 'defend' && action.cardUid) {
      const hand = s.sides.player.hand.find((x) => x.uid === action.cardUid);
      const card = hand ? getPlayCard(hand.cardId) : null;
      standIn = card?.kind === 'skill' && card.effect.type === 'cover' && (card.effect.reduce ?? 0) > 0;
    }
    const logBefore = s.log.length;
    s = applyAction(s, action);
    if (graceBefore !== null) {
      c.graceMana += Math.max(0, s.sides.player.manaPile.length - graceBefore);
      graceBefore = null;
    }
    if (purifyWatch) {
      c.purifyHealed += Math.max(0, (findMonster(s, purifyWatch.uid)?.monster.life ?? 0) - purifyWatch.life);
      purifyWatch = null;
    }
    c.blocked += s.log.slice(logBefore).filter((l) => l.text.startsWith(BLOCKED_PREFIX)).length;
    if (standIn && s.pending?.coverReduce) {
      c.standIn++;
      const m = findMonster(s, s.pending.targetUid)?.monster;
      if (m) watch = { uid: m.uid, life: m.life };
    }
    // みがわりのあとの攻撃が終わった（守りの番が終わった・狙いが変わった）ら、クヨウが受けたダメージを数える
    if (watch && (s.phase !== 'defense' || s.pending?.targetUid !== watch.uid)) {
      const now = findMonster(s, watch.uid)?.monster.life ?? 0;
      const took = Math.max(0, watch.life - now);
      c.standInDamage += took;
      watch = null;
    }
  }
  c.games++;
  c.turns += s.turn;
  if (s.winner === 'player') c.winsA++;
  if (s.endReason === 'deckOut') c.deckOut++;
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);
const per = (n: number, of: number): number => Math.round((n / Math.max(1, of)) * 1000) / 1000;
const summary = (c: Count): Record<string, number> => ({
  games: c.games,
  winA: pct(c.winsA, c.games),
  deckOut: pct(c.deckOut, c.games),
  avgTurns: Math.round((c.turns / Math.max(1, c.games)) * 10) / 10,
  purifyPerGame: per(c.purify, c.games),
  purifiedStatuses: c.purified,
  purifiedPerUse: per(c.purified, c.purify),
  purifyHealOnly: c.purifyHealOnly,
  purifyHealed: c.purifyHealed,
  charmPerGame: per(c.charm, c.games),
  blocked: c.blocked,
  blockedPerGame: per(c.blocked, c.games),
  standInPerGame: per(c.standIn, c.games),
  standInDamage: c.standInDamage,
  standInDamagePerUse: per(c.standInDamage, c.standIn),
  verdictPerGame: per(c.verdict, c.games),
  judgmentPerGame: per(c.judgment, c.games),
  gracePerGame: per(c.grace, c.games),
  graceMana: c.graceMana,
  graceManaPerUse: per(c.graceMana, c.grace),
  waveUsableTurns: c.waveUsable,
  waveUsableTurnsPerGame: per(c.waveUsable, c.games),
  waveUsedPerGame: per(c.waveUsed, c.games),
});

/** X を入れられる（箱に X がいない）箱と入れ替える場所 */
function swapSlots(monsterId: string): { key: BoosterKey; slot: number }[] {
  return BOOSTERS.filter((b) => !b.monsters.includes(monsterId)).flatMap((b) => [0, 1, 2].map((slot) => ({ key: b.key, slot })));
}

describe('BH の試遊', () => {
  it('入れ替えの16枚は16枚。入れ替えたデッキ・状態を使う相手のデッキは山札60枚でルールに合う', () => {
    for (const id of SUBJECTS) {
      for (const withRare of [false, true]) expect(bhPlaytest16(id, withRare).reduce((n, c) => n + c.copies, 0), id).toBe(16);
      for (const { key, slot } of swapSlots(id)) {
        const d = swapDeck(key, slot, id, bhPlaytest16(id, false));
        expect(d.skills).toHaveLength(60);
        expect(isDeckValid(d, countCards([...d.monsters, ...d.skills])), `${id} ${key}#${slot}`).toBe(true);
      }
    }
    const sd = statusDeck();
    expect(sd.skills).toHaveLength(60);
    expect(isDeckValid(sd, countCards([...sd.monsters, ...sd.skills]))).toBe(true);
  });

  it(`1体入れ替え・状態を使う相手との相性（各組み合わせ ${GAMES} 回）`, () => {
    const out: Record<string, unknown> = { games: GAMES, skill: SKILL };
    let seed = 1;
    let total = 0;
    // 1. 1体入れ替え
    for (const withRare of [false, true]) {
      const table: Record<string, unknown> = {};
      for (const id of SUBJECTS) {
        const c = empty();
        for (const { key, slot } of swapSlots(id)) {
          const deck = swapDeck(key, slot, id, bhPlaytest16(id, withRare));
          for (const opp of KEYS) for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(deck, boosterDeck(opp), seed++, first, c);
        }
        table[id] = summary(c);
        total += c.games;
      }
      out[withRare ? 'swapRare' : 'swap'] = table;
    }
    // 2. 状態を使う相手との相性（クヨウ入り・入れ替え前の箱）
    if (SUBJECTS.includes(KUYO)) {
      const foe = statusDeck();
      const vs: Record<string, unknown> = {};
      for (const key of KEYS) {
        const before = empty();
        for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(boosterDeck(key), foe, seed++, first, before);
        vs[`${key}:before`] = summary(before);
        total += before.games;
        for (const withRare of [false, true]) {
          const after = empty();
          for (const slot of [0, 1, 2]) {
            const deck = swapDeck(key, slot, KUYO, bhPlaytest16(KUYO, withRare));
            for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(deck, foe, seed++, first, after);
          }
          vs[`${key}:kuyo${withRare ? 'Rare' : ''}`] = summary(after);
          total += after.games;
        }
      }
      out.statusFoe = vs;
    }
    const file = process.env.PLAYTEST_OUT;
    if (file) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(out, null, 1));
    }
    expect(total).toBeGreaterThan(0);
  }, 7_200_000);
});
