import type { NpcObject } from '../../data/maps.ts';
import { INTRO_STATES, type IntroState, type SceneEffect, type SceneId } from '../../data/storyScenes.ts';
import type { SaveData } from '../save/saveData.ts';
import { isIntroV2Done, setIntroV2State, type IntroV2State } from './introV2.ts';

/**
 * 序盤イベント（となりの家の女性との出会い → カード練習場 → 最初の練習試合 → 自由行動）の進行。DOM 非依存。
 *
 * - 一本道にしない：「あとで」・スキップを選んでも街は自由に歩け、練習場にはいつでも行ける
 * - 旧セーブ（この機能より前のセーブ）は deferred にして、導入を突然始めない（話しかければ誘い直す）
 * - 練習試合の勝ち負けで進行が止まらない（負けても completed）
 */

export function isIntroState(value: unknown): value is IntroState {
  return INTRO_STATES.includes(value as IntroState);
}

export function setIntro(save: SaveData, intro: IntroState): SaveData {
  return save.story.intro === intro ? save : { ...save, story: { ...save.story, intro } };
}

/**
 * 案内役（となりの家の女性）がいる場所。
 * 誘う前・「あとで」・スキップは街、練習場へ案内してから最初の練習試合までは練習場、
 * 最初の練習試合が終わったら「家に戻る」と言って自分の家（2026-10-23 ユーザー決定）
 */
export function guidePlace(intro: IntroState): 'town' | 'practice' | 'home' {
  switch (intro) {
    case 'notSeen':
    case 'invited':
    case 'deferred':
    case 'skipped':
      return 'town';
    case 'completed':
      return 'home';
    default:
      return 'practice';
  }
}

/** 案内役の各場所の人の ID（maps.ts） */
const GUIDE_AT: Readonly<Record<ReturnType<typeof guidePlace>, string>> = {
  town: 'guide-town',
  practice: 'guide-practice',
  home: 'guide-home',
};

/** 導入イベントV2の間、案内役（幼馴染）が教習所の中にいる進み具合（街では一緒に歩く絵を画面側で出す） */
const V2_GUIDE_IN_PRACTICE: readonly IntroV2State[] = ['escortToSchool', 'schoolArrival', 'examBattleActive', 'examPassed', 'escortToBureau'];
/** 管理局の中にいる進み具合（先に入って待ち、パックを選ぶときに説明する） */
const V2_GUIDE_IN_BUREAU: readonly IntroV2State[] = ['escortToBureau', 'bureauReception', 'packSelection', 'packClaimed'];

/**
 * マップ上の人を表示するか（案内役だけ、進み具合で1か所にいる。ほかの人はいつもいる）。
 * 導入イベントV2の最中（と始まる前）は、教習所の中の案内役だけ（進み具合による）。終わったら家に帰る（前の導入と同じ）
 */
export function isNpcPresent(save: SaveData, npc: NpcObject): boolean {
  if (npc.npcId !== 'neighbor_guide') return true;
  const v2 = save.story.introV2;
  if (!isIntroV2Done(v2)) {
    return (npc.id === 'guide-practice' && V2_GUIDE_IN_PRACTICE.includes(v2.state)) || (npc.id === 'guide-bureau' && V2_GUIDE_IN_BUREAU.includes(v2.state));
  }
  return npc.id === GUIDE_AT[guidePlace(save.story.intro)];
}

/** マップに入ったときに自動で始まる場面（なければ null） */
export function sceneOnEnter(save: SaveData, mapId: string): SceneId | null {
  const intro = save.story.intro;
  if (mapId === 'town' && intro === 'notSeen') return 'invite';
  if (mapId === 'practice' && intro === 'onRoute') return 'arrive';
  return null;
}

/** 案内役に話しかけたときの場面 */
export function sceneOnTalk(save: SaveData): SceneId {
  switch (save.story.intro) {
    case 'notSeen':
    case 'invited':
    case 'deferred':
    case 'skipped':
      return 'reinvite';
    case 'onRoute':
      return 'arrive';
    case 'atPractice':
    case 'practiceStarted':
      return 'practiceAsk';
    case 'completed':
      return 'replay';
  }
}

/** 練習テーブルを調べたときの場面（案内役がいれば案内役と同じ、いなければ地の文で練習試合を勧める） */
export function sceneOnTable(save: SaveData): SceneId {
  return guidePlace(save.story.intro) === 'practice' ? sceneOnTalk(save) : 'tableOffer';
}

/** 練習試合の結果（バトル画面から歩行画面へ戻るときに持ち帰る） */
export interface PracticeResult {
  readonly winner: 'player' | 'opponent' | 'draw';
  /** 最初の練習（ヒントつき）だったか */
  readonly tutorial: boolean;
  /** 案内役のいる所で始めた練習試合か（案内役が相手）。いなければ練習テーブルだけ */
  readonly withGuide?: boolean;
}

/** 練習試合のあとの場面 */
export function sceneAfterPractice(_save: SaveData, result: PracticeResult): SceneId {
  if (result.tutorial) return result.winner === 'player' ? 'afterWin' : 'afterLose';
  return result.withGuide ? 'afterReplay' : 'afterTable';
}

/** 場面の効果のうち、セーブを変えるもの（進み具合）を当てる。練習試合の開始は画面側で行う */
export function applySceneEffects(save: SaveData, effects: readonly SceneEffect[]): SaveData {
  let next = save;
  for (const e of effects) {
    if (e.kind === 'intro') next = setIntro(next, e.value);
    else if (e.kind === 'introV2') next = setIntroV2State(next, e.value);
  }
  return next;
}

/** 練習試合を始めるときの進み具合（最初の練習の最中は practiceStarted） */
export function startPractice(save: SaveData, tutorial: boolean): SaveData {
  return tutorial && save.story.intro !== 'completed' ? setIntro(save, 'practiceStarted') : save;
}

/** 読み込み時：最初の練習試合の最中に閉じた（結果がない）なら、練習場に着いた状態へ戻す */
export function recoverIntro(intro: IntroState): IntroState {
  return intro === 'practiceStarted' ? 'atPractice' : intro;
}

/** 街に出す目的地の案内（練習場へ向かう間だけ） */
export function showsPracticeGoal(save: SaveData, mapId: string): boolean {
  return mapId === 'town' && save.story.intro === 'onRoute';
}
