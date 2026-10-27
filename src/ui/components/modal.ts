import { t } from '../../i18n/i18n.ts';
import { button, h, type Child } from '../dom.ts';
import emblemWarn from '@assets/images/ui/frame/emblem_warn.webp';
import emblemAsk from '@assets/images/ui/frame/emblem_ask.webp';
import emblemOk from '@assets/images/ui/frame/emblem_ok.webp';
import emblemNg from '@assets/images/ui/frame/emblem_ng.webp';

/**
 * 窓の上に乗せる、窓の種類の紋章（2026-10-27 デザイン33点の 23）。
 * warn＝注意（もう戻れない・失うものがある）・ask＝質問（〜しますか？）・ok＝成功（できた・手に入れた）・ng＝失敗・できない
 */
export type ModalEmblem = 'warn' | 'ask' | 'ok' | 'ng';
const EMBLEM_ART: Readonly<Record<ModalEmblem, string>> = { warn: emblemWarn, ask: emblemAsk, ok: emblemOk, ng: emblemNg };

/**
 * 画面内に重ねるダイアログ。parent（position: relative の画面要素）の中に表示する。
 * 返り値の close() で閉じる。背景タップで閉じるかは closeOnBackdrop で指定。
 */
export interface ModalOptions {
  readonly title?: string;
  readonly body: readonly Child[];
  readonly actions?: readonly { readonly label: string; readonly onTap: () => void; readonly primary?: boolean; readonly disabled?: boolean }[];
  readonly closeOnBackdrop?: boolean;
  readonly onClose?: () => void;
  readonly className?: string;
  /** 窓の上の紋章（なければ出さない） */
  readonly emblem?: ModalEmblem;
}

export interface ModalHandle {
  readonly element: HTMLElement;
  close(): void;
}

export function openModal(parent: HTMLElement, options: ModalOptions): ModalHandle {
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    overlay.remove();
    options.onClose?.();
  };
  const actions = (options.actions ?? []).map((a) => {
    const b = button(a.label, a.onTap, `btn${a.primary ? ' btn--primary' : ''}`);
    b.disabled = a.disabled ?? false;
    return b;
  });
  const panel = h(
    'div',
    {
      class: `modal__panel${options.className ? ` ${options.className}` : ''}${options.emblem ? ' has-emblem' : ''}`,
      attrs: { role: 'dialog', 'aria-modal': 'true' },
      on: { click: (e) => e.stopPropagation() },
    },
    options.emblem ? h('img', { class: 'modal__emblem', attrs: { src: EMBLEM_ART[options.emblem], alt: '', draggable: 'false' } }) : null,
    options.title ? h('h2', { class: 'modal__title', text: options.title }) : null,
    h('div', { class: 'modal__body' }, ...options.body),
    actions.length > 0 ? h('div', { class: 'modal__actions' }, ...actions) : null,
  );
  const overlay = h(
    'div',
    {
      class: 'modal',
      on: {
        click: () => {
          if (options.closeOnBackdrop ?? true) close();
        },
      },
    },
    panel,
  );
  parent.append(overlay);
  queueMicrotask(() => (actions.find((b) => !b.disabled) ?? panel).focus?.({ preventScroll: true }));
  return { element: overlay, close };
}

/**
 * はい／いいえの確認（2026-10-23 ユーザー指示：確認の窓はすべて「はい／いいえ」）。onYes は1回だけ呼ばれる（二重タップ防止）。
 * 紋章はふつうは「質問」。もう戻れない・失うものがある確認は 'warn'
 */
export function confirmModal(parent: HTMLElement, title: string, body: readonly Child[], onYes: () => void, onClose?: () => void, emblem: ModalEmblem = 'ask'): ModalHandle {
  let done = false;
  const handle = openModal(parent, {
    title,
    body,
    emblem,
    ...(onClose ? { onClose } : {}),
    actions: [
      { label: t('common.no'), onTap: () => handle.close() },
      {
        label: t('common.yes'),
        primary: true,
        onTap: () => {
          if (done) return;
          done = true;
          handle.close();
          onYes();
        },
      },
    ],
  });
  return handle;
}

/** お知らせ（閉じるボタンのみ）。emblem：できた・手に入れた＝'ok'、できない＝'ng'（ふつうのお知らせは出さない） */
export function messageModal(parent: HTMLElement, text: string, onClose?: () => void, title?: string, visual?: HTMLElement, emblem?: ModalEmblem): ModalHandle {
  const handle = openModal(parent, {
    ...(title ? { title } : {}),
    ...(emblem ? { emblem } : {}),
    body: [...(visual ? [visual] : []), ...text.split('\n').map((line) => h('p', { class: 'modal__text', text: line }))],
    actions: [{ label: t('common.ok'), primary: true, onTap: () => handle.close() }],
    ...(onClose ? { onClose } : {}),
  });
  return handle;
}
