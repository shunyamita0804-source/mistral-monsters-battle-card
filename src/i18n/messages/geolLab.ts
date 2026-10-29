import type { MessageEntry } from '../i18n.ts';

/** ジオルの試遊の画面（確認用。?qa=1 のときだけ入れる。src/ui/screens/geolLabScreen.ts）。説明の文と「この組み合わせで対戦」はプカリムの試遊の画面と同じキー（pukarimLab.note・pukarimLab.start）を使う */
export const GEOL_LAB = {
  'geolLab.title': { ja: 'ジオルの試遊（確認用）', en: 'Geol Playtest (QA)' },
  'geolLab.cards': { ja: 'ジオルのカード', en: 'Geol cards' },
  'geolLab.battle': { ja: 'ジオル入りのデッキで対戦', en: 'Battle with a Geol deck' },
  'geolLab.mine': { ja: '自分のデッキ（箱の3体目をジオルに）', en: 'Your deck (3rd monster of the box swapped for Geol)' },
  'geolLab.theirs': { ja: '相手のデッキ', en: "Opponent's deck" },
  'geolLab.withGeol': { ja: '{box}＋ジオル', en: '{box} + Geol' },
  'geolLab.effectCheck': { ja: '効果を確かめる用（地ひびき・かばう・ためる多め）', en: 'Effect check (more Tremor, Cover, Energy)' },
  'geolLab.effectCheckOf': { ja: '{box}＋ジオル（効果を確かめる用）', en: '{box} + Geol (effect check)' },
  'geolLab.battleTitle': { ja: 'ジオルの試遊', en: 'Geol Playtest' },
  'geolLab.opponent': { ja: '確認用の相手', en: 'QA Opponent' },
} as const satisfies Record<string, MessageEntry>;
