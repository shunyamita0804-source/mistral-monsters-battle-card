"""技カードのダメージの欄（金のふちの黒い四角）を、前の v3 の枠の原本から切り出す（2026-10-29 ユーザー「マナとダメージのとこは前のUI使ってね」）。

使い方：python3 -I tools/art/value_box_build.py（npm run art:skillframes から呼ぶ）
原本 design-parts/ui-skillcard-v5/extracted-v3-20261028/frame_normal_support.png（4倍）の左下の数値の欄だけを切り抜く（描き直さない）。
金のふち（R−B が 40 より大きい所）の外側を透明にし、となりにつながった細い線は消す。
書き出し：assets/images/ui/skillcard_simple/value_box.webp（ゲームは CSS の border-image で欄の大きさに合わせてのばす）
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'design-parts/ui-skillcard-v5/extracted-v3-20261028/frame_normal_support.png'
OUT = ROOT / 'assets/images/ui/skillcard_simple/value_box.webp'
# 数値の欄の位置（1倍。前の skillCard.ts の LAYOUT.normal.value）
VALUE = (20, 282, 85, 357)
MARGIN = 24


def main() -> None:
    im = Image.open(SRC).convert('RGBA')
    x1, y1, x2, y2 = [v * 4 for v in VALUE]
    a = np.array(im.crop((x1 - MARGIN, y1 - MARGIN, x2 + MARGIN, y2 + MARGIN))).astype(int)
    gold = (a[..., 0] - a[..., 2] > 40) & (a[..., 3] > 200)
    lab, n = ndimage.label(gold)
    sizes = ndimage.sum(gold, lab, range(1, n + 1))
    box = ndimage.binary_fill_holes(lab == int(np.argmax(sizes)) + 1)
    # となりの窓のふちの細い線を消す（太い所だけ残す）
    box = ndimage.binary_opening(box, iterations=6)
    lab2, n2 = ndimage.label(box)
    box = lab2 == int(np.argmax(ndimage.sum(box, lab2, range(1, n2 + 1)))) + 1
    # 開いたときに丸くなった角を、もとの形（ふちの塊を穴埋めしたもの）で戻す
    box = ndimage.binary_dilation(box, iterations=6) & ndimage.binary_fill_holes(lab == int(np.argmax(sizes)) + 1)
    a[..., 3] = np.where(box, a[..., 3], 0)
    out = Image.fromarray(a.astype('uint8'))
    out = out.crop(out.getbbox())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, quality=90, method=6)
    print(OUT.name, out.size)


if __name__ == '__main__':
    main()
