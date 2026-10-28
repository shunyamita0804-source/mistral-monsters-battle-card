"""技カードのマナの球・分類の八角形の札を、前の版の枠（c57b589 の skillcard_v5/frame_normal_*.webp）から切り出す
（2026-10-29 ユーザー「マナとダメージのとこは前のUI使ってね」「戻すのは見た目だけ」）。

使い方：python3 -I tools/art/old_parts_build.py（npm run art:skillframes から呼ぶ）
前の版の枠は design-parts/ui-skillcard-simple-20261028/old-v5-frames-c57b589/ に置いた（そのときのゲームの絵をそのまま。2倍の大きさ 506×764）。
描き直さない。八角形・円の形で切り抜くだけ。
書き出し：assets/images/ui/skillcard_simple/tile_{分類}.webp（分類の札）・mana_ball.webp（数字の入らない球。数字はゲームが重ねる）
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'design-parts/ui-skillcard-simple-20261028/old-v5-frames-c57b589'
OUT = ROOT / 'assets/images/ui/skillcard_simple'
# 分類の札の金のふちの外形（前の枠の 2倍の px）と角の切り落とし
TILE = (35, 76, 161, 212)
CHAMFER = 16
# マナの球の金の輪の外形（円）
BALL = (34, 209, 161, 336)


def cut(im: Image.Image, box: tuple[int, int, int, int], shape: str) -> Image.Image:
    m = Image.new('L', im.size, 0)
    d = ImageDraw.Draw(m)
    x1, y1, x2, y2 = box
    if shape == 'oct':
        c = CHAMFER
        d.polygon([(x1 + c, y1), (x2 - c, y1), (x2, y1 + c), (x2, y2 - c), (x2 - c, y2), (x1 + c, y2), (x1, y2 - c), (x1, y1 + c)], fill=255)
    else:
        d.ellipse(box, fill=255)
    out = Image.new('RGBA', im.size)
    out.paste(im, (0, 0), m)
    return out.crop(box)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for cat in ('force', 'wisdom', 'defense', 'evade', 'special'):
        im = Image.open(SRC / f'frame_normal_{cat}.webp').convert('RGBA')
        cut(im, TILE, 'oct').save(OUT / f'tile_{cat}.webp', quality=92, method=6)
    ball = cut(Image.open(SRC / 'frame_normal_support.webp').convert('RGBA'), BALL, 'circle')
    ball.save(OUT / 'mana_ball.webp', quality=92, method=6)
    print('分類の札5つ・マナの球', ball.size)


if __name__ == '__main__':
    main()
