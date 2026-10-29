# フルーネの最終（新モンスター制作の手順 8）（2026-10-29）

ユーザー指示（チャット）。ZIP「Mistral_Flune_Final_Part1・Part2_20261029」の指示書 `design-parts/cards-original/flune/00_instructions_for_claude_code.txt` のとおり。
試遊（手順 4）はユーザーの判断でしていない。数字は JSON（`src/data/official/flune14_skills_OFFICIAL_20261029.json`）のまま。

## 1. フルーネを正式に

- `mon-flune`・`skl-flune-01〜14` をふつうの一覧（`MONSTERS`・`SKILLS`）に。図鑑の番号はジオルのあと（No.121〜135。`cardNumbers.ts`）
- ライフ 10・内部ランク C（画面に出さない）・若葉色 `#9CBF5A`。データは `src/data/flune.ts`
- 絵：原本は `design-parts/cards-original/flune/`（無改変）。技14枚 `flune_sk_NN.webp`（幅 827）・正式モンスターカード `flune_official.webp`（幅 508）・バトル用 `flune_battlecard.png`（無改変）
- 枠：モンスターカード `frame_flune.png`（`tools/art/battle_card_frame.py … flune=#9CBF5A`）・技カード `frame_normal_flune.webp`・`frame_hand_flune.webp`（`npm run art:skillframes` の色の表に1行）。ほかの枠は変わっていない
- 英語は仮訳（`contentEnOfficialDraft.ts`）
- カードに書く短い文：`src/data/skillCardText.ts`（ジオルの GEOL_CARD_TEXT と同じく、ここにまとめた。JSON の文は変えない）

  | 技 | 文 |
  | --- | --- |
  | 07 かふん | 相手のマナを1減らす |
  | 09 フラワードレイン | 与えたダメージぶん、自分のライフを回復 |
  | 10 いやしのみつ | 味方1体のライフを2回復 |
  | 11 はっぱのたて | ちから技に効く |
  | 12 はなびらのまく | かしこさ技に効く |
  | 13 つるのかべ | ちから技・かしこさ技に効く |
  | 14 はっぱにかくれる | ちから技を回避（JSON のまま） |

- 技の絵の横の位置：14枚を大きなカード・手札で見て、顔・見せ場の切れるものは無かった。どれも真ん中（50）のまま（`skillArtPosition.ts` は変えていない）
- 研究所の図鑑の研究員の文「正式カードは…」にフルーネを足した

## 2. 新しい効果

`docs/battle-rules.md`「フルーネの効果の扱い」。

- 09 フラワードレイン：攻撃のあと、相手のライフが**実際に減った量**だけ回復（`drain`。`engine.ts` の drainHeal）。防御・しめったはだのあとの量、倒しすぎた分は入らない、回避されたら0、最大ライフ（lifeScale 込み）まで
- 10 いやしのみつ：味方1体（フルーネも可）を2回復（`healAlly`）。倒れた味方は選べない。対象を選ぶ画面はおいかぜと同じ形
- 07 かふん：くしゃみと同じ `manaDrain: 1`
- 相手の CPU：フラワードレイン（倒せるとき・フルーネが2以上減っているとき）・いやしのみつ（倒せる攻撃が無く、味方が2以上減っているとき。いちばん倒れそうな味方）・かふん（ふつうの攻撃）

## 3. 精霊の森・入手の流れ

- セラのデッキ：ラズック・フルーネ・ソラモ（lifeScale 0.85 のまま。フルーネは 9 になる）
- 初回クリア：最奥の祭壇でフルーネのモンスターカード1枚（技カードは出さない）。2回目から：フルーネの技カード1枚（`trumpReward`）。宝箱の技カードもフルーネの技
- 初めて勝った記録 `sera-beaten`（`SERA_BEATEN_FLAG`）。前に森をクリアしたセーブは読み込むと付く
- **セーブ version 25**：仮フルーネ（`mon-tmp-flune`・`skl-tmp-flune-1〜6`）を外した。モンスターカードは同じ枚数の `mon-flune` に、技カードは消す（デッキ・名刺図鑑・挑戦中の獲得も）。古いバックアップでも止めない（`REMOVED_CARD_IDS`）
- tmp-flune を使っていた所：精霊の森のボス（セラ）の編成と初回クリアのカード（`dungeons.ts`）だけ。どちらも mon-flune にした。ほか（大会・バトラー・テスト用チーム）には無かった。テスト4つ（dungeonPeople・moneyIncome・progress・dungeonRun）は新しい形に直した

## 4. ガチャのシリーズとショップ

- `GACHA_SERIES` にジオルのあと1行（レア枠フラワードレイン・`sera-beaten` のあと）。150G・5枚・モンスター5％・レアはノーマルの4分の1（ほかと同じ）
- パック：`pack_flune.png`（`design-parts/gacha-20261029/art/`）を `gacha_series_build.py` で `pack_flune.webp` に。`pack_tint.py` の COLORS に `'flune': '#9CBF5A'`
- ショップの棚：`shop_goods_20261029.py` の MONSTERS に flune（9種類）。棚・ショーケースの絵7枚を作り直した（位置・大きさは前と同じ）

## 道具

- `tools/e2e/flune_battle_shot.cjs`：対戦の画面でいやしのみつ・フラワードレインを撮る（開発用サーバー）

## 未完了

- iPhone 実機での確認（セラの強さはユーザーが確かめる）
