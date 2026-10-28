import type { PlayCard } from '../../game/cards/cardTypes.ts';
import { createPlayCard, skillCardHeight } from './skillCard.ts';

/**
 * 対戦画面の技カード（2026-10-25：ほかの画面と同じ新UI〔skillCard.ts〕で描く）。
 * - 'hand'：守備のカード・指で持ち上げたカードなど（手札用のほぼ正方形の枠。文字は描かない）
 * - 'tall'：自分の手札。2026-10-29 技カードの新しい形から、手札用のほぼ正方形の枠（名前の帯なし・絵の窓がカードいっぱい）で描く
 *   （ユーザーが選んだ見本 design-parts/ui-skillcard-simple-20261028/ref/approved_layout_mock.png の「手札（案）」。
 *   前は 2026-10-26 のユーザー指示「名前は削除して、もう少し絵を大きく」で縦長の枠だった。新しい手札用の枠は絵の窓が大きいので、この指示も満たす）
 * - 'focus'：フォーカスエリアの大きなカード（縦長の通常の枠。技名・説明も描く）
 */
export type BattleCardSize = 'hand' | 'tall' | 'focus';

export interface BattleCardOptions {
  readonly width: number;
  readonly size: BattleCardSize;
}

export function battleCardHeight(width: number, size: BattleCardSize): number {
  return skillCardHeight(width, size === 'focus' ? 'normal' : 'hand');
}

export function createBattleCard(card: PlayCard, options: BattleCardOptions): HTMLElement {
  if (options.size !== 'focus') return createPlayCard(card, { width: options.width, size: 'hand', showText: false });
  return createPlayCard(card, { width: options.width, size: 'normal', showText: true });
}
