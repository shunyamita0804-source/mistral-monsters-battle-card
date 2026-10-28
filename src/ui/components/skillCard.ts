import { getMonster } from '../../data/cards.ts';
import { skillCardFace, skillValueBadge, skillValueBadgeText } from '../../game/cards/cardFace.ts';
import { skillCategory, supportShortText, type PlayCard, type SkillCard, type SkillCategory, type SupportCard } from '../../game/cards/cardTypes.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { resolveCardArt } from '../cardArtSources.ts';
import { h } from '../dom.ts';

/**
 * 技カード・サポートカード（2026-10-25 新UI「v5」。ユーザー承認の参考画像 design-parts/ui-skillcard-v5/approved_ui_reference.png から切り出した枠）。
 * 図鑑・デッキ・ショップ・ガチャ・詳しい表示・対戦（手札・大きなカード・守備・演出）まで、技カードはすべてこれで描く（旧テンプレート V4 は使わない）。
 *
 * 重ね順：イラスト（枠の窓の下）→ 枠 → マナの玉の数字 → 技名・数値の欄・説明（ゲーム側で描く文字。画像に焼き込まない）
 * - 枠：assets/images/ui/skillcard_v5/frame_{size}_{分類}[_{モンスター}].png（2026-10-28 から v3 の絵。npm run art:skillframes で作り直す。docs/cardlook-v3-20261028.md）。
 *   モンスター専用の色があればそれ（ソラモ＝クリーム）、なければ参考画像の分類の色。サポートはシルバー
 * - 'normal'（縦長 253×382）：図鑑・詳しい表示・大きなカード。'hand'（ほぼ正方形 208×210）：対戦の手札・守備のカードなど小さな表示
 * - 数値の欄：攻撃＝ダメージ、防御＝盾と軽減値、回避＝「回避」、特殊＝「効果」（skillValueBadge）
 */
export type SkillCardSize = 'normal' | 'hand';

export interface SkillCardOptions {
  /** カードの幅（論理px）。高さは枠の縦横比から決まる */
  readonly width: number;
  /** 文字（技名・説明）を描くか。小さい表示では省く（数値の欄・マナはいつも描く） */
  readonly showText?: boolean;
  /** 枠の形（なければ 'normal'） */
  readonly size?: SkillCardSize;
}

interface FrameLayout {
  readonly w: number;
  readonly h: number;
  readonly name: readonly [number, number, number, number];
  /** マナの玉：真ん中の x・y と半径 */
  readonly orb: readonly [number, number, number];
  readonly value: readonly [number, number, number, number];
  readonly text: readonly [number, number, number, number];
  readonly art: readonly [number, number, number, number];
}

/** 枠の中の位置（枠の画像の画素。design-parts/ui-skillcard-v5/ の layout と同じ） */
const LAYOUT: Readonly<Record<SkillCardSize, FrameLayout>> = {
  normal: { w: 253, h: 382, name: [98, 30, 232, 62], orb: [49, 138, 26], value: [20, 282, 85, 357], text: [95, 295, 240, 357], art: [26, 64, 238, 294] },
  hand: { w: 208, h: 210, name: [67, 18, 195, 45], orb: [34, 90, 19], value: [13, 143, 65, 197], text: [67, 153, 195, 195], art: [20, 42, 198, 154] },
};

const FRAME_URLS = import.meta.glob<string>('/assets/images/ui/skillcard_v5/frame_*.png', { eager: true, query: '?url', import: 'default' });
const MANA_URLS = import.meta.glob<string>('/assets/images/ui/skillcard_v5/mana_*.png', { eager: true, query: '?url', import: 'default' });

/** 枠の画像（モンスター専用の色 → 分類の色の順に探す） */
export function frameUrl(size: SkillCardSize, category: SkillCategory | 'support', monsterId?: string): string | undefined {
  const key = monsterId?.replace(/^mon-/, '');
  const base = `/assets/images/ui/skillcard_v5/frame_${size}_${category}`;
  return (key ? FRAME_URLS[`${base}_${key}.png`] : undefined) ?? FRAME_URLS[`${base}.png`];
}

const pct = (v: number, of: number): string => `${((v / of) * 100).toFixed(3)}%`;
function place(el: HTMLElement, l: FrameLayout, r: readonly [number, number, number, number]): HTMLElement {
  el.style.left = pct(r[0], l.w);
  el.style.top = pct(r[1], l.h);
  el.style.width = pct(r[2] - r[0], l.w);
  el.style.height = pct(r[3] - r[1], l.h);
  return el;
}

/** 文字の長さに合わせて小さくする（長い英語でも欠けないように）。base は cqw、fit はその大きさで入る文字数の目安 */
function fitText(el: HTMLElement, text: string, base: number, fit: number, min: number): HTMLElement {
  const len = [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 0xff ? 1 : 0.55), 0);
  const size = len > fit ? Math.max(min, (base * fit) / len) : base;
  el.style.fontSize = `${size.toFixed(2)}cqw`;
  return el;
}

/** マナの玉の数字（0〜10 は数字の入った玉の絵、それ以外は文字） */
function manaOrb(l: FrameLayout, cost: number): HTMLElement {
  const [cx, cy, r] = l.orb;
  const d = r * 2 * 1.06;
  const url = MANA_URLS[`/assets/images/ui/skillcard_v5/mana_${cost}.png`];
  const el = url
    ? h('img', { class: 'skill-card__mana', attrs: { src: url, alt: '', draggable: 'false' } })
    : h('span', { class: 'skill-card__mana skill-card__mana--text', text: String(cost) });
  return place(el, l, [cx - d / 2, cy - d / 2, cx + d / 2, cy + d / 2]);
}

const SHIELD_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z" fill="currentColor"/></svg>';

/** 数値の欄（左下の四角）：攻撃＝ダメージ、防御＝盾と軽減値、回避＝「回避」、特殊＝「効果」。サポートは区分の文字 */
function valueBox(l: FrameLayout, skill: SkillCard | null, supportLabel: string, showText: boolean): HTMLElement {
  const box = place(h('div', { class: 'skill-card__value' }), l, l.value);
  if (!skill) {
    box.classList.add('is-word');
    box.append(h('span', { class: 'skill-card__value-word', text: supportLabel }));
    return box;
  }
  const badge = skillValueBadge(skill);
  if (badge.kind === 'damage') {
    box.append(h('span', { class: 'skill-card__value-num', text: skillValueBadgeText(badge) }));
    if (showText) box.append(h('span', { class: 'skill-card__value-sub', text: t('card.badge.damage') }));
  } else if (badge.kind === 'guard') {
    const shield = h('span', { class: 'skill-card__value-shield' });
    shield.innerHTML = SHIELD_SVG;
    box.append(h('span', { class: 'skill-card__value-guard' }, shield, h('span', { class: 'skill-card__value-num', text: skillValueBadgeText(badge) })));
    if (showText) box.append(h('span', { class: 'skill-card__value-sub', text: t('card.badge.guard') }));
  } else {
    box.classList.add('is-word');
    box.append(h('span', { class: 'skill-card__value-word', text: skillValueBadgeText(badge) }));
  }
  box.dataset.badge = badge.kind;
  return box;
}

/**
 * イラスト：縦横比を保って全体を入れる（キャラクターを切らない）。窓との形の差（手札用の横長の窓など）は、
 * 同じ絵をぼかして暗くしたものを後ろに敷いて埋める（絵そのものは変えない）
 */
function artLayer(l: FrameLayout, url: string | undefined, mark: string, support: boolean): HTMLElement {
  const el = url
    ? h(
        'div',
        { class: 'skill-card__art-box' },
        h('img', { class: 'skill-card__art-fill', attrs: { src: url, alt: '', draggable: 'false' } }),
        h('img', { class: 'skill-card__art', attrs: { src: url, alt: '', draggable: 'false' } }),
      )
    : h(
        'div',
        { class: `skill-card__art skill-card__art--placeholder${support ? ' skill-card__art--support' : ''}` },
        h('span', { class: 'skill-card__art-mark', text: mark }),
        h('span', { class: 'skill-card__art-note', text: t('common.placeholderTag') }),
      );
  return place(el, l, l.art);
}

interface Face {
  readonly name: string;
  readonly mana: number;
  readonly category: SkillCategory | 'support';
  readonly text: string;
  readonly art: string | undefined;
  readonly mark: string;
  readonly aria: string;
  readonly skill: SkillCard | null;
  readonly supportLabel: string;
  readonly monsterId?: string;
  readonly placeholder: boolean;
}

function skillFace(skill: SkillCard): Face {
  const face = skillCardFace(skill);
  return {
    name: face.title,
    mana: face.mana,
    category: skillCategory(skill),
    text: face.description,
    art: resolveCardArt(skill.art),
    mark: t('card.art.skill'),
    aria:
      face.value !== null
        ? t('card.aria.skill', { name: face.title, cost: face.mana, stat: face.categoryLabel, v: face.value })
        : t('card.aria.skillNoValue', { name: face.title, cost: face.mana, stat: face.categoryLabel }),
    skill,
    supportLabel: '',
    monsterId: getMonster(skill.monsterId).id,
    placeholder: skill.isPlaceholder,
  };
}

function supportFace(card: SupportCard): Face {
  return {
    name: cardName(card),
    mana: card.cost,
    category: 'support',
    text: supportShortText(card),
    art: resolveCardArt(card.art),
    mark: t(card.duration === 'field' ? 'card.art.field' : 'card.art.support'),
    aria: t('card.aria.support', { name: cardName(card), cost: card.cost }),
    skill: null,
    supportLabel: t(card.duration === 'field' ? 'card.supportKind.field' : 'card.kind.support'),
    placeholder: card.isPlaceholder,
  };
}

function render(f: Face, options: SkillCardOptions): HTMLElement {
  const size = options.size ?? 'normal';
  const l = LAYOUT[size];
  const showText = options.showText ?? (size === 'normal' && options.width >= 120);
  const frame = frameUrl(size, f.category, f.monsterId);
  const card = h(
    'div',
    { class: `skill-card skill-card--${size}${f.skill ? '' : ' skill-card--support'}`, dataset: { category: f.category }, attrs: { role: 'img', 'aria-label': f.aria } },
    artLayer(l, f.art, f.mark, !f.skill),
    frame ? h('img', { class: 'skill-card__frame', attrs: { src: frame, alt: '', draggable: 'false' } }) : null,
    manaOrb(l, f.mana),
    valueBox(l, f.skill, f.supportLabel, showText),
    showText ? fitText(place(h('div', { class: 'skill-card__title', text: f.name }), l, l.name), f.name, size === 'normal' ? 6.6 : 6.4, 9, 3.6) : null,
    showText ? fitText(place(h('div', { class: `skill-card__desc${f.skill && f.skill.effect.type !== 'attack' ? ' is-effect' : ''}`, text: f.text }), l, l.text), f.text, 5, 16, 3.2) : null,
  );
  card.style.width = `${options.width}px`;
  card.style.height = `${((options.width * l.h) / l.w).toFixed(1)}px`;
  return card;
}

export function createSkillCard(skill: SkillCard, options: SkillCardOptions): HTMLElement {
  return render(skillFace(skill), options);
}

/** サポートカード（共通のシルバーの枠。数値の欄には区分〔サポート／全体〕） */
export function createSupportCard(card: SupportCard, options: SkillCardOptions): HTMLElement {
  return render(supportFace(card), options);
}

/** カードの幅から高さを出す（枠の縦横比） */
export function skillCardHeight(width: number, size: SkillCardSize = 'normal'): number {
  return (width * LAYOUT[size].h) / LAYOUT[size].w;
}

/** 技・サポートどちらでも描く */
export function createPlayCard(card: PlayCard, options: SkillCardOptions): HTMLElement {
  return card.kind === 'skill' ? createSkillCard(card, options) : createSupportCard(card, options);
}
