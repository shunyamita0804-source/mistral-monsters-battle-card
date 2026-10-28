import { describe, expect, it } from 'vitest';
import { floorDecorations } from '../src/game/dungeon/decor.ts';
import { generateFloor, isFloorReachable } from '../src/game/dungeon/generate.ts';
import { DUNGEON_RUN, RUN_DUNGEONS } from '../src/data/dungeonRun.ts';

/** 2026-10-28 新しいダンジョン5つの正式な絵：床の上の飾り（炎の火山・天の聖域。見た目だけ） */
const floorOf = (dungeonId: string, seed: number, floor: number) => {
  const c = RUN_DUNGEONS[dungeonId];
  if (!c) throw new Error(dungeonId);
  return generateFloor(seed, floor, floor >= c.floors - 1, DUNGEON_RUN, c.gimmick);
};

describe('床の上の飾り', () => {
  it('飾りがあるのは炎の火山と天の聖域だけ', () => {
    for (const id of ['dungeon-01', 'dungeon-02', 'dungeon-03', 'dungeon-04', 'dungeon-06']) {
      expect(floorDecorations(floorOf(id, 123, 0), 123, id)).toEqual([]);
    }
    expect(floorDecorations(floorOf('dungeon-05', 123, 0), 123, 'dungeon-05').length).toBeGreaterThan(0);
    expect(floorDecorations(floorOf('dungeon-07', 123, 0), 123, 'dungeon-07').length).toBeGreaterThan(0);
  });

  it('同じ階はいつも同じ飾り・階が変われば別の並び', () => {
    const a = floorDecorations(floorOf('dungeon-05', 77, 1), 77, 'dungeon-05');
    const b = floorDecorations(floorOf('dungeon-05', 77, 1), 77, 'dungeon-05');
    const c = floorDecorations(floorOf('dungeon-05', 77, 2), 77, 'dungeon-05');
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('何もない床で、まわりも床のマスだけ。階段・置いてあるもの・始まりの場所には置かない。種類と絵の番号は決まった範囲', () => {
    const variants = { crack: 4, feather: 3, candle: 2, light: 2 } as const;
    for (const id of ['dungeon-05', 'dungeon-07']) {
      for (let seed = 1; seed <= 60; seed++) {
        for (let floor = 0; floor < 5; floor++) {
          const f = floorOf(id, seed, floor);
          const taken = new Set([...f.entities.map((e) => `${e.x},${e.y}`), `${f.start.x},${f.start.y}`, ...(f.stairs ? [`${f.stairs.x},${f.stairs.y}`] : [])]);
          for (const d of floorDecorations(f, seed, id)) {
            for (const [dx, dy] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]] as const) expect(f.tiles[d.y + dy]?.[d.x + dx]).toBe('.');
            expect(taken.has(`${d.x},${d.y}`)).toBe(false);
            expect(d.variant).toBeLessThan(variants[d.kind]);
            expect(id === 'dungeon-05' ? d.kind === 'crack' : d.kind !== 'crack').toBe(true);
          }
        }
      }
    }
  });

  it('飾りを足しても階の作りは変わらない（階を作る乱数を使わない）', () => {
    const f = floorOf('dungeon-07', 5, 0);
    floorDecorations(f, 5, 'dungeon-07');
    expect(floorOf('dungeon-07', 5, 0)).toEqual(f);
    expect(isFloorReachable(f)).toBe(true);
  });
});
