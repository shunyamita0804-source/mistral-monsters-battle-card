# U 風の渓谷とツムジ（2026-10-30）

ユーザー指示（チャット）。ZIP「Mistral_CC_U_Part1_WindValley・Part2_Tsumuji_20261030」の指示書（`design-parts/cards-original/tsumuji/00_instructions_for_claude_code.txt`。2つの ZIP に同じもの）のとおり。
絵・曲はすべて合格済み（描き直し・色の変更はしていない）。**セーブ version は 29 のまま**（ダンジョン・人・モンスターを足しただけ。D ランクより上の前のセーブは、読み込むと風の渓谷が開く）。

## 1. 風の渓谷（dungeon-08）

- 名前「風の渓谷」（Wind Valley）。D ランクで開く・地下4階・強さは水の神殿と同じ段（floorLife 0.8〜1.1・見える範囲 1・負けられる回数 3・お金も同じ）。
  ダンジョンの一覧・世界地図の並びは水の神殿の次。世界地図の印は Claude が仮に置いた（オルティガ地方の南。街・水の神殿・炎の火山の印と名前の札が重ならない所）
- 絵（原本 `design-parts/dungeons5-20261028/wind/`。名前は届いたまま `wind_valley_*.png`）：`python3 -I tools/design/dungeons5_build.py design-parts/dungeons5-20261028 assets/images wind`
  - 床・壁・階段・ボスの印・ボス戦の背景・入るときの絵・重ねる絵は氷の洞窟と同じ作り（大きさの割合も同じ）
  - 飾り5つは座標で切らず、透明でない部分ごとに切り出し、列と上からの順で名前を付けた（`wind_bridge`・`wind_mill`・`wind_vane`・`wind_leaves`・`wind_stake`。5つとも同じ割合で縮めた）。床の飾りとして置く（`decor.ts`。木の葉の吹きだまりを多めに）
  - 題字：`python3 -I tools/design/dungeon_titles_build.py design-parts/dungeon-titles-20261028 assets/images/ui wind`
  - 作り直してもほかのダンジョンの絵は1バイトも変わらない（氷の洞窟で確かめた）
- 仕掛け：強い風のマス（gimmick 'wind'。`generate.ts` の windPush・windLoops）
  - 決まった向き（'>' '<' '^' 'v'）。乗ると風の向きに2マス押し流される。途中に壁・人・物・宝箱・階段があればその手前で止まる。押し流された先がまた風のマスなら、もう一度流される
  - 1階に4〜8か所（スタート・階段〔ボス〕の上には置かない。人・宝箱は風のマスの上に置かない）。置くたびに「全部の床へ行ける」「輪にならない」を確かめ、人や物を置いたあとにも「階段とボスのとなりへ行ける」「輪にならない」を確かめる（150シード×4階のテスト）
  - 見た目：床の上に、風の向きへ流れる白い線と矢じり（コードで描いた。新しい絵は使っていない）。マスを薄い青で色づけ。見たマスなら乗る前から見える
  - 押し流される間は氷のすべる床と同じく少しずつ動く。画面に風の線が一瞬走り、回避の音（風の音の素材は無いので今の効果音）。「強い風に押し流された！」
- 曲：`bgm_dungeon_wind.mp3`（風のダンジョン / ハヤシユウ・OpenTracks）。gain 0.35（`docs/audio-credits.md`）。ボス戦はほかと同じボスの曲。クレジットに足した

## 2. 人（名刺図鑑 41・42）

- **ゼフィラ**（41・渓谷の守り手・一族でいちばん若い。英語 Valley Keeper, clan's youngest〔仮訳。小さい画面で切れないよう短く〕）：ボス `enc-wind-boss`。
  勝ったあとの祭壇へのせりふにだけ「ほかの聖地のみんなにも教えてあげなきゃ……あっ、今のなし！」。せりふは `docs/dungeon-people.md`
- **ニコ**（42・つり橋の番・Bridge Keeper）：風の渓谷のバトラー（ニコ＋フローラ。水の神殿と同じ割り振り）。地図の上の小さな姿は `stand_battler_wind`
- 顔・立ち姿：`python3 -I tools/design/dungeon_people_build.py design-parts/dungeon-people-20261028 guardian_wind_zephyra battler_wind`。ゼフィラの立ち姿は保管だけ

### ゼフィラの編成と強さ

- 編成：ソラモ・**ツムジ**・ガウル（指示書のとおり）
- lifeScale：ルシアと同じ 1.2 から試遊（`npm run playtest:zephyra`。最初の手持ち3箱 × 200回・先攻後攻は半分ずつ・両方とも CPU。フルーネのときのセラと同じしかた）。
  **1.2 ではルシアよりずっと勝ちにくかった**ので、勝つ割合がルシアといちばん近い **1.0** にした（`docs/design/wind-valley-20261030/playtest_200.json`）

| 相手（lifeScale） | 旅立ちのきらめき | 烈火の猛攻 | 蒼海の守り | 平均（プレイヤーが勝つ割合 ％） |
| --- | --- | --- | --- | --- |
| ルシア（1.2・比べる相手） | 24.0 | 11.0 | 26.0 | **20.3** |
| ゼフィラ 1.3 | 12.0 | 6.0 | 11.5 | 9.8 |
| ゼフィラ 1.2 | 11.5 | 10.5 | 12.5 | 11.5 |
| ゼフィラ 1.1 | 11.5 | 10.0 | 16.5 | 12.7 |
| **ゼフィラ 1.0（採用）** | 22.5 | 14.0 | 26.5 | **21.0** |
| ゼフィラ 0.9 | 43.0 | 45.5 | 39.0 | 42.5 |
| ゼフィラ 0.8 | 43.5 | 39.0 | 41.5 | 41.3 |

- 1.1 と 1.2 がほぼ同じなのは、ライフの数を四捨五入すると同じ数になるモンスターが多いため
- ボスのデッキは今の作り方（`buildOpponentDeck`。左のモンスターの技が2枚ずつ、ほかは1枚ずつ）なので、**ゼフィラのツムジの Wひっかき は1枚だけで、2回続けて使う場面は出ない**（試遊で 0 回）。
  かぜのりは1対戦に約 0.14 回。ボスに2枚入れるかどうかは決めていない（報告で確認）

## 3. ツムジ（mon-tsumuji）

- `mon-tsumuji`・`skl-tsumuji-01〜14` をふつうの一覧に。図鑑の番号はセレフィーンのあと（No.151〜165）。LIFE 6・内部ランク C・くすんだ青みの灰 `#8FA3B8`。データは `src/data/tsumuji.ts`（JSON を読む）
- 絵：原本は `design-parts/cards-original/tsumuji/`（無改変）。技14枚 `tsumuji_sk_NN.webp`（幅 827）・正式モンスターカード `tsumuji_official.webp`（幅 508）・バトル用 `tsumuji_battlecard.png`（無改変）
- 枠：モンスターカード `frame_tsumuji.png`（`battle_card_frame.py … tsumuji=#8FA3B8`。フルーネの枠を作り直すと前と同じバイト列）・技カード `frame_normal_tsumuji.webp`・`frame_hand_tsumuji.webp`（`npm run art:skillframes`。ほかの枠は変わっていない）
- 対戦のアイコンの切り抜き（`monsterPortraits.ts`）：とびかかる形で顔が絵の下のほう `x 0.58・y 0.66・zoom 1.6`
- 英語は仮訳（Double Scratch・Whirlwind・Wind Ride・Wind Reading など。`contentEnOfficialDraft.ts`）
- カードに書く短い文（`skillCardText.ts`。指示書の TSUMUJI_CARD_TEXT）。大きなカードで2行に収まる。
  「Wひっかき」の文は「W｜ひっかき」と語の途中で切れていたので、`phraseText.ts` の切らない語に「Wひっかき」を足し、日本語の文の中の英字の大文字の幅の目安を少し広くした（ほかのカードの文には英字の大文字が無いので変わらない）
- 技の絵の横の位置：14枚を大きなカード・手札で見て、顔・見せ場の切れるものは無かった（10 も頭がマナの丸にかからない）。どれも真ん中（50）のまま
- 新しい決まり（Wひっかき・かぜのり・かぜよみ）と CPU：`docs/battle-rules.md`「ツムジの効果の扱い」
  - 対戦の画面：かぜのりが効いている間はツムジにおいかぜと同じ風の印、自分の手札の攻撃技のマナの数字を −1 にして緑で見せる。Wひっかきの1回目のあと、続けて使えるうちはツムジに「行動済み」を出さない

## 4. 入手・ガチャ・ショップ・大会

- 初回クリア：最奥の祭壇でツムジのモンスターカード1枚。2回目から：ツムジの技カード1枚（`trumpReward`）。宝箱の技カードもツムジの技
- ゼフィラに初めて勝った記録 `zephyra-beaten`（`ZEPHYRA_BEATEN_FLAG`）
- `GACHA_SERIES` にセレフィーンのあと1行（レア枠 かまいたち・ストームブレイド・かぜよみ）。値段・確率はほかと同じ。ツムジのカードを受け取ると並ぶ（今のシリーズの開き方）
- パック：`pack_tsumuji.png` → `pack_tsumuji.webp`（`gacha_series_build.py`）。販売機の窓 `panel_tsumuji.webp`（`gacha_panel_build.py`。顔の位置だけ足した）。`pack_tint.py` の COLORS に1行
- ショップの棚：`shop_goods_20261030.py` の MONSTERS に tsumuji（11種類）。街を作り直して、変わったのはカードショップの家具の絵7枚だけ（位置・大きさは前と同じ）
- 大会：`RANK_BOSS_DUNGEONS.D` に風の渓谷（水の神殿・風の渓谷）。受付の理由・掲示板の条件の文にも出る。C から上の条件は変わらない（前のセーブでも今いるランクの大会に出られることをテストで確かめた）

## 道具

- `tools/e2e/wind_valley_shot.cjs`：ダンジョンを選ぶ所・入るときの絵・風のマス・ニコ・ゼフィラ・祭壇
- `tools/e2e/tsumuji_battle_shot.cjs`：Wひっかきを2回続けて・かぜのり（開発用サーバー）
- `card_detail_shot.cjs`・`people_book_shot.cjs` に W・H・LANG、`gacha_shot.cjs` に `last`（最後に並んだシリーズ）を足した

## 気になった点（今回は直していない）

- ダンジョンの地図で、人のすぐ上のマスに宝箱があると、宝箱が人の頭の上に重なって見える（置いたものの重なりの順が、高さではなく置いた順のため。どのダンジョンでも同じ）

## 未完了

- iPhone 実機での確認
