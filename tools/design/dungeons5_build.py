# -*- coding: utf-8 -*-
"""新しいダンジョン5つ（水の神殿・氷の洞窟・炎の火山・機械の塔・天の聖域）の正式な絵を、ゲーム用に切り出す（2026-10-28 届いた30枚）

使い方: python3 -I tools/design/dungeons5_build.py design-parts/dungeons5-20261028 assets/images [wind …（作るダンジョンだけ。省くと全部）]

原本（無改変）: design-parts/dungeons5-20261028/{water,ice,fire,machine,holy}/{d}_{tiles,parts,battle_bg,boss_mark,art,overlay}.png
作るもの（{d} はフォルダ名）:
  maps/dungeon/{d}_floor.webp・{d}_wall_top.webp・{d}_wall_face.webp   床・壁の上面・壁の正面（継ぎ目が出ないように端を重ねてぼかす）
  maps/dungeon/{d}_stairs_down.webp                                    下り階段（上り階段はランダム生成のダンジョンでは使わないので作らない）
  maps/dungeon/water_channel.webp・water_edge.webp・water_edge_v.webp  水路のマス・水路のふちの石（横・縦）
  maps/dungeon/ice_slide.webp                                          すべる氷のマス
  maps/dungeon/fire_crack_{1..4}.webp                                  溶岩のひび割れ（大きい順）
  maps/dungeon/machine_door_{closed,open}.webp・machine_switch_{off,on}.webp
  maps/dungeon/holy_feather_{1..3}.webp・holy_candle_{1,2}.webp・holy_light_{1,2}.webp
  maps/dungeon/wind_{bridge,vane,mill,leaves,stake}.webp                風の渓谷の飾り（2026-10-30 指示書 U。つり橋の切れはし・風見の石の柱・小さな風車・木の葉の吹きだまり・ロープの杭）
  maps/dungeon/boss_mark_{d}.webp                                      ボスの間のしるし（いまの boss_mark_ruins と同じ高さ 320）
  backgrounds/battle_{d}.webp                                          対戦の背景（1024×1536 のまま）
  ui/dungeon_intro/{d}_art.webp・{d}_overlay.webp                      入ったときの挿絵（縦長のまま）と重ねる輪

- 絵そのもの（色・形）は変えない。変えるのは「切り出し・縮小・WebP・床と壁の継ぎ目の加工」だけ
- シートの部品は透明な所で切り分ける。近くの小さなかけら（ひび割れのまわりの石など）は同じ部品にまとめ、
  どれにも入らない小さなゴミは捨てる。何度作り直しても同じ結果になる
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

DUNGEONS = ('water', 'ice', 'fire', 'machine', 'holy', 'wind')
# 原本のファイル名の頭（風の渓谷だけ wind_valley_*.png。2026-10-30 指示書 U。原本の名前は変えない）
PREFIX = {'wind': 'wind_valley'}
# 見えるとみなす透明度（これより薄い所は部品の外）
ALPHA_SOLID = 16
# 部品を1つにまとめるときに、どれだけ離れたかけらまで同じ部品とみなすか（px）
GROUP_GAP = 14
# 捨てる小さなゴミの大きさ（px の数）
MIN_PART_PX = 1500
# 床・壁のタイルのふちの黒い線を落とす幅（px）
TILE_INSET = 6
# 継ぎ目をぼかす幅（タイルの幅に対する割合）
SEAM_RATIO = 0.12


def components(im: Image.Image, gap: int = GROUP_GAP) -> list[tuple[int, int, int, int, np.ndarray]]:
    """透明な所で部品に分ける。(左, 上, 右, 下, その部品の場所) を、上の段から左から順に"""
    a = np.array(im)[:, :, 3]
    solid = a > ALPHA_SOLID
    grown = ndimage.binary_dilation(solid, iterations=gap // 2) if gap >= 2 else solid
    lab, n = ndimage.label(grown)
    out = []
    for i in range(1, n + 1):
        region = lab == i
        mine = region & (a > 0)
        if (solid & region).sum() < MIN_PART_PX:
            continue
        ys, xs = np.nonzero(mine)
        out.append((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1, region))
    # 上の段から、左から順に（炎の火山だけ、ひび割れ3つがシートの下の方〔縦の真ん中が 7 割より下〕にもう1段ある）
    out.sort(key=lambda c: ((c[1] + c[3]) / 2 >= im.height * 0.7, (c[0] + c[2]) / 2))
    return out


def cut(im: Image.Image, comp: tuple[int, int, int, int, np.ndarray]) -> Image.Image:
    """部品の場所だけを残して切り出す（となりの部品のはみ出しは入れない）"""
    x0, y0, x1, y1, region = comp
    arr = np.array(im).copy()
    arr[~region] = 0
    return Image.fromarray(arr).crop((x0, y0, x1, y1))


def split_at_gap(comp: tuple[int, int, int, int, np.ndarray], a: np.ndarray) -> list[tuple[int, int, int, int, np.ndarray]]:
    """くっついて1つになった2つの部品を、見える px がいちばん少ない縦の列で左右に分ける"""
    x0, y0, x1, y1, region = comp
    cols = ((a > ALPHA_SOLID) & region).sum(axis=0)[x0:x1]
    w = x1 - x0
    mid = int(np.argmin(cols[w * 3 // 10: w * 7 // 10])) + w * 3 // 10 + x0
    left = region.copy()
    left[:, mid:] = False
    right = region.copy()
    right[:, :mid] = False
    res = []
    for r in (left, right):
        ys, xs = np.nonzero(r & (a > 0))
        res.append((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1, r))
    return res


def opaque_box(tile: Image.Image) -> Image.Image:
    """タイルの不透明な四角だけにして、ふちの黒い線を落とす"""
    a = np.array(tile)[:, :, 3] > 200
    rows = np.nonzero(a.mean(axis=1) > 0.9)[0]
    cols = np.nonzero(a.mean(axis=0) > 0.9)[0]
    box = (int(cols.min()) + TILE_INSET, int(rows.min()) + TILE_INSET, int(cols.max()) + 1 - TILE_INSET, int(rows.max()) + 1 - TILE_INSET)
    return tile.crop(box).convert('RGB')


def seamless(im: Image.Image, horizontal: bool = True, vertical: bool = True) -> Image.Image:
    """端と端をなめらかにつなぐ：反対の端の続きを、少しずつ重ねてぼかす（その分だけ絵が少し小さくなる）"""
    arr = np.array(im).astype(np.float32)
    if horizontal:
        b = max(8, round(arr.shape[1] * SEAM_RATIO))
        n = arr.shape[1] - b
        out = arr[:, :n].copy()
        t = (np.arange(b, dtype=np.float32) / b)[None, :, None]
        out[:, :b] = arr[:, :b] * t + arr[:, n:] * (1 - t)
        arr = out
    if vertical:
        b = max(8, round(arr.shape[0] * SEAM_RATIO))
        n = arr.shape[0] - b
        out = arr[:n].copy()
        t = (np.arange(b, dtype=np.float32) / b)[:, None, None]
        out[:b] = arr[:b] * t + arr[n:] * (1 - t)
        arr = out
    return Image.fromarray(np.clip(arr + 0.5, 0, 255).astype(np.uint8))


def fit(im: Image.Image, width: int | None = None, height: int | None = None) -> Image.Image:
    """縦か横の長さに合わせて縮める（大きくはしない）"""
    if width and im.width > width:
        return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    if height and im.height > height:
        return im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    return im


def trim(im: Image.Image) -> Image.Image:
    """まわりの透明な所を切り落とす（ほとんど見えない所〔alpha 8 以下〕も外す）"""
    box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    return im.crop(box)


class Saver:
    def __init__(self, out: str) -> None:
        self.out = out

    def __call__(self, im: Image.Image, rel: str, quality: int = 88) -> None:
        dst = os.path.join(self.out, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im.save(dst, 'WEBP', quality=quality, method=6)
        print(rel, im.size, os.path.getsize(dst) // 1024, 'KB')


def build_tiles(src: str, d: str, save: Saver) -> None:
    sheet = Image.open(os.path.join(src, d, f'{PREFIX.get(d, d)}_tiles.png')).convert('RGBA')
    # タイルどうしは近いので、かけらをまとめない
    comps = components(sheet, gap=0)
    assert len(comps) == 3, (d, 'tiles', len(comps))
    floor, top, face = (opaque_box(cut(sheet, c)) for c in comps)
    save(seamless(floor), f'maps/dungeon/{d}_floor.webp')
    save(seamless(top), f'maps/dungeon/{d}_wall_top.webp')
    # 壁の正面は横にだけ並べる
    save(fit(seamless(face, vertical=False), width=768), f'maps/dungeon/{d}_wall_face.webp')


def build_parts(src: str, d: str, save: Saver) -> None:
    sheet = Image.open(os.path.join(src, d, f'{PREFIX.get(d, d)}_parts.png')).convert('RGBA')
    a = np.array(sheet)[:, :, 3]
    if d == 'wind':
        # 下り階段と上り階段の間が狭いので、かけらをまとめる幅を小さく
        build_wind_parts(sheet, components(sheet, gap=4), save)
        return
    comps = components(sheet)
    if d == 'machine' and len(comps) == 5:
        # 上り階段と閉じた扉がくっついている
        comps = [comps[0], *split_at_gap(comps[1], a), *comps[2:]]
    stairs_down = trim(cut(sheet, comps[0]))
    save(fit(stairs_down, height=256), f'maps/dungeon/{d}_stairs_down.webp')
    rest = [trim(cut(sheet, c)) for c in comps[2:]]
    if d == 'water':
        assert len(rest) == 2, (d, len(rest))
        save(seamless(opaque_box(rest[0])), 'maps/dungeon/water_channel.webp')
        save(fit(rest[1], width=512), 'maps/dungeon/water_edge.webp')
        # 縦の水路の左右のふち用に、90度まわしたもの
        save(fit(rest[1], width=512).transpose(Image.Transpose.ROTATE_90), 'maps/dungeon/water_edge_v.webp')
    elif d == 'ice':
        assert len(rest) == 1, (d, len(rest))
        save(seamless(opaque_box(rest[0])), 'maps/dungeon/ice_slide.webp')
    elif d == 'fire':
        assert len(rest) == 4, (d, len(rest))
        rest.sort(key=lambda im: -im.width * im.height)
        for i, im in enumerate(rest, 1):
            save(fit(im, width=320), f'maps/dungeon/fire_crack_{i}.webp')
    elif d == 'machine':
        assert len(rest) == 4, (d, len(rest))
        for im, name in zip(rest, ('door_closed', 'door_open', 'switch_off', 'switch_on')):
            save(fit(im, height=192), f'maps/dungeon/machine_{name}.webp')
    elif d == 'holy':
        assert len(rest) == 7, (d, len(rest))
        lights = [im for im in rest if im.width > 180]
        candles = [im for im in rest if im.width <= 180 and im.height > 200]
        feathers = [im for im in rest if im.width <= 180 and im.height <= 200]
        assert (len(lights), len(candles), len(feathers)) == (2, 2, 3)
        for i, im in enumerate(feathers, 1):
            save(fit(im, height=96), f'maps/dungeon/holy_feather_{i}.webp')
        for i, im in enumerate(candles, 1):
            save(fit(im, height=192), f'maps/dungeon/holy_candle_{i}.webp')
        for i, im in enumerate(lights, 1):
            save(fit(im, height=288), f'maps/dungeon/holy_light_{i}.webp')


def build_wind_parts(sheet: Image.Image, comps: list, save: Saver) -> None:
    """風の渓谷：左から下り階段・上り階段、右に2列の飾り5つ（左の列：つり橋の切れはし・小さな風車、右の列：風見の石の柱・木の葉の吹きだまり・ロープの杭）。
    座標では切らず、透明でない部分ごとに切り出し、列（横の真ん中）と上からの順で名前を決める"""
    assert len(comps) == 7, ('wind', len(comps))
    comps = sorted(comps, key=lambda c: (c[0] + c[2]) / 2)
    save(fit(trim(cut(sheet, comps[0])), height=256), 'maps/dungeon/wind_stairs_down.webp')
    deco = comps[2:]
    mid = sum((c[0] + c[2]) / 2 for c in deco) / len(deco)
    left = sorted([c for c in deco if (c[0] + c[2]) / 2 < mid], key=lambda c: c[1])
    right = sorted([c for c in deco if (c[0] + c[2]) / 2 >= mid], key=lambda c: c[1])
    assert (len(left), len(right)) == (2, 3), ('wind', len(left), len(right))
    # 5つの大きさの比を変えないよう、どれも同じ割合で縮める（いちばん高いもの〔風見の石の柱〕が高さ 240）
    ims = [trim(cut(sheet, c)) for c in [*left, *right]]
    k = 240 / max(im.height for im in ims)
    for im, name in zip(ims, ('bridge', 'mill', 'vane', 'leaves', 'stake')):
        save(im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS), f'maps/dungeon/wind_{name}.webp')


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    save = Saver(out)
    for d in sys.argv[3:] or DUNGEONS:
        build_tiles(src, d, save)
        build_parts(src, d, save)
        f = PREFIX.get(d, d)
        boss = trim(Image.open(os.path.join(src, d, f'{f}_boss_mark.png')).convert('RGBA'))
        save(fit(boss, height=320), f'maps/dungeon/boss_mark_{d}.webp')
        save(Image.open(os.path.join(src, d, f'{f}_battle_bg.png')).convert('RGB'), f'backgrounds/battle_{d}.webp', quality=84)
        save(Image.open(os.path.join(src, d, f'{f}_art.png')).convert('RGB'), f'ui/dungeon_intro/{d}_art.webp', quality=84)
        overlay = trim(Image.open(os.path.join(src, d, f'{f}_overlay.png')).convert('RGBA'))
        save(fit(overlay, width=1200), f'ui/dungeon_intro/{d}_overlay.webp', quality=88)


if __name__ == '__main__':
    main()
