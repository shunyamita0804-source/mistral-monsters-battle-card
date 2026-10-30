/**
 * 世界地図（2026-10-23 ユーザー案）。
 *
 * - 絵：ユーザーが送ったミスモンの世界地図（文字のない版・1448×1086。assets/images/ui/worldmap/world_map.webp）
 * - バトルカードの舞台は左上の大陸「フェルナ地方」（ユーザー決定。地方の名前はミスモン本編の地図と同じ）
 * - ダンジョンは各地方にある（例：雪のダンジョンはノルディス地方。ユーザー案）。地図の上に丸い印と名前を置く
 * - 位置は絵に対する割合（x：左端 0〜右端 1、y：上端 0〜下端 1）
 *
 * 【仮】地方の名前の位置・街とダンジョンの印の位置は Claude が絵を見て置いた仮のもの。ダンジョンの名前も仮
 */
export type RegionId = 'ferna' | 'nordis' | 'asteria' | 'ortiga' | 'seiran' | 'nebrasia';

export interface WorldMapRegion {
  readonly id: RegionId;
  /** 地方の名前を書く位置 */
  readonly x: number;
  readonly y: number;
}

export interface WorldMapSpot {
  readonly x: number;
  readonly y: number;
  readonly region: RegionId;
}

export const WORLD_MAP_SIZE = { width: 1448, height: 1086 } as const;

/** バトルカードの舞台（主人公の街がある地方） */
export const HOME_REGION: RegionId = 'ferna';

export const WORLD_MAP_REGIONS: readonly WorldMapRegion[] = [
  { id: 'ferna', x: 0.13, y: 0.34 },
  { id: 'nordis', x: 0.5, y: 0.1 },
  { id: 'asteria', x: 0.8, y: 0.22 },
  { id: 'ortiga', x: 0.56, y: 0.56 },
  { id: 'seiran', x: 0.16, y: 0.63 },
  { id: 'nebrasia', x: 0.88, y: 0.6 },
];

/** 主人公の街（現在地）。【仮】位置 */
export const TOWN_SPOT: WorldMapSpot = { x: 0.3, y: 0.37, region: 'ferna' };

/** ダンジョンの印。ダンジョンを足すときはここに1行。【仮】位置 */
export const DUNGEON_SPOTS: Readonly<Record<string, WorldMapSpot>> = {
  'dungeon-01': { x: 0.2, y: 0.17, region: 'ferna' },
  // 2026-10-29 ユーザー指示：名前の札が街の印のすぐ左下に重なって見えたので、少し左へ（前は x 0.14）
  'dungeon-02': { x: 0.12, y: 0.46, region: 'ferna' },
  // 2026-10-27 指示書「ダンジョン7つ」：地方の雰囲気に合わせて Claude が仮に置いた（水＝セイラン地方の湖のそば、氷＝ノルディス地方の雪山、
  // 火＝オルティガ地方の赤い火山、機械＝アステリア地方、聖域＝ネブラシア地方の結晶の島）
  'dungeon-03': { x: 0.21, y: 0.66, region: 'seiran' },
  'dungeon-04': { x: 0.5, y: 0.16, region: 'nordis' },
  'dungeon-05': { x: 0.5, y: 0.5, region: 'ortiga' },
  'dungeon-06': { x: 0.8, y: 0.3, region: 'asteria' },
  'dungeon-07': { x: 0.89, y: 0.64, region: 'nebrasia' },
  // 2026-10-30 指示書 U：風の渓谷。Claude が仮に置いた（オルティガ地方の西の山あい。水の神殿・炎の火山の印と重ならない所）
  'dungeon-08': { x: 0.36, y: 0.56, region: 'ortiga' },
};
