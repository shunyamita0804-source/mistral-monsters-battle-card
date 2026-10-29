import type { IntroV2State } from '../game/story/introV2.ts';
import type { MessageKey } from '../i18n/messages/index.ts';
import { RESIDENT_IDS, type ResidentId } from './maps.ts';

/**
 * 【仮】序盤イベントの場面（会話の順番・選択肢・場面の終わりにすること）。
 * 台詞の文は src/i18n/messages/story.ts（台本 V1・仮）。ここは順番とつながりだけ。
 *
 * 進み具合（IntroState）の意味
 * - notSeen：まだ会っていない（新しく始めたとき）。家から街に出ると「声かけ」が始まる
 * - invited：声かけの途中（アプリを閉じた等）。もう自動では始めず、話しかければ誘い直す
 * - deferred：「あとで」を選んだ。旧セーブもこれ（導入を突然始めない）
 * - skipped：声かけをスキップした
 * - onRoute：練習場へ向かう途中（街に目的地を出す。案内役は練習場で待つ）
 * - atPractice：練習場に着いた
 * - practiceStarted：最初の練習試合の最中（アプリを閉じたら atPractice に戻す）
 * - completed：最初の練習試合を終えた（勝ち負けは問わない）
 */
export type IntroState =
  | 'notSeen'
  | 'invited'
  | 'deferred'
  | 'skipped'
  | 'onRoute'
  | 'atPractice'
  | 'practiceStarted'
  | 'completed';

export const INTRO_STATES: readonly IntroState[] = [
  'notSeen',
  'invited',
  'deferred',
  'skipped',
  'onRoute',
  'atPractice',
  'practiceStarted',
  'completed',
];

/** 会話の表情（表情の絵の参照名。絵が届くまでは仮の表示） */
export type Expression = 'normal' | 'smile' | 'explain' | 'surprised' | 'troubled' | 'happy';

/** 話している人。system は地の文（名前の札なし）。住人は会話の絵が無いので名前の札だけ */
export type Speaker = 'neighbor_guide' | ResidentId | 'teacher' | 'clerk' | 'receptionist' | 'researcher' | 'bureau_clerk' | 'system';

/** 住人の会話の場面（話しかけるたびに 1・2 を交互に） */
export type ResidentSceneId = `${ResidentId}_${1 | 2}`;

export type SceneId =
  | 'invite'
  | 'inviteA'
  | 'inviteB'
  | 'invite2'
  | 'reinvite'
  | 'accept'
  | 'defer'
  | 'arrive'
  | 'practiceAsk'
  | 'explain'
  | 'afterWin'
  | 'afterLose'
  | 'replay'
  | 'practiceGo'
  | 'afterReplay'
  | 'tableOffer'
  | 'afterTable'
  | 'greetClerk'
  | 'greetReceptionist'
  | 'greetResearcher'
  // 導入イベントV2「プロのカードバトラーになる試験」（台詞は src/i18n/messages/introV2.ts）
  | 'v2Greeting'
  | 'v2Walk'
  | 'v2School'
  | 'v2Resume'
  | 'v2Retry'
  | 'v2Pass'
  | 'v2Reception'
  | 'v2Thanks'
  | 'v2Briefing'
  | 'v2BureauAfter'
  // ピートとの勝負（2026-10-29 プカリムの最終。src/game/story/pete.ts）
  | 'peteAsk'
  | 'peteAgain'
  | 'peteGo'
  | 'peteFirstWin'
  | 'peteWinAgain'
  | 'peteLose'
  | ResidentSceneId;

/** 場面の終わり（またはスキップ）にすること */
export type SceneEffect =
  | { readonly kind: 'intro'; readonly value: IntroState }
  /** 導入イベントV2の進み具合（src/game/story/introV2.ts の setIntroV2State。勝つ前に試験より先へは進まない） */
  | { readonly kind: 'introV2'; readonly value: IntroV2State }
  /** 練習試合を始める。tutorial＝最初の練習（バトル画面にヒントを出す） */
  | { readonly kind: 'practice'; readonly tutorial: boolean }
  /** 住人との勝負を始める（2026-10-29：ピート） */
  | { readonly kind: 'battle'; readonly id: 'pete' };

export type SceneStep =
  | { readonly kind: 'line'; readonly text: MessageKey; readonly speaker: Speaker; readonly expression?: Expression }
  | {
      readonly kind: 'choice';
      readonly options: readonly { readonly label: MessageKey; readonly next: SceneId | null }[];
    };

export interface Scene {
  readonly id: SceneId;
  /** 場面の始めにすること（途中でアプリを閉じても進み具合が分かるように） */
  readonly onStart?: readonly SceneEffect[];
  readonly steps: readonly SceneStep[];
  /** 選択肢がない場面の続き */
  readonly then?: SceneId;
  /** 最後まで見たときにすること */
  readonly effects?: readonly SceneEffect[];
  /** スキップしたときにすること（指定がなければ effects と同じ） */
  readonly skipEffects?: readonly SceneEffect[];
  /** 会話のスキップのボタンを出さない（導入イベントV2：断る・飛ばすはない。文字を一気に出すのはタップでできる） */
  readonly noSkip?: boolean;
}

const guide = (text: MessageKey, expression: Expression): SceneStep => ({ kind: 'line', text, speaker: 'neighbor_guide', expression });
const system = (text: MessageKey): SceneStep => ({ kind: 'line', text, speaker: 'system' });
const intro = (value: IntroState): SceneEffect => ({ kind: 'intro', value });
const SKIP_INVITE = [intro('skipped')];
const v2 = (value: IntroV2State): SceneEffect => ({ kind: 'introV2', value });
const teacher = (text: MessageKey): SceneStep => ({ kind: 'line', text, speaker: 'teacher' });
const bureau = (text: MessageKey): SceneStep => ({ kind: 'line', text, speaker: 'bureau_clerk' });
const pete = (text: MessageKey): SceneStep => ({ kind: 'line', text, speaker: 'resident_b' });

export const SCENES: Readonly<Record<SceneId, Scene>> = {
  // E01 家から街に出た直後（1回だけ）
  invite: {
    id: 'invite',
    onStart: [intro('invited')],
    steps: [
      guide('story.T001', 'smile'),
      guide('story.T002', 'normal'),
      { kind: 'choice', options: [{ label: 'story.T003.a', next: 'inviteA' }, { label: 'story.T003.b', next: 'inviteB' }] },
    ],
    skipEffects: SKIP_INVITE,
  },
  inviteA: { id: 'inviteA', steps: [guide('story.T004A', 'smile')], then: 'invite2', skipEffects: SKIP_INVITE },
  inviteB: { id: 'inviteB', steps: [guide('story.T004B', 'smile')], then: 'invite2', skipEffects: SKIP_INVITE },
  // E02 世界と遊びへの誘い
  invite2: {
    id: 'invite2',
    steps: [
      guide('story.T005', 'explain'),
      guide('story.T006', 'normal'),
      guide('story.T007', 'smile'),
      { kind: 'choice', options: [{ label: 'story.T008.a', next: 'accept' }, { label: 'story.T008.b', next: 'defer' }] },
    ],
    skipEffects: SKIP_INVITE,
  },
  // 「あとで」・スキップのあと、街で話しかけたとき（誘い直し）
  reinvite: {
    id: 'reinvite',
    steps: [
      guide('story.T007', 'smile'),
      { kind: 'choice', options: [{ label: 'story.T008.a', next: 'accept' }, { label: 'story.T008.b', next: 'defer' }] },
    ],
    skipEffects: [],
  },
  // E03 承諾 → E04 練習場への案内（ここから自分で歩く）
  accept: {
    id: 'accept',
    steps: [guide('story.T009A', 'happy'), guide('story.T010', 'explain'), guide('story.T011', 'normal')],
    effects: [intro('onRoute')],
  },
  defer: { id: 'defer', steps: [guide('story.T009B', 'normal')], effects: [intro('deferred')] },
  // E05 練習場に着いた
  arrive: {
    id: 'arrive',
    onStart: [intro('atPractice')],
    steps: [
      guide('story.T012', 'smile'),
      guide('story.T013', 'explain'),
      { kind: 'choice', options: [{ label: 'story.T014.a', next: 'explain' }, { label: 'story.T014.b', next: null }] },
    ],
    skipEffects: [],
  },
  // 「今はやめる」のあと、練習場で話しかけたとき
  practiceAsk: {
    id: 'practiceAsk',
    steps: [
      guide('story.T013', 'explain'),
      { kind: 'choice', options: [{ label: 'story.T014.a', next: 'explain' }, { label: 'story.T014.b', next: null }] },
    ],
    skipEffects: [],
  },
  // E06 対戦の前の短い説明 → 最初の練習試合（ヒントつき）
  explain: {
    id: 'explain',
    steps: [guide('story.T015', 'explain'), guide('story.T016', 'explain'), guide('story.T017', 'normal')],
    effects: [{ kind: 'practice', tutorial: true }],
  },
  // E07 最初の練習試合のあと（勝ち負けは問わず終わる）
  afterWin: {
    id: 'afterWin',
    steps: [guide('story.T018W', 'happy'), guide('story.T019', 'explain'), guide('story.T020', 'smile'), guide('story.T021', 'normal')],
    effects: [intro('completed')],
  },
  afterLose: {
    id: 'afterLose',
    steps: [guide('story.T018L', 'smile'), guide('story.T019', 'explain'), guide('story.T020', 'smile'), guide('story.T021', 'normal')],
    effects: [intro('completed')],
  },
  // 後日の再開（練習場で話しかけたとき）
  replay: {
    id: 'replay',
    steps: [
      guide('story.T022', 'normal'),
      { kind: 'choice', options: [{ label: 'story.T023.a', next: 'practiceGo' }, { label: 'story.T023.b', next: null }] },
    ],
    skipEffects: [],
  },
  practiceGo: { id: 'practiceGo', steps: [], effects: [{ kind: 'practice', tutorial: false }] },
  afterReplay: { id: 'afterReplay', steps: [guide('story.T024', 'smile')] },
  // 案内役がいないときの練習テーブル
  tableOffer: {
    id: 'tableOffer',
    steps: [
      // 練習場の先生が勧める（2026-10-23 顔の絵が届いたので先生の台詞に。台詞は仮）
      { kind: 'line', text: 'story.teacher.offer', speaker: 'teacher' },
      { kind: 'choice', options: [{ label: 'story.sys.tableYes', next: 'practiceGo' }, { label: 'story.sys.tableNo', next: null }] },
    ],
    skipEffects: [],
  },
  afterTable: { id: 'afterTable', steps: [system('story.sys.practiceDone')] },
  // 【仮】店員・受付・研究員に話しかけたときのひと言（2026-10-23。台詞は仮）。終わったらその画面を開く
  greetClerk: { id: 'greetClerk', steps: [{ kind: 'line', text: 'story.greet.clerk', speaker: 'clerk' }], skipEffects: [] },
  greetReceptionist: { id: 'greetReceptionist', steps: [{ kind: 'line', text: 'story.greet.receptionist', speaker: 'receptionist' }], skipEffects: [] },
  greetResearcher: { id: 'greetResearcher', steps: [{ kind: 'line', text: 'story.greet.researcher', speaker: 'researcher' }], skipEffects: [] },
  // ---------- 導入イベントV2（2026-10-27 正式依頼。台本は 03_全台詞 のまま） ----------
  // S01 家の外：幼馴染が声をかける → 教習所へ一緒に歩く
  v2Greeting: {
    id: 'v2Greeting',
    onStart: [v2('introGreeting')],
    steps: [guide('introV2.s01.1', 'surprised'), guide('introV2.s01.2', 'troubled'), guide('introV2.s01.3', 'smile'), system('introV2.s01.sys')],
    effects: [v2('escortToSchool')],
    noSkip: true,
  },
  // S02 町の徒歩イベント（歩いている途中で1回）
  v2Walk: { id: 'v2Walk', steps: [guide('introV2.s02.1', 'explain'), guide('introV2.s02.2', 'smile')], noSkip: true },
  // S03 教習所に到着 → 試験の対戦（画面側で始める）
  v2School: {
    id: 'v2School',
    onStart: [v2('schoolArrival')],
    steps: [teacher('introV2.s03.1'), teacher('introV2.s03.2'), guide('introV2.s03.3', 'happy'), teacher('introV2.s03.4')],
    noSkip: true,
  },
  // 試験の対戦の途中でアプリを閉じたあと（先生の前から再開）
  v2Resume: { id: 'v2Resume', steps: [teacher('introV2.s03.4')], noSkip: true },
  // S05b 負け・再開
  v2Retry: { id: 'v2Retry', steps: [teacher('introV2.s05b.1'), system('introV2.s05b.sys')], noSkip: true },
  // S05 勝利 → 管理局へ一緒に歩く
  v2Pass: {
    id: 'v2Pass',
    steps: [teacher('introV2.s05.1'), teacher('introV2.s05.2'), guide('introV2.s05.3', 'happy')],
    effects: [v2('escortToBureau')],
    noSkip: true,
  },
  // S06 管理局の受付 → パックを選ぶ（画面側で窓を出す）
  v2Reception: {
    id: 'v2Reception',
    onStart: [v2('bureauReception')],
    steps: [bureau('introV2.s06.1'), bureau('introV2.s06.2'), bureau('introV2.s06.3'), system('introV2.s06.sys')],
    effects: [v2('packSelection')],
    noSkip: true,
  },
  v2Thanks: { id: 'v2Thanks', steps: [bureau('introV2.s06.thanks')], noSkip: true },
  // S07 外に出て、幼馴染が案内 → 自由行動
  v2Briefing: {
    id: 'v2Briefing',
    onStart: [v2('worldBriefing')],
    steps: [
      guide('introV2.s07.1', 'happy'),
      guide('introV2.s07.2', 'explain'),
      guide('introV2.s07.3', 'explain'),
      guide('introV2.s07.4', 'normal'),
      guide('introV2.s07.5', 'smile'),
      system('introV2.s07.sys'),
    ],
    effects: [v2('completed')],
    noSkip: true,
  },
  // 【仮】導入イベントのあとに受付を調べたとき（地の文）
  v2BureauAfter: { id: 'v2BureauAfter', steps: [system('introV2.bureau.after')], skipEffects: [] },
  // ---------- ピートとの勝負（2026-10-29 プカリムの最終。台詞は 2026-10-29 夜 ユーザー決定。src/i18n/messages/story.ts の story.pete.*） ----------
  peteAsk: {
    id: 'peteAsk',
    steps: [pete('story.pete.ask'), { kind: 'choice', options: [{ label: 'story.pete.yes', next: 'peteGo' }, { label: 'story.pete.no', next: null }] }],
    skipEffects: [],
  },
  peteAgain: {
    id: 'peteAgain',
    steps: [pete('story.pete.again'), { kind: 'choice', options: [{ label: 'story.pete.yes', next: 'peteGo' }, { label: 'story.pete.no', next: null }] }],
    skipEffects: [],
  },
  // 2026-10-29 夜 ユーザーの台詞（指示書 C5）：勝負の前のひと言のあとに勝負
  peteGo: { id: 'peteGo', steps: [pete('story.pete.before')], effects: [{ kind: 'battle', id: 'pete' }] },
  // 「ショップにプカリムが並んでいる」の台詞はなくした（2026-10-29 夜。ガチャのシリーズを選ぶ画面の NEW の印で知らせる）
  peteFirstWin: { id: 'peteFirstWin', steps: [pete('story.pete.firstWin')], skipEffects: [] },
  peteWinAgain: { id: 'peteWinAgain', steps: [pete('story.pete.winAgain')], skipEffects: [] },
  peteLose: { id: 'peteLose', steps: [pete('story.pete.lose')], skipEffects: [] },
  ...residentScenes(),
};

/** 【仮】住人の会話（2行ずつ。台詞は src/i18n/messages/story.ts の story.residentA〜E） */
function residentScenes(): Record<ResidentSceneId, Scene> {
  const out = {} as Record<ResidentSceneId, Scene>;
  for (const r of RESIDENT_IDS) {
    for (const n of [1, 2] as const) {
      const id: ResidentSceneId = `${r}_${n}`;
      // メッセージのキーは story.residentA.1a のように（キーに _ は使わない）
      const key = `resident${r.slice(-1).toUpperCase()}`;
      const line = (part: 'a' | 'b'): SceneStep => ({ kind: 'line', text: `story.${key}.${n}${part}` as MessageKey, speaker: r });
      out[id] = { id, steps: [line('a'), line('b')], skipEffects: [] };
    }
  }
  return out;
}

/** 住人に話しかけたときの場面。count は話しかけた回数（0 から） */
export function residentScene(resident: ResidentId, count: number): ResidentSceneId {
  return `${resident}_${count % 2 === 0 ? 1 : 2}`;
}
