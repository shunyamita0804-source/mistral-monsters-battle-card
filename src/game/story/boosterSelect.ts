import type { BoosterKey } from '../../data/introV2.ts';

/**
 * 管理局でパックを選ぶときのタップの決まり（2026-10-27 指示書。DOM 非依存）。
 * - 1回目：その箱を仮に選ぶ（指と幼馴染の説明。受け取らない）
 * - 同じ箱をもう一度：決定（別の確認の窓は出さない）。ただし仮に選んでから confirmDelayMs たつまでは何もしない（連打・ダブルタップで決まらない）
 * - 別の箱：その箱の1回目に切り替わるだけ
 * - 決まったあとは何もしない
 */
export interface BoosterSelectState {
  readonly selected: BoosterKey | null;
  /** 仮に選んだ時刻（ミリ秒） */
  readonly selectedAt: number;
  readonly decided: BoosterKey | null;
}

export const INITIAL_BOOSTER_SELECT: BoosterSelectState = { selected: null, selectedAt: 0, decided: null };

export function tapBooster(state: BoosterSelectState, key: BoosterKey, now: number, confirmDelayMs: number): BoosterSelectState {
  if (state.decided) return state;
  if (state.selected === key) return now - state.selectedAt < confirmDelayMs ? state : { ...state, decided: key };
  return { selected: key, selectedAt: now, decided: null };
}
