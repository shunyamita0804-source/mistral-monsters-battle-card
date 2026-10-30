# -*- coding: utf-8 -*-
"""新しいダンジョン5つの名前の絵と「新しいダンジョン発見」の帯を、ゲーム用に作る（2026-10-28 届いた6枚）

使い方: python3 -I tools/design/dungeon_titles_build.py design-parts/dungeon-titles-20261028 assets/images/ui [wind …（作る名前の絵だけ。省くと全部と帯）]

- 名前の絵（title_{d}.png・1000×700 透明）：まわりの透明な所を切り落として WebP（遺跡・森の名前の絵 dungeon_intro_build.py と同じ作り方）
  → dungeon_intro/{d}_title.webp
- 帯（banner_dungeon_found.png・760×450 透明）：文字を重ねる位置を絵の割合で決めているので、切り落とさずにそのまま WebP
  → banners/banner_dungeon_found.webp（ランクアップの帯 banner_rankup.webp と同じ大きさ）
- 風の渓谷（2026-10-30 指示書 U）の名前の絵は、ほかの風の渓谷の絵と同じ所の design-parts/dungeons5-20261028/wind/wind_valley_title.png（1000×700 透明）
- 絵そのもの（色・形）は変えない
"""
import os
import sys

from PIL import Image

DUNGEONS = ('water', 'ice', 'fire', 'machine', 'holy', 'wind')
# 名前の絵がほかの所にあるもの（src からの相対パス）
TITLE_FILES = {'wind': os.path.join('..', 'dungeons5-20261028', 'wind', 'wind_valley_title.png')}
# 名前の絵の幅の上限（遺跡・森と同じ）
MAX_W = 1000


def save(im: Image.Image, dst: str) -> None:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'WEBP', quality=90, method=6)
    print(dst, im.size, os.path.getsize(dst) // 1024, 'KB')


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    only = sys.argv[3:]
    for d in only or DUNGEONS:
        im = Image.open(os.path.join(src, TITLE_FILES.get(d, f'title_{d}.png'))).convert('RGBA')
        # ほとんど見えない所（alpha 8 以下）は外して、まわりを切り落とす
        im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        save(im, os.path.join(out, 'dungeon_intro', f'{d}_title.webp'))
    if only:
        return
    save(Image.open(os.path.join(src, 'banner_dungeon_found.png')).convert('RGBA'), os.path.join(out, 'banners', 'banner_dungeon_found.webp'))


if __name__ == '__main__':
    main()
