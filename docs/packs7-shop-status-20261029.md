# ガチャのパック7つ・ショップの棚の商品・場の状態の印（2026-10-29）

指示書：`design-parts/gacha-20261029/00_instructions_packs7_shop_status.txt`（ZIP「Mistral_Packs7_Shop_Status_ClaudeCode_20261029」）。
原本は `design-parts/gacha-20261029/`（art・shop・status・パックの型）。道具 `tools/design/pack_tint.py`・`shop_products.py` は置いただけ（ジオルのパックのとき進行が使う）。

## 1. ガチャのパック

- `tools/design/gacha_series_build.py`：パックは新しい原本（935×1683）を 600×1080 に縮めるだけ。前の「上の封を切りとる」処理はやめた。プカリムを足した（7つ）
  - 使い方：`python3 -I tools/design/gacha_series_build.py design-parts/gacha-20261028/art design-parts/gacha-20261029/art`（つまみ・取り出し口などは前の原本のまま。中身は1バイトも変わらない）
- 新しい絵になった所（どれも `gachaArt.ts` の `seriesPackUrl` で同じ絵を使う）
  | 画面 | 場所 |
  | --- | --- |
  | シリーズを選ぶ画面の7つのパック | `shopScreens.ts`（`.gacha-select__pack`） |
  | 値段の確認の窓のパック | `shopScreens.ts`（`.gacha-select__confirm-pack`） |
  | 販売機の中に並ぶパック・取り出し口に出てくるパック | `gachaMachine.ts` |
  | 開ける画面のパック（破るふたと本体） | `gachaOpen.ts`（破れる線 `TEAR_AT` を 0.105→0.075。新しいパックの上の紺の帯の真ん中） |
- パックの縦横の比を `gacha.css` の3か所で 600/950 → 600/1080 に
- `pack_sealed`（無地のパック）：`gachaArt.ts` の「絵が無いシリーズ」のときだけ使う。7つとも絵があるので、いまは画面に出ない（ファイルは新しいシリーズの絵が届く前の予備として残す）
- 別の絵：ベッドの「冒険の記録」の「開けたパック」の小さな印は前からの `ui/packs/pack_01.webp`（シリーズのパックではない共通の印）。今回は替えていない

## 2. カードショップの棚の商品

- `tools/design/shop_goods_20261029.py`（`cardshop_v2.py` が家具を書き出す前に `dress()` を呼ぶ）。家具の絵の無地の紺（青みのある所）の中だけに商品を重ねる
  - 立てたパック（shop_pack）：左右の壁の棚・右の小展示台・奥左の棚・手前の展示台の下の段（棚の段ごとに傾きを合わせて並べる）。中央右の展示台の細長い箱
  - 寝かせたカード（shop_card）：中央の2つのガラスの展示台・奥左の小さなガラスの台・手前の展示台の立てかけた板（測った四すみに合わせる）。ガラスの映りこみは元の絵から上に重ねる
  - 7種類を順に使う（同じものが横に隣り合わない）。明るさは 0.86〜0.95 倍（色は変えない）
  - 右の壁の左の柱の上の紺の飾り・小さな宝箱、右の小展示台の下の看板の板は商品ではないので、そのまま
- 当たり判定・調べる物は変えていない。カウンターの奥の棚（back_shelves）は店員の後ろの在庫なので、そのまま

## 3. 場の状態の印

- `tools/design/status_marks_build.py` で 128px の WebP（`assets/images/ui/battle/status_charged.webp`・`status_tailwind.webp`）
- `battleScreen.ts` の `cornerMarks`：場のカードの右上の角（前のライフの札の所）に、カードの幅の28%。2つのときは縦に並べる。前の仮の丸い印と文字は消した
- 手札・大きなカードには出さない（場のカードだけ）

## 4. 大会会場の受付の画面（同じ日に直した）

- 受付の前（セリアに話しかけられる所）にいる間だけ、画面の中心を主人公とカウンターの真ん中の中間へ。はみ出すときは全体が入る所まで（ユーザー了承）
- `maps.ts` の `CAMERA_LEANS`・`src/ui/components/cameraLean.ts`・テスト `tests/cameraLean.test.ts`。カウンターの範囲は `rooms4_build.py` の marks（COUNTER）
