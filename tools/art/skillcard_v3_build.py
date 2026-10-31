"""技カード・サポートカードの枠を、デザイン担当の v3 の絵からまとめて作り直す（2026-10-28）。

使い方（リポジトリの一番上で）：npm run art:skillframes
  （中身は python3 -I tools/art/skillcard_v3_build.py。scipy が要る：pip install scipy）

1. 原本 design-parts/ui-skillcard-v5/extracted-v3-20261028/frame_{normal,hand}_support.png（ゲームの4倍の大きさ）を、
   ゲームの2倍の大きさ（normal 506×764・hand 416×420）に縮める。縮めるのは銀の枠（サポート）だけ。
   ほかの分類の色は、いままでどおりこの銀の枠に色を付けて作る（全分類で同じ形にするため）
2. 分類のアイコン（種類の札の中）は、v3 の分類ごとの原本（4倍）の札の中を切り出して使う（2倍でもぼやけないように）。
   分類ごとの原本は横幅が少しずつちがうので、銀の枠の札の位置を手がかりに、いちばん合う位置を探して切り出す
3. tools/art/skillcard_v5_monster_color.py（--scale=2 と同じ）で、分類の色の枠・モンスターの色の枠・サポートの枠を作り、
   assets/images/ui/skillcard_v5/frame_*.webp（品質90）に書き出す。前の frame_*.png は消す
4. 色を付ける所の型（frame_*_tintmask.png）は assets には置かず、design-parts/ui-skillcard-v5/ に置く（記録用）

ゲームでは CSS で今までと同じ大きさに表示する（src/ui/components/skillCard.ts の LAYOUT は1倍の数字のまま）。
枠の絵を同じ名前で差し替えたら、このコマンドをもう一度動かすだけでよい。
新しいモンスターの色を足すときは、下の MONSTER_COLORS に1行足す。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/art'))
import skillcard_v5_monster_color as tint  # noqa: E402

V3 = ROOT / 'design-parts/ui-skillcard-v5/extracted-v3-20261028'
ICONS = ROOT / 'design-parts/ui-skillcard-v5/extracted'
OUT = ROOT / 'assets/images/ui/skillcard_v5'
MASK_DIR = ROOT / 'design-parts/ui-skillcard-v5'
# ゲームで使う枠の大きさ（1倍。src/ui/components/skillCard.ts の LAYOUT と同じ）と、書き出す倍率
GAME_SIZE = {'normal': (253, 382), 'hand': (208, 210)}
SCALE = 2
WEBP_QUALITY = 90
# モンスターの色（技カードの枠。tools/art/battle_card_frame.py の色と同じ）
MONSTER_COLORS = {
    'soramo': '#E4D2AC',
    'gauul': '#E68A46',
    'lazuck': '#844DC5',
    'myurol': '#84E5FA',
    'kalshell': '#DFF2F6',
    'pukarim': '#A8DCC4',
    'geol': '#9A7B5C',  # 試遊中（2026-10-29）。確認用の画面だけで使う
    'flune': '#9CBF5A',  # 2026-10-29 フルーネ（若葉色）
    'serephine': '#8FA6E8',  # 2026-10-29 セレフィーン（月の青紫）
    'tsumuji': '#8FA3B8',  # 2026-10-30 ツムジ（くすんだ青みの灰）
    'hyouzuku': '#C8CCD4',  # 2026-10-30 ヒョウズク（銀に近い白。指示書 W）
    'shishien': '#3E3A3F',  # 2026-10-31 シシエン（炭色。指示書 AB）
    'hakuran': '#237C7A',  # 2026-10-31 ハクラン（青緑・ティール。指示書 AF）
    'desuoru': '#1E2B58',  # 2026-10-31 デスオル（紺。指示書 AG）
}


def shrink(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    """透明のふちが黒ずまないよう、アルファを掛けた形で縮める"""
    return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def open_v3(name: str, size: tuple[int, int]) -> Image.Image:
    im = Image.open(V3 / name).convert('RGBA')
    if name.endswith('_support.png') and im.size != (size[0] * 4, size[1] * 4):
        sys.exit(f'{name} の大きさが {im.size}。ゲームの4倍 {(size[0] * 4, size[1] * 4)} であるはず')
    return im


def icon_patches(kind: str, support4: Image.Image) -> dict:
    """分類ごとの原本（4倍）から、種類の札の中（アイコン）を切り出す"""
    sup = np.array(support4).astype(float)
    tile = tint.tile_interior(sup.astype(np.uint8), kind, 4)
    ys, xs = np.nonzero(tile)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    pad = 24
    ref = sup[y0 - pad : y1 + pad, x0 - pad : x1 + pad, :3].mean(-1)
    ref = ref - ref.mean()

    def score(gray: np.ndarray, dx: int, dy: int) -> float:
        p = gray[y0 - pad + dy : y1 + pad + dy, x0 - pad + dx : x1 + pad + dx]
        if p.shape != ref.shape:
            return -1.0
        p = p - p.mean()
        return float((p * ref).sum() / np.sqrt((p * p).sum() * (ref * ref).sum()))

    out = {}
    for cat in tint.CATS:
        im = Image.open(V3 / f'frame_{kind}_{cat}.png').convert('RGBA')
        gray = np.array(im).astype(float)[..., :3].mean(-1)
        best = max(((score(gray, dx, dy), dx, dy) for dy in range(-40, 41, 2) for dx in range(-40, 41, 2)))
        _, bx, by = best
        _, dx, dy = max(((score(gray, bx + i, by + j), bx + i, by + j) for j in range(-2, 3) for i in range(-2, 3)))
        out[(kind, cat)] = im.crop((x0 + dx, y0 + dy, x1 + dx, y1 + dy))
    return out


def main() -> None:
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        icons: dict = {}
        for kind, (w, h) in GAME_SIZE.items():
            support4 = open_v3(f'frame_{kind}_support.png', (w, h))
            shrink(support4, (w * SCALE, h * SCALE)).save(work / f'frame_{kind}_support.png')
            icons.update(icon_patches(kind, support4))
        for old in OUT.glob('frame_*.png'):
            old.unlink()
        total = 0
        for name, arr in tint.build(work, MONSTER_COLORS, SCALE, icons):
            if name.endswith('_tintmask'):
                Image.fromarray(arr).save(MASK_DIR / f'{name}.png', optimize=True)
                continue
            path = OUT / f'{name}.webp'
            Image.fromarray(arr).save(path, 'WEBP', quality=WEBP_QUALITY, method=6)
            total += path.stat().st_size
    print(f'書き出し：{OUT.relative_to(ROOT)}/frame_*.webp（合計 {total / 1024 / 1024:.2f}MB。型は {MASK_DIR.relative_to(ROOT)}）')


if __name__ == '__main__':
    main()
