import { describe, expect, it } from 'vitest';
import { FLORIST, getMap, SHOP, TAILOR, TOWN, type MapDefinition, type NpcObject } from '../src/data/maps.ts';
import { SHOP_ROOMS_ART } from '../src/data/shopRoomsArt.generated.ts';
import { createNewSave, normalizeSave } from '../src/game/save/saveData.ts';
import { adjacentCellOf, isBlocked, objectsAt, reachable } from '../src/game/world/world.ts';

/** 花屋・仕立て屋の中の新しい絵（2026-10-29。tools/design/rooms_shop_build.py）。2026-10-31 指示書 AD【1】で正面向きの絵に */
const ROOMS: readonly MapDefinition[] = [FLORIST, TAILOR];
const all = (): boolean => true;
const area = (map: MapDefinition): Set<string> => reachable(map, map.spawn, (x, y) => isBlocked(map, x, y, all));
const npcOf = (map: MapDefinition, id: string): NpcObject => {
  const o = map.objects.find((x) => x.id === id);
  if (!o || o.type !== 'npc') throw new Error(id);
  return o;
};
/** 絵の px（1536×1024 の部品）→ マス（1マス＝25.6px） */
const cellOf = (px: number, py: number): string => `${Math.floor(px / 25.6)},${Math.floor(py / 25.6)}`;

describe('花屋・仕立て屋の新しい部屋', () => {
  it('街の住宅A の扉 → 花屋、住宅D の扉 → 仕立て屋。住宅B・E は今の民家のまま', () => {
    const door = (id: string) => TOWN.objects.find((o) => o.id === id);
    const target = (id: string) => {
      const d = door(id);
      return d?.type === 'warp' && d.target.kind === 'map' ? d.target.mapId : null;
    };
    expect(target('door-house-a')).toBe('florist');
    expect(target('door-house-d')).toBe('tailor');
    expect(target('door-house-b')).toBe('house-b');
    expect(target('door-house-e')).toBe('house-e');
    expect(getMap('house-a')).toBeUndefined();
    expect(getMap('house-d')).toBeUndefined();
    // 入ったら新しい部屋の入口に立つ
    const a = door('door-house-a');
    if (a?.type !== 'warp' || a.target.kind !== 'map') throw new Error('door-house-a');
    expect({ x: a.target.x, y: a.target.y }).toEqual({ x: FLORIST.spawn.x, y: FLORIST.spawn.y });
  });

  it('人の大きさがほかの部屋とそろう。手前の壁と入口の柱はいつも人より手前', () => {
    for (const m of ROOMS) {
      expect(m.art?.width).toBe(SHOP.art?.width);
      expect(m.art?.height).toBe(SHOP.art?.height);
      expect(m.art?.fitHeight).toBe(SHOP.art?.fitHeight);
      const sprites = m.art?.sprites ?? [];
      expect(sprites[sprites.length - 1]?.z).toBe(99999);
      expect(m.art?.tiles).toHaveLength(1);
    }
    expect(FLORIST.art?.sprites).toHaveLength(7);
    expect(TAILOR.art?.sprites).toHaveLength(11);
  });

  it('入口は手前の真ん中（柱の間）。入口から出口まで歩け、入口からカウンターまでの床は広くあいている', () => {
    for (const m of ROOMS) {
      const a = area(m);
      const exit = m.objects.find((o) => o.type === 'warp');
      if (!exit || exit.type !== 'warp') throw new Error(m.id);
      expect(a.has(`${exit.x},${exit.y}`), m.id).toBe(true);
      expect(Math.abs(exit.x + exit.w / 2 - (m.art?.cols ?? 0) / 2)).toBeLessThanOrEqual(2);
      expect(m.spawn.y).toBeLessThan(exit.y);
      // 作業台の手前（y 595〜680。その下は入口の柱の高さ）は x 430〜1140 がすべて歩ける（2026-10-31 指示書 AD：左右の花のひな壇・布の陳列台のあいだ）
      for (let px = 430; px <= 1140; px += 25.6) for (let py = 595; py <= 680; py += 25.6) expect(a.has(cellOf(px, py)), `${m.id} ${px},${py}`).toBe(true);
    }
  });

  it('歩けるのは床の上だけ（奥の壁・手前の低い壁の上・入口の柱は歩けない）。家具の足もとは通れない', () => {
    for (const m of ROOMS) {
      const a = area(m);
      expect(a.has(cellOf(768, 200)), m.id).toBe(false);
      expect(a.has(cellOf(200, 800)), m.id).toBe(false);
      expect(a.has(cellOf(1300, 800)), m.id).toBe(false);
      expect(a.has(cellOf(480, 850)), m.id).toBe(false);
      expect(a.has(cellOf(1050, 850)), m.id).toBe(false);
      expect(a.has(cellOf(640, 520)), m.id).toBe(false); // カウンター
      expect(a.has(cellOf(1020, 520)), m.id).toBe(false); // 丸いす
    }
    expect(area(FLORIST).has(cellOf(250, 450))).toBe(false); // 左の花の段
    expect(area(FLORIST).has(cellOf(1380, 450))).toBe(false); // 右の花の段
    expect(area(TAILOR).has(cellOf(300, 650))).toBe(false); // 布の陳列台（左の手前）
    expect(area(TAILOR).has(cellOf(150, 520))).toBe(false); // 左の壁ぞいの低い棚
    expect(area(TAILOR).has(cellOf(180, 350))).toBe(false); // 左奥の収納棚
    expect(area(FLORIST).has(cellOf(140, 704))).toBe(false); // 左の手前の鉢植え
    expect(area(TAILOR).has(cellOf(1280, 350))).toBe(false); // 試着の囲い
    expect(area(TAILOR).has(cellOf(1460, 600))).toBe(false); // 姿見
  });

  it('家具の後ろに回れる：カウンターの奥（店番の所は入らない）・仕立て屋の右のトルソーの奥', () => {
    for (const m of ROOMS) {
      const a = area(m);
      expect(a.has(cellOf(580, 400)), m.id).toBe(true);
      expect(a.has(cellOf(960, 400)), m.id).toBe(true);
      expect(a.has(cellOf(768, 405)), m.id).toBe(false);
      // カウンターの奥にいる人は、カウンターより奥に描かれる（足もとの y がカウンターの z より小さい）
      const counter = m.art?.sprites.find((s) => s.file.includes('counter'));
      expect((counter?.z ?? 0) > 16 * 32).toBe(true);
    }
    expect(area(TAILOR).has(cellOf(1300, 540))).toBe(true);
  });

  it('店番（マルタ・ロザリー）はカウンターの奥に見え、カウンターの手前の床から話しかける。丸いすに重ならない', () => {
    for (const [m, id, who] of [[FLORIST, 'florist-keeper', 'resident_a'], [TAILOR, 'tailor-keeper', 'resident_d']] as const) {
      const k = npcOf(m, id);
      expect(k.npcId).toBe(who);
      expect(k.drawDy ?? 0).toBeLessThan(0);
      const cell = m.art?.cell ?? 32;
      const footY = (k.y + (k.drawDy ?? 0) + 0.5) * cell;
      const footX = (k.x + (k.drawDx ?? 0) + 0.5) * cell;
      const counter = m.art?.sprites.find((s) => s.file.includes('counter'));
      expect(footY).toBeLessThan(counter?.z ?? 0);
      // カウンター（x 521〜1054・丸いすは右はしの x 995〜）の内側
      expect(footX).toBeGreaterThan(521 * 1.25 + 60);
      expect(footX).toBeLessThan(995 * 1.25 - 60);
      // 話しかける所はカウンターの手前の床
      const front = { x: k.x, y: k.y + 1 };
      expect(area(m).has(`${front.x},${front.y}`)).toBe(true);
      expect(adjacentCellOf(k, front)).toEqual({ x: k.x, y: k.y });
    }
  });

  it('調べる物：花屋＝花の段（左右）・奥の棚・吊り花かご、仕立て屋＝布の棚・試着の囲い・姿見・トルソー（左右）・布の台。どれも歩ける所のとなり', () => {
    const ids = (m: MapDefinition) => m.objects.filter((o) => o.type === 'interact').map((o) => o.id);
    // 2026-10-31 指示書 AE：花屋の手前の鉢植え（左右）・花台、仕立て屋の左の棚2つを足した（今ある物はそのまま・前に並べる）
    expect(ids(FLORIST)).toEqual(['florist-basket-l', 'florist-basket-r', 'florist-steps-l', 'florist-steps-r', 'florist-shelf', 'florist-plant-l', 'florist-plant-stand', 'florist-plant-r']);
    expect(ids(TAILOR)).toEqual(['tailor-cloth-shelf', 'tailor-fitting', 'tailor-mirror', 'tailor-torso-l', 'tailor-torso-r', 'tailor-cloth-table', 'tailor-box-cabinet', 'tailor-low-cabinet']);
    for (const m of ROOMS) {
      const a = area(m);
      for (const o of m.objects) {
        if (o.type !== 'interact') continue;
        let near = false;
        for (let x = o.x; x < o.x + o.w; x++) for (let y = o.y; y < o.y + o.h; y++) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            if (!a.has(`${x + dx},${y + dy}`)) continue;
            // その方向を向いて調べると、この物が見つかる（重なった別の物ではない）
            if (objectsAt(m, x, y, all)[0]?.id === o.id) near = true;
          }
        }
        expect(near, o.id).toBe(true);
        expect(o.message, o.id).toBeTruthy();
      }
    }
  });

  it('指示書 AE の調べる所5か所：となりの歩ける床から調べられて、鉢の後ろへ回りこめるのも前のまま', () => {
    const msg = (m: MapDefinition, id: string): string | undefined => {
      const o = m.objects.find((x) => x.id === id);
      return o?.type === 'interact' ? o.message : undefined;
    };
    expect(msg(FLORIST, 'florist-plant-l')).toBe('大きな葉の観葉植物。葉が一枚ずつ、ていねいにふいてある。');
    expect(msg(FLORIST, 'florist-plant-stand')).toBe('小さな台の上に、白い花の鉢がひとつ。今日いちばんのおすすめらしい。');
    expect(msg(FLORIST, 'florist-plant-r')).toBe('入口の横で、大きな鉢植えがお客さんを出むかえている。');
    expect(msg(TAILOR, 'tailor-box-cabinet')).toBe('青い小箱に、色とりどりのボタンがぎっしりつまっている。');
    expect(msg(TAILOR, 'tailor-low-cabinet')).toBe('引き出しに、巻き尺や糸巻きがきちんとしまってある。');
    // 鉢の後ろ（すぐ上の行）は歩ける
    expect(area(FLORIST).has(cellOf(140, 678))).toBe(true);
    expect(area(FLORIST).has(cellOf(1400, 678))).toBe(true);
    // 範囲は家具の当たりの所だけ（歩ける床にはかけない）
    for (const [m, ids] of [[FLORIST, ['florist-plant-l', 'florist-plant-stand', 'florist-plant-r']], [TAILOR, ['tailor-box-cabinet', 'tailor-low-cabinet']]] as const) {
      const a = area(m);
      for (const id of ids) {
        const o = m.objects.find((x) => x.id === id);
        if (!o || o.type !== 'interact') throw new Error(id);
        for (let x = o.x; x < o.x + o.w; x++) for (let y = o.y; y < o.y + o.h; y++) expect(a.has(`${x},${y}`), `${id} ${x},${y}`).toBe(false);
      }
    }
  });

  it('セーブの場所が住宅A・D の中なら、新しい部屋の入口へ', () => {
    const base = { ...createNewSave(), version: 23 } as unknown as Record<string, unknown>;
    const a = normalizeSave({ ...base, location: { mapId: 'house-a', x: 10, y: 12, dir: 'down' } });
    expect(a?.location).toEqual({ mapId: 'florist', x: SHOP_ROOMS_ART.florist.spawn.x, y: SHOP_ROOMS_ART.florist.spawn.y, dir: 'up' });
    const d = normalizeSave({ ...base, location: { mapId: 'house-d', x: 10, y: 12, dir: 'down' } });
    expect(d?.location.mapId).toBe('tailor');
    const b = normalizeSave({ ...base, location: { mapId: 'house-b', x: 10, y: 12, dir: 'down' } });
    expect(b?.location).toEqual({ mapId: 'house-b', x: 10, y: 12, dir: 'down' });
  });
});
