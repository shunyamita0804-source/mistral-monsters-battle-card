import { describe, expect, it } from 'vitest';
import { handOverlap, handStep } from '../src/ui/components/handLayout.ts';

// 390 の画面：列に使える幅 378（左右の余白 6）、カードの幅 90（＋ふち 4）、すき間 3
const CARD = 94;
const GAP = 3;
const ROOM = 378;

describe('手札の重ね方（幅 90 のまま。2026-10-28 手札の大きさの指示書）', () => {
  it('3枚までは重ねない（入りきる）。4枚から少しずつ重ねる', () => {
    expect(handOverlap(3, CARD, GAP, ROOM, 28)).toBe(0);
    expect(handOverlap(4, CARD, GAP, ROOM, 28)).toBeLessThan(0);
  });

  it('5枚・7枚・10枚は全部を1列に入れ、カードの左はし（幅の 35%）は隠さない', () => {
    for (const n of [5, 7, 10]) {
      const o = handOverlap(n, CARD, GAP, ROOM, 28);
      expect(o).toBeLessThan(0);
      // 右はしのカードの右はしが列の幅に収まる
      expect(handStep(CARD, GAP, o) * (n - 1) + CARD).toBeCloseTo(ROOM, 5);
      expect(handStep(CARD, GAP, o)).toBeGreaterThanOrEqual(90 * 0.35);
    }
  });

  it('とても多いときも、1枚ずつ指で選べる幅（28px）は残す', () => {
    const o = handOverlap(20, CARD, GAP, ROOM, 28);
    expect(handStep(CARD, GAP, o)).toBe(28);
  });
});
