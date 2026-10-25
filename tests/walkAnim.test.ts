import { describe, expect, it } from 'vitest';
import {
  ACCEL_FROM,
  ACCEL_S,
  advanceMove,
  advancePhase,
  DECEL_TO,
  diagonalOf,
  facing,
  FRAMES_PER_STEP,
  frameOf,
  frameWeightsOf,
  framesPerSecond,
  isContactFrame,
  isWalking,
  RUN_RATE,
  sheetRow,
  sheetStatus,
  squashOf,
  SIDE_FRAME_WEIGHTS,
  STEP_BY_VIEW,
  STEP_PER_HEIGHT,
  strideOf,
  viewOf,
  WALK_COLS,
  WALK_HOLD_MS,
  WALK_PX,
  walkSpeed,
} from '../src/game/world/walkAnim.ts';
import { canStep } from '../src/game/world/world.ts';

/** 街の人物のコマの高さ（論理px）と1マス（論理px）。worldScreen.ts の #figureH・#cell と同じ値 */
const FIGURE_H = 144 * 0.5625 * 1.2;
const CELL = 32 * 0.5625;

/**
 * worldScreen.ts の #step と同じ流れを DOM なしでまねる（歩き続ける・加速・減速・位相）。
 * 1マスの長さ len（縦横 1・斜め √2）のマスを、ずっと同じ向きに歩く
 */
function simulate(opts: { seconds: number; dt: number; len?: number; running?: boolean | ((t: number) => boolean); decelAtEnd?: boolean; blockedAfter?: number; animScale?: number }) {
  const len = opts.len ?? 1;
  let t = 0;
  let move: { t: number } | null = null;
  let moveTime = 0;
  let phase = 0;
  let dist = 0;
  let tiles = 0;
  const frames: number[] = [];
  let lastFrame = -1;
  const isRunning = (now: number): boolean => (typeof opts.running === 'function' ? opts.running(now) : (opts.running ?? false));
  const steps = Math.round(opts.seconds / opts.dt);
  for (let i = 0; i < steps; i += 1) {
    const running = isRunning(t);
    const stride = strideOf(FIGURE_H, running);
    let dt = opts.dt;
    while (dt > 0) {
      if (!move) {
        if (opts.blockedAfter !== undefined && tiles >= opts.blockedAfter) break;
        move = { t: 0 };
      }
      const last = opts.decelAtEnd && opts.blockedAfter !== undefined && tiles === opts.blockedAfter - 1;
      const v = walkSpeed(running, moveTime, last ? move.t : null);
      const r = advanceMove(move.t, len, dt, v, CELL);
      move.t = r.t;
      phase = advancePhase(phase, r.dist, stride, opts.animScale ?? 1);
      dist += r.dist;
      if (r.t >= 1) {
        tiles += 1;
        move = null;
        dt = r.rest;
      } else dt = 0;
    }
    t += opts.dt;
    moveTime = move ? moveTime + opts.dt : 0;
    const f = frameOf(phase);
    if (f !== lastFrame) {
      frames.push(f);
      lastFrame = f;
    }
  }
  return { phase, dist, tiles, frames, moving: move !== null };
}

describe('歩く速さ（walkSpeed）', () => {
  it('歩き出しは ACCEL_FROM から ACCEL_S 秒でふつうの速さに、走りは RUN_RATE 倍', () => {
    expect(walkSpeed(false, 0, null)).toBeCloseTo(WALK_PX * ACCEL_FROM);
    expect(walkSpeed(false, ACCEL_S, null)).toBeCloseTo(WALK_PX);
    expect(walkSpeed(false, 10, null)).toBeCloseTo(WALK_PX);
    expect(walkSpeed(true, 10, null)).toBeCloseTo(WALK_PX * RUN_RATE);
  });

  it('止まる最後のマスの終わりで DECEL_TO の速さまで落ちる', () => {
    expect(walkSpeed(false, 10, 0)).toBeCloseTo(WALK_PX);
    expect(walkSpeed(false, 10, 1)).toBeCloseTo(WALK_PX * DECEL_TO);
  });

  it('確認画面の倍率は速さにそのままかかる', () => {
    expect(walkSpeed(false, 10, null, 0.5)).toBeCloseTo(WALK_PX * 0.5);
  });
});

describe('直進（フレーム時間が変わっても同じ速さ）', () => {
  it('60fps・30fps・20fps で、2秒で進む距離と歩数がほぼ同じ', () => {
    const a = simulate({ seconds: 2, dt: 1 / 60 });
    const b = simulate({ seconds: 2, dt: 1 / 30 });
    const c = simulate({ seconds: 2, dt: 1 / 20 });
    // 加速を終えたあとは WALK_PX（231 論理px/秒）。2秒で約 231×2 − 加速ぶん
    expect(a.dist).toBeGreaterThan(WALK_PX * 1.9);
    expect(a.dist).toBeLessThan(WALK_PX * 2);
    expect(Math.abs(a.dist - b.dist)).toBeLessThan(CELL);
    expect(Math.abs(a.dist - c.dist)).toBeLessThan(CELL);
    expect(Math.abs(a.phase - b.phase)).toBeLessThan(0.2);
    expect(Math.abs(a.phase - c.phase)).toBeLessThan(0.2);
  });

  it('1歩は STEP_PER_HEIGHT×コマの高さ（絵に合わせた歩幅）。コマは1歩4コマ', () => {
    const r = simulate({ seconds: 1, dt: 1 / 60 });
    const stride = strideOf(FIGURE_H, false);
    expect(stride).toBeCloseTo(FIGURE_H * STEP_PER_HEIGHT);
    expect(r.phase).toBeCloseTo((r.dist / stride) as number, 5);
    expect(r.phase).toBeGreaterThan((WALK_PX * 0.9) / stride);
    expect(r.phase).toBeLessThan(WALK_PX / stride);
    expect(framesPerSecond(WALK_PX, stride)).toBeCloseTo((WALK_PX / stride) * FRAMES_PER_STEP);
  });
});

describe('斜め', () => {
  it('斜めの1歩は √2 マスで、論理px/秒 の速さは縦横と同じ（斜めだけ速くならない）', () => {
    const straight = simulate({ seconds: 2, dt: 1 / 60, len: 1 });
    const diag = simulate({ seconds: 2, dt: 1 / 60, len: Math.SQRT2 });
    expect(Math.abs(straight.dist - diag.dist)).toBeLessThan(CELL);
    // 進んだマスの数は 1/√2 倍
    expect(diag.tiles).toBeLessThan(straight.tiles);
    expect(diag.tiles).toBeGreaterThan(straight.tiles / Math.SQRT2 - 2);
  });

  it('斜めの絵の向きと、上下左右の向き', () => {
    expect(diagonalOf(1, 1)).toBe('downright');
    expect(diagonalOf(-1, -1)).toBe('upleft');
    expect(diagonalOf(1, 0)).toBeNull();
    expect(sheetRow('left', null)).toBe(2);
    // 斜めは横の絵（2026-10-24 ユーザー「四方向に」）
    expect(sheetRow('left', 'downleft')).toBe(2);
    expect(sheetRow('down', 'downright')).toBe(3);
  });
});

describe('方向転換（facing）', () => {
  it('いまの向きの成分がある斜めでは向きを変えず、それ以外の斜めは左右の絵', () => {
    expect(facing(1, 1, 'right')).toBe('right');
    expect(facing(1, 1, 'down')).toBe('down');
    expect(facing(1, 1, 'up')).toBe('right');
    expect(facing(-1, 0, 'down')).toBe('left');
    expect(facing(0, -1, 'left')).toBe('up');
    expect(facing(0, 0, 'left')).toBe('left');
  });
});

describe('開始・停止', () => {
  it('歩き出しは遅く、最初の 0.15 秒で速くなる（毎更新で先頭に戻らない）', () => {
    const early = simulate({ seconds: 0.1, dt: 1 / 60 });
    const later = simulate({ seconds: 0.2, dt: 1 / 60 });
    // 最初の 0.1 秒は全速より遅い
    expect(early.dist).toBeLessThan(WALK_PX * 0.1);
    expect(early.dist).toBeGreaterThan(WALK_PX * 0.1 * ACCEL_FROM);
    // 0.1〜0.2 秒は 0〜0.1 秒より多く進む（加速している）
    expect(later.dist - early.dist).toBeGreaterThan(early.dist);
    // コマは 0 から順に進む（0 → 1 → 2 …。戻らない）
    expect(later.frames.slice(0, 3)).toEqual([0, 1, 2]);
  });

  it('最後のマスで減速して止まり、止まると位置はマスの真ん中', () => {
    const r = simulate({ seconds: 3, dt: 1 / 60, blockedAfter: 3, decelAtEnd: true });
    expect(r.tiles).toBe(3);
    expect(r.moving).toBe(false);
    expect(r.dist).toBeCloseTo(3 * CELL, 6);
  });

  it('歩き終えてから WALK_HOLD_MS の間は歩きの絵のまま、その後は立ち止まり', () => {
    expect(isWalking(1000, 1000, false)).toBe(true);
    expect(isWalking(1000 + WALK_HOLD_MS - 1, 1000, false)).toBe(true);
    expect(isWalking(1000 + WALK_HOLD_MS, 1000, false)).toBe(false);
    expect(isWalking(5000, 1000, true)).toBe(true);
  });
});

describe('壁への接触', () => {
  it('進めないときは1歩を始めない（距離も位相も進まず、その場で足踏みしない）', () => {
    const blocked = (x: number, y: number): boolean => x === 1 || y === 1;
    expect(canStep({ x: 0, y: 0 }, 1, 0, blocked)).toBe(false);
    expect(canStep({ x: 0, y: 0 }, 1, 1, blocked)).toBe(false);
    expect(canStep({ x: 0, y: 0 }, 0, -1, blocked)).toBe(true);
    const r = simulate({ seconds: 1, dt: 1 / 60, blockedAfter: 0 });
    expect(r.dist).toBe(0);
    expect(r.phase).toBe(0);
    expect(r.frames).toEqual([0]);
  });
});

describe('歩行と走行の切り替え', () => {
  it('走りに変わっても位相は続きから進む（コマが飛ばない・戻らない）', () => {
    // 1秒歩いてから走る
    const r = simulate({ seconds: 2, dt: 1 / 60, running: (t) => t >= 1 });
    for (let i = 1; i < r.frames.length; i += 1) {
      const prev = r.frames[i - 1] as number;
      const cur = r.frames[i] as number;
      expect((cur - prev + WALK_COLS) % WALK_COLS).toBe(1);
    }
    // 走りは速く進む（同じ2秒で歩きだけより長い距離）
    const walk = simulate({ seconds: 2, dt: 1 / 60 });
    expect(r.dist).toBeGreaterThan(walk.dist * 1.25);
  });

  it('歩幅が変わる瞬間に位相が変わらない（前の走った距離を新しい歩幅で割り直さない）', () => {
    const stride = strideOf(FIGURE_H, false);
    const runStride = strideOf(FIGURE_H, true);
    let phase = advancePhase(0, 100, stride);
    const before = phase;
    phase = advancePhase(phase, 0, runStride);
    expect(phase).toBe(before);
    // 前の計算（走った距離 ÷ いまの歩幅）だとコマが戻っていた
    expect(Math.floor((100 / runStride) * FRAMES_PER_STEP)).toBeLessThan(Math.floor((100 / stride) * FRAMES_PER_STEP));
  });
});

describe('連続10周期の継ぎ目', () => {
  it('10周（80コマ）を小刻みに進めると、コマは 0〜7 を順にくり返し、飛び・戻りがない', () => {
    const stride = strideOf(FIGURE_H, false);
    let phase = 0;
    const seen: number[] = [0];
    const slice = stride / FRAMES_PER_STEP / 7; // 1コマの 1/7 ずつ
    while (phase < 20) {
      phase = advancePhase(phase, slice, stride);
      const f = frameOf(phase);
      if (f !== seen[seen.length - 1]) seen.push(f);
    }
    expect(seen.length).toBe(1 + 10 * WALK_COLS);
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).toBe((i) % WALK_COLS);
    expect(frameOf(20)).toBe(0);
    expect(frameOf(10 - 1e-9)).toBe(7);
  });

  it('足音は右足・左足が着くコマ（0・4）だけ', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].filter(isContactFrame)).toEqual([0, 4]);
  });

  it('体の縮み（前の絵の行だけ）は、足を出したポーズ（半歩）の真ん中で最大、立つポーズの真ん中で最小', () => {
    expect(squashOf(0.25)).toBeCloseTo(1);
    expect(squashOf(0.75)).toBeCloseTo(-1);
    expect(squashOf(1.25)).toBeCloseTo(1);
  });
});

describe('確認画面の再生速度の倍率', () => {
  it('倍率 2 では同じ距離で2倍のコマが進む（移動は変わらない）', () => {
    const a = simulate({ seconds: 2, dt: 1 / 60 });
    const b = simulate({ seconds: 2, dt: 1 / 60, animScale: 2 });
    expect(b.dist).toBeCloseTo(a.dist, 6);
    expect(b.phase).toBeCloseTo(a.phase * 2, 6);
  });
});

describe('シートに入っている絵', () => {
  it('男性は4方向とも歩き第2版・走り第3版。女性は歩き4方向と左右の走りが第3版（正面・背中の走りは未着）', () => {
    expect(sheetStatus('male', 0).walk).toBe('v2');
    expect(sheetStatus('male', 3).walk).toBe('v2');
    expect(sheetStatus('female', 0).walk).toBe('v2');
    expect(sheetStatus('male', 0).run).toBe('v3');
    expect(sheetStatus('male', 2).run).toBe('v3');
    expect(sheetStatus('male', 6).run).toBe('v3');
    expect(sheetStatus('female', 2).run).toBe('v3');
    expect(sheetStatus('female', 0).run).toBe('none');
    expect(sheetStatus('female', 1).run).toBe('none');
    // 走るときは走りの行（＋4）。斜めは横の行
    expect(sheetRow('left', null, true)).toBe(6);
    expect(sheetRow('down', null, true)).toBe(4);
    expect(sheetRow('left', 'downleft', true)).toBe(6);
    expect(sheetRow('right', 'upright', true)).toBe(7);
    expect(sheetRow('left', 'downleft', false)).toBe(2);
    expect(sheetStatus('male', 3).mirrored).toBe(true);
    expect(sheetStatus('male', 2).mirrored).toBe(false);
  });
});

describe('向きごとの歩幅とコマの長さ（2026-10-25 描き直した絵）', () => {
  it('横（左・右）は絵で測った歩幅、縦（正面・背中）は足の回り方を遅くした長い歩幅', () => {
    expect(viewOf('left')).toBe('side');
    expect(viewOf('right')).toBe('side');
    expect(viewOf('up')).toBe('vertical');
    expect(viewOf('down')).toBe('vertical');
    expect(strideOf(FIGURE_H, false, 'side')).toBeCloseTo(FIGURE_H * STEP_BY_VIEW.side.walk);
    expect(strideOf(FIGURE_H, true, 'side')).toBeCloseTo(FIGURE_H * STEP_BY_VIEW.side.run);
    // 縦は前の値より足の回り方が遅い（1歩が長い）
    expect(strideOf(FIGURE_H, false, 'vertical')).toBeGreaterThan(strideOf(FIGURE_H, false));
    expect(strideOf(FIGURE_H, true, 'vertical')).toBeGreaterThan(strideOf(FIGURE_H, true));
  });

  it('横の行は、1歩の4コマを割合どおりの長さで出す。順に 0〜7 をくり返し、飛び・戻りがない', () => {
    const w = frameWeightsOf('left', false);
    expect(w).toEqual(SIDE_FRAME_WEIGHTS.walk);
    expect(frameWeightsOf('up', false)).toBeUndefined();
    const seen: number[] = [];
    const length = new Map<number, number>();
    const d = 1 / 2000;
    for (let phase = 0; phase < 4; phase += d) {
      const f = frameOf(phase, w);
      if (f !== seen[seen.length - 1]) seen.push(f);
      length.set(f, (length.get(f) ?? 0) + d);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7]);
    // 2周したので、各コマの長さは 割合×2
    SIDE_FRAME_WEIGHTS.walk.forEach((x, i) => {
      expect(length.get(i)).toBeCloseTo(x * 2, 2);
      expect(length.get(i + 4)).toBeCloseTo(x * 2, 2);
    });
    // 割合を渡さなければ前と同じ（同じ長さずつ）
    expect(frameOf(0.3)).toBe(1);
  });
});
