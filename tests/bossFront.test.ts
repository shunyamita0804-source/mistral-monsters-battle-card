import { describe, expect, it } from 'vitest';
import { RUN_DUNGEONS } from '../src/data/dungeonRun.ts';
import { floorsOf, move, runFloor, startRun, talkTarget } from '../src/game/dungeon/run.ts';
import { createNewSave, type Direction, type DungeonRun } from '../src/game/save/saveData.ts';

const DIRS: readonly Direction[] = ['up', 'down', 'left', 'right'];

/** 最後の階の入口から歩いて行ける所（すべる床もふくめ、本当の1歩で）をすべて調べる */
function reachable(run0: DungeonRun): DungeonRun[] {
  const seen = new Set<string>();
  const out: DungeonRun[] = [];
  const queue: DungeonRun[] = [run0];
  while (queue.length) {
    const r = queue.shift() as DungeonRun;
    const key = `${r.x},${r.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    for (const dir of DIRS) {
      const m = move({ ...r, cooldown: 99, incenseSteps: 99 }, dir);
      if (m.moved) queue.push({ ...m.run, dir: 'down' });
    }
  }
  return out;
}

describe('ボスには1マス手前から話しかける（2026-10-30 指示書 O3：ボスの印が主人公に重ならないように）', () => {
  it('どのダンジョンでも、どこかから必ずボスに話しかけられる・ほとんどの階ではボスのとなりに入らずに1マス手前から（多くのシード）', () => {
    // 1マス手前から話しかける階（となりに入れない）がほとんど。曲がり角の先など、それができない形の階は今までどおりとなりから
    let afar = 0;
    let total = 0;
    for (const id of Object.keys(RUN_DUNGEONS)) {
      const d = { id };
      for (let seed = 1; seed <= 30; seed++) {
        const base = startRun(createNewSave(), d.id, seed * 104729).dungeonRun;
        if (!base) throw new Error(d.id);
        const last = floorsOf(d.id) - 1;
        const f = runFloor({ seed: base.seed, floor: last, dungeonId: d.id });
        const run: DungeonRun = { ...base, floor: last, x: f.start.x, y: f.start.y, switchFloor: last };
        const boss = f.entities.find((e) => e.kind === 'boss');
        if (!boss) throw new Error('boss');
        const spots = reachable(run);
        total++;
        const near = spots.some((r) => Math.abs(r.x - boss.x) + Math.abs(r.y - boss.y) === 1);
        if (!near) afar++;
        const canTalk = spots.some((r) => DIRS.some((dir) => talkTarget({ ...r, dir })?.kind === 'boss'));
        expect(canTalk, `${d.id} seed ${seed}`).toBe(true);
      }
    }
    expect(afar / total).toBeGreaterThan(0.6);
  }, 120000);
});
