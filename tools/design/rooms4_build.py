# -*- coding: utf-8 -*-
"""部屋4つ（大会会場・管理局・練習場・研究所）の新しい絵（2026-10-28 ZIP「Mistral_Rooms4_ClaudeCode_20261028」）。
2026-10-30 指示書 X：大会会場・管理局・練習場は正面向きの新しい絵（design-parts/rooms-frontfacing-20261030/。部屋の設定の v2。下の _build_v2）。
2026-10-31 指示書 AD：研究所も正面向きの新しい絵（design-parts/rooms-frontfacing-20261031/lab/。v2src）。花屋・仕立て屋（rooms_shop_build.py）も同じ作り。

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
# 2026-10-30 指示書 X：正面向きの新しい絵（大会会場・管理局・練習場）
SRC_V2 = os.path.join(ROOT, 'design-parts/rooms-frontfacing-20261030')
# 2026-10-31 指示書 AD：正面向きの新しい絵（研究所・花屋・仕立て屋）。部屋の設定の v2src に書く
SRC_AD = os.path.join(ROOT, 'design-parts/rooms-frontfacing-20261031')
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
    # ===== 2026-10-30 指示書 X：大会会場・管理局・練習場を正面向きの新しい絵に（カードショップ〔指示書 N〕と同じ作り）=====
    # 原本 design-parts/rooms-frontfacing-20261030/{arena,bureau,practice}/（無改変）。床と壁（shell。不透明）＋家具（1536×1024 の透明な画像に置く位置で描いたもの）。
    # 手前の低い壁・入口の柱・入口わきの植木は shell に描きこまれているので、shell からその所だけ切り抜いて「いつも人より手前」の層にする（front_cut。描き直さない）。
    # 1つの絵に家具が2つ以上あるもの（長いす2台・棚3台・机3つ）は、split の範囲ごとに切り分けて、それぞれの足もとで人と前後を比べる
    # 大会会場：奥に観客席（shell）、真ん中に丸い舞台（shell）、左に長いす2台、右に受付。舞台の上の対戦台は前の絵（arena_02_battle_table）を舞台の真ん中に重ねる。
    # 前の絵の左の壁の紺の板（総当たりの表を描いていた）は新しい絵に無いので、板の表と「対戦表」を調べる所はなくした（表は受付でも見られる）。
    # 2026-10-30 指示書 Z：対戦表の板（arena_furniture_board。design-parts/support-art-z-20261030/。左の観客席と長いすのあいだ・脚の下 y 約429）を足し、
    # 「対戦表」を板の前（下の1列。長いすとのあいだ）から調べられるように戻した。板の裏・脚のあいだはふさぐ
    'arena': dict(
        v2='arena',
        furniture=[
            # (ファイル名, 部屋の絵の中の名前, 足もとの y, 切り分ける範囲 or None)
            ('arena_furniture_benches', 'bench_back', 566, (96, 430, 396, 600)),
            ('arena_furniture_benches', 'bench_front', 762, (96, 600, 396, 775)),
            ('arena_furniture_reception', 'reception', 730, None),
            # 対戦表の板：脚の下は y 約429 だが、板のすぐ前（長いすとのあいだの1列。足もと y 約422）に立った人が板の後ろに隠れないよう、前後を比べる y は 410 にする
            ('support-art-z-20261030/arena_furniture_board', 'board', 410, None),
        ],
        # 舞台の上の対戦台（前の絵。舞台の円の真ん中へ。前の舞台の円の真ん中との差だけずらす）。人は舞台に上がれないので、いつも人より奥
        extra=[('Mistral_Room_arena_parts/arena_02_battle_table', 'battle_table', 291, (0, 13))],
        # 手前の低い壁（上のふち y 約795）・入口の柱（金の飾りの先 y 約745）。入口の通り道（x 618〜918）は切り抜かない
        front_cut=[(0, 793, 494, 1024), (493, 742, 619, 1024), (917, 742, 1043, 1024), (1042, 793, 1536, 1024)],
        floor=[(36, 312), (236, 266), (1300, 266), (1500, 312), (1500, 798), (36, 798)],
        passage=(620, 780, 916, 1024),
        blocks=[
            ellipse(768, 431, 400, 170),         # 丸い舞台（段も。対戦台はこの上）
            (112, 263, 394, 412),                # 対戦表の板（裏・脚のあいだ。すぐ下の1列〔長いすとのあいだ〕は歩ける）
            (384, 256, 666, 362),                # 板と舞台のあいだの奥（板を置いたので行けなくなった床。とじこめられないようふさぐ）
            (96, 430, 396, 572),                 # 左の長いす（奥）
            (96, 624, 396, 768),                 # 左の長いす（手前）
            (1100, 560, 1430, 730),              # 受付（カウンターの奥のセリアの所も）
            (490, 740, 622, 1024),               # 入口の左の柱
            (914, 740, 1046, 1024),              # 入口の右の柱
        ],
        items={
            # 受付：名前の札（範囲の上の真ん中）がセリアの顔に重ならないよう、カウンターの左のはし
            'RECEPTION': (1108, 628, 1180, 728),
            # 対戦表の板（下の1列から調べる。名前の札は板の上のふち）
            'BOARD': (112, 263, 394, 412),
            'TABLE': (560, 290, 980, 600),
            # 左の観客席：対戦表の板（指示書 Z）で舞台の左奥へは回れなくなったので、左の通路の上のはしから調べられるよう左へ広げた
            'SEATS_L': (36, 110, 530, 300),
            'SEATS_R': (1010, 110, 1290, 262),
        },
        # 受付のカウンターの絵の範囲（受付の前に立つと画面の中心をここへ寄せる。worldScreen の CAMERA_LEANS）
        marks={'COUNTER': (1108, 628, 1422, 728)},
        # 受付のセリア：見た目はカウンターの奥（足もとは天板の奥の線 y 約632 より約45px手前。すねから下がカウンターで隠れる）。
        # 話しかけるマスはカウンターの真ん中の一番手前の行（主人公はカウンターの前から話す）
        spots={'RECEPTIONIST_SPOT': dict(logic=(1265, 720), look=(1265, 677))},
        spawn=(768, 770), exit_bottom=1024,
    ),
    # 管理局：奥の壁の前に受付のカウンター（エレノアはその奥）、左奥にランクの板、その下（左の真ん中）に掲示板、右奥にメダルの棚、左右に長いす
    'bureau': dict(
        v2='bureau',
        furniture=[
            ('bureau_furniture_counter', 'counter', 452, None),
            ('bureau_furniture_rank_board', 'rank_board', 405, None),
            ('bureau_furniture_notice_board', 'notice_board', 578, None),
            ('bureau_furniture_medal_case', 'medal_case', 408, None),
            ('bureau_furniture_benches', 'benches', 752, None),
        ],
        extra=[],
        # 手前の低い壁（上のふち y 約812）・入口の柱（上のはし y 約785）。入口の通り道（x 546〜994）は切り抜かない
        front_cut=[(0, 810, 432, 1024), (430, 782, 547, 1024), (993, 782, 1110, 1024), (1108, 810, 1536, 1024)],
        floor=[(36, 198), (1500, 198), (1500, 812), (36, 812)],
        passage=(548, 790, 992, 1024),
        blocks=[
            (452, 190, 1083, 452),               # 受付のカウンターと、その奥（エレノアの所・奥の植木。入らない）
            (36, 190, 380, 405),                 # ランクの板
            # 掲示板とランクの板のあいだ（掲示板のうしろに回ると隠れるので入らない）。右のはしはマスの境（x 409.6）の少し右で止めて、
            # 掲示板のすぐ右の列（x 409.6〜435.2）は歩ける（右から近づいて調べる）
            (36, 405, 405, 580),
            (1145, 190, 1500, 408),              # メダルの棚
            # 左右の長いす。長いすと手前の壁のあいだ（2マス）は入口の柱でふさがれて行き止まりになるので、手前の壁までふさぐ
            (36, 580, 432, 812),                 # 左の長いす
            (1105, 580, 1500, 812),              # 右の長いす
            (430, 780, 550, 1024),               # 入口の左の柱
            (990, 780, 1110, 1024),              # 入口の右の柱
        ],
        items={
            # 名前の札（範囲の上の真ん中）が受付の人に重ならないよう、カウンターの前の板の所
            'COUNTER': (452, 345, 1083, 452),
            'RANK_BOARD': (90, 24, 371, 403),
            'MEDAL_CASE': (1152, 57, 1397, 406),
            # 掲示板（左の真ん中。ランクの板と左の長いすの間）。下はすぐ長いすなので、右どなりの列から調べる
            'NOTICE_BOARD': (105, 427, 405, 577),
        },
        marks={},
        # エレノア：見た目はカウンターの奥（足もとは天板の奥の線 y 約290 より約65px手前。腰から上が見える）。話しかけるマスはカウンターの一番手前の行。
        # 主人公はその2つ手前（導入イベントのブースター選びもここ。ミレイユは主人公の右 4マス）
        spots={'CLERK_SPOT': dict(logic=(768, 440), look=(768, 355)), 'PLAYER_SPOT': dict(logic=(768, 491))},
        spawn=(768, 785), exit_bottom=1024,
    ),
    # 練習場：奥の壁に黒板（shell）、左の壁ぞいにカードの棚3台、真ん中と右に対戦の机（いす付き）3組
    'practice': dict(
        v2='practice',
        furniture=[
            ('practice_furniture_card_shelf', 'shelf_1', 400, (70, 205, 352, 403)),
            ('practice_furniture_card_shelf', 'shelf_2', 594, (70, 403, 352, 597)),
            ('practice_furniture_card_shelf', 'shelf_3', 788, (70, 597, 352, 800)),
            ('practice_furniture_tables', 'table_center', 617, (600, 360, 925, 630)),
            ('practice_furniture_tables', 'table_right_back', 465, (1080, 205, 1400, 495)),
            ('practice_furniture_tables', 'table_right_front', 772, (1080, 495, 1400, 785)),
        ],
        extra=[],
        # 手前の低い壁（上のふち y 約795）・入口の柱（上の飾りの先 y 約660）・入口わきの植木（y 約675 から）。入口の通り道（x 592〜938）は切り抜かない
        front_cut=[(0, 792, 410, 1024), (405, 672, 500, 1024), (486, 656, 593, 1024), (937, 656, 1042, 1024), (1028, 672, 1122, 1024), (1118, 792, 1536, 1024)],
        floor=[(46, 212), (1490, 212), (1490, 798), (46, 798)],
        passage=(594, 780, 936, 1024),
        blocks=[
            (46, 200, 352, 800),                 # 左の壁ぞいのカードの棚3台
            (1388, 200, 1490, 222),              # 右奥の植木（shell）
            (608, 365, 918, 620),                # 真ん中の対戦の机（いすも）
            (1086, 212, 1398, 468),              # 右奥の対戦の机
            (1086, 522, 1398, 775),              # 右手前の対戦の机
            (400, 665, 596, 1024),               # 入口の左の柱と植木
            (934, 665, 1126, 1024),              # 入口の右の柱と植木
        ],
        items={
            'TABLE_1': (613, 376, 912, 616),
            'TABLE_2': (1091, 221, 1393, 464),
            'TABLE_3': (1091, 529, 1393, 771),
            'BOARD': (520, 30, 1015, 205),
            'SHELF': (78, 215, 344, 787),
        },
        marks={},
        # ガレス先生：真ん中の机のすぐ手前の左寄り（右どなり 5マスにミレイユが立つ）
        spots={'TEACHER_SPOT': dict(logic=(640, 652))},
        spawn=(765, 770), exit_bottom=1024,
    ),
    # 研究所（2026-10-31 指示書 AD【1】：正面向きの新しい絵。design-parts/rooms-frontfacing-20261031/lab/）。
    # 前の絵（白い研究施設の v2・木の v1）の部品は design-parts/rooms-20261028/ に残す。
    # 奥の壁に本棚（図鑑）と植木2つ（shell）、左の壁ぞいにガラスの棚、真ん中に机（ルーカスはその奥）、奥の右に記録の投影機（金の機械）、
    # 右の壁ぞいに立つ図形の板、右の手前寄りに解析台（実験台）。手前の低い壁・入口の柱と柱の上の植木は shell から切り抜く
    'lab': dict(
        v2='lab', v2src=SRC_AD,
        furniture=[
            ('lab_01_glass_cabinet', 'glass_cabinet', 545, None),
            ('lab_02_desk', 'desk', 615, None),
            ('lab_03_machine', 'machine', 445, None),
            ('lab_04_lab_counter', 'lab_counter', 755, None),
            ('lab_05_diagram_board', 'diagram_board', 520, None),
        ],
        extra=[],
        # 手前の低い壁（上のふち y 約790）・入口の柱（柱の上の植木の上 y 約687）。入口の通り道（x 577〜953）は切り抜かない
        front_cut=[(0, 788, 432, 1024), (428, 685, 577, 1024), (953, 685, 1102, 1024), (1098, 788, 1536, 1024)],
        # 床：奥の壁の下（y 約310）から手前の低い壁の上のふち（y 約790）まで。左右の壁はまっすぐ（内側のふち x 約40・約1496）
        floor=[(40, 310), (1496, 310), (1496, 790), (40, 790)],
        passage=(577, 780, 953, 1024),
        blocks=[
            (36, 300, 358, 545),                 # ガラスの棚（奥の壁・左の壁とのすき間もふさぐ）
            (440, 300, 540, 330),                # 奥の壁ぞいの植木（本棚の左。shell）
            (985, 300, 1090, 330),               # 奥の壁ぞいの植木（本棚の右。shell）
            (535, 455, 960, 612),                # 真ん中の机
            (800, 395, 940, 460),                # 机の奥のルーカスの所（後ろに回っても人に重ならない）
            (990, 300, 1240, 445),               # 記録の投影機（奥の壁とのすき間もふさぐ）
            (1230, 300, 1500, 520),              # 図形の板（板の裏・右の壁とのすき間もふさぐ）
            # 解析台（右の壁とのすき間・手前の低い壁とのすき間〔1列。入口の柱にふさがれて出られなくなる〕もふさぐ）
            (1100, 640, 1500, 800),
            (428, 700, 577, 1024),               # 入口の左の柱
            (953, 700, 1102, 1024),              # 入口の右の柱
        ],
        items={
            'BIG_SHELF': (545, 30, 985, 325),
            'CABINET': (72, 170, 358, 545),
            'DESK': (535, 455, 960, 612),
            'PROJECTOR': (990, 214, 1240, 445),
            # 図形の板（右の壁ぞいに立つ板）：板の前（下の床）から調べる
            'BLACKBOARD': (1230, 349, 1490, 520),
            'ANALYSIS': (1100, 578, 1480, 755),
        },
        marks={},
        # ルーカス：見た目は真ん中の机の奥（足もとは天板の奥の線 y 約460 より約65px手前。左の大きなレンズに隠れないよう右寄り）。
        # 話しかけるマスは机の一番手前の行（机の手前の床から話す）
        spots={'RESEARCHER_SPOT': dict(logic=(870, 600), look=(870, 525))},
        spawn=(768, 770), exit_bottom=1024,
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


def _v2_open(room: dict, name: str) -> Image.Image:
    # 「フォルダ/名前」と書いたものは design-parts/ の下のそのフォルダから（あとから届いた家具。2026-10-30 指示書 Z の対戦表の板）
    if '/' in name:
        return Image.open(os.path.join(ROOT, 'design-parts', f'{name}.png'))
    return Image.open(os.path.join(room.get('v2src', SRC_V2), room['v2'], f'{name}.png'))


def _build_v2(room: dict, pre: str) -> tuple[list[dict], list[dict]]:
    """正面向きの新しい絵（2026-10-30 指示書 X）：shell（不透明）・家具（切り分け）・前の絵の重ね物（extra）・shell から切り抜いた手前の層"""
    u = ROOM_UNIT
    shell = _v2_open(room, f"{room['v2']}_shell").convert('RGB')
    shell.save(os.path.join(OUT_ROOMS, f'{pre}_shell.webp'), quality=WEBP_Q, method=6)
    tiles = [dict(file=f'maps/rooms/{pre}_shell.webp', x=0, y=0, w=ROOM_W, h=ROOM_H)]
    sprites = []
    for file, name, foot, box in room['furniture']:
        im = _v2_open(room, file).convert('RGBA')
        if box:
            part = Image.new('RGBA', im.size)
            part.paste(im.crop(box), box[:2])
            im = part
        sprites.append({**_save(im, f'{pre}_{name}.webp'), 'z': round(foot * u)})
    for path, name, foot, (dx, dy) in room['extra']:
        src = Image.open(os.path.join(SRC, f'{path}.png')).convert('RGBA')
        im = Image.new('RGBA', src.size)
        im.alpha_composite(src, (dx, dy))
        sprites.append({**_save(im, f'{pre}_{name}.webp'), 'z': round(foot * u)})
    # 手前の低い壁・入口の柱（shell の絵をそのまま切り抜く）
    mask = Image.new('L', shell.size, 0)
    d = ImageDraw.Draw(mask)
    for b in room['front_cut']:
        _draw_shape(d, b, 255)
    front = Image.new('RGBA', shell.size)
    front.paste(shell.convert('RGBA'), (0, 0), mask)
    sprites.append({**_save(front, f'{pre}_front.webp'), 'z': FRONT_Z})
    return tiles, sprites


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
    os.makedirs(OUT_ROOMS, exist_ok=True)
    if room.get('v2'):
        tiles, sprites = _build_v2(room, pre)
    else:
        shell = Image.new('RGBA', (1536, 1024), BG + (255,))
        shell.alpha_composite(_load(room, 'shell'))
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
    if room.get('v2'):
        # 見本：X の部屋は review_*.jpg、AD の部屋は *_preview.png
        v2dir = os.path.join(room.get('v2src', SRC_V2), room['v2'])
        review = os.path.join(v2dir, f"review_{room['v2']}.jpg")
        im = Image.open(review if os.path.exists(review) else os.path.join(v2dir, f"{room['v2']}_preview.png")).convert('RGBA')
    else:
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
