import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RANK_BOSS_DUNGEONS } from '../src/data/calendar.ts';
import { DUNGEONS, ENCOUNTERS, ZEPHYRA_BEATEN_FLAG } from '../src/data/dungeons.ts';
import { RUN_DUNGEONS, runBattlerFace, runBossOpponent, runConfig } from '../src/data/dungeonRun.ts';
import { DUNGEON_MONEY } from '../src/data/economy.ts';
import { getPerson, PEOPLE, personOfOpponent } from '../src/data/people.ts';
import { getTournament } from '../src/data/tournaments.ts';
import { TSUMUJI_MONSTER_ID, TSUMUJI_SKILLS } from '../src/data/tsumuji.ts';
import { DUNGEON_SPOTS } from '../src/data/worldMap.ts';
import { missingBosses } from '../src/game/calendar/calendar.ts';
import {
  blocksWay,
  generateFloor,
  hasWindLoop,
  isFloorReachable,
  isWindTile,
  reachable,
  slide,
  WIND_DIRS,
  WIND_PUSH,
  WIND_TILES,
  windLoops,
  type DungeonFloor,
} from '../src/game/dungeon/generate.ts';
import { availableGachaSeriesFor } from '../src/game/economy/gachaSeries.ts';
import { bossRewardCandidates, bossTrumpSkills, descend, move, rollChest, runFloor, startRun, winRunBattle } from '../src/game/dungeon/run.ts';
import { entryCheck } from '../src/game/progress/tournament.ts';
import { createNewSave, normalizeSave, SAVE_VERSION, unlockedDungeonsFor, type DungeonRun, type SaveData } from '../src/game/save/saveData.ts';
import { dungeonName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/**
 * 風の渓谷（2026-10-30 指示書 U「風の渓谷とツムジ」）：D ランクの2つ目のダンジョン・強い風のマス・守り手ゼフィラ・バトラーのニコ。
 * ツムジの技の決まりは tests/tsumuji.test.ts
 */
const ID = 'dungeon-08';
const base = (): SaveData => createNewSave(new Date('2026-10-30T00:00:00Z'), 'balance');
const runOf = (s: SaveData): DungeonRun => {
  if (!s.dungeonRun) throw new Error('挑戦していない');
  return s.dungeonRun;
};

describe('風の渓谷：ダンジョンの値', () => {
  it('D ランクで開く・地下4階・強さは水の神殿と同じ段・水の神殿の次に並ぶ', () => {
    expect(DUNGEONS.find((d) => d.id === ID)).toMatchObject({ name: '風の渓谷', trumpReward: true, bossFlag: ZEPHYRA_BEATEN_FLAG });
    expect(runConfig(ID)).toMatchObject({ floors: 4, gimmick: 'wind', unlockRank: 'D', viewRadius: 1, maxLosses: 3, bossId: 'enc-wind-boss' });
    expect(runConfig(ID).floorLife).toEqual(runConfig('dungeon-03').floorLife);
    expect(runConfig(ID).floorLife).toEqual([0.8, 0.9, 1, 1.1]);
    expect(DUNGEON_MONEY[ID]).toEqual(DUNGEON_MONEY['dungeon-03']);
    const ids = DUNGEONS.map((d) => d.id);
    expect(ids.indexOf(ID)).toBe(ids.indexOf('dungeon-03') + 1);
    expect(Object.keys(RUN_DUNGEONS).indexOf(ID)).toBe(Object.keys(RUN_DUNGEONS).indexOf('dungeon-03') + 1);
    expect(DUNGEON_SPOTS[ID]).toBeDefined();
  });

  it('E ランクでは開かず、D ランクに上がると開く（前のセーブも読み込むと D なら開く）', () => {
    expect(unlockedDungeonsFor('E', [])).not.toContain(ID);
    expect(unlockedDungeonsFor('D', [])).toContain(ID);
    const old = normalizeSave(JSON.parse(JSON.stringify({ ...base(), rank: 'C', unlockedDungeons: ['dungeon-02', 'dungeon-03', 'dungeon-04', 'dungeon-01'] })));
    expect(old?.unlockedDungeons).toContain(ID);
  });

  it('英語の名前（仮訳）・絵（入るときの絵・題字・重ねる絵・ボスの印・ボス戦の背景・床と壁・階段・飾り5つ）・曲', () => {
    setLanguage('en');
    try {
      expect(dungeonName(DUNGEONS.find((d) => d.id === ID) as (typeof DUNGEONS)[number])).toBe('Wind Valley');
    } finally {
      setLanguage('ja');
    }
    const files = [
      'ui/dungeon_intro/wind_art.webp',
      'ui/dungeon_intro/wind_title.webp',
      'ui/dungeon_intro/wind_overlay.webp',
      'maps/dungeon/boss_mark_wind.webp',
      'backgrounds/battle_wind.webp',
      ...['floor', 'wall_top', 'wall_face', 'stairs_down', 'bridge', 'vane', 'mill', 'leaves', 'stake'].map((k) => `maps/dungeon/wind_${k}.webp`),
    ];
    for (const f of files) expect(existsSync(`assets/images/${f}`), f).toBe(true);
    expect(existsSync('assets/audio/bgm/bgm_dungeon_wind.mp3')).toBe(true);
    expect(readFileSync('src/ui/bgm.ts', 'utf8')).toContain('dungeonWind');
  });
});

/** 手で作った小さな階（周りは壁） */
function tinyFloor(rows: string[]): readonly string[] {
  return rows;
}

const none = (): boolean => false;

describe('強い風のマス（風の向きに2マス押し流される）', () => {
  it('乗ると風の向きに2マス押し流される', () => {
    const tiles = tinyFloor(['#######', '#..>..#', '#######']);
    // (1,1) から右へ1歩：(2,1) → 風のマス (3,1) ではない。(2,1) から右へ1歩で風のマスに乗る → 2マス流されて (5,1)
    expect(slide(tiles, { x: 2, y: 1 }, 1, 0, none)).toEqual([
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ]);
    expect(WIND_PUSH).toBe(2);
  });

  it('途中に壁・人や物・階段があれば、その手前で止まる', () => {
    const wall = tinyFloor(['######', '#.>.##', '######']);
    expect(slide(wall, { x: 1, y: 1 }, 1, 0, none)?.at(-1)).toEqual({ x: 3, y: 1 });
    const open = tinyFloor(['#######', '#.>...#', '#######']);
    // 人や物（blocked）が (4,1) にいる → (3,1) で止まる
    expect(slide(open, { x: 1, y: 1 }, 1, 0, (x, y) => x === 4 && y === 1)?.at(-1)).toEqual({ x: 3, y: 1 });
    // 宝箱・人がすぐ先 (3,1) にいる → 風のマスの上で止まる
    expect(slide(open, { x: 1, y: 1 }, 1, 0, (x, y) => x === 3 && y === 1)?.at(-1)).toEqual({ x: 2, y: 1 });
    // 階段が (4,1) → (3,1) で止まる（階段の上には止まらない）
    expect(slide(open, { x: 1, y: 1 }, 1, 0, none, true, { x: 4, y: 1 })?.at(-1)).toEqual({ x: 3, y: 1 });
  });

  it('押し流された先がまた風のマスなら、そのマスの風でもう一度流される', () => {
    const tiles = tinyFloor(['########', '#.>.v..#', '#...#..#', '#...v..#', '#......#', '########']);
    // (2,1)→ 右に2マスで (4,1) の 'v' → 下に2マス：(4,2) は壁なので動けず (4,1) で止まる
    expect(slide(tiles, { x: 1, y: 1 }, 1, 0, none)?.at(-1)).toEqual({ x: 4, y: 1 });
    const chain = tinyFloor(['########', '#.>.v..#', '#......#', '#......#', '#......#', '########']);
    // (2,1) → (4,1) の 'v' → (4,3)
    expect(slide(chain, { x: 1, y: 1 }, 1, 0, none)?.at(-1)).toEqual({ x: 4, y: 3 });
  });

  it('輪になる置き方は見つけられる（作るときはこの置き方をしない）。輪になっても止まる', () => {
    const loop = tinyFloor(['#######', '#>.v..#', '#.....#', '#^.<..#', '#######']);
    expect(windLoops(loop, none)).toBe(true);
    // 輪に入っても、同じ風のマスに2度目に来たところで止まる（固まらない）
    expect(slide(loop, { x: 1, y: 2 }, 0, -1, none)).not.toBeNull();
    expect(windLoops(tinyFloor(['#######', '#>....#', '#######']), none)).toBe(false);
  });
});

/** その階の風のマスの数 */
const windCount = (f: DungeonFloor): number => f.tiles.join('').split('').filter((c) => isWindTile(c)).length;

describe('風の渓谷の階（いくつもの階をつくって確かめる）', () => {
  const floors: DungeonFloor[] = [];
  for (let seed = 1; seed <= 150; seed++) {
    for (let floor = 0; floor < 4; floor++) floors.push(generateFloor(seed * 7919, floor, floor === 3, undefined, 'wind'));
  }

  it('1階に4〜8か所。階段・宝箱・人・スタートの上には置かない', () => {
    for (const f of floors) {
      const n = windCount(f);
      expect(n, `${f.index}`).toBeGreaterThanOrEqual(WIND_TILES.min);
      expect(n).toBeLessThanOrEqual(WIND_TILES.max);
      for (const e of f.entities) expect(isWindTile(f.tiles[e.y]?.[e.x])).toBe(false);
      if (f.stairs) expect(isWindTile(f.tiles[f.stairs.y]?.[f.stairs.x])).toBe(false);
      expect(isWindTile(f.tiles[f.start.y]?.[f.start.x])).toBe(false);
    }
  });

  it('輪にならない（人や物を置いたあとも）', () => {
    for (const f of floors) expect(hasWindLoop(f)).toBe(false);
  });

  it('押し流されても、スタートから階段（最後の階はボスのとなり）とバトラー・宝箱へ必ず行ける', () => {
    for (const f of floors) {
      expect(isFloorReachable(f)).toBe(true);
      const blockers = new Set(f.entities.filter(blocksWay).map((e) => `${e.x},${e.y}`));
      const dist = reachable(f.tiles, f.start, (x, y) => blockers.has(`${x},${y}`), true, f.stairs);
      if (f.stairs) expect(dist.has(`${f.stairs.x},${f.stairs.y}`)).toBe(true);
      const boss = f.entities.find((e) => e.kind === 'boss');
      if (boss) expect(Object.values(WIND_DIRS).some((d) => dist.has(`${boss.x + d.x},${boss.y + d.y}`))).toBe(true);
    }
  });

  it('ほかのダンジョンの階は変わらない（風のマスは風の渓谷だけ）', () => {
    for (const g of ['none', 'water', 'ice', 'lava', 'switch', 'holy'] as const) {
      const f = generateFloor(1234, 1, false, undefined, g);
      expect(windCount(f)).toBe(0);
    }
  });

  it('じっさいに歩く（move）と、風のマスで押し流される（gust）', () => {
    let found = false;
    for (let seed = 1; seed <= 40 && !found; seed++) {
      const s = startRun(base(), ID, seed);
      const run = runOf(s);
      const f = runFloor(run);
      const blockers = new Set(f.entities.filter(blocksWay).map((e) => `${e.x},${e.y}`));
      // スタートから行ける所で、となりに風のマスがあるマスを探す
      const dist = reachable(f.tiles, f.start, (x, y) => blockers.has(`${x},${y}`), true, f.stairs);
      for (const key of dist.keys()) {
        const [x, y] = key.split(',').map(Number) as [number, number];
        for (const [dir, d] of [['right', { x: 1, y: 0 }], ['left', { x: -1, y: 0 }], ['down', { x: 0, y: 1 }], ['up', { x: 0, y: -1 }]] as const) {
          const ch = f.tiles[y + d.y]?.[x + d.x];
          if (!isWindTile(ch) || blockers.has(`${x + d.x},${y + d.y}`)) continue;
          const wind = WIND_DIRS[ch as string] as { x: number; y: number };
          const r = move({ ...run, x, y }, dir);
          expect(r.moved).toBe(true);
          if (r.path.length > 1) {
            expect(r.gust).toBeTruthy();
            const end = r.path.at(-1) as { x: number; y: number };
            expect(Math.abs(end.x - (x + d.x)) + Math.abs(end.y - (y + d.y))).toBeGreaterThan(0);
            expect(r.path[1]).toEqual({ x: x + d.x + wind.x, y: y + d.y + wind.y });
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
    expect(found).toBe(true);
  });
});

describe('人：守り手ゼフィラ・バトラーのニコ', () => {
  it('ゼフィラの編成：真ん中がツムジ、左右はソラモ・ガウル。lifeScale 1.0（1.2 から試遊して、勝つ割合がルシアと同じくらいになる値）→ 2026-10-30 指示書 V で切り札（ツムジ）の技を2枚ずつにして 1.1', () => {
    expect(ENCOUNTERS['enc-wind-boss']).toEqual({ id: 'enc-wind-boss', name: 'ゼフィラ', monsters: ['mon-soramo', TSUMUJI_MONSTER_ID, 'mon-gauul'], ace: TSUMUJI_MONSTER_ID, lifeScale: 1.1 });
    expect(runBossOpponent(ID).monsters[1]).toBe(TSUMUJI_MONSTER_ID);
    expect(ENCOUNTERS['enc-water-boss']?.lifeScale).toBe(1.2);
  });

  it('名刺図鑑：ゼフィラ 41・ニコ 42（今の最後の番号の続き）。肩書き・勝ったあとのせりふに1つだけ口をすべらせる一言', () => {
    const z = getPerson('zephyra');
    const n = getPerson('niko');
    expect(z).toMatchObject({ no: 41, group: 'dungeon', name: { ja: 'ゼフィラ', en: 'Zephyra' }, title: { ja: '渓谷の守り手・一族でいちばん若い' } });
    expect(n).toMatchObject({ no: 42, group: 'dungeon', name: { ja: 'ニコ', en: 'Niko' }, title: { ja: 'つり橋の番', en: 'Bridge Keeper' } });
    expect(Math.max(...PEOPLE.filter((p) => p.id !== 'zephyra' && p.id !== 'niko').map((p) => p.no))).toBe(40);
    expect(personOfOpponent(ENCOUNTERS['enc-wind-boss'] as never)?.id).toBe('zephyra');
    const lines = Object.values(z?.lines ?? {}).map((l) => (l as { ja: string }).ja);
    expect(lines.filter((l) => l.includes('ほかの聖地')).length).toBe(1);
    expect(z?.lines?.after?.ja).toContain('今のなし');
  });

  it('ニコは風の渓谷のバトラー（その人＋今の3人のうち1人）。地図の上の小さな姿がある', () => {
    expect(runBattlerFace(1, ID)).toBe('battler-niko');
    expect(runBattlerFace(2, ID)).toMatch(/^battler-[123]$/);
    expect(runBattlerFace(3, ID)).toMatch(/^battler-[123]$/);
    expect(runBattlerFace(2, ID)).not.toBe(runBattlerFace(3, ID));
    expect(readFileSync('src/ui/components/dungeonPeopleArt.ts', 'utf8')).toContain("'battler-niko': standNiko");
    for (const f of ['face_guardian_wind_zephyra', 'stand_guardian_wind_zephyra', 'face_battler_wind', 'stand_battler_wind']) {
      expect(existsSync(`assets/images/characters/${f}.webp`), f).toBe(true);
    }
  });
});

/** 風の渓谷の最後の階のボス（ゼフィラ）に勝つ */
function beatZephyra(save: SaveData, seed: number): ReturnType<typeof winRunBattle> {
  let s = startRun(save, ID, seed);
  while (runFloor(runOf(s)).entities.every((e) => e.kind !== 'boss')) s = { ...s, dungeonRun: descend(runOf(s)) };
  const boss = runFloor(runOf(s)).entities.find((e) => e.kind === 'boss');
  if (!boss) throw new Error('boss');
  return winRunBattle(s, { kind: 'boss', id: boss.id }, null);
}

const ZEPHYRA_TEAM = ['mon-soramo', TSUMUJI_MONSTER_ID, 'mon-gauul'];

describe('入手の流れ', () => {
  it('初回クリア：祭壇でツムジのモンスターカード1枚。2回目から：ツムジの技カード1枚。宝箱の技カードもツムジの技', () => {
    const b = base();
    expect(bossRewardCandidates(b, ID, ZEPHYRA_TEAM)).toEqual([]);
    const w = beatZephyra(b, 31);
    expect(w).toMatchObject({ cleared: true, firstClear: true });
    expect(w.clearCards).toEqual([{ cardId: TSUMUJI_MONSTER_ID, count: 1 }]);
    expect(w.save.collection[TSUMUJI_MONSTER_ID]).toBe(1);
    expect(bossRewardCandidates(w.save, ID, ZEPHYRA_TEAM)).toEqual(TSUMUJI_SKILLS.map((k) => k.id));
    const again = beatZephyra(w.save, 32);
    expect(again.firstClear).toBe(false);
    expect(again.clearCards).toEqual([]);
    expect(bossTrumpSkills(ID)).toEqual(TSUMUJI_SKILLS.map((k) => k.id));
    const chestCards = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const r = rollChest(ID, i, 'f1-chest-1');
      if (r.kind === 'card') chestCards.add(r.card);
    }
    expect(chestCards.size).toBeGreaterThan(0);
    for (const c of chestCards) expect(c.startsWith('skl-tsumuji-')).toBe(true);
  });

  it('ゼフィラに初めて勝つと zephyra-beaten（1つだけ）', () => {
    expect(ZEPHYRA_BEATEN_FLAG).toBe('zephyra-beaten');
    const w = beatZephyra(base(), 41);
    expect(w.save.storyFlags.filter((f) => !f.startsWith('gacha-seen-'))).toEqual([ZEPHYRA_BEATEN_FLAG]);
    expect(beatZephyra(w.save, 42).save.storyFlags.filter((f) => f === ZEPHYRA_BEATEN_FLAG)).toHaveLength(1);
  });

  it('ツムジのガチャのシリーズは、ゼフィラに勝つ（ツムジのカードを受け取る）前は並ばず、勝ったあとに並ぶ', () => {
    const b = base();
    expect(availableGachaSeriesFor(b).map((s) => s.id)).not.toContain('tsumuji');
    const w = beatZephyra(b, 51);
    expect(availableGachaSeriesFor(w.save).map((s) => s.id)).toContain('tsumuji');
  });
});

describe('D の大会の出場条件・セーブ', () => {
  it('D の条件に風の渓谷を足した（水の神殿・風の渓谷）。受付の理由に出る', () => {
    expect(RANK_BOSS_DUNGEONS.D).toEqual(['dungeon-03', ID]);
    const water = { 'dungeon-03': { openedChests: [], bossDefeated: true, clears: 1 } };
    const s = { ...base(), rank: 'D' as const, calendar: { year: 1, month: 9 }, dungeons: water };
    expect(missingBosses(s, 'D')).toEqual([ID]);
    const d = getTournament('tournament-d');
    if (!d) throw new Error('tournament-d');
    expect(entryCheck(s, d).reasons).toEqual(['風の渓谷のボスをまだ倒していません']);
  });

  it('すでに D より上のセーブ：風の渓谷のボスを倒していなくても、今のランクの大会の条件には関係しない', () => {
    for (const rank of ['C', 'B', 'A', 'S'] as const) expect(RANK_BOSS_DUNGEONS[rank]).not.toContain(ID);
    const old = normalizeSave(
      JSON.parse(
        JSON.stringify({
          ...base(),
          rank: 'C',
          calendar: { year: 1, month: 9 },
          dungeons: {
            'dungeon-02': { openedChests: [], bossDefeated: true, clears: 1 },
            'dungeon-03': { openedChests: [], bossDefeated: true, clears: 1 },
            'dungeon-04': { openedChests: [], bossDefeated: true, clears: 1 },
            'dungeon-01': { openedChests: [], bossDefeated: true, clears: 1 },
          },
        }),
      ),
    );
    if (!old) throw new Error('load');
    const c = getTournament('tournament-c');
    if (!c) throw new Error('tournament-c');
    expect(missingBosses(old, 'C')).toEqual([]);
    expect(entryCheck(old, c).reasons.some((r) => r.includes('風の渓谷'))).toBe(false);
  });

  it('セーブの version は上げていない（ダンジョン・人・モンスターを足しただけ）', () => {
    expect(SAVE_VERSION).toBe(29);
  });
});
