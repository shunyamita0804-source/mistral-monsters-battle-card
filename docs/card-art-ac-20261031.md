# AC【3】【4】ミュロルの正式カード・バトル用の絵・パック／シシエンの正式カードの枠（2026-10-31）

指示書 AC の【3】【4】。絵は描き直さない（縮める・余白を足す・型に入れるだけ）。

## 【3】ミュロル

原本（無改変）：`design-parts/cards-original/myurol-official-20261031/`（正式モンスターカード・バトル用の絵・パックの窓の絵）。

- **正式モンスターカード** `myurol_official.webp`（508×849）。`src/data/myurol.ts` に `art`（カルシェルと同じ使い方）。図鑑・大きなカード・祭壇・もらったカードの一覧など、ほかの正式カードが出る所すべてで出る
  - **合わせ方**：原本は 974×1615（ほかの正式カードは 970×1622 で、ミュロルは少し横長）。ゆがめずに幅 508 に縮めると高さ 842 になるので、
    上に 3・下に 4 の白い余白（カードのまわりの白と同じ色）を足して、ほかと同じ 508×849 にした。枠は切っていない（`tools/art/official_card_webp.py`）
- **バトル用の絵** `myurol_battlecard.png`：届いた絵（800×920・同じポーズ）に差し替え。`battleCards.ts` の scale 0.86・offsetY 0 のままで枠に収まる。
  アイコンの切り抜き（`monsterPortraits.ts`：0.5・0.3・1.6 倍）も顔が切れない（写真で確認）ので変えていない
- **パック**：新しい窓の絵を `design-parts/gacha-20261029/pack_art/pack_art_myurol.png` に（前の窓の絵は `pack_art_myurol_v1.png`）。
  前の完成のパック（デザイン担当が型に入れた版）は、窓の絵を **695×1218 に縮めて窓の (121, 232) に置く**収め方だった（前の窓の絵とくらべて測った）。
  `pack_tint.py` に `WINDOW_FIT` としてこの収め方を足し、新しい窓の絵も同じに収めて**顔の位置を前と同じ**にした（前の窓の絵で作り直すと前のパックとほぼ同じになることも確かめた）。
  前のパックは `art_v1/pack_myurol.png` に残す
  - `gacha_series_build.py` → `pack_myurol.webp`（ほかのパックは同じバイト列のまま）
  - `gacha_panel_build.py` → 販売機の窓 `panel_myurol.webp`・店の中の販売機 `panel_shop.webp`（顔の位置 0.55・0.30 は前のまま）
  - `shop_products.py` → `shop_pack_myurol.png`・寝かせたカード `shop_card_myurol.png`（新しい正式カードから）
  - 街と部屋の絵の作り直し（`seimon_world_build.py`）→ 変わったのはショップの棚 `cardshop_{left_wall,right_wall,back_left_shelf}.webp` と販売機 `cardshop_gacha_machine.webp` の4枚だけ

## 【4】シシエン

- 原本 `design-parts/cards-original/shishien/shishien_official_monstercard_LIFE7_v2_20261031.png` を足した（前の版は消さずに残す）
- `shishien_official.webp`（508×849）を作り直した。図鑑・大きなカード・祭壇など、正式カードが出る所すべてで新しい版
- 寝かせたカード `shop_card_shishien.png` も新しい正式カードから作り直した

## 気づいたこと

- 寝かせたカード（`shop_card_*.png`）は、2026-10-30 の指示書 N で店の中を正面向きの絵にしてから、今のショップの絵には使われていない
  （今の展示台のガラスの台には技カードの絵、額の台にはソラモ・ガウル・ノビトン・ラズックの正式カード。`shop_goods_20261030.py`）。
  ファイルは作り直したが、ゲームの画面では変わらない。報告には作り直したファイルの前と今を並べた

## 道具

- `tools/art/official_card_webp.py`（正式モンスターカードを 508×849 に）
- `tools/e2e/card_art_ac_shot.cjs`（図鑑・大きなカード・祭壇・対戦の場・ガチャ・ショップの写真。前の版は git worktree で前の main を別のポートで）

## 確かめたこと

- `npm run check`
- 写真（前と今）：図鑑・大きなカード・祭壇（ミュロル・シシエン）・対戦の場・ガチャのシリーズ選び・機械の窓・パック・店の中の販売機・ショップの棚・アイコンの切り抜き

## 未完了

- iPhone 実機での確認
