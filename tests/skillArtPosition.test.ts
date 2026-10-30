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
    // 技15枚＋サポート4枚（2026-10-30 指示書 Z）
    expect(Object.keys(SKILL_ART_X)).toHaveLength(19);
  });

  it('点検の一覧の12枚（2026-10-29 夜。案の値のまま）', () => {
    expect(skillArtX('skl-soramo14-09')).toBe(60);
    expect(skillArtX('skl-gauul14-14')).toBe(100);
    expect([1, 3, 5, 9].map((n) => skillArtX(`skl-nobiton-0${n}`))).toEqual([65, 60, 75, 60]);
    expect(skillArtX('skl-myurol-07')).toBe(65);
    expect(['03', '05', '10'].map((n) => skillArtX(`skl-pukarim-${n}`))).toEqual([70, 75, 70]);
    expect(['06', '09'].map((n) => skillArtX(`skl-geol-${n}`))).toEqual([65, 100]);
  });

  it('サポートの絵（2026-10-30 指示書 Z）：風まかせ 55・霧の香 100・声援 30・守りの陣 65。ほかは真ん中', () => {
    expect(['sup-3', 'sup-9', 'sup-10', 'sup-11'].map(skillArtX)).toEqual([55, 100, 30, 65]);
    expect(skillArtX('sup-7')).toBe(50);
  });

  it('決めた技・サポートはどれも実在するカードで、0〜100 の間', () => {
    for (const [id, x] of Object.entries(SKILL_ART_X)) {
      expect(['skill', 'support'], id).toContain(cardCatalog.get(id)?.kind);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
    }
  });
});
