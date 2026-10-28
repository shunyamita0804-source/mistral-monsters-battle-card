import { cardCatalog } from '../../data/cards.ts';
import type { CardDefinition } from './cardTypes.ts';

/** 取得カードの1行（カードと枚数） */
export interface ReceivedCard {
  readonly card: CardDefinition;
  readonly count: number;
}

/**
 * もらったカード（ID の並び。同じ ID が何回あってもよい）を、取得カードの画面の並びにまとめる（2026-10-28 ユーザー決定）。
 * モンスター（もらった順）→ 技カード（もらったモンスターの順、同じモンスターの中は表示の番号順）→ サポート（ID 順）。
 * 台帳に無い ID は数えない。箱・ダンジョンの勝ち・宝箱・ガチャの結果のどれでも使える
 */
export function receivedCardList(cardIds: readonly string[]): ReceivedCard[] {
  const counts = new Map<string, number>();
  const cards: CardDefinition[] = [];
  for (const id of cardIds) {
    const card = cardCatalog.get(id);
    if (!card) continue;
    if (!counts.has(id)) cards.push(card);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const monsters = cards.filter((c) => c.kind === 'monster');
  const monsterOrder = (id: string): number => {
    const i = monsters.findIndex((m) => m.id === id);
    return i < 0 ? monsters.length : i;
  };
  const skills = cards
    .flatMap((c) => (c.kind === 'skill' ? [c] : []))
    .sort((a, b) => monsterOrder(a.monsterId) - monsterOrder(b.monsterId) || a.monsterId.localeCompare(b.monsterId) || (a.displayNo ?? 99) - (b.displayNo ?? 99) || a.id.localeCompare(b.id));
  const supports = cards.filter((c) => c.kind === 'support').sort((a, b) => a.id.localeCompare(b.id));
  return [...monsters, ...skills, ...supports].map((card) => ({ card, count: counts.get(card.id) ?? 0 }));
}
