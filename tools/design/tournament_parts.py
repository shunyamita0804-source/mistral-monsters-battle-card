# -*- coding: utf-8 -*-
"""大会の対戦表・トーナメント表の部品と、一般の出場者8人の顔（2026-10-27 指示書「大会の新しい形」。原本 design-parts/tournament-20261027/ は無改変）。

使い方：python3 -I tools/design/tournament_parts.py
書き出し：assets/images/ui/tournament/league_*.webp・bracket_*.webp、assets/images/characters/face_entrant_*.webp

- 部品は1枚に並べた絵なので、決まった枠で切り出す（枠は透明の所を測ったもの。名前・数字はゲームが重ねる）
- 総当たりの表（5×5マス）は大きさを変えない（マスの線の位置を src/ui/screens/tournamentScreen.ts の LEAGUE_LINES に書いた）
- トーナメントの部品・小さな印は半分の大きさ（画面では 150px 前後なので十分）
- 顔は胸から上の絵から、顔のまわりを正方形に切り抜く
"""
from __future__ import annotations

import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/tournament-20261027/images')
OUT_UI = os.path.join(ROOT, 'assets/images/ui/tournament')
OUT_FACE = os.path.join(ROOT, 'assets/images/characters')
Q = 90

# 切り出す枠（x1, y1, x2, y2）と縮め方
LEAGUE = {
    'league_grid': ((26, 25, 1058, 964), 1.0),
    'league_face_frame': ((1177, 15, 1540, 350), 0.5),
    'league_win': ((1177, 320, 1540, 669), 0.5),
    'league_self': ((1670, 68, 1903, 301), 0.5),
    'league_lose': ((1639, 360, 1927, 651), 0.5),
    'league_next': ((1263, 673, 1453, 861), 0.5),
    'league_row': ((1074, 872, 2014, 1005), 0.5),
}
BRACKET = {
    'bracket_card': ((17, 65, 677, 315), 0.5),
    'bracket_card_win': ((703, 63, 1363, 325), 0.5),
    'bracket_card_out': ((1380, 65, 2031, 315), 0.5),
    'bracket_join': ((44, 366, 694, 643), 0.5),
    'bracket_join_top': ((733, 353, 1349, 642), 0.5),
    'bracket_join_bottom': ((1387, 365, 2025, 649), 0.5),
    'bracket_final': ((52, 708, 1195, 821), 0.5),
    'bracket_final_glow': ((52, 838, 1195, 975), 0.5),
    'bracket_pedestal': ((1282, 752, 1664, 932), 0.5),
    'bracket_swords': ((1723, 681, 2008, 962), 0.5),
}
# 2人をまとめる線は、上の腕・まっすぐな縦の棒・真ん中の腕・下の腕に分ける（間の長さに合わせて縦の棒だけを伸ばす。飾りはゆがめない）
# 行の区切り（切り出した絵の中の y。原本の大きさ）：上の腕の終わり, 真ん中の腕の始まり, 真ん中の腕の終わり, 下の腕の始まり
JOIN_ROWS = {
    'bracket_join': (92, 96, 184, 188),
    'bracket_join_top': (104, 108, 192, 196),
    'bracket_join_bottom': (94, 98, 184, 188),
}
FACES = ['tobias', 'marie', 'jean', 'helena', 'claude', 'beatrice', 'zara', 'walter']
FACE_BOX = (200, 20, 824, 644)
FACE_SIZE = 256


# 顔の枠と勝ちの輪は絵の中で接している（枠の下の辺 y≒330 に輪の上の飾りが触れる）。
# 枠は下の辺より下の真ん中（輪の飾り）を消し、輪は枠の下の辺から上と、上の飾りのまわりより外（枠の角の飾り）を消す
TOUCH_Y = 331
TOUCH_CX = 1359
TOUCH_HALF = 42


def split_touching(name: str, part: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    px = part.load()
    x0, y0 = box[0], box[1]
    for y in range(part.height):
        for x in range(part.width):
            gx, gy = x + x0, y + y0
            center = abs(gx - TOUCH_CX) <= TOUCH_HALF
            if name == 'league_face_frame' and gy >= TOUCH_Y and center:
                px[x, y] = (0, 0, 0, 0)
            if name == 'league_win' and (gy <= TOUCH_Y or (gy < TOUCH_Y + 30 and not center)):
                px[x, y] = (0, 0, 0, 0)
    return part.crop(part.getbbox())


def cut(sheet: str, parts: dict) -> None:
    im = Image.open(os.path.join(SRC, sheet)).convert('RGBA')
    for name, (box, scale) in parts.items():
        part = im.crop(box)
        if name in ('league_face_frame', 'league_win'):
            part = split_touching(name, part, box)
        if scale != 1.0:
            part = part.resize((round(part.width * scale), round(part.height * scale)), Image.LANCZOS)
        if name in JOIN_ROWS:
            save_join(name, im.crop(box), scale)
            continue
        part.save(os.path.join(OUT_UI, f'{name}.webp'), quality=Q, method=6)
        print(name, part.size)


def save_join(name: str, part: Image.Image, scale: float) -> None:
    r0, r1, r2, r3 = JOIN_ROWS[name]
    pieces = {'a': (0, r0), 'bar1': (r0, r1), 'mid': (r1, r2), 'bar2': (r2, r3), 'b': (r3, part.height)}
    for key, (y0, y1) in pieces.items():
        piece = part.crop((0, y0, part.width, y1))
        w = round(part.width * scale)
        h = max(1, round(piece.height * scale))
        piece.resize((w, h), Image.LANCZOS).save(os.path.join(OUT_UI, f'{name}_{key}.webp'), quality=Q, method=6)
    print(name, 'pieces')


def main() -> None:
    os.makedirs(OUT_UI, exist_ok=True)
    cut('league_table_parts.png', LEAGUE)
    cut('bracket8_parts.png', BRACKET)
    for name in FACES:
        im = Image.open(os.path.join(SRC, f'face_entrant_{name}.png')).convert('RGBA')
        im.crop(FACE_BOX).resize((FACE_SIZE, FACE_SIZE), Image.LANCZOS).save(os.path.join(OUT_FACE, f'face_entrant_{name}.webp'), quality=Q, method=6)
        print('face', name)


if __name__ == '__main__':
    main()
