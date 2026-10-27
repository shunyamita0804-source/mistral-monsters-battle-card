import { getMonster } from '../../data/cards.ts';
import { STARTER_DECKS, type StarterDeckKey } from '../../data/introV2.ts';
import type { Gender } from '../../game/save/saveData.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';
import { button, h } from '../dom.ts';
import { once } from '../gameStore.ts';
import { heroArtUrl } from '../components/heroArt.ts';
import { createMonsterPortrait } from '../components/monsterPortrait.ts';
import type { ScreenDefinition } from './types.ts';

/**
 * 主人公の選択（男性：黒髪・青系の帽子と服／女性：赤系の帽子と服）→ 最初のデッキの選択（導入イベントV2。2026-10-27）。
 * 2026-10-26：札（ふつう・押したとき光る）と大きな立ち絵はデザイン第8弾（src/ui/components/heroArt.ts）。
 * 2026-10-26 ユーザー指示：1回目に押すと札が光って選んだ状態に、同じ札をもう1回押すと決まる（別の札を押すと選び直し）。
 * デッキの選択も同じ操作。モンスター3体の組み合わせは決定、山札60枚の中身は【仮】（src/data/introV2.ts）。
 * 始めたあとの「ようこそ」の説明は出さない（ユーザー「自分で確かめさせるRPG要素にしたい」）
 */
export const newGameScreen: ScreenDefinition = {
  id: 'newGame',
  titleKey: 'newGame.title',
  create(ctx) {
    const element = h('main', { class: 'screen new-game' });
    const start = once((gender: Gender, starter: StarterDeckKey) => {
      ctx.store.newGame(gender, starter);
      // 家の中の画面の上に、物語の始まりの挿絵を1回だけ（2026-10-27 デザイン第13弾。src/ui/components/openingIntro.ts）
      ctx.store.openingIntro = true;
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
        }
        hint.textContent = t(hintKey);
      };
    };

    const showDecks = (gender: Gender): void => {
      const hint = h('p', { class: 'new-game__hint', attrs: { 'aria-live': 'polite' } });
      const pick = twoTap<StarterDeckKey>('deck', (key) => start(gender, key), hint, 'introV2.deck.confirmHint');
      const deck = (key: StarterDeckKey, monsters: readonly string[]): HTMLElement =>
        h(
          'button',
          { class: 'new-game__deck', attrs: { type: 'button', 'aria-pressed': 'false' }, dataset: { deck: key }, on: { click: () => pick(key) } },
          h('span', { class: 'new-game__deck-name', text: t(`introV2.deck.${key}` as MessageKey) }),
          h(
            'span',
            { class: 'new-game__deck-monsters' },
            ...monsters.map((id) => {
              const m = getMonster(id);
              return h('span', { class: 'new-game__deck-monster' }, createMonsterPortrait(m, 64, 64), h('span', { class: 'new-game__deck-monster-name', text: cardName(m) }));
            }),
          ),
        );
      element.replaceChildren(
        h('h1', { class: 'new-game__title', text: t('introV2.deck.heading') }),
        h('div', { class: 'new-game__decks' }, ...STARTER_DECKS.map((d) => deck(d.key, d.monsters))),
        h('p', { class: 'new-game__deck-note', text: t('introV2.deck.note') }),
        hint,
        button(t('introV2.deck.back'), () => showHeroes(), 'btn btn--ghost'),
      );
    };

    const showHeroes = (): void => {
      const hint = h('p', { class: 'new-game__hint', attrs: { 'aria-live': 'polite' } });
      const pick = twoTap<Gender>('gender', (gender) => showDecks(gender), hint, 'newGame.confirmHint');
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
