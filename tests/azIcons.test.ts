import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARD_NAME_LOGOS, LOGO_GLYPH } from '../src/data/cardNameLogos.generated.ts';
import { NAMELESS_OFFICIAL_ART } from '../src/data/cardNames.ts';

/** 指示書 AZ（2026-11-05）：状態・居場所・場のアイコン、カードの名前のロゴ */

const USED = ['b01', 'b02', 'b03', 'b04', 'b05', 'b07', 'b09', 'b13', 's07', 's08', 's09', 's10', 's12', 's13', 'e01', 'e02', 'e03', 'e04', 'e05', 'e06', 't01', 't02', 't03', 'n01', 'n02'];

describe('指示書 AZ', () => {
  it('アイコン：ゲームで使う分の WebP と、43点の原本がある。使わないアイコン（S02〜S06・E08 など）はゲームに入れない', () => {
    for (const id of USED) expect(existsSync(`assets/images/ui/status/icon_${id}.webp`), id).toBe(true);
    // 2026-11-05 指示書 BB：e13（場の効果）・b11（回復）は技カードの効果に使うので入れた
    for (const id of ['s02', 's03', 's04', 's05', 's06', 'e08', 'e09', 'e11', 'e14', 'n03', 'n05', 'b06', 'b08']) {
      expect(existsSync(`assets/images/ui/status/icon_${id}.webp`), id).toBe(false);
      expect(existsSync(`design-parts/status-icons-20261105/${id.toUpperCase()}.png`), id).toBe(true);
    }
  });

  it('名前のロゴ：名前を消した絵の20体すべてにある。枠の色（スウッシュの色）がある', () => {
    expect(Object.keys(CARD_NAME_LOGOS).sort()).toEqual([...NAMELESS_OFFICIAL_ART].sort());
    for (const [id, logo] of Object.entries(CARD_NAME_LOGOS)) {
      expect(existsSync(`assets/images/ui/card_name/logos/${logo.file}`), id).toBe(true);
      expect(logo.frame, id).toMatch(/^#[0-9A-F]{6}$/);
      // 字の部分（左 40・上 55・高さ 170）が切り抜いた絵の中にある
      expect(logo.x, id).toBeLessThanOrEqual(LOGO_GLYPH.left);
      expect(logo.y, id).toBeLessThanOrEqual(LOGO_GLYPH.top);
      expect(logo.y + logo.h, id).toBeGreaterThanOrEqual(LOGO_GLYPH.top + LOGO_GLYPH.height);
    }
    expect(existsSync('assets/images/ui/card_name/name_swoosh.webp')).toBe(true);
  });
});
