import type { RankId } from './economy.ts';

/**
 * 【仮データ】カレンダー（2026-10-30 指示書 R2「カレンダーの決まり」の1段目：年と月）。
 *
 * - ゲームは「1年目 4月」から始まる。4月になるたびに年が1つ進む（1年目＝4月〜3月）
 * - 1か月進むのは：ダンジョンから街に戻ったとき・大会が終わったとき・家のベッドで「寝る」を選んだときだけ（src/game/calendar/calendar.ts）
 * - 季節：春＝3〜5月、夏＝6〜8月、秋＝9〜11月、冬＝12〜2月
 */
export const START_DATE = { year: 1, month: 4 } as const;

/** 公式戦（E〜S のランクの大会）に出られる月 */
export const OFFICIAL_MONTHS: readonly number[] = [3, 6, 9];

/** チーム戦の月（公式戦はない。チーム戦はまだ作っていない） */
export const TEAM_MONTH = 12;

/** チーム戦の出場の条件（掲示板に書くだけ。チーム戦はまだ作っていないので、今は満たせない） */
export const TEAM_REQUIREMENT = { rank: 'C' as RankId } as const;

/**
 * 公式戦の出場の条件：そのランクで開いているダンジョンのボスを、すべて倒していること。
 * 新しいダンジョン（D・B・A・S に1つずつ）や物語のダンジョン（霧の廃坑・忘れられた書庫）が入ったら、そのランクの一覧に足すだけでよい
 */
export const RANK_BOSS_DUNGEONS: Readonly<Record<RankId, readonly string[]>> = {
  E: ['dungeon-02'], // 精霊の森
  D: ['dungeon-03', 'dungeon-08'], // 水の神殿・風の渓谷（2026-10-30 指示書 U）
  C: ['dungeon-04', 'dungeon-01'], // 氷の洞窟・太古の遺跡
  B: ['dungeon-05'], // 炎の火山
  A: ['dungeon-06'], // 機械の塔
  S: ['dungeon-07'], // 天の聖域
};
