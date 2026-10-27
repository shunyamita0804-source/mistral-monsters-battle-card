"""装飾なしのカードの裏面（2026-10-27 デザイン担当「MistralBC_CardBack_Plain」）をゲームの部品にする。

使い方：
  python3 -I tools/design/card_back_build.py design-parts/card-back-plain-20261027

- 裏面（card_back）と図鑑の未所持（card_unknown）：届いた無地の裏面の真ん中に、前の裏面（旧_card_back_星の切り出し元.webp）の
  「星とまわりの円」だけを重ねる（2026-10-27 ユーザー指示「寂しすぎるので、アイコン1つ入れて」→ 案A の星とその周りの円）。
  星と円は金色の所だけを取り出し（前の裏面の明るい紺・四角い枠・翼は入れない）、無地の裏面の紺の上に置く。未所持は暗くくすませる。
  ゲーム用は幅 400 の 2:3（400×600）。星と円は前の裏面と同じ大きさ（拡大しない）
- 山札・手札・捨て札のアイコン、ショップの「カードを見る」の札、カードの束、遊び方の図1、特別復元の場面：
  届いた絵を、いまのゲームの絵と同じ大きさに縮めて WebP にするだけ（描き直さない）
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2] / 'assets' / 'images' / 'ui'

# 前の裏面（400×586）の星と円の中心と、取り出す範囲（円＋星の4本の先）
OLD_CENTER = (200, 290)
RING_R = 62
TIP_X = 76  # 横の先までの長さ
TIP_Y = 87  # 縦の先までの長さ
TIP_W = 11  # 先の部分の太さ（中心での半分の幅）
RING_OUTER = 59  # 描き足す円の外側の半径と太さ
RING_WIDTH = 4
BACK_SIZE = (400, 600)


def emblem(old: Image.Image) -> Image.Image:
    """前の裏面から、金色の星と円だけ（まわりは透明）"""
    a = np.asarray(old.convert('RGBA')).astype(np.float32)
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    dx = np.abs(xx - OLD_CENTER[0])
    dy = np.abs(yy - OLD_CENTER[1])
    # 円の左右は前の裏面の四角い枠の縦の線と重なっているので、円の外側の端（dx が 57 以上）は横の先の細い所だけ残す
    ring = (dx**2 + dy**2 <= RING_R**2) & ~((dx >= 56) & (dy <= 40))
    region = ring | (dx / TIP_X + dy / TIP_W <= 1) | (dy / TIP_Y + dx / TIP_W <= 1)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # 紺（青が赤よりずっと強い）だけを消す。金と、星の明るい面（白っぽい金）は残す
    keep = np.clip((r - b + 45) / 55, 0, 1)
    bright = np.clip((np.maximum(r, g) - 200) / 30, 0, 1)
    gold = np.maximum(keep, bright)
    alpha = (gold * region * 255).astype(np.uint8)
    out = np.dstack([a[..., :3].astype(np.uint8), alpha])
    left, top = OLD_CENTER[0] - TIP_X - 4, OLD_CENTER[1] - TIP_Y - 4
    star = Image.fromarray(out, 'RGBA').crop((left, top, OLD_CENTER[0] + TIP_X + 5, OLD_CENTER[1] + TIP_Y + 5))
    # 枠の線を消すために切った円の左右の短い所を、円の上の所と同じ金色で描き足して、円を1本につなぐ（星の下に敷く）
    ring_rgb = tuple(int(v) for v in np.median(a[OLD_CENTER[1] - RING_R + 2 : OLD_CENTER[1] - RING_R + 5, OLD_CENTER[0] - 6 : OLD_CENTER[0] + 6, :3].reshape(-1, 3), axis=0))
    k = 4
    big = Image.new('RGBA', (star.width * k, star.height * k), (0, 0, 0, 0))
    cx, cy = (OLD_CENTER[0] - left) * k, (OLD_CENTER[1] - top) * k
    draw = ImageDraw.Draw(big)
    for start, end in ((-30, 30), (150, 210)):
        draw.arc((cx - RING_OUTER * k, cy - RING_OUTER * k, cx + RING_OUTER * k, cy + RING_OUTER * k), start, end, fill=ring_rgb + (255,), width=RING_WIDTH * k)
    base = big.resize(star.size, Image.LANCZOS)
    base.alpha_composite(star)
    return base


def with_emblem(back: Image.Image, em: Image.Image, dim: bool = False) -> Image.Image:
    card = back.convert('RGBA').resize(BACK_SIZE, Image.LANCZOS)
    if dim:
        # 未所持：灰色にくすませて暗く
        rgb = np.asarray(em).astype(np.float32)
        gray = rgb[..., :3].mean(axis=2, keepdims=True)
        rgb[..., :3] = (gray * 0.55 + rgb[..., :3] * 0.15) * 0.75
        em = Image.fromarray(rgb.clip(0, 255).astype(np.uint8), 'RGBA')
    card.alpha_composite(em, ((BACK_SIZE[0] - em.width) // 2, (BACK_SIZE[1] - em.height) // 2))
    return card


def fit_width(img: Image.Image, width: int) -> Image.Image:
    box = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox() if img.mode == 'RGBA' else None
    if box:
        img = img.crop(box)
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


def save(img: Image.Image, path: Path) -> None:
    img.save(path, quality=88, method=6)


def main(src: Path) -> None:
    em = emblem(Image.open(src / '旧_card_back_星の切り出し元.webp'))
    a = src / 'assets'
    save(with_emblem(Image.open(a / 'card_back.png'), em), ROOT / 'card_back.webp')
    unknown = with_emblem(Image.open(a / 'card_unknown.png'), em, dim=True)
    save(unknown.resize((360, 540), Image.LANCZOS), ROOT / 'card_unknown.webp')
    for name in ('icon_deck', 'icon_hand', 'icon_discard'):
        save(fit_width(Image.open(a / f'{name}.png').convert('RGBA'), 128), ROOT / 'battle' / f'{name}.webp')
    save(Image.open(a / 'menu_browse.png').convert('RGBA').resize((900, 179), Image.LANCZOS), ROOT / 'shop' / 'menu_browse.webp')
    save(fit_width(Image.open(a / 'card_bundle.png').convert('RGBA'), 204), ROOT / 'reward' / 'card_bundle.webp')
    save(Image.open(a / 'rules_1.png').convert('RGB').resize((480, 281), Image.LANCZOS), ROOT / 'rules' / 'rules_1.webp')
    save(Image.open(a / 'restore_scene.png').convert('RGB').resize((600, 782), Image.LANCZOS), ROOT / 'restore' / 'restore_scene.webp')


if __name__ == '__main__':
    main(Path(sys.argv[1]))
