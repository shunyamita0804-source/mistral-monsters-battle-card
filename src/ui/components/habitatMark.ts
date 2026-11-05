import type { Habitat } from '../../game/cards/cardTypes.ts';
import { t } from '../../i18n/i18n.ts';
import { h } from '../dom.ts';
import { statusIconUrl, type StatusIconId } from '../statusIcons.ts';

/**
 * 居場所の印（2026-11-01 指示書 AJ【2】：地上・空中・水中）。【仮】コードで描く簡単な印（正式な印の絵はデザイン担当への依頼文を報告に書いた）。
 * カードの枠の上に重ねる（正式カードの絵は描き直さない）。置き場所は3つの案（a：右下の角・b：左上の角・c：右の辺の真ん中）。
 * ふだんは案 a。確かめるときは ?qa=1&habitatPos=b のように URL で選べる（写真の比べ用）
 */

const POSITIONS = ['a', 'b', 'c'] as const;
type HabitatPos = (typeof POSITIONS)[number];

function chosenPos(): HabitatPos {
  if (typeof location === 'undefined') return 'a';
  const q = new URLSearchParams(location.search);
  const p = q.get('habitatPos');
  return q.get('qa') === '1' && p && (POSITIONS as readonly string[]).includes(p) ? (p as HabitatPos) : 'a';
}

/** 居場所の印（2026-11-05 指示書 AZ【3】：新しいアイコン T01 地上・T02 空中・T03 水中。置き場所は今のまま） */
const ICON_ID: Readonly<Record<Habitat, StatusIconId>> = { ground: 't01', air: 't02', water: 't03' };

/** 居場所の印（habitat が null なら null）。tide＝場が水中で、もとの居場所から変わっているとき（印のまわりを水色に光らせる） */
export function habitatMark(habitat: Habitat | null | undefined, opts: { readonly tide?: boolean } = {}): HTMLElement | null {
  if (!habitat) return null;
  const label = t(`habitat.${habitat}`);
  return h(
    'span',
    {
      class: `habitat-mark habitat-mark--icon habitat-mark--${habitat} habitat-mark--pos-${chosenPos()}${opts.tide ? ' is-tide' : ''}`,
      attrs: { role: 'img', 'aria-label': label, title: label },
    },
    h('img', { class: 'habitat-mark__img', attrs: { src: statusIconUrl(ICON_ID[habitat]), alt: '', draggable: 'false' } }),
  );
}
