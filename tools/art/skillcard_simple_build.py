"""技カード・サポートカードの「新しい形」の枠を作る（2026-10-29。平らな名前の帯＋大きな絵の窓だけの枠）。

使い方（リポジトリの一番上で）：npm run art:skillframes
  （中身は python3 -I tools/art/skillcard_simple_build.py。numpy と Pillow が要る）

1. 原本 design-parts/ui-skillcard-simple-20261028/frames/frame_{normal,hand}_simple.png（ゲームの LAYOUT のちょうど4倍）を読む。
   届いたままの絵は同じ所の original/ に無改変で保管してある（手札用は外側の白い帯を進行が透明にしたもの）
2. 銀の所をモンスターの色に塗る（金のふちは金のまま・透明はそのまま）。
   金の見分け：R−B が 40 より大きい画素。それ以外の見えている画素を、明るさに合わせて
   「暗（色の45%）→色→明（白へ7割）」のグラデーションに置きかえる（進行の tools/tint_reference.py と同じ式）
3. ゲームの2倍の大きさ（normal 506×764・hand 416×420）に縮めて、
   assets/images/ui/skillcard_simple/frame_{normal,hand}_{モンスター}.webp と frame_{normal,hand}_support.webp（銀のまま）に書き出す

枠は「モンスターごとに1枚」（分類の色の枠は作らない。分類はゲームが印で見せる）。
サポート以外のカードに銀の枠が出ないよう、技を持つモンスターはすべて下の MONSTER_COLORS に入れる
（tests/skillFrames.test.ts で、技を持つモンスター全員の枠があるか確かめている）。新しいモンスターを足すときは1行足す。
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'design-parts/ui-skillcard-simple-20261028/frames'
OUT = ROOT / 'assets/images/ui/skillcard_simple'
GAME_SIZE = {'normal': (253, 382), 'hand': (208, 260)}
# 手札の枠：届いた絵は 208×210（ほぼ正方形）。2026-10-29 ユーザー「もう少し縦長にしてOK」で 208×260 にする。
# 角の飾りは変えず、上下の角のあいだのまっすぐなふち（原本の y HAND_STRETCH）だけを縦にのばす（描き直しはしない）
HAND_SRC_H = 210
HAND_STRETCH = (120, 720)
SCALE = 2
WEBP_QUALITY = 90

# モンスターの色（キーは ID の mon- を除いた所）。正式6体はバトル用カードの枠と同じ色。
# 仮のモンスターは src/data/cards.ts の color と同じ
MONSTER_COLORS = {
    'soramo': '#E4D2AC',
    'gauul': '#E68A46',
    'lazuck': '#844DC5',
    'nobiton': '#FFD400',
    'myurol': '#84E5FA',
    'kalshell': '#DFF2F6',
    'pukarim': '#A8DCC4',
    'geol': '#9A7B5C',  # 試遊中（2026-10-29）。確認用の画面だけで使う
    'flune': '#9CBF5A',  # 2026-10-29 フルーネ（若葉色）
    'serephine': '#8FA6E8',  # 2026-10-29 セレフィーン（月の青紫）
    'tsumuji': '#8FA3B8',  # 2026-10-30 ツムジ（くすんだ青みの灰）
    'hyouzuku': '#C8CCD4',  # 2026-10-30 ヒョウズク（銀に近い白。指示書 W）
    # 仮のモンスター（cards.ts の MONSTER_SEEDS・TMP_BOSS_SEEDS）
    'a': '#d65a4a',
    'b': '#3f7fd6',
    'c': '#4aa65a',
    'd': '#d9a13a',
    'e': '#8a5bd0',
    'f': '#2bb0b0',
    'g': '#c0504d',
    'h': '#5b8bd0',
    'i': '#9aa63a',
    'tmp-geol': '#8a6d4b',
    'tmp-flune': '#5fa86a',
    'hidden': '#7a7f8c',  # 隠しモンスター（未確定）。cards.ts の themeColor
}


def hex_rgb(s: str) -> np.ndarray:
    s = s.lstrip('#')
    return np.array([int(s[i : i + 2], 16) for i in (0, 2, 4)], float)


def tint(src: np.ndarray, color: np.ndarray) -> np.ndarray:
    rgb, al = src[..., :3], src[..., 3]
    gold = (rgb[..., 0] - rgb[..., 2]) > 40
    silver = (al > 0) & ~gold
    dark, mid, light = color * 0.45, color, color + (255 - color) * 0.7
    t = (rgb.mean(-1) / 255.0)[..., None]
    col = np.where(t < 0.6, dark + (mid - dark) * np.clip(t / 0.6, 0, 1), mid + (light - mid) * np.clip((t - 0.6) / 0.4, 0, 1))
    out = rgb.copy()
    out[silver] = col[silver]
    return np.dstack([out, al])


def shrink(arr: np.ndarray, size: tuple[int, int]) -> Image.Image:
    """透明のふちが黒ずまないよう、アルファを掛けた形で縮める"""
    return Image.fromarray(np.clip(arr, 0, 255).astype('uint8'), 'RGBA').convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def stretch_middle(im: Image.Image, height: int, band: tuple[int, int]) -> Image.Image:
    """上下の端（角の飾り）はそのままに、band の行だけを縦にのばして height にする"""
    a, b = band
    mid = im.crop((0, a, im.width, b)).resize((im.width, b - a + height - im.height), Image.BICUBIC)
    out = Image.new('RGBA', (im.width, height))
    out.alpha_composite(im.crop((0, 0, im.width, a)), (0, 0))
    out.alpha_composite(mid, (0, a))
    out.alpha_composite(im.crop((0, b, im.width, im.height)), (0, a + mid.height))
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('frame_*.webp'):
        old.unlink()
    for kind, (w, h) in GAME_SIZE.items():
        src_im = Image.open(SRC / f'frame_{kind}_simple.png').convert('RGBA')
        src_h = HAND_SRC_H if kind == 'hand' else h
        if src_im.size != (w * 4, src_h * 4):
            raise SystemExit(f'frame_{kind}_simple.png の大きさが {src_im.size}。ゲームの4倍 {(w * 4, src_h * 4)} であるはず')
        if kind == 'hand' and h != src_h:
            src_im = stretch_middle(src_im, h * 4, HAND_STRETCH)
        src = np.array(src_im).astype(float)
        size = (w * SCALE, h * SCALE)
        shrink(src, size).save(OUT / f'frame_{kind}_support.webp', quality=WEBP_QUALITY, method=6)
        for key, color in MONSTER_COLORS.items():
            shrink(tint(src, hex_rgb(color)), size).save(OUT / f'frame_{kind}_{key}.webp', quality=WEBP_QUALITY, method=6)
    print('書き出し：', len(list(OUT.glob('frame_*.webp'))), '枚')


if __name__ == '__main__':
    main()
