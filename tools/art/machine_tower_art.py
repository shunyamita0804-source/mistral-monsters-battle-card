"""機械の塔の正式の絵（2026-11-05 指示書 BF）をゲーム用の WebP にする。原本は design-parts/machine-tower-20261105/（無改変）。
python3 -I tools/art/machine_tower_art.py
- 扉（赤・青 × 閉じた・開いた）・スイッチ（赤・青）・上り階段：大きさはそのまま → assets/images/maps/dungeon/
- 上の帯の印（赤・青）：256×256 → 96×96 → assets/images/ui/dungeon/badge_door_{red,blue}.webp
- 説明の絵：1024×1024 → 600×600（ほかの説明の絵と同じ） → assets/images/backgrounds/tutorial_tower_doors.webp
（BD の「今の絵を染めた仮の扉・スイッチ」〔tools/art/machine_door_colors.py〕はやめた）
"""
import os

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
