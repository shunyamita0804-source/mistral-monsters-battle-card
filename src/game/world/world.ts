import { TILE_INFO, type MapDefinition, type MapObject, type NpcObject } from '../../data/maps.ts';
import type { Direction } from '../save/saveData.ts';

/** 歩行マップの当たり判定・経路探索（DOM 非依存） */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export const DIR_DELTA: Readonly<Record<Direction, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function mapSize(map: MapDefinition): { width: number; height: number } {
  return { width: map.tiles[0]?.length ?? 0, height: map.tiles.length };
}

export function tileAt(map: MapDefinition, x: number, y: number): string {
  return map.tiles[y]?.[x] ?? '#';
}

export function isSolidTile(tile: string): boolean {
  return TILE_INFO[tile]?.solid ?? true;
}

export function objectCovers(obj: MapObject, x: number, y: number): boolean {
  if (obj.type === 'enemy' || obj.type === 'chest') return obj.x === x && obj.y === y;
  return x >= obj.x && x < obj.x + obj.w && y >= obj.y && y < obj.y + obj.h;
}

/** そのマスにある物（表示中のものだけ） */
export function objectsAt(
  map: MapDefinition,
  x: number,
  y: number,
  isVisible: (obj: MapObject) => boolean = () => true,
): MapObject[] {
  return map.objects.filter((o) => isVisible(o) && objectCovers(o, x, y));
}

/** 通れないマスか。敵・宝箱・人は表示中なら通れない（敵は接触でバトル） */
export function isBlocked(map: MapDefinition, x: number, y: number, isVisible: (obj: MapObject) => boolean): boolean {
  if (isSolidTile(tileAt(map, x, y))) return true;
  return objectsAt(map, x, y, isVisible).some((o) => o.type === 'enemy' || o.type === 'chest' || o.type === 'npc');
}

/**
 * 人のまわりのマス（2026-10-24 改訂R2 フェーズ1）。正式な絵の街・部屋では人の絵がマスよりずっと大きく、
 * となりのマスまで近づくと主人公と人の絵が大きく重なった（ユーザーの動画 V3）。人から radius マス以内（たて・よこ・ななめ）を通れないことにする
 */
export function isNearNpc(map: MapDefinition, x: number, y: number, isVisible: (obj: MapObject) => boolean, radius: number): boolean {
  if (radius <= 0) return false;
  return map.objects.some((o) => o.type === 'npc' && isVisible(o) && Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) <= radius);
}

/** p から range マス以内（たて・よこ・ななめ）にいる、いちばん近い人。同じ近さなら向いている方の人 */
export function nearestNpc(
  map: MapDefinition,
  p: Point,
  isVisible: (obj: MapObject) => boolean,
  range: number,
  facing?: Direction,
): NpcObject | null {
  let best: NpcObject | null = null;
  let bestScore = Infinity;
  for (const o of map.objects) {
    if (o.type !== 'npc' || !isVisible(o)) continue;
    const dx = o.x - p.x;
    const dy = o.y - p.y;
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    if (dist > range) continue;
    // 向いている方の人を少し優先（同じ近さのとき）
    const f = facing ? DIR_DELTA[facing] : { x: 0, y: 0 };
    const score = dist * 10 + Math.hypot(dx, dy) - (dx * f.x + dy * f.y > 0 ? 0.5 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

export function directionBetween(from: Point, to: Point): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** 8方向の1歩（斜めは、角をすり抜けないように縦・横の両方が通れるときだけ） */
export const STEPS: readonly Point[] = [
  DIR_DELTA.up, DIR_DELTA.down, DIR_DELTA.left, DIR_DELTA.right,
  { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 },
];

/** 上下左右だけ（導入イベントで一緒に歩くとき。主人公の操作と同じく斜めには進まない） */
export const STEPS_4: readonly Point[] = STEPS.slice(0, 4);

/** from から (dx, dy) へ1歩進めるか（斜めは角のすり抜けをしない） */
export function canStep(from: Point, dx: number, dy: number, blocked: (x: number, y: number) => boolean): boolean {
  if (blocked(from.x + dx, from.y + dy)) return false;
  if (dx !== 0 && dy !== 0) return !blocked(from.x + dx, from.y) && !blocked(from.x, from.y + dy);
  return true;
}

/**
 * 8方向の幅優先探索で、isGoal を満たす最も近いマスまでの経路を探す（start を含まない）。見つからなければ null。
 * 斜めは角をすり抜けない。同じ歩数なら縦横を先に選ぶ。
 */
export function findPathWhere(
  map: MapDefinition,
  start: Point,
  isGoal: (x: number, y: number) => boolean,
  blocked: (x: number, y: number) => boolean,
  maxNodes = 40000,
  steps: readonly Point[] = STEPS,
): Point[] | null {
  const { width, height } = mapSize(map);
  if (isGoal(start.x, start.y)) return [];
  const key = (x: number, y: number): number => y * width + x;
  const prev = new Map<number, number>();
  prev.set(key(start.x, start.y), -1);
  const queue: Point[] = [start];
  let head = 0;
  while (head < queue.length && head < maxNodes) {
    const cur = queue[head++] as Point;
    for (const d of steps) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const k = key(nx, ny);
      if (prev.has(k) || !canStep(cur, d.x, d.y, blocked)) continue;
      prev.set(k, key(cur.x, cur.y));
      if (isGoal(nx, ny)) {
        const path: Point[] = [];
        let c = k;
        while (c !== key(start.x, start.y)) {
          path.unshift({ x: c % width, y: Math.floor(c / width) });
          c = prev.get(c) as number;
        }
        return path;
      }
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

/** 道の真ん中を好む経路：端からこのマス数より近いと遠回りに数える（findPathCentered） */
const CENTER_CAP = 4;
const CENTER_WEIGHT = 0.8;
/** 道の外（草 ','）のマスの遠回りの重さ。案内は草地を横切らず、石畳の道を通る */
const OFFROAD_WEIGHT = 6;
const wallDistCache = new WeakMap<MapDefinition, Uint8Array>();

/** 歩けるマスごとの、いちばん近い歩けないマス（地図の地形だけ）までの歩数（4方向。CENTER_CAP まで） */
function wallDistance(map: MapDefinition): Uint8Array {
  const cached = wallDistCache.get(map);
  if (cached) return cached;
  const { width, height } = mapSize(map);
  const dist = new Uint8Array(width * height).fill(CENTER_CAP);
  const queue: number[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (isSolidTile(tileAt(map, x, y))) {
        dist[y * width + x] = 0;
        queue.push(y * width + x);
      }
  for (let head = 0; head < queue.length; head++) {
    const k = queue[head] as number;
    const d = (dist[k] as number) + 1;
    if (d >= CENTER_CAP) continue;
    const x = k % width;
    const y = (k - x) / width;
    for (const s of STEPS_4) {
      const nx = x + s.x;
      const ny = y + s.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nk = ny * width + nx;
      if ((dist[nk] as number) > d) {
        dist[nk] = d;
        queue.push(nk);
      }
    }
  }
  wallDistCache.set(map, dist);
  return dist;
}

/**
 * isGoal までの経路で、道の真ん中を通るもの（2026-10-28 点検：ユーザー「チュートリアルで練習所に行くとき道の真ん中を歩かせたい」）。
 * 道の端（歩けないマスの近く）のマスと草地は遠回りに数えるので、少し長くても石畳の道の真ん中を通る。案内で連れて歩くときに使う
 */
export function findPathCentered(
  map: MapDefinition,
  start: Point,
  isGoal: (x: number, y: number) => boolean,
  blocked: (x: number, y: number) => boolean,
  steps: readonly Point[] = STEPS_4,
  maxNodes = 120000,
): Point[] | null {
  if (isGoal(start.x, start.y)) return [];
  const { width, height } = mapSize(map);
  const wall = wallDistance(map);
  const startKey = start.y * width + start.x;
  const cost = new Float64Array(width * height).fill(Infinity);
  const prev = new Int32Array(width * height).fill(-1);
  cost[startKey] = 0;
  // 小さい順に取り出すヒープ（[コスト, マス]）
  const heap: [number, number][] = [[0, startKey]];
  const push = (item: [number, number]): void => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((heap[p] as [number, number])[0] <= item[0]) break;
      heap[i] = heap[p] as [number, number];
      i = p;
    }
    heap[i] = item;
  };
  const pop = (): [number, number] => {
    const top = heap[0] as [number, number];
    const last = heap.pop() as [number, number];
    if (heap.length > 0) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && (heap[l] as [number, number])[0] < (m === i ? last[0] : (heap[m] as [number, number])[0])) m = l;
        if (r < heap.length && (heap[r] as [number, number])[0] < (m === i ? last[0] : (heap[m] as [number, number])[0])) m = r;
        if (m === i) break;
        heap[i] = heap[m] as [number, number];
        i = m;
      }
      heap[i] = last;
    }
    return top;
  };
  let visited = 0;
  while (heap.length > 0 && visited < maxNodes) {
    const [c, k] = pop();
    if (c > (cost[k] as number)) continue;
    visited += 1;
    const x = k % width;
    const y = (k - x) / width;
    if (k !== startKey && isGoal(x, y)) {
      const path: Point[] = [];
      for (let p = k; p !== startKey; p = prev[p] as number) path.unshift({ x: p % width, y: Math.floor(p / width) });
      return path;
    }
    for (const d of steps) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || !canStep({ x, y }, d.x, d.y, blocked)) continue;
      const nk = ny * width + nx;
      const offroad = tileAt(map, nx, ny) === ',' ? OFFROAD_WEIGHT : 0;
      const nc = c + Math.hypot(d.x, d.y) + CENTER_WEIGHT * (CENTER_CAP - (wall[nk] as number)) + offroad;
      if (nc < (cost[nk] as number)) {
        cost[nk] = nc;
        prev[nk] = k;
        push([nc, nk]);
      }
    }
  }
  return null;
}

/**
 * goal までの経路（start を含まない）。
 * goal が通れないマス（家具・敵など）のときは、その隣まで行く経路を返す。見つからなければ null。
 */
export function findPath(
  map: MapDefinition,
  start: Point,
  goal: Point,
  blocked: (x: number, y: number) => boolean,
  maxNodes = 40000,
): Point[] | null {
  const { width, height } = mapSize(map);
  if (goal.x < 0 || goal.y < 0 || goal.x >= width || goal.y >= height) return null;
  const goalBlocked = blocked(goal.x, goal.y);
  const isGoal = (x: number, y: number): boolean =>
    goalBlocked ? Math.abs(x - goal.x) + Math.abs(y - goal.y) === 1 : x === goal.x && y === goal.y;
  return findPathWhere(map, start, isGoal, blocked, maxNodes);
}

/** 物（複数マスの家具など）のどこかに隣接するマスへ行く経路 */
export function findPathToObject(
  map: MapDefinition,
  start: Point,
  obj: MapObject,
  blocked: (x: number, y: number) => boolean,
): Point[] | null {
  const touches = (x: number, y: number): boolean =>
    !objectCovers(obj, x, y) &&
    [DIR_DELTA.up, DIR_DELTA.down, DIR_DELTA.left, DIR_DELTA.right].some((d) => objectCovers(obj, x + d.x, y + d.y));
  return findPathWhere(map, start, touches, blocked);
}

/** p に隣接する、物の中のマス（向く方向を決めるのに使う） */
export function adjacentCellOf(obj: MapObject, p: Point): Point | null {
  for (const d of [DIR_DELTA.up, DIR_DELTA.down, DIR_DELTA.left, DIR_DELTA.right]) {
    if (objectCovers(obj, p.x + d.x, p.y + d.y)) return { x: p.x + d.x, y: p.y + d.y };
  }
  return null;
}

/** start から到達できるマスの集合（テスト・進行不能チェック用） */
export function reachable(map: MapDefinition, start: Point, blocked: (x: number, y: number) => boolean): Set<string> {
  const { width, height } = mapSize(map);
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const queue: Point[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift() as Point;
    for (const d of Object.values(DIR_DELTA)) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen.has(k) || blocked(nx, ny)) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}
