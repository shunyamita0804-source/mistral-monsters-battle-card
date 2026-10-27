import { cardBookEntries, sectionKey, type BookEntry } from '../../data/cardNumbers.ts';
import { HIDDEN_MONSTER_ID } from '../../data/cards.ts';

/**
 * カード図鑑（研究所）の見え方の決まり。DOM 非依存（2026-10-27 指示書）。
 * - 未入手：番号と「？？？」の枠だけ。隠しモンスターは復元するまで「？？？」
 * - 完成：モンスター1体分（本体＋そのモンスターの技すべて）を1枚ずつ以上持っている
 */

export type BookFilter = 'all' | 'monster' | 'skill' | 'support';

export function matchesFilter(entry: BookEntry, filter: BookFilter): boolean {
  return filter === 'all' || entry.card.kind === filter;
}

/** 「？？？」で見せるか（持っていない・隠しモンスターを復元していない） */
export function isUnknown(entry: BookEntry, collection: Readonly<Record<string, number>>, hiddenRestored: boolean): boolean {
  if (entry.card.id === HIDDEN_MONSTER_ID && !hiddenRestored) return true;
  return (collection[entry.card.id] ?? 0) <= 0;
}

/** 完成したモンスターの区切り（sectionKey） */
export function completeSections(collection: Readonly<Record<string, number>>, entries: readonly BookEntry[] = cardBookEntries()): Set<string> {
  const groups = new Map<string, BookEntry[]>();
  for (const e of entries) {
    if (e.section.kind !== 'monster') continue;
    const key = sectionKey(e.section);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const done = new Set<string>();
  for (const [key, list] of groups) if (list.every((e) => (collection[e.card.id] ?? 0) > 0)) done.add(key);
  return done;
}
