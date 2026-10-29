# -*- coding: utf-8 -*-
"""街の花屋（住宅A・マルタ）と仕立て屋（住宅D・ロザリー）の中の新しい絵（2026-10-29 ZIP「Mistral_Room_florist_parts」「Mistral_Room_tailor_parts」）。

使い方：python3 -I tools/design/rooms_shop_build.py [確認画像の出力先]
原本：design-parts/rooms-20261029/（無改変）。絵は描き直さない（重ねる・切り抜く・形式を変えるだけ。色の処理もかけない）。
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

SRC = os.path.join(r4.ROOT, 'design-parts/rooms-20261029')
OUT_TS = os.path.join(r4.ROOT, 'src/data/shopRoomsArt.generated.ts')

# 2つの店の入れ物（床・壁・入口の柱・カウンター）は同じ形
FLOOR = [(330, 298), (1210, 298), (1505, 690), (1505, 742), (30, 742), (30, 690)]  # 下のふち：手前の低い壁の上のふちまで
PASSAGE = (578, 740, 958, 1024)
PILLARS = [
    (378, 700, 578, 1024),   # 入口の左の柱と植木
    (958, 700, 1158, 1024),  # 入口の右の柱と植木
]
COUNTER = (521, 425, 1054, 571)       # 真ん中のカウンター（右はしの丸いすも）
KEEPER_BACK = (705, 385, 835, 425)    # カウンターの奥の店番の所（後ろに回っても人に重ならない）
PLANT_STAND = (1038, 295, 1108, 322)  # 奥の小さな花鉢と丸い台
# 店番：話しかけるマス（カウンターの一番手前の行）と見た目の足もと（天板の奥の線 y≈415 より約65px手前）
KEEPER = dict(logic=(768, 560), look=(768, 482))

ROOMS: dict[str, dict] = {
    # 花屋：奥の作りつけの棚（花・包み紙・リボン）、左右の花の段、左右の壁の吊り花かご、真ん中のカウンター（マルタはその奥）
    'florist': dict(
        src=SRC, dir='Mistral_Room_florist_parts', prefix='florist',
        furniture={
            '01_counter': 565,
            '02_flower_steps_left': 300,   # 左の壁ぞいの斜めの段（前にしか立てない）
            '03_flower_steps_right': 300,  # 右の壁ぞいの斜めの段（同上）
            '04_plant_stand': 319,
            '05_floor_plant_left': 645,
            '06_floor_plant_right': 650,
        },
        floor=FLOOR, passage=PASSAGE,
        blocks=[
            COUNTER, KEEPER_BACK, PLANT_STAND,
            [(0, 290), (345, 290), (345, 560), (272, 600), (175, 600), (175, 560), (0, 560)],  # 左の花の段
            (0, 560, 175, 650),                                                              # 左手前の鉢植えと小さな台
            [(1200, 290), (1536, 290), (1536, 620), (1342, 620), (1300, 520), (1240, 432), (1200, 380)],  # 右の花の段
            (1388, 590, 1536, 655),                                                          # 右手前の鉢植え
            *PILLARS,
        ],
        items={
            # 吊り花かご（左右の壁の上）は、その下の花の段の右・左の床から調べる（花の段より先に並べる）
            'BASKET_L': (235, 40, 345, 330),
            'BASKET_R': (1180, 40, 1295, 330),
            'STEPS_L': (106, 141, 343, 598),
            'STEPS_R': (1195, 113, 1501, 615),
            'SHELF': (410, 20, 1120, 298),
        },
        marks={'COUNTER': (521, 368, 1054, 571)},
        spots={'KEEPER_SPOT': KEEPER},
        spawn=(768, 742), exit_bottom=1024,
    ),
    # 仕立て屋：奥の布の棚、右奥の試着の囲い、右の姿見、左右のトルソー、左の布の台、真ん中の作業カウンター（ロザリーはその奥）
    'tailor': dict(
        src=SRC, dir='Mistral_Room_tailor_parts', prefix='tailor',
        furniture={
            '01_counter': 565,
            '02_torso_left': 463,
            '03_cloth_table': 420,   # 左の斜めの布の台：右に立つ人はいつも手前、台の奥に回った人は奥
            '04_fitting_room': 400,
            '05_torso_right': 612,
            '06_mirror': 420,        # 右の壁ぞいの姿見（前にしか立てない）
            '07_left_cabinet': 300,  # 左の壁ぞいの低い棚（前にしか立てない）
            '08_rear_cabinet': 357,
            '09_floor_plant_right': 580,
            '10_plant_stand': 319,
        },
        floor=FLOOR, passage=PASSAGE,
        blocks=[
            COUNTER, KEEPER_BACK, PLANT_STAND,
            # 左の壁ぞいの棚・左奥の収納棚・左のトルソー・左の布の台（棚と台の間はせまいので通れない。台の奥の小さなすき間 y 362〜400 には入れる）
            [(0, 290), (335, 290), (335, 362), (272, 362), (272, 400), (405, 400), (405, 480), (335, 668), (0, 668)],
            [(1180, 290), (1536, 290), (1536, 420), (1380, 420), (1345, 398), (1180, 398)],              # 試着の囲い
            (1350, 420, 1436, 585),                                                                       # 姿見のそばの鉢植え
            [(1400, 420), (1536, 420), (1536, 700), (1405, 700), (1405, 600)],                           # 姿見
            (1255, 560, 1345, 625),                                                                       # 右のトルソー（丸い敷物の上は歩ける）
            *PILLARS,
        ],
        items={
            'CLOTH_SHELF': (410, 20, 1120, 298),
            'FITTING': (1179, 73, 1381, 409),
            'MIRROR': (1380, 353, 1526, 692),
            'TORSO_L': (172, 218, 271, 463),
            'TORSO_R': (1250, 352, 1350, 625),
            'CLOTH_TABLE': (162, 370, 401, 668),
        },
        marks={'COUNTER': (521, 397, 1054, 571)},
        spots={'KEEPER_SPOT': KEEPER},
        spawn=(768, 742), exit_bottom=1024,
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
        f.write('// 花屋・仕立て屋の中の新しい絵（2026-10-29。design-parts/rooms-20261029/）\n')
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
