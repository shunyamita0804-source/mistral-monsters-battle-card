import { getMonster } from '../../data/cards.ts';
import { skillCardFace, skillValueBadge, skillValueBadgeText } from '../../game/cards/cardFace.ts';
import { supportShortText, type PlayCard, type SkillCard, type SkillCategory, type SupportCard } from '../../game/cards/cardTypes.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { resolveCardArt } from '../cardArtSources.ts';
import { h } from '../dom.ts';
import iconStatForce from '@assets/images/ui/battle/icon_stat_force.webp';
import iconStatWisdom from '@assets/images/ui/battle/icon_stat_wisdom.webp';

/**
 * 対戦画面の技カードの表面（2026-10-25 バトル画面リデザイン パートB。PS版のように「何マナか」「威力いくつか」が一瞬で読める形）。
 * - 上下の空の帯をなくし、イラストをカードのほぼ全面に（縦横比は技の絵と同じ 827:937。切り抜かない）
 * - 左上：マナの丸いバッジ。右下：威力の数字（防御は盾の印と「-3」、回避・特殊・サポートは種類の札だけ）と、その上に種類の小さな札
 * - 種類の色は技カード UI テンプレート V4 のバーの色（ちから＝赤・かしこさ＝緑・防御＝灰青・回避＝青緑・特殊＝紫）。サポートは決まった色がないので仮の金茶
 * - 'hand'：手札の大きさ（名前はカードの下に画面側で出す）。'focus'：フォーカスエリアの大きなカード（上に名前、下に効果文）
 * 図鑑・デッキなど対戦以外の画面は、いままでどおりテンプレート V4（skillCard.ts）のまま
 */
export type BattleCardSize = 'hand' | 'focus';

export interface BattleCardOptions {
  readonly width: number;
  readonly size: BattleCardSize;
}

/** 技の絵の縦横比（827×937） */
const ART_RATIO = 937 / 827;
/** 'focus' の名前の帯・効果文の高さ（幅に対する割合） */
const FOCUS_NAME = 0.17;
const FOCUS_TEXT = 0.42;

/** 種類の色（V4 テンプレートのバーの色から。サポートは仮） */
export const CATEGORY_COLOR: Readonly<Record<SkillCategory | 'support', string>> = {
  force: '#a8322e',
  wisdom: '#1f8a4f',
  defense: '#5a6882',
  evade: '#16909b',
  special: '#7d45a0',
  support: '#9a7a36',
};

/** サポートカードの外枠の色（skillCard.ts と同じ） */
const SUPPORT_TINT = '#b08a3e';

/** 手札・フォーカスのカードの高さ */
export function battleCardHeight(width: number, size: BattleCardSize): number {
  return size === 'hand' ? width * ART_RATIO : width * (FOCUS_NAME + ART_RATIO + FOCUS_TEXT);
}

const SHIELD_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z" fill="currentColor"/></svg>';

/**
 * 右下の威力（skillValueBadge のきまり。2026-10-25）：ちから・かしこさ＝数字、防御＝盾と「-3」、回避＝「回避」、特殊＝「効果」の文字。
 * 種類は上の札で分かるので、回避・特殊は種類の札を重ねて出さない。サポートは種類の札だけ
 */
function powerBadge(category: SkillCategory | 'support', label: string, skill: SkillCard | null): HTMLElement {
  if (!skill) return h('span', { class: 'bcard__power is-label-only' }, h('span', { class: 'bcard__type', text: label }));
  const badge = skillValueBadge(skill);
  if (badge.kind === 'damage') {
    return h(
      'span',
      { class: 'bcard__power' },
      h('span', { class: 'bcard__type', text: label }),
      h(
        'span',
        { class: 'bcard__value' },
        h('img', { class: 'bcard__icon', attrs: { src: category === 'force' ? iconStatForce : iconStatWisdom, alt: '', draggable: 'false' } }),
        h('span', { class: 'bcard__num', text: skillValueBadgeText(badge) }),
      ),
    );
  }
  if (badge.kind === 'guard') {
    const shield = h('span', { class: 'bcard__shield' });
    shield.innerHTML = SHIELD_SVG;
    return h(
      'span',
      { class: 'bcard__power' },
      h('span', { class: 'bcard__type', text: label }),
      h('span', { class: 'bcard__value bcard__value--guard' }, shield, h('span', { class: 'bcard__num', text: skillValueBadgeText(badge) })),
    );
  }
  // 回避・特殊：数値は出さず、短い文字だけ（0 ダメージと間違えないように）
  return h('span', { class: `bcard__power is-label-only is-${badge.kind}` }, h('span', { class: 'bcard__type', text: skillValueBadgeText(badge) }));
}

function artLayer(url: string | undefined, mark: string): HTMLElement {
  return url
    ? h('img', { class: 'bcard__art', attrs: { src: url, alt: '', draggable: 'false' } })
    : h(
        'span',
        { class: 'bcard__art bcard__art--placeholder' },
        h('span', { class: 'bcard__art-mark', text: mark }),
      );
}

interface FaceParts {
  readonly name: string;
  readonly mana: number;
  readonly category: SkillCategory | 'support';
  readonly label: string;
  readonly text: string;
  readonly frame: string;
  readonly art: HTMLElement;
  readonly placeholder: boolean;
  readonly aria: string;
  readonly skill: SkillCard | null;
}

function skillParts(skill: SkillCard): FaceParts {
  const face = skillCardFace(skill);
  return {
    name: face.title,
    mana: face.mana,
    category: face.category,
    label: face.categoryLabel,
    text: face.description,
    frame: getMonster(skill.monsterId).themeColor,
    art: artLayer(resolveCardArt(skill.art), t('card.art.skill')),
    placeholder: skill.isPlaceholder,
    aria:
      face.value !== null
        ? t('card.aria.skill', { name: face.title, cost: face.mana, stat: face.categoryLabel, v: face.value })
        : t('card.aria.skillNoValue', { name: face.title, cost: face.mana, stat: face.categoryLabel }),
    skill,
  };
}

function supportParts(card: SupportCard): FaceParts {
  return {
    name: cardName(card),
    mana: card.cost,
    category: 'support',
    label: t(card.duration === 'field' ? 'card.supportKind.field' : 'card.kind.support'),
    text: supportShortText(card),
    frame: SUPPORT_TINT,
    art: artLayer(resolveCardArt(card.art), t(card.duration === 'field' ? 'card.art.field' : 'card.art.support')),
    placeholder: card.isPlaceholder,
    aria: t('card.aria.support', { name: cardName(card), cost: card.cost }),
    skill: null,
  };
}

export function createBattleCard(card: PlayCard, options: BattleCardOptions): HTMLElement {
  const p = card.kind === 'skill' ? skillParts(card) : supportParts(card);
  const pic = h(
    'div',
    { class: 'bcard__pic' },
    p.art,
    h('span', { class: 'bcard__mana', attrs: { 'aria-hidden': 'true' } }, h('span', { class: 'bcard__mana-num', text: String(p.mana) })),
    powerBadge(p.category, p.label, p.skill),
    p.placeholder ? h('span', { class: 'bcard__temp', text: t('common.placeholderTag') }) : null,
  );
  const el = h(
    'div',
    { class: `bcard bcard--${options.size}`, dataset: { category: p.category }, attrs: { role: 'img', 'aria-label': p.aria } },
    options.size === 'focus' ? h('div', { class: 'bcard__name', text: p.name }) : null,
    pic,
    options.size === 'focus' ? h('div', { class: 'bcard__text', text: p.text }) : null,
  );
  el.style.setProperty('--frame', p.frame);
  el.style.setProperty('--cat', CATEGORY_COLOR[p.category]);
  el.style.width = `${options.width}px`;
  el.style.height = `${battleCardHeight(options.width, options.size).toFixed(1)}px`;
  // 大きさに合わせて文字を拡大縮小する（幅 70 を基準に）
  el.style.setProperty('--u', `${(options.width / 70).toFixed(3)}px`);
  return el;
}
