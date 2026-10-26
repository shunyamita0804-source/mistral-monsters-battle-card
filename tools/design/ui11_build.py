"""デザイン第11弾（2026-10-26 納品。ZIP「Mistral_UI_Quality11」）を、ゲームで使う大きさの部品に切り出す。

使い方：
  python3 -I tools/design/ui11_build.py design-parts/ui-quality11-20261026

届いた絵は透明ではなくマゼンタの背景（納品メモ：透明の背景の生成が反映されなかった）なので、tools/design/magenta_key.py で背景を透明にしてから切り出す。
ボス戦の背景（battle_bg_boss）と特別復元の場面（restore_scene）は、もともと不透明の絵。

書き出し先（assets/images/）：
  ui/howto/howto_{1..5}.webp              遊び方の挿絵（街・デッキ・ショップ・ダンジョン・大会）
  ui/rules/rules_{1..4}.webp              対戦のルールの図（マナ・攻撃と守り・サポート・勝ち負け）
  ui/restore/restore_scene.webp・effects/fx_restore.webp   特別復元の場面と光（光は黒い背景のまま）
  backgrounds/battle_boss.webp            ボス戦の背景
  ui/battle/wait_plate.webp・wait_sand_{1..4}.webp・hand_tray.webp   相手の番の札・砂時計4コマ・空の手札の台
  ui/gacha/rates_{head,c,u,r}.webp・rates_pie.webp   提供割合の表の部品
  ui/collection/medal_{1..4}.webp・progress_{frame,fill}.webp   図鑑の集めた割合
  ui/worldmap/region_label{,_current}.webp・info_window.webp・compass.webp   世界地図の部品
  ui/settings/{heading,panel}.webp・icon_{language,sound,backup,howto}.webp   設定の部品
  ui/title/btn_{continue,new,settings,pressed}.webp   タイトルのボタン
- 部品の位置は、背景を透明にしたあとの透明でないかたまり（2026-10-26 に調べた位置）。絵は描き直さない（背景を透明にする・切り出し・縮小だけ）
"""

import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from magenta_key import key_magenta  # noqa: E402

ROOT = Path(__file__).resolve().parents[2] / 'assets' / 'images'


def save(img: Image.Image, rel: str, height: int | None = None, width: int | None = None) -> None:
    if height:
        img = img.resize((round(img.width * height / img.height), height), Image.LANCZOS)
    elif width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, quality=88, method=6)
    print(rel, img.size)


def cut(img: Image.Image, box: tuple[int, int, int, int], rel: str, m: int = 2, **size: int) -> None:
    b = (max(0, box[0] - m), max(0, box[1] - m), min(img.width, box[2] + m), min(img.height, box[3] + m))
    save(img.crop(b), rel, **size)


def main() -> None:
    src = Path(sys.argv[1])
    k = lambda name: key_magenta(Image.open(src / name))  # noqa: E731

    # 1 遊び方の挿絵（上に3つ・下に2つ）
    img = k('how_to_play.png')
    boxes = [(32, 98, 502, 470), (530, 98, 1006, 470), (1034, 98, 1505, 470), (236, 536, 747, 893), (789, 536, 1300, 893)]
    for i, box in enumerate(boxes, start=1):
        cut(img, box, f'ui/howto/howto_{i}.webp', width=480)

    # 2 対戦のルールの図（2×2）
    img = k('battle_rules_art.png')
    for i, box in enumerate([(32, 60, 748, 478), (788, 60, 1505, 478), (32, 534, 748, 954), (788, 533, 1505, 954)], start=1):
        cut(img, box, f'ui/rules/rules_{i}.webp', width=480)

    # 3 特別復元：左＝場面（不透明）、右＝光（黒い背景。真ん中の正方形）
    img = Image.open(src / 'restore_scene.png').convert('RGB')
    save(img.crop((0, 0, 786, 1024)), 'ui/restore/restore_scene.webp', width=600)
    save(img.crop((788, 138, 1536, 886)), 'effects/fx_restore.webp', width=400)

    # 4 ボス戦の背景
    save(Image.open(src / 'battle_bg_boss.png').convert('RGB'), 'backgrounds/battle_boss.webp', width=768)

    # 5 相手の番の札・砂時計4コマ・空の手札の台
    img = k('battle_wait_parts.png')
    cut(img, (153, 76, 1383, 316), 'ui/battle/wait_plate.webp', width=600)
    for i, x0 in enumerate((271, 540, 807, 1071), start=1):
        cut(img, (x0, 359, x0 + 196, 686), f'ui/battle/wait_sand_{i}.webp', height=96)
    cut(img, (30, 737, 1507, 954), 'ui/battle/hand_tray.webp', width=900)

    # 6 提供割合の表（見出し・コモン・アンコモン・レア・円グラフの台）
    img = k('gacha_rates_parts.png')
    cut(img, (21, 40, 1515, 188), 'ui/gacha/rates_head.webp', width=900)
    for name, (y0, y1) in (('c', (196, 295)), ('u', (299, 398)), ('r', (402, 498))):
        cut(img, (20, y0, 1516, y1), f'ui/gacha/rates_{name}.webp', m=0, width=900)
    cut(img, (528, 500, 1005, 986), 'ui/gacha/rates_pie.webp', width=300)

    # 7 図鑑の集めた割合（メダル4種・進み具合の帯の枠と中身）
    img = k('collection_progress.png')
    for i, box in enumerate([(25, 146, 390, 527), (404, 146, 768, 527), (771, 146, 1133, 527), (1138, 145, 1518, 532)], start=1):
        cut(img, box, f'ui/collection/medal_{i}.webp', height=128)
    cut(img, (22, 590, 1512, 743), 'ui/collection/progress_frame.webp', width=900)
    cut(img, (137, 811, 1397, 895), 'ui/collection/progress_fill.webp', width=760)

    # 8 世界地図（地方の名札・いまいる地方の名札・場所の説明の窓・方角の印）
    img = k('worldmap_parts.png')
    cut(img, (33, 41, 1503, 259), 'ui/worldmap/region_label.webp', width=480)
    cut(img, (26, 270, 1510, 525), 'ui/worldmap/region_label_current.webp', width=480)
    cut(img, (46, 555, 1038, 956), 'ui/worldmap/info_window.webp', width=720)
    cut(img, (1107, 573, 1480, 939), 'ui/worldmap/compass.webp', width=160)

    # 9 設定（見出しの帯・欄の板・アイコン4つ：言語・音・バックアップ・遊び方）
    img = k('settings_parts.png')
    cut(img, (26, 75, 1510, 279), 'ui/settings/heading.webp', width=900)
    cut(img, (79, 322, 1458, 648), 'ui/settings/panel.webp', width=720)
    for name, x0 in (('language', 87), ('sound', 440), ('backup', 792), ('howto', 1145)):
        cut(img, (x0, 665, x0 + 297, 954), f'ui/settings/icon_{name}.webp', height=96)

    # 10 タイトルのボタン（続きから・最初から・設定・押したとき）
    img = k('title_buttons.png')
    cut(img, (6, 42, 1530, 289), 'ui/title/btn_continue.webp', width=900)
    cut(img, (6, 296, 1530, 543), 'ui/title/btn_new.webp', width=900)
    cut(img, (373, 571, 1162, 704), 'ui/title/btn_settings.webp', width=600)
    cut(img, (6, 718, 1530, 965), 'ui/title/btn_pressed.webp', width=900)


if __name__ == '__main__':
    main()
