import { BOOSTER_SHOP_PRICE, BOOSTERS, EXAM_LOAN_BOOSTER, isBoosterKey, isStarterDeckKey, type BoosterKey, type StarterDeckKey } from '../../data/introV2.ts';
import { t } from '../../i18n/i18n.ts';
import { countCards, createStarterDeckFor, isDeckValid, type Deck } from '../deck/deck.ts';
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
  /** 箱の中身を所持カードに入れたか（2026-10-28 に中身が決まるまでは受け取りの記録だけだった。その記録だけのセーブには1回だけ配る） */
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

/* ---------- ブースターの箱（2026-10-28 ユーザー決定：箱＝初期配布。モンスター3＋山札60＝そのまま1つのデッキ） ---------- */

/** 箱の中身のデッキ（モンスター3体＋技48枚＋仮サポート12枚） */
export function boosterDeck(key: BoosterKey): Deck {
  const def = BOOSTERS.find((b) => b.key === key) ?? (BOOSTERS[0] as (typeof BOOSTERS)[number]);
  return createStarterDeckFor(def.category);
}

/** 箱の中身（カード ID → 枚数） */
export function boosterCardCounts(key: BoosterKey): Record<string, number> {
  const deck = boosterDeck(key);
  return countCards([...deck.monsters, ...deck.skills]);
}

/** 試験で先生が貸すデッキ（「旅立ちのきらめき」と同じ。所持カードには入れない） */
export function examLoanDeck(): Deck {
  return boosterDeck(EXAM_LOAN_BOOSTER);
}

/** 箱の中身を所持カードに足す（同じカードが重なってもそのまま持つ） */
function addBoosterCards(save: SaveData, key: BoosterKey): SaveData {
  return addCards(save, Object.entries(boosterCardCounts(key)).map(([cardId, count]) => ({ cardId, count })));
}

/** カウンターで買った箱の記録（storyFlags。各箱1回まで） */
const boughtFlag = (key: BoosterKey): string => `booster-bought:${key}`;

/** 持っている箱（管理局で受け取った箱・カウンターで買った箱） */
export function ownedBoosters(save: SaveData): BoosterKey[] {
  const v = save.story.introV2;
  return BOOSTERS.map((b) => b.key).filter((k) => (v.boosterClaimed && v.selectedBoosterKey === k) || save.storyFlags.includes(boughtFlag(k)));
}

/** カウンターの棚に並べる箱：管理局で受け取った箱は出さない。買った箱は「購入済み」 */
export function boosterShelf(save: SaveData): { readonly key: BoosterKey; readonly bought: boolean }[] {
  const v = save.story.introV2;
  return BOOSTERS.filter((b) => !(v.boosterClaimed && v.selectedBoosterKey === b.key)).map((b) => ({ key: b.key, bought: save.storyFlags.includes(boughtFlag(b.key)) }));
}

export type BoosterPurchaseResult =
  | { readonly status: 'ok'; readonly save: SaveData }
  | { readonly status: 'duplicate'; readonly save: SaveData }
  | { readonly status: 'error'; readonly save: SaveData; readonly message: string };

/**
 * カウンターで箱を買う（1箱 1,500G・各箱1回まで）。tx は値段の確認を開いたときに作る ID（連打で二重に払わない）。
 * 中身は所持カードに足すだけ（使うデッキは変えない）
 */
export function buyBooster(save: SaveData, key: BoosterKey, tx: string): BoosterPurchaseResult {
  if (hasProcessed(save, tx)) return { status: 'duplicate', save };
  if (!isBoosterKey(key)) return { status: 'error', save, message: t('gacha.error.noPack') };
  if (ownedBoosters(save).includes(key)) return { status: 'error', save, message: t('introV2.shop.owned') };
  if (save.coins < BOOSTER_SHOP_PRICE) return { status: 'error', save, message: t('gacha.error.coins') };
  let next = addBoosterCards({ ...save, coins: save.coins - BOOSTER_SHOP_PRICE }, key);
  next = markProcessed({ ...next, storyFlags: [...next.storyFlags, boughtFlag(key)] }, tx);
  return { status: 'ok', save: next };
}

/**
 * 管理局で箱を受け取る（1回だけ）。tx は画面を開いたときに作る ID。
 * 箱の中身を所持カードに入れ、その3体＋60枚をそのまま使うデッキにする
 */
export function claimBooster(save: SaveData, key: BoosterKey, tx: string): SaveData {
  const v = save.story.introV2;
  if (v.boosterClaimed || hasProcessed(save, tx) || !isBoosterKey(key) || !v.examPassed) return save;
  const claimed = markProcessed(setV2(save, { state: 'packClaimed', selectedBoosterKey: key, boosterClaimed: true, boosterClaimId: tx, boosterGranted: true }), tx);
  return { ...addBoosterCards(claimed, key), deck: boosterDeck(key) };
}

/**
 * 中身が決まる前（2026-10-27〜28）に箱を選んだセーブ：中身を1回だけ配る（読み込むたびに呼んでよい）。
 * 前から持っているカード・デッキは減らさない。使えるデッキが無いときだけ、箱のデッキを使うデッキにする
 */
export function grantPendingBooster(save: SaveData): SaveData {
  const v = save.story.introV2;
  if (!v.boosterClaimed || v.boosterGranted || !v.selectedBoosterKey) return save;
  const next = setV2(addBoosterCards(save, v.selectedBoosterKey), { boosterGranted: true });
  return isDeckValid(next.deck, next.collection) ? next : { ...next, deck: boosterDeck(v.selectedBoosterKey) };
}

/**
 * 【仮】チュートリアルスキップ：イベントを終えて自由に歩けるようにする（試験の合格・管理局での受け取りはしない）。
 * 2026-10-28 から新しく始めたときはカードを持たないので、モンスターを1枚も持っていなければ「旅立ちのきらめき」の中身を配ってデッキにする
 * （遊べなくならないように。Claude の判断。カウンターの棚ではこの箱を「購入済み」にする）
 */
export function skipIntroV2(save: SaveData): SaveData {
  const v = save.story.introV2;
  if (!(isIntroV2Active(v) || v.state === 'notStarted')) return save;
  let next = setV2(save, { state: 'skipped' });
  if (next.deck.monsters.length === 0 && !Object.keys(next.collection).some((id) => id.startsWith('mon-'))) {
    next = { ...addBoosterCards(next, EXAM_LOAN_BOOSTER), deck: boosterDeck(EXAM_LOAN_BOOSTER) };
    next = { ...next, storyFlags: [...next.storyFlags, boughtFlag(EXAM_LOAN_BOOSTER)] };
  }
  return next;
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
