"""正式モンスターカード（原本 PNG）から、ゲーム用の WebP（508×849）を作る（2026-10-31 指示書 AC【3】【4】）。
原本は design-parts/cards-original/ に無改変で置き、ここでは縦横比を変えずに幅 508px へ縮めるだけ（切り抜き・変形・文字入れはしない）。
ほかの正式カード（970×1622）は縮めるとちょうど 508×849。縦横比が少しちがう原本（ミュロル 974×1615 は少し横長）は、
幅 508 に縮めて足りない高さを、カードのまわりの白と同じ色で上下に半分ずつ足す（枠は切らない・ゆがめない）。
python3 -I tools/art/official_card_webp.py <原本> <出力.webp>
"""
import sys
from PIL import Image

WIDTH, HEIGHT = 508, 849  # ほかの正式カード（*_official.webp）と同じ大きさ
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
h = round(im.height * WIDTH / im.width)
small = im.resize((WIDTH, h), Image.LANCZOS)
if h < HEIGHT:
    # 足す余白の色：原本のいちばん外の1列（カードのまわりの白）の平均
    px = [im.getpixel((x, 0)) for x in range(im.width)] + [im.getpixel((x, im.height - 1)) for x in range(im.width)]
    edge = tuple(round(sum(p[i] for p in px) / len(px)) for i in range(3))
    canvas = Image.new('RGB', (WIDTH, HEIGHT), edge)
    top = (HEIGHT - h) // 2
    canvas.paste(small, (0, top))
    small = canvas
    print('pad', edge, 'top', top, 'bottom', HEIGHT - h - top)
elif h > HEIGHT:
    raise SystemExit(f'縦長すぎる原本です（{im.size}）')
small.save(dst, 'WEBP', quality=90, method=6)
print(dst, small.size)
