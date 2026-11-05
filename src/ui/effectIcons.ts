import type { SkillCard } from '../game/cards/cardTypes.ts';
import type { StatusIconId } from './statusIcons.ts';

/**
 * 技カードの効果のアイコン（2026-11-05 指示書 BA【4】ユーザー決定：どこもアイコンだけ）。
 * カードの効果の文（日本語の正本の文）が、アイコンだけで言い切れるものだけアイコンにする。ほかの効果は今の文のまま（docs/ba-icons-fix-20261105.md に一覧）
 * - 回避されない＝E01・防御されない＝E02・回避されても半分＝E03・相手全員＝E04・ちから技に効く防御＝E05・かしこさ技に効く防御＝E06
 * - 効果が2つ（ちから技・かしこさ技に効く防御）はアイコンを2つ
 */
const BY_TEXT: Readonly<Record<string, readonly StatusIconId[]>> = {
  回避されない: ['e01'],
  防御されない: ['e02'],
  回避されても半分のダメージ: ['e03'],
  相手全員にダメージ: ['e04'],
  '相手全員に当たる（守りは1体ずつ）': ['e04'],
  ちから技に効く: ['e05'],
  かしこさ技に効く: ['e06'],
  'ちから技・かしこさ技に効く': ['e05', 'e06'],
};

/** その技の効果のアイコン（アイコンにしない技は null＝今の文のまま） */
export function skillEffectIcons(skill: SkillCard): readonly StatusIconId[] | null {
  const text = skill.effectTextJa;
  return text ? (BY_TEXT[text] ?? null) : null;
}

/** アイコンにしている効果の文（テスト・報告用） */
export const ICON_EFFECT_TEXTS: readonly string[] = Object.keys(BY_TEXT);
