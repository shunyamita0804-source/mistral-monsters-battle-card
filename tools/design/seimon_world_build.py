# -*- coding: utf-8 -*-
"""正式な街・部屋の部品（ユーザー承認済みの33枚）を設計図どおりに並べ、ゲーム用の絵と当たり判定を作る

使い方:
  python3 tools/design/seimon_world_build.py 部品のフォルダ [確認画像の出力フォルダ]

- 部品のファイル名は docs/design/seimon-town/05_補助資料/02_納品ファイル名一覧 の保存名（town_arena.png など）
- 配置の正本は tools/design/seimon_town_pack.py の TOWN / ROOMS（設計図と同じ座標）
- 出力
  - assets/images/maps/town/town_r{行}c{列}.webp   街の完成図（MAP を 3/4 に縮小し 3×3 に分割。いまは 4032 → 3024）
  - assets/images/maps/rooms/{部屋}_shell.webp      部屋の箱（床と壁）
  - assets/images/maps/rooms/{部屋}_{家具}.webp     家具（1つずつ切り出し。人より奥／手前の重なりをゲームで決める）
  - src/data/worldArt.generated.ts                  マス目（歩ける所）・扉・家具の位置（ゲームが読む）
- 絵は描き直さない。縮小・切り抜き・透明部分のふちの整理・影を付けて並べるだけ
"""
from __future__ import annotations

import json
import os
import random
import shutil
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import seimon_town_pack as pack  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_TOWN = os.path.join(ROOT, 'assets/images/maps/town')
OUT_ROOMS = os.path.join(ROOT, 'assets/images/maps/rooms')
OUT_TS = os.path.join(ROOT, 'src/data/worldArt.generated.ts')

CELL = 32                 # 当たり判定のマス（完成図のピクセル）
MAP = pack.MAP            # 4032（2026-10-22 に 4800 から詰めた）
TOWN_OUT = MAP * 3 // 4   # 街の絵の書き出しの大きさ（ゲームでは MAP×0.5625 論理px で表示＝約1.33倍の細かさ）
TOWN_SPLIT = 3
WEBP_Q = 82

# 建物 ID → 部品のファイル名
BUILDING_FILE = {
    'ARENA': 'town_arena', 'TRAINING': 'town_training', 'HOUSE_A': 'town_house_a', 'HOUSE_B': 'town_house_b',
    'HOUSE_C': 'town_house_c', 'HOUSE_D': 'town_house_d', 'HOUSE_E': 'town_house_e', 'SHOP': 'town_shop',
    'LAB': 'town_lab', 'PLAYER_HOME': 'town_player_home', 'GUIDE_HOME': 'town_guide_home',
}


# ───────────── 部品の読み込み ─────────────
def clean_alpha(im: Image.Image, cut: int = 128) -> Image.Image:
    """透明部分のふちの色にじみを消す：半透明を切り、1px 内側に縮める（絵そのものは変えない）"""
    a = np.array(im.convert('RGBA'))
    al = np.where(a[..., 3] > cut, 255, 0).astype(np.uint8)
    al = np.array(Image.fromarray(al).filter(ImageFilter.MinFilter(3)))
    a[..., 3] = al
    return Image.fromarray(a)


def load_part(parts: str, name: str) -> Image.Image:
    im = clean_alpha(Image.open(f'{parts}/{name}.png'))
    return im.crop(im.getbbox())


def split_sheet(parts: str, name: str, dilate: int = 3, cuts: tuple = ()) -> list[Image.Image]:
    """家具・小物の1枚の絵から、1つずつ切り出す（左上から読む順）
    cuts：くっついて描かれた2つを横の線で分ける (x1, x2, y)。y の行から下を別の物にする"""
    im = Image.open(f'{parts}/{name}.png').convert('RGBA')
    a = np.array(im)[..., 3] > 40
    grown = ndimage.binary_dilation(a, iterations=dilate)
    for x1, x2, y in cuts:
        grown[y - 1, x1:x2] = False
        a[y - 1, x1:x2] = False
    lab, _ = ndimage.label(grown)
    boxes = []
    for i, s in enumerate(ndimage.find_objects(lab)):
        ys, xs = s
        if (a[s] & (lab[s] == i + 1)).sum() < 1500:
            continue
        boxes.append((xs.start, ys.start, xs.stop, ys.stop, i + 1))
    boxes.sort(key=lambda b: (round(((b[1] + b[3]) / 2) / 250), b[0]))
    out = []
    for x1, y1, x2, y2, k in boxes:
        piece = np.array(im.crop((x1, y1, x2, y2)))
        piece[..., 3] = np.where(lab[y1:y2, x1:x2] == k, piece[..., 3], 0)
        p = clean_alpha(Image.fromarray(piece), 96)
        out.append(p.crop(p.getbbox()))
    return out


# ───────────── 街 ─────────────
def tile_texture(tex: Image.Image, size: int, scale: float) -> Image.Image:
    t = tex.convert('RGB').resize((round(tex.width * scale), round(tex.height * scale)), Image.LANCZOS)
    out = Image.new('RGB', (size, size))
    for y in range(0, size, t.height):
        for x in range(0, size, t.width):
            out.paste(t, (x, y))
    return out


def town_walk_mask() -> Image.Image:
    """歩ける所（白）。設計図の長方形＋噴水広場の円。噴水そのものは後で絵の形で抜く"""
    m = Image.new('L', (MAP, MAP), 0)
    d = ImageDraw.Draw(m)
    p = pack.TOWN['plaza']
    cx, cy = p['center']
    d.ellipse([cx - p['r'], cy - p['r'], cx + p['r'], cy + p['r']], fill=255)
    for w in pack.TOWN['walk']:
        r = w['rect']
        d.rectangle([r[0], r[1], r[2] - 1, r[3] - 1], fill=255)
    return m


def place_fountain(parts: str) -> tuple[Image.Image, tuple[int, int]]:
    f = pack.TOWN['fountain']
    part = load_part(parts, 'town_fountain')
    x1, y1, x2, y2 = f['slot']
    s = (x2 - x1) / part.width
    part = part.resize((round(part.width * s), round(part.height * s)), Image.LANCZOS)
    cx, cy = f['center']
    return part, (cx - part.width // 2, cy - part.height // 2)


def place_building(parts: str, b: dict) -> tuple[Image.Image, tuple[int, int]]:
    x1, y1, x2, y2 = b['rect']
    part = load_part(parts, BUILDING_FILE[b['id']])
    s = (x2 - x1) / part.width
    part = part.resize((round(part.width * s), round(part.height * s)), Image.LANCZOS)
    return part, ((x1 + x2) // 2 - part.width // 2, y2 - part.height)


def shadow(base: Image.Image, part: Image.Image, xy: tuple[int, int], dx=18, dy=10, blur=10, alpha=90) -> None:
    sh = part.getchannel('A').point(lambda v: alpha if v > 0 else 0).filter(ImageFilter.GaussianBlur(blur))
    base.paste(Image.new('RGBA', part.size, (40, 50, 30, 255)), (xy[0] + dx, xy[1] + dy), sh)


# ───────────── 建物を立体的に（2026-10-26 ユーザー指示「案B」） ─────────────
# 光は左上から。①右下へ長くのびるやわらかい落ち影、②建物の下の端にそった接地の影、③建物の左上を少し明るく・右と下を少し暗く。
# 絵は描き直さない（影を地面に描くのと、明るさを位置で少し変えるだけ）
def building_shadow(base: Image.Image, part: Image.Image, xy: tuple[int, int]) -> None:
    al = part.getchannel('A')
    sh = al.point(lambda v: 130 if v > 0 else 0).filter(ImageFilter.GaussianBlur(22))
    base.paste(Image.new('RGBA', part.size, (28, 34, 20, 255)), (xy[0] + 46, xy[1] + 30), sh)
    a = np.array(al) > 0
    foot = np.zeros_like(a)
    for x in np.where(a.any(axis=0))[0]:
        y = np.where(a[:, x])[0].max()
        foot[max(0, y - 6):min(a.shape[0], y + 22), x] = True
    fm = Image.fromarray((foot * 150).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))
    base.paste(Image.new('RGBA', part.size, (20, 24, 14, 255)), xy, fm)


def shade_building(part: Image.Image) -> Image.Image:
    """建物に光と陰：左上 ×1.06 → 右 ×0.90、下の45%はさらに最大 ×0.90（形にそって）"""
    arr = np.array(part).astype(np.float32)
    h, w = arr.shape[:2]
    xs = np.linspace(0, 1, w)[None, :]
    ys = np.linspace(0, 1, h)[:, None]
    k = 1.06 - 0.16 * xs - 0.10 * np.clip((ys - 0.55) / 0.45, 0, 1)
    arr[..., :3] = np.clip(arr[..., :3] * k[..., None], 0, 255)
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')


# 噴水広場の輪・会場前の飾り石を使うか（納品された絵が平たい図形で、街の画風に合わないため、いまは使わない）
USE_PLAZA_DECOR = os.environ.get('SEIMON_PLAZA_DECOR') == '1'


def scatter_decals(parts: str, base: Image.Image, paved: np.ndarray) -> None:
    """草地に草むら・小花を散らす（地面の飾り。人より必ず奥なので、どこに置いても前後はおかしくならない）"""
    W = base.width
    grass = fit_size(split_sheet(parts, 'decal_grass', 3), DECAL_REF_SIZE['decal_grass'])
    flowers = fit_size(split_sheet(parts, 'decal_flowers', 3), DECAL_REF_SIZE['decal_flowers']) \
        if os.path.exists(f'{parts}/decal_flowers.png') else []
    # 石畳・土の道・建物の枠には置かない（ふちから少し離す）
    block = ndimage.binary_dilation(paved[::4, ::4], iterations=6)
    for b in pack.TOWN['buildings']:
        x1, y1, x2, y2 = (v // 4 for v in b['rect'])
        block[y1:y2, x1:x2] = True
    rng = random.Random(1022)
    for gy in range(40, W, 120):
        for gx in range(40, W, 120):
            x = gx + rng.randint(-50, 50)
            y = gy + rng.randint(-50, 50)
            if not (0 <= x < W and 0 <= y < W) or block[y // 4, x // 4] or rng.random() < 0.35:
                continue
            src = rng.choice(flowers) if flowers and rng.random() < 0.3 else rng.choice(grass)
            s = rng.uniform(0.7, 1.0)
            im = src.resize((max(1, round(src.width * s)), max(1, round(src.height * s))), Image.LANCZOS)
            if rng.random() < 0.5:
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            px, py = x - im.width // 2, y - im.height
            # はみ出し・石畳への重なりは置かない
            if px < 0 or py < 0 or px + im.width > W or py + im.height > W:
                continue
            if block[py // 4:(py + im.height) // 4 + 1, px // 4:(px + im.width) // 4 + 1].any():
                continue
            base.alpha_composite(im, (px, py))


def place_plaza_decor(parts: str, base: Image.Image) -> None:
    """噴水広場の石の輪と、大会会場の前の飾り石の帯（地面に敷く）"""
    ring = Image.open(f'{parts}/plaza_ring.png').convert('RGBA')
    ring = ring.crop(ring.getbbox())
    size = 1000
    ring = ring.resize((size, size), Image.LANCZOS)
    cx, cy = pack.TOWN['fountain']['center']
    base.alpha_composite(ring, (cx - size // 2, cy - size // 2))
    carpet = Image.open(f'{parts}/plaza_carpet.png').convert('RGBA')
    carpet = carpet.crop(carpet.getbbox())
    w = 220
    carpet = carpet.resize((w, round(carpet.height * w / carpet.width)), Image.LANCZOS)
    top, bottom = 1262, 1800
    y = top
    while y < bottom:
        piece = carpet.crop((0, 0, w, min(carpet.height, bottom - y)))
        base.alpha_composite(piece, (cx - w // 2, y))
        y += piece.height


# 小物（部品の何番目か → 名前と、街での大きさの倍率）
PROPS = {
    'props_trees': [('tree_round', 0.80), ('tree_conifer', 0.80), ('tree_small', 0.80), ('bush', 0.62)],
    'props_flowers': [('flowerbed_long', 0.52), ('planter_round', 0.50), ('flower_pot', 0.45), ('planter_box', 0.48)],
    'props_street': [('lamp', 0.62), ('bench', 0.46), ('flag', 0.62), ('signpost', 0.55)],
    'props_misc': [('barrel', 0.42), ('crates', 0.45), ('fence', 0.50), ('rock', 0.45)],
}

# 2026-10-22 の部品での1つずつの大きさ（幅, 高さ）。描き直しで絵の中の大きさが変わっても、街に置く大きさはこれにそろえる
# （2026-10-23 の大人向けの絵は 1.2〜1.5 倍に描かれていた。面積が同じになるように縮める）
PROP_REF_SIZE = {
    'tree_round': (358, 370), 'tree_conifer': (313, 396), 'tree_small': (223, 308), 'bush': (343, 193),
    'flowerbed_long': (423, 167), 'planter_round': (299, 289), 'flower_pot': (149, 240), 'planter_box': (366, 224),
    'lamp': (104, 356), 'bench': (319, 176), 'flag': (211, 381), 'signpost': (152, 323),
    'barrel': (152, 267), 'crates': (245, 253), 'fence': (425, 303), 'rock': (326, 225),
}
# 草むら・小花の1つずつの大きさの平均（√(幅×高さ)。2026-10-22 の部品）
DECAL_REF_SIZE = {'decal_grass': 100, 'decal_flowers': 118}


def fit_size(pieces: list[Image.Image], ref: float) -> list[Image.Image]:
    """草むら・小花：平均の大きさが ref になるように、まとめて同じ倍率で縮める"""
    if not pieces:
        return pieces
    avg = sum((p.width * p.height) ** 0.5 for p in pieces) / len(pieces)
    k = ref / avg
    return [p.resize((max(1, round(p.width * k)), max(1, round(p.height * k))), Image.LANCZOS) for p in pieces]

# 小物の置き場所（足元の座標＝絵の下辺の中央）。緑地・道のわき・街のまわり。道（歩ける所）には重ねない
# 自動で置くもの（木立・まわりの木）は place_props() で足す
CENTER = pack.CX
PROP_SPOTS = [
    # 東西の通りの南側：街灯（北側は家と道の間がせまく、街灯の背が入らない。道から少し離して芝生に立てる）
    ('lamp', 430, 2330), ('lamp', 1260, 2330), ('lamp', 2700, 2330), ('lamp', 3260, 2330), ('lamp', 3820, 2330),
    # 大会会場の前庭のわき・住宅Dの左：街灯
    ('lamp', 2432, 1600),
    # 噴水広場の外：ベンチ
    ('bench', 1520, 2380), ('bench', 2560, 2420),
    # 大会会場の前庭：旗
    ('flag', 1600, 1380), ('flag', 2430, 1380),
    # 練習場の前
    ('flowerbed_long', 420, 1010), ('flowerbed_long', 1000, 1010),
    # 花壇の小広場（南西）
    ('flowerbed_long', 640, 2200), ('planter_round', 860, 2340), ('flowerbed_long', 1000, 2200), ('bench', 640, 2380),
    ('planter_box', 200, 2380),
    # ショップと研究所の間（木箱）
    ('crates', 920, 3110),
    # 家と家の間の生け垣（南東）
    ('bush', 2976, 2820), ('bush', 2976, 3090),
    # 東の小さな緑地
    ('planter_round', 2980, 2200), ('bench', 3040, 2420), ('planter_round', 3540, 2200),
    # 北東（住宅C のまわり）
    ('flowerbed_long', 2760, 960), ('planter_round', 3700, 980),
    # 草原への出口：標柱と柵
    ('signpost', CENTER - 240, 3760), ('fence', CENTER - 420, 3990), ('fence', CENTER + 420, 3990),
    ('rock', 1400, 3700), ('rock', 3000, 3740), ('barrel', CENTER + 280, 3620),
    ('crates', 3960, 2200), ('rock', 120, 2000),
]


def load_props(parts: str) -> dict[str, Image.Image]:
    out = {}
    # 植え込み（描き直し・2026-10-22 納品）があれば、前の平たい植え込みの代わりに使う
    if os.path.exists(f'{parts}/props_bush_v2.png'):
        pieces = split_sheet(parts, 'props_bush_v2', 3)
        for i, piece in enumerate(pieces[:4]):
            out[f'bush2_{i}'] = piece.resize((round(piece.width * 0.42), round(piece.height * 0.42)), Image.LANCZOS)
    for sheet, items in PROPS.items():
        pieces = split_sheet(parts, sheet, 3)
        assert len(pieces) == len(items), (sheet, len(pieces))
        for piece, (name, scale) in zip(pieces, items):
            rw, rh = PROP_REF_SIZE[name]
            scale *= (rw * rh / (piece.width * piece.height)) ** 0.5
            out[name] = piece.resize((round(piece.width * scale), round(piece.height * scale)), Image.LANCZOS)
    if 'bush2_0' in out:
        out['bush'] = out['bush2_0']
    return out


def noise_field(W: int, cells: int, seed: int) -> np.ndarray:
    """なめらかなむら（-1〜1）。小さな乱数を拡大してぼかす"""
    rng = np.random.default_rng(seed)
    small = Image.fromarray(((rng.random((cells, cells)) * 255)).astype(np.uint8))
    big = np.array(small.resize((W, W), Image.BICUBIC).filter(ImageFilter.GaussianBlur(W / cells / 3))).astype(np.float32)
    return (big - big.mean()) / (big.std() + 1e-6) / 2.2


def vary_grass(img: Image.Image) -> Image.Image:
    """草地の色にむらを付ける（同じ模様のくり返しを目立たなくする。絵の部品は変えない）"""
    W = img.width
    a = np.array(img.convert('RGB')).astype(np.float32)
    big = np.clip(noise_field(W, 14, 7), -1, 1)
    mid = np.clip(noise_field(W, 46, 11), -1, 1)
    light = 1 + 0.10 * big + 0.05 * mid
    a *= light[..., None]
    # 明るい所は少し黄みに、暗い所は少し青みに
    warm = np.clip(big, 0, 1)[..., None] * np.array([10, 6, -6], np.float32)
    cool = np.clip(-big, 0, 1)[..., None] * np.array([-6, 0, 4], np.float32)
    a += warm + cool
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert('RGBA')


def build_town(parts: str, check_dir: str | None):
    W = MAP
    walk = town_walk_mask()
    walk_np = np.array(walk) > 0

    # 地面：草地（色のむら付き）→ 歩ける所は石畳（ふちに縁石と陰）→ 草原への出口は土の道
    base = vary_grass(tile_texture(Image.open(f'{parts}/tex_grass.png'), W, 0.75))
    stone = tile_texture(Image.open(f'{parts}/tex_stone.png'), W, 0.38).convert('RGBA')
    dirt = tile_texture(Image.open(f'{parts}/tex_dirt.png'), W, 0.75).convert('RGBA')
    ex = pack.TOWN['exit']['rect']
    dirt_mask = Image.new('L', (W, W), 0)
    ImageDraw.Draw(dirt_mask).rectangle([ex[0], ex[1], ex[2] - 1, ex[3] - 1], fill=255)
    stone_np = walk_np & ~(np.array(dirt_mask) > 0)
    stone_mask = Image.fromarray(np.where(stone_np, 255, 0).astype(np.uint8))
    # 石畳のまわりの草に落ちる陰（ふちから外へうすく）
    outer = stone_mask.filter(ImageFilter.MaxFilter(41)).filter(ImageFilter.GaussianBlur(14))
    base.paste(Image.new('RGBA', (W, W), (24, 40, 18, 255)), (0, 0), outer.point(lambda v: int(v * 0.28)))
    # 縁石：石畳のふちに一回り大きい、濃い石の帯
    curb = stone_mask.filter(ImageFilter.MaxFilter(15))
    curb_col = np.array(tile_texture(Image.open(f'{parts}/tex_stone.png'), W, 0.25).convert('RGB')).astype(np.float32) * np.array([0.62, 0.58, 0.52])
    base.paste(Image.fromarray(curb_col.astype(np.uint8)).convert('RGBA'), (0, 0), curb.filter(ImageFilter.GaussianBlur(1.2)))
    # 石畳：ふちに近いほど少し暗く（へこみの陰）、中ほどは少し明るく
    small = stone_mask.resize((W // 4, W // 4), Image.BILINEAR)
    dist = ndimage.distance_transform_edt(np.array(small) > 127) * 4
    dist = np.array(Image.fromarray(dist.astype(np.float32)).resize((W, W), Image.BILINEAR))
    shade = 1 - 0.22 * np.exp(-dist / 26) + 0.04 * np.clip((dist - 60) / 200, 0, 1)
    st = np.array(stone.convert('RGB')).astype(np.float32) * shade[..., None]
    stone = Image.fromarray(np.clip(st, 0, 255).astype(np.uint8)).convert('RGBA')
    base.paste(stone, (0, 0), stone_mask.filter(ImageFilter.GaussianBlur(1.0)))
    # 土の道は上（石畳との境）をぼかしてつなぐ
    dm = np.array(dirt_mask).astype(np.float32)
    ramp = np.clip((np.arange(W) - ex[1]) / 120.0, 0, 1)[:, None]
    dm = (dm * ramp).astype(np.uint8)
    base.paste(dirt, (0, 0), Image.fromarray(dm).filter(ImageFilter.GaussianBlur(6)))

    # 品質改善の追加部品（2026-10-22 納品。あるときだけ使う）：草むら・小花の飾り、噴水広場の輪、会場前の飾り石
    if os.path.exists(f'{parts}/decal_grass.png'):
        scatter_decals(parts, base, stone_np | (np.array(dirt_mask) > 0))
    if USE_PLAZA_DECOR and os.path.exists(f'{parts}/plaza_ring.png'):
        place_plaza_decor(parts, base)

    # 噴水（形は絵のとおり。絵の部分は歩けない）
    fountain, fxy = place_fountain(parts)
    shadow(base, fountain, fxy, 10, 8, 8, 70)
    base.alpha_composite(fountain, fxy)
    fountain_block = np.zeros((W, W), bool)
    fa = np.array(fountain.getchannel('A')) > 0
    fountain_block[fxy[1]:fxy[1] + fa.shape[0], fxy[0]:fxy[0] + fa.shape[1]] = fa

    # 小物
    props = load_props(parts)
    prop_list = list(PROP_SPOTS)
    rng = random.Random(20261022)
    # 街のまわりの木（ふち）と北西の木立
    for x in range(60, W, 220):
        prop_list.append((rng.choice(['tree_round', 'tree_conifer']), x + rng.randint(-40, 40), 200 + rng.randint(-30, 30)))
    for y in range(400, W - 200, 260):
        prop_list.append((rng.choice(['tree_round', 'tree_conifer', 'tree_small']), 70 + rng.randint(-20, 20), y))
        prop_list.append((rng.choice(['tree_round', 'tree_conifer', 'tree_small']), W - 70 + rng.randint(-20, 20), y))
    gx1, gy1, gx2, gy2 = next(g['rect'] for g in pack.TOWN['green'] if g['id'] == 'GREEN_NW')
    for y in range(gy1 + 200, gy2 + 1, 170):
        for x in range(gx1 + 60, gx2, 150):
            prop_list.append((rng.choice(['tree_round', 'tree_small', 'tree_conifer']), x + rng.randint(-25, 25), y + rng.randint(-20, 20)))
    for g in ('MEADOW_SW', 'MEADOW_SE'):
        mx1, my1, mx2, my2 = next(z['rect'] for z in pack.TOWN['green'] if z['id'] == g)
        for x in range(mx1 + 120, mx2 - 60, 330):
            prop_list.append((rng.choice(['tree_round', 'tree_small', 'bush']), x + rng.randint(-60, 60), my1 + 160 + rng.randint(-40, 120)))

    # 空いている草地を自然に埋める：道から遠い所は木、近い所は植え込み・花・岩（乱数は固定で毎回同じ並び）
    far = ndimage.distance_transform_edt(~ndimage.zoom(walk_np, 0.125, order=0)) * 8
    for gy in range(140, W, 190):
        for gx in range(80, W, 190):
            x = gx + rng.randint(-70, 70) + (95 if (gy // 190) % 2 else 0)
            y = gy + rng.randint(-60, 60)
            if not (0 < x < W and 0 < y < W) or rng.random() < 0.18:
                continue
            d = far[min(y // 8, far.shape[0] - 1), min(x // 8, far.shape[1] - 1)]
            if d > 420:
                name = rng.choices(['tree_round', 'tree_conifer', 'tree_small'], [5, 3, 3])[0]
            elif d > 220:
                name = rng.choices(['tree_small', 'tree_round', 'bush', 'flowerbed_long'], [5, 2, 1, 1])[0]
            else:
                # 道のそば：植木鉢・花壇（植え込み・岩の部品は平たく見えるので控えめに）
                name = rng.choices(['flower_pot', 'planter_round', 'bush', 'rock'], [3, 3, 1, 0.3])[0]
            if name == 'bush' and 'bush2_3' in props:
                name = rng.choice(['bush2_0', 'bush2_1', 'bush2_2', 'bush2_3'])
            prop_list.append((name, x, y))

    # 建物の枠（小物を重ねない）
    bld_rects = [b['rect'] for b in pack.TOWN['buildings']]
    # 歩ける所から「人の背たけぶん上」まで（人がこの範囲を歩くと、小物の奥／手前が逆に見えるため置かない）
    walk_dil = ndimage.binary_dilation(walk_np, iterations=8)
    placed: list[tuple[Image.Image, tuple[int, int]]] = []
    skipped = []
    occupied = np.zeros((W, W), bool)
    for name, fx, fy in prop_list:
        im = props[name]
        x, y = fx - im.width // 2, fy - im.height
        if x < -im.width // 3 or x + im.width > W + im.width // 3 or y < -im.height // 2 or fy > W:
            continue
        x1c, y1c, x2c, y2c = max(x, 0), max(y, 0), min(x + im.width, W), min(y + im.height, W)
        a = np.array(im.getchannel('A'))[y1c - y:y2c - y, x1c - x:x2c - x] > 0
        if (walk_dil[y1c:y2c, x1c:x2c] & a).any() or (occupied[y1c:y2c, x1c:x2c] & a).any():
            skipped.append((name, fx, fy))
            continue
        if any(not (x2c <= r[0] or x1c >= r[2] or y2c <= r[1] or y1c >= r[3]) for r in bld_rects):
            skipped.append((name, fx, fy))
            continue
        occupied[y1c:y2c, x1c:x2c] |= a
        placed.append((im, (x, y)))
    # 奥（上）から順に描く
    for im, xy in sorted(placed, key=lambda p: p[1][1] + p[0].height):
        shadow(base, im, xy, 10, 6, 6, 60)
        base.alpha_composite(im, xy)

    # 建物（奥から）
    buildings = []
    for b in sorted(pack.TOWN['buildings'], key=lambda b: b['rect'][3]):
        part, xy = place_building(parts, b)
        part = shade_building(part)
        building_shadow(base, part, xy)
        base.alpha_composite(part, xy)
        buildings.append((b, part, xy))

    # 書き出し（3/4 に縮小して 3×3）
    os.makedirs(OUT_TOWN, exist_ok=True)
    small = base.convert('RGB').resize((TOWN_OUT, TOWN_OUT), Image.LANCZOS)
    step = TOWN_OUT // TOWN_SPLIT
    tiles = []
    for r in range(TOWN_SPLIT):
        for c in range(TOWN_SPLIT):
            name = f'town_r{r}c{c}.webp'
            small.crop((c * step, r * step, (c + 1) * step, (r + 1) * step)).save(f'{OUT_TOWN}/{name}', quality=WEBP_Q, method=6)
            u = MAP // TOWN_SPLIT
            tiles.append(dict(file=f'maps/town/{name}', x=c * u, y=r * u, w=u, h=u))

    # ───── マス目 ─────
    cols = rows = MAP // CELL
    grid = [['#'] * cols for _ in range(rows)]
    for ry in range(rows):
        for cx in range(cols):
            px, py = cx * CELL + CELL // 2, ry * CELL + CELL // 2
            if walk_np[py, px] and not fountain_block[py, px]:
                grid[ry][cx] = '='
    # 噴水のまわり：足元が噴水の絵にかかるマスも歩けない（中心だけでなくマスの4すみで見る）
    for ry in range(rows):
        for cx in range(cols):
            if grid[ry][cx] != '=':
                continue
            x0, y0 = cx * CELL, ry * CELL
            if fountain_block[y0 + 4:y0 + CELL - 4, x0 + 4:x0 + CELL - 4].any():
                grid[ry][cx] = '#'

    doors = {}
    for b, part, xy in buildings:
        dx, dy = pack.door_of(b)
        half = b['door_w'] / 2
        door_cols = [cx for cx in range(cols) if dx - half <= cx * CELL + CELL // 2 <= dx + half]
        # 玄関のマス：建物の枠の中の一番下の行（その下が歩ける道）
        r0 = dy // CELL
        door_row = r0 if r0 * CELL + CELL // 2 < dy else r0 - 1
        for cx in door_cols:
            assert grid[door_row + 1][cx] == '=', (b['id'], cx, door_row)
            grid[door_row][cx] = '='
        doors[b['id']] = dict(x=door_cols[0], y=door_row, w=len(door_cols), h=1,
                              back=dict(x=(door_cols[0] + door_cols[-1] + 1) // 2, y=door_row + 1),
                              label=dict(x=(b['rect'][0] + b['rect'][2]) // 2, y=xy[1]))
    # 草原への出口
    tx1, ty1, tx2, ty2 = pack.TOWN['exit']['trigger']
    exit_cols = [cx for cx in range(cols) if tx1 <= cx * CELL + CELL // 2 < tx2 and grid[rows - 1][cx] == '=']
    exit_row = rows - 1
    fx1, fy1 = fxy
    fountain_cells = dict(x=fx1 // CELL, y=fy1 // CELL,
                          w=(fx1 + fountain.width) // CELL - fx1 // CELL + 1,
                          h=(fy1 + fountain.height) // CELL - fy1 // CELL + 1)
    sx, sy = pack.TOWN['spawn']['point']
    town = dict(
        id='town', cols=cols, rows=rows, width=MAP, height=MAP, cell=CELL,
        grid=[''.join(r) for r in grid], tiles=tiles, sprites=[],
        doors=doors, exit=dict(x=exit_cols[0], y=exit_row, w=len(exit_cols), h=1),
        fountain=fountain_cells, spawn=dict(x=sx // CELL, y=sy // CELL),
    )
    if check_dir:
        chk = base.copy()
        d = ImageDraw.Draw(chk, 'RGBA')
        for ry in range(rows):
            for cx in range(cols):
                if grid[ry][cx] == '=':
                    d.rectangle([cx * CELL, ry * CELL, cx * CELL + CELL - 1, ry * CELL + CELL - 1], fill=(0, 120, 255, 50))
        for dd in doors.values():
            d.rectangle([dd['x'] * CELL, dd['y'] * CELL, (dd['x'] + dd['w']) * CELL, (dd['y'] + 1) * CELL], fill=(0, 255, 0, 140))
        chk.convert('RGB').resize((1600, 1600), Image.LANCZOS).save(f'{check_dir}/town_check.jpg', quality=88)
        small.resize((1600, 1600), Image.LANCZOS).save(f'{check_dir}/town_full.jpg', quality=88)
        base.crop((2500, 3000, 4500, 4300)).convert('RGB').save(f'{check_dir}/town_se_1x.jpg', quality=88)
        print('skipped props:', skipped)
    return town


# ───────────── 部屋 ─────────────
# 部屋の箱の絵（1024×1024）の中の床の範囲：奥の壁の下 top、手前の壁の上 bottom、
# 左右の壁（奥 lt/rt・手前 lb/rb）、手前の壁の出入口の左右 door
SHELL = {
    'ROOM_PLAYER': dict(file='room_shell_player', top=300, bottom=938, lt=70, rt=955, lb=25, rb=1000, door=(444, 582)),
    'ROOM_GUIDE': dict(file='room_shell_guide', top=250, bottom=932, lt=50, rt=975, lb=12, rb=1012, door=(444, 582)),
    'ROOM_HOUSE': dict(file='room_shell_house', top=290, bottom=905, lt=95, rt=930, lb=25, rb=1000, door=(416, 608)),
    'ROOM_SHOP': dict(file='room_shell_shop', top=335, bottom=888, lt=95, rt=932, lb=18, rb=1008, door=(414, 612)),
    'ROOM_LAB': dict(file='room_shell_lab', top=340, bottom=905, lt=75, rt=950, lb=22, rb=1002, door=(416, 610)),
    'ROOM_TRAINING': dict(file='room_shell_training', top=318, bottom=932, lt=75, rt=950, lb=22, rb=1002, door=(448, 576)),
    'ROOM_ARENA': dict(file='room_shell_arena', top=330, bottom=850, lt=60, rt=965, lb=40, rb=985, door=(390, 650)),
}

# 家具の部品（部品の何番目か）。分割の広げ幅（大会会場の客席は板が離れているので広く）
FURN = {
    'furn_player': (3, ['bed', 'desk', 'bookshelf', 'wall_map']),
    'furn_common': (3, ['rug', 'plant', 'table', 'shelf']),
    'furn_guide': (3, ['fireplace', 'kitchen', 'round_table', 'flower_stand']),
    'furn_shop': (3, ['shelf_wall', 'pack_machine', 'counter', 'showcase']),
    'furn_lab': (3, ['big_shelf', 'crystal', 'specimen', 'desk', 'shelf2', 'reading_table']),
    'furn_training': (3, ['board', 'table', 'bench', 'shelf']),
    'furn_arena': (12, ['flags', 'stage', 'seats', 'reception']),
}
# くっついて描かれた家具を分ける線（2026-10-23 の大人向けの絵：ベッドの脚と本棚の上がふれている）
FURN_CUTS = {
    'furn_player': ((0, 460, 496),),
}

# 設計図の家具 ID → 使う部品。kind: furniture（床に置く・歩けない）／rug（敷物・歩ける）／wall（壁に掛ける）
ROOM_ITEMS = {
    'ROOM_PLAYER': {'BED': 'furn_player:bed', 'WALL_MAP': 'furn_player:wall_map', 'BOOKSHELF': 'furn_player:bookshelf',
                    'DESK': 'furn_player:desk', 'RUG': 'furn_common:rug', 'PLANT': 'furn_common:plant'},
    'ROOM_GUIDE': {'FIREPLACE': 'furn_guide:fireplace', 'KITCHEN': 'furn_guide:kitchen', 'BOOKSHELF': 'furn_player:bookshelf',
                   'TABLE': 'furn_guide:round_table', 'FLOWER': 'furn_guide:flower_stand'},
    'ROOM_HOUSE': {'SHELF': 'furn_common:shelf', 'PLANT': 'furn_common:plant', 'TABLE': 'furn_common:table'},
    'ROOM_SHOP': {'SHELF_WALL': 'furn_shop:shelf_wall', 'PACK_MACHINE': 'furn_shop:pack_machine', 'COUNTER': 'furn_shop:counter',
                  'CASE_L': 'furn_shop:showcase', 'CASE_R': 'furn_shop:showcase'},
    'ROOM_LAB': {'BIG_SHELF': 'furn_lab:big_shelf', 'CRYSTAL': 'furn_lab:crystal', 'SPECIMEN': 'furn_lab:specimen',
                 'DESK': 'furn_lab:desk', 'SHELF2': 'furn_lab:shelf2', 'TABLE': 'furn_lab:reading_table'},
    'ROOM_TRAINING': {'BOARD': 'furn_training:board', 'SHELF': 'furn_training:shelf', 'TABLE_1': 'furn_training:table',
                      'TABLE_2': 'furn_training:table', 'BENCH_L': 'furn_training:bench', 'BENCH_R': 'furn_training:bench'},
    'ROOM_ARENA': {'FLAGS': 'furn_arena:flags', 'STAGE': 'furn_arena:stage', 'SEATS_L': 'furn_arena:seats',
                   'SEATS_R': 'furn_arena:seats', 'RECEPTION': 'furn_arena:reception'},
}

ROOM_SLUG = {'ROOM_PLAYER': 'player', 'ROOM_GUIDE': 'guide', 'ROOM_HOUSE': 'house', 'ROOM_SHOP': 'shop',
             'ROOM_LAB': 'lab', 'ROOM_TRAINING': 'training', 'ROOM_ARENA': 'arena'}


def load_furniture(parts: str) -> dict[str, Image.Image]:
    out = {}
    for sheet, (dil, names) in FURN.items():
        pieces = split_sheet(parts, sheet, dil, FURN_CUTS.get(sheet, ()))
        assert len(pieces) == len(names), (sheet, len(pieces))
        for p, n in zip(pieces, names):
            out[f'{sheet}:{n}'] = p
    return out


def build_room(parts: str, room: dict, furn: dict[str, Image.Image], check_dir: str | None):
    rid = room['id']
    sh = SHELL[rid]
    W, H = room['size']
    k = W / 1024                       # 部屋の箱の絵 1px → 部屋の単位（設計図と同じ。主人公 108×144）
    top, bottom = sh['top'] * k, sh['bottom'] * k
    wall = pack.ROOM_WALL

    def map_y(by: float) -> float:
        """設計図の y → 部屋の絵の上の y（奥の壁と床をそれぞれ縦に合わせる）"""
        if by <= wall:
            return by / wall * top
        return top + (by - wall) / (H - wall) * (bottom - top)

    slug = ROOM_SLUG[rid]
    os.makedirs(OUT_ROOMS, exist_ok=True)
    # 書き出しの細かさ：表示（論理px＝単位×0.5625）の約2倍、元の大きさまで
    out_scale = min(1.0, 2 * 0.5625 * W / 1024)
    shell = Image.open(f'{parts}/{sh["file"]}.png').convert('RGB')
    shell.resize((round(1024 * out_scale), round(1024 * out_scale)), Image.LANCZOS).save(
        f'{OUT_ROOMS}/{slug}_shell.webp', quality=WEBP_Q + 4, method=6)

    cols = rows = W // CELL
    unit = W  # 部屋の絵は正方形
    grid = [['#'] * cols for _ in range(rows)]

    def floor_x(y: float) -> tuple[float, float]:
        t = (y / k - sh['top']) / (sh['bottom'] - sh['top'])
        return (sh['lt'] + (sh['lb'] - sh['lt']) * t) * k, (sh['rt'] + (sh['rb'] - sh['rt']) * t) * k

    for ry in range(rows):
        for cx in range(cols):
            px, py = cx * CELL + CELL / 2, ry * CELL + CELL / 2
            if top + 8 <= py <= bottom - 4:
                lx, rx = floor_x(py)
                if lx + 10 <= px <= rx - 10:
                    grid[ry][cx] = '.'
    # 出入口：手前の壁のすき間（床の下から絵の下まで）
    dl, dr = sh['door'][0] * k, sh['door'][1] * k
    door_cols = [cx for cx in range(cols) if dl + 6 <= cx * CELL + CELL / 2 <= dr - 6]
    for ry in range(rows):
        if ry * CELL + CELL / 2 > bottom - 4:
            for cx in door_cols:
                grid[ry][cx] = '.'

    sprites = []
    items = {}
    saved_files = {}
    for it in room['items']:
        key = ROOM_ITEMS[rid].get(it['id'])
        bx1, by1, bx2, by2 = it['rect']
        y1, y2 = map_y(by1), map_y(by2)
        rect_u = [bx1, y1, bx2, y2]
        if key:
            src = furn[key]
            w = bx2 - bx1
            s = w / src.width
            h = src.height * s
            if it['kind'] == 'wall':
                # 壁の物：枠の中に収める（縦横の小さい方に合わせる）
                s = min(w / src.width, (y2 - y1) / src.height)
                w, h = src.width * s, src.height * s
                x = (bx1 + bx2) / 2 - w / 2
                y = (y1 + y2) / 2 - h / 2
            else:
                x, y = bx1, y2 - h
            fname = f'{slug}_{key.split(":")[1]}.webp'
            if fname not in saved_files:
                px_w = max(1, round(w * 0.5625 * 2))
                src.resize((px_w, max(1, round(src.height * px_w / src.width))), Image.LANCZOS).save(
                    f'{OUT_ROOMS}/{fname}', quality=WEBP_Q + 6, method=6)
                saved_files[fname] = True
            # 敷物は床の一部（いつも人より奥）。壁の物も奥
            z = 0 if it['kind'] in ('rug', 'wall') else y2
            sprites.append(dict(file=f'maps/rooms/{fname}', x=round(x), y=round(y), w=round(w), h=round(h), z=round(z)))
        # 当たり判定：床に置く家具は、設計図の枠（床に当たる部分）を歩けなくする
        c1, c2 = int(bx1 // CELL), int(-(-bx2 // CELL))
        r1, r2 = int(y1 // CELL), int(-(-y2 // CELL))
        if it['kind'] == 'furniture':
            for ry in range(max(r1, 0), min(r2, rows)):
                for cx in range(max(c1, 0), min(c2, cols)):
                    if ry * CELL + CELL / 2 < y2 + 4:
                        grid[ry][cx] = '#'
        # 調べる範囲（マス）：家具の枠。上が歩けないマスなら絵の上までのばす（壁ぎわの家具・壁の物）
        rr1 = r1
        if key:
            img_top = int(sprites[-1]['y'] // CELL)
            while rr1 > max(img_top, 0) and all(grid[rr1 - 1][cx] == '#' for cx in range(max(c1, 0), min(c2, cols))):
                rr1 -= 1
        if it['kind'] == 'wall':
            # 壁の物は床に届くまで下にのばす（床の一番奥から調べられるように）
            while r2 < rows and all(grid[r2][cx] == '#' for cx in range(max(c1, 0), min(c2, cols))):
                r2 += 1
        items[it['id']] = dict(x=c1, y=rr1, w=c2 - c1, h=max(1, r2 - rr1))
    exit_row = rows - 1
    spawn_row = max(ry for ry in range(rows) if ry * CELL + CELL / 2 <= bottom - 4)
    data = dict(
        id=slug, cols=cols, rows=rows, width=unit, height=unit, cell=CELL,
        grid=[''.join(r) for r in grid],
        tiles=[dict(file=f'maps/rooms/{slug}_shell.webp', x=0, y=0, w=unit, h=unit)],
        sprites=sprites, items=items,
        exit=dict(x=door_cols[0], y=exit_row, w=len(door_cols), h=1),
        spawn=dict(x=(door_cols[0] + door_cols[-1] + 1) // 2, y=spawn_row),
    )
    if check_dir:
        im = shell.resize((unit, unit), Image.LANCZOS).convert('RGBA')
        for s in sorted(sprites, key=lambda s: s['z']):
            f = Image.open(f'{OUT_ROOMS}/{s["file"].split("/")[-1]}').convert('RGBA').resize((s['w'], s['h']), Image.LANCZOS)
            im.alpha_composite(f, (s['x'], s['y']))
        d = ImageDraw.Draw(im, 'RGBA')
        for ry in range(rows):
            for cx in range(cols):
                if grid[ry][cx] == '.':
                    d.rectangle([cx * CELL, ry * CELL, cx * CELL + CELL - 1, ry * CELL + CELL - 1], outline=(0, 120, 255, 120), fill=(0, 120, 255, 35))
        for iid, r in items.items():
            d.rectangle([r['x'] * CELL, r['y'] * CELL, (r['x'] + r['w']) * CELL - 1, (r['y'] + r['h']) * CELL - 1], outline=(255, 0, 0, 200), width=2)
            d.text((r['x'] * CELL + 3, r['y'] * CELL + 3), iid, fill=(255, 255, 0, 255))
        e = data['exit']
        d.rectangle([e['x'] * CELL, e['y'] * CELL, (e['x'] + e['w']) * CELL - 1, (e['y'] + 1) * CELL - 1], fill=(0, 255, 0, 140))
        im.convert('RGB').save(f'{check_dir}/room_{slug}.jpg', quality=88)
    return data


# ───────────── TypeScript に書き出す ─────────────
def to_ts(town: dict, rooms: list[dict]) -> str:
    files: list[str] = []

    def ref(d: dict) -> dict:
        f = d['file']
        if f not in files:
            files.append(f)
        return {**d, 'file': f'@@{files.index(f)}@@'}

    maps = []
    for m in [town, *rooms]:
        m = dict(m)
        m['tiles'] = [ref(t) for t in m['tiles']]
        m['sprites'] = [ref(s) for s in m['sprites']]
        maps.append(m)
    body = json.dumps({m['id']: m for m in maps}, ensure_ascii=False, indent=1)
    for i, _ in enumerate(files):
        body = body.replace(f'"@@{i}@@"', f'img{i}')
    imports = '\n'.join(f"import img{i} from '@assets/images/{f}';" for i, f in enumerate(files))
    return (
        '// このファイルは tools/design/seimon_world_build.py が自動で作る（手で直さない）\n'
        '// 正式な街・部屋の絵（ユーザー承認済みの部品を設計図どおりに並べたもの）と、歩ける所のマス目・扉・家具の位置\n'
        f'{imports}\n\n'
        'export interface ArtImage { readonly file: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly z?: number }\n'
        'export interface CellRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }\n'
        'export interface ArtMap {\n'
        '  readonly id: string;\n  readonly cols: number;\n  readonly rows: number;\n'
        '  /** 絵の大きさ（設計図の単位。表示は 0.5625 倍の論理px） */\n  readonly width: number;\n  readonly height: number;\n'
        '  /** 1マスの大きさ（設計図の単位） */\n  readonly cell: number;\n'
        "  /** マス目：'#' 歩けない・'=' 道・'.' 床 */\n  readonly grid: readonly string[];\n"
        '  readonly tiles: readonly ArtImage[];\n  /** 人と前後を比べて重ねる絵（z＝足元の y。0 はいつも奥） */\n  readonly sprites: readonly ArtImage[];\n'
        '  readonly exit: CellRect;\n  readonly spawn: { readonly x: number; readonly y: number };\n'
        '  readonly doors?: Readonly<Record<string, CellRect & { readonly back: { readonly x: number; readonly y: number }; readonly label: { readonly x: number; readonly y: number } }>>;\n'
        '  readonly items?: Readonly<Record<string, CellRect>>;\n  readonly fountain?: CellRect;\n'
        '}\n\n'
        f'export const WORLD_ART: Readonly<Record<string, ArtMap>> = {body};\n'
    )


# ───────────── 街の色の調子 ─────────────
# 2026-10-26 ユーザー指示「街全体が古びて見える。（見本の）弱めで全体にかけて」。街の部品（建物・地面・小物・草花・噴水）だけに、
# 明るさ×1.08・あざやかさ×1.18・コントラスト×1.04（灰色 128 を中心に）・少し暖かく（赤+2%・青−2%）。透明度は変えない。
# 新しく届いたカードショップ・大会会場（ユーザーが調子を変えて描いた絵）と、部屋の中（room_shell_・furn_）にはかけない。
# 原本（design-parts/seimon-world/）は変えず、組み立てるときに写しへかける
TOWN_TONE = {'brightness': 1.08, 'saturation': 1.18, 'contrast': 1.04, 'warm': 0.02}
TOWN_TONE_SKIP = {'town_shop', 'town_arena'}


def tone(im: Image.Image) -> Image.Image:
    a = np.array(im.convert('RGBA')).astype(np.float32)
    rgb = a[..., :3] * TOWN_TONE['brightness']
    lum = (rgb * np.array([0.299, 0.587, 0.114], np.float32)).sum(axis=2, keepdims=True)
    rgb = lum + (rgb - lum) * TOWN_TONE['saturation']
    rgb = 128 + (rgb - 128) * TOWN_TONE['contrast']
    rgb[..., 0] *= 1 + TOWN_TONE['warm']
    rgb[..., 2] *= 1 - TOWN_TONE['warm']
    a[..., :3] = np.clip(rgb, 0, 255)
    out = Image.fromarray(a.astype(np.uint8), 'RGBA')
    # 透明度のない絵（地面の模様など）は、元と同じ形式のまま
    return out if im.mode in ('RGBA', 'LA', 'P') else out.convert(im.mode)


def toned_town_parts(parts: str) -> str:
    """街の部品に色の調子をかけた写しを、作業用のフォルダに作る（部屋の部品は写さない）"""
    out = tempfile.mkdtemp(prefix='town_tone_')
    for f in os.listdir(parts):
        name, ext = os.path.splitext(f)
        if ext != '.png' or name.startswith(('room_shell_', 'furn_')):
            continue
        if name in TOWN_TONE_SKIP:
            shutil.copy(f'{parts}/{f}', f'{out}/{f}')
        else:
            tone(Image.open(f'{parts}/{f}')).save(f'{out}/{f}')
    return out


def main() -> None:
    parts = sys.argv[1]
    check = sys.argv[2] if len(sys.argv) > 2 else None
    if check:
        os.makedirs(check, exist_ok=True)
    toned = toned_town_parts(parts)
    try:
        town = build_town(toned, check)
    finally:
        shutil.rmtree(toned, ignore_errors=True)
    furn = load_furniture(parts)
    rooms = [build_room(parts, r, furn, check) for r in pack.ROOMS]
    with open(OUT_TS, 'w', encoding='utf-8') as f:
        f.write(to_ts(town, rooms))
    print('ok', OUT_TS)


if __name__ == '__main__':
    main()
