# -*- coding: utf-8 -*-
"""ダンジョンに入ったときの挿絵・ダンジョン名・重ねる部品を、ゲーム用に作る（2026-10-26 届いた6枚）

使い方: python3 -I tools/design/dungeon_intro_build.py design-parts/dungeon-intro-20261026 assets/images/ui/dungeon_intro

- 挿絵（*_art.png。不透明 1536×1024）：そのまま WebP に（画面では縦長に切り抜いて真ん中を見せる）
- ダンジョン名（*_title.png）・重ねる部品（*_overlay.png）：まわりの透明な所を切り落とし、幅を MAX_W まで縮めて WebP（透明つき）に
- 絵そのもの（色・形）は変えない
"""
import os
import sys

from PIL import Image

# 画面ではダンジョン名は画面の幅くらい、重ねる部品はその少し外まで出す（スマホは3倍の細かさ）
MAX_W = {'title': 1000, 'overlay': 1200}
NAMES = {
    'dungeon_ruins': 'ruins',
    'dungeon_forest': 'forest',
}


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for name, key in NAMES.items():
        for part in ('art', 'title', 'overlay'):
            im = Image.open(os.path.join(src, f'{name}_{part}.png')).convert('RGBA')
            if part == 'art':
                im = im.convert('RGB')
                dst = os.path.join(out, f'{key}_art.webp')
                im.save(dst, 'WEBP', quality=86, method=6)
            else:
                # ほとんど見えない所（alpha 8 以下）は外して、まわりを切り落とす
                box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
                im = im.crop(box)
                if im.width > MAX_W[part]:
                    im = im.resize((MAX_W[part], round(im.height * MAX_W[part] / im.width)), Image.LANCZOS)
                dst = os.path.join(out, f'{key}_{part}.webp')
                im.save(dst, 'WEBP', quality=90, method=6)
            print(dst, im.size, os.path.getsize(dst) // 1024, 'KB')


if __name__ == '__main__':
    main()
