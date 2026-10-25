"""技カードの能力のバー（bar_force.png・bar_wisdom.png）の左の丸い印（拳・本）だけを切り出して、バトルの状態の印に使う（2026-10-24）。
バーの絵は変えない。丸の外は透明にする。
python3 -I tools/design/stat_icon_crop.py
"""
from PIL import Image, ImageDraw

SRC = 'design-parts/ui-skillcard-v4-retired'  # 旧V4 の部品（2026-10-25 に退役。ゲームでは使わない）
OUT = 'assets/images/ui/battle'
for stat in ('force', 'wisdom'):
    bar = Image.open(f'{SRC}/bar_{stat}.png').convert('RGBA')
    # 丸（金の輪の外側）は中心 (55, 60)・半径 53（bar_force.png で測った値。bar_wisdom.png も同じ形）
    box = (2, 7, 108, 113)
    size = box[2] - box[0]
    icon = bar.crop(box)
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((4, 4, size * 4 - 4, size * 4 - 4), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    a = Image.composite(icon.getchannel('A'), Image.new('L', (size, size), 0), mask)
    icon.putalpha(a)
    icon.resize((96, 96), Image.LANCZOS).save(f'{OUT}/icon_stat_{stat}.webp', 'WEBP', lossless=True)
    print(stat, size)
