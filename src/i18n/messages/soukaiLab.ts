import type { MessageEntry } from '../i18n.ts';

/** 蒼海「みちしおあり」の確かめ用の画面（確認用。?qa=1 のときだけ入れる。src/ui/screens/soukaiLabScreen.ts。2026-11-02 指示書 AP）。「この組み合わせで対戦」「確認用の相手」はプカリムの試遊の画面と同じキー（pukarimLab.start・pukarimLab.opponent） */
export const SOUKAI_LAB = {
  'soukaiLab.title': { ja: '蒼海（みちしおあり）を試す（確認用）', en: 'Ocean Guard with High Tide (QA)' },
  'soukaiLab.note': {
    ja: '「蒼海の守り」にみちしお1枚・タイダルクラッシュ1枚を入れたデッキ（はさむ 3→2・すなをほる 2→1）で対戦します。デッキは借り物で、持っているカード・セーブのデッキは変わりません。',
    en: 'Battle with the Ocean Guard deck plus 1 High Tide and 1 Tidal Crash (Pinch 3→2, Dig 2→1). The deck is borrowed; your cards and saved deck do not change.',
  },
  'soukaiLab.changed': { ja: '入れたカード', en: 'Added cards' },
  'soukaiLab.theirs': { ja: '相手の箱', en: "Opponent's box" },
  'soukaiLab.skill': { ja: '相手の腕前', en: "Opponent's skill" },
  'soukaiLab.skillB': { ja: 'B（ふつう）', en: 'B (normal)' },
  'soukaiLab.skillA': { ja: 'A（強い）', en: 'A (strong)' },
  'soukaiLab.battleTitle': { ja: '蒼海（みちしおあり）の試し', en: 'Ocean Guard Tide Test' },
} as const satisfies Record<string, MessageEntry>;
