import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { categoryLabel, guardReduction, skillCategory, skillShortText, type SkillCard, type SkillCategory } from './cardTypes.ts';

/**
 * 技カードの面に出すもの（DOM 非依存。表示は src/ui/components/skillCard.ts、テストは tests/soramo.test.ts）。
 * - category：右側のバーの種類（1種類だけ）
 * - mana：左側のマナの数字（0 も出す）
 * - value：右側の数字。数値のない技（特殊・防御・回避）は null で、数値枠ごと出さない
 * - 文字（技名・バーの文字・説明）はいまの言語で、ゲーム側で書く
 */
export interface SkillCardFace {
  readonly category: SkillCategory;
  readonly mana: number;
  readonly value: number | null;
  readonly title: string;
  readonly manaLabel: string;
  readonly categoryLabel: string;
  readonly description: string;
}

/**
 * 数値の欄（左下・右下の威力の所）に出すもの（2026-10-25 ユーザー指示。フルサイズ・手札・詳しい表示で同じ）：
 * - damage：ちから・かしこさ＝ダメージの数値
 * - guard：防御＝盾の印と軽減値（-3）
 * - evade：回避＝「回避」の文字
 * - effect：特殊（ダメージなし）＝「効果」の文字。0 ダメージと間違えないよう数値を出さない（種類は左上・上の印で分かるので、ここに印は置かない）
 */
export type SkillValueBadge =
  | { readonly kind: 'damage'; readonly value: number }
  | { readonly kind: 'guard'; readonly value: number }
  | { readonly kind: 'evade' }
  | { readonly kind: 'effect' };

export function skillValueBadge(skill: SkillCard): SkillValueBadge {
  const category = skillCategory(skill);
  if (skill.stat && (category === 'force' || category === 'wisdom')) return { kind: 'damage', value: skill.stat.value };
  if (category === 'defense') return { kind: 'guard', value: guardReduction(skill) };
  if (category === 'evade') return { kind: 'evade' };
  return { kind: 'effect' };
}

/** 数値の欄の文字（effect・evade の文字。damage・guard は数値） */
export function skillValueBadgeText(badge: SkillValueBadge): string {
  if (badge.kind === 'damage') return String(badge.value);
  if (badge.kind === 'guard') return `-${badge.value}`;
  return t(badge.kind === 'evade' ? 'card.badge.evade' : 'card.badge.effect');
}

export function skillCardFace(skill: SkillCard): SkillCardFace {
  const category = skillCategory(skill);
  return {
    category,
    mana: skill.cost,
    value: skill.stat ? skill.stat.value : null,
    title: cardName(skill),
    manaLabel: t('card.manaLabel'),
    categoryLabel: categoryLabel(category),
    description: skillShortText(skill),
  };
}
