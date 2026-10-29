import { describe, expect, it } from 'vitest';
import { phrases } from '../src/ui/phraseText.ts';

/** 区切りの所（文節の切れ目）が「前の語のおわり／次の語のはじめ」の間にあるか */
const breaksInside = (text: string, word: string): boolean => {
  let at = 0;
  for (const p of phrases(text)) {
    const start = at;
    at += p.length;
    const w = text.indexOf(word);
    if (start > w && start < w + word.length) return true;
  }
  return false;
};

describe('文節の区切りで改行する（phraseText）', () => {
  it('つなげるともとの文にもどる', () => {
    const text = 'ちからで2ダメージ。相手全員に当たる（守りは1体ずつ）';
    expect(phrases(text).join('')).toBe(text);
  });

  it('ユーザーが見つけた語の途中で区切らない', () => {
    expect(breaksInside('ちからで2ダメージ。相手全員に当たる（守りは1体ずつ）', '1体ずつ')).toBe(false);
    expect(breaksInside('次のターン、最初のかしこさ技のダメージ2倍', 'かしこさ')).toBe(false);
    expect(breaksInside('味方への攻撃を代わりに受ける', '受ける')).toBe(false);
    expect(breaksInside('ちから技・かしこさ技のダメージを5軽減', 'ダメージ')).toBe(false);
  });

  it('改行の文字はそのまま残す', () => {
    expect(phrases('相手のマナを1減らす\n回避されない')).toContain('\n');
  });

  it('英語はそのまま（ふつうの単語の区切り）', () => {
    expect(phrases('Deals 2 damage to all enemies')).toEqual(['Deals 2 damage to all enemies']);
  });
});
