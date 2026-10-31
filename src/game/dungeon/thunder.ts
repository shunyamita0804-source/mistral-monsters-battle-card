import { nextRandom } from '../rng.ts';
import type { DungeonFloor, FloorEntity, Point } from './generate.ts';
import { isWalkableTile } from './generate.ts';

/**
 * 雷の高原の仕掛け「落雷のマス」（2026-11-01 指示書 AH。gimmick 'thunder'）。DOM に依存しない純粋関数。
 * - 主人公が1歩動くたびに「予告 → 落雷」：見えている範囲とそのまわり1マス（主人公から縦横 THUNDER_REACH マス以内）の歩ける床から
 *   2〜4マスを選んで予告の印を出す。主人公が次の1歩を動いたあと、予告していたマスに稲妻が落ちて印が消え、新しい予告が出る
 * - 稲妻が落ちたマスに主人公がいたら「雷に打たれた！」→ 見えない番人との対戦（今の番人の仕組みそのまま。src/game/dungeon/run.ts の move）
 * - 予告を出さないマス：主人公の今いるマス・階段・ボスのマスとそのとなり・人と宝箱（とスイッチ）のマス
 * - 主人公のとなりのマスにだけ予告が集まらないように、となりの予告は、通路（歩けるとなりが2つまで）では出さず、広い所でも1マスまで
 *   （毎回、安全なとなりのマスが1つ以上ある＝どこからでも安全な1歩がある）
 * - 予告は乱数で決めるが、挑戦の種・階・その階で歩いた歩数・主人公の位置から決めるので、同じ階・同じ歩き方なら同じ結果になる
 * 新しい負け方・新しい道具は作らない（打たれたら番人との対戦。煙玉で逃げられる）
 */

/** 予告の候補にする範囲（主人公から縦横何マスまで。見える範囲 1 ＋ まわり1マス） */
export const THUNDER_REACH = 2;
/** 1回に予告するマスの数（下限・上限） */
export const THUNDER_MIN = 2;
export const THUNDER_MAX = 4;

/** 階の落雷の状態（save.dungeonRun.thunder） */
export interface ThunderState {
  /** どの階の予告か（階を下りたら作り直す） */
  readonly floor: number;
  /** その階で歩いた歩数（予告を決める乱数に使う） */
  readonly step: number;
  /** いま予告しているマス（次の1歩のあとに落ちる） */
  readonly marks: readonly Point[];
}

const key = (p: Point): string => `${p.x},${p.y}`;

/** 予告の乱数の種：挑戦の種・階・歩数・位置から（同じ歩き方なら同じ） */
function thunderSeed(seed: number, floor: number, step: number, at: Point): number {
  let h = 2166136261 ^ (seed >>> 0);
  for (const n of [floor, step, at.x, at.y]) {
    h = Math.imul(h ^ (n & 0xffff), 16777619);
    h = Math.imul(h ^ (n >>> 16), 16777619);
  }
  return h | 0;
}

/** 予告を出さないマス：階段・ボスとそのとなり・人と宝箱など（倒した人・開けた宝箱は entities に入れない） */
function blockedCells(f: DungeonFloor, entities: readonly FloorEntity[]): Set<string> {
  const blocked = new Set<string>();
  if (f.stairs) blocked.add(key(f.stairs));
  for (const e of entities) {
    if (e.kind === 'guardian') continue;
    blocked.add(key(e));
    if (e.kind === 'boss') for (const [dx, dy] of NEIGHBORS) blocked.add(key({ x: e.x + dx, y: e.y + dy }));
  }
  return blocked;
}

const NEIGHBORS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** 主人公のとなりの、歩いて入れるマス（壁・人や物のマスは入らない） */
export function walkableNeighbors(f: DungeonFloor, at: Point, entities: readonly FloorEntity[]): Point[] {
  const occupied = new Set(entities.filter((e) => e.kind !== 'guardian').map(key));
  return NEIGHBORS.map(([dx, dy]) => ({ x: at.x + dx, y: at.y + dy })).filter((p) => isWalkableTile(f.tiles[p.y]?.[p.x]) && !occupied.has(key(p)));
}

/**
 * 新しい予告（2〜4マス）。entities はいまその階にいる人・物（倒した・開けたものを除く）。
 * となりの歩けるマスへの予告は、通路では0・広い所では1マスまで（安全な1歩をいつも残す）
 */
export function thunderForecast(f: DungeonFloor, at: Point, entities: readonly FloorEntity[], seed: number, floor: number, step: number): Point[] {
  const blocked = blockedCells(f, entities);
  const near = walkableNeighbors(f, at, entities);
  const nearKeys = new Set(near.map(key));
  // となりの予告：通路（歩けるとなりが2つまで）では出さない・広い所（3つ以上）では1マスまで。
  // 試遊で「となりの半分まで」だと、予告を気にせず歩くと1階に約20回打たれ、避けて歩くと道のりが約2.6倍になったので減らした（docs/thunder-plateau-ah-20261101.md）
  const maxNear = near.length >= 3 ? 1 : 0;
  const candidates: Point[] = [];
  for (let y = at.y - THUNDER_REACH; y <= at.y + THUNDER_REACH; y++) {
    for (let x = at.x - THUNDER_REACH; x <= at.x + THUNDER_REACH; x++) {
      if (x === at.x && y === at.y) continue;
      const ch = f.tiles[y]?.[x];
      if (!isWalkableTile(ch) || blocked.has(`${x},${y}`)) continue;
      candidates.push({ x, y });
    }
  }
  let s = thunderSeed(seed, floor, step, at);
  const r0 = nextRandom(s);
  s = r0.seed;
  const want = THUNDER_MIN + Math.floor(r0.value * (THUNDER_MAX - THUNDER_MIN + 1));
  const pool = [...candidates];
  const marks: Point[] = [];
  let nearCount = 0;
  while (marks.length < want && pool.length > 0) {
    const r = nextRandom(s);
    s = r.seed;
    const [p] = pool.splice(Math.floor(r.value * pool.length), 1) as [Point];
    if (nearKeys.has(key(p))) {
      if (nearCount >= maxNear) continue;
      nearCount++;
    }
    marks.push(p);
  }
  return marks;
}

/** 1歩動いたあとの落雷：前の予告のマスに稲妻が落ち（strikes）、主人公がそこにいたら打たれた（struck）。新しい予告を出す */
export function thunderStep(
  state: ThunderState | null | undefined,
  f: DungeonFloor,
  at: Point,
  entities: readonly FloorEntity[],
  seed: number,
  floor: number,
): { readonly state: ThunderState; readonly strikes: readonly Point[]; readonly struck: boolean } {
  const prev = state && state.floor === floor ? state : { floor, step: 0, marks: [] };
  const strikes = prev.marks;
  const struck = strikes.some((p) => p.x === at.x && p.y === at.y);
  const step = prev.step + 1;
  return { state: { floor, step, marks: thunderForecast(f, at, entities, seed, floor, step) }, strikes, struck };
}

/** 打たれたときの対戦の相手の ID（倒した記録に入る。番人の体ではないので、階の見えない番人は減らない） */
export function strikeGuardianId(floor: number, step: number): string {
  return `f${floor}-strike-${step}`;
}
