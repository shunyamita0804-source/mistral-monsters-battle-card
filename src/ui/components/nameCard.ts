import { isOpponentPerson, type Person } from '../../data/people.ts';
import type { PersonRecord } from '../../game/people/peopleBook.ts';
import { personEpithet, personLine, personName, personTitle } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { h } from '../dom.ts';
import { personFace } from './personFace.ts';
import opponentCardArt from '@assets/images/ui/album/namecard_opponent.webp';
import townCardArt from '@assets/images/ui/album/namecard_town.webp';
import unknownCardArt from '@assets/images/ui/album/namecard_unknown.webp';

/**
 * 名刺（2026-10-27 に届いた台紙。対戦相手はえんじ、街の人は紺、まだ会っていない人は人影の名刺）。
 * 台紙の絵の上に、番号・顔・名前・肩書き・ひとこと・対戦成績を重ねる（位置は books.css。台紙の絵の中の欄を測った割合）。
 * 文字の大きさは名刺の幅に合わせる（一覧の小さな名刺も、押したときの大きな名刺も同じ形）
 */
export function nameCard(person: Person, met: boolean, record: PersonRecord | null): HTMLElement {
  const no = String(person.no).padStart(2, '0');
  if (!met) {
    return h(
      'span',
      { class: 'ncard ncard--unknown' },
      h('img', { class: 'ncard__art', attrs: { src: unknownCardArt, alt: '', draggable: 'false' } }),
      h('span', { class: 'ncard__no', text: no }),
    );
  }
  const opponent = isOpponentPerson(person);
  const epithet = personEpithet(person);
  return h(
    'span',
    { class: `ncard ncard--${opponent ? 'opponent' : 'town'}` },
    h('img', { class: 'ncard__art', attrs: { src: opponent ? opponentCardArt : townCardArt, alt: '', draggable: 'false' } }),
    h('span', { class: 'ncard__no', text: no }),
    h('span', { class: 'ncard__face' }, personFace(person)),
    h('span', { class: 'ncard__name', text: personName(person) }),
    h('span', { class: 'ncard__title', text: personTitle(person) }),
    h('span', { class: 'ncard__body' }, epithet ? h('span', { class: 'ncard__epithet', text: epithet }) : null, h('span', { class: 'ncard__line', text: personLine(person) })),
    opponent && record
      ? h(
          'span',
          { class: 'ncard__cells' },
          h('span', { class: 'ncard__cell', text: t('peopleBook.wins', { n: record.wins }) }),
          h('span', { class: 'ncard__cell', text: t('peopleBook.losses', { n: record.losses }) }),
          h('span', { class: 'ncard__cell', text: t('peopleBook.battles', { n: record.wins + record.losses }) }),
        )
      : null,
  );
}
