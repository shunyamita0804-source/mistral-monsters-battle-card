"""デザイン第12弾・第13弾（2026-10-27 納品。ZIP「Mistral_UI_Quality12_Assets」「Mistral_UI_Quality13」）を、ゲームで使う大きさの部品に切り出す。

使い方：
  python3 -I tools/design/ui12_13_build.py design-parts/ui-quality12-20261027 design-parts/ui-quality13-20261027

届いた絵は透明の背景（森の床・壁・対戦の背景・大会の絵・物語の始まりの絵は不透明）。
部品は「透明でないかたまり」ごとに切り出す（となりの部品の端が入らないよう、そのかたまりだけを残す）。絵は描き直さない（切り出し・縮小だけ）。

書き出し先（assets/images/）：
  maps/dungeon/forest_{floor,wall_top,wall_face}.webp・forest_stairs_{down,up}.webp   精霊の森の床・壁・階段
  maps/dungeon/boss_mark_{ruins,forest}.webp     ボスの間のしるし（太古の遺跡＝石の門・精霊の森＝根の祭壇）
  backgrounds/battle_forest.webp・battle_arena_d.webp・tournament_champion.webp   森の対戦・D ランク大会の対戦・優勝の場面
  characters/battler_{1,2,3}.webp・face_battler_{1,2,3}.webp   ダンジョンのバトラー3人の立ち姿と顔
  characters/guardian.webp・face_guardian.webp・ui/dungeon/omen_mark.webp   見えない番人の立ち姿・顔・気配の印
  ui/dungeon/dpad{,_pressed}.webp・btn_{a,b}{,_pressed}.webp   十字キーと A・B
  ui/dungeon/minimap_frame.webp・mini_{you,stairs,chest,battler,boss}.webp   ミニマップの枠と印
  ui/dungeon/banner_retreat.webp・lantern_{on,off}.webp   戻されるときの帯・負けの灯り
  characters/hero_{male,female}_{win,lose}.webp   主人公の勝ち・負けの姿
  ui/battle/talk_face_frame.webp・talk_bubble.webp   相手のひと言の顔の枠と吹き出し
物語の始まりの挿絵（opening_art.png）は、入れるかをユーザーに聞いてから（いまは原本だけ）。
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

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


def blob(img: Image.Image, point: tuple[int, int], box: tuple[int, int, int, int] | None = None) -> Image.Image:
    """point を含む透明でないかたまりだけを残して切り出す（box を渡すとその範囲で切る。高さをそろえたいとき）"""
    rgba = np.array(img)
    solid = rgba[:, :, 3] > 8
    lab, _ = ndimage.label(ndimage.binary_dilation(solid, iterations=6))
    n = lab[point[1], point[0]]
    if n == 0:
        raise ValueError(f'{point} にかたまりがない')
    keep = lab == n
    out = rgba.copy()
    out[~keep, 3] = 0
    if box is None:
        ys, xs = np.where(keep & solid)
        box = (xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3)
    return Image.fromarray(out).crop(box)


def main() -> None:
    q12 = Path(sys.argv[1])
    q13 = Path(sys.argv[2])
    o12 = lambda name: Image.open(q12 / name).convert('RGBA')  # noqa: E731
    o13 = lambda name: Image.open(q13 / name).convert('RGBA')  # noqa: E731

    # 12-1・2 精霊の森の床と壁（壁は上が上面 0〜962・下が正面 1070〜1502。間は暗い帯）
    save(Image.open(q12 / 'forest_floor.png').convert('RGB'), 'maps/dungeon/forest_floor.webp', width=512)
    walls = Image.open(q12 / 'forest_walls.png').convert('RGB')
    save(walls.crop((0, 0, 1024, 962)), 'maps/dungeon/forest_wall_top.webp', width=512)
    save(walls.crop((0, 1070, 1024, 1502)), 'maps/dungeon/forest_wall_face.webp', width=768)

    # 12-3 階段（左＝下り・右＝上り）
    img = o12('forest_stairs.png')
    save(blob(img, (400, 500)), 'maps/dungeon/forest_stairs_down.webp', height=256)
    save(blob(img, (1160, 500)), 'maps/dungeon/forest_stairs_up.webp', height=256)

    # 12-4 森の対戦の背景
    save(Image.open(q12 / 'battle_bg_forest.png').convert('RGB'), 'backgrounds/battle_forest.webp', width=1024)

    # 12-5 バトラー3人（3人とも同じ上下の範囲で切って、背の高さの違いを残す）
    img = o12('dungeon_battlers.png')
    for i, (x0, x1) in enumerate([(100, 506), (553, 983), (1023, 1519)], start=1):
        save(blob(img, ((x0 + x1) // 2, 500), (x0, 24, x1, 984)), f'characters/battler_{i}.webp', height=360)

    # 12-6 バトラー3人の顔（3つの正方形が触れ合っているので、512px ごとに分ける）
    img = o12('face_battlers.png')
    for i in range(3):
        save(img.crop((i * 512, 0, i * 512 + 512, 512)), f'characters/face_battler_{i + 1}.webp', width=384)

    # 12-7 ボスの間のしるし（左＝遺跡の門・右＝森の祭壇）
    img = o12('boss_marks.png')
    save(blob(img, (400, 500)), 'maps/dungeon/boss_mark_ruins.webp', height=320)
    save(blob(img, (1150, 500)), 'maps/dungeon/boss_mark_forest.webp', height=320)

    # 12-8 見えない番人（左＝気配の印・中＝立ち姿・右＝顔）
    img = o12('guardian_parts.png')
    save(blob(img, (200, 350)), 'ui/dungeon/omen_mark.webp', height=160)
    save(blob(img, (560, 500)), 'characters/guardian.webp', height=360)
    face = blob(img, (1200, 600))
    side = max(face.size)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(face, ((side - face.width) // 2, side - face.height))
    save(sq, 'characters/face_guardian.webp', width=384)

    # 12-9 十字キーと A・B（上の行＝ふつう・下の行＝押したとき。真ん中＝えんじ＝A・右＝紺＝B）
    img = o12('dpad_buttons.png')
    for row, suffix in ((260, ''), (750, '_pressed')):
        save(blob(img, (300, row)), f'ui/dungeon/dpad{suffix}.webp', width=320)
        save(blob(img, (820, row)), f'ui/dungeon/btn_a{suffix}.webp', width=160)
        save(blob(img, (1280, row)), f'ui/dungeon/btn_b{suffix}.webp', width=160)

    # 12-10 ミニマップの枠と5つの印（左から 自分・階段・宝箱・バトラー・ボス）
    img = o12('minimap_parts.png')
    save(blob(img, (420, 500)), 'ui/dungeon/minimap_frame.webp', width=480)
    for name, x in (('you', 878), ('stairs', 1015), ('chest', 1160), ('battler', 1300), ('boss', 1449)):
        save(blob(img, (x, 520)), f'ui/dungeon/mini_{name}.webp', height=48)

    # 13-1・2 主人公の勝ち・負け（左＝勝ち・右＝負け。同じ上下の範囲で切る）
    for gender, win, lose in (('male', (55, 803), (824, 1516)), ('female', (41, 816), (816, 1530))):
        img = o13(f'hero_{gender}_result.png')
        save(blob(img, ((win[0] + win[1]) // 2, 600), (win[0], 12, win[1], 1024)), f'characters/hero_{gender}_win.webp', height=600)
        save(blob(img, ((lose[0] + lose[1]) // 2, 600), (lose[0], 12, lose[1], 1024)), f'characters/hero_{gender}_lose.webp', height=600)

    # 13-3 相手のひと言（左＝顔の枠・右＝吹き出し）
    img = o13('talk_bubble.png')
    save(blob(img, (85, 500)), 'ui/battle/talk_face_frame.webp', width=240)
    save(blob(img, (900, 500)), 'ui/battle/talk_bubble.webp', width=720)

    # 13-4 戻されるときの帯・負けの灯り（灯った・消えた）
    img = o13('dungeon_retreat.png')
    save(blob(img, (768, 290)), 'ui/dungeon/banner_retreat.webp', width=900)
    save(blob(img, (570, 750)), 'ui/dungeon/lantern_on.webp', height=64)
    save(blob(img, (965, 750)), 'ui/dungeon/lantern_off.webp', height=64)

    # 13-5・6 優勝の場面・D ランク大会の対戦の背景
    save(Image.open(q13 / 'tournament_champion.png').convert('RGB'), 'backgrounds/tournament_champion.webp', width=768)
    save(Image.open(q13 / 'battle_bg_arena_d.png').convert('RGB'), 'backgrounds/battle_arena_d.webp', width=1024)


if __name__ == '__main__':
    main()
