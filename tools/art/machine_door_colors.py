"""機械の塔の赤と青の扉・スイッチ（2026-11-05 指示書 BD【1】）。今の絵を色だけ染める（形は同じ）。
python3 -I tools/art/machine_door_colors.py
- 扉：machine_door_closed／open → machine_door_{red,blue}_{closed,open}.webp
  鉄の板（色のうすい所）を赤／青に染め、真ちゅう（色のこい所）はそのまま。開いた扉の奥（暗い所）は染めない
- スイッチ：赤が開いている＝machine_switch_off を赤に／青が開いている＝machine_switch_on を青に
  → machine_switch_red.webp・machine_switch_blue.webp
"""
import colorsys
import os

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DIR = os.path.join(ROOT, 'assets/images/maps/dungeon')

# 染める色（色相・彩度）。明るさは元の絵のまま
TINT = {'red': (0.0, 0.62), 'blue': (0.6, 0.62)}


def tint(src: str, dst: str, color: str) -> None:
    im = Image.open(os.path.join(DIR, src)).convert('RGBA')
    a = np.asarray(im).astype(np.float64) / 255.0
    rgb = a[..., :3]
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    hue, s = TINT[color]
    # 色のうすい所（鉄）ほど強く染める。真ちゅう（彩度が高い）はほとんど染めない。暗い所（扉の奥）は弱く
    w = np.clip(1.0 - sat / 0.35, 0, 1) * np.clip((mx - 0.08) / 0.2, 0, 1)
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    flat = lum.reshape(-1)
    col = np.array([colorsys.hls_to_rgb(hue, min(0.95, v * 1.15), s) for v in flat]).reshape(rgb.shape)
    out = rgb * (1 - w[..., None]) + col * w[..., None]
    res = np.dstack([out, a[..., 3]])
    Image.fromarray((np.clip(res, 0, 1) * 255).round().astype(np.uint8), 'RGBA').save(os.path.join(DIR, dst), 'WEBP', quality=90, method=6)
    print(dst)


for c in ('red', 'blue'):
    tint('machine_door_closed.webp', f'machine_door_{c}_closed.webp', c)
    tint('machine_door_open.webp', f'machine_door_{c}_open.webp', c)
tint('machine_switch_off.webp', 'machine_switch_red.webp', 'red')
tint('machine_switch_on.webp', 'machine_switch_blue.webp', 'blue')
