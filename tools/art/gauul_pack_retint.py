"""ガウルのパックの縁を、pack_tint.py の COLORS['gauul'] の色にする（2026-11-07 指示書 BO：ノウスと見分けるため薄いオレンジにする予定。色はまだ決まっていない〔docs/bo-nous-fix-20261107.md〕）。
python3 -I tools/art/gauul_pack_retint.py

- 原本 design-parts/gacha-20261029/art/pack_gauul.png（デザイン担当の完成品。縁は #E68A46 で淡く色付け済み）は変えない
- その上に、パックの型（pack_template_symmetric.png）の縁を新しい色にしたもの（tools/design/pack_tint.py の tint_template）を重ねる。
  型の縁はふさがっている（不透明）ので、縁の所だけが新しい色に置きかわる。窓の絵・紺の袋・金の線は変わらない
- 出力 design-parts/bo-nous-fix-20261107/build/pack_gauul.png（色が決まったら、tools/design/gacha_series_build.py の PACK_PATH に 'gauul' を足してこれを使う）
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools/design'))
import pack_tint  # noqa: E402

COLOR = pack_tint.COLORS['gauul']
tpl = np.array(Image.open(os.path.join(ROOT, 'design-parts/gacha-20261029/pack_template_symmetric.png')).convert('RGBA'))
base = Image.open(os.path.join(ROOT, 'design-parts/gacha-20261029/art/pack_gauul.png')).convert('RGBA')
assert base.size == (tpl.shape[1], tpl.shape[0])
frame = Image.fromarray(pack_tint.tint_template(tpl, COLOR), 'RGBA')
out = base.copy()
out.alpha_composite(frame)
a = np.array(out)
a[..., 3] = np.array(base)[..., 3]  # 透明な所は原本のまま
os.makedirs(os.path.join(ROOT, 'design-parts/bo-nous-fix-20261107/build'), exist_ok=True)
Image.fromarray(a, 'RGBA').save(os.path.join(ROOT, 'design-parts/bo-nous-fix-20261107/build/pack_gauul.png'))
print('ok', COLOR)
