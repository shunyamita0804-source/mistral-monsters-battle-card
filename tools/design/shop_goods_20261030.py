# -*- coding: utf-8 -*-
"""正面向きのカードショップの商品（2026-10-30 指示書 N）。

tools/design/cardshop_v2.py が家具の絵を書き出す前に dress() を呼ぶ（組み立てるときに webp へ焼きこむ）。
家具の原本（design-parts/cardshop-frontfacing-20261030/）は描き直さない。商品の絵を切り取る・縮める・重ねるだけ。

デザインの決まり：棚の商品は無地の紺のカード・パックで描いてもらった。その紺の所（青みのある所。金のふち・棚板は手前のまま）の中だけに本物の絵を重ねる。
- 立てたパック（左右の壁ぞいの棚・奥左の段の棚・販売機の左の小さな展示台）：パック専用の絵（design-parts/gacha-20261029/shop/shop_pack_*.png）を、
  紺のパックの前の面の形に合わせて縮める。同じ絵が隣どうしで続かないよう、12種類を順に使う（2026-10-30 指示書 U でツムジ、指示書 W でヒョウズクを足した）
- ガラスの台の中のカード（中央の2つ・奥左の小さな台）：技カードの絵（assets/images/cards/skills/）。ガラスの映りこみは元の絵からもう一度上に重ねる
- 額の台の額4つ：中の紺の窓に、初期のモンスターのモンスターカードの絵（assets/images/cards/monsters/*_official.webp）を1枚ずつ
- 紺の窓の形は、青みのある所をつないだかたまりで探す（小さな上ぶた・細い影・棚の前の板〔横長〕は、大きさと形で外す）
"""
from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PACKS = os.path.join(ROOT, 'design-parts/gacha-20261029/shop')
SKILLS = os.path.join(ROOT, 'assets/images/cards/skills')
MONSTER_CARDS = os.path.join(ROOT, 'assets/images/cards/monsters')
MONSTERS = ['soramo', 'gauul', 'lazuck', 'nobiton', 'myurol', 'kalshell', 'pukarim', 'geol', 'flune', 'serephine', 'tsumuji', 'hyouzuku']
# 額の台の額4つ（左から）：初期のモンスターのモンスターカード
FRAME_MONSTERS = ['soramo', 'gauul', 'nobiton', 'lazuck']

# 家具ごとの商品：種類・明るさ（家具に合わせて少しだけ落とす。色は変えない）・紺の窓の大きさ（幅・高さの最小と最大。絵の px）
GOODS = {
    'left_wall': dict(kind='pack', light=0.9, w=(9, 18), h=(13, 26)),
    'right_wall': dict(kind='pack', light=0.9, w=(9, 18), h=(13, 26)),
    'back_left_shelf': dict(kind='pack', light=0.9, w=(9, 18), h=(13, 26)),
    'right_display': dict(kind='pack', light=0.92, w=(9, 18), h=(13, 26)),
    'center_left': dict(kind='card', light=0.95, w=(14, 20), h=(19, 30), glass=True),
    'center_right': dict(kind='card', light=0.95, w=(13, 20), h=(19, 30), glass=True),
    'back_left': dict(kind='card', light=0.95, w=(16, 26), h=(16, 30), glass=True),
    'front_left': dict(kind='frame', light=0.97, w=(40, 70), h=(60, 100)),
}

_cache: dict[str, Image.Image] = {}


def _image(path: str) -> Image.Image:
    if path not in _cache:
        im = Image.open(path).convert('RGBA')
        _cache[path] = im.crop(im.getbbox())
    return _cache[path]


def _skill_arts() -> list[str]:
    """技カードの絵（モンスターごとに順に1枚ずつ取って、同じモンスターが続かないように並べる）"""
    files = sorted(f for f in os.listdir(SKILLS) if f.endswith('.webp'))
    by = {m: [f for f in files if f.startswith(f'{m}_sk_')] for m in MONSTERS}
    out = []
    for i in range(14):
        for m in MONSTERS:
            if i < len(by[m]):
                out.append(os.path.join(SKILLS, by[m][i]))
    return out


def _cover(src: Image.Image, w: int, h: int, focus_y: float = 0.5) -> Image.Image:
    """縦横の比を変えずに w×h をおおうよう縮め、はみ出す所を切る（縦は focus_y の所を中心に）。小さく縮めるときは少しだけくっきりさせる"""
    k = max(w / src.width, h / src.height)
    sw, sh = max(w, round(src.width * k)), max(h, round(src.height * k))
    big = src.resize((sw, sh), Image.LANCZOS)
    x = (sw - w) // 2
    y = min(max(0, round(sh * focus_y - h / 2)), sh - h)
    out = big.crop((x, y, x + w, y + h))
    if max(w, h) < 40:
        out = out.filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=2))
    return out


def _windows(a: np.ndarray, cfg: dict) -> list[tuple[slice, slice, np.ndarray]]:
    """紺の窓（青みのある所のかたまり）のうち、大きさが cfg の範囲のもの。上から・左から順"""
    r, g, b, al = (a[..., i].astype(int) for i in range(4))
    m = (al > 200) & (b > r + 12) & (b > g)
    lab, n = ndimage.label(m)
    out = []
    for i, s in enumerate(ndimage.find_objects(lab), start=1):
        if s is None:
            continue
        h, w = s[0].stop - s[0].start, s[1].stop - s[1].start
        if not (cfg['w'][0] <= w <= cfg['w'][1] and cfg['h'][0] <= h <= cfg['h'][1]):
            continue
        mask = lab[s] == i
        # 細い影・ふちだけのかたまり（中が埋まっていない）は外す
        if mask.mean() < 0.55:
            continue
        out.append((s[0], s[1], mask))
    out.sort(key=lambda t: (round(t[0].start / 8), t[1].start))
    return out


def _paste(out: np.ndarray, piece: Image.Image, ys: slice, xs: slice, mask: np.ndarray) -> None:
    p = np.array(piece).astype(float)
    # 紺の窓の中だけ（外側の金のふちは手前のまま）
    alpha = (p[..., 3:4] / 255) * mask[..., None]
    out[ys, xs, :3] = out[ys, xs, :3] * (1 - alpha) + p[..., :3] * alpha


def _dim(im: Image.Image, light: float) -> Image.Image:
    a = np.array(im).astype(float)
    a[..., :3] *= light
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def _glass_highlights(orig: np.ndarray, out: np.ndarray, changed: np.ndarray) -> None:
    """ガラスの映りこみ（元の絵の白っぽい光）を、商品の上にもう一度重ねる"""
    mn = orig[..., :3].min(2).astype(float)
    hl = np.clip((mn - 70) / 120, 0, 0.7) * changed
    out[..., :3] = out[..., :3] * (1 - hl[..., None]) + orig[..., :3] * hl[..., None]


def dress(name: str, im: Image.Image) -> Image.Image:
    """家具の絵に商品を重ねた写しを返す（商品を置かない家具はそのまま）"""
    cfg = GOODS.get(name)
    if cfg is None:
        return im
    a = np.array(im.convert('RGBA'))
    out = a.astype(float)
    # 家具ごとに始める位置をずらす（となりの家具と同じ並びにならないように）
    start = sorted(GOODS).index(name) * 3
    skills = _skill_arts()
    for k, (ys, xs, mask) in enumerate(_windows(a, cfg)):
        h, w = mask.shape
        if cfg['kind'] == 'pack':
            src = _image(os.path.join(PACKS, f'shop_pack_{MONSTERS[(start + k) % len(MONSTERS)]}.png'))
            piece = _cover(src, w, h)
        elif cfg['kind'] == 'card':
            piece = _cover(_image(skills[(start * 7 + k * 3) % len(skills)]), w, h)
        else:
            src = _image(os.path.join(MONSTER_CARDS, f'{FRAME_MONSTERS[k % len(FRAME_MONSTERS)]}_official.webp'))
            piece = _cover(src, w, h, 0.5)
        _paste(out, _dim(piece, cfg['light']), ys, xs, mask)
    if cfg.get('glass'):
        changed = (np.abs(out[..., :3] - a[..., :3]).sum(2) > 0).astype(float)
        _glass_highlights(a, out, changed)
    out[..., 3] = a[..., 3]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
