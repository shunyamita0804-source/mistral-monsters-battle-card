import knockoutMark from '@assets/images/ui/battle/knockout_mark.webp';
import tileForce from '@assets/images/ui/skillcard_simple/tile_force.webp';
import tileWisdom from '@assets/images/ui/skillcard_simple/tile_wisdom.webp';
import { h } from '../dom.ts';
import { battleDigits } from './battleDigits.ts';
import type { FxIcon, FxMark } from '../effectIcons.ts';
import { statusIconUrl } from '../statusIcons.ts';

/**
 * 技カードの効果のアイコンを1つ描く（2026-11-05 指示書 BB【2】：ゲームが重ねる）。
 * 本体のアイコン＋右上に小さな印（0〜2つ）＋右下に札（数字の札 N01・時計の札 N02）。
 * 大きさは外側（.fx-icon の幅）で決まり、印・札・字はその割合（container query）なので、手札の大きさでも大きいカードでも同じ形
 */
export function fxMarkUrl(mark: FxMark): string {
  switch (mark) {
    case 'ally':
      return statusIconUrl('m01');
    case 'target':
      return statusIconUrl('s13');
    case 'ko':
      return knockoutMark;
    case 'ground':
      return statusIconUrl('t01');
    case 'air':
      return statusIconUrl('t02');
    case 'water':
      return statusIconUrl('t03');
    case 'force':
      return tileForce;
    case 'wisdom':
      return tileWisdom;
    case 'charge':
      return statusIconUrl('b09');
  }
}

const img = (cls: string, src: string): HTMLElement => h('img', { class: cls, attrs: { src, alt: '', draggable: 'false' } });

export function createFxIcon(icon: FxIcon): HTMLElement {
  const marks = icon.marks ?? [];
  return h(
    'span',
    { class: 'fx-icon', dataset: { main: icon.main } },
    img('fx-icon__main', statusIconUrl(icon.main)),
    marks.length > 0 ? h('span', { class: `fx-icon__marks fx-icon__marks--${marks.length}` }, ...marks.map((m) => img(`fx-icon__mark fx-icon__mark--${m}`, fxMarkUrl(m)))) : null,
    icon.badge
      ? h(
          'span',
          {
            class: `fx-icon__badge fx-icon__badge--${icon.badge.kind}`,
            attrs: { style: `background-image:url("${statusIconUrl(icon.badge.kind === 'turn' ? 'n02' : 'n01')}")` },
          },
          badgeContent(icon.badge.text),
        )
      : null,
  );
}

/** 札の中身：＋n・−n は状態の札と同じ数字の絵（＋は緑・−は赤）。2+・×2・≤1 などは金の字 */
function badgeContent(text: string): HTMLElement {
  const m = /^([+−])(\d+)$/.exec(text);
  if (m) return battleDigits(m[1] === '+' ? Number(m[2]) : -Number(m[2]), 'fx-icon__digits');
  return h('span', { class: 'fx-icon__badge-text', text });
}

/** 本体が2つ以上のときは並べる */
export function createFxIcons(icons: readonly FxIcon[], className: string): HTMLElement {
  return h('span', { class: `${className} fx-icons fx-icons--${icons.length}` }, ...icons.map(createFxIcon));
}
