import { describe, expect, it } from 'vitest';
import { QA_SKILLS, SKILLS } from '../src/data/cards.ts';
import { ICON_EFFECT_TEXTS, skillEffectIcons } from '../src/ui/effectIcons.ts';
import { t, setLanguage } from '../src/i18n/i18n.ts';
import type { MessageKey } from '../src/i18n/messages/index.ts';

/** 指示書 BA【4】（2026-11-05）：技カードの効果のアイコン */

const official = [...SKILLS, ...QA_SKILLS].filter((k) => !k.isPlaceholder);

describe('技カードの効果のアイコン', () => {
  it('アイコンにする効果の文は、どれも今の技に使われている。効果2つ（ちから技・かしこさ技に効く）はアイコン2つ', () => {
    for (const text of ICON_EFFECT_TEXTS) expect(official.some((k) => k.effectTextJa === text), text).toBe(true);
    const both = official.find((k) => k.effectTextJa === 'ちから技・かしこさ技に効く');
    expect(both && skillEffectIcons(both)).toEqual(['e05', 'e06']);
    const gaze = official.find((k) => k.id === 'skl-tyrant-09');
    expect(gaze && skillEffectIcons(gaze)).toBeNull();
  });

  it('アイコンの意味の文が日本語・英語である', () => {
    for (const id of ['e01', 'e02', 'e03', 'e04', 'e05', 'e06']) {
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
