import { OFFICIAL_MONTHS, RANK_BOSS_DUNGEONS, START_DATE, TEAM_MONTH } from '../../data/calendar.ts';
import type { RankId } from '../../data/economy.ts';
import type { GameDate, SaveData } from '../save/saveData.ts';

/**
 * カレンダー（2026-10-30 指示書 R2「カレンダーの決まり」の1段目：年と月）。数値は src/data/calendar.ts（仮）。
 *
 * 1か月進むのは次の3つだけ（ガチャ・買い物・練習場・ピートとの勝負・会話では進まない）：
 * - ダンジョンに挑んで街に戻ったとき（クリア・3回負けて戻された・帰還の羽根。src/game/dungeon/run.ts・src/game/items/items.ts）
 * - 大会に出て、その大会が終わったとき（優勝でも負けでも。景品を受け取ったとき。src/game/progress/tournament.ts）
 * - 家のベッドで「寝る」を選んだとき（体力などは変わらない。時間を進めるだけ）
 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** 季節：春＝3〜5月、夏＝6〜8月、秋＝9〜11月、冬＝12〜2月 */
export function seasonOf(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/** 季節が変わる月（3・6・9・12月）。この月になったときは、月の札の前に季節の挿絵を出す */
export function isSeasonStart(month: number): boolean {
  return month === 3 || month === 6 || month === 9 || month === 12;
}

/** 次の月（4月になったら年が1つ進む：1年目＝4月〜3月） */
export function nextDate(date: GameDate): GameDate {
  const month = (date.month % 12) + 1;
  return { year: month === START_DATE.month ? date.year + 1 : date.year, month };
}

export function sameDate(a: GameDate, b: GameDate): boolean {
  return a.year === b.year && a.month === b.month;
}

/** 1か月進める */
export function advanceMonth(save: SaveData): SaveData {
  return { ...save, calendar: nextDate(save.calendar) };
}

/* ---------- 大会 ---------- */

/** 公式戦（E〜S のランクの大会）に出られる月か */
export function isOfficialMonth(month: number): boolean {
  return OFFICIAL_MONTHS.includes(month);
}

export function isTeamMonth(month: number): boolean {
  return month === TEAM_MONTH;
}

/** 次の公式戦の月（今月が公式戦の月なら今月） */
export function nextOfficialMonth(month: number): number {
  for (let i = 0; i < 12; i++) {
    const m = ((month - 1 + i) % 12) + 1;
    if (isOfficialMonth(m)) return m;
  }
  return month;
}

/** 次の行事の月（公式戦かチーム戦。今月の行事は入れない＝今月より後でいちばん近い月） */
export function nextEventMonth(month: number): number {
  for (let i = 1; i <= 12; i++) {
    const m = ((month - 1 + i) % 12) + 1;
    if (isOfficialMonth(m) || isTeamMonth(m)) return m;
  }
  return month;
}

/** そのランクの公式戦に出るために倒すボスのダンジョン（src/data/calendar.ts の RANK_BOSS_DUNGEONS） */
export function requiredBossDungeons(rank: RankId): readonly string[] {
  return RANK_BOSS_DUNGEONS[rank];
}

/** そのランクの公式戦に出るのに、まだボスを倒していないダンジョン */
export function missingBosses(save: Pick<SaveData, 'dungeons'>, rank: RankId): string[] {
  return requiredBossDungeons(rank).filter((id) => save.dungeons[id]?.bossDefeated !== true);
}
