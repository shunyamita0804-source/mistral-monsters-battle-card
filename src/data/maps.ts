import type { Direction } from '../game/save/saveData.ts';
import { BUREAU_MAP_ID } from './introV2.ts';
import { ROOMS4_ART, ROOMS4_DRAW_OFFSET } from './rooms4Art.generated.ts';
import { SHOP_ROOMS_ART, SHOP_ROOMS_DRAW_OFFSET } from './shopRoomsArt.generated.ts';
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
  /** 欠片の特別復元（2026-10-28 カードショップから研究所の解析台へ移した） */
  | 'restore'
  /** 研究員：図鑑と、欠片を持っていれば特別復元も選べる */
  | 'researcher'
  /** 大会会場の左の壁の板：総当たりの対戦表を見る（受付と同じ表） */
  | 'leagueBoard'
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
  /** 名前の札を出す高さのずれ（マス。負なら上へ）。調べる範囲より上に名札を出したい大きな家具（販売機など） */
  readonly labelDy?: number;
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

/** 街の住人（話しかけると短い会話。台詞は仮）。A＝マルタ・D＝ロザリーは店の中、B＝ピート・E＝ハロルドは街の外（2026-10-28） */
/** 住人C（大工・住宅C）は 2026-10-27 に住宅C をカードバトラー管理局に置き換えたのでなくした */
export type ResidentId = 'resident_a' | 'resident_b' | 'resident_d' | 'resident_e';
export const RESIDENT_IDS: readonly ResidentId[] = ['resident_a', 'resident_b', 'resident_d', 'resident_e'];
export const isResidentId = (id: string): id is ResidentId => (RESIDENT_IDS as readonly string[]).includes(id);

/** 人物（会話の名前・歩行の絵の参照に使う） */
/** bureau_clerk：カードバトラー管理局の受付（エレノア。No.06） */
export type NpcId = 'neighbor_guide' | 'clerk' | 'researcher' | 'receptionist' | 'teacher' | 'bureau_clerk' | ResidentId;

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
  /** 絵だけを横にずらすマスの数（負＝左へ）。大会会場の受付のように、カウンターの横から話しかけるとき（2026-10-28） */
  readonly drawDx?: number;
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

const npc = (id: string, x: number, y: number, npcId: NpcId, action?: InteractAction, drawDy?: number, drawDx?: number): NpcObject => ({
  type: 'npc',
  id,
  x,
  y,
  w: 1,
  h: 1,
  npcId,
  ...(action ? { action } : {}),
  ...(drawDy ? { drawDy } : {}),
  ...(drawDx ? { drawDx } : {}),
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

/** 地図 ID → 部屋の絵（worldArt.generated.ts） */
const ROOM_ART_OF: Readonly<Record<string, string>> = {
  home: 'player', neighbor: 'guide', shop: 'shop',
  'house-b': 'house', 'house-e': 'house',
};
/** 地図 ID → 2026-10-28 の新しい部屋の絵（rooms4Art.generated.ts。tools/design/rooms4_build.py） */
const ROOMS4_OF: Readonly<Record<string, keyof typeof ROOMS4_ART>> = { hall: 'arena', [BUREAU_MAP_ID]: 'bureau', practice: 'practice', lab: 'lab' };
const roomArtOf = (mapId: string): ArtMap => {
  const r4 = ROOMS4_OF[mapId];
  if (r4) return ROOMS4_ART[r4];
  if (mapId === 'florist' || mapId === 'tailor') return SHOP_ROOMS_ART[mapId];
  return artOf(ROOM_ART_OF[mapId] ?? '');
};

/** 街の建物（設計図の ID）→ 入る部屋 */
const TOWN_DOORS: readonly { readonly id: string; readonly building: string; readonly mapId: string; readonly label: string }[] = [
  { id: 'door-practice', building: 'TRAINING', mapId: 'practice', label: 'カード練習場' },
  { id: 'door-hall', building: 'ARENA', mapId: 'hall', label: '大会会場' },
  { id: 'door-home', building: 'PLAYER_HOME', mapId: 'home', label: '家' },
  { id: 'door-neighbor', building: 'GUIDE_HOME', mapId: 'neighbor', label: 'となりの家' },
  { id: 'door-shop', building: 'SHOP', mapId: 'shop', label: 'カードショップ' },
  { id: 'door-lab', building: 'LAB', mapId: 'lab', label: 'カード研究所' },
  // 住宅A は花屋（マルタ）、住宅D は仕立て屋（ロザリー）。2026-10-29 中を店の新しい部屋にした（florist・tailor）
  { id: 'door-house-a', building: 'HOUSE_A', mapId: 'florist', label: '花屋' },
  { id: 'door-house-b', building: 'HOUSE_B', mapId: 'house-b', label: '民家' },
  // 2026-10-27 ユーザー指示：住宅C の所をカードバトラー管理局に置き換えた（住宅C と住人C はなくした）
  { id: 'door-bureau', building: 'BUREAU', mapId: BUREAU_MAP_ID, label: 'カードバトラー管理局' },
  { id: 'door-house-d', building: 'HOUSE_D', mapId: 'tailor', label: '仕立て屋' },
  { id: 'door-house-e', building: 'HOUSE_E', mapId: 'house-e', label: '民家' },
];

/** 街の上に出す施設の名前（絵には焼き込まない。表示は i18n の world.building.*）。位置は建物の絵の上端の中央（設計図の単位） */
export const TOWN_SIGNS: readonly { readonly building: string; readonly label: 'hall' | 'practice' | 'home' | 'neighbor' | 'shop' | 'lab' | 'bureau'; readonly x: number; readonly y: number }[] = (
  [
    ['ARENA', 'hall'], ['TRAINING', 'practice'], ['PLAYER_HOME', 'home'], ['GUIDE_HOME', 'neighbor'], ['SHOP', 'shop'], ['LAB', 'lab'], ['BUREAU', 'bureau'],
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

/** 街の立ち位置（worldArt.generated.ts の town.items の *_SPOT）の足元のマス */
const townSpot = (id: string): { x: number; y: number } => spotOf(TOWN_ART, id);

/**
 * 街（2026-10-28 指示書「街を新しい絵で作り直す」。tools/design/town2026_build.py が組み立てる）。配置図の番号：
 * 北の高台＝1 大会会場（15 大階段）、西の高台＝3 カード研究所・17 見晴らし台（16 階段）、北東＝2 カードバトラー管理局・12 大工の作業小屋（入れない）、
 * 中央＝13 噴水の広場、西＝4 カード練習場、東＝5 カードショップ・6 花屋（住宅A）・22 屋台・7 仕立て屋（住宅D）、
 * 南西＝8 ピートの家（住宅B）・9 ハロルドの家（住宅E）・18 小川・24 木の橋・10 主人公の家・11 となりの家、南＝19 石の橋・14 南の門（ダンジョンへ）。
 * 住人：ピートとハロルドは外だけ（ショップの前・広場のベンチのそば）、マルタとロザリーは店の中だけ（2026-10-28 ユーザー）
 */
export const TOWN: MapDefinition = artMap(
  'town',
  '街',
  'town',
  TOWN_ART,
  [
    ...TOWN_DOORS.map((d) => {
      const door = doorOf(TOWN_ART, d.building);
      const room = roomArtOf(d.mapId);
      return warp(d.id, door.x, door.y, door.w, d.label, { kind: 'map', mapId: d.mapId, ...entryOf(room) });
    }),
    // 14 南の門の扉の前。踏むと既存のダンジョン選択（家の壁の地図と同じ画面）へ
    warp('door-dungeon', TOWN_ART.exit.x, TOWN_ART.exit.y, TOWN_ART.exit.w, 'ダンジョン入口', { kind: 'dungeonGate' }),
    interactAt('sign-fountain', TOWN_ART.fountain as CellRect, '噴水', 'message', '街の中央の噴水。水の音が心地よい。'),
    // となりの家の女性（案内役）。物語の進み具合で、街か練習場のどちらかにいる。街では自分の家の前の道
    npc('guide-town', townSpot('GUIDE_SPOT').x, townSpot('GUIDE_SPOT').y, 'neighbor_guide'),
    // 住人B（ピート）：カードショップの前。住人E（ハロルド）：噴水の広場のベンチのそば（新聞を読んでいる人のイメージ）
    npc('town-pete', townSpot('PETE_SPOT').x, townSpot('PETE_SPOT').y, 'resident_b'),
    npc('town-harold', townSpot('HAROLD_SPOT').x, townSpot('HAROLD_SPOT').y, 'resident_e'),
  ],
  { x: TOWN_ART.spawn.x, y: TOWN_ART.spawn.y, dir: 'down' },
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
/** 販売機の名札：調べる範囲の上のはし（絵の y 420＝16 マス目）から、機械の屋根の下（7 マス目＝絵の y 約 180）へ */
const SHOP_GACHA_LABEL_DY = -9;
/** カードショップ。主役はカードの購入（店員のカウンター）とカードパックの販売機（いまのガチャ。カプセルではない） */
export const SHOP: MapDefinition = artMap('shop', 'カードショップ', 'interior', SHOP_ART, [
  interactAt('shop-counter', itemOf(SHOP_ART, 'COUNTER'), 'カウンター', 'shopClerk'),
  // 2026-10-29 夜 iPhone「主人公が名札と機械の間に挟まる」：名札は機械の上（屋根の下・絵の y 約 180）に出す
  { ...interactAt('shop-gacha', itemOf(SHOP_ART, 'PACK_MACHINE'), 'カードパック販売機', 'gacha'), labelDy: SHOP_GACHA_LABEL_DY },
  interactAt('shop-shelf', itemOf(SHOP_ART, 'SHELF_WALL'), '商品棚', 'message', 'カードとパックがきれいに並んでいる。'),
  interactAt('shop-case-l', itemOf(SHOP_ART, 'CASE_L'), 'ショーケース', 'message', '珍しいカードが飾ってある。'),
  interactAt('shop-case-r', itemOf(SHOP_ART, 'CASE_R'), 'ショーケース', 'message', '珍しいカードが飾ってある。'),
  npc('shop-clerk', spotOf(SHOP_ART, 'CLERK_SPOT').x, spotOf(SHOP_ART, 'CLERK_SPOT').y, 'clerk', 'shopClerk', SHOP_CLERK_DRAW_DY),
  roomExit('shop-exit', SHOP_ART, 'SHOP'),
], entryOf(SHOP_ART));

const LAB_ART = ROOMS4_ART.lab;
/** カウンターの奥などに立つ人（話しかけるマスは家具の手前。見た目だけ奥にずらす） */
const spotNpc = (id: string, art: ArtMap, spot: string, offset: { readonly dx: number; readonly dy: number } | undefined, npcId: NpcId, action?: InteractAction): NpcObject => {
  const p = spotOf(art, spot);
  return npc(id, p.x, p.y, npcId, action, offset?.dy, offset?.dx);
};
/**
 * カード研究所（2026-10-28 新しい絵。tools/design/rooms4_build.py）。奥の壁の本棚＝図鑑、左奥のガラスの飾り棚＝標本棚、中央の机（研究員ルーカスはその奥）、
 * 右奥の機械＝記録の投影機、右の実験台＝解析台、右の壁の図形の板（黒板）。2026-10-29 夜に白い研究施設の絵（v2）へ。前の絵にあった水晶の台・資料棚・閲覧テーブル・薬品の作業台・標本ケースは外した
 */
export const LAB: MapDefinition = artMap('lab', 'カード研究所', 'interior', LAB_ART, [
  interactAt('lab-shelf', itemOf(LAB_ART, 'BIG_SHELF'), '図鑑の本棚', 'collection'),
  interactAt('lab-cabinet', itemOf(LAB_ART, 'CABINET'), '標本棚', 'message', '結晶や羽根が、標本のように並んでいる。'),
  interactAt('lab-desk', itemOf(LAB_ART, 'DESK'), '研究机', 'message', '研究の資料が広げてある。'),
  interactAt('lab-projector', itemOf(LAB_ART, 'PROJECTOR'), '記録の投影機', 'message', '光の板に、昔の対戦の記録が映っている。'),
  // 図形の板（右の壁）は解析台の奥の上で範囲が重なるので、先に並べる（2026-10-29 夜 v2）
  interactAt('lab-blackboard', itemOf(LAB_ART, 'BLACKBOARD'), '図形の板', 'message', '星と円の図がびっしり描かれている。'),
  // 解析台で欠片の特別復元（2026-10-28 ユーザー決定：カードショップから研究所へ）
  interactAt('lab-analysis', itemOf(LAB_ART, 'ANALYSIS'), '解析台', 'restore'),
  spotNpc('lab-researcher', LAB_ART, 'RESEARCHER_SPOT', ROOMS4_DRAW_OFFSET.lab.RESEARCHER_SPOT, 'researcher', 'researcher'),
  roomExit('lab-exit', LAB_ART, 'LAB'),
], entryOf(LAB_ART));

const HALL_ART = ROOMS4_ART.arena;
/**
 * 大会会場の左の壁の紺の板（部屋の絵の中で斜めに見える平行四辺形）。部屋の単位（絵の px × 1.25）。
 * 左の辺 x 75・上 220〜下 440、右の辺 x 243 は 110 上がる（絵 arena_shell.png で測った）。skewY で板の傾きに合わせて表を描く
 */
export const HALL_BOARD = { x: 94, y: 275, w: 210, h: 275, skewDeg: -33.2 } as const;
/**
 * 大会会場（2026-10-28 新しい絵。tools/design/rooms4_build.py）。奥に観客席、中央の円形の段に対戦台、右手前に受付。
 * 受付のセリアはカウンターの奥（話しかけるのはカウンターの左から）。左の壁の大きな紺の板は空（大会の総当たり表を描く予定。位置は HALL_ART.items.BOARD）
 */
export const HALL: MapDefinition = artMap('hall', '大会会場', 'interior', HALL_ART, [
  interactAt('hall-desk', itemOf(HALL_ART, 'RECEPTION'), '受付カウンター', 'tournamentDesk'),
  interactAt('hall-table', itemOf(HALL_ART, 'TABLE'), '対戦テーブル', 'message', '屋根付きの会場の中央にある対戦テーブル。大会の対戦はここで行われる。'),
  // 左の壁の紺の板：いま出ている（または最後に出た）総当たりの大会の表を小さく描き（worldScreen.ts）、調べると対戦表の画面
  interactAt('hall-board', itemOf(HALL_ART, 'BOARD_TOUCH'), '対戦表', 'leagueBoard'),
  interactAt('hall-seats-l', itemOf(HALL_ART, 'SEATS_L'), '客席', 'message', '観客席。'),
  interactAt('hall-seats-r', itemOf(HALL_ART, 'SEATS_R'), '客席', 'message', '観客席。'),
  spotNpc('hall-receptionist', HALL_ART, 'RECEPTIONIST_SPOT', ROOMS4_DRAW_OFFSET.arena.RECEPTIONIST_SPOT, 'receptionist', 'tournamentDesk'),
  roomExit('hall-exit', HALL_ART, 'ARENA'),
], entryOf(HALL_ART));

/**
 * 人の前に立つと画面の中心を寄せる所（2026-10-29 iPhone の試遊「受付カウンターが画面の外に切れる」）。
 * その人に話しかけられる所にいる間だけ、画面の中心を「主人公」と target（マス。カウンターの絵の範囲）の真ん中の中間へ寄せる。
 * それでもカウンターが画面からはみ出すときは、はみ出さない所まで寄せる（worldScreen.ts）
 */
export const CAMERA_LEANS: readonly { readonly mapId: string; readonly npcId: string; readonly target: CellRect }[] = [
  { mapId: 'hall', npcId: 'hall-receptionist', target: itemOf(HALL_ART, 'COUNTER') },
];

const PRACTICE_ART = ROOMS4_ART.practice;
/**
 * カード練習場（2026-10-28 新しい絵。tools/design/rooms4_build.py）。初心者がカードを学ぶ場所。対戦机3つで練習試合ができる。
 * 奥の黒板・左の壁ぞいの教材の棚。ベンチは無くなった
 */
export const PRACTICE: MapDefinition = artMap('practice', 'カード練習場', 'interior', PRACTICE_ART, [
  interactAt('practice-shelf', itemOf(PRACTICE_ART, 'SHELF'), '教材の棚', 'message', '練習用のカードがきちんと並んでいる。'),
  interactAt('practice-board', itemOf(PRACTICE_ART, 'BOARD'), '黒板', 'message', 'カードの並べ方の図が描いてある。'),
  interactAt('practice-table-1', itemOf(PRACTICE_ART, 'TABLE_1'), '練習テーブル', 'practiceTable'),
  interactAt('practice-table-2', itemOf(PRACTICE_ART, 'TABLE_2'), '練習テーブル', 'practiceTable'),
  interactAt('practice-table-3', itemOf(PRACTICE_ART, 'TABLE_3'), '練習テーブル', 'practiceTable'),
  // ガレス先生は真ん中の机のすぐ手前。案内役は最初の練習試合が終わるまで、先生の右どなりにいる
  npc('practice-teacher', spotOf(PRACTICE_ART, 'TEACHER_SPOT').x, spotOf(PRACTICE_ART, 'TEACHER_SPOT').y, 'teacher', 'practiceTable'),
  npc('guide-practice', spotOf(PRACTICE_ART, 'TEACHER_SPOT', 5).x, spotOf(PRACTICE_ART, 'TEACHER_SPOT').y + 1, 'neighbor_guide'),
  roomExit('practice-exit', PRACTICE_ART, 'TRAINING'),
], entryOf(PRACTICE_ART));

const BUREAU_ART = ROOMS4_ART.bureau;
/** 管理局の受付の前（主人公が受付と話すために止まる所。tools/design/rooms4_build.py の PLAYER_SPOT） */
export const BUREAU_DESK_FRONT: { readonly x: number; readonly y: number } = spotOf(BUREAU_ART, 'PLAYER_SPOT');
/**
 * カードバトラー管理局の中（2026-10-28 新しい絵。tools/design/rooms4_build.py）。中央に受付のカウンター（エレノアはその奥）、
 * 左奥にランクの板、右奥にメダルの棚、左右に長いす、左手前に掲示板。入口は扉のない開いた通り道。
 * 街では北東の、もとの住宅C の所（2026-10-27 ユーザー指示）
 */
export const BUREAU: MapDefinition = artMap(BUREAU_MAP_ID, 'カードバトラー管理局', 'interior', BUREAU_ART, [
  interactAt('bureau-desk', itemOf(BUREAU_ART, 'COUNTER'), '受付', 'bureauDesk'),
  interactAt('bureau-rank-board', itemOf(BUREAU_ART, 'RANK_BOARD'), 'ランクの板', 'message', 'カードバトラーのランクの一覧。E から S まで、6つの段がある。'),
  interactAt('bureau-medal-case', itemOf(BUREAU_ART, 'MEDAL_CASE'), 'メダルの棚', 'message', '歴代の優勝者のメダルが、ガラスの中で光っている。'),
  interactAt('bureau-notice-board', itemOf(BUREAU_ART, 'NOTICE_BOARD'), '掲示板', 'message', '大会のお知らせが貼ってある。「ランクを上げて、次の大会に挑もう！」'),
  spotNpc('bureau-clerk', BUREAU_ART, 'CLERK_SPOT', ROOMS4_DRAW_OFFSET.bureau.CLERK_SPOT, 'bureau_clerk', 'bureauDesk'),
  // 幼馴染（ミレイユ）：導入イベントでパックを選ぶ間だけ、受付の前の主人公の右に立つ（2026-10-27 パック選びで幼馴染が説明する）
  npc('guide-bureau', BUREAU_DESK_FRONT.x + 4, BUREAU_DESK_FRONT.y, 'neighbor_guide'),
  roomExit('bureau-exit', BUREAU_ART, 'BUREAU'),
], entryOf(BUREAU_ART));

const HOUSE_ART = artOf('house');
/**
 * 民家（住宅B・E。部屋の絵は共通）。ピート〔住宅B〕とハロルド〔住宅E〕は外だけなので、家の中は空（2026-10-28 ユーザー）。
 * 住宅A（花屋）・住宅D（仕立て屋）は 2026-10-29 に店の新しい部屋にした（下の FLORIST・TAILOR）
 */
const house = (key: 'b' | 'e'): MapDefinition =>
  artMap(`house-${key}`, '民家', 'interior', HOUSE_ART, [
    interactAt(`house-${key}-shelf`, itemOf(HOUSE_ART, 'SHELF'), '棚', 'message', '食器がきちんと並んでいる。'),
    interactAt(`house-${key}-table`, itemOf(HOUSE_ART, 'TABLE'), 'テーブル', 'message', 'テーブルクロスがかかっている。'),
    roomExit(`house-${key}-exit`, HOUSE_ART, `HOUSE_${key.toUpperCase()}`),
  ], entryOf(HOUSE_ART));
// 住宅C は 2026-10-27 にカードバトラー管理局に置き換えた（住人C もなくした）
export const HOUSES: readonly MapDefinition[] = (['b', 'e'] as const).map(house);

const FLORIST_ART = SHOP_ROOMS_ART.florist;
/**
 * 花屋の中（住宅A。2026-10-29 新しい絵。tools/design/rooms_shop_build.py）。奥の作りつけの棚（花・包み紙・リボン）、左右の花の段、
 * 左右の壁の吊り花かご、真ん中のカウンター（マルタはその奥。話しかけるのはカウンターの手前の床から）
 */
export const FLORIST: MapDefinition = artMap('florist', '花屋', 'interior', FLORIST_ART, [
  // 吊り花かごは花の段の上の壁にある（範囲が重なるので先に並べる）
  interactAt('florist-basket-l', itemOf(FLORIST_ART, 'BASKET_L'), '吊り花かご', 'message', '吊るしたかごから、白と黄色の花がこぼれている。'),
  interactAt('florist-basket-r', itemOf(FLORIST_ART, 'BASKET_R'), '吊り花かご', 'message', '吊るしたかごから、白と黄色の花がこぼれている。'),
  interactAt('florist-steps-l', itemOf(FLORIST_ART, 'STEPS_L'), '花の段', 'message', '段の上に、色とりどりの花の鉢がずらりと並んでいる。'),
  interactAt('florist-steps-r', itemOf(FLORIST_ART, 'STEPS_R'), '花の段', 'message', '青い花が気持ちよさそうに咲いている。じょうろも置いてある。'),
  interactAt('florist-shelf', itemOf(FLORIST_ART, 'SHELF'), '奥の棚', 'message', '花束を包む紙とリボンが、色ごとに巻いてしまってある。'),
  spotNpc('florist-keeper', FLORIST_ART, 'KEEPER_SPOT', SHOP_ROOMS_DRAW_OFFSET.florist.KEEPER_SPOT, 'resident_a'),
  roomExit('florist-exit', FLORIST_ART, 'HOUSE_A'),
], entryOf(FLORIST_ART));

const TAILOR_ART = SHOP_ROOMS_ART.tailor;
/**
 * 仕立て屋の中（住宅D。2026-10-29 新しい絵。tools/design/rooms_shop_build.py）。奥の布の棚、右奥の試着の囲い、右の姿見、左右のトルソー、
 * 左の布の台、真ん中の作業カウンター（ロザリーはその奥。話しかけるのはカウンターの手前の床から）
 */
export const TAILOR: MapDefinition = artMap('tailor', '仕立て屋', 'interior', TAILOR_ART, [
  interactAt('tailor-cloth-shelf', itemOf(TAILOR_ART, 'CLOTH_SHELF'), '布の棚', 'message', '巻いた布が色ごとに並んでいる。紺と赤が多い。'),
  interactAt('tailor-fitting', itemOf(TAILOR_ART, 'FITTING'), '試着の囲い', 'message', '紺のカーテンが閉まっている。中で着替えができるようだ。'),
  interactAt('tailor-mirror', itemOf(TAILOR_ART, 'MIRROR'), '姿見', 'message', '大きな鏡に、自分の姿が映っている。'),
  interactAt('tailor-torso-l', itemOf(TAILOR_ART, 'TORSO_L'), 'トルソー', 'message', '紺と白の上着が着せてある。仕立てたばかりのようだ。'),
  interactAt('tailor-torso-r', itemOf(TAILOR_ART, 'TORSO_R'), 'トルソー', 'message', '緑のドレスが着せてある。すそのししゅうがきれいだ。'),
  interactAt('tailor-cloth-table', itemOf(TAILOR_ART, 'CLOTH_TABLE'), '布の台', 'message', 'たたんだ服と布が、きちんと積んである。'),
  spotNpc('tailor-keeper', TAILOR_ART, 'KEEPER_SPOT', SHOP_ROOMS_DRAW_OFFSET.tailor.KEEPER_SPOT, 'resident_d'),
  roomExit('tailor-exit', TAILOR_ART, 'HOUSE_D'),
], entryOf(TAILOR_ART));

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
  FLORIST,
  TAILOR,
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
