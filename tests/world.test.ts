import { describe, expect, it } from 'vitest';
import { FRAGMENTS } from '../src/data/fragments.ts';
import { DUNGEON_B1, getMap, HOME, MAPS, TOWN, townDoorFront, type MapDefinition, type MapObject } from '../src/data/maps.ts';
import { DEFAULT_LOCATION, NEW_GAME_LOCATION } from '../src/game/save/saveData.ts';
import { adjacentCellOf, canStep, findPath, findPathCentered, findPathToObject, findPathWhere, isBlocked, objectsAt, STEPS_4, type Point } from '../src/game/world/world.ts';

const blockedIn = (map: MapDefinition) => (x: number, y: number) => isBlocked(map, x, y, () => true);
const warps = (map: MapDefinition) => map.objects.filter((o): o is Extract<MapObject, { type: 'warp' }> => o.type === 'warp');
const artMaps = MAPS.filter((m) => m.art);

/** 経路が「通れないマス」を通らず、斜めは角をすり抜けていない */
function expectValidPath(map: MapDefinition, from: Point, path: readonly Point[]): void {
  let cur = from;
  for (const p of path) {
    const dx = p.x - cur.x;
    const dy = p.y - cur.y;
    expect(Math.abs(dx) <= 1 && Math.abs(dy) <= 1).toBe(true);
    expect(canStep(cur, dx, dy, blockedIn(map))).toBe(true);
    cur = p;
  }
}

describe('歩行マップの経路探索', () => {
  it('噴水は歩けず、まわりを回って向こう側へ行ける（斜めも使う）', () => {
    const f = TOWN.art?.fountain;
    if (!f) throw new Error('fountain');
    const center = { x: f.x + Math.floor(f.w / 2), y: f.y + Math.floor(f.h / 2) };
    expect(isBlocked(TOWN, center.x, center.y, () => true)).toBe(true);
    const north = { x: center.x, y: f.y - 2 };
    const path = findPath(TOWN, TOWN.spawn, north, blockedIn(TOWN));
    expect(path?.at(-1)).toEqual(north);
    if (path) expectValidPath(TOWN, TOWN.spawn, path);
    expect(path?.some((p, i) => i > 0 && p.x !== (path[i - 1] as Point).x && p.y !== (path[i - 1] as Point).y)).toBe(true);
  });

  it('斜めは角をすり抜けない', () => {
    const blocked = (x: number, y: number): boolean => x === 1 && y === 0;
    expect(canStep({ x: 0, y: 0 }, 1, 1, blocked)).toBe(false);
    expect(canStep({ x: 0, y: 0 }, 0, 1, blocked)).toBe(true);
  });

  it('草地（道の外）や地図の外へは行けない', () => {
    expect(findPath(TOWN, TOWN.spawn, { x: 0, y: 0 }, blockedIn(TOWN))).toBeNull();
  });

  it('複数マスの家具（ベッド）は、どこからでも隣まで行ける', () => {
    const bed = HOME.objects.find((o) => o.id === 'home-bed');
    if (!bed) throw new Error('bed');
    const path = findPathToObject(HOME, HOME.spawn, bed, blockedIn(HOME));
    expect(path).not.toBeNull();
    const end = path?.at(-1) ?? HOME.spawn;
    expect(adjacentCellOf(bed, end)).not.toBeNull();
  });

  it('敵の隣まで行ける（接触でバトル）', () => {
    const enemy = DUNGEON_B1.objects.find((o) => o.type === 'enemy');
    if (!enemy) throw new Error('enemy');
    const path = findPathToObject(DUNGEON_B1, DUNGEON_B1.spawn, enemy, blockedIn(DUNGEON_B1));
    expect(path).not.toBeNull();
  });
});

describe('正式な絵の街・部屋', () => {
  it('出現位置・ゲーム開始の位置・街の決まった位置は歩けるマス', () => {
    for (const m of artMaps) expect(isBlocked(m, m.spawn.x, m.spawn.y, () => true), m.id).toBe(false);
    for (const loc of [DEFAULT_LOCATION, NEW_GAME_LOCATION]) {
      const m = getMap(loc.mapId);
      if (!m) throw new Error(loc.mapId);
      expect(isBlocked(m, loc.x, loc.y, () => true), loc.mapId).toBe(false);
    }
  });

  it('街のすべての玄関へ歩いて入れ、部屋の出口から同じ玄関の前に戻る（すぐ入り直さない）', () => {
    const doors = warps(TOWN).filter((w) => w.target.kind === 'map');
    // 11棟（2026-10-27 住宅C をカードバトラー管理局に置き換えた）
    expect(doors).toHaveLength(11);
    for (const door of doors) {
      if (door.target.kind !== 'map') continue;
      const path = findPathToObject(TOWN, TOWN.spawn, { ...door, type: 'interact', action: 'message' } as MapObject, blockedIn(TOWN));
      expect(path, door.id).not.toBeNull();
      // 玄関のマスは歩ける
      expect(isBlocked(TOWN, door.x, door.y, () => true), door.id).toBe(false);
      const room = getMap(door.target.mapId);
      if (!room) throw new Error(door.target.mapId);
      expect(isBlocked(room, door.target.x, door.target.y, () => true), room.id).toBe(false);
      // 部屋の出口へ歩ける
      const exit = warps(room).find((w) => w.target.kind === 'map' && w.target.mapId === 'town');
      if (!exit || exit.target.kind !== 'map') throw new Error(`${room.id} exit`);
      const toExit = findPath(room, { x: door.target.x, y: door.target.y }, { x: exit.x, y: exit.y }, blockedIn(room));
      expect(toExit, room.id).not.toBeNull();
      // 戻る位置は同じ玄関のすぐ前・歩けるマス・出入口の上ではない
      const back = exit.target;
      expect(back.x >= door.x && back.x < door.x + door.w, door.id).toBe(true);
      expect(back.y).toBe(door.y + 1);
      expect(isBlocked(TOWN, back.x, back.y, () => true)).toBe(false);
      expect(objectsAt(TOWN, back.x, back.y).some((o) => o.type === 'warp')).toBe(false);
    }
  });

  it('部屋の調べられる家具は、すべて入口から隣まで歩いて行ける', () => {
    for (const m of artMaps) {
      for (const obj of m.objects) {
        if (obj.type !== 'interact' && obj.type !== 'npc') continue;
        const path = findPathToObject(m, m.spawn, obj, blockedIn(m));
        expect(path, `${m.id}:${obj.id}`).not.toBeNull();
      }
    }
  });

  it('街の欠片は歩ける所にある', () => {
    for (const f of FRAGMENTS.filter((x) => x.mapId === 'town')) {
      expect(isBlocked(TOWN, f.x, f.y, () => true), f.id).toBe(false);
      expect(findPath(TOWN, TOWN.spawn, f, blockedIn(TOWN)), f.id).not.toBeNull();
    }
  });
});

describe('街のダンジョン入口', () => {
  const gate = TOWN.objects.find((o) => o.id === 'door-dungeon');

  it('入口はダンジョン選択につながる出入口', () => {
    expect(gate?.type).toBe('warp');
    expect(gate?.type === 'warp' && gate.target.kind).toBe('dungeonGate');
  });

  it('出現位置・各建物の前から、道を歩いて入口まで行ける（途中で他の施設の入口を踏まない）', () => {
    if (!gate || gate.type !== 'warp') throw new Error('gate');
    const goal = { x: gate.x, y: gate.y };
    const fronts = warps(TOWN).filter((w) => w.target.kind === 'map').map((w) => ({ x: w.x, y: w.y + 1 }));
    for (const from of [TOWN.spawn, ...fronts]) {
      const path = findPath(TOWN, from, goal, blockedIn(TOWN));
      expect(path, `${from.x},${from.y}`).not.toBeNull();
      const others = path?.slice(0, -1).filter((p) => objectsAt(TOWN, p.x, p.y).some((o) => o.type === 'warp'));
      expect(others).toEqual([]);
    }
  });

  it('入口の手前（戻ってくる位置）は歩けるマス', () => {
    if (!gate || gate.type !== 'warp') throw new Error('gate');
    for (let x = gate.x; x < gate.x + gate.w; x += 1) expect(isBlocked(TOWN, x, gate.y - 1, () => true)).toBe(false);
  });
});

describe('案内で連れて歩く道（2026-10-28 点検）', () => {
  it('街の案内（主人公の家の前 → 練習場）は、最短の道より道の真ん中を通る', () => {
    const blocked = blockedIn(TOWN);
    const door = warps(TOWN).find((w) => w.id === 'door-practice');
    if (!door) throw new Error('door-practice');
    const inDoor = (x: number, y: number): boolean => x >= door.x && x < door.x + door.w && y === door.y;
    const front = townDoorFront('PLAYER_HOME');
    const start = { x: front.x, y: front.y };
    const centered = findPathCentered(TOWN, start, inDoor, blocked);
    const shortest = findPathWhere(TOWN, start, inDoor, blocked, 60000, STEPS_4);
    if (!centered || !shortest) throw new Error('path');
    expectValidPath(TOWN, start, centered);
    // 道の端（となりのマスが歩けない）を通るマスの割合が、最短の道より少ない
    const edge = (p: Point): boolean => STEPS_4.some((d) => blocked(p.x + d.x, p.y + d.y));
    const ratio = (path: readonly Point[]): number => path.filter(edge).length / path.length;
    expect(ratio(centered)).toBeLessThan(ratio(shortest));
    expect(ratio(centered)).toBeLessThan(0.25);
    // 草地を横切らない（石畳の道を通る）
    const grass = centered.filter((p) => TOWN.tiles[p.y]?.[p.x] === ',').length;
    expect(grass).toBeLessThanOrEqual(2);
    // 遠回りしすぎない
    expect(centered.length).toBeLessThan(shortest.length * 2);
  });
});
