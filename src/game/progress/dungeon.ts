import { getDungeon } from '../../data/dungeons.ts';
import { dungeonMoney } from '../../data/economy.ts';
import { getMap, HOME, type ChestObject } from '../../data/maps.ts';
import { addCards, addCoins, type DungeonRecord, type Location, type SaveData } from '../save/saveData.ts';
import { isSolidTile } from '../world/world.ts';

/**
 * ダンジョン探索の進行。
 * - 探索中の状態（階・倒した敵）は save.activeDungeon、位置は save.location に保存し、アプリを閉じても再開できる
 * - 倒した敵は探索ごとに復活する（再挑戦できる）。宝箱は恒久的に1度だけ
 * - 敗北・帰還で探索は終わり、家に戻る（進行不能にならない）
 */
const EMPTY_RECORD: DungeonRecord = { openedChests: [], bossDefeated: false, clears: 0 };

export const HOME_RETURN: Location = { mapId: HOME.id, x: HOME.spawn.x, y: HOME.spawn.y, dir: HOME.spawn.dir };

export function dungeonRecord(save: SaveData, dungeonId: string): DungeonRecord {
  return save.dungeons[dungeonId] ?? EMPTY_RECORD;
}

function floorLocation(dungeonId: string, floor: number, arrival: 'spawn' | 'up'): Location | null {
  const dungeon = getDungeon(dungeonId);
  const mapId = dungeon?.floors[floor];
  const map = mapId ? getMap(mapId) : undefined;
  if (!map) return null;
  const point = arrival === 'up' && map.upArrival ? map.upArrival : map.spawn;
  return { mapId: map.id, x: point.x, y: point.y, dir: point.dir };
}

export function startDungeon(save: SaveData, dungeonId: string): SaveData {
  const location = floorLocation(dungeonId, 0, 'spawn');
  if (!location) return save;
  return { ...save, activeDungeon: { dungeonId, floor: 0, defeatedEnemies: [] }, location };
}

export function changeFloor(save: SaveData, delta: 1 | -1): SaveData {
  const active = save.activeDungeon;
  if (!active) return save;
  const floor = active.floor + delta;
  if (floor < 0) return leaveDungeon(save);
  const location = floorLocation(active.dungeonId, floor, delta === 1 ? 'spawn' : 'up');
  if (!location) return save;
  return { ...save, activeDungeon: { ...active, floor }, location };
}

export function leaveDungeon(save: SaveData): SaveData {
  return { ...save, activeDungeon: null, location: HOME_RETURN };
}

export function isEnemyActive(save: SaveData, enemyId: string): boolean {
  return !save.activeDungeon?.defeatedEnemies.includes(enemyId);
}

export interface VictoryResult {
  readonly save: SaveData;
  readonly coins: number;
  readonly cleared: boolean;
  readonly firstClear: boolean;
  /** もらったカード（ボスを初めて倒したとき） */
  readonly cards: readonly { cardId: string; count: number }[];
}

/** 敵に勝った。ボスならダンジョンクリア */
export function defeatEnemy(save: SaveData, enemyId: string, boss: boolean): VictoryResult {
  const active = save.activeDungeon;
  if (!active || active.defeatedEnemies.includes(enemyId)) return { save, coins: 0, cleared: false, firstClear: false, cards: [] };
  let next: SaveData = {
    ...save,
    activeDungeon: { ...active, defeatedEnemies: [...active.defeatedEnemies, enemyId] },
  };
  // お金はランダム生成のダンジョンと同じ表（src/data/economy.ts の DUNGEON_MONEY。2026-10-28 指示書「お金の入る側」）
  const money = dungeonMoney(active.dungeonId);
  if (!boss) {
    return { save: addCoins(next, money.win), coins: money.win, cleared: false, firstClear: false, cards: [] };
  }
  const record = dungeonRecord(save, active.dungeonId);
  const firstClear = !record.bossDefeated;
  const coins = firstClear ? money.bossFirst : money.bossRepeat;
  next = addCoins(next, coins);
  // 初めて倒したときだけ、そのダンジョンのボスのカード（bossDefeated で1回だけ）
  const cards = firstClear ? (getDungeon(active.dungeonId)?.firstClearCards ?? []) : [];
  next = addCards(next, cards);
  next = {
    ...next,
    dungeons: {
      ...next.dungeons,
      [active.dungeonId]: { ...record, bossDefeated: true, clears: record.clears + 1 },
    },
  };
  return { save: next, coins, cleared: true, firstClear, cards };
}

export function isChestOpened(save: SaveData, dungeonId: string, chestId: string): boolean {
  return dungeonRecord(save, dungeonId).openedChests.includes(chestId);
}

/** 宝箱を開ける（恒久的に1度だけ） */
export function openChest(save: SaveData, chest: ChestObject): { save: SaveData; opened: boolean } {
  const active = save.activeDungeon;
  if (!active || isChestOpened(save, active.dungeonId, chest.id)) return { save, opened: false };
  const record = dungeonRecord(save, active.dungeonId);
  let next = addCoins(save, chest.reward.coins);
  next = addCards(next, chest.reward.cards);
  next = {
    ...next,
    dungeons: { ...next.dungeons, [active.dungeonId]: { ...record, openedChests: [...record.openedChests, chest.id] } },
  };
  return { save: next, opened: true };
}

/**
 * 読み込んだセーブの位置が矛盾していないか確認し、必要なら安全な場所に戻す
 * （ダンジョンの外なのに探索中、など）。進行不能防止。
 */
export function sanitizeLocation(save: SaveData): SaveData {
  const map = getMap(save.location.mapId);
  if (!map) return { ...save, activeDungeon: null, location: HOME_RETURN };
  if (map.area === 'dungeon') {
    const active = save.activeDungeon;
    const dungeon = active ? getDungeon(active.dungeonId) : undefined;
    if (!active || !dungeon || dungeon.floors[active.floor] !== map.id) return leaveDungeon(save);
  } else if (save.activeDungeon) {
    return { ...save, activeDungeon: null };
  }
  const row = map.tiles[save.location.y];
  // マップの外や、通れないマス（仮マップの作り直しで建物になった場所など）にいたら出現位置へ
  if (!row || save.location.x < 0 || save.location.x >= row.length || isSolidTile(row[save.location.x] ?? '#')) {
    return { ...save, location: { mapId: map.id, ...map.spawn } };
  }
  return save;
}
