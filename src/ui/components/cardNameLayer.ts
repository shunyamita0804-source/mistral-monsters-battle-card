import { CARD_NAME_BOX } from '../../data/cardNames.ts';
import type { MonsterCard } from '../../game/cards/cardTypes.ts';
import { cardName } from '../../i18n/content.ts';
import { getLanguage } from '../../i18n/i18n.ts';
import { h } from '../dom.ts';

/** 名前の下の白いスウッシュ（指示書 AY の素材 name_swoosh_white.png〔900×160〕の線の所だけ切り抜いて WebP に。464×56） */
const SWOOSH = Object.values(import.meta.glob<string>('/assets/images/ui/card_name/name_swoosh_white.*', { eager: true, query: '?url', import: 'default' }))[0];

/**
 * 正式カードの左上に、モンスターの名前を書く層（2026-11-05 指示書 AY【3】）。width＝カードの幅（px）。
 * 大きさ・位置はカードの幅に対する割合（CARD_NAME_BOX）。長い名前は左上の札の左はし〜LIFE の札の手前に収まるよう自動で小さくする（fitCardName）。
 * 文字は画面で書く（画像にしない）。字体は 3案（html の data-card-font。cardNames.ts）
 */
export function cardNameLayer(monster: MonsterCard, width: number): HTMLElement {
  const name = cardName(monster);
  const en = getLanguage() === 'en';
  const text = h('span', { class: 'card-name__text', text: name, attrs: { lang: en ? 'en' : 'ja' } });
  const box = h(
    'div',
    { class: `card-name${en ? ' card-name--en' : ''}`, attrs: { 'aria-hidden': 'true' } },
    SWOOSH ? h('img', { class: 'card-name__swoosh', attrs: { src: SWOOSH, alt: '', draggable: 'false' } }) : null,
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
    // 英語の字体は字の大きさの見え方がちがうので、案ごとの倍率（cardName.css の --card-name-en-scale）
    const enScale = box.classList.contains('card-name--en') ? parseFloat(getComputedStyle(box).getPropertyValue('--card-name-en-scale')) || 1 : 1;
    const base = CARD_NAME_BOX.fontSize * width * enScale;
    text.style.fontSize = `${base}px`;
    const max = box.clientWidth;
    const used = text.scrollWidth;
    if (max > 0 && used > max) text.style.fontSize = `${Math.max(base * 0.4, (base * max) / used)}px`;
    // スウッシュは文字の幅に合わせる
    const swoosh = box.querySelector<HTMLElement>('.card-name__swoosh');
    if (swoosh) swoosh.style.width = `${Math.min(max * 1.04, text.scrollWidth * 1.02)}px`;
  };
  run();
  // 字体を読み終えたら測り直す（読む前の字体で測ると幅がちがう）
  document.fonts?.ready.then(() => requestAnimationFrame(run)).catch(() => {});
  document.fonts?.addEventListener('loadingdone', () => requestAnimationFrame(run), { once: true });
}
