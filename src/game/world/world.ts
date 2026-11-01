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

/** 人のまわりの範囲（マス）。数1つならたて・よこ同じ、{ x, y } ならよこ x マス・たて y マス */
export type NpcReach = number | { readonly x: number; readonly y: number };

/** (dx, dy) が範囲 r の中か */
export function inReach(dx: number, dy: number, r: NpcReach): boolean {
  const rx = typeof r === 'number' ? r : r.x;
  const ry = typeof r === 'number' ? r : r.y;
  return Math.abs(dx) <= rx && Math.abs(dy) <= ry;
}

/**
 * 人のまわりのマス（2026-10-24 改訂R2 フェーズ1）。正式な絵の街・部屋では人の絵がマスよりずっと大きく、
 * となりのマスまで近づくと主人公と人の絵が大きく重なった（ユーザーの動画 V3）。人から radius マス以内（たて・よこ・ななめ）を通れないことにする。
 * 2026-10-29 深夜（指示書 F）：人の絵の幅は約3マスあり、よこ1マスあけるだけでは横に並ぶと半分重なった。よことたてを別に決められる（NpcReach）
 */
export function isNearNpc(map: MapDefinition, x: number, y: number, isVisible: (obj: MapObject) => boolean, radius: NpcReach): boolean {
  if (typeof radius === 'number' ? radius <= 0 : radius.x <= 0 && radius.y <= 0) return false;
  return map.objects.some((o) => o.type === 'npc' && isVisible(o) && inReach(o.x - x, o.y - y, radius));
}

/** p から range の中（たて・よこ・ななめ）にいる、いちばん近い人。同じ近さなら向いている方の人 */
export function nearestNpc(
  map: MapDefinition,
  p: Point,
  isVisible: (obj: MapObject) => boolean,
  range: NpcReach,
  facing?: Direction,
): NpcObject | null {
  let best: NpcObject | null = null;
  let bestScore = Infinity;
  for (const o of map.objects) {
    if (o.type !== 'npc' || !isVisible(o)) continue;
    const dx = o.x - p.x;
    const dy = o.y - p.y;
    if (!inReach(dx, dy, range)) continue;
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
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
 * 曲がるたびに足す遠回り（マスの数。2026-11-01 指示書 AI【2】：案内で連れて歩く道が細かく曲がりすぎ〔ジグザグ〕だったので、
 * 曲がる回数を減らす。少し長くても「まっすぐ → 1〜2回曲がる」道を選ぶ）
 */
export const TURN_COST = 5;

/** 道を探すときの決まり（searchPath） */
interface SearchOptions {
  readonly steps: readonly Point[];
  readonly maxNodes: number;
  /** 道の真ん中・石畳を好む（街の案内） */
  readonly center: boolean;
  /** 曲がるたびに足す遠回り（マス） */
  readonly turnCost: number;
  /** 歩き始める前に向いている向き（steps の番号）。最初の1歩がこの向きでないときも1回曲がったと数える。-1 は数えない */
  readonly startDir: number;
}

/**
 * isGoal を満たすマスまでの、遠回りの重さが一番小さい道（start を含まない。見つからなければ null）。
 * 向き（最後に進んだ向き）ごとに数えるので、曲がった回数を重さに足せる
 */
function searchPath(
  map: MapDefinition,
  start: Point,
  isGoal: (x: number, y: number) => boolean,
  blocked: (x: number, y: number) => boolean,
  opt: SearchOptions,
): Point[] | null {
  if (isGoal(start.x, start.y)) return [];
  const { width, height } = mapSize(map);
  const wall = opt.center ? wallDistance(map) : null;
  const dirs = opt.steps.length;
  // 状態＝マス×（最後に進んだ向き＋1。0 は出発のとき）
  const per = dirs + 1;
  const startState = (start.y * width + start.x) * per + (opt.startDir >= 0 ? opt.startDir + 1 : 0);
  const cost = new Float64Array(width * height * per).fill(Infinity);
  const prev = new Int32Array(width * height * per).fill(-1);
  cost[startState] = 0;
  // 小さい順に取り出すヒープ（[コスト, 状態]）
  const heap: [number, number][] = [[0, startState]];
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
  while (heap.length > 0 && visited < opt.maxNodes) {
    const [c, st] = pop();
    if (c > (cost[st] as number)) continue;
    visited += 1;
    const k = Math.floor(st / per);
    const lastDir = (st % per) - 1;
    const x = k % width;
    const y = (k - x) / width;
    if (st !== startState && isGoal(x, y)) {
      const path: Point[] = [];
      for (let p = st; p !== startState; p = prev[p] as number) {
        const pk = Math.floor(p / per);
        path.unshift({ x: pk % width, y: Math.floor(pk / width) });
      }
      return path;
    }
    for (let di = 0; di < dirs; di++) {
      const d = opt.steps[di] as Point;
      const nx = x + d.x;
      const ny = y + d.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || !canStep({ x, y }, d.x, d.y, blocked)) continue;
      const nk = ny * width + nx;
      let nc = c + Math.hypot(d.x, d.y);
      if (wall) nc += CENTER_WEIGHT * (CENTER_CAP - (wall[nk] as number)) + (tileAt(map, nx, ny) === ',' ? OFFROAD_WEIGHT : 0);
      if (lastDir >= 0 && lastDir !== di) nc += opt.turnCost;
      const ns = nk * per + di + 1;
      if (nc < (cost[ns] as number)) {
        cost[ns] = nc;
        prev[ns] = st;
        push([nc, ns]);
      }
    }
  }
  return null;
}

/**
 * isGoal までの経路で、道の真ん中を通るもの（2026-10-28 点検：ユーザー「チュートリアルで練習所に行くとき道の真ん中を歩かせたい」）。
 * 道の端（歩けないマスの近く）のマスと草地は遠回りに数えるので、少し長くても石畳の道の真ん中を通る。案内で連れて歩くときに使う。
 * 2026-11-01 指示書 AI【2】：曲がるたびに turnCost マス分を足す（ジグザグにならず、まっすぐ → 1〜2回曲がる道）
 */
export function findPathCentered(
  map: MapDefinition,
  start: Point,
  isGoal: (x: number, y: number) => boolean,
  blocked: (x: number, y: number) => boolean,
  steps: readonly Point[] = STEPS_4,
  maxNodes = 240000,
  turnCost = TURN_COST,
): Point[] | null {
  return searchPath(map, start, isGoal, blocked, { steps, maxNodes, center: true, turnCost, startDir: -1 });
}

/**
 * isGoal までの、曲がる回数の少ない短い道（部屋の中で人の前まで連れて歩くとき。道の真ん中は気にしない）。
 * facing（いま向いている向き）を渡すと、その向きにまっすぐ歩き出す道を先に選ぶ（入口から入って奥を向いているときは、まず上へ）。
 * 2026-11-01 指示書 AI【1】【2】：練習場の入口 → 先生の前、管理局の入口 → 受付の前
 */
export function findPathStraight(
  map: MapDefinition,
  start: Point,
  isGoal: (x: number, y: number) => boolean,
  blocked: (x: number, y: number) => boolean,
  facing?: Direction,
  steps: readonly Point[] = STEPS_4,
  turnCost = TURN_COST,
): Point[] | null {
  const f = facing ? DIR_DELTA[facing] : null;
  const startDir = f ? steps.findIndex((d) => d.x === f.x && d.y === f.y) : -1;
  return searchPath(map, start, isGoal, blocked, { steps, maxNodes: 60000, center: false, turnCost, startDir });
}

/** 道の曲がった回数（向きが変わった回数。start から path の順に歩いたとき） */
export function countTurns(start: Point, path: readonly Point[]): number {
  let turns = 0;
  let last: string | null = null;
  let prev = start;
  for (const p of path) {
    const dir = `${p.x - prev.x},${p.y - prev.y}`;
    if (last !== null && dir !== last) turns += 1;
    last = dir;
    prev = p;
  }
  return turns;
}

/**
 * 練習場の先生の前（話せる近さで、先生の絵に重ならない所）。先生の左右 3マス・同じ高さから2マス手前まで。
 * 左（主人公が入口から入ってくる側）を先に探し、無ければ右（2026-11-01 指示書 AI【1】：先生を机の右へ動かした。ミレイユは先生の右）
 */
export function teacherSideGoal(teacher: Point, side: -1 | 1 | 0, reachX = 3, reachY = 2): (x: number, y: number) => boolean {
  return (x, y) => (side === 0 ? Math.abs(x - teacher.x) === reachX : x === teacher.x + side * reachX) && y >= teacher.y && y <= teacher.y + reachY;
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

/**
 * 名札（家具の調べる範囲の上のはしの真ん中）が、その家具の奥・上に立つ人の絵にかかるときは、人のとなり（人から遠いほうの側）へずらす。
 * 人の絵は足元のマス（npc.x・y と drawDx・drawDy）から上へ約5マス・左右に約2.5マス。返り値は名札の真ん中の x（マス）。かからなければ null（真ん中のまま）
 */
export function labelCenterAwayFromPeople(obj: { x: number; y: number; w: number; h: number }, objects: readonly MapObject[], labelDy = 0): number | null {
  const top = obj.y + labelDy;
  const mid = obj.x + obj.w / 2;
  for (const o of objects) {
    if (o.type !== 'npc') continue;
    const cx = o.x + (o.drawDx ?? 0) + 0.5;
    const foot = o.y + (o.drawDy ?? 0) + 1;
    // 名札：上のはしの ±1 マス・真ん中から ±3 マス
    const overlapX = Math.abs(cx - mid) < 3 + 2.5;
    const overlapY = top + 1 > foot - 5 && top - 1 < foot;
    if (!overlapX || !overlapY) continue;
    // 人の絵のはし（±2.5）から名札の半分（3）だけ離した所。家具の範囲の中におさめる
    const away = cx >= mid ? cx - 5.5 : cx + 5.5;
    return Math.min(obj.x + obj.w - 1, Math.max(obj.x + 1, away));
  }
  return null;
}
