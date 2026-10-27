/**
 * 【仮データ】ダンジョンの道具8種（2026-10-27 ユーザー指示書「ダンジョンの道具とショップの『道具を買う』」）。
 * 値段・所持の上限・歩数などの数値はすべて仮で、ここ1か所にまとめる（後から調整できるように）。
 * 名前と説明の英語は src/i18n/contentEn.ts の「item:ID:項目」（仮訳）。
 * ショップに並ぶ時期：最初から（unlockedFromStart）か、大会の初優勝（src/data/tournaments.ts の firstWin.unlockItems。
 * 大会の画面・報酬の画面には出さない）。効き目のルールは src/game/items/items.ts、ダンジョンの中の働きは src/game/dungeon/run.ts
 * 絵はデザイン担当に依頼中（道具のアイコン8つ・煙玉とお守りの演出・効き目の印）。届くまでは仮の見た目（画面に「仮」）
 */

export type ItemId = 'torch' | 'incense' | 'smokeBall' | 'returnFeather' | 'ruinsMap' | 'luckyCoin' | 'sealBox' | 'guardianCharm';

export interface ItemDefinition {
  readonly id: ItemId;
  readonly name: string;
  /** ショップの一覧の短い説明 */
  readonly description: string;
  /** 値段（仮） */
  readonly price: number;
  /** 最初からショップに並ぶか（それ以外は大会の初優勝で並ぶ） */
  readonly unlockedFromStart: boolean;
  /** 仮の見た目の文字（アイコンの絵が届くまで） */
  readonly glyph: string;
}

export const ITEMS: readonly ItemDefinition[] = [
  { id: 'torch', name: 'たいまつ', description: 'その階のあいだ、見える範囲が広がる。', price: 30, unlockedFromStart: true, glyph: '火' },
  { id: 'incense', name: '魔除けの香', description: 'しばらくのあいだ、見えない番人が出なくなる。', price: 50, unlockedFromStart: true, glyph: '香' },
  { id: 'smokeBall', name: '煙玉', description: '見えない番人が現れたとき、戦わずに逃げられる。', price: 60, unlockedFromStart: true, glyph: '煙' },
  { id: 'returnFeather', name: '帰還の羽根', description: '手に入れた技カードを持って、街へ帰る。', price: 80, unlockedFromStart: true, glyph: '羽' },
  { id: 'ruinsMap', name: '遺跡の地図', description: 'その階の通路と部屋の形、階段の場所が地図に出る。', price: 100, unlockedFromStart: false, glyph: '図' },
  { id: 'luckyCoin', name: '幸運のコイン', description: '次に勝ったとき、もらう技カードを2枚から選べる。', price: 120, unlockedFromStart: false, glyph: '貨' },
  { id: 'sealBox', name: '封印の小箱', description: '手に入れた技カード1枚を、追い出されても失わないように守る。', price: 150, unlockedFromStart: false, glyph: '箱' },
  { id: 'guardianCharm', name: '身代わりのお守り', description: '次に負けたとき、負けの回数を1回だけ増やさない。', price: 200, unlockedFromStart: false, glyph: '守' },
];

export const ITEM_IDS: readonly ItemId[] = ITEMS.map((i) => i.id);

export function getItem(id: string): ItemDefinition | undefined {
  return ITEMS.find((i) => i.id === id);
}

export function isItemId(id: string): id is ItemId {
  return (ITEM_IDS as readonly string[]).includes(id);
}

/** 道具のルールの数値（すべて仮） */
export const ITEM_RULES = {
  /** 1種類あたりの所持の上限 */
  maxOwned: 9,
  /** たいまつを使っているときの見える範囲（ふだんは src/data/dungeonRun.ts の viewRadius） */
  torchViewRadius: 2,
  /** 魔除けの香が効く歩数 */
  incenseSteps: 30,
  /** 幸運のコインで選べる候補の数 */
  luckyCoinChoices: 2,
} as const;
