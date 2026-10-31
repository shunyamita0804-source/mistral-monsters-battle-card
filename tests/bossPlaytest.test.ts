import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPlayCard } from '../src/data/cards.ts';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { RUN_DUNGEONS } from '../src/data/dungeonRun.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import type { CpuSkill, OpponentDefinition } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, createBattle, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { buildOpponentDeck, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/**
 * ダンジョンのボス8人の自動の試遊（2026-10-30 指示書 V「ボスのデッキ：切り札の技を2枚ずつ」の強さ合わせ）。
 * U のゼフィラ（tests/zephyraPlaytest.test.ts）と同じしかた：最初の手持ち（3つの箱）× ボス。先攻・後攻は半分ずつ・両方とも CPU の思考。
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。npm run playtest:bosses（PLAYTEST=200）で 200 回ずつ（PLAYTEST_OUT に JSON）。
 * PLAYTEST_SCALES="0.5:2:0.05" を付けると、ボスごとに lifeScale を変えて測る（強さを合わせる値を探す）。
 * PLAYTEST_NO_ACE=1 を付けると、切り札（ace）を使わない前のデッキの作り方で測る（直す前の勝つ割合）
 * ツムジ（ゼフィラ）の Wひっかきを2回続けて使った回数・かぜのりの回数も数える
 * 2026-10-30 指示書 W：決着の理由（倒して／山札切れ）・相手の行動不可（まきつく・こおりのいき・ふぶき）でプレイヤーのモンスターが動けなかった手番も数える。
 * PLAYTEST_BOSSES="enc-ice-boss" で測るボスをしぼれる。PLAYTEST_BOSS_SKILL="B" でボスの腕前を変えて測れる（2026-10-31）
 */
const GAMES = Number(process.env.PLAYTEST ?? 2);
const KEYS = BOOSTERS.map((b) => b.key);
const BOSS_IDS = Object.values(RUN_DUNGEONS).map((c) => c.bossId);

interface Tally {
  wins: number;
  losses: number;
  draws: number;
  /** 決着の理由：プレイヤーが相手3体を倒して勝った／相手の山札切れで勝った／倒されて負けた／自分の山札切れで負けた */
  koWins: number;
  deckOutWins: number;
  koLosses: number;
  deckOutLosses: number;
  /** 対戦の手番の数（両方の合計） */
  turns: number;
  doubleScratch: number;
  windRide: number;
  /** 相手が行動不可の技（stunTarget）を使った回数 */
  stunCasts: number;
  /** プレイヤーの手番の数・そのうち行動不可のモンスターが1体でもいた手番の数 */
  playerTurns: number;
  stunnedTurns: number;
  /** プレイヤーの生きているモンスター × 手番の数・そのうち行動不可だった数 */
  monsterTurns: number;
  stunnedMonsterTurns: number;
  /** 同じモンスターが続けて（自分の手番を続けて）動けなかった回数：続いた長さの合計・続いた回の数・いちばん長い */
  streakSum: number;
  streakCount: number;
  streakMax: number;
  /** 2手番以上続けて動けなかった回の数 */
  streak2: number;
  /** ボスの捨て身の反動（2026-10-31 指示書 AB。シシエン）：反動の回数・反動で倒れた回数・反動で倒れてボスが負けた対戦の数 */
  recoil: number;
  recoilKo: number;
  recoilLoss: number;
}

const emptyTally = (): Tally => ({
  wins: 0, losses: 0, draws: 0, koWins: 0, deckOutWins: 0, koLosses: 0, deckOutLosses: 0, turns: 0,
  doubleScratch: 0, windRide: 0, stunCasts: 0, playerTurns: 0, stunnedTurns: 0, monsterTurns: 0, stunnedMonsterTurns: 0, streakSum: 0, streakCount: 0, streakMax: 0, streak2: 0, recoil: 0, recoilKo: 0, recoilLoss: 0,
});

const MAX_STEPS = 6000;

/** 2026-10-30 指示書 Z：ボスは定義の構え（ai）と腕前（skill）で、プレイヤー側は腕前 B（構えはふつう） */
function play(a: Deck, b: Deck, lifeScale: number, seed: number, first: Side, t: Tally, boss?: OpponentDefinition): void {
  let state: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b, lifeScale }, seed, first);
  let seenTurn = -1;
  // モンスターごとの、いま続いている「動けなかった手番」の長さ
  const streak = new Map<string, number>();
  const closeStreak = (uid: string): void => {
    const n = streak.get(uid) ?? 0;
    if (n > 0) {
      t.streakSum += n;
      t.streakCount++;
      t.streakMax = Math.max(t.streakMax, n);
      if (n >= 2) t.streak2++;
    }
    streak.delete(uid);
  };
  for (let i = 0; i < MAX_STEPS && state.phase !== 'ended'; i++) {
    if (state.active === 'player' && state.turn !== seenTurn && state.phase === 'main') {
      seenTurn = state.turn;
      t.playerTurns++;
      let any = false;
      for (const m of state.sides.player.monsters) {
        if (m.life <= 0) {
          closeStreak(m.uid);
          continue;
        }
        t.monsterTurns++;
        if (m.stunnedTurn === state.turn) {
          any = true;
          t.stunnedMonsterTurns++;
          streak.set(m.uid, (streak.get(m.uid) ?? 0) + 1);
        } else closeStreak(m.uid);
      }
      if (any) t.stunnedTurns++;
    }
    const side = actingSide(state);
    if (!side) break;
    const action = side === 'opponent' ? chooseAction(state, side, boss?.ai, boss?.skill ?? 'B') : chooseAction(state, side, 'normal', 'B');
    if (!action) break;
    if (side === 'opponent' && action.type === 'useCard' && state.phase === 'main') {
      const hand = state.sides.opponent.hand.find((c) => c.uid === action.cardUid);
      const card = hand ? getPlayCard(hand.cardId) : null;
      const user = state.sides.opponent.monsters.find((m) => m.uid === action.userUid);
      if (card?.kind === 'skill' && card.effect.type === 'attack' && card.effect.chain && user?.acted) t.doubleScratch++;
      if (card?.kind === 'skill' && card.effect.type === 'windRide') t.windRide++;
      if (card?.kind === 'skill' && card.effect.type === 'attack' && card.effect.stunTarget) t.stunCasts++;
    }
    const before = state;
    state = applyAction(state, action);
    for (const f of state.fx) {
      if (f.seq <= before.fxSeq || f.kind !== 'recoil' || f.side !== 'opponent') continue;
      t.recoil++;
      if (state.sides.opponent.monsters.some((m) => m.life === 0 && (before.sides.opponent.monsters.find((x) => x.uid === m.uid)?.life ?? 0) > 0)) {
        t.recoilKo++;
        if (state.winner === 'player') t.recoilLoss++;
      }
    }
  }
  for (const uid of [...streak.keys()]) closeStreak(uid);
  t.turns += state.turn;
  if (state.winner === 'player') {
    t.wins++;
    if (state.endReason === 'deckOut') t.deckOutWins++;
    else t.koWins++;
  } else if (state.winner === 'opponent') {
    t.losses++;
    if (state.endReason === 'deckOut') t.deckOutLosses++;
    else t.koLosses++;
  } else t.draws++;
}

/** 最初の手持ち3箱 × games 回（箱ごとに先攻・後攻は半分ずつ）。seed はボスごとに決まった値 */
function series(boss: OpponentDefinition, lifeScale: number, games: number, seedBase: number): Record<string, Tally> {
  const deck = buildOpponentDeck(boss);
  const out: Record<string, Tally> = {};
  KEYS.forEach((key, k) => {
    const t = emptyTally();
    for (let i = 0; i < games; i++) play(boosterDeck(key), deck, lifeScale, seedBase + k * 100000 + i * 7919, i % 2 === 0 ? 'player' : 'opponent', t, boss);
    out[key] = t;
  });
  return out;
}

/** プレイヤーが勝つ割合（3箱の平均・％） */
const rate = (r: Record<string, Tally>, games: number): number => Object.values(r).reduce((n, t) => n + t.wins, 0) / (games * KEYS.length) * 100;

/** 3箱の合計 */
function total(r: Record<string, Tally>): Tally {
  const sum = emptyTally();
  for (const t of Object.values(r)) {
    for (const k of Object.keys(sum) as (keyof Tally)[]) sum[k] = k === 'streakMax' ? Math.max(sum[k], t[k]) : sum[k] + t[k];
  }
  return sum;
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);

/** 決着の理由の割合（全部の対戦のうち・％）と、行動不可の数 */
function summary(r: Record<string, Tally>): Record<string, number> {
  const t = total(r);
  const games = t.wins + t.losses + t.draws;
  return {
    koWin: pct(t.koWins, games),
    deckOutWin: pct(t.deckOutWins, games),
    koLoss: pct(t.koLosses, games),
    deckOutLoss: pct(t.deckOutLosses, games),
    draw: pct(t.draws, games),
    avgTurns: Math.round((t.turns / Math.max(1, games)) * 10) / 10,
    stunCastsPerGame: Math.round((t.stunCasts / Math.max(1, games)) * 100) / 100,
    stunnedTurnRate: pct(t.stunnedTurns, t.playerTurns),
    stunnedMonsterTurnRate: pct(t.stunnedMonsterTurns, t.monsterTurns),
    streakMax: t.streakMax,
    streakAvg: t.streakCount === 0 ? 0 : Math.round((t.streakSum / t.streakCount) * 100) / 100,
    streakCount: t.streakCount,
    streak2plus: t.streak2,
    recoilPerGame: Math.round((t.recoil / Math.max(1, games)) * 100) / 100,
    recoilKoPerGame: Math.round((t.recoilKo / Math.max(1, games)) * 100) / 100,
    recoilLossGames: pct(t.recoilLoss, games),
  };
}

describe('ボス8人の試遊（自動の対戦）', () => {
  it(`ボスごとに ${GAMES} 回ずつ：最初の手持ちで勝つ割合`, () => {
    const scan = process.env.PLAYTEST_SCALES?.split(':').map(Number);
    const bosses: Record<string, unknown> = {};
    const only = process.env.PLAYTEST_BOSSES?.split(',');
    BOSS_IDS.forEach((id, b) => {
      if (only && !only.includes(id)) return;
      const def = ENCOUNTERS[id] as OpponentDefinition;
      const { ace: _ace, ...noAce } = def;
      const boss0: OpponentDefinition = process.env.PLAYTEST_NO_ACE ? noAce : def;
      // PLAYTEST_BOSS_SKILL="B" でボスの腕前を変えて測る（2026-10-31 指示書 AB：バルカの合わせ込みのくらべ。ゲームの値は変えない）
      const boss: OpponentDefinition = process.env.PLAYTEST_BOSS_SKILL ? { ...boss0, skill: process.env.PLAYTEST_BOSS_SKILL as CpuSkill } : boss0;
      const seedBase = 30000 + b * 1000;
      const current = series(boss, boss.lifeScale, GAMES, seedBase);
      const row: Record<string, unknown> = {
        name: boss.name,
        monsters: boss.monsters,
        ace: boss.ace ?? null,
        lifeScale: boss.lifeScale,
        rate: rate(current, GAMES),
        summary: summary(current),
        byBox: current,
      };
      if (scan && scan.length === 3) {
        const [from, to, step] = scan as [number, number, number];
        const rates: Record<string, number> = {};
        const reasons: Record<string, Record<string, number>> = {};
        for (let s = from; s <= to + 1e-9; s += step) {
          const scale = Math.round(s * 100) / 100;
          const r = series(boss, scale, GAMES, seedBase);
          rates[scale.toFixed(2)] = rate(r, GAMES);
          reasons[scale.toFixed(2)] = summary(r);
        }
        row.scan = rates;
        row.scanSummary = reasons;
      }
      bosses[id] = row;
    });
    if (process.env.PLAYTEST_OUT) {
      mkdirSync(dirname(process.env.PLAYTEST_OUT), { recursive: true });
      writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify({ games: GAMES, bosses }, null, 1));
    }
    expect(Object.keys(bosses)).toHaveLength(only ? only.length : 9); // 2026-11-01 指示書 AH：雷の高原のステラで9人
  }, 3_600_000);
});
