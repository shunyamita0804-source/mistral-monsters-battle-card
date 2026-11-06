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

  it('2026-11-06 指示書 BK【2】：防御・回避の文はそろえた形。数字・条件はカードの動きと同じ（かばう・みがわり・0にする は特別な守り）', () => {
    const STAT = { force: 'ちから技', wisdom: 'かしこさ技', all: 'ちから技、かしこさ技' } as const;
    let guards = 0;
    let dodges = 0;
    for (const card of cardCatalog.all()) {
      if (card.kind !== 'skill' || card.isPlaceholder) continue;
      const e = card.effect;
      if (e.type === 'defense' && !e.nullify) {
        guards++;
        expect(card.effectTextJa, card.id).toBe(`${STAT[e.against ?? 'all']}の受けるダメージを${e.reduce}減らす。`);
      }
      if (e.type === 'evade') {
        dodges++;
        expect(card.effectTextJa, card.id).toBe(`${e.minCost ? `マナ${e.minCost}以上の` : ''}${STAT[e.against ?? 'all']}を回避する。`);
      }
      // 前の言い方が残っていない
      expect(card.effectTextJa ?? '', card.id).not.toMatch(/に効く$|条件なしで回避|マナに関係なく|を回避$/);
    }
    expect(guards).toBeGreaterThan(20);
    expect(dodges).toBeGreaterThan(20);
    expect(getSkill('skl-kalshell-13').effectTextJa).toBe('ちから技、かしこさ技の受けるダメージを0にする。');
    expect(getSkill('skl-geol-11').effectTextJa).toBe('味方への攻撃を代わりに受ける。');
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
