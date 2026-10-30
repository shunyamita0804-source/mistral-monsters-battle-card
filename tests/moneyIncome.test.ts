import { describe, expect, it } from 'vitest';
import { skillsOf } from '../src/data/cards.ts';
import { getDungeon } from '../src/data/dungeons.ts';
import { runConfig } from '../src/data/dungeonRun.ts';
import { CHEST_RULES, DUNGEON_MONEY, dungeonMoney } from '../src/data/economy.ts';
import { ITEM_RULES } from '../src/data/items.ts';
import {
  bossTrumpSkills,
  loseRunBattle,
  openRunChest,
  rollChest,
  runFloor,
  startRun,
  winRunBattle,
  winRunBattleChoosing,
  type ChestRoll,
} from '../src/game/dungeon/run.ts';
import { createNewSave, type SaveData } from '../src/game/save/saveData.ts';

/**
 * お金の入る側（2026-10-28 ユーザー承認の指示書 design-parts/money-income-20261028/）：
 * ダンジョンの1勝ごとのお金・宝箱の中身・ボスのお金
 */

const DUNGEON_IDS = ['dungeon-01', 'dungeon-02', 'dungeon-03', 'dungeon-08', 'dungeon-04', 'dungeon-05', 'dungeon-06', 'dungeon-07'];

function inRun(dungeonId: string, seed = 777): SaveData {
  return startRun(createNewSave(), dungeonId, seed);
}

describe('ダンジョンごとのお金の表（src/data/economy.ts の DUNGEON_MONEY）', () => {
  it('指示書の表のとおり', () => {
    expect(DUNGEON_MONEY).toEqual({
      // 太古の遺跡：2026-10-29 ジオルの最終で氷の洞窟と同じ段
      'dungeon-01': { win: 25, chest: [25, 50], bossFirst: 600, bossRepeat: 180 },
      'dungeon-02': { win: 15, chest: [15, 30], bossFirst: 300, bossRepeat: 90 },
      'dungeon-03': { win: 20, chest: [20, 40], bossFirst: 500, bossRepeat: 150 },
      'dungeon-04': { win: 25, chest: [25, 50], bossFirst: 600, bossRepeat: 180 },
      'dungeon-05': { win: 30, chest: [30, 60], bossFirst: 700, bossRepeat: 210 },
      'dungeon-06': { win: 35, chest: [35, 70], bossFirst: 850, bossRepeat: 250 },
      'dungeon-07': { win: 40, chest: [40, 80], bossFirst: 1000, bossRepeat: 300 },
      // 風の渓谷（2026-10-30 指示書 U）：水の神殿と同じ段
      'dungeon-08': { win: 20, chest: [20, 40], bossFirst: 500, bossRepeat: 150 },
    });
    expect(CHEST_RULES.rates).toEqual({ coins: 70, item: 25, card: 5 });
    expect(CHEST_RULES.items).toEqual(['torch', 'incense', 'smokeBall', 'returnFeather']);
  });

  it('はじめの所持金 300G は変えていない', () => {
    expect(createNewSave().coins).toBe(300);
  });
});

describe('1勝ごとのお金（バトラー・見えない番人）', () => {
  it('勝ったその場で所持金に入る（ダンジョンごとの値）', () => {
    for (const id of DUNGEON_IDS) {
      const s = inRun(id);
      const npc = winRunBattle(s, { kind: 'npc', id: 'f0-npc-1' }, null);
      expect(npc.coins).toBe(dungeonMoney(id).win);
      expect(npc.save.coins).toBe(s.coins + dungeonMoney(id).win);
      const guardian = winRunBattle(s, { kind: 'guardian', id: 'f0-guardian-1' }, null);
      expect(guardian.save.coins).toBe(s.coins + dungeonMoney(id).win);
    }
  });

  it('幸運のコインで技カードを選ぶ勝ちでも、同じだけ入る', () => {
    const s = inRun('dungeon-03');
    const next = winRunBattleChoosing({ ...s, dungeonRun: s.dungeonRun && { ...s.dungeonRun, luckyCoin: true } }, { kind: 'npc', id: 'f0-npc-1' }, ['a', 'b']);
    expect(next.coins).toBe(s.coins + 20);
    expect(next.dungeonRun?.rewardChoice).toEqual(['a', 'b']);
  });
});

describe('ボスのお金（初回のモンスターカードはそのまま）', () => {
  it('初回と2回目から（ダンジョンごと）', () => {
    for (const id of DUNGEON_IDS) {
      const first = winRunBattle(inRun(id), { kind: 'boss', id: 'boss' }, null);
      expect(first).toMatchObject({ cleared: true, firstClear: true, coins: dungeonMoney(id).bossFirst });
      expect(first.clearCards).toEqual(getDungeon(id)?.firstClearCards ?? []);
      const again = winRunBattle(startRun(first.save, id, 778), { kind: 'boss', id: 'boss' }, null);
      expect(again).toMatchObject({ cleared: true, firstClear: false, coins: dungeonMoney(id).bossRepeat });
      expect(again.save.coins).toBe(first.save.coins + dungeonMoney(id).bossRepeat);
    }
  });
});

describe('宝箱の中身（【仮】お金 70％・道具 25％・技カード 5％）', () => {
  it('たくさん開けると、ほぼ 70 / 25 / 5 になる', () => {
    const n = { coins: 0, item: 0, card: 0 };
    const total = 20000;
    for (let i = 0; i < total; i++) n[rollChest(DUNGEON_IDS[i % 7] as string, 1000 + i, `f${i % 4}-chest-${i % 3}`).kind]++;
    expect(n.coins / total).toBeCloseTo(0.7, 1);
    expect(Math.abs(n.coins / total - 0.7)).toBeLessThan(0.015);
    expect(Math.abs(n.item / total - 0.25)).toBeLessThan(0.015);
    expect(Math.abs(n.card / total - 0.05)).toBeLessThan(0.008);
  });

  it('お金は範囲の中から 5G きざみ（両はしも出る）', () => {
    for (const id of DUNGEON_IDS) {
      const [min, max] = dungeonMoney(id).chest;
      const seen = new Set<number>();
      for (let i = 0; i < 3000; i++) {
        const r = rollChest(id, i, 'f0-chest-1');
        if (r.kind === 'card') continue;
        expect(r.coins).toBeGreaterThanOrEqual(min);
        expect(r.coins).toBeLessThanOrEqual(max);
        expect((r.coins - min) % 5).toBe(0);
        seen.add(r.coins);
      }
      expect(seen.has(min)).toBe(true);
      expect(seen.has(max)).toBe(true);
    }
  });

  it('道具は4つから、技カードはボスの切り札のモンスターの技から', () => {
    const items = new Set<string>();
    const cards = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      const r = rollChest('dungeon-03', i, 'f1-chest-1');
      if (r.kind === 'item') items.add(r.item);
      if (r.kind === 'card') cards.add(r.card);
    }
    expect([...items].sort()).toEqual([...CHEST_RULES.items].sort());
    // 水の神殿の切り札はセレフィーン（2026-10-29 セレフィーンの最終から。前はミュロル）
    const serephineSkills = skillsOf('mon-serephine').map((k) => k.id);
    expect(bossTrumpSkills('dungeon-03')).toEqual(serephineSkills);
    for (const c of cards) expect(serephineSkills).toContain(c);
    // 遺跡のボスの切り札はジオル（2026-10-29 から）、森はフルーネ（2026-10-29 フルーネの最終から）
    expect(bossTrumpSkills('dungeon-01')).toEqual(skillsOf('mon-geol').map((k) => k.id));
    expect(bossTrumpSkills('dungeon-02')).toEqual(skillsOf('mon-flune').map((k) => k.id));
    expect(bossTrumpSkills('dungeon-02')).toHaveLength(14);
  });

  it('同じ挑戦の種と宝箱の ID なら、いつも同じ中身（セーブとロードで選び直せない）', () => {
    for (let i = 0; i < 200; i++) expect(rollChest('dungeon-05', 4242 + i, 'f2-chest-1')).toEqual(rollChest('dungeon-05', 4242 + i, 'f2-chest-1'));
    const kinds = new Set(Array.from({ length: 60 }, (_, i) => JSON.stringify(rollChest('dungeon-05', 4242, `f${i}-chest-1`))));
    expect(kinds.size).toBeGreaterThan(5);
  });
});

/** その中身が出る宝箱の ID を探す */
function chestWith(save: SaveData, kind: ChestRoll['kind']): string {
  const run = save.dungeonRun;
  if (!run) throw new Error('挑戦がない');
  for (let i = 0; i < 500; i++) if (rollChest(run.dungeonId, run.seed, `f0-chest-${i}`).kind === kind) return `f0-chest-${i}`;
  throw new Error(`${kind} の宝箱が見つからない`);
}

describe('宝箱を開けたとき', () => {
  it('お金：所持金に入る', () => {
    const s = inRun('dungeon-04');
    const r = openRunChest(s, chestWith(s, 'coins'));
    expect(r.content?.kind).toBe('coins');
    const got = r.content?.kind === 'coins' ? r.content.coins : 0;
    expect(r.save.coins).toBe(s.coins + got);
  });

  it('道具：持ち物に1つ入る。上限のときはお金に替える', () => {
    const s = inRun('dungeon-04');
    const id = chestWith(s, 'item');
    const r = openRunChest(s, id);
    if (r.content?.kind !== 'item') throw new Error('道具でない');
    expect(r.save.items[r.content.item]).toBe((s.items[r.content.item] ?? 0) + 1);
    expect(r.save.coins).toBe(s.coins);
    const roll = rollChest('dungeon-04', s.dungeonRun?.seed ?? 0, id);
    if (roll.kind !== 'item') throw new Error('道具でない');
    const full = { ...s, items: { ...s.items, [roll.item]: ITEM_RULES.maxOwned } };
    const f = openRunChest(full, id);
    expect(f.content).toEqual({ kind: 'coins', coins: roll.coins, overflowItem: roll.item });
    expect(f.save.coins).toBe(s.coins + roll.coins);
    expect(f.save.items[roll.item]).toBe(ITEM_RULES.maxOwned);
  });

  it('技カード：所持カードとこの挑戦の獲得に入る。3回負けて戻されたら失うが、お金・道具はなくさない', () => {
    let s = inRun('dungeon-03');
    const before = { ...s.collection };
    const coins0 = s.coins;
    const card = openRunChest(s, chestWith(s, 'card'));
    if (card.content?.kind !== 'card') throw new Error('技カードでない');
    const cardId = card.content.card;
    expect(card.save.collection[cardId]).toBe((before[cardId] ?? 0) + 1);
    expect(card.save.dungeonRun?.gained).toEqual([cardId]);
    s = card.save;
    // お金・道具も手に入れておく
    s = openRunChest(s, chestWith(s, 'coins')).save;
    s = openRunChest(s, chestWith(s, 'item')).save;
    s = winRunBattle(s, { kind: 'npc', id: 'f0-npc-1' }, null).save;
    const coins = s.coins;
    const items = { ...s.items };
    expect(coins).toBeGreaterThan(coins0);
    for (let i = 0; i < runConfig('dungeon-03').maxLosses - 1; i++) s = loseRunBattle(s, { kind: 'npc', id: 'f0-npc-2' }).save;
    const out = loseRunBattle(s, { kind: 'npc', id: 'f0-npc-2' });
    expect(out.expelled).toBe(true);
    expect(out.lostCards).toEqual([cardId]);
    expect(out.save.collection).toEqual(before);
    expect(out.save.coins).toBe(coins);
    expect(out.save.items).toEqual(items);
  });

  it('封印の小箱で守った宝箱の技カードは、戻されても失わない', () => {
    let s = inRun('dungeon-03');
    const r = openRunChest(s, chestWith(s, 'card'));
    if (r.content?.kind !== 'card' || !r.save.dungeonRun) throw new Error('技カードでない');
    s = { ...r.save, dungeonRun: { ...r.save.dungeonRun, sealedCard: r.content.card } };
    for (let i = 0; i < runConfig('dungeon-03').maxLosses - 1; i++) s = loseRunBattle(s, { kind: 'npc', id: 'x' }).save;
    const out = loseRunBattle(s, { kind: 'npc', id: 'x' });
    expect(out.keptCard).toBe(r.content.card);
    expect(out.save.collection[r.content.card]).toBe(r.save.collection[r.content.card]);
  });
});

describe('目安：水の神殿を1回まわったとき（ボス2回目）', () => {
  it('バトラー・見えない番人・宝箱をすべて相手にしたときの合計（平均）', () => {
    const money = dungeonMoney('dungeon-03');
    const floors = runConfig('dungeon-03').floors;
    let npcs = 0;
    let guardians = 0;
    let chests = 0;
    let chestCoins = 0;
    const runs = 200;
    for (let seed = 1; seed <= runs; seed++) {
      for (let floor = 0; floor < floors; floor++) {
        const f = runFloor({ seed, floor, dungeonId: 'dungeon-03' });
        npcs += f.entities.filter((e) => e.kind === 'npc').length;
        guardians += f.entities.filter((e) => e.kind === 'guardian').length;
        for (const c of f.entities.filter((e) => e.kind === 'chest')) {
          chests++;
          const r = rollChest('dungeon-03', seed, c.id);
          if (r.kind === 'coins') chestCoins += r.coins;
        }
      }
    }
    const avg = (n: number): number => n / runs;
    const wins = (npcs + guardians) * money.win;
    const total = wins + chestCoins + runs * money.bossRepeat;
    const report = {
      階: floors,
      バトラー: avg(npcs),
      見えない番人: avg(guardians),
      宝箱: avg(chests),
      勝ちのお金: avg(wins),
      宝箱のお金: avg(chestCoins),
      ボス2回目: money.bossRepeat,
      合計: avg(total),
    };
    process.stdout.write(`水の神殿1回の目安 ${JSON.stringify(report)}\n`);
    // 進行の見込み（約500〜600G）から大きく外れていない
    expect(avg(total)).toBeGreaterThan(350);
    expect(avg(total)).toBeLessThan(800);
    // 800階を作るので重い（公開の組み立ての機械では 5 秒を超えることがある。2026-10-30 指示書 W の公開で時間切れ）
  }, 60_000);
});
