# -*- coding: utf-8 -*-
"""カードショップの新しい内装・外観・自動ドア（2026-10-27 ZIP「MistralBC_CardShop_Assets_20261027」の C・D・E・F）。

tools/design/seimon_world_build.py から呼ばれる（街と部屋をまとめて作るときに、カードショップだけこの絵を使う）。
原本は design-parts/cardshop-assets-20261027/assets/（無改変）。絵は描き直さない（重ねる・切り抜く・形式を変えるだけ）。

- 部屋（build_shop_room）：床と壁・家具・店の中の販売機・入口の戸・戸袋・戸枠・手前の壁を、素材の位置のまま並べる。
  素材は 1536×1024 の同じキャンバス。1px ＝ 部屋の単位 ROOM_UNIT（主人公の背 144×1.55 単位が、絵の中の人の背 約178px になる大きさ）。
  歩ける所（マス目）は、床の範囲から家具の足元を除いたもの（下の FLOOR・BLOCKS。素材の「家具と組み込み」の足元の線を見て決めた）
- 街の外観と外の自動ドアは 2026-10-28 に新しい外観（tools/design/town2026_build.py）へ替えたので、ここの街の部分は消した
"""
from __future__ import annotations

import os

from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/cardshop-assets-20261027/assets')
OUT_ROOMS = os.path.join(ROOT, 'assets/images/maps/rooms')
WEBP_Q = 88

CELL = 32
ROOM_UNIT = 1.25          # 絵の 1px → 部屋の単位
ROOM_W, ROOM_H = 1920, 1280
# 部屋を画面の高さに合わせるときの基準の高さ（ほかの部屋と同じ 1024。人物がほかの部屋と同じ大きさに見える。部屋は縦にも少し動く）
FIT_HEIGHT = 1024
FRONT_Z = 99999           # 手前の壁・入口の柱：いつも人より手前

# 家具：ファイル名（shop_furniture_ を除く）→ 足元の y（素材の「家具と組み込み」の足元の線）
FURNITURE = {
    'back_shelves': 245, 'stockroom': 190, 'back_left_shelf': 198, 'back_left': 265, 'counter': 390,
    'left_wall': 572, 'center_left': 552, 'center_right': 552, 'front_left': 745, 'right_wall': 735,
    'right_display': 503, 'easel': 503, 'plant_counter_left': 212, 'plant_back_left': 170,
    'plant_counter_right': 228, 'plant_right': 350, 'plant_left': 578,
}
GACHA_FOOT = 490

# 入口の戸（素材の「内側の自動ドア E」）：開口・戸1枚の幅・戸の足元
DOOR_OPENING = (600, 680, 352, 141)
DOOR_FOOT = 821

# 歩ける所（絵の px）。床：奥の壁の下〜手前の壁の上。左右の壁は斜め
FLOOR = [(205, 205), (1335, 205), (1490, 740), (45, 740)]
# 入口の通り道（戸を抜けて外の敷居まで）
PASSAGE = (612, 700, 940, 872)
# 家具の足元（歩けない）。四角 (x1, y1, x2, y2) か多角形
BLOCKS = [
    (445, 190, 1100, 392),                                    # カウンターと奥の棚（店員の場所も）
    (1095, 190, 1345, 300),                                   # 右奥の間仕切り・在庫棚
    (242, 195, 354, 266),                                     # 奥左の小展示台
    (414, 190, 464, 214),                                     # カウンター左の植木
    [(40, 166), (240, 166), (240, 335), (120, 578), (40, 578)],  # 左の壁の棚・左の植木
    (245, 408, 415, 553),                                     # 中央左のガラス展示台
    (398, 418, 518, 553),                                     # 中央右の展示台
    (50, 605, 435, 745),                                      # 手前左の展示台
    [(1340, 175), (1530, 175), (1530, 745), (1462, 745), (1340, 470)],  # 右の壁の棚
    (1023, 440, 1126, 504),                                   # 販売機の左の小展示台
    (1100, 420, 1280, 492),                                   # 店の中の販売機
    (1260, 450, 1358, 504),                                   # 販売機の右のイーゼル
    (1265, 300, 1325, 351),                                   # 右の植木
    (445, 618, 602, 760),                                     # 入口の左の柱と植木
    (948, 618, 1090, 760),                                    # 入口の右の柱と植木
]
# 調べる物（絵の px の範囲）。maps.ts の ID と同じ
ITEMS = {
    'COUNTER': (445, 240, 1100, 392),
    'PACK_MACHINE': (1100, 400, 1280, 492),
    'SHELF_WALL': (40, 166, 240, 578),
    'CASE_L': (245, 400, 415, 553),
    'CASE_R': (398, 410, 518, 553),
}
# 店員の立つ所（足元）。カウンターの絵より奥（カウンターが腰から下を隠す）で、カウンターの前の床のすぐ隣のマス
# （話しかけられる・テストの「人に行ける」を満たす）
CLERK_FOOT = (760, 371)
# 戸が開く範囲（入口の前後。絵の px）
DOOR_NEAR = (600, 590, 952, 872)
# 入ったときに立つ所の足元の y（絵の px）
SPAWN_Y = 630


def _load(name: str) -> Image.Image:
    return Image.open(os.path.join(SRC, f'{name}.png')).convert('RGBA')


def _save_cropped(im: Image.Image, name: str, box: tuple[int, int, int, int] | None = None) -> dict:
    """透明でない所だけ切り抜いて保存し、部屋の単位の位置を返す"""
    box = box or im.getbbox()
    os.makedirs(OUT_ROOMS, exist_ok=True)
    im.crop(box).save(os.path.join(OUT_ROOMS, name), quality=WEBP_Q, method=6)
    x1, y1, x2, y2 = box
    u = ROOM_UNIT
    return dict(file=f'maps/rooms/{name}', x=round(x1 * u), y=round(y1 * u), w=round((x2 - x1) * u), h=round((y2 - y1) * u))


def _cells(box: tuple[float, float, float, float]) -> dict:
    """絵の px の範囲 → マスの範囲"""
    c = CELL / ROOM_UNIT
    x1, y1, x2, y2 = box
    cx1, cy1 = int(x1 // c), int(y1 // c)
    cx2, cy2 = int(-(-x2 // c)), int(-(-y2 // c))
    return dict(x=cx1, y=cy1, w=cx2 - cx1, h=cy2 - cy1)


def build_shop_room() -> dict:
    u = ROOM_UNIT
    cols, rows = ROOM_W // CELL, ROOM_H // CELL
    c = CELL / u

    # ── 歩ける所 ──
    walk = Image.new('L', (1536, 1024), 0)
    d = ImageDraw.Draw(walk)
    d.polygon(FLOOR, fill=255)
    for b in BLOCKS:
        if isinstance(b, list):
            d.polygon(b, fill=0)
        else:
            d.rectangle(b, fill=0)
    d.rectangle(PASSAGE, fill=255)
    grid = []
    for ry in range(rows):
        row = ''
        for cx in range(cols):
            px, py = (cx + 0.5) * c, (ry + 0.5) * c
            row += '.' if px < 1536 and py < 1024 and walk.getpixel((int(px), int(py))) else '#'
        grid.append(row)

    # ── 絵 ──
    shell = _load('shop_interior_shell').convert('RGB')
    os.makedirs(OUT_ROOMS, exist_ok=True)
    shell.save(os.path.join(OUT_ROOMS, 'cardshop_shell.webp'), quality=WEBP_Q, method=6)
    tiles = [dict(file='maps/rooms/cardshop_shell.webp', x=0, y=0, w=ROOM_W, h=ROOM_H)]
    sprites = []
    for name, foot in FURNITURE.items():
        s = _save_cropped(_load(f'shop_furniture_{name}'), f'cardshop_{name}.webp')
        sprites.append({**s, 'z': round(foot * u)})
    sprites.append({**_save_cropped(_load('shop_gacha_machine'), 'cardshop_gacha_machine.webp'), 'z': round(GACHA_FOOT * u)})
    # 戸袋・戸枠は戸の足元の高さで（店の中にいる人より手前・敷居の外に出た人より奥）。手前の壁はいつも手前
    door_z = round(DOOR_FOOT * u)
    for name in ('shop_door_pocket_left', 'shop_door_pocket_right', 'shop_door_frame'):
        sprites.append({**_save_cropped(_load(name), f'cardshop_{name[5:]}.webp'), 'z': door_z + 1})
    sprites.append({**_save_cropped(_load('shop_interior_front'), 'cardshop_front.webp'), 'z': FRONT_Z})

    # ── 入口の戸（開口の中で左右に動かす） ──
    ox, oy, ow, oh = DOOR_OPENING
    half = ow // 2
    left = _save_cropped(_load('shop_door_left'), 'cardshop_door_left.webp', (ox, oy, ox + half, oy + oh))
    right = _save_cropped(_load('shop_door_right'), 'cardshop_door_right.webp', (ox + half, oy, ox + ow, oy + oh))
    door = dict(
        id='SHOP_IN',
        clip=dict(x=round(ox * u), y=round(oy * u), w=round(ow * u), h=round(oh * u)),
        left=left, right=right, travel=round(half * u), z=door_z, near=_cells(DOOR_NEAR),
    )

    # ── 調べる物・店員・出入口 ──
    items = {k: _cells(v) for k, v in ITEMS.items()}
    ccx, ccy = int(CLERK_FOOT[0] // c), int(CLERK_FOOT[1] // c)
    items['CLERK_SPOT'] = dict(x=ccx, y=ccy - 1, w=1, h=3)  # maps.ts の spotOf（足元＝下から2つ目のマス）
    exit_row = int(PASSAGE[3] // c) - 1
    exit_cols = [cx for cx in range(cols) if grid[exit_row][cx] == '.']
    door_cx = int((ox + ow / 2) // c)
    # 入ったときに立つ所：入口の戸枠の上の横木より奥（足が横木にかからない）。戸が開く範囲の中なので、入った直後は戸が開いている
    spawn_row = int(SPAWN_Y // c)
    assert grid[spawn_row][door_cx] == '.', 'spawn'
    return dict(
        id='shop', cols=cols, rows=rows, width=ROOM_W, height=ROOM_H, cell=CELL, fitHeight=FIT_HEIGHT,
        grid=grid, tiles=tiles, sprites=sprites, items=items,
        exit=dict(x=exit_cols[0], y=exit_row, w=len(exit_cols), h=1),
        spawn=dict(x=door_cx, y=spawn_row),
        doorAnims=[door],
    )
