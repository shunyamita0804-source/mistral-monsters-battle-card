import type { MessageEntry } from '../i18n.ts';

/** プカリムの試遊の画面（確認用。?qa=1 のときだけ入れる。src/ui/screens/pukarimLabScreen.ts） */
export const PUKARIM_LAB = {
  'pukarimLab.title': { ja: 'プカリムの試遊（確認用）', en: 'Pukarim Playtest (QA)' },
  'pukarimLab.note': {
    ja: '試遊中の新モンスター。ふつうに遊んでいる人には出ません。デッキは借り物で、所持カードとセーブのデッキは変わりません。',
    en: "A new monster in playtest. Regular players don't see it. Decks are borrowed; your cards and saved deck don't change.",
  },
  'pukarimLab.cards': { ja: 'プカリムのカード（技の絵は仮）', en: 'Pukarim cards (skill art is temporary)' },
  'pukarimLab.battle': { ja: 'プカリム入りのデッキで対戦', en: 'Battle with a Pukarim deck' },
  'pukarimLab.mine': { ja: '自分のデッキ（箱の3体目をプカリムに）', en: 'Your deck (3rd monster of the box swapped for Pukarim)' },
  'pukarimLab.theirs': { ja: '相手のデッキ', en: "Opponent's deck" },
  'pukarimLab.withPukarim': { ja: '{box}＋プカリム', en: '{box} + Pukarim' },
  'pukarimLab.effectCheck': { ja: '効果を確かめる用（ためる・おいかぜ・ぷはーっ多め）', en: 'Effect check (more Puff, Tailwind, Puhaa)' },
  'pukarimLab.start': { ja: 'この組み合わせで対戦', en: 'Start this battle' },
  'pukarimLab.battleTitle': { ja: 'プカリムの試遊', en: 'Pukarim Playtest' },
  'pukarimLab.opponent': { ja: '確認用の相手', en: 'QA Opponent' },
} as const satisfies Record<string, MessageEntry>;
