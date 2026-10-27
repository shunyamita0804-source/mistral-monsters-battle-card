import { TEST_TEAM, TEST_TEAM_ALT } from './testTeams.ts';
import { monsterId, skillId } from './cards.ts';
import type { RankId } from './economy.ts';

/**
 * 【仮データ】大会。
 * 参加人数・対戦数・対戦相手・景品は正式仕様が未確定のため、すべて仮の設定。
 * 大会の進行ロジック（src/game/progress/tournament.ts）はこのデータだけを見て動く。
 */
export interface OpponentDefinition {
  readonly id: string;
  readonly name: string;
  readonly monsters: readonly string[];
  /** ライフ倍率（強さの調整用・仮） */
  readonly lifeScale: number;
  /** 顔の絵（src/ui/components/opponentFace.ts のキー）。無ければ id で探す（同じ相手の定義で見た目だけ変えるとき：ダンジョンのバトラー） */
  readonly face?: string;
}

export interface CardReward {
  readonly cardId: string;
  readonly count: number;
}

export interface TournamentDefinition {
  readonly id: string;
  readonly name: string;
  /** 参加に必要なランク */
  readonly requiredRank: RankId;
  readonly description: string;
  /** 表示用の参加人数（仮） */
  readonly participants: number;
  /** 対戦相手（1回戦から順に。数＝対戦数） */
  readonly rounds: readonly OpponentDefinition[];
  readonly rewards: {
    /** 参加報酬（優勝・敗退に関係なく、1回の参加につき1回） */
    readonly participationCoins: number;
    /** 初回優勝の景品（1度だけ） */
    readonly firstWin: {
      readonly coins: number;
      readonly unlockPacks: readonly string[];
      readonly rankUp: RankId | null;
      readonly cards: readonly CardReward[];
    };
    /** 2回目以降の優勝の景品 */
    readonly repeatWin: { readonly coins: number };
  };
  readonly isPlaceholder: boolean;
}

export const TOURNAMENTS: readonly TournamentDefinition[] = [
  {
    id: 'tournament-e',
    name: 'Eランク大会',
    requiredRank: 'E',
    description: 'はじめての公式大会（内容は仮）。3連勝で優勝。',
    participants: 8,
    rounds: [
      { id: 'e-1', name: '仮の対戦相手（E-1回戦）', monsters: TEST_TEAM_ALT, lifeScale: 0.6 },
      { id: 'e-2', name: '仮の対戦相手（E-準決勝）', monsters: TEST_TEAM, lifeScale: 0.65 },
      { id: 'e-3', name: '仮の対戦相手（E-決勝）', monsters: TEST_TEAM_ALT, lifeScale: 0.7 },
    ],
    rewards: {
      participationCoins: 20,
      firstWin: {
        coins: 300,
        unlockPacks: ['pack-02'],
        rankUp: 'D',
        cards: [{ cardId: monsterId('e'), count: 1 }, { cardId: skillId('e', 1), count: 2 }],
      },
      repeatWin: { coins: 150 },
    },
    isPlaceholder: true,
  },
  {
    id: 'tournament-d',
    name: 'Dランク大会',
    requiredRank: 'D',
    description: 'Eランク優勝者向けの大会（内容は仮）。',
    participants: 8,
    rounds: [
      { id: 'd-1', name: '仮の対戦相手（D-1回戦）', monsters: TEST_TEAM, lifeScale: 1 },
      { id: 'd-2', name: '仮の対戦相手（D-準決勝）', monsters: TEST_TEAM_ALT, lifeScale: 1.05 },
      { id: 'd-3', name: '仮の対戦相手（D-決勝）', monsters: TEST_TEAM, lifeScale: 1.1 },
    ],
    rewards: {
      participationCoins: 30,
      firstWin: { coins: 400, unlockPacks: ['pack-03'], rankUp: 'C', cards: [] },
      repeatWin: { coins: 200 },
    },
    isPlaceholder: true,
  },
];

export function getTournament(id: string): TournamentDefinition | undefined {
  return TOURNAMENTS.find((t) => t.id === id);
}
