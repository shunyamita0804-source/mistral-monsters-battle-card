import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../src/data/dungeons.ts';
import { RUN_DUNGEONS } from '../src/data/dungeonRun.ts';
import { DUNGEON_SPOTS } from '../src/data/worldMap.ts';
import { floorDecorations } from '../src/game/dungeon/decor.ts';
import { generateFloor } from '../src/game/dungeon/generate.ts';
import { DUNGEON_RUN } from '../src/data/dungeonRun.ts';

/** イベントのダンジョン3つの絵（2026-10-29。原本 design-parts/event-dungeons3-20261029/・切り出し tools/design/event_dungeons3_build.py） */
const KEYS = ['mist_mine', 'archive', 'altar'] as const;
const IDS = ['event-mist-mine', 'event-archive', 'event-altar'] as const;
const DECO_COUNT = { mist_mine: 6, archive: 5, altar: 5 } as const;
const ORIGINAL = 'design-parts/event-dungeons3-20261029';

describe('イベントのダンジョン3つの絵', () => {
  it('原本は届いた 22枚＋確認用3枚を無改変で保管（書庫だけ じゅうたん）', () => {
    for (const d of KEYS) {
      for (const k of ['tiles', 'parts', 'battle_bg', 'boss_mark', 'art', 'overlay', 'title']) expect(existsSync(`${ORIGINAL}/${d}/${d}_${k}.png`), `${d} ${k}`).toBe(true);
      expect(existsSync(`${ORIGINAL}/${d}/${d}_review.jpg`)).toBe(true);
    }
    expect(existsSync(`${ORIGINAL}/archive/archive_rugs.png`)).toBe(true);
    expect(existsSync(`${ORIGINAL}/00_instructions_for_claude_code.txt`)).toBe(true);
  });

  it('ゲーム用の絵がそろっている（床・壁・階段・飾り・ボスのしるし・対戦の背景・挿絵・輪・名前の絵）', () => {
    for (const d of KEYS) {
      const files = [
        ...['floor', 'wall_top', 'wall_face', 'stairs_down'].map((k) => `maps/dungeon/${d}_${k}.webp`),
        ...Array.from({ length: DECO_COUNT[d] }, (_, i) => `maps/dungeon/${d}_deco_${i + 1}.webp`),
        `maps/dungeon/boss_mark_${d}.webp`,
        `backgrounds/battle_${d}.webp`,
        ...['art', 'overlay', 'title'].map((k) => `ui/dungeon_intro/${d}_${k}.webp`),
      ];
      for (const f of files) expect(existsSync(`assets/images/${f}`), f).toBe(true);
    }
    for (const n of [1, 2, 3]) expect(existsSync(`assets/images/maps/dungeon/archive_rug_${n}.webp`)).toBe(true);
  });

  it('ふつうに遊ぶ人には出さない：ダンジョンの一覧・ランダム生成・世界地図に入っていない', () => {
    for (const id of IDS) {
      expect(DUNGEONS.some((d) => d.id === id)).toBe(false);
      expect(RUN_DUNGEONS[id]).toBeUndefined();
      expect(DUNGEON_SPOTS[id]).toBeUndefined();
    }
  });

  it('見た目の割り当て：CSS（.drun--{ID}）・飾りの決まりがある', () => {
    const css = readFileSync('src/ui/styles/eventDungeons.css', 'utf8');
    for (const id of IDS) expect(css).toContain(`.drun--${id}`);
    // 飾りの決まり：あとでダンジョンとして足したとき、ランダム生成の階に置ける
    const f = generateFloor(42, 0, false, DUNGEON_RUN, 'none');
    for (const id of IDS) {
      const kinds = new Set(Array.from({ length: 30 }, (_, s) => floorDecorations({ ...f, index: 0 }, s + 1, id)).flat().map((d) => d.kind));
      expect(kinds.size, id).toBeGreaterThan(0);
      for (const k of kinds) expect(css).toContain(`.drun__decor--${k}-1`);
    }
  });
});
