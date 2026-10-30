# -*- coding: utf-8 -*-
"""販売機の窓を、モンスターの絵のパネルにする（2026-10-30 指示書 J。ユーザー「ガラスじゃないのがいい。現実世界のカードダスみたいに」）

使い方: python3 -I tools/design/gacha_panel_build.py

- 窓の内側（ガラスと奥行きのある内側の壁。900×1300 の px で PANEL_BOX）を、平らなパネルでおおう
- パネル：紺の地に、パックの絵（design-parts/gacha-20261029/pack_art/pack_art_*.png）を、顔が入るよう上の方を切り取って並べ、金のふちで区切る。まわりにも金のふち
- 窓の四すみの金の星の飾りは、機械の絵（machine_front）から切り出して、パネルの上に重ねる（machine_stars.webp）
- 描き直し・色の変更はしない（切り取る・縮める・並べるだけ）

出力（assets/images/ui/gacha/）
- panel_{シリーズID}.webp   ガチャの画面：選んだシリーズのパックの絵を1枚、大きく（PANEL_BOX の大きさ）
- panel_shop.webp           店の中の販売機：3×2（上 ソラモ・ガウル・カルシェル／下 ラズック・ノビトン・ミュロル）
- machine_stars.webp        四すみの星（900×1300。機械の絵と同じ位置）
"""
from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
GACHA_UI = os.path.join(ROOT, 'assets/images/ui/gacha')
PACK_ART = os.path.join(ROOT, 'design-parts/gacha-20261029/pack_art')

# 窓の内側（900×1300 の px。左・上・右・下）。内側の紺の壁・上下の奥行きも含めておおう
PANEL_BOX = (212, 268, 688, 740)
# パネルの色：紺の地・金のふち（機械の絵の金と紺から取った色）
NAVY = (22, 34, 84)
GOLD = (236, 178, 58)
GOLD_LIGHT = (255, 226, 140)
GOLD_DARK = (128, 70, 10)
FRAME = 12      # まわりの金のふち（px）
GAP = 8         # 絵と絵のあいだの金のふち（px）
INSET = 5       # 金のふちと絵のあいだの紺（px）
# 店の中の販売機の並び（上の段・下の段）
SHOP_GRID = [['soramo', 'gauul', 'kalshell'], ['lazuck', 'nobiton', 'myurol']]
# 顔の位置（パックの絵の幅・高さに対する割合）。切り取る範囲を顔に合わせる
FACE = {
    'soramo': (0.55, 0.30), 'gauul': (0.62, 0.26), 'kalshell': (0.55, 0.36), 'lazuck': (0.60, 0.30),
    'nobiton': (0.62, 0.30), 'myurol': (0.55, 0.30), 'flune': (0.50, 0.26), 'geol': (0.62, 0.34),
    'pukarim': (0.55, 0.32), 'serephine': (0.55, 0.24), 'tsumuji': (0.48, 0.56),
}
# 窓の四すみの星（machine_front の px。左・上・右・下）
STAR_BOXES = [(192, 252, 280, 345), (620, 252, 708, 345), (188, 677, 280, 756), (620, 677, 712, 756)]


def crop_face(art: Image.Image, face: tuple[float, float], aspect: float, width_frac: float) -> Image.Image:
    """パックの絵から、顔が上から 4 割の所に来るように、横：縦＝aspect の範囲を切り取る（絵の外にははみ出さない）"""
    w, h = art.size
    cw = min(w, round(w * width_frac))
    ch = round(cw / aspect)
    if ch > h:
        ch = h
        cw = round(ch * aspect)
    fx, fy = face[0] * w, face[1] * h
    x = min(max(0, round(fx - cw / 2)), w - cw)
    y = min(max(0, round(fy - ch * 0.4)), h - ch)
    return art.crop((x, y, x + cw, y + ch))


def panel(names: list[list[str]]) -> Image.Image:
    """紺の地に、絵を rows×cols に並べたパネル（PANEL_BOX の大きさ）。金の地の上に、まわり FRAME・あいだ GAP を残して紺の枠を置き、その中に絵"""
    pw, ph = PANEL_BOX[2] - PANEL_BOX[0], PANEL_BOX[3] - PANEL_BOX[1]
    rows, cols = len(names), len(names[0])
    im = Image.new('RGBA', (pw, ph), GOLD + (255,))
    d = ImageDraw.Draw(im)
    # まわりのふち：外に濃い線・少し内に明るい線
    d.rectangle([0, 0, pw - 1, ph - 1], outline=GOLD_DARK, width=2)
    d.rectangle([4, 4, pw - 5, ph - 5], outline=GOLD_LIGHT, width=1)
    iw = (pw - 2 * FRAME - (cols - 1) * GAP) / cols
    ih = (ph - 2 * FRAME - (rows - 1) * GAP) / rows
    for r, row in enumerate(names):
        for c, name in enumerate(row):
            x1, y1 = round(FRAME + c * (iw + GAP)), round(FRAME + r * (ih + GAP))
            x2, y2 = round(FRAME + c * (iw + GAP) + iw), round(FRAME + r * (ih + GAP) + ih)
            # 金のふちの内がわの濃い線・紺の地
            d.rectangle([x1 - 1, y1 - 1, x2, y2], fill=GOLD_DARK)
            d.rectangle([x1, y1, x2 - 1, y2 - 1], fill=NAVY)
            bw, bh = x2 - x1 - 2 * INSET, y2 - y1 - 2 * INSET
            art = Image.open(os.path.join(PACK_ART, f'pack_art_{name}.png')).convert('RGB')
            pic = crop_face(art, FACE[name], bw / bh, 0.85 if rows * cols > 1 else 1.0).resize((bw, bh), Image.LANCZOS)
            im.paste(pic, (x1 + INSET, y1 + INSET))
            # 絵のまわりの細い金の線
            d.rectangle([x1 + INSET - 2, y1 + INSET - 2, x1 + INSET + bw + 1, y1 + INSET + bh + 1], outline=GOLD, width=2)
    return im


def stars() -> Image.Image:
    """窓の四すみの金の星を、機械の絵から切り出す（金色の大きなかたまりだけ。窓の内側の小さな飾りは入れない）"""
    front = Image.open(os.path.join(GACHA_UI, 'machine_front.webp')).convert('RGBA')
    a = np.array(front)
    rgb = a[..., :3].astype(np.float32) / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    # 金と、その濃い茶の線（赤 > 緑 > 青・あざやか）
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    goldish = (r >= g) & (g > b) & (sat > 0.45) & (mx > 0.25) & (a[..., 3] > 100)
    out = np.zeros_like(a)
    for x1, y1, x2, y2 in STAR_BOXES:
        m = np.zeros(goldish.shape, bool)
        m[y1:y2, x1:x2] = goldish[y1:y2, x1:x2]
        lab, n = ndimage.label(m)
        if n == 0:
            continue
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = ndimage.binary_fill_holes(lab == (int(np.argmax(sizes)) + 1))
        # 星から窓の内側へのびる細い金の棒（窓の内側の壁に描かれていた所）は外す：細い所を消してから、星の形だけ戻す
        core = ndimage.binary_opening(keep, iterations=4)
        keep = keep & ndimage.binary_dilation(core, iterations=4)
        keep = ndimage.binary_dilation(keep, iterations=1)
        out[keep] = a[keep]
    return Image.fromarray(out)


def main() -> None:
    panel(SHOP_GRID).save(os.path.join(GACHA_UI, 'panel_shop.webp'), quality=90, method=6)
    for name in FACE:
        panel([[name]]).save(os.path.join(GACHA_UI, f'panel_{name}.webp'), quality=90, method=6)
    stars().save(os.path.join(GACHA_UI, 'machine_stars.webp'), quality=92, method=6)
    print('ok')


if __name__ == '__main__':
    main()
