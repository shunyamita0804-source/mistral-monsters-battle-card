import { RANK_BOSS_DUNGEONS } from '../../data/calendar.ts';
import { getMonster, skillsOf } from '../../data/cards.ts';
import { DUNGEONS, LUCIA_BEATEN_FLAG, SERA_BEATEN_FLAG } from '../../data/dungeons.ts';
import { GACHA, type RankId } from '../../data/economy.ts';
import { BOOSTERS } from '../../data/introV2.ts';
import { personOfOpponent } from '../../data/people.ts';
import { ENCOUNTERS } from '../../data/dungeons.ts';
import { runConfig } from '../../data/dungeonRun.ts';
import {
  getStoryEvent,
  STORY_EVENTS,
  storyEventFlag,
  type CardRef,
  type CardShow,
  type EventLine,
  type EventTrigger,
  type StoryEventDefinition,
  type StoryEventId,
} from '../../data/storyEvents.ts';
import { dungeonName } from '../../i18n/content.ts';
import { getLanguage, t } from '../../i18n/i18n.ts';
import type { MessageEntry } from '../../i18n/i18n.ts';
import { missingBosses, nextOfficialMonth, type Season } from '../calendar/calendar.ts';
import { FLAG_SIENNA_LEFT, type SaveData } from '../save/saveData.ts';
import { canChallengePete, hasBeatenPete } from './pete.ts';
import { isIntroV2Done } from './introV2.ts';

/**
 * 序盤〜C大会後のイベント（2026-11-02 指示書 AT）の「いつ起きるか」。画面に依存しない。データは src/data/storyEvents.ts
 * - pendingStoryEvent(save, trigger, ctx)：そのきっかけで、いま起きるイベント（1つだけ。まだ見ていない・条件を満たす・順番の早いもの）
 * - markStoryEventSeen(save, id)：一度だけの印を付ける（純粋関数。GameStore.update で使う）
 * - 戦闘・報酬・月が進む途中には呼ばない（画面の側で、今の処理が全部終わったあとに呼ぶ）
 * - 街に入ったとき（townEnter）に重なったら、M28 → M21 → M11T の順に1つだけ。残りは次に街へ入ったときに
 */

/** そのイベントの結果・状況（せりふを選ぶ・条件に使う） */
export interface EventContext {
  readonly npc?: string;
  readonly dungeon?: string;
  readonly rank?: RankId;
  readonly opponent?: string;
  readonly season?: Season;
  readonly after?: StoryEventId;
  /** 大会で優勝した・決勝で勝った */
  readonly won?: boolean;
  /** C 大会で早く負けた（決勝まで行かなかった） */
  readonly earlyLoss?: boolean;
  /** 守り手に初めて勝って、そのダンジョンのモンスターカードを受け取った（reward） */
  readonly firstClear?: boolean;
}

export const hasSeenStoryEvent = (save: SaveData, id: StoryEventId): boolean => save.storyFlags.includes(storyEventFlag(id));

export function markStoryEventSeen(save: SaveData, id: StoryEventId): SaveData {
  const flag = storyEventFlag(id);
  return save.storyFlags.includes(flag) ? save : { ...save, storyFlags: [...save.storyFlags, flag] };
}

const beaten = (save: SaveData, dungeonId: string): boolean => save.dungeons[dungeonId]?.bossDefeated === true;
const introDone = (save: SaveData): boolean => isIntroV2Done(save.story.introV2);
const ownsSkill = (save: SaveData): boolean => Object.entries(save.collection).some(([id, n]) => n > 0 && id.startsWith('skl-') && !id.startsWith('skl-tmp'));

/** 街に入ったときの順番（2026-11-02 指示書 AT「10. 重なったときの順番」） */
const TOWN_ORDER: readonly StoryEventId[] = ['M28', 'M21', 'M11T'];

/** イベントごとの条件（きっかけが合ったうえで） */
function conditionMet(save: SaveData, ev: StoryEventDefinition, ctx: EventContext): boolean {
  switch (ev.id) {
    case 'M02':
      return save.story.introV2.boosterClaimed;
    case 'M03':
      // 導入が終わった直後。前のセーブで、もう最初の試練（風の渓谷）を越えている人・E より上の人には出さない
      return introDone(save) && save.rank === 'E' && !beaten(save, 'dungeon-08');
    case 'M04':
    case 'M06':
    case 'M07':
    case 'M08':
    case 'O02':
    case 'O03':
    case 'O04':
      return introDone(save);
    case 'O01':
      return introDone(save);
    case 'M05':
      return canChallengePete(save) && !hasBeatenPete(save);
    case 'M05W':
      return hasBeatenPete(save);
    case 'M11':
    case 'M17R':
    case 'M19R':
    case 'M24R':
    case 'M25R':
      // 今の報酬の処理で、実際にモンスターカードを受け取ったときだけ
      return ctx.firstClear === true;
    case 'M11T':
      return beaten(save, 'dungeon-08') && save.rank === 'E';
    case 'M12':
      return beaten(save, 'dungeon-08');
    case 'M14':
      return true;
    case 'M15':
      return save.rank === 'D';
    case 'M23':
      return save.rank === 'C';
    case 'M21':
      // どちらを先に倒しても、両方に勝ったあと
      return (save.storyFlags.includes(LUCIA_BEATEN_FLAG) || beaten(save, 'dungeon-03')) && (save.storyFlags.includes(SERA_BEATEN_FLAG) || beaten(save, 'dungeon-02'));
    case 'M26':
      return !save.storyFlags.includes(FLAG_SIENNA_LEFT);
    case 'M27':
    case 'M27E':
      return ctx.opponent === 'sienna';
    case 'M28':
      return save.storyFlags.includes(FLAG_SIENNA_LEFT);
    case 'M29':
      return hasSeenStoryEvent(save, 'M28');
    case 'M30':
      return hasSeenStoryEvent(save, 'M29');
    case 'O05':
      return hasSeenStoryEvent(save, 'M06') && ownsSkill(save);
    case 'O06':
      // 導入の練習のあとで、ふつうの対戦（ダンジョン・大会・ピート）に1回以上負けた（save.stats.battlesLost。練習試合は数えない）
      return introDone(save) && save.stats.battlesLost > 0;
    default:
      return true;
  }
}

/** きっかけが合っているか */
function triggerMatches(ev: StoryEventDefinition, trigger: EventTrigger, ctx: EventContext): boolean {
  if (ev.trigger !== trigger) return false;
  if (ev.npc && ev.npc !== ctx.npc) return false;
  if (ev.dungeon && ev.trigger !== 'guardian' && ev.dungeon !== ctx.dungeon) return false;
  if (ev.rank && (trigger === 'tournamentEntry' || trigger === 'tournamentEnd' || trigger === 'match' || trigger === 'final' || trigger === 'finalEnd') && ev.rank !== ctx.rank) return false;
  if (ev.opponent && ev.opponent !== ctx.opponent) return false;
  if (ev.season && ev.season !== ctx.season) return false;
  // すぐあとに続くイベントは、前のイベントが合うときだけ（M02 は前のイベントの無い「箱を受け取った直後」）
  if (trigger === 'chain' && ev.after !== ctx.after) return false;
  return true;
}

/** 守り手の前の場面（guardian）は、今のせりふだけ（ここからは何も出さない） */
const PLAYED_BY_EVENTS = (ev: StoryEventDefinition): boolean => ev.trigger !== 'guardian';

/** そのきっかけで起きうるイベント（まだ見ていない・条件を満たす）。順番：街に入ったときは TOWN_ORDER、ほかは章と順番 */
export function pendingStoryEvents(save: SaveData, trigger: EventTrigger, ctx: EventContext = {}): StoryEventDefinition[] {
  const list = STORY_EVENTS.filter((ev) => PLAYED_BY_EVENTS(ev) && triggerMatches(ev, trigger, ctx) && !hasSeenStoryEvent(save, ev.id) && conditionMet(save, ev, ctx));
  // 同じきっかけで重なったら：街に入ったときは TOWN_ORDER、ほかは必須（main）を先に、そのあと章と順番（研究所のルーカスは M29 → M06 → O05）
  const rank = (ev: StoryEventDefinition): number => (trigger === 'townEnter' ? TOWN_ORDER.indexOf(ev.id) : ev.kind === 'main' ? 0 : 1);
  return list.sort((a, b) => rank(a) - rank(b) || a.chapter - b.chapter || a.order - b.order);
}

/** そのきっかけで、いま起きるイベント（1つだけ） */
export function pendingStoryEvent(save: SaveData, trigger: EventTrigger, ctx: EventContext = {}): StoryEventDefinition | null {
  return pendingStoryEvents(save, trigger, ctx)[0] ?? null;
}

/** すぐあとに続くイベント（chain。M05 → M05W・M29 → M30） */
export function chainedStoryEvent(save: SaveData, after: StoryEventId, ctx: EventContext = {}): StoryEventDefinition | null {
  return pendingStoryEvent(save, 'chain', { ...ctx, after });
}

/** その行を出すか（結果で分ける行） */
export function lineVisible(line: EventLine, ctx: EventContext, save: SaveData): boolean {
  switch (line.when) {
    case undefined:
      return true;
    case 'won':
      return ctx.won === true;
    case 'lost':
      return ctx.won !== true;
    case 'earlyLoss':
      return ctx.earlyLoss === true;
    case 'forestCleared':
      return save.storyFlags.includes(SERA_BEATEN_FLAG) || beaten(save, 'dungeon-02');
    default:
      return true;
  }
}

const month = (m: number): string => t(`calendar.month.${m}` as 'calendar.month.1');

/** 公式戦の条件のうち、まだ倒していない守り手（「ゼフィラ（風の渓谷）」） */
function missingKeepers(save: SaveData): string[] {
  return missingBosses(save, save.rank).map((id) => {
    const d = DUNGEONS.find((x) => x.id === id);
    const boss = ENCOUNTERS[runConfig(id).bossId];
    const person = boss ? personOfOpponent(boss) : undefined;
    const keeper = person ? (getLanguage() === 'en' ? person.name.en : person.name.ja) : '';
    return d ? `${keeper}（${dungeonName(d)}）` : id;
  });
}

/** せりふの {…} に入れる値（データから。数字を焼きこまない） */
export function eventParams(save: SaveData): Record<string, string> {
  const missing = missingKeepers(save);
  const first = DUNGEONS.find((d) => d.id === RANK_BOSS_DUNGEONS.E[0]);
  return {
    nextMonth: month(nextOfficialMonth(save.calendar.month)),
    firstDungeon: first ? dungeonName(first) : '',
    missingLine: missing.length > 0 ? t('storyEvent.missing', { list: missing.join(getLanguage() === 'en' ? ', ' : '・') }) : t('storyEvent.missingNone'),
    gachaPrice: t('common.coins', { n: GACHA.price }),
  };
}

/** せりふの文（いまの言語・{…} を入れる） */
export function eventText(text: MessageEntry, save: SaveData): string {
  const raw = getLanguage() === 'en' ? text.en : text.ja;
  const params = eventParams(save);
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? `{${k}}`);
}

/**
 * 見せるカードの ID（特別な指定を、いまのセーブで決める）。持っていないカードは owned・reward では出さない（間違って「持っている」と見せない）。
 * 絵が無い・見つからないカードは画面の側で飛ばす
 */
export function resolveCards(save: SaveData, show: CardShow): string[] {
  const owned = (id: string): boolean => (save.collection[id] ?? 0) > 0;
  const expand = (ref: CardRef): string[] => {
    if (ref === 'boxMonsters') return [...(BOOSTERS.find((b) => b.key === save.story.introV2.selectedBoosterKey)?.monsters ?? [])];
    if (ref === 'deckMonsters') return [...save.deck.monsters];
    if (ref === 'firstOwned') return save.deck.monsters.slice(0, 1);
    if (ref === 'ownedSkill') {
      const mon = save.deck.monsters.find((m) => skillsOf(m).some((k) => owned(k.id)));
      const skill = mon ? skillsOf(mon).find((k) => owned(k.id)) : undefined;
      return skill ? [skill.id] : [];
    }
    return [ref];
  };
  const ids = show.cards.flatMap(expand).filter((id) => {
    try {
      getMonster(id);
      return true;
    } catch {
      return id.startsWith('skl-');
    }
  });
  return show.mode === 'preview_only' ? ids : ids.filter(owned);
}

/** 確かめ用の入口（?qa=1&lab=events）の並び：章と順番 */
export function storyEventsInOrder(): StoryEventDefinition[] {
  return [...STORY_EVENTS].sort((a, b) => a.chapter - b.chapter || a.order - b.order);
}

export { getStoryEvent };


/**
 * 目標の帯（2026-11-02 指示書 AT M03「風の渓谷を探検しよう」。目標の表示だけで、ゲームの決まりは変えない）。
 * M03 を見たあと、風の渓谷の守り手にまだ勝っていない E ランクのあいだ
 */
export function storyEventGoal(save: SaveData): MessageEntry | null {
  if (!hasSeenStoryEvent(save, 'M03') || save.rank !== 'E' || beaten(save, 'dungeon-08')) return null;
  return { ja: '目標：風の渓谷を探検しよう', en: 'Goal: Explore the Wind Valley' };
}

/** 季節が変わったか（O11。前の月と今の月の季節がちがえば今の季節） */
export function changedSeason(prevMonth: number, nowMonth: number, seasonOfMonth: (m: number) => Season): Season | null {
  const a = seasonOfMonth(prevMonth);
  const b = seasonOfMonth(nowMonth);
  return a !== b ? b : null;
}
