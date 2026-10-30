import { describe, expect, it } from 'vitest';
import { skillsOf } from '../src/data/cards.ts';
import { GEOL_MONSTER_ID } from '../src/data/geol.ts';
import { DUNGEON_RUN, runBattlerLook, runBossOpponent, runGuardianOpponent, runNpcOpponent } from '../src/data/dungeonRun.ts';
import { DUNGEON_MONEY } from '../src/data/economy.ts';
import { bfs, blocksWay, generateFloor, isFloorReachable, type DungeonFloor } from '../src/game/dungeon/generate.ts';
import {
  activeEntities,
  bossRewardCandidates,
  descend,
  entityAt,
  floorsOf,
  isVisible,
  loseRunBattle,
  move,
  nearGuardian,
  openRunChest,
  reveal,
  rewardCandidates,
  runFloor,
  sanitizeRun,
  startRun,
  winRunBattle,
} from '../src/game/dungeon/run.ts';
import { createNewSave, migrate, normalizeSave, SAVE_VERSION, type DungeonRun, type SaveData } from '../src/game/save/saveData.ts';

const SEEDS = Array.from({ length: 120 }, (_, i) => (i * 7919 + 13) | 0);

function started(seed = 12345): SaveData {
  return startRun(createNewSave(), 'dungeon-01', seed);
}

function runOf(save: SaveData): DungeonRun {
  if (!save.dungeonRun) throw new Error('挑戦がない');
  return save.dungeonRun;
}

describe('ダンジョンの階のランダム生成', () => {
  it('同じシード・同じ階なら同じ形になる（中断して再開できる）', () => {
    expect(generateFloor(42, 1, false)).toEqual(generateFloor(42, 1, false));
    expect(generateFloor(42, 0, false).tiles).not.toEqual(generateFloor(43, 0, false).tiles);
  });

  it('どのシードでも、スタートから階段（最後の階はボス）とすべてのバトラー・宝箱まで行ける', () => {
    for (const seed of SEEDS) {
      for (let floor = 0; floor < DUNGEON_RUN.floors; floor++) {
        const last = floor === DUNGEON_RUN.floors - 1;
        const f = generateFloor(seed, floor, last);
        expect(isFloorReachable(f), `seed ${seed} floor ${floor}`).toBe(true);
        expect(f.tiles[f.start.y]?.[f.start.x]).toBe('.');
        if (last) {
          expect(f.stairs).toBeNull();
          expect(f.entities.filter((e) => e.kind === 'boss')).toHaveLength(1);
        } else {
          expect(f.stairs).not.toBeNull();
          expect(f.entities.some((e) => e.kind === 'boss')).toBe(false);
        }
      }
    }
  });

  it('格子の大きさ・置くものの数は定数どおり。置いたものは床の上で、重ならない', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const f = generateFloor(seed, 0, false);
      expect(f.width).toBe(DUNGEON_RUN.grid * DUNGEON_RUN.cell);
      expect(f.tiles).toHaveLength(f.height);
      const count = (k: string): number => f.entities.filter((e) => e.kind === k).length;
      expect(count('npc')).toBe(DUNGEON_RUN.npcsPerFloor);
      expect(count('chest')).toBe(DUNGEON_RUN.chestsPerFloor);
      expect(count('guardian')).toBe(DUNGEON_RUN.guardiansPerFloor);
      const spots = new Set<string>();
      for (const e of f.entities) {
        expect(f.tiles[e.y]?.[e.x]).toBe('.');
        spots.add(`${e.x},${e.y}`);
        expect(e.x === f.start.x && e.y === f.start.y).toBe(false);
      }
      expect(spots.size).toBe(f.entities.length);
    }
  });

  it('外周はすべて壁', () => {
    const f = generateFloor(7, 2, true);
    expect(f.tiles[0]).toMatch(/^#+$/);
    expect(f.tiles[f.height - 1]).toMatch(/^#+$/);
    for (const row of f.tiles) {
      expect(row[0]).toBe('#');
      expect(row[row.length - 1]).toBe('#');
    }
  });
});

describe('ダンジョンの挑戦', () => {
  it('始めると1階のスタート。最初は自分と隣のマスだけ見えている。位置は街の入り口のまま', () => {
    const base = createNewSave();
    const save = startRun(base, 'dungeon-01', 99);
    const run = runOf(save);
    const f = runFloor(run);
    expect(run.floor).toBe(0);
    expect({ x: run.x, y: run.y }).toEqual(f.start);
    expect(save.location).toEqual(base.location);
    expect(save.activeDungeon).toBeNull();
    const seen = [...run.explored].filter((c) => c === '1').length;
    expect(seen).toBe((DUNGEON_RUN.viewRadius * 2 + 1) ** 2);
    expect(isVisible(run, run.x + 1, run.y + 1)).toBe(true);
    expect(isVisible(run, run.x + 2, run.y)).toBe(false);
  });

  it('見たマスは残る（オートマッピング）', () => {
    const f = runFloor({ seed: 5, floor: 0 });
    const a = reveal('', f, f.start);
    const b = reveal(a, f, { x: f.start.x + 3, y: f.start.y });
    expect(b[f.start.y * f.width + f.start.x]).toBe('1');
    expect(b[f.start.y * f.width + f.start.x + 3]).toBe('1');
  });

  it('壁やバトラーの前では向きだけ変わる。進むと見たマスが広がる', () => {
    const save = started(2024);
    let run = runOf(save);
    const f = runFloor(run);
    // スタートから動ける向きを探す
    const dirs = ['up', 'down', 'left', 'right'] as const;
    const step = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;
    const open = dirs.find((d) => f.tiles[run.y + step[d][1]]?.[run.x + step[d][0]] === '.' && !entityAt(run, f, run.x + step[d][0], run.y + step[d][1]));
    const blocked = dirs.find((d) => f.tiles[run.y + step[d][1]]?.[run.x + step[d][0]] !== '.');
    if (open) {
      const r = move(run, open);
      expect(r.moved).toBe(true);
      expect([...r.run.explored].filter((c) => c === '1').length).toBeGreaterThanOrEqual([...run.explored].filter((c) => c === '1').length);
      run = r.run;
    }
    if (blocked) {
      const r = move({ ...run, x: runFloor(run).start.x, y: runFloor(run).start.y }, blocked);
      expect(r.moved).toBe(false);
      expect(r.run.dir).toBe(blocked);
    }
  });

  it('見えない番人：近いと予兆。戦ったあとの歩数の間は抽選しない', () => {
    const save = started(31337);
    const run = runOf(save);
    const f = runFloor(run);
    const g = f.entities.find((e) => e.kind === 'guardian');
    if (!g) throw new Error('番人がいない');
    const near: DungeonRun = { ...run, x: g.x, y: g.y };
    expect(nearGuardian(near, f)).toBe(true);
    expect(nearGuardian({ ...near, cooldown: 5 }, f)).toBe(false);
    // 番人の上を行ったり来たりすると、いつかは抽選に当たる。休みの間は当たらない
    const dirs = ['up', 'down', 'left', 'right'] as const;
    let r = { ...near };
    let met = false;
    for (let i = 0; i < 400 && !met; i++) {
      const res = move(r, dirs[i % 4] as (typeof dirs)[number]);
      met = !!res.guardian;
      r = res.moved ? { ...res.run, x: g.x, y: g.y } : res.run;
    }
    expect(met).toBe(true);
    let cool: DungeonRun = { ...near, cooldown: 3 };
    for (let i = 0; i < 3; i++) {
      const res = move(cool, dirs[i % 4] as (typeof dirs)[number]);
      expect(res.guardian).toBeNull();
      cool = { ...res.run, x: g.x, y: g.y };
    }
  });

  it('下りると次の階のスタート。上り階段はなく、最後の階より下へは行かない（太古の遺跡は 2026-10-29 から地下4階）', () => {
    const run = runOf(started(1));
    const r1 = descend(run);
    expect(r1.floor).toBe(1);
    expect({ x: r1.x, y: r1.y }).toEqual(runFloor(r1).start);
    const r2 = descend(r1);
    expect(r2.floor).toBe(2);
    const r3 = descend(r2);
    expect(r3.floor).toBe(3);
    expect(descend(r3)).toBe(r3);
  });

  it('宝箱は1度だけ開く（2回目は中身なし）', () => {
    const save = started(3);
    const chest = runFloor(runOf(save)).entities.find((e) => e.kind === 'chest');
    if (!chest) throw new Error('宝箱がない');
    const a = openRunChest(save, chest.id);
    expect(a.opened).toBe(true);
    expect(a.content).not.toBeNull();
    const b = openRunChest(a.save, chest.id);
    expect(b.opened).toBe(false);
    expect(b.save).toBe(a.save);
  });

  it('勝つと技カードを1枚手に入れ、相手は消える。番人なら一定歩数出ない', () => {
    const save = started(8);
    const run = runOf(save);
    const f = runFloor(run);
    const npc = f.entities.find((e) => e.kind === 'npc');
    const g = f.entities.find((e) => e.kind === 'guardian');
    if (!npc || !g) throw new Error('相手がいない');
    const card = rewardCandidates(runNpcOpponent(0, 1).monsters, skillsOf)[0] as string;
    const before = save.collection[card] ?? 0;
    const w = winRunBattle(save, { kind: 'npc', id: npc.id }, card);
    expect(w.cleared).toBe(false);
    expect(w.save.collection[card]).toBe(before + 1);
    expect(runOf(w.save).gained).toEqual([card]);
    expect(activeEntities(runOf(w.save), f).some((e) => e.id === npc.id)).toBe(false);
    const w2 = winRunBattle(w.save, { kind: 'guardian', id: g.id }, null);
    expect(runOf(w2.save).cooldown).toBe(DUNGEON_RUN.guardianCooldownSteps);
  });

  it('勝ったときの技カードの候補は、相手が使っていたモンスターの技', () => {
    const opp = runGuardianOpponent(0);
    const ids = rewardCandidates(opp.monsters, skillsOf);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(opp.monsters.some((m) => skillsOf(m).some((s) => s.id === id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('負けられる回数に達すると街の入り口へ戻され、その挑戦で手に入れた技カードをすべて失う', () => {
    const save = started(77);
    const run = runOf(save);
    const npc = runFloor(run).entities.find((e) => e.kind === 'npc');
    if (!npc) throw new Error('バトラーがいない');
    const card = rewardCandidates(runNpcOpponent(0, 1).monsters, skillsOf)[0] as string;
    const before = { ...save.collection };
    let s = winRunBattle(save, { kind: 'npc', id: npc.id }, card).save;
    s = winRunBattle(s, { kind: 'npc', id: 'f0-npc-2' }, card).save;
    expect(s.collection[card]).toBe((before[card] ?? 0) + 2);
    for (let i = 1; i < DUNGEON_RUN.maxLosses; i++) {
      const l = loseRunBattle(s, { kind: 'npc', id: 'f0-npc-3' });
      expect(l.expelled).toBe(false);
      expect(l.lossesLeft).toBe(DUNGEON_RUN.maxLosses - i);
      s = l.save;
    }
    const last = loseRunBattle(s, { kind: 'npc', id: 'f0-npc-3' });
    expect(last.expelled).toBe(true);
    expect(last.lostCards).toEqual([card, card]);
    expect(last.save.dungeonRun).toBeNull();
    expect(last.save.collection).toEqual(before);
    expect(last.save.location).toEqual(save.location);
  });

  it('ボスを倒すとクリア：挑戦が終わり、ボスのお金（遺跡は初回 600G・2回目から 180G）と初めてのときのカード（ジオルのモンスターカード）', () => {
    let s = started(5);
    s = { ...s, dungeonRun: descend(descend(descend(runOf(s)))) };
    const boss = runFloor(runOf(s)).entities.find((e) => e.kind === 'boss');
    if (!boss) throw new Error('ボスがいない');
    expect(runBossOpponent().monsters).toEqual(['mon-gauul', GEOL_MONSTER_ID, 'mon-lazuck']);
    // 初めてのクリア：技カードは無し（祭壇でジオルのモンスターカードだけ）
    expect(bossRewardCandidates(s, 'dungeon-01', runBossOpponent().monsters)).toEqual([]);
    const coins = s.coins;
    const w = winRunBattle(s, { kind: 'boss', id: boss.id }, null);
    expect(w.cleared).toBe(true);
    expect(w.firstClear).toBe(true);
    expect(w.save.dungeonRun).toBeNull();
    expect(w.save.coins).toBe(coins + 600);
    expect(w.clearCards).toEqual([{ cardId: GEOL_MONSTER_ID, count: 1 }]);
    expect(w.save.collection[GEOL_MONSTER_ID]).toBe((s.collection[GEOL_MONSTER_ID] ?? 0) + 1);
    expect(w.save.dungeons['dungeon-01']?.bossDefeated).toBe(true);
    // 2回目は初めてのカードなし。技カードはジオルの技から1枚
    expect(bossRewardCandidates(w.save, 'dungeon-01', runBossOpponent().monsters)).toEqual(skillsOf(GEOL_MONSTER_ID).map((k) => k.id));
    const again = winRunBattle({ ...startRun(w.save, 'dungeon-01', 6), dungeonRun: { ...runOf(startRun(w.save, 'dungeon-01', 6)), floor: 3 } }, { kind: 'boss', id: boss.id }, 'skl-geol-03');
    expect(again.firstClear).toBe(false);
    expect(again.coins).toBe(180);
    expect(again.clearCards).toEqual([]);
    expect(again.save.collection['skl-geol-03']).toBe((w.save.collection['skl-geol-03'] ?? 0) + 1);
    expect(DUNGEON_MONEY['dungeon-01']).toMatchObject({ bossFirst: 600, bossRepeat: 180 });
    // 精霊の森・水の神殿・氷の洞窟（2026-10-30 指示書 W）も切り札の報酬（2026-10-29 フルーネ・セレフィーンの最終）：初めてのクリアの前は技カードなし。ほかのダンジョンはいままでどおり（相手の3体の技から）
    expect(bossRewardCandidates(w.save, 'dungeon-02', ['mon-soramo'])).toEqual([]);
    expect(bossRewardCandidates(w.save, 'dungeon-03', ['mon-soramo'])).toEqual([]);
    expect(bossRewardCandidates(w.save, 'dungeon-04', ['mon-soramo'])).toEqual([]);
    expect(bossRewardCandidates(w.save, 'dungeon-05', ['mon-soramo'])).toEqual(skillsOf('mon-soramo').map((k) => k.id));
  });
});

describe('ダンジョンの挑戦のセーブ', () => {
  it('新しいセーブは挑戦なし。保存して読み込むと同じ階・同じ位置から', () => {
    expect(createNewSave().dungeonRun).toBeNull();
    const save = started(4242);
    const run = { ...runOf(save), floor: 1, losses: 2, gained: [], defeated: ['f0-npc-1'] };
    const loaded = normalizeSave(JSON.parse(JSON.stringify({ ...save, dungeonRun: run })));
    expect(loaded?.dungeonRun).toEqual(run);
  });

  it(`version 12 のセーブは version ${SAVE_VERSION} で挑戦なしになる`, () => {
    const { dungeonRun: _drop, ...old } = createNewSave();
    const migrated = migrate({ ...old, version: 12 });
    expect(migrated?.version).toBe(SAVE_VERSION);
    expect(migrated?.dungeonRun).toBeNull();
  });

  it('壊れた挑戦の記録は読み込まない・直す', () => {
    expect(normalizeSave({ ...createNewSave(), dungeonRun: { dungeonId: 3 } })?.dungeonRun).toBeNull();
    const run = runOf(started(10));
    // 壁の上にいる → その階のスタートへ
    expect(sanitizeRun({ ...run, x: 0, y: 0 })).toMatchObject({ x: runFloor(run).start.x, y: runFloor(run).start.y });
    // 階が多すぎる → 最後の階
    expect(sanitizeRun({ ...run, floor: 9 })?.floor).toBe(floorsOf('dungeon-01') - 1);
    // 知らないダンジョン → 挑戦をやめる
    expect(sanitizeRun({ ...run, dungeonId: 'dungeon-99' })).toBeNull();
  });
});

describe('道の確かめ（bfs）', () => {
  it('通れないもの（バトラー・宝箱）は避ける。番人は通れる', () => {
    const f: DungeonFloor = runFloor({ seed: 11, floor: 0 });
    expect(f.entities.filter((e) => !blocksWay(e)).every((e) => e.kind === 'guardian')).toBe(true);
    const all = bfs(f.tiles, f.start, () => false);
    expect(all.get(`${f.start.x},${f.start.y}`)).toBe(0);
  });
});

describe('バトラー・番人の見た目（2026-10-27 デザイン第12弾）', () => {
  it('バトラーは番号で3人のどれか。地図の絵と対戦の顔の絵が同じ人になる', () => {
    expect([0, 1, 2, 3, 4, 5].map(runBattlerLook)).toEqual([1, 2, 3, 1, 2, 3]);
    for (const n of [0, 1, 2, 7]) expect(runNpcOpponent(0, n).face).toBe(`battler-${runBattlerLook(n)}`);
  });

  it('番人は番人の顔。ボスには顔の絵がない（名前の ID は変えない＝英語名はそのまま）', () => {
    expect(runGuardianOpponent(1).face).toBe('guardian');
    expect(runGuardianOpponent(1).id).toBe('enc-run-guardian');
    expect(runNpcOpponent(1, 4).id).toBe('enc-run-npc');
    expect(runBossOpponent().face).toBeUndefined();
  });
});
