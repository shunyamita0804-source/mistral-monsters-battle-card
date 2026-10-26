"""デザイン第8弾（2026-10-26 納品。ZIP「Mistral_UI_Quality8」）を、ゲームで使う大きさの部品に切り出す。

使い方：
  python3 -I tools/design/ui8_build.py <第8弾のフォルダ>
  （原本は design-parts/ui-quality8-20261026/ に保管。python3 -I tools/design/ui8_build.py design-parts/ui-quality8-20261026）

書き出し先（assets/images/）：
  ui/order/      先攻・後攻のカードの表（order_first・order_second）
  ui/vs/         VS の紋章・自分と相手の名札
  characters/    主人公の立ち絵（hero_{male,female}.webp）と顔の丸窓用（face_hero_{male,female}.webp）
  ui/newgame/    主人公を選ぶ札（ふつう・選んだとき）
  effects/       技が当たったときの光（黒い背景のまま。ゲームでは「光を足す」重ね方 mix-blend-mode: screen）
  ui/badges/     レア度の印（C・U・R）と NEW の札
  ui/packs/      まだ買えないパック（pack_locked）
  ui/tournament/ 勝ち抜き表の札・線・勝ち負けの印・優勝杯
  ui/banners/    ランクアップ・優勝の帯（banner_rankup）

- 部品の位置は、届いた絵の透明でないかたまり（2026-10-26 に調べた位置）。絵は描き直さない（切り出し・縮小だけ）
- 大きさは、画面に出す大きさの2倍くらい（iPhone の細かい画面でもぼやけないように）
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


def pad(box: tuple[int, int, int, int], m: int, img: Image.Image) -> tuple[int, int, int, int]:
    """切り出す枠を m px 広げる（画像の外にははみ出さない）"""
    return (max(0, box[0] - m), max(0, box[1] - m), min(img.width, box[2] + m), min(img.height, box[3] + m))


def cut(img: Image.Image, box: tuple[int, int, int, int], rel: str, m: int = 4, **size: int) -> None:
    save(img.crop(pad(box, m, img)), rel, **size)


def main() -> None:
    src = Path(sys.argv[1])
    o = lambda name: Image.open(src / name).convert('RGBA')  # noqa: E731

    # 1 先攻・後攻のカードの表（左＝先攻・右＝後攻）
    img = o('order_faces.png')
    cut(img, (39, 6, 754, 1004), 'ui/order/order_first.webp', width=300)
    cut(img, (782, 6, 1497, 1004), 'ui/order/order_second.webp', width=300)

    # 2 VS の紋章・名札（左下＝自分〔紺〕・右下＝相手〔えんじ〕）
    img = o('vs_parts.png')
    cut(img, (312, 16, 1224, 713), 'ui/vs/vs_emblem.webp', width=360)
    cut(img, (6, 718, 753, 1005), 'ui/vs/plate_player.webp', width=480)
    cut(img, (782, 718, 1530, 1005), 'ui/vs/plate_opponent.webp', width=480)

    # 3・4 主人公の立ち絵と、顔の丸窓用（正方形）
    for g, face in (('male', (377, 10, 677, 310)), ('female', (372, 40, 672, 340))):
        img = o(f'hero_{g}.png')
        save(img.crop(img.getbbox()), f'characters/hero_{g}.webp', height=900)
        save(img.crop(face), f'characters/face_hero_{g}.webp', width=256)

    # 5 主人公を選ぶ札（左＝ふつう・右＝選んだとき）
    img = o('newgame_choice.png')
    cut(img, (116, 23, 716, 938), 'ui/newgame/choice_normal.webp', width=360)
    cut(img, (807, 17, 1432, 946), 'ui/newgame/choice_selected.webp', width=360)

    # 6 技が当たったときの光（3列×2行のマス。黒い背景のまま）
    img = Image.open(src / 'battle_effects.png').convert('RGB')
    names = ['force', 'wisdom', 'defense', 'evade', 'special', 'heal']
    for i, name in enumerate(names):
        x, y = (i % 3) * 512, (i // 3) * 512
        save(img.crop((x, y, x + 512, y + 512)), f'effects/fx_{name}.webp', width=256)

    # 7 レア度の印（銅＝C・銀＝U・金＝R）と NEW の札（ふつう・光が強いとき）
    img = o('card_badges.png')
    for rarity, box in (('c', (31, 252, 403, 718)), ('u', (441, 253, 811, 719)), ('r', (848, 250, 1222, 724))):
        cut(img, box, f'ui/badges/rarity_{rarity}.webp', height=96)
    cut(img, (29, 864, 592, 1046), 'ui/badges/new_tag.webp', height=64)
    cut(img, (653, 856, 1223, 1058), 'ui/badges/new_tag_glow.webp', height=64)

    # 8 まだ買えないパック（第1弾のパックと同じ高さ）
    img = o('pack_locked.png')
    cut(img, (129, 63, 894, 1437), 'ui/packs/pack_locked.webp', height=438)

    # 9 勝ち抜き表：回戦の札（ふつう・次に戦う・終わった）・勝ち負けの印・線・優勝杯
    img = o('bracket_parts.png')
    cut(img, (33, 111, 793, 262), 'ui/tournament/plate_normal.webp', width=600)
    cut(img, (34, 283, 793, 434), 'ui/tournament/plate_next.webp', width=600)
    cut(img, (33, 461, 793, 611), 'ui/tournament/plate_done.webp', width=600)
    cut(img, (809, 277, 1014, 484), 'ui/tournament/medal_win.webp', height=96)
    cut(img, (809, 515, 1014, 723), 'ui/tournament/medal_lose.webp', height=96)
    cut(img, (123, 634, 179, 912), 'ui/tournament/line_vertical.webp', height=240)
    cut(img, (1036, 104, 1514, 910), 'ui/tournament/trophy.webp', height=320)

    # 10 ランクアップ・優勝の帯（勝ちの帯と同じ幅）
    img = o('banner_rankup.png')
    cut(img, (13, 61, 1523, 952), 'ui/banners/banner_rankup.webp', width=760)


if __name__ == '__main__':
    main()
