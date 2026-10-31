"""ガチャのパック：型（pack_template_symmetric.png）の縁のクリーム色をモンスターの色にして、届いた絵の上に重ねる。
使い方: python3 -I pack_tint.py 型.png 入力フォルダ 出力フォルダ
（入力フォルダに pack_{名前}.png が無く pack_art_{名前}.png〔窓の絵〕だけあるときは、型の大きさに合わせてから重ねる。WINDOW_FIT のものは窓に収める）
"""
import sys, colorsys
import numpy as np
from PIL import Image

COLORS = {
    'soramo': '#E4D2AC', 'gauul': '#E68A46', 'lazuck': '#844DC5', 'nobiton': '#E8C654',
    'myurol': '#84E5FA', 'kalshell': '#DFF2F6', 'pukarim': '#A8DCC4', 'geol': '#9A7B5C',
    'flune': '#9CBF5A', 'serephine': '#8FA6E8',
    'tsumuji': '#8FA3B8',  # 2026-10-30 ツムジ（くすんだ青みの灰）
    'hyouzuku': '#C8CCD4',  # 2026-10-30 ヒョウズク（銀に近い白。指示書 W）
    'shishien': '#3E3A3F',  # 2026-10-31 シシエン（炭色。指示書 AB）
    'hakuran': '#237C7A',  # 2026-10-31 ハクラン（青緑・ティール。指示書 AF）
    'desuoru': '#1E2B58',  # 2026-10-31 デスオル（紺。指示書 AG。暗い色のしかた）
    'tools': '#B8BCC4',  # 2026-10-30 道具のパック（仮）（銀。指示書 Z）
}

# この明るさより暗い色は、縁の明るさもその色に寄せる（ほかの色は前と同じ）
DARK = 0.35
# 縁の明るさをさらに下げるモンスター（下げる量。2026-10-31 指示書 AF2：ハクランの縁がミュロルの水色に近く見えたので、今より暗い青緑に）
DEEPER = {'hakuran': 0.12}

# 窓の絵を、型の窓（左・上・幅・高さ。型の px）にちょうど収めるもの（cover で型いっぱいに広げない）。
# ミュロル：前の完成のパック（デザイン担当が型に入れた版。design-parts/gacha-20261029/art_v1/pack_myurol.png）は、窓の絵を 695×1218 に縮めて
# 窓の (121, 232) に置いていた（前の窓の絵とくらべて測った）。描き直した窓の絵（2026-10-31 指示書 AC【3】）も同じ収め方にして、顔の位置を前と同じにする
WINDOW_FIT = {'myurol': (121, 232, 695, 1218)}

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

def tint_template(tpl: np.ndarray, hexcol: str, deeper: float = 0.0) -> np.ndarray:
    rgb = tpl[..., :3] / 255.0
    mx, mn = rgb.max(2), rgb.min(2)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    # クリーム色＝明るく彩度が低い所だけ（金・紺は変えない）
    w = smooth(mx, 0.62, 0.80) * (1 - smooth(sat, 0.22, 0.38))
    col = np.array([int(hexcol[i:i + 2], 16) for i in (1, 3, 5)]) / 255.0
    h, lc, sc = colorsys.rgb_to_hls(*col)
    l_orig = (mx + mn) / 2
    l_new = 0.5 + (l_orig - 0.5) * 0.72  # 明るさの濃淡は残し、少しだけ下げて色を見せる
    if lc < DARK:
        # 暗い色（シシエンの炭色）：色味が少ないので、明るさもその色に寄せないと銀の縁（ヒョウズク）と見分けられない（2026-10-31 指示書 AB）
        l_new = lc + (l_orig - 0.5) * 0.35 - deeper
    tinted = hls_to_rgb(h, l_new, min(sc, 0.8))
    keep = 0.15 if lc < DARK else 0.35  # 元の明るさを混ぜる割合（暗い色は少なく）
    mixed = keep * rgb + (1 - keep) * tinted
    out = rgb * (1 - w[..., None]) + mixed * w[..., None]
    res = tpl.copy().astype(float)
    res[..., :3] = out * 255
    return res.clip(0, 255).astype(np.uint8)

def cover(art, size):
    """窓の絵（pack_art_*.png。1042×1824 など）だけが届いたとき：型の高さに合わせて縮め、横は真ん中で切る
    （届いた完成のパックと窓の絵を比べると、この合わせ方で一致した〔ヒョウズク：1683/1824 倍・横の真ん中〕。2026-10-30 指示書 Z）"""
    w, h = size
    k = h / art.height
    a = art.resize((round(art.width * k), h), Image.LANCZOS)
    x = (a.width - w) // 2
    return a.crop((x, 0, x + w, h))

def main(tpl_path, src, dst):
    tpl = np.array(Image.open(tpl_path).convert('RGBA'))
    for name, hexcol in COLORS.items():
        try:
            art = Image.open(f'{src}/pack_{name}.png').convert('RGBA')
        except FileNotFoundError:
            try:
                window = Image.open(f'{src}/pack_art_{name}.png').convert('RGBA')
            except FileNotFoundError:
                continue
            if name in WINDOW_FIT:
                x, y, w, h = WINDOW_FIT[name]
                art = Image.new('RGBA', (tpl.shape[1], tpl.shape[0]), (0, 0, 0, 0))
                art.alpha_composite(window.resize((w, h), Image.LANCZOS), (x, y))
            else:
                art = cover(window, (tpl.shape[1], tpl.shape[0]))
        assert art.size == (tpl.shape[1], tpl.shape[0]), name
        frame = Image.fromarray(tint_template(tpl, hexcol, DEEPER.get(name, 0.0)), 'RGBA')
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
