"""クヨウ（2026-11-05 指示書 BH）の絵を、ゲームで使う形にする。
python3 -I tools/art/kuyo_assets.py

原本は design-parts/bh-kuyo-20261105/kuyo/ に無改変で置いてある（描き直し・色の変更はしない。縮める・形式を変える・外の黒を透明にするだけ）。
- 技 skills/kuyo_sk_01〜12.png（827×937）→ assets/images/cards/skills/kuyo_sk_NN.webp（card_art_webp.py と同じ。幅 827）
- 正式カード card/kuyo_official.png（1016×1698。名前なし）→ assets/images/cards/monsters/kuyo_official.webp（508×849。official_card_webp.py と同じ）
- バトル用 card/kuyo_battlecard.png（1169×1346・透明）→ assets/images/cards/monsters/kuyo_battlecard.png（無改変で写す。毛先の半透明はそのまま）
- パック card/pack_kuyo.png（600×1080。袋のまわりが黒）→ assets/images/ui/gacha/pack_kuyo.webp
  ほかのパックは袋のまわりが透明なので、ふちにつながっている黒（いちばん明るい色が 24 未満）だけを透明にする（袋の紺・絵は変えない）。
  販売機の窓の絵の元（窓の中の絵だけを切り抜いたもの）を design-parts/bh-kuyo-20261105/build/pack_art_kuyo.png に書き出す（gacha_panel_build.py が使う）
- 名前のロゴ logos/name_{ja,en}_kuyo.png（1400×300）：ほかの子より字が大きいので、字の高さがそろうように縮めて、
  design-parts/card-names-20261105/logos{,_en}/ に置く（そのあと card_name_logos.py で WebP と表を作る）。
  日本語：「ク」の高さ 196px → ハクランの「ク」173px（×0.88）。英語：「K」の高さ 168px → デスオル・ハクラン・ギアロスの大文字 156〜160px（×0.94）。
  縮めたあと、字の左上（不透明な所）をほかのロゴと同じ (38, 53) に置く。ふちのざらつきはそのまま
"""
import os
import shutil

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/bh-kuyo-20261105/kuyo')
BUILD = os.path.join(ROOT, 'design-parts/bh-kuyo-20261105/build')
LOGO_SCALE = {'ja': 0.88, 'en': 0.94}
LOGO_ANCHOR = (38, 53)


def skills() -> None:
    for no in range(1, 13):
        im = Image.open(os.path.join(SRC, 'skills', f'kuyo_sk_{no:02d}.png')).convert('RGB')
        h = round(im.height * 827 / im.width)
        im.resize((827, h), Image.LANCZOS).save(os.path.join(ROOT, f'assets/images/cards/skills/kuyo_sk_{no:02d}.webp'), 'WEBP', quality=90, method=6)


def official() -> None:
    im = Image.open(os.path.join(SRC, 'card/kuyo_official.png')).convert('RGB')
    small = im.resize((508, round(im.height * 508 / im.width)), Image.LANCZOS)
    assert small.size == (508, 849), small.size
    small.save(os.path.join(ROOT, 'assets/images/cards/monsters/kuyo_official.webp'), 'WEBP', quality=90, method=6)
    shutil.copyfile(os.path.join(SRC, 'card/kuyo_battlecard.png'), os.path.join(ROOT, 'assets/images/cards/monsters/kuyo_battlecard.png'))


def pack() -> None:
    im = Image.open(os.path.join(SRC, 'card/pack_kuyo.png')).convert('RGB')
    a = np.array(im)
    dark = a.max(-1) < 24
    lab, _ = ndimage.label(dark)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge))
    alpha = np.where(outside, 0, 255).astype(np.uint8)
    # ふちの1px だけ少しなめらかに（袋の形は変えない）
    soft = ndimage.uniform_filter(alpha.astype(float), 3)
    alpha = np.where(outside, 0, np.maximum(soft, 0)).astype(np.uint8)
    alpha[~outside] = np.maximum(alpha[~outside], 128)
    rgba = np.dstack([a, alpha])
    Image.fromarray(rgba, 'RGBA').resize((600, 1080), Image.LANCZOS).save(os.path.join(ROOT, 'assets/images/ui/gacha/pack_kuyo.webp'), 'WEBP', quality=90, method=6)
    # 窓の中の絵（金の線の内側）。600×1080 の px で測った範囲
    os.makedirs(BUILD, exist_ok=True)
    im.crop((82, 185, 518, 880)).save(os.path.join(BUILD, 'pack_art_kuyo.png'))


def logos() -> None:
    for lang, folder in (('ja', 'logos'), ('en', 'logos_en')):
        im = Image.open(os.path.join(SRC, 'logos', f'name_{lang}_kuyo.png')).convert('RGBA')
        k = LOGO_SCALE[lang]
        small = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        op = small.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
        canvas = Image.new('RGBA', im.size, (0, 0, 0, 0))
        canvas.alpha_composite(small, (LOGO_ANCHOR[0] - op[0], LOGO_ANCHOR[1] - op[1]))
        canvas.save(os.path.join(ROOT, 'design-parts/card-names-20261105', folder, f'name_{lang}_kuyo.png'))


if __name__ == '__main__':
    skills()
    official()
    pack()
    logos()
    print('ok')
