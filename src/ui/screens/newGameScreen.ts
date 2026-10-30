import type { Gender } from '../../game/save/saveData.ts';
import { t } from '../../i18n/i18n.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';
import { button, h } from '../dom.ts';
import { once } from '../gameStore.ts';
import { bgm } from '../bgm.ts';
import { heroArtUrl } from '../components/heroArt.ts';
import { openNamePrompt } from '../components/namePrompt.ts';
import type { ScreenDefinition } from './types.ts';

/**
 * 主人公の選択（男性：黒髪・青系の帽子と服／女性：赤系の帽子と服）。選んだらそのまま家の始まりへ。
 * 2026-10-28 ユーザー決定：最初のデッキの3択はなくした（カードは管理局で受け取るブースターの箱から）。
 * 2026-10-26：札（ふつう・押したとき光る）と大きな立ち絵はデザイン第8弾（src/ui/components/heroArt.ts）。
 * 2026-10-26 ユーザー指示：1回目に押すと札が光って選んだ状態に、同じ札をもう1回押すと決まる（別の札を押すと選び直し）。
 * 始めたあとの「ようこそ」の説明は出さない（ユーザー「自分で確かめさせるRPG要素にしたい」）
 * 2026-10-28 ユーザー決定：主人公を決めたすぐあと（導入が始まる前）に名前を決める（src/ui/components/namePrompt.ts）
 */
export const newGameScreen: ScreenDefinition = {
  id: 'newGame',
  titleKey: 'newGame.title',
  create(ctx) {
    const element = h('main', { class: 'screen new-game' });
    // 主人公の選択・名前の曲（2026-10-30 指示書 O2 ユーザー決定）：Bon Voyage!。名前のあと家に入ると家の曲、「戻る」でタイトルに戻るとタイトルの曲
    bgm.play('departure');
    const start = once((gender: Gender, name: string) => {
      ctx.store.newGame(gender, name);
      // 家の中の画面の上の物語の始まりの挿絵（2026-10-27。src/ui/components/openingIntro.ts）は、
      // 2026-10-30 から「最初から」のあとのプロローグ（src/ui/screens/prologueScreen.ts）に置きかわったので出さない
      ctx.store.openingIntro = false;
      ctx.reset('world');
    });

    /** 1回目で選んだ状態、同じものをもう1回で決定 */
    const twoTap = <K extends string>(attr: string, onDecide: (key: K) => void, hint: HTMLElement, hintKey: MessageKey): ((key: K) => void) => {
      let selected: K | null = null;
      return (key) => {
        if (selected === key) {
          onDecide(key);
          return;
        }
        selected = key;
        for (const el of element.querySelectorAll<HTMLElement>(`[data-${attr}]`)) {
          const on = el.dataset[attr] === key;
          el.classList.toggle('is-selected', on);
          el.setAttribute('aria-pressed', String(on));
          // ボタンの音：1回目（選ぶ）は ui_tap、選んだ札をもう1回（決める）は ui_decide（src/ui/buttonSound.ts）
          if (on) el.dataset.se = 'decide';
          else delete el.dataset.se;
        }
        hint.textContent = t(hintKey);
      };
    };

    const showHeroes = (): void => {
      const hint = h('p', { class: 'new-game__hint', attrs: { 'aria-live': 'polite' } });
      const pick = twoTap<Gender>('gender', (gender) => openNamePrompt(element, (name) => start(gender, name)), hint, 'newGame.confirmHint');
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
      element.replaceChildren(
        h('h1', { class: 'new-game__title', text: t('newGame.heading') }),
        h('div', { class: 'new-game__choices' },
          choice('male', t('newGame.male'), t('newGame.maleNote')),
          choice('female', t('newGame.female'), t('newGame.femaleNote')),
        ),
        hint,
        button(t('newGame.back'), () => ctx.back('title'), 'btn btn--ghost'),
      );
    };

    showHeroes();
    return { element };
  },
};
