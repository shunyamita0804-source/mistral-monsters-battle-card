"""ガチャのパック：型（pack_template_symmetric.png）の縁のクリーム色をモンスターの色にして、届いた絵の上に重ねる。
使い方: python3 -I pack_tint.py 型.png 入力フォルダ 出力フォルダ
"""
import sys, colorsys
import numpy as np
from PIL import Image

COLORS = {
    'soramo': '#E4D2AC', 'gauul': '#E68A46', 'lazuck': '#844DC5', 'nobiton': '#E8C654',
    'myurol': '#84E5FA', 'kalshell': '#DFF2F6', 'pukarim': '#A8DCC4', 'geol': '#9A7B5C',
}

def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def hls_to_rgb(h, l, s):
    """colorsys.hls_to_rgb を配列で（h・s は数、l は配列）"""
    m2 = np.where(l <= 0.5, l * (1 + s), l + s - l * s)
    m1 = 2 * l - m2
    def v(hh):
        hh = hh % 1.0
        return np.where(hh < 1 / 6, m1 + (m2 - m1) * hh * 6,
               np.where(hh < 0.5, m2,
               np.where(hh < 2 / 3, m1 + (m2 - m1) * (2 / 3 - hh) * 6, m1)))
    return np.stack([v(h + 1 / 3), v(h), v(h - 1 / 3)], -1)

def tint_template(tpl: np.ndarray, hexcol: str) -> np.ndarray:
    rgb = tpl[..., :3] / 255.0
    mx, mn = rgb.max(2), rgb.min(2)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    # クリーム色＝明るく彩度が低い所だけ（金・紺は変えない）
    w = smooth(mx, 0.62, 0.80) * (1 - smooth(sat, 0.22, 0.38))
    col = np.array([int(hexcol[i:i + 2], 16) for i in (1, 3, 5)]) / 255.0
    h, _, sc = colorsys.rgb_to_hls(*col)
    l_orig = (mx + mn) / 2
    l_new = 0.5 + (l_orig - 0.5) * 0.72  # 明るさの濃淡は残し、少しだけ下げて色を見せる
    tinted = hls_to_rgb(h, l_new, min(sc, 0.8))
    mixed = 0.35 * rgb + 0.65 * tinted
    out = rgb * (1 - w[..., None]) + mixed * w[..., None]
    res = tpl.copy().astype(float)
    res[..., :3] = out * 255
    return res.clip(0, 255).astype(np.uint8)

def main(tpl_path, src, dst):
    tpl = np.array(Image.open(tpl_path).convert('RGBA'))
    for name, hexcol in COLORS.items():
        try:
            art = Image.open(f'{src}/pack_{name}.png').convert('RGBA')
        except FileNotFoundError:
            continue
        assert art.size == (tpl.shape[1], tpl.shape[0]), name
        frame = Image.fromarray(tint_template(tpl, hexcol), 'RGBA')
        out = art.copy()
        out.alpha_composite(frame)
        # 型の外（透明な所）は透明のまま
        a = np.array(out)
        outside = (tpl[..., 3] < 10)
        inner = np.zeros(outside.shape, bool); inner[233:1450, 121:815] = True
        a[outside & ~inner, 3] = 0
        Image.fromarray(a, 'RGBA').save(f'{dst}/pack_{name}.png')
        print('ok', name)

if __name__ == '__main__':
    main(*sys.argv[1:4])
