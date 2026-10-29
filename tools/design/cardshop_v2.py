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

import shop_goods_20261030 as shop_goods

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/cardshop-assets-20261027/assets')
# 2026-10-30（指示書 N）：正面向きに描き直した床と壁・家具 10枚（左右の壁がまっすぐ・家具に遠近なし。進行の検品で合格）。同じ名前なので先に探す。
# 奥の棚・在庫の棚・入口と手前の壁・戸・販売機は前のまま（SRC）
SRC_FRONT = os.path.join(ROOT, 'design-parts/cardshop-frontfacing-20261030')
OUT_ROOMS = os.path.join(ROOT, 'assets/images/maps/rooms')
WEBP_Q = 88

CELL = 32
ROOM_UNIT = 1.25          # 絵の 1px → 部屋の単位
ROOM_W, ROOM_H = 1920, 1280
# 部屋を画面の高さに合わせるときの基準の高さ（ほかの部屋と同じ 1024。人物がほかの部屋と同じ大きさに見える。部屋は縦にも少し動く）
FIT_HEIGHT = 1024
FRONT_Z = 99999           # 手前の壁・入口の柱：いつも人より手前

# 家具：ファイル名（shop_furniture_ を除く）→ 足元の y（家具が床に接している下のはし。人と前後を比べる）
# 2026-10-30（指示書 N）：正面向きの新しい家具の下のはしで測り直した
FURNITURE = {
    'back_shelves': 245, 'stockroom': 190, 'back_left_shelf': 191, 'back_left': 251, 'counter': 400,
    'left_wall': 561, 'center_left': 528, 'center_right': 552, 'front_left': 742, 'right_wall': 665,
    'right_display': 554,
}
# 植木（2026-10-30 指示書 N）：新しい家具の絵には植木を描いていないので、前の植木の絵を、商品や通り道をふさがない所へ置き直す。
# 絵の名前（shop_furniture_ を除く）→ 置く所（足元の真ん中の x・足元の y。絵の px）。入口の左右の植木は手前の壁の絵にある
PLANTS = {
    # カウンターの左のはしの奥（奥左の段の棚と奥の棚のあいだ）
    'plant_counter_left': (436, 244),
    # 販売機の右下・右の壁ぞいの棚の手前（販売機の前と棚の前の通り道はあける）
    'plant_left': (1298, 712),
}
GACHA_FOOT = 490
# 2026-10-29 iPhone の試遊「販売機をもっと大きく・存在感を。棚と重なっている」：
# 販売機を 1.5 倍（足元の真ん中 GACHA_ANCHOR を動かさずに大きくし、少し手前へ GACHA_FORWARD）。
# 左わきの小展示台（right_display）は左へ RIGHT_DISPLAY_SHIFT ずらし、右わきのイーゼル（easel）は置かない。
# 足元に光の床（GLOW。絵ではなく、やわらかい金色の楕円をここで作る）を敷いて主役にする
GACHA_SCALE = 1.5
GACHA_ANCHOR = (1190, 490)
GACHA_FORWARD = 30
# 2026-10-29 深夜（指示書 E。ユーザー決定）：店の中の販売機を、ガチャの画面の機械の絵（assets/images/ui/gacha/ の 900×1300 の6枚。
# gachaMachine.ts と同じ重ね順）から作る。ガラスの奥は紺（前の販売機の窓の色。パックは入れない）。描き直し・色の変更・引きのばしはしない（縮めるだけ）。
# 大きさ：前の 1.5 倍の販売機と同じ高さ（絵の y 85〜520）・同じ足元（下のはし y 520。真ん中は前の本体の真ん中 x 1156。前の絵は右にハンドルがあった）
GACHA_UI = os.path.join(ROOT, 'assets/images/ui/gacha')
# 2026-10-30（指示書 J。ユーザー「ガラスじゃないのがいい。現実世界のカードダスみたいに」）：窓（ガラスと奥行きのある内側の壁）をやめ、
# モンスターの絵を印刷した平らなパネル（panel_shop。tools/design/gacha_panel_build.py が作る）でおおう。窓の四すみの星（machine_stars）はパネルの上
GACHA_LAYERS = ['machine_front', 'panel_shop', 'machine_stars', 'knob_base', 'outlet_closed', 'outlet_front', 'knob_dial']
GACHA_PANEL_AT = (212, 268)              # パネルの左上（900×1300 の px。gacha_panel_build.PANEL_BOX と同じ）
GACHA_BOX = (1156, 85, 520)              # 店の中の機械の真ん中の x・上のはし・下のはし（絵の px）
GLOW = dict(rx=190, ry=58, color=(255, 214, 120))

# 入口の戸（素材の「内側の自動ドア E」）：開口・戸1枚の幅・戸の足元
DOOR_OPENING = (600, 680, 352, 141)
DOOR_FOOT = 821

# 歩ける所（絵の px）。2026-10-30（指示書 N）：左右の壁がまっすぐになり、床が左右のはし（x 約35〜1500）まで広がった。
# 床：奥の壁の下（腰板・柱の下 y 200）〜手前の壁の上。左右の壁の帯の上は歩けない
FLOOR = [(36, 200), (1500, 200), (1500, 742), (36, 742)]
# 入口の通り道（戸を抜けて外の敷居まで）
PASSAGE = (612, 700, 940, 872)
# 家具の足元（歩けない）。四角 (x1, y1, x2, y2)。家具は絵の足元（床に接している面）にだけ当てる（上の面の奥までは当てない）。
# 奥へ回りこむと人が家具に隠れるだけなので、奥の家具のうしろ（カウンターの中・販売機のうしろ）は当てる
BLOCKS = [
    (36, 192, 224, 562),                                      # 左の壁ぞいの棚3台（壁にくっついている。棚どうしのすき間も通れない）
    (1338, 192, 1500, 666),                                   # 右の壁ぞいの棚3台
    (242, 205, 356, 252),                                     # 奥左の小さなガラスの台
    (300, 192, 408, 205),                                     # 奥左の段の棚の足元
    # カウンターの下のはしは y 400。マスの真ん中が 396.8 の行（カウンターの前）は歩けるよう、少しだけ手前（395。四角は下のはしの行もふさぐ）で止める（店員と話せる）
    (445, 192, 1008, 395),                                    # カウンターと奥の棚（店員の場所も）
    (245, 474, 406, 529),                                     # 中央左のガラスの台
    (415, 500, 523, 553),                                     # 中央右のガラスの台
    (36, 632, 436, 742),                                      # 手前左の額の台（左の壁とのすき間も）
    (900, 508, 1004, 555),                                    # 販売機の左の小さな展示台
    # 店の中の販売機：絵の左右のはし（x 1014〜1298）。奥はカウンターの右〜右の壁の棚まで（機械のうしろに入れない）
    (1008, 192, 1300, 522),
    (1300, 192, 1338, 522),                                   # 販売機と右の棚のあいだ（細い行き止まりにしない）
    (1270, 668, 1328, 714),                                   # 販売機の右下の植木
    (402, 205, 470, 246),                                     # カウンターの左のはしの奥の植木
    # 入口の左右の柱と植木（手前の壁の絵。前と同じ）
    (456, 690, 602, 760),
    (948, 690, 1090, 760),
]
# 調べる物（絵の px の範囲）。maps.ts の ID と同じ
ITEMS = {
    'COUNTER': (445, 250, 1008, 400),
    'PACK_MACHINE': (1014, 420, 1298, 522),
    'SHELF_WALL': (36, 185, 224, 562),
    'CASE_L': (245, 340, 406, 529),
    'CASE_R': (415, 380, 523, 553),
}
# 店員の立つ所（足元）。カウンターの絵より奥（カウンターが腰から下を隠す）で、カウンターの前の床のすぐ隣のマス
# （話しかけられる・テストの「人に行ける」を満たす）
CLERK_FOOT = (760, 371)
# 戸が開く範囲（入口の前後。絵の px）
DOOR_NEAR = (600, 590, 952, 872)
# 入ったときに立つ所の足元の y（絵の px）
SPAWN_Y = 630


def _load(name: str) -> Image.Image:
    front = os.path.join(SRC_FRONT, f'{name}.png')
    return Image.open(front if os.path.exists(front) else os.path.join(SRC, f'{name}.png')).convert('RGBA')


def _moved_plant(name: str, foot: tuple[int, int]) -> Image.Image:
    """前の植木の絵を、足元の真ん中が foot に来るように動かした 1536×1024 の絵（描き直さない）"""
    im = _load(f'shop_furniture_{name}')
    piece = im.crop(im.getbbox())
    canvas = Image.new('RGBA', im.size)
    canvas.alpha_composite(piece, (round(foot[0] - piece.width / 2), foot[1] - piece.height))
    return canvas


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


def _gacha_machine() -> dict:
    """店の中の販売機：ガチャの画面の機械の絵（GACHA_LAYERS）を重ねて、GACHA_BOX の高さ・足元に縮めて置く"""
    full = Image.new('RGBA', (900, 1300))
    for name in GACHA_LAYERS:
        im = Image.open(os.path.join(GACHA_UI, f'{name}.webp')).convert('RGBA')
        full.alpha_composite(im, GACHA_PANEL_AT if name.startswith('panel_') else (0, 0))
    full = full.crop(full.getbbox())
    cx, top, bottom = GACHA_BOX
    k = (bottom - top) / full.height
    small = full.resize((round(full.width * k), bottom - top), Image.LANCZOS)
    canvas = Image.new('RGBA', (1536, 1024))
    canvas.alpha_composite(small, (round(cx - small.width / 2), top))
    return _save_cropped(canvas, 'cardshop_gacha_machine.webp')


def _gacha_glow() -> dict:
    """販売機の足元の光の床（やわらかい金色の楕円。床の上・家具より奥）"""
    from PIL import ImageFilter
    ax, ay = GACHA_BOX[0], GACHA_ANCHOR[1]
    cy = ay + GACHA_FORWARD - 6
    rx, ry = GLOW['rx'], GLOW['ry']
    canvas = Image.new('RGBA', (1536, 1024))
    m = Image.new('L', canvas.size, 0)
    ImageDraw.Draw(m).ellipse([ax - rx, cy - ry, ax + rx, cy + ry], fill=150)
    m = m.filter(ImageFilter.GaussianBlur(26))
    canvas.paste(Image.new('RGBA', canvas.size, GLOW['color'] + (255,)), (0, 0), m)
    return _save_cropped(canvas, 'cardshop_gacha_glow.webp')


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
        # 棚・ガラスの台・額の無地の紺のカード・パックの上に商品を重ねる（2026-10-30 正面向きの家具：tools/design/shop_goods_20261030.py）
        im = shop_goods.dress(name, _load(f'shop_furniture_{name}'))
        s = _save_cropped(im, f'cardshop_{name}.webp')
        sprites.append({**s, 'z': round(foot * u)})
    for name, foot_xy in PLANTS.items():
        s = _save_cropped(_moved_plant(name, foot_xy), f'cardshop_{name}.webp')
        sprites.append({**s, 'z': round(foot_xy[1] * u)})
    sprites.append({**_gacha_glow(), 'z': round(GACHA_FOOT * u) - 200})
    sprites.append({**_gacha_machine(), 'z': round((GACHA_FOOT + GACHA_FORWARD) * u)})
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
