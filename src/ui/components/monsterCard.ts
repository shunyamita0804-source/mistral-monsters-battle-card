import type { MonsterCard } from '../../game/cards/cardTypes.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { resolveCardArt } from '../cardArtSources.ts';
import { h } from '../dom.ts';
import { createBattleMonsterCard, hasBattleCard } from './battleMonsterCard.ts';

/**
 * モンスターカードの表示。
 * モンスターカードの正式テンプレート・正式イラストは未着手のため、テーマ色の枠と仮の絵で表示する。
 */
export interface MonsterCardOptions {
  readonly width: number;
  /** バトル中のライフ（指定するとライフバーを出す） */
  readonly life?: { readonly current: number; readonly max: number };
  readonly showName?: boolean;
}

/** 正式の絵の縦横比（高さ÷幅。正式カード 508×849・バトル用 556×941） */
const OFFICIAL_RATIO = 849 / 508;
const BATTLE_RATIO = 941 / 556;

/**
 * 正式の絵があるモンスター（2026-10-23〜。いまはソラモ）。
 * - バトル（life を指定）：バトル用の絵（文字なし）に、ゲーム側でライフのバーを重ねる
 * - それ以外（ショップ・図鑑・自宅など）：正式カードの絵（名前・LIFE 入り）をそのまま。文字は重ねない
 */
function createArtMonsterCard(monster: MonsterCard, options: MonsterCardOptions, url: string, battle: boolean): HTMLElement {
  const name = cardName(monster);
  const life = options.life;
  const card = h(
    'div',
    {
      class: `monster-card monster-card--art${battle ? ' monster-card--battle' : ''}${life && life.current <= 0 ? ' is-down' : ''}`,
      attrs: {
        role: 'img',
        'aria-label': life ? t('card.aria.monsterLife', { name, life: life.current, max: life.max }) : t('card.aria.monster', { name }),
      },
    },
    h('div', { class: 'monster-card__art' }, h('img', { class: 'monster-card__img', attrs: { src: url, alt: '', draggable: 'false' } })),
    life
      ? h(
          'div',
          { class: 'monster-card__life monster-card__life--overlay' },
          h('div', { class: 'monster-card__life-bar' }, h('div', { class: 'monster-card__life-fill' })),
        )
      : null,
    life && life.current <= 0 ? h('div', { class: 'monster-card__down', text: t('card.down') }) : null,
  );
  card.style.setProperty('--theme', monster.themeColor);
  card.style.width = `${options.width}px`;
  card.style.height = `${Math.round(options.width * (battle ? BATTLE_RATIO : OFFICIAL_RATIO))}px`;
  const fill = card.querySelector<HTMLElement>('.monster-card__life-fill');
  if (fill && life) fill.style.width = `${Math.max(0, (life.current / life.max) * 100)}%`;
  return card;
}

export function createMonsterCard(monster: MonsterCard, options: MonsterCardOptions): HTMLElement {
  const battleUrl = options.life ? resolveCardArt(monster.battleArt) : undefined;
  if (battleUrl) return createArtMonsterCard(monster, options, battleUrl, true);
  const officialUrl = monster.art?.layout === 'full' ? resolveCardArt(monster.art) : undefined;
  if (officialUrl) return createArtMonsterCard(monster, options, officialUrl, false);
  // 名前・LIFE 入りの正式カードの1枚絵が無く、バトル用カードの素材があるモンスター（2026-10-27 ミュロル）：
  // 背景・モンスター・色の枠・名前・LIFE をゲームが重ねて描く（ユーザー指示「カード全体を1枚画像として貼り付けない。レイヤー合成」）
  if (!options.life && hasBattleCard(monster.id)) return createBattleMonsterCard(monster, options.width);
  const name = cardName(monster);
  const artUrl = resolveCardArt(monster.art);
  const height = Math.round(options.width * 1.4);
  const art = artUrl
    ? h('img', { class: 'monster-card__img', attrs: { src: artUrl, alt: '', draggable: 'false' } })
    : h(
        'div',
        { class: 'monster-card__placeholder' },
        h('span', { class: 'monster-card__mark', text: monster.undetermined ? '？' : name.slice(-1) }),
        h('span', { class: 'monster-card__tag', text: t(monster.undetermined ? 'common.undeterminedTag' : 'common.placeholderTag') }),
      );
  const life = options.life;
  const card = h(
    'div',
    {
      class: `monster-card${life && life.current <= 0 ? ' is-down' : ''}`,
      attrs: {
        role: 'img',
        'aria-label': life ? t('card.aria.monsterLife', { name, life: life.current, max: life.max }) : t('card.aria.monster', { name }),
      },
    },
    h('div', { class: 'monster-card__art' }, art),
    options.showName === false ? null : h('div', { class: 'monster-card__name', text: name }),
    life
      ? h(
          'div',
          { class: 'monster-card__life' },
          h('div', { class: 'monster-card__life-bar' }, h('div', { class: 'monster-card__life-fill' })),
          h('span', { class: 'monster-card__life-text', text: `${life.current}/${life.max}` }),
        )
      : h('div', {
          class: 'monster-card__life-text monster-card__life-text--base',
          text: t(monster.pendingSpec?.includes('life') ? 'card.lifeProvisional' : 'card.life', { n: monster.life }),
        }),
    life && life.current <= 0 ? h('div', { class: 'monster-card__down', text: t('card.down') }) : null,
  );
  card.style.setProperty('--theme', monster.themeColor);
  card.style.width = `${options.width}px`;
  card.style.height = `${height}px`;
  const fill = card.querySelector<HTMLElement>('.monster-card__life-fill');
  if (fill && life) fill.style.width = `${Math.max(0, (life.current / life.max) * 100)}%`;
  return card;
}
