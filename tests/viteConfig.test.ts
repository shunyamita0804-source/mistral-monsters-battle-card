import { describe, expect, it } from 'vitest';
import { PAGES_BASE, resolveBase } from '../vite.config.ts';

describe('vite base パス設定', () => {
  it('通常ビルドはルート', () => {
    expect(resolveBase('production')).toBe('/');
    expect(resolveBase('development')).toBe('/');
  });

  it('pages モードはリポジトリ名のサブパス', () => {
    expect(PAGES_BASE).toBe('/mistral-monsters-battle-card/');
    expect(resolveBase('pages')).toBe('/mistral-monsters-battle-card/');
  });

  it('VITE_BASE_PATH が最優先で、前後のスラッシュを補正する', () => {
    expect(resolveBase('pages', 'custom')).toBe('/custom/');
    expect(resolveBase('production', '/x/y')).toBe('/x/y/');
    expect(resolveBase('pages', '  ')).toBe('/mistral-monsters-battle-card/');
  });
});
