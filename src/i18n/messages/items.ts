import type { MessageEntry } from '../i18n.ts';

/**
 * ダンジョンの道具（2026-10-27 ユーザー指示書「ダンジョンの道具とショップの『道具を買う』」）。
 * ショップの「道具を買う」（src/ui/screens/itemShopScreen.ts）と、ダンジョンの中で使う窓（src/ui/screens/dungeonRunScreen.ts）。
 * 道具の名前・説明は src/i18n/contentEn.ts の「item:ID:項目」。英語は仮訳
 */
export const ITEMS_MESSAGES = {
  // ショップ
  'items.shopButton': { ja: '道具を買う', en: 'Buy Items' },
  'items.title': { ja: '道具を買う', en: 'Buy Items' },
  'items.greeting': { ja: 'ダンジョンで役に立つ道具です。（値段は仮）', en: 'Handy items for the dungeon. (Prices are temporary)' },
  'items.price': { ja: '{price}G', en: '{price}G' },
  'items.owned': { ja: '所持 {n}/{max}', en: 'Owned {n}/{max}' },
  'items.new': { ja: 'NEW', en: 'NEW' },
  'items.buy': { ja: '買う', en: 'Buy' },
  'items.full': { ja: '上限', en: 'Full' },
  'items.howMany': { ja: '何個買いますか？', en: 'How many?' },
  'items.count': { ja: '{n}個', en: '×{n}' },
  'items.less': { ja: '1個減らす', en: 'One less' },
  'items.more': { ja: '1個増やす', en: 'One more' },
  'items.total': { ja: '合計 {price}G', en: 'Total {price}G' },
  'items.next': { ja: '次へ', en: 'Next' },
  'items.confirmText': { ja: '「{item}」を{n}個、{price}Gで買いますか？', en: 'Buy {n} × "{item}" for {price}G?' },
  'items.bought': { ja: '「{item}」を{n}個買った。', en: 'You bought {n} × "{item}".' },
  'items.notEnough': { ja: '所持金が足りません。', en: 'You do not have enough money.' },
  'items.atLimit': { ja: 'これ以上持てません（1種類{max}個まで）。', en: 'You cannot carry more (up to {max} of each).' },
  'items.note': {
    ja: '道具はダンジョンの中で、メニューの「道具」から使えます（煙玉は見えない番人が現れたとき）。',
    en: 'Use items in the dungeon from Menu > Items (Smoke Ball: when a guardian appears).',
  },
} as const satisfies Readonly<Record<string, MessageEntry>>;
