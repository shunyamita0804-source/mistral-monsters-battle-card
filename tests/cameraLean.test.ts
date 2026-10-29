import { describe, expect, it } from 'vitest';
import { CAMERA_LEAN_MARGIN, leanFocus } from '@/ui/components/cameraLean.ts';
import { CAMERA_LEANS, HALL } from '@/data/maps.ts';

describe('受付の前で画面の中心を寄せる（2026-10-29）', () => {
  it('寄せるのは大会会場のセリアの前だけ。カウンターの範囲は部屋の中', () => {
    expect(CAMERA_LEANS.map((l) => `${l.mapId}:${l.npcId}`)).toEqual(['hall:hall-receptionist']);
    const t = CAMERA_LEANS[0]!.target;
    expect(HALL.objects.some((o) => o.id === 'hall-receptionist')).toBe(true);
    expect(t.x).toBeGreaterThan(0);
    expect(t.x + t.w).toBeLessThanOrEqual(HALL.art?.cols ?? 0);
    expect(t.y + t.h).toBeLessThanOrEqual(HALL.art?.rows ?? 0);
  });

  it('収まるときは主人公と範囲の真ん中の中間', () => {
    const p = leanFocus({ x: 100, y: 100 }, { x: 10, y: 10, w: 2, h: 2 }, 10, 400, 800);
    expect(p).toEqual({ x: 105, y: 105 });
  });

  it('中間だと範囲がはみ出すときは、収まる所まで寄せる', () => {
    // 範囲 300〜600px・画面の幅 390：中間（250）では右のはしがはみ出す
    const p = leanFocus({ x: 50, y: 400 }, { x: 3, y: 4, w: 3, h: 1 }, 100, 390, 800);
    expect(p.x + 390 / 2).toBeGreaterThanOrEqual(600 + CAMERA_LEAN_MARGIN);
    expect(p.x - 390 / 2).toBeLessThanOrEqual(300 - CAMERA_LEAN_MARGIN);
  });

  it('範囲が画面より大きいときは範囲の真ん中', () => {
    expect(leanFocus({ x: 0, y: 0 }, { x: 0, y: 0, w: 10, h: 1 }, 100, 390, 800).x).toBe(500);
  });
});
