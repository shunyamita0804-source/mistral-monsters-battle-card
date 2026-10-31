# -*- coding: utf-8 -*-
"""街の花屋（住宅A・マルタ）と仕立て屋（住宅D・ロザリー）の中の絵（2026-10-29 ZIP「Mistral_Room_florist_parts」「Mistral_Room_tailor_parts」。
2026-10-31 指示書 AD【1】で正面向きの新しい絵に：design-parts/rooms-frontfacing-20261031/{florist,tailor}/。部屋4つの v2〔rooms4_build.py の _build_v2〕と同じ作り）。

使い方：python3 -I tools/design/rooms_shop_build.py [確認画像の出力先]
原本：design-parts/rooms-frontfacing-20261031/（無改変。前の絵は design-parts/rooms-20261029/）。絵は描き直さない（重ねる・切り抜く・形式を変えるだけ。色の処理もかけない）。
書き出し：assets/images/maps/rooms/room_florist_*.webp・room_tailor_*.webp と src/data/shopRoomsArt.generated.ts。

作り方は部屋4つ（rooms4_build.py）とまったく同じ（その build_room を使う）：
- 部品は 1536×1024 の同じキャンバス（左上で重ねる）。shell＝部屋の箱、01〜＝家具1つずつ、front＝手前の低い壁と入口の柱（いつも人より手前）
- 1px ＝ 1.25 単位・基準の高さ 1024。家具は足もとの y（z）で人と前後。壁ぞいの斜めの家具（前にしか立てない）は z を小さくする
- 歩ける所：床の上だけ（FLOOR と入口の通り道 PASSAGE から、家具の足もと BLOCKS を除く）
- 店番（マルタ・ロザリー）は真ん中のカウンターの奥に立つ。見た目は管理局のエレノアと同じ考え方（足もとは天板の奥の線より約65px手前。腰から上が見える）。
  話しかけるマスはカウンターの一番手前の行（カウンターの手前の床から話す）。カウンターの右はしの丸いすには重ならない
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rooms4_build as r4  # noqa: E402

# 前の絵（2026-10-29。ななめの壁）の部品は design-parts/rooms-20261029/ に残す
OUT_TS = os.path.join(r4.ROOT, 'src/data/shopRoomsArt.generated.ts')

# 2026-10-31 指示書 AD【1】：正面向きの新しい絵（design-parts/rooms-frontfacing-20261031/{florist,tailor}/）。
# 部屋4つの v2（指示書 X の管理局など）と同じ作り：shell（不透明）＋家具（1536×1024 の置く位置で描いたもの）＋shell から切り抜いた手前の層（front_cut）。
# 2つの店の入れ物（床・壁・入口の柱・作業台）はほぼ同じ形。左右の壁はまっすぐ（内側のふち x 約45・約1491）、奥の壁の下 y 約300
PASSAGE_X = (577, 953)   # 入口の通り道（左右の柱のあいだ）
PILLARS = [
    (388, 690, 577, 1024),   # 入口の左の柱
    (953, 690, 1147, 1024),  # 入口の右の柱
]
KEEPER_BACK = (720, 390, 840, 442)    # 作業台の奥の店番の所（後ろに回っても人に重ならない。2行）

ROOMS: dict[str, dict] = {
    # 花屋：奥の作りつけの棚（花・包み紙・リボン）と壁の吊り花かご左右（shell）、左右の花のひな壇、真ん中の作業台（マルタはその奥）、
    # 右の手前に花台、左右の手前に床の鉢植え
    'florist': dict(
        v2='florist', v2src=r4.SRC_AD,
        furniture=[
            ('florist_01_counter', 'counter', 585, None),
            ('florist_02_flower_steps_left', 'flower_steps_left', 585, None),
            ('florist_03_flower_steps_right', 'flower_steps_right', 600, None),
            ('florist_04_plant_stand', 'plant_stand', 735, None),
            ('florist_05_floor_plant_left', 'floor_plant_left', 730, None),
            ('florist_06_floor_plant_right', 'floor_plant_right', 740, None),
        ],
        extra=[],
        # 手前の低い壁（上のふち y 約723）・入口の柱（柱の上の飾りの先 y 約643）。入口の通り道は切り抜かない
        front_cut=[(0, 722, 392, 1024), (388, 640, 577, 1024), (953, 640, 1147, 1024), (1143, 722, 1536, 1024)],
        floor=[(45, 300), (1491, 300), (1491, 725), (45, 725)],
        passage=(PASSAGE_X[0], 715, PASSAGE_X[1], 1024),
        blocks=[
            (515, 440, 1065, 582),               # 作業台（右はしの丸いすも）
            KEEPER_BACK,
            (40, 300, 390, 582),                 # 左の花のひな壇（奥の壁・左の壁とのすき間もふさぐ）
            (1150, 300, 1496, 597),              # 右の花のひな壇（同上）
            (80, 680, 212, 728),                 # 左の手前の鉢植え
            (1165, 690, 1240, 733),              # 右の手前の花台
            (1340, 690, 1472, 738),              # 右の手前の鉢植え
            *PILLARS,
        ],
        items={
            # 吊り花かご（奥の壁の左右のはし）は、その下の花のひな壇の右・左の床から調べる（奥の棚・ひな壇より先に並べる。範囲が重なる）
            'BASKET_L': (110, 60, 395, 300),
            'BASKET_R': (1140, 60, 1420, 300),
            'STEPS_L': (65, 377, 390, 585),
            'STEPS_R': (1150, 372, 1475, 600),
            'SHELF': (330, 20, 1200, 300),
        },
        marks={'COUNTER': (515, 384, 1065, 585)},
        # マルタ：見た目は作業台の奥（足もとは天板の奥の線 y 約435 より約65px手前）。話しかけるマスは作業台の一番手前の行
        spots={'KEEPER_SPOT': dict(logic=(768, 575), look=(768, 500))},
        spawn=(768, 704), exit_bottom=1024,
    ),
    # 仕立て屋：奥の布の棚と壁の服かけ（shell）、右奥の試着の囲い、右の姿見と鉢植え、左右のトルソー、左の手前の布の陳列台、
    # 左の壁ぞいの棚2つ（奥の収納棚・低い棚）、奥の小さな花台、真ん中の作業台（ロザリーはその奥）
    'tailor': dict(
        v2='tailor', v2src=r4.SRC_AD,
        furniture=[
            ('tailor_01_counter', 'counter', 580, None),
            ('tailor_02_torso_left', 'torso_left', 530, None),
            ('tailor_03_cloth_table', 'cloth_table', 680, None),
            ('tailor_04_fitting_room', 'fitting_room', 425, None),
            # 右のトルソー：丸い敷物ごとの絵。台の足もと（y 約615）で人と前後を比べる（敷物の手前に立つ人は手前）
            ('tailor_05_torso_right', 'torso_right', 615, None),
            ('tailor_06_mirror', 'mirror', 675, None),
            ('tailor_07_left_cabinet', 'left_cabinet', 550, None),
            ('tailor_08_rear_cabinet', 'rear_cabinet', 400, None),
            ('tailor_09_floor_plant_right', 'floor_plant_right', 620, None),
            ('tailor_10_plant_stand', 'plant_stand', 335, None),
        ],
        extra=[],
        # 手前の低い壁（上のふち y 約718）・入口の柱（柱の上の飾りの先 y 約635）。入口の通り道は切り抜かない
        front_cut=[(0, 716, 390, 1024), (386, 632, 577, 1024), (953, 632, 1147, 1024), (1143, 716, 1536, 1024)],
        floor=[(45, 300), (1491, 300), (1491, 718), (45, 718)],
        passage=(PASSAGE_X[0], 710, PASSAGE_X[1], 1024),
        blocks=[
            (520, 445, 1055, 577),               # 作業台（右はしの丸いすも）
            KEEPER_BACK,
            (40, 300, 260, 398),                 # 左奥の収納棚（奥の壁・左の壁とのすき間もふさぐ）
            (40, 490, 245, 548),                 # 左の壁ぞいの低い棚
            (295, 470, 370, 528),                # 左のトルソーの台
            (110, 620, 420, 678),                # 左の手前の布の陳列台
            (1193, 300, 1377, 422),              # 試着の囲い（奥の壁とのすき間もふさぐ）
            (1077, 300, 1127, 333),              # 奥の小さな花台
            (1255, 560, 1320, 620),              # 右のトルソーの台（丸い敷物の上は歩ける）
            (1335, 560, 1420, 618),              # 姿見のそばの鉢植え
            (1400, 560, 1496, 672),              # 姿見（右の壁とのすき間もふさぐ）
            *PILLARS,
        ],
        items={
            'CLOTH_SHELF': (380, 20, 1150, 300),
            'FITTING': (1193, 170, 1377, 425),
            'MIRROR': (1400, 421, 1505, 675),
            'TORSO_L': (284, 290, 380, 530),
            'TORSO_R': (1200, 385, 1369, 655),
            'CLOTH_TABLE': (110, 584, 420, 680),
        },
        marks={'COUNTER': (520, 437, 1055, 580)},
        # ロザリー：見た目は作業台の奥（足もとは天板の奥の線 y 約440 より約65px手前）。話しかけるマスは作業台の一番手前の行
        spots={'KEEPER_SPOT': dict(logic=(768, 570), look=(768, 505))},
        spawn=(768, 700), exit_bottom=1024,
    ),
}


def main() -> None:
    check = sys.argv[1] if len(sys.argv) > 1 else None
    arts: dict[str, dict] = {}
    offsets: dict[str, dict] = {}
    for key in ROOMS:
        arts[key], offsets[key] = r4.build_room(key, check, ROOMS, f'room_{key}')
    files = [im['file'] for art in arts.values() for im in art['tiles'] + art['sprites']]
    body = json.dumps(arts, ensure_ascii=False, indent=1)
    for i, file in enumerate(files):
        body = body.replace(f'"file": "{file}"', f'"file": shopRoomImg{i}')
    with open(OUT_TS, 'w', encoding='utf-8') as f:
        f.write('// 自動生成：tools/design/rooms_shop_build.py（手で書き換えない）\n')
        f.write('// 花屋・仕立て屋の中の絵（2026-10-31 指示書 AD で正面向きの新しい絵。design-parts/rooms-frontfacing-20261031/）\n')
        for i, file in enumerate(files):
            f.write(f"import shopRoomImg{i} from '@assets/images/{file}';\n")
        f.write("import type { ArtMap } from './worldArt.generated.ts';\n\n")
        f.write('/** 花屋・仕立て屋の絵・歩ける所・調べる物・店番の立つ所（キー：florist・tailor） */\n')
        f.write(f'export const SHOP_ROOMS_ART: Readonly<Record<\'florist\' | \'tailor\', ArtMap>> = {body};\n\n')
        f.write('/** カウンターの奥に立つ店番の見た目のずれ（マス。maps.ts の drawDx・drawDy。負＝左・奥） */\n')
        f.write(f'export const SHOP_ROOMS_DRAW_OFFSET = {json.dumps(offsets, ensure_ascii=False)} as const;\n')
    for key, art in arts.items():
        print(key, 'spawn', art['spawn'], 'exit', art['exit'], 'offsets', offsets[key])


if __name__ == '__main__':
    main()
