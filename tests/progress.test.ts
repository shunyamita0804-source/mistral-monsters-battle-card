import { describe, expect, it } from 'vitest';
import { HIDDEN_MONSTER_ID } from '../src/data/cards.ts';
import { FLUNE_MONSTER_ID } from '../src/data/flune.ts';
import { GEOL_MONSTER_ID } from '../src/data/geol.ts';
import { dungeonMoney } from '../src/data/economy.ts';
import { FRAGMENTS } from '../src/data/fragments.ts';
import { DUNGEON_B2, HOME } from '../src/data/maps.ts';
import { getTournament } from '../src/data/tournaments.ts';
import {
  changeFloor,
  defeatEnemy,
  isEnemyActive,
  leaveDungeon,
  openChest,
  sanitizeLocation,
  startDungeon,
} from '../src/game/progress/dungeon.ts';
import { canRestoreHidden, collectFragment, fragmentCount, restoreHidden } from '../src/game/progress/fragments.ts';
import {
  claimTournamentRewards,
  enterTournament,
  entryCheck,
  recordMatch,
  withdraw,
} from '../src/game/progress/tournament.ts';
import { createNewSave, type SaveData } from '../src/game/save/saveData.ts';
import { cupReady } from './support/cupReady.ts';

const T_E = getTournament('tournament-e');

function winTournament(save: SaveData, entryId: string): SaveData {
  let s = enterTournament(cupReady(save), 'tournament-e', entryId);
  for (let round = 0; round < (T_E?.rounds.length ?? 0); round++) s = recordMatch(s, round, true);
  return s;
}

describe('大会', () => {
  it('Eランク大会：3連勝で優勝し、初回優勝の景品（パック解放・ランクアップ・カード）を受け取る', () => {
    const start = createNewSave();
    const won = winTournament(start, 'entry-1');
    expect(won.activeTournament?.status).toBe('won');
    const claim = claimTournamentRewards(won);
    expect(claim.status).toBe('ok');
    if (claim.status !== 'ok') return;
    expect(claim.summary.firstWin).toBe(true);
    // 2026-10-28 夜：仮パックの解放は景品から外した
    expect(claim.save.unlockedPacks).not.toContain('pack-02');
    expect(claim.save.rank).toBe('D');
    expect(claim.save.coins).toBe(start.coins + (T_E?.rewards.participationCoins ?? 0) + (T_E?.rewards.firstWin.coins ?? 0));
    expect(claim.save.activeTournament).toBeNull();
    expect(claim.save.tournaments['tournament-e']).toEqual({ entries: 1, wins: 1, firstWinClaimed: true });
  });

  it('景品は二重に受け取れない', () => {
    const won = winTournament(createNewSave(), 'entry-1');
    const first = claimTournamentRewards(won);
    if (first.status !== 'ok') throw new Error('claim');
    expect(claimTournamentRewards(first.save).status).toBe('nothing');
    // 同じ参加IDの状態をもう一度作っても受け取れない
    const replay = claimTournamentRewards({ ...first.save, activeTournament: won.activeTournament });
    expect(replay.status).toBe('nothing');
    expect(replay.save.coins).toBe(first.save.coins);
  });

  it('2回目の優勝は再優勝の景品（初回景品は出ない）', () => {
    const first = claimTournamentRewards(winTournament(createNewSave(), 'entry-1'));
    if (first.status !== 'ok') throw new Error('claim');
    const second = claimTournamentRewards(winTournament(first.save, 'entry-2'));
    if (second.status !== 'ok') throw new Error('claim2');
    expect(second.summary.firstWin).toBe(false);
    expect(second.summary.coins).toBe((T_E?.rewards.participationCoins ?? 0) + (T_E?.rewards.repeatWin.coins ?? 0));
  });

  it('1位になれなければ参加報酬だけ。同じ回戦の結果は二重に記録されない', () => {
    let s = enterTournament(cupReady(createNewSave()), 'tournament-e', 'entry-x');
    s = recordMatch(s, 0, true);
    s = recordMatch(s, 0, true); // 二重記録は無視
    expect(s.activeTournament?.round).toBe(1);
    // 総当たりは負けても3試合まで続く。1勝2敗では1位になれない
    s = recordMatch(s, 1, false);
    expect(s.activeTournament?.status).toBe('inProgress');
    s = recordMatch(s, 2, false);
    const claim = claimTournamentRewards(s);
    if (claim.status !== 'ok') throw new Error('claim');
    expect(claim.summary.won).toBe(false);
    expect(claim.summary.coins).toBe(T_E?.rewards.participationCoins);
    expect(claim.save.rank).toBe('E');
  });

  it('途中の状態は保存され、再開できる。棄権もできる', () => {
    let s = enterTournament(cupReady(createNewSave()), 'tournament-e', 'entry-y');
    s = recordMatch(s, 0, true);
    // 中断中に新しく参加しようとしても状態は変わらない
    expect(enterTournament(s, 'tournament-e', 'entry-z')).toBe(s);
    expect(s.activeTournament).toMatchObject({ round: 1, status: 'inProgress' });
    expect(withdraw(s).activeTournament?.status).toBe('lost');
  });

  it('Dランク大会はEランク優勝まで参加できない', () => {
    const d = getTournament('tournament-d');
    if (!d) throw new Error('d');
    expect(entryCheck(createNewSave(), d).ok).toBe(false);
  });
});

describe('欠片と特別復元', () => {
  it('同じ欠片は1度しか入手できない', () => {
    let s = createNewSave();
    const r1 = collectFragment(s, 'fragment-01');
    expect(r1.collected).toBe(true);
    s = r1.save;
    const r2 = collectFragment(s, 'fragment-01');
    expect(r2.collected).toBe(false);
    expect(fragmentCount(r2.save)).toBe(1);
    expect(collectFragment(s, 'no-such').collected).toBe(false);
  });

  it('10個集めると隠しモンスターカード1枚だけを1度だけ受け取れる（技カードは付与しない）', () => {
    let s = createNewSave();
    expect(canRestoreHidden(s)).toBe(false);
    expect(restoreHidden(s, 'tx-0').status).toBe('notReady');
    for (const f of FRAGMENTS) s = collectFragment(s, f.id).save;
    expect(fragmentCount(s)).toBe(10);
    expect(canRestoreHidden(s)).toBe(true);
    const before = s.collection;
    const r = restoreHidden(s, 'tx-1');
    expect(r.status).toBe('ok');
    const diff = Object.entries(r.save.collection).filter(([id, n]) => n !== (before[id] ?? 0));
    expect(diff).toEqual([[HIDDEN_MONSTER_ID, 1]]);
    expect(restoreHidden(r.save, 'tx-1').status).toBe('duplicate');
    expect(restoreHidden(r.save, 'tx-2').status).toBe('alreadyRestored');
  });
});

describe('ダンジョン', () => {
  it('B1F→B2F→B3F と進み、上り階段で戻れる', () => {
    let s = startDungeon(createNewSave(), 'dungeon-01');
    expect(s.location.mapId).toBe('dungeon-01-b1');
    s = changeFloor(s, 1);
    expect(s.location.mapId).toBe('dungeon-01-b2');
    s = changeFloor(s, 1);
    expect(s.location.mapId).toBe('dungeon-01-b3');
    s = changeFloor(s, -1);
    expect(s.location).toMatchObject({ mapId: 'dungeon-01-b2', ...DUNGEON_B2.upArrival });
  });

  it('敵に勝つと消え（報酬あり）、探索し直すと復活する', () => {
    let s = startDungeon(createNewSave(), 'dungeon-01');
    const coins = s.coins;
    const r = defeatEnemy(s, 'b1-enemy-1', false);
    s = r.save;
    expect(isEnemyActive(s, 'b1-enemy-1')).toBe(false);
    expect(s.coins).toBe(coins + dungeonMoney('dungeon-01').win);
    expect(defeatEnemy(s, 'b1-enemy-1', false).coins).toBe(0);
    s = startDungeon(leaveDungeon(s), 'dungeon-01');
    expect(isEnemyActive(s, 'b1-enemy-1')).toBe(true);
  });

  it('ボスを倒すとクリア記録。初回と2回目で報酬が違う', () => {
    const s = startDungeon(createNewSave(), 'dungeon-01');
    const first = defeatEnemy(s, 'b3-boss', true);
    expect(first).toMatchObject({ cleared: true, firstClear: true, coins: dungeonMoney('dungeon-01').bossFirst });
    const again = defeatEnemy(startDungeon(leaveDungeon(first.save), 'dungeon-01'), 'b3-boss', true);
    expect(again).toMatchObject({ cleared: true, firstClear: false, coins: dungeonMoney('dungeon-01').bossRepeat });
    expect(again.save.dungeons['dungeon-01']?.clears).toBe(2);
  });

  it('ボスを初めて倒したときだけ、そのダンジョンのボスのカードがもらえる（遺跡＝ジオル・森＝フルーネ）', () => {
    const ruins = defeatEnemy(startDungeon(createNewSave(), 'dungeon-01'), 'b3-boss', true);
    expect(ruins.cards.map((c) => c.cardId)).toEqual([GEOL_MONSTER_ID]);
    expect(ruins.save.collection[GEOL_MONSTER_ID]).toBe(1);
    const again = defeatEnemy(startDungeon(leaveDungeon(ruins.save), 'dungeon-01'), 'b3-boss', true);
    expect(again.cards).toEqual([]);
    expect(again.save.collection[GEOL_MONSTER_ID]).toBe(1);
    const forest = defeatEnemy(startDungeon(createNewSave(), 'dungeon-02'), 'forest-b3-boss', true);
    expect(forest).toMatchObject({ cleared: true, firstClear: true });
    expect(forest.cards.map((c) => c.cardId)).toEqual([FLUNE_MONSTER_ID]);
    expect(forest.save.collection[FLUNE_MONSTER_ID]).toBe(1);
  });

  it('宝箱は1度だけ開けられる', () => {
    const chest = DUNGEON_B2.objects.find((o) => o.type === 'chest');
    if (!chest || chest.type !== 'chest') throw new Error('chest');
    const s = changeFloor(startDungeon(createNewSave(), 'dungeon-01'), 1);
    const r1 = openChest(s, chest);
    expect(r1.opened).toBe(true);
    const r2 = openChest(startDungeon(leaveDungeon(r1.save), 'dungeon-01'), chest);
    expect(r2.opened).toBe(false);
  });

  it('矛盾した位置のセーブは家に戻す', () => {
    const s = createNewSave();
    const broken = { ...s, location: { mapId: 'dungeon-01-b2', x: 7, y: 14, dir: 'up' as const }, activeDungeon: null };
    expect(sanitizeLocation(broken).location.mapId).toBe(HOME.id);
    expect(sanitizeLocation({ ...s, location: { ...s.location, mapId: 'nowhere' } }).location.mapId).toBe(HOME.id);
    expect(sanitizeLocation(s)).toBe(s);
  });
});
