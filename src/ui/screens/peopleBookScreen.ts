import { cardCatalog, getMonster } from '../../data/cards.ts';
import { isOpponentPerson, PEOPLE, PEOPLE_TOTAL, type Person } from '../../data/people.ts';
import { isMet, metCount, personRecord, type PersonRecord } from '../../game/people/peopleBook.ts';
import { cardName, personEpithet, personLine, personName, personTitle } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { createMonsterPortrait } from '../components/monsterPortrait.ts';
import { openModal } from '../components/modal.ts';
import { personFace } from '../components/personFace.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { h } from '../dom.ts';
import type { ScreenDefinition } from './types.ts';

/**
 * 名刺図鑑（家の本棚。2026-10-27 指示書「人物の名前・名刺図鑑・カード図鑑」）。
 * 会った人の名刺を No. 順に並べる。会っていない人は番号だけ（顔は人影・欄は空）。押すと大きく表示。
 * 街の人の名刺は紺、対戦する人の名刺はえんじ（台紙の絵が届くまで仮の見た目で色だけ分ける）
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
      const kind = isOpponentPerson(person) ? 'opponent' : 'town';
      const epithet = met ? personEpithet(person) : null;
      return h(
        'button',
        {
          class: `name-card name-card--${kind}${met ? '' : ' is-unmet'}`,
          attrs: { type: 'button', 'aria-label': met ? personName(person) : `${no(person.no)} ${t('peopleBook.unmet')}` },
          dataset: { person: person.id },
          on: { click: () => met && openPerson(person) },
        },
        h('span', { class: 'name-card__face' }, personFace(person, !met)),
        h(
          'span',
          { class: 'name-card__text' },
          h('span', { class: 'name-card__no', text: no(person.no) }),
          epithet ? h('span', { class: 'name-card__epithet', text: epithet }) : null,
          h('span', { class: 'name-card__name', text: met ? personName(person) : '' }),
          h('span', { class: 'name-card__title', text: met ? personTitle(person) : '' }),
        ),
      );
    };

    const openPerson = (person: Person): void => {
      const record = personRecord(save, person.id);
      const epithet = personEpithet(person);
      const rows: HTMLElement[] = [];
      if (isOpponentPerson(person)) {
        rows.push(
          row(t('peopleBook.record'), t('peopleBook.recordValue', { w: record.wins, l: record.losses })),
          row(t('peopleBook.monsters'), monstersView(record)),
          row(t('peopleBook.cards'), cardsView(person, record)),
        );
      }
      const handle = openModal(element, {
        className: `name-card-detail name-card-detail--${isOpponentPerson(person) ? 'opponent' : 'town'}`,
        body: [
          h('div', { class: 'name-card-detail__face' }, personFace(person)),
          h('p', { class: 'name-card-detail__no', text: no(person.no) }),
          epithet ? h('p', { class: 'name-card-detail__epithet', text: epithet }) : null,
          h('h2', { class: 'name-card-detail__name', text: personName(person) }),
          h('p', { class: 'name-card-detail__title', text: personTitle(person) }),
          h('p', { class: 'name-card-detail__line', text: personLine(person) }),
          rows.length > 0 ? h('dl', { class: 'name-card-detail__rows' }, ...rows) : null,
        ],
        actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
      });
    };

    element.append(
      createScreenHeader({ title: t('peopleBook.title'), back: { label: t('common.back'), onTap: () => ctx.back('world') } }),
      h('p', { class: 'people-book__count', text: t('peopleBook.count', { n: metCount(save), total: PEOPLE_TOTAL }) }),
      h('p', { class: 'people-book__note', text: t('peopleBook.temp') }),
      h('div', { class: 'people-book__list' }, ...[...PEOPLE].sort((a, b) => a.no - b.no).map(card)),
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
