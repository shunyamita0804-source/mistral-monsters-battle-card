import type { DungeonDefinition } from '../../data/dungeons.ts';
import { dungeonName } from '../../i18n/content.ts';
import { h } from '../dom.ts';
import { once } from '../gameStore.ts';
import ruinsIntroArt from '@assets/images/ui/dungeon_intro/ruins_art.webp';
import ruinsIntroTitle from '@assets/images/ui/dungeon_intro/ruins_title.webp';
import ruinsIntroOverlay from '@assets/images/ui/dungeon_intro/ruins_overlay.webp';
import forestIntroArt from '@assets/images/ui/dungeon_intro/forest_art.webp';
import forestIntroTitle from '@assets/images/ui/dungeon_intro/forest_title.webp';
import forestIntroOverlay from '@assets/images/ui/dungeon_intro/forest_overlay.webp';
import waterIntroArt from '@assets/images/ui/dungeon_intro/water_art.webp';
import waterIntroOverlay from '@assets/images/ui/dungeon_intro/water_overlay.webp';
import waterIntroTitle from '@assets/images/ui/dungeon_intro/water_title.webp';
import iceIntroArt from '@assets/images/ui/dungeon_intro/ice_art.webp';
import iceIntroOverlay from '@assets/images/ui/dungeon_intro/ice_overlay.webp';
import iceIntroTitle from '@assets/images/ui/dungeon_intro/ice_title.webp';
import fireIntroArt from '@assets/images/ui/dungeon_intro/fire_art.webp';
import fireIntroOverlay from '@assets/images/ui/dungeon_intro/fire_overlay.webp';
import fireIntroTitle from '@assets/images/ui/dungeon_intro/fire_title.webp';
import machineIntroArt from '@assets/images/ui/dungeon_intro/machine_art.webp';
import machineIntroOverlay from '@assets/images/ui/dungeon_intro/machine_overlay.webp';
import machineIntroTitle from '@assets/images/ui/dungeon_intro/machine_title.webp';
import holyIntroArt from '@assets/images/ui/dungeon_intro/holy_art.webp';
import holyIntroOverlay from '@assets/images/ui/dungeon_intro/holy_overlay.webp';
import holyIntroTitle from '@assets/images/ui/dungeon_intro/holy_title.webp';
import { EVENT_DUNGEON_ART } from './eventDungeonArt.ts';

/**
 * ダンジョンに入ったときの挿絵・ダンジョン名の絵・重ねる部品（2026-10-26 ユーザー指示「ダンジョン入った時に挿絵とダンジョン名を入れたい」。
 * 同じ日に届いた6枚。原本 design-parts/dungeon-intro-20261026/、ゲーム用は tools/design/dungeon_intro_build.py）。
 * 挿絵は横長なので、画面いっぱいに切り抜いて真ん中を見せる（artX＝横のどこを見せるか）。絵が無いダンジョンは名前を文字で。
 * 2026-10-28：新しい5つ（水の神殿〜天の聖域）の挿絵と重ねる輪（tools/design/dungeons5_build.py）。挿絵は縦長で、真ん中を基準に上下左右を少しだけ切る。
 * 同じ日に5つのダンジョン名の絵も届いた（tools/design/dungeon_titles_build.py。遺跡・森と同じ大きさ・位置）
 * 2026-10-29：イベントのダンジョン3つ（仮の ID。まだダンジョンとしては足していない。eventDungeonArt.ts）
 * 歩行画面（固定のマップのダンジョン）と、ランダム生成のダンジョンの画面の両方で使う。見た目は world.css の .world__dungeon-intro
 */
const DUNGEON_INTRO: Readonly<Record<string, { readonly art: string; readonly title?: string; readonly overlay: string; readonly artX: string }>> = {
  'dungeon-01': { art: ruinsIntroArt, title: ruinsIntroTitle, overlay: ruinsIntroOverlay, artX: '50%' },
  'dungeon-02': { art: forestIntroArt, title: forestIntroTitle, overlay: forestIntroOverlay, artX: '50%' },
  'dungeon-03': { art: waterIntroArt, title: waterIntroTitle, overlay: waterIntroOverlay, artX: '50%' },
  'dungeon-04': { art: iceIntroArt, title: iceIntroTitle, overlay: iceIntroOverlay, artX: '50%' },
  'dungeon-05': { art: fireIntroArt, title: fireIntroTitle, overlay: fireIntroOverlay, artX: '50%' },
  'dungeon-06': { art: machineIntroArt, title: machineIntroTitle, overlay: machineIntroOverlay, artX: '50%' },
  'dungeon-07': { art: holyIntroArt, title: holyIntroTitle, overlay: holyIntroOverlay, artX: '50%' },
  ...Object.fromEntries(EVENT_DUNGEON_ART.map((d) => [d.id, d.intro])),
};
/** 絵の読み込みを待つ長さの上限（ミリ秒。遅い回線でも札がいつまでも残らないように） */
const DUNGEON_INTRO_LOAD_WAIT_MS = 1500;
/**
 * ダンジョンに入ったときの挿絵とダンジョン名を出しておく時間と、消える（フェードアウト）時間（ミリ秒。押すと先に消え始める）。
 * 2026-10-26 ユーザー指示：画面の横も縦もいっぱいに出し、フェードアウトしてダンジョンの画面に切り替える
 */
const DUNGEON_INTRO_MS = 3000;
const DUNGEON_INTRO_FADE_MS = 900;

/**
 * 画面いっぱいの挿絵とダンジョン名。少し見せてからフェードアウトして、ダンジョンの画面に切り替わる。押すと先に消え始める。
 * 消え終わったら onDone（あれば）
 */
export function showDungeonIntro(root: HTMLElement, dungeon: DungeonDefinition, onDone?: () => void): void {
  const intro = DUNGEON_INTRO[dungeon.id];
  const close = once(() => {
    el.classList.add('is-closing');
    setTimeout(() => {
      el.remove();
      onDone?.();
    }, DUNGEON_INTRO_FADE_MS);
  });
  const img = (cls: string, src: string): HTMLImageElement =>
    h('img', { class: cls, attrs: { src, alt: '', draggable: 'false' } }) as HTMLImageElement;
  const imgs = intro
    ? [img('world__dungeon-intro-art', intro.art), img('world__dungeon-intro-overlay', intro.overlay), ...(intro.title ? [img('world__dungeon-intro-title', intro.title)] : [])]
    : [];
  const el = h(
    'div',
    { class: `world__dungeon-intro${intro && !intro.title ? ' world__dungeon-intro--text' : ''}`, attrs: { role: 'button', 'aria-label': dungeonName(dungeon) }, on: { click: close } },
    ...imgs,
    intro?.title ? null : h('p', { class: 'world__dungeon-intro-name', text: dungeonName(dungeon) }),
  );
  if (intro) imgs[0]?.style.setProperty('object-position', `${intro.artX} 50%`);
  el.style.setProperty('--intro-fade', `${DUNGEON_INTRO_FADE_MS}ms`);
  root.append(el);
  // 絵を読み込み終えてから動きを始め、見せる時間を数える（読み込みが遅くても DUNGEON_INTRO_LOAD_WAIT_MS で始める）
  const loaded = Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => undefined) : Promise.resolve())));
  const wait = new Promise((resolve) => setTimeout(resolve, DUNGEON_INTRO_LOAD_WAIT_MS));
  void Promise.race([loaded, wait]).then(() => {
    el.classList.add('is-ready');
    setTimeout(close, DUNGEON_INTRO_MS);
  });
}
