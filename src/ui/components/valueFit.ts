/**
 * 技カードの左下の欄（数値の欄）の文字の大きさ（2026-10-28 手札の大きさの指示書：数字を 1.4倍に）。
 * 欄の幅は決まっているので、2けたの数字・盾と「-3」・英語の長い語などは、欄に収まる大きさまで下げる。
 * 大きさはすべてカードの幅に対する割合（cqw）。DOM を使わない計算だけ（文字の幅は呼ぶ側が測って渡す）
 */

/** 数値の欄の文字の大きさ（ゆとりを見て欄の幅の 90% に収める） */
export const VALUE_ROOM_RATIO = 0.9;

/**
 * 文字の大きさ：base（目標の大きさ）を超えず、欄に収まるいちばん大きい値。
 * textEm：文字列の幅（文字の大きさ 1 あたり）、perSize：文字の大きさに比例して並ぶもの（盾の絵）の幅、fixed：大きさに関係ない幅（すき間）
 */
export function fitValueFont(base: number, boxWidth: number, textEm: number, perSize = 0, fixed = 0): number {
  const room = boxWidth * VALUE_ROOM_RATIO - fixed;
  const per = textEm + perSize;
  if (per <= 0) return base;
  return Math.max(0, Math.min(base, room / per));
}
