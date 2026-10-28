import guideSmile from '@assets/images/characters/neighbor_guide_talk_smile.webp';
import { personOfSpeaker } from '../../data/people.ts';
import { canDecideName, limitNameInput, MAX_NAME_LENGTH, nameLength, normalizeName } from '../../game/player/playerName.ts';
import { personName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { button, h } from '../dom.ts';

/**
 * 主人公の名前を決める窓（2026-10-28 ユーザー決定）。主人公を選んだすぐあと・前のセーブで「つづきから」を押したとき（名前がまだ無いとき1回だけ）。
 *
 * - スマホのキーボードで入れる（50音の文字盤は作らない）。入力欄をタップするとキーボードが出る
 * - 最大8文字（見た目の1文字＝1文字）。漢字の変換中は切らず、変換が決まってから8文字にそろえる
 * - 1文字も無いときは「決定」が灰色（押すと ui_disabled の音。aria-disabled にして、押したことが分かるようにしている）
 * - 「決定」→「○○ でいい？」はい＝決まり／いいえ＝入力に戻る
 * - キーボードが出たら、入力欄と「決定」が隠れないように窓を上へずらす（iPhone の Safari。visualViewport）
 *
 * 音はボタンに data-se を付けて、全体のしくみ（src/ui/buttonSound.ts）で鳴らす
 */
export function openNamePrompt(parent: HTMLElement, onDecide: (name: string) => void, initial = ''): { close(): void } {
  const guide = personOfSpeaker('neighbor_guide');
  const speaker = guide ? personName(guide) : '';
  let decided = false;
  let composing = false;

  const text = h('p', { class: 'name-prompt__text', attrs: { 'aria-live': 'polite' }, text: t('name.ask') });
  const input = h('input', {
    class: 'name-prompt__input',
    attrs: {
      type: 'text',
      inputmode: 'text',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      enterkeyhint: 'done',
      placeholder: t('name.placeholder'),
      'aria-label': t('name.inputAria'),
    },
  });
  input.value = limitNameInput(initial);
  const count = h('span', { class: 'name-prompt__count', attrs: { 'aria-hidden': 'true' } });
  const ok = button(t('name.decide'), () => askConfirm(), 'btn btn--primary btn--large name-prompt__ok');
  const field = h('div', { class: 'name-prompt__field' }, input, count);
  const rule = h('p', { class: 'name-prompt__rule', text: t('name.rule') });
  const yes = button(t('common.yes'), () => decide(), 'btn btn--primary name-prompt__yes');
  const no = button(t('common.no'), () => backToInput(), 'btn name-prompt__no');
  yes.dataset.se = 'decide';
  no.dataset.se = 'cancel';
  ok.dataset.se = 'decide';
  const confirmRow = h('div', { class: 'name-prompt__confirm' }, no, yes);
  const inputArea = h('div', { class: 'name-prompt__input-area' }, field, rule, ok);

  const win = h(
    'div',
    { class: 'name-prompt__window', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('name.title') } },
    h(
      'div',
      { class: 'name-prompt__talk' },
      h('img', { class: 'name-prompt__face', attrs: { src: guideSmile, alt: '', draggable: 'false' } }),
      h('div', { class: 'name-prompt__talk-body' }, speaker ? h('span', { class: 'name-prompt__speaker', text: speaker }) : null, text),
    ),
    inputArea,
    confirmRow,
  );
  const layer = h('div', { class: 'name-prompt' }, win);

  /** 「決定」を押せるか（灰色）と、文字数の表示 */
  const refresh = (): void => {
    const can = canDecideName(input.value);
    ok.classList.toggle('is-disabled', !can);
    ok.setAttribute('aria-disabled', String(!can));
    count.textContent = t('name.count', { n: Math.min(nameLength(input.value.trim()), MAX_NAME_LENGTH), max: MAX_NAME_LENGTH });
  };
  /** 変換が決まった文字を、入れられる文字・8文字にそろえる */
  const tidy = (): void => {
    const next = limitNameInput(input.value);
    if (next !== input.value) {
      input.value = next;
      input.setSelectionRange(next.length, next.length);
    }
    refresh();
  };
  input.addEventListener('compositionstart', () => {
    composing = true;
  });
  input.addEventListener('compositionend', () => {
    composing = false;
    tidy();
  });
  input.addEventListener('input', (e) => {
    if (composing || (e as InputEvent).isComposing) {
      refresh();
      return;
    }
    tidy();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing && !composing) {
      e.preventDefault();
      input.blur();
    }
  });

  const askConfirm = (): void => {
    if (ok.getAttribute('aria-disabled') === 'true') return;
    const name = normalizeName(input.value);
    if (!name) return;
    input.value = name;
    input.blur();
    text.textContent = t('name.confirm', { name });
    win.classList.add('is-confirm');
    queueMicrotask(() => yes.focus({ preventScroll: true }));
  };
  const backToInput = (): void => {
    win.classList.remove('is-confirm');
    text.textContent = t('name.ask');
    refresh();
  };
  const decide = (): void => {
    if (decided) return;
    const name = normalizeName(input.value);
    if (!name) return;
    decided = true;
    close();
    onDecide(name);
  };

  /* ---------- キーボードが出たとき、窓を上へずらす ---------- */
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const fit = (): void => {
    if (!win.isConnected) return;
    win.style.removeProperty('--name-shift');
    const rect = win.getBoundingClientRect();
    const scale = win.offsetHeight > 0 ? rect.height / win.offsetHeight : 1;
    // 見えている範囲（キーボードを除く）。getBoundingClientRect と同じ、レイアウトの画面の座標
    const visibleTop = (vv?.offsetTop ?? 0) + 8;
    const visibleBottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - 8;
    let shift = 0;
    if (rect.bottom > visibleBottom) shift = visibleBottom - rect.bottom;
    // 上にずらしすぎて窓の上が切れるときは、顔を小さくする（入力欄と決定を優先）
    win.classList.toggle('is-tight', rect.top + shift < visibleTop);
    if (win.classList.contains('is-tight')) {
      const tight = win.getBoundingClientRect();
      shift = tight.bottom > visibleBottom ? visibleBottom - tight.bottom : 0;
    }
    if (shift !== 0) win.style.setProperty('--name-shift', `${shift / scale}px`);
  };
  const onFocus = (): void => {
    // iPhone はキーボードが出てから visualViewport が変わる。念のため少し遅れても合わせる
    fit();
    setTimeout(fit, 150);
    setTimeout(fit, 400);
  };
  const onBlur = (): void => {
    setTimeout(() => {
      if (document.activeElement === input) return;
      win.classList.remove('is-tight');
      win.style.removeProperty('--name-shift');
      // キーボードを閉じたあと、iPhone でページがずれたまま残らないように
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    }, 50);
  };
  input.addEventListener('focus', onFocus);
  input.addEventListener('blur', onBlur);
  vv?.addEventListener('resize', fit);
  vv?.addEventListener('scroll', fit);
  window.addEventListener('scroll', fit);

  const close = (): void => {
    vv?.removeEventListener('resize', fit);
    vv?.removeEventListener('scroll', fit);
    window.removeEventListener('scroll', fit);
    layer.remove();
  };

  refresh();
  parent.append(layer);
  return { close };
}
