import { skillsOf } from './cards.ts';
import { FLUNE_MONSTER_ID } from './flune.ts';
import { GAUUL_MONSTER_ID as GAU } from './gauul.ts';
import { GEOL_MONSTER_ID } from './geol.ts';
import { KALSHELL_MONSTER_ID as KAL } from './kalshell.ts';
import { LAZUCK_MONSTER_ID } from './lazuck.ts';
import { MYUROL_MONSTER_ID as MYU } from './myurol.ts';
import { NOBITON_MONSTER_ID as NOB } from './nobiton.ts';
import { PUKARIM_MONSTER_ID as PUK } from './pukarim.ts';
import { SEREPHINE_MONSTER_ID } from './serephine.ts';
import { SORAMO_MONSTER_ID } from './soramo.ts';
import { TSUMUJI_MONSTER_ID } from './tsumuji.ts';
import { HYOUZUKU_MONSTER_ID } from './hyouzuku.ts';
import { TEST_TEAM, TEST_TEAM_ALT } from './testTeams.ts';
import type { CardReward, OpponentDefinition } from './tournaments.ts';

/**
 * 【仮データ】ダンジョンと敵の編成。
 * 第1ダンジョンは地下3階（B1F：探索導入と通常戦、B2F：分岐と宝箱、B3F：最奥にボス）。
 * 敵・ボスの正式な編成は未確定のため、ここの値はすべて仮。
 * 2026-10-23：技の発動を見るため、敵はソラモとラズックの仮の編成（src/data/testTeams.ts。ユーザー指示）。練習の相手は主人公と同じ編成
 */
export interface DungeonDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** 階層ごとのマップID（B1F から順。固定のマップのダンジョンだけ。2026-10-27 からはどれもランダム生成なので、遺跡・森の昔のマップが残っているだけ） */
  readonly floors: readonly string[];
  /** 最奥のボスを初めて倒したときにもらえるカード（2026-10-26。1回だけ） */
  readonly firstClearCards?: readonly CardReward[];
  /**
   * ボスに勝ったときの技カードを、切り札のモンスター（firstClearCards のモンスター）の技からだけ選び、初めてのクリアでは技カードを出さない
   * （2026-10-29 ジオルの最終：太古の遺跡。初回はジオルのモンスターカード、2回目からはジオルの技カード1枚。プカリムのピートと同じ形）。
   * 無いダンジョンはいままでどおり（相手の3体の技からランダムに1枚＋初回の firstClearCards）
   */
  readonly trumpReward?: boolean;
  /** ボスに初めて勝ったときに立てる物語の記録（セーブの storyFlags。ガチャのシリーズの開放に使う。太古の遺跡＝GRANT_BEATEN_FLAG） */
  readonly bossFlag?: string;
  /**
   * 祭壇のモンスターカードをまだ受け取っていない記録（セーブの storyFlags。2026-10-29 セレフィーンの最終：水の神殿）。
   * 切り札のモンスターを替える前にクリアしていたセーブに付ける（saveData.ts の v26）。この記録があれば、次にボスに勝ったとき
   * 初めてのクリアと同じく祭壇で firstClearCards を受け取り（技カードは出さない）、記録を消す
   */
  readonly altarOwedFlag?: string;
  readonly isPlaceholder: boolean;
}

/** 【仮】正式モンスターのボス：モンスターカード1枚と、そのモンスターの最初の技3種を1枚ずつ（遺跡・森と同じ量） */
const officialBossCards = (monsterId: string): CardReward[] => [
  { cardId: monsterId, count: 1 },
  ...skillsOf(monsterId).slice(0, 3).map((k) => ({ cardId: k.id, count: 1 })),
];

/**
 * 2026-10-26 ユーザー指示：最初からあるダンジョンは「遺跡」と「森」の2つ。遺跡のボスはジオル、森のボスはフルーネを使い、
 * 勝つとそのモンスターのモンスターカードと技カードが少しもらえる。ジオル・フルーネの正式データはまだ無いので、仮のジオル・フルーネ（cards.ts）で、
 * 初めて倒したときに1回だけもらえる（ユーザー「今は仮で適当でいい」）。
 * 細かい設計はこれから。いまは森も遺跡（dungeon-01）の写し。
 * 2026-10-26 名前が決まった（ユーザー）：太古の遺跡（ジオルのボス。遺跡に少し草や木、壊れた遺跡の建物）・精霊の森（フルーネのボス。ピンクの花や蝶）
 * 2026-10-29 ジオルの最終：最初からあるダンジョンは精霊の森だけ。太古の遺跡は C ランクで開く（階・強さ・開放は src/data/dungeonRun.ts）
 */
/** 太古の遺跡のグラントに初めて勝った（2026-10-29 夜：ジオルのガチャのシリーズが並ぶ。プカリムの pete-beaten と同じ形） */
export const GRANT_BEATEN_FLAG = 'grant-beaten';
/** 精霊の森のセラに初めて勝った（2026-10-29 フルーネの最終：フルーネのガチャのシリーズが並ぶ。GRANT_BEATEN_FLAG と同じ形） */
export const SERA_BEATEN_FLAG = 'sera-beaten';
/** 水の神殿のルシアに初めて勝った（2026-10-29 セレフィーンの最終：セレフィーンのガチャのシリーズが並ぶ。SERA_BEATEN_FLAG と同じ形） */
export const LUCIA_BEATEN_FLAG = 'lucia-beaten';
/** 水の神殿の祭壇のセレフィーンをまだ受け取っていない（前に水の神殿をクリアしていたセーブ。DungeonDefinition の altarOwedFlag） */
export const LUCIA_ALTAR_OWED_FLAG = 'lucia-altar-owed';
/** 風の渓谷のゼフィラに初めて勝った（2026-10-30 指示書 U：ツムジのガチャのシリーズが並ぶ。SERA_BEATEN_FLAG と同じ形） */
export const ZEPHYRA_BEATEN_FLAG = 'zephyra-beaten';
/** 氷の洞窟のイヴァンに初めて勝った（2026-10-30 指示書 W：ヒョウズクのガチャのシリーズが並ぶ。ZEPHYRA_BEATEN_FLAG と同じ形） */
export const IVAN_BEATEN_FLAG = 'ivan-beaten';
/** 氷の洞窟の祭壇のヒョウズクをまだ受け取っていない（前に氷の洞窟をクリアしていたセーブ。LUCIA_ALTAR_OWED_FLAG と同じ形） */
export const IVAN_ALTAR_OWED_FLAG = 'ivan-altar-owed';

export const DUNGEONS: readonly DungeonDefinition[] = [
  {
    id: 'dungeon-01',
    name: '太古の遺跡',
    description: '草や木に覆われ、壊れた建物が残る遺跡。最奥のボスを倒すとクリア。（敵編成・マップは仮）',
    floors: ['dungeon-01-b1', 'dungeon-01-b2', 'dungeon-01-b3'],
    // 2026-10-29 ジオルの最終：初回クリアは最奥の祭壇でジオルのモンスターカード1枚（仮ジオルはもう使わない）
    firstClearCards: [{ cardId: GEOL_MONSTER_ID, count: 1 }],
    trumpReward: true,
    bossFlag: GRANT_BEATEN_FLAG,
    isPlaceholder: true,
  },
  {
    id: 'dungeon-02',
    name: '精霊の森',
    description: 'ピンクの花が咲き、蝶が舞う森。最奥のボスを倒すとクリア。（敵編成は仮）',
    floors: ['dungeon-02-b1', 'dungeon-02-b2', 'dungeon-02-b3'],
    // 2026-10-29 フルーネの最終：初回クリアは最奥の祭壇でフルーネのモンスターカード1枚。2回目からはフルーネの技カード1枚（遺跡のジオルと同じ形）
    firstClearCards: [{ cardId: FLUNE_MONSTER_ID, count: 1 }],
    trumpReward: true,
    bossFlag: SERA_BEATEN_FLAG,
    isPlaceholder: true,
  },
  // 2026-10-27 指示書「ダンジョン7つ」：ランクで開放する5つ。名前・ボス・編成はすべて仮（仕掛け・階・開放は src/data/dungeonRun.ts の RUN_DUNGEONS）
  {
    id: 'dungeon-03',
    name: '水の神殿',
    description: '水路が行く手をはばむ神殿。最奥のボスを倒すとクリア。（仮）',
    floors: [],
    // 2026-10-29 セレフィーンの最終：初回クリアは最奥の祭壇でセレフィーンのモンスターカード1枚（前はミュロル）。2回目からはセレフィーンの技カード1枚（森のフルーネと同じ形）
    firstClearCards: [{ cardId: SEREPHINE_MONSTER_ID, count: 1 }],
    trumpReward: true,
    bossFlag: LUCIA_BEATEN_FLAG,
    altarOwedFlag: LUCIA_ALTAR_OWED_FLAG,
    isPlaceholder: true,
  },
  // 2026-10-30 指示書 U：D ランクの2つ目のダンジョン（水の神殿と同じ段）。仕掛けは強い風のマス。ボスは守り手ゼフィラ・切り札はツムジ。ダンジョンを選ぶ所では水の神殿の次
  {
    id: 'dungeon-08',
    name: '風の渓谷',
    description: '崖とつり橋の渓谷。強い風が吹き、乗ると押し流される。最奥のボスを倒すとクリア。（仮）',
    floors: [],
    // 初回クリアは最奥の祭壇でツムジのモンスターカード1枚。2回目からはツムジの技カード1枚（水の神殿のセレフィーンと同じ形）
    firstClearCards: [{ cardId: TSUMUJI_MONSTER_ID, count: 1 }],
    trumpReward: true,
    bossFlag: ZEPHYRA_BEATEN_FLAG,
    isPlaceholder: true,
  },
  {
    id: 'dungeon-04',
    name: '氷の洞窟',
    description: '足元がすべる氷の洞窟。最奥のボスを倒すとクリア。（仮）',
    floors: [],
    // 2026-10-30 指示書 W：初回クリアは最奥の祭壇でヒョウズクのモンスターカード1枚（前はカルシェルと技3枚）。2回目からはヒョウズクの技カード1枚・宝箱もヒョウズクの技（風の渓谷と同じ形）
    firstClearCards: [{ cardId: HYOUZUKU_MONSTER_ID, count: 1 }],
    trumpReward: true,
    bossFlag: IVAN_BEATEN_FLAG,
    altarOwedFlag: IVAN_ALTAR_OWED_FLAG,
    isPlaceholder: true,
  },
  { id: 'dungeon-05', name: '炎の火山', description: '溶岩の明かりで明るいが、見えない番人が多い火山。最奥のボスを倒すとクリア。（仮）', floors: [], firstClearCards: officialBossCards(GAU), isPlaceholder: true },
  { id: 'dungeon-06', name: '機械の塔', description: 'スイッチで開く扉のある塔。最奥のボスを倒すとクリア。（仮）', floors: [], firstClearCards: officialBossCards(LAZUCK_MONSTER_ID), isPlaceholder: true },
  { id: 'dungeon-07', name: '天の聖域', description: '強い番人が守る最後の試練。2回負けると戻される。最奥のボスを倒すとクリア。（仮）', floors: [], firstClearCards: officialBossCards(SORAMO_MONSTER_ID), isPlaceholder: true },
];

export function getDungeon(id: string): DungeonDefinition | undefined {
  return DUNGEONS.find((d) => d.id === id);
}

export const ENCOUNTERS: Readonly<Record<string, OpponentDefinition>> = {
  // 2026-10-30 指示書 V：ボス8人の lifeScale は、切り札の技を2枚ずつにしたあと、直す前の勝つ割合から ±3 ポイントに入るように合わせ直した
  // （最初の手持ち3箱 × 1000回で決め、200回でも確かめた。npm run playtest:bosses・docs/deck-gacha-boss-v-20261030.md）。
  // イヴァン・バルカは、ライフを上げても勝つ割合がそれ以上下がらない（ボスの山札切れで負ける）ため ±3 に入らず、いちばん近い値にした
  // 2026-10-30 指示書 Y：サポートカードを入れ替え、最初の箱が変わったので、8人とも V の「直す前の勝つ割合」±3 に合わせ直した（3箱 × 1000回。docs/support-y-20261030.md）。
  // ゼフィラだけは、ライフの段差（1.21＝30.1％・1.22＝25.4％・1.25＝14.6％）で ±3 に入らず、いちばん近い 1.22 にした
  'enc-b1-a': { id: 'enc-b1-a', name: '野生モンスターの群れ（仮）', monsters: TEST_TEAM_ALT, lifeScale: 0.6 },
  'enc-b1-b': { id: 'enc-b1-b', name: '野生モンスターの群れ（仮）', monsters: TEST_TEAM, lifeScale: 0.65 },
  'enc-b2-a': { id: 'enc-b2-a', name: '宝を守る群れ（仮）', monsters: TEST_TEAM_ALT, lifeScale: 0.75 },
  'enc-b2-b': { id: 'enc-b2-b', name: '宝を守る群れ（仮）', monsters: TEST_TEAM, lifeScale: 0.75 },
  'enc-b2-c': { id: 'enc-b2-c', name: '階段の番人（仮）', monsters: TEST_TEAM_ALT, lifeScale: 0.8 },
  'enc-b3-a': { id: 'enc-b3-a', name: '深層の群れ（仮）', monsters: TEST_TEAM, lifeScale: 0.85 },
  'enc-b3-b': { id: 'enc-b3-b', name: '深層の群れ（仮）', monsters: TEST_TEAM_ALT, lifeScale: 0.85 },
  // 遺跡のボス：ジオルを真ん中に（2026-10-29 ジオルの最終。遺跡は氷の洞窟と同じ段になったので、強さもそれに合わせる）
  'enc-b3-boss': { id: 'enc-b3-boss', name: 'グラント', monsters: [GAU, GEOL_MONSTER_ID, LAZUCK_MONSTER_ID], ace: GEOL_MONSTER_ID, lifeScale: 1.05 },
  // 森のボス：フルーネを真ん中に（2026-10-29 フルーネの最終）。2026-10-29 夜 ユーザー指示：プカリム・フルーネ・ミュロル（案2）。
  // lifeScale は試遊（最初の手持ち3箱 × 200回）で勝つ割合が 45％ にいちばん近い 0.75（0.85＝35.0％・0.75＝43.2％・0.7＝55.2％。docs/flune-final-20261029.md 6章）。2026-10-30 指示書 V で 0.7 に
  'enc-forest-boss': { id: 'enc-forest-boss', name: 'セラ', monsters: [PUK, FLUNE_MONSTER_ID, MYU], ace: FLUNE_MONSTER_ID, lifeScale: 0.75 },
  // 2026-10-27 指示書「ダンジョン7つ」のボス（仮。真ん中のモンスターがボスのモンスター。強さは最後の階より少し上）
  // 2026-10-30 指示書 V：どのボスも切り札（ace）＝祭壇でもらえるモンスター（真ん中）。デッキに切り札の技14種を2枚ずつ（deck.ts の buildAceDeck）。
  // 後ろの4人（イヴァン・バルカ・テオ・アウレリオ）の切り札は仮（あとで新しいモンスターに替える）
  // 水の神殿のボス：セレフィーンを真ん中に（2026-10-29 セレフィーンの最終。ソラモを外した〔ユーザー決定〕。lifeScale は今の 1.2 のまま。指示書 V のあとも 1.2）
  'enc-water-boss': { id: 'enc-water-boss', name: 'ルシア', monsters: [KAL, SEREPHINE_MONSTER_ID, MYU], ace: SEREPHINE_MONSTER_ID, lifeScale: 1.22 },
  // 氷の洞窟のボス（2026-10-30 指示書 W）：切り札をカルシェルからヒョウズクに（真ん中）。ノビトンは外した（まきつく＋凍らせるで同じモンスターを止め続ける組み合わせになるため）。
  // lifeScale は V で直す前の勝つ割合 21.2％ から ±3 を目ざしたが、1.1 より上はライフを上げても 33〜36％ から下がらない（プレイヤーはほぼボスの山札切れでしか勝たない）。
  // 測った中でいちばん近い 1.3（1000回で 32.7％）にした。±3 には入っていない（docs/hyouzuku-w-20261030.md・npm run playtest:bosses）。指示書 Y で 1.2（20.1％）に
  'enc-ice-boss': { id: 'enc-ice-boss', name: 'イヴァン', monsters: [MYU, HYOUZUKU_MONSTER_ID, KAL], ace: HYOUZUKU_MONSTER_ID, lifeScale: 1.2 },
  'enc-fire-boss': { id: 'enc-fire-boss', name: 'バルカ', monsters: [LAZUCK_MONSTER_ID, GAU, NOB], ace: GAU, lifeScale: 1.45 },
  'enc-machine-boss': { id: 'enc-machine-boss', name: 'テオ', monsters: [NOB, LAZUCK_MONSTER_ID, GAU], ace: LAZUCK_MONSTER_ID, lifeScale: 1.25 },
  'enc-holy-boss': { id: 'enc-holy-boss', name: 'アウレリオ', monsters: [GAU, SORAMO_MONSTER_ID, KAL], ace: SORAMO_MONSTER_ID, lifeScale: 1.22 },
  // 風の渓谷のボス（2026-10-30 指示書 U）：ツムジを真ん中に、左右はソラモ・ガウル。lifeScale はルシアと同じ 1.2 から試遊（最初の手持ち3箱 × 200回）。
  // 1.2 では勝つ割合 11.5％（ルシア 20.3％）と勝ちにくかったので、ルシアといちばん近い 1.0（21.0％）にした（docs/wind-valley-u-20261030.md・npm run playtest:zephyra）。2026-10-30 指示書 V で 1.1 に
  'enc-wind-boss': { id: 'enc-wind-boss', name: 'ゼフィラ', monsters: [SORAMO_MONSTER_ID, TSUMUJI_MONSTER_ID, GAU], ace: TSUMUJI_MONSTER_ID, lifeScale: 1.22 },
  // 【仮】ランダム生成のダンジョン（2026-10-26 試作。src/data/dungeonRun.ts）：通常のバトラー・見えない番人。編成とライフは階ごとに src/data/dungeonRun.ts で決める
  'enc-run-npc': { id: 'enc-run-npc', name: 'ダンジョンのバトラー（仮）', monsters: TEST_TEAM, lifeScale: 0.6 },
  'enc-run-guardian': { id: 'enc-run-guardian', name: '見えない番人（仮）', monsters: TEST_TEAM_ALT, lifeScale: 0.6 },
  // カード練習場の練習相手（序盤の練習試合）。スターターと同じモンスター3体を少し弱くしたもの（仮。正式な練習相手のデッキは未定）
  // 2026-10-30 指示書 V：仮の編成の3体目がプカリムになって弱くなったので（最初の手持ち3箱 × 200回で勝つ割合 64.0％ → 91.7％）、0.6 → 0.65（71.3％。±3 に入る値はなく、いちばん近い値）
  'enc-practice': { id: 'enc-practice', name: '練習相手（仮）', monsters: TEST_TEAM, lifeScale: 0.65 },
};
