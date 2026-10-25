# -*- coding: utf-8 -*-
"""主人公のシートの立ち・歩き・走りを、ひとつの大きさ・色味にそろえる（2026-10-25）

ユーザーの試遊：
  1回目「立っている状態が正式な大きさ・色味。歩く・走ると大きくなる、色味が変わる」
  2回目「下に歩くは合格。上・横は不合格。四方向に歩いても走っても立ち絵と変わらないように。全部サイズと色味を統一」
わかったこと：
  - 歩き・走りの絵（motion-v2。別の日に描いた絵）どうしは、同じ大きさで描かれている（体がまっすぐな歩きの背の高さ：正面 332・背中 330・横 327）
  - 立ち止まりの絵（正面・背中・横）はもっと前の絵で、体の割合がちがう（上着が短く、ブーツが小さい）。とくに背中・横は歩きとの差が大きい
  - 1回目は向きごとに、その向きの立ち止まりに合わせて倍率を変えたので、向きによって歩きの大きさがばらばらになった
直し方（adult_walk_build.py が作ったままのシート＝9列×8行・1コマ 310×360・足元 (155, 338) にかける）：
  - 大きさ：歩き・走りの全部のコマを同じ倍率 FAMILY_SCALE で、足元を中心に縮める（男性はユーザーが合格にした「下に歩く」の 0.953）
  - 色味：合格した「下に歩く」の色（正面の歩きの Lab の平均・ばらつきを、もとの正面の立ち止まりにそろえる直し）を、全部の行に同じだけかける
  - 立ち止まり：正面はユーザーの新しい立ち絵（歩きと同じ割合の絵）を、歩きの背の高さで置き、同じく色をそろえる。
    背中は歩きのうち両足が地面に着いたコマ（IDLE_FROM）。横は新しい立ち絵が無く、歩きには両足をそろえたコマも無いので、
    もとの横の立ち止まりの背の高さ・色を横の歩きにそろえる（体の割合は前の絵のまま。横向きの立ち絵が届いたら差し替える）
  - 右向きの行（3・7）は左向き（2・6）の左右反転

使い方:
  python3 tools/art/match_stand.py もとのシート.webp 新しい立ち絵.png 出力シート.webp male|female [--check 確認の絵.png] [--idle 選択画面の立ち絵.png]
OpenCV・scipy が要る（pip install opencv-python-headless scipy）
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
from adult_walk_build import outline  # noqa: E402

FW, FH = 310, 360
FOOT_X, FOOT_Y = 155, 338
IDLE = 8
MIRROR = {3: 2, 7: 6}
FRONT, BACK, SIDE = 0, 1, 2
RUN = 4
# 歩き・走りの全部のコマにかける倍率
FAMILY_SCALE = {'male': 0.953, 'female': 1.0}
# 立ち絵の背の高さを決める歩きの向き（体がまっすぐな歩き。女性の正面の歩きはひざを高く上げた絵で背が低く測れるので背中）
HEIGHT_FROM = {'male': FRONT, 'female': BACK}
# 背中の立ち止まりに使う歩きのコマ（両足が地面に着き、足の開きが小さいコマ）
IDLE_FROM = {'male': {BACK: 0}, 'female': {BACK: 0}}


def cell(sheet: np.ndarray, r: int, c: int) -> np.ndarray:
    return sheet[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW]


def rescale(frame: np.ndarray, k: float) -> np.ndarray:
    """足元 (FOOT_X, FOOT_Y) を中心に k 倍（色は不透明度をかけた形で縮める。ふちに黒いにじみが出ないように）"""
    if k == 1:
        return frame.copy()
    m = np.array([[k, 0, FOOT_X * (1 - k)], [0, k, FOOT_Y * (1 - k)]], dtype=np.float32)
    a = frame[..., 3:4].astype(np.float32) / 255
    pre = np.concatenate([frame[..., :3].astype(np.float32) * a, frame[..., 3:4].astype(np.float32)], axis=-1)
    out = np.clip(cv2.warpAffine(pre, m, (FW, FH), flags=cv2.INTER_AREA if k < 1 else cv2.INTER_CUBIC, borderValue=0), 0, 255)
    al = out[..., 3:4]
    rgb = np.where(al > 0, out[..., :3] / np.maximum(al, 1e-3) * 255, 0)
    return np.concatenate([np.clip(rgb, 0, 255), al], axis=-1).round().astype(np.uint8)


def lab_stats(frames: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    px = np.concatenate([cv2.cvtColor(f[..., :3], cv2.COLOR_RGB2LAB)[f[..., 3] > 200].astype(np.float32) for f in frames])
    return px.mean(axis=0), px.std(axis=0)


def tone_fit(src: list[np.ndarray], ref: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """src の Lab の平均・ばらつきを ref にそろえる直し（ばらつきの倍率は 0.8〜1.25 に抑える）"""
    sm, ss = lab_stats(src)
    rm, rs = lab_stats(ref)
    return sm, np.clip(rs / np.maximum(ss, 1e-3), 0.8, 1.25), rm


def tone_apply(f: np.ndarray, fit: tuple[np.ndarray, np.ndarray, np.ndarray]) -> np.ndarray:
    sm, gain, rm = fit
    lab = (cv2.cvtColor(f[..., :3], cv2.COLOR_RGB2LAB).astype(np.float32) - sm) * gain + rm
    rgb = cv2.cvtColor(np.clip(lab, 0, 255).round().astype(np.uint8), cv2.COLOR_LAB2RGB)
    return np.concatenate([rgb, f[..., 3:4]], axis=-1)


def cut_out(im: Image.Image) -> Image.Image:
    """立ち絵の背景を透明に（透明でない絵は、まわりから続く白い所を背景とみなす）"""
    arr = np.array(im.convert('RGBA'))
    if (arr[..., 3] < 250).mean() > 0.2:
        return Image.fromarray(arr)
    white = arr[..., :3].min(axis=-1) > 232
    lab, _ = ndimage.label(white)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    bg = ndimage.binary_dilation(bg, iterations=1)
    arr[..., 3] = np.where(bg, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def place_stand(im: Image.Image, height: float) -> np.ndarray:
    """立ち絵を背の高さ height にして、足元を FOOT_Y、上半身の真ん中を FOOT_X に置く"""
    a = np.array(im)[..., 3] > 128
    ys = np.nonzero(a.any(axis=1))[0]
    top, bot = int(ys[0]), int(ys[-1])
    band = a[top + int((bot - top) * 0.2): top + int((bot - top) * 0.6)]
    cx = float(np.nonzero(band)[1].mean())
    k = height / (bot - top + 1)
    small = im.convert('RGBa').resize((round(im.width * k), round(im.height * k)), Image.LANCZOS).convert('RGBA')
    frame = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    frame.alpha_composite(small, (round(FOOT_X - cx * k), round(FOOT_Y - bot * k)))
    return np.array(frame)


def height_of(f: np.ndarray) -> int:
    ys = np.nonzero((f[..., 3] > 128).any(axis=1))[0]
    return int(ys[-1] - ys[0] + 1)


def check_image(sheet: np.ndarray, path: str) -> None:
    """確認の絵：行ごとに「立ち止まり・8コマ」。どのコマにも正面の立ち止まりの頭のてっぺんと足元の線を引く"""
    rows = [0, 1, 2, 4, 5, 6]
    canvas = Image.new('RGBA', (FW * 9, FH * len(rows)), (70, 50, 35, 255))
    d = ImageDraw.Draw(canvas)
    stand = cell(sheet, FRONT, IDLE)
    ys = np.nonzero((stand[..., 3] > 128).any(axis=1))[0]
    for i, r in enumerate(rows):
        for j, c in enumerate([IDLE] + list(range(8))):
            canvas.alpha_composite(Image.fromarray(cell(sheet, r, c)), (j * FW, i * FH))
        for y in (ys[0], ys[-1]):
            d.line([(0, i * FH + y), (FW * 9, i * FH + y)], fill=(0, 255, 255, 160), width=2)
        d.text((6, i * FH + 6), f'row {r}', fill=(255, 255, 255, 255))
    canvas.resize((canvas.width // 2, canvas.height // 2), Image.LANCZOS).save(path)


def main(args: list[str]) -> None:
    src, stand_path, dst, gender = args[:4]
    sheet = np.array(Image.open(src).convert('RGBA'))
    out = sheet.copy()
    k = FAMILY_SCALE[gender]
    # 歩き・走り：同じ倍率で縮め、合格した「下に歩く」と同じ色の直しを全部にかける
    scaled = {(r, c): rescale(cell(sheet, r, c), k) for r in range(8) if r not in MIRROR for c in range(8)}
    ref = [cell(sheet, FRONT, IDLE)]
    fit = tone_fit([scaled[(FRONT, c)] for c in range(8)], ref)
    for (r, c), f in scaled.items():
        out[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW] = tone_apply(f, fit)
    walk_h = float(np.median([height_of(cell(out, HEIGHT_FROM[gender], c)) for c in range(8)]))
    # 正面の立ち止まり：新しい立ち絵を、歩きの背の高さ（真ん中の値。HEIGHT_FROM の向き）で置く。
    # 頭の大きさで合わせると新しい立ち絵は頭が小さめなので背が 6% 高くなり、止まると大きく見えたため、背の高さで合わせる
    front = np.array(outline(Image.fromarray(place_stand(cut_out(Image.open(stand_path)), walk_h)), 2))
    front = tone_apply(front, tone_fit([front], ref))
    print(f'歩きの背の高さ {walk_h:.0f} → 立ち絵も {walk_h:.0f}')
    # 背中の立ち止まり：歩きの両足が着いたコマ。横：もとの横の立ち止まりを、横の歩きの体の高さにそろえる
    back = cell(out, BACK, IDLE_FROM[gender][BACK]).copy()
    side_old = cell(sheet, SIDE, IDLE)
    side_walk_h = float(np.median([height_of(cell(out, SIDE, c)) for c in range(8)]))
    side = rescale(side_old, side_walk_h / height_of(side_old))
    side = tone_apply(side, tone_fit([side], [cell(out, SIDE, c) for c in range(8)]))
    for r, f in ((FRONT, front), (BACK, back), (SIDE, side)):
        for rr in (r, r + RUN):
            out[rr * FH:(rr + 1) * FH, IDLE * FW:(IDLE + 1) * FW] = f
    for r, src_r in MIRROR.items():
        for c in range(9):
            out[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW] = cell(out, src_r, c)[:, ::-1]
    Image.fromarray(out).save(dst, quality=92, method=6)
    print('書き出し:', dst)
    if '--check' in args:
        check_image(out, args[args.index('--check') + 1])
    if '--idle' in args:
        Image.fromarray(front).save(args[args.index('--idle') + 1], optimize=True)


if __name__ == '__main__':
    main(sys.argv[1:])
