"""カードショップのガチャ（シリーズのパック・つまみ・取り出し口の拡大・選ぶ画面の背景・開けたときの光）の絵を WebP にする（2026-10-28）。

使い方：
  python3 -I tools/design/gacha_series_build.py design-parts/gacha-20261028/art design-parts/gacha-20261029/art
  （1つめ：つまみ・取り出し口・光・選ぶ画面の背景の原本。2つめ：パックの原本）

原本（ZIP「Mistral_Gacha_ClaudeCode_20261028」の art/。ユーザーと進行チャットで検品・承認済み）は描き直さない。
形式を変える・大きさをそろえるだけ。
- pack_{モンスター}.png：2026-10-29 夜からはパック専用の絵（ZIP「Mistral_PackArt8_Part1」。窓の中がモンスターのアップ。型・縁の色・大きさは前と同じ 935×1683。
  前の正式モンスターカードの絵の版は design-parts/gacha-20261029/art_cardart/ に残す。原本の窓の絵は pack_art/〔ゲームでは使わない〕）。
  その前は 2026-10-29 の新しいパック（ZIP「Mistral_Packs7_Shop_Status」。紺のナイロン＋金の線＋縁＋窓の共通の型、
  窓は正式モンスターカードの絵、縁はモンスターの色。935×1683）を 600×1080 に縮める。
  新しい型は上下の紺がもともと短いので、前の「上の封を切りとる」処理（SEAL_CUT）はかけない（切ると金の線と縁が切れる）
- knob_base.png・knob_dial.png（900×1300。機械の部品と同じキャンバス・同じ原点。回る中心は (650,1000)）：そのまま
- outlet_zoom_back.png・outlet_zoom_front.png（1080×1080）：そのまま
- open_burst.png（1080×1080）：そのまま
- select_bg.png（1170×2532・不透明）：そのまま（iPhone の幅 390 × 3 倍）
書き出し先：assets/images/ui/gacha/
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / 'assets' / 'images' / 'ui' / 'gacha'
PACKS = ['soramo', 'gauul', 'lazuck', 'nobiton', 'myurol', 'kalshell', 'pukarim', 'geol', 'flune', 'serephine', 'tsumuji']
PACK_SIZE = (600, 1080)
PARTS = ['knob_base', 'knob_dial', 'outlet_zoom_back', 'outlet_zoom_front', 'open_burst']


def main(src: Path, pack_src: Path) -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for name in [f'pack_{k}' for k in PACKS]:
        im = Image.open(pack_src / f'{name}.png').convert('RGBA').resize(PACK_SIZE, Image.LANCZOS)
        im.save(ROOT / f'{name}.webp', quality=90, method=6)
        print(name, im.size)
    for name in PARTS:
        im = Image.open(src / f'{name}.png').convert('RGBA')
        im.save(ROOT / f'{name}.webp', quality=90, method=6)
        print(name, im.size)
    bg = Image.open(src / 'select_bg.png').convert('RGB')
    bg.save(ROOT / 'select_bg.webp', quality=84, method=6)
    print('select_bg', bg.size)


if __name__ == '__main__':
    main(Path(sys.argv[1]), Path(sys.argv[2]))
