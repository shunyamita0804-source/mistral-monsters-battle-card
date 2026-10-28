/**
 * 手札の列の重ね方（2026-10-28 手札の大きさの指示書）。DOM を使わない計算だけ。
 * カードの大きさは変えず、入りきらないときは隣のカードとの間を詰めて（マイナスの間＝重ねて）1列に入れる。
 * 1枚ずつの見える幅（次のカードの左はしまで）は minStep より小さくしない（指で1枚ずつ選べるように）
 */

/**
 * 隣のカードとの間の調整（論理px。0 ＝重ねない、マイナス＝その分だけ重ねる）。
 * n：枚数、cardW：カード1枚の幅、gap：ふだんのすき間、room：列に使える幅
 */
export function handOverlap(n: number, cardW: number, gap: number, room: number, minStep: number): number {
  if (n <= 1) return 0;
  const need = n * cardW + (n - 1) * gap;
  if (need <= room) return 0;
  const step = Math.max(minStep, (room - cardW) / (n - 1));
  return step - cardW - gap;
}

/** 1枚ずつの見える幅（次のカードの左はしまで。論理px） */
export function handStep(cardW: number, gap: number, overlap: number): number {
  return cardW + gap + overlap;
}
