import { describe, expect, it } from 'vitest';
import { cardBookEntries, NUMBERED_MONSTERS, sectionKey } from '../src/data/cardNumbers.ts';
import { HIDDEN_MONSTER_ID, MONSTERS, SKILLS, SUPPORTS, skillsOf } from '../src/data/cards.ts';
import { runGuardianOpponent, runNpcOpponent } from '../src/data/dungeonRun.ts';
import { EXAM_OPPONENT } from '../src/data/introV2.ts';
import { getPerson, PEOPLE, personOfOpponent, personOfSpeaker } from '../src/data/people.ts';
import { TOURNAMENTS } from '../src/data/tournaments.ts';
import { completeSections, isUnknown, matchesFilter } from '../src/game/cards/cardBook.ts';
import {
  isCardNew,
  isMet,
  markCardSeen,
  meetSpeaker,
  metCount,
  personRecord,
  recordPersonBattle,
  recordPersonCard,
} from '../src/game/people/peopleBook.ts';
import { createNewSave, normalizeSave, SAVE_VERSION, type SaveData } from '../src/game/save/saveData.ts';
import { opponentName, personName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

const fresh = (): SaveData => createNewSave(new Date('2026-10-27T00:00:00Z'), 'balance');

describe('人物28人', () => {
  it('No.01〜28 が1人ずつ。名前・肩書き・ひとことは日本語と英語の両方がある', () => {
    expect(PEOPLE.map((p) => p.no)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    expect(new Set(PEOPLE.map((p) => p.id)).size).toBe(28);
    for (const p of PEOPLE) {
      for (const text of [p.name, p.title, p.line, ...(p.epithet ? [p.epithet] : [])]) {
        expect(text.ja, p.id).not.toBe('');
        expect(text.en, p.id).not.toBe('');
      }
    }
  });

  it('指示書のとおりの名前・肩書き・ひとこと（いくつか）', () => {
    expect(getPerson('mireille')).toMatchObject({ no: 1, name: { ja: 'ミレイユ' }, title: { ja: 'となりに住むカードバトラー' }, line: { ja: '困ったら、いつでも声をかけてね。' } });
    expect(getPerson('alvin')).toMatchObject({ no: 28, epithet: { ja: '無敗の王者' }, title: { ja: '現チャンピオン' } });
    expect(getPerson('ernst')?.epithet).toBeUndefined();
  });

  it('会話の話し手・大会の相手・ダンジョンのバトラーが人物につながる', () => {
    expect(personOfSpeaker('neighbor_guide')?.id).toBe('mireille');
    expect(personOfSpeaker('resident_d')?.id).toBe('rosalie');
    // ブルーノ（もと住人C）は住宅C を管理局に置き換えたので、データだけ
    expect(getPerson('bruno')?.inGame).toBe(false);
    const rounds = TOURNAMENTS.flatMap((t) => t.rounds).map((r) => personOfOpponent(r)?.id);
    expect(rounds).toEqual(['noel', 'viktor', 'sienna', 'dario', 'isabella', 'gordon']);
    expect([0, 1, 2].map((i) => personOfOpponent(runNpcOpponent(0, i))?.id)).toEqual(['flora', 'oscar', 'kyle']);
    expect(personOfOpponent(runGuardianOpponent(0))?.id).toBe('guardian');
    // 試験の先生（ガレス）は街の人なので、対戦の名刺にはしない
    expect(personOfOpponent(EXAM_OPPONENT)).toBeUndefined();
  });

  it('見えない番人の名前は「？？？」のまま（日本語・英語とも）', () => {
    const guardian = getPerson('guardian');
    if (!guardian) throw new Error('guardian');
    expect(personName(guardian)).toBe('？？？');
    expect(opponentName(runGuardianOpponent(1))).toBe('？？？');
    setLanguage('en');
    expect(personName(guardian)).toBe('???');
    setLanguage('ja');
  });

  it('相手の名前は人物の名前（「（仮）」なし）', () => {
    expect(opponentName(TOURNAMENTS[0]!.rounds[0]!)).toBe('ノエル');
    expect(opponentName(runNpcOpponent(0, 1))).toBe('オスカー');
  });
});

describe('名刺の登録・対戦成績', () => {
  it('街の人は話したとき、対戦する人は対戦したとき（勝ち負けは問わない）に登録。一度登録したら消えない', () => {
    let s = fresh();
    expect(metCount(s)).toBe(0);
    s = meetSpeaker(s, 'clerk');
    expect(isMet(s, 'nina')).toBe(true);
    expect(meetSpeaker(s, 'clerk')).toBe(s);
    // 話し手でない（system・管理局の受付）は登録しない
    expect(meetSpeaker(s, 'system')).toBe(s);
    expect(meetSpeaker(s, 'bureau_clerk')).toBe(s);
    const noel = TOURNAMENTS[0]!.rounds[0]!;
    s = recordPersonBattle(s, noel, 'opponent');
    expect(isMet(s, 'noel')).toBe(true);
    expect(metCount(s)).toBe(2);
  });

  it('対戦成績：勝ち・負けを数える（引き分けは数えない）。使うモンスターは最後の対戦の3体', () => {
    const noel = TOURNAMENTS[0]!.rounds[0]!;
    let s = fresh();
    s = recordPersonBattle(s, noel, 'player');
    s = recordPersonBattle(s, noel, 'player');
    s = recordPersonBattle(s, noel, 'opponent');
    s = recordPersonBattle(s, noel, 'draw');
    expect(personRecord(s, 'noel')).toMatchObject({ wins: 2, losses: 1, monsters: [...noel.monsters] });
    // 人物でない相手（ダンジョンの魔物・練習相手）は何もしない
    expect(recordPersonBattle(s, EXAM_OPPONENT, 'player')).toBe(s);
  });

  it('ダンジョンの人から手に入れた技カードを覚える（同じカードは1回）', () => {
    const flora = runNpcOpponent(0, 0);
    const card = skillsOf(flora.monsters[0]!)[0]!.id;
    let s = recordPersonBattle(fresh(), flora, 'player');
    s = recordPersonCard(s, flora, card);
    s = recordPersonCard(s, flora, card);
    expect(personRecord(s, 'flora').cards).toEqual([card]);
  });

  it('保存して読み直しても残る。前の形式（version 15）は大会の記録から相手を登録する', () => {
    const s = recordPersonBattle(meetSpeaker(fresh(), 'teacher'), TOURNAMENTS[0]!.rounds[1]!, 'player');
    const loaded = normalizeSave(JSON.parse(JSON.stringify(s)));
    expect(loaded?.peopleBook.met).toEqual(['gareth', 'viktor']);
    expect(loaded?.peopleBook.records.viktor?.wins).toBe(1);

    const { peopleBook: _pb, cardsSeen: _cs, ...rest } = fresh();
    const old = { ...rest, version: 15, tournaments: { 'tournament-e': { entries: 3, wins: 2, firstWinClaimed: true }, 'tournament-d': { entries: 1, wins: 0, firstWinClaimed: false } } };
    const migrated = normalizeSave(old);
    expect(migrated?.version).toBe(SAVE_VERSION);
    expect(migrated?.peopleBook.met).toEqual(['noel', 'viktor', 'sienna', 'dario']);
    expect(migrated?.peopleBook.records.sienna?.wins).toBe(2);
    // 街の人は話したか分からないので未登録
    expect(migrated && isMet(migrated, 'mireille')).toBe(false);
    // いま持っているカードは NEW にしない
    expect(migrated && Object.keys(migrated.collection).some((id) => isCardNew(migrated, id))).toBe(false);
  });
});

describe('カード図鑑', () => {
  const entries = cardBookEntries();

  it('すべてのカードが1回ずつ載る。番号は 1 から続き、仮のカードは番号なしで最後', () => {
    expect(entries.length).toBe(MONSTERS.length + SKILLS.length + SUPPORTS.length);
    expect(new Set(entries.map((e) => e.card.id)).size).toBe(entries.length);
    const numbered = entries.filter((e) => e.no !== null);
    expect(numbered.map((e) => e.no)).toEqual(numbered.map((_, i) => i + 1));
    const firstTemp = entries.findIndex((e) => e.no === null);
    expect(entries.slice(firstTemp).every((e) => e.no === null && e.section.kind === 'temp')).toBe(true);
    for (const e of entries.filter((x) => x.section.kind === 'temp')) expect(e.card.name.startsWith('仮'), e.card.id).toBe(true);
  });

  it('モンスターごとに本体 → 技の順。最後に隠しモンスター', () => {
    expect(entries[0]!.card.id).toBe(NUMBERED_MONSTERS[0]);
    expect(entries[0]!.no).toBe(1);
    const soramoSkills = skillsOf(NUMBERED_MONSTERS[0]!).length;
    expect(entries[1 + soramoSkills]!.card.id).toBe(NUMBERED_MONSTERS[1]);
    const numbered = entries.filter((e) => e.no !== null);
    const hidden = numbered.filter((e) => e.section.kind === 'hidden');
    expect(hidden[0]!.card.id).toBe(HIDDEN_MONSTER_ID);
    expect(numbered.slice(-hidden.length)).toEqual(hidden);
  });

  it('未入手は「？？？」。隠しモンスターは復元するまで「？？？」', () => {
    const s = fresh();
    const hidden = entries.find((e) => e.card.id === HIDDEN_MONSTER_ID)!;
    expect(isUnknown(hidden, { [HIDDEN_MONSTER_ID]: 1 }, false)).toBe(true);
    expect(isUnknown(hidden, { [HIDDEN_MONSTER_ID]: 1 }, true)).toBe(false);
    const owned = entries.find((e) => (s.collection[e.card.id] ?? 0) > 0)!;
    expect(isUnknown(owned, s.collection, false)).toBe(false);
  });

  it('完成の印：モンスター1体分（本体＋技すべて）を1枚ずつ以上', () => {
    const id = NUMBERED_MONSTERS[0]!;
    const all = Object.fromEntries([id, ...skillsOf(id).map((x) => x.id)].map((c) => [c, 1]));
    const key = sectionKey({ kind: 'monster', monsterId: id });
    expect(completeSections(all, entries).has(key)).toBe(true);
    const lack = { ...all, [skillsOf(id)[3]!.id]: 0 };
    expect(completeSections(lack, entries).has(key)).toBe(false);
  });

  it('NEW：手に入れて詳しい画面で見るまで。見たら消える', () => {
    const s = fresh();
    const card = skillsOf(NUMBERED_MONSTERS[5]!)[0]!.id;
    const got = { ...s, collection: { ...s.collection, [card]: (s.collection[card] ?? 0) + 1 } };
    const isNewBefore = !s.cardsSeen.includes(card);
    expect(isCardNew(got, card)).toBe(isNewBefore);
    expect(isCardNew(markCardSeen(got, card), card)).toBe(false);
    // 初めから持っているカードは NEW にしない
    expect(Object.keys(s.collection).some((id) => isCardNew(s, id))).toBe(false);
  });

  it('タブ：すべて／モンスター／技／サポート', () => {
    const count = (f: 'all' | 'monster' | 'skill' | 'support'): number => entries.filter((e) => matchesFilter(e, f)).length;
    expect(count('monster') + count('skill') + count('support')).toBe(count('all'));
    expect(count('support')).toBe(SUPPORTS.length);
  });
});
