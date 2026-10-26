import { APP_INFO, localizedGameName } from '../../config/app.ts';
import { MONSTERS, SKILLS, SUPPORTS } from '../../data/cards.ts';
import { PACKS } from '../../data/economy.ts';
import { addCards, addCoins, unlockPacks } from '../../game/save/saveData.ts';
import { getLanguage, localeOf, t } from '../../i18n/i18n.ts';
import { confirmModal, messageModal } from '../components/modal.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { button, h } from '../dom.ts';
import type { ScreenDefinition } from './types.ts';
import { rankBadge } from '../components/rankBadge.ts';
import faceMale from '@assets/images/characters/face_hero_male.webp';
import faceFemale from '@assets/images/characters/face_hero_female.webp';
import coinArt from '@assets/images/icons/coin.png';
import cardBackArt from '@assets/images/ui/card_back.webp';
import medalArt from '@assets/images/icons/prize_medal.webp';
import packArt from '@assets/images/ui/packs/pack_01.webp';
import bookArt from '@assets/images/ui/battle/icon_rules.webp';

/** 日時の表示（いまの言語の書き方） */
export const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? t('common.none') : d.toLocaleString(localeOf());
};

/** ベッド：休む（セーブ確認）・記録・設定への入口・セーブ削除 */
export const settingsScreen: ScreenDefinition = {
  id: 'settings',
  titleKey: 'bed.title',
  create(ctx) {
    const store = ctx.store;
    const element = h('main', { class: 'screen settings' });
    const render = (): void => {
      const s = store.save;
      // 冒険の記録の板（2026-10-26 デザイン第10弾）：左＝主人公の顔とランク、右＝5行（左の丸い台にアイコン）
      const rows: [string, string, string][] = [
        [coinArt, t('bed.coins'), t('common.coins', { n: s.coins })],
        [cardBackArt, t('bed.cards'), t('common.cardCount', { n: Object.values(s.collection).reduce((a, b) => a + b, 0) })],
        [medalArt, t('bed.battles'), t('bed.battlesValue', { won: s.stats.battlesWon, lost: s.stats.battlesLost })],
        [packArt, t('bed.packs'), t('bed.packsValue', { n: s.stats.packsOpened })],
        [bookArt, t('bed.updatedAt'), formatDateTime(s.updatedAt)],
      ];
      const hero = t(s.player.gender === 'female' ? 'newGame.female' : 'newGame.male');
      const record = h(
        'div',
        { class: 'record-board' },
        h('span', { class: 'record-board__face' }, h('img', { attrs: { src: s.player.gender === 'female' ? faceFemale : faceMale, alt: t('bed.heroAlt', { hero }), draggable: 'false' } })),
        h('span', { class: 'record-board__rank', attrs: { 'aria-label': t('bed.rank') } }, rankBadge(s.rank, 26)),
        h(
          'dl',
          { class: 'record-board__rows' },
          ...rows.map(([icon, k, v]) =>
            h(
              'div',
              { class: 'record-board__row' },
              h('img', { class: 'record-board__icon', attrs: { src: icon, alt: '', draggable: 'false' } }),
              h('dt', { text: k }),
              h('dd', { text: v }),
            ),
          ),
        ),
      );
      element.replaceChildren(
        createScreenHeader({ title: t('bed.title'), back: { label: t('common.back'), onTap: () => ctx.back('world') } }),
        h(
          'div',
          { class: 'settings__body' },
          button(t('bed.rest'), () => {
            store.persist();
            messageModal(element, store.lastSaveOk ? t('bed.rested') : t('common.saveFailed'), render);
          }, 'btn btn--primary btn--large'),
          h('p', { class: 'settings__note', text: t('bed.autoSaveNote') }),
          record,
          h('p', { class: 'settings__note', text: t('bed.createdAtLine', { at: formatDateTime(s.createdAt) }) }),
          button(t('bed.settings'), () => ctx.navigate('options'), 'btn'),
          h('h2', { class: 'settings__heading', text: t('bed.about') }),
          h(
            'ul',
            { class: 'rule-list' },
            h('li', { text: t('bed.aboutVersion', { name: localizedGameName(getLanguage()), version: APP_INFO.version }) }),
            h('li', { text: t('bed.aboutPlaceholder') }),
            h('li', { text: t('bed.aboutMaps') }),
            h('li', { text: t('bed.aboutSprites') }),
            h('li', { text: t('bed.aboutTemplate') }),
          ),
          button(t('common.toTitle'), () => ctx.reset('title'), 'btn'),
          button(t('bed.delete'), () => {
            confirmModal(element, t('bed.deleteConfirm'), [h('p', { class: 'modal__text', text: t('bed.deleteConfirmText') })], () => {
              confirmModal(element, t('bed.deleteConfirm2'), [h('p', { class: 'modal__text', text: t('bed.deleteConfirm2Text') })], () => {
                store.deleteSave();
                ctx.reset('title');
              });
            });
          }, 'btn btn--danger'),
          store.qa
            ? h(
                'div',
                { class: 'settings__qa' },
                h('h2', { class: 'settings__heading', text: t('bed.qaHeading') }),
                button('+1000G', () => {
                  store.update((x) => addCoins(x, 1000));
                  render();
                }, 'btn btn--small'),
                button(t('bed.qaAllCards'), () => {
                  store.update((x) => addCards(x, [...MONSTERS.filter((m) => !m.hidden), ...SKILLS, ...SUPPORTS].map((c) => ({ cardId: c.id, count: 4 }))));
                  render();
                }, 'btn btn--small'),
                button(t('bed.qaAllPacks'), () => {
                  store.update((x) => unlockPacks(x, PACKS.map((p) => p.id)));
                  render();
                }, 'btn btn--small'),
                button(t('walkLab.title'), () => ctx.navigate('walkLab'), 'btn btn--small'),
              )
            : null,
        ),
      );
    };
    render();
    return { element };
  },
};
