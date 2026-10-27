# -*- coding: utf-8 -*-
"""人物（主人公・NPC）の歩行シートを、背景に「立って」見えるように仕上げる（2026-10-25）

ユーザー「まだ街などの背景に浮いているように見える。NPC も」。見本 D（影を足の裏に＋黒い縁取りなし＋色を場所の明かりに）を選んだ。
このスクリプトは絵の側の2つ（影は worldScreen.ts と world.css）：
  1. 黒い縁取りを外す：adult_walk_build.py の --outline 2 で付けた暗い輪郭（こげ茶 (34,22,14)）を、人物のふちの 3px のうち
     その色に近い画素だけ透明にする（絵そのものの線は残る）。切り抜いて貼った絵のように見えたため
  2. 色を少し落ち着かせる：コントラストを 0.93 倍・明るさを 0.95 倍、足元（人物の下から 18%）を下へ行くほど最大 28% 暗く
     （床に近い所の暗さ。場所ごとに変えると iPhone で重くなるので、どの場所でも同じ量を絵に焼き込む）

元のシート（縁取りあり）は design-parts/characters-adult/sheets-outlined/ に置き、いつもそこから作る（2回かけないように）。
ほかの道具（adult_walk_build.py・unified_build.py・blue_tone.py など）でシートを作り直したら、その出力を sheets-outlined/ に
上書きしてから、このスクリプトをもう一度かける。

使い方:
  python3 tools/art/ground_figures.py [--init]   （--init：いまの assets のシートを sheets-outlined/ へ写してから作る。最初の1回だけ）
"""
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'design-parts/characters-adult/sheets-outlined'
DST = ROOT / 'assets/images/characters'
# シート → 1コマの大きさ（主人公 9列×8行・310×360、NPC 4列×4行・270×360）
SHEETS = {
    'player_male_sheet.webp': (310, 360),
    'player_female_sheet.webp': (310, 360),
    **{f'npc_{n}_walk.webp': (270, 360) for n in (
        'clerk', 'neighbor_guide', 'receptionist', 'researcher', 'teacher', 'eleanor',
        'resident_a', 'resident_b', 'resident_c', 'resident_d', 'resident_e',
    )},
}
OUTLINE_RGB = np.array([34, 22, 14])
CONTRAST = 0.93
BRIGHT = 0.95
FEET_SPAN = 0.18
FEET_DARK = 0.28


def ground(f: np.ndarray) -> np.ndarray:
    a = f.copy()
    m = a[..., 3] > 40
    if not m.any():
        return a
    rgb = a[..., :3].astype(int)
    dark = np.abs(rgb - OUTLINE_RGB).sum(axis=-1) < 60
    ring = m & ~ndimage.binary_erosion(m, iterations=3)
    a[..., 3] = np.where(ring & dark, 0, a[..., 3])
    # 縁を外したふちのぎざぎざを、少しだけなめらかに
    soft = np.array(Image.fromarray(a[..., 3]).filter(ImageFilter.GaussianBlur(0.6)))
    a[..., 3] = np.minimum(a[..., 3], soft)
    c = a[..., :3].astype(np.float32)
    c = ((c - 128) * CONTRAST + 128) * BRIGHT
    ys = np.nonzero((a[..., 3] > 40).any(axis=1))[0]
    if len(ys):
        top, bot = int(ys[0]), int(ys[-1])
        span = max(1.0, (bot - top) * FEET_SPAN)
        g = np.clip((np.arange(a.shape[0]) - (bot - span)) / span, 0, 1)[:, None, None]
        c *= 1 - FEET_DARK * g
    a[..., :3] = np.clip(c, 0, 255).round().astype(np.uint8)
    return a


def main(args: list[str]) -> None:
    SRC.mkdir(parents=True, exist_ok=True)
    for name, (fw, fh) in SHEETS.items():
        src = SRC / name
        if '--init' in args and not src.exists():
            shutil.copy(DST / name, src)
        sheet = np.array(Image.open(src).convert('RGBA'))
        rows, cols = sheet.shape[0] // fh, sheet.shape[1] // fw
        for r in range(rows):
            for c in range(cols):
                sl = (slice(r * fh, (r + 1) * fh), slice(c * fw, (c + 1) * fw))
                sheet[sl] = ground(sheet[sl])
        Image.fromarray(sheet).save(DST / name, quality=92, method=6)
        print('書き出し:', DST / name)


if __name__ == '__main__':
    main(sys.argv[1:])
