import type { MessageEntry } from '../i18n.ts';

/**
 * 名刺図鑑（家の本棚）とカード図鑑（研究所）の文字（2026-10-27 指示書「人物の名前・名刺図鑑・カード図鑑」）
 */
export const BOOK = {
  // ---------- 名刺図鑑 ----------
  'peopleBook.title': { ja: '名刺図鑑', en: 'Card File' },
  'peopleBook.count': { ja: '登録 {n}／{total}人', en: 'Registered {n}/{total}' },
  'peopleBook.no': { ja: 'No.{n}', en: 'No.{n}' },
  'peopleBook.unmet': { ja: 'まだ会っていない', en: 'Not met yet' },
  'peopleBook.record': { ja: '対戦成績', en: 'Record' },
  'peopleBook.recordValue': { ja: '{w}勝{l}敗', en: '{w}W {l}L' },
  'peopleBook.monsters': { ja: '使うモンスター', en: 'Monsters' },
  'peopleBook.cards': { ja: 'もらえるカード', en: 'Cards you can get' },
  'peopleBook.cardsOf': { ja: '{monster}の技', en: "{monster}'s skills" },
  'peopleBook.none': { ja: '—', en: '—' },
  'peopleBook.temp': { ja: '【仮】名刺の台紙・顔の絵の一部は準備中です（顔の絵が無い人は人影）。', en: '[Temp] Card mounts and some portraits are in progress (silhouettes for now).' },

  // ---------- カード図鑑 ----------
  'collection.tab.support': { ja: 'サポート', en: 'Support' },
  'collection.section.support': { ja: 'サポートカード', en: 'Support Cards' },
  'collection.section.hidden': { ja: '隠しモンスター', en: 'Hidden Monster' },
  'collection.section.temp': { ja: '仮のカード（番号なし）', en: 'Temp cards (unnumbered)' },
  'collection.complete': { ja: '完成', en: 'Complete' },
  'collection.new': { ja: 'NEW', en: 'NEW' },
  'collection.no': { ja: 'No.{n}', en: 'No.{n}' },
  'collection.prev': { ja: '前へ', en: 'Prev' },
  'collection.next': { ja: '次へ', en: 'Next' },
  'collection.detail.kind': { ja: '種類', en: 'Type' },
  'collection.detail.mana': { ja: '必要マナ', en: 'Mana cost' },
  'collection.detail.life': { ja: 'ライフ', en: 'Life' },
  'collection.detail.effect': { ja: '効果', en: 'Effect' },
  'collection.detail.owned': { ja: '持っている枚数', en: 'Owned' },
  'collection.unknownDetail': { ja: 'まだ手に入れていないカードです。', en: "You haven't found this card yet." },
} as const satisfies Readonly<Record<string, MessageEntry>>;
