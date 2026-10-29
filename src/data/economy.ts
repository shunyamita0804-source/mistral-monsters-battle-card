import { HIDDEN_MONSTER_ID, monsterId, skillId, supportId } from './cards.ts';
import type { ItemId } from './items.ts';

/**
 * 【仮データ】通貨・パック・提供割合。
 * 価格・確率・収録カードはすべて未承認の仮の値。正式な値が決まったらこのファイルだけを差し替える。
 */
export const CURRENCY = {
  name: 'ゴールド',
  unit: 'G',
  /** 新しく始めたときの所持金（仮） */
  initial: 300,
} as const;

export type RankId = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export const RANK_ORDER: readonly RankId[] = ['E', 'D', 'C', 'B', 'A', 'S'];

export function rankAtLeast(rank: RankId, required: RankId): boolean {
  return RANK_ORDER.indexOf(rank) >= RANK_ORDER.indexOf(required);
}

export interface PackDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly cardsPerPack: number;
  /** 未解放時に表示する解放条件 */
  readonly unlockHint: string;
  /** 最初から解放済みか */
  readonly unlockedFromStart: boolean;
  /** 収録カードID（レアリティはカード側の値） */
  readonly cardIds: readonly string[];
  /** レアリティごとの排出割合（％、合計100） */
  readonly rarityRates: Readonly<Record<'C' | 'U' | 'R', number>>;
  readonly isPlaceholder: boolean;
}

const skillsFor = (keys: readonly string[]): string[] =>
  keys.flatMap((k) => [1, 2, 3, 4, 5, 6].map((n) => skillId(k, n)));

const RATES = { C: 70, U: 25, R: 5 } as const;

export const PACKS: readonly PackDefinition[] = [
  {
    id: 'pack-01',
    name: '第1弾パック（仮）',
    description: '仮モンスターA〜Dとその技、仮サポートを収録。',
    price: 100,
    cardsPerPack: 5,
    unlockHint: '最初から購入できます',
    unlockedFromStart: true,
    cardIds: [...['a', 'b', 'c', 'd'].map(monsterId), ...skillsFor(['a', 'b', 'c', 'd']), ...[1, 2, 4, 5].map(supportId)],
    rarityRates: RATES,
    isPlaceholder: true,
  },
  {
    id: 'pack-02',
    name: '第2弾パック（仮）',
    description: '仮モンスターE〜Gとその技、仮サポートを収録。',
    price: 120,
    cardsPerPack: 5,
    unlockHint: 'Eランク大会で初優勝すると解放',
    unlockedFromStart: false,
    cardIds: [...['e', 'f', 'g'].map(monsterId), ...skillsFor(['e', 'f', 'g']), ...[3, 6].map(supportId)],
    rarityRates: RATES,
    isPlaceholder: true,
  },
  {
    id: 'pack-03',
    name: '第3弾パック（仮）',
    description: '仮モンスターH・Iとその技、隠しモンスターの技を収録。',
    price: 150,
    cardsPerPack: 5,
    unlockHint: 'Dランク大会で初優勝すると解放',
    unlockedFromStart: false,
    // 隠しモンスター本体は収録しない（欠片の特別復元でのみ入手）。技カードだけ収録する
    cardIds: [
      ...['h', 'i'].map(monsterId),
      ...skillsFor(['h', 'i']),
      skillId('hidden', 1),
      skillId('hidden', 2),
      skillId('hidden', 3),
    ],
    rarityRates: RATES,
    isPlaceholder: true,
  },
];

export function getPack(id: string): PackDefinition | undefined {
  return PACKS.find((p) => p.id === id);
}

/** 通常ガチャで排出してはいけないカード */
export const NEVER_IN_PACKS: readonly string[] = [HIDDEN_MONSTER_ID];

/**
 * 【仮】カードショップのガチャ（2026-10-28 作り直し。指示書 design-parts/gacha-20261028/00_instructions_for_claude_code.txt）。
 * 数字はここだけで変える。1シリーズ＝1モンスター（正式の技14種＋モンスターカード＝15枠）。
 * - 値段はどれも同じ・すべて最初から選べる・中身は無限・天井なし（すべて仮）
 * - カードにレアリティの表示は出さない。中の確率だけ「ノーマル枠」と「レア枠」に分ける
 * - 同じカードの4枚目からもそのまま持つ（お金にかえない）
 */
export const GACHA = {
  /** 1回の値段（G） */
  price: 150,
  /** 1パックの枚数 */
  cardsPerPack: 5,
  /** モンスターカードが入る確率（1パックあたり。当たったら5枚のうち1枚がモンスターカードに替わる） */
  monsterRate: 0.05,
  /** 技1種あたりの出やすさ（重み）。レアはノーマルの4分の1 */
  weight: { normal: 4, rare: 1 },
} as const;

export interface GachaSeries {
  /** シリーズの ID（パックの絵 pack_{id}.webp の名前にも使う） */
  readonly id: string;
  /** そのシリーズのモンスター（技はこのモンスターの技カード14種） */
  readonly monsterId: string;
  /** レア枠の技（ユーザー決定。技の名前で指定し、ID は今のデータから引く） */
  readonly rareSkillNames: readonly string[];
  /**
   * この記録（セーブの storyFlags）があるときだけ並ぶ（無ければ最初から並ぶ）。プカリム＝ピートに勝ったあと（src/game/story/pete.ts の PETE_BEATEN_FLAG）、
   * ジオル＝太古の遺跡のグラントに初めて勝ったあと（src/data/dungeons.ts の GRANT_BEATEN_FLAG）、フルーネ＝精霊の森のセラに初めて勝ったあと（SERA_BEATEN_FLAG）、
   * セレフィーン＝水の神殿のルシアに初めて勝ったあと（LUCIA_BEATEN_FLAG）
   */
  readonly unlockFlag?: string;
}

/**
 * ガチャのシリーズ（並び順＝選ぶ画面の順）。新しいモンスターが来たら、パックの絵1枚（assets/images/ui/gacha/pack_{id}.webp）と
 * ここに1行足すだけでシリーズが増える
 */
export const GACHA_SERIES: readonly GachaSeries[] = [
  // レア枠（2026-10-29 夜 ユーザー決定）：「そのモンスターのいちばん大きい攻撃はレア」を足し、どのモンスターもレアを3つにそろえた
  { id: 'soramo', monsterId: 'mon-soramo', rareSkillNames: ['ソラモビーム', 'スターフォール', '星影ステップ'] },
  { id: 'gauul', monsterId: 'mon-gauul', rareSkillNames: ['スパイラルダイブ', '聖なる炎', '高速飛行'] },
  { id: 'lazuck', monsterId: 'mon-lazuck', rareSkillNames: ['とびかかり', 'シャドウバースト', 'フェイントステップ'] },
  { id: 'nobiton', monsterId: 'mon-nobiton', rareSkillNames: ['まきつく', 'ギガントノーズ', 'ダウナーミスト'] },
  { id: 'myurol', monsterId: 'mon-myurol', rareSkillNames: ['アクアテール', 'スリップガード', 'すべってよける'] },
  { id: 'kalshell', monsterId: 'mon-kalshell', rareSkillNames: ['シェルブレイカー', 'タイダルクラッシュ', 'てっぺきシェル'] },
  // プカリム：ピートに初めて勝ったあとに並ぶ。パックの絵はまだ無い（封をしたパックの絵で出す）。JSON の gacha_slot も同じ（pukarim14_skills_DRAFT_20261029.json）
  { id: 'pukarim', monsterId: 'mon-pukarim', rareSkillNames: ['ぷはーっ', 'おおつむじ', 'ぷかぷか'], unlockFlag: 'pete-beaten' },
  // ジオル：グラントに初めて勝ったあとに並ぶ。JSON の gacha_slot も同じ（geol14_skills_DRAFT_20261029_rare3.json）
  { id: 'geol', monsterId: 'mon-geol', rareSkillNames: ['ナックル', 'グランドハンマー', 'うけとめる'], unlockFlag: 'grant-beaten' },
  // フルーネ：セラに初めて勝ったあとに並ぶ。JSON の gacha_slot も同じ（flune14_skills_OFFICIAL_20261029_rare3.json）
  { id: 'flune', monsterId: 'mon-flune', rareSkillNames: ['はなびらストーム', 'フラワードレイン', 'いやしのみつ'], unlockFlag: 'sera-beaten' },
  // セレフィーン（2026-10-29 セレフィーンの最終）：ルシアに初めて勝ったあとに並ぶ。JSON の gacha_slot も同じ（serephine14_skills_OFFICIAL_20261029.json）
  { id: 'serephine', monsterId: 'mon-serephine', rareSkillNames: ['アクアニードル', 'オーシャンウェーブ', 'ウェーブダンス'], unlockFlag: 'lucia-beaten' },
];

/** いまのセーブで選べるシリーズ（unlockFlag の記録がまだ無いものは並ばない） */
export function availableGachaSeries(storyFlags: readonly string[]): readonly GachaSeries[] {
  return GACHA_SERIES.filter((s) => !s.unlockFlag || storyFlags.includes(s.unlockFlag));
}

export function getGachaSeries(id: string): GachaSeries | undefined {
  return GACHA_SERIES.find((s) => s.id === id);
}

/**
 * ダンジョンのお金の入り方（2026-10-28 ユーザー承認の指示書「お金の入る側」design-parts/money-income-20261028/。すべて「最初の値」で、試遊して直す）。
 * ダンジョンごとの表はここ1か所。win＝バトラー・見えない番人に1勝ごと、chest＝宝箱のお金の範囲（stepG きざみ）、bossFirst／bossRepeat＝ボスの初回／2回目から
 * （初回のモンスターカードは src/data/dungeons.ts の firstClearCards のまま）
 */
export interface DungeonMoney {
  readonly win: number;
  readonly chest: readonly [min: number, max: number];
  readonly bossFirst: number;
  readonly bossRepeat: number;
}

export const DUNGEON_MONEY: Readonly<Record<string, DungeonMoney>> = {
  // 太古の遺跡：2026-10-29 ジオルの最終で氷の洞窟と同じ段に（C ランクで開く・地下4階）
  'dungeon-01': { win: 25, chest: [25, 50], bossFirst: 600, bossRepeat: 180 },
  'dungeon-02': { win: 15, chest: [15, 30], bossFirst: 300, bossRepeat: 90 },
  'dungeon-03': { win: 20, chest: [20, 40], bossFirst: 500, bossRepeat: 150 },
  'dungeon-04': { win: 25, chest: [25, 50], bossFirst: 600, bossRepeat: 180 },
  'dungeon-05': { win: 30, chest: [30, 60], bossFirst: 700, bossRepeat: 210 },
  'dungeon-06': { win: 35, chest: [35, 70], bossFirst: 850, bossRepeat: 250 },
  'dungeon-07': { win: 40, chest: [40, 80], bossFirst: 1000, bossRepeat: 300 },
};

/** そのダンジョンのお金（表に無いダンジョンは太古の遺跡と同じ） */
export function dungeonMoney(dungeonId: string | undefined): DungeonMoney {
  return DUNGEON_MONEY[dungeonId ?? ''] ?? (DUNGEON_MONEY['dungeon-01'] as DungeonMoney);
}

/**
 * 【仮】宝箱の中身（2026-10-28 指示書。1つの宝箱から1つ）。割合は％（合計100）。
 * - coins：お金（DUNGEON_MONEY の chest の範囲から coinStep きざみ）
 * - item：items の道具から同じ確率で1つ（所持の上限を超えるときはお金に替える）
 * - card：そのダンジョンのボスの切り札のモンスター（初回クリアでもらえるモンスターカードのモンスター）の技カードから1枚
 */
export const CHEST_RULES: {
  readonly rates: { readonly coins: number; readonly item: number; readonly card: number };
  readonly coinStep: number;
  readonly items: readonly ItemId[];
} = {
  rates: { coins: 70, item: 25, card: 5 },
  coinStep: 5,
  items: ['torch', 'incense', 'smokeBall', 'returnFeather'],
};
