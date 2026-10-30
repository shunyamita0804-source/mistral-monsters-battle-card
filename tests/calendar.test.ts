import { describe, expect, it } from 'vitest';
import { RANK_BOSS_DUNGEONS, START_DATE } from '../src/data/calendar.ts';
import { getTournament } from '../src/data/tournaments.ts';
import {
  advanceMonth,
  isOfficialMonth,
  isSeasonStart,
  missingBosses,
  nextDate,
  nextEventMonth,
  nextOfficialMonth,
  seasonOf,
} from '../src/game/calendar/calendar.ts';
import { descend, loseRunBattle, maxLossesOf, runFloor, startRun, useDungeonItem, winRunBattle } from '../src/game/dungeon/run.ts';
import { claimTournamentRewards, enterTournament, entryCheck, recordMatch, withdraw } from '../src/game/progress/tournament.ts';
import { createNewGameSave, createNewSave, normalizeSave, SAVE_VERSION, type DungeonRun, type SaveData } from '../src/game/save/saveData.ts';
import { setLanguage } from '../src/i18n/i18n.ts';
import { dateLabel } from '../src/i18n/calendarText.ts';

/** カレンダーの1段目：年と月（2026-10-30 指示書 R2） */
const base = (): SaveData => createNewSave(new Date('2026-10-30T00:00:00Z'), 'balance');
const at = (save: SaveData, month: number, year = 1): SaveData => ({ ...save, calendar: { year, month } });
const runOf = (s: SaveData): DungeonRun => {
  if (!s.dungeonRun) throw new Error('挑戦していない');
  return s.dungeonRun;
};
/** ダンジョンの最後の階（ボスの間）まで進めた挑戦 */
const atBoss = (save: SaveData, dungeonId: string): { save: SaveData; bossId: string } => {
  let s = startRun(save, dungeonId, 5);
  while (runFloor(runOf(s)).entities.every((e) => e.kind !== 'boss')) s = { ...s, dungeonRun: descend(runOf(s)) };
  const boss = runFloor(runOf(s)).entities.find((e) => e.kind === 'boss');
  if (!boss) throw new Error('ボスがいない');
  return { save: s, bossId: boss.id };
};

describe('年と月', () => {
  it('新しいセーブは「1年目 4月」から', () => {
    expect(START_DATE).toEqual({ year: 1, month: 4 });
    expect(base().calendar).toEqual({ year: 1, month: 4 });
    expect(createNewGameSave().calendar).toEqual({ year: 1, month: 4 });
  });

  it('前のセーブ（version 28）は「1年目 4月」として読む・壊れた値も「1年目 4月」', () => {
    const { calendar: _c, ...rest } = base();
    const old = normalizeSave({ ...rest, version: 28 });
    expect(SAVE_VERSION).toBe(29);
    expect(old?.version).toBe(29);
    expect(old?.calendar).toEqual({ year: 1, month: 4 });
    // ほかの中身はそのまま
    expect(old?.collection).toEqual(base().collection);
    expect(normalizeSave({ ...base(), calendar: { year: 0, month: 13 } })?.calendar).toEqual({ year: 1, month: 4 });
    expect(normalizeSave({ ...base(), calendar: 'x' })?.calendar).toEqual({ year: 1, month: 4 });
    expect(normalizeSave(JSON.parse(JSON.stringify(at(base(), 11, 3))))?.calendar).toEqual({ year: 3, month: 11 });
  });

  it('次の月：12月の次は同じ年の1月、3月の次の4月で年が進む', () => {
    expect(nextDate({ year: 1, month: 4 })).toEqual({ year: 1, month: 5 });
    expect(nextDate({ year: 1, month: 12 })).toEqual({ year: 1, month: 1 });
    expect(nextDate({ year: 1, month: 3 })).toEqual({ year: 2, month: 4 });
    expect(advanceMonth(base()).calendar).toEqual({ year: 1, month: 5 });
  });

  it('季節：春＝3〜5月・夏＝6〜8月・秋＝9〜11月・冬＝12〜2月。挿絵を出すのは 3・6・9・12月だけ', () => {
    const seasons = Array.from({ length: 12 }, (_, i) => seasonOf(i + 1));
    expect(seasons).toEqual(['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter']);
    expect(Array.from({ length: 12 }, (_, i) => i + 1).filter(isSeasonStart)).toEqual([3, 6, 9, 12]);
  });

  it('日付の札の文字（日本語・英語）', () => {
    expect(dateLabel({ year: 1, month: 4 })).toBe('1年目 4月');
    setLanguage('en');
    try {
      expect(dateLabel({ year: 1, month: 4 })).toBe('Year 1 · April');
      expect(dateLabel({ year: 2, month: 9 })).toBe('Year 2 · September');
    } finally {
      setLanguage('ja');
    }
  });
});

describe('1か月進むとき・進まないとき', () => {
  it('ダンジョンのボスを倒して街に戻ると進む（途中のバトラーに勝っても進まない）', () => {
    const { save, bossId } = atBoss(base(), 'dungeon-02');
    const npc = runFloor(runOf(save)).entities.find((e) => e.kind === 'npc');
    if (npc) expect(winRunBattle(save, { kind: 'npc', id: npc.id }, null).save.calendar).toEqual({ year: 1, month: 4 });
    const w = winRunBattle(save, { kind: 'boss', id: bossId }, null);
    expect(w.cleared).toBe(true);
    expect(w.save.calendar).toEqual({ year: 1, month: 5 });
  });

  it('負けて街に戻されると進む（まだ負けられるあいだは進まない）', () => {
    let s = startRun(base(), 'dungeon-02', 3);
    for (let i = 1; i < maxLossesOf('dungeon-02'); i++) {
      const l = loseRunBattle(s, { kind: 'npc', id: 'f0-npc-1' });
      expect(l.expelled).toBe(false);
      expect(l.save.calendar.month).toBe(4);
      s = l.save;
    }
    const last = loseRunBattle(s, { kind: 'npc', id: 'f0-npc-1' });
    expect(last.expelled).toBe(true);
    expect(last.save.calendar.month).toBe(5);
  });

  it('帰還の羽根で街に戻ると進む（ほかの道具では進まない）', () => {
    const s = startRun({ ...base(), items: { returnFeather: 1, torch: 1 } }, 'dungeon-02', 3);
    expect(useDungeonItem(s, 'torch').save.calendar.month).toBe(4);
    const r = useDungeonItem(s, 'returnFeather');
    expect(r.status).toBe('ok');
    expect(r.save.dungeonRun).toBeNull();
    expect(r.save.calendar.month).toBe(5);
  });

  it('大会が終わって景品を受け取ると進む（優勝でも負けでも・棄権でも）。参加しただけ・試合の途中では進まない', () => {
    const ready = { ...at(base(), 6), dungeons: { 'dungeon-02': { openedChests: [], bossDefeated: true, clears: 1 } } };
    let s = enterTournament(ready, 'tournament-e', 'e-1', 1);
    expect(s.activeTournament).not.toBeNull();
    expect(s.calendar.month).toBe(6);
    s = recordMatch(s, 0, true);
    expect(s.calendar.month).toBe(6);
    for (let r = 1; r < 3; r++) s = recordMatch(s, r, true);
    const won = claimTournamentRewards(s);
    if (won.status !== 'ok') throw new Error('claim');
    expect(won.save.calendar.month).toBe(7);
    // 棄権して負けでも進む
    const quit = claimTournamentRewards(withdraw(enterTournament(ready, 'tournament-e', 'e-2', 2)));
    if (quit.status !== 'ok') throw new Error('claim');
    expect(quit.save.calendar.month).toBe(7);
    // 二重に受け取っても、もう進まない
    expect(claimTournamentRewards(quit.save).save.calendar.month).toBe(7);
  });
});

describe('大会は 3・6・9月だけ・出場の条件', () => {
  const E = getTournament('tournament-e');
  const C = getTournament('tournament-c');
  if (!E || !C) throw new Error('大会がない');
  const forest = { 'dungeon-02': { openedChests: [], bossDefeated: true, clears: 1 } };

  it('次の公式戦の月・次の行事の月', () => {
    expect([3, 6, 9].every(isOfficialMonth)).toBe(true);
    expect(isOfficialMonth(12)).toBe(false);
    expect(nextOfficialMonth(4)).toBe(6);
    expect(nextOfficialMonth(6)).toBe(6);
    expect(nextOfficialMonth(10)).toBe(3);
    expect(nextOfficialMonth(12)).toBe(3);
    expect(nextEventMonth(4)).toBe(6);
    expect(nextEventMonth(6)).toBe(9);
    expect(nextEventMonth(10)).toBe(12);
    expect(nextEventMonth(12)).toBe(3);
  });

  it('4月は受け付けない（次は6月）。12月はチーム戦の月', () => {
    const april = entryCheck({ ...base(), dungeons: forest }, E);
    expect(april.ok).toBe(false);
    expect(april.reasons).toEqual(['次の公式戦は 6月です']);
    expect(enterTournament({ ...base(), dungeons: forest }, 'tournament-e', 'x', 1).activeTournament).toBeNull();
    const dec = entryCheck({ ...at(base(), 12), dungeons: forest }, E);
    expect(dec.reasons).toEqual(['12月はチーム戦の月です']);
  });

  it('ボスを倒していないと受け付けない（「○○のボスをまだ倒していません」）。C は氷の洞窟と太古の遺跡の両方', () => {
    const june = entryCheck(at(base(), 6), E);
    expect(june.ok).toBe(false);
    expect(june.reasons).toEqual(['精霊の森のボスをまだ倒していません']);
    expect(entryCheck({ ...at(base(), 6), dungeons: forest }, E).ok).toBe(true);
    expect(RANK_BOSS_DUNGEONS.C).toEqual(['dungeon-04', 'dungeon-01']);
    const c = { ...at(base(), 9), rank: 'C' as const, dungeons: { 'dungeon-04': { openedChests: [], bossDefeated: true, clears: 1 } } };
    expect(missingBosses(c, 'C')).toEqual(['dungeon-01']);
    expect(entryCheck(c, C).reasons).toEqual(['太古の遺跡のボスをまだ倒していません']);
  });

  it('通し：4月 → 精霊の森のボスを倒して戻る（5月）→ 寝る（6月・夏の挿絵）→ E の大会に出られる', () => {
    const start = createNewGameSave();
    const deckOk = { ...start, deck: base().deck, collection: base().collection };
    expect(deckOk.calendar).toEqual({ year: 1, month: 4 });
    const { save, bossId } = atBoss(deckOk, 'dungeon-02');
    const may = winRunBattle(save, { kind: 'boss', id: bossId }, null).save;
    expect(may.calendar).toEqual({ year: 1, month: 5 });
    expect(entryCheck(may, E).reasons).toEqual(['次の公式戦は 6月です']);
    const june = advanceMonth(may);
    expect(june.calendar).toEqual({ year: 1, month: 6 });
    expect(isSeasonStart(june.calendar.month)).toBe(true);
    expect(seasonOf(june.calendar.month)).toBe('summer');
    expect(entryCheck(june, E).ok).toBe(true);
    // ボスを倒さずに6月にしたときは断られる
    const skip = advanceMonth(advanceMonth(deckOk));
    expect(skip.calendar.month).toBe(6);
    expect(entryCheck(skip, E).reasons).toEqual(['精霊の森のボスをまだ倒していません']);
  });
});
