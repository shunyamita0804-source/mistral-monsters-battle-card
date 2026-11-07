import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPlayCard, skillsOf } from '../src/data/cards.ts';
import { BOOSTERS, type BoosterKey } from '../src/data/introV2.ts';
import { AJ_QA_SKILLS, AJ_SKILLS } from '../src/data/skillRebuildAJ.ts';
import type { CpuSkill } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, createBattle, manaOf, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/**
 * 指示書 BN の試遊（数字は報告するだけ。カード・ルールの数字は変えない）。PLAYTEST=回数（ふだんは 1）・PLAYTEST_OUT に JSON。PLAYTEST_SUBJECT でモンスターを変えられる（ふだんはノウス）。
 * 1体入れ替え（指示書 AJ・AX・BH・BK・BL・BM と同じやり方：3箱 × 3か所 × 相手の3箱 × 先攻・後攻 × 回数）。レア抜き・レアあり。腕前 A どうし。
 * ノウスの側の1対戦あたり：減らした相手のマナ（02 マナをすう・04 うずまくつぼ・06 からっぽのつぼ 別）・からっぽのつぼが当たった回数・
 * ときをすいとるで削った枚数・ぜんちぜんのうで選んだカード・ずのうのせんこうの回数。山札切れで決まった対戦の割合と、ノウスの側が山札切れで勝った割合。
 * 相手が「マナ 0〜1 のまま自分の攻撃の手番」を3回以上続けた対戦の割合（マナを吸われて何もできない対戦になっていないか）
 */
const GAMES = Number(process.env.PLAYTEST ?? 1);
const KEYS = BOOSTERS.map((b) => b.key);
const MAX_STEPS = 6000;
const SKILL: CpuSkill = (process.env.PLAYTEST_SKILL ?? 'A') as CpuSkill;
const SUBJECT = process.env.PLAYTEST_SUBJECT ?? 'mon-nous';
const SIPHON = 'skl-nous-02';
const SWIRL = 'skl-nous-04';
const EMPTY = 'skl-nous-06';
const FLASH = 'skl-nous-07';
const DRAINERS = [SIPHON, SWIRL, EMPTY];

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
  deckOutWins: number;
  turns: number;
  drained: Record<string, number>;
  drainHits: Record<string, number>;
  drainUses: Record<string, number>;
  mill: number;
  milled: number;
  search: number;
  picks: Record<string, number>;
  flash: number;
  starved3Games: number;
  maxStarved: number;
  foeTurns: number;
  foeLowTurns: number;
}
const empty = (): Count => ({
  games: 0, wins: 0, deckOut: 0, deckOutWins: 0, turns: 0, drained: {}, drainHits: {}, drainUses: {}, mill: 0, milled: 0, search: 0, picks: {}, flash: 0,
  starved3Games: 0, maxStarved: 0, foeTurns: 0, foeLowTurns: 0,
});
const add = (r: Record<string, number>, k: string, n = 1): void => {
  r[k] = (r[k] ?? 0) + n;
};

function play(a: Deck, b: Deck, seed: number, first: Side, c: Count): void {
  let s: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b }, seed, first);
  /** いま守りの手番の、ノウスのマナを減らす攻撃 */
  let mineAttack: string | null = null;
  /** 相手の攻撃の手番を数えた最後の turn（1手番に1回だけ数える） */
  let seenFoeTurn = -1;
  let starved = 0;
  let best = 0;
  for (let i = 0; i < MAX_STEPS && s.phase !== 'ended'; i++) {
    const side = actingSide(s);
    if (!side) break;
    // 相手（opponent）の攻撃の手番のはじめのマナ
    if (s.active === 'opponent' && s.phase === 'main' && s.turn !== seenFoeTurn) {
      seenFoeTurn = s.turn;
      c.foeTurns++;
      if (manaOf(s.sides.opponent) <= 1) {
        c.foeLowTurns++;
        starved++;
        best = Math.max(best, starved);
      } else starved = 0;
    }
    const action = chooseAction(s, side, 'normal', SKILL);
    if (!action) break;
    if (side === 'player' && action.type === 'useCard' && s.phase === 'main') {
      const used = s.sides.player.hand.find((x) => x.uid === action.cardUid);
      const k = used ? getPlayCard(used.cardId) : null;
      if (k?.kind === 'skill' && k.monsterId === SUBJECT) {
        if (k.effect.type === 'millDeck') c.mill++;
        if (k.effect.type === 'searchAny') c.search++;
        if (k.id === FLASH) c.flash++;
        if (DRAINERS.includes(k.id)) {
          mineAttack = k.id;
          add(c.drainUses, k.id);
        }
      }
    }
    const logBefore = s.log.length;
    /** この行動の前の相手のマナ（からっぽのつぼで0にした量。守りのカードのマナは前の行動で払い済み） */
    const foeManaBefore = manaOf(s.sides.opponent);
    s = applyAction(s, action);
    const logs = s.log.slice(logBefore).map((l) => l.text);
    for (const l of logs) {
      const m = /の山札の上から(\d+)枚が捨て札になった/.exec(l);
      if (m && l.startsWith('相手')) c.milled += Number(m[1]);
      const p = /^あなたはぜんちぜんのうで、山札から(.+)を手札に加えた。$/.exec(l);
      if (p) add(c.picks, p[1] as string);
    }
    if (mineAttack && s.phase !== 'defense') {
      for (const l of logs) {
        const m = /^相手のマナが(\d+)減った。$/.exec(l);
        if (m) {
          add(c.drained, mineAttack, Number(m[1]));
          add(c.drainHits, mineAttack);
        }
        // からっぽのつぼ（指示書 BO で記録の文が「相手のマナが0になった。」「相手のマナはもう0だった。」に）
        if (l === '相手のマナが0になった。' || l === '相手のマナはもう0だった。') {
          add(c.drained, mineAttack, foeManaBefore);
          add(c.drainHits, mineAttack);
        }
      }
      mineAttack = null;
    }
  }
  c.games++;
  c.turns += s.turn;
  if (best >= 3) c.starved3Games++;
  c.maxStarved = Math.max(c.maxStarved, best);
  if (s.winner === 'player') c.wins++;
  if (s.endReason === 'deckOut') c.deckOut++;
  if (s.endReason === 'deckOut' && s.winner === 'player') c.deckOutWins++;
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);
const per = (n: number, of: number): number => Math.round((n / Math.max(1, of)) * 1000) / 1000;
const summary = (c: Count): Record<string, unknown> => ({
  games: c.games,
  win: pct(c.wins, c.games),
  deckOut: pct(c.deckOut, c.games),
  deckOutWin: pct(c.deckOutWins, c.games),
  avgTurns: Math.round((c.turns / Math.max(1, c.games)) * 10) / 10,
  drainedPerGame: Object.fromEntries(DRAINERS.map((id) => [id, per(c.drained[id] ?? 0, c.games)])),
  drainUsesPerGame: Object.fromEntries(DRAINERS.map((id) => [id, per(c.drainUses[id] ?? 0, c.games)])),
  drainHitRate: Object.fromEntries(DRAINERS.map((id) => [id, pct(c.drainHits[id] ?? 0, c.drainUses[id] ?? 0)])),
  emptyHitsPerGame: per(c.drainHits[EMPTY] ?? 0, c.games),
  millPerGame: per(c.mill, c.games),
  milledPerGame: per(c.milled, c.games),
  searchPerGame: per(c.search, c.games),
  picks: Object.fromEntries(Object.entries(c.picks).sort((x, y) => y[1] - x[1])),
  flashPerGame: per(c.flash, c.games),
  foeLowTurnRate: pct(c.foeLowTurns, c.foeTurns),
  starved3Rate: pct(c.starved3Games, c.games),
  maxStarved: c.maxStarved,
});

function swapSlots(): { key: BoosterKey; slot: number }[] {
  return BOOSTERS.filter((b) => !b.monsters.includes(SUBJECT)).flatMap((b) => [0, 1, 2].map((slot) => ({ key: b.key, slot })));
}

describe('BN の試遊', () => {
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
