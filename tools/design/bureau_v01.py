# -*- coding: utf-8 -*-
"""カードバトラー管理局の内装（2026-10-27 ZIP「管理局_制作素材_v01」。原本 design-parts/bureau-v01-20261027/ は無改変）。

使い方：python3 -I tools/design/bureau_v01.py
書き出し：assets/images/maps/rooms/bureau_*.webp と src/data/bureauArt.generated.ts（ほかの部屋は触らない）。
街の外観は 2026-10-28 に新しい部品（building_bureau.png。tools/design/town2026_build.py）へ替えた（前は v01 の EXTERIOR を街に焼き込んでいた）

- 素材は 1536×1024 の同じキャンバス（原点をそろえたまま使う。家具だけを切り抜いても位置は変えない）。
  1px ＝ 部屋の単位 ROOM_UNIT（カードショップと同じ。人の背が絵の中で約178px）
- 歩ける所・家具の足元・立ち位置は素材の LAYOUT_SPEC の提案値をもとに、32 単位のマス目に直したもの
- 入口は扉のない開いた通り道（v01 の提案。左右に開く扉の部品は v01 に無い）
- 受付の人は流用（大会会場の受付の絵。暫定）。カウンターの奥に見せ、腰から下はカウンターが隠す
"""
from __future__ import annotations

import json
import os

from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/bureau-v01-20261027')
OUT_ROOMS = os.path.join(ROOT, 'assets/images/maps/rooms')
OUT_TS = os.path.join(ROOT, 'src/data/bureauArt.generated.ts')
WEBP_Q = 88

CELL = 32
ROOM_UNIT = 1.25
ROOM_W, ROOM_H = 1920, 1280
FIT_HEIGHT = 1024
BG = (16, 18, 26)

# 歩ける所（LAYOUT_SPEC の多角形。入口の通り道を含む）
FLOOR = [(250, 300), (1286, 300), (1410, 760), (975, 760), (975, 955), (560, 955), (560, 760), (126, 760)]
# 家具の足元（歩けない）
BLOCKS = [
    (470, 445, 1066, 555),   # カウンター
    (700, 395, 836, 445),    # カウンターの奥の受付の人の所（奥へ回っても人に重ならない）
]
# 家具：ファイル名 → 足元の y（LAYOUT_SPEC の重なり順）
FURNITURE = {'BACK_SHELVES': 283, 'COUNTER': 553}
# 調べる物（絵の px）
# カウンターは前の板の所（名前の札が受付の人に重ならないように）
ITEMS = {'COUNTER': (470, 445, 1066, 555), 'SHELVES': (560, 165, 976, 283)}
# 受付の人の見た目の足元（LAYOUT_SPEC は (768,425)。ゲームの人の大きさでは膝から下しか隠れないので、少し手前にして腰から下を隠す）
CLERK_FOOT = (768, 448)
# 主人公が受付で止まる所の足元（LAYOUT_SPEC は (720,625)。話せる近さ（2マス）に合わせて少し前）
PLAYER_FOOT = (768, 605)
# 入ったときに立つ所・出口の行
SPAWN_FOOT = (768, 865)
EXIT_BOTTOM = 955


def _load(name: str) -> Image.Image:
    return Image.open(os.path.join(SRC, f'{name}.png')).convert('RGBA')


def _save(im: Image.Image, name: str, box: tuple[int, int, int, int] | None = None) -> dict:
    box = box or im.getbbox()
    os.makedirs(OUT_ROOMS, exist_ok=True)
    im.crop(box).save(os.path.join(OUT_ROOMS, name), quality=WEBP_Q, method=6)
    x1, y1, x2, y2 = box
    u = ROOM_UNIT
    return dict(file=f'maps/rooms/{name}', x=round(x1 * u), y=round(y1 * u), w=round((x2 - x1) * u), h=round((y2 - y1) * u))


def _cells(box: tuple[float, float, float, float]) -> dict:
    c = CELL / ROOM_UNIT
    x1, y1, x2, y2 = box
    cx1, cy1 = int(x1 // c), int(y1 // c)
    cx2, cy2 = int(-(-x2 // c)), int(-(-y2 // c))
    return dict(x=cx1, y=cy1, w=cx2 - cx1, h=cy2 - cy1)


def build() -> dict:
    u = ROOM_UNIT
    c = CELL / u
    cols, rows = ROOM_W // CELL, ROOM_H // CELL

    walk = Image.new('L', (1536, 1024), 0)
    d = ImageDraw.Draw(walk)
    d.polygon(FLOOR, fill=255)
    for b in BLOCKS:
        d.rectangle(b, fill=0)
    grid = []
    for ry in range(rows):
        row = ''
        for cx in range(cols):
            px, py = (cx + 0.5) * c, (ry + 0.5) * c
            row += '.' if px < 1536 and py < 1024 and walk.getpixel((int(px), int(py))) else '#'
        grid.append(row)

    # 床と壁（透明な所は部屋の外の暗い色）
    shell = Image.new('RGBA', (1536, 1024), BG + (255,))
    shell.alpha_composite(_load('ROOM_SHELL'))
    os.makedirs(OUT_ROOMS, exist_ok=True)
    shell.convert('RGB').save(os.path.join(OUT_ROOMS, 'bureau_shell.webp'), quality=WEBP_Q, method=6)
    tiles = [dict(file='maps/rooms/bureau_shell.webp', x=0, y=0, w=ROOM_W, h=ROOM_H)]
    sprites = [{**_save(_load(name), f'bureau_{name.lower()}.webp'), 'z': round(foot * u)} for name, foot in FURNITURE.items()]

    items = {k: _cells(v) for k, v in ITEMS.items()}
    # 受付の人：話しかけるマスはカウンターの一番手前の行（カウンターの中なので歩けない）。見た目は CLERK_FOOT まで奥（maps.ts の drawDy）
    clerk_cx = int(CLERK_FOOT[0] // c)
    clerk_row = int((BLOCKS[0][3] - 1) // c)
    assert grid[clerk_row][clerk_cx] == '#' and grid[clerk_row + 1][clerk_cx] == '.', 'clerk'
    items['CLERK_SPOT'] = dict(x=clerk_cx, y=clerk_row - 1, w=1, h=3)  # maps.ts の spotOf（足元＝下から2つ目のマス）
    draw_dy = int(CLERK_FOOT[1] // c) - clerk_row
    # 主人公が受付で止まる所（話せる近さ：受付の人から2マス以内・人のまわり1マスより外）
    pcx, pcy = int(PLAYER_FOOT[0] // c), int(PLAYER_FOOT[1] // c)
    assert grid[pcy][pcx] == '.' and pcy - clerk_row == 2, ('player spot', pcy, clerk_row)
    items['PLAYER_SPOT'] = dict(x=pcx, y=pcy, w=1, h=1)

    exit_row = int(EXIT_BOTTOM // c) - 1
    exit_cols = [cx for cx in range(cols) if grid[exit_row][cx] == '.']
    sx, sy = int(SPAWN_FOOT[0] // c), int(SPAWN_FOOT[1] // c)
    assert grid[sy][sx] == '.', 'spawn'
    return dict(
        id='bureau', cols=cols, rows=rows, width=ROOM_W, height=ROOM_H, cell=CELL, fitHeight=FIT_HEIGHT,
        grid=grid, tiles=tiles, sprites=sprites, items=items,
        exit=dict(x=exit_cols[0], y=exit_row, w=len(exit_cols), h=1),
        spawn=dict(x=sx, y=sy),
    ), draw_dy


def main() -> None:
    art, draw_dy = build()
    body = json.dumps(art, ensure_ascii=False, indent=1)
    # 絵のファイルは import して、ビルドが付けた URL を使う（worldArt.generated.ts と同じ形）
    files = [im['file'] for im in art['tiles'] + art['sprites']]
    for i, file in enumerate(files):
        body = body.replace(f'"file": "{file}"', f'"file": bureauImg{i}')
    with open(OUT_TS, 'w', encoding='utf-8') as f:
        f.write('// 自動生成：tools/design/bureau_v01.py（手で書き換えない）\n')
        f.write('// カードバトラー管理局の内装（素材 v01。design-parts/bureau-v01-20261027/）\n')
        for i, file in enumerate(files):
            f.write(f"import bureauImg{i} from '@assets/images/{file}';\n")
        f.write("import type { ArtMap } from './worldArt.generated.ts';\n\n")
        f.write(f'/** 受付の人を、話しかけるマスから何マス奥に見せるか（maps.ts の drawDy） */\nexport const BUREAU_CLERK_DRAW_DY = {draw_dy};\n\n')
        f.write(f'export const BUREAU_ART: ArtMap = {body};\n')
    print('ok', OUT_TS, 'drawDy', draw_dy, 'spawn', art['spawn'], 'exit', art['exit'], 'items', art['items'])


if __name__ == '__main__':
    main()
