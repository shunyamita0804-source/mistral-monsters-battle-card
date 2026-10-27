"""カードパック販売機（ガチャ）の専用画面の部品を作る（2026-10-27 カードショップ改修。ZIP「MistralBC_CardShop_Handoff_FIXED」）。

使い方：
  python3 -I tools/design/gacha_build.py design-parts/cardshop-20261027 design-parts/cardshop-assets-20261027/assets

1. 正式ハンドル（Handle_Official_Reference.jpeg。唯一の正式原画・描き直し禁止）を、白い背景を透明にして
   「動かない円盤（軸受けつき）」と「回る取っ手（軸・ひじ・青い玉）」に分ける（README の指示「固定円盤と回転クランクを切り分け、円盤中央を軸に回す」）。
   - 取っ手：円盤の外の部分と、円盤の上にかかる軸・ひじ（手で決めた多角形 CRANK_OVER_DISC）
   - 円盤：取っ手に隠れていた所は、絵を描き足さず、円盤の見えている所を同じ中心のまわりに回して写して埋める
     （軸受けの中は軸受けの中心 PIVOT のまわりに、ほかは円盤の中心 DISC のまわりに）
   - 2枚とも同じ大きさの正方形で、真ん中が回る中心（PIVOT）。ゲームは取っ手を真ん中を軸に回すだけ
2. 販売機の正面図（2026-10-27 ZIP「MistralBC_CardShop_Assets_20261027」の A・B・G。原本 design-parts/cardshop-assets-20261027/assets/）を
   WebP にする。重ねる部品は 900×1300 の同じキャンバスのまま（位置をずらさない・切り詰めない）。回す画面の背景だけ幅 780 に縮小
   （それまでの【仮】の機械の上半分・取り出し口〔参考シートからの切り出し〕は使わなくなったので消した）
絵は描き直さない（背景を透明にする・形式を変える・縮小するだけ。円盤の隠れていた所だけは上のとおり絵の中から写す）。

使い方の2つ目の引数に販売機の素材のフォルダ（design-parts/cardshop-assets-20261027/assets）。
書き出し先（assets/images/ui/gacha/）：handle_disc.webp・handle_crank.webp・machine_*.webp・outlet_*.webp・pack_sealed.webp・turn_bg.webp
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


# 販売機（A・B）：同じ 900×1300 のキャンバスで重ねる部品。ファイル名 → 書き出す名前
MACHINE_PARTS = {
    'gacha_machine_front': 'machine_front', 'gacha_machine_glass': 'machine_glass', 'gacha_machine_handle_seat': 'machine_seat',
    'gacha_outlet_closed': 'outlet_closed', 'gacha_outlet_open': 'outlet_open', 'gacha_outlet_front': 'outlet_front',
    'gacha_pack_sealed': 'pack_sealed',
}
TURN_BG_WIDTH = 780


def machine(src: Path) -> None:
    for name, out in MACHINE_PARTS.items():
        save(Image.open(src / f'{name}.png').convert('RGBA'), f'{out}.webp')
    save(Image.open(src / 'gacha_turn_bg.png').convert('RGB'), 'turn_bg.webp', width=TURN_BG_WIDTH)


def main() -> None:
    src = Path(sys.argv[1])
    handle(src / 'Handle_Official_Reference.jpeg')
    machine(Path(sys.argv[2]))


if __name__ == '__main__':
    main()
