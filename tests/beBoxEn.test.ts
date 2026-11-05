import { afterEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { BOOSTERS } from '../src/data/introV2.ts';
import { boosterArtUrl } from '../src/ui/components/boosterArt.ts';
import { setLanguage, t } from '../src/i18n/i18n.ts';

/** 指示書 BE（2026-11-05）：英語の箱の絵と箱の英語名 */
describe('指示書 BE', () => {
  afterEach(() => setLanguage('ja'));

  it('英語のときは英語の箱の絵、日本語のときは今の絵', () => {
    for (const b of BOOSTERS) {
      expect(existsSync(`assets/images/ui/booster/${b.art}_en.png`), b.art).toBe(true);
      const ja = boosterArtUrl(b);
      setLanguage('en');
      const en = boosterArtUrl(b);
      setLanguage('ja');
      expect(en).not.toBe(ja);
      expect(en).toContain('_en');
    }
  });

  it('箱の英語名（ユーザー決定）。日本語の名前は同じ', () => {
    setLanguage('en');
    expect([t('introV2.pack.name.1'), t('introV2.pack.name.2'), t('introV2.pack.name.3')]).toEqual(["Journey's Spark", 'Blazing Onslaught', 'Azure Guard']);
    setLanguage('ja');
    expect([t('introV2.pack.name.1'), t('introV2.pack.name.2'), t('introV2.pack.name.3')]).toEqual(['旅立ちのきらめき', '烈火の猛攻', '蒼海の守り']);
  });
});
