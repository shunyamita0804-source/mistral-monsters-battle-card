import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { GACHA_SERIES } from '@/data/economy.ts';

/** webp の絵の大きさ（VP8X の見出しから読む。透過の webp は VP8X） */
function webpSize(path: string): { width: number; height: number } {
  const b = readFileSync(path);
  expect(b.toString('ascii', 12, 16)).toBe('VP8X');
  return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
}

describe('ガチャのパック7つ（2026-10-29 新しい型）', () => {
  it('どのシリーズにもパックの絵がある（無地の pack_sealed で出るシリーズが無い。道具のパック〔2026-10-30 指示書 Y〕は絵がまだ無いので封をしたパックで出す）。大きさは 600×1080', () => {
    for (const s of GACHA_SERIES.filter((x) => !x.cardIds)) {
      const file = `assets/images/ui/gacha/pack_${s.id}.webp`;
      expect(existsSync(file), file).toBe(true);
      expect(webpSize(file), file).toEqual({ width: 600, height: 1080 });
    }
  });

  it('場の状態の印の絵がある', () => {
    for (const n of ['status_charged', 'status_tailwind']) expect(existsSync(`assets/images/ui/battle/${n}.webp`)).toBe(true);
  });
});
