import { getMonster } from '../../data/cards.ts';
import { categoryLabel, kindLabel, type CardDefinition } from '../../game/cards/cardTypes.ts';
import { receivedCardList, type ReceivedCard } from '../../game/cards/receivedCards.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';
import { button, h } from '../dom.ts';
import { cardEffectText } from './cardDetail.ts';
import { createCardView } from './cardView.ts';
import { createMonsterPortrait } from './monsterPortrait.ts';
import { phraseText } from '../phraseText.ts';

export interface CardListOptions {
  /** もらったカードの ID（同じ ID は何回あってもよい。並びは receivedCardList がそろえる） */
  readonly cardIds: readonly string[];
  /** 見出し（なければ「取得カード」） */
  readonly title?: string;
  /** 「閉じる」のあと */
  readonly onClose?: () => void;
}

/** 選んだカードの大きさ（論理px） */
const BIG_CARD_W = 150;
/** 一覧の小さな絵の幅 */
const THUMB_W = 26;

/**
 * 取得カードの画面（2026-10-28 ユーザー決定）。上に選んだカードを大きく（効果つき）、下にもらったカードの一覧（名前と枚数）。
 * 一覧はモンスター → 技カード → サポートの順。行を押すとそのカードを上に出す。最初は1行目を選んだ状態。「閉じる」で次へ。
 * 箱を開けたあとに使う。ダンジョンの勝ち・宝箱・ガチャの結果でも、cardIds を渡せばそのまま使える部品
 */
export function openCardList(parent: HTMLElement, options: CardListOptions): { close(): void } {
  const list = receivedCardList(options.cardIds);
  const total = list.reduce((n, r) => n + r.count, 0);
  let closed = false;

  const bigCard = h('div', { class: 'card-list__big-card' });
  const bigName = h('h3', { class: 'card-list__big-name' });
  const bigMeta = h('p', { class: 'card-list__big-meta' });
  const bigText = h('p', { class: 'card-list__big-text' });
  const bigCount = h('span', { class: 'card-list__big-count' });
  const selected = h(
    'div',
    { class: 'card-list__selected', attrs: { 'aria-live': 'polite' } },
    bigCard,
    h('div', { class: 'card-list__big-info' }, h('div', { class: 'card-list__big-head' }, bigName, bigCount), bigMeta, bigText),
  );

  const rows: HTMLButtonElement[] = [];
  const select = (index: number): void => {
    const row = list[index];
    if (!row) return;
    rows.forEach((el, i) => {
      el.classList.toggle('is-selected', i === index);
      el.setAttribute('aria-pressed', String(i === index));
    });
    const { card, count } = row;
    bigCard.replaceChildren(createCardView(card, BIG_CARD_W, true));
    bigName.textContent = cardName(card);
    bigCount.textContent = t('received.count', { n: count });
    bigMeta.textContent = metaText(card);
    bigText.replaceChildren(phraseText(cardEffectText(card)));
    bigText.scrollTop = 0;
  };

  const groups = (['monster', 'skill', 'support'] as const)
    .map((kind) => ({ kind, items: list.map((r, i) => ({ r, i })).filter(({ r }) => r.card.kind === kind) }))
    .filter((g) => g.items.length > 0);
  const listEl = h(
    'div',
    { class: 'card-list__rows' },
    ...groups.flatMap((g) => [
      h('h4', { class: 'card-list__group', text: t('received.groupCount', { group: t(`received.group.${g.kind}` as MessageKey), n: g.items.reduce((n, { r }) => n + r.count, 0) }) }),
      ...g.items.map(({ r, i }) => {
        const el = rowView(r, () => select(i));
        rows[i] = el;
        return el;
      }),
    ]),
  );

  const close = (): void => {
    if (closed) return;
    closed = true;
    layer.remove();
    options.onClose?.();
  };
  const closeBtn = button(t('received.close'), close, 'btn btn--primary btn--large card-list__close');
  closeBtn.dataset.se = 'cancel';

  const layer = h(
    'div',
    { class: 'card-list', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': options.title ?? t('received.title') } },
    h(
      'div',
      { class: 'card-list__panel' },
      h('div', { class: 'card-list__header' }, h('h2', { class: 'card-list__title', text: options.title ?? t('received.title') }), h('span', { class: 'card-list__total', text: t('received.total', { n: total }) })),
      selected,
      listEl,
      closeBtn,
    ),
  );
  parent.append(layer);
  select(0);
  return { close };
}

/** 種類・分類・マナ（モンスターはライフ） */
function metaText(card: CardDefinition): string {
  const sep = t('common.listSeparator');
  if (card.kind === 'monster') return [t('card.kindCard', { kind: kindLabel(card.kind) }), `${t('card.detail.life')} ${card.life}`].join(sep);
  if (card.kind === 'skill') {
    const parts = [cardName(getMonster(card.monsterId)), card.category ? categoryLabel(card.category) : t('card.kindCard', { kind: kindLabel(card.kind) }), `${t('card.detail.mana')} ${card.cost}`];
    if (card.stat) parts.push(`${t('card.detail.damage')} ${card.stat.value}`);
    return parts.join(sep);
  }
  return [t('card.kindCard', { kind: kindLabel(card.kind) }), `${t('card.detail.mana')} ${card.cost}`].join(sep);
}

/** 一覧の1行：小さな絵・名前・枚数 */
function rowView(row: ReceivedCard, onTap: () => void): HTMLButtonElement {
  const { card, count } = row;
  const thumb = card.kind === 'monster' ? createMonsterPortrait(card, THUMB_W + 4) : createCardView(card, THUMB_W, false);
  return h(
    'button',
    { class: `card-list__row card-list__row--${card.kind}`, attrs: { type: 'button', 'aria-pressed': 'false' }, on: { click: onTap } },
    h('span', { class: 'card-list__thumb', attrs: { 'aria-hidden': 'true' } }, thumb),
    h('span', { class: 'card-list__name', text: cardName(card) }),
    h('span', { class: 'card-list__count', text: t('received.count', { n: count }) }),
  ) as HTMLButtonElement;
}
