import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCREENS } from '../src/i18n/messages/screens.ts';

/**
 * 指示書 BG（2026-11-05）：対戦の結果画面（WIN／LOSE／DRAW）と勝ち・負けの曲
 */
const screen = readFileSync('src/ui/screens/battleScreen.ts', 'utf8');
const bgm = readFileSync('src/ui/bgm.ts', 'utf8');

describe('指示書 BG：結果画面', () => {
  it('素材（文字の絵3つ・顔の枠・曲2つ）。原本は design-parts/result-screen-20261105/ に無改変', () => {
    for (const f of ['result_win_logo', 'result_lose_logo', 'result_draw_logo', 'result_opponent_face_frame']) {
      expect(existsSync(`assets/images/ui/result/${f}.webp`), f).toBe(true);
      expect(existsSync(`design-parts/result-screen-20261105/art/${f}.png`), f).toBe(true);
    }
    for (const f of ['win', 'lose']) {
      const game = readFileSync(`assets/audio/bgm/bgm_battle_${f}_jingle.mp3`);
      const src = readFileSync(`design-parts/result-screen-20261105/audio/battle_${f}_jingle.mp3`);
      expect(game.equals(src), f).toBe(true);
    }
  });

  it('曲：勝ち・負けは1回だけ（くり返さない）。対戦の曲を止めてから流す。引き分けは無音。前の2秒の効果音は鳴らさない。「続ける」で止める', () => {
    expect(bgm).toMatch(/battleWinJingle: \{ src: battleWinJingleMp3, gain: 0\.36, loop: false \}/);
    expect(bgm).toMatch(/battleLoseJingle: \{ src: battleLoseJingleMp3, gain: 0\.36, loop: false \}/);
    expect(screen).toContain("bgm.playAfterStop('battleWinJingle', RESULT_BGM_FADE_S)");
    expect(screen).toContain("bgm.playAfterStop('battleLoseJingle', RESULT_BGM_FADE_S)");
    expect(screen).toContain('else bgm.stop(RESULT_BGM_FADE_S);');
    expect(screen).not.toContain("'battleWin'");
    expect(screen).not.toContain("'battleLose'");
    expect(screen).toContain('bgm.stop(RESULT_BGM_STOP_S);');
    expect(screen).toMatch(/const RESULT_BGM_STOP_S = 0\.3;/);
  });

  it('勝ち・負けのひと言は結果画面の窓に出し、吹き出しには出さない。引き分けはひと言なし', () => {
    expect(screen).toContain("if (!oppLine || Date.now() >= talkUntil || s.phase === 'ended') return null;");
    expect(screen).toContain('resultLine = w ? (npcTextOf(resultLineKey(w)');
  });

  it('クレジット（オプションの「素材のクレジット」）に2曲', () => {
    const c = SCREENS['options.creditsText'];
    expect(c.ja).toContain('勝利BGM「勝利ジングル」作曲：Make a field Music');
    expect(c.ja).toContain('敗北BGM「ゲームオーバー」作曲：カピバラっ子');
    expect(c.ja).toContain('OpenTracks（旧DOVA-SYNDROME）');
    expect(c.en).toContain('Make a field Music');
  });

  it('2回目の直し：帯なし（帯ありはやめた）・ひと言が無いときは窓を名前だけの高さ・描き直しで動きをやり直さない・止めている間は次の曲を鳴らさない', () => {
    const css = readFileSync('src/ui/styles/resultScreen.css', 'utf8');
    expect(css).not.toContain('data-result-band');
    expect(css).toContain('.battle-result__opponent.is-nameonly');
    expect(css).toMatch(/\.battle-result__face \{[^}]*width: 156px;/);
    expect(css).toMatch(/\.battle-result__hero \{[^}]*max-height: 323px;/);
    expect(css).toContain('var(--result-t, 0ms)');
    expect(screen).toContain("${resultLine ? '' : ' is-nameonly'}");
    expect(bgm).toContain('#quietUntil');
  });
});
