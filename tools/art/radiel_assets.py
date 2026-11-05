"""ラディエル（2026-11-05 指示書 BI）の絵を、ゲームで使う形にする。
python3 -I tools/art/radiel_assets.py

原本は design-parts/bi-radiel-20261105/radiel/ に無改変で置いてある（描き直し・色の変更はしない。縮める・形式を変える・外の黒を透明にするだけ）。
作り方はクヨウ（tools/art/kuyo_assets.py）と同じ：
- 技 skills/radiel_sk_01〜12.png（827×937）→ assets/images/cards/skills/radiel_sk_NN.webp
- 正式カード card/radiel_official.png（1016×1698。名前なし）→ assets/images/cards/monsters/radiel_official.webp（508×849）
- バトル用 card/radiel_battlecard.png（1169×1346・透明）→ 無改変で写す（光輪と光の尾の半透明はそのまま）
- パック card/pack_radiel.png（600×1080。袋のまわりが黒）→ ふちにつながる黒だけ透明にして assets/images/ui/gacha/pack_radiel.webp。
  窓の中を切り抜いた絵を design-parts/bi-radiel-20261105/build/pack_art_radiel.png に（販売機の窓 gacha_panel_build.py・ショップの棚 shop_products.py が使う）
- 名前のロゴ（1400×300）：ほかの子より字が大きいので縮める。日本語 ×0.93（「ラ」の高さ 180px → ハクランの「ラ」168px）・
  英語 ×0.86（「R」の高さ 183px → デスオル・ハクラン・ギアロスの大文字 156〜160px）。字の左上を (38, 53) に置く
"""
import os
import shutil

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/bi-radiel-20261105/radiel')
BUILD = os.path.join(ROOT, 'design-parts/bi-radiel-20261105/build')
LOGO_SCALE = {'ja': 0.93, 'en': 0.86}
LOGO_ANCHOR = (38, 53)
WINDOW = (82, 185, 518, 880)


def skills() -> None:
    for no in range(1, 13):
        im = Image.open(os.path.join(SRC, 'skills', f'radiel_sk_{no:02d}.png')).convert('RGB')
        h = round(im.height * 827 / im.width)
        im.resize((827, h), Image.LANCZOS).save(os.path.join(ROOT, f'assets/images/cards/skills/radiel_sk_{no:02d}.webp'), 'WEBP', quality=90, method=6)


def official() -> None:
    im = Image.open(os.path.join(SRC, 'card/radiel_official.png')).convert('RGB')
    small = im.resize((508, round(im.height * 508 / im.width)), Image.LANCZOS)
    assert small.size == (508, 849), small.size
    small.save(os.path.join(ROOT, 'assets/images/cards/monsters/radiel_official.webp'), 'WEBP', quality=90, method=6)
    shutil.copyfile(os.path.join(SRC, 'card/radiel_battlecard.png'), os.path.join(ROOT, 'assets/images/cards/monsters/radiel_battlecard.png'))


def pack() -> None:
    im = Image.open(os.path.join(SRC, 'card/pack_radiel.png')).convert('RGB')
    a = np.array(im)
    dark = a.max(-1) < 24
    lab, _ = ndimage.label(dark)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge))
    alpha = np.where(outside, 0, 255).astype(np.uint8)
    rgba = np.dstack([a, alpha])
    Image.fromarray(rgba, 'RGBA').resize((600, 1080), Image.LANCZOS).save(os.path.join(ROOT, 'assets/images/ui/gacha/pack_radiel.webp'), 'WEBP', quality=90, method=6)
    os.makedirs(BUILD, exist_ok=True)
    im.crop(WINDOW).save(os.path.join(BUILD, 'pack_art_radiel.png'))
    # ショップの棚の商品（shop_products.py の pack_small と同じ形。透明にしたパックから）
    Image.fromarray(rgba, 'RGBA').save(os.path.join(BUILD, 'pack_radiel.png'))


def logos() -> None:
    for lang, folder in (('ja', 'logos'), ('en', 'logos_en')):
        im = Image.open(os.path.join(SRC, 'logos', f'name_{lang}_radiel.png')).convert('RGBA')
        k = LOGO_SCALE[lang]
        small = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        op = small.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
        canvas = Image.new('RGBA', im.size, (0, 0, 0, 0))
        canvas.alpha_composite(small, (LOGO_ANCHOR[0] - op[0], LOGO_ANCHOR[1] - op[1]))
        canvas.save(os.path.join(ROOT, 'design-parts/card-names-20261105', folder, f'name_{lang}_radiel.png'))


if __name__ == '__main__':
    skills()
    official()
    pack()
    logos()
    print('ok')
