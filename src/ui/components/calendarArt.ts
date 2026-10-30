import { isSeasonStart, seasonOf, type Season } from '../../game/calendar/calendar.ts';
import type { GameDate } from '../../game/save/saveData.ts';
import { dateLabel, monthName, seasonName } from '../../i18n/calendarText.ts';
import { t } from '../../i18n/i18n.ts';
import { h } from '../dom.ts';
import iconSpring from '@assets/images/ui/calendar/season_icon_spring.webp';
import iconSummer from '@assets/images/ui/calendar/season_icon_summer.webp';
import iconAutumn from '@assets/images/ui/calendar/season_icon_autumn.webp';
import iconWinter from '@assets/images/ui/calendar/season_icon_winter.webp';
import townSpring from '@assets/images/ui/calendar/season_town_spring.webp';
import townSummer from '@assets/images/ui/calendar/season_town_summer.webp';
import townAutumn from '@assets/images/ui/calendar/season_town_autumn.webp';
import townWinter from '@assets/images/ui/calendar/season_town_winter.webp';
import sleepNightArt from '@assets/images/ui/calendar/sleep_night.webp';

/**
 * カレンダーの絵（2026-10-30 指示書 R2。原本 design-parts/ui-calendar-20261030/）：
 * 街と部屋の左上の日付の札・月が変わるときの演出（季節の挿絵と月の帯）・ベッドで寝るときの夜の挿絵
 */
export const SEASON_ICON: Readonly<Record<Season, string>> = { spring: iconSpring, summer: iconSummer, autumn: iconAutumn, winter: iconWinter };
const SEASON_TOWN: Readonly<Record<Season, string>> = { spring: townSpring, summer: townSummer, autumn: townAutumn, winter: townWinter };

/** 日付の札（左の丸い台座に季節の紋、右に「1年目 4月」）。英語の長い月の名前は字を少し小さく */
export function datePlate(date: GameDate): HTMLElement {
  const season = seasonOf(date.month);
  const text = dateLabel(date);
  return h(
    'div',
    { class: 'date-plate', attrs: { 'aria-label': `${seasonName(season)} ${text}` }, dataset: { season } },
    h('img', { class: 'date-plate__icon', attrs: { src: SEASON_ICON[season], alt: '', draggable: 'false' } }),
    h('span', { class: `date-plate__text${text.length > 14 ? ' is-long' : ''}`, text }),
  );
}

/** 季節の挿絵だけを出す時間（そのあと月の帯を重ねる）・帯を出す時間・消える時間（ミリ秒。CSS の calendar.css と合わせる） */
const SEASON_ART_MS = 1300;
const BANNER_MS = 1500;
const LEAVE_MS = 450;

export interface MonthChangeOptions {
  /** 年も変わった（4月）：帯に「2年目 4月」 */
  readonly yearChanged?: boolean;
  /** 後ろを暗くしておく（ベッドで寝たあと：暗転の上に出す） */
  readonly dark?: boolean;
}

/**
 * 月が変わる演出：月の帯（month_banner に「5月」）を約1.5秒。季節が変わる月（3・6・9・12月）だけ、先に季節の挿絵を画面いっぱいに出してから帯を重ねる。
 * タップで早送り（挿絵だけのときは帯へ、帯のときは終わり）。終わったら done
 */
export function playMonthChange(parent: HTMLElement, to: GameDate, done: () => void, options: MonthChangeOptions = {}): void {
  const season = isSeasonStart(to.month);
  const text = options.yearChanged ? dateLabel(to) : t('calendar.banner', { month: monthName(to.month) });
  const banner = h('div', { class: 'month-change__banner' }, h('span', { class: 'month-change__text', text }));
  const el = h(
    'div',
    { class: `month-change${season ? ' has-season' : ''}${options.dark ? ' is-dark' : ''}`, attrs: { role: 'status', 'aria-label': text } },
    season ? h('img', { class: 'month-change__art', attrs: { src: SEASON_TOWN[seasonOf(to.month)], alt: '', draggable: 'false' } }) : null,
    banner,
  );
  let timer: ReturnType<typeof setTimeout> | null = null;
  let step: 'art' | 'banner' | 'leaving' = season ? 'art' : 'banner';
  const later = (fn: () => void, ms: number): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
  const finish = (): void => {
    if (step === 'leaving') return;
    step = 'leaving';
    el.classList.add('is-leaving');
    later(() => {
      el.remove();
      done();
    }, LEAVE_MS);
  };
  const showBanner = (): void => {
    step = 'banner';
    el.classList.add('is-banner');
    later(finish, BANNER_MS);
  };
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (step === 'art') showBanner();
    else if (step === 'banner') finish();
  });
  parent.append(el);
  // 次のコマで出す（フェードイン）
  requestAnimationFrame(() => {
    el.classList.add('is-on');
    if (step === 'art') later(showBanner, SEASON_ART_MS);
    else showBanner();
  });
}

/** 夜の挿絵を出す時間・暗転の時間（ミリ秒） */
const NIGHT_MS = 2200;
const DARK_MS = 700;

/**
 * ベッドで寝る：夜の挿絵（sleep_night）→ 暗転 → 月が変わる演出 → 暗転が明けて朝（done）。夜の挿絵はタップで早送り
 */
export function playSleep(parent: HTMLElement, to: GameDate, yearChanged: boolean, done: () => void): void {
  const el = h('div', { class: 'sleep-night', attrs: { 'aria-hidden': 'true' } }, h('img', { class: 'sleep-night__art', attrs: { src: sleepNightArt, alt: '', draggable: 'false' } }));
  let timer: ReturnType<typeof setTimeout> | null = null;
  let darkened = false;
  const toDark = (): void => {
    if (darkened) return;
    darkened = true;
    if (timer) clearTimeout(timer);
    el.classList.add('is-dark');
    setTimeout(() => {
      playMonthChange(el, to, () => {
        el.classList.add('is-leaving');
        setTimeout(() => {
          el.remove();
          done();
        }, DARK_MS);
      }, { yearChanged, dark: true });
    }, DARK_MS);
  };
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    toDark();
  });
  parent.append(el);
  requestAnimationFrame(() => {
    el.classList.add('is-on');
    timer = setTimeout(toDark, NIGHT_MS);
  });
}
