"""ロウガの正式カードの LIFE の数字を 8 → 7 にする（2026-11-06 ユーザー指示。ゲームの LIFE を 7 にしたため。BL の案 R1）。
python3 -I tools/art/rouga_life7.py

- 原本 design-parts/bl-rouga-20261106/art/rouga_official.png は変えない。直した絵は design-parts/bl-rouga-20261106/build/rouga_official_life7.png（tools/art/rouga_assets.py が使う）
- 「7」の形は、同じ書体のハクランの正式カード（design-parts/card-names-20261105/noname/14_hakuran_official_noname.png。LIFE 7）から切り出す
  （白い字の所だけ。ハクランの札の濃い色のふちは使わない）
- 札の色（藤色）・大きさは今のロウガのまま：
  1. ロウガの「8」（白い字とまわりの淡い影）を広めに消し、まわりの札の色を内側へ延ばして埋める（OpenCV の inpaint）
  2. ハクランの「7」を、ロウガの「8」と同じ字の高さ（112px。ハクランの 7 は 100px なので ×1.12）にして、8 と同じ下の線・同じ横の真ん中に置く
  3. 影は、ロウガの「8」と同じ付け方（右下に少しずらした、ぼかした暗い藤色）で付ける
"""
import os

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ROUGA = os.path.join(ROOT, 'design-parts/bl-rouga-20261106/art/rouga_official.png')
HAKURAN = os.path.join(ROOT, 'design-parts/card-names-20261105/noname/14_hakuran_official_noname.png')
OUT = os.path.join(ROOT, 'design-parts/bl-rouga-20261106/build/rouga_official_life7.png')

# ロウガの「8」の白い字の範囲（x 818〜902・y 93〜205）。ハクランの「7」（x 822〜893・y 105〜205）
EIGHT = (818, 93, 902, 205)
SEVEN = (822, 105, 893, 205)
# 影：右下へのずれ（px）・ぼかし・暗くする割合（ロウガの「8」のまわりを見て合わせた）
SHADOW_OFFSET = (2, 3)
SHADOW_BLUR = 3.0
SHADOW_DARK = 0.78
# 8 を消す範囲（白い字から広げる px）
HOLE_GROW = 17


def white_alpha(a: np.ndarray) -> np.ndarray:
    """白い字の不透明度（明るく色味の少ない所ほど 1。ふちのなめらかさも残す）"""
    f = a.astype(float)
    mn, mx = f.min(-1), f.max(-1)
    alpha = np.clip((mn - 150) / (225 - 150), 0, 1) * np.clip(1 - (mx - mn - 30) / 40, 0, 1)
    return alpha


def main() -> None:
    rouga = np.array(Image.open(ROUGA).convert('RGB'))
    hak = np.array(Image.open(HAKURAN).convert('RGB'))

    # 1. 「8」を消す：白い字の所（不透明度 0.15 以上）を、影の分まで広げて inpaint
    x0, y0, x1, y1 = EIGHT
    pad = 14
    box = rouga[y0 - pad:y1 + pad, x0 - pad:x1 + pad].copy()
    a8 = white_alpha(box)
    core = a8 > 0.15
    lab, _ = ndimage.label(core)
    # いちばん大きなかたまり（8）だけ
    sizes = ndimage.sum(core, lab, range(1, lab.max() + 1))
    eight = lab == (int(np.argmax(sizes)) + 1)
    # 8 の影（淡い暗い藤色）も残らないよう広めに消す。埋める色は、まわりの札（白い字・影を除いた輪）の色を
    # なめらかな面（x・y の2次式）で合わせたもの（札は細かい模様の無い、ゆるやかなグラデーション）
    hole = ndimage.binary_dilation(eight, iterations=HOLE_GROW)
    # 札の色は、ふちに近いほど少し暗い（ゆるやかなかげり）。なめらかな面では合わないので、まわりの色を穴の内側へ延ばす（OpenCV の inpaint・Navier-Stokes）
    filled = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(box, cv2.COLOR_RGB2BGR), hole.astype(np.uint8) * 255, 12, cv2.INPAINT_NS), cv2.COLOR_BGR2RGB).astype(float)
    # 延ばした色のすじをならす（穴の中だけ軽くぼかす）
    blur = np.stack([ndimage.gaussian_filter(filled[..., c], 3.0) for c in range(3)], -1)
    filled[hole] = blur[hole]
    # 境目をなじませる（穴のふちを広めに元の絵と混ぜる。8 の影のある所は必ず埋めた色）
    edge = np.clip(ndimage.gaussian_filter(hole.astype(float), 4.0) * 1.6, 0, 1)
    edge[ndimage.binary_dilation(eight, iterations=9)] = 1.0
    filled = box * (1 - edge[..., None]) + filled * edge[..., None]

    # 2. ハクランの「7」の形（白い字の所だけ）
    sx0, sy0, sx1, sy1 = SEVEN
    sp = 4
    src = hak[sy0 - sp:sy1 + sp, sx0 - sp:sx1 + sp]
    a7 = white_alpha(src)
    lab7, _ = ndimage.label(a7 > 0.15)
    s7 = ndimage.sum(a7 > 0.15, lab7, range(1, lab7.max() + 1))
    keep = ndimage.binary_dilation(lab7 == (int(np.argmax(s7)) + 1), iterations=2)
    a7 = a7 * keep
    k = (y1 - y0) / (sy1 - sy0)
    h7 = Image.fromarray((a7 * 255).astype(np.uint8)).resize((round(a7.shape[1] * k), round(a7.shape[0] * k)), Image.LANCZOS)
    a7s = np.array(h7).astype(float) / 255
    # 置く位置：8 と同じ下の線（y1）・同じ横の真ん中
    glyph = np.zeros(box.shape[:2])
    cx = (x0 + x1) / 2 - (x0 - pad)
    gh, gw = a7s.shape
    top = int(round((y1 - y0 + pad) - (gh - sp * k)))
    left = int(round(cx - gw / 2))
    assert top >= 0 and left >= 0 and top + gh <= glyph.shape[0] and left + gw <= glyph.shape[1], (top, left, gh, gw, glyph.shape)
    glyph[top:top + gh, left:left + gw] = a7s

    # 3. 影 → 白い字
    shadow = ndimage.gaussian_filter(np.roll(np.roll(glyph, SHADOW_OFFSET[1], 0), SHADOW_OFFSET[0], 1), SHADOW_BLUR)
    shadow = np.clip(shadow * 1.4, 0, 1)
    out = filled * (1 - shadow[..., None] * (1 - SHADOW_DARK))
    white = np.array([253, 252, 255], float)
    out = out * (1 - glyph[..., None]) + white * glyph[..., None]

    res = rouga.copy()
    res[y0 - pad:y1 + pad, x0 - pad:x1 + pad] = np.clip(out, 0, 255).astype(np.uint8)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    Image.fromarray(res).save(OUT)
    print('ok', OUT)


if __name__ == '__main__':
    main()
