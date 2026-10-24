# -*- coding: utf-8 -*-
"""大人の人物の歩く絵（2026-10-23 納品）を、ゲーム用のシートにする

届く絵（1人につき3枚。docs/design/characters-adult-20261022/ の依頼どおり）:
  {ID}_walk_front.png / {ID}_walk_back.png / {ID}_walk_left.png
  1536×1024 に 512×1024 の枠が3つ。左から「立つ・右足を前・左足を前」。足元は枠の y≈940、背の高さ約860
  （男性主人公〔2026-10-23 の別便〕は背の高さ約944・足元 y≈972。人ごとに正面の「立つ」の背の高さで縮める倍率を決める）

作るもの（1コマ 216×288、足元 (108, 270)、人物の高さ約250。行は 正面・背中・左・右）:
  - 主人公：9列（歩き1周8コマ＋立ち止まり。2026-10-24〜）。第2版の絵（motion-v2/{ID}_{向き}_walk_{r,l}.png）がある向きは
    その8コマ（着く・沈む・足を運ぶ・伸び上がる ×右足・左足）、無い向きは今までの4コマを1コマずつ2回並べる。
    行は 正面・背中・左・右・左下・右下・左上・右上（--diag）＋ 走りの4行（正面・背中・左・右。motion-v2/{ID}_{向き}_run8.png が
    あればその8コマ、無ければ歩きの行の写し）。2026-10-24 ユーザー「四方向に」で --diag を付けず、正面・背中・左・右＋走り4行＝8行
  - NPC   ：4列（右足を前・立つ・左足を前・立つ）＝ 864×1152（2列目が待機の絵）
  - 主人公の選択画面の立ち絵：正面の「立つ」1コマ（216×288）
  右向きは左向きの左右反転。絵は描き直さない（縮小と位置合わせだけ）

使い方:
  python3 tools/art/adult_walk_build.py 届いた絵のフォルダ ID 出力.png [--npc] [--idle 立ち絵の出力.png] [--scale 倍率]

--scale：コマの大きさの倍率（2026-10-23 追加）。1.25 なら 1コマ 270×360・足元 (135, 338)。並び・位置の割合は同じなので、
  ゲームはそのまま読める。人物を大きく表示してもぼやけないように、ゲームのシートは 1.25 で作る（出力は .webp）。
  1.5 も試したが、iPhone で絵が大きすぎて歩くときにコマが飛んだ（2026-10-23）
--tone：大人向けの色の落ち着かせ（彩度 0.72・明るさ 0.94・コントラスト 1.06）を絵に焼き込む（2026-10-23 追加）。
  それまでは CSS の filter で毎回計算していて、歩くたびに描き直しが重くなっていた
--diag：斜め向きの4行を足す（主人公だけ。2026-10-23 追加）。行は 正面・背中・左・右・左下・右下・左上・右上 の8行になる。
  届く絵は1枚に1ポーズ：{ID}_{downleft,upleft}_{stand,rightfoot,leftfoot}.png（1024×1024 か 1254×1254）。
  絵ごとに大きさが違うので、1枚ずつ背の高さ（頭のてっぺん〜足元）を FIGURE_H にそろえる。右下・右上は左下・左上の左右反転
{ID}_walk_{front,back,left}_pass.png（2026-10-24〜。あれば）：足を運ぶ途中の絵（docs/design/walk-passing-20261024/。1枚に
  「右足で立ち左足を運ぶ・立つ（見本）・左足で立ち右足を運ぶ」）。歩きの「立つ」の2コマ（2列目・4列目）をこの2ポーズにする
{ID}_{front,back,left}_walk_pass_{r,l}.png（2026-10-24〜。あれば上より優先）：1枚に1ポーズの同じ絵（docs/design/motion-20261024/ の形）
--outline N：人物のまわりに N px の暗い輪郭を付ける（2026-10-23 追加）。背景の描き込みが強い街・部屋で人物が埋もれないように。
  同じ日に --tone（色を落ち着かせる）はやめた（背景を描き直して色の調整を外したので、人物だけがくすんで見えたため）
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

FW, FH = 216, 288
FOOT_X, FOOT_Y = 108, 270
FIGURE_H = 250          # ゲームのコマでの人物の高さ（いまの人物と同じ）
SRC_W = 512             # 届いた絵の1ポーズの枠の幅
WIN_W = 1024            # 1ポーズを切り出す幅（枠からのはみ出しも入る広さ）


def split_poses(sheet: Image.Image) -> list[Image.Image]:
    """1枚の歩きの絵を3ポーズに分ける。枠（512 幅）からはみ出した靴の先などもその人のポーズに入れ、
    となりのポーズのはみ出しは入れない（つながった形ごとに、近い枠のポーズへ）。
    返すのは、枠の真ん中を中心にした 1024 幅の絵（はみ出しも入る広さ）"""
    a = np.array(sheet)[..., 3] > 40
    lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=3))
    owner = np.zeros(n + 1, dtype=int)
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        ys, xs = np.nonzero(lab[sl] == i)
        cx = xs.mean() + sl[1].start
        owner[i] = min(2, int(cx // SRC_W))
    out = []
    rgba = np.array(sheet)
    for p in range(3):
        mask = (owner[lab] == p) & (lab > 0)
        piece = rgba.copy()
        piece[..., 3] = np.where(mask, piece[..., 3], 0)
        cx = p * SRC_W + SRC_W // 2
        win = Image.new('RGBA', (WIN_W, sheet.height), (0, 0, 0, 0))
        win.alpha_composite(Image.fromarray(piece).crop((cx - WIN_W // 2, 0, cx + WIN_W // 2, sheet.height)))
        out.append(win)
    return out


def alpha(im: Image.Image) -> np.ndarray:
    return np.array(im)[..., 3] > 40


def body_band(a: np.ndarray) -> slice:
    """上半身（頭の下〜腰）の行"""
    ys = np.nonzero(a.any(axis=1))[0]
    top, bottom = int(ys[0]), int(ys[-1])
    return slice(top + int((bottom - top) * 0.15), top + int((bottom - top) * 0.50))


def body_center(a: np.ndarray) -> float:
    """上半身の横の真ん中"""
    xs = np.nonzero(a[body_band(a)])[1]
    return float(xs.mean())


def body_shift(ref: np.ndarray, a: np.ndarray) -> int:
    """a を横に何 px ずらすと、上半身が ref と一番重なるか。
    足を出したポーズは体が枠の真ん中からずれて描かれていることがあり、そのままだと歩くたびに体が左右にぶれる"""
    band = body_band(ref)
    r, m = ref[band], a[band]
    best, best_dx = -1, 0
    for dx in range(-240, 241, 2):
        score = int((r & np.roll(m, dx, axis=1)).sum())
        if score > best:
            best, best_dx = score, dx
    return best_dx


def place(win: Image.Image, anchor_x: float, k: float) -> Image.Image:
    """ポーズを 216×288 のコマに。足元（いちばん下の不透明な行）を y=270、上半身の真ん中（anchor_x）を x=108 に"""
    ground = int(np.nonzero(alpha(win).any(axis=1))[0][-1])
    small = win.convert('RGBa').resize((round(win.width * k), round(win.height * k)), Image.LANCZOS).convert('RGBA')
    out = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    out.alpha_composite(small, (round(FOOT_X - anchor_x * k), round(FOOT_Y - ground * k)))
    return out


def poses(sheet: Image.Image, k: float) -> list[Image.Image]:
    """立つ・右足を前・左足を前 の3コマ。足を出した2つは、上半身が「立つ」と重なる位置に"""
    wins = split_poses(sheet)
    ref = alpha(wins[0])
    cx = body_center(ref)
    return [place(wins[0], cx, k)] + [place(w, cx - body_shift(ref, alpha(w)), k) for w in wins[1:]]


def pass_poses(pass_sheet: Image.Image, walk_sheet: Image.Image, k: float) -> list[Image.Image]:
    """足を運ぶ途中の絵（1枚に「右足で立ち左足を運ぶ・立つ（見本）・左足で立ち右足を運ぶ」）の2コマ。
    見本の「立つ」の背の高さを歩きの絵の「立つ」にそろえ、上半身が見本の「立つ」と重なる位置に置く
    （歩きの絵とは別の日に描いた絵なので、大きさ・位置が少し違うことがある）"""
    wins = split_poses(pass_sheet)
    ref = alpha(wins[1])
    ys = np.nonzero(ref.any(axis=1))[0]
    kp = k * figure_height(walk_sheet) / int(ys[-1] - ys[0])
    cx = body_center(ref)
    return [place(w, cx - body_shift(ref, alpha(w)), kp) for w in (wins[0], wins[2])]


def single_pose(im: Image.Image, walk_sheet: Image.Image) -> Image.Image:
    """1枚に1ポーズの絵（motion-20261024 の形）を1コマに。背の高さ（頭のてっぺん〜いちばん下の足）を FIGURE_H にそろえ、
    上半身が歩きの絵の「立つ」と重なる位置に置く"""
    REF_H = 860
    stand = split_poses(walk_sheet)[0]
    sa = alpha(stand)
    sy = np.nonzero(sa.any(axis=1))[0]
    ns = REF_H / int(sy[-1] - sy[0])
    ia = alpha(im)
    iy = np.nonzero(ia.any(axis=1))[0]
    hi = int(iy[-1] - iy[0])
    ni = REF_H / hi
    ms = np.array(Image.fromarray(sa).resize((round(stand.width * ns), round(stand.height * ns)), Image.NEAREST))
    mi = np.array(Image.fromarray(ia).resize((round(im.width * ni), round(im.height * ni)), Image.NEAREST))
    w = max(ms.shape[1], mi.shape[1])
    h = max(ms.shape[0], mi.shape[0])
    ms = np.pad(ms, ((0, h - ms.shape[0]), (0, w - ms.shape[1])))
    mi = np.pad(mi, ((0, h - mi.shape[0]), (0, w - mi.shape[1])))
    anchor = body_center(ms) - body_shift(ms, mi)
    return place(im, anchor / ni, FIGURE_H / hi)


V2_SLOT = 384  # 第2版の絵：1枚に4ポーズ（1536 幅を4つに）


def slot_windows(sheet: Image.Image, cols: int, rows: int) -> list[Image.Image]:
    """1枚に cols×rows のポーズが並んだ絵を、1ポーズずつ（WIN_W 幅の窓に）分ける。となりのポーズからはみ出したかけらは消す"""
    sw, sh = sheet.width // cols, sheet.height // rows
    wins = []
    for r in range(rows):
        for c in range(cols):
            win = Image.new('RGBA', (WIN_W, sh), (0, 0, 0, 0))
            win.alpha_composite(sheet.crop((c * sw, r * sh, (c + 1) * sw, (r + 1) * sh)), ((WIN_W - sw) // 2, 0))
            arr = np.array(win)
            lab, n = ndimage.label(ndimage.binary_dilation(arr[..., 3] > 40, iterations=3))
            if n > 1:
                sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
                arr[..., 3] = np.where(lab == int(np.argmax(sizes)) + 1, arr[..., 3], 0)
                win = Image.fromarray(arr)
            wins.append(win)
    return wins


def hat_color(im: Image.Image) -> np.ndarray:
    """帽子の色（人物の上から 12% の範囲で、色の濃い画素の中央値。男性は青、女性は赤）"""
    arr = np.asarray(im)
    a = arr[..., 3] > 200
    ys = np.nonzero(a.any(axis=1))[0]
    top, bot = int(ys[0]), int(ys[-1])
    rgb = arr[..., :3].astype(int)
    band = a.copy()
    band[top + int((bot - top) * 0.12):] = False
    sat = (rgb.max(axis=-1) - rgb.min(axis=-1)) > 60
    px = rgb[band & sat]
    return np.median(px, axis=0) if len(px) else np.array([0, 0, 0])


def hat_mask(im: Image.Image, color: np.ndarray) -> np.ndarray:
    """帽子の色に近い画素（上から 25% の範囲）"""
    arr = np.asarray(im)
    a = arr[..., 3] > 200
    ys = np.nonzero(a.any(axis=1))[0]
    top, bot = int(ys[0]), int(ys[-1])
    rgb = arr[..., :3].astype(int)
    m = (np.abs(rgb - color).sum(axis=-1) < 110) & a
    m[top + int((bot - top) * 0.25):] = False
    return m


def cap_width(im: Image.Image, color: np.ndarray) -> int:
    """帽子の横幅（帽子の色の画素の左右の端）。前傾しても変わりにくいので、大きさ合わせの目安にする"""
    xs = np.nonzero(hat_mask(im, color).any(axis=0))[0]
    return int(xs[-1] - xs[0] + 1) if len(xs) else 0


def region_means(im: Image.Image, color: np.ndarray) -> list[np.ndarray]:
    """色合わせの目安になる3か所（帽子・顔の肌・ブーツの茶）の平均色。無い所は飛ばす"""
    arr = np.asarray(im)
    a = arr[..., 3] > 200
    ys = np.nonzero(a.any(axis=1))[0]
    top, bot = int(ys[0]), int(ys[-1])
    h = bot - top
    rgb = arr[..., :3].astype(int)
    cap = hat_mask(im, color)
    skin = (rgb[..., 0] > 200) & (rgb[..., 1] > 150) & (rgb[..., 1] < 215) & (rgb[..., 2] > 120) & (rgb[..., 2] < 195) & a
    skin[top + int(h * 0.45):] = False
    boot = (rgb[..., 0] > 90) & (rgb[..., 0] < 170) & (rgb[..., 1] > 50) & (rgb[..., 1] < 110) & (rgb[..., 2] < 70) & a
    boot[: top + int(h * 0.7)] = False
    return [rgb[m].mean(axis=0) for m in (cap, skin, boot) if m.sum() > 50]


def tone_match(wins: list[Image.Image], ref: Image.Image) -> list[Image.Image]:
    """別の日に描いた絵（走り）の色味を、歩きの「立つ」に合わせる（2026-10-24 ユーザー「走りは若干色味が変わる」）。
    帽子・肌・ブーツの平均色が歩きと同じになるように、色ごとに「傾きと切片」の直線で直す（傾きは 0.85〜1.15 に抑える）"""
    color = hat_color(ref)
    ref_means = region_means(ref, color)
    run_means = [np.median([m for m in [region_means(w, color)[i:i + 1] for w in wins] if m], axis=0)[0] for i in range(len(ref_means))] if ref_means else []
    if len(ref_means) < 2 or len(run_means) < 2:
        return wins
    src = np.array(run_means)
    dst = np.array(ref_means)
    out = []
    coef = []
    for ch in range(3):
        x, y = src[:, ch], dst[:, ch]
        slope = float(np.polyfit(x, y, 1)[0]) if len(x) >= 2 else 1.0
        slope = min(1.15, max(0.85, slope))
        inter = float((y - slope * x).mean())
        coef.append((slope, inter))
    for w in wins:
        arr = np.asarray(w).astype(float)
        for ch, (slope, inter) in enumerate(coef):
            arr[..., ch] = np.clip(arr[..., ch] * slope + inter, 0, 255)
        out.append(Image.fromarray(arr.astype(np.uint8), 'RGBA'))
    print(f'  色合わせ: {[(round(a, 3), round(b, 1)) for a, b in coef]}')
    return out


def head_scale(stand: Image.Image, frames: list[Image.Image]) -> float:
    """立ち姿の頭（帽子〜おでこ：上から 22%）を型にして、各コマの中で最も合う拡大率を探し、その真ん中の値を返す（2026-10-24）。
    別の日に描いた絵（歩き・走り）は頭の大きさが少しずつ違うので、行ごとにこの値で割って立ち姿の大きさにそろえる。
    横向きの走りは頭が前に傾くので、少し回した型も試す。OpenCV（pip install opencv-python-headless）が要る"""
    import cv2

    def on_gray(im: Image.Image) -> np.ndarray:
        f = np.asarray(im).astype(float)
        a = f[..., 3:4] / 255.0
        return (f[..., :3] * a + 128 * (1 - a)).astype(np.uint8)

    st = np.asarray(stand)
    a = st[..., 3] > 40
    ys = np.nonzero(a.any(axis=1))[0]
    top, h = int(ys[0]), int(ys[-1] - ys[0])
    head = Image.fromarray(st[top:top + int(h * 0.22)])
    hx = np.nonzero(alpha(head).any(axis=0))[0]
    tmpl = on_gray(head.crop((int(hx[0]), 0, int(hx[-1]) + 1, head.height)))
    found = []
    for f in frames:
        img = on_gray(f)
        best = (-1.0, 1.0)
        for rot in (0, 8, 15):
            if rot:
                m = cv2.getRotationMatrix2D((tmpl.shape[1] / 2, tmpl.shape[0] / 2), rot, 1.0)
                t0 = cv2.warpAffine(tmpl, m, (tmpl.shape[1], tmpl.shape[0]), borderValue=(128, 128, 128))
            else:
                t0 = tmpl
            for sc in np.arange(0.75, 1.5, 0.02):
                t = cv2.resize(t0, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
                if t.shape[0] >= img.shape[0] or t.shape[1] >= img.shape[1]:
                    continue
                score = float(cv2.matchTemplate(img, t, cv2.TM_CCOEFF_NORMED).max())
                if score > best[0]:
                    best = (score, float(sc))
        found.append(best[1])
    return float(np.median(found))


def run8_windows(path: Path, walk_sheet: Image.Image) -> list[Image.Image]:
    """走りの絵（1枚に8ポーズ）を1ポーズずつの窓に分け、色味を歩きに合わせる"""
    return tone_match(slot_windows(Image.open(path).convert('RGBA'), 4, 2), split_poses(walk_sheet)[0])


def _gray(im: Image.Image) -> np.ndarray:
    f = np.asarray(im).astype(np.float32)
    a = f[..., 3:4] / 255.0
    return (f[..., :3] * a + 128 * (1 - a)).astype(np.uint8)


def _bbox(im: Image.Image) -> tuple[int, int, int, int]:
    a = alpha(im)
    ys = np.nonzero(a.any(axis=1))[0]
    xs = np.nonzero(a.any(axis=0))[0]
    return int(xs[0]), int(ys[0]), int(xs[-1]), int(ys[-1])


def head_ratios(stand: Image.Image, wins: list[Image.Image], upright: bool = True) -> list[float]:
    """1コマずつ「そのコマの頭の大きさ ÷ 立ち姿の頭の大きさ」を、元の絵（大きな解像度）で測る（2026-10-24 第2版）。
    型＝立ち姿の頭（帽子のてっぺん〜上から 26%）。縮尺と傾き（横向きの走りは頭が前に傾く）を、粗く→細かく探す。
    コマの中の頭の大きさが立ち姿とぴったり同じになるよう、置くときの倍率をこの値で割る。OpenCV が要る"""
    import cv2

    WORK_H = 640  # 立ち姿の背の高さをこの画素にそろえて測る（大きいほど細かく測れる）
    x0, y0, x1, y1 = _bbox(stand)
    sh = y1 - y0
    ws = WORK_H / sh
    head = stand.crop((x0, y0, x1 + 1, y0 + int(sh * 0.26)))
    hx = np.nonzero(alpha(head).any(axis=0))[0]
    head = head.crop((int(hx[0]), 0, int(hx[-1]) + 1, head.height))
    tmpl = _gray(head.resize((max(1, round(head.width * ws)), max(1, round(head.height * ws))), Image.LANCZOS))
    out = []
    for w in wins:
        bx0, by0, bx1, by1 = _bbox(w)
        g0 = (by1 - by0) / sh / (1.0 if upright else 0.9)  # 背の高さから見たおおよその比
        area = w.crop((max(0, bx0 - 40), max(0, by0 - 20), min(w.width, bx1 + 40), by0 + int((by1 - by0) * 0.6)))
        f = ws / g0
        img = _gray(area.resize((max(1, round(area.width * f)), max(1, round(area.height * f))), Image.LANCZOS))

        def score(sc: float, rot: float) -> float:
            t = cv2.resize(tmpl, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA if sc < 1 else cv2.INTER_CUBIC)
            if rot:
                m = cv2.getRotationMatrix2D((t.shape[1] / 2, t.shape[0] / 2), rot, 1.0)
                t = cv2.warpAffine(t, m, (t.shape[1], t.shape[0]), borderValue=(128, 128, 128))
            if t.shape[0] >= img.shape[0] or t.shape[1] >= img.shape[1]:
                return -1.0
            return float(cv2.matchTemplate(img, t, cv2.TM_CCOEFF_NORMED).max())

        best = max(((score(sc, rot), sc, rot) for sc in np.arange(0.70, 1.45, 0.025) for rot in (-6, 0, 6, 12, 18)))
        _, sc0, rot0 = best
        best = max(((score(sc, rot), sc, rot) for sc in np.arange(sc0 - 0.03, sc0 + 0.031, 0.005) for rot in np.arange(rot0 - 4, rot0 + 4.1, 1.0)))
        out.append(g0 * best[1])
    return out


def robust(ratios: list[float], groups: list[list[int]], tol: float = 0.02) -> list[float]:
    """同じ1枚の絵から切ったコマは、画像AIがほぼ同じ大きさで描いている。1枚ごとの中央値から ±tol より外れた値は測り違えとみなし、
    中央値±tol に寄せる（2026-10-24。女性の後ろ姿で、長い髪のせいで測り違えたコマが大きくなりすぎたため）"""
    out = list(ratios)
    for g in groups:
        med = float(np.median([ratios[i] for i in g]))
        for i in g:
            out[i] = min(med * (1 + tol), max(med * (1 - tol), ratios[i]))
    return out


def refine(wins: list[Image.Image], walk_sheet: Image.Image, scales: list[float], stand_frame: Image.Image, upright: bool) -> list[Image.Image]:
    """置いたあとのコマの頭を、同じ向きの立ち姿（置いたもの）ともう一度くらべ、1% より大きくずれたコマだけ倍率を直す（2回まで）。
    長い髪の後ろ姿などは測り違えることがあるので、直す幅は最初の値の ±3% まで、くらべ直して良くなったときだけ採用する"""
    base = list(scales)
    frames = place_poses(wins, walk_sheet, scales=scales)
    chk = head_ratios(stand_frame, frames, upright=upright)
    for _ in range(2):
        bad = [i for i, c in enumerate(chk) if 0.01 < abs(c - 1) <= 0.05]
        if not bad:
            break
        trial = [min(base[i] * 1.03, max(base[i] * 0.97, sc / chk[i])) if i in bad else sc for i, sc in enumerate(scales)]
        tframes = place_poses(wins, walk_sheet, scales=trial)
        tchk = head_ratios(stand_frame, [tframes[i] for i in bad], upright=upright)
        for j, i in enumerate(bad):
            if abs(tchk[j] - 1) < abs(chk[i] - 1):
                scales[i], frames[i], chk[i] = trial[i], tframes[i], tchk[j]
    return frames


def run8_poses(path: Path, walk_sheet: Image.Image, extra: float = 1.0) -> list[Image.Image]:
    """走りの絵（1枚に8ポーズ：2段×4列。docs/design/walk-run-v3-20261024/）の8コマ。
    8人の背の高さの真ん中の値を FIGURE_H にそろえたうえで、帽子の幅が歩きの「立つ」と同じになるように縮める
    （前傾した走りは背が低く測れるので、背の高さだけで合わせると人物が大きくなる。2026-10-24 ユーザー「走りは少し大きくなる」）。
    色味も歩きに合わせる。足元を FOOT_Y、上半身を歩きの「立つ」に合わせる"""
    stand = split_poses(walk_sheet)[0]
    wins = tone_match(slot_windows(Image.open(path).convert('RGBA'), 4, 2), stand)
    frames = place_poses(wins, walk_sheet)
    color = hat_color(stand)
    ref_cap = cap_width(place(stand, body_center(alpha(stand)), FIGURE_H / figure_height(walk_sheet)), color)
    run_cap = float(np.median([cap_width(f, color) for f in frames]))
    # 大きさは --match-heads（頭の大きさを立ち姿にそろえる）で決める。帽子の幅は参考に出すだけ
    print(f'  帽子の幅: 歩き {ref_cap} / 走り {run_cap:.0f}（参考）')
    return place_poses(wins, walk_sheet, extra)


def v2_windows(path: Path) -> list[Image.Image]:
    """第2版の絵（1枚に4ポーズ）を1ポーズずつの窓に分ける"""
    sheet = Image.open(path).convert('RGBA')
    wins = []
    for p in range(4):
        win = Image.new('RGBA', (WIN_W, sheet.height), (0, 0, 0, 0))
        win.alpha_composite(sheet.crop((p * V2_SLOT, 0, (p + 1) * V2_SLOT, sheet.height)), ((WIN_W - V2_SLOT) // 2, 0))
        # となりのポーズからはみ出したかけら（小さなかたまり）を消す
        arr = np.array(win)
        lab, n = ndimage.label(ndimage.binary_dilation(arr[..., 3] > 40, iterations=3))
        if n > 1:
            sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
            arr[..., 3] = np.where(lab == int(np.argmax(sizes)) + 1, arr[..., 3], 0)
            win = Image.fromarray(arr)
        wins.append(win)
    return wins


def v2_poses(path: Path, walk_sheet: Image.Image, extra: float = 1.0) -> list[Image.Image]:
    """第2版の絵（1枚に4ポーズ：着く・沈む・足を運ぶ・伸び上がる。docs/design/motion-v2-20261024/）の4コマ。
    1枚の中は同じ倍率（4人の背の高さの真ん中の値を FIGURE_H に）にして、絵の中の体の上下を残す。
    足元（いちばん下の足）を FOOT_Y に、上半身を歩きの絵の「立つ」に合わせる"""
    return place_poses(v2_windows(path), walk_sheet, extra)


def place_poses(wins: list[Image.Image], walk_sheet: Image.Image, extra: float = 1.0, scales: list[float] | None = None) -> list[Image.Image]:
    """同じ絵から切ったポーズをコマに置く（倍率は全部同じ：背の高さの真ん中の値を FIGURE_H に。extra はさらにかける倍率）。
    scales を渡すと、1コマずつその倍率で置く（--match-heads：頭の大きさを1コマずつ立ち姿にそろえるとき）"""
    heights = []
    for w in wins:
        ys = np.nonzero(alpha(w).any(axis=1))[0]
        heights.append(int(ys[-1] - ys[0]))
    k_common = FIGURE_H / float(np.median(heights)) * extra
    # 上半身の位置は、歩きの絵の「立つ」を同じ大きさにした形と比べる
    stand = split_poses(walk_sheet)[0]
    sa = alpha(stand)
    sy = np.nonzero(sa.any(axis=1))[0]
    ks = FIGURE_H / int(sy[-1] - sy[0])
    ref = np.array(Image.fromarray(sa).resize((round(stand.width * ks), round(stand.height * ks)), Image.NEAREST))
    out = []
    for i, w in enumerate(wins):
        k = scales[i] if scales else k_common
        m = np.array(Image.fromarray(alpha(w)).resize((round(w.width * k), round(w.height * k)), Image.NEAREST))
        hh, ww = max(ref.shape[0], m.shape[0]), max(ref.shape[1], m.shape[1])
        r2 = np.pad(ref, ((0, hh - ref.shape[0]), (0, ww - ref.shape[1])))
        m2 = np.pad(m, ((0, hh - m.shape[0]), (0, ww - m.shape[1])))
        # w を右へ dx ずらすと上半身が ref と重なる → ref の上半身の真ん中に来る w の点は（中心 − dx）
        out.append(place(w, (body_center(r2) - body_shift(r2, m2)) / k, k))
    return out


def diag_poses(folder: str, cid: str, d: str) -> list[Image.Image]:
    """斜め向き（d＝downleft / upleft）の 立つ・右足を前・左足を前 の3コマ。
    1枚ずつ背の高さを FIGURE_H にそろえ、足を出した2つは上半身が「立つ」と重なる位置に"""
    ims = [Image.open(f'{folder}/{cid}_{d}_{p}.png').convert('RGBA') for p in ('stand', 'rightfoot', 'leftfoot')]
    heights = []
    for im in ims:
        ys = np.nonzero(alpha(im).any(axis=1))[0]
        heights.append(int(ys[-1] - ys[0]))
    # 上半身の重なりは、背の高さをそろえた（REF_H）大きさの形で比べる
    REF_H = 860
    norm = [REF_H / hh for hh in heights]
    masks = [np.array(Image.fromarray(alpha(im)).resize((round(im.width * n), round(im.height * n)), Image.NEAREST)) for im, n in zip(ims, norm)]
    w = max(m.shape[1] for m in masks)
    hh = max(m.shape[0] for m in masks)
    padded = [np.pad(m, ((0, hh - m.shape[0]), (0, w - m.shape[1]))) for m in masks]
    cx = body_center(padded[0])
    out = []
    for i, (im, n) in enumerate(zip(ims, norm)):
        anchor = cx if i == 0 else cx - body_shift(padded[0], padded[i])
        out.append(place(im, anchor / n, FIGURE_H / heights[i]))
    return out


def figure_height(sheet: Image.Image) -> int:
    """正面の「立つ」ポーズの人物の高さ（頭のてっぺん〜足元）"""
    ys = np.nonzero(alpha(split_poses(sheet)[0]).any(axis=1))[0]
    return int(ys[-1] - ys[0])


def tone(im: Image.Image) -> Image.Image:
    """CSS の filter: saturate(0.72) brightness(0.94) contrast(1.06) と同じ計算（sRGB のまま）"""
    a = np.asarray(im).astype(np.float64) / 255
    rgb, al = a[..., :3], a[..., 3:]
    s = 0.72
    m = np.array([
        [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
        [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
        [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
    ])
    rgb = np.clip(rgb @ m.T, 0, 1)
    rgb = np.clip(rgb * 0.94, 0, 1)
    rgb = np.clip((rgb - 0.5) * 1.06 + 0.5, 0, 1)
    out = np.concatenate([rgb, al], axis=-1)
    return Image.fromarray(np.round(out * 255).astype(np.uint8), 'RGBA')


def outline(im: Image.Image, width: int) -> Image.Image:
    """人物のまわりに暗い輪郭（こげ茶、少し透ける）を付ける。絵そのものは変えず、後ろに輪郭を敷く"""
    a = np.asarray(im)[..., 3] > 40
    yy, xx = np.mgrid[-width:width + 1, -width:width + 1]
    disk = (xx * xx + yy * yy) <= width * width + 0.5
    grown = ndimage.binary_dilation(a, structure=disk)
    soft = ndimage.gaussian_filter(grown.astype(np.float64), 0.6)
    layer = np.zeros((*a.shape, 4), dtype=np.uint8)
    layer[..., 0], layer[..., 1], layer[..., 2] = 34, 22, 14
    layer[..., 3] = np.clip(soft * 215, 0, 255).astype(np.uint8)
    base = Image.fromarray(layer, 'RGBA')
    base.alpha_composite(im)
    return base


def main() -> None:
    args = sys.argv[1:]
    npc = '--npc' in args
    idle_out = args[args.index('--idle') + 1] if '--idle' in args else None
    scale_arg = args[args.index('--scale') + 1] if '--scale' in args else None
    outline_arg = args[args.index('--outline') + 1] if '--outline' in args else None
    # --wide W：コマの幅（倍率をかける前の単位。既定 216）。主人公は走りの絵が横に広いので 248 にする（2026-10-24。
    # 216 では横向きの走りの髪・腕・ブーツがコマの端で切れ、縦の線に見えた）。足元はコマの横の真ん中
    wide_arg = args[args.index('--wide') + 1] if '--wide' in args else None
    global FW, FH, FOOT_X, FOOT_Y, FIGURE_H
    if wide_arg:
        FW, FOOT_X = int(wide_arg), int(wide_arg) // 2
    if scale_arg:
        sc = float(scale_arg)
        FW, FH, FOOT_X, FOOT_Y, FIGURE_H = (round(v * sc) for v in (FW, FH, FOOT_X, FOOT_Y, FIGURE_H))
    folder, cid, out_path = [a for a in args if not a.startswith('--') and a not in (idle_out, scale_arg, outline_arg, wide_arg)][:3]
    # --match-heads：歩き・走りの各行の頭の大きさを、その向きの立ち姿にそろえる（2026-10-24 ユーザー「走ると大きく見える。
    # 立ち・歩きも走りの大きさに」。絵の中の頭の大きさをそろえたうえで、ゲームの表示倍率 FIGURE_ZOOM で全体を走りの大きさにする）
    match_heads = '--match-heads' in args
    head_fix: dict[str, float] = {}
    rows = []
    k = FIGURE_H / figure_height(Image.open(f'{folder}/{cid}_walk_front.png').convert('RGBA'))
    for d in ('front', 'back', 'left'):
        sheet = Image.open(f'{folder}/{cid}_walk_{d}.png').convert('RGBA')
        stand, right_fwd, left_fwd = poses(sheet, k)
        # 足を運ぶ途中の絵（2026-10-24〜。あるときだけ）：「立つ」の2コマを「右足で立ち左足を運ぶ」「左足で立ち右足を運ぶ」に
        pass_r = pass_l = stand
        pass_path = Path(f'{folder}/{cid}_walk_{d}_pass.png')
        if pass_path.exists():
            pass_r, pass_l = pass_poses(Image.open(pass_path).convert('RGBA'), sheet, k)
        # 1枚に1ポーズの絵（docs/design/motion-20261024/ の形。あればこちらを使う）
        single_r = Path(f'{folder}/{cid}_{d}_walk_pass_r.png')
        single_l = Path(f'{folder}/{cid}_{d}_walk_pass_l.png')
        if single_r.exists():
            pass_r = single_pose(Image.open(single_r).convert('RGBA'), sheet)
        if single_l.exists():
            pass_l = single_pose(Image.open(single_l).convert('RGBA'), sheet)
        v2_r = Path(f'{folder}/motion-v2/{cid}_{d}_walk_r.png')
        v2_l = Path(f'{folder}/motion-v2/{cid}_{d}_walk_l.png')
        if not npc and v2_r.exists() and v2_l.exists():
            # 第2版：1周8コマ（右足の1歩4コマ＋左足の1歩4コマ）
            if match_heads:
                # 1コマずつ、頭の大きさを立ち姿とぴったり同じに（2026-10-24 ユーザー「1ミリも変わらないように」）
                wins = v2_windows(v2_r) + v2_windows(v2_l)
                ratios = robust(head_ratios(split_poses(sheet)[0], wins), [[0, 1, 2, 3], [4, 5, 6, 7]])
                head_fix[f'{d}_walk'] = ratios
                frames = refine(wins, sheet, [k / r for r in ratios], stand, True)
            else:
                frames = v2_poses(v2_r, sheet) + v2_poses(v2_l, sheet)
            rows.append(frames + [stand])
        elif npc:
            rows.append([right_fwd, pass_r, left_fwd, pass_l])
        else:
            # 4コマの絵は1コマずつ2回並べて8コマにそろえる（主人公のシートは 8列＋立ち止まり）
            rows.append([right_fwd, right_fwd, pass_r, pass_r, left_fwd, left_fwd, pass_l, pass_l, stand])
    rows.append([f.transpose(Image.FLIP_LEFT_RIGHT) for f in rows[2]])
    if '--diag' in args:
        for d in ('downleft', 'upleft'):
            stand, right_fwd, left_fwd = diag_poses(folder, cid, d)
            row = [right_fwd, stand, left_fwd, stand] if npc else [right_fwd, right_fwd, stand, stand, left_fwd, left_fwd, stand, stand, stand]
            rows.append(row)
            rows.append([f.transpose(Image.FLIP_LEFT_RIGHT) for f in row])
    # 走りの行（2026-10-24 第3版）：歩きの8行の下に 正面・背中・左・右 の4行（行 8〜11）。走りの絵（motion-v2/{ID}_{向き}_run8.png：
    # 1枚に8ポーズ・2段×4列）がある向きはその8コマ＋立ち止まり、無い向きは歩きの行をそのまま写す（ゲームは走るとき常に +8 の行を使う）。
    # 人のシート（--npc）には付けない。歩きの行（4行。--diag なら8行）のすぐあとに続ける。
    # 2026-10-24 ユーザー「斜め歩行は無しにして四方向に」：主人公は --diag を付けずに作る（4行＋走り4行＝8行。斜めに進むときは横の絵）
    if not npc:
        assert len(rows) in (4, 8), '走りの行は歩きの行のすぐあと'
        for i, d in enumerate(('front', 'back', 'left')):
            run8 = Path(f'{folder}/motion-v2/{cid}_{d}_run8.png')
            if run8.exists():
                walk_src = Image.open(f'{folder}/{cid}_walk_{d}.png').convert('RGBA')
                if match_heads:
                    wins = run8_windows(run8, walk_src)
                    ratios = robust(head_ratios(split_poses(walk_src)[0], wins, upright=False), [list(range(8))])
                    head_fix[f'{d}_run'] = ratios
                    frames = refine(wins, walk_src, [k / r for r in ratios], rows[i][8], False)
                else:
                    frames = run8_poses(run8, walk_src)
                rows.append(frames + [rows[i][8]])
            else:
                rows.append(list(rows[i]))
        rows.append([f.transpose(Image.FLIP_LEFT_RIGHT) for f in rows[-1]])
    if head_fix:
        print('  頭の大きさ（元の絵での立ち姿に対する比。1コマずつこの値で割ってそろえた）:')
        for key, v in head_fix.items():
            print(f'    {key}: {[round(x, 3) for x in v]}')
        # 確かめ：できあがったコマの頭を、同じ向きの立ち姿とくらべる（1.000 に近いほどよい）
        for name, r in (('front_walk', 0), ('back_walk', 1), ('left_walk', 2), ('front_run', 4), ('back_run', 5), ('left_run', 6)):
            if r < len(rows) and f'{name}' in head_fix:
                chk = head_ratios(rows[r][8], rows[r][:8], upright=name.endswith('walk'))
                print(f'  確かめ {name}: {[round(x, 3) for x in chk]}')
    # コマの端に絵がかかっていないか（かかっていると、そこで切れて縦・横の線に見える）
    for r, frames in enumerate(rows):
        cut = [c for c, f in enumerate(frames) if alpha(f)[:, [0, -1]].any() or alpha(f)[0].any()]
        if cut:
            print(f'  注意：{r} 行目のコマ {cut} が端で切れている（--wide を広げる）')
    cols = len(rows[0])
    out = Image.new('RGBA', (FW * cols, FH * len(rows)), (0, 0, 0, 0))
    for r, frames in enumerate(rows):
        for c, f in enumerate(frames):
            out.alpha_composite(f, (c * FW, r * FH))
    if '--tone' in args:
        out = tone(out)
    if outline_arg:
        out = outline(out, int(outline_arg))
    if out_path.endswith('.webp'):
        out.save(out_path, quality=92, method=6)
    else:
        out.save(out_path, optimize=True)
    if idle_out:
        rows[0][1].save(idle_out, optimize=True)


if __name__ == '__main__':
    main()
