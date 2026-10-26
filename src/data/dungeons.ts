import { skillId, TMP_FLUNE_ID, TMP_GEOL_ID } from './cards.ts';
import { LAZUCK_MONSTER_ID } from './lazuck.ts';
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
  /** 階層ごとのマップID（B1F から順） */
  readonly floors: readonly string[];
  /** 最奥のボスを初めて倒したときにもらえるカード（2026-10-26。1回だけ） */
  readonly firstClearCards?: readonly CardReward[];
  readonly isPlaceholder: boolean;
}

/** 【仮】ボスのモンスターのカードを少し：モンスターカード1枚と、技1〜3を1枚ずつ */
const bossCards = (monsterId: string, key: string): CardReward[] => [
  { cardId: monsterId, count: 1 },
  ...[1, 2, 3].map((no) => ({ cardId: skillId(key, no), count: 1 })),
];

/**
 * 2026-10-26 ユーザー指示：最初からあるダンジョンは「遺跡」と「森」の2つ。遺跡のボスはジオル、森のボスはフルーネを使い、
 * 勝つとそのモンスターのモンスターカードと技カードが少しもらえる。ジオル・フルーネの正式データはまだ無いので、仮のジオル・フルーネ（cards.ts）で、
 * 初めて倒したときに1回だけもらえる（ユーザー「今は仮で適当でいい」）。
 * 細かい設計はこれから。いまは森も遺跡（dungeon-01）の写し。
 * 2026-10-26 名前が決まった（ユーザー）：太古の遺跡（ジオルのボス。遺跡に少し草や木、壊れた遺跡の建物）・精霊の森（フルーネのボス。ピンクの花や蝶）
 */
export const DUNGEONS: readonly DungeonDefinition[] = [
  {
    id: 'dungeon-01',
    name: '太古の遺跡',
    description: '草や木に覆われ、壊れた建物が残る遺跡。最奥のボスを倒すとクリア。（敵編成・マップは仮）',
    floors: ['dungeon-01-b1', 'dungeon-01-b2', 'dungeon-01-b3'],
    firstClearCards: bossCards(TMP_GEOL_ID, 'tmp-geol'),
    isPlaceholder: true,
  },
  {
    id: 'dungeon-02',
    name: '精霊の森',
    description: 'ピンクの花が咲き、蝶が舞う森。最奥のボスを倒すとクリア。（敵編成・マップは仮。いまは遺跡と同じ作り）',
    floors: ['dungeon-02-b1', 'dungeon-02-b2', 'dungeon-02-b3'],
    firstClearCards: bossCards(TMP_FLUNE_ID, 'tmp-flune'),
    isPlaceholder: true,
  },
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
  // 遺跡のボス：仮のジオルを真ん中に（正式データが届いたら入れ替える）
  'enc-b3-boss': { id: 'enc-b3-boss', name: '遺跡の主（仮）', monsters: [SORAMO_MONSTER_ID, TMP_GEOL_ID, LAZUCK_MONSTER_ID], lifeScale: 0.85 },
  // 森のボス：仮のフルーネを真ん中に
  'enc-forest-boss': { id: 'enc-forest-boss', name: '森の主（仮）', monsters: [LAZUCK_MONSTER_ID, TMP_FLUNE_ID, SORAMO_MONSTER_ID], lifeScale: 0.85 },
  // 【仮】ランダム生成のダンジョン（2026-10-26 試作。src/data/dungeonRun.ts）：通常のバトラー・見えない番人。編成とライフは階ごとに src/data/dungeonRun.ts で決める
  'enc-run-npc': { id: 'enc-run-npc', name: 'ダンジョンのバトラー（仮）', monsters: TEST_TEAM, lifeScale: 0.6 },
  'enc-run-guardian': { id: 'enc-run-guardian', name: '見えない番人（仮）', monsters: TEST_TEAM_ALT, lifeScale: 0.6 },
  // カード練習場の練習相手（序盤の練習試合）。スターターと同じモンスター3体を少し弱くしたもの（仮。正式な練習相手のデッキは未定）
  'enc-practice': { id: 'enc-practice', name: '練習相手（仮）', monsters: TEST_TEAM, lifeScale: 0.6 },
};
