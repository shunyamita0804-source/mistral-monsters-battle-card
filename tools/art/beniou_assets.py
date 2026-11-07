"""ベニオウ（2026-11-07 指示書 BP）の絵を、ゲームで使う形にする。作り方はノウス（tools/art/nous_assets.py）と同じ。
python3 -I tools/art/beniou_assets.py [skills official battle pack logos]

原本は design-parts/bp-beniou-20261107/art/ に無改変で置いてある（描き直し・色の変更はしない。縮める・形式を変える・透明度をそろえる・余白を足すだけ）。
- 技 skills/beniou_sk_01〜12.png（827×937）→ assets/images/cards/skills/beniou_sk_NN.webp
- 正式カード beniou_official.png（970×1622。名前なし・LIFE 8 入り・えんじの枠）→ assets/images/cards/monsters/beniou_official.webp（508×849）
- バトル用 beniou_battle_transparent.png（1170×1345・透明）：髪の上が約8px でほぼ端なので（【絵の直し】1）、体を縮めて（切らない）同じ大きさの真ん中に置き、
  上 90px・下 70px の透明の余白を足す（ノウスと同じ）→ 透明度を 0／255 にそろえて assets/images/cards/monsters/beniou_battlecard.png（色は変えない）
- パック：窓の絵 pack_art_beniou.png（948×1660）をほかの子と同じ型に入れる（縁は深いえんじ #6B1E3A）→ assets/images/ui/gacha/pack_beniou.webp。
  顔と角が窓の飾りにかかるときは PACK_SHIFT px 下げる（【絵の直し】2）
- 名前のロゴ name_ja_beniou.png（2008×783）・name_en_beniou.png（2046×769）：まわりのもやを消し、字の高さをそろえて（日本語 174px・英語 160px）1400×300 の形に
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/bp-beniou-20261107/art')
BUILD = os.path.join(ROOT, 'design-parts/bp-beniou-20261107/build')
COLOR = '#6B1E3A'
LOGO_HEIGHT = {'ja': 174, 'en': 160}
LOGO_ANCHOR = (38, 53)
PACK_SHIFT = int(os.environ.get('PACK_SHIFT', 0))  # パックの窓で絵を下げる量（型の px）
BATTLE_MARGIN = (90, 70)  # バトル用の体の上・下の余白（px。ノウスと同じ）
HAZE = 2  # この透明度以下のもやは透明に（ロゴ）

sys.path.insert(0, os.path.join(ROOT, 'tools/design'))
import pack_tint  # noqa: E402


def skills() -> None:
    for no in range(1, 13):
        path = os.path.join(SRC, 'skills', f'beniou_sk_{no:02d}.png')
        im = Image.open(path).convert('RGB')
        h = round(im.height * 827 / im.width)
        small = im.resize((827, h), Image.LANCZOS)
        assert small.size == (827, 937), (no, small.size)
        small.save(os.path.join(ROOT, f'assets/images/cards/skills/beniou_sk_{no:02d}.webp'), 'WEBP', quality=90, method=6)


def official() -> None:
    im = Image.open(os.path.join(SRC, 'beniou_official.png')).convert('RGB')
    im.resize((508, 849), Image.LANCZOS).save(os.path.join(ROOT, 'assets/images/cards/monsters/beniou_official.webp'), 'WEBP', quality=90, method=6)


def battle() -> None:
    os.makedirs(BUILD, exist_ok=True)
    src = Image.open(os.path.join(SRC, 'beniou_battle_transparent.png')).convert('RGBA')
    W, H = src.size
    box = src.split()[3].point(lambda v: 255 if v > 0 else 0).getbbox()
    body = src.crop(box)
    k = (H - BATTLE_MARGIN[0] - BATTLE_MARGIN[1]) / body.height
    small = body.resize((round(body.width * k), round(body.height * k)), Image.LANCZOS)
    assert small.width <= W, small.size
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(small, ((W - small.width) // 2, BATTLE_MARGIN[0]))
    padded = os.path.join(BUILD, 'beniou_battle_padded.png')
    canvas.save(padded)
    print('バトル用 縮め', round(k, 3), '体', small.size)
    subprocess.run(
        [sys.executable, '-I', os.path.join(ROOT, 'tools/art/alpha_binarize.py'), padded, os.path.join(ROOT, 'assets/images/cards/monsters/beniou_battlecard.png')],
        check=True,
    )


def pack() -> None:
    tpl = np.array(Image.open(os.path.join(ROOT, 'design-parts/gacha-20261029/pack_template_symmetric.png')).convert('RGBA'))
    window = Image.open(os.path.join(SRC, 'pack_art_beniou.png')).convert('RGBA')
    art0 = pack_tint.cover(window, (tpl.shape[1], tpl.shape[0]))
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
    Image.fromarray(a, 'RGBA').save(os.path.join(BUILD, 'pack_beniou.png'))
    Image.fromarray(a, 'RGBA').resize((600, 1080), Image.LANCZOS).save(os.path.join(ROOT, 'assets/images/ui/gacha/pack_beniou.webp'), 'WEBP', quality=90, method=6)


def logos() -> None:
    for lang, folder in (('ja', 'logos'), ('en', 'logos_en')):
        a = np.array(Image.open(os.path.join(SRC, f'name_{lang}_beniou.png')).convert('RGBA'))
        a[a[..., 3] <= HAZE] = 0
        im = Image.fromarray(a, 'RGBA')
        op = im.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
        k = LOGO_HEIGHT[lang] / (op[3] - op[1])
        small = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        op = small.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
        canvas = Image.new('RGBA', (1400, 300), (0, 0, 0, 0))
        canvas.alpha_composite(small, (LOGO_ANCHOR[0] - op[0], LOGO_ANCHOR[1] - op[1]))
        canvas.save(os.path.join(ROOT, 'design-parts/card-names-20261105', folder, f'name_{lang}_beniou.png'))


if __name__ == '__main__':
    only = sys.argv[1:] or ['skills', 'official', 'battle', 'pack', 'logos']
    for name in only:
        globals()[name]()
    print('ok')
