# -*- coding: utf-8 -*-
"""デッキ編集の「大きなカードの台」を、左の枠を広く・全体を少し高くした絵にする（2026-11-02 指示書 AW【2】「上の大きなカードが小さい」）。

使い方: python3 -I tools/art/deck_stand_tall.py
- もとの台 assets/images/ui/deck/stand.webp（720×351）は変えない。新しい台 stand_tall.webp（720×400）を書く
- 左の枠（x 25〜237）と右の紙（x 237〜720）を、それぞれ9つに分けて広げる（角の飾りはそのまま。ふちと真ん中だけ伸ばす）
- 左の枠の窓（透明）は、技カード（253×382）を窓の高さいっぱいに近く入れられる横幅にする
"""
from __future__ import annotations

import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets/images/ui/deck/stand.webp')
OUT = os.path.join(ROOT, 'assets/images/ui/deck/stand_tall.webp')
W, H = 720, 400
SPLIT_SRC = 237          # もとの絵の、左の枠と右の紙のさかい
SPLIT_DST = 284          # 新しい絵のさかい（左の枠を広く）
B = 44                   # 9つに分けるときの角の大きさ（角の飾りが収まる）


def nine(piece: Image.Image, size: tuple[int, int], b: int = B) -> Image.Image:
    w, h = piece.size
    tw, th = size
    out = Image.new('RGBA', size, (0, 0, 0, 0))
    xs = [(0, b, 0, b), (b, w - b, b, tw - b), (w - b, w, tw - b, tw)]
    ys = [(0, b, 0, b), (b, h - b, b, th - b), (h - b, h, th - b, th)]
    for sx1, sx2, dx1, dx2 in xs:
        for sy1, sy2, dy1, dy2 in ys:
            part = piece.crop((sx1, sy1, sx2, sy2)).resize((dx2 - dx1, dy2 - dy1), Image.LANCZOS)
            out.alpha_composite(part, (dx1, dy1))
    return out


def main() -> None:
    src = Image.open(SRC).convert('RGBA')
    sw, sh = src.size
    left = nine(src.crop((0, 0, SPLIT_SRC, sh)), (SPLIT_DST, H))
    right = nine(src.crop((SPLIT_SRC, 0, sw, sh)), (W - SPLIT_DST, H))
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.alpha_composite(left, (0, 0))
    out.alpha_composite(right, (SPLIT_DST, 0))
    out.save(OUT, quality=92, method=6)
    print('ok', OUT)


if __name__ == '__main__':
    main()
