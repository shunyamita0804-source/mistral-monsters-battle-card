import { floorSeed, type DungeonFloor } from './generate.ts';

/**
 * 床の上の飾り（2026-10-28 指示書「新しいダンジョン5つの正式な絵」）：炎の火山の溶岩のひび割れ・天の聖域の羽根・燭台・光の筋。
 * 見た目だけで、通れるかどうか・仕掛けには影響しない。
 * 階を作るときの乱数（generate.ts の Rng）とは別の決まった並び（マスの位置から作る数）で選ぶので、同じ階はいつも同じ見た目になり、
 * 飾りを足しても階の作りは変わらない
 */
export type FloorDecorKind =
  | 'crack'
  | 'feather'
  | 'candle'
  | 'light'
  // 風の渓谷（2026-10-30 指示書 U）：つり橋の切れはし・風見の石の柱・小さな風車・木の葉の吹きだまり・ロープの杭
  | 'bridge'
  | 'vane'
  | 'mill'
  | 'leaves'
  | 'stake'
  // 雷の高原（2026-11-01 指示書 AH）：小さな石の柱・倒れた柱のかけら・焦げた岩・草むら・避雷の鉄の棒（イベントの 'pillar' と分けるため名前を変えた）
  | 'stonepillar'
  | 'fallenpillar'
  | 'scorched'
  | 'tuft'
  | 'rod'
  // 2026-10-29 イベントのダンジョン3つ（まだダンジョンとしては足していない。src/ui/components/eventDungeonArt.ts）
  | 'rail'
  | 'ore'
  | 'fog'
  | 'rug'
  | 'books'
  | 'slab'
  | 'candlestand'
  | 'lantern'
  | 'emblem'
  | 'pillar';

export interface FloorDecor {
  readonly x: number;
  readonly y: number;
  readonly kind: FloorDecorKind;
  /** 同じ種類の中のどの絵か（0 から） */
  readonly variant: number;
}

interface DecorRule {
  /** 床のマスのうち、飾りを置く割合 */
  readonly rate: number;
  /** 種類と絵の数、選ばれやすさ */
  readonly kinds: readonly { readonly kind: FloorDecorKind; readonly variants: number; readonly weight: number }[];
}

/** 【仮】ダンジョンごとの飾り（置く割合・選ばれやすさは Claude の判断） */
const DECOR_RULES: Readonly<Record<string, DecorRule>> = {
  // 炎の火山：溶岩のひび割れ（大小4つ）
  'dungeon-05': { rate: 0.07, kinds: [{ kind: 'crack', variants: 4, weight: 1 }] },
  // 天の聖域：羽根3つ・燭台2つ・光の筋2つ
  'dungeon-07': {
    rate: 0.06,
    kinds: [
      { kind: 'feather', variants: 3, weight: 2 },
      { kind: 'candle', variants: 2, weight: 1 },
      { kind: 'light', variants: 2, weight: 1 },
    ],
  },
  // 風の渓谷（2026-10-30 指示書 U）：木の葉の吹きだまりを多めに、柱・風車・杭・つり橋の切れはしを少し
  'dungeon-08': {
    rate: 0.06,
    kinds: [
      { kind: 'leaves', variants: 1, weight: 3 },
      { kind: 'vane', variants: 1, weight: 1 },
      { kind: 'mill', variants: 1, weight: 1 },
      { kind: 'stake', variants: 1, weight: 1 },
      { kind: 'bridge', variants: 1, weight: 1 },
    ],
  },
  // 雷の高原（2026-11-01 指示書 AH）：草むらを多めに、石の柱・倒れた柱・焦げた岩・避雷の鉄の棒を少し
  'dungeon-09': {
    rate: 0.06,
    kinds: [
      { kind: 'tuft', variants: 1, weight: 3 },
      { kind: 'stonepillar', variants: 1, weight: 1 },
      { kind: 'fallenpillar', variants: 1, weight: 1 },
      { kind: 'scorched', variants: 1, weight: 1 },
      { kind: 'rod', variants: 1, weight: 1 },
    ],
  },
  // イベントのダンジョン3つ（2026-10-29。ID は仮で、まだどの階にも出ない。src/ui/components/eventDungeonArt.ts）
  // 霧の廃坑：レールの切れはし2・鉱石のかたまり2・床をはう霧2
  'event-mist-mine': {
    rate: 0.06,
    kinds: [
      { kind: 'rail', variants: 2, weight: 1 },
      { kind: 'ore', variants: 2, weight: 1 },
      { kind: 'fog', variants: 2, weight: 2 },
    ],
  },
  // 忘れられた書庫：じゅうたんの切れはしは少しだけ（指示書）。本と巻物の山2・石板のかけら2・燭台1
  'event-archive': {
    rate: 0.06,
    kinds: [
      { kind: 'rug', variants: 3, weight: 1 },
      { kind: 'books', variants: 2, weight: 2 },
      { kind: 'slab', variants: 2, weight: 1 },
      { kind: 'candlestand', variants: 1, weight: 1 },
    ],
  },
  // 静かなる祭壇：石の灯籠2・床の銀の紋章1・くずれた柱のかけら2
  'event-altar': {
    rate: 0.05,
    kinds: [
      { kind: 'lantern', variants: 2, weight: 2 },
      { kind: 'emblem', variants: 1, weight: 1 },
      { kind: 'pillar', variants: 2, weight: 2 },
    ],
  },
};

/** マスの位置と階のシードから、0 以上 1 未満の数（決まった並び） */
function cellNoise(seed: number, x: number, y: number, salt: number): number {
  let v = Math.imul(seed ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 1, 0x85ebca77) ^ Math.imul(salt, 0xc2b2ae3d);
  v = Math.imul(v ^ (v >>> 15), 0x2c1b3c6d);
  v = Math.imul(v ^ (v >>> 12), 0x297a2d39);
  v ^= v >>> 15;
  return (v >>> 0) / 4294967296;
}

const isPlainFloor = (f: DungeonFloor, x: number, y: number): boolean => f.tiles[y]?.[x] === '.';

/**
 * その階の飾り。置くのは何もない床（'.'）で、まわり（上下左右）も床のマスだけ（壁・水路・扉に絵がはみ出さないように）。
 * 階段・置いてあるもの（バトラー・宝箱・スイッチ・ボス）・始まりの場所には置かない
 */
export function floorDecorations(f: DungeonFloor, runSeed: number, dungeonId: string): FloorDecor[] {
  const rule = DECOR_RULES[dungeonId];
  if (!rule) return [];
  const seed = floorSeed(runSeed, f.index);
  const taken = new Set(f.entities.map((e) => `${e.x},${e.y}`));
  taken.add(`${f.start.x},${f.start.y}`);
  if (f.stairs) taken.add(`${f.stairs.x},${f.stairs.y}`);
  const total = rule.kinds.reduce((s, k) => s + k.weight, 0);
  const out: FloorDecor[] = [];
  for (let y = 0; y < f.height; y++) {
    for (let x = 0; x < f.width; x++) {
      if (!isPlainFloor(f, x, y) || taken.has(`${x},${y}`)) continue;
      if (![[0, -1], [0, 1], [-1, 0], [1, 0]].every(([dx, dy]) => isPlainFloor(f, x + (dx ?? 0), y + (dy ?? 0)))) continue;
      if (cellNoise(seed, x, y, 1) >= rule.rate) continue;
      let pick = cellNoise(seed, x, y, 2) * total;
      const k = rule.kinds.find((c) => (pick -= c.weight) < 0) ?? (rule.kinds[rule.kinds.length - 1] as DecorRule['kinds'][number]);
      out.push({ x, y, kind: k.kind, variant: Math.floor(cellNoise(seed, x, y, 3) * k.variants) });
    }
  }
  return out;
}
