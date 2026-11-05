import { CARD_NAME_BOX } from '../../data/cardNames.ts';
import { CARD_NAME_LOGOS, LOGO_GLYPH } from '../../data/cardNameLogos.generated.ts';
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

/** そのモンスター・いまの言語のロゴ（無ければ undefined。英語のロゴはまだ無い） */
export function cardNameLogo(monsterId: string): { url: string; logo: (typeof CARD_NAME_LOGOS)[string] } | undefined {
  if (getLanguage() !== 'ja') return undefined;
  const logo = CARD_NAME_LOGOS[monsterId];
  const url = logo ? LOGO_URLS[`/assets/images/ui/card_name/logos/${logo.file}`] : undefined;
  return logo && url ? { url, logo } : undefined;
}

/**
 * 正式カードの左上に、モンスターの名前を出す層。width＝カードの幅（px）。
 * - 日本語でロゴの絵があるとき（2026-11-05 指示書 AZ【7】）：ロゴの絵を、字の部分（原本の左 40px・上 55px・高さ 170px）が
 *   AY で決めた名前の位置と大きさ（左 4.3％・字の高さ 13.5％）になるように置く。LIFE の札の手前（74％）に入りきらなければ縮める。
 *   下にスウッシュをカードの枠の色に染めて、字の幅に合わせて置く
 * - それ以外（英語・ロゴの無いモンスター）：AY の文字（仮の英語の字体 Bangers）。長い名前は自動で小さくする（fitCardName）
 */
export function cardNameLayer(monster: MonsterCard, width: number): HTMLElement {
  const found = cardNameLogo(monster.id);
  if (found) return logoLayer(found.url, found.logo, width);
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

function logoLayer(url: string, logo: (typeof CARD_NAME_LOGOS)[string], width: number): HTMLElement {
  const left = CARD_NAME_BOX.left * width;
  const right = CARD_NAME_BOX.right * width;
  // 原本の px → 画面の px。字の幅（字の左はし〜絵の右はし）が LIFE の札の手前に入りきらなければ縮める
  const glyphW = logo.x + logo.w - LOGO_GLYPH.left;
  const k = Math.min((LOGO_GLYPH_H * width) / LOGO_GLYPH.height, (right - left) / glyphW);
  const top = LOGO_GLYPH_TOP * width;
  const img = h('img', { class: 'card-name__logo', attrs: { src: url, alt: '', draggable: 'false' } });
  img.style.left = `${left - (LOGO_GLYPH.left - logo.x) * k}px`;
  img.style.top = `${top - (LOGO_GLYPH.top - logo.y) * k}px`;
  img.style.width = `${logo.w * k}px`;
  img.style.height = `${logo.h * k}px`;
  const tint = SWOOSH_LOGO ? h('span', { class: 'card-name__swoosh-tint' }) : null;
  const swoosh = tint ? h('span', { class: 'card-name__swoosh-wrap' }, tint) : null;
  if (swoosh && tint && SWOOSH_LOGO) {
    const sw = glyphW * k;
    swoosh.style.left = `${left}px`;
    swoosh.style.top = `${top + LOGO_GLYPH.height * k * 1.02}px`;
    tint.style.display = 'block';
    tint.style.width = `${sw}px`;
    tint.style.height = `${sw * 0.07}px`;
    tint.style.backgroundColor = logo.frame;
    tint.style.setProperty('--swoosh', `url("${SWOOSH_LOGO}")`);
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
