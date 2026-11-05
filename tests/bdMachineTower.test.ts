import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { skillsOf } from '../src/data/cards.ts';
import { DUNGEON_RUN, runConfig, towerClimbs } from '../src/data/dungeonRun.ts';
import { getStoryEvent } from '../src/data/storyEvents.ts';
import {
  countDoors,
  DOOR_TILES,
  generateFloor,
  isDoorTile,
  isWalkableTile,
  SWITCH_DOORS,
  SWITCH_EARLY_FLOORS,
  switchPuzzle,
  type DungeonFloor,
} from '../src/game/dungeon/generate.ts';
import { bossTrumpSkills, descend, openDoorColor, pressSwitch, rollChest, runFloor, sanitizeRun, startRun } from '../src/game/dungeon/run.ts';
import { createNewSave, migrate, normalizeSave, SAVE_VERSION, type DungeonRun, type SaveData } from '../src/game/save/saveData.ts';
import { markStoryEventSeen, pendingStoryEvent, reviewableStoryEvents } from '../src/game/story/storyEvents.ts';
import { setLanguage, t } from '../src/i18n/i18n.ts';

/**
 * 指示書 BD（2026-11-05）：機械の塔を A ランクらしく。
 * 【1】赤と青の切り替えの扉（閉じこめられない・全部のバトラー・宝箱へ行ける・同じシードで同じ階・セーブの再開）
 * 【2】敵を B の子に 【3】宝箱はギアロスの技 【4】上へのぼる塔 【5】初めて入ったときの場面
 * 試遊の表（150シード×5階）は PLAYTEST_OUT に JSON（docs/design/bd-machine-tower-20261105/doors_150.json）
 */
const ID = 'dungeon-06';
const SEEDS = 150;
const fresh = (): SaveData => createNewSave(new Date('2026-10-27T00:00:00Z'), 'balance');
const runOf = (s: SaveData): DungeonRun => {
  if (!s.dungeonRun) throw new Error('挑戦がありません');
  return s.dungeonRun;
};
const floorOf = (seed: number, floor: number): DungeonFloor => generateFloor(seed, floor, floor === runConfig(ID).floors - 1, DUNGEON_RUN, 'switch');

describe('指示書 BD【1】赤と青の切り替えの扉', () => {
  it(`試遊（${SEEDS}シード×5階）：どの状態からでもゴールへ行ける・全部のバトラー・宝箱へ行ける・階ごとの決まり`, () => {
    const rows: { floor: number; toggles: number[]; steps: number[]; doors: number[]; switches: number[] }[] = [];
    for (let floor = 0; floor < 5; floor++) {
      const row = { floor: floor + 1, toggles: [] as number[], steps: [] as number[], doors: [] as number[], switches: [] as number[] };
      for (let seed = 1; seed <= SEEDS; seed++) {
        const f = floorOf(seed * 7919, floor);
        const p = switchPuzzle(f);
        const where = `seed ${seed} floor ${floor + 1}`;
        expect(p.solvable, where).toBe(true);
        expect(p.trapped, where).toBe(0);
        expect(p.entitiesReachable, where).toBe(true);
        const switches = f.entities.filter((e) => e.kind === 'switch');
        const doors = countDoors(f.tiles);
        if (floor < SWITCH_EARLY_FLOORS) {
          expect(switches, where).toHaveLength(1);
          expect(p.minToggles, where).toBe(1);
        } else {
          expect(switches.length, where).toBeGreaterThanOrEqual(2);
          expect(switches.length, where).toBeLessThanOrEqual(3);
          expect(doors, where).toBeGreaterThanOrEqual(SWITCH_DOORS.min);
          expect(doors, where).toBeLessThanOrEqual(SWITCH_DOORS.max);
          expect(p.minToggles, where).toBeGreaterThanOrEqual(2);
        }
        // 扉のマスにだれもいない・スタートと階段は扉でない・スイッチは扉のとなりに無い
        for (const e of f.entities) expect(isDoorTile(f.tiles[e.y]?.[e.x]), where).toBe(false);
        expect(isDoorTile(f.tiles[f.start.y]?.[f.start.x])).toBe(false);
        if (f.stairs) expect(isDoorTile(f.tiles[f.stairs.y]?.[f.stairs.x])).toBe(false);
        for (const s of switches) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) expect(isDoorTile(f.tiles[s.y + dy]?.[s.x + dx]), where).toBe(false);
        }
        // 赤の扉・青の扉のどちらもある（1・2階は赤が飾りで1つ・青がゴールの前）
        expect(f.tiles.join('')).toMatch(/B/);
        row.toggles.push(p.minToggles);
        row.steps.push(p.minSteps);
        row.doors.push(doors);
        row.switches.push(switches.length);
      }
      rows.push(row);
    }
    const stat = (xs: number[]) => ({ min: Math.min(...xs), avg: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10, max: Math.max(...xs) });
    const table = rows.map((r) => ({ floor: r.floor, toggles: stat(r.toggles), steps: stat(r.steps), doors: stat(r.doors), switches: stat(r.switches) }));
    if (process.env.PLAYTEST_OUT) {
      mkdirSync(dirname(process.env.PLAYTEST_OUT), { recursive: true });
      writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify({ seeds: SEEDS, table }, null, 2));
    }
  }, 300_000);

  it('同じシードなら同じ階（中断して再開しても同じ）', () => {
    for (const seed of [3, 77, 2026]) {
      for (let floor = 0; floor < 5; floor++) expect(floorOf(seed, floor)).toEqual(floorOf(seed, floor));
    }
  });

  it('開いている色の扉だけ通れる（赤＝R・青＝B）', () => {
    expect(DOOR_TILES).toEqual({ R: 'red', B: 'blue' });
    expect(isWalkableTile('R', 'red')).toBe(true);
    expect(isWalkableTile('R', 'blue')).toBe(false);
    expect(isWalkableTile('B', 'blue')).toBe(true);
    expect(isWalkableTile('B', 'red')).toBe(false);
    expect(isWalkableTile('B', 'all')).toBe(true);
    expect(isWalkableTile('R', 'none')).toBe(false);
  });

  it('スイッチを押すと色が入れかわる。セーブして読み込んでも同じ色・同じ場所（再開）', () => {
    let s = startRun(fresh(), ID, 4242);
    const pressed = pressSwitch(runOf(s));
    s = { ...s, dungeonRun: pressed.run };
    expect(openDoorColor(runOf(s))).toBe('blue');
    const loaded = normalizeSave(JSON.parse(JSON.stringify(s)));
    expect(loaded?.dungeonRun?.blueDoorFloor).toBe(0);
    const resumed = sanitizeRun(runOf(loaded as SaveData));
    expect(resumed && openDoorColor(resumed)).toBe('blue');
    expect(resumed?.x).toBe(runOf(s).x);
    expect(resumed?.y).toBe(runOf(s).y);
    // 上の階へ進むと赤に戻る
    expect(openDoorColor(descend(pressed.run))).toBe('red');
  });

  it(`セーブの version ${SAVE_VERSION}：前のセーブ（switchFloor）の機械の塔の挑戦は、いまの階のスタートからやり直す`, () => {
    const s = startRun(fresh(), ID, 99);
    const run = runOf(s);
    const { blueDoorFloor: _b, ...old } = run;
    const raw = JSON.parse(JSON.stringify({ ...s, version: 35, dungeonRun: { ...old, floor: 1, switchFloor: 1, x: 5, y: 5, explored: '1'.repeat(10) } }));
    const m = migrate(raw);
    expect((m?.dungeonRun as Record<string, unknown>).switchFloor).toBeUndefined();
    const loaded = normalizeSave(raw) as SaveData;
    expect(loaded.dungeonRun?.blueDoorFloor).toBe(null);
    const fixed = sanitizeRun(runOf(loaded));
    const f = runFloor({ seed: run.seed, floor: 1, dungeonId: ID });
    expect(fixed?.floor).toBe(1);
    expect({ x: fixed?.x, y: fixed?.y }).toEqual(f.start);
    expect(fixed && openDoorColor(fixed)).toBe('red');
    // ほかのダンジョンの挑戦はそのまま（switchFloor だけ消える）
    const other = startRun(fresh(), 'dungeon-01', 5);
    const o = runOf(other);
    const { blueDoorFloor: _ob, ...oldOther } = o;
    const raw2 = JSON.parse(JSON.stringify({ ...other, version: 35, dungeonRun: { ...oldOther, switchFloor: null } }));
    expect(normalizeSave(raw2)?.dungeonRun?.x).toBe(o.x);
  });
});

describe('指示書 BD【2】〜【5】', () => {
  it('【2】バトラー・見えない番人は B の子（ギアロスは入れない）', () => {
    const B = ['mon-geol', 'mon-hyouzuku', 'mon-shishien', 'mon-hakuran', 'mon-flune'];
    const c = runConfig(ID);
    for (const team of [...c.npcTeams, c.guardianTeam]) for (const m of team) expect(B).toContain(m);
    expect(c.npcTeams).toEqual([
      ['mon-geol', 'mon-hyouzuku', 'mon-shishien'],
      ['mon-hakuran', 'mon-flune', 'mon-geol'],
    ]);
    expect(c.guardianTeam).toEqual(['mon-hyouzuku', 'mon-shishien', 'mon-hakuran']);
    expect(c.floorLife).toEqual([0.9, 0.95, 1.05, 1.1, 1.2]);
  });

  it('【3】宝箱の技カードはギアロスの技（雷の高原と同じ形：守り手の切り札の技）', () => {
    const gearos = skillsOf('mon-gearos').map((k) => k.id);
    expect(bossTrumpSkills(ID)).toEqual(gearos);
    expect(bossTrumpSkills('dungeon-09')).toEqual(skillsOf('mon-hakuran').map((k) => k.id));
    const cards = Array.from({ length: 200 }, (_, i) => rollChest(ID, 7, `f1-chest-${i}`)).filter((r) => r.kind === 'card');
    expect(cards.length).toBeGreaterThan(0);
    for (const r of cards) if (r.kind === 'card') expect(gearos).toContain(r.card);
  });

  it('【4】塔なので「○階」と上へ（ほかのダンジョンは「地下○階」のまま）。階段は「上る」', () => {
    expect(towerClimbs(ID)).toBe(true);
    expect(towerClimbs('dungeon-01')).toBe(false);
    expect(t('dungeonRun.floorNameUp', { n: 3 })).toBe('3階');
    expect(t('dungeonRun.stairsUpTitle')).toBe('階段を上りますか？');
    setLanguage('en');
    try {
      expect(t('dungeonRun.floorNameUp', { n: 3 })).toBe('3F');
    } finally {
      setLanguage('ja');
    }
  });

  it('【5】初めて入ったときの場面（1回だけ・研究所の「記録をふり返る」で見直せる）', () => {
    const ev = getStoryEvent('D06');
    expect(ev?.steps.map((s) => (s.kind === 'line' ? s.line.text.ja : ''))).toEqual([
      '歯車の音が、塔のてっぺんまで響いている。',
      '赤と青の扉は、スイッチを踏むたびに開く色が入れかわります。',
      'どの扉を開けておくか考えて、上の階を目指しましょう。',
    ]);
    const s = fresh();
    expect(pendingStoryEvent(s, 'dungeonEnter', { dungeon: ID })?.id).toBe('D06');
    expect(pendingStoryEvent(s, 'dungeonEnter', { dungeon: 'dungeon-01' })?.id).not.toBe('D06');
    const seen = markStoryEventSeen(s, 'D06');
    expect(pendingStoryEvent(seen, 'dungeonEnter', { dungeon: ID })).toBeNull();
    expect(reviewableStoryEvents(seen).map((e) => e.id)).toEqual(['D06']);
    expect(reviewableStoryEvents(s)).toEqual([]);
  });
});
