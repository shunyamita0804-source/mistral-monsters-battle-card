import type { ItemDefinition, ItemId } from '../../data/items.ts';
import { h } from '../dom.ts';

/** ファイル名の決まり（小文字と _）にした道具 ID（guardianCharm → guardian_charm） */
const snake = (id: string): string => id.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** 道具の絵（2026-10-27 デザイン33点の 14。tools/design/ui33_build.py が切り出した assets/images/ui/items/item_<道具ID>.webp） */
const ITEM_ART: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('/assets/images/ui/items/item_*.webp', { eager: true, query: '?url', import: 'default' })).map(([path, url]) => [
    /item_([a-z_]+)\.webp$/.exec(path)?.[1] ?? path,
    url,
  ]),
);

/** 効き目の印（33。魔除けの香・たいまつ・身代わりのお守り・幸運のコイン）と、守ったカードの印（sealed） */
const MARK_ART: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('/assets/images/ui/items/mark_*.webp', { eager: true, query: '?url', import: 'default' })).map(([path, url]) => [
    /mark_([a-z_]+)\.webp$/.exec(path)?.[1] ?? path,
    url,
  ]),
);

/** 道具の絵の URL（宝箱で手に入れたときの小窓など） */
export function itemArtUrl(id: ItemId): string {
  return ITEM_ART[snake(id)] ?? '';
}

/** 道具のアイコン */
export function itemIcon(item: ItemDefinition, size: 'normal' | 'small' = 'normal'): HTMLElement {
  return h('img', {
    class: `item-icon item-icon--${item.id}${size === 'small' ? ' item-icon--small' : ''}`,
    attrs: { src: ITEM_ART[snake(item.id)] ?? '', alt: '', draggable: 'false', 'aria-hidden': 'true' },
  });
}

/** 効き目の印・守ったカードの印 */
export function itemMark(kind: ItemId | 'sealed'): HTMLElement {
  return h('img', { class: `item-mark item-mark--${kind}`, attrs: { src: MARK_ART[snake(kind)] ?? '', alt: '', draggable: 'false', 'aria-hidden': 'true' } });
}
