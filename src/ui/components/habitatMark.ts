import type { Habitat } from '../../game/cards/cardTypes.ts';
import { t } from '../../i18n/i18n.ts';
import { h } from '../dom.ts';

/**
 * 居場所の印（2026-11-01 指示書 AJ【2】：地上・空中・水中）。【仮】コードで描く簡単な印（正式な印の絵はデザイン担当への依頼文を報告に書いた）。
 * カードの枠の上に重ねる（正式カードの絵は描き直さない）。置き場所は3つの案（a：右下の角・b：左上の角・c：右の辺の真ん中）。
 * ふだんは案 a。確かめるときは ?qa=1&habitatPos=b のように URL で選べる（写真の比べ用）
 */
const ICON_PATH: Readonly<Record<Habitat, string>> = {
  // 地上：二つの山
  ground: 'M3 17 L9 8 L12.5 12.5 L15 9.5 L21 17 Z',
  // 空中：つばさ
  air: 'M3 14 C6 9 10 7 15 7 C13 8.5 12 10 12 11 C14 10 17 10 21 11 C17 12.5 14 14 11 15 C8 16 5 16 3 14 Z',
  // 水中：しずく
  water: 'M12 3 C15 8 18 11 18 14.5 A6 6 0 0 1 6 14.5 C6 11 9 8 12 3 Z',
};

const POSITIONS = ['a', 'b', 'c'] as const;
type HabitatPos = (typeof POSITIONS)[number];

function chosenPos(): HabitatPos {
  if (typeof location === 'undefined') return 'a';
  const q = new URLSearchParams(location.search);
  const p = q.get('habitatPos');
  return q.get('qa') === '1' && p && (POSITIONS as readonly string[]).includes(p) ? (p as HabitatPos) : 'a';
}

/** 居場所の印（habitat が null なら null）。tide＝場が水中で、もとの居場所から変わっているとき（印に波のふちを付ける） */
export function habitatMark(habitat: Habitat | null | undefined, opts: { readonly tide?: boolean } = {}): HTMLElement | null {
  if (!habitat) return null;
  const label = t(`habitat.${habitat}`);
  const el = h('span', {
    class: `habitat-mark habitat-mark--${habitat} habitat-mark--pos-${chosenPos()}${opts.tide ? ' is-tide' : ''}`,
    attrs: { role: 'img', 'aria-label': label, title: label },
  });
  el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON_PATH[habitat]}"/></svg>`;
  return el;
}
