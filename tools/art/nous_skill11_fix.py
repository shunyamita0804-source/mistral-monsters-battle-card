"""ノウスの技の絵 11（ろっぽんうででうける）の右上に浮いている壺（体とつながっていない）を消す（2026-11-07 指示書 BN【絵の直し】3）。
腕・光・体はさわらない。壺とそのまわりの光だけを、まわりの青いグラデーションでなじませる（描き直しはしない）。
python3 -I tools/art/nous_skill11_fix.py <原本.png> <出力.png>

- 壺の範囲：右上の窓（x 560〜740・y 150〜320）の中で「青くない画素」のかたまりのうち、壺の真ん中（640, 230）を含むもの。外へ 16px 広げる（光のふち。腕・体のまわり 4px は除く）
- 埋める色：窓の中の青い画素から、位置の2次式で背景のグラデーションを求めて塗る。境目はぼかしてなじませる
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
im = np.array(Image.open(src).convert('RGB')).astype(float)
X0, X1, Y0, Y1 = 560, 740, 150, 320
win = im[Y0:Y1, X0:X1]
r, g, b = win[..., 0], win[..., 1], win[..., 2]
blue = (b > r + 100) & (b > g + 60)
lab, _ = ndimage.label(~blue)
pot = lab == lab[230 - Y0, 640 - X0]
assert pot.any() and not pot[:, 0].any(), '壺のかたまりが腕とつながっている'
mask = ndimage.binary_dilation(pot, iterations=16)
# 腕・体（壺でない、青くない画素）のまわり 4px は残す（腕のふちの光をさわらない）
mask &= ~ndimage.binary_dilation(~blue & ~pot, iterations=4)
# 背景の2次式（窓の中の、壺から離れた青い画素で求める）
yy, xx = np.mgrid[Y0:Y1, X0:X1]
fit = blue & ~ndimage.binary_dilation(pot, iterations=24) & ~ndimage.binary_dilation(~blue & ~pot, iterations=8)
A = np.stack([np.ones_like(xx), xx, yy, xx * xx, yy * yy, xx * yy], -1).astype(float)
model = np.zeros_like(win)
for c in range(3):
    coef, *_ = np.linalg.lstsq(A[fit], win[..., c][fit], rcond=None)
    model[..., c] = A @ coef
core = ndimage.binary_dilation(pot, iterations=9) & mask
soft = ndimage.gaussian_filter(mask.astype(float), 3.0)[..., None]
soft = np.maximum(soft, core[..., None].astype(float))
soft = np.where(mask[..., None] | (soft > 0), soft, 0)
# 腕（窓の左下）に触れないよう、青くない画素で壺以外のものは残す
keep = (~blue & ~pot)[..., None]
out_win = np.where(keep, win, win * (1 - soft) + model * soft)
im[Y0:Y1, X0:X1] = out_win
Image.fromarray(np.clip(im + 0.5, 0, 255).astype(np.uint8)).save(dst)
print(dst, '消した画素', int(mask.sum()))
