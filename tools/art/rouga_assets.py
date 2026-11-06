"""ロウガ（2026-11-06 指示書 BL）の絵を、ゲームで使う形にする。作り方はクロシオ（tools/art/kuroshio_assets.py）と同じ。
python3 -I tools/art/rouga_assets.py

原本は design-parts/bl-rouga-20261106/art/ に無改変で置いてある（描き直し・色の変更はしない。縮める・形式を変える・透明度をそろえるだけ）。
- 技 skills/rouga_sk_01〜12.png（827×937）→ assets/images/cards/skills/rouga_sk_NN.webp
- 正式カード rouga_official.png（969×1622。名前なし。LIFE の数字を 7 にした build/rouga_official_life7.png〔tools/art/rouga_life7.py〕を使う）→ assets/images/cards/monsters/rouga_official.webp（508×849）
- バトル用 rouga_battle_transparent.png（1169×1345・透明）→ 透明度を 0／255 にそろえて assets/images/cards/monsters/rouga_battlecard.png（色は変えない）
- パック：窓の絵 pack_art_rouga.png（948×1659）をほかの子と同じ型に入れる（縁は淡い藤色 #B7A3DA）→ assets/images/ui/gacha/pack_rouga.webp
- 名前のロゴ name_ja_rouga.png（2004×785）・name_en_rouga.png（2054×766）：まわりのもやを消し、字の高さをそろえて（日本語 174px・英語 160px）1400×300 の形に
"""
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/bl-rouga-20261106/art')
BUILD = os.path.join(ROOT, 'design-parts/bl-rouga-20261106/build')
COLOR = '#B7A3DA'
LOGO_HEIGHT = {'ja': 174, 'en': 160}
LOGO_ANCHOR = (38, 53)
HAZE = 2  # この透明度以下のもやは透明に（ロゴ）

sys.path.insert(0, os.path.join(ROOT, 'tools/design'))
import pack_tint  # noqa: E402


def skills() -> None:
    for no in range(1, 13):
        im = Image.open(os.path.join(SRC, 'skills', f'rouga_sk_{no:02d}.png')).convert('RGB')
        h = round(im.height * 827 / im.width)
        small = im.resize((827, h), Image.LANCZOS)
        assert small.size == (827, 937), (no, small.size)
        small.save(os.path.join(ROOT, f'assets/images/cards/skills/rouga_sk_{no:02d}.webp'), 'WEBP', quality=90, method=6)


def official() -> None:
    # 2026-11-06：LIFE を 7 にしたので、札の数字を 7 にした絵（tools/art/rouga_life7.py。原本は変えない）を使う
    im = Image.open(os.path.join(BUILD, 'rouga_official_life7.png')).convert('RGB')
    # 969×1622 で届いた（ほかの子は 970×1622）。ほかの子と同じ 508×849 にする（縦横比の差は 0.1% ほど）
    small = im.resize((508, 849), Image.LANCZOS)
    small.save(os.path.join(ROOT, 'assets/images/cards/monsters/rouga_official.webp'), 'WEBP', quality=90, method=6)
    subprocess.run(
        [sys.executable, '-I', os.path.join(ROOT, 'tools/art/alpha_binarize.py'), os.path.join(SRC, 'rouga_battle_transparent.png'),
         os.path.join(ROOT, 'assets/images/cards/monsters/rouga_battlecard.png')],
        check=True,
    )


def pack() -> None:
    tpl = np.array(Image.open(os.path.join(ROOT, 'design-parts/gacha-20261029/pack_template_symmetric.png')).convert('RGBA'))
    window = Image.open(os.path.join(SRC, 'pack_art_rouga.png')).convert('RGBA')
    art = pack_tint.cover(window, (tpl.shape[1], tpl.shape[0]))
    frame = Image.fromarray(pack_tint.tint_template(tpl, COLOR), 'RGBA')
    out = art.copy()
    out.alpha_composite(frame)
    a = np.array(out)
    outside = tpl[..., 3] < 10
    inner = np.zeros(outside.shape, bool)
    inner[233:1450, 121:815] = True
    a[outside & ~inner, 3] = 0
    os.makedirs(BUILD, exist_ok=True)
    Image.fromarray(a, 'RGBA').save(os.path.join(BUILD, 'pack_rouga.png'))
    Image.fromarray(a, 'RGBA').resize((600, 1080), Image.LANCZOS).save(os.path.join(ROOT, 'assets/images/ui/gacha/pack_rouga.webp'), 'WEBP', quality=90, method=6)


def logos() -> None:
    for lang, folder in (('ja', 'logos'), ('en', 'logos_en')):
        a = np.array(Image.open(os.path.join(SRC, f'name_{lang}_rouga.png')).convert('RGBA'))
        a[a[..., 3] <= HAZE] = 0
        im = Image.fromarray(a, 'RGBA')
        op = im.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
        k = LOGO_HEIGHT[lang] / (op[3] - op[1])
        small = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        op = small.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
        canvas = Image.new('RGBA', (1400, 300), (0, 0, 0, 0))
        canvas.alpha_composite(small, (LOGO_ANCHOR[0] - op[0], LOGO_ANCHOR[1] - op[1]))
        canvas.save(os.path.join(ROOT, 'design-parts/card-names-20261105', folder, f'name_{lang}_rouga.png'))


if __name__ == '__main__':
    skills()
    official()
    pack()
    logos()
    print('ok')
