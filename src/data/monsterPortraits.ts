/**
 * 対戦画面のモンスターのアイコン（正方形）の切り抜き位置（2026-10-25 バトル画面リデザイン。PS版のように、モンスターをカードではなく顔〜上半身のアイコンで見せる）。
 *
 * 絵はバトル用の絵（battleArt。無ければ仮の絵）をそのまま使い、表示のときに切り抜くだけ（素材のファイルは変えない）。
 * - x・y：アイコンの真ん中に来る、絵の中の位置（0〜1。左上が 0）
 * - zoom：アイコンの幅に対する絵の幅の倍率（1＝絵の幅がアイコンの幅。大きいほど寄る。縁の飾りが入らないよう 1.3 以上）
 * 見え方を直したいときは、ここの数字だけ変える
 */
export interface PortraitFocus {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

/** 決めていないモンスターの切り抜き（絵の上のほう＝顔のあたり） */
export const DEFAULT_PORTRAIT_FOCUS: PortraitFocus = { x: 0.5, y: 0.34, zoom: 1.4 };

export const PORTRAIT_FOCUS: Readonly<Record<string, PortraitFocus>> = {
  'mon-soramo': { x: 0.45, y: 0.36, zoom: 1.5 },
  'mon-lazuck': { x: 0.56, y: 0.36, zoom: 1.5 },
  'mon-gauul': { x: 0.64, y: 0.38, zoom: 1.4 },
  'mon-nobiton': { x: 0.52, y: 0.36, zoom: 1.3 },
  'mon-myurol': { x: 0.5, y: 0.3, zoom: 1.6 },
  'mon-kalshell': { x: 0.5, y: 0.4, zoom: 1.4 },
  'mon-pukarim': { x: 0.5, y: 0.42, zoom: 1.4 },
  'mon-geol': { x: 0.5, y: 0.38, zoom: 1.4 },
  // フルーネ（2026-10-29）：顔は絵の少し右上（花びらの冠の下）
  'mon-flune': { x: 0.57, y: 0.3, zoom: 1.5 },
  // セレフィーン（2026-10-29）：顔は絵の上のほうの真ん中（体が縦に長いので、ほかより寄せて上へ）
  'mon-serephine': { x: 0.5, y: 0.22, zoom: 1.9 },
  // ツムジ（2026-10-30）：とびかかる形で、顔は絵の下のほうの少し右
  'mon-tsumuji': { x: 0.58, y: 0.66, zoom: 1.6 },
  // ヒョウズク（2026-10-30 指示書 W）：顔は絵の上のほうの少し右
  'mon-hyouzuku': { x: 0.64, y: 0.34, zoom: 1.6 },
};

export function portraitFocus(monsterId: string): PortraitFocus {
  return PORTRAIT_FOCUS[monsterId] ?? DEFAULT_PORTRAIT_FOCUS;
}
