# -*- coding: utf-8 -*-
"""正面の歩きの「反対の足の1歩」を、腰から下だけ左右反転して作る（2026-10-25）

画像AIに「下の段だけ足を入れ替えて」と2回頼んでも、6・8 が上の段と同じ足のままだった。正面の人物は、腰から下（ズボン・ブーツ・コートのすそ）は
ほぼ左右対称なので、上の段の4コマを腰から下だけ左右反転すれば、前に出る足が逆の4コマになる。かばん・鎖の飾り・顔・腕は元の絵のまま。
前の試み（tools/art/leg_swap.py の swap_front：コートのすそより下だけを反転）はコートの途中に継ぎ目が出たので、切る位置を腰（かばんの下）にした。

届いた絵（4列×2段）の上の段 1〜4 から、上の段＝そのまま、下の段＝腰から下を反転、の 4列×2段の1枚を作る。
それを tools/art/unified_build.py でシートの行0に入れる。

使い方:
  python3 tools/art/front_flip_walk.py 届いた絵.png 出力.png [--cut 0.60] [--check 確認.png]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
from unified_build import crop, load_poses  # noqa: E402

BLEND = 12  # 境目で色を混ぜる幅（px・届いた絵の大きさで）


def flip_lower(p: Image.Image, cut: float) -> Image.Image:
    """人物の上から cut より下を、体（上から 20〜50%）の横の真ん中で左右反転する"""
    c = np.array(crop(p)).astype(np.float32)
    h, w = c.shape[:2]
    a = c[..., 3] > 128
    cx = float(np.nonzero(a[int(h * 0.2): int(h * 0.5)])[1].mean())
    width = int(2 * max(cx, w - cx)) + 4
    off = int(round(width / 2 - cx))
    base = np.zeros((h, width, 4), np.float32)
    base[:, off:off + w] = c
    flip = base[:, ::-1]
    y = int(h * cut)
    t = np.clip((np.arange(h) - (y - BLEND / 2)) / BLEND, 0, 1)[:, None, None]
    out = base * (1 - t) + flip * t
    # 不透明度：境目より上は元の絵、下は反転した絵（混ぜると、どちらか一方にしかない所に薄いかけらが残る）
    out[..., 3] = np.where(np.arange(h)[:, None] < y, base[..., 3], flip[..., 3])
    # 人物から離れた小さなかけら（コートのふちの形が左右で少し違う所）を消す
    solid = out[..., 3] > 40
    lab, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        keep = lab == int(np.argmax(sizes)) + 1
        out[..., 3] = np.where(ndimage.binary_dilation(keep, iterations=1), out[..., 3], 0)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def main(args: list[str]) -> None:
    src, dst = args[0], args[1]
    cut = float(args[args.index('--cut') + 1]) if '--cut' in args else 0.60
    poses, _ = load_poses(src, 4)
    top = [crop(p) for p in poses[:4]]
    frames = top + [flip_lower(p, cut) for p in poses[:4]]
    canvas = Image.new('RGBA', (1536, 1024), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        canvas.alpha_composite(f, ((i % 4) * 384 + (384 - f.width) // 2, (i // 4) * 512 + 500 - f.height))
    canvas.save(dst)
    print('書き出し:', dst)
    if '--check' in args:
        bg = Image.new('RGBA', canvas.size, (70, 50, 35, 255))
        bg.alpha_composite(canvas)
        bg.save(args[args.index('--check') + 1])


if __name__ == '__main__':
    main(sys.argv[1:])
