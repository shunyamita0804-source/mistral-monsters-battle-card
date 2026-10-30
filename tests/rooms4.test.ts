import { describe, expect, it } from 'vitest';
import { BUREAU, BUREAU_DESK_FRONT, HALL, HALL_BOARD, LAB, PRACTICE, SHOP, type MapDefinition, type NpcObject } from '../src/data/maps.ts';
import { isBlocked, reachable } from '../src/game/world/world.ts';

/** 部屋4つの新しい絵（2026-10-28。tools/design/rooms4_build.py）。2026-10-30 指示書 X で大会会場・管理局・練習場は正面向きの絵に */
const ROOMS: readonly MapDefinition[] = [HALL, BUREAU, PRACTICE, LAB];
const all = (): boolean => true;
const area = (map: MapDefinition): Set<string> => reachable(map, map.spawn, (x, y) => isBlocked(map, x, y, all));
const npcOf = (map: MapDefinition, id: string): NpcObject => {
  const o = map.objects.find((x) => x.id === id);
  if (!o || o.type !== 'npc') throw new Error(id);
  return o;
};
/** 絵の px（1536×1024 の部品）→ マス（1マス＝25.6px） */
const cellOf = (px: number, py: number): string => `${Math.floor(px / 25.6)},${Math.floor(py / 25.6)}`;

describe('部屋4つの新しい絵（大会会場・管理局・練習場・研究所）', () => {
  it('人の大きさがほかの部屋（カードショップ）とそろう：同じ大きさ・同じ高さの基準', () => {
    for (const m of ROOMS) {
      expect(m.art?.width).toBe(SHOP.art?.width);
      expect(m.art?.height).toBe(SHOP.art?.height);
      expect(m.art?.fitHeight).toBe(SHOP.art?.fitHeight);
    }
  });

  it('手前の壁と入口の柱（front）はいつも人より手前。部屋の箱と家具1つずつの絵を使う', () => {
    for (const m of ROOMS) {
      const sprites = m.art?.sprites ?? [];
      expect(sprites[sprites.length - 1]?.z).toBe(99999);
      expect(sprites.length).toBeGreaterThanOrEqual(5);
      expect(m.art?.tiles).toHaveLength(1);
    }
  });

  it('入ったら入口の少し内側に立ち、そこから出口まで歩ける', () => {
    for (const m of ROOMS) {
      const a = area(m);
      const exit = m.objects.find((o) => o.type === 'warp');
      if (!exit || exit.type !== 'warp') throw new Error(m.id);
      expect(a.has(`${exit.x},${exit.y}`), m.id).toBe(true);
      // 入口は手前の真ん中
      expect(Math.abs(exit.x + exit.w / 2 - (m.art?.cols ?? 0) / 2)).toBeLessThanOrEqual(2);
      expect(m.spawn.y).toBeLessThan(exit.y);
    }
  });

  it('家具の後ろに回り込める（大会会場の舞台の横・練習場の真ん中の机の奥・研究所の机の奥・管理局のメダルの棚の前）', () => {
    // 大会会場の舞台の左奥は、指示書 Z の対戦表の板でふさがった。板の前（長いすとのあいだ）へは左の通路から回り込める
    expect(area(HALL).has(cellOf(300, 330))).toBe(false);
    expect(area(HALL).has(cellOf(300, 422))).toBe(true);
    expect(area(PRACTICE).has(cellOf(760, 330))).toBe(true);
    expect(area(LAB).has(cellOf(560, 400))).toBe(true);
    expect(area(BUREAU).has(cellOf(1200, 500))).toBe(true);
    // 家具の足もとは通れない
    expect(area(HALL).has(cellOf(768, 430))).toBe(false);
    expect(area(PRACTICE).has(cellOf(870, 480))).toBe(false);
    expect(area(LAB).has(cellOf(680, 520))).toBe(false);
    expect(area(BUREAU).has(cellOf(768, 420))).toBe(false);
  });

  it('受付・研究員はカウンター・机の奥に見える（見た目だけ奥へずらす）。大会会場の受付は前から話しかける（2026-10-30 指示書 X）', () => {
    const celia = npcOf(HALL, 'hall-receptionist');
    expect(celia.drawDy ?? 0).toBeLessThan(0);
    expect(area(HALL).has(`${celia.x},${celia.y + 1}`)).toBe(true);
    const eleanor = npcOf(BUREAU, 'bureau-clerk');
    expect(eleanor.drawDy ?? 0).toBeLessThan(0);
    const lucas = npcOf(LAB, 'lab-researcher');
    expect(lucas.drawDy ?? 0).toBeLessThan(0);
    // 見た目の足もとはカウンター・机より奥（カウンター・机が腰から下を隠す）
    const footZ = (o: NpcObject, map: MapDefinition): number => (o.y + (o.drawDy ?? 0) + 0.5) * (map.art?.cell ?? 32);
    const zOf = (map: MapDefinition, file: string): number => map.art?.sprites.find((sp) => sp.file.includes(file))?.z ?? 0;
    expect(footZ(celia, HALL)).toBeLessThan(zOf(HALL, 'reception'));
    expect(footZ(eleanor, BUREAU)).toBeLessThan(zOf(BUREAU, 'counter'));
    expect(footZ(lucas, LAB)).toBeLessThan(zOf(LAB, 'desk'));
  });

  it('管理局：受付の前（ブースター選びで立つ所）は歩けて、エレノアと話せる近さ。ミレイユはその右に立てる', () => {
    const eleanor = npcOf(BUREAU, 'bureau-clerk');
    expect(area(BUREAU).has(`${BUREAU_DESK_FRONT.x},${BUREAU_DESK_FRONT.y}`)).toBe(true);
    expect(Math.max(Math.abs(eleanor.x - BUREAU_DESK_FRONT.x), Math.abs(eleanor.y - BUREAU_DESK_FRONT.y))).toBe(2);
    const guide = npcOf(BUREAU, 'guide-bureau');
    expect(isBlocked({ ...BUREAU, objects: [] }, guide.x, guide.y, all)).toBe(false);
  });

  it('練習場：対戦机は3つ・ベンチは無い。先生は真ん中の机のすぐ手前、ミレイユは先生の右', () => {
    const ids = PRACTICE.objects.map((o) => o.id);
    expect(ids.filter((id) => id.startsWith('practice-table-'))).toHaveLength(3);
    expect(ids.some((id) => id.includes('bench'))).toBe(false);
    const teacher = npcOf(PRACTICE, 'practice-teacher');
    const guide = npcOf(PRACTICE, 'guide-practice');
    expect(guide.x).toBeGreaterThan(teacher.x);
    expect(isBlocked({ ...PRACTICE, objects: [] }, guide.x, guide.y, all)).toBe(false);
  });

  it('研究所：絵に無くなった調べる物は外し、図鑑の本棚・標本棚・投影機・解析台・黒板がある', () => {
    const ids = LAB.objects.map((o) => o.id);
    for (const gone of ['lab-crystal', 'lab-specimen', 'lab-shelf2', 'lab-table', 'lab-chem']) expect(ids).not.toContain(gone);
    for (const id of ['lab-shelf', 'lab-cabinet', 'lab-projector', 'lab-analysis', 'lab-blackboard']) expect(ids).toContain(id);
  });

  it('大会会場：対戦表の板（2026-10-30 指示書 Z）。板の前（長いすとのあいだの1列）から「対戦表」を調べる。板の裏はふさぐ。板の上に小さな表は重ねない', () => {
    expect(HALL_BOARD).toBeNull();
    const board = HALL.art?.items?.BOARD;
    expect(board).toEqual({ x: 4, y: 10, w: 12, h: 7 });
    const obj = HALL.objects.find((o) => o.id === 'hall-board');
    expect(obj).toMatchObject({ type: 'interact', action: 'leagueBoard', label: '対戦表' });
    // 板の裏・脚のあいだ（10〜15行）は歩けない。すぐ下の16行（長いすとのあいだ）は歩ける。17行からは長いす
    for (let x = 4; x <= 13; x++) {
      for (let y = 10; y <= 15; y++) expect(isBlocked(HALL, x, y, () => true), `${x},${y}`).toBe(true);
      expect(isBlocked(HALL, x, 16, () => true), `${x},16`).toBe(false);
      expect(isBlocked(HALL, x, 17, () => true), `${x},17`).toBe(true);
    }
    // 板の絵（家具）は足もと y 429 で人と前後を比べる
    expect(HALL.art?.sprites.some((s) => s.file.endsWith('arena_board.webp'))).toBe(true);
    expect(HALL.objects.some((o) => o.id === 'hall-desk')).toBe(true);
  });
});
