# -*- coding: utf-8 -*-
"""カードショップの棚・ショーケースの商品（2026-10-29 ZIP「Mistral_Packs7_Shop_Status」の shop/。依頼文 09_shop_display.md の B の形）。

tools/design/cardshop_v2.py が家具の絵を書き出す前に dress() を呼ぶ。原本は描き直さない（商品の絵を縮める・傾ける・重ねるだけ）。

- 家具の絵の中の無地の紺のカード・パック（青みのある所）の中だけに商品を重ねる（棚板・柱・ふちは手前のまま）
  - 壁の棚・小さな展示台・手前の展示台の下の段（PACK_ROWS）：青みのある所を棚の段ごとに探し、立てたパック（shop_pack_*）を
    段の下の線の傾きに合わせて並べる
  - ガラスの展示台（中央の2つ・奥左の小さな台）・手前の展示台の板（CARD_SLOTS）：測った置き場所1つずつに、寝かせたカード（shop_card_*）を四すみに合わせて重ねる
    （小さな箱の上はそのまま縮めて、細長い箱には立てたパック）。ガラスの映りこみ（白っぽい光の筋）は、元の絵からもう一度上に重ねる
- 10種類（2026-10-29 夜にジオル、同じ日の深夜にフルーネ、そのあとセレフィーンを足した。商品の絵はパック専用の絵の版）を順に使い、同じものが隣り合わないようにする。明るさは家具に合わせて少しだけ落とす（色は変えない）
"""
from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/gacha-20261029/shop')
MONSTERS = ['soramo', 'gauul', 'lazuck', 'nobiton', 'myurol', 'kalshell', 'pukarim', 'geol', 'flune', 'serephine']

# 立てたパックを並べる家具：明るさ・パックの横の縮め（斜めに見える棚は細く）・はぶく所（看板の板など。絵の px の四角）
PACK_ROWS = {
    'left_wall': dict(light=0.86, squeeze=0.62, skip=[]),
    # 左の柱の上の紺の飾り・上の段の小さな宝箱は商品ではないので、はぶく
    'right_wall': dict(light=0.86, squeeze=0.62, skip=[(1340, 175, 1378, 206), (1358, 230, 1396, 300)]),
    'right_display': dict(light=0.9, squeeze=1.0, skip=[(1023, 420, 1126, 503)]),
    'back_left_shelf': dict(light=0.86, squeeze=0.5, skip=[]),
    # 手前の展示台の下の段（箱が2つずつ入っている所）
    'front_left': dict(light=0.86, squeeze=0.85, skip=[(50, 550, 435, 655)]),
}
# 寝かせたカードを重ねる所（絵の px。家具の絵を拡大して測った）。明るさ・置き場所の一覧
#  quad：無地のカード・板の四すみ（左上・右上・右下・左下）に、寝かせたカードの台形を合わせる（立てかけたカードに見える）
#  card：小さな箱の上など。寝かせたカードをそのまま四角に縮めて重ねる
#  pack：細長い箱。立てたパックを四角に縮めて重ねる
# どれも、元の絵の青みのある所（無地のカード・箱）の中だけに描く（金のふち・棚・ガラスの枠は手前のまま）
def _r(x1: int, y1: int, x2: int, y2: int) -> list[tuple[int, int]]:
    return [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]


CARD_SLOTS = {
    # 中央左のガラスの展示台：大きなカード 3×3・右の列の小さな箱 2×2 が3段
    'center_left': dict(light=0.92, slots=[
        *[('quad', _r(*b)) for b in [
            (290, 360, 313, 393), (317, 360, 337, 393), (340, 360, 361, 393),
            (279, 405, 303, 439), (307, 405, 329, 439), (332, 405, 356, 439),
            (268, 451, 294, 486), (297, 451, 323, 486), (326, 451, 351, 486)]],
        *[('card', b) for b in [
            (366, 367, 382, 384), (384, 367, 400, 384), (366, 385, 382, 400), (384, 385, 400, 400),
            (363, 407, 380, 425), (382, 407, 398, 425), (363, 426, 380, 442), (382, 426, 398, 442),
            (359, 450, 377, 468), (379, 450, 398, 468), (359, 469, 377, 486), (379, 469, 398, 486)]],
    ]),
    # 中央右のガラスの展示台：上の段に細長い箱3つと小さな箱 2×2、下の2段に大きなカード 3×2、右の列に小さな箱
    'center_right': dict(light=0.92, slots=[
        *[('pack', b) for b in [(425, 397, 438, 429), (440, 397, 453, 429), (454, 397, 468, 429)]],
        *[('card', b) for b in [(469, 402, 487, 417), (487, 402, 503, 417), (469, 417, 487, 432), (487, 417, 503, 432),
                                (475, 442, 489, 453), (489, 442, 502, 453), (475, 453, 489, 468), (489, 453, 502, 468)]],
        *[('pack', b) for b in [(475, 470, 489, 495), (489, 470, 502, 495)]],
        *[('quad', _r(*b)) for b in [
            (415, 437, 435, 467), (436, 437, 454, 467), (454, 437, 473, 467),
            (412, 466, 428, 491), (431, 466, 447, 491), (450, 466, 467, 491)]],
    ]),
    # 手前左の展示台：立てかけた大きな板4枚（下の段の箱は PACK_ROWS）
    # 奥左の小さなガラスの展示台：立てかけたカード2枚
    'back_left': dict(light=0.92, slots=[
        ('quad', [(270, 163), (298, 166), (297, 206), (269, 203)]),
        ('quad', [(306, 166), (334, 170), (333, 209), (305, 206)]),
    ]),
    # 板は上のほうがライトで明るく青みが無いので、青みの所ではなく四すみの中に描く（whole）
    'front_left': dict(light=0.95, whole=True, slots=[
        ('quad', [(102, 572), (150, 577), (138, 625), (92, 622)]),
        ('quad', [(180, 573), (230, 578), (217, 633), (170, 630)]),
        ('quad', [(253, 580), (308, 585), (300, 637), (247, 635)]),
        ('quad', [(332, 585), (392, 587), (383, 640), (323, 638)]),
    ]),
}

# 2026-10-29 夜 iPhone「手前の額のカード（カルシェル・プカリム）が横に引きのばされている」：額は正方形に近いので、
# 四すみいっぱいに合わせると横にのびる。カードの縦横の比（CARD_ASPECT。ガラスの展示台の置き場所と同じ 0.7）より横長の置き場所は、
# 上下はそのままに、上の辺・下の辺をそれぞれ真ん中へ縮めた台形に置く（額の左右には元の紺の板が見える）。
# 小さな箱（card）・細長い箱（pack）も、縦横の比を変えずに箱の中に収める（あまりは元の箱の色）
CARD_ASPECT = 0.7

_cache: dict[str, Image.Image] = {}


def _product(kind: str, name: str) -> Image.Image:
    key = f'{kind}_{name}'
    if key not in _cache:
        im = Image.open(os.path.join(SRC, f'shop_{kind}_{name}.png')).convert('RGBA')
        _cache[key] = im.crop(im.getbbox())
    return _cache[key]


class _Cycle:
    """10種類を順に（同じものが隣り合わない）"""

    def __init__(self, start: int) -> None:
        self.i = start

    def next(self) -> str:
        name = MONSTERS[self.i % len(MONSTERS)]
        self.i += 1
        return name


def _dim(im: Image.Image, light: float) -> Image.Image:
    a = np.array(im).astype(float)
    a[..., :3] *= light
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def _skip_mask(shape: tuple[int, int], skip: list) -> np.ndarray:
    m = np.zeros(shape, bool)
    for x1, y1, x2, y2 in skip:
        m[y1:y2, x1:x2] = True
    return m


def _regions(a: np.ndarray) -> tuple[np.ndarray, int]:
    """棚の段ごとの無地の箱の所（青みのある所をつなぐ）"""
    r, g, b, al = (a[..., i].astype(int) for i in range(4))
    m = (al > 200) & (b > r + 8)
    m = ndimage.binary_closing(m, iterations=3)
    m = ndimage.binary_opening(ndimage.binary_fill_holes(m), iterations=2)
    return ndimage.label(ndimage.binary_fill_holes(m))


def _paste_clipped(canvas: np.ndarray, piece: Image.Image, x: int, y: int, clip: np.ndarray) -> None:
    """piece を (x, y) に、clip の中だけ重ねる（canvas は RGBA の float 配列）"""
    h, w = clip.shape
    p = np.array(piece).astype(float)
    x1, y1 = max(0, x), max(0, y)
    x2, y2 = min(w, x + piece.width), min(h, y + piece.height)
    if x1 >= x2 or y1 >= y2:
        return
    sub = p[y1 - y:y2 - y, x1 - x:x2 - x]
    alpha = sub[..., 3:4] / 255 * clip[y1:y2, x1:x2, None]
    canvas[y1:y2, x1:x2, :3] = canvas[y1:y2, x1:x2, :3] * (1 - alpha) + sub[..., :3] * alpha


def _shear_pack(pack: Image.Image, w: int, h: int, k: float) -> tuple[Image.Image, int]:
    """パックを w×h にして、右へ行くほど k だけ下がる（棚の段の傾き）ように縦にずらす。上のずれ（負なら上へ）も返す"""
    p = pack.resize((max(1, w), max(1, h)), Image.LANCZOS)
    dy = k * w
    top = int(np.floor(min(0.0, dy)))
    out_h = h + int(np.ceil(abs(dy))) + 1
    # 出力 (X, Y) ← 元 (X, Y - k X + off)
    off = -min(0.0, dy)
    sheared = p.transform((w, out_h), Image.AFFINE, (1, 0, 0, -k, 1, -off), resample=Image.BICUBIC)
    return sheared, top


def _pack_rows(a: np.ndarray, out: np.ndarray, cfg: dict, cyc: _Cycle) -> None:
    lab, n = _regions(a)
    skip = _skip_mask(lab.shape, cfg['skip'])
    for i in range(1, n + 1):
        m = lab == i
        if m.sum() < 150 or (m & skip).sum() > m.sum() * 0.5:
            continue
        ys, xs = np.nonzero(m)
        cols = np.arange(xs.min(), xs.max() + 1)
        bot = np.array([ys[xs == c].max() if (xs == c).any() else np.nan for c in cols])
        top = np.array([ys[xs == c].min() if (xs == c).any() else np.nan for c in cols])
        ok = ~np.isnan(bot)
        k, c0 = np.polyfit(cols[ok], bot[ok], 1) if ok.sum() > 3 else (0.0, float(np.nanmax(bot)))
        hgt = int(np.nanpercentile(bot - top, 75)) + 3
        pack0 = _product('pack', 'soramo')
        pw = max(6, round(hgt * pack0.width / pack0.height * cfg['squeeze']))
        clip = ndimage.binary_dilation(m, iterations=1).astype(float)
        x = int(cols[0]) - 1
        while x < cols[-1] + 1:
            piece, dtop = _shear_pack(_dim(_product('pack', cyc.next()), cfg['light']), pw, hgt, k)
            ybot = k * x + c0 + 2
            _paste_clipped(out, piece, x, int(round(ybot - hgt)) + dtop, clip)
            x += pw


def _card_corners(card: Image.Image) -> list[tuple[float, float]]:
    """寝かせたカードの絵の四すみ（台形）"""
    al = np.array(card)[..., 3] > 128
    rows = np.nonzero(al.any(1))[0]
    t, b = rows[0], rows[-1]
    tx = np.nonzero(al[t + 1])[0]
    bx = np.nonzero(al[b - 1])[0]
    return [(tx[0], t), (tx[-1], t), (bx[-1], b), (bx[0], b)]


def _persp_coeffs(src: list, dst: list) -> list[float]:
    """出力の点 dst → 元の点 src の射影変換の係数（PIL の PERSPECTIVE）"""
    rows = []
    for (x, y), (u, v) in zip(dst, src):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    return np.linalg.solve(np.array(rows, float), np.array(src, float).reshape(8)).tolist()


def _bluish(a: np.ndarray) -> np.ndarray:
    """元の絵の青みのある所（無地のカード・箱。金の細いふちもつなぐ）"""
    r, g, b, al = (a[..., i].astype(int) for i in range(4))
    m = ndimage.binary_closing((al > 200) & (b > r + 8), iterations=2)
    return ndimage.binary_fill_holes(m)


def _fit_quad(pts: list[tuple[int, int]]) -> list[tuple[float, float]]:
    """置き場所の四すみ（左上・右上・右下・左下）が CARD_ASPECT より横長なら、上の辺・下の辺を真ん中へ縮める"""
    p = [np.array(q, float) for q in pts]
    w = (np.linalg.norm(p[1] - p[0]) + np.linalg.norm(p[2] - p[3])) / 2
    h = (np.linalg.norm(p[3] - p[0]) + np.linalg.norm(p[2] - p[1])) / 2
    f = min(1.0, CARD_ASPECT * h / w)
    out = []
    for a, b in ((p[0], p[1]), (p[3], p[2])):
        m = (a + b) / 2
        out.append((m + (a - m) * f, m + (b - m) * f))
    (tl, tr), (bl, br) = out
    return [tuple(tl), tuple(tr), tuple(br), tuple(bl)]


def _fit_box(src: Image.Image, x1: int, y1: int, x2: int, y2: int) -> tuple[Image.Image, int, int, list[tuple[int, int]]]:
    """箱（x1, y1, x2, y2）の中に、縦横の比を変えずに収める（真ん中に置く）。絵・左上・描く範囲を返す"""
    bw, bh = x2 - x1 + 2, y2 - y1 + 2
    k = min(bw / src.width, bh / src.height)
    pw, ph = max(1, round(src.width * k)), max(1, round(src.height * k))
    px, py = x1 - 1 + (bw - pw) // 2, y1 - 1 + (bh - ph) // 2
    return src.resize((pw, ph), Image.LANCZOS), px, py, _r(px, py, px + pw, py + ph)


def _card_slots(a: np.ndarray, out: np.ndarray, cfg: dict, cyc: _Cycle) -> None:
    h, w = a.shape[:2]
    blue = _bluish(a)
    for kind, pts in cfg['slots']:
        if kind == 'quad':
            card = _dim(_product('card', cyc.next()), cfg['light'])
            fit = _fit_quad(pts)
            coeffs = _persp_coeffs(_card_corners(card), fit)
            piece, x0, y0 = card.transform((w, h), Image.PERSPECTIVE, coeffs, resample=Image.BICUBIC), 0, 0
            poly = [(round(x), round(y)) for x, y in fit]
        else:
            x1, y1, x2, y2 = pts
            src = _product('card' if kind == 'card' else 'pack', cyc.next())
            piece, x0, y0, poly = _fit_box(_dim(src, cfg['light']), x1, y1, x2, y2)
        area = Image.new('L', (w, h), 0)
        ImageDraw.Draw(area).polygon(poly, fill=255)
        inside = np.array(area) > 0 if cfg.get('whole') else ndimage.binary_dilation(np.array(area) > 0, iterations=2)
        _paste_clipped(out, piece, x0, y0, (inside if cfg.get('whole') else inside & blue).astype(float))


def _glass_highlights(orig: np.ndarray, out: np.ndarray, changed: np.ndarray) -> None:
    """ガラスの映りこみ（元の絵の白っぽい光）を、商品の上にもう一度重ねる"""
    mn = orig[..., :3].min(2).astype(float)
    hl = np.clip((mn - 70) / 120, 0, 0.7) * changed
    out[..., :3] = out[..., :3] * (1 - hl[..., None]) + orig[..., :3] * hl[..., None]


def dress(name: str, im: Image.Image) -> Image.Image:
    """家具の絵に商品を重ねた写しを返す（商品を置かない家具はそのまま）"""
    if name not in PACK_ROWS and name not in CARD_SLOTS:
        return im
    a = np.array(im.convert('RGBA'))
    out = a.astype(float)
    cyc = _Cycle(sorted(set(PACK_ROWS) | set(CARD_SLOTS)).index(name) * 3)
    if name in CARD_SLOTS:
        _card_slots(a, out, CARD_SLOTS[name], cyc)
    if name in PACK_ROWS:
        _pack_rows(a, out, PACK_ROWS[name], cyc)
    if name in ('center_left', 'center_right', 'back_left'):
        changed = (np.abs(out[..., :3] - a[..., :3]).sum(2) > 0).astype(float)
        _glass_highlights(a, out, changed)
    out[..., 3] = a[..., 3]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
