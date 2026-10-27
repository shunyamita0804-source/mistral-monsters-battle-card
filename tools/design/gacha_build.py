"""カードパック販売機（ガチャ）の専用画面の部品を作る（2026-10-27 カードショップ改修。ZIP「MistralBC_CardShop_Handoff_FIXED」）。

使い方：
  python3 -I tools/design/gacha_build.py design-parts/cardshop-20261027

1. 正式ハンドル（Handle_Official_Reference.jpeg。唯一の正式原画・描き直し禁止）を、白い背景を透明にして
   「動かない円盤（軸受けつき）」と「回る取っ手（軸・ひじ・青い玉）」に分ける（README の指示「固定円盤と回転クランクを切り分け、円盤中央を軸に回す」）。
   - 取っ手：円盤の外の部分と、円盤の上にかかる軸・ひじ（手で決めた多角形 CRANK_OVER_DISC）
   - 円盤：取っ手に隠れていた所は、絵を描き足さず、円盤の見えている所を同じ中心のまわりに回して写して埋める
     （軸受けの中は軸受けの中心 PIVOT のまわりに、ほかは円盤の中心 DISC のまわりに）
   - 2枚とも同じ大きさの正方形で、真ん中が回る中心（PIVOT）。ゲームは取っ手を真ん中を軸に回すだけ
2. 参考シート（Gacha_Tray_8Frame_Reference.png。02_WORKING＝参考候補・正式完成品ではない）から、焼き込まれた市松模様を透明にして、
   【仮】機械の上半分（ガラス窓と帯。シートの機械の正面図の下半分には別のハンドルが描かれていて使用禁止なので、その上で切る）と
   【仮】排出トレー（閉・開）を切り出す。正式素材が届いたら差し替える
絵は描き直さない（背景を透明にする・切り出す・縮小するだけ。円盤の隠れていた所だけは上のとおり絵の中から写す）。

書き出し先（assets/images/ui/gacha/）：handle_disc.webp・handle_crank.webp・machine_top.webp・tray_closed.webp・tray_open.webp
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2] / 'assets' / 'images' / 'ui' / 'gacha'

# ハンドルの原画（1536×1024）の中の位置
DISC = (520, 358, 336, 328)  # 円盤の外形の楕円（中心 x, y・半径 x, y）
PIVOT = (632, 401)  # 軸受けの中心（取っ手が回る中心）
COLLAR_R = 118  # 軸受けの半径
CRANK_OVER_DISC = [(626, 322), (700, 315), (762, 325), (880, 349), (914, 420), (914, 710), (733, 710), (736, 516), (645, 494), (612, 470)]
HANDLE_SIZE = 640  # 書き出す正方形の一辺（px）

SHEET_SCALE = 1536 / 1200  # 参考シートの位置は 1200 幅で測ったので、原寸に直す倍率
MACHINE_FRONT = (8, 33, 285, 400)  # 機械の正面図（1200 幅で測った位置）
MACHINE_TOP_H = 288  # 機械の上半分の高さ（切り出した正面図の中。この下に別のハンドルがある）
TRAY_CLOSED = (10, 460, 142, 566)
TRAY_OPEN = (148, 460, 296, 566)


def save(img: Image.Image, name: str, width: int | None = None) -> None:
    if width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    ROOT.mkdir(parents=True, exist_ok=True)
    img.save(ROOT / name, quality=88, method=6)
    print(name, img.size)


def handle(src: Path) -> None:
    im = np.array(Image.open(src).convert('RGB')).astype(int)
    h, w, _ = im.shape
    mx, mn = im.max(-1), im.min(-1)
    white = (mn > 226) & ((mx - mn) < 22)
    lab, _ = ndimage.label(white)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    obj = ndimage.binary_opening(~np.isin(lab, list(edge)), iterations=1)
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy, rx, ry = DISC
    inside = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0
    poly = Image.new('L', (w, h), 0)
    ImageDraw.Draw(poly).polygon(CRANK_OVER_DISC, fill=255)
    crank = obj & (~inside | (np.array(poly) > 0))
    disc = obj & ~crank

    # 円盤の隠れていた所を、見えている所を回して写して埋める
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., :3] = im.astype(np.uint8)
    rgba[..., 3] = np.where(disc, 255, 0)
    filled = disc.copy()
    hidden = inside & crank
    collar = np.hypot(xx - PIVOT[0], yy - PIVOT[1]) <= COLLAR_R

    def copy_rotated(mask: np.ndarray, center: tuple[int, int], deg: float) -> None:
        ys, xs = np.where(mask & ~filled)
        a = np.deg2rad(deg)
        dx, dy = xs - center[0], ys - center[1]
        sx = np.clip(np.round(center[0] + dx * np.cos(a) - dy * np.sin(a)).astype(int), 0, w - 1)
        sy = np.clip(np.round(center[1] + dx * np.sin(a) + dy * np.cos(a)).astype(int), 0, h - 1)
        ok = disc[sy, sx]
        rgba[ys[ok], xs[ok], :3] = im[sy[ok], sx[ok]]
        rgba[ys[ok], xs[ok], 3] = 255
        filled[ys[ok], xs[ok]] = True

    for deg in (180, 160, 200, -90):
        copy_rotated(hidden & collar, PIVOT, deg)
    for deg in (-70, -90, -110, 70):
        copy_rotated(hidden & ~collar, (cx, cy), deg)

    # 取っ手：細い線のかけら（円盤のふちの線）を除き、いちばん大きなかたまりだけ。ふちを1px 内側に
    crank = ndimage.binary_opening(crank, iterations=3)
    lab2, n2 = ndimage.label(crank)
    if n2 > 1:
        sizes = ndimage.sum(crank, lab2, range(1, n2 + 1))
        crank = lab2 == int(np.argmax(sizes)) + 1
    ck = np.zeros((h, w, 4), np.uint8)
    ck[..., :3] = im.astype(np.uint8)
    ck[..., 3] = np.where(ndimage.binary_erosion(crank, iterations=1), 255, 0)
    ck[..., 3] = np.array(Image.fromarray(ck[..., 3]).filter(ImageFilter.GaussianBlur(0.8)))

    # 回す中心を真ん中にした正方形（回しても取っ手がはみ出さない大きさ）
    r = int(np.hypot(xx - PIVOT[0], yy - PIVOT[1])[obj].max()) + 8
    box = (PIVOT[0] - r, PIVOT[1] - r, PIVOT[0] + r, PIVOT[1] + r)
    save(Image.fromarray(rgba, 'RGBA').crop(box).resize((HANDLE_SIZE, HANDLE_SIZE), Image.LANCZOS), 'handle_disc.webp')
    save(Image.fromarray(ck, 'RGBA').crop(box).resize((HANDLE_SIZE, HANDLE_SIZE), Image.LANCZOS), 'handle_crank.webp')


def keyed(im: np.ndarray, box: tuple[int, int, int, int]) -> Image.Image:
    """参考シートの一部を切り出し、外側につながる市松模様（明るい無彩色）を透明にする"""
    x0, y0, x1, y1 = (round(v * SHEET_SCALE) for v in box)
    sub = im[y0:y1, x0:x1]
    mx, mn = sub.max(-1), sub.min(-1)
    checker = (mn > 180) & ((mx - mn) <= 10)
    lab, _ = ndimage.label(checker)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    alpha = np.where(np.isin(lab, list(edge)), 0, 255).astype(np.uint8)
    alpha = np.array(Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)))
    img = Image.fromarray(np.dstack([sub.astype(np.uint8), alpha]), 'RGBA')
    return img.crop(img.getbbox())


def sheet(src: Path) -> None:
    im = np.array(Image.open(src).convert('RGB')).astype(int)
    front = keyed(im, MACHINE_FRONT)
    save(front.crop((0, 0, front.width, MACHINE_TOP_H)), 'machine_top.webp', width=480)
    save(keyed(im, TRAY_CLOSED), 'tray_closed.webp', width=260)
    save(keyed(im, TRAY_OPEN), 'tray_open.webp', width=260)


def main() -> None:
    src = Path(sys.argv[1])
    handle(src / 'Handle_Official_Reference.jpeg')
    sheet(src / 'Gacha_Tray_8Frame_Reference.png')


if __name__ == '__main__':
    main()
