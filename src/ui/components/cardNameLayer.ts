import { CARD_NAME_BOX } from '../../data/cardNames.ts';
import { CARD_NAME_LOGOS, CARD_NAME_LOGOS_EN, LOGO_GLYPH, LOGO_GLYPH_EN, type CardNameLogo } from '../../data/cardNameLogos.generated.ts';
import type { MonsterCard } from '../../game/cards/cardTypes.ts';
import { cardName } from '../../i18n/content.ts';
import { getLanguage } from '../../i18n/i18n.ts';
import { h } from '../dom.ts';

/** 名前の下の白いスウッシュ（指示書 AY は name_swoosh_white、指示書 AZ のロゴ用は name_swoosh を枠の色に染める） */
const SWOOSH_URLS = import.meta.glob<string>('/assets/images/ui/card_name/name_swoosh*.webp', { eager: true, query: '?url', import: 'default' });
const SWOOSH_WHITE = SWOOSH_URLS['/assets/images/ui/card_name/name_swoosh_white.webp'];
const SWOOSH_LOGO = SWOOSH_URLS['/assets/images/ui/card_name/name_swoosh.webp'];
const LOGO_URLS = import.meta.glob<string>('/assets/images/ui/card_name/logos/*.webp', { eager: true, query: '?url', import: 'default' });

/** ロゴの字の高さ（カードの幅に対する割合。AY の文字の大きさ〔0.15〕の字の高さに合わせる） */
const LOGO_GLYPH_H = 0.135;
/** ロゴの字の上のはし（カードの幅に対する割合） */
const LOGO_GLYPH_TOP = 0.04;

type Glyph = { readonly left: number; readonly top: number; readonly height: number };

/** そのモンスター・いまの言語のロゴ（無ければ undefined。英語のロゴは 2026-11-05 指示書 BC から） */
export function cardNameLogo(monsterId: string): { url: string; logo: CardNameLogo; glyph: Glyph } | undefined {
  const en = getLanguage() === 'en';
  const logo = (en ? CARD_NAME_LOGOS_EN : CARD_NAME_LOGOS)[monsterId];
  const url = logo ? LOGO_URLS[`/assets/images/ui/card_name/logos/${logo.file}`] : undefined;
  return logo && url ? { url, logo, glyph: en ? LOGO_GLYPH_EN : LOGO_GLYPH } : undefined;
}

/**
 * 正式カードの左上に、モンスターの名前を出す層。width＝カードの幅（px）。
 * - 日本語でロゴの絵があるとき（2026-11-05 指示書 AZ【7】）：ロゴの絵を、字の部分（原本の左 40px・上 55px・高さ 170px）が
 *   AY で決めた名前の位置と大きさ（左 4.3％・字の高さ 13.5％）になるように置く。LIFE の札の手前（74％）に入りきらなければ縮める。
 *   下にスウッシュをカードの枠の色に染めて、字の幅に合わせて置く
 * - 英語もロゴ（2026-11-05 指示書 BC。字の上 48px）。ロゴの無いモンスター（これから足す子）は AY の文字（ふつうの字体）。長い名前は自動で小さくする（fitCardName）
 */
export function cardNameLayer(monster: MonsterCard, width: number): HTMLElement {
  const found = cardNameLogo(monster.id);
  if (found) return logoLayer(found.url, found.logo, found.glyph, width);
  const name = cardName(monster);
  const en = getLanguage() === 'en';
  const text = h('span', { class: 'card-name__text', text: name, attrs: { lang: en ? 'en' : 'ja' } });
  const box = h(
    'div',
    { class: `card-name${en ? ' card-name--en' : ''}`, attrs: { 'aria-hidden': 'true' } },
    SWOOSH_WHITE ? h('img', { class: 'card-name__swoosh', attrs: { src: SWOOSH_WHITE, alt: '', draggable: 'false' } }) : null,
    text,
  );
  box.style.setProperty('--card-w', `${width}px`);
  box.style.left = `${CARD_NAME_BOX.left * 100}%`;
  box.style.top = `${CARD_NAME_BOX.top * 100}%`;
  box.style.width = `${(CARD_NAME_BOX.right - CARD_NAME_BOX.left) * 100}%`;
  text.style.fontSize = `${CARD_NAME_BOX.fontSize * width}px`;
  fitCardName(box);
  return box;
}

function logoLayer(url: string, logo: CardNameLogo, glyph: Glyph, width: number): HTMLElement {
  const left = CARD_NAME_BOX.left * width;
  const right = CARD_NAME_BOX.right * width;
  // 原本の px → 画面の px。字の幅（字の左はし〜絵の右はし）が LIFE の札の手前に入りきらなければ縮める
  const glyphW = logo.x + logo.w - glyph.left;
  const k = Math.min((LOGO_GLYPH_H * width) / glyph.height, (right - left) / glyphW);
  const top = LOGO_GLYPH_TOP * width;
  const img = h('img', { class: 'card-name__logo', attrs: { src: url, alt: '', draggable: 'false' } });
  img.style.left = `${left - (glyph.left - logo.x) * k}px`;
  img.style.top = `${top - (glyph.top - logo.y) * k}px`;
  img.style.width = `${logo.w * k}px`;
  img.style.height = `${logo.h * k}px`;
  // スウッシュ（指示書 BA【3】）：前の名前入りのカード（ガウル・ソラモ・ラズック）のように、ふちと先は枠の色・中心は明るい色（白〜うすい金）。
  // 枠の色の線の上に、少し細く短い明るい線を重ねる（どちらも同じ形の mask）。外側に暗い細いふち
  const tint = SWOOSH_LOGO ? h('span', { class: 'card-name__swoosh-tint' }) : null;
  const core = SWOOSH_LOGO ? h('span', { class: 'card-name__swoosh-core' }) : null;
  const swoosh = tint && core ? h('span', { class: 'card-name__swoosh-wrap' }, tint, core) : null;
  if (swoosh && tint && core && SWOOSH_LOGO) {
    const sw = glyphW * k;
    swoosh.style.left = `${left}px`;
    swoosh.style.top = `${top + glyph.height * k * 1.0}px`;
    swoosh.style.width = `${sw}px`;
    swoosh.style.height = `${sw * 0.12}px`;
    tint.style.backgroundColor = logo.frame;
    for (const el of [tint, core]) el.style.setProperty('--swoosh', `url("${SWOOSH_LOGO}")`);
  }
  return h('div', { class: 'card-name card-name--logo', attrs: { 'aria-hidden': 'true' } }, swoosh, img);
}

/** 名前が枠に入りきらなければ文字を小さくする（画面に置かれてから・字体を読んでから測る） */
export function fitCardName(box: HTMLElement, tries = 20): void {
  const run = (): void => {
    if (!box.isConnected) {
      if (tries-- > 0) requestAnimationFrame(run);
      return;
    }
    const text = box.querySelector<HTMLElement>('.card-name__text');
    if (!text) return;
    const width = parseFloat(box.style.getPropertyValue('--card-w')) || box.parentElement?.clientWidth || 0;
    // 英語の字体は字の大きさの見え方がちがうので倍率（cardName.css の --card-name-en-scale）
    const enScale = box.classList.contains('card-name--en') ? parseFloat(getComputedStyle(box).getPropertyValue('--card-name-en-scale')) || 1 : 1;
    const base = CARD_NAME_BOX.fontSize * width * enScale;
    text.style.fontSize = `${base}px`;
    const max = box.clientWidth;
    const used = text.scrollWidth;
    if (max > 0 && used > max) text.style.fontSize = `${Math.max(base * 0.4, (base * max) / used)}px`;
    const swoosh = box.querySelector<HTMLElement>('.card-name__swoosh');
    if (swoosh) swoosh.style.width = `${Math.min(max * 1.04, text.scrollWidth * 1.02)}px`;
  };
  run();
  document.fonts?.ready.then(() => requestAnimationFrame(run)).catch(() => {});
  document.fonts?.addEventListener('loadingdone', () => requestAnimationFrame(run), { once: true });
}
