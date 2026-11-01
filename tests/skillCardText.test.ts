import { describe, expect, it } from 'vitest';
import { cardCatalog, getSkill, REMOVED_SKILL_IDS } from '../src/data/cards.ts';
import { SKILL_CARD_TEXT } from '../src/data/skillCardText.ts';
import { AJ_SKILLS } from '../src/data/skillRebuildAJ.ts';

/** カードに書く短い効果の文（2026-10-29 ユーザー指示。src/data/skillCardText.ts） */
describe('カードに書く短い効果の文', () => {
  it('指示書 AJ：ゲームの技の効果の文は表の文（text）。JSON の文は変えない', () => {
    for (const rows of Object.values(AJ_SKILLS)) {
      for (const row of rows) expect(getSkill(row.id).effectTextJa ?? null, row.id).toBe(row.text);
    }
  });

  it('SKILL_CARD_TEXT（前の14枚のときの短い文）の技は、今の技か、指示書 AJ で外した技', () => {
    for (const id of Object.keys(SKILL_CARD_TEXT)) {
      expect(cardCatalog.get(id)?.kind === 'skill' || REMOVED_SKILL_IDS.includes(id), id).toBe(true);
    }
  });

  it('防御の技は「どの技に効くか」だけ（軽減の数を書かない。かばうは別）', () => {
    for (const card of cardCatalog.all()) {
      if (card.kind !== 'skill' || card.isPlaceholder || card.category !== 'defense' || card.effect.type === 'cover') continue;
      expect(card.effectTextJa, card.id).toMatch(/^(マナ\d以上の)?(ちから技|かしこさ技|ちから技・かしこさ技)に効く$/);
    }
  });

  it('「重複不可」は「重ねられない」にそろえる', () => {
    for (const card of cardCatalog.all()) {
      if (card.kind === 'skill') expect(card.effectTextJa ?? '', card.id).not.toContain('重複不可');
    }
  });

  it('ユーザーが決めた文（前の14枚のときの文。SKILL_CARD_TEXT に残す）', () => {
    expect(SKILL_CARD_TEXT['skl-gauul14-14']).toBe('マナに関係なく、ちから技・かしこさ技を回避');
    expect(SKILL_CARD_TEXT['skl-pukarim-10']).toBe('プカリム以外の味方1体：次のターンの攻撃＋1');
    expect(SKILL_CARD_TEXT['skl-lazuck-itazura']).toBe('相手の手札1枚をランダムに山札へ混ぜる（補充なし）');
    expect(SKILL_CARD_TEXT['skl-myurol-08']).toBe('今と次のターン、ちから技を1軽減（重ねられない）');
    expect(SKILL_CARD_TEXT['skl-geol-10']).toBe('次のターン、最初のかしこさ技を2倍に');
  });
});
