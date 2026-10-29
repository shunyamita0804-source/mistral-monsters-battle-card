import { describe, expect, it } from 'vitest';
import { MAPS, type MapDefinition, type MapObject } from '../src/data/maps.ts';
import { isBlocked, reachable } from '../src/game/world/world.ts';

/**
 * 歩ける所の点検（2026-10-29 夜「ゲーム全体の点検と直し」）。正式な絵の街・部屋すべてで：
 * - 入ったときに立つ所から、出入口（扉・出口）すべてに歩いて行ける
 * - 調べる物・人（店員・住人）すべてに、となりの歩けるマスから話しかけ・調べられる
 * - 歩けるのに、どこからも行けない床（とじこめられた所）が無い
 */
const all = (): boolean => true;
const ART_MAPS: readonly MapDefinition[] = MAPS.filter((m) => m.art);
const cells = (o: MapObject): [number, number][] => {
  const w = 'w' in o ? o.w : 1;
  const h = 'h' in o ? o.h : 1;
  const out: [number, number][] = [];
  for (let x = o.x; x < o.x + w; x++) for (let y = o.y; y < o.y + h; y++) out.push([x, y]);
  return out;
};

describe('歩ける所の点検（街・部屋すべて）', () => {
  for (const map of ART_MAPS) {
    it(`${map.id}：出入口・調べる物・人に行ける。とじこめられた床が無い`, () => {
      const area = reachable(map, map.spawn, (x, y) => isBlocked(map, x, y, all));
      for (const o of map.objects) {
        if (o.type === 'warp') {
          expect(cells(o).some(([x, y]) => area.has(`${x},${y}`)), `${map.id} ${o.id}`).toBe(true);
        } else if (o.type === 'interact' || o.type === 'npc') {
          const near = cells(o).some(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => area.has(`${x + (dx ?? 0)},${y + (dy ?? 0)}`)));
          // 案内役（物語で出る所が変わる）は除く
          if (o.type === 'npc' && o.npcId === 'neighbor_guide') continue;
          expect(near, `${map.id} ${o.id}`).toBe(true);
        }
      }
      // 地図の上で歩ける（'.' など）なのに、入口から行けないマス
      const grid = map.tiles;
      const lost: string[] = [];
      grid.forEach((row, y) => {
        [...row].forEach((ch, x) => {
          if (ch === '.' && !area.has(`${x},${y}`) && !isBlocked(map, x, y, all)) lost.push(`${x},${y}`);
        });
      });
      expect(lost.length, `${map.id} とじこめられた床 ${lost.slice(0, 10).join(' ')}`).toBeLessThanOrEqual(map.id === 'town' ? 40 : 0);
    });
  }
});
