import { APP_INFO } from '../../config/app.ts';
import { resolvePublicPath } from '../../core/assetPath.ts';
import { getLanguage, t } from '../../i18n/i18n.ts';
import { confirmModal } from '../components/modal.ts';
import { bgm } from '../bgm.ts';
import { button, h } from '../dom.ts';
import type { ScreenDefinition } from './types.ts';
import titleLogo from '@assets/images/ui/title/title_logo.webp';

export const titleScreen: ScreenDefinition = {
  id: 'title',
  titleKey: 'title.title',
  create(ctx) {
    const store = ctx.store;
    const element = h('main', { class: 'screen title' });
    bgm.play('title');
    const start = (): void => {
      if (store.hasSave) {
        confirmModal(
          element,
          t('title.confirmNew'),
          [h('p', { class: 'modal__text', text: t('title.confirmNewText') })],
          () => ctx.navigate('newGame'),
        );
      } else {
        ctx.navigate('newGame');
      }
    };
    const continueBtn = button(t('title.continue'), () => ctx.reset('world'), 'btn btn--primary btn--large');
    continueBtn.disabled = !store.hasSave;
    const en = getLanguage() === 'en';

    element.append(
      h(
        'div',
        { class: 'title__logo' },
        // ユーザー承認の正式アイコン（2026-10-23 新しい版。原本を縮小し、外側の黒い角を透明にしただけで描き換えていない）
        h('img', { class: 'title__icon', attrs: { src: resolvePublicPath('icons/icon-512.png'), alt: '', draggable: 'false' } }),
        // タイトルロゴ（2026-10-26 デザイン第9弾。英字の「MISTRAL MONSTERS / BATTLE CARD」）。日本語の正式名称は下に文字で添える（英語表示でも日本語）
        h('h1', { class: 'title__name title__name--logo' }, h('img', { class: 'title__logo-art', attrs: { src: titleLogo, alt: en ? APP_INFO.gameNameEn : APP_INFO.gameName, draggable: 'false' } })),
        h('p', { class: 'title__en', text: APP_INFO.gameName }),
      ),
      store.loadResult.status === 'unreadable'
        ? h('p', {
            class: 'notice notice--warn',
            text: t('title.unreadable', { reason: t(`title.unreadable.${store.loadResult.reason}`) }),
          })
        : '',
      h(
        'div',
        { class: 'title__buttons' },
        continueBtn,
        button(t('title.newGame'), start, store.hasSave ? 'btn btn--large' : 'btn btn--primary btn--large'),
        button(t('title.settings'), () => ctx.navigate('options'), 'btn'),
        // 開発用（?qa=1 のときだけ）：歩きの確認画面
        store.qa ? button(t('walkLab.title'), () => ctx.navigate('walkLab'), 'btn btn--small') : null,
      ),
      h('p', { class: 'title__footer', text: t('title.footer', { version: APP_INFO.version }) }),
    );
    return { element };
  },
};
