import { portraitFocus } from '../../data/monsterPortraits.ts';
import type { MonsterCard } from '../../game/cards/cardTypes.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { resolveCardArt } from '../cardArtSources.ts';
import { h } from '../dom.ts';

/**
 * 対戦画面のモンスターのアイコン（2026-10-25 バトル画面リデザイン。height を渡すと縦長に切り抜く：バトル用カードがまだ無いモンスター）。
 * バトル用の絵（文字なし）を顔〜上半身で切り抜いて見せる（切り抜き位置は src/data/monsterPortraits.ts）。
 * バトル用の絵がないモンスター（仮のモンスター・絵が未着のミュロルなど）は、名前の1文字と「仮」で出す
 */
export function createMonsterPortrait(monster: MonsterCard, size: number, height = size): HTMLElement {
  const url = resolveCardArt(monster.battleArt);
  const el = h('span', { class: 'battle-portrait', attrs: { 'aria-hidden': 'true' } });
  el.style.width = `${size}px`;
  el.style.height = `${height}px`;
  el.style.setProperty('--theme', monster.themeColor);
  if (url) {
    const f = portraitFocus(monster.id);
    const img = h('img', { class: 'battle-portrait__img', attrs: { src: url, alt: '', draggable: 'false' } });
    img.style.setProperty('--fx', String(f.x));
    img.style.setProperty('--fy', String(f.y));
    img.style.setProperty('--zoom', String(f.zoom));
    el.append(img);
  } else {
    const name = cardName(monster);
    el.classList.add('battle-portrait--placeholder');
    el.append(
      h('span', { class: 'battle-portrait__mark', text: monster.undetermined ? '？' : name.slice(-1) }),
      h('span', { class: 'battle-portrait__tag', text: t(monster.undetermined ? 'common.undeterminedTag' : 'common.placeholderTag') }),
    );
  }
  return el;
}
