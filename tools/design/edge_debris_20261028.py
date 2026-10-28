# -*- coding: utf-8 -*-
"""絵の外枠に残った小さなかけら（切り出したときの、となりの部品の切れ端）を消す（2026-10-28 画面の点検）。

使い方：python3 -I tools/design/edge_debris_20261028.py
対象（assets/ を直接直す。何度動かしても同じ結果）：
- ui/album/book_section.webp：名刺図鑑の見出しの帯。帯の上に細い線の切れ端
- ui/battle/icon_mana.webp：対戦のマナの絵。上の左右の角に小さなかけら
外枠に触れていて、絵全体の 3% より小さい塊だけを透明にする（本体の絵は変えない）
"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FILES = ['assets/images/ui/album/book_section.webp', 'assets/images/ui/battle/icon_mana.webp']


def clean(path: str) -> None:
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    solid = a[..., 3] > 10
    lab, n = ndimage.label(solid, structure=np.ones((3, 3)))
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    limit = solid.sum() * 0.03
    removed = 0
    for k in border:
        if sizes[k - 1] < limit:
            a[lab == k, 3] = 0
            removed += int(sizes[k - 1])
    Image.fromarray(a).save(path, 'WEBP', quality=90, method=6)
    print(path, 'removed px', removed)


if __name__ == '__main__':
    for f in FILES:
        clean(os.path.join(ROOT, f))
