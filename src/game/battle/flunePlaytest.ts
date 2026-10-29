import { getPlayCard } from '../../data/cards.ts';
import { FLUNE_MONSTER_ID } from '../../data/flune.ts';
import type { AiStyle } from '../../data/tournaments.ts';
import type { Deck } from '../deck/deck.ts';
import { chooseAction } from './ai.ts';
import { actingSide, applyAction, createBattle, findMonster, type BattleState, type BattleWinner, type Side } from './engine.ts';

/**
 * フルーネの自動の試遊（2026-10-29 フルーネの最終の追加の指示「自動の試遊の表だけ出す」。数字は変えない）。
 * ジオルの試遊（geolPlaytest.ts）と同じく、両方とも相手の CPU と同じ思考で最後まで自動で対戦し、フラワードレイン・いやしのみつを数える。
 * B の側だけライフ倍率（ダンジョンのボスの lifeScale）と思考の癖を付けられる。DOM に依存しない純粋関数。決まった seed なら毎回同じ結果。
 * 使い方は tests/flunePlaytest.test.ts（npm run playtest:flune で全部の組み合わせを 200 回ずつ）
 */

/** 試遊で数えること（片方の側について。数はすべて合計） */
export interface FluneStats {
  /** フラワードレインを使った回数・回復した量の合計 */
  drains: number;
  drainHeal: number;
  /** いやしのみつを使った回数・回復した量の合計 */
  nectars: number;
  nectarHeal: number;
  /** フルーネがいた対戦の数 */
  fluneMatches: number;
}

export const emptyFluneStats = (): FluneStats => ({ drains: 0, drainHeal: 0, nectars: 0, nectarHeal: 0, fluneMatches: 0 });

export interface FluneMatchResult {
  /** 勝った側（打ち切りは null） */
  readonly winner: BattleWinner | null;
  readonly turns: number;
  readonly stats: Readonly<Record<Side, FluneStats>>;
}

export interface FluneMatchOptions {
  /** B（opponent）のライフ倍率（精霊の森のセラは 0.85） */
  readonly bLifeScale?: number;
  /** B の思考の癖 */
  readonly bStyle?: AiStyle;
}

/** 打ち切り（行動の数） */
const MAX_STEPS = 6000;

/** player＝a・opponent＝b で、先攻 first の対戦を最後まで自動で進め、フルーネの技を数える */
export function playFluneMatch(a: Deck, b: Deck, seed: number, first: Side, options: FluneMatchOptions = {}): FluneMatchResult {
  let state: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b, lifeScale: options.bLifeScale ?? 1 }, seed, first);
  const stats: Record<Side, FluneStats> = { player: emptyFluneStats(), opponent: emptyFluneStats() };
  for (const side of ['player', 'opponent'] as const) {
    if (state.sides[side].monsters.some((m) => m.cardId === FLUNE_MONSTER_ID)) stats[side].fluneMatches = 1;
  }
  // フラワードレインを使ったフルーネ（攻撃が全部終わるまで覚えておく）
  let drain: { side: Side; uid: string; before: number } | null = null;
  for (let i = 0; i < MAX_STEPS && state.phase !== 'ended'; i++) {
    const side = actingSide(state);
    if (!side) break;
    const action = chooseAction(state, side, side === 'opponent' ? options.bStyle : undefined);
    if (!action) break;
    let nectar: { side: Side; uid: string; before: number } | null = null;
    if (action.type === 'useCard' && side === state.active && state.phase === 'main') {
      const hand = state.sides[side].hand.find((c) => c.uid === action.cardUid);
      const card = hand ? getPlayCard(hand.cardId) : null;
      if (card?.kind === 'skill' && card.effect.type === 'healAlly' && action.targetUid) {
        const target = findMonster(state, action.targetUid)?.monster;
        if (target) nectar = { side, uid: target.uid, before: target.life };
      }
      if (card?.kind === 'skill' && card.effect.type === 'attack' && card.effect.drain) {
        const before = state;
        const after = applyAction(state, action);
        // 使ったモンスター＝この行動で「行動済」になったフルーネ
        const user = after.sides[side].monsters.find((m) => m.acted && !before.sides[side].monsters.find((x) => x.uid === m.uid)?.acted);
        if (user) drain = { side, uid: user.uid, before: user.life };
      }
    }
    state = applyAction(state, action);
    if (nectar) {
      const s = stats[nectar.side];
      s.nectars++;
      s.nectarHeal += (findMonster(state, nectar.uid)?.monster.life ?? 0) - nectar.before;
    }
    if (drain && state.phase !== 'defense') {
      const s = stats[drain.side];
      s.drains++;
      s.drainHeal += Math.max(0, (findMonster(state, drain.uid)?.monster.life ?? 0) - drain.before);
      drain = null;
    }
  }
  return { winner: state.winner, turns: state.turn, stats };
}
