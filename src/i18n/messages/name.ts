import type { MessageEntry } from '../i18n.ts';

/**
 * 主人公の名前を決める画面（2026-10-28 ユーザー決定）と、取得カードの画面（同じ指示書）
 */
export const NAME_MESSAGES = {
  'name.title': { ja: '名前を決める', en: 'Your Name' },
  'name.ask': { ja: 'あなたの名前を教えてね。', en: "What's your name?" },
  'name.placeholder': { ja: 'ここをタップして入力', en: 'Tap here to type' },
  'name.inputAria': { ja: '名前（8文字まで）', en: 'Name (up to 8 characters)' },
  'name.count': { ja: '{n}／{max}文字', en: '{n}/{max}' },
  'name.rule': { ja: '8文字まで。絵文字と一部の記号は使えません。', en: 'Up to 8 characters. Emoji and some symbols are not allowed.' },
  'name.decide': { ja: '決定', en: 'OK' },
  'name.confirm': { ja: '{name} でいい？', en: 'Is "{name}" right?' },

  // 取得カード（src/ui/components/cardListView.ts）
  'received.title': { ja: '取得カード', en: 'Cards Received' },
  'received.count': { ja: '×{n}', en: '×{n}' },
  'received.total': { ja: '全{n}枚', en: '{n} cards in all' },
  'received.group.monster': { ja: 'モンスター', en: 'Monsters' },
  'received.group.skill': { ja: '技カード', en: 'Skill Cards' },
  'received.group.support': { ja: 'サポート', en: 'Support' },
  'received.groupCount': { ja: '{group}（{n}枚）', en: '{group} ({n})' },
  'received.close': { ja: '閉じる', en: 'Close' },
} as const satisfies Readonly<Record<string, MessageEntry>>;
