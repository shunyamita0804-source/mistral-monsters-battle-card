import type { ItemDefinition } from '../../data/items.ts';
import { t } from '../../i18n/i18n.ts';
import { h } from '../dom.ts';

/**
 * 道具のアイコン（【仮】の見た目。2026-10-27 デザイン担当に依頼中の「道具のアイコン8つ」が届いたら絵に差し替える）。
 * いまは丸い札に1文字と「仮」の印
 */
export function itemIcon(item: ItemDefinition, size: 'normal' | 'small' = 'normal'): HTMLElement {
  return h(
    'span',
    { class: `item-icon item-icon--${item.id}${size === 'small' ? ' item-icon--small' : ''}`, attrs: { 'aria-hidden': 'true' } },
    h('span', { class: 'item-icon__glyph', text: item.glyph }),
    size === 'small' ? null : h('span', { class: 'item-icon__temp', text: t('items.temp') }),
  );
}
