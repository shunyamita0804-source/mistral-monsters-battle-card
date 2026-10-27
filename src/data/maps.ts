import type { Direction } from '../game/save/saveData.ts';
import { BUREAU_MAP_ID } from './introV2.ts';
import type { CardReward } from './tournaments.ts';
import { WORLD_ART, type ArtMap, type CellRect } from './worldArt.generated.ts';

/**
 * 歩行用マップ（街・部屋・ダンジョン）。
 *
 * - 街と部屋（家・となりの家・民家・カードショップ・カード研究所・大会会場・カード練習場）は、ユーザー承認済みの正式な絵を
 *   設計図どおりに並べたもの（tools/design/seimon_world_build.py が worldArt.generated.ts を作る）。マスは設計図の 32px
 * - ダンジョンは【仮マップ】のまま（正式な絵が無い）。地形を記号で表して描く
 *
 * 記号（TILE_INFO）：# 壁 / . 床 / , 草 / = 道 / T 木 / ~ 水 / H 大会会場 / A 家 / B ショップ / P カード練習場 / N となりの家
 *                  D 入口 / d 出口 / G ダンジョン入口
 *                  F 噴水 / S 下り階段 / U 上り階段・出口 / b ベッド / M 壁の地図 / h 本棚 / k 机 / s 棚・客席
 *                  c カウンター / n 人 / g ガチャマシン / x 対戦テーブル / r じゅうたん
 */
export interface TileInfo {
  readonly solid: boolean;
  readonly name: string;
}

export const TILE_INFO: Readonly<Record<string, TileInfo>> = {
  '#': { solid: true, name: '壁' },
  '.': { solid: false, name: '床' },
  ',': { solid: false, name: '草' },
  '=': { solid: false, name: '道' },
  T: { solid: true, name: '木' },
  '~': { solid: true, name: '水' },
  H: { solid: true, name: '大会会場' },
  A: { solid: true, name: '家' },
  B: { solid: true, name: 'カードショップ' },
  P: { solid: true, name: 'カード練習場' },
  N: { solid: true, name: 'となりの家' },
  D: { solid: false, name: '入口' },
  d: { solid: false, name: '出口' },
  F: { solid: true, name: '噴水' },
  S: { solid: false, name: '下り階段' },
  U: { solid: false, name: '上り階段' },
  G: { solid: false, name: 'ダンジョン入口' },
  b: { solid: true, name: 'ベッド' },
  M: { solid: true, name: '壁の地図' },
  h: { solid: true, name: '本棚' },
  k: { solid: true, name: '机' },
  s: { solid: true, name: '棚' },
  c: { solid: true, name: 'カウンター' },
  n: { solid: true, name: '人' },
  g: { solid: true, name: 'ガチャマシン' },
  x: { solid: true, name: '対戦テーブル' },
  r: { solid: false, name: 'じゅうたん' },
};

export type InteractAction =
  | 'deck'
  | 'dungeonSelect'
  | 'collection'
  | 'settings'
  | 'shopClerk'
  | 'gacha'
  | 'tournamentDesk'
  /** 名刺図鑑（家の本棚。2026-10-27） */
  | 'peopleBook'
  /** カード練習場の練習テーブル（練習試合） */
  | 'practiceTable'
  /** 【仮】カードバトラー管理局の受付（導入イベントV2。src/game/story/introV2.ts） */
  | 'bureauDesk'
  | 'message';

export type WarpTarget =
  | { readonly kind: 'map'; readonly mapId: string; readonly x: number; readonly y: number; readonly dir: Direction }
  | { readonly kind: 'floor'; readonly delta: 1 | -1 }
  | { readonly kind: 'leaveDungeon' }
  /** ダンジョン選択画面を開く（街のダンジョン入口） */
  | { readonly kind: 'dungeonGate' };

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface InteractObject extends Rect {
  readonly type: 'interact';
  readonly id: string;
  readonly label: string;
  readonly action: InteractAction;
  readonly message?: string;
}

export interface WarpObject extends Rect {
  readonly type: 'warp';
  readonly id: string;
  readonly label: string;
  readonly target: WarpTarget;
}

export interface EnemyObject {
  readonly type: 'enemy';
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly encounterId: string;
  readonly boss: boolean;
}

export interface ChestObject {
  readonly type: 'chest';
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly reward: { readonly coins: number; readonly cards: readonly CardReward[] };
  /** 宝箱の見た目（ミスモンの宝箱の絵：wood＝木・iron＝鉄・gold＝金）。中身とは関係ない（仮の割り当て） */
  readonly look: 'wood' | 'iron' | 'gold';
}

/** 街の住人（民家A〜E にいる人。話しかけると短い会話。台詞は仮） */
export type ResidentId = 'resident_a' | 'resident_b' | 'resident_c' | 'resident_d' | 'resident_e';
export const RESIDENT_IDS: readonly ResidentId[] = ['resident_a', 'resident_b', 'resident_c', 'resident_d', 'resident_e'];
export const isResidentId = (id: string): id is ResidentId => (RESIDENT_IDS as readonly string[]).includes(id);

/** 人物（会話の名前・歩行の絵の参照に使う） */
export type NpcId = 'neighbor_guide' | 'clerk' | 'researcher' | 'receptionist' | 'teacher' | ResidentId;

/**
 * 人（NPC）。足元の1マスが歩けない。絵は人物ごとの歩行の絵（worldScreen.ts）。
 * 案内役の表示・会話は物語の進み具合で決まる（src/game/story/）。
 * 店員・研究員・受付・先生は action があり、話しかけるとカウンターなどを調べたときと同じ画面を開く
 */
export interface NpcObject extends Rect {
  readonly type: 'npc';
  readonly id: string;
  readonly npcId: NpcId;
  readonly action?: InteractAction;
  /** 絵だけを縦にずらすマスの数（負＝奥へ）。カウンターの後ろに立つ店員のように、話しかけるマスと見た目の立ち位置が違うとき */
  readonly drawDy?: number;
}

export type MapObject = InteractObject | WarpObject | EnemyObject | ChestObject | NpcObject;

export interface MapDefinition {
  readonly id: string;
  readonly name: string;
  readonly area: 'town' | 'interior' | 'dungeon';
  readonly tiles: readonly string[];
  readonly objects: readonly MapObject[];
  /** 既定の出現位置 */
  readonly spawn: { readonly x: number; readonly y: number; readonly dir: Direction };
  /** 階段を上って戻ってきたときの出現位置（ダンジョンのみ） */
  readonly upArrival?: { readonly x: number; readonly y: number; readonly dir: Direction };
  /** 正式な絵（街・部屋）。あれば背景・家具の絵を敷く。無ければ記号のマスで描く（ダンジョン：仮） */
  readonly art?: ArtMap;
}

const interact = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  action: InteractAction,
  message?: string,
): InteractObject => ({ type: 'interact', id, x, y, w, h, label, action, ...(message ? { message } : {}) });

const warp = (id: string, x: number, y: number, w: number, label: string, target: WarpTarget): WarpObject => ({
  type: 'warp',
  id,
  x,
  y,
  w,
  h: 1,
  label,
  target,
});

const enemy = (id: string, x: number, y: number, encounterId: string, boss = false): EnemyObject => ({
  type: 'enemy',
  id,
  x,
  y,
  encounterId,
  boss,
});

const npc = (id: string, x: number, y: number, npcId: NpcId, action?: InteractAction, drawDy?: number): NpcObject => ({
  type: 'npc',
  id,
  x,
  y,
  w: 1,
  h: 1,
  npcId,
  ...(action ? { action } : {}),
  ...(drawDy ? { drawDy } : {}),
});

const chest = (
  id: string,
  x: number,
  y: number,
  coins: number,
  cards: readonly CardReward[] = [],
  look: ChestObject['look'] = cards.length > 0 ? 'iron' : 'wood',
): ChestObject => ({
  type: 'chest',
  id,
  x,
  y,
  reward: { coins, cards },
  look,
});

/* ---------- 街・部屋（正式な絵。worldArt.generated.ts の座標を使う） ---------- */

const artOf = (id: string): ArtMap => {
  const art = WORLD_ART[id];
  if (!art) throw new Error(`worldArt: ${id}`);
  return art;
};

const doorOf = (art: ArtMap, id: string): NonNullable<ArtMap['doors']>[string] => {
  const d = art.doors?.[id];
  if (!d) throw new Error(`door: ${id}`);
  return d;
};

const itemOf = (art: ArtMap, id: string): CellRect => {
  const r = art.items?.[id];
  if (!r) throw new Error(`item: ${id}`);
  return r;
};

/** 人の立ち位置（設計図の *_SPOT の枠）の足元のマス。dx で横にずらす */
const spotOf = (art: ArtMap, id: string, dx = 0): { x: number; y: number } => {
  const r = itemOf(art, id);
  return { x: r.x + Math.floor(r.w / 2) + dx, y: r.y + r.h - 2 };
};

const interactAt = (id: string, r: CellRect, label: string, action: InteractAction, message?: string): InteractObject =>
  interact(id, r.x, r.y, r.w, r.h, label, action, message);

/** 部屋の入口（入ったときに立つ所：出入口の手前の床。奥を向く） */
const entryOf = (art: ArtMap): { x: number; y: number; dir: Direction } => ({ x: art.spawn.x, y: art.spawn.y, dir: 'up' });

const TOWN_ART = artOf('town');

/** 地図 ID → 部屋の絵 */
const ROOM_ART_OF: Readonly<Record<string, string>> = {
  home: 'player', neighbor: 'guide', shop: 'shop', lab: 'lab', hall: 'arena', practice: 'training',
  'house-a': 'house', 'house-b': 'house', 'house-c': 'house', 'house-d': 'house', 'house-e': 'house',
};

/** 街の建物（設計図の ID）→ 入る部屋 */
const TOWN_DOORS: readonly { readonly id: string; readonly building: string; readonly mapId: string; readonly label: string }[] = [
  { id: 'door-practice', building: 'TRAINING', mapId: 'practice', label: 'カード練習場' },
  { id: 'door-hall', building: 'ARENA', mapId: 'hall', label: '大会会場' },
  { id: 'door-home', building: 'PLAYER_HOME', mapId: 'home', label: '家' },
  { id: 'door-neighbor', building: 'GUIDE_HOME', mapId: 'neighbor', label: 'となりの家' },
  { id: 'door-shop', building: 'SHOP', mapId: 'shop', label: 'カードショップ' },
  { id: 'door-lab', building: 'LAB', mapId: 'lab', label: 'カード研究所' },
  { id: 'door-house-a', building: 'HOUSE_A', mapId: 'house-a', label: '民家' },
  { id: 'door-house-b', building: 'HOUSE_B', mapId: 'house-b', label: '民家' },
  { id: 'door-house-c', building: 'HOUSE_C', mapId: 'house-c', label: '民家' },
  { id: 'door-house-d', building: 'HOUSE_D', mapId: 'house-d', label: '民家' },
  { id: 'door-house-e', building: 'HOUSE_E', mapId: 'house-e', label: '民家' },
];

/** 街の上に出す施設の名前（絵には焼き込まない。表示は i18n の world.building.*）。位置は建物の絵の上端の中央（設計図の単位） */
export const TOWN_SIGNS: readonly { readonly building: string; readonly label: 'hall' | 'practice' | 'home' | 'neighbor' | 'shop' | 'lab'; readonly x: number; readonly y: number }[] = (
  [
    ['ARENA', 'hall'], ['TRAINING', 'practice'], ['PLAYER_HOME', 'home'], ['GUIDE_HOME', 'neighbor'], ['SHOP', 'shop'], ['LAB', 'lab'],
  ] as const
).map(([building, label]) => ({ building, label, ...doorOf(TOWN_ART, building).label }));

/** 建物から出たときに立つ所（玄関の前。手前を向く） */
export function townDoorFront(building: string): { x: number; y: number; dir: Direction } {
  const d = doorOf(TOWN_ART, building);
  return { x: d.back.x, y: d.back.y, dir: 'down' };
}

const exitTo = (building: string): WarpTarget => ({ kind: 'map', mapId: 'town', ...townDoorFront(building) });

/** 部屋の出口（手前の壁のすき間の一番下） */
const roomExit = (id: string, art: ArtMap, building: string): WarpObject =>
  warp(id, art.exit.x, art.exit.y, art.exit.w, '外へ', exitTo(building));

/** 部屋の背景・家具の絵を使う地図を作る */
const artMap = (
  id: string,
  name: string,
  area: MapDefinition['area'],
  art: ArtMap,
  objects: readonly MapObject[],
  spawn: MapDefinition['spawn'],
): MapDefinition => ({ id, name, area, tiles: art.grid, objects, spawn, art });

/**
 * 【仮】カードバトラー管理局の入口（街のマス）。位置は候補の中から Claude が仮に選んだもの（ユーザー承認待ち。docs/intro-v2.md）。
 * 街の中央の通りの西の行き止まり（住宅Bの南）。ほかの建物の入口・道をふさがない
 */
export const BUREAU_TOWN_DOOR = { x: 5, y: 57, w: 1 } as const;
/** 管理局から出たときに立つ所（入口のすぐ下。ほかの建物と同じく手前を向く） */
const BUREAU_TOWN_FRONT = { x: 5, y: 58, dir: 'down' } as const satisfies { x: number; y: number; dir: Direction };
/** 管理局に入ったときに立つ所（仮の部屋の入口の手前。奥を向く） */
const BUREAU_ENTRY = { x: 4, y: 7, dir: 'up' } as const satisfies { x: number; y: number; dir: Direction };

/**
 * 街。ユーザー承認済みの正式な絵（建物11棟・噴水・地面・小物）を、設計図（docs/design/seimon-town/）どおりに並べたもの。
 * 北中央＝大会会場、北西＝カード練習場・住宅A/B、北東＝住宅C/D/E、中央＝噴水広場、南西＝カードショップ・カード研究所、
 * 南東＝主人公の家ととなりの家（案内役の家）、南＝草原への出口（ダンジョン方面）。
 */
export const TOWN: MapDefinition = artMap(
  'town',
  '街',
  'town',
  TOWN_ART,
  [
    ...TOWN_DOORS.map((d) => {
      const door = doorOf(TOWN_ART, d.building);
      const room = artOf(ROOM_ART_OF[d.mapId] ?? '');
      return warp(d.id, door.x, door.y, door.w, d.label, { kind: 'map', mapId: d.mapId, ...entryOf(room) });
    }),
    // 南の土の道の端（草原の方角）。踏むと既存のダンジョン選択（家の壁の地図と同じ画面）へ
    warp('door-dungeon', TOWN_ART.exit.x, TOWN_ART.exit.y, TOWN_ART.exit.w, 'ダンジョン入口', { kind: 'dungeonGate' }),
    interactAt('sign-fountain', TOWN_ART.fountain as CellRect, '噴水', 'message', '街の中央の噴水。水の音が心地よい。'),
    // となりの家の女性（案内役）。物語の進み具合で、街か練習場のどちらかにいる。街では自分の家の前の通り
    npc('guide-town', doorOf(TOWN_ART, 'GUIDE_HOME').back.x - 4, doorOf(TOWN_ART, 'GUIDE_HOME').back.y + 6, 'neighbor_guide'),
    // 【仮】カードバトラー管理局の入口（建物の絵・位置は未定。承認までは仮の印。worldScreen.ts が札と印を描く）
    warp('door-bureau', BUREAU_TOWN_DOOR.x, BUREAU_TOWN_DOOR.y, BUREAU_TOWN_DOOR.w, 'カードバトラー管理局（仮）', { kind: 'map', mapId: BUREAU_MAP_ID, ...BUREAU_ENTRY }),
  ],
  { ...townDoorFront('PLAYER_HOME'), y: TOWN_ART.spawn.y, dir: 'down' },
);

const HOME_ART = artOf('player');
export const HOME: MapDefinition = artMap('home', '家', 'interior', HOME_ART, [
  interactAt('home-bed', itemOf(HOME_ART, 'BED'), 'ベッド', 'settings'),
  interactAt('home-map', itemOf(HOME_ART, 'WALL_MAP'), '壁の地図', 'dungeonSelect'),
  // 本棚：名刺図鑑（2026-10-27 指示書。カード図鑑は研究所）
  interactAt('home-shelf', itemOf(HOME_ART, 'BOOKSHELF'), '本棚', 'peopleBook'),
  interactAt('home-desk', itemOf(HOME_ART, 'DESK'), '机', 'deck'),
  interactAt('home-plant', itemOf(HOME_ART, 'PLANT'), '植木鉢', 'message', '元気に育っている。'),
  roomExit('home-exit', HOME_ART, 'PLAYER_HOME'),
], entryOf(HOME_ART));

const NEIGHBOR_ART = artOf('guide');
/** となりの家（案内役の家）。最初の練習試合が終わると、案内役は家に戻ってここにいる（話しかけるとまた練習できる） */
export const NEIGHBOR: MapDefinition = artMap('neighbor', 'となりの家', 'interior', NEIGHBOR_ART, [
  interactAt('neighbor-fireplace', itemOf(NEIGHBOR_ART, 'FIREPLACE'), '暖炉', 'message', '暖炉の火がぱちぱちと燃えている。'),
  interactAt('neighbor-kitchen', itemOf(NEIGHBOR_ART, 'KITCHEN'), '台所の棚', 'message', 'お茶の道具がきれいに並んでいる。'),
  interactAt('neighbor-shelf', itemOf(NEIGHBOR_ART, 'BOOKSHELF'), '本棚', 'message', 'カードの本がたくさん並んでいる。'),
  interactAt('neighbor-table', itemOf(NEIGHBOR_ART, 'TABLE'), '丸テーブル', 'message', 'テーブルの上にティーセットが置いてある。'),
  interactAt('neighbor-flower', itemOf(NEIGHBOR_ART, 'FLOWER'), '花台', 'message', 'きれいな花が飾ってある。'),
  npc('guide-home', spotOf(NEIGHBOR_ART, 'GUIDE_SPOT').x, spotOf(NEIGHBOR_ART, 'GUIDE_SPOT').y, 'neighbor_guide'),
  roomExit('neighbor-exit', NEIGHBOR_ART, 'GUIDE_HOME'),
], entryOf(NEIGHBOR_ART));

const SHOP_ART = artOf('shop');
/**
 * 店員は、話しかけるマス（カウンターの前の床の隣）より4マス奥に見せる（2026-10-27 新しい内装。カウンターの奥行きが深く、
 * 話しかけるマスに立たせるとカウンターに隠れて頭しか見えない）
 */
const SHOP_CLERK_DRAW_DY = -4;
/** カードショップ。主役はカードの購入（店員のカウンター）とカードパックの販売機（いまのガチャ。カプセルではない） */
export const SHOP: MapDefinition = artMap('shop', 'カードショップ', 'interior', SHOP_ART, [
  interactAt('shop-counter', itemOf(SHOP_ART, 'COUNTER'), 'カウンター', 'shopClerk'),
  interactAt('shop-gacha', itemOf(SHOP_ART, 'PACK_MACHINE'), 'カードパック販売機', 'gacha'),
  interactAt('shop-shelf', itemOf(SHOP_ART, 'SHELF_WALL'), '商品棚', 'message', 'カードとパックがきれいに並んでいる。'),
  interactAt('shop-case-l', itemOf(SHOP_ART, 'CASE_L'), 'ショーケース', 'message', '珍しいカードが飾ってある。'),
  interactAt('shop-case-r', itemOf(SHOP_ART, 'CASE_R'), 'ショーケース', 'message', '珍しいカードが飾ってある。'),
  npc('shop-clerk', spotOf(SHOP_ART, 'CLERK_SPOT').x, spotOf(SHOP_ART, 'CLERK_SPOT').y, 'clerk', 'shopClerk', SHOP_CLERK_DRAW_DY),
  roomExit('shop-exit', SHOP_ART, 'SHOP'),
], entryOf(SHOP_ART));

const LAB_ART = artOf('lab');
/** カード研究所。図鑑（集めたカード）への入り口。研究所だけの新しい仕組みは作らない */
export const LAB: MapDefinition = artMap('lab', 'カード研究所', 'interior', LAB_ART, [
  interactAt('lab-shelf', itemOf(LAB_ART, 'BIG_SHELF'), '図鑑の本棚', 'collection'),
  interactAt('lab-crystal', itemOf(LAB_ART, 'CRYSTAL'), '水晶の台', 'message', '水晶が静かに光っている。'),
  interactAt('lab-specimen', itemOf(LAB_ART, 'SPECIMEN'), 'カード標本ケース', 'message', 'めずらしいカードが標本のように並んでいる。'),
  interactAt('lab-desk', itemOf(LAB_ART, 'DESK'), '研究机', 'message', '研究の資料が広げてある。'),
  interactAt('lab-shelf2', itemOf(LAB_ART, 'SHELF2'), '資料棚', 'message', '資料がぎっしり詰まっている。'),
  interactAt('lab-table', itemOf(LAB_ART, 'TABLE'), '閲覧テーブル', 'message', '本を読むためのテーブル。'),
  // 研究員：設計図の立ち位置（研究机の奥）では机の絵に全身が隠れるので、机の右どなり（天球儀と標本ケースの間）に立つ
  npc('lab-researcher', spotOf(LAB_ART, 'RESEARCHER_SPOT', 9).x, spotOf(LAB_ART, 'RESEARCHER_SPOT').y, 'researcher', 'collection'),
  roomExit('lab-exit', LAB_ART, 'LAB'),
], entryOf(LAB_ART));

const HALL_ART = artOf('arena');
/** 大会会場（屋根付きのカード大会の会場。中央に対戦テーブル） */
export const HALL: MapDefinition = artMap('hall', '大会会場', 'interior', HALL_ART, [
  interactAt('hall-desk', itemOf(HALL_ART, 'RECEPTION'), '受付カウンター', 'tournamentDesk'),
  interactAt('hall-table', itemOf(HALL_ART, 'STAGE'), '対戦テーブル', 'message', '屋根付きの会場の中央にある対戦テーブル。大会の対戦はここで行われる。'),
  interactAt('hall-seats-l', itemOf(HALL_ART, 'SEATS_L'), '客席', 'message', '観客席。'),
  interactAt('hall-seats-r', itemOf(HALL_ART, 'SEATS_R'), '客席', 'message', '観客席。'),
  npc('hall-receptionist', spotOf(HALL_ART, 'RECEPTIONIST_SPOT').x, spotOf(HALL_ART, 'RECEPTIONIST_SPOT').y, 'receptionist', 'tournamentDesk'),
  roomExit('hall-exit', HALL_ART, 'ARENA'),
], entryOf(HALL_ART));

const PRACTICE_ART = artOf('training');
/** カード練習場。初心者がカードを学ぶ場所。練習テーブルで練習試合ができる */
export const PRACTICE: MapDefinition = artMap('practice', 'カード練習場', 'interior', PRACTICE_ART, [
  interactAt('practice-shelf', itemOf(PRACTICE_ART, 'SHELF'), '教材の棚', 'message', '練習用のカードがきちんと並んでいる。'),
  interactAt('practice-board', itemOf(PRACTICE_ART, 'BOARD'), '黒板', 'message', 'カードの並べ方の図が描いてある。'),
  interactAt('practice-table-1', itemOf(PRACTICE_ART, 'TABLE_1'), '練習テーブル', 'practiceTable'),
  interactAt('practice-table-2', itemOf(PRACTICE_ART, 'TABLE_2'), '練習テーブル', 'practiceTable'),
  interactAt('practice-bench-l', itemOf(PRACTICE_ART, 'BENCH_L'), 'ベンチ', 'message', '順番を待つ人のためのベンチ。'),
  interactAt('practice-bench-r', itemOf(PRACTICE_ART, 'BENCH_R'), 'ベンチ', 'message', '順番を待つ人のためのベンチ。'),
  // 先生は黒板の前。案内役は最初の練習試合が終わるまで、先生の右どなりにいる
  npc('practice-teacher', spotOf(PRACTICE_ART, 'TEACHER_SPOT').x, spotOf(PRACTICE_ART, 'TEACHER_SPOT').y, 'teacher', 'practiceTable'),
  npc('guide-practice', spotOf(PRACTICE_ART, 'TEACHER_SPOT', 5).x, spotOf(PRACTICE_ART, 'TEACHER_SPOT').y + 1, 'neighbor_guide'),
  roomExit('practice-exit', PRACTICE_ART, 'TRAINING'),
], entryOf(PRACTICE_ART));

/**
 * 【仮】カードバトラー管理局の中（仮の部屋。正式な内装・受付の人物の絵が届くまで、記号のマスで描く）。
 * 奥に受付のカウンター。入口は手前の真ん中
 */
export const BUREAU: MapDefinition = {
  id: BUREAU_MAP_ID,
  name: 'カードバトラー管理局（仮）',
  area: 'interior',
  tiles: [
    '#########',
    '#h.....h#',
    '#.ccccc.#',
    '#.......#',
    '#.......#',
    '#r.....r#',
    '#.......#',
    '#.......#',
    '####d####',
  ],
  objects: [
    interact('bureau-desk', 2, 2, 5, 1, '受付（仮）', 'bureauDesk'),
    interact('bureau-shelf-l', 1, 1, 1, 1, '書類の棚', 'message', '登録の書類が並んでいる。'),
    interact('bureau-shelf-r', 7, 1, 1, 1, '書類の棚', 'message', '登録の書類が並んでいる。'),
    warp('bureau-exit', 4, 8, 1, '外へ', { kind: 'map', mapId: 'town', ...BUREAU_TOWN_FRONT }),
  ],
  spawn: BUREAU_ENTRY,
};

const HOUSE_ART = artOf('house');
/** 民家（住宅A〜E。部屋の絵は共通）。住宅A〜E にそれぞれ住人A〜E がいる */
const house = (key: 'a' | 'b' | 'c' | 'd' | 'e'): MapDefinition =>
  artMap(`house-${key}`, '民家', 'interior', HOUSE_ART, [
    interactAt(`house-${key}-shelf`, itemOf(HOUSE_ART, 'SHELF'), '棚', 'message', '食器がきちんと並んでいる。'),
    interactAt(`house-${key}-table`, itemOf(HOUSE_ART, 'TABLE'), 'テーブル', 'message', 'テーブルクロスがかかっている。'),
    npc(`house-${key}-resident`, spotOf(HOUSE_ART, 'RESIDENT_SPOT').x, spotOf(HOUSE_ART, 'RESIDENT_SPOT').y, `resident_${key}`),
    roomExit(`house-${key}-exit`, HOUSE_ART, `HOUSE_${key.toUpperCase()}`),
  ], entryOf(HOUSE_ART));
export const HOUSES: readonly MapDefinition[] = (['a', 'b', 'c', 'd', 'e'] as const).map(house);

export const DUNGEON_B1: MapDefinition = {
  id: 'dungeon-01-b1',
  name: 'B1F',
  area: 'dungeon',
  tiles: [
    '############',
    '#....#.....#',
    '#.S..#.....#',
    '#....#.....#',
    '#..........#',
    '####.####..#',
    '#........#.#',
    '#.######.#.#',
    '#.#......#.#',
    '#.#.######.#',
    '#.#........#',
    '#.######.###',
    '#..........#',
    '#.###..###.#',
    '#....U.....#',
    '############',
  ],
  objects: [
    warp('b1-down', 2, 2, 1, 'B2Fへ', { kind: 'floor', delta: 1 }),
    warp('b1-exit', 5, 14, 1, '街へ帰る', { kind: 'leaveDungeon' }),
    enemy('b1-enemy-1', 4, 5, 'enc-b1-a'),
    enemy('b1-enemy-2', 6, 8, 'enc-b1-b'),
  ],
  spawn: { x: 5, y: 13, dir: 'up' },
  upArrival: { x: 3, y: 2, dir: 'down' },
};

export const DUNGEON_B2: MapDefinition = {
  id: 'dungeon-01-b2',
  name: 'B2F',
  area: 'dungeon',
  tiles: [
    '##############',
    '#...#....#...#',
    '#...#....#...#',
    '#...#.S..#...#',
    '##.###..###.##',
    '#............#',
    '#.####..####.#',
    '#.#........#.#',
    '#.#.######.#.#',
    '#...#....#...#',
    '###.#....#.###',
    '#...#....#...#',
    '#.###.##.###.#',
    '#............#',
    '#.####..####.#',
    '#......U.....#',
    '#............#',
    '##############',
  ],
  objects: [
    warp('b2-down', 6, 3, 1, 'B3Fへ', { kind: 'floor', delta: 1 }),
    warp('b2-up', 7, 15, 1, 'B1Fへ', { kind: 'floor', delta: -1 }),
    enemy('b2-enemy-1', 2, 4, 'enc-b2-a'),
    enemy('b2-enemy-2', 11, 4, 'enc-b2-b'),
    enemy('b2-enemy-3', 7, 4, 'enc-b2-c'),
    chest('b2-chest-1', 3, 1, 80),
    chest('b2-chest-2', 12, 1, 0, [{ cardId: 'skl-a-5', count: 2 }]),
    chest('b2-chest-3', 6, 10, 50),
  ],
  spawn: { x: 7, y: 14, dir: 'up' },
  upArrival: { x: 7, y: 3, dir: 'down' },
};

export const DUNGEON_B3: MapDefinition = {
  id: 'dungeon-01-b3',
  name: 'B3F',
  area: 'dungeon',
  tiles: [
    '############',
    '#....##....#',
    '#..........#',
    '#....##....#',
    '###.####.###',
    '#..........#',
    '#.###..###.#',
    '#.#......#.#',
    '#.#.####.#.#',
    '#...#..#...#',
    '###.#..#.###',
    '#...#..#...#',
    '#.###..###.#',
    '#..........#',
    '#####..#####',
    '#....U.....#',
    '#..........#',
    '############',
  ],
  objects: [
    warp('b3-up', 5, 15, 1, 'B2Fへ', { kind: 'floor', delta: -1 }),
    enemy('b3-enemy-1', 5, 6, 'enc-b3-a'),
    enemy('b3-enemy-2', 3, 4, 'enc-b3-b'),
    enemy('b3-boss', 5, 2, 'enc-b3-boss', true),
    chest('b3-chest-1', 10, 9, 0, [{ cardId: 'skl-b-5', count: 2 }], 'gold'),
  ],
  spawn: { x: 6, y: 14, dir: 'up' },
};

/**
 * ダンジョンの階を、別のダンジョン用に写す（2026-10-26 ユーザー指示「ダンジョンの細かい設計は今後やるので、一旦いまのダンジョンを複製」）。
 * 宝箱・敵は1度だけの処理を ID で見分けるので、物の ID の頭に prefix を付ける。敵の編成は encounters で置き換えられる（欠片は写さない）
 */
function copyFloor(map: MapDefinition, id: string, prefix: string, encounters: Readonly<Record<string, string>> = {}): MapDefinition {
  return {
    ...map,
    id,
    objects: map.objects.map((o) =>
      o.type === 'enemy' ? { ...o, id: `${prefix}${o.id}`, encounterId: encounters[o.encounterId] ?? o.encounterId } : { ...o, id: `${prefix}${o.id}` },
    ),
  };
}

/** 【仮】森のダンジョン（2026-10-26）：いまは遺跡（dungeon-01）の写し。ボスだけ森の編成 */
export const FOREST_B1: MapDefinition = copyFloor(DUNGEON_B1, 'dungeon-02-b1', 'forest-');
export const FOREST_B2: MapDefinition = copyFloor(DUNGEON_B2, 'dungeon-02-b2', 'forest-');
export const FOREST_B3: MapDefinition = copyFloor(DUNGEON_B3, 'dungeon-02-b3', 'forest-', { 'enc-b3-boss': 'enc-forest-boss' });

export const MAPS: readonly MapDefinition[] = [
  TOWN,
  HOME,
  NEIGHBOR,
  SHOP,
  LAB,
  HALL,
  PRACTICE,
  ...HOUSES,
  BUREAU,
  DUNGEON_B1,
  DUNGEON_B2,
  DUNGEON_B3,
  FOREST_B1,
  FOREST_B2,
  FOREST_B3,
];

export function getMap(id: string): MapDefinition | undefined {
  return MAPS.find((m) => m.id === id);
}
