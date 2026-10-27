import { BOOSTERS, isBoosterKey, isStarterDeckKey, type BoosterKey, type StarterDeckKey } from '../../data/introV2.ts';
import { addCards, hasProcessed, markProcessed, type SaveData } from '../save/saveData.ts';

/**
 * 導入イベントV2「プロのカードバトラーになる試験」の進行（2026-10-27 ユーザー正式依頼。DOM 非依存）。
 *
 * 新しく始めたとき：家から街に出ると幼馴染が声をかける → 教習所（いまのカード練習場）へ一緒に歩く → 先生と試験の対戦（勝つまで）→
 * カードバトラー管理局へ一緒に歩く → 受付でブースターパックを3種から1つ選ぶ → 外で幼馴染が案内 → 自由行動。
 * 断る・飛ばすはない（文字を一気に出すのはよい）。ただし【仮】のチュートリアルスキップ（ユーザー指示。販売前に消す予定）だけはある。
 * 前の形式のセーブは legacySkipped にして、突然始めない。
 */
export type IntroV2State =
  | 'notStarted'
  | 'introGreeting'
  | 'escortToSchool'
  | 'schoolArrival'
  | 'examBattleActive'
  | 'examPassed'
  | 'escortToBureau'
  | 'bureauReception'
  | 'packSelection'
  | 'packClaimed'
  | 'worldBriefing'
  | 'completed'
  /** この機能より前のセーブ（自動では始めない） */
  | 'legacySkipped'
  /** 【仮】チュートリアルスキップで終えた（販売前にスキップのボタンと一緒に消す予定） */
  | 'skipped';

export const INTRO_V2_STATES: readonly IntroV2State[] = [
  'notStarted',
  'introGreeting',
  'escortToSchool',
  'schoolArrival',
  'examBattleActive',
  'examPassed',
  'escortToBureau',
  'bureauReception',
  'packSelection',
  'packClaimed',
  'worldBriefing',
  'completed',
  'legacySkipped',
  'skipped',
];

export const INTRO_V2_VERSION = 1;

export interface IntroV2 {
  readonly state: IntroV2State;
  /** 新しく始めたときに選んだ初期デッキ（3種のどれか。前の形式のセーブは null） */
  readonly selectedStarterDeckKey: StarterDeckKey | null;
  readonly examPassed: boolean;
  /** 試験の対戦を始めた回数（負けて再挑戦するたびに増える。先生のライフを少なくする救済に使う） */
  readonly examAttempts: number;
  readonly selectedBoosterKey: BoosterKey | null;
  readonly boosterClaimed: boolean;
  /** 受け取りの ID（1回だけ処理する。アプリの再起動・2回のタップでも同じ） */
  readonly boosterClaimId: string | null;
  /** パックの中身（正式なカード）を所持カードに入れたか。中身が決まるまでは false のまま */
  readonly boosterGranted: boolean;
  readonly tutorialCompleted: boolean;
  readonly version: number;
}

/** 新しく始めたとき */
export function newIntroV2(starter: StarterDeckKey | null): IntroV2 {
  return {
    state: 'notStarted',
    selectedStarterDeckKey: starter,
    examPassed: false,
    examAttempts: 0,
    selectedBoosterKey: null,
    boosterClaimed: false,
    boosterClaimId: null,
    boosterGranted: false,
    tutorialCompleted: false,
    version: INTRO_V2_VERSION,
  };
}

/** 前の形式のセーブ（自動では始めない） */
export const LEGACY_INTRO_V2: IntroV2 = { ...newIntroV2(null), state: 'legacySkipped' };

/** イベントの最中か（自由に歩けない・メニューを出さない） */
export function isIntroV2Active(v: IntroV2): boolean {
  return v.state !== 'notStarted' && v.state !== 'completed' && v.state !== 'legacySkipped' && v.state !== 'skipped';
}

/** イベントが終わっているか（もう自動で始まらない） */
export function isIntroV2Done(v: IntroV2): boolean {
  return v.state === 'completed' || v.state === 'legacySkipped' || v.state === 'skipped';
}

function setV2(save: SaveData, patch: Partial<IntroV2>): SaveData {
  return { ...save, story: { ...save.story, introV2: { ...save.story.introV2, ...patch } } };
}

/** 進み具合を変える。勝つ前に試験より先へは進めない（不変条件） */
export function setIntroV2State(save: SaveData, state: IntroV2State): SaveData {
  const v = save.story.introV2;
  if (v.state === state) return save;
  const afterExam: readonly IntroV2State[] = ['escortToBureau', 'bureauReception', 'packSelection', 'packClaimed', 'worldBriefing', 'completed'];
  if (afterExam.includes(state) && !v.examPassed) return save;
  if ((state === 'worldBriefing' || state === 'completed') && !v.boosterClaimed) return save;
  return setV2(save, { state, ...(state === 'completed' ? { tutorialCompleted: true } : {}) });
}

/** 家から街に出たとき：まだ始めていなければ、幼馴染の声かけを始める（1回だけ） */
export function startIntroV2OnTown(save: SaveData): SaveData {
  return save.story.introV2.state === 'notStarted' ? setV2(save, { state: 'introGreeting' }) : save;
}

/** 試験の対戦を始める（回数を数える） */
export function beginExam(save: SaveData): SaveData {
  const v = save.story.introV2;
  if (v.examPassed) return save;
  return setV2(save, { state: 'examBattleActive', examAttempts: v.examAttempts + 1 });
}

/** 試験の対戦の結果。勝てば合格、負け・引き分けは教習所の先生の前に戻って再挑戦 */
export function finishExam(save: SaveData, won: boolean): SaveData {
  if (save.story.introV2.examPassed) return save;
  return won ? setV2(save, { state: 'examPassed', examPassed: true }) : setV2(save, { state: 'schoolArrival' });
}

/**
 * パックを受け取る（1回だけ）。tx は確認の窓を開いたときに作る ID。
 * 中身（正式なカード）が決まっていれば所持カードに入れる。決まっていなければ選んだ記録だけ（あとで grantPendingBooster が1回だけ配る）
 */
export function claimBooster(save: SaveData, key: BoosterKey, tx: string): SaveData {
  const v = save.story.introV2;
  if (v.boosterClaimed || hasProcessed(save, tx) || !isBoosterKey(key) || !v.examPassed) return save;
  const claimed = markProcessed(setV2(save, { state: 'packClaimed', selectedBoosterKey: key, boosterClaimed: true, boosterClaimId: tx }), tx);
  return grantPendingBooster(claimed);
}

/** 受け取ったパックの中身が決まっていて、まだ配っていなければ1回だけ配る（正式な中身が届いたあと、読み込むたびに呼んでよい） */
export function grantPendingBooster(save: SaveData): SaveData {
  const v = save.story.introV2;
  if (!v.boosterClaimed || v.boosterGranted || !v.selectedBoosterKey) return save;
  const cards = BOOSTERS.find((b) => b.key === v.selectedBoosterKey)?.cards;
  if (!cards || cards.length === 0) return save;
  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  return setV2(addCards(save, [...counts].map(([cardId, count]) => ({ cardId, count }))), { boosterGranted: true });
}

/** 【仮】チュートリアルスキップ：イベントを終えて自由に歩けるようにする（試験の合格・パックの受け取りはしない） */
export function skipIntroV2(save: SaveData): SaveData {
  return isIntroV2Active(save.story.introV2) || save.story.introV2.state === 'notStarted' ? setV2(save, { state: 'skipped' }) : save;
}

/**
 * 読み込んだとき：途中で閉じても安全な所から続ける。
 * - 試験の対戦の最中 → 先生の前（schoolArrival）に戻して再挑戦
 * - 合格の記録がないのに試験より先 → 教習所の先生の前
 * - 受け取っていないのに受け取った後 → パックを選ぶところ
 */
export function recoverIntroV2(v: IntroV2): IntroV2 {
  let state = v.state;
  if (state === 'examBattleActive') state = 'schoolArrival';
  const afterExam: readonly IntroV2State[] = ['examPassed', 'escortToBureau', 'bureauReception', 'packSelection', 'packClaimed', 'worldBriefing', 'completed'];
  if (afterExam.includes(state) && !v.examPassed) state = 'schoolArrival';
  if ((state === 'packClaimed' || state === 'worldBriefing' || state === 'completed') && !v.boosterClaimed) state = 'packSelection';
  return state === v.state ? v : { ...v, state };
}

/** 読み込んだセーブの値を確かめる（壊れていれば前の形式と同じく legacySkipped） */
export function normalizeIntroV2(raw: unknown): IntroV2 {
  if (typeof raw !== 'object' || raw === null) return LEGACY_INTRO_V2;
  const r = raw as Record<string, unknown>;
  const state = INTRO_V2_STATES.includes(r.state as IntroV2State) ? (r.state as IntroV2State) : 'legacySkipped';
  const selectedBoosterKey = isBoosterKey(r.selectedBoosterKey) ? r.selectedBoosterKey : null;
  const boosterClaimed = r.boosterClaimed === true && selectedBoosterKey !== null;
  return recoverIntroV2({
    state,
    selectedStarterDeckKey: isStarterDeckKey(r.selectedStarterDeckKey) ? r.selectedStarterDeckKey : null,
    examPassed: r.examPassed === true,
    examAttempts: typeof r.examAttempts === 'number' && Number.isFinite(r.examAttempts) && r.examAttempts >= 0 ? Math.floor(r.examAttempts) : 0,
    selectedBoosterKey,
    boosterClaimed,
    boosterClaimId: boosterClaimed && typeof r.boosterClaimId === 'string' ? r.boosterClaimId : null,
    boosterGranted: boosterClaimed && r.boosterGranted === true,
    tutorialCompleted: r.tutorialCompleted === true || state === 'completed',
    version: INTRO_V2_VERSION,
  });
}
