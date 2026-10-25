# -*- coding: utf-8 -*-
"""主人公の「立ち・歩き・走り」をそろえて描き直した絵（docs/design/walk-unified-20261025/）を、ゲームのシートの1行に入れる（2026-10-25）

届く絵：1536×1024 に 4列×2段の8ポーズ（上の段 1〜4＝右足の1歩、下の段 5〜8＝左足の1歩）。背景は透明か、格子模様が焼き込まれた白。
大きさは「頭の大きさ」を正式の立ち絵（design-parts/characters-adult/player_{male,female}_stand_v2.png）にそろえる
（adult_walk_build.head_ratios：立ち絵の頭を型にして、1コマずつ縮尺を探す）。頭がそろえば、同じ割合で描かれた歩きは背の高さもそろう
（歩きは脚が開くぶん立ち絵の −2〜−4%）。
走りは画像AIがどうしても沈んだ形（頭をそろえると背が −8〜−11%）に描くので、--stretch-run で腰から下だけを縦に伸ばして、
背の高さを歩きの真ん中の値にそろえる（頭・胴・腕はそのまま。2026-10-25 ユーザーに比較の絵で確認）。
色は Lab の平均・ばらつきを、シートの正面の立ち止まり（正式の立ち絵）にそろえる（tools/art/match_stand.py の tone_fit）。
暗い輪郭 2px を付ける（ほかのコマと同じ）。

使い方:
  python3 tools/art/unified_build.py シート.webp male|female 行 届いた絵.png [--stretch-run 歩きの届いた絵.png] [--out 出力.webp] [--check 確認.png]
  行：0 正面・1 背中・2 左 の歩き、4 正面・5 背中・6 左 の走り（左の行を入れると、右〈3・7〉は左右反転で入る）
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
from adult_walk_build import head_ratios, outline  # noqa: E402
from match_stand import FH, FOOT_X, FOOT_Y, FW, IDLE, MIRROR, cell, tone_apply, tone_fit  # noqa: E402

STANDS = {g: Path(__file__).resolve().parents[2] / f'design-parts/characters-adult/player_{g}_stand_v2.png' for g in ('male', 'female')}
# 腰から下として伸ばす範囲（人物の上から何割より下か）
LOWER_FROM = 0.42


def load_poses(path: str) -> list[Image.Image]:
    """届いた絵を8ポーズに分ける（つながった形ごとに、近いマスへ）。格子模様の背景は、まわりから続く明るい灰色として消す"""
    im = Image.open(path)
    arr = np.array(im.convert('RGBA'))
    if (arr[..., 3] < 250).mean() < 0.2:
        rgb = arr[..., :3].astype(int)
        bg_like = (rgb.min(-1) > 195) & ((rgb.max(-1) - rgb.min(-1)) < 14)
        lab, _ = ndimage.label(bg_like)
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        fg = ndimage.binary_opening(~np.isin(lab, list(edge)), iterations=1)
        arr[..., 3] = np.where(fg, 255, 0)
    a = arr[..., 3] > 128
    lab, _ = ndimage.label(ndimage.binary_dilation(a, iterations=2))
    cw, rh = arr.shape[1] / 4, arr.shape[0] / 2
    out = [np.zeros_like(arr) for _ in range(8)]
    for i, _sl in enumerate(ndimage.find_objects(lab), start=1):
        m = (lab == i) & a
        if m.sum() < 300:
            continue
        ys, xs = np.nonzero(m)
        out[int(ys.mean() // rh) * 4 + int(xs.mean() // cw)][m] = arr[m]
    # うすい光の輪などの半透明は使わない（不透明な部分だけ）
    for o in out:
        o[..., 3] = np.where(o[..., 3] > 128, 255, 0)
    return [Image.fromarray(o) for o in out]


def crop(im: Image.Image) -> Image.Image:
    a = np.array(im)[..., 3] > 128
    ys = np.nonzero(a.any(axis=1))[0]
    xs = np.nonzero(a.any(axis=0))[0]
    return im.crop((int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1))


def stretch_lower(im: Image.Image, factor: float) -> Image.Image:
    """人物の上から LOWER_FROM より下を縦に factor 倍（上はそのまま）"""
    im = crop(im)
    w, h = im.size
    y = round(h * LOWER_FROM)
    low = im.crop((0, y, w, h)).convert('RGBa').resize((w, round((h - y) * factor)), Image.LANCZOS).convert('RGBA')
    out = Image.new('RGBA', (w, y + low.height), (0, 0, 0, 0))
    out.alpha_composite(im.crop((0, 0, w, y)), (0, 0))
    out.alpha_composite(low, (0, y))
    return out


def place(im: Image.Image, k: float) -> np.ndarray:
    """k 倍にして、足元（いちばん下）を FOOT_Y、胴（上から 15〜45%）の横の真ん中を FOOT_X に置いた 1コマ"""
    im = crop(im)
    small = im.convert('RGBa').resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS).convert('RGBA')
    a = np.array(small)[..., 3] > 128
    h = small.height
    cx = float(np.nonzero(a[int(h * 0.15): int(h * 0.45)])[1].mean())
    frame = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    frame.alpha_composite(small, (round(FOOT_X - cx), FOOT_Y - h + 1))
    return np.array(frame)


def height_ratios(stand: Image.Image, poses: list[Image.Image]) -> tuple[list[float], list[float]]:
    """1コマずつ（頭の大きさ ÷ 立ち絵の頭、頭をそろえたときの背の高さ ÷ 立ち絵の背の高さ）"""
    heads = head_ratios(stand, poses)
    sh = crop(stand).height
    return heads, [crop(p).height / hd / sh for p, hd in zip(poses, heads)]


def main(args: list[str]) -> None:
    sheet_path, gender, row, src = args[0], args[1], int(args[2]), args[3]
    out_path = args[args.index('--out') + 1] if '--out' in args else sheet_path
    sheet = np.array(Image.open(sheet_path).convert('RGBA'))
    stand = Image.open(STANDS[gender]).convert('RGBA')
    # ゲームのコマでの立ち絵の背の高さ（正面の立ち止まり。輪郭 2px のぶんを引く）＝ 原本の立ち絵の何倍で置くか
    idle = cell(sheet, 0, IDLE)
    ys = np.nonzero((idle[..., 3] > 128).any(axis=1))[0]
    game_h = int(ys[-1] - ys[0] + 1) - 4
    k_stand = game_h / crop(stand).height
    poses = load_poses(src)
    heads, hs = height_ratios(stand, poses)
    print('頭の比', [round(x, 3) for x in heads])
    print('頭をそろえたときの背の高さ（立ち絵＝1）', [round(x, 3) for x in hs])
    if '--stretch-run' in args:
        walk = load_poses(args[args.index('--stretch-run') + 1])
        target = float(np.median(height_ratios(stand, walk)[1]))
        poses = [stretch_lower(p, 1 + (target - h) / (1 - LOWER_FROM) / h) if h < target else p for p, h in zip(poses, hs)]
        print(f'走りの腰から下を伸ばして、背の高さを歩きの真ん中の値 {target:.3f} に')
    frames = [place(p, k_stand / hd) for p, hd in zip(poses, heads)]
    fit = tone_fit(frames, [idle])
    frames = [np.array(outline(Image.fromarray(tone_apply(f, fit)), 2)) for f in frames]
    for c, f in enumerate(frames):
        sheet[row * FH:(row + 1) * FH, c * FW:(c + 1) * FW] = f
    # 背中・横の立ち止まりは今の列のまま。左の行を入れたら右（反転）にも
    for r, src_r in MIRROR.items():
        if src_r == row:
            for c in range(8):
                sheet[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW] = cell(sheet, src_r, c)[:, ::-1]
    Image.fromarray(sheet).save(out_path, quality=92, method=6)
    print('書き出し:', out_path)
    if '--check' in args:
        from match_stand import check_image

        check_image(sheet, args[args.index('--check') + 1])


if __name__ == '__main__':
    main(sys.argv[1:])
