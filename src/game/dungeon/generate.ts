import { DUNGEON_RUN } from '../../data/dungeonRun.ts';
import { nextInt, nextRandom } from '../rng.ts';

/**
 * ランダム生成のダンジョンの1つの階を作る（2026-10-26 試作。GB 版のダンジョンを参考に）。DOM に依存しない純粋関数。
 *
 * - 部屋の格子（grid×grid の区画）。区画ごとに部屋（roomRate の割合）か、通路の曲がり角だけを作る
 * - 区画どうしを迷路の木の形（必ず全部つながる）でつなぎ、回り道を extraLinks 本足す。道は L 字の通路
 * - スタートは区画のどれか。下り階段（最後の階はボス）は、スタートからいちばん遠い部屋
 * - 通常のバトラー・宝箱（通れない）・見えない番人（姿なし・通れる）を部屋に置く。
 *   置いたあと、スタートから階段（ボス）とすべてのバトラー・宝箱の隣まで歩いて行けるか確かめ、行けなければ置き直す
 * 同じシード・同じ階なら必ず同じ階になる（中断して再開したときに作り直すため）
 */
export type FloorEntityKind = 'npc' | 'chest' | 'guardian' | 'boss';

export interface FloorEntity {
  /** 階ごとに一意の ID（例：f0-npc-1）。倒した・開けたの記録に使う */
  readonly id: string;
  readonly kind: FloorEntityKind;
  readonly x: number;
  readonly y: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface DungeonFloor {
  readonly index: number;
  readonly width: number;
  readonly height: number;
  /** '#'＝壁、'.'＝床 */
  readonly tiles: readonly string[];
  readonly start: Point;
  /** 下り階段（最後の階は null。代わりにボス） */
  readonly stairs: Point | null;
  readonly entities: readonly FloorEntity[];
}

export interface GenerateParams {
  readonly grid: number;
  readonly cell: number;
  readonly roomMin: number;
  readonly roomMax: number;
  readonly roomRate: number;
  readonly extraLinks: number;
  readonly npcsPerFloor: number;
  readonly chestsPerFloor: number;
  readonly guardiansPerFloor: number;
}

interface Room {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly cx: number;
  readonly cy: number;
}

/** 乱数の状態を持ち回すための小さな箱（この関数の中だけで使う） */
class Rng {
  constructor(public seed: number) {}
  int(max: number): number {
    const r = nextInt(this.seed, max);
    this.seed = r.seed;
    return r.value;
  }
  chance(p: number): boolean {
    const r = nextRandom(this.seed);
    this.seed = r.seed;
    return r.value < p;
  }
  range(min: number, max: number): number {
    return min + this.int(max - min + 1);
  }
}

/** 階ごとのシード（挑戦のシードと階の番号から） */
export function floorSeed(runSeed: number, floor: number): number {
  return (Math.imul(runSeed ^ 0x9e3779b9, 31) + (floor + 1) * 0x51ed27) | 0;
}

export function generateFloor(runSeed: number, floor: number, isLast: boolean, params: GenerateParams = DUNGEON_RUN): DungeonFloor {
  const rng = new Rng(floorSeed(runSeed, floor));
  const { grid, cell } = params;
  const width = grid * cell;
  const height = grid * cell;
  const map: string[][] = Array.from({ length: height }, () => Array<string>(width).fill('#'));
  const carve = (x: number, y: number): void => {
    if (x > 0 && y > 0 && x < width - 1 && y < height - 1) (map[y] as string[])[x] = '.';
  };

  // 区画ごとの部屋（または曲がり角の1マス）
  const rooms: Room[] = [];
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const ox = gx * cell + 1;
      const oy = gy * cell + 1;
      const inner = cell - 2;
      if (rng.chance(params.roomRate)) {
        const w = rng.range(params.roomMin, Math.min(params.roomMax, inner));
        const h = rng.range(params.roomMin, Math.min(params.roomMax, inner));
        const x = ox + rng.int(inner - w + 1);
        const y = oy + rng.int(inner - h + 1);
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) carve(xx, yy);
        rooms.push({ x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) });
      } else {
        const x = ox + rng.int(inner);
        const y = oy + rng.int(inner);
        carve(x, y);
        rooms.push({ x, y, w: 1, h: 1, cx: x, cy: y });
      }
    }
  }
  const roomAt = (gx: number, gy: number): Room => rooms[gy * grid + gx] as Room;

  // 区画のつなぎ方：迷路の木（全部つながる）＋回り道
  const linked = new Set<string>();
  const key = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const neighbors = (i: number): number[] => {
    const gx = i % grid;
    const gy = Math.floor(i / grid);
    const out: number[] = [];
    if (gx > 0) out.push(i - 1);
    if (gx < grid - 1) out.push(i + 1);
    if (gy > 0) out.push(i - grid);
    if (gy < grid - 1) out.push(i + grid);
    return out;
  };
  const visited = new Set<number>([rng.int(grid * grid)]);
  const stack = [...visited];
  while (stack.length > 0) {
    const cur = stack[stack.length - 1] as number;
    const open = neighbors(cur).filter((n) => !visited.has(n));
    if (open.length === 0) {
      stack.pop();
      continue;
    }
    const next = open[rng.int(open.length)] as number;
    linked.add(key(cur, next));
    visited.add(next);
    stack.push(next);
  }
  for (let tries = 0, added = 0; added < params.extraLinks && tries < 100; tries++) {
    const a = rng.int(grid * grid);
    const ns = neighbors(a);
    const b = ns[rng.int(ns.length)] as number;
    if (linked.has(key(a, b))) continue;
    linked.add(key(a, b));
    added++;
  }
  // L 字の通路で部屋の真ん中どうしをつなぐ
  for (const k of linked) {
    const [a, b] = k.split('-').map(Number) as [number, number];
    const ra = roomAt(a % grid, Math.floor(a / grid));
    const rb = roomAt(b % grid, Math.floor(b / grid));
    const horizontalFirst = rng.chance(0.5);
    const corner = horizontalFirst ? { x: rb.cx, y: ra.cy } : { x: ra.cx, y: rb.cy };
    const line = (p: Point, q: Point): void => {
      const dx = Math.sign(q.x - p.x);
      const dy = Math.sign(q.y - p.y);
      let x = p.x;
      let y = p.y;
      carve(x, y);
      while (x !== q.x || y !== q.y) {
        if (x !== q.x) x += dx;
        else y += dy;
        carve(x, y);
      }
    };
    line({ x: ra.cx, y: ra.cy }, corner);
    line(corner, { x: rb.cx, y: rb.cy });
  }

  const tiles = map.map((row) => row.join(''));
  const floorAt = (x: number, y: number): boolean => tiles[y]?.[x] === '.';

  // スタートと、いちばん遠い部屋（階段・ボス）
  const startRoom = rooms[rng.int(rooms.length)] as Room;
  const start = { x: startRoom.cx, y: startRoom.cy };
  const dist = bfs(tiles, start, () => false);
  const realRooms = rooms.filter((r) => r.w > 1 && r !== startRoom);
  const farthest = [...(realRooms.length > 0 ? realRooms : rooms)].sort(
    (p, q) => (dist.get(`${q.cx},${q.cy}`) ?? -1) - (dist.get(`${p.cx},${p.cy}`) ?? -1),
  )[0] as Room;
  const goal = { x: farthest.cx, y: farthest.cy };

  // 部屋の中の置き場所（スタートの部屋・ゴールのまわりは除く）
  const inRoom = (r: Room, p: Point): boolean => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
  const spots: Point[] = [];
  for (const r of rooms) {
    if (r === startRoom || r.w === 1) continue;
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (Math.abs(x - goal.x) <= 1 && Math.abs(y - goal.y) <= 1) continue;
        if (!inRoom(startRoom, { x, y }) && floorAt(x, y)) spots.push({ x, y });
      }
    }
  }

  const prefix = `f${floor}`;
  for (let attempt = 0; attempt < 30; attempt++) {
    const pool = [...spots];
    const take = (): Point | null => (pool.length === 0 ? null : (pool.splice(rng.int(pool.length), 1)[0] as Point));
    const entities: FloorEntity[] = [];
    const place = (kind: FloorEntityKind, count: number): void => {
      for (let i = 0; i < count; i++) {
        const p = take();
        if (p) entities.push({ id: `${prefix}-${kind}-${i + 1}`, kind, x: p.x, y: p.y });
      }
    };
    place('npc', params.npcsPerFloor);
    place('chest', params.chestsPerFloor);
    place('guardian', params.guardiansPerFloor);
    if (isLast) entities.push({ id: `${prefix}-boss`, kind: 'boss', x: goal.x, y: goal.y });
    const result: DungeonFloor = { index: floor, width, height, tiles, start, stairs: isLast ? null : goal, entities };
    if (isFloorReachable(result)) return result;
  }
  // 置けなかったとき（ほぼ起きない）：バトラー・宝箱を置かない
  const fallback: FloorEntity[] = isLast ? [{ id: `${prefix}-boss`, kind: 'boss', x: goal.x, y: goal.y }] : [];
  return { index: floor, width, height, tiles, start, stairs: isLast ? null : goal, entities: fallback };
}

/** 通れないもの（バトラー・宝箱・ボス）。見えない番人は姿がないので通れる */
export function blocksWay(e: FloorEntity): boolean {
  return e.kind !== 'guardian';
}

/** 床のマスを、通れない所を避けて広げたときの、各マスまでの歩数 */
export function bfs(tiles: readonly string[], from: Point, blocked: (x: number, y: number) => boolean): Map<string, number> {
  const dist = new Map<string, number>([[`${from.x},${from.y}`, 0]]);
  const queue: Point[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i] as Point;
    const d = dist.get(`${p.x},${p.y}`) as number;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const x = p.x + dx;
      const y = p.y + dy;
      const k = `${x},${y}`;
      if (dist.has(k) || tiles[y]?.[x] !== '.' || blocked(x, y)) continue;
      dist.set(k, d + 1);
      queue.push({ x, y });
    }
  }
  return dist;
}

/**
 * スタートから、階段（最後の階はボスの隣）と、すべてのバトラー・宝箱の隣まで、通れないものを避けて歩いて行けるか
 */
export function isFloorReachable(f: DungeonFloor): boolean {
  const blockers = new Set(f.entities.filter(blocksWay).map((e) => `${e.x},${e.y}`));
  const dist = bfs(f.tiles, f.start, (x, y) => blockers.has(`${x},${y}`));
  const nextTo = (p: Point): boolean =>
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => dist.has(`${p.x + (dx as number)},${p.y + (dy as number)}`));
  if (f.stairs && !dist.has(`${f.stairs.x},${f.stairs.y}`)) return false;
  return f.entities.filter(blocksWay).every(nextTo);
}
