# -*- coding: utf-8 -*-
"""ダンジョンに入ったときの挿絵・ダンジョン名・重ねる部品を、ゲーム用に作る（2026-10-26 届いた6枚）

使い方: python3 -I tools/design/dungeon_intro_build.py design-parts/dungeon-intro-20261026 assets/images/ui/dungeon_intro

- 挿絵（*_art.png。不透明 1536×1024）：そのまま WebP に（画面では縦長に切り抜いて真ん中を見せる）
- ダンジョン名（*_title.png）・重ねる部品（*_overlay.png）：まわりの透明な所を切り落とし、幅を MAX_W まで縮めて WebP（透明つき）に
- 絵そのもの（色・形）は変えない。ただし原本の外枠で絵が切れている辺（精霊の森の名前の上の端・遺跡の光の筋の上の端）は、
  切れ目が横一線に見えないよう、その辺から少しずつ薄くする（fade_cut_edges。2026-10-28 ユーザー「取って張り付けた感」）
"""
import os
import sys

import numpy as np
from PIL import Image

# 画面ではダンジョン名は画面の幅くらい、重ねる部品はその少し外まで出す（スマホは3倍の細かさ）
MAX_W = {'title': 1000, 'overlay': 1200}
NAMES = {
    'dungeon_ruins': 'ruins',
    'dungeon_forest': 'forest',
}


def fade_cut_edges(im: Image.Image, ratio: float = 0.07) -> Image.Image:
    """絵が外枠で切れている辺（その辺の 5% 以上がはっきり見える）だけ、辺から ratio の幅で透明へ少しずつ薄くする"""
    a = np.array(im).astype(np.float32)
    al = a[..., 3]
    h, w = al.shape
    for side in ('top', 'bottom', 'left', 'right'):
        edge = {'top': al[0], 'bottom': al[-1], 'left': al[:, 0], 'right': al[:, -1]}[side]
        if (edge > 40).mean() < 0.05:
            continue
        n = max(4, round((h if side in ('top', 'bottom') else w) * ratio))
        ramp = (np.arange(n, dtype=np.float32) + 0.5) / n
        ramp = ramp * ramp * (3 - 2 * ramp)  # なめらかに
        if side == 'top':
            al[:n] *= ramp[:, None]
        elif side == 'bottom':
            al[-n:] *= ramp[::-1, None]
        elif side == 'left':
            al[:, :n] *= ramp[None, :]
        else:
            al[:, -n:] *= ramp[None, ::-1]
    a[..., 3] = al
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for name, key in NAMES.items():
        for part in ('art', 'title', 'overlay'):
            im = Image.open(os.path.join(src, f'{name}_{part}.png')).convert('RGBA')
            if part == 'art':
                im = im.convert('RGB')
                dst = os.path.join(out, f'{key}_art.webp')
                im.save(dst, 'WEBP', quality=86, method=6)
            else:
                # ほとんど見えない所（alpha 8 以下）は外して、まわりを切り落とす
                box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
                im = fade_cut_edges(im.crop(box))
                if im.width > MAX_W[part]:
                    im = im.resize((MAX_W[part], round(im.height * MAX_W[part] / im.width)), Image.LANCZOS)
                dst = os.path.join(out, f'{key}_{part}.webp')
                im.save(dst, 'WEBP', quality=90, method=6)
            print(dst, im.size, os.path.getsize(dst) // 1024, 'KB')


if __name__ == '__main__':
    main()
