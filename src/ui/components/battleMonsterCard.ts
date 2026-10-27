import { battleCardOf } from '../../data/battleCards.ts';
import type { MonsterCard } from '../../game/cards/cardTypes.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { resolveCardArt } from '../cardArtSources.ts';
import { h } from '../dom.ts';
import backgroundUrl from '@assets/images/backgrounds/battlecard_bg_common.png';

const FRAME_URLS = import.meta.glob<string>('/assets/images/ui/battlecard/frame_*.png', { eager: true, query: '?url', import: 'default' });

/** カードの縦横比（800×920） */
export const BATTLE_CARD_RATIO = 920 / 800;

/** バトル用カードがあるモンスターか（いまはソラモだけ） */
export function hasBattleCard(monsterId: string): boolean {
  const spec = battleCardOf(monsterId);
  return !!spec && !!resolveCardArt({ category: 'monsterCards', file: spec.art, layout: 'full' }) && !!FRAME_URLS[`/assets/images/ui/battlecard/frame_${spec.frame}.png`];
}

/**
 * バトル用カード（2026-10-25）：共通の背景 → モンスター → モンスターの色の枠 → 名前とライフ（文字はゲームが描く。画像に焼き込まない）。
 * life を渡すと「いま／最大」で出す
 */
export function createBattleMonsterCard(monster: MonsterCard, width: number, life?: { current: number; max: number }): HTMLElement {
  const spec = battleCardOf(monster.id);
  const artUrl = spec ? resolveCardArt({ category: 'monsterCards', file: spec.art, layout: 'full' }) : undefined;
  const frameUrl = spec ? FRAME_URLS[`/assets/images/ui/battlecard/frame_${spec.frame}.png`] : undefined;
  const name = cardName(monster);
  const lifeText = life ? `${life.current}/${life.max}` : String(monster.life);
  const card = h(
    'div',
    {
      class: 'battle-card',
      attrs: { role: 'img', 'aria-label': life ? t('card.aria.monsterLife', { name, life: life.current, max: life.max }) : t('card.aria.monster', { name }) },
    },
    h('img', { class: 'battle-card__bg', attrs: { src: backgroundUrl, alt: '', draggable: 'false' } }),
    artUrl ? h('img', { class: 'battle-card__art', attrs: { src: artUrl, alt: '', draggable: 'false' } }) : null,
    frameUrl ? h('img', { class: 'battle-card__frame', attrs: { src: frameUrl, alt: '', draggable: 'false' } }) : null,
    h('span', { class: 'battle-card__life' }, h('span', { class: 'battle-card__life-label', text: 'LIFE' }), h('b', { class: 'battle-card__life-value', text: lifeText })),
    h('span', { class: 'battle-card__name', text: name }),
  );
  // 枠の外形で切り抜く（枠の外の角に背景が出ないように）
  const shapeUrl = FRAME_URLS['/assets/images/ui/battlecard/frame_shape.png'];
  if (shapeUrl) card.style.setProperty('--shape', `url("${shapeUrl}")`);
  card.style.width = `${width}px`;
  card.style.height = `${(width * BATTLE_CARD_RATIO).toFixed(1)}px`;
  card.style.setProperty('--u', `${(width / 260).toFixed(3)}`);
  if (spec) {
    card.style.setProperty('--art-scale', String(spec.scale));
    card.style.setProperty('--art-offset', String(spec.offsetY));
  }
  return card;
}
