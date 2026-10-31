"""バトル用カードの枠（800×920）を、ゲームで使う形にする（2026-10-25）。

1. 正式採用の枠（04_Approved_Battle_Frame_Reference.png）に混入した白い市松模様だけを透明にする（透明度だけを変える。色・形・装飾は変えない）
   対象：内側（外周から 52px より内）で、明るく色味が少なく、近くに完全に透明な画素がある画素と、
         本体につながっていない小さな白っぽい粒（金の星・葉は色味が強く大きいので残る）
   さらに、枠の外形より外に残った粒（外形を角を丸めてふさいだ形の外）と、枠の外側の縁の外にあるうっすらした粒（透明度 < 128 で、枠の不透明な所から 1px より離れたもの。上の端の 0〜1 行目など）も透明にする
2. モンスターの色にする：色替えマスク（MonsterColor_AccentMask_800x920.png。白いほど強く）の所だけ、
   明るさはそのままに色味（色相・彩度）をモンスターの色にする（CSS の color ブレンドと同じ考え方。金の明暗・輪郭は残る）

使い方：
  python3 -I tools/art/battle_card_frame.py 枠.png マスク.png 出力フォルダ ソラモ=#E4D2AC [ほかのモンスター=色 …]
出力：frame_base.png（市松を消した金の枠）・frame_{名前}.png（色替えした枠）・
      frame_shape.png（枠の外形。背景とモンスターをこの形で切り抜き、枠の外の角に背景が出ないようにする）
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

BR, SAT, RAD, EDGE = 212, 34, 3, 52
SPECK_MAX, SPECK_SAT, SPECK_BR = 90, 70, 170
TINT_STRENGTH = 0.95
# この明るさ（0〜255）より暗い色は、枠の明るさもその色に寄せる（ほかの色は前と同じ）
DARK = 90
# 色はこの明るさより明るいが、暗い色と同じしかたで枠の明るさもその色に寄せるモンスター（2026-10-31 指示書 AF2：ハクランの青緑はそのままだとミュロルの水色と見分けにくい）
FORCE_DARK = {'hakuran'}


def clean_checker(im: np.ndarray) -> np.ndarray:
    r, g, b, a = [im[..., i].astype(int) for i in range(4)]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    h, w = a.shape
    inner = np.zeros((h, w), bool)
    inner[EDGE:h - EDGE, EDGE:w - EDGE] = True
    near_clear = ndimage.binary_dilation(a == 0, iterations=RAD)
    cand = (a > 0) & ((r + g + b) / 3 >= BR) & ((mx - mn) <= SAT) & inner & near_clear
    out = im.copy()
    out[cand, 3] = 0
    # 残った小さな白っぽい粒（本体につながっていない・小さい・色味が少ない）
    on = out[..., 3] > 0
    lab, n = ndimage.label(on, structure=np.ones((3, 3)))
    sizes = ndimage.sum(on, lab, index=np.arange(1, n + 1))
    main = 1 + int(np.argmax(sizes))
    sat = (mx - mn).astype(float)
    bright = (r + g + b) / 3
    for i in range(1, n + 1):
        if i == main or sizes[i - 1] >= SPECK_MAX:
            continue
        m = lab == i
        if (m & inner).any() and sat[m].mean() <= SPECK_SAT and bright[m].mean() >= SPECK_BR:
            out[m, 3] = 0
    # 枠の外側の縁の外のうっすらした粒（外縁のゴミ）。縁のすぐ外（1px）のなめらかさは残す
    solid = out[..., 3] >= 200
    near_solid = ndimage.binary_dilation(solid, iterations=1)
    faint = (out[..., 3] > 0) & (out[..., 3] < 128) & ~near_solid & ~inner
    out[faint, 3] = 0
    # 枠の外形（不透明な所をふさいで角を丸めたもの）より外に、細い線でつながって残った粒（上の端の 0〜1 行目など）
    filled = ndimage.binary_fill_holes(out[..., 3] >= 200)
    body = ndimage.binary_dilation(ndimage.binary_opening(filled, iterations=3), iterations=1)
    out[(out[..., 3] > 0) & ~body, 3] = 0
    # 縁から外へ飛び出した細い筋・粒：各列（各行）で縁の最初の不透明な画素の位置を、まわり 15 列のまん中の値とくらべ、
    # それより 2px 以上外にあるものを消す（縁のすぐ外 1px のなめらかさは残す）（角の丸みはまわりの列も同じように変わるので削れない）
    solid = out[..., 3] >= 200
    outside = np.zeros_like(solid)
    for axis in (0, 1):
        s_ = solid if axis == 0 else solid.T
        o = outside if axis == 0 else outside.T
        n = s_.shape[0]
        has = s_.any(axis=0)
        first = np.where(has, s_.argmax(axis=0), n).astype(float)
        last = np.where(has, n - 1 - s_[::-1].argmax(axis=0), -1).astype(float)
        first_m = ndimage.median_filter(first, size=15, mode='nearest')
        last_m = ndimage.median_filter(last, size=15, mode='nearest')
        idx = np.arange(n)[:, None]
        o |= (idx < first_m[None, :] - 1) | (idx > last_m[None, :] + 1)
    out[outside & (out[..., 3] > 0), 3] = 0
    return out


def tint(im: np.ndarray, mask: np.ndarray, color: tuple[int, int, int], dark: bool = False) -> np.ndarray:
    rgb = im[..., :3].astype(float)
    weights = np.array([0.3, 0.59, 0.11])
    lum = (rgb @ weights)[..., None]
    target = np.array(color, float)
    col = np.clip(target + (lum - target @ weights), 0, 255)
    if dark or target @ weights < DARK:
        # 暗い色（シシエンの炭色）：明るさを残すと銀の枠（ヒョウズク）と見分けられないので、明るさもその色に寄せる。濃淡（金の明暗・輪郭）は少し残す（2026-10-31 指示書 AB）
        ref = float(np.median(lum[mask > 0.5]))
        col = np.clip(target + (lum - ref) * 0.6, 0, 255)
    w = (mask * TINT_STRENGTH)[..., None]
    out = im.copy()
    out[..., :3] = np.clip(rgb * (1 - w) + col * w, 0, 255).astype(np.uint8)
    return out


def main() -> None:
    frame_path, mask_path, out_dir, *colors = sys.argv[1:]
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    base = clean_checker(np.array(Image.open(frame_path).convert('RGBA')))
    Image.fromarray(base).save(out / 'frame_base.png', optimize=True)
    # 枠の外形：不透明な所と、その内側（開口部）をすべて含む形
    solid = base[..., 3] > 127
    shape = ndimage.binary_fill_holes(solid)
    sil = np.zeros(base.shape, np.uint8)
    sil[..., :3] = 255
    # 外形の縁は枠の透明度のまま（ギザギザにしない）、内側はすべて不透明
    sil[..., 3] = np.where(shape, 255, base[..., 3])
    Image.fromarray(sil).save(out / 'frame_shape.png', optimize=True)
    mask = np.array(Image.open(mask_path).convert('L')).astype(float) / 255
    for spec in colors:
        name, hex_color = spec.split('=')
        rgb = tuple(int(hex_color.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
        Image.fromarray(tint(base, mask, rgb, name in FORCE_DARK)).save(out / f'frame_{name}.png', optimize=True)
    print('ok')


if __name__ == '__main__':
    main()
