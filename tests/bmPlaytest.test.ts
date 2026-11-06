import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPlayCard, skillsOf } from '../src/data/cards.ts';
import { BOOSTERS, type BoosterKey } from '../src/data/introV2.ts';
import { AJ_QA_SKILLS, AJ_SKILLS } from '../src/data/skillRebuildAJ.ts';
import type { CpuSkill } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, createBattle, findMonster, type BattleState, type PendingAttack, type Side } from '../src/game/battle/engine.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/**
 * 指示書 BM の試遊（数字は報告するだけ。カード・ルールの数字は変えない）。PLAYTEST=回数（ふだんは 1）・PLAYTEST_OUT に JSON。PLAYTEST_SUBJECT でモンスターを変えられる（ふだんはフギン）。
 * 1体入れ替え（指示書 AJ・AX・BH・BK・BL と同じやり方：3箱 × 3か所 × 相手の3箱 × 先攻・後攻 × 回数）。レア抜き・レアあり。腕前 A どうし。
 * フギンの側の1対戦あたり：ちえのささやきの回数（回避を手札に加えた／1枚引いた）・はねやすめの回数（そのあと0マナで回避した）・
 * 回避の回数（かぜよみ・さきよみ別）と、フギンへの攻撃を回避した割合・ひかりものをぬすむで減らしたマナ・よみのまなざしで封じた回数・すいりのいちげきの回数・
 * 3回以上続けて回避した対戦の割合。山札切れで決まった対戦の割合
 */
const GAMES = Number(process.env.PLAYTEST ?? 1);
const KEYS = BOOSTERS.map((b) => b.key);
const MAX_STEPS = 6000;
const SKILL: CpuSkill = (process.env.PLAYTEST_SKILL ?? 'A') as CpuSkill;
const SUBJECT = process.env.PLAYTEST_SUBJECT ?? 'mon-huginn';
const WIND = 'skl-huginn-11';
const FORESEE = 'skl-huginn-12';
const GAZE = 'skl-huginn-06';
const STEAL = 'skl-huginn-08';
const DEDUCE = 'skl-huginn-09';

/** 入れ替えの16枚（tests/bhPlaytest.test.ts の bhPlaytest16 と同じ） */
function playtest16(monsterId: string, withRare: boolean): { id: string; copies: number }[] {
  const rare = new Set((AJ_SKILLS[monsterId] ?? AJ_QA_SKILLS[monsterId] ?? []).filter((r) => r.rare).map((r) => r.id));
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

interface Count {
  games: number;
  wins: number;
  deckOut: number;
  turns: number;
  search: number;
  searchAdded: number;
  searchDrew: number;
  rest: number;
  restFree: number;
  wind: number;
  foresee: number;
  attacksOnSubject: number;
  evadedOnSubject: number;
  streak3Games: number;
  maxStreak: number;
  stolen: number;
  gazeSeals: number;
  deduce: number;
}
const empty = (): Count => ({
  games: 0, wins: 0, deckOut: 0, turns: 0, search: 0, searchAdded: 0, searchDrew: 0, rest: 0, restFree: 0,
  wind: 0, foresee: 0, attacksOnSubject: 0, evadedOnSubject: 0, streak3Games: 0, maxStreak: 0, stolen: 0, gazeSeals: 0, deduce: 0,
});

function play(a: Deck, b: Deck, seed: number, first: Side, c: Count): void {
  let s: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b }, seed, first);
  /** いま守りの手番の、フギンへの攻撃（守りが終わったら回避したかを見る） */
  let onSubject: PendingAttack | null = null;
  /** いま守りの手番の、フギンの攻撃（よみのまなざし・ひかりものをぬすむ） */
  let mineAttack: string | null = null;
  let streak = 0;
  let best = 0;
  for (let i = 0; i < MAX_STEPS && s.phase !== 'ended'; i++) {
    const side = actingSide(s);
    if (!side) break;
    const action = chooseAction(s, side, 'normal', SKILL);
    if (!action) break;
    if (side === 'player' && action.type === 'useCard' && s.phase === 'main') {
      const used = s.sides.player.hand.find((x) => x.uid === action.cardUid);
      const k = used ? getPlayCard(used.cardId) : null;
      if (k?.kind === 'skill' && k.monsterId === SUBJECT) {
        if (k.effect.type === 'searchEvade') c.search++;
        if (k.effect.type === 'featherRest') c.rest++;
        if (k.id === DEDUCE) c.deduce++;
        if (k.id === GAZE || k.id === STEAL) mineAttack = k.id;
      }
    }
    if (side === 'player' && action.type === 'defend' && action.cardUid) {
      const used = s.sides.player.hand.find((x) => x.uid === action.cardUid);
      if (used?.cardId === WIND) c.wind++;
      if (used?.cardId === FORESEE) c.foresee++;
    }
    const logBefore = s.log.length;
    s = applyAction(s, action);
    const logs = s.log.slice(logBefore).map((l) => l.text);
    c.searchAdded += logs.filter((l) => l.includes('はちえのささやきで、山札から')).length;
    c.searchDrew += logs.filter((l) => l.includes('山札に回避のカードが無い。かわりに1枚引いた。')).length;
    c.restFree += logs.filter((l) => l.endsWith('ははねやすめの力で、マナを使わずに回避した。') && l.startsWith('フギン')).length;
    // フギンへの攻撃：守りの手番に入ったら覚えておき、守りが終わったら回避したかを見る（続けて回避した回数も）
    if (s.phase === 'defense' && s.pending && s.pending.attacker === 'opponent' && findMonster(s, s.pending.targetUid)?.monster.cardId === SUBJECT) onSubject = s.pending;
    if (onSubject && s.phase !== 'defense') {
      c.attacksOnSubject++;
      const evaded = onSubject.responses.some((id) => getPlayCard(id).effect.type === 'evade');
      if (evaded) {
        c.evadedOnSubject++;
        streak++;
        best = Math.max(best, streak);
      } else streak = 0;
      onSubject = null;
    }
    if (mineAttack && s.phase !== 'defense') {
      if (mineAttack === GAZE) c.gazeSeals += logs.filter((l) => l.endsWith('は次のターン攻撃できない。')).length;
      if (mineAttack === STEAL) {
        for (const l of logs) {
          const m = /のマナが(\d+)減った。$/.exec(l);
          if (m) c.stolen += Number(m[1]);
        }
      }
      mineAttack = null;
    }
  }
  c.games++;
  c.turns += s.turn;
  if (best >= 3) c.streak3Games++;
  c.maxStreak = Math.max(c.maxStreak, best);
  if (s.winner === 'player') c.wins++;
  if (s.endReason === 'deckOut') c.deckOut++;
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);
const per = (n: number, of: number): number => Math.round((n / Math.max(1, of)) * 1000) / 1000;
const summary = (c: Count): Record<string, number> => ({
  games: c.games,
  win: pct(c.wins, c.games),
  deckOut: pct(c.deckOut, c.games),
  avgTurns: Math.round((c.turns / Math.max(1, c.games)) * 10) / 10,
  searchPerGame: per(c.search, c.games),
  searchAddedRate: pct(c.searchAdded, c.search),
  searchDrewRate: pct(c.searchDrew, c.search),
  restPerGame: per(c.rest, c.games),
  restFreeRate: pct(c.restFree, c.rest),
  windPerGame: per(c.wind, c.games),
  foreseePerGame: per(c.foresee, c.games),
  attacksOnSubjectPerGame: per(c.attacksOnSubject, c.games),
  evadeRate: pct(c.evadedOnSubject, c.attacksOnSubject),
  streak3Rate: pct(c.streak3Games, c.games),
  maxStreak: c.maxStreak,
  stolenManaPerGame: per(c.stolen, c.games),
  gazeSealsPerGame: per(c.gazeSeals, c.games),
  deducePerGame: per(c.deduce, c.games),
});

function swapSlots(): { key: BoosterKey; slot: number }[] {
  return BOOSTERS.filter((b) => !b.monsters.includes(SUBJECT)).flatMap((b) => [0, 1, 2].map((slot) => ({ key: b.key, slot })));
}

describe('BM の試遊', () => {
  it('入れ替えの16枚は16枚。入れ替えたデッキは山札60枚でルールに合う', () => {
    for (const withRare of [false, true]) expect(playtest16(SUBJECT, withRare).reduce((n, x) => n + x.copies, 0)).toBe(16);
    for (const { key, slot } of swapSlots()) {
      const d = swapDeck(key, slot, SUBJECT, playtest16(SUBJECT, false));
      expect(d.skills).toHaveLength(60);
      expect(isDeckValid(d, countCards([...d.monsters, ...d.skills])), `${key}#${slot}`).toBe(true);
    }
  });

  it(`1体入れ替え（各組み合わせ ${GAMES} 回）`, () => {
    const out: Record<string, unknown> = { games: GAMES, skill: SKILL, subject: SUBJECT };
    let seed = 1;
    let total = 0;
    const parts = (process.env.PLAYTEST_PART ?? 'swap,swapRare').split(',');
    for (const withRare of [false, true]) {
      if (!parts.includes(withRare ? 'swapRare' : 'swap')) continue;
      const c = empty();
      for (const { key, slot } of swapSlots()) {
        const deck = swapDeck(key, slot, SUBJECT, playtest16(SUBJECT, withRare));
        for (const opp of KEYS) for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(deck, boosterDeck(opp), seed++, first, c);
      }
      out[withRare ? 'swapRare' : 'swap'] = summary(c);
      total += c.games;
    }
    const file = process.env.PLAYTEST_OUT;
    if (file) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(out, null, 1));
    }
    expect(total).toBeGreaterThan(0);
  }, 7_200_000);
});
