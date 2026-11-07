"""パックの縁の色を、tools/design/pack_tint.py の COLORS の今の色にする（2026-11-07 指示書 BQ【2】：ヒョウズク・ウズリオの色の入れ替え）。
python3 -I tools/art/pack_retint.py hyouzuku uzurio

- 原本 design-parts/gacha-20261029/art/pack_{名前}.png（パックの完成品。縁は前の色）は変えない
- その上に、パックの型（pack_template_symmetric.png）の縁を新しい色にしたもの（pack_tint.tint_template）を重ねる。型の縁はふさがっているので、縁の所だけが新しい色に置きかわる。
  窓の絵・紺の袋・金の線は変わらない（tools/art/gauul_pack_retint.py と同じやり方）
- 出力 design-parts/bq-stellard-20261107/build/pack_{名前}.png（ゲームの絵は tools/design/gacha_series_build.py の PACK_PATH でこれを使う。ショップの棚の小さなパックもこれから作る）
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools/design'))
import pack_tint  # noqa: E402

OUT = os.path.join(ROOT, 'design-parts/bq-stellard-20261107/build')
tpl = np.array(Image.open(os.path.join(ROOT, 'design-parts/gacha-20261029/pack_template_symmetric.png')).convert('RGBA'))
os.makedirs(OUT, exist_ok=True)
for name in sys.argv[1:]:
    color = pack_tint.COLORS[name]
    base = Image.open(os.path.join(ROOT, f'design-parts/gacha-20261029/art/pack_{name}.png')).convert('RGBA')
    assert base.size == (tpl.shape[1], tpl.shape[0]), name
    frame = Image.fromarray(pack_tint.tint_template(tpl, color, pack_tint.DEEPER.get(name, 0.0)), 'RGBA')
    out = base.copy()
    out.alpha_composite(frame)
    a = np.array(out)
    a[..., 3] = np.array(base)[..., 3]
    Image.fromarray(a, 'RGBA').save(os.path.join(OUT, f'pack_{name}.png'))
    print('ok', name, color)
