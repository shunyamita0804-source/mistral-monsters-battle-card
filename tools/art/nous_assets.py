"""ノウス（2026-11-07 指示書 BN）の絵を、ゲームで使う形にする。作り方はフギン（tools/art/huginn_assets.py）と同じ。
python3 -I tools/art/nous_assets.py

原本は design-parts/bn-nous-20261107/art/ に無改変で置いてある（描き直し・色の変更はしない。縮める・形式を変える・透明度をそろえる・余白を足すだけ）。
- 技 skills/nous_sk_01〜12.png（827×937）→ assets/images/cards/skills/nous_sk_NN.webp
  - 11 だけ、右上に浮いている壺を消したもの（tools/art/nous_skill11_fix.py。指示書の【絵の直し】3）を使う。build/nous_sk_11_fixed.png
- 正式カード nous_official.png（969×1622。名前なし・LIFE 7 入り）→ assets/images/cards/monsters/nous_official.webp（508×849）
- バトル用 nous_battle_transparent.png（1169×1345・透明）：頭の上 約8px・ひづめの下 約3px でほぼ端なので（【絵の直し】1）、
  体を BATTLE_SCALE に縮めて（切らない）同じ 1169×1345 の真ん中に置き、まわりに透明の余白を足す → 透明度を 0／255 にそろえて
  assets/images/cards/monsters/nous_battlecard.png（色は変えない）
- パック：窓の絵 pack_art_nous.png（948×1660）をほかの子と同じ型に入れる（縁は深い琥珀 #CC6A1F）→ assets/images/ui/gacha/pack_nous.webp。
  水晶の頭が窓の上の飾りにかからないよう、絵を PACK_SHIFT px 下げる（【絵の直し】2。フギンと同じ直し）
- 名前のロゴ name_ja_nous.png（2000×827）・name_en_nous.png（2000×819）：まわりのもやを消し、字の高さをそろえて（日本語 174px・英語 160px）1400×300 の形に
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/bn-nous-20261107/art')
BUILD = os.path.join(ROOT, 'design-parts/bn-nous-20261107/build')
COLOR = '#CC6A1F'
LOGO_HEIGHT = {'ja': 174, 'en': 160}
LOGO_ANCHOR = (38, 53)
PACK_SHIFT = int(os.environ.get('PACK_SHIFT', 150))  # パックの窓で絵を下げる量（型の px）
BATTLE_MARGIN = (90, 70)  # バトル用の体の上・下の余白（px。フギン 123／90・ロウガ 50／37 の間）
HAZE = 2  # この透明度以下のもやは透明に（ロゴ）

sys.path.insert(0, os.path.join(ROOT, 'tools/design'))
import pack_tint  # noqa: E402


def skills() -> None:
    os.makedirs(BUILD, exist_ok=True)
    fixed = os.path.join(BUILD, 'nous_sk_11_fixed.png')
    subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'tools/art/nous_skill11_fix.py'), os.path.join(SRC, 'skills', 'nous_sk_11.png'), fixed], check=True)
    for no in range(1, 13):
        path = fixed if no == 11 else os.path.join(SRC, 'skills', f'nous_sk_{no:02d}.png')
        im = Image.open(path).convert('RGB')
        h = round(im.height * 827 / im.width)
        small = im.resize((827, h), Image.LANCZOS)
        assert small.size == (827, 937), (no, small.size)
        small.save(os.path.join(ROOT, f'assets/images/cards/skills/nous_sk_{no:02d}.webp'), 'WEBP', quality=90, method=6)


def official() -> None:
    im = Image.open(os.path.join(SRC, 'nous_official.png')).convert('RGB')
    im.resize((508, 849), Image.LANCZOS).save(os.path.join(ROOT, 'assets/images/cards/monsters/nous_official.webp'), 'WEBP', quality=90, method=6)


def battle() -> None:
    src = Image.open(os.path.join(SRC, 'nous_battle_transparent.png')).convert('RGBA')
    W, H = src.size
    box = src.split()[3].point(lambda v: 255 if v > 0 else 0).getbbox()
    body = src.crop(box)
    k = (H - BATTLE_MARGIN[0] - BATTLE_MARGIN[1]) / body.height
    small = body.resize((round(body.width * k), round(body.height * k)), Image.LANCZOS)
    assert small.width <= W, small.size
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(small, ((W - small.width) // 2, BATTLE_MARGIN[0]))
    padded = os.path.join(BUILD, 'nous_battle_padded.png')
    canvas.save(padded)
    print('バトル用 縮め', round(k, 3), '体', small.size)
    subprocess.run(
        [sys.executable, '-I', os.path.join(ROOT, 'tools/art/alpha_binarize.py'), padded, os.path.join(ROOT, 'assets/images/cards/monsters/nous_battlecard.png')],
        check=True,
    )


def pack() -> None:
    tpl = np.array(Image.open(os.path.join(ROOT, 'design-parts/gacha-20261029/pack_template_symmetric.png')).convert('RGBA'))
    window = Image.open(os.path.join(SRC, 'pack_art_nous.png')).convert('RGBA')
    art0 = pack_tint.cover(window, (tpl.shape[1], tpl.shape[0]))
    # 水晶の頭が窓の上の飾りに隠れないよう、絵を PACK_SHIFT px 下げて上の方を見せる（フギンと同じ。絵は描き直さない）
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
    Image.fromarray(a, 'RGBA').save(os.path.join(BUILD, 'pack_nous.png'))
    Image.fromarray(a, 'RGBA').resize((600, 1080), Image.LANCZOS).save(os.path.join(ROOT, 'assets/images/ui/gacha/pack_nous.webp'), 'WEBP', quality=90, method=6)


def logos() -> None:
    for lang, folder in (('ja', 'logos'), ('en', 'logos_en')):
        a = np.array(Image.open(os.path.join(SRC, f'name_{lang}_nous.png')).convert('RGBA'))
        a[a[..., 3] <= HAZE] = 0
        im = Image.fromarray(a, 'RGBA')
        op = im.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
        k = LOGO_HEIGHT[lang] / (op[3] - op[1])
        small = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        op = small.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
        canvas = Image.new('RGBA', (1400, 300), (0, 0, 0, 0))
        canvas.alpha_composite(small, (LOGO_ANCHOR[0] - op[0], LOGO_ANCHOR[1] - op[1]))
        canvas.save(os.path.join(ROOT, 'design-parts/card-names-20261105', folder, f'name_{lang}_nous.png'))


if __name__ == '__main__':
    only = sys.argv[1:] or ['skills', 'official', 'battle', 'pack', 'logos']
    for name in only:
        globals()[name]()
    print('ok')
