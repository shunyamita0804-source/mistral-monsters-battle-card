import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPlayCard } from '../src/data/cards.ts';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { TSUMUJI_MONSTER_ID } from '../src/data/tsumuji.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, createBattle, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { buildOpponentDeck, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/**
 * ゼフィラ（風の渓谷のボス）の自動の試遊（2026-10-30 指示書 U「フルーネのときと同じ試遊のしかたで勝つ割合を出して報告」）。
 * フルーネのときのセラ（tests/flunePlaytest.test.ts）と同じ：最初の手持ち（3つの箱）× ボス。先攻・後攻は半分ずつ・両方とも CPU の思考。数字は変えない（表を出すだけ）。
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。npm run playtest:zephyra（PLAYTEST=200）で 200 回ずつ（PLAYTEST_OUT に JSON）
 * - 比べるもの：水の神殿のルシア（lifeScale 1.2）・ゼフィラ（lifeScale 1.2。ほかに 1.3・1.1・1.0・0.9・0.8 も）
 * - ゼフィラ側のツムジが、Wひっかきを2回続けて使った回数・かぜのりを使った回数も数える
 */
const GAMES = Number(process.env.PLAYTEST ?? 4);
const KEYS = BOOSTERS.map((b) => b.key);

interface Tally {
  wins: number;
  losses: number;
  draws: number;
  turns: number;
  /** b 側（ボス）が Wひっかきを2回続けて使った回数・かぜのりを使った回数 */
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
  t.turns += state.turn;
}

/** 最初の手持ち a（player 側）とボス b を games 回。先攻・後攻は半分ずつ */
function series(a: Deck, b: Deck, lifeScale: number, games: number, seedBase: number): Tally {
  const t: Tally = { wins: 0, losses: 0, draws: 0, turns: 0, doubleScratch: 0, windRide: 0 };
  for (let i = 0; i < games; i++) play(a, b, lifeScale, seedBase + i * 7919, i % 2 === 0 ? 'player' : 'opponent', t);
  return t;
}

const ZEPHYRA = ENCOUNTERS['enc-wind-boss'];
const LUCIA = ENCOUNTERS['enc-water-boss'];

describe('ゼフィラの試遊（自動の対戦）', () => {
  it('ゼフィラ：ソラモ・ツムジ・ガウル。ルシアと同じ 1.2 から試遊し、勝つ割合がルシアといちばん近い 1.0 にした（2026-10-30 指示書 V で切り札の技を2枚ずつにして 1.1）', () => {
    expect(ZEPHYRA).toMatchObject({ monsters: ['mon-soramo', TSUMUJI_MONSTER_ID, 'mon-gauul'], ace: TSUMUJI_MONSTER_ID, lifeScale: 1.22 });
    expect(LUCIA?.lifeScale).toBe(1.25);
  });

  it(`各組み合わせ ${GAMES} 回ずつ：最初の手持ちで勝つ割合`, () => {
    if (!ZEPHYRA || !LUCIA) throw new Error('boss');
    const rows: Record<string, { lifeScale: number; byBox: Record<string, Tally> }> = {};
    const plan = (name: string, monsters: readonly string[], scale: number, p: number): void => {
      const deck = buildOpponentDeck({ monsters: [...monsters] });
      const byBox: Record<string, Tally> = {};
      KEYS.forEach((a, i) => {
        byBox[a] = series(boosterDeck(a), deck, scale, GAMES, 70000 + p * 1000 + i * 10);
      });
      rows[name] = { lifeScale: scale, byBox };
    };
    plan('lucia_1.2', LUCIA.monsters, 1.2, 0);
    plan('zephyra_1.2', ZEPHYRA.monsters, 1.2, 1);
    plan('zephyra_1.1', ZEPHYRA.monsters, 1.1, 2);
    plan('zephyra_1.3', ZEPHYRA.monsters, 1.3, 3);
    // 1.2 ではルシアより勝ちにくかったので、低い値も測る（ルシアと同じくらいになる値を探す）
    plan('zephyra_1.0', ZEPHYRA.monsters, 1.0, 4);
    plan('zephyra_0.9', ZEPHYRA.monsters, 0.9, 5);
    plan('zephyra_0.8', ZEPHYRA.monsters, 0.8, 6);
    const out = { games: GAMES, rows };
    if (process.env.PLAYTEST_OUT) {
      mkdirSync(dirname(process.env.PLAYTEST_OUT), { recursive: true });
      writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 1));
    }
    const all = Object.values(rows).flatMap((r) => Object.values(r.byBox));
    expect(all.reduce((n, t) => n + t.wins + t.losses + t.draws, 0)).toBe(all.length * GAMES);
    expect(all.reduce((n, t) => n + t.draws, 0)).toBeLessThanOrEqual(all.length * GAMES * 0.02);
  }, 1_800_000);
});
