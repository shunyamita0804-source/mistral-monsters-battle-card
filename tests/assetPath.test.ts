import { describe, expect, it } from 'vitest';
import { resolvePublicPath } from '../src/core/assetPath.ts';

describe('resolvePublicPath', () => {
  it('ルート配信（base = /）', () => {
    expect(resolvePublicPath('favicon.svg', '/')).toBe('/favicon.svg');
    expect(resolvePublicPath('/favicon.svg', '/')).toBe('/favicon.svg');
  });

  it('GitHub Pages のサブパス配信', () => {
    const base = '/mistral-monsters-battle-card/';
    expect(resolvePublicPath('/favicon.svg', base)).toBe('/mistral-monsters-battle-card/favicon.svg');
    expect(resolvePublicPath('./data/a.json', base)).toBe('/mistral-monsters-battle-card/data/a.json');
  });

  it('末尾スラッシュのない base も補正する', () => {
    expect(resolvePublicPath('a.png', '/repo')).toBe('/repo/a.png');
  });

  it('外部URLと data URI は変更しない', () => {
    expect(resolvePublicPath('https://example.com/a.png', '/repo/')).toBe('https://example.com/a.png');
    expect(resolvePublicPath('//cdn.example.com/a.png', '/repo/')).toBe('//cdn.example.com/a.png');
    expect(resolvePublicPath('data:image/png;base64,AAAA', '/repo/')).toBe('data:image/png;base64,AAAA');
  });
});
