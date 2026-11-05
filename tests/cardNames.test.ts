import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NAMELESS_OFFICIAL_ART } from '../src/data/cardNames.ts';
import { MONSTERS, QA_MONSTERS } from '../src/data/cards.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/** 指示書 AY（2026-11-05）：モンスターカードの名前をゲームが書く。字体は使う文字だけに減らした WOFF2（tools/art/card_name_fonts.py） */

// 2026-11-05 指示書 AZ：英語の仮の字体 Bangers だけ残す（日本語はロゴの絵）
const FONTS = ['bangers'];
const official = [...MONSTERS, ...QA_MONSTERS].filter((m) => !m.isPlaceholder && m.art);

describe('モンスターカードの名前', () => {
  it('英語の字体 Bangers とライセンスの文がある（OFL 1.1）。ほかの案の字体はビルドに入れない', () => {
    for (const f of ['reggae-one', 'dela-gothic-one', 'yuji-boku', 'bungee', 'permanent-marker']) expect(existsSync(`assets/fonts/card-name/${f}.woff2`), f).toBe(false);
    for (const f of FONTS) {
      expect(existsSync(`assets/fonts/card-name/${f}.woff2`), f).toBe(true);
      expect(existsSync(`assets/fonts/card-name/license_${f}.txt`), f).toBe(true);
    }
  });

  it('日本語の名前はカタカナ（減らした日本語の字体に入っている文字）、英語の名前はラテン文字だけ', () => {
    for (const m of official) expect(cardName(m), m.id).toMatch(/^[ァ-ヶー・仮]+$/);
    setLanguage('en');
    try {
      for (const m of official) expect(cardName(m), m.id).toMatch(/^[\x20-\x7E]+$/);
    } finally {
      setLanguage('ja');
    }
  });

  it('名前を消した絵に差し替えたモンスターは、正式カードの絵があるモンスターだけ', () => {
    for (const id of NAMELESS_OFFICIAL_ART) expect(official.some((m) => m.id === id), id).toBe(true);
  });
});
