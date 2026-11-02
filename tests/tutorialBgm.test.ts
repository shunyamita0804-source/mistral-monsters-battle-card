import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../src/i18n/messages/index.ts';

/** 2026-11-02 指示書 AN：練習場（教習所）の対戦の曲を「チュートリアル」（いまたく・OpenTracks）に。記録は docs/audio-credits.md */
describe('練習場の対戦の曲（指示書 AN）', () => {
  const bgm = readFileSync('src/ui/bgm.ts', 'utf8');
  const world = readFileSync('src/ui/screens/worldScreen.ts', 'utf8');

  it('tutorialBattle の曲がある（ループに切ったファイル・音量合わせの gain）', () => {
    expect(existsSync('assets/audio/bgm/bgm_tutorial_battle.mp3')).toBe(true);
    expect(bgm).toContain("tutorialBattle: { src: tutorialBattleMp3, gain: 0.57 }");
    expect(bgm).toContain("| 'tutorialBattle'");
    // 対戦の曲・練習場を歩くときの曲は変えない
    expect(bgm).toContain('battle: { src: battleMp3, gain: 0.36 }');
    expect(bgm).toContain('practice: { src: practiceMp3, gain: 0.56 }');
  });

  it('試験（ガレス先生）と、練習場の中で始めた練習試合だけ、この曲にする', () => {
    expect(world.match(/bgm: 'tutorialBattle'/g)).toHaveLength(2);
    expect(world).toContain("...(this.#map.id === 'practice' ? { bgm: 'tutorialBattle' as const } : {}),");
  });

  it('クレジット（日本語・英語）に曲名・作曲・提供元', () => {
    const credits = MESSAGES['options.creditsText'];
    expect(credits?.ja).toContain('「チュートリアル」作曲：いまたく（imataku）（https://opentracks.com/bgm/detail/9057）');
    expect(credits?.ja).toContain('音楽素材提供：OpenTracks（旧DOVA-SYNDROME）');
    expect(credits?.en).toContain('"Tutorial" composed by imataku (https://opentracks.com/bgm/detail/9057)');
  });
});
