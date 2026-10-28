"""街の部品（2026-10-28 納品）の色を落ち着かせる。ユーザー承認 2026-10-28（比較画像 town_tone_compare.png の下の版）。
使い方：python3 -I town_tone_20261028.py 入力フォルダ 出力フォルダ
入力フォルダの *.png をすべて同じ名前で出力フォルダへ（Mistral_Town_24Parts_Review.png は除く）。原本は変えない。
あざやかさ：青・水色 ×0.74（明るさも ×0.92）／緑 ×0.80／金 ×0.84／赤 ×0.85／ほか ×0.88。透明度はそのまま。
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
import matplotlib.colors as mc

def tone(im: Image.Image) -> Image.Image:
    im = im.convert('RGBA')
    a = np.asarray(im).astype(np.float32) / 255
    hsv = mc.rgb_to_hsv(a[..., :3])
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    blue = (h > 0.53) & (h < 0.72)
    green = (h > 0.20) & (h < 0.45)
    gold = (h > 0.07) & (h < 0.17) & (s > 0.45)
    red = ((h < 0.05) | (h > 0.95)) & (s > 0.45)
    k = np.full(s.shape, 0.88, np.float32)
    k[blue] = 0.74; k[green] = 0.80; k[gold] = 0.84; k[red] = 0.85
    s *= k
    v[blue] *= 0.92
    out = np.concatenate([mc.hsv_to_rgb(np.stack([h, s, v], -1)), a[..., 3:]], -1)
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype('uint8'), 'RGBA')

if __name__ == '__main__':
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    dst.mkdir(parents=True, exist_ok=True)
    for p in sorted(src.glob('*.png')):
        if p.name == 'Mistral_Town_24Parts_Review.png':
            continue
        tone(Image.open(p)).save(dst / p.name)
        print(p.name)
