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
 * - switch（機械の塔。2026-11-05 指示書 BD で「切り替えの扉」に作り直し）：赤の扉（'R'）と青の扉（'B'）。開いているのはどちらか一方の色だけで、
 *   スイッチを押すたびに入れかわる（階に入ったときは赤が開いている）。1・2階はスイッチ1つ・1回の切り替えでゴールへ。
 *   3〜5階はスイッチ2〜3つ・扉4〜6か所・ゴールまで2回以上の切り替え。「いる場所 × 開いている色」で調べて、必ずゴールへ行ける置き方だけを残す（switchPuzzle）
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
  /** '#'＝壁、'.'＝床、'w'＝水路（通れない）、'i'＝氷（すべる）、'R'＝赤の扉・'B'＝青の扉（開いている色だけ通れる。機械の塔）、'>' '<' '^' 'v'＝強い風のマス（その向きに押し流す） */
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
/** 1〜2階の風のマスの数（2026-11-02 指示書 AT：風の渓谷が最初のダンジョンになったので、初めての人が迷わないよう少なめ） */
export const WIND_TILES_EARLY = { min: 2, max: 4 } as const;
/** 風のマスを少なめにする階の数（0＝1階・1＝2階） */
export const WIND_EARLY_FLOORS = 2;
export const WIND_PUSH = 2;

/** 風のマスの向き（文字 → 1マスの動き） */
export const WIND_DIRS: Readonly<Record<string, Point>> = { '>': { x: 1, y: 0 }, '<': { x: -1, y: 0 }, '^': { x: 0, y: -1 }, v: { x: 0, y: 1 } };

/** 強い風のマスか（風の渓谷） */
export function isWindTile(ch: string | undefined): boolean {
  return ch !== undefined && ch in WIND_DIRS;
}

/** 扉の色（機械の塔。2026-11-05 指示書 BD） */
export type DoorColor = 'red' | 'blue';

/**
 * どの扉が開いているか：'red'／'blue'＝その色だけ・'all'＝全部（形を調べるとき）・'none'＝全部閉じている。
 * true は 'all'、false は 'none' と同じ（前の書き方）
 */
export type DoorsOpen = DoorColor | 'all' | 'none' | boolean;

/** 扉のマスの文字 → 色 */
export const DOOR_TILES: Readonly<Record<string, DoorColor>> = { R: 'red', B: 'blue' };

/** 扉のマスか */
export function isDoorTile(ch: string | undefined): boolean {
  return ch !== undefined && ch in DOOR_TILES;
}

/** 歩けるマスか（扉は開いている色のときだけ） */
export function isWalkableTile(ch: string | undefined, doors: DoorsOpen = 'all'): boolean {
  if (ch === '.' || ch === 'i' || isWindTile(ch)) return true;
  const color = ch === undefined ? undefined : DOOR_TILES[ch];
  if (!color) return false;
  return doors === true || doors === 'all' || doors === color;
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
  doorsOpen: DoorsOpen = 'all',
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
function windStep(tiles: readonly string[], at: Point, blocked: (x: number, y: number) => boolean, doorsOpen: DoorsOpen, stairs: Point | null): Point[] {
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
  doorsOpen: DoorsOpen = 'all',
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
  doorsOpen: DoorsOpen = 'all',
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
    const count = floor < WIND_EARLY_FLOORS ? WIND_TILES_EARLY : WIND_TILES;
    const want = rng.range(count.min, count.max);
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
  // 機械の塔（2026-11-05 指示書 BD）：赤と青の扉の置き方の候補（通路のマスだけを扉にする。部屋のマスは扉にしない）
  const roomCells = new Set<string>();
  for (const r of rooms) if (r.w > 1) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) roomCells.add(`${x},${y}`);
  const roomSet = (r: Room): Set<string> => {
    const out = new Set<string>();
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.add(`${x},${y}`);
    return out;
  };
  const early = floor < SWITCH_EARLY_FLOORS;
  const plans: Map<string, DoorColor>[] = [];
  if (gimmick === 'switch') {
    const goalCells = roomSet(farthest);
    // スタートの側：スタートが通路の曲がり角なら、いちばん近い部屋までの道も含める（スイッチを置ける部屋がスタートの側に要る）
    const startCells = roomSet(startRoom);
    let home: Room | null = startRoom.w > 1 ? startRoom : null;
    if (!home) {
      home = realRooms.filter((r) => r !== farthest).sort((a, b) => (dist.get(`${a.cx},${a.cy}`) ?? 1e9) - (dist.get(`${b.cx},${b.cy}`) ?? 1e9))[0] ?? null;
      if (home) {
        for (const k of roomSet(home)) startCells.add(k);
        for (const k of shortestPath(tiles, start, { x: home.cx, y: home.cy })) startCells.add(k);
      }
    }
    if (early) {
      // 1・2階：スタートとゴールの部屋のあいだを青の扉で区切る（1回切り替えると開く）
      const cut = minVertexCut(tiles, startCells, goalCells, roomCells);
      if (cut && cut.length > 0) plans.push(new Map(cut.map((k) => [k, 'blue'])));
    } else {
      // 3〜5階：スタート ─青─ 途中の部屋 ─赤─ ゴール。赤は最初開いているが、そこへは青の扉を通らないと行けない（2回の切り替え）
      const middles = realRooms.filter((r) => r !== farthest && r !== home);
      for (let i = middles.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [middles[i], middles[j]] = [middles[j] as Room, middles[i] as Room];
      }
      for (const mid of middles) {
        if (plans.length >= 6) break;
        const midCells = roomSet(mid);
        const cut2 = minVertexCut(tiles, new Set([...startCells, ...midCells]), goalCells, roomCells);
        if (!cut2 || cut2.length === 0 || cut2.length > SWITCH_DOORS.max - 1) continue;
        // 途中の部屋から赤の扉までの道も青の扉の向こうに入れる（2つ目のスイッチから赤の扉へ歩いて行けるように）
        const midSide = new Set([...midCells, ...cut2]);
        for (const c of cut2) {
          const [x, y] = c.split(',').map(Number) as [number, number];
          for (const q of shortestPath(tiles, { x: mid.cx, y: mid.cy }, { x, y })) midSide.add(q);
        }
        if ([...startCells].some((c) => midSide.has(c))) continue;
        const cut1 = minVertexCut(tiles, startCells, midSide, roomCells);
        if (!cut1 || cut1.length === 0 || cut1.length + cut2.length > SWITCH_DOORS.max) continue;
        plans.push(new Map([...cut1.map((k) => [k, 'blue'] as const), ...cut2.map((k) => [k, 'red'] as const)]));
      }
    }
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
  const attempts = gimmick === 'switch' ? 30 * Math.max(1, plans.length) : 30;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const pool = [...spots];
    const take = (): Point | null => (pool.length === 0 ? null : (pool.splice(rng.int(pool.length), 1)[0] as Point));
    const entities: FloorEntity[] = [];
    let floorTiles = tiles;
    // 赤と青の扉・スイッチ（いちばん先に置く）。スイッチは扉のとなりには置かない（扉の上に立ったまま切り替えないように）
    if (gimmick === 'switch') {
      const plan = plans[attempt % Math.max(1, plans.length)];
      if (!plan) break;
      floorTiles = withDoors(tiles, plan);
      const nearDoor = (p: Point): boolean => DIRS.some(([dx, dy]) => isDoorTile(floorTiles[p.y + dy]?.[p.x + dx]));
      const red = reachable(floorTiles, start, () => false, 'red');
      const blue = reachable(floorTiles, start, () => false, 'blue');
      // ゴールの側から：その色が開いていればゴールへ歩いて行ける所
      const redToGoal = reachable(floorTiles, goal, () => false, 'red');
      const blueToGoal = reachable(floorTiles, goal, () => false, 'blue');
      // スイッチはスタートの部屋にも置ける（スタートのマスとそのとなりは除く）
      const startSpots: Point[] = [];
      for (const k of roomSet(startRoom)) {
        const [x, y] = k.split(',').map(Number) as [number, number];
        if (Math.abs(x - start.x) + Math.abs(y - start.y) > 1 && floorAt(x, y) && !entities.some((e) => e.x === x && e.y === y)) startSpots.push({ x, y });
      }
      const putSwitch = (ok: (p: Point) => boolean, n: number): boolean => {
        const options = [...pool, ...startSpots.filter((p) => !entities.some((e) => e.x === p.x && e.y === p.y))].filter((p) => ok(p) && !nearDoor(p));
        if (options.length === 0) return false;
        const p = options[rng.int(options.length)] as Point;
        if (pool.includes(p)) pool.splice(pool.indexOf(p), 1);
        entities.push({ id: `${prefix}-switch-${n}`, kind: 'switch', x: p.x, y: p.y });
        return true;
      };
      // 1つ目：赤が開いたままで行ける所（1・2階は、そこで青にすればゴールへ行ける所）。
      // 2つ目（3階から）：青の扉の向こう（青でしか行けない所）で、そこで赤にすればゴールへ行ける所。3つ目（あれば）：どこでも
      const k = (p: Point): string => `${p.x},${p.y}`;
      if (!putSwitch((p) => red.has(k(p)) && (!early || blueToGoal.has(k(p))), 1)) continue;
      if (!early) {
        if (!putSwitch((p) => blue.has(k(p)) && !red.has(k(p)) && redToGoal.has(k(p)), 2)) continue;
        if (rng.chance(SWITCH_THIRD_RATE)) putSwitch((p) => red.has(k(p)) || blue.has(k(p)), 3);
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
    let result: DungeonFloor = { index: floor, width, height, tiles: floorTiles, start, stairs: isLast ? null : goal, entities };
    if (gimmick === 'switch') {
      // 飾りの扉：1・2階は赤を1つ（赤が開いていることが分かるように）、3〜5階は4か所に足りなければ足す。解けなくなる置き方はしない
      const want = early ? 1 : Math.max(0, SWITCH_DOORS.min - countDoors(floorTiles)) + (rng.chance(0.5) ? 1 : 0);
      const extra = corridorCells(floorTiles, roomCells, entities, start, goal);
      for (let added = 0, tries = 0; added < want && tries < 24 && extra.length > 0 && countDoors(result.tiles) < SWITCH_DOORS.max; tries++) {
        const k = extra.splice(rng.int(extra.length), 1)[0] as string;
        const color: DoorColor = early ? 'red' : rng.chance(0.5) ? 'red' : 'blue';
        const trial: DungeonFloor = { ...result, tiles: withDoors(result.tiles, new Map([[k, color]])) };
        if (switchFloorOk(trial, early, true)) {
          result = trial;
          added++;
        }
      }
      if (switchFloorOk(result, early)) return result;
      continue;
    }
    if (isFloorReachable(result) && (gimmick !== 'wind' || !hasWindLoop(result))) return result;
  }
  // 置けなかったとき（ほぼ起きない）：バトラー・宝箱を置かない。扉もやめる（スイッチが無いと開けられないため）
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

/** 機械の塔の1・2階（0＝1階・1＝2階）：スイッチ1つ・1回の切り替えでゴールへ（2026-11-05 指示書 BD） */
export const SWITCH_EARLY_FLOORS = 2;
/** 機械の塔の3〜5階の扉の数（か所） */
export const SWITCH_DOORS = { min: 4, max: 6 } as const;
/** 【仮】3〜5階でスイッチを3つにする割合（ふだんは2つ） */
export const SWITCH_THIRD_RATE = 0.5;

/** 扉の数（マス） */
export function countDoors(tiles: readonly string[]): number {
  let n = 0;
  for (const row of tiles) for (const ch of row) if (isDoorTile(ch)) n++;
  return n;
}

/** tiles のうち doors のマス（"x,y"）を、その色の扉にした形 */
function withDoors(tiles: readonly string[], doors: ReadonlyMap<string, DoorColor>): string[] {
  const grid2 = tiles.map((row) => row.split(''));
  for (const [k, c] of doors) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    (grid2[y] as string[])[x] = c === 'red' ? 'R' : 'B';
  }
  return grid2.map((row) => row.join(''));
}

/** 飾りの扉を置けるマス：部屋の外の床（通路）で、スタート・ゴール・人や物とそのとなりでない */
function corridorCells(tiles: readonly string[], roomCells: ReadonlySet<string>, entities: readonly FloorEntity[], start: Point, goal: Point): string[] {
  const near = new Set<string>();
  for (const p of [...entities, start, goal]) for (const [dx, dy] of [[0, 0], ...DIRS]) near.add(`${p.x + dx},${p.y + dy}`);
  const out: string[] = [];
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < (tiles[y]?.length ?? 0); x++) {
      const k = `${x},${y}`;
      if (tiles[y]?.[x] === '.' && !roomCells.has(k) && !near.has(k)) out.push(k);
    }
  }
  return out;
}

/** 機械の塔の階が決まりを満たすか（1・2階：スイッチ1つ・切り替え1回。3〜5階：スイッチ2〜3つ・扉4〜6か所・切り替え2回以上。どれも閉じこめられない） */
function switchFloorOk(f: DungeonFloor, early: boolean, adding = false): boolean {
  const switches = f.entities.filter((e) => e.kind === 'switch').length;
  const doors = countDoors(f.tiles);
  const p = switchPuzzle(f);
  if (!p.solvable || p.trapped > 0 || !p.entitiesReachable) return false;
  if (early) return switches === 1 && p.minToggles === 1;
  // 飾りの扉を足している途中（adding）は扉の数を見ない
  return switches >= 2 && switches <= 3 && (adding || doors >= SWITCH_DOORS.min) && doors <= SWITCH_DOORS.max && p.minToggles >= 2;
}

/**
 * いちばん少ない数のマスで sources と sinks を分ける（そのマスを通れなくすると行き来できない）。
 * 通路のマスだけを使う（fixed・sources・sinks のマスは使わない）。分けられない・7マス以上要るときは null
 */
function minVertexCut(tiles: readonly string[], sources: ReadonlySet<string>, sinks: ReadonlySet<string>, fixed: ReadonlySet<string>): string[] | null {
  const cells: Point[] = [];
  const index = new Map<string, number>();
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < (tiles[y]?.length ?? 0); x++) {
      if (tiles[y]?.[x] !== '.') continue;
      index.set(`${x},${y}`, cells.length);
      cells.push({ x, y });
    }
  }
  const INF = 1_000_000;
  const n = cells.length * 2 + 2;
  const S = n - 2;
  const T = n - 1;
  const head = new Array<number>(n).fill(-1);
  const to: number[] = [];
  const cap: number[] = [];
  const nxt: number[] = [];
  const edge = (u: number, v: number, c: number): void => {
    to.push(v), cap.push(c), nxt.push(head[u] as number), (head[u] = to.length - 1);
    to.push(u), cap.push(0), nxt.push(head[v] as number), (head[v] = to.length - 1);
  };
  cells.forEach((p, i) => {
    const k = `${p.x},${p.y}`;
    edge(2 * i, 2 * i + 1, sources.has(k) || sinks.has(k) || fixed.has(k) ? INF : 1);
    if (sources.has(k)) edge(S, 2 * i, INF);
    if (sinks.has(k)) edge(2 * i + 1, T, INF);
    for (const [dx, dy] of DIRS) {
      const j = index.get(`${p.x + dx},${p.y + dy}`);
      if (j !== undefined) edge(2 * i + 1, 2 * j, INF);
    }
  });
  const bfs2 = (): number[] => {
    const prev = new Array<number>(n).fill(-2);
    prev[S] = -1;
    const q = [S];
    for (let qi = 0; qi < q.length; qi++) {
      const u = q[qi] as number;
      for (let e = head[u] as number; e !== -1; e = nxt[e] as number) {
        const v = to[e] as number;
        if ((cap[e] as number) > 0 && prev[v] === -2) {
          prev[v] = e;
          q.push(v);
        }
      }
    }
    return prev;
  };
  let flow = 0;
  for (;;) {
    const prev = bfs2();
    if (prev[T] === -2) break;
    flow++;
    if (flow > SWITCH_DOORS.max) return null;
    for (let v = T; v !== S; ) {
      const e = prev[v] as number;
      cap[e] = (cap[e] as number) - 1;
      cap[e ^ 1] = (cap[e ^ 1] as number) + 1;
      v = to[e ^ 1] as number;
    }
  }
  // ゴールの側に近い切り方（スタートの側を広くする）：残りの流れで T へ行けるマスを逆にたどる
  const toT = new Array<boolean>(n).fill(false);
  toT[T] = true;
  const q = [T];
  for (let qi = 0; qi < q.length; qi++) {
    const w = q[qi] as number;
    for (let e = head[w] as number; e !== -1; e = nxt[e] as number) {
      const u = to[e] as number;
      if (!toT[u] && (cap[e ^ 1] as number) > 0) {
        toT[u] = true;
        q.push(u);
      }
    }
  }
  const cut: string[] = [];
  cells.forEach((p, i) => {
    if (toT[2 * i + 1] && !toT[2 * i]) cut.push(`${p.x},${p.y}`);
  });
  return cut;
}

/** 機械の塔の階を「いる場所 × 開いている色」で調べた結果（2026-11-05 指示書 BD） */
export interface SwitchPuzzle {
  /** スタート（赤が開いている）からゴール（階段・ボスのとなり）へ行ける */
  readonly solvable: boolean;
  /** スタートから行ける状態のうち、そこからゴールへ行けない状態の数（0＝閉じこめられない） */
  readonly trapped: number;
  /** すべてのバトラー・宝箱・スイッチのとなりへ、どれかの状態で行ける */
  readonly entitiesReachable: boolean;
  /** ゴールまでのいちばん少ない切り替えの回数（行けなければ -1） */
  readonly minToggles: number;
  /** その回数で行くときのいちばん少ない歩数（行けなければ -1） */
  readonly minSteps: number;
  /** スタートから行ける状態の数 */
  readonly states: number;
}

/**
 * 機械の塔の階を調べる。状態＝（いる場所・開いている色）。
 * 1歩＝となりのマスへ（開いている色の扉・床。人や物のマスは通れない）、切り替え＝スイッチのとなりで色を入れかえる
 */
export function switchPuzzle(f: DungeonFloor): SwitchPuzzle {
  const blockers = new Set(f.entities.filter(blocksWay).map((e) => `${e.x},${e.y}`));
  const switches = f.entities.filter((e) => e.kind === 'switch');
  const boss = f.entities.find((e) => e.kind === 'boss');
  const colors: DoorColor[] = ['red', 'blue'];
  const sk = (x: number, y: number, c: number): number => (y * f.width + x) * 2 + c;
  const isGoal = (x: number, y: number): boolean =>
    (!!f.stairs && f.stairs.x === x && f.stairs.y === y) || (!!boss && Math.abs(boss.x - x) + Math.abs(boss.y - y) === 1);
  const nextToSwitch = (x: number, y: number): boolean => switches.some((s) => Math.abs(s.x - x) + Math.abs(s.y - y) === 1);
  /** 次の状態（cost：0＝1歩、1＝切り替え） */
  const edges = (s: number): [number, number][] => {
    const c = s % 2;
    const cell = (s - c) / 2;
    const x = cell % f.width;
    const y = (cell - x) / f.width;
    const out: [number, number][] = [];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (isWalkableTile(f.tiles[ny]?.[nx], colors[c]) && !blockers.has(`${nx},${ny}`)) out.push([sk(nx, ny, c), 0]);
    }
    if (nextToSwitch(x, y)) out.push([sk(x, y, 1 - c), 1]);
    return out;
  };
  const startState = sk(f.start.x, f.start.y, 0);
  // スタートから行ける状態（と、逆向きのつながり）
  const reach = new Set<number>([startState]);
  const back = new Map<number, number[]>();
  const queue = [startState];
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i] as number;
    for (const [t2] of edges(s)) {
      const list = back.get(t2) ?? [];
      list.push(s);
      back.set(t2, list);
      if (!reach.has(t2)) {
        reach.add(t2);
        queue.push(t2);
      }
    }
  }
  const stateXY = (s: number): Point => {
    const cell = (s - (s % 2)) / 2;
    return { x: cell % f.width, y: Math.floor(cell / f.width) };
  };
  const goals = [...reach].filter((s) => {
    const p = stateXY(s);
    return isGoal(p.x, p.y);
  });
  // ゴールへ行ける状態（ゴールから逆にたどる）
  const canGoal = new Set<number>(goals);
  const bq = [...goals];
  for (let i = 0; i < bq.length; i++) {
    for (const p of back.get(bq[i] as number) ?? []) {
      if (!canGoal.has(p)) {
        canGoal.add(p);
        bq.push(p);
      }
    }
  }
  const trapped = [...reach].filter((s) => !canGoal.has(s)).length;
  // いちばん少ない切り替え → 歩数（切り替えの回数ごとに広げる）
  let minToggles = -1;
  let minSteps = -1;
  const best = new Map<number, number>([[startState, 0]]);
  let layer: number[] = [startState];
  for (let toggles = 0; layer.length > 0 && toggles <= 8; toggles++) {
    // この回数のまま歩いて広げる（歩数の少ない順）
    layer.sort((a, b) => (best.get(a) as number) - (best.get(b) as number));
    const done = new Set<number>();
    const q2 = [...layer];
    const nextLayer = new Map<number, number>();
    for (let i = 0; i < q2.length; i++) {
      const s = q2[i] as number;
      if (done.has(s)) continue;
      done.add(s);
      const d = best.get(s) as number;
      for (const [t2, cost] of edges(s)) {
        if (cost === 1) {
          if (!best.has(t2) && (nextLayer.get(t2) ?? Infinity) > d) nextLayer.set(t2, d);
          continue;
        }
        if (best.has(t2) && (best.get(t2) as number) <= d + 1) continue;
        best.set(t2, d + 1);
        q2.push(t2);
      }
    }
    const reached = [...done].filter((s) => {
      const p = stateXY(s);
      return isGoal(p.x, p.y);
    });
    if (reached.length > 0) {
      minToggles = toggles;
      minSteps = Math.min(...reached.map((s) => best.get(s) as number));
      break;
    }
    layer = [];
    for (const [s, d] of nextLayer) {
      if (best.has(s)) continue;
      best.set(s, d);
      layer.push(s);
    }
  }
  // バトラー・宝箱・スイッチのとなりへ行けるか（どれかの状態で）
  const reachedCells = new Set([...reach].map((s) => (s - (s % 2)) / 2));
  const entitiesReachable = f.entities
    .filter((e) => e.kind === 'npc' || e.kind === 'chest' || e.kind === 'switch')
    .every((e) => DIRS.some(([dx, dy]) => reachedCells.has((e.y + dy) * f.width + (e.x + dx))));
  const onDoor = f.entities.some((e) => isDoorTile(f.tiles[e.y]?.[e.x])) || isDoorTile(f.tiles[f.start.y]?.[f.start.x]);
  return { solvable: goals.length > 0 && !onDoor, trapped, entitiesReachable: entitiesReachable && !onDoor, minToggles, minSteps, states: reach.size };
}

/** 床のマスだけを通る、いちばん短い道のマス（"x,y"。from・to も入る。行けなければ空） */
function shortestPath(tiles: readonly string[], from: Point, to: Point): string[] {
  const prev = new Map<string, string | null>([[`${from.x},${from.y}`, null]]);
  const q: Point[] = [from];
  for (let i = 0; i < q.length; i++) {
    const p = q[i] as Point;
    if (p.x === to.x && p.y === to.y) break;
    for (const [dx, dy] of DIRS) {
      const k = `${p.x + dx},${p.y + dy}`;
      if (prev.has(k) || tiles[p.y + dy]?.[p.x + dx] !== '.') continue;
      prev.set(k, `${p.x},${p.y}`);
      q.push({ x: p.x + dx, y: p.y + dy });
    }
  }
  const out: string[] = [];
  for (let k: string | null | undefined = `${to.x},${to.y}`; k; k = prev.get(k)) out.push(k);
  return prev.has(`${to.x},${to.y}`) ? out : [];
}

function range(from: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => from + i);
}
