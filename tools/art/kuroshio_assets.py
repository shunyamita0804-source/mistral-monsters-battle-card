"""クロシオ（2026-11-06 指示書 BK）の絵を、ゲームで使う形にする。
python3 -I tools/art/kuroshio_assets.py

原本は design-parts/bk-kuroshio-20261106/art/ に無改変で置いてある（描き直し・色の変更はしない。縮める・形式を変える・透明度をそろえるだけ）。
- 技 skills/kuroshio_sk_01〜12.png → assets/images/cards/skills/kuroshio_sk_NN.webp（幅 827。02 だけ 1178×1335 で届いたので 827×937 に縮める。縦横比は同じ）
- 正式カード kuroshio_official.png（970×1622。名前なし）→ assets/images/cards/monsters/kuroshio_official.webp（508×849）
- バトル用 kuroshio_battle_transparent.png（1169×1345・透明）→ assets/images/cards/monsters/kuroshio_battlecard.png
  背景に透明度 1〜2 のもやが散っているので、透明度を 0／255 にそろえる（tools/art/alpha_binarize.py と同じ。タイラント・ギアロスと同じ。色は変えない）
- パック：窓の絵 pack_art_kuroshio.png（948×1659）だけが届いたので、ほかの子と同じ型（design-parts/gacha-20261029/pack_template_symmetric.png）に
  tools/design/pack_tint.py と同じしかたで入れる（縁は珊瑚 #F08A78。窓の絵は型の高さに合わせて縮め、横は真ん中で切る。ウズリオと同じ）。
  → design-parts/bk-kuroshio-20261106/build/pack_kuroshio.png（935×1683）→ assets/images/ui/gacha/pack_kuroshio.webp（600×1080）
  販売機の窓（gacha_panel_build.py）は届いた窓の絵をそのまま使う
- 名前のロゴ name_{ja,en}_kuroshio.png（2172×724・透明）：ほかのロゴ（1400×300）と同じ形にする。
  まわりの透明度 1〜2 のもや（字から離れた所に散っている）を透明にしてから、字の高さ（不透明な所）をほかの子にそろえて縮め、字の左上を (38, 53) に置く。
  日本語：高さ 508px → 174px（ほかの子の日本語の多くと同じ）。英語：高さ 431px → 160px（下に出っぱりの無い英語の名前〔デスオル・ハクラン・ギアロス〕の 158〜161px）。
  design-parts/card-names-20261105/logos{,_en}/ に置く（そのあと card_name_logos.py で WebP と表を作る）
"""
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/bk-kuroshio-20261106/art')
BUILD = os.path.join(ROOT, 'design-parts/bk-kuroshio-20261106/build')
COLOR = '#F08A78'
LOGO_HEIGHT = {'ja': 174, 'en': 160}
LOGO_ANCHOR = (38, 53)
HAZE = 2  # この透明度以下のもやは透明に（ロゴ）

sys.path.insert(0, os.path.join(ROOT, 'tools/design'))
import pack_tint  # noqa: E402


def skills() -> None:
    for no in range(1, 13):
        im = Image.open(os.path.join(SRC, 'skills', f'kuroshio_sk_{no:02d}.png')).convert('RGB')
        h = round(im.height * 827 / im.width)
        small = im.resize((827, h), Image.LANCZOS)
        assert small.size == (827, 937), (no, small.size)
        small.save(os.path.join(ROOT, f'assets/images/cards/skills/kuroshio_sk_{no:02d}.webp'), 'WEBP', quality=90, method=6)


def official() -> None:
    im = Image.open(os.path.join(SRC, 'kuroshio_official.png')).convert('RGB')
    small = im.resize((508, round(im.height * 508 / im.width)), Image.LANCZOS)
    assert small.size == (508, 849), small.size
    small.save(os.path.join(ROOT, 'assets/images/cards/monsters/kuroshio_official.webp'), 'WEBP', quality=90, method=6)
    subprocess.run(
        [sys.executable, '-I', os.path.join(ROOT, 'tools/art/alpha_binarize.py'), os.path.join(SRC, 'kuroshio_battle_transparent.png'),
         os.path.join(ROOT, 'assets/images/cards/monsters/kuroshio_battlecard.png')],
        check=True,
    )


def pack() -> None:
    tpl = np.array(Image.open(os.path.join(ROOT, 'design-parts/gacha-20261029/pack_template_symmetric.png')).convert('RGBA'))
    window = Image.open(os.path.join(SRC, 'pack_art_kuroshio.png')).convert('RGBA')
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
    Image.fromarray(a, 'RGBA').save(os.path.join(BUILD, 'pack_kuroshio.png'))
    Image.fromarray(a, 'RGBA').resize((600, 1080), Image.LANCZOS).save(os.path.join(ROOT, 'assets/images/ui/gacha/pack_kuroshio.webp'), 'WEBP', quality=90, method=6)


def logos() -> None:
    for lang, folder in (('ja', 'logos'), ('en', 'logos_en')):
        a = np.array(Image.open(os.path.join(SRC, f'name_{lang}_kuroshio.png')).convert('RGBA'))
        a[a[..., 3] <= HAZE] = 0
        im = Image.fromarray(a, 'RGBA')
        op = im.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
        k = LOGO_HEIGHT[lang] / (op[3] - op[1])
        small = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        op = small.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
        canvas = Image.new('RGBA', (1400, 300), (0, 0, 0, 0))
        canvas.alpha_composite(small, (LOGO_ANCHOR[0] - op[0], LOGO_ANCHOR[1] - op[1]))
        canvas.save(os.path.join(ROOT, 'design-parts/card-names-20261105', folder, f'name_{lang}_kuroshio.png'))


if __name__ == '__main__':
    skills()
    official()
    pack()
    logos()
    print('ok')
