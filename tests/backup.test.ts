import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  backupFileName,
  createBackup,
  parseBackup,
  serializeBackup,
} from '../src/game/save/backup.ts';
import { addCards, createNewSave, SAVE_VERSION, type SaveData } from '../src/game/save/saveData.ts';
import { BEFORE_RESTORE_KEY, MemoryStorage, SAVE_KEY, type KeyValueStorage } from '../src/game/save/saveRepository.ts';
import { DEFAULT_SETTINGS } from '../src/game/settings/settings.ts';
import { GameStore } from '../src/ui/gameStore.ts';

/** 進めたセーブ（カード・所持金・デッキ・大会・欠片・現在地・ダンジョン） */
function progressedSave(): SaveData {
  const base = addCards(createNewSave(new Date('2026-10-01T00:00:00Z')), [
    { cardId: 'mon-e', count: 1 },
    { cardId: 'skl-e-1', count: 2 },
  ]);
  return {
    ...base,
    coins: 1234,
    rank: 'D',
    unlockedPacks: ['pack-01', 'pack-02'],
    // Eランク大会の初優勝で並ぶ道具（読み込むときに記録から決まる）
    unlockedItems: [...base.unlockedItems, 'ruinsMap', 'luckyCoin'],
    tournaments: { 'tournament-e': { entries: 2, wins: 1, firstWinClaimed: true } },
    claimedEntries: ['entry-1'],
    dungeons: { 'dungeon-01': { openedChests: ['chest-b2-a'], bossDefeated: true, clears: 1 } },
    fragments: ['fragment-01', 'fragment-05'],
    location: { mapId: 'shop', x: 4, y: 6, dir: 'up' },
    processedTransactions: ['purchase-1'],
    stats: { battlesWon: 5, battlesLost: 2, packsOpened: 3 },
  };
}

const text = (save: unknown, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ format: BACKUP_FORMAT, formatVersion: 1, exportedAt: '2026-10-22T00:00:00.000Z', save, ...extra });

describe('セーブのバックアップ（書き出し）', () => {
  it('識別子・version・日時・セーブ・設定だけを持つ', () => {
    const file = createBackup(progressedSave(), DEFAULT_SETTINGS, new Date('2026-10-22T01:02:03Z'));
    expect(Object.keys(file).sort()).toEqual(['exportedAt', 'format', 'formatVersion', 'game', 'save', 'saveVersion', 'settings']);
    expect(file.format).toBe(BACKUP_FORMAT);
    expect(file.saveVersion).toBe(SAVE_VERSION);
    expect(file.exportedAt).toBe('2026-10-22T01:02:03.000Z');
  });

  it('ファイル名に日時が入る', () => {
    expect(backupFileName(new Date(2026, 9, 22, 9, 5))).toBe('mistral-monsters-bc-backup-20261022-0905.json');
  });

  it('書き出し → 読み込みで同じ状態に戻る', () => {
    const save = progressedSave();
    const r = parseBackup(serializeBackup(createBackup(save, { ...DEFAULT_SETTINGS, language: 'en', seVolume: 40 })));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save).toEqual(save);
    expect(r.settings).toEqual({ ...DEFAULT_SETTINGS, language: 'en', seVolume: 40 });
    expect(r.summary).toMatchObject({ coins: 1234, rank: 'D', battlesWon: 5, battlesLost: 2, fragments: 2 });
  });
});

describe('セーブのバックアップ（読み込みの検証）', () => {
  it('壊れた JSON・別のファイル・新しすぎる形式は読まない', () => {
    expect(parseBackup('{broken')).toMatchObject({ ok: false, error: 'notJson' });
    expect(parseBackup(JSON.stringify({ hello: 1 }))).toMatchObject({ ok: false, error: 'notThisGame' });
    expect(parseBackup(JSON.stringify(createNewSave()))).toMatchObject({ ok: false, error: 'notThisGame' });
    expect(parseBackup(text(createNewSave(), { formatVersion: 99 }))).toMatchObject({ ok: false, error: 'formatTooNew' });
    expect(parseBackup('x'.repeat(2_000_000))).toMatchObject({ ok: false, error: 'tooLarge' });
  });

  it('新しいバージョンのセーブは読まない', () => {
    expect(parseBackup(text({ ...createNewSave(), version: SAVE_VERSION + 1 }))).toMatchObject({ ok: false, error: 'saveTooNew' });
  });

  it('知らないカード ID があれば、黙って消さずに止める', () => {
    const save = { ...createNewSave(), collection: { 'mon-a': 1, 'mon-future': 2 } };
    expect(parseBackup(text(save))).toEqual({ ok: false, error: 'unknownCards', details: ['mon-future'] });
    const deck = { ...createNewSave(), deck: { monsters: ['mon-x'], skills: [] } };
    expect(parseBackup(text(deck))).toMatchObject({ ok: false, error: 'unknownCards', details: ['mon-x'] });
  });

  it('ありえない値は読まない', () => {
    expect(parseBackup(text({ ...createNewSave(), coins: -5 }))).toMatchObject({ ok: false, error: 'outOfRange', details: ['coins'] });
    expect(parseBackup(text({ ...createNewSave(), coins: 1.5 }))).toMatchObject({ ok: false, error: 'outOfRange' });
    expect(parseBackup(text({ ...createNewSave(), collection: { 'mon-a': 'many' } }))).toMatchObject({ ok: false, error: 'outOfRange' });
    expect(parseBackup(text({ ...createNewSave(), deck: 'x' }))).toMatchObject({ ok: false, error: 'outOfRange' });
  });

  it('旧形式（version 1）のセーブも読み、いまの形式に直す', () => {
    const v1 = { ...createNewSave(), version: 1 };
    const r = parseBackup(text(v1));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.save.version).toBe(SAVE_VERSION);
  });
});

/** 書き込みだけ失敗する保存先（容量不足のまね） */
class FullStorage extends MemoryStorage {
  full = false;
  override setItem(key: string, value: string): void {
    if (this.full) throw new Error('QuotaExceededError');
    super.setItem(key, value);
  }
}

describe('復元（GameStore.restoreSave）', () => {
  it('いまのセーブを退避してから入れ替える', () => {
    const storage = new MemoryStorage();
    const store = new GameStore(storage);
    store.newGame('male');
    const before = storage.getItem(SAVE_KEY);
    expect(store.restoreSave(progressedSave())).toBe(true);
    expect(storage.getItem(BEFORE_RESTORE_KEY)).toBe(before);
    expect(new GameStore(storage).save.coins).toBe(1234);
  });

  it('書き込めなければ入れ替えず、いまのセーブはそのまま', () => {
    const storage = new FullStorage();
    const store = new GameStore(storage);
    store.newGame('female');
    const before = storage.getItem(SAVE_KEY);
    storage.full = true;
    expect(store.restoreSave(progressedSave())).toBe(false);
    expect(store.save.player.gender).toBe('female');
    expect(storage.getItem(SAVE_KEY)).toBe(before);
  });

  it('保存領域が使えなくてもアプリを初期化しない（例外を出さない）', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const store = new GameStore(broken);
    expect(store.loadResult).toEqual({ status: 'unreadable', reason: 'storage' });
    expect(store.settings.value).toEqual(DEFAULT_SETTINGS);
    expect(() => store.newGame('male')).not.toThrow();
    expect(store.lastSaveOk).toBe(false);
  });

  it('セーブがない状態からでも復元できる', () => {
    const storage = new MemoryStorage();
    const store = new GameStore(storage);
    expect(store.restoreSave(progressedSave())).toBe(true);
    expect(store.hasSave).toBe(true);
    expect(storage.getItem(BEFORE_RESTORE_KEY)).toBeNull();
  });
});
