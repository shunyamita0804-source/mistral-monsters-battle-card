import type { PlayCard } from '../../game/cards/cardTypes.ts';
import { createPlayCard, skillCardHeight } from './skillCard.ts';

/**
 * 対戦画面の技カード（2026-10-25：ほかの画面と同じ新UI〔skillCard.ts〕で描く）。
 * - 'hand'：守備のカード・指で持ち上げたカードなど（手札用のほぼ正方形の枠。文字は描かない）
 * - 'tall'：自分の手札（縦長の通常の枠で文字は描かない。2026-10-26 ユーザー指示「名前は削除して、もう少し絵を大きく」：
 *   正方形の枠は絵の窓が横長で小さいので、絵の窓の大きい縦長の枠に）
 * - 'focus'：フォーカスエリアの大きなカード（縦長の通常の枠。技名・説明も描く）
 */
export type BattleCardSize = 'hand' | 'tall' | 'focus';

export interface BattleCardOptions {
  readonly width: number;
  readonly size: BattleCardSize;
}

export function battleCardHeight(width: number, size: BattleCardSize): number {
  return skillCardHeight(width, size === 'hand' ? 'hand' : 'normal');
}

export function createBattleCard(card: PlayCard, options: BattleCardOptions): HTMLElement {
  if (options.size === 'hand') return createPlayCard(card, { width: options.width, size: 'hand', showText: false });
  return createPlayCard(card, { width: options.width, size: 'normal', showText: options.size === 'focus' });
}
