import { computeStageLayout } from '../core/stageLayout.ts';
import { h } from './dom.ts';

/**
 * 390×844 の論理座標で組んだ画面（ステージ）を、セーフエリアを除いた実画面に合わせて拡大縮小する。
 *
 * #app            画面全体（背景）
 *  └ .viewport    セーフエリアの内側（CSS の env(safe-area-inset-*) で決まる）
 *     └ .stage    論理解像度の画面。transform で拡大縮小・中央寄せ
 */
export interface Stage {
  readonly element: HTMLElement;
}

/** iPhone のホーム画面から開いたか（Safari の「ホーム画面に追加」） */
const isIosStandalone = (): boolean => (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function mountStage(root: HTMLElement, options: { readonly qa?: boolean } = {}): Stage {
  const stage = h('div', { class: 'stage' });
  const viewport = h('div', { class: 'viewport' }, stage);
  // QA 用：画面の大きさの数字（iPhone で撮ってもらい、黒い余白の原因を確かめる）
  const diag = options.qa ? h('div', { class: 'stage-diag', attrs: { 'aria-hidden': 'true' } }) : null;
  root.replaceChildren(viewport, ...(diag ? [diag] : []));

  const apply = (): void => {
    const rect = viewport.getBoundingClientRect();
    const layout = computeStageLayout(rect.width, rect.height);
    stage.style.width = `${layout.width}px`;
    stage.style.height = `${layout.height}px`;
    stage.style.transform = `translate(${layout.offsetX}px, ${layout.offsetY}px) scale(${layout.scale})`;
    // 画面が縮んでいる（375×667 など）ときの、押す所の大きさの割り増し（実際の大きさで 44px 以上にする。tapSize.css。2026-10-30 指示書 O3）
    stage.style.setProperty('--tap-inv', String(Math.max(1, 1 / layout.scale)));
    stage.toggleAttribute('data-small', layout.scale < 0.98);
    if (diag) {
      const app = root.getBoundingClientRect();
      const vv = window.visualViewport;
      diag.textContent = [
        `screen ${window.screen.width}x${window.screen.height} inner ${window.innerWidth}x${window.innerHeight}`,
        `vv ${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)}` : '-'} app ${Math.round(app.top)}-${Math.round(app.bottom)}`,
        `safe ${viewport.offsetTop}/${Math.round(app.bottom - rect.bottom)} view ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        `stage ${layout.width}x${layout.height} x${layout.scale.toFixed(3)} sa ${isIosStandalone() ? 1 : 0}`,
      ].join('\n');
    }
  };

  new ResizeObserver(apply).observe(viewport);
  new ResizeObserver(apply).observe(root);
  window.addEventListener('orientationchange', apply);
  window.addEventListener('resize', apply);
  apply();

  return { element: stage };
}
