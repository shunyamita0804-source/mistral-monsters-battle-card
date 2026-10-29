import { skillsOf } from './cards.ts';
import { FLUNE_MONSTER_ID } from './flune.ts';
import { GAUUL_MONSTER_ID as GAU } from './gauul.ts';
import { GEOL_MONSTER_ID } from './geol.ts';
import { KALSHELL_MONSTER_ID as KAL } from './kalshell.ts';
import { LAZUCK_MONSTER_ID } from './lazuck.ts';
import { MYUROL_MONSTER_ID as MYU } from './myurol.ts';
import { NOBITON_MONSTER_ID as NOB } from './nobiton.ts';
import { PUKARIM_MONSTER_ID as PUK } from './pukarim.ts';
import { SORAMO_MONSTER_ID } from './soramo.ts';
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
  { id: 'dungeon-03', name: '水の神殿', description: '水路が行く手をはばむ神殿。最奥のボスを倒すとクリア。（仮）', floors: [], firstClearCards: officialBossCards(MYU), isPlaceholder: true },
  { id: 'dungeon-04', name: '氷の洞窟', description: '足元がすべる氷の洞窟。最奥のボスを倒すとクリア。（仮）', floors: [], firstClearCards: officialBossCards(KAL), isPlaceholder: true },
  { id: 'dungeon-05', name: '炎の火山', description: '溶岩の明かりで明るいが、見えない番人が多い火山。最奥のボスを倒すとクリア。（仮）', floors: [], firstClearCards: officialBossCards(GAU), isPlaceholder: true },
  { id: 'dungeon-06', name: '機械の塔', description: 'スイッチで開く扉のある塔。最奥のボスを倒すとクリア。（仮）', floors: [], firstClearCards: officialBossCards(LAZUCK_MONSTER_ID), isPlaceholder: true },
  { id: 'dungeon-07', name: '天の聖域', description: '強い番人が守る最後の試練。2回負けると戻される。最奥のボスを倒すとクリア。（仮）', floors: [], firstClearCards: officialBossCards(SORAMO_MONSTER_ID), isPlaceholder: true },
];

export function getDungeon(id: string): DungeonDefinition | undefined {
  return DUNGEONS.find((d) => d.id === id);
}

export const ENCOUNTERS: Readonly<Record<string, OpponentDefinition>> = {
  'enc-b1-a': { id: 'enc-b1-a', name: '野生モンスターの群れ（仮）', monsters: TEST_TEAM_ALT, lifeScale: 0.6 },
  'enc-b1-b': { id: 'enc-b1-b', name: '野生モンスターの群れ（仮）', monsters: TEST_TEAM, lifeScale: 0.65 },
  'enc-b2-a': { id: 'enc-b2-a', name: '宝を守る群れ（仮）', monsters: TEST_TEAM_ALT, lifeScale: 0.75 },
  'enc-b2-b': { id: 'enc-b2-b', name: '宝を守る群れ（仮）', monsters: TEST_TEAM, lifeScale: 0.75 },
  'enc-b2-c': { id: 'enc-b2-c', name: '階段の番人（仮）', monsters: TEST_TEAM_ALT, lifeScale: 0.8 },
  'enc-b3-a': { id: 'enc-b3-a', name: '深層の群れ（仮）', monsters: TEST_TEAM, lifeScale: 0.85 },
  'enc-b3-b': { id: 'enc-b3-b', name: '深層の群れ（仮）', monsters: TEST_TEAM_ALT, lifeScale: 0.85 },
  // 遺跡のボス：ジオルを真ん中に（2026-10-29 ジオルの最終。遺跡は氷の洞窟と同じ段になったので、強さもそれに合わせる）
  'enc-b3-boss': { id: 'enc-b3-boss', name: 'グラント', monsters: [GAU, GEOL_MONSTER_ID, LAZUCK_MONSTER_ID], lifeScale: 1.2 },
  // 森のボス：フルーネを真ん中に（2026-10-29 フルーネの最終）。2026-10-29 夜 ユーザー指示：プカリム・フルーネ・ミュロル（案2）。
  // lifeScale は試遊（最初の手持ち3箱 × 200回）で勝つ割合が 45％ にいちばん近い 0.75（0.85＝35.0％・0.75＝43.2％・0.7＝55.2％。docs/flune-final-20261029.md 6章）
  'enc-forest-boss': { id: 'enc-forest-boss', name: 'セラ', monsters: [PUK, FLUNE_MONSTER_ID, MYU], lifeScale: 0.75 },
  // 2026-10-27 指示書「ダンジョン7つ」のボス（仮。真ん中のモンスターがボスのモンスター。強さは最後の階より少し上）
  'enc-water-boss': { id: 'enc-water-boss', name: 'ルシア', monsters: [KAL, MYU, SORAMO_MONSTER_ID], lifeScale: 1.2 },
  'enc-ice-boss': { id: 'enc-ice-boss', name: 'イヴァン', monsters: [MYU, KAL, NOB], lifeScale: 1.3 },
  'enc-fire-boss': { id: 'enc-fire-boss', name: 'バルカ', monsters: [LAZUCK_MONSTER_ID, GAU, NOB], lifeScale: 1.5 },
  'enc-machine-boss': { id: 'enc-machine-boss', name: 'テオ', monsters: [NOB, LAZUCK_MONSTER_ID, GAU], lifeScale: 1.6 },
  'enc-holy-boss': { id: 'enc-holy-boss', name: 'アウレリオ', monsters: [GAU, SORAMO_MONSTER_ID, KAL], lifeScale: 1.75 },
  // 【仮】ランダム生成のダンジョン（2026-10-26 試作。src/data/dungeonRun.ts）：通常のバトラー・見えない番人。編成とライフは階ごとに src/data/dungeonRun.ts で決める
  'enc-run-npc': { id: 'enc-run-npc', name: 'ダンジョンのバトラー（仮）', monsters: TEST_TEAM, lifeScale: 0.6 },
  'enc-run-guardian': { id: 'enc-run-guardian', name: '見えない番人（仮）', monsters: TEST_TEAM_ALT, lifeScale: 0.6 },
  // カード練習場の練習相手（序盤の練習試合）。スターターと同じモンスター3体を少し弱くしたもの（仮。正式な練習相手のデッキは未定）
  'enc-practice': { id: 'enc-practice', name: '練習相手（仮）', monsters: TEST_TEAM, lifeScale: 0.6 },
};
