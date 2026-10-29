import { describe, expect, it } from 'vitest';
import { MAPS, getMap, type MapDefinition, type MapObject } from '../src/data/maps.ts';
import { isBlocked, isNearNpc, nearestNpc, objectCovers, reachable } from '../src/game/world/world.ts';

/** 人のまわりの通れない範囲（worldScreen.ts の NPC_SPACE）と話せる範囲（NPC_TALK_RANGE） */
const SPACE = { x: 2, y: 1 };
const TALK = { x: 3, y: 2 };
const all = (): boolean => true;
const artMaps = MAPS.filter((m) => m.art && m.objects.some((o) => o.type === 'npc'));

const touchable = (obj: MapObject, area: Set<string>): boolean => {
  const w = 'w' in obj ? obj.w : 1;
  const h = 'h' in obj ? obj.h : 1;
  for (let y = obj.y - 1; y <= obj.y + h; y++)
    for (let x = obj.x - 1; x <= obj.x + w; x++) {
      const side = (x >= obj.x && x < obj.x + w) !== (y >= obj.y && y < obj.y + h);
      if ((side || objectCovers(obj, x, y)) && area.has(`${x},${y}`)) return true;
    }
  return false;
};

describe('人のまわり（近づきすぎて絵が重ならないように）', () => {
  it('人からよこ2マス・たて1マス以内は通れない（2026-10-29 深夜：よこに並ぶと絵が半分重なったので、よこは絵の幅ぶん離す）', () => {
    const town = getMap('town') as MapDefinition;
    const guide = town.objects.find((o) => o.id === 'guide-town') as MapObject;
    expect(isNearNpc(town, guide.x + 1, guide.y + 1, all, SPACE)).toBe(true);
    expect(isNearNpc(town, guide.x + 2, guide.y, all, SPACE)).toBe(true);
    expect(isNearNpc(town, guide.x + 3, guide.y, all, SPACE)).toBe(false);
    expect(isNearNpc(town, guide.x, guide.y + 2, all, SPACE)).toBe(false);
    expect(nearestNpc(town, { x: guide.x + 3, y: guide.y }, all, TALK)?.id).toBe('guide-town');
    expect(nearestNpc(town, { x: guide.x, y: guide.y + 2 }, all, TALK)?.id).toBe('guide-town');
    expect(nearestNpc(town, { x: guide.x + 4, y: guide.y }, all, TALK)).toBeNull();
  });

  it.each(artMaps.map((m) => [m.id, m] as const))('%s：人のまわりを通れなくしても、出入口・家具に行けて、全員と話せる', (_id, map) => {
    const base = (x: number, y: number): boolean => isBlocked(map, x, y, all);
    const spaced = (x: number, y: number): boolean => base(x, y) || isNearNpc(map, x, y, all, SPACE);
    const before = reachable(map, map.spawn, base);
    const after = reachable(map, map.spawn, spaced);
    for (const obj of map.objects) {
      if (obj.type === 'npc') {
        // 話せる範囲（2マス以内）のどこかに立てる
        let ok = false;
        for (const k of after) {
          const [x, y] = k.split(',').map(Number) as [number, number];
          if (Math.abs(x - obj.x) <= TALK.x && Math.abs(y - obj.y) <= TALK.y) ok = true;
        }
        expect(ok, `${obj.id} と話せる`).toBe(true);
      } else if (touchable(obj, before)) {
        expect(touchable(obj, after), `${obj.id} に行ける`).toBe(true);
      }
    }
  });
});

describe('人のまわりと出現位置', () => {
  it('出現位置・出入口から出た所は、人のまわり（通れないマス）に入らない', () => {
    const bad: string[] = [];
    for (const m of MAPS) {
      if (m.art && isNearNpc(m, m.spawn.x, m.spawn.y, all, SPACE)) bad.push(`${m.id} の出現位置`);
      for (const o of m.objects) {
        if (o.type !== 'warp' || o.target.kind !== 'map') continue;
        const to = getMap(o.target.mapId);
        if (to?.art && isNearNpc(to, o.target.x, o.target.y, all, SPACE)) bad.push(`${o.id} → ${to.id}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
