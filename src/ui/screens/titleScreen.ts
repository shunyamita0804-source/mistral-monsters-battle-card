import { APP_INFO } from '../../config/app.ts';
import { getLanguage, t } from '../../i18n/i18n.ts';
import { confirmModal } from '../components/modal.ts';
import { openNamePrompt } from '../components/namePrompt.ts';
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
          undefined,
          'warn',
        );
      } else {
        ctx.navigate('newGame');
      }
    };
    // ボタンの絵（2026-10-26 デザイン第11弾）：続きから＝金、最初から＝紺、設定＝小さな紺
    // つづきから：名前がまだ無い前のセーブ（2026-10-28 より前）は、1回だけ名前を決めてから
    const resume = (): void => {
      if (store.hasSave && store.save.player.name === null) {
        openNamePrompt(element, (name) => {
          store.update((s) => ({ ...s, player: { ...s.player, name } }));
          ctx.reset('world');
        });
        return;
      }
      ctx.reset('world');
    };
    const continueBtn = button(t('title.continue'), resume, 'btn btn--primary btn--large title__btn title__btn--continue');
    continueBtn.disabled = !store.hasSave;
    const en = getLanguage() === 'en';

    element.append(
      h(
        'div',
        { class: 'title__logo' },
        // 2026-10-26 ユーザー指示「アイコンは消して、ロゴをその分上に」（アプリのアイコンとしてはそのまま使う）
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
        button(t('title.newGame'), start, `btn btn--large title__btn ${store.hasSave ? 'title__btn--new' : 'title__btn--continue'}`),
        button(t('title.settings'), () => ctx.navigate('options'), 'btn title__btn title__btn--settings'),
        // 開発用（?qa=1 のときだけ）：歩きの確認画面
        store.qa ? button(t('walkLab.title'), () => ctx.navigate('walkLab'), 'btn btn--small') : null,
      ),
      h('p', { class: 'title__footer', text: t('title.footer', { version: APP_INFO.version }) }),
    );
    return { element };
  },
};
