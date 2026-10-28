import { localizedGameName } from '../config/app.ts';
import { INITIAL_SCREEN, type ScreenId } from '../config/screens.ts';
import { Router } from '../core/router.ts';
import { getLanguage, onLanguageChange, t } from '../i18n/i18n.ts';
import { GameStore } from './gameStore.ts';
import { SCREENS } from './screens/registry.ts';
import type { ScreenContext, ScreenInstance } from './screens/types.ts';
import { bgm } from './bgm.ts';
import { installButtonSound } from './buttonSound.ts';
import { sound } from './sound.ts';
import { mountStage } from './stage.ts';

/** セーブがなくても開ける画面（歩きの確認画面は自分用の仮セーブで動く） */
const NO_SAVE_SCREENS: readonly ScreenId[] = ['title', 'newGame', 'options', 'walkLab'];

/** 最初に開く画面。QA（?qa=1）のときだけ、?lab=walk で歩きの確認画面、?lab=pukarim でプカリムの試遊の画面（セーブが要る）を直接開ける */
export function initialScreen(qa: boolean, search: string): ScreenId {
  const lab = qa ? new URLSearchParams(search).get('lab') : null;
  return lab === 'walk' ? 'walkLab' : lab === 'pukarim' ? 'pukarimLab' : INITIAL_SCREEN;
}

/** アプリ全体の組み立て：ステージを用意し、ルーターの変化に合わせて画面を差し替える */
export function startApp(root: HTMLElement, store: GameStore = GameStore.fromBrowser()): void {
  const stage = mountStage(root, { qa: store.qa });
  // iPhone は最初のタップまで音を鳴らせないので、タップで効果音・BGM を使えるようにする
  sound.installUnlock();
  bgm.installUnlock();
  // ボタンの音（2026-10-28：ui_tap・ui_decide・ui_cancel・ui_disabled。どのボタンに何を鳴らすかは buttonSound.ts）
  installButtonSound();
  const router = new Router<ScreenId>(initialScreen(store.qa, typeof window === 'undefined' ? '' : window.location.search));
  let current: ScreenInstance | null = null;

  const context: ScreenContext = {
    navigate: (to) => router.navigate(to),
    back: (fallback) => {
      if (!router.back()) router.reset(fallback);
    },
    reset: (to) => {
      // 同じ画面への reset でも作り直す（歩行画面で別マップに移ったときなど）
      if (router.current === to) show(to);
      else router.reset(to);
    },
    store,
  };

  const show = (id: ScreenId): void => {
    current?.destroy?.();
    // セーブがない状態で遊ぶ画面に来たらタイトルへ（設定はセーブがなくても開ける）
    let target: ScreenId = !store.hasSave && !NO_SAVE_SCREENS.includes(id) ? 'title' : id;
    // ランダム生成のダンジョンの挑戦中（中断して再開したときも）は、歩行画面の代わりにダンジョンの画面（同じ階・同じ位置から）
    if (target === 'world' && store.hasSave && store.save.dungeonRun) target = 'dungeonRun';
    // 挑戦が終わっていれば（クリア・戻された）歩行画面へ
    if (target === 'dungeonRun' && (!store.hasSave || !store.save.dungeonRun)) target = store.hasSave ? 'world' : 'title';
    const screen = SCREENS[target];
    current = screen.create(context);
    stage.element.dataset.screen = target;
    stage.element.replaceChildren(current.element);
    updateDocument();
  };

  /** タブの題名と <html lang> を、いまの画面と言語に合わせる */
  const updateDocument = (): void => {
    const screen = SCREENS[(stage.element.dataset.screen as ScreenId | undefined) ?? router.current];
    document.title = `${t(screen.titleKey)}${t('common.titleSeparator')}${localizedGameName(getLanguage())}`;
    document.documentElement.lang = getLanguage();
  };
  onLanguageChange(updateDocument);

  router.subscribe(({ to }) => show(to));
  show(router.current);

  // バックグラウンドに回ったら念のため保存（iPhone でアプリを切り替えたとき）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && store.hasSave) store.persist();
  });
}
