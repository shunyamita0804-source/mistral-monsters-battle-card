import { t } from '../../i18n/i18n.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';
import { bgm } from '../bgm.ts';
import { button, h } from '../dom.ts';
import { once } from '../gameStore.ts';
import type { ScreenDefinition } from './types.ts';
import plazaArt from '@assets/images/backgrounds/prologue_01_plaza.webp';
import morningArt from '@assets/images/backgrounds/prologue_02_morning.webp';

/**
 * プロローグ（2026-10-30 指示書 M。ユーザー決定）：「最初から」のすぐあと、主人公を選ぶ前に挿絵2枚。
 * 「ひとりの若者の物語」→ その若者（主人公）を選ぶ → 名前 → 家 の流れ。「続きから」では出さない（新しく始めるたびに出す）。
 * - 絵（原本 design-parts/prologue-20261030/）は画面いっぱい（はみ出す左右を切る）。ゆっくり少しだけ寄る・切り替えはクロスフェード
 * - 文字は絵の上の約3分の1（空の所）に白い字＋やわらかい影。2つのかたまりを少し間をあけてフェードで出す
 * - 1枚あたり約6秒で次へ。タップで次へ（文字が出きっていないときは先に文字を全部出す）。右上に「スキップ」
 * - 曲は bgm_prologue（Shy Love。約12秒・ループしない）を1枚目と同時に1回だけ。早く進めた・スキップしたときは短く消して次へ
 */
const SLIDES: readonly { readonly art: string; readonly lines: readonly [MessageKey, MessageKey] }[] = [
  { art: plazaArt, lines: ['prologue.1a', 'prologue.1b'] },
  { art: morningArt, lines: ['prologue.2a', 'prologue.2b'] },
];
/** 1枚の長さ（ミリ秒）・2つ目の文字を出すまで（ミリ秒） */
const SLIDE_MS = 6000;
const SECOND_LINE_MS = 2000;
/** 最後の暗転（ミリ秒。CSS の .prologue.is-leaving と同じ） */
const LEAVE_MS = 700;

export const prologueScreen: ScreenDefinition = {
  id: 'prologue',
  titleKey: 'prologue.title',
  create(ctx) {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number): void => {
      timers.push(setTimeout(fn, ms));
    };
    const clearTimers = (): void => {
      for (const id of timers.splice(0)) clearTimeout(id);
    };

    const slides = SLIDES.map((s) =>
      h(
        'div',
        { class: 'prologue__slide' },
        h('img', { class: 'prologue__art', attrs: { src: s.art, alt: '', draggable: 'false' } }),
        h('div', { class: 'prologue__text' }, ...s.lines.map((key) => h('p', { class: 'prologue__line', text: t(key) }))),
      ),
    );
    let index = -1;
    let leaving = false;

    const finish = once((): void => {
      leaving = true;
      clearTimers();
      // 曲は短く消して、主人公を選ぶ画面へ（その画面の曲はプロローグの前と同じタイトルの曲。まだ決まっていない）
      bgm.play(null);
      element.classList.add('is-leaving');
      later(() => {
        bgm.play('title');
        ctx.reset('newGame');
      }, LEAVE_MS);
    });

    const lineEls = (i: number): HTMLElement[] => [...(slides[i]?.querySelectorAll<HTMLElement>('.prologue__line') ?? [])];
    const allShown = (i: number): boolean => lineEls(i).every((el) => el.classList.contains('is-shown'));

    const show = (i: number): void => {
      clearTimers();
      if (i >= slides.length) {
        finish();
        return;
      }
      index = i;
      slides.forEach((el, k) => el.classList.toggle('is-active', k === i));
      const [first, second] = lineEls(i);
      later(() => first?.classList.add('is-shown'), 400);
      later(() => second?.classList.add('is-shown'), 400 + SECOND_LINE_MS);
      later(() => show(i + 1), SLIDE_MS);
    };

    // タップ：文字が出きっていなければ全部出す、出きっていれば次へ（最後の1枚なら終わり）
    const onTap = (): void => {
      if (leaving || index < 0) return;
      if (!allShown(index)) {
        clearTimers();
        for (const el of lineEls(index)) el.classList.add('is-shown');
        later(() => show(index + 1), SLIDE_MS - SECOND_LINE_MS);
        return;
      }
      show(index + 1);
    };

    const skip = button(t('prologue.skip'), () => finish(), 'btn btn--small prologue__skip');
    const element = h('main', { class: 'screen prologue', on: { click: (e: Event) => (e.target === skip ? undefined : onTap()) } }, ...slides, skip);

    bgm.play('prologue');
    // 暗転から1枚目へ（次の描画で is-active を付けて、フェードで出す）
    requestAnimationFrame(() => requestAnimationFrame(() => show(0)));
    return {
      element,
      destroy: clearTimers,
    };
  },
};
