// 街・部屋の画面の中心を、人の前に立ったときだけ寄せる計算（2026-10-29 iPhone の試遊「受付カウンターが画面の外に切れる」）。
// 使う所：worldScreen.ts（寄せる所は src/data/maps.ts の CAMERA_LEANS）
import type { Point } from '../../game/world/world.ts';

/** 受付の前で画面の中心を寄せるとき、カウンターと画面のふちのあいだに残すすき間（px） */
export const CAMERA_LEAN_MARGIN = 12;

/** 画面の中心（px）を、主人公（focus）とマスの範囲 r の真ん中の中間へ。r がはみ出すときは収まる所まで（r が画面より大きいときは r の真ん中） */
export function leanFocus(focus: Point, r: { x: number; y: number; w: number; h: number }, unit: number, vw: number, vh: number): Point {
  const axis = (f: number, start: number, size: number, view: number): number => {
    const a = start * unit;
    const b = (start + size) * unit;
    const mid = (f + (a + b) / 2) / 2;
    if (b - a + CAMERA_LEAN_MARGIN * 2 > view) return (a + b) / 2;
    return Math.min(Math.max(mid, b + CAMERA_LEAN_MARGIN - view / 2), a - CAMERA_LEAN_MARGIN + view / 2);
  };
  return { x: axis(focus.x, r.x, r.w, vw), y: axis(focus.y, r.y, r.h, vh) };
}
