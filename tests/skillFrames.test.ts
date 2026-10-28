import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 技・サポートカードの枠（2026-10-28：v3 の絵を LAYOUT の2倍の大きさの webp で。npm run art:skillframes）。
 * 重さは前の PNG の合計（約4.6MB）より大きくしない（ユーザー指示）
 */
const DIR = 'assets/images/ui/skillcard_v5';
const frames = readdirSync(DIR).filter((f) => f.startsWith('frame_'));

/** webp の絵の大きさ（VP8X の見出しから読む） */
function webpSize(path: string): [number, number] {
  const b = readFileSync(path);
  expect(b.toString('ascii', 12, 16)).toBe('VP8X');
  return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
}

describe('技・サポートカードの枠', () => {
  it('すべて webp（前の PNG は残っていない）', () => {
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.filter((f) => !f.endsWith('.webp'))).toEqual([]);
  });

  it('分類の色・モンスターの色・サポートの枠がそろっている', () => {
    for (const size of ['normal', 'hand']) {
      expect(existsSync(`${DIR}/frame_${size}_support.webp`)).toBe(true);
      for (const c of ['force', 'wisdom', 'defense', 'evade', 'special']) {
        expect(existsSync(`${DIR}/frame_${size}_${c}.webp`)).toBe(true);
        for (const m of ['soramo', 'gauul', 'lazuck', 'myurol', 'kalshell']) expect(existsSync(`${DIR}/frame_${size}_${c}_${m}.webp`)).toBe(true);
      }
    }
  });

  it('大きさは LAYOUT（253×382・208×210）のちょうど2倍', () => {
    for (const f of frames) expect(webpSize(`${DIR}/${f}`)).toEqual(f.startsWith('frame_normal') ? [506, 764] : [416, 420]);
  });

  it('合計の重さは前の PNG（約4.6MB）より小さい', () => {
    const total = frames.reduce((n, f) => n + statSync(`${DIR}/${f}`).size, 0);
    expect(total).toBeLessThan(4_600_000);
  });
});
