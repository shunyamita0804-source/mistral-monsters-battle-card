import { getMonster } from '../../data/cards.ts';
import { skillCardFace, skillValueBadge, skillValueBadgeText } from '../../game/cards/cardFace.ts';
import { skillBandText, skillCategory, supportShortText, type PlayCard, type SkillCard, type SkillCategory, type SupportCard } from '../../game/cards/cardTypes.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { resolveCardArt } from '../cardArtSources.ts';
import { h } from '../dom.ts';
import { fitValueFont } from './valueFit.ts';

/**
 * 技カード・サポートカード（2026-10-29 新しい形：平らな名前の帯＋大きな絵の窓だけの枠。
 * 指示書 design-parts/ui-skillcard-simple-20261028/00_instructions_for_claude_code.txt・ユーザーが選んだ見本 ref/approved_layout_mock.png）。
 * 図鑑・デッキ・ショップ・ガチャ・詳しい表示・対戦（手札・大きなカード・守備・演出）まで、技カードはすべてこれで描く。
 *
 * 重ね順：イラスト（窓いっぱい・はみ出しは切る）→ 枠 → マナの丸・分類の印・ダメージの四角・技名・効果の帯（ゲーム側で描く。画像に焼き込まない）
 * - 枠：assets/images/ui/skillcard_simple/frame_{size}_{モンスター}.webp（モンスターごとに1枚。サポートは frame_{size}_support.webp の銀）。
 *   LAYOUT の2倍の大きさ。npm run art:skillframes（tools/art/skillcard_simple_build.py）で作り直す
 * - 'normal'（縦長 253×382）：図鑑・詳しい表示・大きなカード。'hand'（少し縦長 208×260）：対戦の手札・守備のカードなど小さな表示。
 *   手札は名前・効果の帯を出さず、マナ・印・ダメージを重ねたときに見える左35%に置く
 * - ダメージの四角：攻撃＝大きな数字だけ、防御＝軽減値の数字だけ（-3）、回避＝「回避」、特殊＝「効果」（skillValueBadge）、サポート＝区分
 * - 効果の帯：防御・回避・特殊・サポートは説明の文、攻撃は追加の効果のときだけ（skillBandText）
 */
export type SkillCardSize = 'normal' | 'hand';

export interface SkillCardOptions {
  /** カードの幅（論理px）。高さは枠の縦横比から決まる */
  readonly width: number;
  /** 効果の帯を描くか（指定がなければ幅120以上）。技名は縦長の枠で幅70以上ならいつも描く。マナ・印・ダメージはいつも描く */
  readonly showText?: boolean;
  /** 枠の形（なければ 'normal'） */
  readonly size?: SkillCardSize;
}

type Rect = readonly [number, number, number, number];

interface FrameLayout {
  readonly w: number;
  readonly h: number;
  /** 絵の窓 */
  readonly art: Rect;
  /** 技名（帯の上。マナの丸に重ならない所）。手札は無し */
  readonly name: Rect | null;
  /** マナの丸：真ん中の x・y と半径 */
  readonly mana: readonly [number, number, number];
  /** 分類の印：真ん中の x・y と一辺 */
  readonly icon: readonly [number, number, number];
  /** ダメージの四角（窓の左下の角にぴったり） */
  readonly value: Rect;
  /** 効果の帯（大きなカードだけ） */
  readonly band: Rect | null;
}

/** 枠の中の位置（枠の絵の 1/4 の画素。design-parts/ui-skillcard-simple-20261028/ref/layout_positions.png） */
const LAYOUT: Readonly<Record<SkillCardSize, FrameLayout>> = {
  normal: { w: 253, h: 382, art: [13, 40, 240.5, 371.25], name: [58, 9, 240, 34], mana: [31, 26, 24], icon: [31, 63, 21], value: [13, 315, 69, 371.25], band: [73, 336, 236, 367] },
  // 手札：2026-10-29 ユーザー「もう少し縦長にしてOK」で 208×210 → 208×260（下のふちの位置を 50 下げただけ。マナ・印は今のまま）
  hand: { w: 208, h: 260, art: [8.5, 9.5, 199.5, 250.5], name: null, mana: [34, 34, 27], icon: [34, 84, 37], value: [8.5, 190.5, 68.5, 250.5], band: null },
};

const FRAME_URLS = import.meta.glob<string>('/assets/images/ui/skillcard_simple/frame_*.webp', { eager: true, query: '?url', import: 'default' });
const ICON_URLS = import.meta.glob<string>('/assets/images/ui/skillcard_v5/icon_*.png', { eager: true, query: '?url', import: 'default' });

/** 枠の画像（技＝そのモンスターの色、サポート＝銀） */
export function frameUrl(size: SkillCardSize, monsterId?: string): string | undefined {
  const key = monsterId ? monsterId.replace(/^mon-/, '') : 'support';
  return FRAME_URLS[`/assets/images/ui/skillcard_simple/frame_${size}_${key}.webp`];
}

const cqw = (v: number): string => `${v.toFixed(2)}cqw`;
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

/** 効果の帯の文字：2行に収まる大きさ（上限 4.6cqw）。帯の中の幅（cqw）と、折り返しのむだを見た目安で決める */
function fitBandText(l: FrameLayout, band: Rect, text: string): HTMLElement {
  const el = h('span', { class: 'skill-card__band-text', text });
  const len = [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 0xff ? 1 : 0.55), 0);
  const inner = ((band[2] - band[0]) / l.w) * 100 - 5;
  el.style.fontSize = cqw(Math.max(2.2, Math.min(4.6, (2 * inner * 0.9) / Math.max(1, len))));
  return el;
}

/** マナの丸：平らな紺の丸に細い金のふち、白い太い数字（丸の直径の約7割。CSS の .skill-card__mana）。つや・影はつけない */
function manaOrb(l: FrameLayout, cost: number): HTMLElement {
  const [cx, cy, r] = l.mana;
  const el = place(h('span', { class: 'skill-card__mana' }, h('span', { class: 'skill-card__mana-num', text: String(cost) })), l, [cx - r, cy - r, cx + r, cy + r]);
  // 数字の大きさ：丸の直径の約7割（2桁は少し小さく）
  el.style.fontSize = cqw(((r * 2) / l.w) * 100 * (String(cost).length > 1 ? 0.56 : 0.7));
  return el;
}

/** 分類の印（今の icon_{分類}.png をそのまま縮めて置く）。サポートは印なし */
function categoryIcon(l: FrameLayout, category: SkillCategory | 'support'): HTMLElement | null {
  const url = category === 'support' ? undefined : ICON_URLS[`/assets/images/ui/skillcard_v5/icon_${category}.png`];
  if (!url) return null;
  const [cx, cy, side] = l.icon;
  return place(h('img', { class: 'skill-card__icon', attrs: { src: url, alt: '', draggable: 'false' } }), l, [cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2]);
}

/**
 * 数値の欄の文字の大きさ（cqw。2026-10-28 手札の大きさの指示書：数字 1.4倍・短い文字 約1.3倍）。
 * 欄からはみ出すときは、その端末の字の形で幅を測って、収まる大きさまで下げる（valueFit.ts）
 */
const VALUE_FONT: Readonly<Record<SkillCardSize, { readonly num: number; readonly word: number }>> = {
  normal: { num: 21, word: 8.5 },
  hand: { num: 22, word: 9.5 },
};
const NUM_FONT = "900 100px 'Arial Black', 'Hiragino Sans', sans-serif";

let measureCtx: CanvasRenderingContext2D | null | undefined;
const emCache = new Map<string, number>();
/** 文字列の幅（文字の大きさ 1 あたり）。測れないときは、ゆとりを見た目安（数字 0.68・記号 0.45・全角 1・ほか 0.66） */
function textEm(text: string, font: string): number {
  const key = `${font}|${text}`;
  const hit = emCache.get(key);
  if (hit !== undefined) return hit;
  if (measureCtx === undefined) measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  let em: number;
  if (measureCtx) {
    measureCtx.font = font;
    em = measureCtx.measureText(text).width / 100;
  } else {
    em = [...text].reduce((n, ch) => n + (/[0-9]/.test(ch) ? 0.68 : /[-+]/.test(ch) ? 0.45 : ch.charCodeAt(0) > 0xff ? 1 : 0.66), 0);
  }
  emCache.set(key, em);
  return em;
}

let wordFont: string | null = null;
/** 短い文字（回避・効果・サポート）の字の形：ページの字（body）の太字 */
function wordFontOf(): string {
  if (wordFont === null) wordFont = `900 100px ${typeof document !== 'undefined' && document.body ? getComputedStyle(document.body).fontFamily : 'sans-serif'}`;
  return wordFont;
}

/** ダメージの四角（窓の左下の角）：攻撃＝大きな数字だけ、防御＝軽減値の数字だけ（-3。2026-10-29 ユーザー「盾のアイコン不要」）、回避＝「回避」、特殊＝「効果」。サポートは区分の文字 */
function valueBox(l: FrameLayout, size: SkillCardSize, skill: SkillCard | null, supportLabel: string): HTMLElement {
  const box = place(h('div', { class: 'skill-card__value' }), l, l.value);
  const boxW = ((l.value[2] - l.value[0]) / l.w) * 100;
  const font = VALUE_FONT[size];
  const word = (text: string): HTMLElement => {
    const el = h('span', { class: 'skill-card__value-word', text });
    el.style.fontSize = cqw(fitValueFont(font.word, boxW, textEm(text, wordFontOf())));
    return el;
  };
  if (!skill) {
    box.classList.add('is-word');
    box.append(word(supportLabel));
    return box;
  }
  const badge = skillValueBadge(skill);
  if (badge.kind === 'damage' || badge.kind === 'guard') {
    // 攻撃＝ダメージ、防御＝軽減値（-3）。どちらも数字だけ（はみ出すときは収まる大きさまで下げる）
    const text = skillValueBadgeText(badge);
    const num = h('span', { class: 'skill-card__value-num', text });
    num.style.fontSize = cqw(fitValueFont(font.num, boxW, textEm(text, NUM_FONT)));
    box.append(num);
  } else {
    box.classList.add('is-word');
    box.append(word(skillValueBadgeText(badge)));
  }
  box.dataset.badge = badge.kind;
  return box;
}

/** イラスト：窓いっぱいに広げる（縦横比を保ち、はみ出した所を切る＝cover・真ん中合わせ）。窓の角の丸みは枠が隠す */
function artLayer(l: FrameLayout, url: string | undefined, mark: string, support: boolean): HTMLElement {
  const el = url
    ? h('img', { class: 'skill-card__art', attrs: { src: url, alt: '', draggable: 'false' } })
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
    text: skillBandText(skill),
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
  // 名前は縦長の枠で幅70以上ならいつも描く（名前の帯が「空っぽの箱」に見えないように。2026-10-29 新しい形）。
  // 効果の帯は showText（指定がなければ幅120以上）
  const showName = size === 'normal' && options.width >= 70;
  const showText = options.showText ?? (size === 'normal' && options.width >= 120);
  const frame = frameUrl(size, f.monsterId);
  const name = showName && l.name ? fitText(place(h('div', { class: 'skill-card__title', text: f.name }), l, l.name), f.name, 7.6, 9, 4) : null;
  const band =
    showText && l.band && f.text !== ''
      ? place(h('div', { class: 'skill-card__band' }, fitBandText(l, l.band, f.text)), l, l.band)
      : null;
  const card = h(
    'div',
    { class: `skill-card skill-card--${size}${f.skill ? '' : ' skill-card--support'}`, dataset: { category: f.category }, attrs: { role: 'img', 'aria-label': f.aria } },
    artLayer(l, f.art, f.mark, !f.skill),
    frame ? h('img', { class: 'skill-card__frame', attrs: { src: frame, alt: '', draggable: 'false' } }) : null,
    valueBox(l, size, f.skill, f.supportLabel),
    band,
    name,
    manaOrb(l, f.mana),
    categoryIcon(l, f.category),
  );
  card.style.width = `${options.width}px`;
  card.style.height = `${((options.width * l.h) / l.w).toFixed(1)}px`;
  return card;
}

export function createSkillCard(skill: SkillCard, options: SkillCardOptions): HTMLElement {
  return render(skillFace(skill), options);
}

/** サポートカード（銀の枠・分類の印なし。ダメージの四角には区分〔サポート／全体〕） */
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
