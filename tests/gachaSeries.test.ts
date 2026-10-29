import { describe, expect, it } from 'vitest';
import { skillsOf } from '../src/data/cards.ts';
import { availableGachaSeries, GACHA, GACHA_SERIES } from '../src/data/economy.ts';
import {
  canReselectSeries,
  drawSeriesPack,
  purchaseSeriesPack,
  seriesLineup,
  seriesOwned,
  tierOf,
} from '../src/game/economy/gachaSeries.ts';
import { createNewSave } from '../src/game/save/saveData.ts';
import { PETE_BEATEN_FLAG } from '../src/game/story/pete.ts';

const SORAMO = GACHA_SERIES.find((s) => s.id === 'soramo');
if (!SORAMO) throw new Error('soramo');

describe('ガチャのシリーズ（2026-10-28）', () => {
  it('9シリーズ（2026-10-29 にプカリム、夜にジオル、深夜にフルーネ）。どれも 150G・5枚', () => {
    expect(GACHA_SERIES.map((s) => s.id)).toEqual(['soramo', 'gauul', 'lazuck', 'nobiton', 'myurol', 'kalshell', 'pukarim', 'geol', 'flune']);
    expect(GACHA.price).toBe(150);
    expect(GACHA.cardsPerPack).toBe(5);
  });

  it('中身はそのモンスターの技14種＋モンスターカード＝15枠。レア枠の名前はすべて今のデータにある', () => {
    for (const series of GACHA_SERIES) {
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
    };
    for (const s of GACHA_SERIES) expect(names(s.id).sort(), s.id).toEqual([...(want[s.id] ?? [])].sort());
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

  it('プカリムはピートに勝ったあと（記録 pete-beaten）だけ並び、買える。レア枠は 7 ぷはーっ・8 おおつむじ・14 ぷかぷか', () => {
    const before = { ...createNewSave(), coins: 150 };
    expect(availableGachaSeries(before.storyFlags).map((s) => s.id)).not.toContain('pukarim');
    expect(purchaseSeriesPack(before, 'pukarim', 'tx-p', 3).status).toBe('error');
    const after = { ...before, storyFlags: [PETE_BEATEN_FLAG] };
    expect(availableGachaSeries(after.storyFlags).map((s) => s.id)).toContain('pukarim');
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
