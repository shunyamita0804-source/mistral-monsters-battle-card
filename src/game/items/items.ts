import { getItem, ITEM_RULES, type ItemId } from '../../data/items.ts';
import { hasProcessed, markProcessed, type DungeonRun, type SaveData } from '../save/saveData.ts';

/**
 * ダンジョンの道具（2026-10-27 ユーザー指示書「ダンジョンの道具とショップの『道具を買う』」）。DOM に依存しない純粋関数。
 * - ショップで買う（数を選ぶ → 確認 → 購入。1回の操作で1回だけ処理）
 * - ダンジョンの中で使う（メニューの「道具」から。煙玉だけは見えない番人が現れたときの窓。src/game/dungeon/run.ts の escapeGuardian）
 * 数値は src/data/items.ts（すべて仮）
 */

export function itemCount(save: SaveData, id: ItemId): number {
  return save.items[id] ?? 0;
}

function setItemCount(save: SaveData, id: ItemId, n: number): SaveData {
  const items = { ...save.items };
  if (n > 0) items[id] = Math.min(n, ITEM_RULES.maxOwned);
  else delete items[id];
  return { ...save, items };
}

/** 道具を1つ足せるか（所持の上限 ITEM_RULES.maxOwned より少ない） */
export function canAddItem(save: SaveData, id: ItemId): boolean {
  return itemCount(save, id) < ITEM_RULES.maxOwned;
}

/** 道具を1つ足す（宝箱など。上限のときはそのまま） */
export function addItem(save: SaveData, id: ItemId): SaveData {
  return canAddItem(save, id) ? setItemCount(save, id, itemCount(save, id) + 1) : save;
}

/** 道具を1つ減らす（持っていなければそのまま） */
export function consumeItem(save: SaveData, id: ItemId): SaveData {
  const n = itemCount(save, id);
  return n > 0 ? setItemCount(save, id, n - 1) : save;
}

/** ショップに並んでいるか */
export function isItemUnlocked(save: SaveData, id: ItemId): boolean {
  return save.unlockedItems.includes(id);
}

/** 「NEW」の印を出すか（大会の初優勝で新しく並んだ道具を、ショップで最初に見るときだけ。最初から並ぶ道具は出さない） */
export function isNewItem(save: SaveData, id: ItemId): boolean {
  const item = getItem(id);
  return !!item && !item.unlockedFromStart && isItemUnlocked(save, id) && !save.seenItems.includes(id);
}

/** ショップの一覧を見た：並んでいる道具の NEW を消す */
export function markItemsSeen(save: SaveData): SaveData {
  const fresh = save.unlockedItems.filter((id) => !save.seenItems.includes(id));
  return fresh.length > 0 ? { ...save, seenItems: [...save.seenItems, ...fresh] } : save;
}

/** あと何個買えるか（所持の上限まで） */
export function buyableCount(save: SaveData, id: ItemId): number {
  return Math.max(0, ITEM_RULES.maxOwned - itemCount(save, id));
}

export type ItemPurchaseResult =
  | { readonly status: 'ok'; readonly save: SaveData }
  | { readonly status: 'duplicate'; readonly save: SaveData }
  | { readonly status: 'error'; readonly reason: 'locked' | 'count' | 'limit' | 'coins'; readonly save: SaveData };

/** 道具を買う（tx は購入の確認を開いたときに作る ID。同じ ID は1回だけ処理） */
export function purchaseItem(save: SaveData, id: ItemId, count: number, tx: string): ItemPurchaseResult {
  if (hasProcessed(save, tx)) return { status: 'duplicate', save };
  const item = getItem(id);
  if (!item || !isItemUnlocked(save, id)) return { status: 'error', reason: 'locked', save };
  if (!Number.isInteger(count) || count < 1) return { status: 'error', reason: 'count', save };
  if (count > buyableCount(save, id)) return { status: 'error', reason: 'limit', save };
  const price = item.price * count;
  if (save.coins < price) return { status: 'error', reason: 'coins', save };
  const next = setItemCount({ ...save, coins: save.coins - price }, id, itemCount(save, id) + count);
  return { status: 'ok', save: markProcessed(next, tx) };
}

/* ---------- ダンジョンの中で使う ---------- */

/** 使えない理由（画面の文字のキーの一部） */
export type ItemBlock = 'none' | 'noRun' | 'torchActive' | 'mapActive' | 'coinActive' | 'charmUsed' | 'sealBoxUsed' | 'noCards' | 'guardianOnly' | 'choosing';

/** いま使えるか（使えなければ理由） */
export function itemBlock(save: SaveData, id: ItemId): ItemBlock | null {
  if (itemCount(save, id) <= 0) return 'none';
  const run = save.dungeonRun;
  if (!run) return 'noRun';
  if (run.rewardChoice) return 'choosing';
  switch (id) {
    case 'torch':
      return run.torchFloor === run.floor ? 'torchActive' : null;
    case 'ruinsMap':
      return run.mapFloor === run.floor ? 'mapActive' : null;
    case 'luckyCoin':
      return run.luckyCoin ? 'coinActive' : null;
    case 'guardianCharm':
      return run.charmUsed ? 'charmUsed' : null;
    case 'sealBox':
      return run.sealBoxUsed ? 'sealBoxUsed' : run.gained.length === 0 ? 'noCards' : null;
    case 'smokeBall':
      return 'guardianOnly';
    case 'incense':
    case 'returnFeather':
      return null;
  }
}

export type UseItemResult =
  | { readonly status: 'ok'; readonly save: SaveData; /** 帰還の羽根で挑戦を終えて街へ帰った */ readonly returned: boolean }
  | { readonly status: 'blocked'; readonly reason: ItemBlock; readonly save: SaveData };

/**
 * ダンジョンの中で道具を使う（煙玉は使えない。src/game/dungeon/run.ts の escapeGuardian）。
 * sealCard は封印の小箱で守る技カード（この挑戦で手に入れたカードのどれか）
 */
export function useItem(save: SaveData, id: ItemId, sealCard?: string): UseItemResult {
  const block = itemBlock(save, id);
  if (block) return { status: 'blocked', reason: block, save };
  const run = save.dungeonRun as DungeonRun;
  const spent = consumeItem(save, id);
  const withRun = (patch: Partial<DungeonRun>): UseItemResult => ({ status: 'ok', save: { ...spent, dungeonRun: { ...run, ...patch } }, returned: false });
  switch (id) {
    case 'torch':
      return withRun({ torchFloor: run.floor });
    case 'ruinsMap':
      return withRun({ mapFloor: run.floor });
    case 'incense':
      // 効いている間にもう1つ使うと、残りを決まった歩数に戻す（足し算しない）
      return withRun({ incenseSteps: ITEM_RULES.incenseSteps });
    case 'luckyCoin':
      return withRun({ luckyCoin: true });
    case 'guardianCharm':
      return withRun({ charm: true, charmUsed: true });
    case 'sealBox':
      if (!sealCard || !run.gained.includes(sealCard)) return { status: 'blocked', reason: 'noCards', save };
      return withRun({ sealBoxUsed: true, sealedCard: sealCard });
    case 'returnFeather':
      // 挑戦を終えて街の入り口へ（位置は入る前の街の入り口のまま）。手に入れた技カードは勝ったときに所持へ入っているので、そのまま持ち帰る。クリアの報酬はない
      return { status: 'ok', save: { ...spent, dungeonRun: null }, returned: true };
    case 'smokeBall':
      return { status: 'blocked', reason: 'guardianOnly', save };
  }
}
