# セレフィーンの最終（新モンスター制作の手順 8）（2026-10-29）

ユーザー指示（チャット）。ZIP「Mistral_Serephine_Final_Part1・Part2_20261029」の指示書 `design-parts/cards-original/serephine/00_instructions_for_claude_code.txt` のとおり。
試遊（手順 4）はユーザーの判断でしていない。数字は JSON（`src/data/official/serephine14_skills_OFFICIAL_20261029.json`）のまま。フルーネの最終（`docs/flune-final-20261029.md`）と同じ形。

## 1. セレフィーンを正式に

- `mon-serephine`・`skl-serephine-01〜14` をふつうの一覧（`MONSTERS`・`SKILLS`）に。図鑑の番号はフルーネのあと（No.136〜150。`cardNumbers.ts`。隠しモンスターは No.151 から）
- ライフ 6・内部ランク C（画面に出さない）・月の青紫 `#8FA6E8`。データは `src/data/serephine.ts`
- 絵：原本は `design-parts/cards-original/serephine/`（無改変）。技14枚 `serephine_sk_NN.webp`（幅 827）・正式モンスターカード `serephine_official.webp`（幅 508）・バトル用 `serephine_battlecard.png`（無改変）
- 枠：モンスターカード `frame_serephine.png`（`tools/art/battle_card_frame.py … serephine=#8FA6E8`。フルーネの枠を作り直すと前と同じバイト列）・
  技カード `frame_normal_serephine.webp`・`frame_hand_serephine.webp`（`npm run art:skillframes` の色の表に1行）。ほかの枠は変わっていない
- 対戦のアイコンの切り抜き（`monsterPortraits.ts`）：顔が絵の上のほうなので `x 0.5・y 0.22・zoom 1.9`
- 英語は仮訳（`contentEnOfficialDraft.ts`。名前は Serephine）
- カードに書く短い文（`skillCardText.ts`。指示書の表のとおり。05・07「回避されない」は JSON の文のまま）。
  大きなカード（幅 176）で、どれもいちばん大きな字（4.6cqw）のまま2行以内。14 ウェーブダンスの改行は「ちから｜技」で、ソラモの星影ステップ・ガウルの高速飛行と同じ（同じ文）
- 技の絵の横の位置：14枚を大きなカード・手札で見て、顔・見せ場の切れるものは無かった。どれも真ん中（50）のまま（`skillArtPosition.ts` は変えていない）
- 研究所の図鑑の研究員の文「正式カードは…」にセレフィーンを足した

## 2. 効果の扱い

`docs/battle-rules.md`「セレフィーンの効果の扱い」。新しい仕組みは作らず、今ある仕組みを使った。

- 05 なみ打ち・07 アクアニードル：今の「回避されない」（undodgeable）
- 10 みちしお：今の「山札の上からマナ」（mana）に、動かす枚数（amount 1）を持たせた。山札が足りなければ使えない（「山札がありません」）
- 11 ミストヴェール：ちから・かしこさ −2。12：ちから技を回避。13：かしこさ技だけを回避（今の回避の「効く種類」のまま足せた）。14：両方を回避
- 相手の CPU：みちしお（`ai.ts` の chooseTide）。ほかは今の思考のまま

## 3. 水の神殿・入手の流れ

- ルシアのデッキ：カルシェル・セレフィーン・ミュロル（ソラモを外した）。lifeScale 1.2 のまま（セレフィーンは 7 になる）
- 初回クリア：最奥の祭壇でセレフィーンのモンスターカード1枚（前はミュロルと技3枚）。2回目から：セレフィーンの技カード1枚（`trumpReward`）。宝箱の技カードもセレフィーンの技
- 初めて勝った記録 `lucia-beaten`（`LUCIA_BEATEN_FLAG`）。前に水の神殿をクリアしたセーブは読み込むと付く（`withBossFlags`）
- **セーブ version 26**：前に水の神殿をクリアしていて、セレフィーンのモンスターカードを持っていないセーブに「祭壇でまだ受け取っていない」記録（`lucia-altar-owed`）を付ける。
  次にルシアに勝ったとき、初めてのクリアと同じく祭壇でセレフィーンを受け取り（技カードは出さない）、記録を消す（`DungeonDefinition.altarOwedFlag`）
- 水の神殿のバトラー・見えない番人のチームは今のまま

## 4. ガチャのシリーズとショップ

- `GACHA_SERIES` にフルーネのあと1行（レア枠 アクアニードル・オーシャンウェーブ・ウェーブダンス・`lucia-beaten` のあと）。値段・確率はほかと同じ
- パック：`pack_serephine.png` を `gacha_series_build.py` で `pack_serephine.webp` に（ほかのパックは変わっていない）。`pack_tint.py` の COLORS に `'serephine': '#8FA6E8'`
- ショップの棚：`shop_goods_20261029.py` の MONSTERS に serephine（10種類）。棚・ショーケースの絵7枚を作り直した（位置・大きさは前と同じ）

## 道具

- `tools/e2e/serephine_battle_shot.cjs`：対戦の画面でみちしお・ゆらりとかわすを撮る（開発用サーバー）
- `tools/e2e/album_shot.cjs`：図鑑の好きな番号の区切りを撮る

## 未完了

- iPhone 実機での確認
