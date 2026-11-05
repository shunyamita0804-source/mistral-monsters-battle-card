"""カードの名前のロゴ（2026-11-05 指示書 AZ【7】）をゲーム用にする。
python3 -I tools/art/card_name_logos.py
- design-parts/card-names-20261105/logos/name_ja_{key}.png（1400×300 透明）を、絵のある所だけ切り抜いて高さ 128px の WebP に（assets/images/ui/card_name/logos/name_ja_{key}.webp）
- name_swoosh.png（白 1000×120）も絵のある所だけ切り抜いて WebP に（ゲームで枠の色に染める。CSS の mask）
- 枠の色：名前を消した正式カードの原本（design-parts/card-names-20261105/noname/）の左の枠の帯を測った色（中央値）
- 表 src/data/cardNameLogos.generated.ts（切り抜いた大きさ・字の位置〔原本の左 40px・上 55px・高さ 170px〕・枠の色）
"""
import glob
import os
import re

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/card-names-20261105')
OUT = os.path.join(ROOT, 'assets/images/ui/card_name')
H = 128
GLYPH = {'left': 40, 'top': 55, 'height': 170}


def frame_color(key: str) -> str:
    f = glob.glob(os.path.join(SRC, 'noname', f'*_{key}_official_noname.png'))[0]
    a = np.array(Image.open(f).convert('RGB')).astype(int)
    band = a[300:1300, 10:28].reshape(-1, 3)
    return '#%02X%02X%02X' % tuple(int(v) for v in np.median(band, axis=0))


def main() -> None:
    os.makedirs(os.path.join(OUT, 'logos'), exist_ok=True)
    rows = []
    for f in sorted(glob.glob(os.path.join(SRC, 'logos', 'name_ja_*.png'))):
        key = re.match(r'name_ja_(.+)\.png', os.path.basename(f)).group(1)
        im = Image.open(f).convert('RGBA')
        x0, y0, x1, y1 = im.getbbox()
        crop = im.crop((x0, y0, x1, y1))
        k = H / crop.height
        crop.resize((round(crop.width * k), H), Image.LANCZOS).save(os.path.join(OUT, 'logos', f'name_ja_{key}.webp'), 'WEBP', quality=92, method=6)
        rows.append((key, x0, y0, x1 - x0, y1 - y0, frame_color(key)))
    sw = Image.open(os.path.join(SRC, 'logos', 'name_swoosh.png')).convert('RGBA')
    sw.crop(sw.getbbox()).save(os.path.join(OUT, 'name_swoosh.webp'), 'WEBP', quality=92, method=6)
    lines = [
        '// 自動で作った表（tools/art/card_name_logos.py）。手で直さない',
        '/** 名前のロゴ（原本 1400×300 から絵のある所を切り抜いた位置と大きさ・原本の px）と、そのカードの枠の色（スウッシュを染める色） */',
        'export interface CardNameLogo {',
        '  readonly file: string;',
        '  readonly x: number;',
        '  readonly y: number;',
        '  readonly w: number;',
        '  readonly h: number;',
        '  readonly frame: string;',
        '}',
        f"/** 原本の中の字の部分（左・上・高さ。指示書 AZ） */",
        f"export const LOGO_GLYPH = {{ left: {GLYPH['left']}, top: {GLYPH['top']}, height: {GLYPH['height']} }} as const;",
        'export const CARD_NAME_LOGOS: Readonly<Record<string, CardNameLogo>> = {',
    ]
    for key, x, y, w, h, c in rows:
        lines.append(f"  'mon-{key}': {{ file: 'name_ja_{key}.webp', x: {x}, y: {y}, w: {w}, h: {h}, frame: '{c}' }},")
    lines.append('};')
    open(os.path.join(ROOT, 'src/data/cardNameLogos.generated.ts'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print(len(rows), 'logos')


if __name__ == '__main__':
    main()
