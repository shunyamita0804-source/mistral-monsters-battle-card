/**
 * 欠片の隠し場所（計10個、各1度だけ）。
 * 位置はマップ上に表示しない。その場所で「しらべる」と見つかる。
 * 隠しモンスターの正式名称・画像は未確定。欠片の個数（10個）は指示書どおり。場所は仮。
 */
export interface FragmentDefinition {
  readonly id: string;
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
}

export const FRAGMENTS: readonly FragmentDefinition[] = [
  // 街（マスは 32px）：道の行き止まり4か所（2026-10-28 の新しい街で置き直し：北東の道の東の端・ピートの家の前の道の西の端・
  // 仕立て屋の前の道の東の端・主人公の家の前の道の西の端）
  { id: 'fragment-01', mapId: 'town', x: 190, y: 63 },
  { id: 'fragment-02', mapId: 'town', x: 152, y: 140 },
  { id: 'fragment-03', mapId: 'town', x: 14, y: 140 },
  { id: 'fragment-04', mapId: 'town', x: 16, y: 189 },
  // 2026-10-26：太古の遺跡がランダム生成のダンジョンになったので、同じ形の精霊の森（遺跡の写し）の同じ場所へ移した
  { id: 'fragment-05', mapId: 'dungeon-02-b1', x: 9, y: 1 },
  { id: 'fragment-06', mapId: 'dungeon-02-b1', x: 3, y: 14 },
  { id: 'fragment-07', mapId: 'dungeon-02-b2', x: 5, y: 11 },
  { id: 'fragment-08', mapId: 'dungeon-02-b2', x: 12, y: 16 },
  { id: 'fragment-09', mapId: 'dungeon-02-b3', x: 10, y: 1 },
  { id: 'fragment-10', mapId: 'dungeon-02-b3', x: 1, y: 16 },
];

export const FRAGMENT_TOTAL = 10;
