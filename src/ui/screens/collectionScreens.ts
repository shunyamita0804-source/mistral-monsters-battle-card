import { getMonster, HIDDEN_MONSTER_ID, MONSTERS, SKILLS, SUPPORTS } from '../../data/cards.ts';
import { cardBookEntries, sectionKey, type BookEntry } from '../../data/cardNumbers.ts';
import { getPerson } from '../../data/people.ts';
import { completeSections, isUnknown, matchesFilter, type BookFilter } from '../../game/cards/cardBook.ts';
import { describeSkill, describeSupport, kindLabel } from '../../game/cards/cardTypes.ts';
import { isCardNew, markCardSeen } from '../../game/people/peopleBook.ts';
import { cardName, personName } from '../../i18n/content.ts';
import { createCardView, createUnknownCard } from '../components/cardView.ts';
import { button, h } from '../dom.ts';
import { GACHA_SERIES } from '../../data/economy.ts';
import { seriesLineup } from '../../game/economy/gachaSeries.ts';
import { cardCatalog } from '../../data/cards.ts';
import type { CardDefinition } from '../../game/cards/cardTypes.ts';
import { t } from '../../i18n/i18n.ts';
import { createCardGrid } from '../components/cardGrid.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import researcherFace from '@assets/images/characters/face_researcher.webp';
import completeArt from '@assets/images/ui/album/book_complete.webp';
import type { ScreenDefinition } from './types.ts';

/** 詳しい画面のカードの幅（背景の絵の額の内側 149×224 に収まる大きさ） */
const DETAIL_CARD_W = 134;

/** 集めた割合のメダル（2026-10-26 デザイン第11弾）：25%＝銅・50%＝銀・75%＝金・100%＝完成 */
const MEDAL_ART = Object.values(
  import.meta.glob<string>('/assets/images/ui/collection/medal_*.webp', { eager: true, query: '?url', import: 'default' }),
);

/** 集めた割合の帯（左にメダル、まだ25%に届かなければメダルなし） */
function collectionProgress(owned: number, total: number): HTMLElement {
  const pct = total > 0 ? Math.floor((owned / total) * 100) : 0;
  const tier = Math.min(4, Math.floor(pct / 25));
  const medal = tier > 0 ? MEDAL_ART[tier - 1] : undefined;
  const fill = h('span', { class: 'collection-progress__fill' });
  fill.style.width = `${pct}%`;
  return h(
    'div',
    { class: 'collection-progress', attrs: { role: 'img', 'aria-label': t('collection.progress', { n: pct }) } },
    medal ? h('img', { class: 'collection-progress__medal', attrs: { src: medal, alt: '', draggable: 'false' } }) : h('span', { class: 'collection-progress__medal is-empty' }),
    h('span', { class: 'collection-progress__bar' }, fill),
    h('span', { class: 'collection-progress__text', text: t('collection.progress', { n: pct }) }),
  );
}

/**
 * カード図鑑（研究所。2026-10-27 指示書でPS版のように作り直し）：番号（No.001〜）順に、モンスターごとの「本体 → 技」、サポート、隠しモンスター、
 * 最後に仮のカード（番号なし）。未入手は番号と「？？？」の枠だけ。モンスター1体分そろうと見出しに「完成」。
 * 手に入れてまだ詳しい画面で見ていないカードに NEW。押すと詳しい画面（上にカード・下に文。左右になぞる・矢印で前後の番号へ）
 */
export const collectionScreen: ScreenDefinition = {
  id: 'collection',
  titleKey: 'collection.title',
  create(ctx) {
    const store = ctx.store;
    const save = store.save;
    const element = h('main', { class: 'screen collection' });
    // 集めた割合（メダル・帯）はそれまでと同じ数え方
    const progressCards: CardDefinition[] = [...MONSTERS.filter((m) => m.id !== HIDDEN_MONSTER_ID || save.hiddenRestored), ...SKILLS, ...SUPPORTS];
    const ownedKinds = progressCards.filter((c) => (save.collection[c.id] ?? 0) > 0).length;
    const entries = cardBookEntries();
    let filter: BookFilter = 'all';
    const body = h('div', { class: 'card-book' });

    const label = (entry: BookEntry): string => (entry.no === null ? '' : t('collection.no', { n: String(entry.no).padStart(3, '0') }));
    const sectionTitle = (entry: BookEntry): string => {
      const sec = entry.section;
      if (sec.kind === 'monster') return cardName(getMonster(sec.monsterId));
      if (sec.kind === 'support') return t('collection.section.support');
      if (sec.kind === 'hidden') return save.hiddenRestored ? cardName(getMonster(HIDDEN_MONSTER_ID)) : t('collection.section.hidden');
      return t('collection.section.temp');
    };

    const render = (): void => {
      const now = store.save;
      const done = completeSections(now.collection, entries);
      const list = entries.filter((e) => matchesFilter(e, filter));
      const tabs = h(
        'div',
        { class: 'card-grid__tabs' },
        ...(
          [
            ['all', t('common.all')],
            ['monster', t('card.kind.monster')],
            ['skill', t('card.kind.skill')],
            ['support', t('collection.tab.support')],
          ] as const
        ).map(([f, text]) =>
          button(text, () => {
            filter = f;
            render();
          }, `card-grid__tab${filter === f ? ' is-active' : ''}`),
        ),
      );
      const parts: HTMLElement[] = [];
      let currentKey = '';
      let grid: HTMLElement | null = null;
      list.forEach((entry, index) => {
        const key = sectionKey(entry.section);
        if (key !== currentKey) {
          currentKey = key;
          const complete = done.has(key);
          parts.push(
            h(
              'h2',
              { class: `card-book__section${entry.section.kind === 'temp' ? ' card-book__section--temp' : ''}`, dataset: { section: key } },
              // 区切りの見出し（2026-10-27 に届いた帯の絵）。左の丸に、そろったら「完成」の印
              h('span', { class: 'card-book__seal' }, complete ? h('img', { class: 'card-book__complete', attrs: { src: completeArt, alt: t('collection.complete'), draggable: 'false' } }) : null),
              h('span', { class: 'card-book__section-name', text: sectionTitle(entry) }),
            ),
          );
          grid = h('div', { class: 'card-grid__items card-book__items' });
          parts.push(grid);
        }
        const unknown = isUnknown(entry, now.collection, now.hiddenRestored);
        const owned = now.collection[entry.card.id] ?? 0;
        const isNew = !unknown && isCardNew(now, entry.card.id);
        grid?.append(
          h(
            'button',
            {
              class: `card-grid__item card-book__item${unknown ? ' is-unowned' : ''}`,
              attrs: { type: 'button', 'aria-label': unknown ? `${label(entry)} ${t('card.grid.unknown')}` : cardName(entry.card) },
              dataset: { id: entry.card.id, no: entry.no === null ? '' : String(entry.no) },
              on: { click: () => openDetail(list, index) },
            },
            h('span', { class: 'card-book__no', text: label(entry) }),
            h(
              'span',
              { class: 'card-book__art' },
              unknown ? createUnknownCard(96) : createCardView(entry.card, 96, false),
              // 持っている枚数（丸い札。2026-10-27 に届いた部品）
              unknown ? null : h('span', { class: 'card-book__count', text: String(owned), attrs: { 'aria-label': t('common.owned', { n: owned }) } }),
            ),
            isNew ? h('span', { class: 'card-book__new', text: t('collection.new') }) : null,
            h('span', { class: 'card-grid__name', text: unknown ? t('common.unknownName') : cardName(entry.card) }),
          ),
        );
      });
      body.replaceChildren(tabs, ...parts);
    };

    /** 詳しい画面（上にカードを大きく、下に文）。左右になぞる・矢印・ボタンで前後の番号へ */
    const openDetail = (list: readonly BookEntry[], start: number): void => {
      let index = start;
      const view = h('div', { class: 'card-book-detail', attrs: { role: 'dialog', 'aria-modal': 'true' } });
      const show = (): void => {
        const entry = list[index];
        if (!entry) return;
        const now = store.save;
        const unknown = isUnknown(entry, now.collection, now.hiddenRestored);
        if (!unknown) store.update((s) => markCardSeen(s, entry.card.id));
        const card = entry.card;
        const rows: [string, string][] = [];
        if (!unknown) {
          rows.push([t('collection.detail.kind'), t('card.kindCard', { kind: kindLabel(card.kind) })]);
          if (card.kind === 'monster') rows.push([t('collection.detail.life'), String(card.life)]);
          else rows.push([t('collection.detail.mana'), String(card.cost)]);
          if (card.kind === 'skill') rows.push([t('collection.detail.effect'), describeSkill(card)]);
          if (card.kind === 'support') rows.push([t('collection.detail.effect'), describeSupport(card)]);
          rows.push([t('collection.detail.owned'), t('common.cardCount', { n: now.collection[card.id] ?? 0 })]);
        }
        view.replaceChildren(
          h(
            'div',
            { class: 'card-book-detail__top' },
            h('p', { class: 'card-book-detail__no', text: label(entry) || t('collection.section.temp') }),
            // 詳しい画面の背景（2026-10-27 に届いた絵）の、机の上の額の中にカード
            h('div', { class: 'card-book-detail__card' }, unknown ? createUnknownCard(DETAIL_CARD_W) : createCardView(card, DETAIL_CARD_W, true)),
          ),
          h(
            'div',
            { class: 'card-book-detail__bottom' },
            h('h2', { class: 'card-book-detail__name', text: unknown ? t('common.unknownName') : cardName(card) }),
            unknown
              ? h('p', { class: 'card-book-detail__text', text: t('collection.unknownDetail') })
              : h('dl', { class: 'card-book-detail__rows' }, ...rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })])),
          ),
          // 前後・閉じるのボタンは羊皮紙の下（背景の絵の下の帯）
          h(
            'div',
            { class: 'card-book-detail__nav' },
            button(`‹ ${t('collection.prev')}`, () => go(-1), 'btn btn--small'),
            button(t('common.close'), () => close(), 'btn btn--primary'),
            button(`${t('collection.next')} ›`, () => go(1), 'btn btn--small'),
          ),
        );
        const navButtons = view.querySelectorAll<HTMLButtonElement>('.card-book-detail__nav .btn--small');
        navButtons[0]!.disabled = index === 0;
        navButtons[1]!.disabled = index === list.length - 1;
      };
      const go = (d: number): void => {
        const next = index + d;
        if (next < 0 || next >= list.length) return;
        index = next;
        show();
      };
      let downX: number | null = null;
      view.addEventListener('pointerdown', (e) => (downX = e.clientX));
      view.addEventListener('pointerup', (e) => {
        if (downX === null) return;
        const dx = e.clientX - downX;
        downX = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      });
      const onKey = (e: KeyboardEvent): void => {
        if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === 'ArrowRight') go(1);
        else if (e.key === 'Escape') close();
      };
      const close = (): void => {
        window.removeEventListener('keydown', onKey);
        view.remove();
        render();
      };
      window.addEventListener('keydown', onKey);
      element.append(view);
      show();
    };

    element.append(
      createScreenHeader({ title: t('collection.title'), back: { label: t('common.back'), onTap: () => ctx.back('world') } }),
      // 研究所の場所の絵（デザイン第4弾）の上に、研究員の顔（第5弾）と登録数の吹き出し。ショップの店員と同じ形
      h(
        'div',
        { class: 'shop-menu__clerk collection__desk' },
        h('img', { class: 'shop-menu__clerk-figure shop-menu__face', attrs: { src: researcherFace, alt: researcherName(), draggable: 'false' } }),
        h('p', { class: 'shop-menu__bubble', text: t('collection.count', { owned: ownedKinds, total: progressCards.length }) }),
      ),
      collectionProgress(ownedKinds, progressCards.length),
      body,
    );
    render();
    return { element };
  },
};

function researcherName(): string {
  const person = getPerson('lucas');
  return person ? personName(person) : '';
}

/** ショップの「カードを見る」：解放済みパックの収録カード（所持枚数つき） */
export const cardListScreen: ScreenDefinition = {
  id: 'cardList',
  titleKey: 'cardList.title',
  create(ctx) {
    const save = ctx.store.save;
    const element = h('main', { class: 'screen card-list' });
    // 販売機のガチャ6シリーズの中身（2026-10-28 夜。前は販売機から外した仮パックの中身だった）
    const ids = new Set(GACHA_SERIES.flatMap((s) => seriesLineup(s).all));
    const cards = [...ids].map((id) => cardCatalog.get(id)).filter((c): c is CardDefinition => c !== undefined);
    element.append(
      createScreenHeader({ title: t('cardList.heading'), back: { label: t('common.back'), onTap: () => ctx.back('shopMenu') } }),
      h('p', { class: 'notice', text: t('cardList.note') }),
      createCardGrid({ cards, owned: save.collection, hideUnowned: false, modalParent: element }),
    );
    return { element };
  },
};
