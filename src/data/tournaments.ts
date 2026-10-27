import { TEST_TEAM, TEST_TEAM_ALT } from './testTeams.ts';
import { monsterId, skillId } from './cards.ts';
import { GAUUL_MONSTER_ID as GAU } from './gauul.ts';
import { KALSHELL_MONSTER_ID as KAL } from './kalshell.ts';
import { LAZUCK_MONSTER_ID as LAZ } from './lazuck.ts';
import { MYUROL_MONSTER_ID as MYU } from './myurol.ts';
import { NOBITON_MONSTER_ID as NOB } from './nobiton.ts';
import { SORAMO_MONSTER_ID as SOR } from './soramo.ts';
import type { RankId } from './economy.ts';
import type { ItemId } from './items.ts';

/**
 * 【仮データ】大会。
 * 参加人数・対戦数・対戦相手・景品は正式仕様が未確定のため、すべて仮の設定。
 * 大会の進行ロジック（src/game/progress/tournament.ts）はこのデータだけを見て動く。
 *
 * 2026-10-27 指示書「大会の新しい形」：
 * - E・D：4人の総当たり（league）。rounds の3人と1試合ずつ。同じ回のほかの2人の試合は自動で結果を出す
 * - C〜S：8人のトーナメント（bracket）。常連は毎回出る。一般の出場者は組の中からランダム
 * - 常連のデッキの組み方（deckStyle）と考え方（ai）、強さ（lifeScale）、勝率（winRate）はすべて仮
 */

/** デッキの組み方（src/game/deck/deck.ts の buildOpponentDeck） */
export type DeckStyle = 'balanced' | 'power' | 'disrupt' | 'guard' | 'flashy' | 'strong';
/** 相手の考え方の癖（src/game/battle/ai.ts の chooseAction） */
export type AiStyle = 'normal' | 'aggressive' | 'disrupt' | 'guard' | 'flashy' | 'hunter';

export interface OpponentDefinition {
  readonly id: string;
  readonly name: string;
  readonly monsters: readonly string[];
  /** ライフ倍率（強さの調整用・仮） */
  readonly lifeScale: number;
  /** 顔の絵（src/ui/components/opponentFace.ts のキー）。無ければ id で探す（同じ相手の定義で見た目だけ変えるとき：ダンジョンのバトラー） */
  readonly face?: string;
  /** デッキの組み方（無ければ balanced：適合技を順番に） */
  readonly deckStyle?: DeckStyle;
  /** 考え方の癖（無ければ normal） */
  readonly ai?: AiStyle;
  /** 通算の勝率（%。札を押したときに出す。仮の固定値。常連だけ） */
  readonly winRate?: number;
}

export interface CardReward {
  readonly cardId: string;
  readonly count: number;
}

/** 8人のトーナメントの出場者 */
export interface BracketSetup {
  /** 常連（毎回出る） */
  readonly regulars: readonly OpponentDefinition[];
  /** 一般の出場者の組（ここから generalCount 人をランダム） */
  readonly pool: readonly OpponentDefinition[];
  readonly generalCount: number;
  /** 主人公と反対の山に置き、決勝まで必ず勝ち上がる人（C：シエナ、S：アルヴィン） */
  readonly finalist: string | null;
}

export type TournamentFormat = 'league' | 'bracket';

export interface TournamentDefinition {
  readonly id: string;
  readonly name: string;
  /** league＝4人の総当たり（E・D）、bracket＝8人のトーナメント（C〜S） */
  readonly format: TournamentFormat;
  /** 参加に必要なランク */
  readonly requiredRank: RankId;
  readonly description: string;
  /** 表示用の参加人数（仮） */
  readonly participants: number;
  /** 総当たりの相手3人（1回目から順に主人公と戦う）。トーナメントは空（出場者は bracket） */
  readonly rounds: readonly OpponentDefinition[];
  readonly bracket?: BracketSetup;
  /**
   * 「シエナがいなくなった」の記録があるあいだの代わり（2026-10-27 ユーザー指示）。replace の相手の代わりに with が出る。
   * 記録を消せば元に戻る（霧の廃坑で助けたら戻る予定）
   */
  readonly siennaLeft?: { readonly replace: string; readonly with: OpponentDefinition };
  readonly rewards: {
    /** 参加報酬（優勝・敗退に関係なく、1回の参加につき1回） */
    readonly participationCoins: number;
    /** 初回優勝の景品（1度だけ） */
    readonly firstWin: {
      readonly coins: number;
      readonly unlockPacks: readonly string[];
      readonly rankUp: RankId | null;
      readonly cards: readonly CardReward[];
      /**
       * ショップに並ぶようになる道具（仮。src/data/items.ts）。内部の設定だけで、大会の画面・報酬の画面には出さない
       * （2026-10-27 ユーザー指示書「ダンジョンの道具」）
       */
      readonly unlockItems: readonly ItemId[];
    };
    /** 2回目以降の優勝の景品 */
    readonly repeatWin: { readonly coins: number };
  };
  readonly isPlaceholder: boolean;
}

/* ---------- C〜S：8人のトーナメント（2026-10-27 指示書。値はすべて仮） ---------- */

type BracketRank = 'C' | 'B' | 'A' | 'S';
type RegularId = 'sienna' | 'dolf' | 'leonard' | 'greta' | 'julius' | 'camilla' | 'alvin';

/** ランクごとの強さ（ライフ倍率の目安。C＜B＜A＜S。仮） */
const RANK_SCALE: Readonly<Record<BracketRank, number>> = { C: 1.15, B: 1.25, A: 1.35, S: 1.5 };

/**
 * 常連（人物は src/data/people.ts。相手の ID は reg-〈人物の ID〉）。
 * モンスター・デッキ・考え方は性格に合わせた仮の構成。強さ（scale）はランクの倍率に掛ける。勝率は仮の固定値
 */
const REGULARS: Readonly<Record<RegularId, { name: string; monsters: readonly string[]; deckStyle: DeckStyle; ai: AiStyle; scale: number; winRate: number }>> = {
  // 偏りのない、まっすぐな構成・ふつう
  sienna: { name: 'シエナ', monsters: [SOR, MYU, GAU], deckStyle: 'balanced', ai: 'normal', scale: 1, winRate: 64 },
  // 必要マナの多い強い攻撃ばかり・守りはほぼ入れない・いつも攻撃
  dolf: { name: 'ドルフ', monsters: [GAU, LAZ, NOB], deckStyle: 'power', ai: 'aggressive', scale: 1, winRate: 58 },
  // ちょうはつ・すなかけなど妨害が中心・妨害を先に
  leonard: { name: 'レナード', monsters: [LAZ, SOR, GAU], deckStyle: 'disrupt', ai: 'disrupt', scale: 1.15, winRate: 66 },
  // 防御・回避が多い・守りを優先して相手の山札切れを待つ
  greta: { name: 'グレタ', monsters: [KAL, MYU, NOB], deckStyle: 'guard', ai: 'guard', scale: 0.85, winRate: 72 },
  // 華やかな大技・大技を優先
  julius: { name: 'ユリウス', monsters: [GAU, SOR, KAL], deckStyle: 'flashy', ai: 'flashy', scale: 1.05, winRate: 80 },
  // 強くてバランスのよい構成・相手の弱いモンスターを先に狙う
  camilla: { name: 'カミラ', monsters: [KAL, GAU, MYU], deckStyle: 'strong', ai: 'hunter', scale: 1.1, winRate: 91 },
  // いちばん強い構成・カミラと同じ考え方で強さはいちばん上
  alvin: { name: 'アルヴィン', monsters: [SOR, GAU, KAL], deckStyle: 'strong', ai: 'hunter', scale: 1.2, winRate: 100 },
};

/** 一般の出場者（名刺図鑑には載せない。名前と顔だけ。顔は src/ui/components/opponentFace.ts の gen-〈名前〉） */
const GENERAL: Readonly<Record<'cb' | 'as', readonly { id: string; name: string; monsters: readonly string[] }[]>> = {
  cb: [
    { id: 'gen-tobias', name: 'トビアス', monsters: [SOR, LAZ, NOB] },
    { id: 'gen-marie', name: 'マリー', monsters: [MYU, SOR, GAU] },
    { id: 'gen-jean', name: 'ジャン', monsters: [LAZ, NOB, KAL] },
    { id: 'gen-helena', name: 'ヘレナ', monsters: [MYU, KAL, SOR] },
  ],
  as: [
    { id: 'gen-claude', name: 'クロード', monsters: [GAU, KAL, LAZ] },
    { id: 'gen-beatrice', name: 'ベアトリス', monsters: [MYU, SOR, KAL] },
    { id: 'gen-zara', name: 'ザラ', monsters: [LAZ, GAU, NOB] },
    { id: 'gen-walter', name: 'ウォルター', monsters: [NOB, KAL, MYU] },
  ],
};

/** 一般の出場者の強さ（ランクの倍率に掛ける。ふつうの構成。仮） */
const GENERAL_SCALE = 0.95;

function bracketTournament(
  rank: BracketRank,
  firstCoins: number,
  participation: number,
  rankUp: RankId | null,
  regulars: readonly RegularId[],
  group: 'cb' | 'as',
  generalCount: number,
  finalist: RegularId | null,
): TournamentDefinition {
  const scale = RANK_SCALE[rank];
  const round2 = (v: number): number => Math.round(v * 100) / 100;
  return {
    id: `tournament-${rank.toLowerCase()}`,
    name: `${rank}ランク大会`,
    format: 'bracket',
    requiredRank: rank,
    description: `${rank}ランクの公式大会（内容は仮）。8人のトーナメントで3連勝なら優勝。`,
    participants: 8,
    rounds: [],
    bracket: {
      regulars: regulars.map((id) => {
        const r = REGULARS[id];
        return { id: `reg-${id}`, name: r.name, monsters: r.monsters, lifeScale: round2(scale * r.scale), deckStyle: r.deckStyle, ai: r.ai, winRate: r.winRate };
      }),
      pool: GENERAL[group].map((g) => ({ ...g, lifeScale: round2(scale * GENERAL_SCALE) })),
      generalCount,
      finalist: finalist ? `reg-${finalist}` : null,
    },
    // C でシエナがいないあいだは、D ランクの相手のゴードン（かつての大会の常連）が C の一般の出場者の強さで出る（2026-10-27 ユーザー指示）
    ...(rank === 'C' ? { siennaLeft: { replace: 'reg-sienna', with: { id: 'c-gordon', name: 'ゴードン', monsters: TEST_TEAM, lifeScale: round2(scale * GENERAL_SCALE) } } } : {}),
    rewards: {
      participationCoins: participation,
      // パックの解放・カードの景品は C 以上では付けない（決まっていないため）
      firstWin: { coins: firstCoins, unlockPacks: [], rankUp, cards: [], unlockItems: [] },
      // 2回目以降の優勝は初回の半分
      repeatWin: { coins: firstCoins / 2 },
    },
    isPlaceholder: true,
  };
}

export const TOURNAMENTS: readonly TournamentDefinition[] = [
  {
    id: 'tournament-e',
    name: 'Eランク大会',
    format: 'league',
    requiredRank: 'E',
    description: 'はじめての公式大会（内容は仮）。4人の総当たりで1位なら優勝。',
    participants: 4,
    // 相手の名前は人物（src/data/people.ts。2026-10-27 決定）。編成・強さは仮のまま
    rounds: [
      { id: 'e-1', name: 'ノエル', monsters: TEST_TEAM_ALT, lifeScale: 0.6 },
      { id: 'e-2', name: 'ヴィクトル', monsters: TEST_TEAM, lifeScale: 0.65 },
      { id: 'e-3', name: 'シエナ', monsters: TEST_TEAM_ALT, lifeScale: 0.7 },
    ],
    // シエナがいないあいだは、一般の出場者のマリーが E の強さで出る
    siennaLeft: { replace: 'e-3', with: { id: 'e-marie', name: 'マリー', monsters: [MYU, SOR, GAU], lifeScale: 0.7, face: 'gen-marie' } },
    rewards: {
      participationCoins: 20,
      firstWin: {
        coins: 300,
        unlockPacks: ['pack-02'],
        rankUp: 'D',
        cards: [{ cardId: monsterId('e'), count: 1 }, { cardId: skillId('e', 1), count: 2 }],
        unlockItems: ['ruinsMap', 'luckyCoin'],
      },
      repeatWin: { coins: 150 },
    },
    isPlaceholder: true,
  },
  {
    id: 'tournament-d',
    name: 'Dランク大会',
    format: 'league',
    requiredRank: 'D',
    description: 'Eランク優勝者向けの大会（内容は仮）。4人の総当たりで1位なら優勝。',
    participants: 4,
    rounds: [
      { id: 'd-1', name: 'ダリオ', monsters: TEST_TEAM, lifeScale: 1 },
      { id: 'd-2', name: 'イザベラ', monsters: TEST_TEAM_ALT, lifeScale: 1.05 },
      { id: 'd-3', name: 'ゴードン', monsters: TEST_TEAM, lifeScale: 1.1 },
    ],
    rewards: {
      participationCoins: 30,
      firstWin: { coins: 400, unlockPacks: ['pack-03'], rankUp: 'C', cards: [], unlockItems: ['sealBox', 'guardianCharm'] },
      repeatWin: { coins: 200 },
    },
    isPlaceholder: true,
  },
  bracketTournament('C', 500, 40, 'B', ['sienna', 'dolf', 'leonard'], 'cb', 4, 'sienna'),
  bracketTournament('B', 600, 50, 'A', ['dolf', 'leonard', 'greta', 'julius'], 'cb', 3, null),
  bracketTournament('A', 800, 60, 'S', ['leonard', 'greta', 'julius', 'camilla'], 'as', 3, null),
  bracketTournament('S', 1000, 80, null, ['julius', 'camilla', 'alvin'], 'as', 4, 'alvin'),
];

/** 大会に出てくる相手すべて（総当たりの3人・トーナメントの常連と一般の組） */
export function tournamentOpponents(t: TournamentDefinition): readonly OpponentDefinition[] {
  return [...t.rounds, ...(t.bracket ? [...t.bracket.regulars, ...t.bracket.pool] : []), ...(t.siennaLeft ? [t.siennaLeft.with] : [])];
}

export function getTournament(id: string): TournamentDefinition | undefined {
  return TOURNAMENTS.find((t) => t.id === id);
}
