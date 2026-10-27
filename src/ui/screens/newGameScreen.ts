import type { Gender } from '../../game/save/saveData.ts';
import { t } from '../../i18n/i18n.ts';
import { button, h } from '../dom.ts';
import { once } from '../gameStore.ts';
import { heroArtUrl } from '../components/heroArt.ts';
import type { ScreenDefinition } from './types.ts';

/**
 * 主人公の選択（男性：黒髪・青系の帽子と服／女性：赤系の帽子と服）。
 * 2026-10-26：札（ふつう・押したとき光る）と大きな立ち絵はデザイン第8弾（src/ui/components/heroArt.ts）。
 * 2026-10-26 ユーザー指示：1回目に押すと札が光って選んだ状態に、同じ札をもう1回押すと決まる（別の札を押すと選び直し）。
 * 始めたあとの「ようこそ」の説明は出さない（ユーザー「自分で確かめさせるRPG要素にしたい」）
 */
export const newGameScreen: ScreenDefinition = {
  id: 'newGame',
  titleKey: 'newGame.title',
  create(ctx) {
    const element = h('main', { class: 'screen new-game' });
    const start = once((gender: Gender) => {
      ctx.store.newGame(gender);
      // 家の中の画面の上に、物語の始まりの挿絵を1回だけ（2026-10-27 デザイン第13弾。src/ui/components/openingIntro.ts）
      ctx.store.openingIntro = true;
      ctx.reset('world');
    });
    let selected: Gender | null = null;
    const hint = h('p', { class: 'new-game__hint', attrs: { 'aria-live': 'polite' } });
    const pick = (gender: Gender): void => {
      if (selected === gender) {
        start(gender);
        return;
      }
      selected = gender;
      for (const el of element.querySelectorAll<HTMLElement>('.new-game__choice')) {
        const on = el.dataset.gender === gender;
        el.classList.toggle('is-selected', on);
        el.setAttribute('aria-pressed', String(on));
      }
      hint.textContent = t('newGame.confirmHint');
    };
    const choice = (gender: Gender, label: string, note: string): HTMLElement =>
      h(
        'button',
        { class: 'new-game__choice', attrs: { type: 'button', 'aria-pressed': 'false' }, dataset: { gender }, on: { click: () => pick(gender) } },
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
      hint,
      button(t('newGame.back'), () => ctx.back('title'), 'btn btn--ghost'),
    );
    return { element };
  },
};
