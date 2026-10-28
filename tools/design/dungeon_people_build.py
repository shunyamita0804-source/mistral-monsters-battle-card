# -*- coding: utf-8 -*-
"""ダンジョンの人物12人（守り手7人・バトラー5人。2026-10-28 指示書）の絵を、ゲーム用に縮小して WebP にする。

使い方：python3 -I tools/design/dungeon_people_build.py design-parts/dungeon-people-20261028

- 原本（無改変）：faces/face_*.png（1024×1024）・stands/stand_*.png（768×1024）
- 出力：assets/images/characters/face_{guardian,battler}_*.webp（幅 384）
        assets/images/characters/stand_{guardian,battler}_*.webp（人物だけ切り抜いて高さ 360）
- 大きさと切り抜き方は、今のバトラー3人（tools/design/ui12_13_build.py の battler_*・face_battler_*）と同じ
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ui12_13_build import blob, save  # noqa: E402

NAMES = [
    'guardian_ruins_grant', 'guardian_forest_sera', 'guardian_water_lucia', 'guardian_ice_ivan',
    'guardian_fire_balka', 'guardian_machine_teo', 'guardian_holy_aurelio',
    'battler_water_pia', 'battler_ice_hans', 'battler_fire_zack', 'battler_machine_otto', 'battler_holy_mina',
]


def main() -> None:
    src = Path(sys.argv[1])
    for name in NAMES:
        face = Image.open(src / 'faces' / f'face_{name}.png').convert('RGBA')
        save(face, f'characters/face_{name}.webp', width=384)
        stand = Image.open(src / 'stands' / f'stand_{name}.png').convert('RGBA')
        # 人物のかたまり（胸のあたりの、透明でない点を含む）だけを残して切り抜く
        a = np.array(stand)[..., 3] > 128
        ys, xs = np.where(a)
        cy = int(ys.min() + (ys.max() - ys.min()) * 0.35)
        row = np.where(a[cy])[0]
        point = (int(row[np.argmin(np.abs(row - xs.mean()))]), cy)
        save(blob(stand, point), f'characters/stand_{name}.webp', height=360)


if __name__ == '__main__':
    main()
