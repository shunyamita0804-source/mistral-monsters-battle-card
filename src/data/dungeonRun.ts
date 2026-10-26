import { TMP_GEOL_ID } from './cards.ts';
import { ENCOUNTERS } from './dungeons.ts';
import { LAZUCK_MONSTER_ID } from './lazuck.ts';
import { SORAMO_MONSTER_ID } from './soramo.ts';
import { TEST_TEAM, TEST_TEAM_ALT } from './testTeams.ts';
import type { OpponentDefinition } from './tournaments.ts';

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

/** ランダム生成のダンジョンにするダンジョン（いまは最初のダンジョン「太古の遺跡」だけ。精霊の森はそれまでの固定のマップのまま） */
export const RUN_DUNGEON_IDS: readonly string[] = ['dungeon-01'];

export function isRunDungeon(dungeonId: string): boolean {
  return RUN_DUNGEON_IDS.includes(dungeonId);
}

/** 階ごとの相手の強さ（ライフの割合。それまでの固定のダンジョン B1〜B3 と同じくらい） */
const FLOOR_LIFE_SCALE: readonly number[] = [0.6, 0.75, 0.85];

/** 【仮】通常のバトラー（話しかけると対戦）。編成は仮のテスト用（ソラモ・ラズック） */
export function runNpcOpponent(floor: number, index: number): OpponentDefinition {
  const base = ENCOUNTERS['enc-run-npc'] as OpponentDefinition;
  return { ...base, monsters: index % 2 === 0 ? TEST_TEAM : TEST_TEAM_ALT, lifeScale: FLOOR_LIFE_SCALE[floor] ?? 0.85 };
}

/** 【仮】見えない番人。編成は仮 */
export function runGuardianOpponent(floor: number): OpponentDefinition {
  const base = ENCOUNTERS['enc-run-guardian'] as OpponentDefinition;
  return { ...base, monsters: [LAZUCK_MONSTER_ID, LAZUCK_MONSTER_ID, SORAMO_MONSTER_ID], lifeScale: FLOOR_LIFE_SCALE[floor] ?? 0.85 };
}

/** ボス：遺跡の主（仮のジオル。src/data/dungeons.ts の enc-b3-boss） */
export function runBossOpponent(): OpponentDefinition {
  return ENCOUNTERS['enc-b3-boss'] ?? { id: 'enc-b3-boss', name: '遺跡の主（仮）', monsters: [SORAMO_MONSTER_ID, TMP_GEOL_ID, LAZUCK_MONSTER_ID], lifeScale: 0.85 };
}
