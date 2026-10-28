import { TMP_GEOL_ID } from './cards.ts';
import { ENCOUNTERS } from './dungeons.ts';
import type { RankId } from './economy.ts';
import { GAUUL_MONSTER_ID as GAU } from './gauul.ts';
import { KALSHELL_MONSTER_ID as KAL } from './kalshell.ts';
import { LAZUCK_MONSTER_ID } from './lazuck.ts';
import { MYUROL_MONSTER_ID as MYU } from './myurol.ts';
import { NOBITON_MONSTER_ID as NOB } from './nobiton.ts';
import { SORAMO_MONSTER_ID } from './soramo.ts';
import { TEST_TEAM, TEST_TEAM_ALT } from './testTeams.ts';
import type { OpponentDefinition } from './tournaments.ts';

const LAZ = LAZUCK_MONSTER_ID;
const SOR = SORAMO_MONSTER_ID;

/**
 * 【仮】ランダム生成・手探り探索のダンジョン（2026-10-26 ユーザー指示「ミスモンBC ダンジョン試作（たたき台）」。
 * モンスターファームバトルカード GB 版のダンジョンを参考に）。数値はすべて仮で、ここ1か所にまとめる。
 * ロジックは src/game/dungeon/（generate.ts・run.ts）、画面は src/ui/screens/dungeonRunScreen.ts
 */
export const DUNGEON_RUN = {
  /** 階の数（最後の階にボス。下りたら上り階段はない） */
  floors: 3,
  /** 部屋の格子（横×縦） */
  grid: 5,
  /** 格子の1区画のマス数（部屋はこの中に作る。区画の境目は壁） */
  cell: 7,
  /** 部屋の大きさ（最小・最大。区画の内側に収まる大きさ） */
  roomMin: 3,
  roomMax: 5,
  /** 区画が部屋になる割合（残りは通路の曲がり角だけ） */
  roomRate: 0.75,
  /** 部屋どうしの道を、迷路の木の形のほかに足す本数（回り道） */
  extraLinks: 3,
  /** 見える範囲（自分のマスからのマス数。1＝自分と隣のマス〔斜めを含む〕） */
  viewRadius: 1,
  /** 1つの階に置くもの */
  npcsPerFloor: 3,
  chestsPerFloor: 2,
  guardiansPerFloor: 2,
  /** 見えない番人：この距離（上下左右のマス数の合計）まで近づくと予兆、この距離以内で1歩ごとに抽選 */
  guardianOmenRange: 3,
  guardianEncounterRange: 2,
  /** 見えない番人の抽選の確率（1歩ごと） */
  guardianRate: 0.3,
  /** 番人と戦ったあと、番人が出てこない歩数（連続で出ないように） */
  guardianCooldownSteps: 20,
  /** 1回の挑戦で負けられる回数（この回数負けると街の入り口へ戻され、その挑戦で手に入れた技カードを失う） */
  maxLosses: 3,
  /** 十字キーを押しっぱなしにしたときの、2歩目までの待ちと、その後の1歩の間隔（ミリ秒） */
  holdDelayMs: 260,
  stepRepeatMs: 170,
} as const;

/**
 * ダンジョンごとの仕掛け（2026-10-27 指示書「ダンジョン7つ」。ダンジョンごとに1つだけ）
 * - water：水路（通れない水のマス。遠回りが要る）
 * - ice：すべる床（乗ると、壁・氷でないマス・人や物にぶつかるまで進み続ける）
 * - lava：溶岩の明かりで見える範囲が広いが、見えない番人が出やすい
 * - switch：階段（最後の階はボスの間）の手前に閉じた扉。同じ階のスイッチを調べると開く
 * - holy：見えない番人が強く、負けられる回数が少ない
 */
export type DungeonGimmick = 'none' | 'water' | 'ice' | 'lava' | 'switch' | 'holy';

/** 【仮】ダンジョンごとの値（階・開放・強さ・相手）。名前・説明は src/data/dungeons.ts */
export interface RunDungeonConfig {
  readonly floors: number;
  readonly gimmick: DungeonGimmick;
  /** このランクに上がったら開放（null＝最初から） */
  readonly unlockRank: RankId | null;
  /** 階ごとの相手の強さ（ライフの割合。数＝階の数） */
  readonly floorLife: readonly number[];
  /** 見える範囲（たいまつを使うと +1） */
  readonly viewRadius: number;
  /** 見えない番人の抽選の確率（1歩ごと） */
  readonly guardianRate: number;
  /** 負けられる回数 */
  readonly maxLosses: number;
  /** 見えない番人の強さ（階の強さに足す） */
  readonly guardianLifeBonus: number;
  /** バトラーの編成（バトラーの番号で順に使う） */
  readonly npcTeams: readonly (readonly string[])[];
  readonly guardianTeam: readonly string[];
  /** ボス（src/data/dungeons.ts の ENCOUNTERS の ID。真ん中のモンスターがボスのモンスター＝初回クリアの景品） */
  readonly bossId: string;
}

/** 2026-10-27 指示書：ふつうのダンジョンは最大5階。強さは 遺跡・森 ＜ 水 ＜ 氷 ＜ 火 ＜ 機械 ＜ 聖域（すべて仮） */
export const RUN_DUNGEONS: Readonly<Record<string, RunDungeonConfig>> = {
  // 太古の遺跡（最初から）：いまのまま
  'dungeon-01': {
    floors: 3, gimmick: 'none', unlockRank: null, floorLife: [0.6, 0.75, 0.85], viewRadius: 1, guardianRate: 0.3, maxLosses: 3,
    guardianLifeBonus: 0, npcTeams: [TEST_TEAM, TEST_TEAM_ALT], guardianTeam: [LAZ, LAZ, SOR], bossId: 'enc-b3-boss',
  },
  // 精霊の森（最初から）：固定のマップをやめて、遺跡と同じランダム生成（2026-10-27）
  'dungeon-02': {
    floors: 3, gimmick: 'none', unlockRank: null, floorLife: [0.6, 0.75, 0.85], viewRadius: 1, guardianRate: 0.3, maxLosses: 3,
    guardianLifeBonus: 0, npcTeams: [TEST_TEAM, TEST_TEAM_ALT], guardianTeam: [LAZ, LAZ, SOR], bossId: 'enc-forest-boss',
  },
  // 水の神殿（D ランク）：水路
  'dungeon-03': {
    floors: 4, gimmick: 'water', unlockRank: 'D', floorLife: [0.8, 0.9, 1, 1.1], viewRadius: 1, guardianRate: 0.3, maxLosses: 3,
    guardianLifeBonus: 0, npcTeams: [[MYU, KAL, SOR], [KAL, MYU, NOB]], guardianTeam: [KAL, MYU, KAL], bossId: 'enc-water-boss',
  },
  // 氷の洞窟（C ランク）：すべる床
  'dungeon-04': {
    floors: 4, gimmick: 'ice', unlockRank: 'C', floorLife: [0.9, 1, 1.1, 1.2], viewRadius: 1, guardianRate: 0.3, maxLosses: 3,
    guardianLifeBonus: 0, npcTeams: [[KAL, NOB, MYU], [NOB, KAL, SOR]], guardianTeam: [KAL, NOB, KAL], bossId: 'enc-ice-boss',
  },
  // 炎の火山（B ランク）：見える範囲が1マス広い（2マス）・見えない番人が出やすい（1.5倍）
  'dungeon-05': {
    floors: 5, gimmick: 'lava', unlockRank: 'B', floorLife: [1, 1.1, 1.2, 1.3, 1.4], viewRadius: 2, guardianRate: 0.45, maxLosses: 3,
    guardianLifeBonus: 0, npcTeams: [[GAU, LAZ, NOB], [LAZ, GAU, SOR]], guardianTeam: [GAU, GAU, LAZ], bossId: 'enc-fire-boss',
  },
  // 機械の塔（A ランク）：スイッチで開く扉
  'dungeon-06': {
    floors: 5, gimmick: 'switch', unlockRank: 'A', floorLife: [1.1, 1.2, 1.3, 1.4, 1.5], viewRadius: 1, guardianRate: 0.3, maxLosses: 3,
    guardianLifeBonus: 0, npcTeams: [[NOB, LAZ, KAL], [LAZ, NOB, GAU]], guardianTeam: [LAZ, NOB, LAZ], bossId: 'enc-machine-boss',
  },
  // 天の聖域（S ランク）：見えない番人が強く、2回負けると戻される
  'dungeon-07': {
    floors: 5, gimmick: 'holy', unlockRank: 'S', floorLife: [1.2, 1.3, 1.4, 1.5, 1.6], viewRadius: 1, guardianRate: 0.3, maxLosses: 2,
    guardianLifeBonus: 0.3, npcTeams: [[SOR, GAU, KAL], [GAU, SOR, MYU]], guardianTeam: [GAU, KAL, SOR], bossId: 'enc-holy-boss',
  },
};

/** ランダム生成のダンジョン（2026-10-27 からは7つすべて） */
export const RUN_DUNGEON_IDS: readonly string[] = Object.keys(RUN_DUNGEONS);

export function isRunDungeon(dungeonId: string): boolean {
  return RUN_DUNGEON_IDS.includes(dungeonId);
}

/** ダンジョンの値（知らない ID は太古の遺跡と同じ） */
export function runConfig(dungeonId: string | undefined): RunDungeonConfig {
  return RUN_DUNGEONS[dungeonId ?? ''] ?? (RUN_DUNGEONS['dungeon-01'] as RunDungeonConfig);
}

const floorLife = (dungeonId: string | undefined, floor: number): number => {
  const c = runConfig(dungeonId);
  return c.floorLife[Math.min(floor, c.floorLife.length - 1)] ?? 0.85;
};

/** バトラーの見た目（2026-10-27 デザイン第12弾の3人：1＝探検家・2＝学者・3＝剣士）。階の中の番号で決める（地図の絵と対戦の顔をそろえる） */
export function runBattlerLook(index: number): 1 | 2 | 3 {
  return ((((index % 3) + 3) % 3) + 1) as 1 | 2 | 3;
}

/**
 * 新しいダンジョン（水〜聖域）のバトラー（2026-10-28 指示書「ダンジョンの人物12人」）：そのダンジョンの人と、
 * 今の3人（フローラ・オスカー・カイル）のうち1人（だれにするかは Claude の割り振り）。遺跡・森は今の3人のまま
 */
const LOCAL_BATTLERS: Readonly<Record<string, { readonly face: string; readonly guest: 1 | 2 | 3 }>> = {
  'dungeon-03': { face: 'battler-pia', guest: 1 },
  'dungeon-04': { face: 'battler-hans', guest: 3 },
  'dungeon-05': { face: 'battler-zack', guest: 3 },
  'dungeon-06': { face: 'battler-otto', guest: 2 },
  'dungeon-07': { face: 'battler-mina', guest: 2 },
};

/**
 * バトラーの顔のキー（地図の上の姿と対戦の顔をそろえる。src/ui/components/opponentFace.ts）。
 * 新しいダンジョンは、階の中の番号（1〜3）が奇数ならそのダンジョンの人、偶数なら今の3人のうちの1人
 */
export function runBattlerFace(index: number, dungeonId?: string): string {
  const local = LOCAL_BATTLERS[dungeonId ?? ''];
  if (!local) return `battler-${runBattlerLook(index)}`;
  return index % 2 === 1 ? local.face : `battler-${local.guest}`;
}

/** 【仮】通常のバトラー（話しかけると対戦）。編成はダンジョンごとの仮の編成。顔ぶれは runBattlerFace */
export function runNpcOpponent(floor: number, index: number, dungeonId?: string): OpponentDefinition {
  const base = ENCOUNTERS['enc-run-npc'] as OpponentDefinition;
  const teams = runConfig(dungeonId).npcTeams;
  return { ...base, monsters: teams[index % teams.length] ?? TEST_TEAM, lifeScale: floorLife(dungeonId, floor), face: runBattlerFace(index, dungeonId) };
}

/** 【仮】見えない番人。編成はダンジョンごとの仮の編成（天の聖域は強い） */
export function runGuardianOpponent(floor: number, dungeonId?: string): OpponentDefinition {
  const base = ENCOUNTERS['enc-run-guardian'] as OpponentDefinition;
  const c = runConfig(dungeonId);
  return { ...base, monsters: c.guardianTeam, lifeScale: Math.round((floorLife(dungeonId, floor) + c.guardianLifeBonus) * 100) / 100, face: 'guardian' };
}

/** ボス＝そのダンジョンの守り手（src/data/dungeons.ts の ENCOUNTERS・人物は src/data/people.ts。遺跡は仮のジオル、森は仮のフルーネ、ほかは正式モンスターの仮の編成） */
export function runBossOpponent(dungeonId?: string): OpponentDefinition {
  return ENCOUNTERS[runConfig(dungeonId).bossId] ?? { id: 'enc-b3-boss', name: 'グラント', monsters: [SORAMO_MONSTER_ID, TMP_GEOL_ID, LAZUCK_MONSTER_ID], lifeScale: 0.85 };
}
