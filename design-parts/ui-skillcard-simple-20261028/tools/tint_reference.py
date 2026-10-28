import sys
import numpy as np
from PIL import Image
def tint(p, color):
    a = np.array(Image.open(p).convert('RGBA')).astype(float)
    rgb, al = a[..., :3], a[..., 3]
    r, b = rgb[..., 0], rgb[..., 2]
    gold = (r - b > 40)
    silver = (al > 0) & ~gold
    c = np.array(color, float)
    dark, mid, light = c * 0.45, c, c + (255 - c) * 0.7
    t = (rgb.mean(-1) / 255.0)[..., None]
    col = np.where(t < 0.6, dark + (mid - dark) * np.clip(t / 0.6, 0, 1), mid + (light - mid) * np.clip((t - 0.6) / 0.4, 0, 1))
    out = rgb.copy(); out[silver] = col[silver]
    return Image.fromarray(np.dstack([out, al]).astype('uint8'), 'RGBA'), gold & (al > 0), silver
for p, name in [(sys.argv[1], 'hand'), (sys.argv[2], 'normal')]:
    for cname, col in [('mint', (0xA8, 0xDC, 0xC4)), ('silver', None)]:
        im = Image.open(p).convert('RGBA') if col is None else tint(p, col)[0]
        bg = Image.new('RGBA', im.size, (30, 120, 60, 255))  # 濃い緑の上でふちの白いにじみを見る
        bg.alpha_composite(im); bg.save(f'chk_{name}_{cname}.png')
    _, g, s = tint(p, (0xA8, 0xDC, 0xC4))
    print(name, 'gold px', g.sum(), 'silver px', s.sum())
