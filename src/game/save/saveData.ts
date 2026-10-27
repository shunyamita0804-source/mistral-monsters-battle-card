import { cardCatalog } from '../../data/cards.ts';
import { CURRENCY, PACKS, RANK_ORDER, rankAtLeast, type RankId } from '../../data/economy.ts';
import { ITEM_IDS, ITEM_RULES, ITEMS, isItemId, type ItemId } from '../../data/items.ts';
import { getTournament, TOURNAMENTS, tournamentOpponents } from '../../data/tournaments.ts';
import { drawEntrants, PLAYER_ENTRANT, seedFromId, TOURNAMENT_ROUNDS } from '../progress/tournamentDraw.ts';
import {
  buildDeckFromCollection,
  countCards,
  createMixedTestDeck,
  createPlaceholderStarterDeck,
  createSoramoTestDeck,
  createStarterCollection,
  createStarterDeck,
  createStarterDeckFor,
  isDeckValid,
  topUpDeck,
  type Deck,
} from '../deck/deck.ts';
import { GAUUL_OLD_SKILL_IDS } from '../../data/gauul.ts';
import { LAZUCK_REMOVED_14_IDS } from '../../data/lazuck.ts';
import { MYUROL_REMOVED_14_IDS } from '../../data/myurol.ts';
import { NOBITON_REMOVED_14_IDS } from '../../data/nobiton.ts';
import { SORAMO_OLD_SKILL_IDS, SORAMO_STARTER } from '../../data/soramo.ts';
import type { IntroState } from '../../data/storyScenes.ts';
import { isIntroState, recoverIntro } from '../story/intro.ts';
import { EMPTY_PEOPLE_BOOK, normalizePeopleBook, ownedCardIds, rescuePeopleBook, type PeopleBook } from '../people/peopleBook.ts';
import { LEGACY_INTRO_V2, newIntroV2, normalizeIntroV2, type IntroV2 } from '../story/introV2.ts';
import type { StarterDeckKey } from '../../data/introV2.ts';

/**
 * セーブデータ（カード所持・通貨・パック解放・欠片・大会実績・ダンジョン進捗・デッキを一元管理）。
 *
 * - version で形式を管理し、古い形式は MIGRATIONS で順に変換する
 * - 読み込み時は normalizeSave() で型・範囲を確認し、壊れた値は既定値に戻す
 * - 変更はすべて「古いセーブを受け取り新しいセーブを返す」純粋関数で行う
 */
export const SAVE_VERSION = 18;

export type Gender = 'male' | 'female';
export type Direction = 'down' | 'up' | 'left' | 'right';

export interface Location {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly dir: Direction;
}

export interface TournamentRecord {
  /** 参加回数 */
  readonly entries: number;
  readonly wins: number;
  /** 初回優勝の景品を受け取ったか */
  readonly firstWinClaimed: boolean;
}

/** 大会の1試合の結果（出場者の ID。主人公は 'player'） */
export interface TournamentMatch {
  /** 何回目の試合か（0始まり。総当たりは何試合目、トーナメントは回戦） */
  readonly round: number;
  readonly a: string;
  readonly b: string;
  readonly winner: string;
  /** 残った自分のモンスターの数 */
  readonly aLeft: number;
  readonly bLeft: number;
  /** 相手に与えたダメージ */
  readonly aDamage: number;
  readonly bDamage: number;
}

/**
 * 進行中（または景品受け取り前）の大会（2026-10-27 指示書「大会の新しい形」で組み合わせと結果を入れた。セーブ version 18）。
 * 途中でアプリを閉じても次の試合から続けられる（試合の途中なら、その試合はやり直し）
 */
export interface ActiveTournament {
  readonly tournamentId: string;
  /** 参加ごとに一意のID。景品の二重受け取り防止に使う */
  readonly entryId: string;
  /** 次に戦う回戦（0始まり） */
  readonly round: number;
  readonly status: 'inProgress' | 'won' | 'lost';
  /** 組み合わせ・ほかの人の試合・抽選に使う seed */
  readonly seed: number;
  /** 出場者（src/game/progress/tournamentDraw.ts。総当たりは4人、トーナメントは山の順に8人） */
  readonly entrants: readonly string[];
  /** 終わった試合（主人公の試合もほかの人の試合も） */
  readonly matches: readonly TournamentMatch[];
}

/** 「シエナがいなくなった」の記録（C ランク大会を終えたとき。あとで作るイベントダンジョン「霧の廃坑」の条件） */
export const FLAG_SIENNA_LEFT = 'siennaLeft';

export interface DungeonRecord {
  /** 開けた宝箱（恒久的に1回だけ） */
  readonly openedChests: readonly string[];
  readonly bossDefeated: boolean;
  readonly clears: number;
}

/** 探索中のダンジョン（倒した敵は探索ごとに復活する） */
export interface ActiveDungeon {
  readonly dungeonId: string;
  readonly floor: number;
  readonly defeatedEnemies: readonly string[];
}

/**
 * ランダム生成のダンジョンの挑戦中の状態（2026-10-26 試作。中断して再開すると同じ階・同じ位置から）。
 * 階の形はシードから毎回同じに作り直すので、保存するのは「どこにいるか・何を見たか・何を倒した／開けたか」だけ。
 * ロジックは src/game/dungeon/run.ts
 */
export interface DungeonRun {
  readonly dungeonId: string;
  /** 挑戦のシード（階の形を作る） */
  readonly seed: number;
  /** いまの階（0＝1階） */
  readonly floor: number;
  readonly x: number;
  readonly y: number;
  readonly dir: Direction;
  /** いまの階の見たマス（'1'＝見た。左上から1行ずつ） */
  readonly explored: string;
  /** 倒したバトラー・見えない番人の ID（全部の階） */
  readonly defeated: readonly string[];
  /** 開けた宝箱の ID（全部の階） */
  readonly opened: readonly string[];
  /** この挑戦で負けた回数 */
  readonly losses: number;
  /** この挑戦で手に入れた技カード（負けて戻されたら失う） */
  readonly gained: readonly string[];
  /** 見えない番人が出てこない残りの歩数 */
  readonly cooldown: number;
  /** 見えない番人の抽選の乱数の状態 */
  readonly rng: number;
  /* ----- 道具の効き目（2026-10-27。中断して再開しても続く。src/data/items.ts・src/game/items/items.ts） ----- */
  /** たいまつを使った階（その階のあいだ見える範囲が広がる。使っていなければ null） */
  readonly torchFloor: number | null;
  /** 遺跡の地図を使った階（その階のあいだ地図に通路・部屋・階段が出る） */
  readonly mapFloor: number | null;
  /** 魔除けの香の残りの歩数（0＝効いていない） */
  readonly incenseSteps: number;
  /** 身代わりのお守りを身につけている */
  readonly charm: boolean;
  /** この挑戦でお守りを使った（1回の挑戦で1個まで） */
  readonly charmUsed: boolean;
  /** 幸運のコインが効いている（次に勝ったとき、報酬を候補から選べる） */
  readonly luckyCoin: boolean;
  /** 幸運のコインで、選ぶのを待っている報酬の候補（対戦から戻ったら選ぶ。選ぶまでは null 以外） */
  readonly rewardChoice: readonly string[] | null;
  /** この挑戦で封印の小箱を使った（1回の挑戦で1個まで） */
  readonly sealBoxUsed: boolean;
  /** 封印の小箱で守った技カード（追い出されても失わない1枚） */
  readonly sealedCard: string | null;
}

/** 挑戦を始めたときの道具の効き目（どれも効いていない） */
export const NO_RUN_EFFECTS = {
  torchFloor: null,
  mapFloor: null,
  incenseSteps: 0,
  charm: false,
  charmUsed: false,
  luckyCoin: false,
  rewardChoice: null,
  sealBoxUsed: false,
  sealedCard: null,
} as const satisfies Partial<DungeonRun>;

export interface SaveData {
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly player: { readonly gender: Gender | null };
  readonly coins: number;
  readonly collection: Readonly<Record<string, number>>;
  readonly deck: Deck;
  readonly rank: RankId;
  readonly unlockedPacks: readonly string[];
  readonly tournaments: Readonly<Record<string, TournamentRecord>>;
  readonly activeTournament: ActiveTournament | null;
  /** 景品を受け取り済みの大会参加ID（二重受け取り防止） */
  readonly claimedEntries: readonly string[];
  readonly dungeons: Readonly<Record<string, DungeonRecord>>;
  readonly activeDungeon: ActiveDungeon | null;
  /** ランダム生成のダンジョンの挑戦中の状態（挑戦していなければ null） */
  readonly dungeonRun: DungeonRun | null;
  /** 集めた欠片ID */
  readonly fragments: readonly string[];
  /** 隠しモンスターを特別復元したか */
  readonly hiddenRestored: boolean;
  /** 持っている道具の数（道具 ID → 個数。0個は書かない。src/data/items.ts） */
  readonly items: Readonly<Partial<Record<ItemId, number>>>;
  /** ショップに並ぶようになった道具（最初から並ぶものも含む） */
  readonly unlockedItems: readonly ItemId[];
  /** ショップで「NEW」を見た道具（最初に見たときだけ NEW の印） */
  readonly seenItems: readonly ItemId[];
  readonly location: Location;
  /** 処理済みの購入・受け取りID（二重決済・二重タップ防止。新しい順に最大 TRANSACTION_LOG_SIZE 件） */
  readonly processedTransactions: readonly string[];
  readonly stats: {
    readonly battlesWon: number;
    readonly battlesLost: number;
    readonly packsOpened: number;
  };
  /** 名刺図鑑（会った人・対戦成績・もらったカード。src/game/people/peopleBook.ts） */
  readonly peopleBook: PeopleBook;
  /** カード図鑑の詳しい画面で見たカード（持っていてここに無いカードに NEW の印） */
  readonly cardsSeen: readonly string[];
  /** 物語の記録（一度立てたら消えない。FLAG_SIENNA_LEFT など） */
  readonly storyFlags: readonly string[];
  /** 物語の進み具合（序盤イベント。src/game/story/intro.ts） */
  readonly story: {
    readonly intro: IntroState;
    /** 導入イベントV2「プロのカードバトラーになる試験」（2026-10-27。src/game/story/introV2.ts） */
    readonly introV2: IntroV2;
  };
}

export const TRANSACTION_LOG_SIZE = 100;

/** 街の決まった位置：主人公の家の前（正式な絵の街。マスは設計図の 32px） */
export const DEFAULT_LOCATION: Location = { mapId: 'town', x: 80, y: 100, dir: 'down' };

/** 新しく始めたときの位置：自分の家の中（家から街に出ると、となりの家の女性が声をかける） */
export const NEW_GAME_LOCATION: Location = { mapId: 'home', x: 12, y: 14, dir: 'down' };

/**
 * 新しいセーブ。starter（導入イベントV2で選んだ初期デッキ）を渡すと、そのデッキ（仮の60枚）で始める。
 * 前の序盤イベント（となりの家の女性の誘い）は使わないので completed にする（導入イベントV2に置き換え）
 */
export function createNewSave(now: Date = new Date(), starter: StarterDeckKey | null = null): SaveData {
  const iso = now.toISOString();
  const deck = starter ? createStarterDeckFor(starter) : createStarterDeck();
  return {
    version: SAVE_VERSION,
    createdAt: iso,
    updatedAt: iso,
    player: { gender: null },
    coins: CURRENCY.initial,
    collection: createStarterCollection(deck),
    deck,
    rank: 'E',
    unlockedPacks: PACKS.filter((p) => p.unlockedFromStart).map((p) => p.id),
    tournaments: {},
    activeTournament: null,
    claimedEntries: [],
    dungeons: {},
    activeDungeon: null,
    dungeonRun: null,
    fragments: [],
    hiddenRestored: false,
    items: {},
    unlockedItems: ITEMS.filter((i) => i.unlockedFromStart).map((i) => i.id),
    seenItems: [],
    location: NEW_GAME_LOCATION,
    processedTransactions: [],
    stats: { battlesWon: 0, battlesLost: 0, packsOpened: 0 },
    peopleBook: EMPTY_PEOPLE_BOOK,
    storyFlags: [],
    // 初めから持っているカードは NEW にしない
    cardsSeen: ownedCardIds(createStarterCollection(deck)),
    story: { intro: 'completed', introV2: newIntroV2(starter) },
  };
}

/* ---------- 形式の変換（マイグレーション） ---------- */

type RawObject = Record<string, unknown>;

/**
 * version 1 → 2（2026-10-22）：同じカードの上限が4枚→3枚になり、スターターデッキも変わった。
 * 4枚入りのデッキのままだと大会・ダンジョンに出られなくなるので、1回だけ次のことをする（version で1回だけ）。
 * - 新しいスターターデッキのカードで足りない分を所持カードに足す（上限変更の補填）
 * - デッキが新しいルールで使えなければ、同じモンスター3体で所持カードから組み直す。それでも無理ならスターターデッキにする
 */
function migrateDeckRulesV2(raw: RawObject): RawObject {
  const collection: Record<string, number> = isObject(raw.collection) ? { ...(raw.collection as Record<string, number>) } : {};
  // 当時のスターター（仮モンスターA〜C）のまま補填する（2026-10-23 にスターターがソラモになっても、この変換の意味は変えない）
  for (const [id, count] of Object.entries(countCards(createPlaceholderStarterDeck().skills))) {
    const owned = typeof collection[id] === 'number' ? collection[id] : 0;
    collection[id] = Math.max(owned, count);
  }
  const old = isObject(raw.deck) ? raw.deck : {};
  const deck: Deck = { monsters: asStringArray(old.monsters), skills: asStringArray(old.skills) };
  let next: Deck = deck;
  if (!isDeckValid(deck, collection)) {
    const rebuilt = buildDeckFromCollection(deck.monsters, collection);
    next = isDeckValid(rebuilt, collection) ? rebuilt : createPlaceholderStarterDeck();
  }
  return { ...raw, collection, deck: next };
}

/**
 * version 2 → 3（2026-10-22）：物語の進み具合（序盤イベント）を足した。
 * すでに遊んでいる人に導入の会話を突然始めないよう、「あとで」を選んだのと同じ状態にする（話しかければ誘い直す）。
 */
function migrateStoryV3(raw: RawObject): RawObject {
  return { ...raw, story: { intro: 'deferred' } };
}

/**
 * version 3 → 4（2026-10-22）：街と部屋を正式な絵に作り直し、マス目の大きさと座標が変わった。
 * 古い街・部屋の座標は新しい地図では壁の中になりうるので、街か部屋にいたら主人公の家の前に移す（ダンジョンはそのまま）。
 */
const OLD_WALK_MAPS: readonly string[] = ['town', 'home', 'shop', 'hall', 'practice'];
function migrateWorldV4(raw: RawObject): RawObject {
  const loc = raw.location;
  if (isObject(loc) && typeof loc.mapId === 'string' && OLD_WALK_MAPS.includes(loc.mapId)) {
    return { ...raw, location: { ...DEFAULT_LOCATION } };
  }
  return raw;
}

/**
 * version 4 → 5（2026-10-22）：街を詰めて作り直し（4800 → 4032）、街の座標が変わった。
 * 街にいたら主人公の家の前に移す（部屋・ダンジョンの座標は変わっていないのでそのまま）。
 */
function migrateTownV5(raw: RawObject): RawObject {
  const loc = raw.location;
  if (isObject(loc) && loc.mapId === 'town') return { ...raw, location: { ...DEFAULT_LOCATION } };
  return raw;
}

/**
 * version 5 → 6（2026-10-23）：ユーザー指示「技の発動を見るため、仮のカードはすべてソラモに」。
 * 1回だけ、テスト用のソラモのデッキ（createSoramoTestDeck）に入っているカードを所持カードに足し（足りない分だけ）、デッキをそれに替える。
 * それまでの所持カード（仮カード）は消さない。デッキ編集で、前の仮カードのデッキに組み直すこともできる
 */
function migrateSoramoTestV6(raw: RawObject): RawObject {
  const collection: Record<string, number> = isObject(raw.collection) ? { ...(raw.collection as Record<string, number>) } : {};
  const deck = createSoramoTestDeck();
  for (const [id, count] of Object.entries(countCards([...deck.monsters, ...deck.skills]))) {
    const owned = typeof collection[id] === 'number' ? collection[id] : 0;
    collection[id] = Math.max(owned, count);
  }
  return { ...raw, collection, deck };
}

/** 同じカードが同じ枚数ずつ入っているか（並び順は問わない） */
function sameCards(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const ca = countCards(a);
  const cb = countCards(b);
  return Object.keys(ca).length === Object.keys(cb).length && Object.entries(ca).every(([id, n]) => cb[id] === n);
}

/**
 * version 6 → 7（2026-10-23）：ユーザー指示「仮置きで、ソラモしかいない所にラズックも出して」。
 * 1回だけ、テスト用のソラモとラズックのデッキ（createMixedTestDeck）に入っているカードを所持カードに足す（足りない分だけ）。
 * デッキは、version 6 で配ったソラモのデッキのまま（自分で組み直していない）ときだけ、新しいデッキに替える。組み直したデッキはそのまま
 */
function migrateLazuckTestV7(raw: RawObject): RawObject {
  const collection: Record<string, number> = isObject(raw.collection) ? { ...(raw.collection as Record<string, number>) } : {};
  const mixed = createMixedTestDeck();
  for (const [id, count] of Object.entries(countCards([...mixed.monsters, ...mixed.skills]))) {
    const owned = typeof collection[id] === 'number' ? collection[id] : 0;
    collection[id] = Math.max(owned, count);
  }
  const old = createSoramoTestDeck();
  const deck = raw.deck;
  const untouched =
    isObject(deck) &&
    Array.isArray(deck.monsters) &&
    Array.isArray(deck.skills) &&
    sameCards(deck.monsters as string[], old.monsters) &&
    sameCards(deck.skills as string[], old.skills);
  return untouched ? { ...raw, collection, deck: mixed } : { ...raw, collection };
}

/**
 * ゲームから削除したカードの ID（2026-10-24：ラズックの旧13 クロスガード。ユーザー決定「クロスガードはゲームから削除」）。
 * 古いセーブ・バックアップに残っていても、読み込み時の変換（migrateRemoveCrossGuardV8）で外すので、バックアップの読み込みでは止めない
 */
const CROSS_GUARD_IDS: readonly string[] = ['skl-lazuck-13'];
/** ゲームから削除したカードすべて（クロスガード・旧ソラモの16技・旧ガウルの16技）。バックアップの読み込みでは止めない */
export const REMOVED_CARD_IDS: readonly string[] = [
  ...CROSS_GUARD_IDS,
  ...SORAMO_OLD_SKILL_IDS,
  ...GAUUL_OLD_SKILL_IDS,
  ...LAZUCK_REMOVED_14_IDS,
  ...NOBITON_REMOVED_14_IDS,
  ...MYUROL_REMOVED_14_IDS,
];

/**
 * version 7 → 8（2026-10-24）：クロスガード（skl-lazuck-13）をゲームから削除した。
 * 所持カードとデッキから外し、デッキの抜けた分は持っているカードで埋める（足りなければ足りないまま。デッキ編集で直せる）。
 * 代わりのカードは配らない
 */
function migrateRemoveCrossGuardV8(raw: RawObject): RawObject {
  const removed = new Set(CROSS_GUARD_IDS);
  const collection: Record<string, number> = isObject(raw.collection) ? { ...(raw.collection as Record<string, number>) } : {};
  for (const id of removed) delete collection[id];
  const deck = raw.deck;
  if (!isObject(deck) || !Array.isArray(deck.skills) || !Array.isArray(deck.monsters)) return { ...raw, collection };
  const skills = (deck.skills as unknown[]).filter((id) => !(typeof id === 'string' && removed.has(id)));
  if (skills.length === deck.skills.length) return { ...raw, collection };
  const counts = Object.fromEntries(Object.entries(collection).filter(([, n]) => typeof n === 'number')) as Record<string, number>;
  const filled = topUpDeck({ monsters: deck.monsters as string[], skills: skills as string[] }, counts);
  return { ...raw, collection, deck: { ...deck, skills: filled.skills } };
}

/**
 * version 8 → 9（2026-10-25）：ソラモの技を新しい14技に替えた。旧16技（skl-soramo-01〜16）はユーザー決定「削除」で、所持カードとデッキから外す。
 * 代わりに、新しく始めたときと同じソラモの初期配布16枚（SORAMO_STARTER）を持たせる（足りない分だけ）。
 * デッキ：配られたままのデッキ（version 7 の仮のデッキ）なら新しい初期デッキに替え、その分のカードも持たせる。
 * 自分で組み直したデッキは、旧ソラモの技を外した残りに、持っているカードで埋める（足りなければ足りないまま。デッキ編集で直せる）
 */
function migrateSoramo14V9(raw: RawObject): RawObject {
  const removed = new Set(SORAMO_OLD_SKILL_IDS);
  const collection: Record<string, number> = isObject(raw.collection) ? { ...(raw.collection as Record<string, number>) } : {};
  for (const id of removed) delete collection[id];
  const grant = (counts: Record<string, number>): void => {
    for (const [id, n] of Object.entries(counts)) collection[id] = Math.max(typeof collection[id] === 'number' ? collection[id] : 0, n);
  };
  grant(Object.fromEntries(SORAMO_STARTER.map((s) => [s.id, s.copies])));
  const deck = raw.deck;
  if (!isObject(deck) || !Array.isArray(deck.skills) || !Array.isArray(deck.monsters)) return { ...raw, collection };
  const old = createMixedTestDeck();
  if (sameCards(deck.monsters as string[], old.monsters) && sameCards(deck.skills as string[], old.skills)) {
    const starter = createStarterDeck();
    grant(countCards([...starter.monsters, ...starter.skills]));
    return { ...raw, collection, deck: starter };
  }
  const skills = (deck.skills as unknown[]).filter((id) => !(typeof id === 'string' && removed.has(id)));
  if (skills.length === deck.skills.length) return { ...raw, collection };
  const counts = Object.fromEntries(Object.entries(collection).filter(([, n]) => typeof n === 'number')) as Record<string, number>;
  const filled = topUpDeck({ monsters: deck.monsters as string[], skills: skills as string[] }, counts);
  return { ...raw, collection, deck: { ...deck, skills: filled.skills } };
}

/**
 * version 9 → 10（2026-10-26）：ガウルの技を新しい14技に替えた。旧16技（skl-gauul-01〜16）は所持カードとデッキから外す。
 * 代わりのカードは配らない（当時はガウルの初期配布をゲームに入れていなかった。2026-10-26 確定の16枚は新しく始めたときだけ）。デッキの抜けた分は持っているカードで埋める（足りなければ足りないまま。デッキ編集で直せる）
 */
function migrateGaul14V10(raw: RawObject): RawObject {
  const removed = new Set(GAUUL_OLD_SKILL_IDS);
  const collection: Record<string, number> = isObject(raw.collection) ? { ...(raw.collection as Record<string, number>) } : {};
  for (const id of removed) delete collection[id];
  const deck = raw.deck;
  if (!isObject(deck) || !Array.isArray(deck.skills) || !Array.isArray(deck.monsters)) return { ...raw, collection };
  const skills = (deck.skills as unknown[]).filter((id) => !(typeof id === 'string' && removed.has(id)));
  if (skills.length === deck.skills.length) return { ...raw, collection };
  const counts = Object.fromEntries(Object.entries(collection).filter(([, n]) => typeof n === 'number')) as Record<string, number>;
  const filled = topUpDeck({ monsters: deck.monsters as string[], skills: skills as string[] }, counts);
  return { ...raw, collection, deck: { ...deck, skills: filled.skills } };
}

/**
 * version 10 → 11（2026-10-26）：ラズックの技を正式14技にした。正式14技の外になった旧05 しっぽアタック（skl-lazuck-05）・
 * 旧16 ミラージュダッシュ（skl-lazuck-16）は所持カードとデッキから外す。ほかの13技は ID が同じなので、持っている枚数はそのまま。
 * 代わりのカードは配らない（依頼に指定がないため）。デッキの抜けた分は持っているカードで埋める（足りなければ足りないまま。デッキ編集で直せる）
 */
function migrateLazuck14V11(raw: RawObject): RawObject {
  return removeCardsFromSave(raw, LAZUCK_REMOVED_14_IDS);
}

/** 所持カードとデッキから、ゲームから外したカードを除く。デッキの抜けた分は持っているカードで埋める（足りなければ足りないまま） */
function removeCardsFromSave(raw: RawObject, ids: readonly string[]): RawObject {
  const removed = new Set(ids);
  const collection: Record<string, number> = isObject(raw.collection) ? { ...(raw.collection as Record<string, number>) } : {};
  for (const id of removed) delete collection[id];
  const deck = raw.deck;
  if (!isObject(deck) || !Array.isArray(deck.skills) || !Array.isArray(deck.monsters)) return { ...raw, collection };
  const skills = (deck.skills as unknown[]).filter((id) => !(typeof id === 'string' && removed.has(id)));
  if (skills.length === deck.skills.length) return { ...raw, collection };
  const counts = Object.fromEntries(Object.entries(collection).filter(([, n]) => typeof n === 'number')) as Record<string, number>;
  const filled = topUpDeck({ monsters: deck.monsters as string[], skills: skills as string[] }, counts);
  return { ...raw, collection, deck: { ...deck, skills: filled.skills } };
}

/**
 * version 11 → 12（2026-10-26）：ノビトンの技を正式14技にした。正式14技の外になった旧11 サイコガード（skl-nobiton-11）・
 * 旧14 ねばりガード（skl-nobiton-14）は所持カードとデッキから外す。ほかの12技は ID が同じなので、持っている枚数はそのまま。
 * 初期配布16枚は新しく始めたときだけ（ユーザー指示「既存ユーザーへの再配布や所持カードの上書きは、明示的な移行仕様がない限り行わない」）
 */
function migrateNobiton14V12(raw: RawObject): RawObject {
  return removeCardsFromSave(raw, NOBITON_REMOVED_14_IDS);
}

/** version 12 → 13（2026-10-26）：ランダム生成のダンジョンの挑戦中の状態（dungeonRun）を足した。いままでのセーブは挑戦していない */
function migrateDungeonRunV13(raw: RawObject): RawObject {
  return { ...raw, dungeonRun: null };
}

/**
 * version 13 → 14（2026-10-27）：ミュロルの技を正式14技にした。正式14技の外になった旧12 ぬるぬるガード（skl-myurol-12）・
 * 旧13 ぷるぷるガード（skl-myurol-13）は所持カードとデッキから外す（ノビトン・ラズックと同じ方針）。ほかの12技は ID が同じなので、持っている枚数はそのまま。
 * 初期配布16枚は新しく始めたときだけ（いまのセーブには配らない）
 */
function migrateMyurol14V14(raw: RawObject): RawObject {
  return removeCardsFromSave(raw, MYUROL_REMOVED_14_IDS);
}

/**
 * version 14 → 15（2026-10-27）：導入イベントV2「プロのカードバトラーになる試験」を足した。
 * いままでのセーブには突然始めないよう legacySkipped にする（カード・大会の記録はそのまま）
 */
function migrateIntroV2V15(raw: RawObject): RawObject {
  const story = isObject(raw.story) ? raw.story : {};
  return { ...raw, story: { ...story, introV2: LEGACY_INTRO_V2 } };
}

/**
 * version 15 → 16（2026-10-27）：名刺図鑑とカード図鑑の NEW を足した。
 * 大会の記録から、対戦したはずの相手の名刺を登録する（街の人は話したか分からないので未登録）。いま持っているカードは見たことにする（NEW にしない）
 */
function migratePeopleBookV16(raw: RawObject): RawObject {
  const collection = isObject(raw.collection) ? (raw.collection as Record<string, number>) : {};
  return { ...raw, peopleBook: rescuePeopleBook(raw), cardsSeen: ownedCardIds(collection) };
}

/**
 * version 16 → 17（2026-10-27）：ダンジョンの道具を足した。いままでのセーブは道具0個。
 * ショップに並ぶ道具は、読み込むときに大会の初優勝の記録から決める（normalizeSave の unlockedItemsFor）。挑戦中の効き目はどれも無し
 */
function migrateItemsV17(raw: RawObject): RawObject {
  const run = isObject(raw.dungeonRun) ? { ...raw.dungeonRun, ...NO_RUN_EFFECTS } : raw.dungeonRun;
  return { ...raw, items: {}, unlockedItems: [], seenItems: [], dungeonRun: run };
}

/**
 * v17 → v18：大会の新しい形（2026-10-27 指示書「大会の新しい形」）。物語の記録を足す。
 * 途中の大会は出場者が無いので、読み込むときにその大会の1試合目からやり直す（normalizeActiveTournament）
 */
function migrateTournamentV18(raw: RawObject): RawObject {
  return { ...raw, storyFlags: [] };
}

/** version n → n+1 の変換。形式を変えるときはここに足し、SAVE_VERSION を上げる */
const MIGRATIONS: Readonly<Record<number, (raw: RawObject) => RawObject>> = {
  1: migrateDeckRulesV2,
  2: migrateStoryV3,
  3: migrateWorldV4,
  4: migrateTownV5,
  5: migrateSoramoTestV6,
  6: migrateLazuckTestV7,
  7: migrateRemoveCrossGuardV8,
  8: migrateSoramo14V9,
  9: migrateGaul14V10,
  10: migrateLazuck14V11,
  11: migrateNobiton14V12,
  12: migrateDungeonRunV13,
  13: migrateMyurol14V14,
  14: migrateIntroV2V15,
  15: migratePeopleBookV16,
  16: migrateItemsV17,
  17: migrateTournamentV18,
};

export function migrate(raw: RawObject): RawObject | null {
  let current = raw;
  let version = typeof current.version === 'number' ? current.version : NaN;
  if (!Number.isInteger(version) || version < 1) return null;
  if (version > SAVE_VERSION) return null; // 新しいバージョンのセーブは読めない（上書きしない）
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return null;
    current = step(current);
    version += 1;
    current = { ...current, version };
  }
  return current;
}

/* ---------- 安全な読み込み ---------- */

const isObject = (v: unknown): v is RawObject => typeof v === 'object' && v !== null && !Array.isArray(v);
const asString = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);
const asBool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const asCount = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const unique = (items: readonly string[]): string[] => [...new Set(items)];

const DIRECTIONS: readonly Direction[] = ['down', 'up', 'left', 'right'];

function normalizeCollection(v: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!isObject(v)) return result;
  for (const [id, count] of Object.entries(v)) {
    const n = asCount(count);
    if (n > 0 && cardCatalog.get(id)) result[id] = n;
  }
  return result;
}

function normalizeDeck(v: unknown): Deck {
  if (!isObject(v)) return createStarterDeck();
  const known = (id: string): boolean => cardCatalog.get(id) !== undefined;
  return {
    monsters: asStringArray(v.monsters).filter(known),
    skills: asStringArray(v.skills).filter(known),
  };
}

function normalizeLocation(v: unknown): Location {
  if (!isObject(v)) return DEFAULT_LOCATION;
  const dir = DIRECTIONS.includes(v.dir as Direction) ? (v.dir as Direction) : 'down';
  const x = typeof v.x === 'number' && Number.isFinite(v.x) ? Math.round(v.x) : NaN;
  const y = typeof v.y === 'number' && Number.isFinite(v.y) ? Math.round(v.y) : NaN;
  if (typeof v.mapId !== 'string' || Number.isNaN(x) || Number.isNaN(y)) return DEFAULT_LOCATION;
  return { mapId: v.mapId, x, y, dir };
}

function normalizeTournaments(v: unknown): Record<string, TournamentRecord> {
  const result: Record<string, TournamentRecord> = {};
  if (!isObject(v)) return result;
  for (const [id, r] of Object.entries(v)) {
    if (!isObject(r)) continue;
    result[id] = {
      entries: asCount(r.entries),
      wins: asCount(r.wins),
      firstWinClaimed: asBool(r.firstWinClaimed, false),
    };
  }
  return result;
}

/**
 * 大会の途中の状態。出場者が読めない（前の形式・壊れた値）ときは、その大会の1試合目からやり直す（参加の回数はそのまま）。
 * 終わった試合も同じく、読めない試合があれば組み合わせごとやり直す
 */
function normalizeActiveTournament(v: unknown, siennaLeft: boolean): ActiveTournament | null {
  if (!isObject(v) || typeof v.tournamentId !== 'string' || typeof v.entryId !== 'string') return null;
  const tour = getTournament(v.tournamentId);
  if (!tour) return null;
  const status = v.status === 'won' || v.status === 'lost' ? v.status : 'inProgress';
  const seed = typeof v.seed === 'number' && Number.isInteger(v.seed) && v.seed >= 0 ? v.seed : seedFromId(v.entryId);
  const known = new Set([PLAYER_ENTRANT, ...tournamentOpponents(tour).map((o) => o.id)]);
  const entrants = asStringArray(v.entrants);
  const size = tour.format === 'league' ? 4 : 8;
  const entrantsOk = entrants.length === size && new Set(entrants).size === size && entrants.every((id) => known.has(id)) && entrants.includes(PLAYER_ENTRANT);
  const matches = Array.isArray(v.matches) ? v.matches.map(normalizeMatch) : [];
  const matchesOk = matches.every((m): m is TournamentMatch => m !== null && entrants.includes(m.a) && entrants.includes(m.b));
  if (!entrantsOk || !matchesOk) {
    return { tournamentId: v.tournamentId, entryId: v.entryId, round: 0, status, seed, entrants: drawEntrants(tour, seed, siennaLeft), matches: [] };
  }
  return { tournamentId: v.tournamentId, entryId: v.entryId, round: Math.min(asCount(v.round), TOURNAMENT_ROUNDS), status, seed, entrants, matches };
}

function normalizeMatch(v: unknown): TournamentMatch | null {
  if (!isObject(v) || typeof v.a !== 'string' || typeof v.b !== 'string' || (v.winner !== v.a && v.winner !== v.b)) return null;
  return {
    round: asCount(v.round),
    a: v.a,
    b: v.b,
    winner: v.winner,
    aLeft: asCount(v.aLeft),
    bLeft: asCount(v.bLeft),
    aDamage: asCount(v.aDamage),
    bDamage: asCount(v.bDamage),
  };
}

function normalizeDungeons(v: unknown): Record<string, DungeonRecord> {
  const result: Record<string, DungeonRecord> = {};
  if (!isObject(v)) return result;
  for (const [id, r] of Object.entries(v)) {
    if (!isObject(r)) continue;
    result[id] = {
      openedChests: unique(asStringArray(r.openedChests)),
      bossDefeated: asBool(r.bossDefeated, false),
      clears: asCount(r.clears),
    };
  }
  return result;
}

function normalizeActiveDungeon(v: unknown): ActiveDungeon | null {
  if (!isObject(v) || typeof v.dungeonId !== 'string') return null;
  return { dungeonId: v.dungeonId, floor: asCount(v.floor), defeatedEnemies: unique(asStringArray(v.defeatedEnemies)) };
}

function normalizeDungeonRun(v: unknown): DungeonRun | null {
  if (!isObject(v) || typeof v.dungeonId !== 'string' || typeof v.seed !== 'number' || !Number.isFinite(v.seed)) return null;
  return {
    dungeonId: v.dungeonId,
    seed: Math.floor(v.seed),
    floor: asCount(v.floor),
    x: asCount(v.x),
    y: asCount(v.y),
    dir: DIRECTIONS.includes(v.dir as Direction) ? (v.dir as Direction) : 'down',
    explored: typeof v.explored === 'string' && /^[01]*$/.test(v.explored) ? v.explored : '',
    defeated: unique(asStringArray(v.defeated)),
    opened: unique(asStringArray(v.opened)),
    losses: asCount(v.losses),
    gained: asStringArray(v.gained).filter((id) => !!cardCatalog.get(id)),
    cooldown: asCount(v.cooldown),
    rng: typeof v.rng === 'number' && Number.isFinite(v.rng) ? Math.floor(v.rng) : 1,
    torchFloor: asFloorOrNull(v.torchFloor),
    mapFloor: asFloorOrNull(v.mapFloor),
    incenseSteps: Math.min(asCount(v.incenseSteps), ITEM_RULES.incenseSteps),
    charm: asBool(v.charm, false),
    charmUsed: asBool(v.charmUsed, false) || asBool(v.charm, false),
    luckyCoin: asBool(v.luckyCoin, false),
    rewardChoice: Array.isArray(v.rewardChoice) ? asStringArray(v.rewardChoice).filter((id) => !!cardCatalog.get(id)) : null,
    sealBoxUsed: asBool(v.sealBoxUsed, false) || typeof v.sealedCard === 'string',
    sealedCard: typeof v.sealedCard === 'string' && cardCatalog.get(v.sealedCard) ? v.sealedCard : null,
  };
}

const asFloorOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);

function normalizeItems(v: unknown): Partial<Record<ItemId, number>> {
  const result: Partial<Record<ItemId, number>> = {};
  if (!isObject(v)) return result;
  for (const [id, count] of Object.entries(v)) {
    const n = Math.min(asCount(count), ITEM_RULES.maxOwned);
    if (n > 0 && isItemId(id)) result[id] = n;
  }
  return result;
}

/**
 * ショップに並ぶ道具：最初から並ぶもの＋大会の初優勝で並ぶもの。初優勝は記録（firstWinClaimed）か、
 * その景品のランクに上がっていること（2026-10-27 指示「すでにDランク以上のセーブでも、読み込んだときに条件どおり解放」）で見る
 */
export function unlockedItemsFor(save: Pick<SaveData, 'rank' | 'tournaments' | 'unlockedItems'>): ItemId[] {
  const ids = new Set<ItemId>([...ITEMS.filter((i) => i.unlockedFromStart).map((i) => i.id), ...save.unlockedItems]);
  for (const tour of TOURNAMENTS) {
    const won = save.tournaments[tour.id]?.firstWinClaimed === true;
    const rankUp = tour.rewards.firstWin.rankUp;
    if (won || (rankUp !== null && rankAtLeast(save.rank, rankUp))) for (const id of tour.rewards.firstWin.unlockItems) ids.add(id);
  }
  return ITEM_IDS.filter((id) => ids.has(id));
}

/** 生データ（JSON.parse の結果）を検証してセーブデータにする。読めない場合は null */
export function normalizeSave(raw: unknown): SaveData | null {
  if (!isObject(raw)) return null;
  const migrated = migrate(raw);
  if (!migrated) return null;
  const base = createNewSave();
  const player = isObject(migrated.player) ? migrated.player : {};
  const stats = isObject(migrated.stats) ? migrated.stats : {};
  const story = isObject(migrated.story) ? migrated.story : {};
  const rank = RANK_ORDER.includes(migrated.rank as RankId) ? (migrated.rank as RankId) : 'E';
  const startPacks = PACKS.filter((p) => p.unlockedFromStart).map((p) => p.id);
  const tournaments = normalizeTournaments(migrated.tournaments);
  const itemIds = (v: unknown): ItemId[] => unique(asStringArray(v)).filter(isItemId);
  return {
    version: SAVE_VERSION,
    createdAt: asString(migrated.createdAt, base.createdAt),
    updatedAt: asString(migrated.updatedAt, base.updatedAt),
    player: { gender: player.gender === 'male' || player.gender === 'female' ? player.gender : null },
    coins: asCount(migrated.coins, base.coins),
    collection: normalizeCollection(migrated.collection),
    deck: normalizeDeck(migrated.deck),
    rank,
    unlockedPacks: unique([
      ...startPacks,
      ...asStringArray(migrated.unlockedPacks).filter((id) => PACKS.some((p) => p.id === id)),
    ]),
    tournaments,
    activeTournament: normalizeActiveTournament(migrated.activeTournament, asStringArray(migrated.storyFlags).includes(FLAG_SIENNA_LEFT)),
    claimedEntries: unique(asStringArray(migrated.claimedEntries)),
    dungeons: normalizeDungeons(migrated.dungeons),
    activeDungeon: normalizeActiveDungeon(migrated.activeDungeon),
    dungeonRun: normalizeDungeonRun(migrated.dungeonRun),
    fragments: unique(asStringArray(migrated.fragments)),
    hiddenRestored: asBool(migrated.hiddenRestored, false),
    items: normalizeItems(migrated.items),
    unlockedItems: unlockedItemsFor({ rank, tournaments, unlockedItems: itemIds(migrated.unlockedItems) }),
    seenItems: itemIds(migrated.seenItems),
    location: normalizeLocation(migrated.location),
    processedTransactions: unique(asStringArray(migrated.processedTransactions)).slice(0, TRANSACTION_LOG_SIZE),
    stats: {
      battlesWon: asCount(stats.battlesWon),
      battlesLost: asCount(stats.battlesLost),
      packsOpened: asCount(stats.packsOpened),
    },
    peopleBook: normalizePeopleBook(migrated.peopleBook),
    cardsSeen: unique(asStringArray(migrated.cardsSeen)),
    storyFlags: unique(asStringArray(migrated.storyFlags)),
    // 読めない値は「あとで」と同じ扱い（導入を突然始めない）。練習試合の最中に閉じたなら練習場に着いた状態へ
    story: { intro: isIntroState(story.intro) ? recoverIntro(story.intro) : 'deferred', introV2: normalizeIntroV2(story.introV2) },
  };
}

/* ---------- よく使う変更 ---------- */

export function touch(save: SaveData, now: Date = new Date()): SaveData {
  return { ...save, updatedAt: now.toISOString() };
}

export function addCards(save: SaveData, cards: readonly { cardId: string; count: number }[]): SaveData {
  const collection = { ...save.collection };
  for (const { cardId, count } of cards) {
    if (count <= 0) continue;
    collection[cardId] = (collection[cardId] ?? 0) + count;
  }
  return { ...save, collection };
}

export function addCoins(save: SaveData, amount: number): SaveData {
  return { ...save, coins: Math.max(0, save.coins + amount) };
}

export function hasProcessed(save: SaveData, transactionId: string): boolean {
  return save.processedTransactions.includes(transactionId);
}

export function markProcessed(save: SaveData, transactionId: string): SaveData {
  return {
    ...save,
    processedTransactions: [transactionId, ...save.processedTransactions.filter((t) => t !== transactionId)].slice(
      0,
      TRANSACTION_LOG_SIZE,
    ),
  };
}

export function unlockPacks(save: SaveData, packIds: readonly string[]): SaveData {
  return { ...save, unlockedPacks: unique([...save.unlockedPacks, ...packIds]) };
}
