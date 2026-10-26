import type { RankId } from '../../data/economy.ts';
import { h } from '../dom.ts';
import { rankBadge } from './rankBadge.ts';

/**
 * 優勝・ランクアップの帯（2026-10-26 デザイン第8弾 banner_rankup。勝ちの帯より一段豪華）。
 * 上の丸い台にランクの紋章（ランクが上がったとき。上がらないときは台だけ）、紺の帯に文字（「優勝！」「ランクアップ！」）をゲームが重ねる
 */
export function celebrationBanner(title: string, rank: RankId | null): HTMLElement {
  return h(
    'div',
    { class: 'celebration-banner' },
    rank ? h('span', { class: 'celebration-banner__rank' }, rankBadge(rank, 54)) : null,
    h('span', { class: 'celebration-banner__title', text: title }),
  );
}
