# -*- coding: utf-8 -*-
"""主人公のシートの歩き・走りのコマを、立ち姿（その向きの立ち止まりの列）の大きさ・色味にそろえる（2026-10-25）

ユーザーの試遊「立っている状態が正式な大きさ・色味。歩く・走ると大きくなる、色味が変わる」から。
adult_walk_build.py の --match-heads は「頭の大きさ」だけをそろえていたが、歩き・走りの絵（別の日に描いた絵）は
頭に対して体（胴・上着・ブーツ）が大きく描かれていて、全体では立ち姿より 3〜8% 大きく見えた。色も歩き・走りのほうが鮮やかだった。

できあがったシート（9列×8行・1コマ 310×360・足元 (155, 338)）をそのまま直す：
  - 大きさ：行ごとの倍率 SCALE で、足元を中心に縮める（同じ行の8コマは同じ倍率）。
    自動で測る方法（頭・胴の形の重なり、面積、頭〜ベルトの長さ）は、腕の振り・長い髪・ひざの上げ方で大きく狂ったので、
    歩き（体がまっすぐ）は背の高さの真ん中の値を立ち姿にそろえる値から始め、立ち姿の輪郭を重ねた確認の絵（--check）を見て決めた
  - 色味：不透明な画素の Lab の平均・ばらつきを、立ち姿と同じにする（行ごと。ばらつきの倍率は 0.8〜1.25 に抑える）
  - 右向きの行（3・7）は左向き（2・6）を直したものの左右反転

使い方:
  python3 tools/art/match_stand.py 入力シート.webp 出力シート.webp male|female [--check 確認の絵.png]
入力はいつも adult_walk_build.py が作ったままのシート（このスクリプトを2回かけない）。OpenCV が要る（pip install opencv-python-headless）
"""
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

FW, FH = 310, 360
FOOT_X, FOOT_Y = 155, 338
ROWS, IDLE = 8, 8
# 左向き → 右向き（左右反転）
MIRROR = {3: 2, 7: 6}
# 行ごとの倍率（行：0 正面・1 背中・2 左 の歩き、4 正面・5 背中・6 左 の走り）
SCALE: dict[str, dict[int, float]] = {
    'male': {0: 0.953, 1: 0.927, 2: 0.968, 4: 0.953, 5: 0.927, 6: 0.968},
    'female': {0: 0.95, 1: 1.0, 2: 1.0, 4: 0.95, 5: 1.0, 6: 1.0},
}


def rescale(frame: np.ndarray, k: float) -> np.ndarray:
    """足元 (FOOT_X, FOOT_Y) を中心に k 倍"""
    if k == 1:
        return frame.copy()
    m = np.array([[k, 0, FOOT_X * (1 - k)], [0, k, FOOT_Y * (1 - k)]], dtype=np.float32)
    # 色は不透明度をかけた形で縮める（ふちに黒いにじみが出ないように）
    a = frame[..., 3:4].astype(np.float32) / 255
    pre = np.concatenate([frame[..., :3].astype(np.float32) * a, frame[..., 3:4].astype(np.float32)], axis=-1)
    out = np.clip(cv2.warpAffine(pre, m, (FW, FH), flags=cv2.INTER_AREA if k < 1 else cv2.INTER_CUBIC, borderValue=0), 0, 255)
    al = out[..., 3:4]
    rgb = np.where(al > 0, out[..., :3] / np.maximum(al, 1e-3) * 255, 0)
    return np.concatenate([np.clip(rgb, 0, 255), al], axis=-1).round().astype(np.uint8)


def lab_stats(frames: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    px = np.concatenate([cv2.cvtColor(f[..., :3], cv2.COLOR_RGB2LAB)[f[..., 3] > 200].astype(np.float32) for f in frames])
    return px.mean(axis=0), px.std(axis=0)


def tone(frames: list[np.ndarray], ref: np.ndarray) -> list[np.ndarray]:
    """Lab の平均・ばらつきを立ち姿にそろえる（明るさ・色合い・鮮やかさ）"""
    sm, ss = lab_stats(frames)
    rm, rs = lab_stats([ref])
    gain = np.clip(rs / np.maximum(ss, 1e-3), 0.8, 1.25)
    out = []
    for f in frames:
        lab = cv2.cvtColor(f[..., :3], cv2.COLOR_RGB2LAB).astype(np.float32)
        lab = (lab - sm) * gain + rm
        rgb = cv2.cvtColor(np.clip(lab, 0, 255).round().astype(np.uint8), cv2.COLOR_LAB2RGB)
        out.append(np.concatenate([rgb, f[..., 3:4]], axis=-1))
    return out


def check_image(sheet: np.ndarray, path: str) -> None:
    """確認の絵：行ごとに「立ち姿・歩き（走り）8コマ」を並べ、どのコマにも立ち姿の輪郭（水色）を重ねる"""
    rows = [0, 1, 2, 4, 5, 6]
    canvas = Image.new('RGBA', (FW * 9, FH * len(rows)), (70, 50, 35, 255))
    for i, r in enumerate(rows):
        stand = sheet[r * FH:(r + 1) * FH, IDLE * FW:(IDLE + 1) * FW]
        a = (stand[..., 3] > 128).astype(np.uint8)
        edge = a - cv2.erode(a, np.ones((3, 3), np.uint8))
        for j, c in enumerate([IDLE] + list(range(8))):
            f = sheet[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW].copy()
            canvas.alpha_composite(Image.fromarray(f), (j * FW, i * FH))
            ov = np.zeros((FH, FW, 4), np.uint8)
            ov[edge > 0] = (0, 255, 255, 220)
            canvas.alpha_composite(Image.fromarray(ov), (j * FW, i * FH))
        ImageDraw.Draw(canvas).text((6, i * FH + 6), f'row {r}', fill=(255, 255, 255, 255))
    canvas.resize((canvas.width // 2, canvas.height // 2), Image.LANCZOS).save(path)


def main(args: list[str]) -> None:
    src, dst, gender = args[:3]
    sheet = np.array(Image.open(src).convert('RGBA'))
    out = sheet.copy()
    for r, k in SCALE[gender].items():
        stand = sheet[r * FH:(r + 1) * FH, IDLE * FW:(IDLE + 1) * FW]
        frames = [rescale(sheet[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW], k) for c in range(8)]
        for c, f in enumerate(tone(frames, stand)):
            out[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW] = f
    for r, src_r in MIRROR.items():
        for c in range(8):
            out[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW] = out[src_r * FH:(src_r + 1) * FH, c * FW:(c + 1) * FW][:, ::-1]
    Image.fromarray(out).save(dst, quality=92, method=6)
    print('書き出し:', dst)
    if '--check' in args:
        check_image(out, args[args.index('--check') + 1])


if __name__ == '__main__':
    main(sys.argv[1:])
