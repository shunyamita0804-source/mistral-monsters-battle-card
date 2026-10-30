import { getMonster } from '../../data/cards.ts';
import { skillArtX } from '../../data/skillArtPosition.ts';
import { skillCardFace, skillValueBadge, skillValueBadgeText } from '../../game/cards/cardFace.ts';
import { skillBandText, skillCategory, supportShortText, type PlayCard, type SkillCard, type SkillCategory, type SupportCard } from '../../game/cards/cardTypes.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { resolveCardArt } from '../cardArtSources.ts';
import { h } from '../dom.ts';
import { fitValueFont } from './valueFit.ts';
import { phrases, phraseText } from '../phraseText.ts';

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
 * - マナの球・分類の札・ダメージの四角は前の版（3cf9050）の見た目（2026-10-29 ユーザー指示）：mana_ball.webp・tile_{分類}.webp・value_box.webp
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
  /** マナの数字をカードの値の代わりに出す（対戦の手札：ツムジのかぜのりで攻撃技のマナ−1 のとき。2026-10-30 指示書 U） */
  readonly mana?: number;
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
  // 2026-10-29 ユーザー指示：左上の部品（マナの球＋分類の札）は絵の窓の幅・高さの約25%の中に。分類の札はマナの球のすぐ下に小さく
  normal: { w: 253, h: 382, art: [13, 40, 240.5, 371.25], name: [58, 9, 240, 34], mana: [32, 28, 23], icon: [32, 67, 26], value: [13, 315, 69, 371.25], band: [73, 336, 236, 367] },
  // 手札：2026-10-29 ユーザー「もう少し縦長にしてOK」で 208×210 → 208×260。分類の札は幅の約18%（37）。マナ・札・ダメージは重なっても見える左35%（x 72.8 まで）に
  hand: { w: 208, h: 260, art: [8.5, 9.5, 199.5, 250.5], name: null, mana: [31, 31, 23], icon: [31, 76, 37], value: [8.5, 190.5, 68.5, 250.5], band: null },
};

const FRAME_URLS = import.meta.glob<string>('/assets/images/ui/skillcard_simple/frame_*.webp', { eager: true, query: '?url', import: 'default' });
const TILE_URLS = import.meta.glob<string>('/assets/images/ui/skillcard_simple/tile_*.webp', { eager: true, query: '?url', import: 'default' });
/** 分類の札の縦横比（前の枠から切り出した八角形の札 126×136。tools/art/old_parts_build.py） */
const TILE_RATIO = 136 / 126;

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

/**
 * 字の幅の目安（全角1・半角0.55。字の大きさを1としたとき）。
 * 日本語の文の中の英字の大文字（ツムジの「Wひっかき」の W。2026-10-30）は日本語の字の形で幅が広いので 0.8（英語の文は今までどおり 0.55）
 */
const roughEm = (text: string, ja = false): number =>
  [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 0xff ? 1 : ja && /[A-Z]/.test(ch) ? 0.8 : 0.55), 0);

/**
 * 効果の帯の文字：2行に収まる大きさ（上限 4.6cqw・下限 2.2cqw）。帯の中の幅（cqw）に、文節（phraseText と同じ区切り）を
 * 前から詰めていって2行に入る大きさを探す（2026-10-29 文節で改行するようにしたので、行の終わりのむだも数に入れる）
 */
function fitBandText(l: FrameLayout, band: Rect, text: string): HTMLElement {
  const el = phraseText(text, 'skill-card__band-text');
  const inner = ((band[2] - band[0]) / l.w) * 100 - 5;
  // 英語は単語（と後ろの空白）ごと
  const ja = /[぀-ヿ㐀-鿿]/.test(text);
  const parts = phrases(text)
    .flatMap((p) => (p === '\n' ? [] : /\s/.test(p) ? p.split(/(?<=\s)/) : [p]))
    .map((p) => roughEm(p, ja));
  const lines = (size: number): number => {
    const cap = (inner * 0.96) / size;
    let n = 1;
    let used = 0;
    for (const w of parts) {
      if (used + w <= cap) {
        used += w;
        continue;
      }
      if (used > 0) n += 1;
      // 1行より長い文節は、その中で改行する
      const extra = Math.max(0, Math.ceil(w / cap) - 1);
      n += extra;
      used = w - extra * cap;
    }
    return n;
  };
  let size = 4.6;
  while (size > 2.2 && lines(size) > 2) size -= 0.1;
  el.style.fontSize = cqw(Math.max(2.2, size));
  return el;
}

/**
 * マナの球（2026-10-29 ユーザー「マナとダメージのとこは前のUI使ってね」：前の版〔3cf9050〕の枠のつやのある青い球を切り出した mana_ball.webp に、
 * 白い太い数字をゲームが重ねる。真ん中・大きさは LAYOUT の mana）
 */
function manaOrb(l: FrameLayout, cost: number, lowered = false): HTMLElement {
  const [cx, cy, r] = l.mana;
  const el = place(h('span', { class: `skill-card__mana${lowered ? ' skill-card__mana--lowered' : ''}` }, h('span', { class: 'skill-card__mana-num', text: String(cost) })), l, [cx - r, cy - r, cx + r, cy + r]);
  // 数字の大きさ：球の直径の約6割（2桁は少し小さく）
  el.style.fontSize = cqw(((r * 2) / l.w) * 100 * (String(cost).length > 1 ? 0.48 : 0.6));
  return el;
}

/**
 * 分類の札（前の版の枠の八角形の札〔赤い拳・緑の本・青い盾・橙の羽・紫の星〕を切り出した tile_{分類}.webp）。
 * サポートは tile_support（すぐ効く）・tile_field（場）。2026-10-30 指示書 Z（届いた 504×544 を tile_force と同じ 126×136 に縮めた）
 */
function categoryIcon(l: FrameLayout, tile: string): HTMLElement | null {
  const url = TILE_URLS[`/assets/images/ui/skillcard_simple/tile_${tile}.webp`];
  if (!url) return null;
  const [cx, cy, side] = l.icon;
  const hh = (side * TILE_RATIO) / 2;
  return place(h('img', { class: 'skill-card__icon', attrs: { src: url, alt: '', draggable: 'false' } }), l, [cx - side / 2, cy - hh, cx + side / 2, cy + hh]);
}

/**
 * 数値の欄の文字の大きさ（cqw。2026-10-28 手札の大きさの指示書：数字 1.4倍・短い文字 約1.3倍）。
 * 欄からはみ出すときは、その端末の字の形で幅を測って、収まる大きさまで下げる（valueFit.ts）
 */
const VALUE_FONT: Readonly<Record<SkillCardSize, { readonly num: number; readonly word: number }>> = {
  normal: { num: 21, word: 8.5 },
  hand: { num: 22, word: 9.5 },
};
/** ダメージの欄の金のふちの太さ（cqw。cards.css の .skill-card__value の border と同じ） */
const VALUE_BORDER = 4.6;
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
  // 文字を収める幅：欄の幅から金のふち（CSS の .skill-card__value の border 4.6cqw）を左右とも引く
  const boxW = ((l.value[2] - l.value[0]) / l.w) * 100 - 2 * VALUE_BORDER;
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

/**
 * イラスト：窓いっぱいに広げる（縦横比を保ち、はみ出した所を切る＝cover・縦は真ん中合わせ）。窓の角の丸みは枠が隠す。
 * 横の見せる所は技ごと（src/data/skillArtPosition.ts。決めていない技は真ん中）
 */
function artLayer(l: FrameLayout, url: string | undefined, mark: string, support: boolean, skillId: string | null): HTMLElement {
  const el = url
    ? h('img', { class: 'skill-card__art', attrs: { src: url, alt: '', draggable: 'false' } })
    : h(
        'div',
        { class: `skill-card__art skill-card__art--placeholder${support ? ' skill-card__art--support' : ''}` },
        h('span', { class: 'skill-card__art-mark', text: mark }),
        h('span', { class: 'skill-card__art-note', text: t('common.placeholderTag') }),
      );
  if (url && skillId) el.style.objectPosition = `${skillArtX(skillId)}% 50%`;
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
  /** 絵の横の位置を引くキー（技・サポートの ID。skillArtPosition.ts） */
  readonly artKey: string;
  /** 分類の印（tile_{…}.webp の {…}）。サポートは tile_support・場のカードは tile_field（2026-10-30 指示書 Z） */
  readonly tile: string;
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
    artKey: skill.id,
    tile: skillCategory(skill),
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
    artKey: card.id,
    tile: card.duration === 'field' ? 'field' : 'support',
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
  // 2026-10-30 指示書 O3：9文字の技の名前（フェイントステップ など）が約2px 切れていたので、8.4文字ぶんより長い名前から字を小さくする（前は 9）
  const name = showName && l.name ? fitText(place(h('div', { class: 'skill-card__title', text: f.name }), l, l.name), f.name, 7.6, 8.4, 4) : null;
  const band =
    showText && l.band && f.text !== ''
      ? place(h('div', { class: 'skill-card__band' }, fitBandText(l, l.band, f.text)), l, l.band)
      : null;
  const card = h(
    'div',
    { class: `skill-card skill-card--${size}${f.skill ? '' : ' skill-card--support'}`, dataset: { category: f.category }, attrs: { role: 'img', 'aria-label': f.aria } },
    artLayer(l, f.art, f.mark, !f.skill, f.artKey),
    frame ? h('img', { class: 'skill-card__frame', attrs: { src: frame, alt: '', draggable: 'false' } }) : null,
    valueBox(l, size, f.skill, f.supportLabel),
    band,
    name,
    manaOrb(l, options.mana ?? f.mana, options.mana !== undefined && options.mana < f.mana),
    categoryIcon(l, f.tile),
  );
  card.style.width = `${options.width}px`;
  card.style.height = `${((options.width * l.h) / l.w).toFixed(1)}px`;
  return card;
}

export function createSkillCard(skill: SkillCard, options: SkillCardOptions): HTMLElement {
  return render(skillFace(skill), options);
}

/** サポートカード（銀の枠・分類の印〔すぐ効く／場〕。ダメージの四角には区分〔サポート／全体〕） */
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
