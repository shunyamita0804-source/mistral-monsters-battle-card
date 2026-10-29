import { describe, expect, it } from 'vitest';
import { getMap, HOUSES, TOWN, townDoorFront, type MapDefinition } from '../src/data/maps.ts';
import { createNewSave, DEFAULT_LOCATION, normalizeSave, SAVE_VERSION } from '../src/game/save/saveData.ts';
import { findPath, isBlocked } from '../src/game/world/world.ts';
import { FRAGMENTS } from '../src/data/fragments.ts';

/** 2026-10-28 指示書「街を新しい絵で作り直す」 */
const art = TOWN.art!;
const blockedIn = (map: MapDefinition) => (x: number, y: number) => isBlocked(map, x, y, () => true);

describe('新しい街（2026-10-28）', () => {
  it('建物11棟の扉があり、どの扉も出発の場所（主人公の家の前）から歩いて行ける', () => {
    const ids = ['ARENA', 'BUREAU', 'LAB', 'TRAINING', 'SHOP', 'HOUSE_A', 'HOUSE_D', 'HOUSE_B', 'HOUSE_E', 'PLAYER_HOME', 'GUIDE_HOME'];
    expect(Object.keys(art.doors ?? {}).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      const front = townDoorFront(id);
      expect(findPath(TOWN, TOWN.spawn, front, blockedIn(TOWN)), id).not.toBeNull();
    }
    // 12 大工の作業小屋は入れない（扉が無い）
    expect(art.doors?.SHED).toBeUndefined();
  });

  it('出発の場所は主人公の家の前（決まった位置・新しく始めたあとに外へ出る所と同じ）', () => {
    const home = townDoorFront('PLAYER_HOME');
    expect(TOWN.spawn.x).toBe(home.x);
    expect(TOWN.spawn.y - home.y).toBeGreaterThan(0);
    expect(TOWN.spawn.y - home.y).toBeLessThanOrEqual(3);
    expect({ x: DEFAULT_LOCATION.x, y: DEFAULT_LOCATION.y }).toEqual({ x: TOWN.spawn.x, y: TOWN.spawn.y });
  });

  it('建物は人と前後を比べて重ねる絵（後ろに回ると隠れる）。扉の前に立つと手前に描かれる', () => {
    const building = art.sprites.find((s) => s.file.includes('t2_arena'));
    expect(building).toBeDefined();
    const door = art.doors!.ARENA!;
    // 足元の y（単位）：扉の前のマスは建物の z より手前、扉の1つ上の行は奥
    expect((door.back.y + 0.5) * art.cell).toBeGreaterThan(building!.z!);
    expect((door.y - 1 + 0.5) * art.cell).toBeLessThan(building!.z!);
  });

  it('大会会場は街でいちばん大きい建物', () => {
    const area = (name: string) => {
      const s = art.sprites.find((x) => x.file.includes(`t2_${name}.`));
      return (s?.w ?? 0) * (s?.h ?? 0);
    };
    const arena = area('arena');
    for (const b of ['bureau', 'lab', 'training', 'shop', 'house_a', 'house_b', 'house_d', 'house_e', 'player_home', 'guide_home', 'shed']) {
      expect(arena, b).toBeGreaterThan(area(b));
    }
  });

  it('噴水のしぶきは3コマをくり返す。カードショップの自動ドアは入口の枠の中で左右へ開く', () => {
    expect(art.loops?.[0]?.frames.length).toBe(3);
    const shop = art.doorAnims?.find((d) => d.id === 'SHOP');
    expect(shop).toBeDefined();
    expect(shop!.travel).toBeGreaterThan(0);
    expect(shop!.left.x).toBeLessThan(shop!.right.x);
    expect(shop!.z).toBeGreaterThan(art.sprites.find((s) => s.file.includes('t2_shop.'))!.z!);
  });

  it('住宅B・E（ピート・ハロルド）の中は空、外にピートとハロルドがいる', () => {
    expect(HOUSES.find((h) => h.id === 'house-b')?.objects.some((o) => o.type === 'npc')).toBe(false);
    expect(HOUSES.find((h) => h.id === 'house-e')?.objects.some((o) => o.type === 'npc')).toBe(false);
    for (const id of ['town-pete', 'town-harold']) {
      const npc = TOWN.objects.find((o) => o.id === id);
      expect(npc, id).toBeDefined();
      expect(isBlocked(TOWN, npc!.x, npc!.y, () => false), id).toBe(false);
    }
    // マルタ・ロザリーは店（2026-10-29 新しい部屋 florist・tailor）の中
    expect(getMap('florist')?.objects.some((o) => o.type === 'npc' && o.npcId === 'resident_a')).toBe(true);
    expect(getMap('tailor')?.objects.some((o) => o.type === 'npc' && o.npcId === 'resident_d')).toBe(true);
  });

  it('2026-10-28 直し：石の橋は道の幅だけ歩ける（橋の下の水の上は歩けない）・東西のはしは林で通れない・欠片の場所へ歩いて行ける', () => {
    const cell = art.cell;
    // 小川の上（石の橋：y 4900〜5520・x 2880〜3520、木の橋：y 4780〜4900・x 1100〜2000）で歩けるのは橋の真ん中の列だけ
    const check = (ys: [number, number], xs: [number, number], ok: [number, number]) => {
      let open = 0;
      for (let y = Math.floor(ys[0] / cell); y <= Math.floor(ys[1] / cell); y++) {
        for (let x = Math.floor(xs[0] / cell); x <= Math.floor(xs[1] / cell); x++) {
          if (blockedIn(TOWN)(x, y)) continue;
          open++;
          const ux = (x + 0.5) * cell;
          expect(ux > ok[0] && ux < ok[1], `x=${x} y=${y}`).toBe(true);
        }
      }
      expect(open).toBeGreaterThan(0);
    };
    // 2026-10-30：正面向きの新しい石の橋。床の幅は南の大通りと同じ（x 2944〜3456）。塔の外がわ（街灯）より内の列で確かめる
    check([4900, 5520], [2880, 3520], [2944, 3456]);
    // 木の橋は 2026-10-28 点検でまっすぐにして、主人公の家ととなりの家のあいだ（真ん中 1615）へ
    check([4780, 4900], [1100, 2000], [1540, 1700]);
    // 東西のはし（林のへり 300 単位）はどの行も歩けない
    for (let y = 0; y < art.rows; y++) {
      expect(blockedIn(TOWN)(0, y)).toBe(true);
      expect(blockedIn(TOWN)(Math.floor(250 / cell), y)).toBe(true);
      expect(blockedIn(TOWN)(art.cols - 1 - Math.floor(250 / cell), y)).toBe(true);
    }
    for (const f of FRAGMENTS.filter((x) => x.mapId === 'town')) {
      expect(findPath(TOWN, TOWN.spawn, { x: f.x, y: f.y }, blockedIn(TOWN)), f.id).not.toBeNull();
    }
  });

  it(`前の街にいたセーブ（version 19）は、主人公の家の前に移す（version ${SAVE_VERSION}）`, () => {
    const old = { ...createNewSave(new Date('2026-10-28T00:00:00Z')), version: 19, location: { mapId: 'town', x: 80, y: 100, dir: 'up' } };
    const loaded = normalizeSave(old);
    expect(loaded?.location).toMatchObject({ mapId: 'town', x: DEFAULT_LOCATION.x, y: DEFAULT_LOCATION.y });
    const inRoom = normalizeSave({ ...old, location: { mapId: 'home', x: 12, y: 14, dir: 'down' } });
    expect(inRoom?.location).toMatchObject({ mapId: 'home', x: 12, y: 14 });
  });
});
