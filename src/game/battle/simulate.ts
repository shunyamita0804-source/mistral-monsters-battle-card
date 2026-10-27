import type { OpponentDefinition } from '../../data/tournaments.ts';
import { buildOpponentDeck } from '../deck/deck.ts';
import { chooseAction } from './ai.ts';
import { actingSide, aliveMonsters, applyAction, createBattle, type BattleSide, type BattleState } from './engine.ts';

/**
 * 画面を出さずに、相手どうしの対戦を最後まで自動で進める（2026-10-27 指示書「大会の新しい形」：同じ回のほかの人の試合）。
 * ふつうの対戦と同じルール・同じ思考（考え方の癖も）で、決まった seed なら毎回同じ結果になる
 */
export interface SimResult {
  readonly winner: 'a' | 'b';
  /** 残った自分のモンスターの数 */
  readonly aLeft: number;
  readonly bLeft: number;
  /** 相手に与えたダメージ（相手のモンスターの減ったライフの合計） */
  readonly aDamage: number;
  readonly bDamage: number;
}

/** 終わらないときの打ち切り（行動の数） */
const MAX_STEPS = 6000;

const lifeLost = (side: BattleSide): number => side.monsters.reduce((sum, m) => sum + Math.max(0, m.maxLife - m.life), 0);
const lifeLeft = (side: BattleSide): number => side.monsters.reduce((sum, m) => sum + Math.max(0, m.life), 0) / Math.max(1, side.monsters.reduce((sum, m) => sum + m.maxLife, 0));

/** 対戦の終わりの様子（主人公から見て。大会の総当たりの順位に使う） */
export interface BattleSummary {
  readonly playerLeft: number;
  readonly opponentLeft: number;
  readonly damageDealt: number;
  readonly damageTaken: number;
}

export function summarizeBattle(state: BattleState): BattleSummary {
  return {
    playerLeft: aliveMonsters(state.sides.player).length,
    opponentLeft: aliveMonsters(state.sides.opponent).length,
    damageDealt: lifeLost(state.sides.opponent),
    damageTaken: lifeLost(state.sides.player),
  };
}

export function simulateBattle(a: OpponentDefinition, b: OpponentDefinition, seed: number): SimResult {
  let state = createBattle(
    { name: a.name, deck: buildOpponentDeck(a), lifeScale: a.lifeScale },
    { name: b.name, deck: buildOpponentDeck(b), lifeScale: b.lifeScale },
    seed,
  );
  for (let i = 0; i < MAX_STEPS && state.phase !== 'ended'; i++) {
    const side = actingSide(state);
    if (!side) break;
    const action = chooseAction(state, side, side === 'player' ? a.ai : b.ai);
    if (!action) break;
    state = applyAction(state, action);
  }
  const pa = state.sides.player;
  const pb = state.sides.opponent;
  // 引き分け・打ち切りは、残りのライフの割合が多いほうの勝ち（同じなら seed で決める）
  const winner =
    state.winner === 'player' ? 'a'
      : state.winner === 'opponent' ? 'b'
        : lifeLeft(pa) !== lifeLeft(pb) ? (lifeLeft(pa) > lifeLeft(pb) ? 'a' : 'b')
          : seed % 2 === 0 ? 'a' : 'b';
  return { winner, aLeft: aliveMonsters(pa).length, bLeft: aliveMonsters(pb).length, aDamage: lifeLost(pb), bDamage: lifeLost(pa) };
}
