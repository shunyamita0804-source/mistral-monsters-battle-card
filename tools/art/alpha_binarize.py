"""バトル用の透過 PNG の透明度を 0／255 にそろえる（2026-11-05 指示書 AX：タイラント・ギアロス。届いた絵は透明度 224〜254 の所が多く、場のカードで背景がうっすら透ける）。
色は変えない。透明度だけ：
- 128 以上 → 255、128 より下 → 0
- ただし、輪郭のふち（不透明な所と透明な所の境目から 1px）は元の透明度のまま残す（ギザギザにしない）
python3 -I tools/art/alpha_binarize.py <原本.png> <出力.png>
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
im = np.array(Image.open(src).convert('RGBA'))
a = im[..., 3]
solid = a >= 128
# 境目：不透明な所のすぐ外とすぐ内の 1px
edge = ndimage.binary_dilation(solid, iterations=1) & ndimage.binary_dilation(~solid, iterations=1)
out = im.copy()
out[..., 3] = np.where(edge, a, np.where(solid, 255, 0))
Image.fromarray(out).save(dst, optimize=True)
b = out[..., 3]
print(dst, 'ふちの半透明', round(float(((b > 0) & (b < 255)).mean()), 4), '不透明', round(float((b == 255).mean()), 3))
