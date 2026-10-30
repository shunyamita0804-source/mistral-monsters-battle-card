import { describe, expect, it } from 'vitest';
import { skillsOf } from '../src/data/cards.ts';
import { GACHA, GACHA_SERIES, gachaSeenFlag } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import {
  availableGachaSeriesFor,
  canReselectSeries,
  isNewGachaSeries,
  drawSeriesPack,
  markGachaSeriesSeen,
  purchaseSeriesPack,
  seriesLineup,
  seriesOwned,
  startingGachaMonsters,
  tierOf,
} from '../src/game/economy/gachaSeries.ts';
import { addCards, createNewGameSave, createNewSave, normalizeSave, SAVE_VERSION, type SaveData } from '../src/game/save/saveData.ts';
import { PETE_BEATEN_FLAG, winPete } from '../src/game/story/pete.ts';

/**
 * プカリムのカードを持っていない createNewSave（2026-10-30 指示書 V で仮の編成 TEST_TEAM の3体目がプカリムになり、
 * createNewSave の手持ちにプカリムが入るようになったため。「最初から」の本当のセーブ createNewGameSave はカードを持たない）
 */
const newSaveWithoutPukarim = (): SaveData => {
  const s = createNewSave();
  const { 'mon-pukarim': _p, ...collection } = s.collection;
  return { ...s, collection };
};

const SORAMO = GACHA_SERIES.find((s) => s.id === 'soramo');
if (!SORAMO) throw new Error('soramo');

describe('ガチャのシリーズ（2026-10-28）', () => {
  it('14シリーズ（2026-10-29 にプカリム、夜にジオル、深夜にフルーネ・セレフィーン。2026-10-30 にツムジ・ヒョウズク・道具のパック。2026-10-31 にシシエン）。どれも 150G・5枚', () => {
    expect(GACHA_SERIES.map((s) => s.id)).toEqual(['soramo', 'gauul', 'lazuck', 'nobiton', 'myurol', 'kalshell', 'pukarim', 'geol', 'flune', 'serephine', 'tsumuji', 'hyouzuku', 'shishien', 'tools']);
    expect(GACHA.price).toBe(150);
    expect(GACHA.cardsPerPack).toBe(5);
  });

  it('中身はそのモンスターの技14種＋モンスターカード＝15枠。レア枠の名前はすべて今のデータにある', () => {
    for (const series of GACHA_SERIES.filter((s) => !s.cardIds)) {
      const lineup = seriesLineup(series);
      expect(lineup.errors).toEqual([]);
      expect(lineup.skillIds).toHaveLength(14);
      expect(lineup.all).toHaveLength(15);
      expect(lineup.rareIds).toHaveLength(series.rareSkillNames.length);
      expect(lineup.skillIds).toEqual(skillsOf(series.monsterId).map((s) => s.id));
    }
  });

  it('レア枠はユーザー決定の技', () => {
    const names = (id: string): string[] => {
      const series = GACHA_SERIES.find((s) => s.id === id);
      if (!series) throw new Error(id);
      const lineup = seriesLineup(series);
      return skillsOf(series.monsterId).filter((s) => lineup.rareIds.includes(s.id)).map((s) => s.name);
    };
    // 2026-10-29 夜：「いちばん大きい攻撃はレア」を足し、どのモンスターもレア3つ
    const want: Record<string, string[]> = {
      soramo: ['ソラモビーム', 'スターフォール', '星影ステップ'],
      gauul: ['スパイラルダイブ', '聖なる炎', '高速飛行'],
      lazuck: ['とびかかり', 'シャドウバースト', 'フェイントステップ'],
      nobiton: ['まきつく', 'ギガントノーズ', 'ダウナーミスト'],
      myurol: ['アクアテール', 'スリップガード', 'すべってよける'],
      kalshell: ['シェルブレイカー', 'タイダルクラッシュ', 'てっぺきシェル'],
      pukarim: ['ぷはーっ', 'おおつむじ', 'ぷかぷか'],
      geol: ['ナックル', 'グランドハンマー', 'うけとめる'],
      flune: ['はなびらストーム', 'フラワードレイン', 'いやしのみつ'],
      serephine: ['アクアニードル', 'オーシャンウェーブ', 'ウェーブダンス'],
      tsumuji: ['かまいたち', 'ストームブレイド', 'かぜよみ'],
      hyouzuku: ['ふぶき', 'ひょうが', 'おとなきはばたき'],
      shishien: ['れんごくのとっしん', 'ほのおのほうこう', 'かげろう'],
    };
    for (const s of GACHA_SERIES.filter((x) => !x.cardIds)) expect(names(s.id).sort(), s.id).toEqual([...(want[s.id] ?? [])].sort());
  });

  it('1パック5枚。シリーズのカードだけが出て、開ける順はノーマル → レア → モンスター', () => {
    for (const series of GACHA_SERIES) {
      const lineup = seriesLineup(series);
      let seed = 7;
      for (let i = 0; i < 400; i++) {
        const r = drawSeriesPack(series, seed);
        seed = r.seed;
        expect(r.cards).toHaveLength(5);
        for (const c of r.cards) expect(lineup.all).toContain(c);
        const order = r.cards.map((c) => ({ normal: 0, rare: 1, monster: 2 })[tierOf(lineup, c)]);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(r.cards.filter((c) => c === series.monsterId).length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('1万回で、モンスターカードは約5％のパックに出て、レア1種はノーマル1種の約4分の1', () => {
    const lineup = seriesLineup(SORAMO);
    const counts = new Map<string, number>();
    let monsterPacks = 0;
    let seed = 20261028;
    const N = 10000;
    for (let i = 0; i < N; i++) {
      const r = drawSeriesPack(SORAMO, seed);
      seed = r.seed;
      if (r.cards.includes(lineup.monsterId)) monsterPacks += 1;
      for (const c of r.cards) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    expect(monsterPacks / N).toBeGreaterThan(0.04);
    expect(monsterPacks / N).toBeLessThan(0.06);
    const avg = (ids: readonly string[]): number => ids.reduce((s, id) => s + (counts.get(id) ?? 0), 0) / ids.length;
    const normals = lineup.skillIds.filter((id) => !lineup.rareIds.includes(id));
    const ratio = avg(lineup.rareIds) / avg(normals);
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(0.3);
  });

  it('買うと 150G 減り、5枚が所持に入る。4枚目からもそのまま持つ', () => {
    let save = { ...createNewSave(), coins: 2000 };
    const r = purchaseSeriesPack(save, 'soramo', 'tx-1', 123);
    if (r.status !== 'ok') throw new Error(r.status);
    expect(r.save.coins).toBe(1850);
    expect(r.save.stats.packsOpened).toBe(save.stats.packsOpened + 1);
    expect(r.cards).toHaveLength(5);
    for (const id of new Set(r.cards)) {
      expect(r.save.collection[id] ?? 0).toBe((save.collection[id] ?? 0) + r.cards.filter((c) => c === id).length);
    }
    // 同じカードを何枚でも持てる（お金にかえない）
    save = { ...save, collection: { ...save.collection, [r.cards[0] ?? '']: 9 } };
    const r2 = purchaseSeriesPack(save, 'soramo', 'tx-1b', 123);
    if (r2.status !== 'ok') throw new Error(r2.status);
    expect(r2.save.collection[r.cards[0] ?? '']).toBeGreaterThan(9);
    expect(r2.save.coins).toBe(1850);
  });

  it('同じ購入 ID で2回呼んでも1回しか払わない（連打で二重に払わない）', () => {
    const save = { ...createNewSave(), coins: 1000 };
    const r1 = purchaseSeriesPack(save, 'gauul', 'tx-dup', 5);
    if (r1.status !== 'ok') throw new Error(r1.status);
    const r2 = purchaseSeriesPack(r1.save, 'gauul', 'tx-dup', 5);
    expect(r2.status).toBe('duplicate');
    expect(r2.save.coins).toBe(850);
  });

  it('お金が足りないときは買えない', () => {
    const save = { ...createNewSave(), coins: 149 };
    const r = purchaseSeriesPack(save, 'soramo', 'tx-poor', 1);
    expect(r.status).toBe('error');
    expect(r.save.coins).toBe(149);
  });

  it('プカリム・ジオル・フルーネ以外は最初から選べる（新しいセーブでも買える）', () => {
    for (const series of GACHA_SERIES.filter((s) => !s.unlockFlag)) {
      const r = purchaseSeriesPack({ ...createNewSave(), coins: 150 }, series.id, `tx-${series.id}`, 3);
      expect(r.status).toBe('ok');
    }
  });

  it('プカリムはモンスターカード（ピートに勝つと受け取る）を手に入れたあとだけ並び、買える。レア枠は 7 ぷはーっ・8 おおつむじ・14 ぷかぷか', () => {
    const before = { ...newSaveWithoutPukarim(), coins: 150 };
    expect(availableGachaSeriesFor(before).map((s) => s.id)).not.toContain('pukarim');
    expect(purchaseSeriesPack(before, 'pukarim', 'tx-p', 3).status).toBe('error');
    // ピートに勝った記録だけ（カードなし）では並ばない（2026-10-30 指示書 K）
    expect(availableGachaSeriesFor({ ...before, storyFlags: [PETE_BEATEN_FLAG] }).map((s) => s.id)).not.toContain('pukarim');
    const after = addCards(before, [{ cardId: 'mon-pukarim', count: 1 }]);
    expect(availableGachaSeriesFor(after).map((s) => s.id)).toContain('pukarim');
    expect(purchaseSeriesPack(after, 'pukarim', 'tx-p', 3).status).toBe('ok');
    const pukarim = GACHA_SERIES.find((s) => s.id === 'pukarim');
    if (!pukarim) throw new Error('pukarim');
    expect(seriesLineup(pukarim).rareIds).toEqual(['skl-pukarim-07', 'skl-pukarim-08', 'skl-pukarim-14']);
  });

  it('「パックを選び直す」は払う前だけ', () => {
    expect(canReselectSeries(false)).toBe(true);
    expect(canReselectSeries(true)).toBe(false);
  });

  it('そろった数：15枠のうち持っている種類', () => {
    const lineup = seriesLineup(SORAMO);
    const save = { ...createNewSave(), collection: {} as Record<string, number> };
    expect(seriesOwned(save, SORAMO)).toEqual({ owned: 0, total: 15 });
    const some = { ...save, collection: { [lineup.skillIds[0] ?? '']: 3, [lineup.monsterId]: 1 } };
    expect(seriesOwned(some, SORAMO)).toEqual({ owned: 2, total: 15 });
  });
});

/** 管理局で箱を選んだセーブ（新しく始めた人） */
function boxSave(key: 'booster-1' | 'booster-2' | 'booster-3'): SaveData {
  const base = createNewGameSave();
  const box = BOOSTERS.find((b) => b.key === key);
  if (!box) throw new Error(key);
  const withCards = addCards(base, box.monsters.map((cardId) => ({ cardId, count: 1 })));
  return { ...withCards, coins: 1000, story: { ...withCards.story, introV2: { ...withCards.story.introV2, state: 'completed', selectedBoosterKey: key, boosterClaimed: true } } };
}
const ids = (save: SaveData): string[] => availableGachaSeriesFor(save).map((s) => s.id);
const series = (id: string) => {
  const g = GACHA_SERIES.find((x) => x.id === id);
  if (!g) throw new Error(id);
  return g;
};

describe('シリーズの開く条件（2026-10-30 指示書 K。ユーザー決定）', () => {
  it('最初から並ぶのは、管理局で選んだ箱の3体のシリーズだけ', () => {
    expect(ids(boxSave('booster-1'))).toEqual(['soramo', 'gauul', 'myurol', 'tools']);
    expect(ids(boxSave('booster-2'))).toEqual(['gauul', 'lazuck', 'nobiton', 'tools']);
    expect(ids(boxSave('booster-3'))).toEqual(['nobiton', 'myurol', 'kalshell', 'tools']);
    // 箱の3体には NEW を出さない
    const s = boxSave('booster-1');
    for (const g of availableGachaSeriesFor(s)) expect(isNewGachaSeries(s, g)).toBe(false);
  });

  it('並んでいないシリーズは買えない（箱の外のモンスター）', () => {
    expect(purchaseSeriesPack(boxSave('booster-1'), 'kalshell', 'tx-k', 1).status).toBe('error');
    expect(purchaseSeriesPack(boxSave('booster-1'), 'soramo', 'tx-s', 1).status).toBe('ok');
  });

  it('そのモンスターのモンスターカードを初めて手に入れたら開き、NEW が出る（ショップで箱を買った・ボスから受け取った など）', () => {
    const s = addCards(boxSave('booster-1'), [{ cardId: 'mon-kalshell', count: 1 }, { cardId: 'mon-geol', count: 1 }]);
    expect(ids(s)).toEqual(['soramo', 'gauul', 'myurol', 'kalshell', 'geol', 'tools']);
    expect(isNewGachaSeries(s, series('kalshell'))).toBe(true);
    expect(isNewGachaSeries(s, series('geol'))).toBe(true);
    // 技カードだけでは開かない
    const skill = addCards(boxSave('booster-1'), [{ cardId: 'skl-kalshell-01', count: 1 }]);
    expect(ids(skill)).not.toContain('kalshell');
  });

  it('ピートに勝つ（プカリムのカードを受け取る）とプカリムのシリーズが開き、NEW。一度選ぶと NEW は消える', () => {
    const won = winPete(boxSave('booster-2'), 'tx-pete', () => 0.1).save;
    expect(ids(won)).toContain('pukarim');
    expect(isNewGachaSeries(won, series('pukarim'))).toBe(true);
    const seen = markGachaSeriesSeen(won, series('pukarim'));
    expect(isNewGachaSeries(seen, series('pukarim'))).toBe(false);
    expect(ids(seen)).toContain('pukarim');
  });

  it('一度開いた（選んだ）シリーズは、カードがなくても閉じない', () => {
    const s = { ...boxSave('booster-1'), storyFlags: [gachaSeenFlag('flune')] };
    expect(ids(s)).toContain('flune');
    expect(isNewGachaSeries(s, series('flune'))).toBe(false);
  });

  it('チュートリアルをスキップした（箱を選んでいない）セーブは、今のまま6つ並ぶ', () => {
    const skipped = { ...createNewGameSave(), story: { ...createNewGameSave().story, introV2: { ...createNewGameSave().story.introV2, state: 'skipped' as const } } };
    expect(startingGachaMonsters(skipped)).toHaveLength(6);
    expect(ids(skipped)).toEqual(['soramo', 'gauul', 'lazuck', 'nobiton', 'myurol', 'kalshell', 'tools']);
    for (const g of availableGachaSeriesFor(skipped)) expect(isNewGachaSeries(skipped, g)).toBe(false);
  });

  it('前のセーブ（v27）で、もう並んでいるシリーズは閉じない・NEW も出さない（箱を選んだセーブでも6つのまま）', () => {
    const box = boxSave('booster-1');
    const old = { ...box, version: 27, storyFlags: [PETE_BEATEN_FLAG] };
    const s = normalizeSave(JSON.parse(JSON.stringify(old)));
    if (!s) throw new Error('load');
    expect(s.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(28);
    expect(ids(s)).toEqual(['soramo', 'gauul', 'lazuck', 'nobiton', 'myurol', 'kalshell', 'pukarim', 'tools']);
    for (const g of GACHA_SERIES) expect(isNewGachaSeries(s, g)).toBe(false);
  });
});

describe('新しく並んだシリーズの NEW の印（2026-10-29 夜）', () => {
  const PUKARIM = GACHA_SERIES.find((s) => s.id === 'pukarim');
  if (!PUKARIM) throw new Error('pukarim');

  it('並んだばかりのシリーズだけ NEW。最初から並ぶシリーズ・まだ並ばないシリーズには出さない', () => {
    const base = newSaveWithoutPukarim();
    expect(isNewGachaSeries(addCards(base, [{ cardId: 'mon-pukarim', count: 1 }]), PUKARIM)).toBe(true);
    expect(isNewGachaSeries(base, PUKARIM)).toBe(false);
    expect(isNewGachaSeries(addCards(base, [{ cardId: 'mon-pukarim', count: 1 }]), SORAMO)).toBe(false);
  });

  it('一度選ぶと消える（記録は1回だけ付く）', () => {
    const save = addCards({ ...createNewSave(), storyFlags: [PETE_BEATEN_FLAG] }, [{ cardId: 'mon-pukarim', count: 1 }]);
    const seen = markGachaSeriesSeen(save, PUKARIM);
    expect(seen.storyFlags).toEqual([PETE_BEATEN_FLAG, gachaSeenFlag('pukarim')]);
    expect(isNewGachaSeries(seen, PUKARIM)).toBe(false);
    expect(markGachaSeriesSeen(seen, PUKARIM)).toBe(seen);
  });

  it('前のセーブ（v26）で、もう並んでいるシリーズは選んだことにする（ボスのダンジョンのクリアで並ぶものも）', () => {
    const base = createNewSave();
    const old = {
      ...base,
      version: 26,
      storyFlags: [PETE_BEATEN_FLAG],
      dungeons: { ...base.dungeons, 'dungeon-03': { ...(base.dungeons['dungeon-03'] ?? {}), bossDefeated: true } },
    };
    const s = normalizeSave(JSON.parse(JSON.stringify(old)));
    if (!s) throw new Error('load');
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.storyFlags).toContain(gachaSeenFlag('pukarim'));
    expect(s.storyFlags).toContain(gachaSeenFlag('serephine'));
    expect(s.storyFlags).not.toContain(gachaSeenFlag('geol'));
    expect(s.storyFlags).not.toContain(gachaSeenFlag('flune'));
    for (const g of GACHA_SERIES) expect(isNewGachaSeries(s, g)).toBe(false);
  });
});
