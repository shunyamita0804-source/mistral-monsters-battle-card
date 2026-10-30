import { describe, expect, it } from 'vitest';
import { validateDeck } from '../src/game/deck/deck.ts';
import { createNewSave, migrate, normalizeSave, SAVE_VERSION, type SaveData } from '../src/game/save/saveData.ts';
import { BACKUP_KEY, MemoryStorage, SAVE_KEY, SaveRepository } from '../src/game/save/saveRepository.ts';

describe('セーブデータ', () => {
  it('新規セーブは初期デッキ・所持金・第1弾パックを持つ', () => {
    const save = createNewSave(new Date('2026-10-22T00:00:00Z'));
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.deck.skills).toHaveLength(60);
    expect(save.coins).toBeGreaterThan(0);
    expect(save.unlockedPacks).toEqual(['pack-01']);
    expect(save.fragments).toEqual([]);
  });

  it('保存して読み込むと同じ内容に戻る（updatedAt を除く）', () => {
    const repo = new SaveRepository(new MemoryStorage());
    const save: SaveData = { ...createNewSave(), coins: 1234, fragments: ['fragment-01'], player: { gender: 'female', name: 'ミレ' } };
    expect(repo.save(save)).toBe(true);
    const result = repo.load();
    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect({ ...result.save, updatedAt: '' }).toEqual({ ...save, updatedAt: '' });
  });

  it('セーブがなければ empty', () => {
    expect(new SaveRepository(new MemoryStorage()).load().status).toBe('empty');
  });

  it('壊れたセーブは退避してから unreadable を返す（消さない）', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{broken');
    const repo = new SaveRepository(storage);
    expect(repo.load().status).toBe('unreadable');
    expect(storage.getItem(BACKUP_KEY)).toBe('{broken');
  });

  it('新しすぎるバージョンのセーブは読まない', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ ...createNewSave(), version: SAVE_VERSION + 1 }));
    expect(new SaveRepository(storage).load().status).toBe('unreadable');
    expect(migrate({ version: 0 })).toBeNull();
  });

  it('version 1 のセーブ（同じカード4枚のデッキ）は、新しいルールで使えるデッキに直り、足りないカードを受け取る', () => {
    // 旧スターター：仮モンスターA〜C の技1〜4・6 を4枚ずつ
    const oldSkills = ['a', 'b', 'c'].flatMap((k) => [1, 2, 3, 4, 6].flatMap((n) => Array<string>(4).fill(`skl-${k}-${n}`)));
    const oldCollection: Record<string, number> = { 'mon-a': 1, 'mon-b': 1, 'mon-c': 1 };
    for (const id of oldSkills) oldCollection[id] = 4;
    const raw = { ...createNewSave(), version: 1, collection: oldCollection, deck: { monsters: ['mon-a', 'mon-b', 'mon-c'], skills: oldSkills } };
    const migrated = migrate(raw);
    expect(migrated?.version).toBe(SAVE_VERSION);
    const save = normalizeSave(raw);
    if (!save) throw new Error('save');
    // version 2 で仮モンスターのデッキに直り、version 6（2026-10-23）でテスト用のソラモのデッキ、version 7 でソラモとラズックのデッキに替わる
    // version 8（2026-10-26）でそのデッキは初期デッキ（createStarterDeck）に替わる。2026-10-30 指示書 V から初期デッキの3体目はプカリム
    expect(save.deck.monsters).toEqual(['mon-soramo', 'mon-lazuck', 'mon-pukarim']);
    expect(validateDeck(save.deck, save.collection)).toEqual([]);
    expect(save.collection['mon-a']).toBe(1);
    // 持っていた枚数は減らさない
    expect(save.collection['skl-a-1']).toBe(4);
    expect(save.collection['skl-a-5']).toBeGreaterThan(0);
    expect(save.collection['sup-1']).toBeGreaterThan(0);
  });

  it('不正な値は既定値に直し、未知のカードは捨てる', () => {
    const raw = {
      ...createNewSave(),
      coins: -50,
      collection: { 'skl-a-1': 2, 'no-such-card': 3, 'skl-a-2': 'x' },
      rank: 'Z',
      unlockedPacks: ['pack-02', 'no-pack'],
      fragments: ['fragment-01', 'fragment-01', 7],
      location: { mapId: 'town', x: 'a', y: 1 },
      processedTransactions: 'x',
    };
    const save = normalizeSave(raw);
    expect(save).not.toBeNull();
    if (!save) return;
    expect(save.coins).toBe(createNewSave().coins);
    expect(save.collection).toEqual({ 'skl-a-1': 2 });
    expect(save.rank).toBe('E');
    expect(save.unlockedPacks).toEqual(['pack-01', 'pack-02']);
    expect(save.fragments).toEqual(['fragment-01']);
    expect(save.location.mapId).toBe('town');
    expect(save.processedTransactions).toEqual([]);
  });

  it('書き込みに失敗しても例外を出さない', () => {
    const repo = new SaveRepository({
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
      removeItem: () => undefined,
    });
    expect(repo.save(createNewSave())).toBe(false);
  });
});
