import type { MessageEntry } from '../i18n.ts';

/** カレンダー（年と月・月が変わる演出・ベッドの「寝る」・管理局の掲示板。2026-10-30 指示書 R2） */
export const CALENDAR = {
  'calendar.month.1': { ja: '1月', en: 'January' },
  'calendar.month.2': { ja: '2月', en: 'February' },
  'calendar.month.3': { ja: '3月', en: 'March' },
  'calendar.month.4': { ja: '4月', en: 'April' },
  'calendar.month.5': { ja: '5月', en: 'May' },
  'calendar.month.6': { ja: '6月', en: 'June' },
  'calendar.month.7': { ja: '7月', en: 'July' },
  'calendar.month.8': { ja: '8月', en: 'August' },
  'calendar.month.9': { ja: '9月', en: 'September' },
  'calendar.month.10': { ja: '10月', en: 'October' },
  'calendar.month.11': { ja: '11月', en: 'November' },
  'calendar.month.12': { ja: '12月', en: 'December' },
  // 街と部屋の左上の日付の札
  'calendar.date': { ja: '{year}年目 {month}', en: 'Year {year} · {month}' },
  'calendar.season.spring': { ja: '春', en: 'Spring' },
  'calendar.season.summer': { ja: '夏', en: 'Summer' },
  'calendar.season.autumn': { ja: '秋', en: 'Autumn' },
  'calendar.season.winter': { ja: '冬', en: 'Winter' },
  // 月が変わったときの帯（年が変わった 4月は calendar.date と同じ「2年目 4月」）
  'calendar.banner': { ja: '{month}', en: '{month}' },

  // ベッド（家）
  'calendar.bed.title': { ja: 'ベッド', en: 'Bed' },
  'calendar.bed.sleep': { ja: '寝る', en: 'Sleep' },
  'calendar.bed.save': { ja: 'セーブ', en: 'Save' },
  'calendar.bed.load': { ja: 'ロード', en: 'Load' },
  'calendar.bed.sleepConfirm': { ja: '1か月休みますか？', en: 'Rest for a month?' },
  'calendar.bed.morning': { ja: 'よく眠った。\n{date}の朝だ。', en: 'You slept well.\nIt is morning, {date}.' },

  // 管理局の掲示板
  'calendar.board.title': { ja: '大会のお知らせ', en: 'Cup Announcements' },
  'calendar.board.official': { ja: '3・6・9月 公式戦', en: 'Mar · Jun · Sep — Official Cup' },
  'calendar.board.officialCond': { ja: '出場の条件：{bosses}のボスを倒す', en: 'To enter: beat the boss of {bosses}' },
  'calendar.board.officialCondNone': { ja: '出場の条件：なし', en: 'To enter: no conditions' },
  'calendar.board.team': { ja: '12月 チーム戦', en: 'December — Team Battle' },
  'calendar.board.teamCond': { ja: '出場の条件：{rank}ランク・霧の廃坑', en: 'To enter: Rank {rank} and the Misty Mine' },
  'calendar.board.teamSoon': { ja: 'まだ受け付けていません', en: 'Entries are not open yet' },
  'calendar.board.thisMonth': { ja: '今月', en: 'This month' },
  'calendar.board.next': { ja: '次は {month}', en: 'Next: {month}' },
} as const satisfies Readonly<Record<string, MessageEntry>>;
