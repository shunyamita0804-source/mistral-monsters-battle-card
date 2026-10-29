# -*- coding: utf-8 -*-
"""部屋4つ（大会会場・管理局・練習場・研究所）の新しい絵（2026-10-28 ZIP「Mistral_Rooms4_ClaudeCode_20261028」）。

使い方：python3 -I tools/design/rooms4_build.py [確認画像の出力先]
原本：design-parts/rooms-20261028/（無改変）。絵は描き直さない（重ねる・切り抜く・形式を変えるだけ。色の処理もかけない）。
書き出し：assets/images/maps/rooms/room4_*.webp と src/data/rooms4Art.generated.ts。

- 部品はすべて 1536×1024 の同じキャンバス（左上で重ねる）。shell＝部屋の箱、01〜＝家具1つずつ、front＝手前の低い壁と入口の柱
- 1px ＝ 部屋の単位 ROOM_UNIT（カードショップ・前の管理局と同じ。人の背が絵の中で約178px）。FIT_HEIGHT もショップと同じ 1024（ほかの部屋と人の大きさがそろう）
- 歩ける所：床の多角形 FLOOR と入口の通り道 PASSAGE から、家具の足もと BLOCKS を除いたもの（32 単位のマス目に直す）
- 前後：家具は足もとの y（z）で人と比べる。壁ぞいの斜めの家具（前にしか立てない）は z を小さくして、前に立った人がいつも手前に描かれるようにする。
  front はいつも人より手前（FRONT_Z）。入口の柱の後ろには回れない（柱の足もとを BLOCKS に入れる）
- 調べる物（ITEMS）は、となりに歩けるマスが無ければ、あるまで下へ広げる（家具の手前の床から調べられるように）
- 人の立つ所（SPOTS）：logic＝話しかける判定に使うマス（歩けない家具の中でもよい）、look＝見た目の足もと（絵の px）。
  カウンターの奥に立つ人は、見た目をカウンターの奥にずらす（maps.ts の drawDx・drawDy）。足もとはカウンターの天板の奥の線ではなく、
  天板の奥の線より約65px手前に置く（天板の線に置くと人がカウンターの上に浮いて見え、カウンターの高さぶん下げると頭しか見えない。
  ゲームの人の背は絵の中で約145px なので、腰から上が見える所）
"""
from __future__ import annotations

import json
import math
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/rooms-20261028')
OUT_ROOMS = os.path.join(ROOT, 'assets/images/maps/rooms')
OUT_TS = os.path.join(ROOT, 'src/data/rooms4Art.generated.ts')
WEBP_Q = 88

CELL = 32
ROOM_UNIT = 1.25
ROOM_W, ROOM_H = 1920, 1280
FIT_HEIGHT = 1024
FRONT_Z = 99999
BG = (16, 18, 26)
C = CELL / ROOM_UNIT  # 1マスの大きさ（絵の px）＝25.6


def ellipse(cx: float, cy: float, rx: float, ry: float, n: int = 36) -> list[tuple[float, float]]:
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]


# ===== 部屋ごとの設定（座標は絵の px）=====
ROOMS: dict[str, dict] = {
    # 大会会場：奥に観客席、中央に円形の段と対戦台、右手前に受付。左の壁の大きな紺の板は空（総当たり表を描く予定。BOARD に位置だけ記録）
    'arena': dict(
        dir='Mistral_Room_arena_parts', prefix='arena',
        # 2026-10-29 iPhone の試遊「主人公が段の手すりにめりこむ」：段と対戦台は低い台で、人は段の上に乗れない（段のまわりにしか立てない）ので、
        # 前後はいつも人より奥（z を段の上のふちの 290 に）。床の下のふちは手前の低い壁の上のふちまで（壁の上を歩けない）
        furniture={'01_stage': 290, '02_battle_table': 291, '03_bench_left_back': 702, '04_bench_left_front': 750, '05_reception': 760},
        floor=[(300, 330), (450, 298), (1090, 298), (1235, 335), (1360, 470), (1420, 520), (1530, 560), (1530, 758), (40, 735), (40, 620), (60, 600)],
        passage=(610, 730, 925, 1024),
        blocks=[
            ellipse(768, 433, 370, 147),         # 円形の段（対戦台はこの上）
            (78, 625, 232, 702),                 # 左の長いす（奥）
            (242, 672, 407, 750),                # 左の長いす（手前）
            (1180, 552, 1536, 780),              # 受付（カウンターの奥も）。2026-10-29 新しいカウンター（x 1203〜1496・y 609〜776）
            (490, 740, 610, 1024),               # 入口の左の柱
            (925, 740, 1045, 1024),              # 入口の右の柱
        ],
        items={
            # 2026-10-29 新しいカウンター：名前の札（範囲の上の真ん中）がセリアの顔に重ならないよう、カウンターの左のはし（話しかける側）だけ
            'RECEPTION': (1180, 600, 1270, 780),
            'TABLE': (560, 300, 980, 560),
            'SEATS_L': (300, 230, 450, 300),
            'SEATS_R': (1090, 230, 1235, 300),
            # 左の壁の紺の板（2026-10-28 夜：調べると総当たりの対戦表。板の下の床から調べる）
            'BOARD_TOUCH': (55, 140, 250, 600),
        },
        # 記録だけ（調べる物にはしない）：左の壁の大きな紺の板（大会の総当たり表を描く予定）
        # 受付のカウンターの絵の範囲（2026-10-29：受付の前に立つと、画面の中心をここの真ん中へ寄せる。worldScreen の CAMERA_LEANS）
        marks={'BOARD': (55, 140, 250, 590), 'COUNTER': (1203, 609, 1496, 776)},
        # 受付のセリア：見た目はカウンターの奥（下半身がカウンターで隠れる）。話しかけるマスはカウンターの左はし（カウンターの左から話す）
        # 2026-10-29 iPhone の試遊「職員はカウンターの内側に」：見た目をカウンターの前の板の奥（内側の床）へ。話しかけるマスは今のまま
        # 2026-10-29 新しいカウンター（小さくなった）：話しかけるマスはカウンターの左の柱のすぐ左の列、見た目はコの字の内側（前の板のすぐ奥。足もとは天板の奥の線より約45px手前で、すねから下が前の板で隠れる）
        spots={'RECEPTIONIST_SPOT': dict(logic=(1190, 653), look=(1330, 700))},
        spawn=(768, 742), exit_bottom=1024,
    ),
    # 管理局：奥に書類棚、中央に受付のカウンター、左奥にランクの板、右奥にメダルの棚、左右に長いす、右の壁に掲示板（白い枠の額）
    'bureau': dict(
        dir='Mistral_Room_bureau_parts', prefix='bureau',
        # 2026-10-29 ユーザー指示：置いて立てる掲示板の絵（05_notice_board）は使わない（左の長いすに重なり、動かしても床の真ん中に立って不自然）。
        # 代わりに右の壁の白い枠の額（shell の絵）を掲示板として調べる（下の items の NOTICE_BOARD）
        furniture={'01_counter': 555, '02_rank_board': 300, '03_medal_case': 430, '04_bench_left': 790, '06_bench_right': 790},
        floor=[(205, 300), (1340, 300), (1370, 470), (1430, 600), (1445, 790), (90, 790), (95, 600), (120, 500), (205, 445)],
        passage=(540, 780, 1000, 975),
        blocks=[
            (470, 420, 1068, 555),                                   # 受付のカウンター
            (440, 300, 1100, 420),                                   # カウンターの奥（受付の人の所。入らない）
            [(200, 295), (422, 295), (422, 392), (222, 455), (200, 455)],  # ランクの板
            [(1108, 295), (1345, 295), (1345, 472), (1118, 432)],    # メダルの棚
            (148, 440, 238, 505),                                    # 左の植木
            (1302, 440, 1375, 505),                                  # 右の植木
            (52, 628, 434, 790),                                     # 左の長いす
            (1108, 628, 1486, 790),                                  # 右の長いす
            (428, 740, 540, 990),                                    # 入口の左の柱
            (1000, 740, 1108, 990),                                  # 入口の右の柱
        ],
        items={
            # 名前の札（範囲の上の真ん中）が受付の人に重ならないよう、カウンターの前の板の所
            'COUNTER': (470, 470, 1068, 555),
            'RANK_BOARD': (205, 68, 420, 452),
            'MEDAL_CASE': (1112, 100, 1340, 470),
            # 掲示板＝右の壁の白い枠の額2つ（shell の絵。2026-10-29）：右の壁ぞいの床（右の植木と右の長いすの間）から調べる
            'NOTICE_BOARD': (1385, 285, 1440, 545),
        },
        marks={},
        # エレノア：見た目はカウンターの奥。話しかけるマスはカウンターの一番手前の行。主人公はその2つ手前（導入イベントのブースター選びもここ）
        spots={'CLERK_SPOT': dict(logic=(768, 550), look=(768, 472)), 'PLAYER_SPOT': dict(logic=(768, 601))},
        spawn=(768, 880), exit_bottom=975,
    ),
    # 練習場：奥に黒板と棚、左の壁ぞいにカウンター、対戦机3つ
    'practice': dict(
        dir='Mistral_Room_practice_parts', prefix='practice',
        furniture={'01_table_center': 528, '02_table_right_back': 420, '03_table_right_front': 658, '04_left_counter': 330, '05_stool': 499},
        floor=[(90, 255), (1400, 255), (1430, 420), (1490, 700), (1500, 742), (90, 742)],  # 下のふち：手前の低い壁の上のふちまで（2026-10-29）
        passage=(615, 755, 920, 1024),
        blocks=[
            [(0, 240), (352, 240), (352, 336), (246, 522), (184, 700), (0, 700)],  # 左のカウンターと左の壁の棚
            (0, 690, 98, 775),                                       # 左手前の植木と小棚
            (712, 440, 1040, 528),                                   # 真ん中の対戦机
            (1046, 335, 1356, 420),                                  # 右奥の対戦机
            (1072, 555, 1424, 656),                                  # 右手前の対戦机
            (254, 462, 318, 500),                                    # 丸いす
            (1335, 250, 1402, 282),                                  # 右奥の植木
            (440, 640, 615, 1024),                                   # 入口の左の柱と植木
            (920, 640, 1085, 1024),                                  # 入口の右の柱と植木
        ],
        items={
            'TABLE_1': (712, 440, 1040, 528),
            'TABLE_2': (1046, 335, 1356, 420),
            'TABLE_3': (1072, 555, 1424, 656),
            'BOARD': (550, 40, 930, 255),
            'SHELF': (88, 243, 352, 690),
        },
        marks={},
        # ガレス先生：真ん中の机のすぐ手前の左寄り（机の名前の札に重ならない。右どなりにミレイユが立つ）
        spots={'TEACHER_SPOT': dict(logic=(762, 550))},
        spawn=(768, 742), exit_bottom=1024,
    ),
    # 研究所：奥に本棚（図鑑）、左奥にガラスの飾り棚、中央に机、右奥に機械と青い画面、右の壁ぞいに実験台と図形の板（黒板）
    # 2026-10-29 夜：白い研究施設の絵（v2。ZIP「Mistral_Room_lab_v2_parts」）に替えた。前の木の絵は design-parts/rooms-20261028/lab_v1_wood/。
    # 部屋の形・家具の置き場所と大きさは前と同じなので、床・家具の当たりはそのまま。奥の壁ぞいの植木鉢2つ（shell の絵）の足もとを足し、
    # 図形の板（右の壁。前の黒板の所より右）を調べる所を合わせた
    'lab': dict(
        dir='Mistral_Room_lab_parts', prefix='lab',
        furniture={'01_glass_cabinet': 420, '02_desk': 580, '03_machine': 405, '04_lab_counter': 500},
        floor=[(80, 310), (1300, 310), (1536, 690), (1536, 762), (0, 762), (0, 560)],  # 下のふち：手前の低い壁の上のふちまで（2026-10-29）
        passage=(595, 778, 940, 1024),
        blocks=[
            [(0, 290), (305, 290), (305, 425), (95, 475), (0, 600)],  # ガラスの飾り棚と左の壁
            (0, 440, 86, 572),                                         # 左の植木
            (500, 450, 862, 578),                                      # 中央の机
            (740, 400, 862, 450),                                      # 机の奥の研究員の所（後ろに回っても人に重ならない）
            (438, 292, 512, 328),                                      # 奥の壁ぞいの植木鉢（本棚の左）
            (848, 292, 926, 328),                                      # 奥の壁ぞいの植木鉢（本棚の右）
            ellipse(1148, 348, 122, 60),                               # 機械の台
            [(1265, 300), (1536, 300), (1536, 790), (1385, 790), (1140, 615), (1140, 495), (1265, 452)],  # 実験台・右の壁・植木
            (438, 690, 595, 1024),                                     # 入口の左の柱と植木
            (940, 690, 1082, 1024),                                    # 入口の右の柱と植木
        ],
        items={
            'BIG_SHELF': (515, 30, 845, 320),
            'CABINET': (72, 132, 301, 469),
            'DESK': (500, 450, 862, 578),
            # 機械と浮かぶ青い画面。右はしは図形の板に重ならないよう、右の柱の手前まで
            'PROJECTOR': (1024, 93, 1250, 413),
            'ANALYSIS': (1140, 440, 1536, 777),
            # 右の壁の図形の板（v2）：右奥の植木鉢と実験台の奥。実験台の左上の床（x 1265 の左）から調べる
            'BLACKBOARD': (1265, 230, 1520, 450),
        },
        marks={},
        # 研究員ルーカス：見た目は中央の机の奥（左の大きなレンズに隠れないよう右寄り）。話しかけるマスは机の一番手前の行
        spots={'RESEARCHER_SPOT': dict(logic=(800, 572), look=(800, 500))},
        spawn=(768, 752), exit_bottom=1024,
    ),
}


def _load(room: dict, name: str) -> Image.Image:
    return Image.open(os.path.join(room.get('src', SRC), room['dir'], f"{room['prefix']}_{name}.png")).convert('RGBA')


def _save(im: Image.Image, name: str) -> dict:
    box = im.getbbox()
    os.makedirs(OUT_ROOMS, exist_ok=True)
    im.crop(box).save(os.path.join(OUT_ROOMS, name), quality=WEBP_Q, method=6)
    x1, y1, x2, y2 = box
    u = ROOM_UNIT
    return dict(file=f'maps/rooms/{name}', x=round(x1 * u), y=round(y1 * u), w=round((x2 - x1) * u), h=round((y2 - y1) * u))


def _cells(box: tuple[float, float, float, float]) -> dict:
    x1, y1, x2, y2 = box
    cx1, cy1 = math.floor(x1 / C + 1e-9), math.floor(y1 / C + 1e-9)
    cx2, cy2 = math.ceil(x2 / C - 1e-9), math.ceil(y2 / C - 1e-9)
    return dict(x=cx1, y=cy1, w=cx2 - cx1, h=cy2 - cy1)


def _cell_of(p: tuple[float, float]) -> tuple[int, int]:
    return math.floor(p[0] / C + 1e-9), math.floor(p[1] / C + 1e-9)


def _draw_shape(d: ImageDraw.ImageDraw, shape, fill: int) -> None:
    if isinstance(shape, list):
        d.polygon(shape, fill=fill)
    else:
        d.rectangle(shape, fill=fill)


def build_room(key: str, check: str | None, rooms: dict[str, dict] | None = None, pre: str | None = None) -> tuple[dict, dict]:
    """rooms・pre は別の道具（rooms_shop_build.py）から使うとき。部屋の設定に src（原本の置き場所）を書ける"""
    room = (rooms or ROOMS)[key]
    u = ROOM_UNIT
    cols, rows = ROOM_W // CELL, ROOM_H // CELL

    walk = Image.new('L', (1536, 1024), 0)
    d = ImageDraw.Draw(walk)
    d.polygon(room['floor'], fill=255)
    d.rectangle(room['passage'], fill=255)
    for b in room['blocks']:
        _draw_shape(d, b, 0)
    grid = []
    for ry in range(rows):
        row = ''
        for cx in range(cols):
            px, py = (cx + 0.5) * C, (ry + 0.5) * C
            row += '.' if walk.getpixel((min(int(px), 1535), min(int(py), 1023))) else '#'
        grid.append(row)

    def walkable(x: int, y: int) -> bool:
        return 0 <= y < rows and 0 <= x < cols and grid[y][x] == '.'

    # 部屋の箱（透明な所は部屋の外の暗い色）
    pre = pre or f'room4_{key}'
    shell = Image.new('RGBA', (1536, 1024), BG + (255,))
    shell.alpha_composite(_load(room, 'shell'))
    os.makedirs(OUT_ROOMS, exist_ok=True)
    shell.convert('RGB').save(os.path.join(OUT_ROOMS, f'{pre}_shell.webp'), quality=WEBP_Q, method=6)
    tiles = [dict(file=f'maps/rooms/{pre}_shell.webp', x=0, y=0, w=ROOM_W, h=ROOM_H)]
    sprites = []
    for name, foot in room['furniture'].items():
        sprites.append({**_save(_load(room, name), f'{pre}_{name[3:]}.webp'), 'z': round(foot * u)})
    sprites.append({**_save(_load(room, 'front'), f'{pre}_front.webp'), 'z': FRONT_Z})

    # 調べる物：となりに歩けるマスが無ければ、あるまで下へ広げる
    items: dict[str, dict] = {}
    for name, box in room['items'].items():
        r = _cells(box)
        for _ in range(8):
            cells = [(x, y) for x in range(r['x'], r['x'] + r['w']) for y in range(r['y'], r['y'] + r['h'])]
            inside = set(cells)
            touch = any(walkable(x + dx, y + dy) and (x + dx, y + dy) not in inside for x, y in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if touch:
                break
            r = {**r, 'h': r['h'] + 1}
        else:
            raise SystemExit(f'{key}: {name} のとなりに歩けるマスがありません')
        items[name] = r
    for name, box in room['marks'].items():
        items[name] = _cells(box)

    # 人の立つ所。spotOf（maps.ts）は y＋h−2 を足もとにするので、h=3・y＝足もと−1 で書く
    offsets: dict[str, dict] = {}
    for name, s in room['spots'].items():
        lx, ly = _cell_of(s['logic'])
        items[name] = dict(x=lx, y=ly - 1, w=1, h=3)
        if 'look' in s:
            vx, vy = s['look']
            offsets[name] = dict(dx=round(vx / C - 0.5 - lx, 2), dy=round(vy / C - 0.5 - ly, 2))

    exit_row = math.floor(room['exit_bottom'] / C + 1e-9) - 1
    exit_cols = [cx for cx in range(cols) if walkable(cx, exit_row)]
    assert exit_cols and exit_cols == list(range(exit_cols[0], exit_cols[-1] + 1)), (key, 'exit', exit_cols)
    sx, sy = _cell_of(room['spawn'])
    assert walkable(sx, sy), (key, 'spawn')
    art = dict(
        id=pre, cols=cols, rows=rows, width=ROOM_W, height=ROOM_H, cell=CELL, fitHeight=FIT_HEIGHT,
        grid=grid, tiles=tiles, sprites=sprites, items=items,
        exit=dict(x=exit_cols[0], y=exit_row, w=len(exit_cols), h=1),
        spawn=dict(x=sx, y=sy),
    )
    if check:
        _check_image(key, room, art, offsets, check)
    return art, offsets


def _check_image(key: str, room: dict, art: dict, offsets: dict, out: str) -> None:
    """確認画像：見本に、歩けるマス（緑）・調べる物（黄の枠）・人の所（話す＝赤、見た目＝水色）を重ねる"""
    im = Image.open(os.path.join(room.get('src', SRC), room['dir'], f"{room['prefix']}_preview.png")).convert('RGBA')
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for y, row in enumerate(art['grid']):
        for x, ch in enumerate(row):
            if ch == '.':
                d.rectangle((x * C + 2, y * C + 2, (x + 1) * C - 2, (y + 1) * C - 2), fill=(40, 220, 90, 70))
    for name, r in art['items'].items():
        d.rectangle((r['x'] * C, r['y'] * C, (r['x'] + r['w']) * C, (r['y'] + r['h']) * C), outline=(255, 220, 0, 255), width=3)
        d.text((r['x'] * C + 4, r['y'] * C + 4), name, fill=(255, 255, 0, 255))
    for name, s in room['spots'].items():
        lx, ly = _cell_of(s['logic'])
        d.rectangle((lx * C, ly * C, (lx + 1) * C, (ly + 1) * C), fill=(255, 40, 40, 200))
        if 'look' in s:
            vx, vy = s['look']
            d.ellipse((vx - 8, vy - 8, vx + 8, vy + 8), fill=(0, 220, 255, 230))
            d.line((vx - 30, vy - 178, vx + 30, vy - 178), fill=(0, 220, 255, 230), width=3)
    sx, sy = art['spawn']['x'], art['spawn']['y']
    d.rectangle((sx * C, sy * C, (sx + 1) * C, (sy + 1) * C), fill=(60, 60, 255, 220))
    e = art['exit']
    d.rectangle((e['x'] * C, e['y'] * C, (e['x'] + e['w']) * C, (e['y'] + 1) * C), outline=(255, 0, 255, 255), width=3)
    im.alpha_composite(ov)
    os.makedirs(out, exist_ok=True)
    im.convert('RGB').save(os.path.join(out, f'rooms4_check_{key}.jpg'), quality=88)


def main() -> None:
    check = sys.argv[1] if len(sys.argv) > 1 else None
    arts: dict[str, dict] = {}
    offsets: dict[str, dict] = {}
    for key in ROOMS:
        arts[key], offsets[key] = build_room(key, check)
    files: list[str] = []
    for art in arts.values():
        for im in art['tiles'] + art['sprites']:
            files.append(im['file'])
    body = json.dumps(arts, ensure_ascii=False, indent=1)
    for i, file in enumerate(files):
        body = body.replace(f'"file": "{file}"', f'"file": rooms4Img{i}')
    with open(OUT_TS, 'w', encoding='utf-8') as f:
        f.write('// 自動生成：tools/design/rooms4_build.py（手で書き換えない）\n')
        f.write('// 部屋4つ（大会会場・管理局・練習場・研究所）の新しい絵（2026-10-28。design-parts/rooms-20261028/）\n')
        for i, file in enumerate(files):
            f.write(f"import rooms4Img{i} from '@assets/images/{file}';\n")
        f.write("import type { ArtMap } from './worldArt.generated.ts';\n\n")
        f.write('/** 部屋4つの絵・歩ける所・調べる物・人の立つ所（キー：arena・bureau・practice・lab） */\n')
        f.write(f'export const ROOMS4_ART: Readonly<Record<\'arena\' | \'bureau\' | \'practice\' | \'lab\', ArtMap>> = {body};\n\n')
        f.write('/** カウンターの奥に立つ人の見た目のずれ（マス。maps.ts の drawDx・drawDy。負＝左・奥） */\n')
        f.write(f'export const ROOMS4_DRAW_OFFSET = {json.dumps(offsets, ensure_ascii=False)} as const;\n')
    for key, art in arts.items():
        print(key, 'spawn', art['spawn'], 'exit', art['exit'], 'offsets', offsets[key])


if __name__ == '__main__':
    main()
