"""デザイン第10弾（2026-10-26 納品。ZIP「Mistral_UI_Quality10_20261026_assets」）を、ゲームで使う大きさの部品に切り出す。

使い方：
  python3 -I tools/design/ui10_build.py design-parts/ui-quality10-20261026

原本の名前（依頼文の保存名）：battle_buttons・battle_windows・battle_focus_frame・encounter_fx・dungeon_banners・
walk_parts・item_get・shop_menu_plates・record_board・deck_parts（.png）

書き出し先（assets/images/）：
  ui/battle/cmd_{blue,wine}_{normal,pressed,disabled}.webp   対戦の操作のボタン
  ui/battle/window_{confirm,cmdlist,result}.webp             対戦の窓の枠（確認・コマンドの一覧・結果）
  ui/battle/focus_frame.webp                                 対戦の説明の欄の枠
  effects/fx_encounter_{1,2,3}.webp                          敵とぶつかったときの光（黒い背景のまま。光を足す重ね方で使う）
  ui/banners/dungeon_{floor,clear,boss}.webp                 ダンジョンの帯
  ui/hud/{label_plate,exit_marker,hint_plate,next_1,next_2}.webp   歩く画面の小物
  ui/reward/{item_window,item_glow,shard,card_bundle}.webp   手に入れたときの小窓と絵
  ui/shop/menu_{browse,sell,gacha}.webp                      カードショップのメニューの札
  ui/record_board.webp                                       ベッドの画面の冒険の記録の板
  ui/deck/{row,row_selected,head,stand,slot,slot_selected}.webp   デッキ編集の部品

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


def cut(img: Image.Image, box: tuple[int, int, int, int], rel: str, m: int = 2, **size: int) -> None:
    b = (max(0, box[0] - m), max(0, box[1] - m), min(img.width, box[2] + m), min(img.height, box[3] + m))
    save(img.crop(b), rel, **size)


def main() -> None:
    src = Path(sys.argv[1])
    o = lambda name: Image.open(src / name).convert('RGBA')  # noqa: E731

    # 1 対戦の操作のボタン（左＝青・右＝えんじ。上から ふつう・押した・使えない）
    img = o('battle_buttons.png')
    rows = {'normal': (116, 332), 'pressed': (388, 605), 'disabled': (663, 878)}
    for state, (y0, y1) in rows.items():
        cut(img, (61, y0, 737, y1), f'ui/battle/cmd_blue_{state}.webp', height=120)
        cut(img, (799, y0, 1475, y1), f'ui/battle/cmd_wine_{state}.webp', height=120)

    # 2 対戦の窓の枠（確認・結果・コマンドの一覧）
    img = o('battle_windows.png')
    cut(img, (60, 91, 620, 405), 'ui/battle/window_confirm.webp', width=480)
    cut(img, (663, 216, 1483, 783), 'ui/battle/window_result.webp', width=600)
    cut(img, (176, 457, 508, 922), 'ui/battle/window_cmdlist.webp', width=300)

    # 3 対戦の説明の欄の枠
    cut(o('battle_focus_frame.png'), (34, 445, 991, 1072), 'ui/battle/focus_frame.webp', width=720)

    # 4 敵とぶつかったときの光（3コマ。黒い背景のまま）
    img = Image.open(src / 'encounter_fx.png').convert('RGB')
    for i, (x0, x1) in enumerate(((0, 512), (512, 1024), (1024, 1536)), start=1):
        save(img.crop((x0, 0, x1, img.height)), f'effects/fx_encounter_{i}.webp', width=384)

    # 5 ダンジョンの帯（階に入った・クリア・ボスの階）
    img = o('dungeon_banners.png')
    cut(img, (18, 32, 1519, 347), 'ui/banners/dungeon_floor.webp', width=900)
    cut(img, (18, 363, 1518, 631), 'ui/banners/dungeon_clear.webp', width=900)
    cut(img, (17, 664, 1520, 962), 'ui/banners/dungeon_boss.webp', width=900)

    # 6 歩く画面の小物（名札・出口の印・操作の案内の札・次への印2コマ）
    img = o('walk_parts.png')
    cut(img, (40, 221, 930, 440), 'ui/hud/label_plate.webp', width=360)
    cut(img, (947, 72, 1473, 555), 'ui/hud/exit_marker.webp', width=200)
    cut(img, (87, 623, 940, 889), 'ui/hud/hint_plate.webp', width=480)
    cut(img, (1030, 695, 1222, 821), 'ui/hud/next_1.webp', width=64)
    cut(img, (1249, 786, 1441, 913), 'ui/hud/next_2.webp', width=64)

    # 7 手に入れたときの小窓・台座の後ろの光・不思議な欠片・カードの束
    img = o('item_get.png')
    cut(img, (59, 78, 981, 447), 'ui/reward/item_window.webp', width=600)
    cut(img, (1031, 53, 1486, 508), 'ui/reward/item_glow.webp', width=300)
    cut(img, (323, 492, 662, 974), 'ui/reward/shard.webp', height=192)
    cut(img, (909, 531, 1375, 969), 'ui/reward/card_bundle.webp', height=192)

    # 8 カードショップのメニューの札（カードを見る・売る・カードガチャ）
    img = o('shop_menu_plates.png')
    for name, (y0, y1) in (('browse', (33, 319)), ('sell', (368, 654)), ('gacha', (703, 989))):
        cut(img, (42, y0, 1493, y1), f'ui/shop/menu_{name}.webp', width=900)

    # 9 ベッドの画面の冒険の記録の板
    cut(o('record_board.png'), (39, 147, 1497, 857), 'ui/record_board.webp', width=900)

    # 10 デッキ編集の部品（表の行・選んだ行・見出し・大きなカードの台・モンスターの枠2種）
    img = o('deck_parts.png')
    cut(img, (40, 38, 1497, 209), 'ui/deck/row.webp', width=900)
    cut(img, (42, 235, 1496, 407), 'ui/deck/row_selected.webp', width=900)
    cut(img, (38, 435, 1499, 534), 'ui/deck/head.webp', width=900)
    cut(img, (39, 558, 875, 964), 'ui/deck/stand.webp', width=720)
    cut(img, (914, 568, 1187, 942), 'ui/deck/slot.webp', width=200)
    cut(img, (1221, 567, 1495, 942), 'ui/deck/slot_selected.webp', width=200)


if __name__ == '__main__':
    main()
