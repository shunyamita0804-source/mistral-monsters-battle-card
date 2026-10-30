import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPlayCard } from '../src/data/cards.ts';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { RUN_DUNGEONS } from '../src/data/dungeonRun.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import type { OpponentDefinition } from '../src/data/tournaments.ts';
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
 */
const GAMES = Number(process.env.PLAYTEST ?? 2);
const KEYS = BOOSTERS.map((b) => b.key);
const BOSS_IDS = Object.values(RUN_DUNGEONS).map((c) => c.bossId);

interface Tally {
  wins: number;
  losses: number;
  draws: number;
  doubleScratch: number;
  windRide: number;
}

const MAX_STEPS = 6000;

function play(a: Deck, b: Deck, lifeScale: number, seed: number, first: Side, t: Tally): void {
  let state: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b, lifeScale }, seed, first);
  for (let i = 0; i < MAX_STEPS && state.phase !== 'ended'; i++) {
    const side = actingSide(state);
    if (!side) break;
    const action = chooseAction(state, side);
    if (!action) break;
    if (side === 'opponent' && action.type === 'useCard' && state.phase === 'main') {
      const hand = state.sides.opponent.hand.find((c) => c.uid === action.cardUid);
      const card = hand ? getPlayCard(hand.cardId) : null;
      const user = state.sides.opponent.monsters.find((m) => m.uid === action.userUid);
      if (card?.kind === 'skill' && card.effect.type === 'attack' && card.effect.chain && user?.acted) t.doubleScratch++;
      if (card?.kind === 'skill' && card.effect.type === 'windRide') t.windRide++;
    }
    state = applyAction(state, action);
  }
  if (state.winner === 'player') t.wins++;
  else if (state.winner === 'opponent') t.losses++;
  else t.draws++;
}

/** 最初の手持ち3箱 × games 回（箱ごとに先攻・後攻は半分ずつ）。seed はボスごとに決まった値 */
function series(boss: OpponentDefinition, lifeScale: number, games: number, seedBase: number): Record<string, Tally> {
  const deck = buildOpponentDeck(boss);
  const out: Record<string, Tally> = {};
  KEYS.forEach((key, k) => {
    const t: Tally = { wins: 0, losses: 0, draws: 0, doubleScratch: 0, windRide: 0 };
    for (let i = 0; i < games; i++) play(boosterDeck(key), deck, lifeScale, seedBase + k * 100000 + i * 7919, i % 2 === 0 ? 'player' : 'opponent', t);
    out[key] = t;
  });
  return out;
}

/** プレイヤーが勝つ割合（3箱の平均・％） */
const rate = (r: Record<string, Tally>, games: number): number => Object.values(r).reduce((n, t) => n + t.wins, 0) / (games * KEYS.length) * 100;

describe('ボス8人の試遊（自動の対戦）', () => {
  it(`ボスごとに ${GAMES} 回ずつ：最初の手持ちで勝つ割合`, () => {
    const scan = process.env.PLAYTEST_SCALES?.split(':').map(Number);
    const bosses: Record<string, unknown> = {};
    BOSS_IDS.forEach((id, b) => {
      const def = ENCOUNTERS[id] as OpponentDefinition;
      const { ace: _ace, ...noAce } = def;
      const boss: OpponentDefinition = process.env.PLAYTEST_NO_ACE ? noAce : def;
      const seedBase = 30000 + b * 1000;
      const current = series(boss, boss.lifeScale, GAMES, seedBase);
      const row: Record<string, unknown> = { name: boss.name, monsters: boss.monsters, ace: boss.ace ?? null, lifeScale: boss.lifeScale, rate: rate(current, GAMES), byBox: current };
      if (scan && scan.length === 3) {
        const [from, to, step] = scan as [number, number, number];
        const rates: Record<string, number> = {};
        for (let s = from; s <= to + 1e-9; s += step) {
          const scale = Math.round(s * 100) / 100;
          rates[scale.toFixed(2)] = rate(series(boss, scale, GAMES, seedBase), GAMES);
        }
        row.scan = rates;
      }
      bosses[id] = row;
    });
    if (process.env.PLAYTEST_OUT) {
      mkdirSync(dirname(process.env.PLAYTEST_OUT), { recursive: true });
      writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify({ games: GAMES, bosses }, null, 1));
    }
    expect(Object.keys(bosses)).toHaveLength(8);
  }, 3_600_000);
});
