# -*- coding: utf-8 -*-
"""イベントのダンジョン3つ（霧の廃坑・忘れられた書庫・静かなる祭壇）の正式な絵を、ゲーム用に切り出す（2026-10-29 届いた22枚＋確認用3枚）

使い方: python3 -I tools/design/event_dungeons3_build.py design-parts/event-dungeons3-20261029 assets/images

原本（無改変）: design-parts/event-dungeons3-20261029/{d}/{d}_{tiles,parts,battle_bg,boss_mark,art,overlay,title}.png（書庫だけ archive_rugs.png も）
作り方・名前・大きさ・継ぎ目の加工は、新しいダンジョン5つ（tools/design/dungeons5_build.py）と同じ（その道具の関数をそのまま使う）。
作るもの（{d} は mist_mine・archive・altar）:
  maps/dungeon/{d}_floor.webp・{d}_wall_top.webp・{d}_wall_face.webp   床・壁の上面・壁の正面（継ぎ目が出ないように端を重ねてぼかす）
  maps/dungeon/{d}_stairs_down.webp                                    下り階段（上り階段はランダム生成のダンジョンでは使わないので作らない）
  maps/dungeon/{d}_deco_{1..}.webp                                     床に置く飾り（仕掛けではなく見た目だけ。指示書の parts の順）
      mist_mine：1・2 トロッコのレールの切れはし／3・4 鉱石のかたまり／5・6 床をはう霧のかたまり（半透明のまま）
      archive  ：1・2 本と巻物の山／3・4 石板のかけら／5 燭台
      altar    ：1・2 石の灯籠／3 床の銀の紋章／4・5 くずれた柱のかけら
  maps/dungeon/archive_rug_{1..3}.webp                                 書庫の床に少しだけ散らすじゅうたんの切れはし
  maps/dungeon/boss_mark_{d}.webp                                      ボスの間のしるし（今の boss_mark_ruins と同じ高さ 320）
  backgrounds/battle_{d}.webp                                          対戦の背景（1024×1536 のまま）
  ui/dungeon_intro/{d}_art.webp・{d}_overlay.webp・{d}_title.webp     入ったときの挿絵（縦長のまま）・重ねる輪・ダンジョン名の絵

- 絵そのもの（色・形）は変えない。変えるのは「切り出し・縮小・WebP・床と壁の継ぎ目の加工」だけ。何度作り直しても同じ結果になる
- ゲームのデータ（ダンジョンの一覧・世界地図）にはまだ足さない。見た目の割り当ては src/data/eventDungeons.ts（まだ使われていない）
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dungeons5_build as d5  # noqa: E402

DUNGEONS = ('mist_mine', 'archive', 'altar')
# 飾りの数（指示書の parts の中身）
DECO_COUNT = {'mist_mine': 6, 'archive': 5, 'altar': 5}
# 飾りの縮める高さ（px。床の1マス 48px の 2〜4 倍くらいの絵。今の聖域の燭台 192・羽 96 と同じ考え方）
DECO_HEIGHT = 192
# 飾りを上の段から並べるときの段の高さ（シートの px。部品の縦の真ん中をこれで割って段を決める）
ROW_BAND = 250
# ダンジョン名の絵の幅の上限（今のダンジョンと同じ）
TITLE_MAX_W = 1000


def deco_order(d: str, comps: list) -> list:
    """飾りを指示書の parts の順に並べる"""
    if d == 'altar':
        # 灯籠（縦に細長い2つ）→ 紋章（いちばん横に広い）→ 柱のかけら（残り。左から）
        tall = sorted([c for c in comps if (c[3] - c[1]) > 1.5 * (c[2] - c[0])], key=lambda c: c[0])
        rest = [c for c in comps if c not in tall]
        emblem = max(rest, key=lambda c: c[2] - c[0])
        pillars = sorted([c for c in rest if c is not emblem], key=lambda c: c[0])
        return [*tall, emblem, *pillars]
    # 霧の廃坑・書庫：上の段から、段の中は左から
    return sorted(comps, key=lambda c: (round((c[1] + c[3]) / 2 / ROW_BAND), (c[0] + c[2]) / 2))


def build_parts(src: str, d: str, save: d5.Saver) -> None:
    sheet = Image.open(os.path.join(src, d, f'{d}_parts.png')).convert('RGBA')
    a = np.array(sheet)[:, :, 3]
    comps = d5.components(sheet)
    # 階段は左の2つ（シートの左の方〔横の真ん中が 6 割より左〕）。祭壇は2つの階段がくっついているので分ける
    stairs = sorted([c for c in comps if (c[0] + c[2]) / 2 < sheet.width * 0.6], key=lambda c: c[0])
    rest = [c for c in comps if c not in stairs]
    if len(stairs) == 1:
        stairs = d5.split_at_gap(stairs[0], a)
    assert len(stairs) == 2, (d, 'stairs', len(stairs))
    save(d5.fit(d5.trim(d5.cut(sheet, stairs[0])), height=256), f'maps/dungeon/{d}_stairs_down.webp')
    assert len(rest) == DECO_COUNT[d], (d, 'deco', len(rest))
    for i, c in enumerate(deco_order(d, rest), 1):
        save(d5.fit(d5.trim(d5.cut(sheet, c)), height=DECO_HEIGHT), f'maps/dungeon/{d}_deco_{i}.webp')


def build_rugs(src: str, save: d5.Saver) -> None:
    sheet = Image.open(os.path.join(src, 'archive', 'archive_rugs.png')).convert('RGBA')
    comps = sorted(d5.components(sheet), key=lambda c: c[0])
    assert len(comps) == 3, ('rugs', len(comps))
    for i, c in enumerate(comps, 1):
        save(d5.fit(d5.trim(d5.cut(sheet, c)), width=384), f'maps/dungeon/archive_rug_{i}.webp')


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    save = d5.Saver(out)
    for d in DUNGEONS:
        d5.build_tiles(src, d, save)
        build_parts(src, d, save)
        boss = d5.trim(Image.open(os.path.join(src, d, f'{d}_boss_mark.png')).convert('RGBA'))
        save(d5.fit(boss, height=320), f'maps/dungeon/boss_mark_{d}.webp')
        save(Image.open(os.path.join(src, d, f'{d}_battle_bg.png')).convert('RGB'), f'backgrounds/battle_{d}.webp', quality=84)
        save(Image.open(os.path.join(src, d, f'{d}_art.png')).convert('RGB'), f'ui/dungeon_intro/{d}_art.webp', quality=84)
        overlay = d5.trim(Image.open(os.path.join(src, d, f'{d}_overlay.png')).convert('RGBA'))
        save(d5.fit(overlay, width=1200), f'ui/dungeon_intro/{d}_overlay.webp', quality=88)
        title = d5.trim(Image.open(os.path.join(src, d, f'{d}_title.png')).convert('RGBA'))
        save(d5.fit(title, width=TITLE_MAX_W), f'ui/dungeon_intro/{d}_title.webp', quality=90)
    build_rugs(src, save)


if __name__ == '__main__':
    main()
