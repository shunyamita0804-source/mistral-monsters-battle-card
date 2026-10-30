import { skillsOf } from '../../data/cards.ts';
import { GACHA, GACHA_SERIES, gachaSeenFlag, getGachaSeries, SKIP_GACHA_SERIES_IDS, type GachaSeries } from '../../data/economy.ts';
import { BOOSTERS } from '../../data/introV2.ts';
import { t } from '../../i18n/i18n.ts';
import { nextRandom } from '../rng.ts';
import { addCards, hasProcessed, markProcessed, type SaveData } from '../save/saveData.ts';

/**
 * カードショップのガチャ（2026-10-28 作り直し。1シリーズ＝1モンスター）。画面に依存しない部分。
 * 数字は data/economy.ts の GACHA・GACHA_SERIES。カードにレアリティの表示は出さず、中の確率だけ「ノーマル枠」「レア枠」に分ける
 */

/** 出たカードの枠（開ける順番：ノーマル → レア → モンスター） */
export type GachaTier = 'normal' | 'rare' | 'monster';

const TIER_ORDER: Readonly<Record<GachaTier, number>> = { normal: 0, rare: 1, monster: 2 };

export interface SeriesLineup {
  readonly monsterId: string;
  /** 技カード（そのモンスターの技14種。並びはデータの順） */
  readonly skillIds: readonly string[];
  /** レア枠の技の ID */
  readonly rareIds: readonly string[];
  /** ラインナップ15枠（モンスター1＋技14。画面の並び：モンスターが最後） */
  readonly all: readonly string[];
}

/** シリーズの中身。レア枠は技の名前から今のデータの ID を引く（見つからない名前は errors に入れる） */
export function seriesLineup(series: GachaSeries): SeriesLineup & { readonly errors: readonly string[] } {
  const skills = skillsOf(series.monsterId);
  const errors: string[] = [];
  const rareIds = series.rareSkillNames.flatMap((name) => {
    const hit = skills.filter((s) => s.name === name);
    if (hit.length !== 1) errors.push(`${series.id}: レア枠の技「${name}」が${hit.length === 0 ? '見つかりません' : '2つ以上あります'}`);
    return hit.map((s) => s.id);
  });
  const skillIds = skills.map((s) => s.id);
  return { monsterId: series.monsterId, skillIds, rareIds, all: [...skillIds, series.monsterId], errors };
}

/**
 * 最初から並ぶシリーズのモンスター（2026-10-30 指示書 K。ユーザー決定）：管理局で選んだ箱の3体。
 * 箱を選んでいないセーブ（チュートリアルをスキップした・前の形式）は、今までどおり6つ（SKIP_GACHA_SERIES_IDS）
 */
export function startingGachaMonsters(save: SaveData): readonly string[] {
  const box = BOOSTERS.find((b) => b.key === save.story.introV2.selectedBoosterKey);
  if (box) return box.monsters;
  return GACHA_SERIES.filter((s) => SKIP_GACHA_SERIES_IDS.includes(s.id)).map((s) => s.monsterId);
}

/**
 * いま並ぶシリーズ（2026-10-30 指示書 K。ユーザー決定）：
 * - 最初から並ぶ：startingGachaMonsters のシリーズ
 * - ほかは、そのモンスターのモンスターカードを初めて手に入れたら開く（ショップで箱を買った・ピートに勝った・ボスから受け取った など。手に入れ方は問わない）
 * - 一度選んだシリーズ（gachaSeenFlag）は閉じない（前のセーブで並んでいたシリーズは、v27→v28 の変換でこの記録が付く）
 */
export function availableGachaSeriesFor(save: SaveData): readonly GachaSeries[] {
  const start = startingGachaMonsters(save);
  return GACHA_SERIES.filter(
    (s) => start.includes(s.monsterId) || (save.collection[s.monsterId] ?? 0) > 0 || save.storyFlags.includes(gachaSeenFlag(s.id)),
  );
}

/** NEW の印を出すシリーズか（あとから開いて、まだ一度も選んでいない。最初から並ぶシリーズには出さない） */
export function isNewGachaSeries(save: SaveData, series: GachaSeries): boolean {
  if (startingGachaMonsters(save).includes(series.monsterId) || save.storyFlags.includes(gachaSeenFlag(series.id))) return false;
  return availableGachaSeriesFor(save).includes(series);
}

/** カードの枠 */
export function tierOf(lineup: SeriesLineup, cardId: string): GachaTier {
  if (cardId === lineup.monsterId) return 'monster';
  return lineup.rareIds.includes(cardId) ? 'rare' : 'normal';
}

/** 技1種あたりの出る割合（1枚の中で。合計1） */
export function skillWeights(lineup: SeriesLineup): { readonly cardId: string; readonly weight: number }[] {
  return lineup.skillIds.map((cardId) => ({ cardId, weight: lineup.rareIds.includes(cardId) ? GACHA.weight.rare : GACHA.weight.normal }));
}

/**
 * パック1つを開けた中身（開ける順に並べる）。
 * 5枚それぞれ技を重みで選び、1パックに monsterRate の確率で5枚のうち1枚をモンスターカードに替える。
 * 2026-10-30 指示書 V（ユーザー決定）：モンスターカードは「まだ持っていないとき」だけ（ownsMonster が true なら、モンスターの当たりの抽選をしない。
 * 技14種だけ）。天井なし。この先の「大会の優勝で開き、ガチャで当てるしかないモンスター」も同じ決まりで動く
 */
export function drawSeriesPack(series: GachaSeries, seed: number, ownsMonster = false): { cards: string[]; seed: number } {
  const lineup = seriesLineup(series);
  const weights = skillWeights(lineup);
  const total = weights.reduce((s, w) => s + w.weight, 0);
  let s = seed;
  const roll = (): number => {
    const r = nextRandom(s);
    s = r.seed;
    return r.value;
  };
  const cards: string[] = [];
  for (let i = 0; i < GACHA.cardsPerPack; i++) {
    let point = roll() * total;
    let picked = weights[weights.length - 1]?.cardId;
    for (const w of weights) {
      point -= w.weight;
      if (point < 0) {
        picked = w.cardId;
        break;
      }
    }
    if (picked) cards.push(picked);
  }
  if (!ownsMonster && roll() < GACHA.monsterRate) {
    const slot = Math.min(cards.length - 1, Math.floor(roll() * cards.length));
    cards[slot] = lineup.monsterId;
  }
  // 強いものほど最後（同じ枠の中は引いた順のまま）
  const sorted = cards.map((id, i) => ({ id, i })).sort((a, b) => TIER_ORDER[tierOf(lineup, a.id)] - TIER_ORDER[tierOf(lineup, b.id)] || a.i - b.i);
  return { cards: sorted.map((c) => c.id), seed: s };
}

/** シリーズの「○ / 15 そろった」 */
export function seriesOwned(save: SaveData, series: GachaSeries): { readonly owned: number; readonly total: number } {
  const { all } = seriesLineup(series);
  return { owned: all.filter((id) => (save.collection[id] ?? 0) > 0).length, total: all.length };
}

export type SeriesPurchaseResult =
  | { readonly status: 'ok'; readonly save: SaveData; readonly cards: readonly string[] }
  | { readonly status: 'duplicate'; readonly save: SaveData }
  | { readonly status: 'error'; readonly save: SaveData; readonly message: string };

/**
 * シリーズのパックを1つ買う（お金を払って中身を決め、所持に足す）。
 * transactionId は値段の確認を開いたときに1回だけ作る ID。同じ ID で2回呼ばれても2回目は何もしない（連打で二重に払わない）
 */
export function purchaseSeriesPack(save: SaveData, seriesId: string, transactionId: string, seed: number): SeriesPurchaseResult {
  if (hasProcessed(save, transactionId)) return { status: 'duplicate', save };
  const series = getGachaSeries(seriesId);
  // まだ並んでいないシリーズ（そのモンスターのカードをまだ持っていない）は買えない
  if (!series || !availableGachaSeriesFor(save).includes(series)) return { status: 'error', save, message: t('gacha.error.noPack') };
  if (save.coins < GACHA.price) return { status: 'error', save, message: t('gacha.error.coins') };
  // モンスターカードは、そのモンスターのカードを1枚も持っていないときだけ出る（2026-10-30 指示書 V）
  const { cards } = drawSeriesPack(series, seed, (save.collection[series.monsterId] ?? 0) > 0);
  let next = addCards(
    { ...save, coins: save.coins - GACHA.price },
    cards.map((cardId) => ({ cardId, count: 1 })),
  );
  next = markProcessed(next, transactionId);
  next = { ...next, stats: { ...next.stats, packsOpened: next.stats.packsOpened + 1 } };
  return { status: 'ok', save: next, cards };
}

/**
 * 機械の画面の「パックを選び直す」を出せるか（払う前だけ。払ったあとは出さない）
 */
export function canReselectSeries(paid: boolean): boolean {
  return !paid;
}

/** シリーズを一度選んだ記録を付ける（NEW の印を消す）。NEW でなければそのまま返す */
export function markGachaSeriesSeen(save: SaveData, series: GachaSeries): SaveData {
  if (!isNewGachaSeries(save, series)) return save;
  return { ...save, storyFlags: [...save.storyFlags, gachaSeenFlag(series.id)] };
}
