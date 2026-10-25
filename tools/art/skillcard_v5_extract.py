"""承認済みUI参考画像（1536x1024 の1枚絵）から、技カードの枠・手札用の枠・アイコン・マナの玉・数字0〜10を切り出して透過PNGにする（2026-10-25）。

- 外側：暗い背景との色の差から透明度を作る（縁の光は半透明で残す。背景色を差し引いて色の濁りを戻す）
- 絵の窓：参考画像では市松模様が描き込まれているので、窓の真ん中から「色味の少ない明るい画素」を塗りつぶして完全に透明にする
- 中の暗い所（数値の四角など）は、外の背景とつながっていないので消えない
使い方：python3 -I extract.py 参考画像.png 出力フォルダ
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
ref = np.array(Image.open(SRC).convert('RGB')).astype(float)

CATS = ['force', 'wisdom', 'defense', 'evade', 'special', 'support']
# 参考画像の中の位置（x0, y0, x1, y1）。上の段＝通常版、下の段＝手札用
NORMAL = [(4, 58, 284, 440), (282, 58, 540, 440), (537, 58, 776, 440), (772, 58, 1018, 440), (1015, 58, 1276, 440), (1273, 58, 1526, 440)]
HAND = [(36, 490, 252, 700), (299, 490, 511, 700), (548, 490, 756, 700), (797, 490, 1002, 700), (1047, 490, 1260, 700), (1302, 490, 1510, 700)]
# 技種別アイコン（ちから・かしこさ・防御・特殊・回避）・マナの玉・数字
ICONS = {'force': (478, 788, 552, 862), 'wisdom': (566, 788, 640, 862), 'defense': (654, 788, 728, 862), 'special': (742, 788, 816, 862), 'evade': (830, 788, 904, 862)}
MANA = (484, 916, 556, 988)
DIGITS = [(950 + 57.5 * (n % 5), 767 + 58 * (n // 5), 57) for n in range(10)] + [(950, 883, 57)]


def cut_background(rgb: np.ndarray, d0: float = 18, d1: float = 70) -> np.ndarray:
    """外の背景（切り抜いた四隅の色）を透明に。外とつながっている所だけ"""
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    d = np.sqrt(((rgb - bg) ** 2).sum(-1))
    near = d < d1
    lab, _ = ndimage.label(near)
    edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge_labels))
    alpha = np.ones((h, w))
    ramp = np.clip((d - d0) / (d1 - d0), 0, 1)
    alpha[outside] = ramp[outside]
    # 半透明の所は、背景の色を差し引いて元の色に戻す
    a3 = np.maximum(alpha, 1e-3)[..., None]
    col = np.where(alpha[..., None] < 1, (rgb - (1 - alpha[..., None]) * bg) / a3, rgb)
    return np.dstack([np.clip(col, 0, 255), alpha * 255]).astype(np.uint8)


def keep_main(rgba: np.ndarray) -> np.ndarray:
    """カード本体とつながっていない、切り抜きの端に触れている破片（見出しの札の端など）を消す"""
    on = rgba[..., 3] > 0
    lab, n = ndimage.label(on, structure=np.ones((3, 3)))
    if n <= 1:
        return rgba
    sizes = ndimage.sum(on, lab, index=np.arange(1, n + 1))
    main = 1 + int(np.argmax(sizes))
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0, main}
    out = rgba.copy()
    out[np.isin(lab, list(edge)), 3] = 0
    return out


def window_mask(rgba: np.ndarray, seed: tuple[int, int], limit: np.ndarray | None = None) -> np.ndarray:
    """窓の真ん中から、色味の少ない明るい画素（描き込まれた市松模様）をたどった範囲。limit があればその中だけ"""
    rgb = rgba[..., :3].astype(float)
    mx, mn = rgb.max(-1), rgb.min(-1)
    grayish = ((mx - mn) < 42) & (mx > 120)
    if limit is not None:
        grayish &= limit
    lab, _ = ndimage.label(grayish)
    return ndimage.binary_fill_holes(lab == lab[seed[1], seed[0]])


def clear_window(rgba: np.ndarray, seed: tuple[int, int], limit: np.ndarray | None = None) -> np.ndarray:
    """絵の窓（描き込まれた市松模様）を完全に透明に"""
    win = window_mask(rgba, seed, limit)
    # 塗りつぶしの中の小さな穴（薄い線の描き込み）もふさぐ
    win = ndimage.binary_fill_holes(win)
    win = ndimage.binary_dilation(win, iterations=1)
    out = rgba.copy()
    out[win, 3] = 0
    # 窓の縁の1画素は半分だけ透明に（ギザギザを和らげる）
    ring = ndimage.binary_dilation(win, iterations=1) & ~win
    out[ring, 3] = (out[ring, 3] * 0.5).astype(np.uint8)
    return out


def crop(box):
    x0, y0, x1, y1 = [int(round(v)) for v in box]
    return ref[y0:y1, x0:x1]


# 枠の色が窓の市松模様と見分けにくいもの（シルバー・水色）は、ほかの4種の窓の形（大きさをそろえて重ねたもの）の少し外までに限る
CLEAN = ['force', 'wisdom', 'defense', 'special']
LIMITED = {'evade', 'support'}


def prior(kind: str, boxes, seed_at, size) -> np.ndarray:
    acc = np.zeros((size[1], size[0]))
    for cat, box in zip(CATS, boxes):
        if cat not in CLEAN:
            continue
        rgba = cut_background(crop(box))
        h, w = rgba.shape[:2]
        m = window_mask(rgba, (int(w * seed_at[0]), int(h * seed_at[1])))
        acc += np.array(Image.fromarray((m * 255).astype(np.uint8)).resize(size, Image.BILINEAR)) / 255
    return ndimage.binary_dilation(acc / len(CLEAN) > 0.5, iterations=5)


meta = {'source': SRC.name, 'normal': {}, 'hand': {}}
for kind, boxes, seed_at in [('normal', NORMAL, (0.6, 0.45)), ('hand', HAND, (0.62, 0.48))]:
    for cat, box in zip(CATS, boxes):
        rgba = cut_background(crop(box))
        h, w = rgba.shape[:2]
        limit = prior(kind, boxes, seed_at, (w, h)) if cat in LIMITED else None
        rgba = keep_main(clear_window(rgba, (int(w * seed_at[0]), int(h * seed_at[1])), limit))
        Image.fromarray(rgba).save(OUT / f'frame_{kind}_{cat}.png')
        meta[kind][cat] = {'box': box, 'size': [w, h]}
for cat, box in ICONS.items():
    Image.fromarray(cut_background(crop(box), 14, 60)).save(OUT / f'icon_{cat}.png')
Image.fromarray(cut_background(crop(MANA), 14, 60)).save(OUT / 'icon_mana.png')
for n, (x, y, s) in enumerate(DIGITS):
    Image.fromarray(cut_background(crop((x, y, x + s, y + s)), 14, 60)).save(OUT / f'digit_{n}.png')
(OUT / 'extract_meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
print('ok')
