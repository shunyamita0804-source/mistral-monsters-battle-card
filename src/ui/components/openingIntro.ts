import { h } from '../dom.ts';
import { once } from '../gameStore.ts';
import openingArt from '@assets/images/backgrounds/opening_art.webp';

/**
 * 物語の始まりの挿絵（2026-10-27 デザイン第13弾。原本 design-parts/ui-quality13-20261027/opening_art.png、切り出し tools/design/ui12_13_build.py）。
 * 主人公を選んで新しく始めたときに1回だけ、家の中の画面の上に画面いっぱいに出して、少し見せてからフェードアウトする。押すと先に消え始める。
 * 説明の文は出さない（2026-10-26 ユーザー「ようこそ」の説明をやめた）。見た目はダンジョンに入ったときの挿絵と同じ（world.css の .world__dungeon-intro）
 */
const OPENING_LOAD_WAIT_MS = 1500;
const OPENING_MS = 3500;
const OPENING_FADE_MS = 1200;

export function showOpeningIntro(root: HTMLElement, onDone?: () => void): void {
  const close = once(() => {
    el.classList.add('is-closing');
    setTimeout(() => {
      el.remove();
      onDone?.();
    }, OPENING_FADE_MS);
  });
  const art = h('img', { class: 'world__dungeon-intro-art', attrs: { src: openingArt, alt: '', draggable: 'false' } }) as HTMLImageElement;
  const el = h('div', { class: 'world__dungeon-intro world__opening', attrs: { role: 'button', 'aria-hidden': 'true' }, on: { click: close } }, art);
  el.style.setProperty('--intro-fade', `${OPENING_FADE_MS}ms`);
  root.append(el);
  // 絵を読み込み終えてから見せる時間を数える（遅くても OPENING_LOAD_WAIT_MS で始める）
  const loaded = art.decode ? art.decode().catch(() => undefined) : Promise.resolve();
  const wait = new Promise((resolve) => setTimeout(resolve, OPENING_LOAD_WAIT_MS));
  void Promise.race([loaded, wait]).then(() => {
    el.classList.add('is-ready');
    setTimeout(close, OPENING_MS);
  });
}
