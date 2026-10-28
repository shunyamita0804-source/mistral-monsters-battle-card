import { describe, expect, it } from 'vitest';
import { fitValueFont } from '../src/ui/components/valueFit.ts';

describe('技カードの数値の欄の文字の大きさ（数字 1.4倍。はみ出すときは収まる大きさまで下げる）', () => {
  it('1けたの数字は目標の大きさのまま', () => {
    expect(fitValueFont(21, 25.7, 0.62)).toBe(21);
  });

  it('2けたの数字は欄の幅の 90% に収まる大きさまで下げる', () => {
    const size = fitValueFont(21, 25.7, 1.3);
    expect(size).toBeLessThan(21);
    expect(size * 1.3).toBeCloseTo(25.7 * 0.9, 5);
  });

  it('盾と「-3」：盾（文字の 0.4 倍）とすき間も入れて収める', () => {
    const size = fitValueFont(21, 25.7, 1.0, 0.4, 0.5);
    expect(size * (1.0 + 0.4) + 0.5).toBeLessThanOrEqual(25.7 * 0.9 + 1e-9);
  });
});
