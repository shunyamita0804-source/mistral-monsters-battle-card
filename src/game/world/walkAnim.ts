import type { Direction } from '../save/saveData.ts';

/**
 * 主人公の歩き・走りの計算（DOM 非依存。2026-10-24 に worldScreen.ts から切り出し）。
 *
 * - 速さ：1秒あたりの論理px。歩き出しの加速・止まる前の減速・走り
 * - 1歩の長さ（歩幅）：人物の絵の高さに対する割合。コマ送りは「時間」ではなく「進んだ距離」で決める（足が地面をすべって見えないように）
 * - 位相（phase）：歩いた歩数（1.0＝1歩＝4コマ）。走りと歩きで歩幅が変わっても位相は続きから進む（コマが飛ばない）
 *
 * 歩行画面（src/ui/screens/worldScreen.ts）と、歩きの確認画面（src/ui/screens/walkLabScreen.ts）が同じ計算を使う。
 * 数値はすべて仮（ユーザーの iPhone 確認で調整）。
 */

/**
 * 歩行速度（論理px/秒）。2026-10-22 に街を詰めたとき 185 から 1.25 倍の 231 に（ユーザー指示）。
 * 2026-10-24 第3版の絵に歩幅を合わせたら足の回転が速すぎた（約6.3歩/秒）ので、ユーザー「歩く速さを下げて」で 185 に戻す（約5歩/秒・20コマ/秒）
 */
export const WALK_PX = 185;
/** 走る：歩きに対する速さの倍率（2026-10-23・ユーザー承認）。走る絵はまだ無いので、歩きの絵を大きな歩幅で使う */
export const RUN_RATE = 1.7;
/**
 * 1歩で進む距離（人物のコマの高さ＝figureH に対する割合）。
 * 2026-10-24 ユーザー「動きがチープで本当に歩いているように見えない」：足がパタパタ速すぎたので 0.45→0.58（約5歩/秒）。
 * 2026-10-24（第3版の絵）：男性・左向きの8コマで「地面に着いた足が体に対して動く量」を測ると 1歩 137px（コマの高さ 360 の 0.38）だったので、
 * 絵に合わせて 0.38 に（足が地面をすべらない。歩く速さ 185px/秒 で約 5歩/秒＝20コマ/秒）
 */
export const STEP_PER_HEIGHT = 0.38;
/**
 * 2026-10-25（描き直した絵・ユーザー「上下は足が動く割に進まない。左右は歩幅が大きい割に進まない。走りも歩幅と進む距離がずれる」）：
 * 1歩の長さを向きごとに。コマの高さ（figureH）に対する割合。
 * - 横（左・右）：新しい絵で、地面に着いた足がコマからコマへ動く位置を読み、その足が地面にとどまって見える長さ（下の割合と組み合わせて、
 *   足のすべりがいちばん小さくなる値。画面では横に FIGURE_WIDEN 1.1 倍で出すのも入れて計算）。
 *   歩き 0.44（前は 0.38。前の値では絵の歩幅より進まなかった）・走り 0.68（前は 0.7）。計算上の足のすべりは 歩き 49→26px・走り 47→24px（コマの高さ 360px）
 * - 縦（正面・背中）：足が奥・手前に動くので絵から測れない。ユーザー「足が動く割に進まない」から、足の回り方を遅くした
 *   （歩きは前の 0.38 の約 1.3 倍、走りは 0.7 の約 1.15 倍。Claude の判断。iPhone で確認して直す）
 */
export const STEP_BY_VIEW: Readonly<Record<'side' | 'vertical', { readonly walk: number; readonly run: number }>> = {
  side: { walk: 0.44, run: 0.68 },
  vertical: { walk: 0.5, run: 0.8 },
};
/**
 * 横の行で、1歩（4コマ）のうち各コマを出す長さの割合（2026-10-25）。新しい絵は、コマからコマへ地面の足が動く量がそろっていない
 * （歩き：つま先が 66→80→154→200 px、走り：着地のあと 40→107→202 px で、そのあと宙に浮く）。同じ長さずつ出すと足がすべって見えるので、
 * 足が大きく動くコマを長く、着いた直後のコマ（次の1歩の1コマ目とほぼ同じ絵）を短く。左足の1歩（コマ4〜7）も同じ割合
 */
export const SIDE_FRAME_WEIGHTS: Readonly<Record<'walk' | 'run', readonly [number, number, number, number]>> = {
  walk: [0.1, 0.35, 0.45, 0.1],
  run: [0.22, 0.4, 0.28, 0.1],
};
/**
 * 走りの1歩（コマの高さに対する割合）。2026-10-24 第3版の走りの絵（男性・左向き）：着地のときの前後の足の幅がコマの高さの約 0.56、
 * そこに両足が浮いて進むぶんを足して 0.7 に（走る速さ 315px/秒 で約 4.6歩/秒・18コマ/秒）。走りの絵が無い向きも同じ値
 */
export const RUN_STEP_PER_HEIGHT = 0.7;
/**
 * 歩き出し・止まり方（2026-10-23）：歩き出しは ACCEL_FROM の速さから ACCEL_S 秒でふつうの速さに。
 * 止まる最後のマスでは、マスの終わりで DECEL_TO の速さまで落とす
 */
export const ACCEL_S = 0.15;
export const ACCEL_FROM = 0.45;
export const DECEL_TO = 0.55;
/** 歩き終えてから、立ち止まりの絵に切り替えるまでの猶予（ミリ秒。歩き続けている途中のマスの切り替わりで絵がちらつかないように） */
export const WALK_HOLD_MS = 90;

/**
 * 主人公の歩行素材：1コマ 216×288（ゲームのシートは 1.25 倍の 270×360）、足元 (108, 270)。
 * 9列（歩き1周8コマ＋立ち止まり）×8行（正面・背中・左・右・左下・右下・左上・右上）。tools/art/adult_walk_build.py が作る
 */
export const FRAME_W = 216;
export const FRAME_H = 288;
export const FOOT_X = 108;
export const FOOT_Y = 270;
/**
 * 主人公のコマの幅と足元の x（2026-10-24 に 216→248。横向きの走りの髪・腕・ブーツがコマの端で切れて縦の線に見えたため。
 * ゲームのシートは 1.25 倍の 310×360・足元 (155, 338)。人（NPC）のシートは 216 のまま）
 */
export const PLAYER_FRAME_W = 248;
export const PLAYER_FOOT_X = 124;
export const PLAYER_SHEET_COLS = 9;
/**
 * 行：歩き4行（正面・背中・左・右）＋走り4行（同じ順）＝8行。
 * 2026-10-24 ユーザー「複雑すぎるので斜め歩行は無しにして四方向に」：斜めの絵の行（左下・右下・左上・右上）をやめた。
 * 斜めに進むときは横（左・右）の絵（進み方は8方向のまま）
 */
export const PLAYER_SHEET_ROWS = 8;
/** 走りの行は歩きの行の下（行 4〜7）。走りの絵が無い向きは歩きの行の写しが入っている */
export const RUN_ROW_BASE = 4;
/** 歩き1周のコマ数（右足の1歩4コマ＋左足の1歩4コマ）と、1歩のコマ数、シートの立ち止まりの列 */
export const WALK_COLS = 8;
export const FRAMES_PER_STEP = 4;
export const IDLE_COL = 8;

export type PlayerGender = 'male' | 'female';
/** 主人公の斜め向き（絵の向きだけ。セーブや「しらべる」の向きは上下左右の Direction のまま） */
export type Diagonal = 'downleft' | 'downright' | 'upleft' | 'upright';
export const DIR_ROW: Readonly<Record<Direction, number>> = { down: 0, up: 1, left: 2, right: 3 };
/** 絵の向きの名前（行 0〜3。確認画面の表示用。走りの行は +RUN_ROW_BASE） */
export const ROW_NAMES: readonly Direction[] = ['down', 'up', 'left', 'right'];

/**
 * 第2版の絵（1周8コマ。体の上下まで描いてある）が入っている行。この行では、プログラムで付ける体の縮み・影の動きをやめる（絵と二重になるため）。
 * 第2版の絵が届いたらここに行を足す（行の番号は DIR_ROW。走りは +RUN_ROW_BASE）。
 * それ以外の行は、前の絵「右足を前・立つ・左足を前」を1コマずつ2回並べた8コマ（実質3ポーズ）
 */
export const PLAYER_V2_ROWS: Readonly<Record<PlayerGender, ReadonlySet<number>>> = { male: new Set([0, 1, 2, 3, 4, 5, 6, 7]), female: new Set([0, 1, 2, 3, 4, 5, 6, 7]) };
/**
 * 走りの絵（第3版・1周8コマ）が入っている行。この行では、プログラムで付ける体の傾きもやめる（前傾が絵に描いてある）。
 * 女性の正面・背中の走り（行 4・5）はまだ届いていない（歩きの絵の写し。2026-10-24）
 */
export const PLAYER_RUN_ART_ROWS: Readonly<Record<PlayerGender, ReadonlySet<number>>> = { male: new Set([4, 5, 6, 7]), female: new Set([6, 7]) };

/** 1歩の長さ（論理px）。figureH は人物のコマの高さ（論理px）。view を渡すと向きごとの長さ（STEP_BY_VIEW。2026-10-25〜 歩行画面はこちら） */
export function strideOf(figureH: number, running: boolean, view?: 'side' | 'vertical'): number {
  if (view) return figureH * STEP_BY_VIEW[view][running ? 'run' : 'walk'];
  return figureH * (running ? RUN_STEP_PER_HEIGHT : STEP_PER_HEIGHT);
}

/** 向き → 1歩の長さの種類（左・右＝横、正面・背中＝縦） */
export function viewOf(dir: Direction): 'side' | 'vertical' {
  return dir === 'left' || dir === 'right' ? 'side' : 'vertical';
}

/**
 * いまの歩く速さ（論理px/秒）。走る・歩き出しの加速（moveTime＝歩き出してからの秒）・止まる最後のマスの減速
 * （decelT＝最後のマスの進み具合 0〜1。減速しないときは null）
 */
export function walkSpeed(running: boolean, moveTime: number, decelT: number | null, scale = 1): number {
  let v = WALK_PX * (running ? RUN_RATE : 1) * scale;
  v *= Math.min(1, ACCEL_FROM + ((1 - ACCEL_FROM) * moveTime) / ACCEL_S);
  if (decelT !== null) v *= 1 - (1 - DECEL_TO) * decelT;
  return v;
}

export interface MoveAdvance {
  /** 1歩の進み具合（0〜1。1以上＝着いた） */
  readonly t: number;
  /** この更新で進んだ距離（論理px。マスの終わりで止まる） */
  readonly dist: number;
  /** 着いたあとに残った時間（秒）。歩き続けるときは次のマスに持ち越す */
  readonly rest: number;
}

/**
 * 1歩（1マス）の途中を dt 秒ぶん進める。速さは論理px/秒、cell は1マスの論理px、len は1歩の長さ（斜めは √2）。
 * 斜めは len で割るので、縦横と同じ速さ（論理px/秒）で進む（斜めだけ速くならない）
 */
export function advanceMove(t: number, len: number, dt: number, speedPx: number, cell: number): MoveAdvance {
  const speedCells = speedPx / cell;
  const next = t + (dt * speedCells) / len;
  const dist = (Math.min(1, next) - t) * len * cell;
  const rest = next >= 1 && speedCells > 0 ? ((next - 1) * len) / speedCells : 0;
  return { t: next, dist, rest };
}

/**
 * 歩きの位相を進める。dist 論理px 進んだとき、いまの歩幅 stride で何歩ぶんかを足す。
 * animScale は確認画面用の「再生速度の倍率」（1＝進んだ距離どおり。本編は常に1）
 */
export function advancePhase(phase: number, dist: number, stride: number, animScale = 1): number {
  if (stride <= 0) return phase;
  return phase + (dist / stride) * animScale;
}

/**
 * 位相（歩数）→ 歩きのコマ（0〜7）。右足が着く＝0、左足が着く＝4。
 * weights（1歩の4コマを出す長さの割合。SIDE_FRAME_WEIGHTS）を渡すと、コマごとに出す長さを変える（なければ同じ長さずつ）
 */
export function frameOf(phase: number, weights?: readonly number[]): number {
  if (!weights) return Math.floor(phase * FRAMES_PER_STEP) % WALK_COLS;
  const steps = Math.floor(phase);
  const half = steps % 2;
  const total = weights.reduce((a, b) => a + b, 0);
  let t = (phase - steps) * total;
  let i = 0;
  while (i < FRAMES_PER_STEP - 1 && t >= (weights[i] ?? 0)) {
    t -= weights[i] ?? 0;
    i += 1;
  }
  return half * FRAMES_PER_STEP + i;
}

/** その行の、1歩の4コマを出す長さの割合（横の行だけ。縦の行は同じ長さずつ＝undefined） */
export function frameWeightsOf(dir: Direction, running: boolean): readonly number[] | undefined {
  return viewOf(dir) === 'side' ? SIDE_FRAME_WEIGHTS[running ? 'run' : 'walk'] : undefined;
}

/** 足が地面に着くコマか（足音を鳴らすコマ） */
export function isContactFrame(frame: number): boolean {
  return frame % FRAMES_PER_STEP === 0;
}

/**
 * 体の縮み・伸び（−1〜1）。前の絵（1ポーズ＝2列）の行だけに使う：足を出したポーズ（半歩）の真ん中で 1（いちばん縮む）、
 * 立つポーズの真ん中で −1。位相から決めるので、足のコマ送りとずれない
 */
export function squashOf(phase: number): number {
  return Math.cos(Math.PI * (phase * 2 - 0.5));
}

/** 歩いている最中か（1歩の途中、または歩き終えてから WALK_HOLD_MS 以内） */
export function isWalking(now: number, lastMoving: number, moving: boolean): boolean {
  return moving || now - lastMoving < WALK_HOLD_MS;
}

/**
 * 1歩の向き → 人物の向き（上下左右。主人公の斜めの絵は別に diagonalOf で選ぶ）。
 * いまの向きの成分がある斜め（例：右を向いて右下へ）は向きを変えない。斜め45度あたりで正面と横の絵が細かく入れ替わらないように。
 * それ以外の斜めは左右の絵
 */
export function facing(dx: number, dy: number, prev: Direction): Direction {
  if (dx === 0 && dy === 0) return prev;
  const p = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[prev];
  if ((p.x !== 0 && p.x === dx) || (p.y !== 0 && p.y === dy)) return prev;
  return dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
}

/** 1歩の向き → 斜めの絵の向き（斜めでなければ null） */
export function diagonalOf(dx: number, dy: number): Diagonal | null {
  return dx !== 0 && dy !== 0 ? `${dy > 0 ? 'down' : 'up'}${dx > 0 ? 'right' : 'left'}` : null;
}

/**
 * 絵の向き → シートの行。斜めに進むときは横（左・右）の絵（2026-10-24 ユーザー「四方向に」）。
 * 走っているときは走りの行（歩きの行＋RUN_ROW_BASE）
 */
export function sheetRow(dir: Direction, diag: Diagonal | null, running = false): number {
  const side: Direction = diag ? (diag.endsWith('left') ? 'left' : 'right') : dir;
  return (running ? RUN_ROW_BASE : 0) + DIR_ROW[side];
}

/** 1秒あたりのコマ数（この速さ・歩幅でコマが切り替わる速さ。確認画面の表示用） */
export function framesPerSecond(speedPx: number, stride: number, animScale = 1): number {
  return stride > 0 ? (speedPx / stride) * FRAMES_PER_STEP * animScale : 0;
}

export interface SheetStatus {
  /** 歩き：第2版の1周8コマ（v2）／前の3ポーズを2回ずつ並べた8コマ（legacy） */
  readonly walk: 'v2' | 'legacy';
  /** 走り：第3版の1周8コマ（v3）／専用の絵は無い（歩きの絵を速く・大きな歩幅で）（none） */
  readonly run: 'v3' | 'none';
  /** 立ち止まり：専用の列がある */
  readonly idle: true;
  /** 右向きは左向きの左右反転（かばんなど左右で違う持ち物が入れ替わる） */
  readonly mirrored: boolean;
}

/** その人物・その行のシートに、どの絵が入っているか（確認画面で「未実装」を出すため） */
export function sheetStatus(gender: PlayerGender, row: number): SheetStatus {
  const walkRow = row % RUN_ROW_BASE;
  return {
    walk: PLAYER_V2_ROWS[gender].has(walkRow) ? 'v2' : 'legacy',
    run: PLAYER_RUN_ART_ROWS[gender].has(RUN_ROW_BASE + walkRow) ? 'v3' : 'none',
    idle: true,
    mirrored: walkRow === DIR_ROW.right,
  };
}
