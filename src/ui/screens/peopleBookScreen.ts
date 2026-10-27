import { cardCatalog, getMonster } from '../../data/cards.ts';
import { isOpponentPerson, PEOPLE, PEOPLE_TOTAL, type Person } from '../../data/people.ts';
import { isMet, metCount, personRecord, type PersonRecord } from '../../game/people/peopleBook.ts';
import { cardName, personName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { createMonsterPortrait } from '../components/monsterPortrait.ts';
import { openModal } from '../components/modal.ts';
import { nameCard } from '../components/nameCard.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { button, h } from '../dom.ts';
import { sound } from '../sound.ts';
import type { ScreenDefinition } from './types.ts';

/** 1ページの名刺の数（名刺ファイルのポケットの数） */
const PER_PAGE = 5;
/** 横になぞってページをめくる距離（論理px） */
const SWIPE_PX = 48;

/**
 * 名刺図鑑（家の本棚。2026-10-27 指示書「人物の名前・名刺図鑑・カード図鑑」）。
 * 2026-10-27 に届いた絵：名刺ファイル（1ページにポケット5つ）に、No. 順に5枚ずつ。左右の矢印か、横になぞってページをめくる。
 * 会った人は台紙（対戦相手はえんじ・街の人は紺）に顔・名前・肩書き・ひとこと。会っていない人は人影の名刺に番号だけ。押すと大きく表示
 */
export const peopleBookScreen: ScreenDefinition = {
  id: 'peopleBook',
  titleKey: 'peopleBook.title',
  create(ctx) {
    const save = ctx.store.save;
    const element = h('main', { class: 'screen people-book' });
    const no = (n: number): string => t('peopleBook.no', { n: String(n).padStart(2, '0') });

    const card = (person: Person): HTMLElement => {
      const met = isMet(save, person.id);
      return h(
        'button',
        {
          class: `people-book__slot${met ? '' : ' is-unmet'}`,
          attrs: { type: 'button', 'aria-label': met ? personName(person) : `${no(person.no)} ${t('peopleBook.unmet')}` },
          dataset: { person: person.id },
          on: { click: () => met && openPerson(person) },
        },
        nameCard(person, met, isOpponentPerson(person) ? personRecord(save, person.id) : null),
      );
    };

    const openPerson = (person: Person): void => {
      const record = personRecord(save, person.id);
      const rows: HTMLElement[] = [];
      if (isOpponentPerson(person)) {
        rows.push(
          row(t('peopleBook.record'), t('peopleBook.recordValue', { w: record.wins, l: record.losses })),
          row(t('peopleBook.monsters'), monstersView(record)),
          row(t('peopleBook.cards'), cardsView(person, record)),
        );
      }
      // 大きな名刺（一覧と同じ台紙）と、その下に使うモンスター・もらえるカード
      const handle = openModal(element, {
        className: `name-card-detail name-card-detail--${isOpponentPerson(person) ? 'opponent' : 'town'}`,
        body: [
          h('div', { class: 'name-card-detail__card' }, nameCard(person, true, isOpponentPerson(person) ? record : null)),
          rows.length > 0 ? h('dl', { class: 'name-card-detail__rows' }, ...rows) : null,
        ],
        actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
      });
    };

    // 名刺ファイルのページ（5枚ずつ）
    const people = [...PEOPLE].sort((a, b) => a.no - b.no);
    const pages = Math.max(1, Math.ceil(people.length / PER_PAGE));
    let page = 0;
    const pageEl = h('div', { class: 'people-book__page' });
    const pageNo = h('span', { class: 'people-book__page-no' });
    const prev = button(t('peopleBook.prev'), () => turn(-1), 'people-book__turn');
    const next = button(t('peopleBook.next'), () => turn(1), 'people-book__turn');
    const show = (): void => {
      pageEl.replaceChildren(...people.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map(card));
      pageNo.textContent = t('peopleBook.page', { n: page + 1, total: pages });
      prev.disabled = page === 0;
      next.disabled = page === pages - 1;
    };
    const turn = (d: number): void => {
      const to = Math.min(pages - 1, Math.max(0, page + d));
      if (to === page) return;
      page = to;
      sound.tap();
      show();
    };
    // 横になぞってめくる
    let downX: number | null = null;
    pageEl.addEventListener('pointerdown', (e) => (downX = e.clientX));
    pageEl.addEventListener('pointerup', (e) => {
      if (downX === null) return;
      const dx = (e.clientX - downX) / (element.getBoundingClientRect().width / (element.clientWidth || 1) || 1);
      downX = null;
      if (Math.abs(dx) >= SWIPE_PX) turn(dx < 0 ? 1 : -1);
    });
    show();

    element.append(
      createScreenHeader({ title: t('peopleBook.title'), back: { label: t('common.back'), onTap: () => ctx.back('world') } }),
      h('p', { class: 'people-book__count', text: t('peopleBook.count', { n: metCount(save), total: PEOPLE_TOTAL }) }),
      pageEl,
      h('div', { class: 'people-book__nav' }, prev, pageNo, next),
    );
    return { element };
  },
};

function row(label: string, value: string | HTMLElement): HTMLElement {
  return h('div', { class: 'name-card-detail__row' }, h('dt', { text: label }), typeof value === 'string' ? h('dd', { text: value }) : h('dd', {}, value));
}

/** 使うモンスター（最後に対戦したときの3体） */
function monstersView(record: PersonRecord): HTMLElement | string {
  if (record.monsters.length === 0) return t('peopleBook.none');
  return h(
    'span',
    { class: 'name-card-detail__monsters' },
    ...record.monsters.map((id) => {
      const m = getMonster(id);
      return h('span', { class: 'name-card-detail__monster' }, createMonsterPortrait(m, 40, 40), h('span', { text: cardName(m) }));
    }),
  );
}

/**
 * もらえるカード：ダンジョンの人は相手のモンスターの技カード。その人から手に入れたことのあるモンスターの技だけ出し、まだのものは「？？？」。
 * 大会の相手（と常連）は試合ごとのカードがないので「—」
 */
function cardsView(person: Person, record: PersonRecord): HTMLElement | string {
  if (person.group !== 'dungeon') return t('peopleBook.none');
  const monsters = [...new Set(record.monsters)];
  if (monsters.length === 0) return t('peopleBook.none');
  // 消えたカード（データの作り直しで無くなった ID）は数えない
  const gotFrom = new Set(record.cards.flatMap((id) => {
    const card = cardCatalog.get(id);
    return card?.kind === 'skill' ? [card.monsterId] : [];
  }));
  return h(
    'span',
    { class: 'name-card-detail__cards' },
    ...monsters.map((m) =>
      h('span', { text: gotFrom.has(m) ? t('peopleBook.cardsOf', { monster: cardName(getMonster(m)) }) : t('common.unknownName') }),
    ),
  );
}
