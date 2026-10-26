import { getDungeon } from '../../data/dungeons.ts';
import { DUNGEON_RUN, isRunDungeon } from '../../data/dungeonRun.ts';
import { REWARDS } from '../../data/economy.ts';
import { nextRandom } from '../rng.ts';
import { addCards, addCoins, type Direction, type DungeonRun, type SaveData } from '../save/saveData.ts';
import { blocksWay, generateFloor, type DungeonFloor, type FloorEntity, type Point } from './generate.ts';

/**
 * ランダム生成のダンジョンの挑戦（2026-10-26 試作。GB 版のダンジョンを参考に）。DOM に依存しない純粋関数。
 * - 見下ろしで1マスずつ動く。最初は真っ暗で、自分と隣のマス（viewRadius）だけ見える。見たマスは地図に残る
 * - 下りたら上り階段はない。最後の階にボス
 * - 通常のバトラーは話しかけると対戦。見えない番人は姿がなく、近づくと予兆、1歩ごとの抽選で対戦（戦ったあとはしばらく出ない）
 * - 勝つと相手のモンスターの技カードを1枚（画面が選んで渡す）。負けられる回数（maxLosses）負けると、
 *   街の入り口へ戻され、その挑戦で手に入れた技カードを失う。ボスを倒すとクリア
 * 中断して再開できるよう、状態はすべて save.dungeonRun に持つ
 */

/** 階の形（同じシード・階なら同じ。作り直しを減らすため、直近に作った階を覚えておく） */
const floorCache = new Map<string, DungeonFloor>();

export function runFloor(run: Pick<DungeonRun, 'seed' | 'floor'>): DungeonFloor {
  const key = `${run.seed}:${run.floor}`;
  let f = floorCache.get(key);
  if (!f) {
    f = generateFloor(run.seed, run.floor, run.floor >= DUNGEON_RUN.floors - 1);
    if (floorCache.size > 8) floorCache.clear();
    floorCache.set(key, f);
  }
  return f;
}

export function isLastFloor(run: Pick<DungeonRun, 'floor'>): boolean {
  return run.floor >= DUNGEON_RUN.floors - 1;
}

/** 見たマスに、いまの位置から見えるマスを足す */
export function reveal(explored: string, f: DungeonFloor, p: Point, radius: number = DUNGEON_RUN.viewRadius): string {
  const cells = (explored.length === f.width * f.height ? explored : '0'.repeat(f.width * f.height)).split('');
  for (let y = p.y - radius; y <= p.y + radius; y++) {
    for (let x = p.x - radius; x <= p.x + radius; x++) {
      if (x >= 0 && y >= 0 && x < f.width && y < f.height) cells[y * f.width + x] = '1';
    }
  }
  return cells.join('');
}

export function isExplored(run: DungeonRun, f: DungeonFloor, x: number, y: number): boolean {
  return run.explored[y * f.width + x] === '1';
}

/** いま見えているマスか（自分のまわり viewRadius） */
export function isVisible(run: DungeonRun, x: number, y: number, radius: number = DUNGEON_RUN.viewRadius): boolean {
  return Math.abs(x - run.x) <= radius && Math.abs(y - run.y) <= radius;
}

/** 新しく挑戦を始める（1階のスタート）。location は街の入り口のまま（戻されたときの場所） */
export function startRun(save: SaveData, dungeonId: string, seed: number): SaveData {
  const f = runFloor({ seed, floor: 0 });
  const run: DungeonRun = {
    dungeonId,
    seed,
    floor: 0,
    x: f.start.x,
    y: f.start.y,
    dir: 'down',
    explored: reveal('', f, f.start),
    defeated: [],
    opened: [],
    losses: 0,
    gained: [],
    cooldown: 0,
    rng: (seed ^ 0x2545f491) | 0,
  };
  return { ...save, activeDungeon: null, dungeonRun: run };
}

/** いまその階にいる（倒されていない・開いていても残る）もの */
export function activeEntities(run: DungeonRun, f: DungeonFloor): FloorEntity[] {
  return f.entities.filter((e) => !((e.kind === 'npc' || e.kind === 'guardian' || e.kind === 'boss') && run.defeated.includes(e.id)));
}

export function entityAt(run: DungeonRun, f: DungeonFloor, x: number, y: number): FloorEntity | undefined {
  return activeEntities(run, f).find((e) => e.x === x && e.y === y && e.kind !== 'guardian');
}

const STEP: Readonly<Record<Direction, Point>> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/** 向いている先のマス */
export function facingPoint(run: DungeonRun): Point {
  const d = STEP[run.dir];
  return { x: run.x + d.x, y: run.y + d.y };
}

export interface MoveResult {
  readonly run: DungeonRun;
  /** 1マス進んだか（壁・バトラー・宝箱の前では向きだけ変わる） */
  readonly moved: boolean;
  /** 下り階段の上に来た */
  readonly onStairs: boolean;
  /** 見えない番人の気配（近い） */
  readonly omen: boolean;
  /** 見えない番人が対戦を挑んできた */
  readonly guardian: FloorEntity | null;
}

/** 近くの見えない番人（上下左右のマス数の合計がいちばん小さいもの）と、その距離 */
export function nearestGuardian(run: DungeonRun, f: DungeonFloor): { guardian: FloorEntity; distance: number } | null {
  let best: { guardian: FloorEntity; distance: number } | null = null;
  for (const g of activeEntities(run, f).filter((e) => e.kind === 'guardian')) {
    const distance = Math.abs(g.x - run.x) + Math.abs(g.y - run.y);
    if (!best || distance < best.distance) best = { guardian: g, distance };
  }
  return best;
}

/** 十字キーの1歩：向きを変え、通れれば1マス進む。進んだら見たマスを広げ、見えない番人の抽選をする */
export function move(run: DungeonRun, dir: Direction): MoveResult {
  const f = runFloor(run);
  const turned: DungeonRun = { ...run, dir };
  const d = STEP[dir];
  const x = run.x + d.x;
  const y = run.y + d.y;
  if (f.tiles[y]?.[x] !== '.' || entityAt(run, f, x, y)) return { run: turned, moved: false, onStairs: false, omen: nearGuardian(turned, f), guardian: null };
  let next: DungeonRun = { ...turned, x, y, explored: reveal(run.explored, f, { x, y }) };
  // 見えない番人：戦ったあとの残り歩数があれば出ない。近くにいれば1歩ごとに抽選
  let guardian: FloorEntity | null = null;
  if (next.cooldown > 0) {
    next = { ...next, cooldown: next.cooldown - 1 };
  } else {
    const near = nearestGuardian(next, f);
    if (near && near.distance <= DUNGEON_RUN.guardianEncounterRange) {
      const r = nextRandom(next.rng);
      next = { ...next, rng: r.seed };
      if (r.value < DUNGEON_RUN.guardianRate) guardian = near.guardian;
    }
  }
  const onStairs = !!f.stairs && f.stairs.x === x && f.stairs.y === y;
  return { run: next, moved: true, onStairs, omen: nearGuardian(next, f), guardian };
}

/** 見えない番人の予兆を出すか（近くにいて、戦ったあとの休みでない） */
export function nearGuardian(run: DungeonRun, f: DungeonFloor): boolean {
  if (run.cooldown > 0) return false;
  const near = nearestGuardian(run, f);
  return !!near && near.distance <= DUNGEON_RUN.guardianOmenRange;
}

/** 下の階へ（上り階段はないので戻れない） */
export function descend(run: DungeonRun): DungeonRun {
  if (isLastFloor(run)) return run;
  const floor = run.floor + 1;
  const f = runFloor({ seed: run.seed, floor });
  return { ...run, floor, x: f.start.x, y: f.start.y, dir: 'down', explored: reveal('', f, f.start) };
}

/** 宝箱を開ける（1度だけ。中身は仮でまだ無い） */
export function openRunChest(run: DungeonRun, chestId: string): { run: DungeonRun; opened: boolean } {
  if (run.opened.includes(chestId)) return { run, opened: false };
  return { run: { ...run, opened: [...run.opened, chestId] }, opened: true };
}

export type BattleTargetKind = 'npc' | 'guardian' | 'boss';

export interface RunVictory {
  readonly save: SaveData;
  /** ボスを倒してクリアした */
  readonly cleared: boolean;
  readonly firstClear: boolean;
  /** クリアでもらったお金（仮） */
  readonly coins: number;
  /** クリアでもらったカード（初めてのクリアだけ。仮のジオル） */
  readonly clearCards: readonly { cardId: string; count: number }[];
}

/**
 * 対戦に勝った：相手を倒したことにし、技カード（card。画面が相手のモンスターの技から選ぶ）を所持カードに足して、この挑戦の獲得に記録する。
 * 見えない番人なら、しばらく番人が出てこない。ボスならクリア（挑戦を終える。報酬は仮：それまでの固定のダンジョンと同じお金と、初めてのときのカード）
 */
export function winRunBattle(save: SaveData, target: { kind: BattleTargetKind; id: string }, card: string | null): RunVictory {
  const run = save.dungeonRun;
  if (!run) return { save, cleared: false, firstClear: false, coins: 0, clearCards: [] };
  let next: SaveData = card ? addCards(save, [{ cardId: card, count: 1 }]) : save;
  const updated: DungeonRun = {
    ...run,
    defeated: run.defeated.includes(target.id) ? run.defeated : [...run.defeated, target.id],
    gained: card ? [...run.gained, card] : run.gained,
    cooldown: target.kind === 'guardian' ? DUNGEON_RUN.guardianCooldownSteps : run.cooldown,
  };
  if (target.kind !== 'boss') return { save: { ...next, dungeonRun: updated }, cleared: false, firstClear: false, coins: 0, clearCards: [] };
  const record = next.dungeons[run.dungeonId] ?? { openedChests: [], bossDefeated: false, clears: 0 };
  const firstClear = !record.bossDefeated;
  const coins = firstClear ? REWARDS.dungeonBossFirstClear : REWARDS.dungeonBossRepeat;
  const clearCards = firstClear ? (getDungeon(run.dungeonId)?.firstClearCards ?? []) : [];
  next = addCards(addCoins(next, coins), clearCards);
  next = {
    ...next,
    dungeonRun: null,
    dungeons: { ...next.dungeons, [run.dungeonId]: { ...record, bossDefeated: true, clears: record.clears + 1 } },
  };
  return { save: next, cleared: true, firstClear, coins, clearCards };
}

export interface RunDefeat {
  readonly save: SaveData;
  /** 負けられる回数に達して、街の入り口へ戻された */
  readonly expelled: boolean;
  /** 戻されて失った技カード */
  readonly lostCards: readonly string[];
  /** あと何回負けられるか（戻されたら 0） */
  readonly lossesLeft: number;
}

/**
 * 対戦に負けた：負けた回数を1つ増やす（見えない番人なら、しばらく番人が出てこない）。
 * 負けられる回数に達したら、この挑戦で手に入れた技カードを所持カードから外し、挑戦を終える（位置は街の入り口のまま）
 */
export function loseRunBattle(save: SaveData, target: { kind: BattleTargetKind; id: string }): RunDefeat {
  const run = save.dungeonRun;
  if (!run) return { save, expelled: false, lostCards: [], lossesLeft: 0 };
  const losses = run.losses + 1;
  if (losses < DUNGEON_RUN.maxLosses) {
    const updated: DungeonRun = { ...run, losses, cooldown: target.kind === 'guardian' ? DUNGEON_RUN.guardianCooldownSteps : run.cooldown };
    return { save: { ...save, dungeonRun: updated }, expelled: false, lostCards: [], lossesLeft: DUNGEON_RUN.maxLosses - losses };
  }
  const collection: Record<string, number> = { ...save.collection };
  for (const id of run.gained) {
    const n = (collection[id] ?? 0) - 1;
    if (n > 0) collection[id] = n;
    else delete collection[id];
  }
  return { save: { ...save, collection, dungeonRun: null }, expelled: true, lostCards: run.gained, lossesLeft: 0 };
}

/** 勝ったときにもらう技カードの候補（相手が使っていたモンスターの技） */
export function rewardCandidates(monsterIds: readonly string[], skillsOf: (monsterId: string) => readonly { id: string }[]): string[] {
  return [...new Set(monsterIds)].flatMap((m) => skillsOf(m).map((s) => s.id));
}

/** 対戦の相手が通れないもの（バトラー・ボス）か */
export function isBattler(e: FloorEntity): boolean {
  return blocksWay(e) && e.kind !== 'chest';
}

/**
 * 読み込んだ挑戦を確かめる（壊れたセーブ・数値を変えたあとのセーブでも遊べるように）。
 * 知らないダンジョンなら挑戦をやめる（null）。階が多すぎれば最後の階、立っている所が床でなければその階のスタートへ
 */
export function sanitizeRun(run: DungeonRun): DungeonRun | null {
  if (!isRunDungeon(run.dungeonId)) return null;
  const floor = Math.min(run.floor, DUNGEON_RUN.floors - 1);
  const f = runFloor({ seed: run.seed, floor });
  const fixed: DungeonRun = { ...run, floor, losses: Math.min(run.losses, DUNGEON_RUN.maxLosses - 1) };
  const onFloor = f.tiles[fixed.y]?.[fixed.x] === '.' && !entityAt(fixed, f, fixed.x, fixed.y);
  const at = onFloor && floor === run.floor ? { x: fixed.x, y: fixed.y } : f.start;
  return { ...fixed, x: at.x, y: at.y, explored: reveal(floor === run.floor ? fixed.explored : '', f, at) };
}
