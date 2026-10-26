"""デザイン第9弾（2026-10-26 納品。チャットで届いた画像）を、ゲームで使う大きさの部品に切り出す。

使い方：
  python3 -I tools/design/ui9_build.py <第9弾のフォルダ>
  （原本は design-parts/ui-quality9-20261026/ に保管。python3 -I tools/design/ui9_build.py design-parts/ui-quality9-20261026）

原本の名前（依頼文の保存名）：title_logo・target_arrows・knockout_mark・status_icons・life_gauge・battle_frames・mana_effects・
hand_marks・battle_bg_practice・dungeon_signs（.png。ZIP の「ChatGPT 画像 2026年10月26日 14_50_45〜14_51_43」を時刻の順に 1〜10 とした）

書き出し先（assets/images/）：
  ui/title/title_logo.webp                  タイトルロゴ
  ui/battle/target_{player,opponent}.webp   技の対象を示す矢印（自分の技＝青・相手の技＝赤）
  ui/battle/knockout_mark.webp              戦闘不能の印
  ui/battle/status_*.webp                   状態のアイコン（攻撃できない・行動できない・ちょうはつ・ダメージ軽減・行動済・能力が下がる）
  ui/battle/life_frame.webp・life_fill_{green,ochre,red}.webp   ライフのゲージ（枠と中身）
  ui/battle/ticker_frame.webp・stats_frame_{player,opponent}.webp   上の流れる文字の帯・情報の欄の枠
  effects/fx_mana_{gain,convert,spend}.webp マナの光（黒い背景のまま。光を足す重ね方で使う）
  ui/battle/hand_{selected,mana,mana_tag,unusable}.webp   手札の印（選んだ・マナにする・マナの札・使えない）
  backgrounds/battle_practice.webp          練習試合の対戦の背景
  maps/dungeon/sign_{down,up,exit}.webp     ダンジョンの案内板

- 部品の位置は、届いた絵の透明でないかたまり（2026-10-26 に調べた位置）。絵は描き直さない（切り出し・縮小だけ）
- 大きさは、画面に出す大きさの2〜3倍くらい（iPhone の細かい画面でもぼやけないように）
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / 'assets' / 'images'


def save(img: Image.Image, rel: str, height: int | None = None, width: int | None = None) -> None:
    if height:
        img = img.resize((round(img.width * height / img.height), height), Image.LANCZOS)
    elif width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, quality=90, method=6)
    print(rel, img.size)


def cut(img: Image.Image, box: tuple[int, int, int, int], rel: str, m: int = 4, **size: int) -> None:
    b = (max(0, box[0] - m), max(0, box[1] - m), min(img.width, box[2] + m), min(img.height, box[3] + m))
    save(img.crop(b), rel, **size)


def main() -> None:
    src = Path(sys.argv[1])
    o = lambda name: Image.open(src / name).convert('RGBA')  # noqa: E731

    # 1 タイトルロゴ
    cut(o('title_logo.png'), (17, 72, 1519, 877), 'ui/title/title_logo.webp', width=720)

    # 2 技の対象を示す矢印（左＝自分の技の対象〔青〕・右＝相手の技の対象〔赤〕）
    img = o('target_arrows.png')
    cut(img, (265, 173, 666, 798), 'ui/battle/target_player.webp', height=96)
    cut(img, (870, 173, 1271, 798), 'ui/battle/target_opponent.webp', height=96)

    # 3 戦闘不能の印
    cut(o('knockout_mark.png'), (34, 40, 1218, 1206), 'ui/battle/knockout_mark.webp', width=256)

    # 4 状態のアイコン（3列×2行）
    img = o('status_icons.png')
    boxes = {
        'sealed': (48, 42, 502, 485),
        'stunned': (539, 40, 992, 486),
        'taunt': (1033, 40, 1487, 486),
        'shield': (48, 519, 501, 955),
        'acted': (541, 521, 990, 955),
        'weaken': (1032, 520, 1484, 955),
    }
    for name, box in boxes.items():
        cut(img, box, f'ui/battle/status_{name}.webp', height=64)

    # 5 ライフのゲージ：1本目＝空の枠。2〜4本目は枠の中に中身（緑・黄土色・赤）が描かれているので、中身だけを切り出す
    img = o('life_gauge.png')
    cut(img, (37, 154, 1499, 288), 'ui/battle/life_frame.webp', m=2, width=600)
    cut(img, (120, 388, 1416, 442), 'ui/battle/life_fill_green.webp', m=0, height=24)
    cut(img, (120, 579, 772, 633), 'ui/battle/life_fill_ochre.webp', m=0, height=24)
    cut(img, (120, 770, 417, 824), 'ui/battle/life_fill_red.webp', m=0, height=24)

    # 6 上の流れる文字の帯・情報の欄の枠（自分＝紺・相手＝えんじ）
    img = o('battle_frames.png')
    cut(img, (22, 70, 1513, 221), 'ui/battle/ticker_frame.webp', width=900)
    cut(img, (223, 287, 720, 932), 'ui/battle/stats_frame_player.webp', width=240)
    cut(img, (816, 287, 1313, 932), 'ui/battle/stats_frame_opponent.webp', width=240)

    # 7 マナの光（黒い背景のまま。縦長の光が切れないよう、高さいっぱいで切って、真ん中にそろえた正方形の黒に置く）
    img = Image.open(src / 'mana_effects.png').convert('RGB')
    for name, (x0, x1) in (('gain', (0, 512)), ('convert', (512, 984)), ('spend', (984, 1536))):
        piece = img.crop((x0, 0, x1, img.height))
        sq = Image.new('RGB', (img.height, img.height), (0, 0, 0))
        sq.paste(piece, ((img.height - piece.width) // 2, 0))
        save(sq, f'effects/fx_mana_{name}.webp', width=256)

    # 8 手札の印（金の枠＝選んだ・青い枠＝マナにする・青い結晶の札・灰色のくもり＝使えない）。青い枠とくもりはくっついているので y 589 で分ける
    img = o('hand_marks.png')
    cut(img, (123, 32, 744, 587), 'ui/battle/hand_selected.webp', width=300)
    cut(img, (799, 27, 1414, 589), 'ui/battle/hand_mana.webp', m=0, width=300)
    cut(img, (129, 693, 788, 893), 'ui/battle/hand_mana_tag.webp', height=64)
    cut(img, (883, 589, 1357, 983), 'ui/battle/hand_unusable.webp', m=0, width=240)

    # 9 練習試合の背景（そのまま WebP に）
    save(Image.open(src / 'battle_bg_practice.png').convert('RGB'), 'backgrounds/battle_practice.webp', width=768)

    # 10 ダンジョンの案内板（下り・上り・出口）
    img = o('dungeon_signs.png')
    cut(img, (58, 183, 470, 898), 'maps/dungeon/sign_down.webp', height=160)
    cut(img, (539, 184, 943, 901), 'maps/dungeon/sign_up.webp', height=160)
    cut(img, (1008, 170, 1497, 902), 'maps/dungeon/sign_exit.webp', height=160)


if __name__ == '__main__':
    main()
