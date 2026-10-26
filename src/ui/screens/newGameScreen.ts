import type { Gender } from '../../game/save/saveData.ts';
import { t } from '../../i18n/i18n.ts';
import { button, h } from '../dom.ts';
import { once } from '../gameStore.ts';
import { heroArtUrl } from '../components/heroArt.ts';
import type { ScreenDefinition } from './types.ts';

/**
 * 主人公の選択（男性：黒髪・青系の帽子と服／女性：赤系の帽子と服）。
 * 2026-10-26：札（ふつう・押したとき光る）と大きな立ち絵はデザイン第8弾（src/ui/components/heroArt.ts）。押すとすぐ始まる（いままでどおり）
 */
export const newGameScreen: ScreenDefinition = {
  id: 'newGame',
  titleKey: 'newGame.title',
  create(ctx) {
    const element = h('main', { class: 'screen new-game' });
    const start = once((gender: Gender) => {
      ctx.store.newGame(gender);
      ctx.store.flashMessage = t('newGame.welcome');
      ctx.reset('world');
    });
    const choice = (gender: Gender, label: string, note: string): HTMLElement =>
      h(
        'button',
        { class: 'new-game__choice', attrs: { type: 'button' }, dataset: { gender }, on: { click: () => start(gender) } },
        h(
          'span',
          { class: 'new-game__panel' },
          h('img', { class: 'new-game__hero', attrs: { src: heroArtUrl(gender), alt: '', draggable: 'false' } }),
          h('span', { class: 'new-game__label', text: label }),
        ),
        h('span', { class: 'new-game__note', text: note }),
      );
    element.append(
      h('h1', { class: 'new-game__title', text: t('newGame.heading') }),
      h('div', { class: 'new-game__choices' },
        choice('male', t('newGame.male'), t('newGame.maleNote')),
        choice('female', t('newGame.female'), t('newGame.femaleNote')),
      ),
      button(t('newGame.back'), () => ctx.back('title'), 'btn btn--ghost'),
    );
    return { element };
  },
};
