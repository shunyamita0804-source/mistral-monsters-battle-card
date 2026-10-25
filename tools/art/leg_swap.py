# -*- coding: utf-8 -*-
"""歩きの絵で、反対の足の1歩を作る（2026-10-25）

ユーザー「歩くは左足しか出ていない。ロボットがカクカク動いているように見える」。描き直した歩きの絵（画像AI）は、上の段と下の段で
前に出る足を入れ替えずに描いていた（正面：8コマとも同じ足が前、横：同じ足が前の絵が4コマ・足を上げるのは手前の足だけ）。
ゲームのシート（9列×8行・1コマ 310×360・足元 (155, 338)）の1行を、決まった4コマから作り直す。

- 正面（front）：ズボンとブーツだけを股の中心で左右反転して、反対の足を前にする（コート・手・かばんはそのまま。
  tools/art/back_walk_swap_legs.py と同じ考え方）
- 横（side）：2本の足を切り分けて、手前の足と奥の足を入れ替える（奥にした足は少し暗く、重なりの順も入れ替える）

1周は「着く・沈む・足を運ぶ（後ろの足を上げる）・伸び上がる」×右足・左足。届いた絵のコマ A〜D から
  [A, B, S(C), S(D), S(A), S(B), C, D]（S＝反対の足にしたもの）。C は「前の足を上げたコマ」なので、反対の足にすると「後ろの足を運ぶ」になる

使い方:
  python3 tools/art/leg_swap.py シート.webp 行 front|side A,B,C,D [--out 出力.webp] [--check 確認.png]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
from match_stand import FH, FW, cell  # noqa: E402

CUT = 0.58  # 人物の上から何割より下を足とみなすか


def over(dst: np.ndarray, src: np.ndarray) -> np.ndarray:
    """src を dst の上に重ねる（どちらも float RGBA 0〜255）"""
    sa = src[..., 3:4] / 255
    da = dst[..., 3:4] / 255
    oa = sa + da * (1 - sa)
    rgb = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.concatenate([rgb, oa * 255], -1)


def masks(f: np.ndarray) -> tuple[np.ndarray, np.ndarray, int, int]:
    """人物・コート（青・金のふちとその輪郭）・足（切れ目より下のコート以外で、ブーツまでつながる所）"""
    a = f[..., 3] > 30
    ys = np.nonzero(a.any(axis=1))[0]
    top, bot = int(ys[0]), int(ys[-1])
    h = bot - top
    cut = int(top + CUT * h)
    r, g, b = (f[..., i].astype(int) for i in range(3))
    blue = a & (b > r + 20) & (b > g + 5)
    gold = a & (r > 150) & (g > 95) & (r - b > 70)
    near_blue = ndimage.binary_dilation(blue, iterations=5)
    glab, gn = ndimage.label(gold)
    coat_gold = np.zeros_like(gold)
    for k in range(1, gn + 1):
        c = glab == k
        if (c & near_blue).sum() >= 0.3 * c.sum():
            coat_gold |= c
    coat = blue | coat_gold
    dark = a & (np.maximum(np.maximum(r, g), b) < 90)
    coat |= dark & ndimage.binary_dilation(coat, iterations=4)
    coat = ndimage.binary_closing(coat, iterations=2) & a
    yy = np.arange(f.shape[0])[:, None]
    cand = a & ~coat & (yy >= cut)
    lab, n = ndimage.label(cand)
    legs = np.zeros_like(cand)
    for k in range(1, n + 1):
        c = lab == k
        if c[int(bot - 0.12 * h):].any():
            legs |= c
    return a, legs, cut, bot


def swap_front(f: np.ndarray) -> np.ndarray:
    """正面：コートのすそより下（すね・ブーツ）を、体の真ん中で左右反転して、コートの後ろに描く
    （すそより上まで反転すると、コートの間に見えるズボンとコートのふちが切れて崩れた）"""
    s = f.astype(np.float32)
    a, legs, _, bot = masks(f)
    r, g, b = (f[..., i].astype(int) for i in range(3))
    blue = a & (b > r + 20) & (b > g + 5)
    rows = np.nonzero(blue.sum(axis=1) > 3)[0]
    hem = int(rows[-1]) if len(rows) else int(bot - 0.3 * (bot - np.nonzero(a.any(axis=1))[0][0]))
    yy = np.arange(f.shape[0])[:, None]
    legs = legs & (yy >= hem - 30)
    # 体の真ん中：すそのすぐ下の足の左右の端の真ん中
    band = legs[hem - 30: hem + 10]
    xs = np.nonzero(band.any(axis=0))[0] if band.any() else np.nonzero(legs.any(axis=0))[0]
    cx = (xs[0] + xs[-1]) / 2
    leg = s.copy()
    leg[..., 3] = np.where(legs, s[..., 3], 0)
    mir = np.zeros_like(leg)
    for x in range(FW):
        xm = int(round(2 * cx - x))
        if 0 <= xm < FW:
            mir[:, x] = leg[:, xm]
    rest = s.copy()
    rest[..., 3] = np.where(legs | ~a, 0, s[..., 3])
    return np.clip(over(mir, rest), 0, 255).astype(np.uint8)


def split_legs(f: np.ndarray, legs: np.ndarray, bot: int) -> tuple[np.ndarray, np.ndarray]:
    """横向きの足を2本に分ける。前（画面の左＝進む向き）の足と後ろの足。足先の2つのかたまりを種にして、足の中で近い方へ"""
    low = legs.copy()
    low[: bot - 60] = False
    lab, n = ndimage.label(low)
    sizes = ndimage.sum(low, lab, range(1, n + 1))
    order = np.argsort(sizes)[::-1][:2] + 1
    if len(order) < 2:
        # 足先が1つにくっついている：横の真ん中で分ける
        xs = np.nonzero(low.any(axis=0))[0]
        mid = (xs[0] + xs[-1]) / 2
        xx = np.arange(f.shape[1])[None, :]
        return legs & (xx < mid), legs & (xx >= mid)
    seeds = [lab == k for k in order]
    seeds.sort(key=lambda m: np.nonzero(m)[1].mean())
    d0 = ndimage.distance_transform_edt(~seeds[0])
    d1 = ndimage.distance_transform_edt(~seeds[1])
    return legs & (d0 <= d1), legs & (d0 > d1)


def swap_side(f: np.ndarray, near_is_front: bool) -> np.ndarray:
    """横：手前の足と奥の足を入れ替える。near_is_front＝元の絵で前の足が手前か。奥にした足は暗く（0.82倍）、手前にした足は明るく"""
    s = f.astype(np.float32)
    a, legs, _, bot = masks(f)
    front, back = split_legs(f, legs, bot)
    near, far = (front, back) if near_is_front else (back, front)
    rest = s.copy()
    rest[..., 3] = np.where(legs | ~a, 0, s[..., 3])

    def part(m: np.ndarray, k: float) -> np.ndarray:
        p = s.copy()
        p[..., :3] *= k
        p[..., 3] = np.where(m, s[..., 3], 0)
        return p

    # 新しい奥（元の手前）を先に、新しい手前（元の奥）をその上に。元の絵で隠れていた所は、奥の足が見える
    layered = over(part(near, 0.82), part(far, 1 / 0.82 if far.any() else 1))
    return np.clip(over(layered, rest), 0, 255).astype(np.uint8)


def main(args: list[str]) -> None:
    src, row, view, pick = args[0], int(args[1]), args[2], [int(x) for x in args[3].split(',')]
    out = args[args.index('--out') + 1] if '--out' in args else src
    sheet = np.array(Image.open(src).convert('RGBA'))
    base = [cell(sheet, row, c).copy() for c in pick]
    if view == 'front':
        sw = [swap_front(f) for f in base]
    else:
        # 元の絵で、前の足が手前かどうか（着くコマ A で決める。横向きの手前の足は重なりで上に描かれている）
        sw = [swap_side(f, True) for f in base]
    a, b, c, d = base
    sa, sb, sc, sd = sw
    frames = [a, b, sc, sd, sa, sb, c, d]
    for i, f in enumerate(frames):
        sheet[row * FH:(row + 1) * FH, i * FW:(i + 1) * FW] = f
    # 左の行を直したら右（反転）も
    if row in (2, 6):
        for i in range(8):
            sheet[(row + 1) * FH:(row + 2) * FH, i * FW:(i + 1) * FW] = cell(sheet, row, i)[:, ::-1]
    Image.fromarray(sheet).save(out, quality=92, method=6)
    print('書き出し:', out)
    if '--check' in args:
        canvas = Image.new('RGBA', (FW * 8, FH), (70, 50, 35, 255))
        for i, f in enumerate(frames):
            canvas.alpha_composite(Image.fromarray(f), (i * FW, 0))
        canvas.save(args[args.index('--check') + 1])


if __name__ == '__main__':
    main(sys.argv[1:])
