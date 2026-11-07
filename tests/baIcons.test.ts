import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { QA_SKILLS, SKILLS } from '../src/data/cards.ts';
import { skillBandText } from '../src/game/cards/cardTypes.ts';
import { ICON_EFFECT_TEXTS, skillEffectIcons } from '../src/ui/effectIcons.ts';
import { t, setLanguage } from '../src/i18n/i18n.ts';
import type { MessageKey } from '../src/i18n/messages/index.ts';

/** 指示書 BA【4】・指示書 BB（2026-11-05）：技カードの効果のアイコン */

const official = [...SKILLS, ...QA_SKILLS].filter((k) => !k.isPlaceholder);

describe('技カードの効果のアイコン', () => {
  it('アイコンにする効果の文は、どれも今の技に使われている。効果2つ（ちから技、かしこさ技の防御）はアイコン2つ', () => {
    for (const text of ICON_EFFECT_TEXTS) expect(official.some((k) => k.effectTextJa === text), text).toBe(true);
    const both = official.find((k) => k.effectTextJa === 'ちから技、かしこさ技の受けるダメージを3減らす。');
    expect(both && skillEffectIcons(both)?.map((i) => i.main)).toEqual(['e05', 'e06']);
  });

  it('指示書 BB：正式の技で効果の文があるもの（132枚）は、すべてアイコンになる（カードに文が出ない）', () => {
    const withText = official.filter((k) => skillBandText(k) !== '');
    // 2026-11-05 指示書 BH：クヨウの7枚（05・06・08・09・10・11・12）を足して139枚。指示書 BI：ラディエルの10枚を足して149枚。
    // 2026-11-06 指示書 BK：クロシオの8枚（04・06〜12）を足して157枚。指示書 BL：ロウガの6枚（04・05・08・09・11・12）で163枚。
    // 指示書 BM：フギンの8枚（05〜12）で171枚。指示書 BN：ノウスの8枚（02・04・06・08〜12）で179枚。指示書 BP：ベニオウの7枚（04〜06・09〜12）で186枚
    expect(withText.length).toBe(186);
    for (const k of withText) expect(skillEffectIcons(k), `${k.id} ${k.effectTextJa}`).not.toBeNull();
  });

  it('指示書 BB：組み立て（本体・小さな印・札）が表のとおり', () => {
    const icons = (id: string) => {
      const k = official.find((s) => s.id === id);
      return k ? skillEffectIcons(k) : undefined;
    };
    const byText = (text: string) => {
      const k = official.find((s) => s.effectTextJa === text);
      return k ? skillEffectIcons(k) : undefined;
    };
    expect(icons('skl-tyrant-09')).toEqual([{ main: 'e01', badge: { kind: 'turn', text: '1' } }]);
    expect(byText('マナ3以上のちから技、かしこさ技を回避する。')).toEqual([{ main: 'e15', badge: { kind: 'value', text: '3+' } }]);
    expect(byText('かしこさ技を回避する。')).toEqual([{ main: 'e15', marks: ['wisdom'] }]);
    // 2026-11-06 指示書 BK【2】：防御の文に数字が入っても、アイコンは前と同じ（軽減の数はカードの盾の欄）
    expect(byText('ちから技の受けるダメージを5減らす。')).toEqual([{ main: 'e05' }]);
    expect(byText('ちから技、かしこさ技の受けるダメージを0にする。')).toEqual([{ main: 'e05' }, { main: 'e06' }]);
    expect(byText('相手のマナ−4')).toEqual([{ main: 'b13', badge: { kind: 'value', text: '−4' } }]);
    expect(byText('相手の手札をすべて見て1枚選んで捨てさせる')?.map((i) => i.main)).toEqual(['e18', 'e17']);
    expect(byText('倒れている味方1体につき＋2')).toEqual([{ main: 'b09', marks: ['ko'], badge: { kind: 'value', text: '+2' } }]);
    // 同じアイコン（B13）の技どうしは、押したときの効果の文で違いが分かる
    const sneeze = official.find((s) => s.effectTextJa === '相手のマナ−1');
    const ride = official.find((s) => s.effectTextJa === '次のターン、ツムジの攻撃のマナ−1');
    expect(sneeze && ride && skillBandText(sneeze) !== skillBandText(ride)).toBe(true);
  });

  it('使うアイコンの絵がすべてある', () => {
    const mains = new Set(official.flatMap((k) => skillEffectIcons(k)?.map((i) => i.main) ?? []));
    for (const id of [...mains, 'm01', 'n01', 'n02']) expect(existsSync(`assets/images/ui/status/icon_${id}.webp`), id).toBe(true);
  });

  it('アイコンの意味の文が日本語・英語である', () => {
    for (const id of ['e01', 'e02', 'e03', 'e04', 'e05', 'e06', 'e13', 'e15', 'e17', 'e18', 'e21', 'e24', 'b11']) {
      const key = `card.fx.${id}` as MessageKey;
      expect(t(key)).not.toBe(key);
      setLanguage('en');
      try {
        expect(t(key)).toMatch(/^[\x20-\x7E]+$/);
      } finally {
        setLanguage('ja');
      }
    }
  });
});
