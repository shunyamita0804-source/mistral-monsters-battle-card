# -*- coding: utf-8 -*-
"""木の橋の絵（design-parts/town-20261028/wood_bridge_front.png）を、真ん中の板を何枚か抜いて短くした版を作る（2026-10-29 夜 指示書 A）。

- 原本は変えない。出力は design-parts/town-20261028/wood_bridge_front_short.png
- 縮めない（幅・はしの柱・はしの板はそのまま）。上下の柱のあいだから CUT_LEN 行を抜いて、上と下をつなぐ
  - 板は、板のつなぎ目（暗い線）どうしでつなぐ（DECK_CUT）
  - 欄干は、飾りの出っぱりの無い所どうしでつなぐ（RAIL_CUT。上と下がいちばん似ている行を選んだ）
- 絵は奥ほど少し細い（欄干と板のふちが少しななめ）ので、そのままつなぐと欄干に段がつく。
  上下の柱のあいだの行だけ、外のふち・板のふちがそれぞれ1本のまっすぐな線になるよう、横に少しだけ（最大 3% ほど）合わせる

使い方：python3 -I tools/design/wood_bridge_shorten.py
"""
from __future__ import annotations

import os

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/town-20261028/wood_bridge_front.png')
OUT = os.path.join(ROOT, 'design-parts/town-20261028/wood_bridge_front_short.png')

CUT_LEN = 592            # 抜く行の数（px）
DECK_CUT = 617           # 板：この行（板のつなぎ目）から CUT_LEN 行を抜く（617 と 1209 がどちらもつなぎ目）
RAIL_CUT = 454           # 欄干：この行から CUT_LEN 行を抜く
RAIL = (400, 1250)       # 横を合わせる範囲（原本の行。上の柱の下〜下の柱の上）
CX = 460                 # 橋の真ん中（px）
BLEND = 12               # 欄干のつなぎ目は、上下を少しずつ混ぜる（木目の細い線を出さない）


def fit_lines(alpha: np.ndarray, lum: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """原本の外のふち（左）・板のふち（左）を、行の1次式で表す（右は真ん中で折り返し）"""
    ys = np.arange(RAIL[0], RAIL[1] + 1)
    outer = [int(np.argmax(alpha[y] > 128)) for y in ys]
    deck = [270 + int(np.argmin(lum[y, 270:320])) for y in ys]
    return np.polyfit(ys, outer, 1), np.polyfit(ys, deck, 1)


def warp_row(row: np.ndarray, src_pts: list[float], dst_pts: list[float]) -> np.ndarray:
    """1行を横に動かす：dst_pts の x に src_pts の x が来るよう、あいだは直線で（真ん中で左右対称）"""
    w = row.shape[0]
    xs = np.arange(w, dtype=np.float32)
    sx = np.interp(xs, dst_pts, src_pts)
    x0 = np.clip(np.floor(sx).astype(int), 0, w - 1)
    x1 = np.clip(x0 + 1, 0, w - 1)
    f = (sx - x0)[:, None]
    pre = row.astype(np.float32)
    pre[:, :3] *= pre[:, 3:4] / 255     # 透明度を掛けた色で混ぜる（ふちに黒いにじみを出さない）
    v = pre[x0] * (1 - f) + pre[x1] * f
    al = np.clip(v[:, 3:4], 1e-3, None)
    v[:, :3] = np.where(v[:, 3:4] > 0, v[:, :3] * 255 / al, 0)
    return v


def shorten() -> Image.Image:
    arr = np.array(Image.open(SRC).convert('RGBA'))
    h, w = arr.shape[:2]
    p_out, p_deck = fit_lines(arr[..., 3], arr[..., :3].astype(np.float32).mean(2))
    oh = h - CUT_LEN
    y_top, y_bot = RAIL[0], RAIL[1] - CUT_LEN      # 出力の行で、横を合わせる範囲

    def src_row(y: int, cut: int) -> int:
        return y if y < cut else y + CUT_LEN

    out = np.zeros((oh, w, 4), dtype=np.float32)
    for y in range(oh):
        rr, rd = src_row(y, RAIL_CUT), src_row(y, DECK_CUT)
        if not (y_top < y < y_bot):
            out[y] = arr[rr]
            continue
        t = (y - y_top) / (y_bot - y_top)
        want_o = np.polyval(p_out, RAIL[0]) * (1 - t) + np.polyval(p_out, RAIL[1]) * t
        want_d = np.polyval(p_deck, RAIL[0]) * (1 - t) + np.polyval(p_deck, RAIL[1]) * t
        dst = [0, want_o, want_d, CX, 2 * CX - want_d, 2 * CX - want_o, w - 1]

        def mapped(sy: int) -> np.ndarray:
            o, d = np.polyval(p_out, sy), np.polyval(p_deck, sy)
            return warp_row(arr[sy], [0, o, d, CX, 2 * CX - d, 2 * CX - o, w - 1], dst)

        rail = mapped(rr)
        if RAIL_CUT <= y < RAIL_CUT + BLEND:
            k = (y - RAIL_CUT + 1) / (BLEND + 1)
            rail = mapped(y) * (1 - k) + rail * k
        deck = rail if rd == rr else mapped(rd)
        xl, xr = int(round(want_d)), int(round(2 * CX - want_d))
        row = rail.copy()
        row[xl:xr + 1] = deck[xl:xr + 1]
        out[y] = row
    return Image.fromarray(np.clip(np.round(out), 0, 255).astype(np.uint8))


if __name__ == '__main__':
    im = shorten()
    im.save(OUT)
    print(OUT, im.size)
