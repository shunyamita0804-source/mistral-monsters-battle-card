import { t } from '../i18n/i18n.ts';
import { sound, type SoundId } from './sound.ts';

/**
 * ボタンの効果音（2026-10-28 指示書「ボタンの効果音」）。画面ごとに音を書かず、押されたボタンからここで決めて鳴らす。
 *
 * - ui_tap：ふつうのボタン・メニュー・タブ・一覧の行
 * - ui_decide：決める（決定・はい・OK・買う・出発など、次へ進むボタン）
 * - ui_cancel：戻る・いいえ・閉じる・やめる
 * - ui_disabled：押せない（灰色の）ボタン
 *
 * 決め方（上から順に）：
 * 1. ボタンか、その外側に data-se="tap|decide|cancel|none" があればそれ（none＝鳴らさない）
 * 2. 対戦の手札（.battle__hand）の中は鳴らさない（カードの音があるため）
 * 3. 押せないボタン（disabled・aria-disabled="true"）は ui_disabled
 * 4. 文字が「戻る・閉じる・いいえ・やめる」を含む、または画面の上の「戻る」→ ui_cancel
 * 5. 文字が「はい・OK」、または目立つボタン（btn--primary）→ ui_decide
 * 6. ほかは ui_tap
 *
 * 二重に鳴らさない：押したボタンの処理の中で、ほかの効果音（扉・レジ・ガチャ・カードなど）を鳴らしたときは、ボタンの音は鳴らさない
 * （押した瞬間に数を覚え、処理が終わったあとで比べる）。音は今の効果音と同じしくみ（Web Audio）で鳴らす
 */
export type ButtonSoundKind = 'tap' | 'decide' | 'cancel' | 'disabled';

const KIND_SOUND: Readonly<Record<ButtonSoundKind, SoundId>> = {
  tap: 'uiTap',
  decide: 'uiDecide',
  cancel: 'uiCancel',
  disabled: 'uiDisabled',
};

/** ボタンとして扱うもの */
const BUTTON_SELECTOR = 'button, [role="button"], [role="tab"]';

function isDisabled(el: Element): boolean {
  return (el instanceof HTMLButtonElement && el.disabled) || el.getAttribute('aria-disabled') === 'true';
}

/** ボタンの文字（読み上げの名前があればそれも） */
function labelOf(el: Element): string {
  return `${el.textContent ?? ''} ${el.getAttribute('aria-label') ?? ''}`.trim();
}

/** このボタンで鳴らす音の種類（鳴らさないなら null） */
export function buttonSoundKind(el: Element): ButtonSoundKind | null {
  const explicit = el.closest<HTMLElement>('[data-se]')?.dataset.se;
  if (explicit === 'none') return null;
  if (el.closest('.battle__hand')) return null;
  if (isDisabled(el)) return 'disabled';
  if (explicit === 'tap' || explicit === 'decide' || explicit === 'cancel') return explicit;
  const label = labelOf(el);
  // 英語は単語として（「No」が「Normal」に当たらないように）
  const has = (w: string): boolean => (/^[\x20-\x7e]+$/.test(w) ? new RegExp(`\\b${w}\\b`, 'i').test(label) : label.includes(w));
  const cancelWords = [t('common.back'), t('common.close'), t('common.no'), t('common.cancel')];
  if (el.classList.contains('screen-header__back') || cancelWords.some(has)) return 'cancel';
  const decideWords = [t('common.yes'), t('common.ok')];
  if (decideWords.includes(label) || el.classList.contains('btn--primary')) return 'decide';
  return 'tap';
}

/** 押せないボタンを押したか（pointerdown の場所にある、押せないボタン） */
function disabledButtonAt(target: Element, x: number, y: number): Element | null {
  const direct = target.closest(BUTTON_SELECTOR);
  if (direct) return isDisabled(direct) ? direct : null;
  // 押せないボタンにはイベントが届かないブラウザがあるので、押した所の下にある押せないボタンを探す
  for (const b of target.querySelectorAll('button:disabled')) {
    const r = b.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return b;
  }
  return null;
}

let installed = false;

/** 画面全体でボタンの音を鳴らすようにする（app.ts から1回） */
export function installButtonSound(root: Document = document): void {
  if (installed) return;
  installed = true;
  // 押せる（aria-disabled を含む）ボタン：押したあとで、ほかの効果音を鳴らしていなければ鳴らす
  root.addEventListener(
    'click',
    (e) => {
      const target = e.target instanceof Element ? e.target.closest(BUTTON_SELECTOR) : null;
      if (!target) return;
      const kind = buttonSoundKind(target);
      if (!kind) return;
      const before = sound.playCount;
      setTimeout(() => {
        if (sound.playCount === before) sound.play(KIND_SOUND[kind]);
      }, 0);
    },
    { capture: true },
  );
  // 押せない（disabled）ボタン：click が来ないので、押した瞬間に鳴らす
  root.addEventListener(
    'pointerdown',
    (e) => {
      if (!(e.target instanceof Element)) return;
      const b = disabledButtonAt(e.target, e.clientX, e.clientY);
      // aria-disabled のボタンは click が来るので、そちらで鳴らす
      if (!(b instanceof HTMLButtonElement) || !b.disabled || buttonSoundKind(b) !== 'disabled') return;
      sound.play('uiDisabled');
    },
    { capture: true, passive: true },
  );
}
