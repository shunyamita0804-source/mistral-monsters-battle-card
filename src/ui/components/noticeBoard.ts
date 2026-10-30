import { TEAM_MONTH, TEAM_REQUIREMENT } from '../../data/calendar.ts';
import { getDungeon } from '../../data/dungeons.ts';
import { TOURNAMENTS } from '../../data/tournaments.ts';
import { isOfficialMonth, isTeamMonth, missingBosses, nextEventMonth, requiredBossDungeons } from '../../game/calendar/calendar.ts';
import type { SaveData } from '../../game/save/saveData.ts';
import { monthName } from '../../i18n/calendarText.ts';
import { dungeonName, tournamentName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { button, h } from '../dom.ts';
import officialIcon from '@assets/images/ui/calendar/event_icon_official.webp';
import teamIcon from '@assets/images/ui/calendar/event_icon_team.webp';

interface NoticeRow {
  readonly icon: string;
  readonly head: string;
  readonly name: string;
  readonly cond: string;
  readonly locked: boolean;
  /** 行事の月（「今月」「次は ○月」の印に使う） */
  readonly isThisMonth: boolean;
  readonly isNext: boolean;
  readonly nextMonth: number;
}

const namesOf = (ids: readonly string[]): string =>
  ids
    .map((id) => {
      const d = getDungeon(id);
      return d ? dungeonName(d) : id;
    })
    .join(t('common.listSeparator'));

/** 掲示板の紙の行：3・6・9月の公式戦（いまのランクの大会）と、12月のチーム戦 */
function noticeRows(save: SaveData): NoticeRow[] {
  const month = save.calendar.month;
  const next = nextEventMonth(month);
  const cup = TOURNAMENTS.find((x) => x.requiredRank === save.rank);
  const bosses = requiredBossDungeons(save.rank);
  const missing = missingBosses(save, save.rank);
  const officialNow = isOfficialMonth(month);
  const teamNow = isTeamMonth(month);
  return [
    {
      icon: officialIcon,
      head: t('calendar.board.official'),
      name: cup ? t('tournament.nameTemp', { name: tournamentName(cup) }) : '',
      cond: bosses.length > 0 ? t('calendar.board.officialCond', { bosses: namesOf(bosses) }) : t('calendar.board.officialCondNone'),
      locked: missing.length > 0,
      isThisMonth: officialNow,
      isNext: !officialNow && isOfficialMonth(next),
      nextMonth: next,
    },
    {
      icon: teamIcon,
      head: t('calendar.board.team'),
      name: t('calendar.board.teamSoon'),
      cond: t('calendar.board.teamCond', { rank: TEAM_REQUIREMENT.rank }),
      // チーム戦はまだ作っていないので、出場の条件はまだ満たせない
      locked: true,
      isThisMonth: teamNow,
      isNext: !teamNow && next === TEAM_MONTH,
      nextMonth: TEAM_MONTH,
    },
  ];
}

/**
 * 管理局の掲示板（2026-10-30 指示書 R2）：notice_board_bg の画面。上の札に「大会のお知らせ」、紙を縦に並べる。
 * まだ出られないものは錠前の紙（notice_paper_locked）に条件を書く。今月の行事に「今月」、次の行事に「次は ○月」。「戻る」で閉じる
 */
export function openNoticeBoard(parent: HTMLElement, save: SaveData, onClose: () => void): void {
  const close = (): void => {
    el.remove();
    onClose();
  };
  const paper = (row: NoticeRow): HTMLElement => {
    const tag = row.isThisMonth
      ? h('span', { class: 'notice-board__tag is-now', text: t('calendar.board.thisMonth') })
      : row.isNext
        ? h('span', { class: 'notice-board__tag is-next', text: t('calendar.board.next', { month: monthName(row.nextMonth) }) })
        : null;
    return h(
      'li',
      { class: `notice-board__paper${row.locked ? ' is-locked' : ''}` },
      h('img', { class: 'notice-board__icon', attrs: { src: row.icon, alt: '', draggable: 'false' } }),
      h(
        'div',
        { class: 'notice-board__text' },
        h('p', { class: 'notice-board__head', text: row.head }),
        row.name ? h('p', { class: 'notice-board__name', text: row.name }) : null,
        h('p', { class: 'notice-board__cond', text: row.cond }),
      ),
      tag,
    );
  };
  const el = h(
    'div',
    { class: 'notice-board', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('calendar.board.title') } },
    h('h2', { class: 'notice-board__title', text: t('calendar.board.title') }),
    h('ul', { class: 'notice-board__list' }, ...noticeRows(save).map(paper)),
    button(t('common.back'), close, 'btn btn--primary notice-board__back'),
  );
  parent.append(el);
}
