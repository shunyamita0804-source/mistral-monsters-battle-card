"""技カード新UI（v5）の枠を、色ごとに作る（2026-10-25）。

もと：承認済みUI参考画像（design-parts/ui-skillcard-v5/approved_ui_reference.png）から skillcard_v5_extract.py で切り出した
      サポート（シルバー）の枠 frame_{normal,hand}_support.png。全分類で同じ形にするため、この1枚の形をもとにする。
1. 色替え：枠の銀色の部分（影まで）を、指定の色のグラデーション（暗・中・明）に替える。
   金の縁・技名と説明の札・数値の四角・マナの玉は替えない（色替えマスク frame_{size}_tintmask.png に書き出す）
0. 縦長の枠の上の端に残った背景のゴミ（細い横線）を消す（clean_top）
2. 左上の種類の札の中に、参考画像の「技種別アイコン」（icon_{分類}.png）を入れる
出力（出力フォルダ）：
  frame_{normal,hand}_{分類}.png            … 分類の色（参考画像の分類別の色。ソラモ以外のモンスターと仮カード）
  frame_{normal,hand}_{分類}_{名前}.png     … モンスターの色（例：soramo＝クリーム。全分類を同じ色）
  frame_{normal,hand}_support.png            … サポート（シルバーのまま）
  frame_{normal,hand}_tintmask.png           … 色替えマスク（白＝色替えする所）
使い方：python3 -I tools/art/skillcard_v5_monster_color.py [--scale=2] 切り出しフォルダ 出力フォルダ [名前=#RRGGBB …]
  --scale：枠の絵が LAYOUT（253×382・208×210）の何倍か（2026-10-28 から 2倍。下の KEEP・TILE はいつも1倍の数字で書き、倍率を掛けて使う）
  ふつうは tools/art/skillcard_v3_build.py（npm run art:skillframes）から使う。そのときは分類のアイコンを v3 の大きな絵から切り出して渡す（icons）
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

CATS = ['force', 'wisdom', 'defense', 'evade', 'special']
# 分類の色：参考画像の各分類の枠の色（側面の帯の中央値）。モンスターの色は引数で（ソラモ＝クリーム #E4D2AC）
CATEGORY_COLORS = {'force': '#FAB951', 'wisdom': '#9FB336', 'defense': '#197FBC', 'evade': '#80B8C4', 'special': '#BA1BB3'}

# 色替えしない所（枠の画像の画素で）：技名・説明の札、数値の四角、マナの玉。種類の札の中は tile_interior で別に除く
KEEP = {
    'normal': {'rects': [(94, 26, 236, 66), (91, 291, 244, 361), (16, 278, 89, 361)], 'orb': (49, 138, 31)},
    'hand': {'rects': [(63, 14, 199, 49), (63, 149, 199, 199), (9, 139, 69, 201)], 'orb': (34, 90, 23)},
}
# 左上の種類の札の中（八角形の暗い所）：札の真ん中と、探す範囲（x0, y0, x1, y1）
TILE = {'normal': ((49, 72), (16, 36, 84, 110)), 'hand': ((37, 44), (13, 18, 62, 69))}


def clean_top(rgba: np.ndarray, kind: str, scale: int = 1) -> np.ndarray:
    """縦長の枠の上の端に残った参考画像の背景（細い横線とにじみ）を透明にする。上の飾りの山（x 95〜205）は残す。色は変えない"""
    out = rgba.copy()
    k = scale
    if kind == 'normal':
        out[0 : 2 * k, :, 3] = 0
        out[2 * k : 10 * k, : 95 * k, 3] = 0
        out[2 * k : 10 * k, 205 * k :, 3] = 0
    return out


def ramp_of(hex_color: str):
    """中の色から、暗・中・明のグラデーションを作る（暗＝中の色の約45%、明＝白へ7割寄せた色）"""
    mid = np.array([int(hex_color.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)], float)
    return mid * 0.45, mid, mid + (255 - mid) * 0.7


def tile_interior(rgba: np.ndarray, kind: str, scale: int = 1) -> np.ndarray:
    (cx, cy), (x0, y0, x1, y1) = TILE[kind]
    cx, cy, x0, y0, x1, y1 = (v * scale for v in (cx, cy, x0, y0, x1, y1))
    rgb = rgba[..., :3].astype(float)
    dark = rgb.mean(-1) < 80
    box = np.zeros(dark.shape, bool)
    box[y0:y1, x0:x1] = True
    lab, _ = ndimage.label(dark & box)
    ys, xs = np.nonzero(lab > 0)
    k = int(np.argmin((ys - cy) ** 2 + (xs - cx) ** 2))
    return ndimage.binary_closing(ndimage.binary_fill_holes(lab == lab[ys[k], xs[k]]), iterations=2 * scale)


def tint_mask(rgba: np.ndarray, kind: str, tile: np.ndarray, scale: int = 1) -> np.ndarray:
    rgb = rgba[..., :3].astype(float)
    r, b = rgb[..., 0], rgb[..., 2]
    gold = (r - b > 45) & (r > 120)
    in_rect = np.zeros(gold.shape, bool)
    for x0, y0, x1, y1 in KEEP[kind]['rects']:
        in_rect[y0 * scale : y1 * scale, x0 * scale : x1 * scale] = True
    br = rgb.mean(-1)
    keep = in_rect & (((r - b > 18) & (br > 150)) | (br < 58))
    cx, cy, rad = (v * scale for v in KEEP[kind]['orb'])
    yy, xx = np.mgrid[: gold.shape[0], : gold.shape[1]]
    keep |= (xx - cx) ** 2 + (yy - cy) ** 2 <= rad ** 2
    keep |= ndimage.binary_dilation(tile, iterations=scale)
    return (rgba[..., 3] > 0) & ~gold & ~keep


def colorize(rgba: np.ndarray, mask: np.ndarray, ramp) -> np.ndarray:
    rgb = rgba[..., :3].astype(float)
    lum = (rgb @ np.array([0.299, 0.587, 0.114])) / 255
    dark, mid, light = ramp
    lo = dark + (mid - dark) * np.clip(lum / 0.55, 0, 1)[..., None]
    hi = mid + (light - mid) * np.clip((lum - 0.55) / 0.45, 0, 1)[..., None]
    col = np.where((lum < 0.55)[..., None], lo, hi)
    out = rgba.copy()
    out[mask, :3] = np.clip(col[mask], 0, 255).astype(np.uint8)
    return out


def with_icon(img: np.ndarray, inner: np.ndarray, cat: str, src: Path, icon_patch: Image.Image | None = None) -> np.ndarray:
    """種類の札の中にアイコンを入れる。icon_patch（札の中の大きさの絵）があればそれ、なければ src の icon_{分類}.png の真ん中"""
    yy, xx = np.nonzero(inner)
    x0, y0, x1, y1 = xx.min(), yy.min(), xx.max() + 1, yy.max() + 1
    if icon_patch is not None:
        glyph = np.array(icon_patch.convert('RGBA').resize((x1 - x0, y1 - y0), Image.LANCZOS))
    else:
        icon = Image.open(src / f'icon_{cat}.png').convert('RGBA')
        iw, ih = icon.size
        inset = round(iw * 0.15)
        glyph = np.array(icon.crop((inset, inset, iw - inset, ih - inset)).resize((x1 - x0, y1 - y0), Image.LANCZOS))
    out = img.copy()
    region = inner[y0:y1, x0:x1]
    patch = out[y0:y1, x0:x1]
    patch[region, :3] = glyph[region, :3]
    patch[region, 3] = 255
    return out


def build(src: Path, monsters: dict[str, str], scale: int = 1, icons: dict | None = None):
    """枠をすべて作る。(ファイル名, 画像の配列) を順に返す（色替えマスクは frame_{size}_tintmask）。
    icons：{(size, 分類): 札の中の絵}。無ければ src の icon_{分類}.png を使う"""
    for kind in ['normal', 'hand']:
        base = clean_top(np.array(Image.open(src / f'frame_{kind}_support.png').convert('RGBA')), kind, scale)
        inner = tile_interior(base, kind, scale)
        mask = tint_mask(base, kind, inner, scale)
        yield f'frame_{kind}_tintmask', (mask * 255).astype(np.uint8)
        yield f'frame_{kind}_support', base
        for cat in CATS:
            patch = (icons or {}).get((kind, cat))
            yield f'frame_{kind}_{cat}', with_icon(colorize(base, mask, ramp_of(CATEGORY_COLORS[cat])), inner, cat, src, patch)
            for name, color in monsters.items():
                yield f'frame_{kind}_{cat}_{name}', with_icon(colorize(base, mask, ramp_of(color)), inner, cat, src, patch)


def main() -> None:
    args = sys.argv[1:]
    scale = 1
    if args and args[0].startswith('--scale='):
        scale = int(args.pop(0).split('=')[1])
    src, out = Path(args[0]), Path(args[1])
    out.mkdir(parents=True, exist_ok=True)
    monsters = dict(arg.split('=') for arg in args[2:])
    for name, arr in build(src, monsters, scale):
        Image.fromarray(arr).save(out / f'{name}.png', optimize=True)
    print('ok')


if __name__ == '__main__':
    main()
