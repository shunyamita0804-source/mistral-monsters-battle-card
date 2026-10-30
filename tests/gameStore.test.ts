import { describe, expect, it } from 'vitest';
import { createNewSave } from '../src/game/save/saveData.ts';
import { MemoryStorage, SAVE_KEY } from '../src/game/save/saveRepository.ts';
import { GameStore, once } from '../src/ui/gameStore.ts';

describe('GameStore（セーブの一元管理）', () => {
  it('新しく始めると主人公（男女と名前）を記録して保存する', () => {
    const storage = new MemoryStorage();
    const store = new GameStore(storage);
    expect(store.hasSave).toBe(false);
    store.newGame('female', 'ミレ');
    expect(store.save.player).toEqual({ gender: 'female', name: 'ミレ' });
    expect(JSON.parse(storage.getItem(SAVE_KEY) ?? '{}').player).toEqual({ gender: 'female', name: 'ミレ' });
    expect(new GameStore(storage).save.player.name).toBe('ミレ');
  });

  it('update のたびに保存され、作り直しても同じ内容を読める', () => {
    const storage = new MemoryStorage();
    const store = new GameStore(storage);
    store.newGame('male', 'テスト');
    store.update((s) => ({ ...s, coins: 999 }));
    expect(new GameStore(storage).save.coins).toBe(999);
  });

  it('月が変わる演出：読み込んだとき・最初から始めたときは出さず、月が進んだら1回だけ出す（2026-10-30 指示書 R2）', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ ...createNewSave(), calendar: { year: 1, month: 8 } }));
    const store = new GameStore(storage);
    expect(store.pendingMonthChange()).toBeNull();
    store.update((s) => ({ ...s, calendar: { year: 1, month: 9 } }));
    expect(store.pendingMonthChange()).toEqual({ from: { year: 1, month: 8 }, to: { year: 1, month: 9 } });
    store.markMonthShown();
    expect(store.pendingMonthChange()).toBeNull();
    store.newGame('male', 'テスト');
    expect(store.pendingMonthChange()).toBeNull();
  });

  it('矛盾した位置のセーブは読み込み時に家へ戻す', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ ...createNewSave(), location: { mapId: 'dungeon-01-b3', x: 6, y: 14, dir: 'up' } }));
    expect(new GameStore(storage).save.location.mapId).toBe('home');
  });

  it('once：2回目以降の呼び出しは無視（二重タップ防止）', () => {
    let n = 0;
    const f = once(() => n++);
    f();
    f();
    expect(n).toBe(1);
  });
});
