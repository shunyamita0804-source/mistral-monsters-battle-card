"""対戦の場の状態の印（2026-10-29 ZIP「Mistral_Packs7_Shop_Status」の status/）を WebP にする。

使い方：
  python3 -I tools/design/status_marks_build.py design-parts/gacha-20261029/status

原本（512×512・透過。進行が検品済み）は描き直さない。まわりの透明を切りとって 128px にそろえるだけ。
- status_charged.png：ためている（プカリムのほっぺにためる）
- status_tailwind.png：おいかぜ＋1
書き出し先：assets/images/ui/battle/
"""

import sys
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parents[2] / 'assets' / 'images' / 'ui' / 'battle'
NAMES = ['status_charged', 'status_tailwind']
SIZE = 128


def main(src: Path) -> None:
    for name in NAMES:
        im = Image.open(src / f'{name}.png').convert('RGBA')
        im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
        s = SIZE / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        im.save(OUT / f'{name}.webp', quality=90, method=6)
        print(name, im.size)


if __name__ == '__main__':
    main(Path(sys.argv[1]))
