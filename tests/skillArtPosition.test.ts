import { describe, expect, it } from 'vitest';
import { cardCatalog } from '../src/data/cards.ts';
import { SKILL_ART_X, skillArtX } from '../src/data/skillArtPosition.ts';

/** 技の絵の横の位置（2026-10-29 ユーザー指示。src/data/skillArtPosition.ts） */
describe('技の絵の横の位置', () => {
  it('ソラモ04 100%・カルシェル02 75%・カルシェル13 40%。決めていない技は 50%', () => {
    expect(skillArtX('skl-soramo14-04')).toBe(100);
    expect(skillArtX('skl-kalshell-02')).toBe(75);
    expect(skillArtX('skl-kalshell-13')).toBe(40);
    expect(skillArtX('skl-soramo14-01')).toBe(50);
    expect(Object.keys(SKILL_ART_X)).toHaveLength(3);
  });

  it('決めた技はどれも実在する技で、0〜100 の間', () => {
    for (const [id, x] of Object.entries(SKILL_ART_X)) {
      expect(cardCatalog.get(id)?.kind, id).toBe('skill');
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
    }
  });
});
