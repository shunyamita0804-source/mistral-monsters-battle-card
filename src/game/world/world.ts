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
