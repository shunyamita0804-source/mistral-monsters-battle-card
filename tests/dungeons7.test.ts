import { describe, expect, it } from 'vitest';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { DUNGEON_RUN, RUN_DUNGEONS, runBossOpponent, runConfig, runGuardianOpponent } from '../src/data/dungeonRun.ts';
import { getTournament } from '../src/data/tournaments.ts';
import { personOfOpponent } from '../src/data/people.ts';
import { isFloorReachable, isSwitchReachable, slide, type DungeonFloor } from '../src/game/dungeon/generate.ts';
import {
  descend,
  doorsOpen,
  floorsOf,
  loseRunBattle,
  move,
  pressSwitch,
  runFloor,
  startRun,
  viewRadiusOf,
} from '../src/game/dungeon/run.ts';
import { claimTournamentRewards, enterTournament, recordMatch } from '../src/game/progress/tournament.ts';
import { createNewSave, normalizeSave, SAVE_VERSION, unlockedDungeonsFor, type Direction, type DungeonRun, type SaveData } from '../src/game/save/saveData.ts';
import { cupReady } from './support/cupReady.ts';

const fresh = (): SaveData => createNewSave(new Date('2026-10-27T00:00:00Z'), 'balance');
const runOf = (s: SaveData): DungeonRun => {
  if (!s.dungeonRun) throw new Error('no run');
  return s.dungeonRun;
};
const DIRS: readonly Direction[] = ['up', 'down', 'left', 'right'];

describe('ダンジョンの一覧（2026-10-27 指示書「ダンジョン7つ」。値は仮）', () => {
  it('7つ（2026-10-30 に風の渓谷を足して8つ。水の神殿の次）：階・仕掛け・開放のランク', () => {
    expect(DUNGEONS.map((d) => d.id)).toEqual(['dungeon-01', 'dungeon-02', 'dungeon-03', 'dungeon-08', 'dungeon-04', 'dungeon-05', 'dungeon-06', 'dungeon-07']);
    expect(DUNGEONS.map((d) => [d.name, runConfig(d.id).floors, runConfig(d.id).gimmick, runConfig(d.id).unlockRank])).toEqual([
      // 2026-10-29 ジオルの最終：遺跡は C ランクで開く地下4階（氷の洞窟と同じ段）
      ['太古の遺跡', 4, 'none', 'C'],
      ['精霊の森', 3, 'none', null],
      ['水の神殿', 4, 'water', 'D'],
      ['風の渓谷', 4, 'wind', 'D'],
      ['氷の洞窟', 4, 'ice', 'C'],
      ['炎の火山', 5, 'lava', 'B'],
      ['機械の塔', 5, 'switch', 'A'],
      ['天の聖域', 5, 'holy', 'S'],
    ]);
    // ふつうのダンジョンは最大5階。階ごとの強さの数＝階の数
    for (const [id, c] of Object.entries(RUN_DUNGEONS)) {
      expect(c.floors, id).toBeLessThanOrEqual(5);
      expect(c.floorLife, id).toHaveLength(c.floors);
    }
  });

  it('強さは 森 ＜ 水 ＜ 氷・遺跡 ＜ 火 ＜ 機械 ＜ 聖域（最後の階・ボス）', () => {
    // 太古の遺跡は 2026-10-29 から氷の洞窟と同じ段（階ごとの強さが同じ）
    expect(runConfig('dungeon-01').floorLife).toEqual(runConfig('dungeon-04').floorLife);
    expect(runBossOpponent('dungeon-01').lifeScale).toBe(1.2);
    const ids = ['dungeon-02', 'dungeon-03', 'dungeon-04', 'dungeon-05', 'dungeon-06', 'dungeon-07'];
    const last = ids.map((id) => runConfig(id).floorLife.at(-1) ?? 0);
    const boss = ids.map((id) => runBossOpponent(id).lifeScale);
    for (let i = 1; i < ids.length; i++) {
      expect(last[i]).toBeGreaterThan(last[i - 1] as number);
      expect(boss[i]).toBeGreaterThan(boss[i - 1] as number);
    }
  });

  it('ボス：初回クリアはボスのモンスターカード（真ん中のモンスター）＋そのモンスターの技カード', () => {
    for (const d of DUNGEONS.slice(2)) {
      const boss = runBossOpponent(d.id);
      // 2026-10-28：ボスはそのダンジョンの守り手（名前は src/data/people.ts）
      expect(personOfOpponent(boss)?.title.ja, d.id).toMatch(/の守り手/);
      const monster = boss.monsters[1] as string;
      expect(d.firstClearCards?.[0]).toEqual({ cardId: monster, count: 1 });
      expect(d.firstClearCards?.slice(1).every((c) => c.cardId.includes(monster.replace('mon-', '')))).toBe(true);
      expect(ENCOUNTERS[boss.id]).toBe(boss);
    }
  });
});

describe('開放', () => {
  it('新しく始めたときは精霊の森だけ（2026-10-29 から。太古の遺跡は C ランクで氷の洞窟と同時に開く）', () => {
    expect(fresh().unlockedDungeons).toEqual(['dungeon-02']);
    expect(unlockedDungeonsFor('D', [])).toEqual(['dungeon-02', 'dungeon-03', 'dungeon-08']);
    expect(unlockedDungeonsFor('C', [])).toEqual(['dungeon-01', 'dungeon-02', 'dungeon-03', 'dungeon-08', 'dungeon-04']);
  });

  it('すでに遺跡が開いている・クリアしたセーブは、そのまま（閉じない）', () => {
    const old = { ...fresh(), version: 22, rank: 'E', unlockedDungeons: ['dungeon-01', 'dungeon-02'], dungeons: { 'dungeon-01': { openedChests: [], bossDefeated: true, clears: 1 } } };
    const s = normalizeSave(JSON.parse(JSON.stringify(old)));
    expect(s?.unlockedDungeons).toEqual(['dungeon-01', 'dungeon-02']);
    expect(s?.dungeons['dungeon-01']?.bossDefeated).toBe(true);
  });

  it('前のセーブ（version 18）：ランクに合わせて開放する。森の固定のマップを探索中なら家に戻す', () => {
    const { unlockedDungeons: _u, ...rest } = fresh();
    const old = { ...rest, version: 18, rank: 'A', activeDungeon: { dungeonId: 'dungeon-02', floor: 1, defeatedEnemies: [] }, location: { mapId: 'dungeon-02-b2', x: 5, y: 5, dir: 'up' } };
    const s = normalizeSave(old);
    expect(s?.version).toBe(SAVE_VERSION);
    expect(s?.unlockedDungeons).toEqual(['dungeon-01', 'dungeon-02', 'dungeon-03', 'dungeon-08', 'dungeon-04', 'dungeon-05', 'dungeon-06']);
    expect(s?.activeDungeon).toBeNull();
    expect(s?.location.mapId).toBe('home');
  });

  it('大会でランクが上がったときに開放し、報酬の画面で知らせる（D 優勝で C → 氷の洞窟）', () => {
    const d = getTournament('tournament-d');
    if (!d) throw new Error('d');
    let s: SaveData = { ...fresh(), rank: 'D', unlockedDungeons: ['dungeon-01', 'dungeon-02', 'dungeon-03', 'dungeon-08'] };
    s = enterTournament(cupReady(s), 'tournament-d', 'd-1', 1);
    for (let r = 0; r < 3; r++) s = recordMatch(s, r, true);
    const claim = claimTournamentRewards(s);
    if (claim.status !== 'ok') throw new Error('claim');
    expect(claim.save.rank).toBe('C');
    expect(claim.summary.unlockedDungeons).toEqual(['dungeon-04']);
    expect(claim.save.unlockedDungeons).toContain('dungeon-04');
  });
});

/** 多くのシードで、すべての階を作って確かめる */
function eachFloor(dungeonId: string, seeds: number, check: (f: DungeonFloor, floor: number) => void): void {
  for (let seed = 1; seed <= seeds; seed++) {
    for (let floor = 0; floor < floorsOf(dungeonId); floor++) check(runFloor({ seed: seed * 7919, floor, dungeonId }), floor);
  }
}

describe('仕掛け：必ず階段・ボスまで行ける（多くのシード）', () => {
  it('水の神殿：水路があっても、階段（最後の階はボスの隣）・バトラー・宝箱まで行ける', () => {
    let water = 0;
    eachFloor('dungeon-03', 150, (f, floor) => {
      expect(isFloorReachable(f), `floor ${floor}`).toBe(true);
      water += f.tiles.join('').split('w').length - 1;
      expect(!!f.stairs || f.entities.some((e) => e.kind === 'boss')).toBe(true);
    });
    expect(water).toBeGreaterThan(0);
  });

  it('氷の洞窟：すべって止まる所だけで、階段・ボス・バトラー・宝箱まで行ける', () => {
    let ice = 0;
    eachFloor('dungeon-04', 150, (f) => {
      expect(isFloorReachable(f)).toBe(true);
      ice += f.tiles.join('').split('i').length - 1;
    });
    expect(ice).toBeGreaterThan(0);
  });

  it('機械の塔：階段・ボスの部屋は閉じた扉の向こう。スイッチは扉の手前から行ける。開ければ全部行ける', () => {
    let doors = 0;
    eachFloor('dungeon-06', 150, (f) => {
      expect(isFloorReachable(f)).toBe(true);
      expect(isSwitchReachable(f)).toBe(true);
      const n = f.tiles.join('').split('D').length - 1;
      doors += n;
      if (n > 0) expect(f.entities.filter((e) => e.kind === 'switch')).toHaveLength(1);
    });
    expect(doors).toBeGreaterThan(0);
  });

  it('仕掛けのないダンジョンは今までと同じ階（遺跡の階は変わらない）', () => {
    const f = runFloor({ seed: 42, floor: 1, dungeonId: 'dungeon-01' });
    expect(f.tiles.join('')).not.toMatch(/[wiD]/);
    expect(f.entities.some((e) => e.kind === 'switch')).toBe(false);
  });
});

describe('すべる床', () => {
  const tiles = ['#######', '#.iii.#', '#.#i#.#', '#######'];
  const none = (): boolean => false;

  it('氷に乗ると、氷でないマスに乗るまで進み続ける', () => {
    expect(slide(tiles, { x: 1, y: 1 }, 1, 0, none)?.at(-1)).toEqual({ x: 5, y: 1 });
  });

  it('壁・人や物にぶつかると、氷の上で止まる', () => {
    // 下へ：(3,1) → (3,2) は氷、その下は壁 → (3,2) で止まる
    expect(slide(tiles, { x: 3, y: 0 + 1 }, 0, 1, none)?.at(-1)).toEqual({ x: 3, y: 2 });
    // 右へすべる途中に物がある → 手前の氷で止まる
    expect(slide(tiles, { x: 1, y: 1 }, 1, 0, (x, y) => x === 4 && y === 1)?.at(-1)).toEqual({ x: 3, y: 1 });
    // 目の前が壁なら進めない
    expect(slide(tiles, { x: 1, y: 1 }, 0, -1, none)).toBeNull();
  });

  it('氷の上では見えない番人の抽選をしない（すべり始め・途中・止まった所）', () => {
    let iceMoves = 0;
    for (let seed = 1; seed <= 30; seed++) {
      let s = startRun(fresh(), 'dungeon-04', seed * 104729);
      let run = runOf(s);
      let r0 = seed;
      for (let i = 0; i < 2000; i++) {
        const f = runFloor(run);
        const from = f.tiles[run.y]?.[run.x];
        r0 = (Math.imul(r0, 1103515245) + 12345) | 0;
        const r = move({ ...run, cooldown: 0, incenseSteps: 0 }, DIRS[(r0 >>> 16) % 4] as Direction);
        const icy = from === 'i' || r.path.some((p) => f.tiles[p.y]?.[p.x] === 'i');
        if (icy) iceMoves++;
        if (icy) expect(r.guardian).toBeNull();
        run = r.run;
      }
      s = { ...s, dungeonRun: run };
    }
    expect(iceMoves).toBeGreaterThan(0);
  });
});

describe('炎の火山・天の聖域・機械の塔', () => {
  it('炎の火山：見える範囲が2マス（たいまつで3マス）。見えない番人は1.5倍出やすい', () => {
    const run = runOf(startRun(fresh(), 'dungeon-05', 3));
    expect(viewRadiusOf(run)).toBe(2);
    expect(viewRadiusOf({ ...run, torchFloor: run.floor })).toBe(3);
    expect(viewRadiusOf({ ...runOf(startRun(fresh(), 'dungeon-01', 3)), torchFloor: 0 })).toBe(2);
    expect(runConfig('dungeon-05').guardianRate).toBeCloseTo(DUNGEON_RUN.guardianRate * 1.5);
  });

  it('天の聖域：2回負けると街の入り口へ戻される（ほかは3回）。番人はほかより強い', () => {
    let s = startRun(fresh(), 'dungeon-07', 9);
    const first = loseRunBattle(s, { kind: 'npc', id: 'f0-npc-1' });
    expect(first).toMatchObject({ expelled: false, lossesLeft: 1 });
    s = first.save;
    expect(loseRunBattle(s, { kind: 'npc', id: 'f0-npc-2' }).expelled).toBe(true);
    let r = startRun(fresh(), 'dungeon-06', 9);
    r = loseRunBattle(r, { kind: 'npc', id: 'a' }).save;
    expect(loseRunBattle(r, { kind: 'npc', id: 'b' }).expelled).toBe(false);
    for (const id of ['dungeon-03', 'dungeon-04', 'dungeon-05', 'dungeon-06']) {
      expect(runGuardianOpponent(4, 'dungeon-07').lifeScale).toBeGreaterThan(runGuardianOpponent(4, id).lifeScale);
    }
  });

  it('機械の塔：スイッチで扉が開き、その階にいる間は開いたまま。下りると次の階の扉は閉じている', () => {
    const run = runOf(startRun(fresh(), 'dungeon-06', 11));
    expect(doorsOpen(run)).toBe(false);
    const pressed = pressSwitch(run);
    expect(pressed.opened).toBe(true);
    expect(doorsOpen(pressed.run)).toBe(true);
    expect(pressSwitch(pressed.run).opened).toBe(false);
    expect(doorsOpen(descend(pressed.run))).toBe(false);
  });
});
