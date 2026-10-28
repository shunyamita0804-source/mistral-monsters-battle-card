import { t } from '../i18n/i18n.ts';
import type { MessageKey } from '../i18n/messages/index.ts';

/**
 * 【仮ルール】デッキとバトルのルール設定値。
 *
 * このリポジトリには正式なルール資料がないため、指示書に明記された点（デッキ60枚・モンスター3体・適合技・
 * マナ・攻撃/防御・対象選択・勝敗）以外はすべて仮の値。正式ルールが届いたらここを変更する。
 * 仮であることは画面のルール説明にも表示する（PROVISIONAL_RULE_NOTES・provisionalRuleNotes()）。
 */
export const DECK_RULES = {
  /** モンスターの数（指示書：モンスター3体） */
  monsterCount: 3,
  /** 技カードの枚数（指示書：デッキ60枚。モンスターは山札に入れず、技カード60枚とする解釈は仮） */
  skillCount: 60,
  /** 同じカードの上限枚数（PS版：3枚。docs/battle-rules.md） */
  maxCopies: 3,
  /**
   * 同じモンスターを2体以上入れられるか（仮）。
   * 2026-10-23 ユーザー指示「技の発動を見るため、仮のカードはすべてソラモに」で、ソラモ3体のデッキを組めるよう「可」にした（正式な決まりは未定）
   */
  allowDuplicateMonsters: true,
} as const;

export const BATTLE_RULES = {
  /** 最初の手札（PS版） */
  initialHand: 5,
  /** ドロー：手札をこの枚数まで補充。この枚数あるときは山札の一番上を1枚マナにする（PS版） */
  refillHandTo: 5,
  /**
   * 手札の上限（2026-10-28 ユーザー決定）。引く効果（ドロー・考える など）でこの枚数を超える分は、引かずに山札の上からそのままマナにする。
   * ターンのはじめの「refillHandTo 枚まで引く」はこの上限より少ないので関係しない
   */
  maxHand: 9,
  /** 先攻1ターン目はドロー・攻撃なしでマナ化だけ。マナにできるのはこの枚数まで（PS版） */
  firstTurnManaLimit: 2,
  /**
   * マナ（原作のガッツ）。指示書で確定：カード1枚をマナ化すると1マナ・持ち越し・上限なし・毎ターンの自動獲得なし。
   * マナ化は攻撃のあとの「マナ化」の場面で、手札から何枚でも。
   * 支払いは新しくマナにしたカードから（原作ルール。docs/battle-rules.md）。
   */
  manaPayOrder: 'newest' as 'oldest' | 'newest',
  /** 各モンスターは1ターンに技を1回まで（仮） */
  actionsPerMonsterPerTurn: 1,
} as const;

/** ルール説明（仮）の文のキー。文そのものは src/i18n/messages/battle.ts にある（日本語・英語） */
export const PROVISIONAL_RULE_NOTES: readonly MessageKey[] = [
  'battle.ruleNote.deck',
  'battle.ruleNote.opening',
  'battle.ruleNote.draw',
  'battle.ruleNote.mana',
  'battle.ruleNote.pay',
  'battle.ruleNote.skill',
  'battle.ruleNote.defend',
  'battle.ruleNote.damage',
  'battle.ruleNote.win',
  'battle.ruleNote.deckOut',
  'battle.ruleNote.support',
];

/** ルール説明（仮）を、いまの言語の文で返す */
export function provisionalRuleNotes(): string[] {
  return PROVISIONAL_RULE_NOTES.map((key) => t(key));
}
