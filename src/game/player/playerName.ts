/**
 * 主人公の名前（2026-10-28 ユーザー決定）。画面に依存しない決まりだけをここに置く（入力の画面は src/ui/components/namePrompt.ts）。
 *
 * - 最大8文字。見た目の1文字（書記素）を1文字と数える（「が」に濁点を分けて入れても、国旗のような合成文字でも1文字）
 * - 前後の空白（半角・全角）は消す。間の空白はそのまま
 * - 絵文字と、表示やセーブを壊すおそれのある記号（< > / \ & " ' ` など）・目に見えない制御文字は入れない
 */
export const MAX_NAME_LENGTH = 8;

/** 入れられない記号（HTML・パス・引用符に使う記号） */
const FORBIDDEN_SYMBOLS = /[<>/\\&"'`]/gu;
/** 絵文字（絵文字の部品：異体字セレクタ・結合用の文字・肌の色・国旗の文字・キーキャップも含む） */
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}\uFE0E\uFE0F\u20E3\u200D]/gu;
/** 制御文字・書式の文字（改行・タブ・文字の向きを変える文字など）。空白は別に扱う */
const CONTROL = /[\p{Cc}\p{Cf}\p{Co}\u2028\u2029]/gu;

/** 見た目の1文字ずつに分ける（Intl.Segmenter が無い古い環境では、コードポイントごと） */
export function graphemes(text: string): string[] {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter('ja', { granularity: 'grapheme' }).segment(text), (s) => s.segment);
  return Array.from(text);
}

/** 見た目の文字数 */
export function nameLength(text: string): number {
  return graphemes(text).length;
}

/** 入れられない文字を取りのぞく（入力の途中でも使う。前後の空白と長さはそのまま） */
export function stripForbidden(text: string): string {
  return text.replace(EMOJI, '').replace(FORBIDDEN_SYMBOLS, '').replace(CONTROL, '');
}

/** 入力の途中：入れられない文字を取りのぞき、8文字を超えた分を切る（前後の空白はまだ消さない） */
export function limitNameInput(text: string): string {
  const clean = stripForbidden(text);
  const chars = graphemes(clean);
  return chars.length > MAX_NAME_LENGTH ? chars.slice(0, MAX_NAME_LENGTH).join('') : clean;
}

/** 決めるときの名前：入れられない文字を取りのぞき、前後の空白を消し、8文字まで。何も残らなければ空文字 */
export function normalizeName(text: string): string {
  const trimmed = stripForbidden(text).trim();
  const chars = graphemes(trimmed);
  return (chars.length > MAX_NAME_LENGTH ? chars.slice(0, MAX_NAME_LENGTH).join('') : trimmed).trim();
}

/** 決められる名前か（1文字以上） */
export function canDecideName(text: string): boolean {
  return normalizeName(text).length > 0;
}

/** セーブから読んだ名前（正しくなければ null＝まだ決めていない） */
export function readSavedName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = normalizeName(value);
  return name.length > 0 ? name : null;
}
