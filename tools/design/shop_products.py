"""ショップの棚の商品を、ガチャのパックと正式モンスターカードから作る。
使い方: python3 -I shop_products.py パックのフォルダ カードの一覧.txt 出力フォルダ
カードの一覧.txt：1行に「名前<TAB>正式モンスターカードの画像のパス」
"""
import sys
import numpy as np
from PIL import Image, ImageDraw

def coeffs(src, dst):
    # dst（出力の点）→ src（元の点）の射影変換の係数
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    A = np.array(m, float); B = np.array(src, float).reshape(8)
    return np.linalg.solve(A, B).tolist()

def drop_white_corners(im):
    """四すみの外の白（角の丸みの外）を透明にする"""
    im = im.convert('RGBA')
    a = np.array(im)
    if a[0, 0, 3] < 250:
        return im
    rgb = a[..., :3].astype(int)
    white = (rgb.min(2) > 235)
    seed = Image.fromarray((white * 255).astype(np.uint8))
    for c in [(0, 0), (seed.width - 1, 0), (0, seed.height - 1), (seed.width - 1, seed.height - 1)]:
        ImageDraw.floodfill(seed, c, 128)
    out = np.array(seed) == 128
    a[out, 3] = 0
    return Image.fromarray(a, 'RGBA')

def pack_small(path):
    im = Image.open(path).convert('RGBA')
    S = 2
    W, H = 120 * S, 210 * S
    ph = 188 * S; pw = round(im.width * ph / im.height)
    sm = im.resize((pw, ph), Image.LANCZOS)
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); c.alpha_composite(sm, ((W - pw) // 2, 11 * S))
    return c.resize((120, 210), Image.LANCZOS)

def card_lying(path):
    im = drop_white_corners(Image.open(path))
    S = 3
    W, H = 144 * S, 192 * S
    quad = [(28 * S, 38 * S), (116 * S, 38 * S), (140 * S, 166 * S), (4 * S, 166 * S)]
    src = [(0, 0), (im.width, 0), (im.width, im.height), (0, im.height)]
    out = im.transform((W, H), Image.PERSPECTIVE, coeffs(src, quad), Image.BICUBIC)
    return out.resize((144, 192), Image.LANCZOS)

def main(pack_dir, card_list, dst):
    for line in open(card_list, encoding='utf-8'):
        if not line.strip():
            continue
        name, card = line.rstrip('\n').split('\t')
        pack_small(f'{pack_dir}/pack_{name}.png').save(f'{dst}/shop_pack_{name}.png')
        card_lying(card).save(f'{dst}/shop_card_{name}.png')
        print('ok', name)

if __name__ == '__main__':
    main(*sys.argv[1:4])
