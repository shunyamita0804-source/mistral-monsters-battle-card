import { describe, expect, it } from 'vitest';
import { SCREENS } from '../src/ui/screens/registry.ts';
import { initialScreen, screenWithoutSave } from '../src/ui/app.ts';
import { SOUKAI_TIDE_T1, soukaiTideDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/** 2026-11-02 指示書 AP：蒼海（みちしおあり）を試す確かめ用の入口（?qa=1&lab=soukai・設定の QA 用の欄） */
describe('蒼海（みちしおあり）の確かめ用の入口', () => {
  it('?qa=1&lab=soukai のときだけ開く（ふつうの人には出ない）', () => {
    expect(initialScreen(true, '?qa=1&lab=soukai')).toBe('soukaiLab');
    expect(initialScreen(false, '?lab=soukai')).not.toBe('soukaiLab');
    expect(SCREENS.soukaiLab.id).toBe('soukaiLab');
  });

  it('デッキは蒼海の箱に、みちしお1・タイダルクラッシュ1（はさむ 3→2・すなをほる 2→1）。山札60枚でルールに合う。ゲームの箱は変えない', () => {
    expect(SOUKAI_TIDE_T1).toEqual({ 'skl-kalshell-01': -1, 'skl-kalshell-10': -1, 'skl-kalshell-15': 1, 'skl-kalshell-08': 1 });
    const d = soukaiTideDeck();
    const c = countCards(d.skills);
    expect(d.monsters).toEqual(['mon-myurol', 'mon-kalshell', 'mon-forn']);
    expect(d.skills).toHaveLength(60);
    expect(['skl-kalshell-01', 'skl-kalshell-10', 'skl-kalshell-15', 'skl-kalshell-08'].map((id) => c[id] ?? 0)).toEqual([2, 1, 1, 1]);
    expect(isDeckValid(d, countCards([...d.monsters, ...d.skills]))).toBe(true);
    const box = countCards(boosterDeck('booster-3').skills);
    expect([box['skl-kalshell-15'] ?? 0, box['skl-kalshell-08'] ?? 0]).toEqual([0, 0]);
  });

  it('セーブがなくても開ける。対戦は借りた山札のときだけ（ふつうの対戦・街はタイトルへ）', () => {
    expect(screenWithoutSave('soukaiLab', false, false)).toBe('soukaiLab');
    expect(screenWithoutSave('battle', false, true)).toBe('battle');
    expect(screenWithoutSave('battle', false, false)).toBe('title');
    expect(screenWithoutSave('world', false, true)).toBe('title');
    expect(screenWithoutSave('world', true, false)).toBe('world');
  });
});
