import type { GameDate } from '../game/save/saveData.ts';
import type { Season } from '../game/calendar/calendar.ts';
import { t } from './i18n.ts';
import type { MessageKey } from './messages/index.ts';

/** 月の名前（日本語「4月」・英語「April」） */
export const monthName = (month: number): string => t(`calendar.month.${month}` as MessageKey);

/** 日付の札の文字（「1年目 4月」・「Year 1 · April」） */
export const dateLabel = (date: GameDate): string => t('calendar.date', { year: date.year, month: monthName(date.month) });

export const seasonName = (season: Season): string => t(`calendar.season.${season}` as MessageKey);
