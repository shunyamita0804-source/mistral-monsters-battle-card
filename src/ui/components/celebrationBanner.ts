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

/**
 * 「新しいダンジョン発見」の帯（2026-10-28 デザイン担当 banner_dungeon_found。大会でランクが上がって新しいダンジョンが開いたとき）。
 * 紺の帯に「新しいダンジョンが見つかった：」と、そのダンジョンの名前をゲームが重ねる（2行）。ランクアップの帯のあとに続けて出る（CSS の animation-delay）
 */
export function dungeonFoundBanner(lead: string, name: string, label: string): HTMLElement {
  return h(
    'div',
    { class: 'dungeon-found-banner', attrs: { role: 'img', 'aria-label': label } },
    h('span', { class: 'dungeon-found-banner__text', attrs: { 'aria-hidden': 'true' } }, h('span', { class: 'dungeon-found-banner__lead', text: lead }), h('span', { class: 'dungeon-found-banner__name', text: name })),
  );
}
