# -*- coding: utf-8 -*-
"""新しい街（2026-10-28 指示書「街を新しい絵で作り直す」）を、届いた部品から組み立てる。

tools/design/seimon_world_build.py の main() から呼ばれる（部屋はいままでどおり seimon_world_build が作る）。

- 部品の原本：design-parts/town-20261028/（無改変。part1_buildings・part2_terrain_props・instructions/cardshop）
- 色：tools/design/town_tone_20261028.py（ユーザー承認の「1〜2割落ち着かせる」）をかけた写しを使う。
  前の TOWN_TONE（あざやかさ ×1.18 など）は、新しい部品にはかけない。建物の落ち影・接地の影・光と陰は今までどおりかける
- 配置：instructions/town_layout_numbers.png（番号つきの配置図・北が上）。下の BUILDINGS などが正本
- 大きさ：建物は「扉の高さ」でそろえる（主人公の体の高さ 約194 単位より少し高く。大会会場はいちばん大きく）
- 出力
  - assets/images/maps/town/town2_r{行}c{列}.webp   地面と、人がいつも手前に立つもの（道・小川・塀・高台の壁・階段・橋・草花）
  - assets/images/maps/town/t2_*.webp               建物・木・小物など（人と足元の高さで前後を比べて重ねる）
  - 戻り値の dict                                   マス目・扉・自動ドア・噴水のしぶき（seimon_world_build が worldArt.generated.ts に書く）
- 絵は描き直さない。切り出し・縮小・並べる・影を付けるだけ
"""
from __future__ import annotations

import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

import town_tone_20261028 as town_tone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/town-20261028')
# 2026-10-28 夜：建物7つは正面向きの新しい絵（front-facing-20261028。同じファイル名なので先に探す。前の斜めの原本は part1_buildings に残す）
# 2026-10-29：研究所・管理局・練習場も front-facing-20261028 に（指示書は town3-20261029/）
SHEET_DIRS = [os.path.join(SRC, 'front-facing-20261028'), os.path.join(SRC, 'part1_buildings'), os.path.join(SRC, 'part2_terrain_props'), os.path.join(SRC, 'instructions/cardshop')]
OUT_TOWN = os.path.join(ROOT, 'assets/images/maps/town')

CELL = 32
W, H = 6400, 6784          # 街の大きさ（設計図の単位。表示は 0.5625 倍の論理px）。200×212 マス
K = 0.75                   # 書き出しの細かさ（1 単位 → 0.75px。いままでの街と同じ）
SPLIT_C, SPLIT_R = 4, 4    # 地面の絵の分け方
WEBP_Q = 82
SPRITE_Q = 86

# ───────────── 部品 ─────────────
_sheets: dict[str, Image.Image] = {}
_labels: dict[str, tuple[np.ndarray, list]] = {}


def sheet(name: str) -> Image.Image:
    """部品のシート（色の処理をかけた写し。原本は変えない）"""
    if name not in _sheets:
        path = next(os.path.join(d, f'{name}.png') for d in SHEET_DIRS if os.path.exists(os.path.join(d, f'{name}.png')))
        _sheets[name] = town_tone.tone(Image.open(path))
    return _sheets[name]


def cut(name: str, box: tuple[int, int, int, int] | None = None, raw: bool = False) -> Image.Image:
    """シートから1つ切り出す。box（シートの px）に中心がある塊だけ残し、透明でない所で切り抜く。
    raw：塊を見ずに box をそのまま切る（となりの物とくっついているとき）"""
    return cut_at(name, box, raw)[0]


def cut_at(name: str, box: tuple[int, int, int, int] | None = None, raw: bool = False) -> tuple[Image.Image, tuple[int, int]]:
    """cut と同じ。切り抜いた絵の左上が、シートのどこか（px）も返す"""
    im = sheet(name)
    if box is None:
        return _trim_at(im, (0, 0))
    if raw:
        return _trim_at(im.crop(box), box[:2])
    if name not in _labels:
        a = np.array(im)[..., 3] > 40
        lab, _ = ndimage.label(ndimage.binary_dilation(a, iterations=3))
        _labels[name] = (lab, ndimage.find_objects(lab))
    lab, objs = _labels[name]
    x1, y1, x2, y2 = box
    keep = [i + 1 for i, s in enumerate(objs) if s is not None
            and x1 <= (s[1].start + s[1].stop) / 2 <= x2 and y1 <= (s[0].start + s[0].stop) / 2 <= y2]
    arr = np.array(im)
    arr[..., 3] = np.where(np.isin(lab, keep), arr[..., 3], 0)
    return _trim_at(Image.fromarray(arr).crop(box), (x1, y1))


def _trim(im: Image.Image) -> Image.Image:
    return _trim_at(im, (0, 0))[0]


def _trim_at(im: Image.Image, origin: tuple[int, int]) -> tuple[Image.Image, tuple[int, int]]:
    """うすい透明（10 未満）を消して、透明でない所で切り抜く。切り抜いた左上（origin からの位置を足したもの）も返す"""
    arr = np.array(im.convert('RGBA'))
    arr[..., 3] = np.where(arr[..., 3] < 10, 0, arr[..., 3])
    out = Image.fromarray(arr)
    bb = out.getbbox()
    return out.crop(bb), (origin[0] + bb[0], origin[1] + bb[1])


def resize(im: Image.Image, s: float) -> Image.Image:
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


# ───────────── 配置（設計図の単位） ─────────────
# 建物：部品・扉（シートの px：扉の中心 x・扉の上・扉の下＝敷居）・扉の高さ（単位）・街の扉の位置（中心 x・敷居の y）
#  扉の高さ：家・店 215（主人公 約194 より少し高い）、公共の建物は少し大きく、大会会場はいちばん大きく 290
# 2026-10-28 夜：6〜12 の扉の位置は正面向きの新しい絵で測り直した（扉の石のアーチの上・扉の下の段の上）
# 2026-10-29：2 管理局・3 研究所・4 練習場も正面向きの新しい絵に。扉を測り直した（扉の高さ・街の扉の位置はそのまま）
BUILDINGS = [
    # 番号  ID              部品                      扉 cx, 上, 下     扉の高さ  街の扉 x, 敷居 y
    dict(no=1, id='ARENA', file='building_arena', door=(762, 735, 945), door_h=290, at=(3200, 1330), door_w=236),
    dict(no=2, id='BUREAU', file='building_bureau', door=(511, 669, 874), door_h=240, at=(5420, 1830), door_w=150),
    dict(no=3, id='LAB', file='building_lab', door=(508, 711, 861), door_h=215, at=(1150, 1520), door_w=150),
    dict(no=4, id='TRAINING', file='building_practice', door=(768, 585, 824), door_h=240, at=(1100, 2960), door_w=170),
    dict(no=5, id='SHOP', file='cardshop_building_open', door=(767, 548, 798), door_h=230, at=(4600, 2890), door_w=200),
    dict(no=6, id='HOUSE_A', file='building_florist', door=(516, 575, 828), door_h=215, at=(5800, 2890), door_w=100),
    dict(no=7, id='HOUSE_D', file='building_tailor', door=(480, 606, 848), door_h=215, at=(4500, 4240), door_w=100),
    dict(no=8, id='HOUSE_B', file='building_house_pete', door=(512, 621, 868), door_h=215, at=(900, 4240), door_w=100),
    dict(no=9, id='HOUSE_E', file='building_house_harold', door=(512, 630, 872), door_h=215, at=(2000, 4240), door_w=100),
    dict(no=10, id='PLAYER_HOME', file='building_home', door=(512, 630, 862), door_h=215, at=(1000, 5800), door_w=100),
    dict(no=11, id='GUIDE_HOME', file='building_neighbor', door=(513, 615, 872), door_h=215, at=(2050, 5800), door_w=100),
    # 12 大工の作業小屋：入れない（見た目だけ）
    dict(no=12, id='SHED', file='building_shed', door=(555, 477, 735), door_h=215, at=(4700, 1000), door_w=0),
]
# カードショップの自動ドア（instructions/cardshop/cardshop_layout.json。シートの px）
SHOP_DOORS = dict(left=(646, 546), right=(766, 546), clip=(648, 548, 238, 250), travel=120)

# 高台（1・3 の段）：上の面の範囲（左, 上, 右, 下）。下の辺に石の壁（高さ TERRACE_FACE）
TERRACE_FACE = 200
TERRACE_W = (140, 300, 2160, 1860)       # 西の高台（研究所・見晴らし台）
TERRACE_N = (2160, 300, 4300, 1560)      # 北の高台（大会会場）。西の高台と同じ高さでつながる
STAIRS_N = dict(cx=3200, top=1505, s=0.9)   # 15 大階段（terrace_parts の大きい階段）
STAIRS_W = dict(cx=1960, top=1812, s=0.9)   # 16 西の高台への階段（小さい階段）
STAIR_TUCK = 140                            # 階段のわきの石垣を、階段の外のふちから内へ差しこむ長さ

# 道（石畳 tile_street）：長方形。噴水のまわりは円い広場（tile_plaza）
# 2026-10-28 直し（ユーザー「行き止まりの四角い道を残さない」）：道の端は扉の前の小道（DOOR_PATH_W）か別の道で終わる
PLAZA = dict(cx=3200, cy=3220, r=720)
STREETS = [
    (2944, 1860, 3456, 2600),     # 大階段の下 → 広場
    (3456, 1840, 5960, 2120),     # 北東の道（管理局の前。建物の右のはしで終わる）
    (1000, 3080, 2944, 3360),     # 西の道（練習場の扉の前で終わる）
    (3456, 3028, 5940, 3412),     # 東の道（ショップ・花屋の前・商店街）。2026-10-29：林の手前で止め、はしに花壇（END_PLANTERS）
    (5060, 3412, 5940, 3960),     # 商店街の石畳（屋台の足元。東の道とひと続き）
    (1840, 2110, 2080, 3100),     # 西の高台の階段の下 → 西の道（2026-10-29：階段の下の端までつなぐ）
    (2944, 3800, 3456, 4900),     # 南の大通り（広場 → 石の橋）
    (800, 4380, 2944, 4600),      # ピート・ハロルドの家の前（ピートの家の扉の前で終わる）
    (3456, 4380, 4600, 4600),     # 仕立て屋の前（仕立て屋の扉の前で終わる）
    (2944, 5640, 3456, 6180),     # 南の大通り（石の橋 → 南の門）
    (3080, 6180, 3320, 6300),     # 南の門の前
    (900, 5930, 2944, 6170),      # 主人公の家・となりの家の前（主人公の家の扉の前で終わる）
    (2420, 1330, 3980, 1560),     # 大会会場の前（高台の上。建物の幅だけ）
    (1050, 1560, 2060, 1830),     # 研究所の扉の前 → 西の高台の階段（高台の上。2026-10-29：階段の幅いっぱい・階段の上の端まで）
    (1535, 4990, 1695, 5930),     # 木の橋 → 主人公の家・となりの家の前の道（2026-10-28 点検。橋の先の行き止まりをなくす）
]
# 扉の前の小道：扉の敷居から下の道まで（幅。BUILDINGS の扉の真ん中に合わせる）
DOOR_PATH_W = 200
# 縁石（edges_curb）：石の高さ（単位）
CURB_STONE = 30
# 小川（18）：中心線と幅。石の橋（19）・木の橋（24）の所だけ渡れる
# 東西のはしは林の下へ流れていく（林の木は小川の上に置かない）
# 2026-10-29 iPhone の試遊「小川の石垣が斜めの段々で安っぽい」：斜めをやめて「まっすぐ＋直角の曲がり」に。
# 西はピート・ハロルドの家の道の南（y 4840）、となりの家の東（x 2660）で直角に南へ曲がり、東は石の橋の下（y 5500）をまっすぐ。
# 中心線は水平・垂直の線だけ（STREAM の点は順に、x か y のどちらかだけが変わる）
STREAM = [(-300, 4840), (2660, 4840), (2660, 5500), (6700, 5500)]
STREAM_W = 240
BRIDGE_STONE = dict(cx=3200, s=1.1)       # 石の橋：アーチの下の端を小川の下の岸に合わせる
# 石の橋の手前（南）のアーチの面と水は使わない（2026-10-28 ユーザー「橋の下の水の上を歩いてしまう」）。
# シートの y 518（デッキの南の端＝アーチの上のふち）より下は、左右の柱（x 895 より左・1265 より右）だけ残す。
# そこから南は道（tile_street）がデッキにそのままつながる。小川は柱の左右に見える
BRIDGE_DECK_S = 518
BRIDGE_PILLARS = (895, 1265)
# 木の橋（24）：2026-10-28 点検（ユーザー「斜めだから歩くと違和感」）。部品は上ほど右へずれた斜めの絵なので、
# 下の端はそのままに上を左へずらしてまっすぐにする（WOOD_DESKEW＝高さ1あたりのずれ。シートの橋板の真ん中は上下で約155px ずれていた）。
# 渡った先は主人公の家ととなりの家のあいだ。そこから南の道まで小道（STREETS の最後）でつなぐ（前は草地で行き止まりだった）
BRIDGE_WOOD = dict(cx=1615, top=4600, s=0.85)
WOOD_DESKEW = 0.32
# 噴水（13）：水の輪の中心・柱（輪の穴より上。水の上に描き直す）・しぶきの下の端（どれもシートの px）
FOUNTAIN_WATER = (328, 682)
FOUNTAIN_PILLAR = [(230, 200), (432, 200), (432, 515), (393, 515), (393, 600), (397, 600), (397, 642),
                   (260, 642), (260, 600), (242, 600), (242, 515), (230, 515)]
# しぶき：2026-10-29 iPhone の試遊「取って貼り付けた感じ」：小さくして（1.2→0.9）、下の端を水盤の水の中（柱の前の水面）へ下げ、
# 水盤の水の色に寄せて少し透かす（FOUNTAIN_SPRAY_TINT・FOUNTAIN_SPRAY_ALPHA）。動きは少しゆっくり（コマ 140→220ms）。
# しぶきは噴水の台の後ろに重ねる（柱の前のしぶきの根元と、水盤に落ちた先は台と水に隠れ、柱から出て水盤へ落ちて見える）
FOUNTAIN_SPRAY_FOOT = (326, 655)
FOUNTAIN_SPRAY_SCALE = 0.9
FOUNTAIN_SPRAY_TINT = 0.35
FOUNTAIN_SPRAY_ALPHA = 0.85
FOUNTAIN_SPRAY_MS = 220
# 街のまわりの塀・南の門（14）。東西のはしは塀をやめて林のへり（2026-10-28 ユーザー）
WALL_N_BASE = 300
WALL_SIDE = 140
WALL_S_TOP = 6474
GATE_CX = 3200
GATE_TUCK = 70        # 門のわきの塀を、門の絵のふちから内へ差しこむ長さ（すき間を作らない）
# 林のへり：はしからこの幅は歩けない（木と植え込みをすき間なく並べる）
FOREST_W = 300

# 小物（足元の位置）。番号のない★・丸（木）は配置図の目安
PROPS = [
    # 木（配置図の丸）
    ('tree_big', 330, 1250), ('tree_mid', 2020, 760), ('conifer', 330, 760), ('tree_mid', 2050, 1300),
    ('conifer', 330, 3330),
    # 2026-10-29：小川をまっすぐにしたので、東の南側の木は小川の南へ
    ('tree_big', 5650, 5800), ('conifer', 5300, 5950),
    ('tree_big', 3950, 6420), ('tree_mid', 4550, 6440), ('conifer', 5100, 6420), ('tree_big', 5700, 6440), ('tree_mid', 6150, 6200),
    ('tree_mid', 4450, 1720), ('conifer', 6120, 760), ('tree_mid', 6110, 1500), ('conifer', 4400, 820),
    ('tree_mid', 4300, 5900), ('tree_big', 4800, 6050),
    ('conifer', 330, 4300),
    # 南の塀の手前の植え込み
    ('hedge', 420, 6440), ('bush_big', 640, 6430), ('hedge', 900, 6440), ('bush_small', 1150, 6420), ('hedge', 1420, 6440),
    ('bush_big', 1700, 6430), ('hedge', 1980, 6440), ('bush_small', 2250, 6420), ('hedge', 2520, 6440),
    # 主人公の家・となりの家のまわり
    # 2026-10-28 点検：(1640, 6000) の植木鉢は、木の橋からの小道の出口をふさぐので外した
    ('bush_small', 380, 5800), ('planter', 2700, 5880), ('lamp', 2860, 5900),
    # 西の高台（★：研究所の前）
    ('flowerbowl', 760, 1640), ('flowerbowl', 1560, 1640), ('lamp', 640, 1580), ('lamp', 1660, 1580),
    ('telescope', 470, 1850),     # 17 見晴らし台
    # 大会会場の前（高台の上）・大階段のわき
    ('banner', 2460, 1500), ('banner', 3940, 1500), ('lamp', 2780, 1520), ('lamp', 3620, 1520),
    # 広場（13）のまわり：ベンチ・街灯・花
    ('bench', 2660, 3700), ('bench', 3740, 3700), ('lamp', 2600, 2700), ('lamp', 3800, 2700),
    # 2026-10-29：(2480, 3250) の花鉢は西の道の上にはみ出していたので外した
    ('flowerbowl', 3920, 3640),
    # 北東の道・管理局のまわり
    ('lamp', 3700, 2230), ('lamp', 4500, 2230), ('crate', 4250, 1180), ('barrel', 4380, 1250),
    ('banner', 6100, 1790), ('barrel', 6020, 1250),
    # 東の道（21・22 商店街）
    ('lamp', 3620, 3520), ('lamp', 4900, 3520), ('barrel', 6150, 3920), ('crate', 5110, 3900), ('barrel', 6180, 3640),
    # 西の道・練習場のまわり
    ('lamp', 1500, 3460), ('lamp', 2500, 3460), ('planter', 2250, 2400), ('flowerbowl', 2200, 2800),
    # ピート・ハロルドの家の前・仕立て屋の前
    ('lamp', 1250, 4690), ('lamp', 2700, 4700), ('planter', 4950, 4300), ('lamp', 3600, 4700),
    # 南の大通り（14 南の門のまえ・20 ★）
    # 2026-10-29：石の橋の南のはしの街灯2本は、橋の柱の街灯と重なって見えたので外した
    ('sign', 2760, 6440), ('bench', 3850, 5920),
    # 2026-10-29：東の道・商店街のはし（林の手前）の花壇。道がここで終わる理由になるように、道のはしにそろえて同じ間で
    ('planter', 6040, 3130), ('planter', 6040, 3420), ('planter', 6040, 3700), ('planter', 6040, 3980),
    # 西の高台の石垣の角（階段の右。上の段の石垣とのつなぎ目）を植え込みで
    ('bush_big', 2215, 1905),
    ('flowerbowl', 3700, 6120),
    # 2026-10-28 直し（ユーザー「広く空いた草地に小物を置いて、にぎやかに」。歩く道はふさがない）
    # 西の道の北（西の高台の階段の道と大通りの間）
    ('tree_mid', 2600, 2330), ('bush_big', 2300, 2620), ('bench', 2400, 2990), ('flowerbowl', 2160, 3010),
    # 北東の道とショップの間
    ('tree_mid', 3650, 2560), ('bush_small', 3830, 2400),
    # 西の高台の石垣の下（練習場の裏）
    ('hedge', 700, 2190), ('bush_small', 960, 2180), ('hedge', 1250, 2190), ('bush_big', 1600, 2200),
    # ピートの家とハロルドの家の間・ハロルドの家と大通りの間
    ('bush_big', 1525, 4270), ('bush_small', 2650, 4010), ('flowerbowl', 2740, 4260),
    # 仕立て屋と広場の間
    ('bush_big', 3800, 4060), ('flowerbowl', 3600, 4260),
    # 商店街の南
    ('flowerbowl', 5000, 4110), ('bench', 5300, 4130), ('lamp', 5600, 4020),
    # 東の南側（2026-10-29 並べ直し：小川の南の岸に沿って、ベンチと街灯を同じ間で交互に。23 ★のベンチもここ）
    ('bench', 4000, 5150), ('lamp', 4350, 5110), ('bench', 4700, 5150), ('lamp', 5050, 5110), ('bench', 5400, 5150),
    ('bush_big', 4200, 6220), ('bush_small', 5100, 6230), ('flowerbowl', 5000, 5800),
    # となりの家と石の橋の間・主人公の家の西
    ('bush_big', 2420, 5450), ('bush_small', 470, 5420), ('flowerbowl', 570, 5760),
]
# 外に立つ人の足元（単位）。maps.ts の spotOf で読む（2026-10-28 ユーザー：ピートとハロルドは外だけ、マルタとロザリーは店の中だけ）
SPOTS = {
    'PETE_SPOT': (4880, 3090),       # ピート：カードショップ（5）の前（入口の前はふさがない）
    'HAROLD_SPOT': (2880, 3700),     # ハロルド：噴水の広場のベンチのそば
    'GUIDE_SPOT': (2250, 5990),      # ミレイユ：となりの家（11）の前の道
}
# 草むら・花の飾り（decal_grass）を散らす間隔
DECAL_STEP = 150

# ───────────── 部品の切り出し（シートの px の範囲） ─────────────
PROP_PARTS = {
    'tree_big': ('props_nature', (8, 19, 665, 700), 0.95), 'tree_mid': ('props_nature', (661, 137, 1159, 691), 0.95),
    'conifer': ('props_nature', (1174, 36, 1517, 686), 0.95), 'bush_big': ('props_nature', (23, 718, 329, 985), 0.7),
    'bush_small': ('props_nature', (344, 780, 572, 983), 0.7), 'hedge': ('props_nature', (585, 828, 881, 982), 0.85),
    'fence': ('props_nature', (895, 809, 1157, 983), 0.7), 'telescope': ('props_nature', (1174, 710, 1517, 1003), 0.85),
    'lamp': ('props_street', (100, 1, 216, 400), 0.8), 'lamp2': ('props_street', (319, 2, 582, 397), 0.8),
    'bench': ('props_street', (625, 122, 1078, 404), 0.7), 'bench_side': ('props_street', (1228, 42, 1403, 391), 0.7),
    'planter': ('props_street', (66, 415, 399, 699), 0.62), 'flowerbowl': ('props_street', (468, 414, 778, 691), 0.62),
    'barrel': ('props_street', (861, 429, 1057, 706), 0.6), 'crate': ('props_street', (1163, 415, 1473, 704), 0.55),
    'banner': ('props_street', (56, 652, 239, 1024), 0.8), 'sign': ('props_street', (368, 721, 721, 1016), 0.7),
    'manhole': ('props_street', (821, 736, 1121, 976), 0.45), 'drain': ('props_street', (1163, 779, 1492, 967), 0.45),
    # 林のへり用（少し小さく）
    'conifer_e': ('props_nature', (1174, 36, 1517, 686), 0.8), 'tree_e': ('props_nature', (661, 137, 1159, 691), 0.78),
    'bush_e': ('props_nature', (23, 718, 329, 985), 0.62),
}
# 当たり（足元の何マス分をふさぐか：幅の割合・奥行きの単位）
PROP_BLOCK = {
    'tree_big': (0.30, 70), 'tree_mid': (0.30, 64), 'conifer': (0.35, 64), 'bush_big': (0.9, 90), 'bush_small': (0.9, 70),
    'hedge': (0.95, 64), 'fence': (0.9, 40), 'telescope': (0.9, 120), 'lamp': (0.9, 32), 'lamp2': (0.6, 32),
    'bench': (0.9, 70), 'bench_side': (0.9, 120), 'planter': (0.95, 90), 'flowerbowl': (0.9, 80), 'barrel': (0.9, 64),
    'crate': (0.95, 80), 'banner': (0.5, 32), 'sign': (0.8, 40),
    'conifer_e': (0.35, 64), 'tree_e': (0.30, 64), 'bush_e': (0.9, 80),
}
STALLS = [((6, 181, 526, 844), 5240), ((539, 183, 1042, 849), 5600), ((1043, 183, 1536, 853), 5960)]
STALL_BASE, STALL_S = 3880, 0.6


# ───────────── 地面 ─────────────
def tiled(tex: Image.Image, size: tuple[int, int], scale: float, mirror: bool = False) -> Image.Image:
    t = resize(tex.convert('RGBA'), scale)
    out = Image.new('RGBA', size)
    for j, y in enumerate(range(0, size[1], t.height)):
        for i, x in enumerate(range(0, size[0], t.width)):
            piece = t
            if mirror and i % 2:
                piece = piece.transpose(Image.FLIP_LEFT_RIGHT)
            if mirror and j % 2:
                piece = piece.transpose(Image.FLIP_TOP_BOTTOM)
            out.paste(piece, (x, y))
    return out


def P(v: float) -> int:
    """単位 → 書き出しの px"""
    return round(v * K)


def noise(size: tuple[int, int], cells: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    small = Image.fromarray((rng.random((cells, cells)) * 255).astype(np.uint8))
    big = np.array(small.resize(size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(size[0] / cells / 3))).astype(np.float32)
    return np.clip((big - big.mean()) / (big.std() + 1e-6) / 2.2, -1, 1)


def mask_rects(size: tuple[int, int], rects, circle=None) -> Image.Image:
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    for x1, y1, x2, y2 in rects:
        d.rectangle([P(x1), P(y1), P(x2) - 1, P(y2) - 1], fill=255)
    if circle:
        cx, cy, r = circle
        d.ellipse([P(cx - r), P(cy - r), P(cx + r), P(cy + r)], fill=255)
    return m


def stream_rects(widen: float = 0) -> list[tuple[float, float, float, float]]:
    """小川の水の範囲（区間ごとの長方形。角は四角につながる）"""
    h = (STREAM_W + widen) / 2
    return [(min(x1, x2) - h, min(y1, y2) - h, max(x1, x2) + h, max(y1, y2) + h) for (x1, y1), (x2, y2) in zip(STREAM, STREAM[1:])]


def stream_mask(size: tuple[int, int], widen: float = 0) -> Image.Image:
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    for x1, y1, x2, y2 in stream_rects(widen):
        d.rectangle([P(x1), P(y1), P(x2) - 1, P(y2) - 1], fill=255)
    return m


def deskew(im: Image.Image, k: float) -> Image.Image:
    """上ほど右へずれて描かれた絵を、下の端はそのままに上を左へずらしてまっすぐにする（行ごとに k×(下からの高さ) だけ）"""
    w, h = im.size
    pad = int(k * h) + 2
    out = im.transform((w + pad, h), Image.AFFINE, (1, -k, 0, 0, 1, 0), resample=Image.BICUBIC)
    return out.crop(out.getchannel('A').getbbox())


def stream_y(x: float) -> float:
    """小川の中心線の y（x の位置。水平の区間の y。曲がり角の x では東の区間）"""
    for (x1, y1), (x2, y2) in zip(STREAM, STREAM[1:]):
        if y1 == y2 and min(x1, x2) <= x <= max(x1, x2):
            return y1
    return STREAM[-1][1]


def door_paths() -> list[tuple[float, float, float, float]]:
    """扉の前の小道：扉の敷居（少し上から。段の絵の下に隠れる）から、すぐ下の道の上の辺まで"""
    out = []
    for b in BUILDINGS:
        if not b['door_w']:
            continue
        x, sill = b['at']
        tops = [r[1] for r in STREETS if r[0] <= x <= r[2] and r[1] >= sill - 10]
        if tops and min(tops) - sill > 10:
            out.append((x - DOOR_PATH_W / 2, sill - 40, x + DOOR_PATH_W / 2, min(tops)))
    return out


def _stone_span(im: Image.Image, axis: int) -> tuple[int, int]:
    """縁石の部品の中で、石の所（草でない所）の始まりと終わり（axis=1：行、axis=0：列）"""
    a = np.array(im).astype(int)
    stone = (a[..., 3] > 128) & ~(a[..., 1] > a[..., 0] + 15)
    idx = np.where(stone.mean(axis=axis) > 0.5)[0]
    return int(idx[0]), int(idx[-1]) + 1


def draw_curbs(base: Image.Image, rects, extra_paved) -> None:
    """縁石（edges_curb）を、道の辺の向きに合わせて並べる。上・下の辺は横の石（草が外側）、左・右の辺は縦の石。
    噴水の円い広場は石を1つずつ回して並べる。となりが道の所（つながっている所）には置かない。
    道の下に描くので、石のはしが道にはみ出しても道の絵で隠れる（角は辺の石をのばして埋める）"""
    hsrc = cut('edges_curb', (65, 90, 1081, 231))      # 横（上が草）
    vsrc = cut('edges_curb', (40, 270, 200, 950))      # 縦（左が草）
    h0, h1 = _stone_span(hsrc, 1)
    v0, v1 = _stone_span(vsrc, 0)
    hs, vs = CURB_STONE / (h1 - h0), CURB_STONE / (v1 - v0)
    pieces = {
        'top': resize(hsrc, hs * K), 'bottom': resize(hsrc.transpose(Image.FLIP_TOP_BOTTOM), hs * K),
        'left': resize(vsrc, vs * K), 'right': resize(vsrc.transpose(Image.FLIP_LEFT_RIGHT), vs * K),
    }
    all_rects = list(rects) + list(extra_paved)
    cx, cy, r = PLAZA['cx'], PLAZA['cy'], PLAZA['r']

    def paved(x: float, y: float) -> bool:
        return any(a <= x < c and b <= y < d for a, b, c, d in all_rects) or (x - cx) ** 2 + (y - cy) ** 2 <= r * r

    def runs(points: list[tuple[float, float]], vals: list[float]) -> list[tuple[float, float]]:
        out, start = [], None
        for v, (px, py) in zip(vals, points):
            if not paved(px, py):
                start = v if start is None else start
            elif start is not None:
                out.append((start, v))
                start = None
        if start is not None:
            out.append((start, vals[-1]))
        return out

    ov = 4      # 石を道の側へ少し重ねる（すき間を作らない）
    for x1, y1, x2, y2 in rects:
        for side in ('top', 'bottom', 'left', 'right'):
            horiz = side in ('top', 'bottom')
            a, b = (x1, x2) if horiz else (y1, y2)
            vals = list(np.arange(a + 4, b, 8.0)) + [b - 1]
            off = {'top': y1 - 8, 'bottom': y2 + 8, 'left': x1 - 8, 'right': x2 + 8}[side]
            pts = [(v, off) if horiz else (off, v) for v in vals]
            for s0, s1 in runs(pts, vals):
                s0, s1 = s0 - 4 - CURB_STONE, s1 + 4 + CURB_STONE
                im = pieces[side]
                if horiz:
                    # 上の辺：石の下の辺を道の上の辺に。下の辺：石の上の辺を道の下の辺に
                    py = (y1 + ov - h1 * hs) if side == 'top' else (y2 - ov - (hsrc.height - h1) * hs)
                    x = P(s0)
                    while x < P(s1):
                        _paste(base, im.crop((0, 0, min(im.width, P(s1) - x), im.height)), (x, P(py)))
                        x += im.width - P(4)
                else:
                    # 左の辺：石の右の辺を道の左の辺に。右の辺：石の左の辺を道の右の辺に
                    px_ = (x1 + ov - v1 * vs) if side == 'left' else (x2 - ov - (vsrc.width - v1) * vs)
                    y = P(s0)
                    while y < P(s1):
                        _paste(base, im.crop((0, 0, im.width, min(im.height, P(s1) - y))), (P(px_), y))
                        y += im.height - P(4)
    # 円い広場：横の石を1つずつ（草が外を向くように回して）並べる
    n_bricks = 6
    bw = hsrc.width / n_bricks
    brick = resize(hsrc.crop((0, 0, round(bw), hsrc.height)), hs * K)
    stone_c = (h0 + h1) / 2 * hs * K
    step = bw * hs * 0.92
    n = int(np.ceil(2 * np.pi * r / step))
    for i in range(n):
        th = 2 * np.pi * i / n
        nx, ny = np.cos(th), np.sin(th)
        if paved(cx + nx * (r + 20), cy + ny * (r + 20)):
            continue
        rot = brick.rotate(-(np.degrees(th) + 90), expand=True, resample=Image.BICUBIC)
        # 石の真ん中を円の外側 CURB_STONE/2 - ov の所に。絵の真ん中は石の真ん中より外へ（草のぶん）
        rad = r + CURB_STONE / 2 - ov + (stone_c - brick.height / 2) / K
        bx, by = cx + nx * rad, cy + ny * rad
        _paste(base, rot, (P(bx) - rot.width // 2, P(by) - rot.height // 2))


def _paste(base: Image.Image, im: Image.Image, xy: tuple[int, int]) -> None:
    """絵の外にはみ出す所を切って重ねる（alpha_composite は負の位置を受け付けない）"""
    x, y = xy
    l, t_ = max(0, -x), max(0, -y)
    r, b = min(im.width, base.width - x), min(im.height, base.height - y)
    if r > l and b > t_:
        base.alpha_composite(im.crop((l, t_, r, b)), (x + l, y + t_))


def forest_edge(rng: random.Random) -> list[tuple[str, float, float]]:
    """東西のはしの林のへり（2026-10-28 ユーザー「塀をやめて、木と植え込みをすき間なく並べる」）。
    奥の列・手前の列の木を互い違いに、その手前に植え込み。建物・見晴らし台・高台の石垣の前は手前の列を置かない"""
    out = []
    # 手前の列・植え込みを置かない y の範囲（西・東）
    # 2026-10-29：東の道・商店街のはしは花壇で終わるので、東の手前の列は道のはしでも置く（前は道の幅だけ空けていて、道が林の中へ入って見えた）
    skip = {'w': [(1640, 1900), (1880, 2070)], 'e': []}
    for side in ('w', 'e'):
        def X(v: float) -> float:
            return v if side == 'w' else W - v
        # 小川が林の下へ流れていく所（岸のあいだ）には置かない
        sy = stream_y(X(200))
        skip[side].append((sy - STREAM_W / 2 - 60, sy + STREAM_W / 2 + 90))
        for i, y in enumerate(range(540, 6470, 170)):
            yy = y + rng.randint(-20, 20)
            if not (1880 <= yy <= 2070 and side == 'w') and not (skip[side][-1][0] <= yy <= skip[side][-1][1]):
                out.append(('conifer_e' if (i + (side == 'e')) % 2 else 'tree_e', X(95), yy))
            fy = y + 85 + rng.randint(-15, 15)
            if fy < 6460 and not any(a <= fy <= b for a, b in skip[side]):
                out.append(('tree_e' if (i + (side == 'e')) % 2 else 'conifer_e', X(245 + rng.randint(-20, 20)), fy))
            by_ = y + 140 + rng.randint(-10, 10)
            if by_ < 6460 and not any(a <= by_ <= b for a, b in skip[side]):
                out.append((rng.choice(['bush_e', 'bush_small', 'bush_e']), X(330 + rng.randint(-15, 15)), by_))
    # 西の高台の石垣のはしを隠す木
    out.append(('tree_e', 250, 2110))
    out.append(('bush_e', 380, 2130))
    return out


# ───────────── 建物の影（seimon_world_build の building_shadow と同じ形。単位を K 倍） ─────────────
def building_shadow(base: Image.Image, part: Image.Image, xy: tuple[int, int]) -> None:
    al = part.getchannel('A').point(lambda v: 130 if v > 60 else 0)
    sh = al.filter(ImageFilter.GaussianBlur(22 * K))
    base.paste(Image.new('RGBA', part.size, (28, 34, 20, 255)), (xy[0] + P(46), xy[1] + P(30)), sh)
    a = np.array(al) > 0
    foot = np.zeros_like(a)
    for x in np.where(a.any(axis=0))[0]:
        y = np.where(a[:, x])[0].max()
        foot[max(0, y - P(6)):min(a.shape[0], y + P(22)), x] = True
    fm = Image.fromarray((foot * 150).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10 * K))
    base.paste(Image.new('RGBA', part.size, (20, 24, 14, 255)), xy, fm)


def soft_shadow(base: Image.Image, part: Image.Image, xy: tuple[int, int], dx=14, dy=8, blur=8, alpha=70) -> None:
    sh = part.getchannel('A').point(lambda v: alpha if v > 60 else 0).filter(ImageFilter.GaussianBlur(blur * K))
    base.paste(Image.new('RGBA', part.size, (30, 40, 22, 255)), (xy[0] + P(dx), xy[1] + P(dy)), sh)


# ───────────── 組み立て ─────────────
class Town:
    def __init__(self, shade):
        self.shade = shade
        self.size = (P(W), P(H))
        self.cols, self.rows = W // CELL, H // CELL
        self.block = np.zeros((self.rows, self.cols), bool)      # 歩けない
        self.paved = np.zeros((self.rows, self.cols), bool)      # 石畳（足音）
        self.sprites: list[dict] = []
        self.saved: dict[str, str] = {}
        self.doors: dict[str, dict] = {}
        self.door_cols: dict[str, tuple[int, int, int]] = {}
        self.extra: dict = {}

    # マスの中心（単位）
    def cell_centers(self):
        xs = (np.arange(self.cols) + 0.5) * CELL
        ys = (np.arange(self.rows) + 0.5) * CELL
        return xs, ys

    def block_rect(self, x1, y1, x2, y2, value=True) -> None:
        xs, ys = self.cell_centers()
        cx = (xs >= x1) & (xs < x2)
        cy = (ys >= y1) & (ys < y2)
        self.block[np.ix_(cy, cx)] = value

    def block_alpha(self, im: Image.Image, x: float, y: float, s_units: float, y_from: float, y_to: float, keep=None) -> None:
        """絵（書き出しの px の絵。左上 x,y 単位・1px = s_units 単位）の透明でない所のうち、y_from〜y_to（単位）のマスをふさぐ"""
        a = np.array(im.getchannel('A')) > 100
        xs, ys = self.cell_centers()
        for r in np.where((ys >= max(y_from, y)) & (ys < min(y_to, y + im.height * s_units)))[0]:
            py = int((ys[r] - y) / s_units)
            for c in np.where((xs >= x) & (xs < x + im.width * s_units))[0]:
                px = int((xs[c] - x) / s_units)
                # マスの中ほど（3×3 の点）のどこかが絵なら、ふさぐ
                if a[max(0, py - 4):py + 5, max(0, px - 4):px + 5].any():
                    if keep is None or not keep(c, r):
                        self.block[r, c] = True

    def save_sprite(self, im: Image.Image, name: str) -> str:
        """書き出しの px の絵を保存（同じ名前は1回だけ）"""
        if name not in self.saved:
            os.makedirs(OUT_TOWN, exist_ok=True)
            im.save(os.path.join(OUT_TOWN, f't2_{name}.webp'), quality=SPRITE_Q, method=6)
            self.saved[name] = f'maps/town/t2_{name}.webp'
        return self.saved[name]

    def add_sprite(self, im: Image.Image, name: str, x: float, y: float, z: float) -> dict:
        """im：書き出しの px（1px = 1/K 単位）。x,y：左上（単位）。z：前後を比べる足元の y（単位）"""
        s = dict(file=self.save_sprite(im, name), x=round(x), y=round(y), w=round(im.width / K), h=round(im.height / K), z=round(z))
        self.sprites.append(s)
        return s


def build_town(shade_building, check_dir: str | None = None) -> dict:
    rng = random.Random(20261028)
    t = Town(shade_building)
    size = t.size
    base = tiled(sheet('tile_grass'), size, 0.5)
    # 草地の色のむら（同じ模様のくり返しを目立たなくする）
    g = np.array(base).astype(np.float32)
    big = noise(size, 16, 7)
    g[..., :3] *= (1 + 0.07 * big)[..., None]
    base = Image.fromarray(np.clip(g, 0, 255).astype(np.uint8))
    # 高台の上の草は少しだけ明るく（一段高い所に見えるように）
    terr = mask_rects(size, [TERRACE_W, TERRACE_N])
    bright = Image.fromarray(np.clip(np.array(base).astype(np.float32) * np.array([1.06, 1.06, 1.03, 1]), 0, 255).astype(np.uint8))
    base.paste(bright, (0, 0), terr)

    # ── 道・広場 ──
    # 石の橋の下（デッキの北の端 〜 小川の南の岸）も道。小川を描いたあとで塗る（橋の柱の間に見える）
    bridge_gap = (2944, 4880, 3456, 5660)
    rects = STREETS + door_paths()
    streets = mask_rects(size, rects)
    gap_mask = mask_rects(size, [bridge_gap])
    plaza = mask_rects(size, [], (PLAZA['cx'], PLAZA['cy'], PLAZA['r']))
    paved = Image.fromarray(np.maximum.reduce([np.array(streets), np.array(plaza), np.array(gap_mask)]))
    # 道のまわりの草に落ちる陰
    outer = paved.filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.GaussianBlur(10))
    base.paste(Image.new('RGBA', size, (24, 40, 18, 255)), (0, 0), outer.point(lambda v: int(v * 0.22)))
    # 縁石（edges_curb）：道の辺の向きに合わせて横・縦の石を並べる（道の下に描き、はみ出しは道で隠れる）
    draw_curbs(base, rects, [bridge_gap])
    street_tex = tiled(sheet('tile_street'), size, 0.45)
    plaza_tex = tiled(sheet('tile_plaza'), size, 0.45)
    # 石畳：ふちに近いほど少し暗く（へこみの陰）
    small = paved.resize((size[0] // 4, size[1] // 4), Image.BILINEAR)
    dist = ndimage.distance_transform_edt(np.array(small) > 127) * 4
    dist = np.array(Image.fromarray(dist.astype(np.float32)).resize(size, Image.BILINEAR))
    shade = (1 - 0.16 * np.exp(-dist / 18))[..., None]
    st = np.array(street_tex).astype(np.float32)
    st[..., :3] *= shade
    st_img = Image.fromarray(st.astype(np.uint8))
    pl = np.array(plaza_tex).astype(np.float32)
    pl[..., :3] *= shade
    base.paste(st_img, (0, 0), streets.filter(ImageFilter.GaussianBlur(0.8)))
    base.paste(Image.fromarray(pl.astype(np.uint8)), (0, 0), plaza.filter(ImageFilter.GaussianBlur(0.8)))
    xs, ys = t.cell_centers()
    for (x1, y1, x2, y2) in rects:
        t.paved[np.ix_((ys >= y1) & (ys < y2), (xs >= x1) & (xs < x2))] = True
    t.paved |= ((xs[None, :] - PLAZA['cx']) ** 2 + (ys[:, None] - PLAZA['cy']) ** 2) <= PLAZA['r'] ** 2
    # 道の飾り（マンホール・排水口。地面に描く）
    for name, ux, uy in [('manhole', 3200, 2280), ('drain', 4300, 3220), ('drain', 2500, 3220), ('manhole', 3200, 4560), ('manhole', 3200, 5980)]:
        src, box, s = PROP_PARTS[name]
        im = resize(cut(src, box), s * K)
        base.alpha_composite(im, (P(ux) - im.width // 2, P(uy) - im.height // 2))

    # ── 草むら・花（decal_grass。人よりいつも奥） ──
    decals = [resize(cut('decal_grass', b), 0.42 * K) for b in [
        (62, 13, 564, 255), (587, 40, 947, 254), (975, 69, 1239, 241), (1274, 102, 1479, 229), (97, 249, 538, 444),
        (628, 262, 983, 443), (1116, 281, 1368, 422), (49, 426, 478, 627), (534, 444, 847, 624), (940, 448, 1186, 615),
        (1259, 457, 1491, 606), (52, 618, 598, 843), (657, 628, 1076, 837), (1137, 626, 1478, 826), (88, 831, 494, 998),
        (648, 849, 919, 994), (1159, 863, 1381, 988)]]
    no_decal = ndimage.binary_dilation(np.array(paved.resize((size[0] // 8, size[1] // 8))) > 0, iterations=3)
    for gy in range(200, H - 200, DECAL_STEP):
        for gx in range(180, W - 180, DECAL_STEP):
            x, y = gx + rng.randint(-60, 60), gy + rng.randint(-50, 50)
            if rng.random() < 0.55:
                continue
            im = rng.choice(decals)
            if rng.random() < 0.5:
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            px, py = P(x) - im.width // 2, P(y) - im.height
            if no_decal[max(0, py) // 8:(py + im.height) // 8 + 1, max(0, px) // 8:(px + im.width) // 8 + 1].any():
                continue
            base.alpha_composite(im, (px, py))

    # ── 小川（18）：水の面・岸の石・はす ──
    water_src = cut('stream_parts', (17, 105, 877, 963))
    water_src = water_src.crop((8, 8, water_src.width - 8, water_src.height - 8))
    water = tiled(water_src, size, 0.42, mirror=True)
    sm = stream_mask(size)
    base.paste(water, (0, 0), sm.filter(ImageFilter.GaussianBlur(1)))
    bank = cut('stream_parts', (892, 127, 1502, 424))
    bank = resize(bank, 0.34 * K)
    cap = bank.crop((0, 0, bank.width, round(bank.height * 0.42)))
    # 縦の岸：石のふち（cap）を 90 度まわして縦に並べる（上から見たふちなので向きを変えても形が合う）。
    # 南の岸の cap は上の辺が水の側なので、西の岸は時計まわり（上の辺が右＝水の側）、東の岸は反時計まわり
    vcap_w = cap.rotate(-90, expand=True)
    vcap_e = cap.rotate(90, expand=True)
    hw = STREAM_W / 2

    def h_run(x1: float, x2: float, y: float, north: bool) -> None:
        """横の岸：x1〜x2（単位）。北の岸は石の壁の面（水の上に見える）、南の岸は石のふちだけ。はしは切ってそろえる"""
        im = bank if north else cap
        yy = P(y) - P(14) if north else P(y) - cap.height + P(10)
        x = P(x1)
        while x < P(x2):
            base.alpha_composite(im.crop((0, 0, min(im.width, P(x2) - x), im.height)), (x, yy))
            x += im.width - P(14)

    def v_run(y1: float, y2: float, x: float, west_bank: bool) -> None:
        """縦の岸：y1〜y2（単位）。x は水のふち。石のふちは南の岸と同じく、ほとんど水の側に置く"""
        im = vcap_w if west_bank else vcap_e
        xx = P(x) - P(10) if west_bank else P(x) - im.width + P(10)
        y = P(y1)
        while y < P(y2):
            base.alpha_composite(im.crop((0, 0, im.width, min(im.height, P(y2) - y))), (xx, y))
            y += im.height - P(14)

    pts = STREAM
    for i, ((x1, y1), (x2, y2)) in enumerate(zip(pts, pts[1:])):
        prev = pts[i - 1] if i > 0 else None
        nxt = pts[i + 2] if i + 2 < len(pts) else None
        if y1 == y2:
            # 横の区間：曲がり角では、外側の岸は角までのばし、内側の岸は縦の区間の岸の所で止める
            a, b = min(x1, x2), max(x1, x2)
            turn_down = nxt is not None and nxt[1] > y2
            came_down = prev is not None and prev[1] < y1
            n1, n2 = a - (hw if came_down else 0), b + (hw if turn_down else 0)
            s1, s2 = a + (hw if came_down else 0), b - (hw if turn_down else 0)
            if prev is None:
                n1 = s1 = a
            if nxt is None:
                n2 = s2 = b
            h_run(n1 if not came_down else a + hw, n2, y1 - hw, True)
            h_run(s1 if not came_down else a - hw, s2, y1 + hw, False)
        else:
            # 縦の区間（上から下へ）：西の岸は上の区間の南の岸から、東の岸は上の区間の北の岸から、下の区間の北の岸まで
            a, b = min(y1, y2), max(y1, y2)
            v_run(a + hw, b + hw, x1 - hw, True)
            v_run(a - hw, b - hw, x1 + hw, False)
    pads = [cut('stream_parts', b) for b in [(910, 736, 1151, 939), (1174, 778, 1358, 930), (1385, 811, 1518, 922)]]
    for ux in (700, 1150, 2250, 3900, 4700, 5300, 5900):
        im = resize(rng.choice(pads), 0.4 * K)
        base.alpha_composite(im, (P(ux) - im.width // 2, P(stream_y(ux) + rng.randint(-20, 40)) - im.height // 2))
    sblock = np.array(stream_mask(size, 60).resize((t.cols, t.rows), Image.BILINEAR)) > 40
    t.block |= sblock
    # 石の橋の下の道（小川の上に塗る。左右は橋の柱で隠れる）
    base.paste(st_img, (0, 0), gap_mask)

    # ── 石の橋（19）・木の橋（24） ──
    br, (box_, boy_) = cut_at('bridges', (629, 14, 1535, 954))
    # デッキの南の端より下は、左右の柱だけ残す（アーチの面と、その下の水は使わない）
    ba = np.array(br)
    ba[BRIDGE_DECK_S - boy_:, BRIDGE_PILLARS[0] - box_:BRIDGE_PILLARS[1] - box_, 3] = 0
    br = Image.fromarray(ba)
    s = BRIDGE_STONE['s']
    bim = resize(br, s * K)
    # アーチの下の端（シートの y 905）を小川の下の岸に合わせる。橋の板（シートの x 880〜1260）を道の真ん中に
    by = stream_y(BRIDGE_STONE['cx']) + STREAM_W / 2 - (905 - boy_) * s
    bx = BRIDGE_STONE['cx'] - (1070 - box_) * s
    soft_shadow(base, bim, (P(bx), P(by)), 18, 10, 10, 60)
    base.alpha_composite(bim, (P(bx), P(by)))
    deck_top, deck_bot = by + (200 - boy_) * s, by + br.height * s
    t.block_rect(bx, by + 80 * s, bx + br.width * s, deck_bot)
    t.block_rect(BRIDGE_STONE['cx'] - 150, by, BRIDGE_STONE['cx'] + 150, deck_bot + 40, False)
    t.paved[np.ix_((ys >= deck_top) & (ys < deck_bot), (xs >= BRIDGE_STONE['cx'] - 150) & (xs < BRIDGE_STONE['cx'] + 150))] = True
    t.extra['bridge_stone'] = (bx, by, deck_top, deck_bot)
    wb = deskew(cut('bridges', (42, 379, 572, 951)), WOOD_DESKEW)
    s = BRIDGE_WOOD['s']
    wim = resize(wb, s * K)
    wx, wy = BRIDGE_WOOD['cx'] - wb.width * s / 2, BRIDGE_WOOD['top']
    soft_shadow(base, wim, (P(wx), P(wy)), 14, 8, 8, 60)
    base.alpha_composite(wim, (P(wx), P(wy)))
    t.block_rect(wx, wy + 40, wx + wb.width * s, wy + wb.height * s)
    t.block_rect(BRIDGE_WOOD['cx'] - 64, wy, BRIDGE_WOOD['cx'] + 64, wy + wb.height * s + 30, False)

    # ── 高台（1・3 の段）：石の壁（terrace_parts）と階段 ──
    wall = cut('terrace_parts', (40, 39, 630, 353))
    ws = TERRACE_FACE / (wall.height * 0.86)
    wall = resize(wall, ws * K)
    big_stairs = cut('terrace_parts', (66, 594, 900, 1012))
    small_stairs = cut('terrace_parts', (1037, 666, 1431, 1011))
    sn = resize(big_stairs, STAIRS_N['s'] * K)
    sw = resize(small_stairs, STAIRS_W['s'] * K)
    sn_x = STAIRS_N['cx'] - big_stairs.width * STAIRS_N['s'] / 2
    sw_x = STAIRS_W['cx'] - small_stairs.width * STAIRS_W['s'] / 2

    def face(x1: float, x2: float, top: float, gaps: list[tuple[float, float]]) -> None:
        stepw = wall.width - P(30)
        x = P(x1) - P(20)
        # 2026-10-29：右のはしは x2 で切る（前は最後の石が高台の外まではみ出し、その前に立つ木の幹が石垣の手前に見えた）
        right = P(x2) + P(20)
        while x < P(x2) - P(10):
            ux1, ux2 = x / K, (x + wall.width) / K
            if not any(ux2 > g1 + 30 and ux1 < g2 - 30 for g1, g2 in gaps):
                base.alpha_composite(wall.crop((0, 0, min(wall.width, right - x), wall.height)), (x, P(top) - round(wall.height * 0.14)))
            x += stepw
        # 壁のすき間（階段のわき）は壁を詰めて置く。2026-10-29 iPhone の試遊「石垣が角ですき間（草が見える）」：
        # 階段は下ほど広がる形なので、石垣を階段の上の柱の内側（STAIR_TUCK）まで差しこむ（はみ出しは階段の絵で隠れる）
        for g1, g2 in gaps:
            for gx in (g1 - wall.width / K + STAIR_TUCK, g2 - STAIR_TUCK):
                if x1 - 20 <= gx and P(gx) < right:
                    base.alpha_composite(wall.crop((0, 0, min(wall.width, right - P(gx)), wall.height)), (P(gx), P(top) - round(wall.height * 0.14)))

    # 縦の辺（東向き・西向きの壁）：壁の上の石（rail）を縦にして細い帯に
    rail = cut('terrace_parts', (55, 408, 762, 556))
    bar = rail.crop((round(rail.width * 0.18), 0, round(rail.width * 0.82), rail.height)).rotate(90, expand=True)
    bar = bar.resize((P(64), max(1, round(bar.height * P(64) / bar.width))), Image.LANCZOS)

    def side(x: float, y1: float, y2: float) -> None:
        y = P(y1)
        while y < P(y2):
            piece = bar.crop((0, 0, bar.width, min(bar.height, P(y2) - y)))
            base.alpha_composite(piece, (P(x) - bar.width // 2, y))
            y += bar.height - P(6)

    tw, tn = TERRACE_W, TERRACE_N
    side(tn[2], tn[1], tn[3])
    # 2026-10-29 iPhone の試遊「高台の階段の横の壁の端に細い白い切れはし」：西の高台の東のふち（上の段の石垣の下〜西の石垣）の縦の帯は描かない。
    # つなぎ目は植え込み（PROPS の bush_big 2215,1905）で隠す。当たりは今までどおり
    # 西の高台の石垣は林のへりの手前で止める（はしは林の木で隠れる）
    face(FOREST_W - 60, tw[2], tw[3], [(sw_x, sw_x + small_stairs.width * STAIRS_W['s'])])
    face(tn[0], tn[2], tn[3], [(sn_x, sn_x + big_stairs.width * STAIRS_N['s'])])
    base.alpha_composite(sn, (P(sn_x), P(STAIRS_N['top'])))
    base.alpha_composite(sw, (P(sw_x), P(STAIRS_W['top'])))
    # 当たり：壁の面と縦の辺。階段の段の所だけ通れる
    t.block_rect(tw[0], tw[3] - 20, tw[2] + 40, tw[3] + TERRACE_FACE)
    t.block_rect(tn[0], tn[3] - 20, tn[2], tn[3] + TERRACE_FACE)
    t.block_rect(tn[2] - 30, tn[1], tn[2] + 40, tn[3] + TERRACE_FACE)
    t.block_rect(tw[2] - 30, tn[3], tw[2] + 40, tw[3] + TERRACE_FACE)
    t.block_rect(STAIRS_N['cx'] - 240, STAIRS_N['top'], STAIRS_N['cx'] + 240, STAIRS_N['top'] + big_stairs.height * STAIRS_N['s'] + 10, False)
    t.block_rect(STAIRS_W['cx'] - 90, STAIRS_W['top'], STAIRS_W['cx'] + 90, STAIRS_W['top'] + small_stairs.height * STAIRS_W['s'] + 10, False)
    # 階段の手すり（左右の柱）は通れない
    for cxs, half, top, hgt in ((STAIRS_N['cx'], 375, STAIRS_N['top'], big_stairs.height * STAIRS_N['s']),
                                (STAIRS_W['cx'], 178, STAIRS_W['top'], small_stairs.height * STAIRS_W['s'])):
        t.block_rect(cxs - half, top, cxs - half + (half - 240 if half > 200 else half - 90), top + hgt + 10)
        t.block_rect(cxs + (240 if half > 200 else 90), top, cxs + half, top + hgt + 10)
    t.paved[np.ix_((ys >= STAIRS_N['top']) & (ys < STAIRS_N['top'] + 380), (xs >= 2950) & (xs < 3450))] = True

    # ── 街のまわりの塀（wall_gate）・南の門（14） ──
    gate_full = sheet('wall_gate')
    seg = _trim(gate_full.crop((11, 560, 408, 931)))
    tower = cut('wall_gate', (1146, 436, 1529, 947))
    gate, (gox, goy) = _trim_at(gate_full.crop((408, 98, 1134, 931)), (408, 98))
    seg_s = 300 / seg.height
    seg_k = resize(seg, seg_s * K)
    stepw = seg_k.width - P(36)
    for x in range(-P(30), size[0], stepw):
        base.alpha_composite(seg_k, (x, P(WALL_N_BASE) - seg_k.height))
    # 東西のはしは塀をやめて林のへり（下の「林のへり」。2026-10-28 ユーザー）。北と南の塀の両はしに塔
    tower_k = resize(tower, 0.62 * K)
    for tx, ty in [(WALL_SIDE / 2, WALL_N_BASE + 40), (W - WALL_SIDE / 2, WALL_N_BASE + 40)]:
        base.alpha_composite(tower_k, (P(tx) - tower_k.width // 2, P(ty) - tower_k.height))
    gs = 300 / (850 - 545)                     # 門の扉の高さ 300 単位
    gate_x = GATE_CX - (768 - gox) * gs        # 扉の中心（シートの x 768）
    gate_y = H - 10 - (850 - goy) * gs         # 扉の下の端を街の下の端に（門の前の段は街の外）
    gate_k = resize(gate, gs * K)
    gate_k = gate_k.crop((0, 0, gate_k.width, min(gate_k.height, P(H - gate_y))))
    for x in range(-P(30), size[0], stepw):
        ux1 = x / K
        if ux1 + seg_k.width / K < gate_x + 80 or ux1 > gate_x + gate.width * gs - 80:
            base.alpha_composite(seg_k, (x, size[1] - seg_k.height))
    # 2026-10-29 iPhone の試遊「南の門の横にすき間があり、草の上を通れる」：門の両わきの塔まで塀をのばす（はしは門の絵の下に隠れる）
    gl, gr = gate_x + GATE_TUCK, gate_x + gate.width * gs - GATE_TUCK
    base.alpha_composite(seg_k, (P(gl) - seg_k.width, size[1] - seg_k.height))
    base.alpha_composite(seg_k, (P(gr), size[1] - seg_k.height))
    for tx in (WALL_SIDE / 2, W - WALL_SIDE / 2):
        base.alpha_composite(tower_k, (P(tx) - tower_k.width // 2, size[1] - tower_k.height))
    soft_shadow(base, gate_k, (P(gate_x), P(gate_y)), 16, 6, 8, 50)
    gate_door = (GATE_CX - 110, GATE_CX + 110)
    t.add_sprite(gate_k, 'gate', gate_x, gate_y, WALL_S_TOP + 10)
    t.block_rect(0, 0, W, WALL_N_BASE + 10)
    t.block_rect(0, 0, FOREST_W, H)
    t.block_rect(W - FOREST_W, 0, W, H)
    t.block_rect(0, WALL_S_TOP + 20, W, H)
    # 出口：門の真ん中のとがった屋根（シートの y 318）の手前。人が門の絵に隠れる前に、ダンジョンを選ぶ画面へ
    gate_exit_y = gate_y + (318 - goy) * gs - 40
    t.block_rect(gate_x, gate_exit_y + 20, gate_x + gate.width * gs, H)
    t.extra['gate'] = (gate_door, gate_exit_y)

    # ── 建物 ──
    xs, ys = t.cell_centers()
    for b in sorted(BUILDINGS, key=lambda b: b['at'][1]):
        im, (ox, oy) = cut_at(b['file'])
        dcx, dtop, dbot = b['door']
        s = b['door_h'] / (dbot - dtop)
        part = t.shade(resize(im, s * K))
        x = b['at'][0] - (dcx - ox) * s
        y = b['at'][1] - (dbot - oy) * s
        building_shadow(base, part, (P(x), P(y)))
        z = b['at'][1]
        t.add_sprite(part, b['id'].lower(), x, y, z)
        # 当たり：建物の下の方（敷居から上へ奥行きぶん）。扉の真ん中の列だけ、敷居まで通れる
        depth = 0.42 * part.height / K
        half = b['door_w'] / 2
        door_c = [c for c in range(t.cols) if b['at'][0] - half <= xs[c] <= b['at'][0] + half] if b['door_w'] else []
        t.block_alpha(part, x, y, 1 / K, z - depth, y + part.height / K + 1)
        if door_c:
            r0 = int((z - 1) // CELL)                # 扉のマス（敷居のすぐ上の行）
            for r in range(r0, t.rows):
                if ys[r] > y + part.height / K + 40:
                    break
                for c in door_c:
                    t.block[r, c] = False
            t.door_cols[b['id']] = (door_c[0], len(door_c), r0)
            for c in door_c:
                t.block[r0 - 1, c] = True
            t.doors[b['id']] = dict(x=door_c[0], y=r0, w=len(door_c), h=1,
                                    back=dict(x=(door_c[0] + door_c[-1] + 1) // 2, y=r0 + 1),
                                    label=dict(x=round(b['at'][0]), y=round(y + 40)))
        if b['id'] == 'SHOP':
            t.extra['shop'] = (s, x, y, ox, oy, part.size, z, im.size)

    # カードショップの自動ドア（扉の絵を、建物と同じ色・陰・拡大率で。入口の範囲で切り抜く）
    s, x0, y0, ox, oy, psize, z, isize = t.extra['shop']
    full = sheet('cardshop_building_open')
    bb = (ox, oy, ox + isize[0], oy + isize[1])

    def leaf(key: str) -> dict:
        canvas = Image.new('RGBA', full.size)
        lx, ly = SHOP_DOORS[key]
        canvas.alpha_composite(sheet(f'cardshop_door_{key}'), (lx, ly))
        c = t.shade(resize(canvas.crop(bb), s * K).resize(psize, Image.LANCZOS))
        lw, lh = sheet(f'cardshop_door_{key}').size
        box = (P((lx - ox) * s), P((ly - oy) * s), P((lx + lw - ox) * s), P((ly + lh - oy) * s))
        piece = c.crop(box)
        f = t.save_sprite(piece, f'shop_door_{key}')
        return dict(file=f, x=round(x0 + box[0] / K), y=round(y0 + box[1] / K), w=round(piece.width / K), h=round(piece.height / K))

    cx_, cy_, cw_, ch_ = SHOP_DOORS['clip']
    dc = t.doors['SHOP']
    shop_anim = dict(
        id='SHOP',
        clip=dict(x=round(x0 + (cx_ - ox) * s), y=round(y0 + (cy_ - oy) * s), w=round(cw_ * s), h=round(ch_ * s)),
        left=leaf('left'), right=leaf('right'), travel=round(SHOP_DOORS['travel'] * s), z=z + 1,
        near=dict(x=dc['x'] - 1, y=dc['y'], w=dc['w'] + 2, h=5),
    )

    # ── 噴水（13）：台・水・しぶき3コマ ──
    fbase, (fbx, fby) = cut_at('fountain_layers', (20, 200, 627, 930), raw=True)
    fwater = cut('fountain_layers', (627, 560, 1104, 845), raw=True)
    sprays = [cut('fountain_layers', b) for b in [(1096, 48, 1508, 359), (1095, 348, 1507, 653), (1095, 664, 1503, 970)]]
    fs = 860 / fbase.width
    comp = fbase.copy()
    # 水の輪を水盤に重ね（輪の中心＝シートの FOUNTAIN_WATER）、輪の穴より上の柱をもう一度上に描く（水が柱の前を通らない）
    wcx, wcy = FOUNTAIN_WATER
    comp.alpha_composite(fwater, (wcx - fwater.width // 2 - fbx, wcy - fwater.height // 2 - fby))
    pm = Image.new('L', fbase.size, 0)
    ImageDraw.Draw(pm).polygon([(p[0] - fbx, p[1] - fby) for p in FOUNTAIN_PILLAR], fill=255)
    comp.paste(fbase, (0, 0), Image.fromarray(np.minimum(np.array(pm), np.array(fbase.getchannel('A')))))
    fpart = resize(comp, fs * K)
    fx, fy = PLAZA['cx'] - (wcx - fbx) * fs, PLAZA['cy'] - (wcy - fby) * fs
    soft_shadow(base, fpart, (P(fx), P(fy)), 14, 10, 10, 70)
    fz = fy + (wcy - fby) * fs
    t.add_sprite(fpart, 'fountain', fx, fy, fz)
    t.block_alpha(fpart, fx, fy, 1 / K, fy + (wcy - 150 - fby) * fs, fy + fpart.height / K)
    # しぶき：柱のてっぺんの皿（シートの FOUNTAIN_SPRAY_FOOT）に、しぶきの下の端を合わせる
    frames = []
    sw_ = max(p.width for p in sprays)
    sh_ = max(p.height for p in sprays)
    # 水盤の水の色（輪の絵の見えている所の平均）
    wa = np.array(fwater).astype(np.float32)
    wcol = wa[..., :3][wa[..., 3] > 200].mean(axis=0)
    for i, p in enumerate(sprays):
        c = Image.new('RGBA', (sw_, sh_))
        c.alpha_composite(p, ((sw_ - p.width) // 2, sh_ - p.height))
        a = np.array(c).astype(np.float32)
        # 明るさは残して、色だけ水盤の水へ寄せる。全体を少し透かす
        lum = a[..., :3].mean(-1, keepdims=True) / 255
        target = np.clip(wcol * (0.55 + 0.9 * lum), 0, 255)
        a[..., :3] = a[..., :3] * (1 - FOUNTAIN_SPRAY_TINT) + target * FOUNTAIN_SPRAY_TINT
        a[..., 3] *= FOUNTAIN_SPRAY_ALPHA
        c = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
        frames.append(t.save_sprite(resize(c, fs * FOUNTAIN_SPRAY_SCALE * K), f'fountain_spray{i + 1}'))
    ss = fs * FOUNTAIN_SPRAY_SCALE
    spx = fx + (FOUNTAIN_SPRAY_FOOT[0] - fbx) * fs - sw_ * ss / 2
    spy = fy + (FOUNTAIN_SPRAY_FOOT[1] - fby) * fs - sh_ * ss
    loops = [dict(frames=frames, x=round(spx), y=round(spy), w=round(sw_ * ss), h=round(sh_ * ss), z=round(fz - 1), ms=FOUNTAIN_SPRAY_MS)]
    fountain_cells = dict(x=int(fx // CELL), y=int((fy + (wcy - 150 - fby) * fs) // CELL),
                          w=int(fpart.width / K // CELL) + 1, h=int((fpart.height / K - (wcy - 150 - fby) * fs) // CELL) + 1)

    # ── 屋台（22） ──
    for i, (box, cxs) in enumerate(STALLS):
        im = resize(cut('stalls', box), STALL_S * K)
        x, y = cxs - im.width / K / 2, STALL_BASE - im.height / K
        soft_shadow(base, im, (P(x), P(y)), 18, 10, 10, 70)
        t.add_sprite(im, f'stall{i + 1}', x, y, STALL_BASE - 20)
        t.block_alpha(im, x, y, 1 / K, STALL_BASE - 150, STALL_BASE + 10)

    # ── 木・小物 ──
    cache: dict[str, Image.Image] = {}
    for name, ux, uy in PROPS + forest_edge(rng):
        if name not in cache:
            src, box, s = PROP_PARTS[name]
            cache[name] = resize(cut(src, box), s * K)
        im = cache[name]
        x, y = ux - im.width / K / 2, uy - im.height / K
        soft_shadow(base, im, (P(x), P(y)), 16 if name.startswith(('tree', 'conifer')) else 10, 8, 9, 70)
        # 街の外にはみ出す所は切る（林のへりの木）
        l, tp = max(0, -P(x)), max(0, -P(y))
        r = min(im.width, P(W) - P(x))
        key = name if (l, tp, r) == (0, 0, im.width) else f'{name}_c{l}_{tp}_{im.width - r}'
        t.add_sprite(im.crop((l, tp, r, im.height)), key, x + l / K, y + tp / K, uy - 10)
        fw, fd = PROP_BLOCK[name]
        t.block_rect(ux - im.width / K * fw / 2, uy - fd, ux + im.width / K * fw / 2, uy + 4)

    check_props(rects)

    # ── 書き出し ──
    os.makedirs(OUT_TOWN, exist_ok=True)
    tiles = []
    tw_, th_ = size[0] // SPLIT_C, size[1] // SPLIT_R
    for r in range(SPLIT_R):
        for c in range(SPLIT_C):
            name = f'town2_r{r}c{c}.webp'
            box = (c * tw_, r * th_, size[0] if c == SPLIT_C - 1 else (c + 1) * tw_, size[1] if r == SPLIT_R - 1 else (r + 1) * th_)
            base.crop(box).convert('RGB').save(os.path.join(OUT_TOWN, name), quality=WEBP_Q, method=6)
            tiles.append(dict(file=f'maps/town/{name}', x=round(box[0] / K), y=round(box[1] / K),
                              w=round((box[2] - box[0]) / K), h=round((box[3] - box[1]) / K)))

    # ── マス目 ──
    grid = []
    for r in range(t.rows):
        grid.append(''.join('#' if t.block[r, c] else ('=' if t.paved[r, c] else ',') for c in range(t.cols)))
    # 南の門（ダンジョンへの出口）：門の扉の前の行
    (g1, g2), gy = t.extra['gate']
    exit_cols = [c for c in range(t.cols) if g1 <= xs[c] <= g2 and grid[int(gy // CELL)][c] != '#']
    door_home = t.doors['PLAYER_HOME']
    town = dict(
        id='town', cols=t.cols, rows=t.rows, width=W, height=H, cell=CELL,
        grid=grid, tiles=tiles, sprites=sorted(t.sprites, key=lambda s: s['z']),
        doors=t.doors, exit=dict(x=exit_cols[0], y=int(gy // CELL), w=len(exit_cols), h=1),
        fountain=fountain_cells, spawn=dict(x=door_home['back']['x'], y=door_home['back']['y'] + 3),
        # 人の立ち位置：足元のマスが下から2つ目になる 1×3 の枠（部屋の *_SPOT と同じ形）
        items={k: dict(x=int(x // CELL), y=int(y // CELL) - 1, w=1, h=3) for k, (x, y) in SPOTS.items()},
        doorAnims=[shop_anim], loops=loops,
    )
    if check_dir:
        write_checks(base, t, town, check_dir)
    return town


def check_props(rects) -> None:
    """小物の置き方の点検（2026-10-29「ベンチや花を雑に置きすぎ」）：道の上にはみ出した物・ほかの小物と重なる物を書き出す（街灯は道のふちに置くので除く）"""
    boxes = []
    for name, ux, uy in PROPS:
        src, box, sc = PROP_PARTS[name]
        w = (box[2] - box[0]) * sc * 0.8
        boxes.append((name, ux, uy, (ux - w / 2, uy - 60, ux + w / 2, uy)))
    cx, cy, r = PLAZA['cx'], PLAZA['cy'], PLAZA['r']
    for name, ux, uy, (x1, y1, x2, y2) in boxes:
        if name.startswith('lamp'):
            continue
        on_road = any(x1 < c and x2 > a and y1 < d and y2 > b for a, b, c, d in rects) or (ux - cx) ** 2 + (uy - cy) ** 2 < r * r
        if on_road:
            print('点検：道の上', name, ux, uy)
    for i, (n1, x, y, b1) in enumerate(boxes):
        for n2, x_, y_, b2 in boxes[i + 1:]:
            if b1[0] < b2[2] and b1[2] > b2[0] and b1[1] < b2[3] and b1[3] > b2[1]:
                print('点検：重なり', n1, x, y, n2, x_, y_)


def write_checks(base: Image.Image, t: Town, town: dict, check_dir: str) -> None:
    """確認用の絵：全体（人より手前の物も重ねる）と、マス目（青＝歩ける・緑＝扉・赤＝門）"""
    os.makedirs(check_dir, exist_ok=True)
    full = base.copy()
    for s in town['sprites']:
        im = Image.open(os.path.join(ROOT, 'assets/images', s['file'])).convert('RGBA')
        full.alpha_composite(im, (P(s['x']), P(s['y'])))
    for lp in town['loops']:
        im = Image.open(os.path.join(ROOT, 'assets/images', lp['frames'][0])).convert('RGBA')
        full.alpha_composite(im, (P(lp['x']), P(lp['y'])))
    for a in town['doorAnims']:
        for k in ('left', 'right'):
            im = Image.open(os.path.join(ROOT, 'assets/images', a[k]['file'])).convert('RGBA')
            full.alpha_composite(im, (P(a[k]['x']), P(a[k]['y'])))
    full.convert('RGB').save(os.path.join(check_dir, 'town2_full.jpg'), quality=90)
    full.convert('RGB').resize((1600, round(1600 * full.height / full.width)), Image.LANCZOS).save(os.path.join(check_dir, 'town2_small.jpg'), quality=88)
    chk = full.copy()
    d = ImageDraw.Draw(chk, 'RGBA')
    c = P(CELL)
    for r, row in enumerate(town['grid']):
        for x, ch in enumerate(row):
            if ch != '#':
                d.rectangle([x * c, r * c, x * c + c - 1, r * c + c - 1], fill=(0, 120, 255, 60) if ch == '=' else (255, 255, 0, 45))
    for dd in town['doors'].values():
        d.rectangle([dd['x'] * c, dd['y'] * c, (dd['x'] + dd['w']) * c, (dd['y'] + 1) * c], fill=(0, 255, 0, 160))
    e = town['exit']
    d.rectangle([e['x'] * c, e['y'] * c, (e['x'] + e['w']) * c, (e['y'] + 1) * c], fill=(255, 0, 0, 160))
    sp = town['spawn']
    d.rectangle([sp['x'] * c, sp['y'] * c, sp['x'] * c + c, sp['y'] * c + c], fill=(255, 0, 255, 200))
    chk.convert('RGB').resize((2400, round(2400 * chk.height / chk.width)), Image.LANCZOS).save(os.path.join(check_dir, 'town2_grid.jpg'), quality=88)
