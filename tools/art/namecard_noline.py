# -*- coding: utf-8 -*-
"""名刺の台紙から、せりふの欄の真ん中の飾りの横線を消す（2026-11-02 指示書 AW【6】「せりふに線が重なって消し線に見える」）。

使い方: python3 -I tools/art/namecard_noline.py
- 消す前の台紙は design-parts/aw-screen-fixes-20261102/namecard_*_before.webp（この道具はそこから読む。何度動かしても同じ結果）
- 線の行のまわり（上下7px）を、すぐ上の紙の模様（15行ぶん）で置きかえ、さかいめを少しぼかす。欄のふちの飾りには触らない
"""
from __future__ import annotations

import os

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/aw-screen-fixes-20261102')
OUT = os.path.join(ROOT, 'assets/images/ui/album')
# 台紙ごとの (線の行 y, 消す x の範囲)。台紙は 828 px 幅。線は欄の内側の 303〜795 px、飾りのひし形は上下 5px ほど
CARDS = {
    'namecard_town': (245, 296, 804),
    'namecard_opponent': (237, 296, 804),
}
HALF = 7


def main() -> None:
    for name, (y, x1, x2) in CARDS.items():
        a = np.array(Image.open(os.path.join(SRC, f'{name}_before.webp')).convert('RGBA')).astype(float)
        band = a[y - HALF - 2 * HALF - 1:y - HALF, x1:x2].copy()  # すぐ上の紙（15行）
        a[y - HALF:y + HALF + 1, x1:x2] = band
        # 上下のさかいめを2行ずつなじませる
        for k, w in ((y - HALF - 1, 0.5), (y + HALF + 1, 0.5)):
            a[k, x1:x2] = a[k, x1:x2] * (1 - w) + (a[k - 1, x1:x2] + a[k + 1, x1:x2]) / 2 * w
        Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(os.path.join(OUT, f'{name}.webp'), quality=92, method=6)
        print(name, 'ok')


if __name__ == '__main__':
    main()
