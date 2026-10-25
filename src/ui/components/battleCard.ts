import type { PlayCard } from '../../game/cards/cardTypes.ts';
import { createPlayCard, skillCardHeight } from './skillCard.ts';

/**
 * 対戦画面の技カード（2026-10-25：ほかの画面と同じ新UI〔skillCard.ts〕で描く）。
 * - 'hand'：手札・守備のカード・指で持ち上げたカードなど（手札用の枠。文字は描かず、名前は画面がカードの下に出す）
 * - 'focus'：フォーカスエリアの大きなカード（縦長の通常の枠。技名・説明も描く）
 */
export type BattleCardSize = 'hand' | 'focus';

export interface BattleCardOptions {
  readonly width: number;
  readonly size: BattleCardSize;
}

export function battleCardHeight(width: number, size: BattleCardSize): number {
  return skillCardHeight(width, size === 'hand' ? 'hand' : 'normal');
}

export function createBattleCard(card: PlayCard, options: BattleCardOptions): HTMLElement {
  return options.size === 'hand'
    ? createPlayCard(card, { width: options.width, size: 'hand', showText: false })
    : createPlayCard(card, { width: options.width, size: 'normal', showText: true });
}
