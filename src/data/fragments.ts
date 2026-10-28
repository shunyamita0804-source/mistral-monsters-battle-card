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
  // 街（マスは 32px）。2026-10-28 の直しで道の行き止まりが無くなったので、街のすみ4か所へ置き直した：
  // 作業小屋の裏（北東）・南東のすみ・練習場の裏（西の高台の石垣の下）・南西のすみ
  { id: 'fragment-01', mapId: 'town', x: 181, y: 21 },
  { id: 'fragment-02', mapId: 'town', x: 182, y: 196 },
  { id: 'fragment-03', mapId: 'town', x: 14, y: 67 },
  { id: 'fragment-04', mapId: 'town', x: 12, y: 197 },
  { id: 'fragment-05', mapId: 'dungeon-02-b1', x: 9, y: 1 },
  { id: 'fragment-06', mapId: 'dungeon-02-b1', x: 3, y: 14 },
  { id: 'fragment-07', mapId: 'dungeon-02-b2', x: 5, y: 11 },
  { id: 'fragment-08', mapId: 'dungeon-02-b2', x: 12, y: 16 },
  { id: 'fragment-09', mapId: 'dungeon-02-b3', x: 10, y: 1 },
  { id: 'fragment-10', mapId: 'dungeon-02-b3', x: 1, y: 16 },
];

export const FRAGMENT_TOTAL = 10;
