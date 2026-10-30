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

/**
 * 途中で区切らない語（2026-10-29 夜 ユーザー：BudouX の結果に関係なく、この語の中では改行しない）。
 * 「ちから｜技」のように、技の種類の名前の途中で改行されていた（ウェーブダンス・星影ステップ・高速飛行の大きなカード）。
 * 2026-10-30 指示書 U：ツムジの「Wひっかき」の文で「W｜ひっかき」と切れていた
 */
export const KEEP_WORDS: readonly string[] = ['ちから技', 'かしこさ技', 'Wひっかき'];

/** 区切りの位置のうち、KEEP_WORDS の語の中にあるものを消す（となりの文節とつなげる） */
function keepWords(line: string, parts: string[]): string[] {
  const inside = new Set<number>();
  for (const w of KEEP_WORDS) {
    for (let i = line.indexOf(w); i >= 0; i = line.indexOf(w, i + 1)) {
      for (let k = i + 1; k < i + w.length; k += 1) inside.add(k);
    }
  }
  if (inside.size === 0) return parts;
  const out: string[] = [];
  let at = 0;
  for (const p of parts) {
    if (out.length > 0 && inside.has(at)) out[out.length - 1] += p;
    else out.push(p);
    at += p.length;
  }
  return out;
}

/** 文を文節に区切る（日本語の字のない行はそのまま1つ） */
export function phrases(text: string): string[] {
  if (!JA.test(text)) return [text];
  parser ??= new Parser(jaModel);
  return text.split('\n').flatMap((line, i) => {
    const parts = JA.test(line) ? keepWords(line, parser!.parse(line)) : [line];
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
