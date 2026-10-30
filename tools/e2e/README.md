# ブラウザでの通し確認（E2E）

Playwright で実際の画面を操作して、最小縦断体験を確認するスクリプトです。
npm の依存には入れていません（CI では実行しません）。手元で確認するときだけ使います。

| スクリプト | 内容 |
| --- | --- |
| `flow.cjs` | 新規開始 → 家（デッキ・図鑑・ベッド）→ 欠片 → ショップ（一覧・提供割合・ガチャ・二重タップ）→ ダンジョン B1〜B3 ボス → 大会 → 景品 → 再読み込みで復帰。バトルは QA 用のオート（AI が実際に対戦）で進める |
| `flow2.cjs` | 人の操作でのバトル（拡大表示・対象選択・防御・使用不可）、大会初優勝の景品と二重受け取り防止、欠片10個目と特別復元、375×667 / 390×844 / 430×932 での画面はみ出し確認 |
| `flune_battle_shot.cjs` | フルーネのいやしのみつ・フラワードレインを対戦の画面で撮る（撮影のときだけ対戦の始まりを置きかえる。2026-10-29） |
| `serephine_battle_shot.cjs` | セレフィーンのみちしお・相手のゆらりとかわすを対戦の画面で撮る（flune_battle_shot.cjs と同じ作り。2026-10-29） |
| `album_shot.cjs` | 研究所の図鑑を開き、図鑑の番号の区切り（15枚）までスクロールして撮る（2026-10-29） |
| `town_shot.cjs`・`town_doors.cjs` | 街・部屋の好きな場所の写真／11か所の入口を全部ためす（2026-10-28 街の作り直し） |
| `dungeon_people_shot.cjs` | ダンジョンのボス・バトラーの地図・話しかけた窓・対戦のひと言・守り手に勝ったあと（2026-10-28 ダンジョンの人物12人） |
| `people_book_shot.cjs` | 名刺図鑑の全ページと1人の大きな名刺 |
| `calendar_shot.cjs` | カレンダー（2026-10-30）：街の左上の日付・ベッドの「寝る」の流れ（季節の挿絵あり・なし）・大会の受付で断られる・掲示板・帰還の羽根でダンジョンから戻る。`before` で前の版 |
| `intro.cjs` | 序盤イベント：新規開始（家の中）→ 街に出て声かけ → 練習場へ → 練習試合（ヒント）→ 対戦後 → 後日の再開。2つ目の流れで「あとで」・話しかけて誘い直し・スキップ・練習テーブル（英語表示・女性主人公）。約1分半 |

## 使い方

```bash
npm run build
npx vite preview --port 4173 &
# Playwright を別途用意して、そのパスを PLAYWRIGHT_MODULE に渡す（例：グローバルにインストールした場合）
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright E2E_OUT=/tmp/e2e node tools/e2e/flow.cjs http://127.0.0.1:4173/
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright E2E_OUT=/tmp/e2e node tools/e2e/flow2.cjs http://127.0.0.1:4173/
```

スクリーンショットは `E2E_OUT` に保存されます。URL に `?qa=1` を付けると QA 用ボタン（オート・即勝利・所持金追加など）が出ます。

## 2026-10-28 街の確認の道具（いま動く）

- `town_shot.cjs`：街・部屋の好きな場所の画面写真（390×844）。使い方はファイルの先頭
- `town_doors.cjs`：街の11か所の入口を全部ためす（入る → 部屋 → 外へ → 扉の前に戻ったか）
- どちらもセーブの JSON が要る（`docs/handoff.md`「画面写真の撮り方」）

## 2026-10-28 夜〜深夜に足した道具（いま動く。Playwright は `NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node` で動かす）

| スクリプト | 内容 |
| --- | --- |
| `exam_shot.cjs` | 導入の試験の対戦（手で操作／QA オートで合格まで／即敗北→再挑戦） |
| `screen_steps.cjs` | 調べる→手順（押す・なぞる・遅くする・連写）を JSON で渡して撮る。ガチャ・デッキ編集 |
| `hand_shot.cjs` | 手札の大きさ（手札5/7/10枚・印・大きなカード）。390×844 と 375×667 |
| `money_shot.cjs` | ダンジョンの宝箱3通り・バトラーに勝った報酬・ボス初回クリア |
| `pukarim_lab_shot.cjs`・`pukarim_effects_shot.cjs` | プカリムの試遊の画面と、新しい効果（おいかぜ・ためている・ぷはーっ） |

- どれもセーブの JSON が要る（Vitest の一時テスト `tests/zz-*.test.ts` で作って、終わったら消す）
- 対戦中の確認の窓（「まだ使えるカードがあります…」）は `.modal` ではないので、ボタンの文字（マナ化へ進む）で押す
- 手札が多すぎる（12枚以上）と列が画面からはみ出し、ボタンが押しにくくなる

## 2026-10-28 名前・取得カード・ボタンの音・手札の上限（いま動く。`docs/name-cardlist-uisound.md`）

| スクリプト | 内容 |
| --- | --- |
| `name_shot.cjs` | 最初から → 主人公 → 名前の窓（入力前・キーボードが出たとき・「○○ でいい？」・はい）。キーボードは visualViewport をまねて灰色の板を重ねる（`KB_RATIO=0.58` で高いキーボード）。鳴った音も書き出す |
| `name_resume_shot.cjs` | 名前の無い前のセーブで「続きから」→ 名前の窓は1回だけ |
| `name_places_shot.cjs` | 8文字の名前が出る所（VS・大会の受付・総当たり表・壁の板・トーナメント表・名刺図鑑）。セーブは名前入りの exam/league/bracket/home_N.json |
| `card_list_shot.cjs` | 管理局で箱を選ぶ → 取得カード（一覧・行を押す・スクロール・閉じる）。セーブは introV2.state 'packSelection' |
| `hand_full_shot.cjs` | 試験の対戦（?qa=1）で手札10枚から「2枚引く」を使い、「手札がいっぱい」の記録を撮る |
| `se_probe.cjs` | いくつかのボタンを押して、鳴った音の名前を書き出す |

## 2026-10-29 ジオルの試遊（`docs/geol.md`）

- `geol_shot.cjs URL セーブ.json 出力`：`?qa=1&lab=geol` の確認用の画面（カード15枚）と、効果を確かめる用どうしの QA:オート の対戦（地ひびきが出た所）
- `geol_effects_shot.cjs URL セーブ.json 出力`：自分で エネルギーをためる（場の「ためている」の印）・地ひびき・相手の攻撃を かばう を使って撮る（`DEBUG=1` で使う前後の写真も）
- 技カードの大きな絵：`card_gallery_shot.cjs`（開発用サーバー）に `skl-geol-01`〜`14`

## 2026-10-30 風の渓谷とツムジ（指示書 U。`docs/wind-valley-u-20261030.md`）

| スクリプト | 内容 |
| --- | --- |
| `wind_valley_shot.cjs` | ダンジョンを選ぶ所（街の南の出口から）・入るときの絵と題字・風のマス（押し流される前・途中・あと）・ニコ・ゼフィラ（話しかける・対戦・QA 即勝利・勝ったあとのひと言・祭壇）。W・H・LANG・ONLY |
| `tsumuji_battle_shot.cjs` | Wひっかきを2回続けて・かぜのりを使う・かぜのりが効いている手番（手札のマナ −1 が緑）。開発用サーバー |

- セーブは Vitest の一時テストで作る（`base.json`：D ランク・物語の導入は終わり〔`story.introV2.state` を 'completed`〕・名前入り）。終わったら一時テストは消す
- `card_detail_shot.cjs`・`people_book_shot.cjs` は W・H・LANG=en に対応した。`gacha_shot.cjs` はパックの番号に `last`（最後に並んだシリーズ）

## 2026-10-30 デッキ・ガチャ・ボス・重なり（指示書 V。`docs/deck-gacha-boss-v-20261030.md`）

| スクリプト | 内容 |
| --- | --- |
| `save_shot.cjs` | セーブを入れて「続きから」→ キーを押して撮る（ダンジョンの宝箱と人の重なりの前後・メニューの案内・大会受付など）。キーは `z`・`Enter`・`wait:ミリ秒`・`click:セレクタ`（街では `click:.world__action`）。W・H・LANG・WAIT・CROP |
| `deck_dup_shot.cjs` | 家の机（`{home,8,17,left}`）→ デッキ編集 → モンスターを選ぶ → もうデッキにいるモンスターを押す（入れられない理由）。MENU=1 で最初のメニュー、ISSUES=1 で問題の一覧。W・H・LANG |
| `gacha_owned_shot.cjs` | 販売機の前でパックを選ぶ所・提供割合・シリーズを買ったときの中身の15枠（持っているモンスターは絵、持っていないものは ?）。W・H・LANG |

- 見る前（直す前）の版は、`git worktree add` で前の main を作り、`vite build --outDir` して別のポート（例 4177）で `vite preview --outDir` する

## 2026-10-30 ヒョウズク（指示書 W。`docs/hyouzuku-w-20261030.md`）

| スクリプト | 内容 |
| --- | --- |
| `hyouzuku_battle_shot.cjs` | ふぶきが当たって相手が行動不可・こちらのヒョウズクが凍らされた手番（押すと理由）・こおりわり。開発用サーバー。W・H・LANG |

- 祭壇（初回・前のセーブ）は `dungeon_people_shot.cjs URL フォルダ 出力 win`（フォルダに `boss_dungeon-04.json`。前のセーブは version 29・氷の洞窟クリア済み）
- 撮影用のセーブで導入を終わらせるには `story.introV2` の `state: 'completed'` に加えて `examPassed`・`selectedBoosterKey`・`boosterClaimed`・`boosterGranted`・`tutorialCompleted` も入れる（入れないと練習場の試験に戻る）

## 2026-10-30 部屋3つ・状態の印・噴水（指示書 X。`docs/rooms-status-fountain-x-20261030.md`）

| スクリプト | 内容 |
| --- | --- |
| `status_marks_shot.cjs` | 対戦の画面に状態の印4つ（凍った・まきつく・エネルギー・回避できない）を付けて撮る。開発用サーバー。W・H・LANG |
| `support_y_shot.cjs` | サポート11種類（2026-10-30 指示書 Y）：手札・投石の対象えらび／防御／回避・思い出の箱と風まかせのえらぶ窓・霧の香・声援の印・守りの陣で下がった手札・熱気・記録。開発用サーバー。LANG・ONLY |
| `cpu_skill_z_shot.cjs` | 指示書 Z（2026-10-30）：サポートの絵が入った手札・ヒョウズクの技とサポートが並んだ手札・腕前 C の CPU の記録（守りそこねた・迷っている。撮影のときだけ割合を 1 にする）。開発用サーバー。LANG・ONLY |

- 部屋の写真は `town_shot.cjs`（場所は `{bureau,30,30,up}`・受付の前 `{bureau,30,19,up}`・掲示板の右 `{bureau,16,19,left}`・大会会場の受付の前 `{hall,49,29,up}`）。
  調べた所は `save_shot.cjs セーブ 出力 click:.world__action`（部屋でも z キーは効かない）
