"""ステラード（2026-11-07 指示書 BQ）の絵を、ゲームで使う形にする。作り方はベニオウ（tools/art/beniou_assets.py）と同じ。
python3 -I tools/art/stellard_assets.py [skills official battle pack logos]

原本は design-parts/bq-stellard-20261107/art/ に無改変で置いてある（描き直し・色の変更はしない。縮める・形式を変える・透明度をそろえるだけ）。
- 技 skills/stellard_sk_01〜12.png（827×937）→ assets/images/cards/skills/stellard_sk_NN.webp
- 正式カード stellard_official.png（970×1622。名前なし・LIFE 8・シルバーの枠）→ assets/images/cards/monsters/stellard_official.webp（508×849）
- バトル用 stellard_battle_transparent.png（1169×1345・透明）→ 透明度を 0／255 にそろえて assets/images/cards/monsters/stellard_battlecard.png（余白はもとからほかの子と同じくらい）
- パック：窓の絵 pack_art_stellard.png（985×1597。ほかの子〔948×1660〕より少し横長）を、のばさずに型の高さに合わせて縮め、横は真ん中で切る（pack_tint.cover）。
  頭（兜・たてがみ・額の星）と槍の穂先が切れないか確かめる。縁はシルバー #C8CCD4 → assets/images/ui/gacha/pack_stellard.webp
- 名前のロゴ name_ja_stellard.png（2008×783）・name_en_stellard.png（2046×768）：字の高さをそろえて（日本語 174px・英語 160px）1400×300 の形に
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/bq-stellard-20261107/art')
BUILD = os.path.join(ROOT, 'design-parts/bq-stellard-20261107/build')
COLOR = '#C8CCD4'
LOGO_HEIGHT = {'ja': 174, 'en': 160}
LOGO_ANCHOR = (38, 53)
PACK_SHIFT = int(os.environ.get('PACK_SHIFT', 0))
PACK_FIT = float(os.environ.get('PACK_FIT', 0.82))  # パックの窓の絵の高さ（型の高さの何倍か）  # パックの窓で絵を下げる量（型の px）
HAZE = 2  # この透明度以下のもやは透明に（ロゴ）

sys.path.insert(0, os.path.join(ROOT, 'tools/design'))
import pack_tint  # noqa: E402


def skills() -> None:
    for no in range(1, 13):
        path = os.path.join(SRC, 'skills', f'stellard_sk_{no:02d}.png')
        im = Image.open(path).convert('RGB')
        h = round(im.height * 827 / im.width)
        small = im.resize((827, h), Image.LANCZOS)
        assert small.size == (827, 937), (no, small.size)
        small.save(os.path.join(ROOT, f'assets/images/cards/skills/stellard_sk_{no:02d}.webp'), 'WEBP', quality=90, method=6)


def official() -> None:
    im = Image.open(os.path.join(SRC, 'stellard_official.png')).convert('RGB')
    im.resize((508, 849), Image.LANCZOS).save(os.path.join(ROOT, 'assets/images/cards/monsters/stellard_official.webp'), 'WEBP', quality=90, method=6)


def battle() -> None:
    # 【絵の直し】1：届いた絵の余白（上 約45px・下 約49px〔うすい所も入れて〕）はほかの子（フギン 123／90・ロウガ 50／37）と同じくらいなので、足さない。透明度だけ 0／255 に
    subprocess.run(
        [sys.executable, '-I', os.path.join(ROOT, 'tools/art/alpha_binarize.py'), os.path.join(SRC, 'stellard_battle_transparent.png'), os.path.join(ROOT, 'assets/images/cards/monsters/stellard_battlecard.png')],
        check=True,
    )


def pack() -> None:
    tpl = np.array(Image.open(os.path.join(ROOT, 'design-parts/gacha-20261029/pack_template_symmetric.png')).convert('RGBA'))
    window = Image.open(os.path.join(SRC, 'pack_art_stellard.png')).convert('RGBA')
    # 【絵の直し】2：ほかの子と同じ合わせ方（cover：型の高さいっぱい）だと、槍の穂先（絵の下 約93％）が窓の下の飾りの裏に入る。
    # 絵をのばさずに型の高さの PACK_FIT 倍に縮め、横は真ん中・縦も真ん中に置く（頭〔絵の上 約13％〕と穂先が窓の中に入る。絵の横の外は袋の裏）
    W0, H0 = tpl.shape[1], tpl.shape[0]
    h = round(H0 * PACK_FIT)
    small = window.resize((round(window.width * h / window.height), h), Image.LANCZOS)
    art0 = Image.new('RGBA', (W0, H0), (0, 0, 0, 0))
    art0.alpha_composite(small.crop(((small.width - W0) // 2, 0, (small.width - W0) // 2 + W0, h)) if small.width > W0 else small, (max(0, (W0 - small.width) // 2), (H0 - h) // 2))
    # 顔と角が窓の上の飾りに隠れるときは、絵を PACK_SHIFT px 下げて上の方を見せる（フギン・ノウスと同じ。絵は描き直さない）
    art = Image.new('RGBA', art0.size, (0, 0, 0, 0))
    art.alpha_composite(art0, (0, PACK_SHIFT))
    frame = Image.fromarray(pack_tint.tint_template(tpl, COLOR), 'RGBA')
    out = art.copy()
    out.alpha_composite(frame)
    a = np.array(out)
    outside = tpl[..., 3] < 10
    inner = np.zeros(outside.shape, bool)
    inner[233:1450, 121:815] = True
    a[outside & ~inner, 3] = 0
    os.makedirs(BUILD, exist_ok=True)
    Image.fromarray(a, 'RGBA').save(os.path.join(BUILD, 'pack_stellard.png'))
    Image.fromarray(a, 'RGBA').resize((600, 1080), Image.LANCZOS).save(os.path.join(ROOT, 'assets/images/ui/gacha/pack_stellard.webp'), 'WEBP', quality=90, method=6)


def logos() -> None:
    for lang, folder in (('ja', 'logos'), ('en', 'logos_en')):
        a = np.array(Image.open(os.path.join(SRC, f'name_{lang}_stellard.png')).convert('RGBA'))
        a[a[..., 3] <= HAZE] = 0
        im = Image.fromarray(a, 'RGBA')
        op = im.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
        k = LOGO_HEIGHT[lang] / (op[3] - op[1])
        small = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        op = small.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
        canvas = Image.new('RGBA', (1400, 300), (0, 0, 0, 0))
        canvas.alpha_composite(small, (LOGO_ANCHOR[0] - op[0], LOGO_ANCHOR[1] - op[1]))
        canvas.save(os.path.join(ROOT, 'design-parts/card-names-20261105', folder, f'name_{lang}_stellard.png'))


if __name__ == '__main__':
    only = sys.argv[1:] or ['skills', 'official', 'battle', 'pack', 'logos']
    for name in only:
        globals()[name]()
    print('ok')
