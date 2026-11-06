"""フギン（2026-11-06 指示書 BM）の絵を、ゲームで使う形にする。作り方はクロシオ（tools/art/kuroshio_assets.py）と同じ。
python3 -I tools/art/huginn_assets.py

原本は design-parts/bm-huginn-20261106/art/ に無改変で置いてある（描き直し・色の変更はしない。縮める・形式を変える・透明度をそろえるだけ）。
- 技 skills/huginn_sk_01〜12.png（827×937）→ assets/images/cards/skills/huginn_sk_NN.webp
- 正式カード huginn_official.png（970×1622。名前なし・LIFE 6 入り。枠だけ緑にした build/huginn_official_green.png〔tools/art/huginn_frame_green.py〕を使う）→ assets/images/cards/monsters/huginn_official.webp（508×849）
- バトル用 huginn_battle_transparent.png（1169×1345・透明）→ 透明度を 0／255 にそろえて assets/images/cards/monsters/huginn_battlecard.png（色は変えない）
- パック：窓の絵 pack_art_huginn.png（949×1658）をほかの子と同じ型に入れる（縁は深い翠の緑 #1E6B45）→ assets/images/ui/gacha/pack_huginn.webp
- 名前のロゴ name_ja_huginn.png（2003×785）・name_en_huginn.png（2087×753）：まわりのもやを消し、字の高さをそろえて（日本語 174px・英語 160px）1400×300 の形に
"""
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/bm-huginn-20261106/art')
BUILD = os.path.join(ROOT, 'design-parts/bm-huginn-20261106/build')
COLOR = '#1E6B45'
LOGO_HEIGHT = {'ja': 174, 'en': 160}
LOGO_ANCHOR = (38, 53)
PACK_SHIFT = int(os.environ.get('PACK_SHIFT', 180))  # パックの窓で絵を下げる量（型の px。BM の直し）
HAZE = 2  # この透明度以下のもやは透明に（ロゴ）

sys.path.insert(0, os.path.join(ROOT, 'tools/design'))
import pack_tint  # noqa: E402


def skills() -> None:
    for no in range(1, 13):
        im = Image.open(os.path.join(SRC, 'skills', f'huginn_sk_{no:02d}.png')).convert('RGB')
        h = round(im.height * 827 / im.width)
        small = im.resize((827, h), Image.LANCZOS)
        assert small.size == (827, 937), (no, small.size)
        small.save(os.path.join(ROOT, f'assets/images/cards/skills/huginn_sk_{no:02d}.webp'), 'WEBP', quality=90, method=6)


def official() -> None:
    # 2026-11-06 BM の直し：枠だけを深い翠の緑にした絵（tools/art/huginn_frame_green.py。原本は変えない）を使う
    im = Image.open(os.path.join(BUILD, 'huginn_official_green.png')).convert('RGB')
    small = im.resize((508, 849), Image.LANCZOS)
    small.save(os.path.join(ROOT, 'assets/images/cards/monsters/huginn_official.webp'), 'WEBP', quality=90, method=6)
    subprocess.run(
        [sys.executable, '-I', os.path.join(ROOT, 'tools/art/alpha_binarize.py'), os.path.join(SRC, 'huginn_battle_transparent.png'),
         os.path.join(ROOT, 'assets/images/cards/monsters/huginn_battlecard.png')],
        check=True,
    )


def pack() -> None:
    tpl = np.array(Image.open(os.path.join(ROOT, 'design-parts/gacha-20261029/pack_template_symmetric.png')).convert('RGBA'))
    window = Image.open(os.path.join(SRC, 'pack_art_huginn.png')).convert('RGBA')
    art0 = pack_tint.cover(window, (tpl.shape[1], tpl.shape[0]))
    # 2026-11-06 BM の直し（ユーザー指示）：ほかの子と同じ合わせ方だと2つの頭が窓の上の飾りに隠れるので、絵を PACK_SHIFT px 下げて上の方を見せる
    # （絵は描き直さない。下がった分の上のすきまは窓の外の飾りの裏になる。下のはしは窓の外に出る）
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
    Image.fromarray(a, 'RGBA').save(os.path.join(BUILD, 'pack_huginn.png'))
    Image.fromarray(a, 'RGBA').resize((600, 1080), Image.LANCZOS).save(os.path.join(ROOT, 'assets/images/ui/gacha/pack_huginn.webp'), 'WEBP', quality=90, method=6)


def logos() -> None:
    for lang, folder in (('ja', 'logos'), ('en', 'logos_en')):
        a = np.array(Image.open(os.path.join(SRC, f'name_{lang}_huginn.png')).convert('RGBA'))
        a[a[..., 3] <= HAZE] = 0
        im = Image.fromarray(a, 'RGBA')
        op = im.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
        k = LOGO_HEIGHT[lang] / (op[3] - op[1])
        small = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        op = small.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
        canvas = Image.new('RGBA', (1400, 300), (0, 0, 0, 0))
        canvas.alpha_composite(small, (LOGO_ANCHOR[0] - op[0], LOGO_ANCHOR[1] - op[1]))
        canvas.save(os.path.join(ROOT, 'design-parts/card-names-20261105', folder, f'name_{lang}_huginn.png'))


if __name__ == '__main__':
    skills()
    official()
    pack()
    logos()
    print('ok')
