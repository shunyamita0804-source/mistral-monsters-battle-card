# 指示書 BF：機械の塔の正式の絵に差し替え（2026-11-05）

ブランチ `bf-tower-art`（main に取り込む・**公開はしない**）。指示書と原本（無改変）は `design-parts/machine-tower-20261105/`。
ゲーム用の WebP は `python3 -I tools/art/machine_tower_art.py` で作る（BD の「今の絵を染めた仮の絵」を作る `tools/art/machine_door_colors.py` はやめて消した）。

## 差し替えたもの

| 絵 | 原本 | ゲーム用 | 使う所 |
| --- | --- | --- | --- |
| 赤の扉（閉じた・開いた） | machine_door_red_closed／open.png | `assets/images/maps/dungeon/machine_door_red_*.webp`（大きさそのまま） | 扉のマス（1・2階の飾りの赤の扉も） |
| 青の扉（閉じた・開いた） | machine_door_blue_closed／open.png | `machine_door_blue_*.webp` | 扉のマス |
| スイッチ（赤・青） | machine_switch_red／blue.png | `machine_switch_red／blue.webp` | スイッチ（赤＝レバー下・三角のランプ／青＝レバー上・丸のランプ） |
| 上り階段 | machine_stairs_up.png | `machine_stairs_up.webp` | 機械の塔の階段のマス（前は下り階段の絵） |
| 上の帯の印（赤・青） | badge_door_red／blue.png（256×256） | `assets/images/ui/dungeon/badge_door_*.webp`（96×96） | 上の帯の左（BD の仮の印の代わり。32px で出す） |
| 説明の絵 | tutorial_tower_doors.png（1024×1024） | `assets/images/backgrounds/tutorial_tower_doors.webp`（600×600。ほかの説明の絵と同じ） | 初めて入った場面 `D06` の2行目（AX の説明の絵と同じ額） |

- ファイル名・置き場所は BD と同じなので、扉・スイッチは絵が変わるだけ。ミニマップの扉の色（赤・青）はそのまま
- 開いた扉の足もとのうすい光（BD で足した）はそのまま

## 確かめ

- テスト `tests/bdMachineTower.test.ts`（絵がある・階段は上り・説明の絵は2行目）。`tests/axEvents.test.ts` の「説明の絵の原本」の確かめに、この絵の置き場所を足した
- 写真の道具 `tools/e2e/bd_tower_shot.cjs` に上り階段のとなりの写真を足した
- 暗い画面：扉のふちの光（赤＝赤・青＝水色）とランプの形（三角・丸）で見分けられる。見たけれど今は明かりの外のマスは暗く（半分の明るさ）なるので、遠くの扉は見えにくい

## 要確認

1. 階段の確かめの窓の絵（`stairs_confirm.webp`）は今の絵のまま（塔の上り階段の絵ではない）
2. 開いた扉の足もとのうすい光（BD で足した）は、新しい絵にもふちの光があるので要らないかもしれない
3. 明かりの外の扉は暗くて色が分かりにくい（今のダンジョンの見え方のまま）
