# -*- coding: utf-8 -*-
"""主人公の「立ち・歩き・走り」をそろえて描き直した絵（docs/design/walk-unified-20261025/）を、ゲームのシートの1行に入れる（2026-10-25）

届く絵：1536×1024 に 4列×2段の8ポーズ（上の段 1〜4＝右足の1歩、下の段 5〜8＝左足の1歩）。5列×2段のときは左端が見本の列（--cols 5）。
背景は透明か、格子模様が焼き込まれた白。人物のまわりのうすい光の輪は使わない（不透明な部分だけ）。
大きさは「頭の大きさ」を正式の立ち絵にそろえる（adult_walk_build.head_ratios：立ち絵の頭を型にして、1コマずつ縮尺を探す）。
頭がそろえば、同じ割合で描かれた歩きは背の高さもそろう（歩きは脚が開くぶん立ち絵の −2〜−4%）。
  - 正面：design-parts/characters-adult/player_{male,female}_stand_v2.png（正式の立ち絵）
  - 左向き・背中：--stand でその向きの立ち絵を渡す（頭の大きさはその立ち絵で比べる）。--stand sample は届いた絵の見本の列の立ち姿。その立ち絵は、背の高さを正面の立ち絵と同じにする
    （立ち姿どうしなら、向きが違っても背の高さで比べられる）。--set-idle でその向きの立ち止まりの列にも入れる
走りは画像AIが沈んだ形（頭をそろえると背が −8〜−11%）に描くので、--stretch-run で腰から下だけを縦に伸ばして、
背の高さを歩きの真ん中の値にそろえる（頭・胴・腕はそのまま。2026-10-25 ユーザーに比較の絵で確認）。
色は Lab の平均・ばらつきを、シートの正面の立ち止まり（正式の立ち絵）にそろえる（tools/art/match_stand.py の tone_fit）。
暗い輪郭 2px を付ける（ほかのコマと同じ）。左の行（2・6）を入れると、右（3・7）は左右反転で入る。

使い方:
  python3 tools/art/unified_build.py シート.webp male|female 行 届いた絵.png [--cols 5|6 [--pick 1,2,…]] [--stand 向きの立ち絵.png|sample [--set-idle]]
      [--stretch-run 歩きの届いた絵.png [--walk-cols 5]] [--by hat] [--ratio 比] [--one-scale] [--out 出力.webp] [--check 確認.png]
  --ratio 1.02：8コマとも頭の比をこの値にする（帽子の幅を自分で測ったとき。女性の背中の走りで帽子の照合が 1.47 と外れた）
  --one-scale：8コマとも同じ縮尺（測った頭の比の真ん中の値）。届いた絵の中で大きさがそろっているのに、照合が一部のコマで外れるとき（2026-10-25 女性の背中）
  行：0 正面・1 背中・2 左 の歩き、4 正面・5 背中・6 左 の走り
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
# これより薄い画素は使わない（画像AIが人物のまわりに付けるうすい光の輪を消す）
ALPHA_MIN = 200


def clean_alpha(arr: np.ndarray) -> np.ndarray:
    """格子模様の背景（透明でない絵）は、まわりから続く明るい灰色を背景として消す。不透明度は ALPHA_MIN で 0 か 255 に"""
    arr = arr.copy()
    if (arr[..., 3] < 250).mean() < 0.2:
        rgb = arr[..., :3].astype(int)
        bg_like = (rgb.min(-1) > 195) & ((rgb.max(-1) - rgb.min(-1)) < 14)
        lab, _ = ndimage.label(bg_like)
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        arr[..., 3] = np.where(ndimage.binary_opening(~np.isin(lab, list(edge)), iterations=1), 255, 0)
    arr[..., 3] = np.where(arr[..., 3] >= ALPHA_MIN, 255, 0)
    return arr


def opaque(im: Image.Image) -> Image.Image:
    """1人の立ち絵：不透明な部分だけ、いちばん大きなかたまり（人物）だけ残す"""
    arr = clean_alpha(np.array(im.convert('RGBA')))
    a = arr[..., 3] > 0
    lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=2))
    if n > 1:
        sizes = ndimage.sum(a, lab, range(1, n + 1))
        arr[..., 3] = np.where(a & (lab == int(np.argmax(sizes)) + 1), 255, 0)
    return Image.fromarray(arr)


def load_poses(path: str, cols: int = 4) -> tuple[list[Image.Image], list[Image.Image]]:
    """届いた絵を8ポーズに分ける（つながった形ごとに、近いマスへ）。cols＝5 のときは各段の左端（見本の列）を別に返す"""
    arr = clean_alpha(np.array(Image.open(path).convert('RGBA')))
    a = arr[..., 3] > 0
    lab, _ = ndimage.label(ndimage.binary_dilation(a, iterations=2))
    cw, rh = arr.shape[1] / cols, arr.shape[0] / 2
    out = [np.zeros_like(arr) for _ in range(cols * 2)]
    for i, _sl in enumerate(ndimage.find_objects(lab), start=1):
        m = (lab == i) & a
        if m.sum() < 300:
            continue
        ys, xs = np.nonzero(m)
        out[int(ys.mean() // rh) * cols + int(xs.mean() // cw)][m] = arr[m]
    ims = [Image.fromarray(o) for o in out]
    if cols >= 5:
        # 各段の左端は見本の列（立ち姿）。残りを上の段・下の段の順に並べる（6列のときは10コマ。--pick で8コマを選ぶ）
        return ims[1:cols] + ims[cols + 1:], [ims[0], ims[cols]]
    return ims, []


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


def height_ratios(stand: Image.Image, poses: list[Image.Image], by: str = 'head') -> tuple[list[float], list[float]]:
    """1コマずつ（頭の大きさ ÷ 立ち絵の頭、頭をそろえたときの背の高さ ÷ 立ち絵の背の高さ）。
    by＝'hat' は頭の代わりに帽子の横幅で比べる（後ろ姿は顔が無く、頭の照合が外れることがある。2026-10-25 背中の走り）"""
    if by == 'hat':
        from adult_walk_build import cap_width, hat_color

        color = hat_color(stand)
        base = cap_width(stand, color)
        heads = [cap_width(p, color) / base for p in poses]
    else:
        heads = head_ratios(stand, poses)
    sh = crop(stand).height
    return heads, [crop(p).height / hd / sh for p, hd in zip(poses, heads)]


def opt(args: list[str], name: str, default: str | None = None) -> str | None:
    return args[args.index(name) + 1] if name in args else default


def main(args: list[str]) -> None:
    sheet_path, gender, row, src = args[0], args[1], int(args[2]), args[3]
    out_path = opt(args, '--out', sheet_path)
    sheet = np.array(Image.open(sheet_path).convert('RGBA'))
    poses, samples = load_poses(src, int(opt(args, '--cols', '4')))
    if '--pick' in args:
        # 届いた絵のコマ（1から）のうち、ゲームの8コマに使うもの（例：6列で1段5コマのとき 1,2,3,4,6,7,8,9）
        poses = [poses[int(n) - 1] for n in opt(args, '--pick').split(',')]
    # --stand sample：届いた絵の見本の列（左端・上の段）に画像AIが描いた立ち姿を使う（同じ絵の中なので歩きと同じ割合。2026-10-25 左向き）
    stand_arg = opt(args, '--stand')
    stand = samples[0] if stand_arg == 'sample' else opaque(Image.open(stand_arg or STANDS[gender]))
    # ゲームのコマでの立ち絵の背の高さ（正面の立ち止まり。輪郭 2px のぶんを引く）＝ 原本の立ち絵の何倍で置くか
    idle = cell(sheet, 0, IDLE)
    ys = np.nonzero((idle[..., 3] > 128).any(axis=1))[0]
    game_h = int(ys[-1] - ys[0] + 1) - 4
    k_stand = game_h / crop(stand).height
    by = opt(args, '--by', 'head')
    heads, hs = height_ratios(stand, poses, by)
    if '--ratio' in args:
        fixed = float(opt(args, '--ratio'))
        hs = [h * hd / fixed for h, hd in zip(hs, heads)]
        heads = [fixed] * len(heads)
    if '--one-scale' in args:
        mid = float(np.median(heads))
        hs = [h * hd / mid for h, hd in zip(hs, heads)]
        heads = [mid] * len(heads)
    print('頭の比', [round(x, 3) for x in heads])
    print('頭をそろえたときの背の高さ（立ち絵＝1）', [round(x, 3) for x in hs])
    if '--stretch-run' in args:
        walk, _ = load_poses(opt(args, '--stretch-run'), int(opt(args, '--walk-cols', '4')))
        target = float(np.median(height_ratios(stand, walk, by)[1]))
        # 低ければ腰から下を伸ばし、高ければ縮める（背中の走りは頭が小さく描かれ、頭をそろえると背が +10〜+12% になった）
        poses = [stretch_lower(p, 1 + (target - h) / (1 - LOWER_FROM) / h) if abs(h - target) > 0.01 else p for p, h in zip(poses, hs)]
        print(f'走りの腰から下を伸び縮みさせて、背の高さを歩きの真ん中の値 {target:.3f} に')
    frames = [place(p, k_stand / hd) for p, hd in zip(poses, heads)]
    fit = tone_fit(frames, [idle])
    frames = [np.array(outline(Image.fromarray(tone_apply(f, fit)), 2)) for f in frames]
    for c, f in enumerate(frames):
        sheet[row * FH:(row + 1) * FH, c * FW:(c + 1) * FW] = f
    if '--set-idle' in args:
        # 立ち止まりの列（歩きの行と走りの行の両方）をこの向きの立ち絵に
        still = place(stand, k_stand)
        still = np.array(outline(Image.fromarray(tone_apply(still, tone_fit([still], [idle]))), 2))
        for r in (row % 4, row % 4 + 4):
            sheet[r * FH:(r + 1) * FH, IDLE * FW:(IDLE + 1) * FW] = still
    for r, src_r in MIRROR.items():
        if src_r % 4 == row % 4:
            for c in range(9):
                sheet[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW] = cell(sheet, src_r, c)[:, ::-1]
    Image.fromarray(sheet).save(out_path, quality=92, method=6)
    print('書き出し:', out_path)
    if '--check' in args:
        from match_stand import check_image

        check_image(sheet, opt(args, '--check'))


if __name__ == '__main__':
    main(sys.argv[1:])
