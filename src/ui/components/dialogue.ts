import windowUrl from '@assets/images/ui/talk/dialogue_window_blank.png';
import nameUrl from '@assets/images/ui/talk/name_label_blank.png';
import choiceUrl from '@assets/images/ui/talk/button_blank.png';
import guideNormal from '@assets/images/characters/neighbor_guide_talk_normal.webp';
import guideSmile from '@assets/images/characters/neighbor_guide_talk_smile.webp';
import guideExplain from '@assets/images/characters/neighbor_guide_talk_explain.webp';
import guideSurprised from '@assets/images/characters/neighbor_guide_talk_surprised.webp';
import guideWorried from '@assets/images/characters/neighbor_guide_talk_worried.webp';
import guideHappy from '@assets/images/characters/neighbor_guide_talk_happy.webp';
import teacherFace from '@assets/images/characters/face_teacher.webp';
import clerkFace from '@assets/images/characters/face_clerk.webp';
import receptionistFace from '@assets/images/characters/face_receptionist.webp';
import eleanorFace from '@assets/images/characters/face_eleanor_temp.webp';
import researcherFace from '@assets/images/characters/face_researcher.webp';
import residentA from '@assets/images/characters/face_resident_a.webp';
import residentB from '@assets/images/characters/face_resident_b.webp';
import residentD from '@assets/images/characters/face_resident_d.webp';
import residentE from '@assets/images/characters/face_resident_e.webp';
import { SCENES, type Expression, type SceneEffect, type SceneId, type SceneStep, type Speaker } from '../../data/storyScenes.ts';
import { personOfSpeaker } from '../../data/people.ts';
import { personName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';
import { button, h } from '../dom.ts';

/**
 * 会話（文字送り・選択肢・スキップ）。見た目はミストラルモンスターズの会話 UI の画像
 * （セリフ枠・名前の札・選択肢のボタン。assets/images/ui/talk/）を使う。
 *
 * - 画面のどこをタップしても次へ（文字を出している途中なら、まず全部出す）
 * - 選択肢はボタン（高さ 46px）。スキップは右上
 * - 会話の絵（胸から上・表情6種）。6枚とも同じ位置・同じ大きさで描かれているので、表情だけ差し替えても人物は動かない
 *   （原本 1122×1402 を半分に縮小して WebP にしたもの。描き換えなし）。会話を始めるときに6枚とも先に読み込む
 * - 絵が無い表情は「仮」の札を出す（いまは全部そろっている）
 */

/** 会話の絵（人物 → 表情 → 画像の URL）。困り顔（troubled）の絵は 05_worried。表情の指定がない台詞は normal */
const PORTRAITS: Readonly<Partial<Record<Exclude<Speaker, 'system'>, Partial<Record<Expression, string>>>>> = {
  neighbor_guide: {
    normal: guideNormal,
    smile: guideSmile,
    explain: guideExplain,
    surprised: guideSurprised,
    troubled: guideWorried,
    happy: guideHappy,
  },
  // 住人の顔の絵（2026-10-23 第3弾。住人C は 2026-10-27 に住宅C ごとなくした。店員・受付と同じ「顔の絵の形」：正方形・胸から上。表情は1種類）
  resident_a: { normal: residentA },
  resident_b: { normal: residentB },
  resident_d: { normal: residentD },
  resident_e: { normal: residentE },
  teacher: { normal: teacherFace },
  clerk: { normal: clerkFace },
  receptionist: { normal: receptionistFace },
  researcher: { normal: researcherFace },
  // カードバトラー管理局の受付：エレノア。顔の絵がまだ無いので、立ち姿の絵の胸から上を切り抜いた仮の顔（正式な顔が届いたら差し替える）
  bureau_clerk: { normal: eleanorFace },
};

/** 正方形の「顔の絵の形」で描かれた人（案内役の会話の絵より小さく、正方形の枠で出す） */
const FACE_FORMAT: ReadonlySet<Speaker> = new Set<Speaker>(['resident_a', 'resident_b', 'resident_d', 'resident_e', 'teacher', 'clerk', 'receptionist', 'researcher', 'bureau_clerk']);

/** 会話の絵を先に読み込む（表情を切り替えた瞬間に白く抜けないように） */
const preloaded = new Set<string>();
function preloadPortraits(): void {
  if (typeof Image === 'undefined') return;
  for (const set of Object.values(PORTRAITS)) {
    for (const url of Object.values(set)) {
      if (!url || preloaded.has(url)) continue;
      preloaded.add(url);
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  }
}

/**
 * 名前の札。人物（src/data/people.ts。2026-10-27 名前が決まった）はその名前。
 * 管理局の受付は、職員（エレノア）がまだゲームに出てこない（データだけ）ので仮の呼び名のまま
 */
function speakerName(speaker: Exclude<Speaker, 'system'>): string {
  const person = personOfSpeaker(speaker);
  return person ? personName(person) : t('introV2.speaker.bureau');
}

/** 1文字を出す間隔（ミリ秒） */
const CHAR_MS = 28;

export interface DialogueOptions {
  /** 場面の始め・終わり・スキップで、進み具合を変えるとき（すぐに保存する） */
  readonly onEffects: (effects: readonly SceneEffect[]) => void;
  /** 話し手の名前の札を出したとき（名刺図鑑の登録に使う） */
  readonly onSpeaker?: (speaker: Exclude<Speaker, 'system'>) => void;
  /** 会話が閉じたとき。練習試合を始める場面なら practice が入る */
  readonly onClose: (practice: { readonly tutorial: boolean } | null) => void;
}

export interface DialogueHandle {
  close(): void;
}

export function playScene(parent: HTMLElement, start: SceneId, options: DialogueOptions): DialogueHandle {
  let sceneId: SceneId = start;
  let stepIndex = -1;
  let typing: ReturnType<typeof setInterval> | null = null;
  let fullText = '';
  let closed = false;

  preloadPortraits();
  const portrait = h('div', { class: 'talk__portrait' });
  const portraitImg = h('img', { class: 'talk__portrait-img', attrs: { alt: '', draggable: 'false' } }) as HTMLImageElement;
  const name = h('div', { class: 'talk__name' });
  const text = h('p', { class: 'talk__text', attrs: { 'aria-live': 'polite' } });
  const next = h('span', { class: 'talk__next', text: '▼', attrs: { 'aria-hidden': 'true' } });
  const choices = h('div', { class: 'talk__choices', attrs: { role: 'group' } });
  const win = h('div', { class: 'talk__window' }, name, text, next);
  const skip = button(t('story.ui.skip'), () => doSkip(), 'btn btn--small talk__skip');
  const overlay = h(
    'div',
    { class: 'talk', attrs: { role: 'dialog', 'aria-modal': 'true' }, on: { click: () => advance() } },
    skip,
    portrait,
    choices,
    win,
  );
  overlay.style.setProperty('--talk-window', `url("${windowUrl}")`);
  overlay.style.setProperty('--talk-name', `url("${nameUrl}")`);
  overlay.style.setProperty('--talk-choice', `url("${choiceUrl}")`);
  skip.addEventListener('click', (e) => e.stopPropagation());

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      advance();
    }
  };
  window.addEventListener('keydown', onKey);
  parent.append(overlay);

  const stopTyping = (): void => {
    if (typing) clearInterval(typing);
    typing = null;
    text.textContent = fullText;
    overlay.classList.add('is-ready');
  };

  const showSpeaker = (speaker: Speaker, expression: Expression | undefined): void => {
    if (speaker === 'system') {
      name.hidden = true;
      portrait.hidden = true;
      return;
    }
    name.hidden = false;
    name.textContent = speakerName(speaker);
    options.onSpeaker?.(speaker);
    const set = PORTRAITS[speaker];
    portrait.hidden = !set;
    if (!set) return;
    const url = set[expression ?? 'normal'];
    portrait.classList.toggle('is-face', FACE_FORMAT.has(speaker));
    portrait.dataset.expression = expression ?? 'normal';
    portrait.classList.toggle('is-temp', !url);
    if (url) {
      if (portraitImg.getAttribute('src') !== url) portraitImg.src = url;
      if (portraitImg.parentElement !== portrait) portrait.replaceChildren(portraitImg);
    } else {
      // 仮：会話の絵が届くまでの札（人物の絵は勝手に作らない）
      portrait.replaceChildren(
        h('span', { class: 'talk__portrait-temp', text: t('story.ui.portraitTemp') }),
        h('span', { class: 'talk__portrait-expr', text: t(`story.expr.${expression ?? 'normal'}` as MessageKey) }),
        h('span', { class: 'talk__portrait-note', text: t('story.ui.portraitNote') }),
      );
    }
  };

  const showLine = (step: Extract<SceneStep, { kind: 'line' }>): void => {
    choices.replaceChildren();
    overlay.classList.remove('is-choice', 'is-ready');
    showSpeaker(step.speaker, step.expression);
    fullText = t(step.text);
    text.textContent = '';
    let n = 0;
    const chars = [...fullText];
    typing = setInterval(() => {
      n += 1;
      text.textContent = chars.slice(0, n).join('');
      if (n >= chars.length) stopTyping();
    }, CHAR_MS);
  };

  const showChoice = (step: Extract<SceneStep, { kind: 'choice' }>): void => {
    overlay.classList.add('is-choice', 'is-ready');
    choices.replaceChildren(
      ...step.options.map((o) => {
        const b = h('button', { class: 'talk__choice', text: t(o.label), attrs: { type: 'button' } });
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (closed) return;
          if (o.next) enterScene(o.next);
          else finish(null);
        });
        return b;
      }),
    );
  };

  const runStep = (): void => {
    const scene = SCENES[sceneId];
    const step = scene.steps[stepIndex];
    if (!step) {
      endScene();
      return;
    }
    if (step.kind === 'line') showLine(step);
    else showChoice(step);
  };

  const enterScene = (id: SceneId): void => {
    sceneId = id;
    stepIndex = 0;
    const scene = SCENES[id];
    skip.hidden = scene.noSkip === true;
    if (scene.onStart?.length) options.onEffects(scene.onStart);
    runStep();
  };

  /** 場面の最後まで来た：続きの場面へ、なければ終わりの効果を当てて閉じる */
  const endScene = (): void => {
    const scene = SCENES[sceneId];
    if (scene.then) {
      enterScene(scene.then);
      return;
    }
    finish(scene.effects ?? []);
  };

  const finish = (effects: readonly SceneEffect[] | null): void => {
    if (closed) return;
    const list = effects ?? [];
    const intro = list.filter((e) => e.kind !== 'practice');
    if (intro.length) options.onEffects(intro);
    const practice = list.find((e): e is Extract<SceneEffect, { kind: 'practice' }> => e.kind === 'practice');
    close();
    options.onClose(practice ? { tutorial: practice.tutorial } : null);
  };

  function advance(): void {
    if (closed) return;
    if (typing) {
      stopTyping();
      return;
    }
    const step = SCENES[sceneId].steps[stepIndex];
    if (step?.kind === 'choice') return; // 選択肢はボタンで選ぶ
    stepIndex += 1;
    runStep();
  }

  function doSkip(): void {
    if (closed) return;
    const scene = SCENES[sceneId];
    if (scene.noSkip) return;
    finish(scene.skipEffects ?? scene.effects ?? []);
  }

  function close(): void {
    if (closed) return;
    closed = true;
    if (typing) clearInterval(typing);
    window.removeEventListener('keydown', onKey);
    overlay.remove();
  }

  enterScene(start);
  return { close };
}
