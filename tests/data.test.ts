import { describe, expect, it } from 'vitest';
import { cardCatalog, HIDDEN_MONSTER_ID, MONSTERS, SKILLS, skillsOf, SUPPORTS } from '../src/data/cards.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { getPack, NEVER_IN_PACKS, PACKS } from '../src/data/economy.ts';
import { FRAGMENT_TOTAL, FRAGMENTS } from '../src/data/fragments.ts';
import { getMap, MAPS, TILE_INFO, type MapDefinition } from '../src/data/maps.ts';
import { TOURNAMENTS } from '../src/data/tournaments.ts';
import { validatePack } from '../src/game/economy/gacha.ts';
import { isBlocked, isSolidTile, objectsAt, reachable, tileAt } from '../src/game/world/world.ts';

describe('カードデータ（仮）', () => {
  it('技カードの数値は V4 テンプレートの数字の範囲（マナ0〜10・数値1〜10。マナ0 は正式カードで使う）', () => {
    for (const s of SKILLS) {
      expect(s.cost).toBeGreaterThanOrEqual(s.isPlaceholder ? 1 : 0);
      expect(s.cost).toBeLessThanOrEqual(10);
      if (s.stat === null) continue;
      expect(s.stat.value).toBeGreaterThanOrEqual(1);
      expect(s.stat.value).toBeLessThanOrEqual(10);
    }
  });

  it('すべての技カードの適合モンスターが存在する', () => {
    for (const s of SKILLS) expect(cardCatalog.get(s.monsterId)?.kind).toBe('monster');
  });

  it('仮データであることが明示されている（正式カードはソラモ・ラズック・ガウルだけ）', () => {
    for (const c of [...MONSTERS, ...SKILLS, ...SUPPORTS]) {
      const official =
        ['mon-soramo', 'mon-lazuck', 'mon-gauul', 'mon-nobiton', 'mon-myurol', 'mon-kalshell', 'mon-pukarim', 'mon-geol', 'mon-flune', 'mon-serephine', 'mon-tsumuji', 'mon-hyouzuku', 'mon-shishien'].includes(c.id) ||
        ['skl-soramo14-', 'skl-lazuck-', 'skl-gauul14-', 'skl-nobiton-', 'skl-myurol-', 'skl-kalshell-', 'skl-pukarim-', 'skl-geol-', 'skl-flune-', 'skl-serephine-', 'skl-tsumuji-', 'skl-hyouzuku-', 'skl-shishien-'].some((p) => c.id.startsWith(p)) ||
        // サポート11種類（2026-10-30 指示書 Y）
        c.kind === 'support';
      expect(c.isPlaceholder).toBe(!official);
    }
  });

  it('サポートカードは正式の11種類（2026-10-30 指示書 Y）。すぐ効くカードは全部まとめて1ターン1回、場に残るカードは回数制限なし', () => {
    expect(SUPPORTS).toHaveLength(11);
    expect(SUPPORTS.map((c) => c.code)).toEqual(['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'F01', 'F02', 'F03', 'F04']);
    for (const c of SUPPORTS) {
      expect(c.kind).toBe('support');
      expect(c.isPlaceholder).toBe(false);
      expect(c.name.startsWith('仮')).toBe(false);
    }
    for (const c of SUPPORTS.filter((x) => x.duration === 'instant')) expect(c).toMatchObject({ limitGroup: 'breeder', limitPerTurn: 1 });
    for (const c of SUPPORTS.filter((x) => x.duration === 'field')) expect(['field', 'guardDiscount']).toContain(c.effect.type);
    // 古いパック（第1〜2弾・仮）は同じ ID のまま新しい中身で出る
    expect(PACKS.some((p) => p.cardIds.includes('sup-1'))).toBe(true);
  });

  it('各モンスターに守備（ちから・かしこさの防御か回避）を含む適合技がある', () => {
    for (const m of MONSTERS.filter((x) => !x.hidden && x.isPlaceholder)) {
      const skills = skillsOf(m.id);
      expect(skills.length).toBe(6);
      const guards = skills.filter((s) => s.effect.type === 'defense' || s.effect.type === 'evade');
      expect(new Set(guards.map((s) => s.stat?.type))).toEqual(new Set(['force', 'wisdom']));
      expect(guards.some((s) => s.effect.type === 'evade')).toBe(true);
    }
  });

  it('隠しモンスターは未確定として扱い、正体を創作していない', () => {
    const hidden = cardCatalog.get(HIDDEN_MONSTER_ID);
    expect(hidden?.kind).toBe('monster');
    expect(hidden && hidden.kind === 'monster' && hidden.undetermined).toBe(true);
    expect(hidden?.name).toContain('未確定');
  });
});

describe('パック（仮）', () => {
  it.each(PACKS.map((p) => [p.id, p] as const))('%s の提供割合・収録内容が正しい', (_id, pack) => {
    expect(validatePack(pack)).toEqual([]);
  });

  it('隠しモンスター本体はどのパックにも入っていない', () => {
    for (const p of PACKS) expect(p.cardIds).not.toContain(HIDDEN_MONSTER_ID);
    expect(NEVER_IN_PACKS).toContain(HIDDEN_MONSTER_ID);
  });

  it('隠しモンスターの技カードは対応パックから入手できる', () => {
    const hiddenSkills = skillsOf(HIDDEN_MONSTER_ID).map((s) => s.id);
    expect(hiddenSkills.length).toBeGreaterThan(0);
    for (const id of hiddenSkills) expect(PACKS.some((p) => p.cardIds.includes(id))).toBe(true);
  });

  it('パックごとに収録モンスターが異なる', () => {
    const monsterSets = PACKS.map((p) => p.cardIds.filter((id) => cardCatalog.get(id)?.kind === 'monster'));
    const all = monsterSets.flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('最初から買えるのは第1弾だけ', () => {
    expect(PACKS.filter((p) => p.unlockedFromStart).map((p) => p.id)).toEqual(['pack-01']);
  });
});

describe('大会（仮）', () => {
  it('景品で解放するパック・カードが存在する', () => {
    for (const t of TOURNAMENTS) {
      for (const id of t.rewards.firstWin.unlockPacks) expect(getPack(id)).toBeDefined();
      for (const c of t.rewards.firstWin.cards) expect(cardCatalog.get(c.cardId)).toBeDefined();
      for (const r of t.rounds) {
        expect(r.monsters).toHaveLength(3);
        for (const m of r.monsters) expect(cardCatalog.get(m)?.kind).toBe('monster');
      }
    }
  });

  it('大会の景品に、販売機から外した仮パックの解放は入れない（2026-10-28 夜）', () => {
    expect(TOURNAMENTS.flatMap((t) => t.rewards.firstWin.unlockPacks)).toEqual([]);
  });
});

/* ---------- マップ ---------- */

const noObjectsBlocked = (map: MapDefinition) => (x: number, y: number) => isSolidTile(tileAt(map, x, y));

describe('マップ（仮）', () => {
  it.each(MAPS.map((m) => [m.id, m] as const))('%s：行の長さがそろい、記号はすべて定義済み', (_id, map) => {
    const width = map.tiles[0]?.length ?? 0;
    for (const row of map.tiles) {
      expect(row.length).toBe(width);
      for (const ch of row) expect(TILE_INFO[ch]).toBeDefined();
    }
  });

  it.each(MAPS.map((m) => [m.id, m] as const))('%s：出現位置は歩けるマス', (_id, map) => {
    expect(isBlocked(map, map.spawn.x, map.spawn.y, () => true)).toBe(false);
    if (map.upArrival) expect(isBlocked(map, map.upArrival.x, map.upArrival.y, () => true)).toBe(false);
  });

  it.each(MAPS.map((m) => [m.id, m] as const))('%s：出入口・階段・宝箱・敵・家具に到達できる（進行不能防止）', (_id, map) => {
    // 敵は倒せば通れるので、壁・家具だけを障害物として到達可能範囲を調べる
    const area = reachable(map, map.spawn, noObjectsBlocked(map));
    for (const obj of map.objects) {
      const cells: [number, number][] = [];
      if (obj.type === 'enemy' || obj.type === 'chest') cells.push([obj.x, obj.y]);
      else for (let dy = 0; dy < obj.h; dy++) for (let dx = 0; dx < obj.w; dx++) cells.push([obj.x + dx, obj.y + dy]);
      const ok = cells.some(([x, y]) =>
        [
          [x, y],
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ].some(([ax, ay]) => area.has(`${ax},${ay}`)),
      );
      expect(ok, `${obj.id} に到達できない`).toBe(true);
    }
  });

  it('出入口の行き先は歩けるマス', () => {
    for (const map of MAPS) {
      for (const obj of map.objects) {
        if (obj.type !== 'warp' || obj.target.kind !== 'map') continue;
        const dest = getMap(obj.target.mapId);
        expect(dest, obj.id).toBeDefined();
        if (!dest) continue;
        expect(isBlocked(dest, obj.target.x, obj.target.y, () => true), obj.id).toBe(false);
        // 行き先が出入口の上だと、すぐ戻されてしまう
        expect(objectsAt(dest, obj.target.x, obj.target.y).some((o) => o.type === 'warp'), obj.id).toBe(false);
      }
    }
  });

  it('ダンジョンは地下3階で、最下層にボスがいる', () => {
    const dungeon = DUNGEONS[0];
    expect(dungeon?.floors).toHaveLength(3);
    const last = getMap(dungeon?.floors[2] ?? '');
    expect(last?.objects.some((o) => o.type === 'enemy' && o.boss)).toBe(true);
    const b2 = getMap(dungeon?.floors[1] ?? '');
    expect(b2?.objects.filter((o) => o.type === 'chest').length).toBeGreaterThanOrEqual(2);
  });

  it('敵の編成がすべて定義されている', () => {
    for (const map of MAPS) {
      for (const obj of map.objects) {
        if (obj.type === 'enemy') expect(ENCOUNTERS[obj.encounterId], obj.id).toBeDefined();
      }
    }
  });
});

describe('欠片', () => {
  it('合計10個、IDと場所が重複しない', () => {
    expect(FRAGMENTS).toHaveLength(FRAGMENT_TOTAL);
    expect(FRAGMENT_TOTAL).toBe(10);
    expect(new Set(FRAGMENTS.map((f) => f.id)).size).toBe(10);
    expect(new Set(FRAGMENTS.map((f) => `${f.mapId}:${f.x},${f.y}`)).size).toBe(10);
  });

  it('街とダンジョンに配置され、すべて歩いて行ける場所にある', () => {
    const areas = new Set(FRAGMENTS.map((f) => getMap(f.mapId)?.area));
    expect(areas).toEqual(new Set(['town', 'dungeon']));
    for (const f of FRAGMENTS) {
      const map = getMap(f.mapId);
      expect(map, f.id).toBeDefined();
      if (!map) continue;
      const area = reachable(map, map.spawn, noObjectsBlocked(map));
      expect(area.has(`${f.x},${f.y}`), f.id).toBe(true);
      // 出入口の上には置かない（調べる前に移動してしまうため）
      expect(objectsAt(map, f.x, f.y).length, f.id).toBe(0);
    }
  });
});
