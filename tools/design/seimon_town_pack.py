# -*- coding: utf-8 -*-
"""セイモン街・部屋の設計図を作るスクリプト（デザイン資料用。ゲーム本体のコードではない）

使い方:
  python3 tools/design/seimon_town_pack.py --out docs/design/seimon-town \
      [--sprite 主人公の歩行シート.png]

- 街と部屋の配置はこのファイルの TOWN / ROOMS が正本。ここを直して作り直す
- 座標の単位は「街の完成図（MAP×MAP。いまは 4032）のピクセル」。原点は左上
- 主人公は 216×288 の素材を半分（108×144）にして置く前提
"""
from __future__ import annotations

import argparse
import json
import os
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ───────────── 共通の決まり ─────────────
MAP = 4032                         # 2026-10-22 B案で 3200→4800（扉の高さを主人公の背たけに）。同日、移動が長いので 4032 に詰めた
PLAYER_W, PLAYER_H = 108, 144      # 街・部屋での主人公の大きさ（素材 216×288 の半分）
PLAYER_FIGURE = 124                # 透明部分を除いた体の高さ（約）
CELL = 32                          # 当たり判定を作るときのマス
FONT_PATHS = [
    '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
]


def font(size: int) -> ImageFont.FreeTypeFont:
    for p in FONT_PATHS:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


# ───────────── 街の配置（正本） ─────────────
# rect = [左, 上, 右, 下]。建物の rect は「絵を置く枠」。玄関は枠の下辺の中央
# 建物の大きさの決め方：届いた絵の扉の高さが、主人公の背たけ（約124）と同じくらいになる大きさ
# 道の幅は主人公に合わせる（大通り 288・小道 224・玄関への道 192）。建物を大きくしても道は広げない


def hlane(xa: int, xb: int, y: int, w: int) -> list[int]:
    """横の道：中心線 y、xa から xb まで、幅 w（両端は w/2 のばす）"""
    return [xa - w // 2, y - w // 2, xb + w // 2, y + w // 2]


def vpath(x: int, top: int, bottom: int, w: int) -> list[int]:
    """縦の道：中心線 x、top から bottom まで、幅 w（玄関からの道は top＝玄関）"""
    return [x - w // 2, top, x + w // 2, bottom]


W_MAIN, W_LANE, W_DOOR = 288, 224, 192
# 2026-10-22 街を詰めた（ユーザー指示「街が広すぎ・移動が面倒」）：4800 → 4032。建物の大きさは変えず、すき間と道を詰めた。
# 住宅Dは北東の上の段から、東の通りの北の段（住宅Eのとなり）へ。北東の小道はなくし、住宅Cの道は住宅DとEの間をまっすぐ通りへ
CX = MAP // 2                      # 南北の軸（大会会場・噴水・南の大通り・草原への出口）
SY = 1888                          # 東西の通りの中心線・噴水の中心
LANE = 3360                        # 南の通り（ショップ・研究所・家々の玄関の前）の中心線
TOWN = {
    'size': [MAP, MAP],
    'buildings': [
        dict(id='ARENA', name='カードバトル大会会場', zone='北中央', rect=[CX - 720, 96, CX + 720, 1104], door_w=176,
             color='#4A6FB0', canvas='1536x1024'),
        dict(id='TRAINING', name='カード練習場', zone='北西', rect=[128, 288, 1280, 888], door_w=136,
             color='#C98A45', canvas='1536x1024'),
        dict(id='HOUSE_A', name='住宅A', zone='北西', rect=[848, 1152, 1424, 1632], door_w=80,
             color='#B5866E', canvas='1024x1024'),
        dict(id='HOUSE_B', name='住宅B', zone='北西', rect=[16, 1152, 592, 1632], door_w=80,
             color='#B5866E', canvas='1024x1024'),
        # 2026-10-27 ユーザー指示：住宅C の所をカードバトラー管理局に置き換えた（住宅C と住人C はなくした）。
        # 枠・玄関（下の辺の真ん中 x=3200）・道は住宅C と同じ（枠を変えると、草むら・小物の並びが街じゅうずれるため）
        dict(id='BUREAU', name='カードバトラー管理局', zone='北東', rect=[2912, 288, 3488, 768], door_w=96,
             color='#3E5A8C', canvas='1536x1024'),
        dict(id='HOUSE_D', name='住宅D', zone='北東', rect=[2528, 1152, 3104, 1632], door_w=80,
             color='#79A584', canvas='1024x1024'),
        dict(id='HOUSE_E', name='住宅E', zone='北東', rect=[3296, 1152, 3872, 1632], door_w=80,
             color='#79A584', canvas='1024x1024'),
        dict(id='SHOP', name='カードショップ', zone='南西', rect=[48, 2544, 880, 3120], door_w=104,
             color='#D9A040', canvas='1536x1024'),
        dict(id='LAB', name='カード研究所', zone='南西', rect=[960, 2384, 1800, 3120], door_w=120,
             color='#4F9AA3', canvas='1024x1024'),
        dict(id='PLAYER_HOME', name='主人公の家', zone='南東', rect=[2256, 2544, 2880, 3120], door_w=88,
             color='#C0705A', canvas='1024x1024'),
        dict(id='GUIDE_HOME', name='案内役の家', zone='南東', rect=[3072, 2544, 3696, 3120], door_w=88,
             color='#B79E62', canvas='1024x1024'),
    ],
    'fountain': dict(id='FOUNTAIN', name='噴水', center=[CX, SY], slot=[CX - 336, SY - 336, CX + 336, SY + 336],
                     blocked_r=288, canvas='1024x1024'),
    'plaza': dict(id='PLAZA', name='噴水広場（ぐるっと一周歩ける）', center=[CX, SY], r=512),
    # 歩ける所（長方形の重ね合わせ＋広場の円）
    'walk': [
        dict(id='N_FORECOURT', name='大会会場の前庭', rect=[CX - 320, 1104, CX + 320, SY]),
        dict(id='S_STREET', name='南の大通り', rect=vpath(CX, SY, MAP, W_MAIN)),
        dict(id='W_STREET', name='西の通り', rect=hlane(304, CX, SY, W_MAIN)),
        dict(id='E_STREET', name='東の通り', rect=hlane(CX, 3584, SY, W_MAIN)),
        dict(id='P_TRAINING', name='練習場への道', rect=vpath(704, 888, SY, W_DOOR)),
        dict(id='P_HOUSE_B', name='住宅Bへの道', rect=vpath(304, 1632, SY, W_DOOR)),
        dict(id='P_HOUSE_A', name='住宅Aへの道', rect=vpath(1136, 1632, SY, W_DOOR)),
        dict(id='P_BUREAU', name='管理局への道（もとの住宅Cへの道）', rect=vpath(3200, 768, SY, W_DOOR)),
        dict(id='P_HOUSE_D', name='住宅Dへの道', rect=vpath(2816, 1632, SY, W_DOOR)),
        dict(id='P_HOUSE_E', name='住宅Eへの道', rect=vpath(3584, 1632, SY, W_DOOR)),
        dict(id='P_SHOP', name='ショップの玄関前', rect=vpath(464, 3120, LANE, W_DOOR)),
        dict(id='P_LAB', name='研究所の玄関前', rect=vpath(1380, 3120, LANE, W_DOOR)),
        dict(id='SW_LANE', name='南西の通り', rect=hlane(464, CX, LANE, W_LANE)),
        dict(id='P_PLAYER', name='主人公の家の玄関前', rect=vpath(2568, 3120, LANE, W_DOOR)),
        dict(id='P_GUIDE', name='案内役の家の玄関前', rect=vpath(3384, 3120, LANE, W_DOOR)),
        dict(id='SE_LANE', name='南東の通り', rect=hlane(CX, 3384, LANE, W_LANE)),
    ],
    'exit': dict(id='EXIT_SOUTH', name='草原への出口（土の道）', rect=[CX - 144, 3648, CX + 144, MAP],
                 trigger=[CX - 144, MAP - 96, CX + 144, MAP]),
    # 飾りを置いてよい緑地（木・花壇・ベンチなど。歩ける所にははみ出さない）
    'green': [
        dict(id='GREEN_NW', name='木立', rect=[1456, 1152, 1664, 1480]),
        dict(id='GARDEN_SW', name='花壇の小広場', rect=[96, 2112, 1488, 2336]),
        dict(id='GREEN_E', name='小さな緑地', rect=[2560, 2112, 3904, 2480]),
        dict(id='HEDGE_SE', name='生け垣', rect=[2912, 2592, 3040, 3088]),
        dict(id='MEADOW_SW', name='草地', rect=[96, 3536, 1808, 3936]),
        dict(id='MEADOW_SE', name='草地（建物を足さない）', rect=[2224, 3536, 3936, 3936]),
    ],
    'spawn': dict(name='ゲーム開始・家から出た所', point=[2568, 3216]),
}

# ───────────── 部屋の配置（正本） ─────────────
# 単位は部屋の左上からのピクセル。1マス=64。上の WALL ピクセルは奥の壁（歩けない）
# kind: furniture=家具（歩けない） rug=敷物（歩ける） wall=壁に掛ける物 npc=人の立ち位置（絵に人は描かない） exit=出口
ROOM_WALL = 192
ROOMS = [
    dict(id='ROOM_PLAYER', name='主人公の家', size=[768, 832], door=[320, 448], items=[
        dict(id='BED', name='ベッド', kind='furniture', rect=[64, 192, 256, 448], use='設定（言語・音など）'),
        dict(id='WALL_MAP', name='壁の地図', kind='wall', rect=[288, 48, 480, 160], use='ダンジョンを選ぶ'),
        dict(id='BOOKSHELF', name='本棚', kind='furniture', rect=[576, 192, 704, 288], use='図鑑（集めたカード）'),
        dict(id='DESK', name='机と椅子', kind='furniture', rect=[64, 576, 256, 704], use='デッキを組む'),
        dict(id='RUG', name='じゅうたん', kind='rug', rect=[288, 384, 512, 576], use=''),
        dict(id='PLANT', name='植木鉢', kind='furniture', rect=[640, 640, 704, 736], use=''),
        dict(id='WINDOW', name='窓', kind='wall', rect=[544, 48, 704, 144], use=''),
    ]),
    dict(id='ROOM_GUIDE', name='案内役の家', size=[768, 832], door=[320, 448], items=[
        dict(id='FIREPLACE', name='暖炉', kind='wall', rect=[288, 32, 480, 192], use=''),
        dict(id='KITCHEN', name='台所の棚', kind='furniture', rect=[64, 192, 256, 288], use=''),
        dict(id='BOOKSHELF', name='本棚', kind='furniture', rect=[576, 192, 704, 288], use=''),
        dict(id='TABLE', name='丸テーブルと椅子', kind='furniture', rect=[224, 384, 448, 576], use=''),
        dict(id='GUIDE_SPOT', name='案内役の立ち位置', kind='npc', rect=[512, 416, 608, 512], use='話しかける（案内・チュートリアル）'),
        dict(id='FLOWER', name='花台', kind='furniture', rect=[64, 640, 128, 736], use=''),
        dict(id='WINDOW', name='窓', kind='wall', rect=[64, 48, 224, 144], use=''),
    ]),
    dict(id='ROOM_HOUSE', name='民家（住宅A〜Eで共通）', size=[640, 704], door=[256, 384], items=[
        dict(id='SHELF', name='棚', kind='furniture', rect=[64, 192, 192, 256], use=''),
        dict(id='PLANT', name='植木鉢', kind='furniture', rect=[512, 192, 576, 256], use=''),
        dict(id='TABLE', name='テーブルと椅子', kind='furniture', rect=[192, 320, 448, 448], use=''),
        dict(id='RESIDENT_SPOT', name='住人の立ち位置', kind='npc', rect=[480, 416, 576, 512], use='話しかける'),
        dict(id='WINDOW', name='窓', kind='wall', rect=[256, 48, 384, 144], use=''),
    ]),
    dict(id='ROOM_SHOP', name='カードショップ', size=[1024, 896], door=[448, 576], items=[
        dict(id='SHELF_WALL', name='商品棚（カードとパック）', kind='furniture', rect=[64, 192, 512, 256], use='見る'),
        dict(id='PACK_MACHINE', name='カードパック販売機', kind='furniture', rect=[768, 192, 960, 320], use='パックを買う（今のガチャ）'),
        dict(id='CLERK_SPOT', name='店員の立ち位置', kind='npc', rect=[432, 320, 528, 416], use=''),
        dict(id='COUNTER', name='カウンター', kind='furniture', rect=[256, 416, 704, 512], use='店員と話す（買う・売る）'),
        dict(id='CASE_L', name='ショーケース（左）', kind='furniture', rect=[64, 576, 320, 672], use='見る'),
        dict(id='CASE_R', name='ショーケース（右）', kind='furniture', rect=[704, 576, 960, 672], use='見る'),
    ]),
    dict(id='ROOM_LAB', name='カード研究所', size=[1024, 896], door=[448, 576], items=[
        dict(id='BIG_SHELF', name='図鑑の大きな本棚', kind='furniture', rect=[64, 192, 448, 256], use='図鑑（集めたカード）'),
        dict(id='CRYSTAL', name='水晶の表示台', kind='furniture', rect=[576, 192, 736, 320], use='集めた割合を見る（仮）'),
        dict(id='SPECIMEN', name='カード標本ケース', kind='furniture', rect=[832, 192, 960, 384], use='見る'),
        dict(id='RESEARCHER_SPOT', name='研究員の立ち位置', kind='npc', rect=[432, 320, 528, 416], use=''),
        dict(id='DESK', name='研究机', kind='furniture', rect=[256, 416, 704, 512], use='研究員と話す'),
        dict(id='SHELF2', name='資料棚', kind='furniture', rect=[64, 576, 256, 672], use=''),
        dict(id='TABLE', name='閲覧テーブル', kind='furniture', rect=[768, 576, 960, 672], use=''),
    ]),
    dict(id='ROOM_TRAINING', name='カード練習場', size=[1152, 960], door=[512, 640], items=[
        dict(id='BOARD', name='黒板（カードの図だけ・文字なし）', kind='wall', rect=[384, 32, 768, 176], use='遊び方を見る（仮）'),
        dict(id='TEACHER_SPOT', name='先生の立ち位置', kind='npc', rect=[528, 224, 624, 320], use='話しかける（練習の案内）'),
        dict(id='SHELF', name='教材の棚', kind='furniture', rect=[64, 192, 256, 256], use=''),
        dict(id='TABLE_1', name='練習テーブル1', kind='furniture', rect=[128, 416, 448, 576], use='練習試合（仮）'),
        dict(id='TABLE_2', name='練習テーブル2', kind='furniture', rect=[704, 416, 1024, 576], use='練習試合（仮）'),
        dict(id='BENCH_L', name='ベンチ（左）', kind='furniture', rect=[128, 736, 384, 800], use=''),
        dict(id='BENCH_R', name='ベンチ（右）', kind='furniture', rect=[768, 736, 1024, 800], use=''),
    ]),
    dict(id='ROOM_ARENA', name='カードバトル大会会場', size=[1280, 1152], door=[576, 704], items=[
        dict(id='FLAGS', name='旗（紋章だけ・文字なし）', kind='wall', rect=[192, 48, 1088, 176], use=''),
        dict(id='STAGE', name='対戦ステージと対戦テーブル', kind='furniture', rect=[384, 256, 896, 576], use='見る'),
        dict(id='SEATS_L', name='観客席（左）', kind='furniture', rect=[64, 256, 320, 768], use=''),
        dict(id='SEATS_R', name='観客席（右）', kind='furniture', rect=[960, 256, 1216, 768], use=''),
        dict(id='RECEPTIONIST_SPOT', name='受付の立ち位置', kind='npc', rect=[592, 672, 688, 768], use=''),
        dict(id='RECEPTION', name='受付カウンター', kind='furniture', rect=[448, 768, 832, 864], use='大会に申し込む'),
    ]),
]

COLORS = {
    'grass': (215, 232, 200), 'grid': (202, 221, 185), 'grid2': (175, 198, 160),
    'walk': (246, 231, 200), 'walk_edge': (190, 150, 100), 'exit': (226, 196, 150),
    'green': (178, 214, 150), 'green_edge': (110, 160, 90), 'door': (60, 200, 140),
    'ink': (35, 45, 60), 'red': (210, 40, 60), 'water': (110, 175, 215),
}


def hexrgb(h: str) -> tuple[int, int, int]:
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))  # type: ignore[return-value]


def door_of(b: dict) -> list[int]:
    x1, _, x2, y2 = b['rect']
    return [(x1 + x2) // 2, y2]


def label(d: ImageDraw.ImageDraw, xy, text, size=28, fill=COLORS['ink'], anchor='mm', box=True):
    f = font(size)
    if box:
        bb = d.textbbox(xy, text, font=f, anchor=anchor)
        d.rounded_rectangle([bb[0] - 10, bb[1] - 6, bb[2] + 10, bb[3] + 6], radius=8, fill=(255, 255, 255),
                            outline=COLORS['ink'], width=2)
    d.text(xy, text, font=f, fill=fill, anchor=anchor)


def dashed_rect(d, rect, color, width=3, dash=18):
    x1, y1, x2, y2 = rect
    for x in range(x1, x2, dash * 2):
        d.line([x, y1, min(x + dash, x2), y1], fill=color, width=width)
        d.line([x, y2, min(x + dash, x2), y2], fill=color, width=width)
    for y in range(y1, y2, dash * 2):
        d.line([x1, y, x1, min(y + dash, y2)], fill=color, width=width)
        d.line([x2, y, x2, min(y + dash, y2)], fill=color, width=width)


# ───────────── 主人公の絵（大きさ確認用） ─────────────
def load_player(sprite_path: str | None, height: int) -> Image.Image:
    """正面の1コマ目を取り出して、枠の高さ height に縮める。素材が無ければ簡単な人型の目安を描く"""
    w = round(216 * height / 288)
    if sprite_path and os.path.exists(sprite_path):
        sheet = Image.open(sprite_path).convert('RGBA')
        frame = sheet.crop((0, 0, 216, 288))
        return frame.resize((w, height), Image.LANCZOS)
    im = Image.new('RGBA', (w, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    s = height / 288
    d.ellipse([60 * s, 20 * s, 156 * s, 116 * s], fill=(60, 80, 160, 255))
    d.rounded_rectangle([56 * s, 110 * s, 160 * s, 230 * s], radius=int(20 * s), fill=(60, 80, 160, 255))
    d.rectangle([70 * s, 230 * s, 100 * s, 270 * s], fill=(90, 60, 40, 255))
    d.rectangle([116 * s, 230 * s, 146 * s, 270 * s], fill=(90, 60, 40, 255))
    return im


def paste_player(base: Image.Image, player: Image.Image, foot_xy, scale_from_frame=PLAYER_H):
    """足元（素材の 108,270 に当たる点）を foot_xy に合わせて置く"""
    h = player.height
    fx = foot_xy[0] - player.width // 2
    fy = foot_xy[1] - round(270 * h / 288)
    base.alpha_composite(player, (int(fx), int(fy)))


# ───────────── 街：マスク ─────────────
def town_mask() -> Image.Image:
    m = Image.new('L', (MAP, MAP), 0)
    d = ImageDraw.Draw(m)
    p = TOWN['plaza']
    cx, cy = p['center']
    d.ellipse([cx - p['r'], cy - p['r'], cx + p['r'], cy + p['r']], fill=255)
    for w in TOWN['walk']:
        d.rectangle([w['rect'][0], w['rect'][1], w['rect'][2] - 1, w['rect'][3] - 1], fill=255)
    f = TOWN['fountain']
    fx, fy = f['center']
    d.ellipse([fx - f['blocked_r'], fy - f['blocked_r'], fx + f['blocked_r'], fy + f['blocked_r']], fill=0)
    return m


# ───────────── 街：自動チェック ─────────────
def town_checks(mask: Image.Image) -> list[str]:
    a = np.array(mask) > 0
    out: list[str] = []
    ok_all = True

    def rect_hits_walk(r, shrink=1):
        x1, y1, x2, y2 = r
        return a[y1 + shrink:y2 - shrink, x1 + shrink:x2 - shrink].any()

    out.append('■ 建物の枠が歩ける所に食い込んでいないか')
    for b in TOWN['buildings']:
        bad = rect_hits_walk(b['rect'])
        ok_all &= not bad
        out.append(f"  {'NG' if bad else 'OK'}  {b['name']}")
    out.append('■ 緑地（飾りを置く所）が歩ける所・建物に重なっていないか')
    for g in TOWN['green']:
        bad = rect_hits_walk(g['rect'])
        for b in TOWN['buildings']:
            r1, r2 = g['rect'], b['rect']
            if r1[0] < r2[2] and r2[0] < r1[2] and r1[1] < r2[3] and r2[1] < r1[3]:
                bad = True
        ok_all &= not bad
        out.append(f"  {'NG' if bad else 'OK'}  {g['name']}")

    # 主人公が通れるか：主人公の足元の大きさ（横 128・縦 96）が収まる位置だけをつなぐ
    cw, ch = 128 // CELL, 96 // CELL
    grid = a[CELL // 2::CELL, CELL // 2::CELL]
    gh, gw = grid.shape
    fits = np.zeros_like(grid)
    for y in range(gh - ch + 1):
        for x in range(gw - cw + 1):
            fits[y, x] = grid[y:y + ch, x:x + cw].all()

    def cell_of(px, py):
        return min(max(int(px // CELL) - cw // 2, 0), gw - cw), min(max(int(py // CELL), 0), gh - ch)

    start = cell_of(*TOWN['spawn']['point'])
    seen = np.zeros_like(fits)
    q = deque([start])
    if fits[start[1], start[0]]:
        seen[start[1], start[0]] = True
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < gw and 0 <= ny < gh and fits[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((nx, ny))

    out.append('■ 主人公の家の前から、すべての玄関の前まで歩いて行けるか（主人公の足元 128×96 が通れる幅で判定）')
    for b in TOWN['buildings']:
        dx, dy = door_of(b)
        x, y = cell_of(dx, dy + 16)
        ok = bool(seen[y, x])
        ok_all &= ok
        out.append(f"  {'OK' if ok else 'NG'}  {b['name']}（玄関 {dx},{dy}）")
    tx = (TOWN['exit']['trigger'][0] + TOWN['exit']['trigger'][2]) // 2
    x, y = cell_of(tx, TOWN['exit']['trigger'][1])
    ok = bool(seen[y, x])
    ok_all &= ok
    out.append(f"  {'OK' if ok else 'NG'}  草原への出口")

    out.append('■ 噴水のまわりを一周できるか（噴水の上下左右の4か所すべてに行けるか）')
    fx, fy = TOWN['fountain']['center']
    r = TOWN['fountain']['blocked_r'] + 96
    ring_ok = True
    for px, py in ((fx, fy - r - 48), (fx, fy + r), (fx - r - 64, fy - 48), (fx + r, fy - 48)):
        x, y = cell_of(px, py)
        ring_ok &= bool(seen[y, x])
    ok_all &= ring_ok
    out.append(f"  {'OK' if ring_ok else 'NG'}  噴水の外周")

    out.append('■ 玄関の前の空き（玄関の真下に横160・縦96 以上の歩ける所があるか）')
    for b in TOWN['buildings']:
        dx, dy = door_of(b)
        ok = a[dy + 1:dy + 96, dx - 80:dx + 80].all()
        ok_all &= ok
        out.append(f"  {'OK' if ok else 'NG'}  {b['name']}")
    out.insert(0, f"結果：{'すべて合格' if ok_all else '不合格あり'}\n")
    return out


# ───────────── 街：全体配置図 ─────────────
def draw_town(mask: Image.Image, player: Image.Image, labels=True, grid=True) -> Image.Image:
    im = Image.new('RGBA', (MAP, MAP), COLORS['grass'] + (255,))
    d = ImageDraw.Draw(im)
    for v in (range(0, MAP, 64) if grid else ()):
        d.line([v, 0, v, MAP], fill=COLORS['grid'], width=1)
        d.line([0, v, MAP, v], fill=COLORS['grid'], width=1)
    for v in (range(0, MAP + 1, 480) if grid else ()):
        d.line([v, 0, v, MAP], fill=COLORS['grid2'], width=2)
        d.line([0, v, MAP, v], fill=COLORS['grid2'], width=2)
    for g in TOWN['green']:
        d.rounded_rectangle(g['rect'], radius=24, fill=COLORS['green'])
        if grid:
            dashed_rect(d, g['rect'], COLORS['green_edge'])
    walk = Image.new('RGBA', (MAP, MAP), COLORS['walk'] + (255,))
    im.paste(walk, (0, 0), mask)
    ex = TOWN['exit']['rect']
    d.rectangle(ex, fill=COLORS['exit'])
    edge = mask.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 0 else 0).filter(ImageFilter.MaxFilter(5))
    im.paste(Image.new('RGBA', (MAP, MAP), COLORS['walk_edge'] + (255,)), (0, 0), edge)
    # 噴水
    f = TOWN['fountain']
    fx, fy = f['center']
    br, wr = f['blocked_r'], int(f['blocked_r'] * 0.78)
    d.ellipse([fx - br, fy - br, fx + br, fy + br], fill=(200, 200, 205), outline=COLORS['ink'], width=4)
    d.ellipse([fx - wr, fy - wr, fx + wr, fy + wr], fill=COLORS['water'])
    if grid:
        dashed_rect(d, f['slot'], (90, 120, 160))
    # 建物
    for b in TOWN['buildings']:
        x1, y1, x2, y2 = b['rect']
        d.rounded_rectangle(b['rect'], radius=16, fill=hexrgb(b['color']), outline=COLORS['ink'], width=6)
        dx, dy = door_of(b)
        dw = b['door_w']
        d.rectangle([dx - dw // 2, dy - 20, dx + dw // 2, dy], fill=COLORS['door'], outline=COLORS['ink'], width=3)
        if labels:
            label(d, ((x1 + x2) // 2, (y1 + y2) // 2 - 22), b['name'], size=60 if x2 - x1 > 700 else 46)
            label(d, ((x1 + x2) // 2, (y1 + y2) // 2 + 34), f"{b['id']}  枠 {x2 - x1}×{y2 - y1}", size=30, box=False,
                  fill=(255, 255, 255))
            label(d, (dx, dy + 40), '玄関', size=24)
    if labels:
        for g in TOWN['green']:
            x1, y1, x2, y2 = g['rect']
            label(d, ((x1 + x2) // 2, (y1 + y2) // 2), g['name'], size=26, box=False, fill=(70, 110, 60))
        for w in TOWN['walk']:
            if w['id'] in ('S_STREET', 'W_STREET', 'E_STREET', 'SW_LANE', 'SE_LANE', 'N_FORECOURT'):
                x1, y1, x2, y2 = w['rect']
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                if w['id'] == 'S_STREET':
                    cy = (SY + LANE) // 2 + 300
                if w['id'] == 'N_FORECOURT':
                    cy = 1240
                label(d, (cx, cy), w['name'], size=24, box=False, fill=(140, 100, 60))
        label(d, (fx, fy + 350), '噴水（像なし）', size=36)
        label(d, (MAP // 2, MAP - 120), '↓ 草原へ（土の道）', size=36)
        sx, sy = TOWN['spawn']['point']
        paste_player(im, player, (sx + 120, sy + 40))
        label(d, (sx + 120, sy + 140), f'主人公 {PLAYER_W}×{PLAYER_H}', size=22)
        for v in range(0, MAP, 480):
            d.text((v + 6, 4), str(v), font=font(26), fill=(90, 110, 80))
            d.text((4, v + 6), str(v), font=font(26), fill=(90, 110, 80))
        # 4分割の線（管理用）
        for v in range(0, MAP, 40):
            d.line([MAP // 2, v, MAP // 2, v + 20], fill=COLORS['red'], width=4)
            d.line([v, MAP // 2, v + 20, MAP // 2], fill=COLORS['red'], width=4)
        label(d, (MAP - 160, 70), '↑北', size=52)
    return im


def town_sheet(town: Image.Image) -> Image.Image:
    """全体配置図の下に凡例を付ける"""
    H = MAP + 560
    im = Image.new('RGBA', (MAP, H), (255, 255, 255, 255))
    im.alpha_composite(town, (0, 0))
    d = ImageDraw.Draw(im)
    y = MAP + 40
    d.text((60, y), f'セイモン街　全体配置図（固定）　{MAP}×{MAP}・1マス64px・主人公 108×144', font=font(80), fill=COLORS['ink'])
    items = [
        (COLORS['walk'], '歩ける所（道・広場）。ここには何も置かない'),
        (COLORS['exit'], '草原への出口（石畳から土の道へ変わる）'),
        (COLORS['green'], '緑地（木・花壇・ベンチなどの飾りを置いてよい）'),
        (COLORS['door'], '玄関（建物の枠の下辺の真ん中。前は必ず空ける）'),
        (COLORS['red'], '赤の点線＝4分割の線（Claude が完成図から切るときの線。絵には描かない）'),
    ]
    for i, (c, t) in enumerate(items):
        x = 60 + (i % 2) * (MAP // 2)
        yy = y + 150 + (i // 2) * 110
        d.rectangle([x, yy, x + 80, yy + 70], fill=c, outline=COLORS['ink'], width=2)
        d.text((x + 100, yy + 6), t, font=font(50), fill=COLORS['ink'])
    return im


# ───────────── 主人公と扉の大きさ確認 ─────────────
def scale_check(town: Image.Image, player: Image.Image) -> Image.Image:
    """南東を等倍で切り出し、扉（高さ132の目安）と主人公を並べる"""
    box = (2640, 3060, 4480, 4260)
    crop = town.crop(box)
    d = ImageDraw.Draw(crop)
    for b in TOWN['buildings']:
        if b['id'] in ('PLAYER_HOME', 'GUIDE_HOME'):
            dx, dy = door_of(b)
            dx, dy = dx - box[0], dy - box[1]
            w, h = b['door_w'], 132
            d.rounded_rectangle([dx - w // 2, dy - h, dx + w // 2, dy], radius=w // 2, fill=(130, 90, 60),
                                outline=COLORS['ink'], width=3)
            paste_player(crop, player, (dx + 110, dy + 60))
    out = Image.new('RGBA', (crop.width, crop.height + 200), (255, 255, 255, 255))
    out.alpha_composite(crop, (0, 120))
    d = ImageDraw.Draw(out)
    d.text((20, 24), '主人公と扉の大きさ（等倍）：扉の高さ＝主人公の背たけ（約124〜132）', font=font(52), fill=COLORS['ink'])
    d.text((20, crop.height + 140), '茶色＝扉の目安。建物の大きさは、届いた絵の扉がこの高さになるように決めた（B案）',
           font=font(38), fill=(30, 120, 60))
    return out


# ───────────── 建物の部品一覧 ─────────────
def parts_sheet(player: Image.Image) -> Image.Image:
    s = 0.35
    items = TOWN['buildings'] + [dict(id='FOUNTAIN', name='噴水', rect=TOWN['fountain']['slot'], door_w=0,
                                      color='#8FB8D8', canvas='1024x1024')]
    W = 3000
    im = Image.new('RGBA', (W, 1700), (255, 255, 255, 255))
    d = ImageDraw.Draw(im)
    d.text((40, 30), '建物と噴水の部品一覧（すべて同じ倍率 0.35。玄関＝緑。主人公と並べて大きさを確認）', font=font(46), fill=COLORS['ink'])
    x, y, rowh = 60, 150, 0
    pl = player.resize((round(player.width * s), round(player.height * s)), Image.LANCZOS)
    for b in items:
        x1, y1, x2, y2 = b['rect']
        w, h = int((x2 - x1) * s), int((y2 - y1) * s)
        if x + w + 200 > W:
            x, y, rowh = 60, y + rowh + 200, 0
        d.rounded_rectangle([x, y, x + w, y + h], radius=10, fill=hexrgb(b['color']), outline=COLORS['ink'], width=3)
        if b['door_w']:
            dw = int(b['door_w'] * s)
            cx = x + w // 2
            d.rectangle([cx - dw // 2, y + h - 12, cx + dw // 2, y + h], fill=COLORS['door'], outline=COLORS['ink'])
        paste_player(im, pl, (x + w + 40, y + h))
        d.text((x, y + h + 14), b['name'], font=font(32), fill=COLORS['ink'])
        door_ratio = f"玄関の幅＝建物の幅の約{round(b['door_w'] / (x2 - x1) * 100)}%" if b['door_w'] else '真ん中は歩けない'
        d.text((x, y + h + 56), f"枠 {x2 - x1}×{y2 - y1} / ChatGPT {b['canvas']}", font=font(24), fill=(80, 80, 80))
        d.text((x, y + h + 88), door_ratio, font=font(24), fill=(80, 80, 80))
        x += w + 220
        rowh = max(rowh, h)
    return im.crop((0, 0, W, y + rowh + 160))


# ───────────── ChatGPT に添付する枠 ─────────────
def guide_building(b: dict) -> Image.Image:
    cw, ch = map(int, b['canvas'].split('x'))
    im = Image.new('RGB', (cw, ch), (255, 255, 255))
    d = ImageDraw.Draw(im)
    x1, y1, x2, y2 = b['rect']
    bw, bh = x2 - x1, y2 - y1
    s = min(cw * 0.88 / bw, ch * 0.80 / bh)
    w, h = int(bw * s), int(bh * s)
    left = (cw - w) // 2
    bottom = int(ch * 0.93)
    top = bottom - h
    d.rectangle([left, top, left + w, bottom], fill=(232, 232, 232), outline=(150, 150, 150), width=4)
    d.line([0, bottom, cw, bottom], fill=(150, 150, 150), width=3)
    if b.get('door_w'):
        dw = int(b['door_w'] * s)
        dh = int(max(b['door_w'] * 1.5, 132) * s)  # 扉の高さ＝主人公の背たけ（体 約124px）くらい
        cx = cw // 2
        d.rectangle([cx - dw // 2, bottom - dh, cx + dw // 2, bottom], fill=(170, 170, 170), outline=(110, 110, 110), width=3)
    return im


def guide_fountain() -> Image.Image:
    im = Image.new('RGB', (1024, 1024), (255, 255, 255))
    d = ImageDraw.Draw(im)
    d.ellipse([80, 160, 944, 944], fill=(232, 232, 232), outline=(150, 150, 150), width=4)
    d.ellipse([250, 330, 774, 774], fill=(205, 205, 205), outline=(130, 130, 130), width=3)
    return im


def guide_room(r: dict) -> Image.Image:
    W, H = r['size']
    im = Image.new('RGB', (1024, 1024), (255, 255, 255))
    d = ImageDraw.Draw(im)
    sx, sy = 1024 / W, 1024 / H
    d.rectangle([0, 0, 1023, int(ROOM_WALL * sy)], fill=(200, 200, 200))
    d.rectangle([0, 0, int(32 * sx), 1023], fill=(200, 200, 200))
    d.rectangle([1023 - int(32 * sx), 0, 1023, 1023], fill=(200, 200, 200))
    d.rectangle([0, 1023 - int(32 * sy), 1023, 1023], fill=(200, 200, 200))
    a, b = r['door']
    d.rectangle([int(a * sx), 1023 - int(32 * sy), int(b * sx), 1023], fill=(255, 255, 255))
    d.rectangle([0, 0, 1023, 1023], outline=(150, 150, 150), width=4)
    return im


# ───────────── 部屋の設計図 ─────────────
KIND_COLOR = {
    'furniture': (196, 160, 120), 'rug': (232, 200, 210), 'wall': (150, 170, 200), 'npc': (255, 255, 255),
}
KIND_NAME = {'furniture': '家具（歩けない）', 'rug': '敷物（歩ける）', 'wall': '壁の物', 'npc': '人の立ち位置（人は描かない）'}


def room_plan(r: dict, player: Image.Image) -> Image.Image:
    W, H = r['size']
    M, T = 80, 150
    im = Image.new('RGBA', (W + M * 2 + 640, max(H + T + M + 40, 900)), (255, 255, 255, 255))
    d = ImageDraw.Draw(im)
    d.text((M, 30), f"{r['name']}（{r['id']}）　部屋 {W}×{H}・1マス64px", font=font(40), fill=COLORS['ink'])
    ox, oy = M, T
    d.rectangle([ox, oy, ox + W, oy + H], fill=(246, 236, 214))
    for v in range(0, W + 1, 64):
        d.line([ox + v, oy, ox + v, oy + H], fill=(225, 212, 188), width=1)
    for v in range(0, H + 1, 64):
        d.line([ox, oy + v, ox + W, oy + v], fill=(225, 212, 188), width=1)
    wall = (120, 110, 105)
    d.rectangle([ox, oy, ox + W, oy + ROOM_WALL], fill=(170, 160, 150))
    d.rectangle([ox, oy, ox + 32, oy + H], fill=wall)
    d.rectangle([ox + W - 32, oy, ox + W, oy + H], fill=wall)
    d.rectangle([ox, oy + H - 32, ox + W, oy + H], fill=wall)
    a, b = r['door']
    d.rectangle([ox + a, oy + H - 32, ox + b, oy + H], fill=COLORS['door'])
    label(d, (ox + W // 2, oy + ROOM_WALL // 2 + 50), '奥の壁（歩けない）', size=22, box=False, fill=(70, 60, 55))
    marks = '①②③④⑤⑥⑦⑧⑨⑩'
    for n, it in enumerate(r['items']):
        x1, y1, x2, y2 = it['rect']
        rect = [ox + x1, oy + y1, ox + x2, oy + y2]
        if it['kind'] == 'npc':
            d.ellipse(rect, outline=COLORS['red'], width=4)
        else:
            d.rounded_rectangle(rect, radius=8, fill=KIND_COLOR[it['kind']], outline=COLORS['ink'], width=3)
        d.text(((rect[0] + rect[2]) // 2, (rect[1] + rect[3]) // 2), marks[n], font=font(40), fill=COLORS['ink'],
               anchor='mm')
    paste_player(im, player, (ox + (a + b) // 2, oy + H - 40))
    label(d, (ox + (a + b) // 2, oy + H + 24), '出入口（街へ）', size=22)
    # 凡例
    lx = ox + W + 60
    d.text((lx, oy), '凡例', font=font(30), fill=COLORS['ink'])
    for i, (k, n) in enumerate(KIND_NAME.items()):
        yy = oy + 60 + i * 56
        if k == 'npc':
            d.ellipse([lx, yy, lx + 44, yy + 44], outline=COLORS['red'], width=4)
        else:
            d.rectangle([lx, yy, lx + 44, yy + 44], fill=KIND_COLOR[k], outline=COLORS['ink'], width=2)
        d.text((lx + 60, yy + 8), n, font=font(24), fill=COLORS['ink'])
    yy = oy + 60 + 4 * 56
    d.rectangle([lx, yy, lx + 44, yy + 44], fill=COLORS['door'])
    d.text((lx + 60, yy + 8), '出入口（下の真ん中）', font=font(24), fill=COLORS['ink'])
    d.text((lx, yy + 90), '背の高い家具は、絵が上（奥の壁）に', font=font(22), fill=(90, 90, 90))
    d.text((lx, yy + 118), 'はみ出してよい。床の位置は守る', font=font(22), fill=(90, 90, 90))
    yy += 200
    d.text((lx, yy), '番号の一覧（「→」は調べたときの働き）', font=font(26), fill=COLORS['ink'])
    for n, it in enumerate(r['items']):
        t = f"{marks[n]} {it['name']}" + (f" → {it['use']}" if it['use'] else '')
        d.text((lx, yy + 44 + n * 36), t, font=font(22), fill=COLORS['ink'])
    return im


def room_checks() -> list[str]:
    """出入口から、働きのある物の前まで歩いて行けるか（主人公の足元 96×64 が通れる幅で判定）"""
    out: list[str] = []
    ok_all = True
    fw, fh = 96 // CELL, 64 // CELL
    for r in ROOMS:
        W, H = r['size']
        a = np.zeros((H, W), dtype=bool)
        a[ROOM_WALL:H, 32:W - 32] = True
        for it in r['items']:
            if it['kind'] in ('furniture', 'npc'):
                x1, y1, x2, y2 = it['rect']
                a[y1:y2, x1:x2] = False
        grid = a[CELL // 2::CELL, CELL // 2::CELL]
        gh, gw = grid.shape
        fits = np.zeros_like(grid)
        for y in range(gh - fh + 1):
            for x in range(gw - fw + 1):
                fits[y, x] = grid[y:y + fh, x:x + fw].all()
        start = ((r['door'][0] + r['door'][1]) // 2 // CELL - fw // 2, gh - fh - 1)
        seen = np.zeros_like(fits)
        q = deque([start]) if fits[start[1], start[0]] else deque()
        if q:
            seen[start[1], start[0]] = True
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < gw and 0 <= ny < gh and fits[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((nx, ny))
        out.append(f"■ {r['name']}")
        for it in r['items']:
            if not it['use']:
                continue
            x1, y1, x2, y2 = (v // CELL for v in it['rect'])
            if it['kind'] == 'wall':
                y2 = ROOM_WALL // CELL  # 壁の物は、壁のすぐ下に立って調べる
            ok = False
            # 物の上下左右に、主人公の足元がくっつく位置があるか
            for y in range(max(y1 - fh, 0), min(y2 + 1, gh)):
                for x in range(max(x1 - fw, 0), min(x2 + 1, gw)):
                    if seen[y, x]:
                        ok = True
            ok_all &= ok
            out.append(f"  {'OK' if ok else 'NG'}  {it['name']}（{it['use']}）")
    out.insert(0, f"結果：{'すべて合格' if ok_all else '不合格あり'}\n")
    return out


def coordinate_text() -> str:
    """設計図の見方と座標表（人が読む用）。座標はこのファイルの TOWN / ROOMS から自動で書く"""
    L = [
        '設計図の見方と座標表（このファイルは tools/design/seimon_town_pack.py が自動で作成）',
        '',
        '■ 画像の一覧',
        f'街/T01_全体配置図_固定_{MAP}.png　　　　　街の正本。建物の枠・玄関・歩ける所・緑地・4分割の線',
        f'街/T02_歩ける所マスク_白が歩ける_{MAP}.png　白＝歩ける、黒＝歩けない（当たり判定のもと）',
        '街/T03_主人公と扉の大きさ確認.png　　　　 扉の高さが主人公の背たけと同じくらいか（等倍）',
        '街/T04_建物の部品一覧_同じ倍率.png　　　　 建物と噴水の大きさの関係、玄関の幅、ChatGPT で作る画像の大きさ',
        '街/T05_4分割の管理図_縮小.png　　　　　　 完成図を4つに切る線（A北西・B北東・C南西・D南東）',
        '部屋/R01〜R07_配置図.png　　　　　　　　 部屋ごとの家具の位置（番号と一覧）',
        'ChatGPTに添付する枠/G00〜G27　　　　　　　ChatGPT に添付する「形の目安」（文字なし）',
        '',
        '■ 色の意味（T01）',
        'うすい黄土色＝歩ける所（道・広場）。ここには何も置かない',
        '茶色＝草原への出口（石畳から土の道へ）',
        '濃い緑の点線の四角＝緑地（木・花壇・ベンチなどの飾りを置いてよい所）',
        '色の四角＝建物の枠（その建物の絵を置く場所）。緑の帯＝玄関',
        '赤の点線＝4分割の線（絵には描かない）',
        '',
        '■ 座標の読み方',
        f'・単位は完成図（{MAP}×{MAP}）のピクセル。左上が 0,0。右へ行くほど x、下へ行くほど y が大きい',
        '・枠 [左, 上, 右, 下]。玄関は枠の下辺の真ん中',
        f'・主人公は {PLAYER_W}×{PLAYER_H}（素材 216×288 の半分）。1マス＝64',
        '',
        '■ 建物（街）',
        'ID　　　　　　名前　　　　　　　　　場所　　枠 [左,上,右,下]　　　　大きさ　　玄関(x,y)　　玄関の幅　ChatGPTの画像',
    ]
    for b in TOWN['buildings']:
        x1, y1, x2, y2 = b['rect']
        dx, dy = door_of(b)
        L.append(f"{b['id']:<13} {b['name']:<12}\t{b['zone']}\t[{x1},{y1},{x2},{y2}]\t{x2 - x1}×{y2 - y1}\t({dx},{dy})\t{b['door_w']}\t{b['canvas']}")
    f = TOWN['fountain']
    L += ['', f"噴水：中心 {tuple(f['center'])}・絵の枠 {f['slot']}・真ん中の半径 {f['blocked_r']} は歩けない",
          f"噴水広場：中心 {tuple(TOWN['plaza']['center'])}・半径 {TOWN['plaza']['r']}（噴水のまわりを一周できる）", '',
          '■ 歩ける所（長方形を重ねたもの＋噴水広場の円）']
    for w in TOWN['walk']:
        x1, y1, x2, y2 = w['rect']
        L.append(f"{w['id']:<12} {w['name']:<14}\t[{x1},{y1},{x2},{y2}]\t横{x2 - x1}×縦{y2 - y1}")
    e = TOWN['exit']
    L += [f"{e['id']:<12} {e['name']}\t{e['rect']}（下の端 {e['trigger']} に入ると街の外へ）", '', '■ 緑地（飾りを置いてよい所）']
    for g in TOWN['green']:
        L.append(f"{g['id']:<12} {g['name']:<14}\t{g['rect']}")
    L += ['', f"■ ゲーム開始の位置：{tuple(TOWN['spawn']['point'])}（{TOWN['spawn']['name']}）", '',
          '■ 部屋（単位は部屋の左上からのピクセル。上 192 は奥の壁）']
    for r in ROOMS:
        W, H = r['size']
        L.append(f"\n【{r['id']}】{r['name']}　{W}×{H}　出入口 x {r['door'][0]}〜{r['door'][1]}（下の壁）")
        for it in r['items']:
            use = f" → {it['use']}" if it['use'] else ''
            L.append(f"  {it['id']:<18} {it['name']}\t{it['kind']}\t{it['rect']}{use}")
    L += ['', '■ 機械が読む正本：街/town_layout.json・部屋/rooms_layout.json', '']
    return '\n'.join(L)


# ───────────── 書き出し ─────────────
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--sprite', default=None)
    args = ap.parse_args()
    root = args.out
    town_dir = os.path.join(root, '02_設計図', '街')
    room_dir = os.path.join(root, '02_設計図', '部屋')
    guide_dir = os.path.join(root, '02_設計図', 'ChatGPTに添付する枠')
    check_dir = os.path.join(root, '04_チェック表')
    for p in (town_dir, room_dir, guide_dir, check_dir):
        os.makedirs(p, exist_ok=True)

    player = load_player(args.sprite, PLAYER_H)
    mask = town_mask()
    mask.save(os.path.join(town_dir, f'T02_歩ける所マスク_白が歩ける_{MAP}.png'), optimize=True)
    town = draw_town(mask, player)
    town_sheet(town).convert('RGB').save(os.path.join(town_dir, f'T01_全体配置図_固定_{MAP}.png'), optimize=True)
    plain = draw_town(mask, player, labels=False)
    scale_check(plain, player).convert('RGB').save(os.path.join(town_dir, 'T03_主人公と扉の大きさ確認.png'),
                                                   optimize=True)
    parts_sheet(player).convert('RGB').save(os.path.join(town_dir, 'T04_建物の部品一覧_同じ倍率.png'), optimize=True)
    q = town.resize((1600, 1600), Image.LANCZOS).convert('RGB')
    dq = ImageDraw.Draw(q)
    dq.line([800, 0, 800, 1600], fill=COLORS['red'], width=6)
    dq.line([0, 800, 1600, 800], fill=COLORS['red'], width=6)
    for t, xy in (('A 北西', (20, 20)), ('B 北東', (820, 20)), ('C 南西', (20, 820)), ('D 南東', (820, 820))):
        dq.text(xy, t, font=font(44), fill=COLORS['red'], stroke_width=4, stroke_fill=(255, 255, 255))
    q.save(os.path.join(town_dir, 'T05_4分割の管理図_縮小.png'), optimize=True)

    rough = draw_town(mask, player, labels=False, grid=False).resize((1024, 1024), Image.LANCZOS).convert('RGB')
    rough.save(os.path.join(guide_dir, 'G00_街_配置の目安_文字なし_1024x1024.png'), optimize=True)
    for i, b in enumerate(TOWN['buildings'], 1):
        guide_building(b).save(os.path.join(guide_dir, f"G{i:02d}_街_{b['name']}_{b['canvas']}.png"), optimize=True)
    guide_fountain().save(os.path.join(guide_dir, 'G12_街_噴水_1024x1024.png'), optimize=True)
    for i, r in enumerate(ROOMS, 1):
        room_plan(r, player).convert('RGB').save(os.path.join(room_dir, f"R{i:02d}_{r['name'].split('（')[0]}_配置図.png"),
                                                 optimize=True)
        guide_room(r).save(os.path.join(guide_dir, f"G{20 + i}_部屋_{r['name'].split('（')[0]}_1024x1024.png"), optimize=True)

    # 座標表（機械が読む用）
    town_json = dict(TOWN)
    town_json['buildings'] = [dict(b, door=door_of(b)) for b in TOWN['buildings']]
    town_json['note'] = f'単位は完成図({MAP}×{MAP})のピクセル。rect=[左,上,右,下]。建物 rect は絵を置く枠、玄関は枠の下辺の中央'
    town_json['player_size'] = [PLAYER_W, PLAYER_H]
    with open(os.path.join(town_dir, 'town_layout.json'), 'w', encoding='utf-8') as fp:
        json.dump(town_json, fp, ensure_ascii=False, indent=1)
    with open(os.path.join(room_dir, 'rooms_layout.json'), 'w', encoding='utf-8') as fp:
        json.dump(dict(note='単位は部屋の左上からのピクセル。1マス64。上192pxは奥の壁', wall_top=ROOM_WALL,
                       rooms=ROOMS), fp, ensure_ascii=False, indent=1)

    with open(os.path.join(root, '02_設計図', '00_設計図の見方と座標表_UTF8.txt'), 'w', encoding='utf-8') as fp:
        fp.write(coordinate_text())

    lines = town_checks(mask)
    rlines = room_checks()
    with open(os.path.join(check_dir, '02_設計図の自動チェック結果_UTF8.txt'), 'w', encoding='utf-8') as fp:
        fp.write('セイモン街　設計図の自動チェック結果（tools/design/seimon_town_pack.py が作成）\n')
        fp.write('設計図そのものに矛盾がないかを、プログラムで確かめた結果です。絵のチェックは 01_QAチェック表 で行います。\n\n')
        fp.write('【街】\n' + '\n'.join(lines) + '\n\n【部屋】\n' + '\n'.join(rlines) + '\n')
    print('\n'.join(lines + rlines))


if __name__ == '__main__':
    main()
