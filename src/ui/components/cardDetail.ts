import { getMonster } from '../../data/cards.ts';
import { GACHA_SERIES } from '../../data/economy.ts';
import { BOOSTERS } from '../../data/introV2.ts';
import { seriesLineup } from '../../game/economy/gachaSeries.ts';
import { boosterCardCounts } from '../../game/story/introV2.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';
import { categoryLabel, describeSkill, describeSupport, effectLabel, kindLabel, rarityLabel, skillCategory, type CardDefinition } from '../../game/cards/cardTypes.ts';
import { cardDescription, cardName, gachaSeriesName } from '../../i18n/content.ts';
import { t, tKey } from '../../i18n/i18n.ts';
import { h } from '../dom.ts';
import { createCardView } from './cardView.ts';
import { openModal, type ModalHandle } from './modal.ts';
import { rarityBadge } from './rarityBadge.ts';
import { phraseText } from '../phraseText.ts';

export interface CardDetailOptions {
  /** 所持枚数（指定すると表示） */
  readonly owned?: number;
  /** 追加で表示する行（バトル中の場所など） */
  readonly extra?: readonly string[];
}

/** カードの効果・説明の文（技＝効果、サポート＝効果、モンスター＝説明） */
export function cardEffectText(card: CardDefinition): string {
  return card.kind === 'skill' ? describeSkill(card) : card.kind === 'support' ? describeSupport(card) : cardDescription(card);
}

/** カードの拡大表示と詳細（分類・効果・数値・所持枚数・収録パック） */
export function openCardDetail(parent: HTMLElement, card: CardDefinition, options: CardDetailOptions = {}): ModalHandle {
  const rows: [string, string | HTMLElement][] = [[t('card.detail.kind'), t('card.kindCard', { kind: kindLabel(card.kind) })]];
  if (card.kind === 'skill') {
    rows.push([t('card.detail.monster'), cardName(getMonster(card.monsterId))]);
    if (card.category) rows.push([t('card.detail.category'), categoryLabel(card.category)]);
    else rows.push([t('card.detail.effect'), effectLabel(card.effect.type)]);
    rows.push([t('card.detail.mana'), String(card.cost)]);
    if (card.stat) rows.push([card.category ? t('card.detail.damage') : categoryLabel(skillCategory(card)), String(card.stat.value)]);
    if (card.availability) rows.push([t('card.detail.availability'), t(`card.availability.${card.availability}`)]);
  } else if (card.kind === 'support') {
    rows.push([t('card.detail.supportKind'), t(card.duration === 'field' ? 'card.detail.supportField' : 'card.detail.supportInstant')]);
    rows.push([t('card.detail.mana'), String(card.cost)]);
  } else {
    rows.push([t('card.detail.life'), card.pendingSpec?.includes('life') ? t('card.provisionalValue', { n: card.life }) : String(card.life)]);
  }
  if (card.kind === 'skill' && card.displayNo !== undefined) rows.push([t('card.detail.number'), String(card.displayNo).padStart(2, '0')]);
  // サポートの表示の番号（S01〜・F01〜。2026-10-30 指示書 Y）
  if (card.kind === 'support' && card.code) rows.push([t('card.detail.number'), card.code]);
  if (card.designId) rows.push([t('card.detail.designId'), card.designId]);
  // レア度：印（決まっているときだけ）と名前
  const badge = rarityBadge(card.rarity, 18);
  rows.push([t('card.detail.rarity'), badge ? h('span', { class: 'card-detail__rarity' }, badge, rarityLabel(card.rarity)) : rarityLabel(card.rarity)]);
  // 入手方法：販売機のガチャのシリーズ・ブースターの箱（2026-10-28 夜。前は販売機から外した仮パックの名前を出していた）
  const packs = [
    ...GACHA_SERIES.filter((s) => seriesLineup(s).all.includes(card.id)).map(gachaSeriesName),
    ...BOOSTERS.filter((b) => (boosterCardCounts(b.key)[card.id] ?? 0) > 0).map((b) => t(`introV2.pack.name.${b.key.slice(-1)}` as MessageKey)),
  ];
  rows.push([
    t('card.detail.source'),
    card.kind === 'monster' && card.hidden ? t('card.detail.sourceHidden') : packs.join(t('common.listSeparator')) || t('common.none'),
  ]);
  if (options.owned !== undefined) rows.push([t('card.detail.owned'), t('common.cardCount', { n: options.owned })]);

  const description = cardEffectText(card);

  const handle = openModal(parent, {
    className: 'card-detail',
    body: [
      h('div', { class: 'card-detail__card' }, createCardView(card, 180, true)),
      h('h2', { class: 'card-detail__name', text: cardName(card) }),
      ...(options.extra ?? []).map((t) => h('p', { class: 'card-detail__extra', text: t })),
      h('p', { class: 'card-detail__description' }, phraseText(description)),
      h(
        'dl',
        { class: 'card-detail__rows' },
        ...rows.flatMap(([k, v]) => [h('dt', { text: k }), typeof v === 'string' ? h('dd', { text: v }) : h('dd', {}, v)]),
      ),
      card.isPlaceholder ? h('p', { class: 'card-detail__note', text: t('card.detail.placeholderNote') }) : null,
      !card.isPlaceholder && card.pendingSpec && card.pendingSpec.length > 0
        ? h('p', {
            class: 'card-detail__note',
            text: t('card.detail.pendingNote', { items: card.pendingSpec.map((k) => tKey(`card.pending.${k}`, undefined, k)).join(t('common.listSeparator')) }),
          })
        : null,
    ],
    actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
  });
  return handle;
}
