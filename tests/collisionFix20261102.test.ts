import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUREAU, FLORIST, HALL, LAB, PRACTICE, SHOP, TAILOR, TEACHER_FRONT_DY, TOWN, type MapDefinition, type MapObject, type NpcObject } from '../src/data/maps.ts';
import { createNewSave } from '../src/game/save/saveData.ts';
import { isNpcPresent } from '../src/game/story/intro.ts';
import { newIntroV2, type IntroV2State } from '../src/game/story/introV2.ts';
import {
  countTurns,
  findPathStraight,
  findPathWhere,
  isBlocked,
  isNearNpc,
  nearestNpc,
  objectsAt,
  reachable,
  STEPS_4,
  teacherFrontGoal,
  type Point,
} from '../src/game/world/world.ts';

/**
 * 2026-11-02 iPhone 試遊の当たり判定の点検（docs/collision-fix-20261102.md）。ゲームと同じ通れない所
 * （家具・人・人のまわり〔ふつうは よこ2・たて1、カウンターの奥の人は本人のマスだけ〕・練習場の先生のうしろ）で確かめる
 */
const SPACE = { x: 2, y: 1 };
const TALK = { x: 3, y: 2 };

function walker(map: MapDefinition, state: IntroV2State | null = null) {
  const s = createNewSave(new Date('2026-11-02T00:00:00Z'));
  const save = { ...s, story: { ...s.story, intro: 'skipped' as const, introV2: state ? { ...newIntroV2(null), state } : { ...s.story.introV2, state: 'completed' as const } } };
  const vis = (o: MapObject): boolean => (o.type === 'npc' ? isNpcPresent(save, o) : true);
  const teacher = map.objects.find((o): o is NpcObject => o.type === 'npc' && o.npcId === 'teacher');
  const behindTeacher = (x: number, y: number): boolean =>
    map.id === 'practice' && !!teacher && Math.abs(x - teacher.x) <= 2 && y < teacher.y && y >= teacher.y - 4;
  const blocked = (x: number, y: number): boolean => isBlocked(map, x, y, vis) || isNearNpc(map, x, y, vis, SPACE) || behindTeacher(x, y);
  return { vis, blocked, area: reachable(map, map.spawn, blocked) };
}
const at = (area: Set<string>, x: number, y: number): boolean => area.has(`${x},${y}`);
const npcOf = (map: MapDefinition, id: string): NpcObject => {
  const o = map.objects.find((x): x is NpcObject => x.type === 'npc' && x.id === id);
  if (!o) throw new Error(id);
  return o;
};

describe('カウンターの奥に見える人のまわり（P0-4 研究所・P0-6 大会会場）', () => {
  // 2026-11-02 iPhone 試遊（2回目）「カウンターの左のはしで動けなくなる」：セリアも本人のマスだけに（受付の前の行を、セリアの真ん前まで歩ける）
  it('ルーカス・エレノア・花屋・仕立て屋（2.5マス以上奥に見える人）とセリアは本人のマスだけ。ショップの店員は今までどおり', () => {
    expect(npcOf(LAB, 'lab-researcher').space).toEqual({ x: 0, y: 0 });
    expect(npcOf(BUREAU, 'bureau-clerk').space).toEqual({ x: 0, y: 0 });
    expect(npcOf(FLORIST, 'florist-keeper').space).toEqual({ x: 0, y: 0 });
    expect(npcOf(TAILOR, 'tailor-keeper').space).toEqual({ x: 0, y: 0 });
    expect(npcOf(HALL, 'hall-receptionist').space).toEqual({ x: 0, y: 0 });
    expect(npcOf(SHOP, 'shop-clerk').space).toBeUndefined();
  });

  it('研究所：机の前の行を、左はしから右の解析台の前までまっすぐ歩ける（前はルーカスの前の5マスでふさがっていた）', () => {
    const { blocked, area } = walker(LAB);
    const lucas = npcOf(LAB, 'lab-researcher');
    const row = lucas.y + 1;
    for (let x = 24; x <= 44; x++) expect(blocked(x, row), `${x},${row}`).toBe(false);
    expect(at(area, 44, row)).toBe(true);
    // 前のまわりの決まり（よこ2・たて1）なら、ルーカスの前の行はふさがっていた
    expect(Math.abs(row - lucas.y)).toBeLessThanOrEqual(SPACE.y);
    // 机の真ん前から話せる（となりの行。ルーカスの絵はさらに3マス奥）
    expect(nearestNpc(LAB, { x: lucas.x, y: row }, () => true, TALK)?.id).toBe('lab-researcher');
    // 右の解析台へ：となりのマスに立てる
    const analysis = LAB.objects.find((o) => o.id === 'lab-analysis');
    expect(analysis).toBeDefined();
  });

  it('大会会場：受付の前の行（セリアの真ん前も）と、その1つ手前の行で、入口から受付の右はしまで行ける。セリアに話せる', () => {
    const { blocked, area } = walker(HALL);
    const celia = npcOf(HALL, 'hall-receptionist');
    expect(blocked(celia.x, celia.y + 1)).toBe(false);
    expect(nearestNpc(HALL, { x: celia.x, y: celia.y + 1 }, () => true, TALK)?.id).toBe('hall-receptionist');
    for (let x = 40; x <= 56; x++) expect(blocked(x, celia.y + 2), `${x}`).toBe(false);
    expect(at(area, 56, celia.y + 1)).toBe(true);
    expect(nearestNpc(HALL, { x: celia.x, y: celia.y + 2 }, () => true, TALK)?.id).toBe('hall-receptionist');
  });
});

describe('管理局の掲示板（P0-2）', () => {
  const board = BUREAU.objects.find((o) => o.id === 'bureau-notice-board');
  it('掲示板の手前（長いすの背もたれとのあいだ）の床を歩けて、上を向いて調べられる。右どなりの列からも調べられる', () => {
    if (!board || board.type !== 'interact') throw new Error('board');
    const { area } = walker(BUREAU);
    const front = board.y + board.h;
    let fromFront = 0;
    for (let x = board.x; x < board.x + board.w; x++) {
      if (!at(area, x, front)) continue;
      fromFront++;
      expect(objectsAt(BUREAU, x, front - 1, () => true).some((o) => o.id === 'bureau-notice-board')).toBe(true);
    }
    expect(fromFront).toBeGreaterThanOrEqual(10);
    // 右どなりの列
    expect(at(area, board.x + board.w, board.y + 3)).toBe(true);
    // 掲示板とランクの板のあいだ（掲示板のうしろ）は入らない（右はしの列は前から、ランクの板の右の通り道）
    for (let x = board.x; x < board.x + board.w - 1; x++) expect(at(area, x, board.y - 1), `${x}`).toBe(false);
  });
});

describe('街の入口（P0-1・P0-3・P0-5）', () => {
  const warp = (id: string) => {
    const w = TOWN.objects.find((o) => o.id === id);
    if (!w || w.type !== 'warp') throw new Error(id);
    return w;
  };
  it('カードショップの扉は自動ドアの絵の幅（7マス）。扉の前の段から、どの列も入れる', () => {
    const w = warp('door-shop');
    expect([w.x, w.w]).toEqual([140, 7]);
    const anim = TOWN.art?.doorAnims?.find((d) => d.id === 'SHOP');
    if (!anim) throw new Error('anim');
    // 自動ドアの絵の範囲（単位）の中に、扉のマスの真ん中がある
    for (let x = w.x; x < w.x + w.w; x++) {
      const cx = (x + 0.5) * 32;
      expect(cx >= anim.clip.x && cx <= anim.clip.x + anim.clip.w, `${x}`).toBe(true);
    }
    const { area } = walker(TOWN);
    for (let x = w.x; x < w.x + w.w; x++) expect(at(area, x, w.y), `${x}`).toBe(true);
  });

  it('管理局・大会会場・カードショップ：街の道から扉まで歩ける（扉の真ん中の列）', () => {
    const { area } = walker(TOWN);
    for (const id of ['door-bureau', 'door-hall', 'door-shop', 'door-lab', 'door-practice']) {
      const w = warp(id);
      expect(at(area, w.x + Math.floor(w.w / 2), w.y), id).toBe(true);
    }
  });

  it('大会会場：塔と塔のあいだのくぼみ（立つと建物の絵に隠れる所）には入れない。前の石畳の高台は通れる', () => {
    const { blocked } = walker(TOWN);
    for (const [x, y] of [[83, 40], [84, 40], [84, 41], [80, 41], [116, 41]] as const) expect(blocked(x, y), `${x},${y}`).toBe(true);
    for (let x = 80; x <= 120; x++) expect(blocked(x, 45), `${x},45`).toBe(false);
    // 大階段を上って扉へ
    const door = warp('door-hall');
    const path = findPathWhere(TOWN, { x: 100, y: 58 }, (x, y) => y === door.y && x >= door.x && x < door.x + door.w, blocked, 40000, STEPS_4);
    expect(path).not.toBeNull();
  });
});

describe('練習場：先生と上下に向かい合う（P1-1）', () => {
  const teacher = npcOf(PRACTICE, 'practice-teacher');
  it('向かい合う所（先生の真ん前の5マス手前）は、導入の前も後も入口から歩いて行けて、曲がる回数は1回まで', () => {
    expect(TEACHER_FRONT_DY).toBe(5);
    for (const state of ['escortToSchool', 'schoolArrival', 'examPassed', null] as const) {
      const { blocked } = walker(PRACTICE, state);
      const path = findPathStraight(PRACTICE, PRACTICE.spawn, teacherFrontGoal(teacher, TEACHER_FRONT_DY), blocked, 'up');
      expect(path, String(state)).not.toBeNull();
      const last = path?.[path.length - 1] as Point;
      expect(last).toEqual({ x: teacher.x, y: teacher.y + TEACHER_FRONT_DY });
      expect(countTurns(PRACTICE.spawn, path ?? [])).toBeLessThanOrEqual(1);
    }
  });

  it('向かい合う所から先生に話せる（先生だけ話せる範囲が たて5マス）。ミレイユのまわりにかからない', () => {
    expect(teacher.talkReach).toEqual({ x: 3, y: TEACHER_FRONT_DY });
    const front = { x: teacher.x, y: teacher.y + TEACHER_FRONT_DY };
    expect(nearestNpc(PRACTICE, front, () => true, TALK)?.id).toBe('practice-teacher');
    const guide = npcOf(PRACTICE, 'guide-practice');
    expect(Math.abs(guide.x - front.x) > SPACE.x || Math.abs(guide.y - front.y) > SPACE.y).toBe(true);
  });
});

describe('ミレイユの明るさ（P1-2）', () => {
  it('ミレイユだけ、人の色の落ち着かせを弱くする（ほかの人の調整は今までどおり）', () => {
    const css = readFileSync('src/ui/styles/world.css', 'utf8');
    expect(css).toContain(".world__npc[data-npc='neighbor_guide'] {");
    expect(css).toContain('filter: brightness(0.9) saturate(0.86) sepia(0.1) drop-shadow(0 0 1px rgb(30 18 8 / 0.55));');
  });
});
