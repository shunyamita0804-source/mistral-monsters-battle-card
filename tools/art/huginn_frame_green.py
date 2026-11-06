"""フギンの正式カードの絵の枠だけを、深い翠の緑 #1E6B45 寄りにする（2026-11-06 指示書 BM の直し・ユーザー指示。前の枠の色 #135853 前後はハクランと見分けにくかった）。
python3 -I tools/art/huginn_frame_green.py

原本 design-parts/bm-huginn-20261106/art/huginn_official.png は変えない。出力は design-parts/bm-huginn-20261106/build/huginn_official_green.png（tools/art/huginn_assets.py がこれを使う）。
- 変える範囲は枠の位置で決める（絵の中の羽も同じ青緑なので、色だけでは選ばない）：
  ふちの帯（ふちから BAND px。内側の白い線まで）・四すみの飾り（CORNER px 四方）・右上の LIFE の札（LIFE_BOX）
- その範囲の中で、青緑の色合い（色相 HUE_LO〜HUE_HI 度）の画素だけ、色相を #1E6B45 の色相へ回す（明るさ・あざやかさは変えない。白い文字・線はほぼ変わらない）。
  範囲の内側のはしは FEATHER px かけてなめらかに弱める
"""
import colorsys
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/bm-huginn-20261106/art/huginn_official.png')
OUT = os.path.join(ROOT, 'design-parts/bm-huginn-20261106/build/huginn_official_green.png')
TARGET = '#1E6B45'
BAND = 31
CORNER = 105
FEATHER = 3
LIFE_BOX = (745, 0, 970, 245)  # 左・上・右・下（原本 970×1622 の px）
HUE_LO, HUE_HI = 150, 200


def region(w: int, h: int) -> np.ndarray:
    m = np.zeros((h, w), bool)
    m[:BAND, :] = m[-BAND:, :] = True
    m[:, :BAND] = m[:, -BAND:] = True
    for ys in (slice(0, CORNER), slice(h - CORNER, h)):
        for xs in (slice(0, CORNER), slice(w - CORNER, w)):
            m[ys, xs] = True
    l, t, r, b = LIFE_BOX
    m[t:b, l:r] = True
    return m


def main() -> None:
    im = np.array(Image.open(SRC).convert('RGB')).astype(np.float32) / 255
    h, w, _ = im.shape
    # 範囲の中だけ（外の絵には出さない）。範囲の内側のはしから FEATHER px で 0 → 1
    reg = region(w, h)
    padded = np.pad(reg, 1, constant_values=True)  # 絵のふちは範囲のはしにしない
    inside = ndimage.distance_transform_edt(padded)[1:-1, 1:-1]
    weight = np.where(reg, np.clip(inside / FEATHER, 0, 1), 0).astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mx, mn = im.max(-1), im.min(-1)
    d = np.where(mx - mn == 0, 1, mx - mn)
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    hue = np.where(mx - mn == 0, 0, hue)
    teal = (hue >= HUE_LO) & (hue <= HUE_HI)
    tr, tg, tb = (int(TARGET[i:i + 2], 16) / 255 for i in (1, 3, 5))
    target_hue = colorsys.rgb_to_hsv(tr, tg, tb)[0] * 360
    shift = np.where(teal, (target_hue - hue) * weight, 0)
    new_hue = (hue + shift) % 360
    # 色相だけ回す（HSV の S・V はそのまま）
    s = np.where(mx == 0, 0, (mx - mn) / np.where(mx == 0, 1, mx))
    v = mx
    hh = new_hue / 60
    i = np.floor(hh).astype(int) % 6
    f = hh - np.floor(hh)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    out = np.zeros_like(im)
    for k, (cr, cg, cb) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        sel = i == k
        out[..., 0][sel], out[..., 1][sel], out[..., 2][sel] = cr[sel], cg[sel], cb[sel]
    changed = teal & (weight > 0)
    res = np.where(changed[..., None], out, im)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    Image.fromarray(np.clip(res * 255 + 0.5, 0, 255).astype(np.uint8), 'RGB').save(OUT)
    print('ok', int(changed.sum()), 'px', round(target_hue))


if __name__ == '__main__':
    main()
