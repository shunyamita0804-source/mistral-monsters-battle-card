import { cardCatalog } from '../../data/cards.ts';
import { normalizeSettings, type GameSettings } from '../settings/settings.ts';
import { normalizeSave, REMOVED_CARD_IDS, SAVE_VERSION, type SaveData } from './saveData.ts';

/**
 * セーブのバックアップ（JSON ファイルへの書き出し・読み込み）。DOM に依存しない部分。
 *
 * - ファイルに入れるのは：ゲームの識別子・形式の version・作った日時・セーブ本体・設定（言語と音量）だけ
 *   （カードの画像・ブラウザの情報・個人情報は入れない。サーバーにも送らない）
 * - 読み込むときは、このゲームのファイルか・JSON として正しいか・version・知らないカードがないか・値の範囲を確かめる。
 *   1つでもおかしければ読み込まない（いまのセーブを上書きしない）
 * - 知らないカード ID があると normalizeSave() が黙って捨ててしまうので、その前に止めて知らせる
 */
/** バックアップの形の名前（前のリポジトリ名のまま。変えると前に書き出したファイルが読めなくなる） */
export const BACKUP_FORMAT = 'sacred-monsters-battle-card/save-backup';
export const BACKUP_FORMAT_VERSION = 1;
/** 読み込むファイルの大きさの上限（これより大きいものはセーブではない） */
export const BACKUP_MAX_BYTES = 1_000_000;

const MAX_COINS = 1_000_000_000;
const MAX_CARD_COUNT = 9_999;

export interface BackupFile {
  readonly format: typeof BACKUP_FORMAT;
  readonly formatVersion: number;
  readonly game: string;
  readonly exportedAt: string;
  readonly saveVersion: number;
  readonly save: SaveData;
  readonly settings?: GameSettings;
}

export function createBackup(save: SaveData, settings: GameSettings | undefined, now: Date = new Date()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    game: 'Mistral Monsters Battle Card',
    exportedAt: now.toISOString(),
    saveVersion: save.version,
    save,
    ...(settings ? { settings } : {}),
  };
}

export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2);
}

/** 保存するファイル名（例：mistral-monsters-bc-backup-20261022-0930.json。2026-10-24 の名称変更で sacred- から。中身の形は同じ） */
export function backupFileName(now: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `mistral-monsters-bc-backup-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

/** 復元の確認画面に出す内容 */
export interface BackupSummary {
  readonly coins: number;
  readonly cards: number;
  readonly kinds: number;
  readonly rank: string;
  readonly battlesWon: number;
  readonly battlesLost: number;
  readonly fragments: number;
  readonly updatedAt: string;
  readonly exportedAt: string | null;
}

export type BackupError =
  | 'tooLarge'
  | 'notJson'
  | 'notThisGame'
  | 'formatTooNew'
  | 'saveTooNew'
  | 'invalidSave'
  | 'unknownCards'
  | 'outOfRange';

export type BackupCheck =
  | { readonly ok: true; readonly save: SaveData; readonly settings: GameSettings | null; readonly summary: BackupSummary }
  | { readonly ok: false; readonly error: BackupError; readonly details: readonly string[] };

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const fail = (error: BackupError, details: readonly string[] = []): BackupCheck => ({ ok: false, error, details });
const isCount = (v: unknown, max: number): boolean => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;

export function summarize(save: SaveData, exportedAt: string | null = null): BackupSummary {
  const counts = Object.values(save.collection);
  return {
    coins: save.coins,
    cards: counts.reduce((a, b) => a + b, 0),
    kinds: counts.filter((n) => n > 0).length,
    rank: save.rank,
    battlesWon: save.stats.battlesWon,
    battlesLost: save.stats.battlesLost,
    fragments: save.fragments.length,
    updatedAt: save.updatedAt,
    exportedAt,
  };
}

/** バックアップファイルの中身を確かめ、読み込めるならセーブにする */
export function parseBackup(text: string): BackupCheck {
  if (text.length > BACKUP_MAX_BYTES) return fail('tooLarge');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('notJson');
  }
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) return fail('notThisGame');
  if (typeof raw.formatVersion !== 'number' || !Number.isInteger(raw.formatVersion) || raw.formatVersion < 1) return fail('notThisGame');
  if (raw.formatVersion > BACKUP_FORMAT_VERSION) return fail('formatTooNew');
  const save = raw.save;
  if (!isObject(save)) return fail('invalidSave');
  if (typeof save.version !== 'number' || !Number.isInteger(save.version) || save.version < 1) return fail('invalidSave');
  if (save.version > SAVE_VERSION) return fail('saveTooNew');

  // 値の範囲（壊れた・書き換えられたファイルを読まない）
  const range: string[] = [];
  if (!isCount(save.coins, MAX_COINS)) range.push('coins');
  if (!isObject(save.collection)) range.push('collection');
  else for (const [id, n] of Object.entries(save.collection)) if (!isCount(n, MAX_CARD_COUNT)) range.push(`collection.${id}`);
  const deck = save.deck;
  const deckIds: unknown[] = isObject(deck) ? [...asArray(deck.monsters), ...asArray(deck.skills)] : [];
  if (!isObject(deck) || !Array.isArray(deck.monsters) || !Array.isArray(deck.skills) || deckIds.some((x) => typeof x !== 'string')) {
    range.push('deck');
  }
  if (range.length > 0) return fail('outOfRange', range);

  // 知らないカード（このバージョンにないカード）があれば、黙って消さずに止める
  const ids = new Set<string>([...Object.keys(save.collection as Raw), ...(deckIds as string[])]);
  // ゲームから削除したカード（REMOVED_CARD_IDS）は、読み込み時の変換で外すので止めない
  const unknown = [...ids].filter((id) => cardCatalog.get(id) === undefined && !REMOVED_CARD_IDS.includes(id)).sort();
  if (unknown.length > 0) return fail('unknownCards', unknown);

  const normalized = normalizeSave(save);
  if (!normalized) return fail('invalidSave');
  const exportedAt = typeof raw.exportedAt === 'string' ? raw.exportedAt : null;
  return {
    ok: true,
    save: normalized,
    settings: isObject(raw.settings) ? normalizeSettings(raw.settings) : null,
    summary: summarize(normalized, exportedAt),
  };
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
