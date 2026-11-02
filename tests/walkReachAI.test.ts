import { describe, expect, it } from 'vitest';
import { HALL, MAPS, PRACTICE, TOWN, type MapDefinition, type MapObject, type NpcObject } from '../src/data/maps.ts';
import { createNewSave } from '../src/game/save/saveData.ts';
import { isNpcPresent } from '../src/game/story/intro.ts';
import { LEGACY_INTRO_V2, newIntroV2, type IntroV2State } from '../src/game/story/introV2.ts';
import {
  countTurns,
  findPathCentered,
  findPathStraight,
  findPathWhere,
  inReach,
  isBlocked,
  isNearNpc,
  objectCovers,
  reachable,
  STEPS_4,
  teacherSideGoal,
  type Point,
} from '../src/game/world/world.ts';

/**
 * 2026-11-01 指示書 AI【6】：入口から、すべての「調べる所」と「人」に歩いて届くか。
 * ゲームと同じ通れない所（家具・人・人のまわり〔よこ2・たて1〕・練習場の先生のうしろ）で、物語の進み具合ごとに出る人を変えて確かめる。
 * 調べる所はとなり（上下左右）のマスに立てること、人は話せる近さ（よこ3・たて2）のマスに立てること
 */
const SPACE = { x: 2, y: 1 };
const TALK = { x: 3, y: 2 };
const ART_MAPS: readonly MapDefinition[] = MAPS.filter((m) => m.art);

const saveIn = (state: IntroV2State | null) => {
  const s = createNewSave(new Date('2026-11-01T00:00:00Z'));
  return { ...s, story: { ...s.story, intro: 'skipped' as const, introV2: state ? { ...newIntroV2(null), state } : LEGACY_INTRO_V2 } };
};

function walker(map: MapDefinition, state: IntroV2State | null) {
  const save = saveIn(state);
  const vis = (o: MapObject): boolean => (o.type === 'npc' ? isNpcPresent(save, o) : true);
  const teacher = map.objects.find((o): o is NpcObject => o.type === 'npc' && o.npcId === 'teacher');
  const behindTeacher = (x: number, y: number): boolean =>
    map.id === 'practice' && !!teacher && Math.abs(x - teacher.x) <= 2 && y < teacher.y && y >= teacher.y - 4;
  const blocked = (x: number, y: number): boolean => isBlocked(map, x, y, vis) || isNearNpc(map, x, y, vis, SPACE) || behindTeacher(x, y);
  return { vis, blocked, area: reachable(map, map.spawn, blocked) };
}

const touchCells = (o: MapObject): Point[] => {
  const w = 'w' in o ? o.w : 1;
  const h = 'h' in o ? o.h : 1;
  const out: Point[] = [];
  for (let y = o.y - 1; y <= o.y + h; y++)
    for (let x = o.x - 1; x <= o.x + w; x++) {
      if (objectCovers(o, x, y)) continue;
      const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => objectCovers(o, x + (dx ?? 0), y + (dy ?? 0)));
      if (side) out.push({ x, y });
    }
  return out;
};

describe('入口から、調べる所と人にすべて届く（指示書 AI【6】）', () => {
  // 導入の前後（案内役のいる所が変わる）
  const states: readonly (IntroV2State | null)[] = [null, 'escortToSchool', 'escortToBureau'];
  for (const map of ART_MAPS) {
    for (const state of states) {
      it(`${map.id}（${state ?? '導入のあと'}）`, () => {
        const { vis, area } = walker(map, state);
        const missing: string[] = [];
        for (const o of map.objects) {
          if (o.type === 'interact') {
            if (!touchCells(o).some((p) => area.has(`${p.x},${p.y}`))) missing.push(o.id);
          } else if (o.type === 'npc' && vis(o)) {
            let ok = false;
            for (const k of area) {
              const [x, y] = k.split(',').map(Number) as [number, number];
              if (inReach(o.x - x, o.y - y, TALK)) ok = true;
            }
            if (!ok) missing.push(o.id);
          } else if (o.type === 'warp') {
            const w = o;
            let ok = false;
            for (let x = w.x; x < w.x + w.w; x++) if (area.has(`${x},${w.y}`)) ok = true;
            if (!ok) missing.push(o.id);
          }
        }
        expect(missing, `${map.id} 届かない所`).toEqual([]);
      });
    }
  }
});

describe('街の建物の入口（指示書 AI【3】）', () => {
  const doors = TOWN.art?.doors ?? {};
  const blocked = (x: number, y: number): boolean => isBlocked(TOWN, x, y, () => false);
  it.each(Object.entries(doors))('%s：扉の前から、まっすぐ上へ歩けば扉に入れる（扉の列すべて）', (_id, d) => {
    for (let x = d.x; x < d.x + d.w; x++) {
      for (let y = d.y; y <= d.y + 3; y++) expect(blocked(x, y), `${x},${y}`).toBe(false);
    }
  });
  it('入口の段の踏み面（扉の列の左右）も歩ける。段の両はしのふち・柱の台はふさいだまま', () => {
    // 練習場：扉 32〜36。下の段（93行）は 31〜37、いちばん下（94行）は 30〜37 が歩ける。柱の台（92行の 31・37）はふさぐ
    for (let x = 31; x <= 37; x++) expect(blocked(x, 93), `${x},93`).toBe(false);
    for (let x = 30; x <= 37; x++) expect(blocked(x, 94), `${x},94`).toBe(false);
    expect(blocked(31, 92)).toBe(true);
    expect(blocked(37, 92)).toBe(true);
    // カードショップ：扉 141〜146。段は 139〜149（90行）・138〜149（91行）
    for (let x = 139; x <= 149; x++) expect(blocked(x, 90), `${x},90`).toBe(false);
    for (let x = 138; x <= 149; x++) expect(blocked(x, 91), `${x},91`).toBe(false);
    // 自分の家：扉 30〜32。段は 29〜33
    for (let x = 29; x <= 33; x++) expect(blocked(x, 183), `${x},183`).toBe(false);
  });
});

describe('大会会場（指示書 AI【4】【5】）', () => {
  const { blocked } = walker(HALL, null);
  const board = HALL.objects.find((o) => o.id === 'hall-board') as MapObject;
  const front = (x: number, y: number): boolean => y === 16 && x >= 4 && x <= 13;
  it('対戦表の前（板の下の1列）へ、長いすの左からも右からも入れる。前に立つと「調べる」が届く（板のとなり）', () => {
    // 左から：左の壁ぞい（1〜3列）だけ通れるとき
    const leftOnly = (x: number, y: number): boolean => blocked(x, y) || (x >= 14 && y >= 16 && y <= 22);
    // 右から：舞台と奥の長いすのあいだ（15列）だけ通れるとき
    const rightOnly = (x: number, y: number): boolean => blocked(x, y) || (x <= 3 && y >= 12 && y <= 22);
    expect(findPathWhere(HALL, HALL.spawn, front, leftOnly, 40000, STEPS_4)).not.toBeNull();
    expect(findPathWhere(HALL, HALL.spawn, front, rightOnly, 40000, STEPS_4)).not.toBeNull();
    for (let x = 4; x <= 13; x++) expect(objectCovers(board, x, 15) || objectCovers(board, x, 16)).toBe(true);
  });
  it('入口 → 受付の前（セリアと話せる所）、受付の前 → 入口 が、ほぼまっすぐ（曲がるのは1回まで）', () => {
    const celia = HALL.objects.find((o) => o.id === 'hall-receptionist') as NpcObject;
    const talk = (x: number, y: number): boolean => inReach(celia.x - x, celia.y - y, TALK);
    const go = findPathStraight(HALL, HALL.spawn, talk, blocked, 'up') as Point[];
    expect(go).not.toBeNull();
    expect(countTurns(HALL.spawn, go)).toBeLessThanOrEqual(1);
    expect(go[0]).toEqual({ x: HALL.spawn.x, y: HALL.spawn.y - 1 });
    const desk = go[go.length - 1] as Point;
    const exit = HALL.objects.find((o) => o.id === 'hall-exit') as MapObject & { w: number };
    const back = findPathStraight(HALL, desk, (x, y) => y === exit.y && x >= exit.x && x < exit.x + exit.w, blocked) as Point[];
    expect(back).not.toBeNull();
    expect(countTurns(desk, back)).toBeLessThanOrEqual(1);
    // 受付の前の行（29行）は、入口の通り道から受付まで、家具・柱でふさがれない
    for (let x = 24; x <= 55; x++) expect(isBlocked(HALL, x, 29, () => false), `${x},29`).toBe(false);
  });
  // 2026-11-02 iPhone 試遊：カウンターの左のはしに主人公が重なって動けなくなる・入口の柱と低い壁の手前で引っかかる
  it('カウンターの左右のはしの横（体がカウンターに重なる列）には立てない。前の行（29行）からは受付まで歩ける', () => {
    for (let y = 24; y <= 28; y++) {
      expect(isBlocked(HALL, 42, y, () => false), `42,${y}`).toBe(true);
      expect(isBlocked(HALL, 56, y, () => false), `56,${y}`).toBe(true);
    }
    expect(isBlocked(HALL, 41, 28, () => false)).toBe(false);
    expect(isBlocked(HALL, 42, 29, () => false)).toBe(false);
    // セリアのまわりは本人のマスだけ：受付の前の行を、カウンターの左はしの前で止まらずに、セリアの真ん前まで歩ける
    const celia = HALL.objects.find((o) => o.id === 'hall-receptionist') as NpcObject;
    for (let x = 42; x <= 55; x++) expect(blocked(x, celia.y + 1), `${x},${celia.y + 1}`).toBe(false);
    const path = findPathWhere(HALL, HALL.spawn, (x, y) => x === celia.x && y === celia.y + 1, blocked, 40000, STEPS_4);
    expect(path).not.toBeNull();
  });
  it('入口の柱のまわりに行き止まり（下にも横にも進めないマス）が無い。柱のあいだの通り道は12マスのまま', () => {
    // 30行（柱の頭・低い壁のすぐ上）：歩けるマスで、下が低い壁なら、左右のどちらかに歩けるマスがある（柱にはさまれた1マスの行き止まりが無い）
    for (let x = 1; x < 59; x++) {
      if (blocked(x, 30) || !blocked(x, 31)) continue;
      expect(!blocked(x - 1, 30) || !blocked(x + 1, 30), `${x},30`).toBe(true);
      // 柱のすぐ横（柱の頭がかかるマス）には立たない
      expect(x === 20 || x === 39, `${x},30`).toBe(false);
    }
    for (let y = 31; y <= 39; y++) {
      const open = Array.from({ length: 60 }, (_, x) => x).filter((x) => !blocked(x, y));
      expect(open, `${y}`).toEqual(Array.from({ length: 12 }, (_, i) => 24 + i));
    }
  });
});

describe('カード練習場（指示書 AI【1】）', () => {
  const table = PRACTICE.art?.items?.TABLE_1 as { x: number; y: number; w: number; h: number };
  const teacher = PRACTICE.objects.find((o) => o.id === 'practice-teacher') as NpcObject;
  const guide = PRACTICE.objects.find((o) => o.id === 'guide-practice') as NpcObject;
  it('練習テーブルは奥（黒板の前）。テーブルと黒板のあいだは通れない', () => {
    const top = PRACTICE.tiles.findIndex((row) => row.includes('.'));
    expect(table.y).toBeLessThanOrEqual(top);
  });
  it('ガレス先生はテーブルの右の辺の横。ミレイユは先生の右手前で、先生にも主人公にも重ならない', () => {
    expect(teacher.x).toBeGreaterThanOrEqual(table.x + table.w);
    expect(teacher.y).toBeGreaterThan(table.y);
    expect(teacher.y).toBeLessThan(table.y + table.h);
    expect(guide.x - teacher.x).toBeGreaterThanOrEqual(3);
  });
  it('入口 → まっすぐ上 → 先生の前 の短い道（曲がるのは1回まで）。主人公はミレイユ・先生に重ならない', () => {
    const { blocked } = walker(PRACTICE, 'escortToSchool');
    const path = findPathStraight(PRACTICE, PRACTICE.spawn, teacherSideGoal(teacher, -1, TALK.x, TALK.y), blocked, 'up') as Point[];
    expect(path).not.toBeNull();
    expect(countTurns(PRACTICE.spawn, path)).toBeLessThanOrEqual(1);
    expect(path.length).toBeLessThanOrEqual(20);
    expect(path[0]).toEqual({ x: PRACTICE.spawn.x, y: PRACTICE.spawn.y - 1 });
    const end = path[path.length - 1] as Point;
    expect(inReach(teacher.x - end.x, teacher.y - end.y, TALK)).toBe(true);
    expect(Math.abs(end.x - guide.x)).toBeGreaterThan(SPACE.x);
  });
  it('先生の真ん前から話しかけたときの横へ回る道も短い（3歩以内）', () => {
    const { blocked } = walker(PRACTICE, 'escortToSchool');
    const fronts: Point[] = [];
    for (let x = teacher.x - 2; x <= teacher.x + 2; x++)
      for (let y = teacher.y + 1; y <= teacher.y + 2; y++) if (!blocked(x, y)) fronts.push({ x, y });
    expect(fronts.length).toBeGreaterThan(0);
    for (const f of fronts) {
      const p = findPathStraight(PRACTICE, f, teacherSideGoal(teacher, 0, TALK.x, TALK.y), blocked);
      expect(p, `${f.x},${f.y}`).not.toBeNull();
      expect((p as Point[]).length, `${f.x},${f.y}`).toBeLessThanOrEqual(3);
    }
  });
});

describe('案内の道の曲がる回数（指示書 AI【2】）', () => {
  it('曲がるたびに遠回りを足すので、同じ長さならジグザグより曲がりの少ない道を選ぶ', () => {
    const tiles = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];
    const map: MapDefinition = { id: 't', name: 't', area: 'interior', tiles, objects: [], spawn: { x: 1, y: 1, dir: 'down' } };
    const blocked = (x: number, y: number): boolean => tiles[y]?.[x] !== '.';
    const goal = (x: number, y: number): boolean => x === 7 && y === 4;
    const flat = findPathCentered(map, { x: 1, y: 1 }, goal, blocked, STEPS_4, 10000, 0) as Point[];
    const straight = findPathCentered(map, { x: 1, y: 1 }, goal, blocked) as Point[];
    expect(straight.length).toBe(flat.length);
    expect(countTurns({ x: 1, y: 1 }, straight)).toBeLessThanOrEqual(2);
    expect(countTurns({ x: 1, y: 1 }, straight)).toBeLessThanOrEqual(countTurns({ x: 1, y: 1 }, flat));
  });
});
