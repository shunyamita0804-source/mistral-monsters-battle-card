import { RANK_BOSS_DUNGEONS } from '../../src/data/calendar.ts';
import type { SaveData } from '../../src/game/save/saveData.ts';

/** 大会に出られる状態にする（公式戦の月＝6月・どのランクのダンジョンのボスも倒した。2026-10-30 指示書 R2 の条件をテストで満たす） */
export function cupReady(save: SaveData): SaveData {
  const dungeons = { ...save.dungeons };
  for (const id of Object.values(RANK_BOSS_DUNGEONS).flat()) dungeons[id] = { openedChests: [], clears: 1, ...dungeons[id], bossDefeated: true };
  return { ...save, calendar: { ...save.calendar, month: 6 }, dungeons };
}
