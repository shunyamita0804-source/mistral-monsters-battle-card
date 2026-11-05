"""機械の塔の正式の絵（2026-11-05 指示書 BF）をゲーム用の WebP にする。原本は design-parts/machine-tower-20261105/（無改変）。
python3 -I tools/art/machine_tower_art.py
- 扉（赤・青 × 閉じた・開いた）・スイッチ（赤・青）・上り階段：大きさはそのまま → assets/images/maps/dungeon/
- 上の帯の印（赤・青）：256×256 → 96×96 → assets/images/ui/dungeon/badge_door_{red,blue}.webp
- 説明の絵：1024×1024 → 600×600（ほかの説明の絵と同じ） → assets/images/backgrounds/tutorial_tower_doors.webp
（BD の「今の絵を染めた仮の扉・スイッチ」〔tools/art/machine_door_colors.py〕はやめた）
- 2026-11-05 指示書 BG：扉・スイッチの「自分で光る部分」（赤・青のランプと光のふち）だけを取り出した絵 *_glow.webp
  （赤・水色の強い所だけを残し、そのとなりの白く光る芯も入れる。暗さの層の上に重ねて、明かりの外でも暗くしない）
"""
import os

import numpy as np
from PIL import ImageFilter

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/machine-tower-20261105')


def save(name: str, dst: str, size: tuple[int, int] | None = None) -> None:
    im = Image.open(os.path.join(SRC, name))
    if size:
        im = im.resize(size, Image.LANCZOS)
    os.makedirs(os.path.dirname(os.path.join(ROOT, dst)), exist_ok=True)
    im.save(os.path.join(ROOT, dst), 'WEBP', quality=90, method=6)
    print(dst, im.size)


for c in ('red', 'blue'):
    for s in ('closed', 'open'):
        save(f'machine_door_{c}_{s}.png', f'assets/images/maps/dungeon/machine_door_{c}_{s}.webp')
    save(f'machine_switch_{c}.png', f'assets/images/maps/dungeon/machine_switch_{c}.webp')
    save(f'badge_door_{c}.png', f'assets/images/ui/dungeon/badge_door_{c}.webp', (96, 96))
save('machine_stairs_up.png', 'assets/images/maps/dungeon/machine_stairs_up.webp')
save('tutorial_tower_doors.png', 'assets/images/backgrounds/tutorial_tower_doors.webp', (600, 600))


def glow(name: str, color: str) -> None:
    """name の絵から、color（red／blue）の光る部分だけを残した絵（*_glow.webp）"""
    im = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    a = np.asarray(im).astype(np.float64) / 255.0
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    if color == 'red':
        # 真ちゅう（赤みのある金色）は入れない：緑・青が赤の半分より十分小さい所だけ
        w = np.clip((r * 0.55 - np.maximum(g, b)) / 0.12, 0, 1) * np.clip((r - 0.4) / 0.3, 0, 1)
    else:
        w = np.clip((np.minimum(g, b) - r) / 0.3, 0, 1) * np.clip((b - 0.35) / 0.3, 0, 1)
    # となりの白く光る芯（ランプの真ん中）も入れる
    near = np.asarray(Image.fromarray((w * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))).astype(np.float64) / 255.0
    hot = np.clip((np.max(a[..., :3], axis=2) - 0.75) / 0.2, 0, 1) * near
    alpha = np.clip(np.maximum(w, hot), 0, 1) * al
    out = np.dstack([a[..., :3], alpha])
    dst = f'assets/images/maps/dungeon/{name}_glow.webp'
    Image.fromarray((out * 255).round().astype(np.uint8), 'RGBA').save(os.path.join(ROOT, dst), 'WEBP', quality=92, method=6)
    print(dst)


for c in ('red', 'blue'):
    for s in ('closed', 'open'):
        glow(f'machine_door_{c}_{s}', c)
    glow(f'machine_switch_{c}', c)
