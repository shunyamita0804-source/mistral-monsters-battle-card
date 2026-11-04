import type { MessageEntry } from '../i18n.ts';

/** 2026-11-05 指示書 AX の確かめ用の画面（?qa=1&lab=tyrant／gearos。src/ui/screens/axLabScreens.ts） */
export const AX_LAB = {
  'axLab.title': { ja: '新しいモンスターの確認', en: 'New Monster (QA)' },
  'axLab.titleOf': { ja: '{name}の確認（確認用）', en: '{name} (QA)' },
  'axLab.cards': { ja: '{name}のカード', en: '{name} cards' },
  'axLab.battle': { ja: '{name}入りのデッキで対戦', en: 'Battle with a {name} deck' },
  'axLab.mine': { ja: '自分のデッキ（箱の3体目を{name}に）', en: 'Your deck (3rd monster of the box swapped for {name})' },
  'axLab.theirs': { ja: '相手', en: 'Opponent' },
  'axLab.withMonster': { ja: '{box}＋{name}', en: '{box} + {name}' },
  'axLab.effectCheck': { ja: '効果を確かめる用（新しい効果のカード多め）', en: 'Effect check (more new-effect cards)' },
  'axLab.boss': { ja: '守り手 {boss}', en: 'Guardian {boss}' },
  'axLab.battleTitle': { ja: '{name}の確認', en: '{name} Check' },
  'axLab.opponent': { ja: '確認用の相手', en: 'QA Opponent' },
} as const satisfies Record<string, MessageEntry>;
