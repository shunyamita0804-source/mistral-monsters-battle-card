import { cardCatalog } from '../../data/cards.ts';
import type { GachaSeries } from '../../data/economy.ts';
import { skillArtX } from '../../data/skillArtPosition.ts';
import { canReselectSeries, seriesLineup } from '../../game/economy/gachaSeries.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { button, h } from '../dom.ts';
import { once } from '../gameStore.ts';
import { sound } from '../sound.ts';
import { cardThumbUrl, seriesPackUrl } from './gachaArt.ts';
import knobBaseArt from '@assets/images/ui/gacha/knob_base.webp';
import knobDialArt from '@assets/images/ui/gacha/knob_dial.webp';
import machineFrontArt from '@assets/images/ui/gacha/machine_front.webp';
import machineGlassArt from '@assets/images/ui/gacha/machine_glass.webp';
import outletClosedArt from '@assets/images/ui/gacha/outlet_closed.webp';
import outletOpenArt from '@assets/images/ui/gacha/outlet_open.webp';
import outletFrontArt from '@assets/images/ui/gacha/outlet_front.webp';
import outletZoomBackArt from '@assets/images/ui/gacha/outlet_zoom_back.webp';
import outletZoomFrontArt from '@assets/images/ui/gacha/outlet_zoom_front.webp';

/**
 * カードパック販売機の画面（2026-10-28 作り直し。指示書 design-parts/gacha-20261028/00_instructions_for_claude_code.txt の「2. 機械の画面」「3. まわし終えたら」）。
 * - 上：シリーズの名前・「パックを選び直す」（払う前だけ）・ラインナップ15枠（手に入れたカードは絵、まだのものは「？」）
 * - 機械：ガラスの中・出てくるパックは選んだシリーズの絵。ハンドルの代わりにつまみ（knob_base は動かない・knob_dial が回る。中心は (650,1000)）
 *   指で時計まわりに1周。反対まわりでは進まない。18°ごとに「カチッ」。「自動でまわす」もある
 * - まわし終えたら：機械が小さく揺れる（chestUnlock）→ 取り出し口が開く → 取り出し口へ寄る（0.6秒）→ 寄りきったら細かい絵（outlet_zoom_back/front）に切り替え →
 *   パックが寝た形で奥から手前へすべり出て、手前のふちからはみ出して止まり、ふわっと光る（cardSlide）→「タップして取り出す」
 * 払う前（「もう1回」の値段の確認で「いいえ」を選んだとき）は、つまみ・「自動でまわす」をさわると onRequestPay（値段の確認をもう一度）
 * 機械の部品は 900×1300 の同じキャンバスで、そのまま重ねる（位置は gacha.css）。お試しページ prototype/gacha_prototype_reference.html の動き・時間に合わせた
 */
const TURN_DEG = 360;
const CLICK_EVERY_DEG = 18;
/** 指が速く動いて角度が飛んだとき、1回で進める角度の上限（反対まわりと取り違えないように） */
const MAX_STEP_DEG = 70;
const AUTO_MS = 1600;
/** 揺れてから取り出し口が開くまで */
const SHAKE_MS = 420;
/** 取り出し口へ寄る時間（gacha.css の transition と同じ） */
const ZOOM_MS = 600;
/** 細かい絵に切り替えてから、パックがすべり出るまで */
const SLIDE_DELAY_MS = 160;
/** パックがすべり出る時間（gacha.css の animation と同じ） */
const SLIDE_MS = 520;

export interface GachaMachineOptions {
  readonly series: GachaSeries;
  /** 払ってあるか（払う前は「パックを選び直す」を出し、つまみをさわると onRequestPay） */
  readonly paid: boolean;
  /** 持っているカード（払う前の時点。払ったあとの中身がラインナップに先に出ないように） */
  readonly collection: Readonly<Record<string, number>>;
  readonly onReselect: () => void;
  readonly onRequestPay: () => void;
  readonly onRates: () => void;
  /** パックを取り出した（開ける画面へ） */
  readonly onTake: () => void;
}

export interface GachaMachineHandle {
  readonly element: HTMLElement;
  /** 払った（つまみをまわせるようにする） */
  markPaid(): void;
  close(): void;
}

/** ラインナップの枠の絵（技の絵の横の位置は大きなカードと同じ。src/data/skillArtPosition.ts） */
function lineupArt(url: string, x: number): HTMLElement {
  const img = h('img', { attrs: { src: url, alt: '', draggable: 'false' } });
  img.style.objectPosition = `${x}% 50%`;
  return img;
}

/** ラインナップ15枠と「○ / 15 そろった」 */
function lineupView(series: GachaSeries, collection: Readonly<Record<string, number>>): HTMLElement {
  const { all, monsterId } = seriesLineup(series);
  let owned = 0;
  const cells = all.map((id) => {
    const has = (collection[id] ?? 0) > 0;
    if (has) owned += 1;
    const url = has ? cardThumbUrl(id) : undefined;
    const card = cardCatalog.get(id);
    return h(
      'div',
      { class: `gacha-lineup__cell${has ? ' is-owned' : ''}${id === monsterId ? ' is-monster' : ''}`, attrs: { role: 'img', 'aria-label': has && card ? cardName(card) : '?' } },
      url ? lineupArt(url, card?.kind === 'skill' ? skillArtX(id) : 50) : h('span', { class: 'gacha-lineup__q', text: '?' }),
    );
  });
  return h(
    'div',
    { class: 'gacha-lineup' },
    ...cells,
    h('p', { class: 'gacha-lineup__note', text: t('gacha.series.owned', { n: owned, total: all.length }) }),
  );
}

export function showGachaMachine(root: HTMLElement, options: GachaMachineOptions): GachaMachineHandle {
  const { series } = options;
  const packUrl = seriesPackUrl(series);
  const name = t('gacha.series.name', { monster: cardName(series.monsterId) });
  let paid = options.paid;
  let turned = 0;
  let clicks = 0;
  let finished = false;
  let auto = false;
  let lastAngle: number | null = null;

  const dial = h('img', { class: 'gacha-machine__layer gacha-machine__dial', attrs: { src: knobDialArt, alt: '', draggable: 'false' } });
  // 指でつかめる範囲はつまみの絵より広く（::before）
  const knob = h('div', { class: 'gacha-machine__knob', attrs: { role: 'img', 'aria-label': t('gacha.knob') } });
  const layer = (src: string, cls = ''): HTMLElement =>
    h('img', { class: `gacha-machine__layer${cls ? ` ${cls}` : ''}`, attrs: { src, alt: '', draggable: 'false' } });
  const packImg = (cls: string): HTMLElement => h('img', { class: cls, attrs: { src: packUrl, alt: '', draggable: 'false' } });
  // ガラスの中に、選んだシリーズのパックが入っている
  const windowPacks = h('div', { class: 'gacha-machine__window' }, packImg('gacha-machine__stock'), packImg('gacha-machine__stock'), packImg('gacha-machine__stock'));
  // 機械：ガラスの奥（紺とパック）→ 本体 → ガラスの光 → つまみの台 → 取り出し口（閉・開）→ 受け皿の手前のふち → つまみ（回る）→ つかむ所
  const machine = h(
    'div',
    { class: 'gacha-machine__machine' },
    windowPacks,
    layer(machineFrontArt),
    layer(machineGlassArt),
    layer(knobBaseArt),
    layer(outletClosedArt, 'gacha-machine__outlet-closed'),
    layer(outletOpenArt, 'gacha-machine__outlet-open'),
    layer(outletFrontArt),
    dial,
    knob,
  );
  // 取り出し口に寄ったときの細かい絵：奥と床 → 寝たパック → 手前のふち
  const take = once(() => {
    close();
    options.onTake();
  });
  const outPack = h(
    'button',
    { class: 'gacha-machine__out', attrs: { type: 'button', 'aria-label': t('gacha.tapToTake'), disabled: '' }, on: { click: () => take() } },
    h('span', { class: 'gacha-machine__out-shadow' }),
    h('span', { class: 'gacha-machine__lie' }, packImg('gacha-machine__lie-art')),
  ) as HTMLButtonElement;
  const zoom = h(
    'div',
    { class: 'gacha-machine__zoom' },
    h('img', { class: 'gacha-machine__zoom-img', attrs: { src: outletZoomBackArt, alt: '', draggable: 'false' } }),
    outPack,
    h('img', { class: 'gacha-machine__zoom-img gacha-machine__zoom-front', attrs: { src: outletZoomFrontArt, alt: '', draggable: 'false' } }),
  );
  const tapHint = h('p', { class: 'gacha-machine__tap', text: t('gacha.tapToTake') });
  const stage = h('div', { class: 'gacha-machine__stage' }, machine, zoom, tapHint);
  stage.addEventListener('click', () => {
    if (stage.classList.contains('is-landed')) take();
  });

  const hint = h('p', { class: 'gacha-machine__hint' });
  const autoBtn = button(t('gacha.turnAuto'), () => (paid ? autoTurn() : options.onRequestPay()), 'btn gacha-machine__auto');
  // 回すと歯車の「カチッ」が鳴るので、ボタンの音は付けない（2026-10-28 二重にしない）
  autoBtn.dataset.se = 'none';
  const reselect = button(t('gacha.reselect'), () => options.onReselect(), 'gacha-machine__reselect');
  const rates = button(t('gacha.rates'), () => options.onRates(), 'gacha-machine__rates');
  const lineupHost = lineupView(series, options.collection);
  const overlay = h(
    'div',
    { class: 'gacha-machine', dataset: { series: series.id } },
    h('div', { class: 'gacha-machine__bar' }, h('span', { class: 'gacha-machine__name', text: name }), rates, reselect),
    lineupHost,
    hint,
    h('div', { class: 'gacha-machine__room' }, stage),
    h('div', { class: 'gacha-machine__actions' }, autoBtn),
  );

  const syncPaid = (): void => {
    reselect.hidden = !canReselectSeries(paid);
    hint.textContent = paid ? t('gacha.turnHint') : t('gacha.unpaidHint');
    overlay.classList.toggle('is-unpaid', !paid);
  };

  const setTurned = (deg: number): void => {
    turned = Math.min(TURN_DEG, deg);
    dial.style.transform = `rotate(${turned}deg)`;
    // 18°ごとに歯車の「カチッ」
    const nextClicks = Math.floor(turned / CLICK_EVERY_DEG);
    if (nextClicks > clicks) {
      clicks = nextClicks;
      sound.ratchet();
    }
    if (turned >= TURN_DEG) finish();
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    lastAngle = null;
    autoBtn.disabled = true;
    // ガシャン：機械が小さく揺れて、ガラスの中のパックが1つ落ちる
    sound.play('chestUnlock');
    overlay.classList.add('is-turned');
    machine.classList.add('is-shake');
    setTimeout(() => {
      // 取り出し口が開いて、取り出し口へ寄る
      machine.classList.add('is-open');
      stage.classList.add('is-zoom');
      autoBtn.hidden = true;
      hint.textContent = t('gacha.packOut');
      setTimeout(() => {
        // 寄りきったら細かい絵に切り替えて、パックがすべり出る
        stage.classList.add('is-detail');
        setTimeout(() => {
          outPack.classList.add('is-out');
          sound.play('cardSlide');
          setTimeout(() => {
            stage.classList.add('is-landed');
            outPack.disabled = false;
          }, SLIDE_MS);
        }, SLIDE_DELAY_MS);
      }, ZOOM_MS);
    }, SHAKE_MS);
  };

  const autoTurn = (): void => {
    if (finished || auto) return;
    auto = true;
    autoBtn.disabled = true;
    const from = turned;
    const start = performance.now();
    const stepFrame = (now: number): void => {
      if (finished) return;
      const k = Math.min(1, (now - start) / AUTO_MS);
      // ゆっくり回し始めて、ゆっくり止まる
      const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      setTurned(from + (TURN_DEG - from) * ease);
      if (k < 1) requestAnimationFrame(stepFrame);
    };
    requestAnimationFrame(stepFrame);
  };

  // 指でまわす：つまみの中心から見た指の角度の変わった分だけ回す（時計まわりだけ進む。反対まわりは止まる）
  const angleOf = (e: PointerEvent): number => {
    const r = knob.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  knob.addEventListener('pointerdown', (e) => {
    if (finished || auto) return;
    if (!paid) {
      options.onRequestPay();
      return;
    }
    knob.setPointerCapture(e.pointerId);
    lastAngle = angleOf(e);
    knob.classList.add('is-grabbed');
  });
  knob.addEventListener('pointermove', (e) => {
    if (lastAngle === null) return;
    const a = angleOf(e);
    let d = a - lastAngle;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    lastAngle = a;
    if (d > 0) setTurned(turned + Math.min(d, MAX_STEP_DEG));
  });
  const release = (): void => {
    lastAngle = null;
    knob.classList.remove('is-grabbed');
  };
  knob.addEventListener('pointerup', release);
  knob.addEventListener('pointercancel', release);

  const close = (): void => {
    overlay.remove();
  };

  syncPaid();
  root.append(overlay);
  return {
    element: overlay,
    markPaid() {
      paid = true;
      syncPaid();
    },
    close,
  };
}
