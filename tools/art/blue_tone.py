# -*- coding: utf-8 -*-
"""主人公の帽子・服の青を、立ち止まりの絵の青にそろえる（2026-10-25）

ユーザー「走っている時の帽子の色が若干鮮やかで、立ち絵と違う」。unified_build.py は人物全体の色の平均・ばらつきを立ち絵に合わせるが、
走りの絵は青い部分だけが鮮やか（左の走りで鮮やかさ +16%・正面で +8%）だった。全体の平均では直りきらないので、青い部分だけを合わせる。

シート（9列×8行・1コマ 310×360）の歩き・走りの行（0・1・2・4・5・6）の各コマで、青い画素（Lab の b が −12 より青）の
明るさ L の平均と鮮やかさ（a・b の大きさ）の平均を、同じ行の立ち止まり（9列目）の青と同じにする。青さが弱い画素ほど直す量を小さく。
右向きの行（3・7）は左向き（2・6）の左右反転。

使い方:
  python3 tools/art/blue_tone.py シート.webp [--out 出力.webp]
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from match_stand import FH, FW, IDLE, MIRROR  # noqa: E402

ROWS = (0, 1, 2, 4, 5, 6)
BLUE_B = -12.0  # Lab の b（−128〜127）がこれより小さい画素を青とみなす
FULL_B = -22.0  # これより青い画素は直す量をすべて


def blue_stats(f: np.ndarray) -> tuple[float, float, np.ndarray, np.ndarray]:
    lab = cv2.cvtColor(f[..., :3], cv2.COLOR_RGB2LAB).astype(np.float32)
    lab[..., 1:] -= 128
    m = (f[..., 3] > 200) & (lab[..., 2] < BLUE_B)
    chroma = np.hypot(lab[..., 1], lab[..., 2])
    return float(lab[..., 0][m].mean()), float(chroma[m].mean()), lab, m


def match(f: np.ndarray, ref: np.ndarray) -> np.ndarray:
    l_ref, c_ref, _, _ = blue_stats(ref)
    l_f, c_f, lab, _ = blue_stats(f)
    w = np.clip((BLUE_B - lab[..., 2]) / (BLUE_B - FULL_B), 0, 1) * (f[..., 3] > 0)
    k = 1 + (c_ref / max(c_f, 1e-3) - 1) * w
    lab[..., 0] += (l_ref - l_f) * w
    lab[..., 1] *= k
    lab[..., 2] *= k
    lab[..., 1:] += 128
    rgb = cv2.cvtColor(np.clip(lab, 0, 255).round().astype(np.uint8), cv2.COLOR_LAB2RGB)
    return np.concatenate([rgb, f[..., 3:4]], axis=-1)


def main(args: list[str]) -> None:
    src = args[0]
    out_path = args[args.index('--out') + 1] if '--out' in args else src
    sheet = np.array(Image.open(src).convert('RGBA'))
    for r in ROWS:
        ref = sheet[r * FH:(r + 1) * FH, IDLE * FW:(IDLE + 1) * FW]
        for c in range(8):
            f = sheet[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW]
            before = blue_stats(f)[:2]
            sheet[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW] = match(f, ref)
            after = blue_stats(sheet[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW])[:2]
            if c == 0:
                print(f'行{r}：青の 明るさ・鮮やかさ  立ち {blue_stats(ref)[0]:.1f}・{blue_stats(ref)[1]:.1f}  コマ0 {before[0]:.1f}・{before[1]:.1f} → {after[0]:.1f}・{after[1]:.1f}')
    for r, src_r in MIRROR.items():
        for c in range(9):
            sheet[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW] = sheet[src_r * FH:(src_r + 1) * FH, c * FW:(c + 1) * FW][:, ::-1]
    Image.fromarray(sheet).save(out_path, quality=92, method=6)
    print('書き出し:', out_path)


if __name__ == '__main__':
    main(sys.argv[1:])
