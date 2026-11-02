# -*- coding: utf-8 -*-
"""ミュロル LIFE 6 の正式カード：LIFE の字の下に残った細い線（前の数字の上のふち。y 97〜99）を、上下の画素の色から埋めて消す（指示書 AM【2】）。
各列で y96（直す範囲の外・原本のまま）と y100 のあいだを、y96 から始めはゆっくり変わる色でつなぐ。いまより明るくなる画素だけ変える（数字のふちの暗い所は変えない）。
x は数字の枠（814〜915）の中だけ。使い方: python3 -I fix_line.py 入力.png 出力.png"""
import sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src)
a = np.array(im).astype(float)
Y0, Y1 = 96, 100
X0, X1 = 814, 915
lum = lambda p: 0.299 * p[..., 0] + 0.587 * p[..., 1] + 0.114 * p[..., 2]
changed = 0
for y in (97, 98, 99):
    t = ((y - Y0) / (Y1 - Y0)) ** 2  # y96 からなめらかに（はじめはゆっくり）
    target = a[Y0, X0:X1 + 1, :3] * (1 - t) + a[Y1, X0:X1 + 1, :3] * t
    cur = a[y, X0:X1 + 1, :3]
    up = lum(target) > lum(cur) + 2
    a[y, X0:X1 + 1, :3][up] = target[up]
    changed += int(up.sum())
out = Image.fromarray(np.clip(np.rint(a), 0, 255).astype(np.uint8), im.mode)
out.save(dst)
print('changed px', changed)
