"""技カード・サポートカードの枠を、デザイン担当の v3 の絵からまとめて作り直す（2026-10-28）。

使い方（リポジトリの一番上で）：npm run art:skillframes
  （中身は python3 -I tools/art/skillcard_v3_build.py。scipy が要る：pip install scipy）

1. 原本 design-parts/ui-skillcard-v5/extracted-v3-20261028/frame_{normal,hand}_support.png（ゲームの4倍の大きさ）を、
   ゲームの大きさ（normal 253×382・hand 208×210）に縮める。縮めるのは銀の枠（サポート）だけ。
   ほかの分類の色は、いままでどおりこの銀の枠に色を付けて作る（全分類で同じ形にするため）
2. 分類のアイコン（icon_*.png）は今の切り出し design-parts/ui-skillcard-v5/extracted/ のものを使う
3. tools/art/skillcard_v5_monster_color.py で、分類の色の枠・モンスターの色の枠・サポートの枠を assets/images/ui/skillcard_v5/ に書き出す
4. 色を付ける所の型（frame_*_tintmask.png）は assets には置かず、design-parts/ui-skillcard-v5/ に置く（記録用）

枠の絵を同じ名前で差し替えたら、このコマンドをもう一度動かすだけでよい。
新しいモンスターの色を足すときは、下の MONSTER_COLORS に1行足す。
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
V3 = ROOT / 'design-parts/ui-skillcard-v5/extracted-v3-20261028'
ICONS = ROOT / 'design-parts/ui-skillcard-v5/extracted'
OUT = ROOT / 'assets/images/ui/skillcard_v5'
MASK_DIR = ROOT / 'design-parts/ui-skillcard-v5'
# ゲームで使う枠の大きさ（src/ui/components/skillCard.ts の LAYOUT と同じ）
GAME_SIZE = {'normal': (253, 382), 'hand': (208, 210)}
# モンスターの色（技カードの枠。tools/art/battle_card_frame.py の色と同じ）
MONSTER_COLORS = {
    'soramo': '#E4D2AC',
    'gauul': '#E68A46',
    'lazuck': '#844DC5',
    'myurol': '#84E5FA',
    'kalshell': '#DFF2F6',
}


def shrink(src: Path, size: tuple[int, int]) -> Image.Image:
    """透明のふちが黒ずまないよう、アルファを掛けた形で縮める"""
    im = Image.open(src).convert('RGBA')
    if im.size != (size[0] * 4, size[1] * 4):
        sys.exit(f'{src.name} の大きさが {im.size}。ゲームの4倍 {(size[0] * 4, size[1] * 4)} であるはず')
    return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        work, out = Path(tmp) / 'src', Path(tmp) / 'out'
        work.mkdir()
        for kind, size in GAME_SIZE.items():
            shrink(V3 / f'frame_{kind}_support.png', size).save(work / f'frame_{kind}_support.png')
        for icon in ICONS.glob('icon_*.png'):
            shutil.copy(icon, work / icon.name)
        args = [f'{k}={v}' for k, v in MONSTER_COLORS.items()]
        subprocess.run([sys.executable, '-I', str(ROOT / 'tools/art/skillcard_v5_monster_color.py'), str(work), str(out), *args], check=True)
        for f in sorted(out.glob('*.png')):
            dest = MASK_DIR if f.name.endswith('_tintmask.png') else OUT
            shutil.copy(f, dest / f.name)
    print(f'書き出し：{OUT.relative_to(ROOT)}（型は {MASK_DIR.relative_to(ROOT)}）')


if __name__ == '__main__':
    main()
