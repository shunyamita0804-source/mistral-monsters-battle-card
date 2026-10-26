import glowUrl from '@assets/images/ui/reward_glow.webp';
import ringUrl from '@assets/images/ui/reward/item_glow.webp';
import { h } from '../dom.ts';

/** 景品・宝箱の中身を見せるときの、光の輪＋景品の絵（2026-10-23 デザイン第4弾） */
export function rewardGlow(iconUrl: string): HTMLElement {
  const el = h('div', { class: 'reward-glow', attrs: { 'aria-hidden': 'true' } }, h('img', { class: 'reward-glow__icon', attrs: { src: iconUrl, alt: '', draggable: 'false' } }));
  el.style.backgroundImage = `url("${glowUrl}")`;
  return el;
}

/**
 * 手に入れたときの小窓（2026-10-26 デザイン第10弾）：左の台座に手に入れた物の絵（後ろに金の光の輪がゆっくり回る）、右に名前。
 * 宝箱・不思議な欠片のお知らせの上に出す
 */
export function itemGetWindow(iconUrl: string, label: string): HTMLElement {
  const ring = h('span', { class: 'item-get__ring' });
  ring.style.backgroundImage = `url("${ringUrl}")`;
  return h(
    'div',
    { class: 'item-get' },
    h('span', { class: 'item-get__pedestal', attrs: { 'aria-hidden': 'true' } }, ring, h('img', { class: 'item-get__icon', attrs: { src: iconUrl, alt: '', draggable: 'false' } })),
    h('span', { class: 'item-get__label', text: label }),
  );
}
