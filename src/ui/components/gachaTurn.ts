import { t } from '../../i18n/i18n.ts';
import { button, h } from '../dom.ts';
import { once } from '../gameStore.ts';
import { sound } from '../sound.ts';
import handleDiscArt from '@assets/images/ui/gacha/handle_disc.webp';
import handleCrankArt from '@assets/images/ui/gacha/handle_crank.webp';
import machineTopArt from '@assets/images/ui/gacha/machine_top.webp';
import trayClosedArt from '@assets/images/ui/gacha/tray_closed.webp';
import trayOpenArt from '@assets/images/ui/gacha/tray_open.webp';

/**
 * カードパック販売機のハンドルを回す場面（2026-10-27 カードショップ改修。ユーザー指示
 * 「ガチャマシンの専用画面でハンドル回す、カードパックが出る → カードパック開封画面」）。
 * 買ったあとに出す。ハンドルを指で時計まわりに1周まわすと（「自動でまわす」でも可）、取り出し口が開いてパックが出る。
 * パックを押すと onTake を呼ぶ（開封の画面へ）。お金はもう払っているので、途中でやめる手段は置かない。
 *
 * 絵：ハンドルは正式（Handle_Official_Reference.jpeg を円盤と取っ手に分けたもの）。
 *     機械の上半分と取り出し口は【仮】（参考シートからの切り出し。正式素材が届いたら差し替える）。tools/design/gacha_build.py
 */
const TURN_DEG = 360;
const CLICK_EVERY_DEG = 30;
/** 指が速く動いて角度が飛んだとき、1回で進める角度の上限（反対まわりと取り違えないように） */
const MAX_STEP_DEG = 70;
const AUTO_MS = 1600;
const DROP_MS = 450;

export function showGachaTurn(root: HTMLElement, packArt: string | undefined, packLabel: string, onTake: () => void): void {
  let turned = 0;
  let clicks = 0;
  let finished = false;
  let lastAngle: number | null = null;

  const crank = h('img', { class: 'gacha-turn__crank', attrs: { src: handleCrankArt, alt: '', draggable: 'false' } });
  const handle = h(
    'div',
    { class: 'gacha-turn__handle', attrs: { role: 'img', 'aria-label': t('gacha.handle') } },
    h('img', { class: 'gacha-turn__disc', attrs: { src: handleDiscArt, alt: '', draggable: 'false' } }),
    crank,
  );
  const packImg = (cls: string): HTMLElement =>
    packArt ? h('img', { class: cls, attrs: { src: packArt, alt: '', draggable: 'false' } }) : h('div', { class: `${cls} is-blank`, text: packLabel });
  // ガラスの中に、買ったパックが入っている
  const windowPacks = h('div', { class: 'gacha-turn__window' }, packImg('gacha-turn__stock'), packImg('gacha-turn__stock'), packImg('gacha-turn__stock'));
  const take = once(() => {
    overlay.remove();
    onTake();
  });
  const outPack = h(
    'button',
    { class: 'gacha-turn__out', attrs: { type: 'button', 'aria-label': t('gacha.takePack'), disabled: '' }, on: { click: take } },
    packImg('gacha-turn__out-art'),
  ) as HTMLButtonElement;
  const tray = h(
    'div',
    { class: 'gacha-turn__tray' },
    h('img', { class: 'gacha-turn__tray-closed', attrs: { src: trayClosedArt, alt: '', draggable: 'false' } }),
    h('img', { class: 'gacha-turn__tray-open', attrs: { src: trayOpenArt, alt: '', draggable: 'false' } }),
    outPack,
  );
  const hint = h('p', { class: 'gacha-turn__hint', text: t('gacha.turnHint') });
  const autoBtn = button(t('gacha.turnAuto'), () => autoTurn(), 'btn gacha-turn__auto');
  const takeBtn = button(t('gacha.takePack'), take, 'btn btn--primary gacha-turn__take');
  takeBtn.hidden = true;
  const overlay = h(
    'div',
    { class: 'gacha-turn' },
    hint,
    h('div', { class: 'gacha-turn__machine' }, h('img', { class: 'gacha-turn__machine-art', attrs: { src: machineTopArt, alt: t('gacha.machine'), draggable: 'false' } }), windowPacks),
    h('div', { class: 'gacha-turn__panel' }, tray, handle),
    h('div', { class: 'gacha-turn__actions' }, autoBtn, takeBtn),
  );

  const setTurned = (deg: number): void => {
    turned = Math.min(TURN_DEG, deg);
    crank.style.transform = `rotate(${turned}deg)`;
    // 30度ごとに歯車の「カチッ」
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
    overlay.classList.add('is-turned');
    autoBtn.disabled = true;
    sound.play('chestUnlock');
    // ガラスの中のパックが1つ落ちて、取り出し口が開き、パックが出てくる
    setTimeout(() => {
      tray.classList.add('is-open');
      outPack.disabled = false;
      outPack.classList.add('is-out');
      sound.deal();
      hint.textContent = t('gacha.packOut');
      autoBtn.hidden = true;
      takeBtn.hidden = false;
    }, DROP_MS);
  };

  const autoTurn = (): void => {
    if (finished) return;
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

  // 指でまわす：ハンドルの中心から見た指の角度の変わった分だけ回す（時計まわりだけ進む。反対まわりは止まる）
  const angleOf = (e: PointerEvent): number => {
    const r = handle.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  handle.addEventListener('pointerdown', (e) => {
    if (finished || autoBtn.disabled) return;
    handle.setPointerCapture(e.pointerId);
    lastAngle = angleOf(e);
    handle.classList.add('is-grabbed');
  });
  handle.addEventListener('pointermove', (e) => {
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
    handle.classList.remove('is-grabbed');
  };
  handle.addEventListener('pointerup', release);
  handle.addEventListener('pointercancel', release);

  root.append(overlay);
}
