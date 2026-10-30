import { DUNGEON_RUN, type DungeonGimmick } from '../../data/dungeonRun.ts';
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
 *
 * 2026-10-27 指示書「ダンジョン7つ」の仕掛け（gimmick。仕掛けの無いダンジョンは今までと同じ乱数の使い方で、同じ階になる）：
 * - water：部屋を横切る水路（'w'。通れない）。水路のせいで行けない床ができるなら、その水路は作らない
 * - ice：部屋の床を氷（'i'）に。氷は乗るとすべる（run.ts の slide）。すべって止まる所だけを「行ける所」として確かめる
 * - switch：階段（最後の階はボス）の部屋の入口をすべて閉じた扉（'D'）にし、扉の手前から行ける所にスイッチを置く
 * - wind（2026-10-30 指示書 U・風の渓谷）：決まった向きの強い風のマス（'>' '<' '^' 'v'）を1階に4〜8か所。乗ると風の向きに2マス押し流される（slide）。
 *   押し流された先がまた風のマスなら、もう一度流される。輪にならない置き方・押し流されても階段とボスへ必ず行ける置き方だけを残す
 */
export type FloorEntityKind = 'npc' | 'chest' | 'guardian' | 'boss' | 'switch';

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
  /** '#'＝壁、'.'＝床、'w'＝水路（通れない）、'i'＝氷（すべる）、'D'＝扉（スイッチで開く）、'>' '<' '^' 'v'＝強い風のマス（その向きに押し流す） */
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

/** 【仮】仕掛けの量（部屋に水路・氷を作る割合） */
const WATER_ROOM_RATE = 0.7;
const ICE_ROOM_RATE = 0.6;
/** 【仮】風のマスの数（1階に min〜max か所）・押し流すマスの数（2026-10-30 指示書 U） */
export const WIND_TILES = { min: 4, max: 8 } as const;
export const WIND_PUSH = 2;

/** 風のマスの向き（文字 → 1マスの動き） */
export const WIND_DIRS: Readonly<Record<string, Point>> = { '>': { x: 1, y: 0 }, '<': { x: -1, y: 0 }, '^': { x: 0, y: -1 }, v: { x: 0, y: 1 } };

/** 強い風のマスか（風の渓谷） */
export function isWindTile(ch: string | undefined): boolean {
  return ch !== undefined && ch in WIND_DIRS;
}

/** 歩けるマスか（扉は開いているときだけ） */
export function isWalkableTile(ch: string | undefined, doorsOpen = true): boolean {
  return ch === '.' || ch === 'i' || (ch === 'D' && doorsOpen) || isWindTile(ch);
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * 1歩：dir の向きに進む。氷の上では、壁・通れないもの・氷でないマスにぶつかるまで進み続ける（氷でないマスに乗ったらそこで止まる）。
 * 進めなければ null。blocked は人や物（バトラー・宝箱・スイッチ・ボス）のマス。
 * 風のマス（風の渓谷）に乗ったら、風の向きに WIND_PUSH マス押し流す（windPush。stairs＝階段のマスの手前でも止まる）
 */
export function slide(
  tiles: readonly string[],
  from: Point,
  dx: number,
  dy: number,
  blocked: (x: number, y: number) => boolean,
  doorsOpen = true,
  stairs: Point | null = null,
): Point[] | null {
  let x = from.x + dx;
  let y = from.y + dy;
  if (!isWalkableTile(tiles[y]?.[x], doorsOpen) || blocked(x, y)) return null;
  const path: Point[] = [{ x, y }];
  while (tiles[y]?.[x] === 'i') {
    const nx = x + dx;
    const ny = y + dy;
    if (!isWalkableTile(tiles[ny]?.[nx], doorsOpen) || blocked(nx, ny)) break;
    x = nx;
    y = ny;
    path.push({ x, y });
  }
  return windPush(tiles, path, blocked, doorsOpen, stairs);
}

/**
 * 風のマス at から1回押し流された道（at は入れない）。風の向きに WIND_PUSH マスまで。
 * 途中に壁・通れないもの・人や物（blocked）・階段（stairs）があれば、その手前で止まる（1マスも動けなければ空）
 */
function windStep(tiles: readonly string[], at: Point, blocked: (x: number, y: number) => boolean, doorsOpen: boolean, stairs: Point | null): Point[] {
  const wind = WIND_DIRS[tiles[at.y]?.[at.x] ?? ''];
  if (!wind) return [];
  const out: Point[] = [];
  let { x, y } = at;
  for (let i = 0; i < WIND_PUSH; i++) {
    const nx = x + wind.x;
    const ny = y + wind.y;
    if (!isWalkableTile(tiles[ny]?.[nx], doorsOpen) || blocked(nx, ny) || (stairs !== null && stairs.x === nx && stairs.y === ny)) break;
    x = nx;
    y = ny;
    out.push({ x, y });
  }
  return out;
}

/**
 * 強い風のマス（2026-10-30 指示書 U）：path の最後が風のマスなら、風の向きに押し流す（windStep）。押し流された先がまた風のマスなら、そのマスの風でもう一度。
 * 同じ風のマスに2度来たら（輪。作るときに輪にならない置き方にしているので、ふつうは起きない）そこで止まる
 */
export function windPush(
  tiles: readonly string[],
  path: Point[],
  blocked: (x: number, y: number) => boolean,
  doorsOpen = true,
  stairs: Point | null = null,
): Point[] {
  const seen = new Set<string>();
  for (;;) {
    const at = path[path.length - 1] as Point;
    if (!isWindTile(tiles[at.y]?.[at.x]) || seen.has(`${at.x},${at.y}`)) return path;
    seen.add(`${at.x},${at.y}`);
    const step = windStep(tiles, at, blocked, doorsOpen, stairs);
    if (step.length === 0) return path;
    path.push(...step);
  }
}

/** どこかの風のマスから押し流される先をたどると、同じ風のマスに戻ってくる（輪になる）か */
export function windLoops(tiles: readonly string[], blocked: (x: number, y: number) => boolean, stairs: Point | null = null): boolean {
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < (tiles[y]?.length ?? 0); x++) {
      const seen = new Set<string>();
      let at: Point = { x, y };
      while (isWindTile(tiles[at.y]?.[at.x])) {
        const k = `${at.x},${at.y}`;
        if (seen.has(k)) return true;
        seen.add(k);
        const step = windStep(tiles, at, blocked, true, stairs);
        if (step.length === 0) break;
        at = step[step.length - 1] as Point;
      }
    }
  }
  return false;
}

/** すべる床・風のマスも考えて、止まれるマスまでの歩数（氷・風のない階ではふつうの歩数と同じ） */
export function reachable(
  tiles: readonly string[],
  from: Point,
  blocked: (x: number, y: number) => boolean,
  doorsOpen = true,
  stairs: Point | null = null,
): Map<string, number> {
  const dist = new Map<string, number>([[`${from.x},${from.y}`, 0]]);
  const queue: Point[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i] as Point;
    const d = dist.get(`${p.x},${p.y}`) as number;
    for (const [dx, dy] of DIRS) {
      const path = slide(tiles, p, dx, dy, blocked, doorsOpen, stairs);
      const end = path?.[path.length - 1];
      if (!end || dist.has(`${end.x},${end.y}`)) continue;
      dist.set(`${end.x},${end.y}`, d + 1);
      queue.push(end);
    }
  }
  return dist;
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

export function generateFloor(runSeed: number, floor: number, isLast: boolean, params: GenerateParams = DUNGEON_RUN, gimmick: DungeonGimmick = 'none'): DungeonFloor {
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

  let tiles = map.map((row) => row.join(''));
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

  // 仕掛け（ダンジョンごとに1つ）。仕掛けの無いダンジョンは乱数を使わない（今までと同じ階になる）
  const set = (grid2: string[][], x: number, y: number, ch: string): void => {
    (grid2[y] as string[])[x] = ch;
  };
  // 風に押し流されても階段の上には止まらない（階段の手前で止まる）。最後の階は階段がない
  const stairsAt = isLast ? null : goal;
  const allFloorReachable = (t: readonly string[]): boolean => {
    const dist = reachable(t, start, () => false, true, stairsAt);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (t[y]?.[x] === '.' && !dist.has(`${x},${y}`)) return false;
    return true;
  };
  const isGoalRoom = (r: Room): boolean => r === farthest;
  if (gimmick === 'water' || gimmick === 'ice') {
    for (const r of rooms) {
      if (r.w < 3 || r.h < 3 || r === startRoom || isGoalRoom(r)) continue;
      if (!rng.chance(gimmick === 'water' ? WATER_ROOM_RATE : ICE_ROOM_RATE)) continue;
      const trial = tiles.map((row) => row.split(''));
      if (gimmick === 'water') {
        // 部屋を横切る水路（横か縦。部屋の真ん中の行・列は通路が通るので避ける）
        const across = rng.chance(0.5);
        const lines = across ? range(r.y, r.h).filter((y) => y !== r.cy) : range(r.x, r.w).filter((x) => x !== r.cx);
        const at = lines[rng.int(lines.length)] as number;
        for (let i = 0; i < (across ? r.w : r.h); i++) set(trial, across ? r.x + i : at, across ? at : r.y + i, 'w');
      } else {
        // 部屋の床を氷に（ふちの1マスは残すこともある）
        const edge = rng.chance(0.5) ? 1 : 0;
        for (let y = r.y + edge; y < r.y + r.h - edge; y++) for (let x = r.x + edge; x < r.x + r.w - edge; x++) set(trial, x, y, 'i');
      }
      const next = trial.map((row) => row.join(''));
      if (allFloorReachable(next)) tiles = next;
    }
  }
  // 強い風のマス（風の渓谷）：床のマス（スタート・階段〔ボス〕のマスは除く）に、決まった向きの風を置く。
  // 押し流す先が1マス以上あり、置いたあとも全部の床へ行けて（押し流されても止まれる所として）、輪にならないものだけ残す
  if (gimmick === 'wind') {
    const want = rng.range(WIND_TILES.min, WIND_TILES.max);
    const kinds = Object.keys(WIND_DIRS);
    const candidates: Point[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tiles[y]?.[x] !== '.' || (x === start.x && y === start.y) || (x === goal.x && y === goal.y)) continue;
        candidates.push({ x, y });
      }
    }
    let placed = 0;
    for (let tries = 0; placed < want && tries < 200 && candidates.length > 0; tries++) {
      const p = candidates.splice(rng.int(candidates.length), 1)[0] as Point;
      const ch = kinds[rng.int(kinds.length)] as string;
      const d = WIND_DIRS[ch] as Point;
      if (tiles[p.y + d.y]?.[p.x + d.x] !== '.' || (stairsAt && stairsAt.x === p.x + d.x && stairsAt.y === p.y + d.y)) continue;
      const trial = tiles.map((row) => row.split(''));
      set(trial, p.x, p.y, ch);
      const next = trial.map((row) => row.join(''));
      if (!allFloorReachable(next) || windLoops(next, () => false, stairsAt)) continue;
      tiles = next;
      placed++;
    }
  }
  // 扉：階段・ボスの部屋の入口（部屋のすぐ外の床）をすべて扉にする
  const goalRoomCells = new Set<string>();
  for (let y = farthest.y; y < farthest.y + farthest.h; y++) for (let x = farthest.x; x < farthest.x + farthest.w; x++) goalRoomCells.add(`${x},${y}`);
  const doors: Point[] = [];
  if (gimmick === 'switch') {
    const grid2 = tiles.map((row) => row.split(''));
    for (const key2 of goalRoomCells) {
      const [x, y] = key2.split(',').map(Number) as [number, number];
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (goalRoomCells.has(`${nx},${ny}`) || tiles[ny]?.[nx] !== '.') continue;
        set(grid2, nx, ny, 'D');
        doors.push({ x: nx, y: ny });
      }
    }
    tiles = grid2.map((row) => row.join(''));
  }

  // 部屋の中の置き場所（スタートの部屋・ゴールのまわりは除く）
  const inRoom = (r: Room, p: Point): boolean => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
  const spots: Point[] = [];
  for (const r of rooms) {
    if (r === startRoom || r.w === 1 || (gimmick === 'switch' && isGoalRoom(r))) continue;
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
    // スイッチ：扉を閉じたままで行ける所（いちばん先に置く）
    if (gimmick === 'switch') {
      const closed = reachable(tiles, start, () => false, false);
      const options = pool.filter((p) => closed.has(`${p.x},${p.y}`));
      if (options.length > 0) {
        const p = options[rng.int(options.length)] as Point;
        pool.splice(pool.indexOf(p), 1);
        entities.push({ id: `${prefix}-switch`, kind: 'switch', x: p.x, y: p.y });
      }
    }
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
    if (isFloorReachable(result) && (gimmick !== 'switch' || isSwitchReachable(result)) && (gimmick !== 'wind' || !hasWindLoop(result))) return result;
  }
  // 置けなかったとき（ほぼ起きない）：バトラー・宝箱を置かない。扉もやめる（スイッチが無いと開けられないため）
  const fallback: FloorEntity[] = isLast ? [{ id: `${prefix}-boss`, kind: 'boss', x: goal.x, y: goal.y }] : [];
  const openTiles = doors.length > 0 ? tiles.map((row) => row.replaceAll('D', '.')) : tiles;
  return { index: floor, width, height, tiles: openTiles, start, stairs: isLast ? null : goal, entities: fallback };
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
 * スタートから、階段（最後の階はボスの隣）と、すべてのバトラー・宝箱・スイッチの隣まで、通れないものを避けて歩いて行けるか
 * （すべる床ではすべって止まれる所だけ。扉は開いているとして）
 */
export function isFloorReachable(f: DungeonFloor): boolean {
  const blockers = new Set(f.entities.filter(blocksWay).map((e) => `${e.x},${e.y}`));
  const dist = reachable(f.tiles, f.start, (x, y) => blockers.has(`${x},${y}`), true, f.stairs);
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

/** 人や物を置いたあとの階で、風のマスが輪になっていないか（風の渓谷。人や物の手前で止まると行き先が変わるので、置いたあとにも確かめる） */
export function hasWindLoop(f: DungeonFloor): boolean {
  const blockers = new Set(f.entities.filter(blocksWay).map((e) => `${e.x},${e.y}`));
  return windLoops(f.tiles, (x, y) => blockers.has(`${x},${y}`), f.stairs);
}

/** 扉を閉じたままで、スイッチの隣まで行けるか（機械の塔。必ず解ける） */
export function isSwitchReachable(f: DungeonFloor): boolean {
  const sw = f.entities.find((e) => e.kind === 'switch');
  if (!sw) return !f.tiles.some((row) => row.includes('D'));
  const blockers = new Set(f.entities.filter(blocksWay).map((e) => `${e.x},${e.y}`));
  const dist = reachable(f.tiles, f.start, (x, y) => blockers.has(`${x},${y}`), false);
  return DIRS.some(([dx, dy]) => dist.has(`${sw.x + dx},${sw.y + dy}`));
}

function range(from: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => from + i);
}
