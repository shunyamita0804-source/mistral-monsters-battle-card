import { Parser, jaModel } from 'budoux';
import { h } from './dom.ts';

/**
 * 日本語の文を文節（意味のまとまり）の区切りで改行する（2026-10-29 ユーザー指示：「1／体ずつ」「かしこ／さ」のような語の途中の改行をなくす）。
 *
 * BudouX（Google の文節の区切りの辞書。https://github.com/google/budoux）で文を区切り、区切りの所にだけ <wbr>（ここなら改行してよい印）を入れる。
 * 文字は `word-break: keep-all`（印の所でだけ改行）にする（styles/components.css の .phrase-text）。Safari でも Chrome でも同じに効く
 * （Chrome だけの `word-break: auto-phrase` は使わない）。1つの文節が1行より長いときだけ、その文節の中で改行する（overflow-wrap: anywhere）。
 * 英語など日本語の字のない文は、そのまま（ふつうの単語の区切りで改行する）。
 */
let parser: Parser | undefined;
const JA = /[぀-ヿ㐀-鿿＀-￯]/;

/** 文を文節に区切る（日本語の字のない行はそのまま1つ） */
export function phrases(text: string): string[] {
  if (!JA.test(text)) return [text];
  parser ??= new Parser(jaModel);
  return text.split('\n').flatMap((line, i) => {
    const parts = JA.test(line) ? parser!.parse(line) : [line];
    return i === 0 ? parts : ['\n', ...parts];
  });
}

/** 文節の区切りで改行する文字（span.phrase-text）。中身は文字と <wbr> だけなので、textContent はもとの文のまま */
export function phraseText(text: string, className = ''): HTMLSpanElement {
  const el = h('span', { class: className ? `phrase-text ${className}` : 'phrase-text' });
  phrases(text).forEach((p, i, all) => {
    if (i > 0 && p !== '\n' && all[i - 1] !== '\n') el.append(document.createElement('wbr'));
    el.append(p);
  });
  return el;
}
