import { describe, expect, it } from 'vitest';
import { skillsOf } from '../src/data/cards.ts';
import { DUNGEON_RUN } from '../src/data/dungeonRun.ts';
import { ITEM_RULES, ITEMS, type ItemId } from '../src/data/items.ts';
import { TOURNAMENTS } from '../src/data/tournaments.ts';
import {
  chooseRunReward,
  descend,
  escapeGuardian,
  loseRunBattle,
  move,
  nearGuardian,
  pickRewardChoices,
  rewardCandidates,
  runFloor,
  startRun,
  useDungeonItem,
  usesLuckyCoin,
  viewRadiusOf,
  winRunBattle,
  winRunBattleChoosing,
} from '../src/game/dungeon/run.ts';
import { isNewItem, itemBlock, itemCount, markItemsSeen, purchaseItem } from '../src/game/items/items.ts';
import { claimTournamentRewards, enterTournament } from '../src/game/progress/tournament.ts';
import { createNewSave, normalizeSave, SAVE_VERSION, type DungeonRun, type SaveData } from '../src/game/save/saveData.ts';

const SKILL = skillsOf('mon-soramo')[0]?.id as string;
const SKILL2 = skillsOf('mon-soramo')[1]?.id as string;

/** 道具を持たせて、ダンジョンに入った状態 */
function inRun(items: Partial<Record<ItemId, number>> = {}, seed = 31337): SaveData {
  return startRun({ ...createNewSave(), items }, 'dungeon-01', seed);
}

function runOf(save: SaveData): DungeonRun {
  if (!save.dungeonRun) throw new Error('挑戦がない');
  return save.dungeonRun;
}

function used(save: SaveData, id: ItemId, seal?: string): SaveData {
  const r = useDungeonItem(save, id, seal);
  if (r.status !== 'ok') throw new Error(`使えなかった: ${id} ${r.reason}`);
  return r.save;
}

/** 技カードを1枚勝ち取った状態 */
function withGained(save: SaveData, card = SKILL, id = 'npc-x'): SaveData {
  return winRunBattle(save, { kind: 'npc', id }, card).save;
}

describe('道具のデータ（仮）', () => {
  it('8種。値段と並ぶ時期は指示書どおり', () => {
    expect(ITEMS.map((i) => [i.id, i.name, i.price, i.unlockedFromStart])).toEqual([
      ['torch', 'たいまつ', 30, true],
      ['incense', '魔除けの香', 50, true],
      ['smokeBall', '煙玉', 60, true],
      ['returnFeather', '帰還の羽根', 80, true],
      ['ruinsMap', '遺跡の地図', 100, false],
      ['luckyCoin', '幸運のコイン', 120, false],
      ['sealBox', '封印の小箱', 150, false],
      ['guardianCharm', '身代わりのお守り', 200, false],
    ]);
    expect(ITEM_RULES).toMatchObject({ maxOwned: 9, incenseSteps: 30, torchViewRadius: 2 });
    const unlock = Object.fromEntries(TOURNAMENTS.map((t) => [t.id, t.rewards.firstWin.unlockItems]));
    expect(unlock).toEqual({ 'tournament-e': ['ruinsMap', 'luckyCoin'], 'tournament-d': ['sealBox', 'guardianCharm'] });
  });
});

describe('ショップで買う', () => {
  it('新しく始めたときは最初の4種だけ並び、道具は0個。NEW は出ない', () => {
    const save = createNewSave();
    expect(save.items).toEqual({});
    expect(save.unlockedItems).toEqual(['torch', 'incense', 'smokeBall', 'returnFeather']);
    for (const i of ITEMS) expect(isNewItem(save, i.id)).toBe(false);
  });

  it('数を選んで買う：お金が減り、数が増える。同じ購入 ID は1回だけ', () => {
    const save = { ...createNewSave(), coins: 500 };
    const r = purchaseItem(save, 'incense', 3, 'tx-1');
    expect(r.status).toBe('ok');
    expect(r.save.coins).toBe(500 - 150);
    expect(itemCount(r.save, 'incense')).toBe(3);
    const again = purchaseItem(r.save, 'incense', 3, 'tx-1');
    expect(again.status).toBe('duplicate');
    expect(again.save).toBe(r.save);
  });

  it('お金が足りない・上限（9個）を超える・まだ並ばない道具は買えない', () => {
    const save = { ...createNewSave(), coins: 1000, items: { torch: 8 } };
    expect(purchaseItem(save, 'torch', 2, 'a')).toMatchObject({ status: 'error', reason: 'limit' });
    expect(purchaseItem(save, 'torch', 1, 'b').status).toBe('ok');
    expect(purchaseItem({ ...save, coins: 59 }, 'smokeBall', 1, 'c')).toMatchObject({ status: 'error', reason: 'coins' });
    expect(purchaseItem(save, 'sealBox', 1, 'd')).toMatchObject({ status: 'error', reason: 'locked' });
    expect(purchaseItem(save, 'torch', 0, 'e')).toMatchObject({ status: 'error', reason: 'count' });
  });
});

describe('道具が並ぶ時期（大会の初優勝）', () => {
  const winTournament = (save: SaveData, id: string): SaveData => {
    const entered = enterTournament(save, id, `entry-${id}`);
    if (!entered.activeTournament) throw new Error('参加できない');
    const won = { ...entered, activeTournament: { ...entered.activeTournament, status: 'won' as const } };
    const r = claimTournamentRewards(won);
    if (r.status !== 'ok') throw new Error('景品なし');
    return r.save;
  };

  it('Eランク大会の初優勝で地図とコイン、Dランク大会で小箱とお守り。新しく並んだものは最初に見たときだけ NEW', () => {
    const e = winTournament(createNewSave(), 'tournament-e');
    expect(e.unlockedItems).toEqual(['torch', 'incense', 'smokeBall', 'returnFeather', 'ruinsMap', 'luckyCoin']);
    expect(isNewItem(e, 'ruinsMap')).toBe(true);
    expect(isNewItem(e, 'torch')).toBe(false);
    const seen = markItemsSeen(e);
    expect(isNewItem(seen, 'ruinsMap')).toBe(false);
    const d = winTournament(seen, 'tournament-d');
    expect(d.unlockedItems).toContain('sealBox');
    expect(d.unlockedItems).toContain('guardianCharm');
    expect(isNewItem(d, 'sealBox')).toBe(true);
    expect(isNewItem(d, 'ruinsMap')).toBe(false);
  });

  it('報酬の画面に出す内容（summary）には道具を入れない', () => {
    const entered = enterTournament(createNewSave(), 'tournament-e', 'entry-1');
    if (!entered.activeTournament) throw new Error('参加できない');
    const r = claimTournamentRewards({ ...entered, activeTournament: { ...entered.activeTournament, status: 'won' } });
    if (r.status !== 'ok') throw new Error('景品なし');
    expect(Object.keys(r.summary).sort()).toEqual(['cards', 'coins', 'firstWin', 'rankUp', 'unlockedPacks', 'won']);
  });

  it('前の形式（version 14）のセーブ：道具0個。Dランク以上なら読み込んだときに条件どおり並ぶ', () => {
    const old = (rank: string, tournaments: Record<string, unknown>): Record<string, unknown> => {
      const { items: _i, unlockedItems: _u, seenItems: _s, ...rest } = createNewSave();
      return { ...rest, version: 14, rank, tournaments };
    };
    const e = normalizeSave(old('E', {}));
    expect(e?.version).toBe(SAVE_VERSION);
    expect(e?.items).toEqual({});
    expect(e?.unlockedItems).toEqual(['torch', 'incense', 'smokeBall', 'returnFeather']);
    const d = normalizeSave(old('D', {}));
    expect(d?.unlockedItems).toEqual(['torch', 'incense', 'smokeBall', 'returnFeather', 'ruinsMap', 'luckyCoin']);
    const c = normalizeSave(old('C', { 'tournament-e': { entries: 1, wins: 1, firstWinClaimed: true } }));
    expect(c?.unlockedItems).toHaveLength(8);
    expect(c && isNewItem(c, 'guardianCharm')).toBe(true);
  });

  it('道具の数・並んだ道具・NEW を見たか・挑戦中の効き目は、保存して読み込んでも同じ', () => {
    let save: SaveData = { ...markItemsSeen({ ...createNewSave(), unlockedItems: ['torch', 'incense', 'smokeBall', 'returnFeather', 'ruinsMap'] as ItemId[] }), items: { torch: 2, guardianCharm: 1, luckyCoin: 1, incense: 1, sealBox: 1 } };
    save = startRun(save, 'dungeon-01', 99);
    save = used(save, 'torch');
    save = used(save, 'incense');
    save = used(save, 'guardianCharm');
    save = used(save, 'luckyCoin');
    save = used(withGained(save), 'sealBox', SKILL);
    const loaded = normalizeSave(JSON.parse(JSON.stringify(save)));
    expect(loaded?.items).toEqual(save.items);
    expect(loaded?.seenItems).toEqual(save.seenItems);
    expect(loaded?.dungeonRun).toEqual(save.dungeonRun);
  });
});

describe('ダンジョンの中で使う', () => {
  it('ダンジョンの外では使えない。持っていなければ使えない。煙玉はメニューからは使えない', () => {
    expect(itemBlock({ ...createNewSave(), items: { torch: 1 } }, 'torch')).toBe('noRun');
    expect(itemBlock(inRun(), 'torch')).toBe('none');
    expect(itemBlock(inRun({ smokeBall: 1 }), 'smokeBall')).toBe('guardianOnly');
  });

  it('たいまつ：その階のあいだ見える範囲が2マス。同じ階で2個目は使えない。下りると切れる', () => {
    let save = inRun({ torch: 2 });
    expect(viewRadiusOf(runOf(save))).toBe(1);
    const before = [...runOf(save).explored].filter((c) => c === '1').length;
    save = used(save, 'torch');
    expect(itemCount(save, 'torch')).toBe(1);
    expect(viewRadiusOf(runOf(save))).toBe(2);
    expect([...runOf(save).explored].filter((c) => c === '1').length).toBeGreaterThan(before);
    expect(itemBlock(save, 'torch')).toBe('torchActive');
    const down = { ...save, dungeonRun: descend(runOf(save)) };
    expect(viewRadiusOf(runOf(down))).toBe(1);
    expect(itemBlock(down, 'torch')).toBeNull();
  });

  it('魔除けの香：30歩のあいだ番人の抽選も予兆もない。効いている間に使うと30歩に戻る（足し算しない）。階をまたいでも続く', () => {
    let save = inRun({ incense: 2 });
    const f = runFloor(runOf(save));
    const g = f.entities.find((e) => e.kind === 'guardian');
    if (!g) throw new Error('番人がいない');
    save = used(save, 'incense');
    let run: DungeonRun = { ...runOf(save), x: g.x, y: g.y };
    expect(nearGuardian(run, f)).toBe(false);
    const dirs = ['up', 'down', 'left', 'right'] as const;
    let steps = 0;
    for (let i = 0; steps < ITEM_RULES.incenseSteps - 5 && i < 400; i++) {
      const r = move(run, dirs[i % 4] as (typeof dirs)[number]);
      expect(r.guardian).toBeNull();
      if (r.moved) {
        steps++;
        expect(r.omen).toBe(false);
      }
      run = { ...r.run, x: g.x, y: g.y };
    }
    expect(run.incenseSteps).toBe(5);
    save = used({ ...save, dungeonRun: run }, 'incense');
    expect(runOf(save).incenseSteps).toBe(ITEM_RULES.incenseSteps);
    expect(descend(runOf(save)).incenseSteps).toBe(ITEM_RULES.incenseSteps);
  });

  it('煙玉：番人から逃げる。煙玉が1つ減り、しばらく番人が出ない。負けの回数は増えず、カードももらえない', () => {
    const save = inRun({ smokeBall: 1 });
    const r = escapeGuardian(save);
    if (!r) throw new Error('逃げられない');
    expect(itemCount(r, 'smokeBall')).toBe(0);
    expect(runOf(r).cooldown).toBe(DUNGEON_RUN.guardianCooldownSteps);
    expect(runOf(r).losses).toBe(0);
    expect(runOf(r).gained).toEqual([]);
    expect(runOf(r).defeated).toEqual([]);
    expect(r.collection).toEqual(save.collection);
    expect(escapeGuardian(r)).toBeNull();
  });

  it('帰還の羽根：挑戦を終えて街へ。手に入れた技カードはすべて所持に残る', () => {
    let save = withGained(withGained(inRun({ returnFeather: 1 }), SKILL, 'npc-1'), SKILL2, 'npc-2');
    const owned = { ...save.collection };
    const r = useDungeonItem(save, 'returnFeather');
    if (r.status !== 'ok') throw new Error('使えない');
    expect(r.returned).toBe(true);
    save = r.save;
    expect(save.dungeonRun).toBeNull();
    expect(save.collection).toEqual(owned);
    expect(save.collection[SKILL]).toBe((createNewSave().collection[SKILL] ?? 0) + 1);
    expect(itemCount(save, 'returnFeather')).toBe(0);
    expect(save.dungeons['dungeon-01']).toBeUndefined();
  });

  it('遺跡の地図：その階だけ。同じ階で2個目は使えない。下りると切れる', () => {
    let save = inRun({ ruinsMap: 2 });
    save = used(save, 'ruinsMap');
    expect(runOf(save).mapFloor).toBe(0);
    expect(itemBlock(save, 'ruinsMap')).toBe('mapActive');
    expect(itemBlock({ ...save, dungeonRun: descend(runOf(save)) }, 'ruinsMap')).toBeNull();
  });

  it('身代わりのお守り：次の負けで負けの回数が増えずに消える。勝っても残る。1回の挑戦で1個まで', () => {
    let save = used(inRun({ guardianCharm: 2 }), 'guardianCharm');
    save = winRunBattle(save, { kind: 'npc', id: 'npc-1' }, SKILL).save;
    expect(runOf(save).charm).toBe(true);
    expect(itemBlock(save, 'guardianCharm')).toBe('charmUsed');
    const lost = loseRunBattle(save, { kind: 'guardian', id: 'g-1' });
    expect(lost.charmSaved).toBe(true);
    expect(runOf(lost.save).losses).toBe(0);
    expect(runOf(lost.save).charm).toBe(false);
    expect(runOf(lost.save).cooldown).toBe(DUNGEON_RUN.guardianCooldownSteps);
    expect(itemBlock(lost.save, 'guardianCharm')).toBe('charmUsed');
    const again = loseRunBattle(lost.save, { kind: 'npc', id: 'npc-2' });
    expect(again.charmSaved).toBe(false);
    expect(runOf(again.save).losses).toBe(1);
  });

  it('封印の小箱：手に入れたカードが無いと使えない。3回負けて追い出されても守った1枚だけ残り、道具は減らない', () => {
    let save = inRun({ sealBox: 2, torch: 3 });
    expect(itemBlock(save, 'sealBox')).toBe('noCards');
    save = withGained(withGained(withGained(save, SKILL, 'n1'), SKILL, 'n2'), SKILL2, 'n3');
    save = used(save, 'sealBox', SKILL);
    expect(runOf(save).sealedCard).toBe(SKILL);
    expect(itemBlock(save, 'sealBox')).toBe('sealBoxUsed');
    const start = createNewSave().collection;
    let r = loseRunBattle(save, { kind: 'npc', id: 'a' });
    r = loseRunBattle(r.save, { kind: 'npc', id: 'b' });
    r = loseRunBattle(r.save, { kind: 'npc', id: 'c' });
    expect(r.expelled).toBe(true);
    expect(r.keptCard).toBe(SKILL);
    expect(r.lostCards).toEqual([SKILL, SKILL2]);
    expect(r.save.collection[SKILL]).toBe((start[SKILL] ?? 0) + 1);
    expect(r.save.collection[SKILL2] ?? 0).toBe(start[SKILL2] ?? 0);
    expect(r.save.items).toEqual({ sealBox: 1, torch: 3 });
  });

  it('封印の小箱を使っていなければ、追い出されたら手に入れたカードはすべて失う（いままでどおり）', () => {
    let save = withGained(inRun(), SKILL, 'n1');
    let r = loseRunBattle(save, { kind: 'npc', id: 'a' });
    r = loseRunBattle(r.save, { kind: 'npc', id: 'b' });
    r = loseRunBattle(r.save, { kind: 'npc', id: 'c' });
    expect(r.keptCard).toBeNull();
    expect(r.lostCards).toEqual([SKILL]);
    save = r.save;
    expect(save.collection[SKILL] ?? 0).toBe(createNewSave().collection[SKILL] ?? 0);
  });

  it('幸運のコイン：次の勝ち（バトラー・番人）で別々の2枚から選ぶ。ボスは変わらない。負けても残る。効いている間は重ねて使えない', () => {
    let save = used(inRun({ luckyCoin: 2 }), 'luckyCoin');
    expect(itemBlock(save, 'luckyCoin')).toBe('coinActive');
    save = loseRunBattle(save, { kind: 'npc', id: 'n0' }).save;
    expect(runOf(save).luckyCoin).toBe(true);
    const candidates = rewardCandidates(['mon-soramo', 'mon-lazuck'], skillsOf);
    expect(usesLuckyCoin(runOf(save), 'boss', candidates)).toBe(false);
    expect(usesLuckyCoin(runOf(save), 'guardian', candidates)).toBe(true);
    expect(usesLuckyCoin(runOf(save), 'npc', [SKILL, SKILL])).toBe(false);
    const choices = pickRewardChoices(candidates, 2, () => 0.5);
    expect(new Set(choices).size).toBe(2);
    save = winRunBattleChoosing(save, { kind: 'npc', id: 'n1' }, choices);
    expect(runOf(save).defeated).toContain('n1');
    expect(runOf(save).luckyCoin).toBe(false);
    expect(runOf(save).rewardChoice).toEqual(choices);
    expect(itemBlock(save, 'torch')).toBe('none');
    const pick = choices[1] as string;
    const before = save.collection[pick] ?? 0;
    save = chooseRunReward(save, pick);
    expect(save.collection[pick]).toBe(before + 1);
    expect(runOf(save).gained).toEqual([pick]);
    expect(runOf(save).rewardChoice).toBeNull();
    expect(chooseRunReward(save, pick)).toBe(save);
    expect(itemBlock(save, 'luckyCoin')).toBeNull();
  });

  it('3回負けて追い出されても、持っている道具は失わない', () => {
    let save = inRun({ torch: 2, smokeBall: 4 });
    let r = loseRunBattle(save, { kind: 'npc', id: 'a' });
    r = loseRunBattle(r.save, { kind: 'npc', id: 'b' });
    r = loseRunBattle(r.save, { kind: 'npc', id: 'c' });
    save = r.save;
    expect(r.expelled).toBe(true);
    expect(save.items).toEqual({ torch: 2, smokeBall: 4 });
  });
});
