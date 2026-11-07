# -*- coding: utf-8 -*-
"""販売機の窓を、モンスターの絵のパネルにする（2026-10-30 指示書 J。ユーザー「ガラスじゃないのがいい。現実世界のカードダスみたいに」）

使い方: python3 -I tools/design/gacha_panel_build.py

- 窓の内側（ガラスと奥行きのある内側の壁。900×1300 の px で PANEL_BOX）を、平らなパネルでおおう
- パネル：紺の地に、パックの絵（design-parts/gacha-20261029/pack_art/pack_art_*.png）を、顔が入るよう上の方を切り取って並べ、金のふちで区切る。まわりにも金のふち
- 窓の四すみの金の星の飾りは、機械の絵（machine_front）から切り出して、パネルの上に重ねる（machine_stars.webp）
- 描き直し・色の変更はしない（切り取る・縮める・並べるだけ）

出力（assets/images/ui/gacha/）
- panel_{シリーズID}.webp   ガチャの画面：選んだシリーズのパックの絵を1枚、大きく（PANEL_BOX の大きさ）
- panel_shop_group.webp     店の中の販売機：10体の集合の絵1枚（2026-11-02 指示書 AV。原本 design-parts/av-shop-machine-20261102/panel_shop_group.png）
- panel_fallback.webp       絵が無いシリーズの代わり：3×2（上 ソラモ・ガウル・カルシェル／下 ラズック・ノビトン・ミュロル。前は panel_shop の名前で店の中の販売機にも使っていた）
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
    'pukarim': (0.55, 0.32), 'serephine': (0.55, 0.24), 'tsumuji': (0.48, 0.56), 'hyouzuku': (0.66, 0.38),
    'shishien': (0.55, 0.28),
    'hakuran': (0.62, 0.26),  # 2026-10-31 指示書 AF：顔は絵の上のほうの真ん中より右
    'desuoru': (0.54, 0.29),  # 2026-10-31 指示書 AG：顔（フードの中の光る目）は絵の上から3分の1くらいの真ん中
    'lilil': (0.62, 0.25),  # 2026-11-02 指示書 AK2：顔は絵の上のほう、真ん中より少し右
    'forn': (0.58, 0.2),  # 2026-11-02 指示書 AL：顔は絵の上のほう、真ん中より少し右（角が入るように）
    'uzurio': (0.58, 0.3),  # 2026-11-02 指示書 AQ：顔は絵の上から約3割、真ん中より少し右
    'gearos': (0.5, 0.42),  # 2026-11-05 指示書 AX：単眼は絵の真ん中より少し上
    'kuyo': (0.46, 0.2),
    'kuroshio': (0.5, 0.5),  # 2026-11-06 指示書 BK：顔（目と白い玉）は絵の真ん中
    'rouga': (0.3, 0.2),  # 2026-11-06 指示書 BL：顔（とおぼえ）は絵の左上
    'huginn': (0.5, 0.3),  # 2026-11-06 指示書 BM：2つの頭が入るように（絵の上から3割の真ん中）
    'nous': (0.5, 0.22),  # 2026-11-07 指示書 BN：水晶の頭（絵の上から 10〜25％）が入るように
    'beniou': (0.5, 0.3),  # 2026-11-07 指示書 BP：顔と角（絵の上から約30〜40％）が入るように
    'radiel': (0.52, 0.3),  # 2026-11-05 指示書 BI：顔は絵の上から3割の真ん中（窓の絵はパックから切り抜いた build/pack_art_radiel.png）  # 2026-11-05 指示書 BH：顔は絵の上から2割、真ん中より少し左（窓の絵はパックから切り抜いた build/pack_art_kuyo.png）
    # 道具のパック（仮）：顔は無いので、絵の真ん中（手帳と薬草のあたり。2026-10-30 指示書 Z）
    'tools': (0.50, 0.52),
}
# パックの窓の絵がほかの所にあるもの（道具のパックの原本は design-parts/support-art-z-20261030/）
PACK_ART_PATH = {
    'tools': os.path.join(ROOT, 'design-parts/support-art-z-20261030/pack_art_tools.png'),
    # 2026-11-05 指示書 BH：クヨウはパックの絵だけが届いたので、窓の中を切り抜いたもの（tools/art/kuyo_assets.py）
    'kuyo': os.path.join(ROOT, 'design-parts/bh-kuyo-20261105/build/pack_art_kuyo.png'),
    'radiel': os.path.join(ROOT, 'design-parts/bi-radiel-20261105/build/pack_art_radiel.png'),
    # 2026-11-06 指示書 BK：クロシオは窓の絵が届いた（原本のまま）
    'kuroshio': os.path.join(ROOT, 'design-parts/bk-kuroshio-20261106/art/pack_art_kuroshio.png'),
    'rouga': os.path.join(ROOT, 'design-parts/bl-rouga-20261106/art/pack_art_rouga.png'),
    'huginn': os.path.join(ROOT, 'design-parts/bm-huginn-20261106/art/pack_art_huginn.png'),
    'nous': os.path.join(ROOT, 'design-parts/bn-nous-20261107/art/pack_art_nous.png'),
    'beniou': os.path.join(ROOT, 'design-parts/bp-beniou-20261107/art/pack_art_beniou.png'),
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
            art = Image.open(PACK_ART_PATH.get(name, os.path.join(PACK_ART, f'pack_art_{name}.png'))).convert('RGB')
            pic = crop_face(art, FACE[name], bw / bh, 0.85 if rows * cols > 1 else 1.0).resize((bw, bh), Image.LANCZOS)
            im.paste(pic, (x1 + INSET, y1 + INSET))
            # 絵のまわりの細い金の線
            d.rectangle([x1 + INSET - 2, y1 + INSET - 2, x1 + INSET + bw + 1, y1 + INSET + bh + 1], outline=GOLD, width=2)
    return im


# 店の中の販売機の窓の絵（2026-11-02 指示書 AV。ユーザーと進行が合格にした10体の集合の絵。原本は手を加えずに保管）
SHOP_GROUP_ART = os.path.join(ROOT, 'design-parts/av-shop-machine-20261102/panel_shop_group.png')


def group_panel() -> Image.Image:
    """集合の絵1枚を、パネル（PANEL_BOX の大きさ）に。まわりの金のふち・紺は1枚のパネルと同じ。絵は縦横の比を保って真ん中を切り取る（顔は四すみの星にかからない）"""
    pw, ph = PANEL_BOX[2] - PANEL_BOX[0], PANEL_BOX[3] - PANEL_BOX[1]
    im = Image.new('RGBA', (pw, ph), GOLD + (255,))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, pw - 1, ph - 1], outline=GOLD_DARK, width=2)
    d.rectangle([4, 4, pw - 5, ph - 5], outline=GOLD_LIGHT, width=1)
    x1, y1, x2, y2 = FRAME, FRAME, pw - FRAME, ph - FRAME
    d.rectangle([x1 - 1, y1 - 1, x2, y2], fill=GOLD_DARK)
    d.rectangle([x1, y1, x2 - 1, y2 - 1], fill=NAVY)
    bw, bh = x2 - x1 - 2 * INSET, y2 - y1 - 2 * INSET
    art = Image.open(SHOP_GROUP_ART).convert('RGB')
    pic = crop_face(art, (0.5, 0.45), bw / bh, 1.0).resize((bw, bh), Image.LANCZOS)
    im.paste(pic, (x1 + INSET, y1 + INSET))
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
    group_panel().save(os.path.join(GACHA_UI, 'panel_shop_group.webp'), quality=90, method=6)
    panel(SHOP_GRID).save(os.path.join(GACHA_UI, 'panel_fallback.webp'), quality=90, method=6)
    for name in FACE:
        panel([[name]]).save(os.path.join(GACHA_UI, f'panel_{name}.webp'), quality=90, method=6)
    stars().save(os.path.join(GACHA_UI, 'machine_stars.webp'), quality=92, method=6)
    print('ok')


if __name__ == '__main__':
    main()
