import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 2026-11-02 指示書 AW：iPhone の試遊で見つかった画面の直し6つ。見た目は写真（docs/design/aw-screen-fixes-20261102/）で確かめ、
 * ここでは、もどってしまわないように決まりだけ見る
 */
const css = (f: string): string => readFileSync(`src/ui/styles/${f}`, 'utf8');

describe('指示書 AW：画面の直し', () => {
  it('【1】技カードを選ぶ：−・枚数・＋の欄は同じ幅（--deck-step。押しやすい 44px と同じ）。前の 36px の欄は使わない', () => {
    const s = css('screens.css');
    expect(s).toContain('grid-template-columns: 1fr var(--deck-step) var(--deck-step) var(--deck-step) 32px;');
    expect(s).not.toContain('grid-template-columns: 1fr 36px 36px 36px 40px;');
    expect(s).toMatch(/\.deck__item--card \.deck__row-count \{[^}]*box-sizing: border-box;[^}]*width: var\(--deck-step\);/);
  });

  it('【2】大きなカードの台は左の枠が広い絵（stand_tall.webp。窓 225×335 はカード 253×382 と同じくらいの縦横比）。カードは台の幅の割合で決める', () => {
    expect(existsSync('assets/images/ui/deck/stand_tall.webp')).toBe(true);
    expect(225 / 335).toBeGreaterThan((253 / 382) * 0.98);
    const s = css('uiParts10.css');
    expect(s).toContain("url('@assets/images/ui/deck/stand_tall.webp')");
    expect(s).toContain('aspect-ratio: 720 / 400;');
    expect(s).toMatch(/\.deck-preview > \.skill-card \{[^}]*width: 29\.6% !important;/);
  });

  it('【3】デッキ編集の表：数字の欄は板のくぼみ（65〜74.5・76〜85.5・87〜97%）に合わせる', () => {
    const s = css('uiParts10.css');
    expect(s).toContain('grid-template-columns: 63.5% 9.5% 9.5% 10%;');
    expect(s).toContain('column-gap: 1.5%;');
  });

  it('【4】ガチャの機械は前の約7割（231px）。つまみのつかめる所は広げた', () => {
    const s = css('gacha.css');
    expect(s).toContain('width: min(231px, 70cqw, calc(70cqh * 900 / 1300));');
    expect(s).toMatch(/\.gacha-machine__knob::before \{[^}]*inset: -65%;/);
  });

  it('【5】名札はすべて名札の層（.world__labels）に入れ、地図のいちばん最後・いちばん上に置く', () => {
    const ts = readFileSync('src/ui/screens/worldScreen.ts', 'utf8');
    const add = ts.slice(ts.indexOf('  #addLabels(): void {'), ts.indexOf('  #objectElement(obj: MapObject)'));
    expect(add).not.toContain('this.#mapLayer.append');
    expect(add.match(/this\.#labelLayer\.append\(el\)/g)).toHaveLength(2);
    // 主人公・目印のあとに名札の層を置く
    expect(ts.indexOf('this.#mapLayer.append(this.#labelLayer)')).toBeGreaterThan(ts.indexOf('this.#mapLayer.append(this.#marker)'));
    expect(css('world.css')).toMatch(/\.world__labels \{[^}]*z-index: 2147483000;/);
  });

  it('【6】名刺の台紙（街の人・対戦相手）は、せりふの欄の真ん中の飾りの横線を消した絵（消す前の絵は design-parts に残す）', () => {
    for (const file of ['namecard_town', 'namecard_opponent']) {
      const before = `design-parts/aw-screen-fixes-20261102/${file}_before.webp`;
      expect(existsSync(before), file).toBe(true);
      expect(readFileSync(`assets/images/ui/album/${file}.webp`).equals(readFileSync(before)), file).toBe(false);
    }
  });
});
