# 引き継ぎメモ（2026-10-30 夜：H〜N のセッション終わり・次のセッションへの引き継ぎ用）

新しいセッションで読むのは `CLAUDE.md` とこのファイルだけ。他の資料は必要になったときに1つずつ読む。

## 0. 次のセッションへ

### まず読む：いまの状態（2026-10-30 夜 H〜N のセッション終わり）

- **公開中：`main`（N まで）**。**セーブ version 28**（K で上げた）。テスト 877件。**H〜N をまとめた作業報告書の ZIP で報告ずみ・返事待ち**
- 作業ブランチ `claude/parts-bgm-panel-20261030`（と M・N を作った `claude/prologue-shop-20261030`）は main に取り込み済み。新しい作業は新しいブランチで
- 夜の作業（ユーザーは寝ている間。質問で止まらず、迷ったら安全なほう。記録 `docs/night-20261030.md`）
  | # | 内容 |
  | --- | --- |
  | K | ガチャのシリーズの開く条件：最初は管理局で選んだ箱の3体だけ・ほかはそのモンスターのモンスターカードを初めて手に入れたら開く（NEW）。スキップした・前のセーブは6つ。セーブ v28（前のセーブで並んでいたシリーズは閉じない） |
  | L | 通しで遊んで点検（手伝いの係3つ）。止まる不具合なし。見た目・押しにくさ14件を直して公開。判断が要ること・絵が要ることは記録の一覧 |
  | M | プロローグ（「最初から」→ 挿絵2枚と Shy Love → 主人公の選択）。`src/ui/screens/prologueScreen.ts` |
  | N | カードショップの店の中を正面向きの絵に（床と壁・家具10枚・商品の絵を焼きこみ・当たり・植木2つ・店員の位置） |
- **判断待ち**（記録の L の「判断が要ること」）：大会会場の中の曲・375×667 の小さい画面のボタン・試験の勝ちの記録の時・場面の立ち位置の重なり など。
  M：主人公の選択の画面の曲はタイトルの曲のまま。N：床の光の筋・奥の棚の色の差（報告だけ）
- **未完了**：iPhone 実機での確認（H〜N すべて）。部屋の家具の描き直しは、カードショップのつぎの部屋の絵を待つ

### その前（2026-10-30 H〜J のセッション終わり）

- **公開中：`main`（J まで）**。セーブ version 27（変えていない）。テスト 870件。報告ずみ（A〜G・H〜J は合格）
- A〜G はユーザー合格。作業ブランチ `claude/parts-bgm-panel-20261030` は main に取り込み済み。新しい作業は新しいブランチで
- このセッションでしたこと（ZIP「Mistral_Parts_BGM_Panel_ClaudeCode_20261030」の指示書。H・I・J の順に main に取り込んで公開。記録 `docs/parts-bgm-panel-20261030.md`）
  | # | 内容 |
  | --- | --- |
  | H | 正面向きの街の部品14枚（原本 `design-parts/town-20261028/front-facing-20261030/`）。石の橋は左右の半分に切り分けて床の幅を南の大通り（512）に・床は街の石畳。外していたベンチ・排水溝・木箱・花壇を戻した（`ANGLE_OFF` は空）。屋台・大工の小屋・階段も。一覧 `docs/angle-audit-20261029.md` |
  | I | BGM：タイトル「異世界へようこそ」・管理局「白銀の城」（`ROOM_BGM` に bureau）・プロローグ「Shy Love」は保存だけ。前のタイトル曲は `bgm_departure.mp3`。`docs/audio-credits.md` |
  | J | 販売機の窓を絵のパネルに（`tools/design/gacha_panel_build.py`。店の中は 3×2、ガチャの画面は選んだシリーズの1枚）。ガラス（machine_glass）と窓の中のパックはやめた |
- **決定（2026-10-30 ユーザー）**：部屋の家具は**床と壁も含めて正面向きに描き直す。まずカードショップから**（デザイン担当に依頼中）。**絵が届くまで今の家具はそのまま**（`docs/angle-audit-20261029.md` 3章）
- **未完了・判断待ち**：石の橋の大きさ（塔の倍率 1.0。下の注）の見え方・iPhone 実機での確認・プロローグ（「Shy Love」と絵2枚）はまだ作っていない
  - 石の橋の注：絵ごと床を 512 にすると橋が約2000の長さになって入らないので、左右の半分を離して置いた。塔をもっと大きくしたいときは `BRIDGE_STONE['s']` だが、北の塔が北の十字路（ピート・ハロルドの家の前の道）にかかる
- 作業のこつ（このセッションで分かったこと）
  - 公開ページの写真（前の版）は読みこみが遅いので、`town_shot.cjs` の撮る場所に `"wait":8000` を入れる
  - 街だけの確認なら、`seimon_world_build` の `shade_building` と `town2026_build.build_town(shade, 確認の絵のフォルダ)` を呼ぶ小さなスクリプトで約4分（`town2_full.jpg`・`town2_grid.jpg` が出る。`worldArt.generated.ts` は書かない）
  - BGM のループ：`find_loop.py` の結果に加え、テンポ（拍の長さ）を調べて小節の切れ目に合う長さを選んだ。音量は `ffmpeg -af ebur128`
  - `git mv` したファイルは `git add` しなくても次のコミットに入る（H のコミットに混ざりかけた）

### その前（2026-10-29 深夜 E〜G のセッション終わり）

- **公開中：`main`（G まで）**。セーブ version 27。テスト 870件。**次の指示を待っている**
- A〜D・E〜G はユーザー合格（E〜G の返事は「OK」）。作業ブランチ `claude/fixes-20261029-late` は main に取り込み済み。新しい作業は新しいブランチで
- このセッションでしたこと（ZIP「Mistral_Fixes_20261029_late」の指示書。どれも main・公開済み。記録 `docs/fixes-20261029-night.md` の「E〜G」）
  | # | 内容 |
  | --- | --- |
  | E | 店の中の販売機を、ガチャの画面の機械の絵（900×1300 の6枚）から作った（`cardshop_v2.py` の `_gacha_machine`。当たり・名札・光の床を合わせた）。依頼文 09 は使わない |
  | F | 人と主人公が横に並ぶと半分重なった → 人のまわりの通れない範囲をよこ2マス（たて1マス）、話せる範囲をよこ3マス（たて2マス）に（`worldScreen.ts` の `NPC_SPACE`・`NPC_TALK_RANGE`、`world.ts` の `inReach`） |
  | G | 部屋の家具は外さない（描き直しに決定。絵が届くまで今のまま）。部屋の依頼文は進行のチャットで決めてから（`docs/angle-audit-20261029.md` 3章） |
- **未完了・判断待ち**：部屋の家具の描き直しの範囲（進行のチャット）・屋台・大工の小屋・石の橋・階段などの新しい絵（依頼文 `docs/design-requests-20261030/`）・iPhone 実機での確認
- 公開のしかた：`gh` は使えない（ログインできない）。`git fetch origin main && git checkout -B deploy-main origin/main && git merge --no-ff 作業ブランチ` → `git push origin deploy-main:main` →
  GitHub の道具（MCP）の actions_run_trigger で `deploy-pages.yml` を main で動かす → 公開ページの `static/index-*.js` に変更が入ったかを curl で確かめる
- 作業環境のこつ（このセッションで分かったこと）
  - セッションを再開すると `vite preview` が止まっている。撮影の前に `npx vite preview --port 4173 --host 127.0.0.1` を起こし直す（`npm run check` で dist も作り直される）
  - 街・部屋の作り直し（`python3 -I tools/design/seimon_world_build.py design-parts/seimon-world`）は約5分。待つときに `pgrep -f seimon_world_build` を until で使うと自分自身に当たって終わらない（`run_in_background` の終わりの知らせを待つ）
  - カードショップの家具の絵だけなら `python3 -I -c "import sys; sys.path.insert(0,'tools/design'); import cardshop_v2; cardshop_v2.build_shop_room()"` で速い（当たり・位置を変えたら全部の作り直しが要る）
  - 撮影用のセーブ：`tests/zz-*.test.ts` で `createNewSave` を JSON に書き出す（`player.name` を入れないと名前の入力で止まる・`story.intro: 'skipped'`・`introV2: LEGACY_INTRO_V2`）。
    v26 のままのセーブを読むと v27 の変換でガチャの NEW が消えるので、NEW を撮るときは `version: 27` にする
  - 写真：街・部屋 `tools/e2e/town_shot.cjs`（keys で歩かせる・`qa` と `qs:"&hit=1"` で当たり）、ピート `tools/e2e/pete_shot.cjs`（勝負の前のひと言も撮る）、ガチャ `tools/e2e/gacha_shot.cjs`（`g-03-landed` が取り出し口）
  - 外した街の小物は `town2026_build.py` の `ANGLE_OFF`。新しい絵が届いたら `PROP_PARTS` を替えて名前を外すだけで、もとの置き場所に戻る（使わなくなった `t2_bench*.webp` などは消した。作り直しでまたできる）
  - 報告の写真・ZIP はスクラッチに作った（git に入れない・新しいセッションには無い）

### その前（2026-10-29 夜 A〜D のセッション終わり）

- **公開中：`main`（D 絵の角度の点検まで）**。セーブ version 27。テスト 870件。**作業報告書の ZIP で報告ずみ・返事待ち**
- 作業ブランチ `claude/fixes-20261029-night` は main に取り込み済み。新しい作業は新しいブランチで
- ユーザー合格：⑯ セレフィーン。⑰ 木の橋は iPhone で「長すぎ」→ A で直した
- このセッションでしたこと（ZIP「Mistral_Fixes_20261029_night」の指示書。どれも main・公開済み。まとめ `docs/fixes-20261029-night.md`）
  | # | 内容 | 記録 |
  | --- | --- | --- |
  | A | 木の橋を短く（真ん中の板を抜いた版 `wood_bridge_front_short.png`・柱を両岸の石垣のすぐ外・南の小道の幅を板にそろえる・北に短い小道） | `docs/wood-bridge-20261029.md` の「2回目」 |
  | B | ソラモのパックの絵を差し替え（前の絵は `_v1`・`art_v1/`） | `docs/packart8-20261029.md` の最後 |
  | C | 飾りのカードの比・取り出し口のパック・販売機の名札と当たり・ショップのメニュー・ピートの台詞（ユーザーの文）とガチャの NEW（セーブ v27）・ちから技／かしこさ技の改行 | `docs/fixes-20261029-night.md` |
  | D | 絵の角度の点検の一覧・ななめの小物を外した（ベンチ7・排水溝2・木箱2・四角い花壇5。`town2026_build.py` の `ANGLE_OFF`）・依頼文 | `docs/angle-audit-20261029.md`・`docs/design-requests-20261030/` |
- **未完了・判断待ち**
  - 部屋の家具のななめの物（左右の壁ぞいの棚・ベンチなど。部屋の床と壁の絵そのものが遠近の作り）：外すとカードショップがほとんど空になるので、**外していない。外すかユーザーの判断待ち**（一覧 `docs/angle-audit-20261029.md` 3章）
  - 屋台3つ・大工の小屋・石の橋・高台の階段：ななめだが、外すと商店街が空・建物・道なので残した（依頼文あり）。新しい絵が届いたら替える
  - 効果の文：「ちから技」「かしこさ技」を切らないかわりに、10枚が少し小さい字（4.6→4.3cqw。2行には入る）
  - iPhone 実機での確認（この日の作業すべて）・てっぺきシェルの顔の位置・手札のマナの球と分類の札の高さ（前から。今のまま）
- 公開のしかた（このセッション）：`gh` が使えなかったので、GitHub の道具（MCP）の actions_run_trigger で `deploy-pages.yml` を main で動かした

### その前（2026-10-29 ⑯⑰ のセッション終わり）

- **公開中：`main`（⑰ 木の橋まで。公開ページで確認済み）**。セーブ version 26。テスト 865件。**次の指示を待っている**
- 作業ブランチ `claude/claude-md-handoff-review-3lzll0` は main に取り込み済み。新しい作業は新しいブランチで
- ユーザー合格：①〜⑮ すべて（⑦ 効果の文の短縮・⑮ 烈火の猛攻の案3 もこのセッションで合格）。⑯⑰ は報告ずみ（返事は「OK」）
- このセッションでしたこと（どれも main・公開済み）
  | # | 内容 | 記録 |
  | --- | --- | --- |
  | ⑯ | セレフィーンを正式に（水の神殿のルシアの切り札。ルシア＝カルシェル・セレフィーン・ミュロル 1.2。みちしお・かしこさ技だけの回避・ガチャのシリーズ〔lucia-beaten のあと〕・ショップの棚。セーブ v26＝前にクリアしたセーブは次に勝つと祭壇で受け取る） | `docs/serephine-final-20261029.md`・`docs/battle-rules.md`「セレフィーンの効果の扱い」 |
  | ⑰ | 街の木の橋を正面向きの新しい絵に（deskew なし・板の幅を南の小道に合わせた・前より約4マス長い・四すみの柱は前後を比べる部品） | `docs/wood-bridge-20261029.md` |
- **未完了・判断待ち**
  - iPhone 実機での確認（⑯⑰ と前の日の作業。特に「攻撃の途中で相手の正式な絵が出る」がまだ出るか・攻撃の流れの速さ）
  - てっぺきシェルの顔の位置・手札のマナの球と分類の札の高さ：**ユーザーが iPhone で見てから決める。今のまま**
  - ピートの台詞：**進行チャットが案を作る**（今の台詞は場面ごとに報告ずみ。`src/i18n/messages/story.ts` の `story.pete.*`・箱の前は住人の `story.residentB.*`。場面は `src/data/storyScenes.ts` の peteAsk など）。案が届いたら差し替え
  - 気づいたこと（直していない）：ウェーブダンス・星影ステップ・高速飛行の「マナに関係なく、ちから技・かしこさ技を回避」は大きなカードで「ちから｜技」と改行される（同じ文なので3枚とも同じ）
- 道具（このセッションで足したもの）
  - `tools/e2e/serephine_battle_shot.cjs`（対戦の画面でみちしお・ゆらりとかわす）・`tools/e2e/album_shot.cjs`（図鑑の好きな番号の区切り）
  - ボスに勝って祭壇の写真：`tools/e2e/dungeon_people_shot.cjs URL セーブのフォルダ 出力 win`（フォルダに `boss_dungeon-0N.json` だけ置く）
  - ショップの中の歩けるマスは `worldArt.generated.ts` の shop の grid で確かめる（例 (6,22)・(30,21)・(50,24)・(20,25)）
- 作業環境のこつ
  - node_modules が無いことがある：`npm ci`。テストとビルドは Node 24（`. /opt/nvm/nvm.sh && nvm install 24 && nvm use 24`）
  - 絵の道具は `pip install scipy matplotlib` が要る。街の作り直しは `python3 -I tools/design/seimon_world_build.py design-parts/seimon-world`（約4分半）
- 公開のしかた（このセッションのやり方）：`git fetch origin main && git checkout -B deploy-main origin/main && git merge --no-ff 作業ブランチ` → `git push origin deploy-main:main` →
  `gh workflow run deploy-pages.yml --ref main -R shunyamita0804-source/mistral-monsters-battle-card` → `gh run watch 番号` → 公開ページの `static/index-*.js` に変更が入ったかを確かめる
- 報告の写真はスクラッチに作ってユーザーに渡した（git に入れない・新しいセッションには無い）

### 前のセッションの終わり（2026-10-29 深夜。⑮のあと）

- **公開中：`main`（⑮ 烈火の猛攻の中身＝案3 まで。公開ページで確認済み）**。セーブ version 25。テスト 842件。**次の指示を待っている**
- 作業ブランチ `claude/claude-md-handoff-review-21ruf8` は main に取り込み済み。新しい作業は新しいブランチで
- ユーザー合格：①〜⑭ すべて（⑦ だけ合格かどうかまだ聞いていない＝下）。⑮ は「公開して」で公開（合格の返事はまだ）
- このセッション（2026-10-29 夜〜深夜）でしたこと（どれも main・公開済み）
  | # | 内容 | 記録 |
  | --- | --- | --- |
  | ⑧ | 花屋・仕立て屋の部屋（セーブ v24） | `docs/shop-rooms-20261029.md` |
  | ⑨ | フルーネを正式に（セーブ v25）・守りの文・試遊の表 | `docs/flune-final-20261029.md` |
  | ⑩ | 研究所を白い研究施設の絵（v2）に | `docs/lab-v2-20261029.md` |
  | ⑪ | セラ＝プカリム・フルーネ・ミュロル（lifeScale 0.75）・精霊の森の番人＝プカリム・ラズック・ソラモ | `docs/flune-final-20261029.md` 6章 |
  | ⑫ | ゲーム全体の点検と直し（小川の石垣・ベンチ・ショップの柱・守りは自動で進めない・攻撃の流れの順番など） | `docs/audit-20261029-night.md` |
  | ⑬ | ガチャのレア枠をどのモンスターも3つに | `docs/gacha-20261028.md` |
  | ⑭ | ラズック 6 トリックショット 2マナ2・7 シャドウバースト 3マナ4 | `docs/lazuck-numbers-20261029.md` |
  | ⑮ | 烈火の猛攻の箱の技を入れかえ（案3）。箱は資料 `booster_contents_20261029.json` から作る（`introV2.ts` の `boosterDeck`）。開けたセーブは変えない | `docs/rekka-playtest-20261029.md` |
- **未完了・返事待ち**
  - （済み 2026-10-29 ⑰）街の木の橋：新しい正面向きの絵に替えた（`docs/wood-bridge-20261029.md`）
  - iPhone 実機での確認（この日の作業すべて。特に「攻撃の途中で相手の正式な絵が出る」がまだ出るか・攻撃の流れの速さ）
  - ⑦ カードに書く効果の文を短くした件：合格かどうかまだ聞いていない（下）
  - 判断待ち（前から）：てっぺきシェルの顔の位置・手札のマナの球と分類の札の高さ・ピートの台詞など
- 作業報告書の ZIP（⑩〜⑭）はスクラッチに作ってユーザーに渡した（git に入れない・新しいセッションには無い）
- 道具（このセッションで足したもの）
  - 自動の試遊：`npm run playtest:flune`・`playtest:lazuck`・`playtest:rekka`（200回ずつ。結果は `docs/design/*/playtest_200*.json`）。試遊の対戦は `src/game/battle/flunePlaytest.ts` の `playFluneMatch`（ライフ倍率・思考の癖を付けられる）
  - 点検：`tests/walkAudit.test.ts`（街・部屋の歩ける所）・`tools/e2e/battle_audit.cjs`（オートの対戦で小さいボタン・切れた文字・重なり）・`tools/e2e/dungeon_audit.cjs`（ダンジョン7つ×種3つ×全部の階の写真）
  - 写真：`tools/e2e/town_shot.cjs`（場所は歩けるマスに。歩けないマスだと家の前に戻る）・`card_detail_shot.cjs`（開発用サーバーで）。`?qa=1&hit=1` で当たりを赤く表示
- 公開のしかた（このセッションのやり方）：ローカルの `main` は古いので使わない。`git fetch origin main && git checkout -B deploy-main origin/main && git merge --no-ff 作業ブランチ` → テスト → `git push origin deploy-main:main` →
  GitHub の Actions で `deploy-pages.yml` を main で動かす → 公開ページの JS に変更が入ったかを確かめる

### 前の部分（同じ日の夕方まで。⑦のあと）

- **公開中：`main`（⑮ 烈火の猛攻の中身＝案3 まで）**。セーブ version 25。⑧⑨はユーザー合格
- 作業中（2026-10-29 夜の指示。この順に1つずつ main・公開）：⑩ 研究所の描き直し（済み。`docs/lab-v2-20261029.md`）→ ⑪ 精霊の森の相手（済み。セラ＝プカリム・フルーネ・ミュロル・0.75、番人＝プカリム・ラズック・ソラモ。`docs/flune-final-20261029.md` 6章）→
  ⑫ ゲーム全体の点検と直し（済み。`docs/audit-20261029-night.md`。木の橋は絵の依頼文 `docs/design-requests-20261029-night/`）→
  ⑬ ガチャのレア枠を3つにそろえる（済み。`docs/gacha-20261028.md`。JSON は新しい版 pukarim…_20261029・geol…_rare3・flune…_rare3）→ ⑭ ラズックの数字（済み。6＝2マナ2・7＝3マナ4。`docs/lazuck-numbers-20261029.md`）。⑬⑭は同じ日の追加の指示。⑩〜⑭ はユーザー合格
- ⑮ 烈火の猛攻を強くする試遊（表だけ。**ゲームにはまだ入れていない**。`docs/rekka-playtest-20261029.md`・試す中身 `src/data/official/booster_contents_20261029_draft.json`）。
  ユーザーの案は目安に入らず、案3（ちょうはつ2・ダストキック2 → とびかかり2・シャドウバースト2）で 45〜55% に入った。
  **ユーザーが案3 に決定 → 作業ブランチでゲームに入れた**（箱の資料 `booster_contents_20261029.json`。開けたセーブは変えない）。main に取り込んで公開済み。**次の指示を待っている**
- ⑧ 済み：花屋・仕立て屋の中を新しい部屋に（`florist`・`tailor`。記録 `docs/shop-rooms-20261029.md`・道具 `tools/design/rooms_shop_build.py`。セーブ version 24）
- ⑨ 済み：新モンスター「フルーネ」を正式に（記録 `docs/flune-final-20261029.md`・ルール `docs/battle-rules.md`「フルーネの効果の扱い」。セーブ version 25）。
  精霊の森のセラの切り札・祭壇・ガチャのシリーズ（sera-beaten のあと）・ショップの棚・フラワードレイン（drain）・いやしのみつ（healAlly）。対戦の写真は `tools/e2e/flune_battle_shot.cjs`
  追加：守りの文（11〜14）・自動の試遊の表（`npm run playtest:flune`。記録の文書の5章）。**セラのデッキの案（今・案1・案2）はユーザーが表を見て決める。まだ変えない**
- ⑦ 済み・**返事待ち**：カードに書く効果の文を短くした（36枚。記録 `docs/card-text-short-20261029.md`。表 `src/data/skillCardText.ts`）。報告 https://claude.ai/artifact/1qLDxip2CvnDj9nRWG2W8q
  （ユーザーの返事は「ありがとう」。合格かどうかはまだ聞いていない）
  - 短い文を足す・変えるとき：`skillCardText.ts` に1行（日本語）と `contentEnOfficialDraft.ts` の英語。決まりはそのファイルの先頭と記録の文書
  - 字の大きさの確かめ方：開発用サーバーで `createPlayCard(カード, { width: 176, size: 'normal' })` を描き、`.skill-card__band-text` の style.fontSize を読む
    （いちばん大きいのは 4.6cqw。`card_gallery_shot.cjs` で写真）。手札の大きさのカードには効果の文は出ない
- 合格（ユーザー）：①〜⑥すべて
- ⑥ 済み・合格：https://claude.ai/artifact/D4E4Qhvf1j9nm6JYBA4sV7 （記録 `docs/fixes-20261029b.md`）
  - 管理局の掲示板＝右の壁の白い枠の額（立てる掲示板の絵は使わない）・カードの効果の文を文節で改行（`src/ui/phraseText.ts`。BudouX）・
    技の絵12枚の位置・街（木箱・街灯・望遠鏡・管理局の前の道のはし・大工の小屋の前・林の中の樽を消した）・世界地図の精霊の森の札
  - 研究所の植木鉢はしない（研究所の部屋は描き直しを頼んでいる）。花屋・仕立て屋の名前の札は出さない（ユーザー決定）
- 判断待ち：てっぺきシェルは指示の 40% で顔が少し右へ寄る（前から）
- **未完了**：iPhone 実機での確認（この日の作業すべて）
- 作業報告書の ZIP：`downloads/作業報告書_20261029.zip`（①〜⑤）・`downloads/作業報告書_直し7つ_20261029.zip`（⑥）。git に入れない・新しいセッションには無い
- カードの詳しい画面の写真：`tools/e2e/card_detail_shot.cjs`（開発用サーバーで）。世界地図はセーブの場所を街の南の出口 (99,192) にして下へ1歩（town_shot.cjs。精霊の森だけの地図はセーブの rank を E・unlockedDungeons を dungeon-02 だけに）
- 作業ブランチ `claude/town-fix-20261029`（⑤）・`claude/fixes-20261029b`（⑥）・`claude/card-text-short-20261029`（⑦）は main に取り込み済み。新しい作業は新しいブランチで。
- ⑥で足した部品：BudouX 0.7.0（package.json。文節の区切り。セッション開始のときに自動で入る）。
- 街と部屋を直すときのこつ（⑤・⑥）：
  - 街の物の置き場所は `tools/design/town2026_build.py` の `PROPS`（単位。32 単位＝1マス）。川は `STREAM`・橋は `BRIDGE_STONE`・東の森のあけ方は `EAST_CLEAR`・管理局の前の道のはしは `NE_CLEAR`。作り直しは約5〜8分
  - 部屋4つは `tools/design/rooms4_build.py`（家具は `furniture`・当たりは `blocks`・調べる所は `items`）。⑤で足した家具を動かす `moves` は⑥で使わなくなったので消した
  - 作り直すと中身が同じでも .webp が書きかわることがある（差分を見て、絵が同じものは元に戻すとよい）
  - 写真は `town_shot.cjs` に歩けるマスを渡す（管理局の掲示板＝右の壁の額は (53,21) で右向き・大工の小屋の左は (138,16) が使える）

- ユーザーの順番：①ジオルの最終＋太古の遺跡を初期から外す → ②パック専用の絵8つ（ZIP `Mistral_PackArt8_Part1〜3`）＋ジオルのシリーズ → ③イベントのダンジョン3つの絵（ZIP `Mistral_EventDungeons_Part1〜3`）→ ④技の絵の左右の位置（ソラモ04・カルシェル02・13）→ ⑤街と部屋の点検で見つけた所の直し → ⑥直し7つ → ⑦カードに書く効果の文を短く（一覧を2回見せて承認のあと直した）。1つずつ main に取り込み・公開・報告
- ① 済み：`docs/geol-final-20261029.md`。**セーブ version 23**（仮ジオル → mon-geol）。初期のダンジョンは精霊の森だけ・遺跡は C ランク・地下4階。説明の枠の文が切れる不具合を直した（`fitSpotTexts`）
- ② 済み：`docs/packart8-20261029.md`。パック8つ（ジオルを足した）・ショップの棚・ジオルのシリーズ（グラントに初めて勝つと開く。記録 `grant-beaten`）
- ③ 済み：`docs/design/event-dungeons3-20261029/10_受け取り結果_UTF8.txt`。イベントのダンジョン3つの絵（仮の ID event-mist-mine など。ふつうの人には出さない。?qa=1&lab=event）
- ④ 済み：`docs/skill-art-position-20261029.md`。技の絵の横の位置（`skillArtPosition.ts`）。ほかに切れていた技12枚は⑥で案の値のまま決めた
- ZIP は `/root/.claude/uploads/` にある（新しいセッションには無い）

### 前のセッション（2026-10-29 夜）の「いまの状態」

- **公開中：`main`（`f653ec8` 以降。公開ページで確認済み）**。作業ブランチ `claude/nifty-goodall-a0zbf9` は main に取り込み済み。テスト 764件。**次の指示を待っている**
- **返事待ち：ジオルの試遊の報告** https://claude.ai/artifact/LQa7h5Ayw8UnCwB9kHHuuM （ZIP は `downloads/作業報告書_ジオルの試遊_20261029.zip`。git に入れない・新しいセッションには無い）
  - 結果は**強すぎ**：ジオル入りの平均 75.6%（目安 50〜56%）・27 組すべて 60% 超え。原因の見立て＝ナックル（マナ3で5）とライフ9（試遊の中だけで、ナックルを抜く→63.2%・ライフ7→65.4%・ライフ6→57.4%）
  - **数字は変えていない**。直し方は進行チャットで決まり、次の指示（新しい JSON など）で届く見込み。届いたら JSON を差し替えて `npm run playtest:geol` をやり直し、`docs/geol.md` に表を足す
  - そのあとの予定（指示書より）：入手の流れ（グラントの切り札・最奥の祭壇・ガチャのシリーズ）は「試遊の数字が決まってから別の指示」。プカリムの最終（`docs/pukarim-final-20261029.md`）と同じ形になるはず
- このセッションでしたこと（どれも main・公開済み）
  | 内容 | ユーザー | 記録 |
  | --- | --- | --- |
  | 街の建物3つ（研究所・管理局・練習場）を正面向きに・研究所の床・大会会場の受付カウンター | 合格 | `docs/design/town-20261028/10_受け取り結果_UTF8.txt` の最後・`docs/rooms4-20261028.md` の最後 |
  | 受付の前で画面の中心をカウンターへ寄せる（はみ出すときは全体が入る所まで） | 合格 | `docs/packs7-shop-status-20261029.md` 4章（`CAMERA_LEANS`・`cameraLean.ts`） |
  | ガチャのパック7つ・ショップの棚とショーケースの商品・場の「ためている」「おいかぜ＋1」の印 | 合格 | `docs/packs7-shop-status-20261029.md` |
  | 新モンスター「ジオル」の試遊（?qa=1 の確認用の画面だけ） | **返事待ち** | `docs/geol.md`・裁定 `docs/battle-rules.md`「ジオル（試遊中）」 |
- 前の報告（返事待ちのまま）：https://claude.ai/artifact/2hJiq7gmg2XKfXLq9mx9G1 ・ https://claude.ai/artifact/DTuDzvVgaPmQubR33VUeqz
- 判断待ち（前から）：手札のマナの球と分類の札の高さ・ピートの台詞・台本の台詞・ダンジョンの人の「あなた」など（下の「前のセッション」）
- 依頼文の残り：09 ショップの棚の商品は今回のパックの縮小で入れた。プカリムのパックも新しい型で入った（`docs/design-requests-20261028/` の残りは無いはず）
- **未完了**：iPhone 実機での確認（この日の作業すべて）・ダンジョン7つと対戦の全画面の点検の続き・取得カードの画面をダンジョンの勝ち・宝箱・ガチャにつなぐ

#### ジオル（試遊中）の仕組み（次に触るとき）

- データ `src/data/geol.ts`（JSON `src/data/official/geol14_skills_DRAFT_20261029.json` を読む。原本 `design-parts/cards-original/geol/`）。`cards.ts` の `QA_MONSTERS`・`QA_SKILLS` にだけ入れている（ふつうの一覧に移すのは最終の指示で。プカリムと同じ）
- 新しい効果（`cardTypes.ts`）：攻撃の `allTargets`（地ひびき）・防御の `nullify`（うけとめる。`NULLIFY_REDUCE`）・特殊 `pin`（じならし）・`energy`（エネルギーをためる）・守り `cover`（かばう）
- エンジン（`engine.ts`）：`PendingAttack.queue`（全体攻撃の残り）・`pinned`・`coveredFrom`・`energized`、`BattleMonster.pinTurn`・`energy`、`isPinned`・`energyOf`・`coverUser`・`coverUsability`・`cover`・`nextAllTarget`
- CPU（`ai.ts`）：`chooseEnergyOrPin`・`chooseAttack`（地ひびき・じならしの相手を狙う）・`shouldCover`
- 画面：確認用の画面 `geolLabScreen.ts`（`?qa=1&lab=geol`）・場の印 `battleScreen.ts` の `cornerMarks`・カードの欄 `cardFace.ts`（かばう・0に）
- 試遊：`npm run playtest:geol`（約12秒。`src/game/battle/geolPlaytest.ts`・`tests/geolPlaytest.test.ts`。生の数字 `docs/design/geol-20261029/`）。テスト `tests/geol.test.ts`
- 写真：`tools/e2e/geol_shot.cjs`（`LAB_ONLY=1` で確認用の画面だけ）・`geol_effects_shot.cjs`（ためる・かばう・地ひびきを手で使う）・カードの見本は `card_gallery_shot.cjs`（開発用サーバー `npx vite --port 5173`）

#### 作業のしかた（このセッションでも同じ）

- 順番：指示どおり作業 → `npm run check` → main に取り込み（`git merge --no-ff`）→ push → 公開（GitHub の MCP の `actions_run_trigger`・`deploy-pages.yml`・ref `main`）
  → 公開ページの `static/index-*.js` に新しい絵のファイル名が出るまで curl で待つ（約2〜3分）→ 公開ページで写真 → 報告（Artifact のページ＋求められたら `downloads/` の ZIP を SendUserFile）
- 作業環境：Node は `export NVM_DIR=/opt/nvm; . /opt/nvm/nvm.sh; nvm install 24` のあと `export PATH=/opt/nvm/versions/node/v24.22.2/bin:$PATH`（版の番号は `node -v` で確かめる）・`npm install`・`pip install scipy matplotlib`
- Playwright：`NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node スクリプト.cjs`。プレビュー `npx vite preview --port 4173 --host 127.0.0.1` は背景で長く動かすと止まることがある（`run_in_background` の timeout を長く）
- 写真のセーブは Vitest の一時テスト `tests/zz-*.test.ts` で作って消す。`town_shot.cjs` は歩けないマスを指定すると入口に戻る（ショップは (7,21)・(17,22)・(52,20)・(5,23) が使える）
- 街と部屋の絵を作り直す：`python3 -I tools/design/seimon_world_build.py design-parts/seimon-world`（約5分）。部屋4つだけなら `python3 -I tools/design/rooms4_build.py`（数秒）
- ユーザーが「ZIP が届いていない」と言わずに指示だけ送ることがある（添付が外れる）。`/root/.claude/uploads/` に新しい ZIP が無ければ、作らずに聞く

### 前のセッション（2026-10-29 深夜）の「いまの状態」

- 公開：`main` の `51b5fd4`。ZIP は `downloads/`（git に入れない）
- ユーザーが合格としたもの：名前の入力・取得カード・ボタンの音・手札の上限9枚（2026-10-29）

#### このセッション（2026-10-29 夕方〜深夜）でしたこと（どれも main・公開済み）

| 内容 | 記録 | 主な所 |
| --- | --- | --- |
| モンスターの説明からランクを消す・CPU のおいかぜは「次のターンに攻撃できそうな味方」へ | `docs/pukarim.md` 7章 | `ai.ts` の `chooseChargeOrTailwind` |
| 技カードの新しい形（平らな名前の帯＋大きな絵の窓・モンスターごとの色の枠） | `docs/cardshape-20261029.md` | `skillCard.ts`・`npm run art:skillframes` |
| ↑のあとの直し：防御は数字だけ・手札は 208×260・マナ／分類／ダメージは前の版（3cf9050）の見た目（青い球・八角形の札・金のふちの札） | 同じ文書の最後の章 | `tools/art/old_parts_build.py`・`value_box_build.py`・`skillCard.ts` の LAYOUT |
| プカリムの最終（ふつうの一覧へ・ピートとの勝負・ガチャのシリーズ・相手のチーム） | `docs/pukarim-final-20261029.md` | `src/game/story/pete.ts`（記録 `storyFlags` の `pete-beaten`。セーブの形式は変えていない） |
| iPhone の試遊の直し18項目＋全体の点検 | `docs/polish-20261029.md` | 街 `town2026_build.py`（`seimon_world_build.py` で約5分）・部屋 `rooms4_build.py`・`cardshop_v2.py`・`tapSize.css`・`TOWN_FIGURE_BOOST` |
| 対戦の場のモンスターのカードの右上のライフの札を消す | — | `battleMonsterCard.ts` |

#### 作業のしかた（このセッションで分かったこと）

- 作業の順番：指示どおり作業 → `npm run check` → main に取り込み（`git merge --no-ff`）→ push → 公開（GitHub の MCP の `actions_run_trigger`・`deploy-pages.yml`・ref `main`。`gh` は使えない）
  → 公開ページの CSS／JS に新しい文字が出るまで curl で待つ（約2〜3分。キャッシュで古いことがあるので、写真の前にもう一度確かめる）→ 公開ページで写真 → 報告
- 報告は Artifact のページ（写真入り）＋ `downloads/` の ZIP（SendUserFile）。日本語・短く・専門用語なし
- 作業環境：最初に `export NVM_DIR=/opt/nvm; . /opt/nvm/nvm.sh; nvm install 24`・`export PATH=/opt/nvm/versions/node/v24.22.1/bin:$PATH`・`npm install`・`pip install scipy matplotlib`。
  ローカルの main が古いことがある → `git fetch origin main && git checkout -B main origin/main`
- 写真：Playwright は `NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node`。道具は `tools/e2e/`
  - `card_gallery_shot.cjs`（開発サーバー `npx vite --port 5173` でカードIDを並べる）・`hand_shot.cjs`（試験の対戦で手札5/7/10枚）・`gacha_shot.cjs`・`pete_shot.cjs`
  - `town_shot.cjs`（W・H・qs。`&hit=1` で当たり判定・`&fig=1.15` で人の大きさ）・`screen_steps.cjs`（W・H・`small` で 44 未満のボタンを書き出す）
  - セーブは Vitest の一時テスト `tests/zz-*.test.ts` で作って消す（`createNewSave`・`createNewGameSave`・`enterTournament`・`startRun` など）

### 前のセッション（2026-10-29 昼）の「いまの状態」

- **公開中：`main` の `3f92ad8` 以降**（公開ページで確認済み）。作業ブランチはすべて main に取り込み済み。次の指示を待っている
- **2026-10-29（このセッションの最後）**：おいかぜの直し（`claude/tailwind-fix-20261029`）と、
  **名前の入力・取得カード画面・ボタンの効果音・手札の上限9枚**（`claude/name-cardlist-uisound-20261029`。`docs/name-cardlist-uisound.md`）を main に取り込んで公開。
  **セーブ version 22**（`player.name`。前のセーブは「続きから」で1回だけ名前の窓）。テスト 714件。報告は Artifact のページ https://claude.ai/artifact/5LjJuRs6vQCabzCPBGCUtB （**返事待ち**）
- 名前・取得カード・ボタンの音の未完了：iPhone 実機（キーボードが出たときの窓のずれ・変換中の文字・音の大きさ・Safari で灰色のボタンの音）。
  取得カードをダンジョンの勝ち・宝箱・ガチャにつなぐ（部品はできている）
- 報告書の ZIP もほしいと言われることがある（2026-10-29「作業報告書をジップファイルでください」）→ `downloads/`（git に入れない）に
  `作業報告書.html`（Artifact と同じ）・`作業報告書.md`・`画面写真/` を入れた ZIP を作り、SendUserFile で渡し、開けないとき用に Artifact のリンクも添える
- **ユーザーは iPhone で作業している。ファイル（ZIP・.md）はダウンロードできないことがある** → 報告書は **Artifact の Web ページ** にしてリンクで渡す
  （プカリムの報告：https://claude.ai/artifact/JubpTGTyZ6RVs53iQG2DjD 。中身は `docs/report-2026-10-28-pukarim.md` と同じ。元のファイルはリポジトリに入れていない）。
  画面写真も同じページに入れる。ZIP を作る場合も、スクラッチパッドでなく作業フォルダ（`downloads/`。`.git/info/exclude` で git に入れない）に置く
- 作業の順番の約束：指示どおり作業 → `npm run check` → main に取り込み → 公開 → 公開ページで写真 → 報告（日本語・短く・専門用語なし）。ユーザーは毎回「main に取り込んで公開し、画面写真で報告」を求めている
- **公開のしかた**：`gh` は使えない（ログインできない）。GitHub の MCP の `actions_run_trigger`（`run_workflow`・`deploy-pages.yml`・ref `main`）で動かし、
  公開ページの `static/index-*.js` に新しい文字（例：新しいメッセージのキー）が入るまで curl で待つ（約2分）

#### このセッション（2026-10-28 深夜〜29）でしたこと：すべて公開済み

| 内容 | ユーザーの確認 | 記録・報告書 | 道具・テスト |
| --- | --- | --- | --- |
| カードの見た目3点 v3（技カードの枠・裏面の獅子・場のモンスターの二重の枠）・試験の先生のデッキ（ラズック・カルシェル・ノビトン）・倒れたときのひと言 | 合格 | `docs/cardlook-v3-20261028.md`・`docs/report-2026-10-28-cardlook-v3.md` | `src/game/battle/talk.ts`・`tests/battleTalk.test.ts` |
| 手札の大きさ（幅90・小さくせず重ねる）・マナの玉と数字 1.4倍・手札の印（色と光）・技カードの枠を2倍の webp | 合格（「縦が足りない画面だけ80」は作らなくてよい） | `docs/handsize-20261028.md`・`docs/report-2026-10-28-handsize.md` | `handLayout.ts`・`valueFit.ts`・`npm run art:skillframes`・`tests/skillFrames.test.ts` |
| お金の入る側（ダンジョンの1勝ごと・宝箱の中身・ボス） | 合格（水の神殿の合計が見込みより多めな点は、iPhone での試遊のあとで直すか決める） | `docs/money-income-20261028.md`・`docs/report-2026-10-28-money.md` | `economy.ts` の `DUNGEON_MONEY`・`CHEST_RULES`・`run.ts` の `rollChest`・`tests/moneyIncome.test.ts` |
| 新モンスター「プカリム」の試遊（確認用 ?qa=1 だけ） | 合格（数字は確定。おいかぜだけ直した） | `docs/pukarim.md`・`docs/report-2026-10-28-pukarim.md`・裁定 `docs/battle-rules.md`「プカリム（試遊中）」 | `src/data/pukarim.ts`・`src/game/battle/playtest.ts`・`npm run playtest:pukarim`・`tests/pukarim*.test.ts` |
| おいかぜを「次の自分のターンだけ＋1」に直した | ユーザー指示どおり | `docs/pukarim.md` 6章 | `tests/pukarim.test.ts` |
| 名前の入力・取得カード画面・ボタンの効果音・手札の上限9枚 | **報告済み・返事待ち** | `docs/name-cardlist-uisound.md`（名前を出す所の一覧・ボタンと音の対応表・未完了）・写真 `docs/design/name-cardlist-20261028/` | `playerName.ts`・`namePrompt.ts`・`cardListView.ts`・`receivedCards.ts`・`buttonSound.ts`・`tests/playerName.test.ts`・`tests/handLimit.test.ts`・`tools/e2e/name_*.cjs` ほか |

前の報告書の「Claude が決めたこと」（`report-2026-10-28-evening.md` 2章・`report-2026-10-28-cardlook-v3.md` 2章）は「すべてそのままで構わない」とユーザーが回答済み。

#### 名前・取得カード・ボタンの音の仕組み（次に触るとき）

- 名前：`player.name`（null＝まだ。画面は `heroName()` で「あなた」に戻す）。窓は `openNamePrompt`（新規は `newGameScreen`、前のセーブは `titleScreen` の続きから）。
  大会の表の長い名前（6文字以上）は `tournamentBoards.ts` の `boardName` で小さく2行
- 取得カード：`openCardList(parent, { cardIds, onClose })`。今つないでいるのは `worldScreen.ts` の `#choosePack` だけ
- ボタンの音：`app.ts` の `installButtonSound()`。決め方は `buttonSoundKind`（`data-se="tap|decide|cancel|none"` で上書き）。
  押したボタンの処理でほかの効果音が鳴ったら鳴らさない（`sound.playCount`）。自動の確認は `window.__seLog = []` で鳴った音の名前が取れる
- 手札の上限：`BATTLE_RULES.maxHand`・`engine.ts` の `drawUpToMax`

#### プカリムの仕組み（次に触るとき）

- ふつうに遊ぶ人には出さない：`cards.ts` の `MONSTERS`・`SKILLS` には入れず `QA_MONSTERS`・`QA_SKILLS`（台帳 `cardCatalog` と `skillsOf` には入る）。
  入口は設定の「QA用」→「プカリムの試遊」（`pukarimLabScreen.ts`。`?qa=1&lab=pukarim` でも開く。`?qa=1` が無いとタイトル）
- 新しい効果：`charge`（ほっぺにためる。`BattleMonster.charge`）・`tailwind`（おいかぜ。`BattleMonster.tailwind`）・攻撃の `undodgeableWhenCharged`（ぷはーっ。`PendingAttack.undodgeable`）。
  CPU は `ai.ts` の `chooseChargeOrTailwind`。場の印は `battleScreen.ts` の `statusBadges`（仮の見た目。`uiParts9.css`）
- 技の絵はまだ無い（`pendingSpec: ['art']`）。届いたら `assets/images/cards/skills/puk_sk_NN.png` に置き、`pukarim.ts` の `toSkill` で art を戻す
- 試遊用の16枚 `PUKARIM_PLAYTEST_16`（Claude の仮）・効果を確かめる用 `PUKARIM_EFFECT_CHECK_16`（画面写真用）。対戦の依頼に相手のデッキを渡せる `BattleRequest.opponentDeck` を足した
- 遊ぶ人の入手の流れ（ピート・ガチャ・ダンジョンのバトラー）・正式モンスターカードは「絵がそろってから別の指示書」

#### 作業環境（このセッションで分かったこと）

- 始めは Node 22・`node_modules` なし → `export NVM_DIR=/opt/nvm; . /opt/nvm/nvm.sh; nvm install 24` → `export PATH=/opt/nvm/versions/node/v24.22.1/bin:$PATH` → `npm install`。
  絵の道具は `pip install scipy`
- Playwright は Node 24 からは見えない → `NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node スクリプト.cjs`。画面確認は `npx vite build` → `npx vite preview --port 4173 --host 127.0.0.1`
- 画面写真の道具は `tools/e2e/`（README の最後の章に、このセッションで足したもの）。セーブは Vitest の一時テスト `tests/zz-*.test.ts` で作って消す
- 長い撮影は `timeout` を付けて動かし、ログをファイルに書いて途中を見る（止まったら画面写真を1枚撮って原因を見る）

#### ユーザーの判断待ち・未完了（いま）

- 名前・取得カード・ボタンの音・手札の上限の報告（`docs/name-cardlist-uisound.md`）への返事。とくに Claude からの質問：
  台本の台詞・ダンジョンの人の「あなた」・ベッドの冒険の記録の板にも名前を出すか（いまは出していない）
- 水の神殿を1回まわったときのお金（約 723G。見込み 500〜600G）：iPhone での試遊のあとで直すか決める
- 前からの判断待ち：【仮】スキップのボタンを消す時期（販売前）・前のセーブの対戦成績・道具の値段と歩数（すべて仮）・すなをほるで隠れたカルシェルを特殊の技で狙えるか・
  図鑑のカードの1枚絵・レアリティと正式英語（`docs/review-2026-10-27-answer.md`）
- 未完了：iPhone 実機での確認（このセッションの作業すべて）。マナの玉の数字の絵（57px）は大きな絵を頼むとくっきりする（報告済み）
- 気になる所（前から）：店の中の入口から出るとき、一瞬だけ主人公の頭が戸枠の上の横木に隠れる

#### 前のセッション（2026-10-28 夕方〜深夜）でしたこと（記録の場所）

| 内容 | 記録 | 道具・テスト |
| --- | --- | --- |
| 街の倍率 0.85→0.7 | `worldScreen.ts` の `VIEW_ZOOM` | — |
| ガチャの作り直し | `docs/gacha-20261028.md` | `tools/design/gacha_series_build.py`・`tests/gachaSeries.test.ts` |
| 部屋4つの新しい絵 | `docs/rooms4-20261028.md` | `tools/design/rooms4_build.py`（数秒）・`tests/rooms4.test.ts` |
| 画面の点検と直し | `docs/polish-20261028.md` | `findPathCentered`（案内の道）・`tools/design/edge_debris_20261028.py` |
| ブースターとカウンター | `docs/booster-select.md` の最後の章 | `src/game/story/introV2.ts`（`boosterDeck`・`buyBooster` など）・`tests/boosterCounter.test.ts` |
| 街の建物7つを正面向きに | `docs/design/town-20261028/10_受け取り結果_UTF8.txt` の最後 | `tools/design/town2026_build.py`（原本 `design-parts/town-20261028/front-facing-20261028/`） |
| 仮パックの名残（大会の景品・特別復元の説明・カードを見る） | `docs/booster-select.md` の最後の章 | — |

#### 大事な仕組み（前のセッションで変わったところ）

- 新しく始めたときのセーブは `createNewGameSave`（カードなし）。`createNewSave` はテストや読み込みの土台としてこれまでどおり（初期デッキ入り）
- 試験は `BattleRequest.playerDeck`（先生の貸しデッキ。`examLoanDeck`）。所持カードには入らない
- カウンターで買った箱の記録は `storyFlags` の `booster-bought:*`。管理局で受け取った箱は `story.introV2.selectedBoosterKey`
- 特別復元は `src/ui/components/restoreFlow.ts`（研究所の解析台 `restore`・研究員 `researcher`）。カウンターのメニューにはもう無い
- 大会会場の壁の板の位置は `maps.ts` の `HALL_BOARD`（板の傾き skewY −33.2°）。表は `#addLeagueBoard`。○× は `tournamentBoards.ts` の `leagueMark`
- 部屋4つは `rooms4Art.generated.ts`（`ROOMS4_ART`）。大会会場・練習場・研究所は `seimon_world_build.py` では作らない（`ROOMS4_IDS`）。管理局の前の部品（bureau-v01）は消した
- 街の絵を作り直すとき：`python3 -I tools/design/seimon_world_build.py design-parts/seimon-world`（約4分。`pip install scipy matplotlib` が要る）
- 画面写真：セーブは Vitest の一時テスト（`tests/zz-*.test.ts`、終わったら消す）で `createNewGameSave`・`claimBooster`・`enterTournament` などから作る。
  場所の例：カウンター `{shop, 30,16, up}`・研究所の解析台 `{lab, 43,26, right}`・研究員 `{lab, 31,24, up}`・大会会場の板 `{hall, 10,23, left}`・家の机（デッキ編集）`{home, 8,18, left}`。
  街の入口11か所の出入り `node tools/e2e/town_doors.cjs URL 出力 セーブ.json`
- 作業環境：セッションの始めは Node 22・`node_modules` なしのことがある → `export NVM_DIR=/opt/nvm; . /opt/nvm/nvm.sh; nvm install 24` → `export PATH=/opt/nvm/versions/node/v24.22.1/bin:$PATH` → `npm install`

#### 前のセッションの判断待ち（上の「いま」が正しい）

- Claude が決めたこと（報告書 2章）：ガチャの数字（仮）・部屋の人の立ち位置と調べたときの文・カウンターからガチャの札を外した・【仮】スキップで旅立ちのきらめきを配る・研究員の選択の窓・植木鉢と木箱の位置
- 前からの判断待ち：試験の先生のデッキとライフ・【仮】スキップのボタンを消す時期（販売前）・前のセーブの対戦成績・道具の値段と歩数（すべて仮）・
  すなをほるで隠れたカルシェルを特殊の技で狙えるか・図鑑のカードの1枚絵・レアリティと正式英語（`docs/review-2026-10-27-answer.md`）
- 未完了：iPhone 実機での確認（ガチャの音と手ざわり・部屋4つ・建物7つ・街の倍率）
- 気になる所（前から）：店の中の入口から出るとき、一瞬だけ主人公の頭が戸枠の上の横木に隠れる

#### これより下は前の記録（古い順に積み上げ。上と食いちがうときは上が正しい）

- 2026-10-28 夜〜夕方の作業の細かいメモ（上の表と同じ内容）は git の履歴にある（`git log --oneline b386425..554f2a6`）
- 2026-10-28 午後（その前）の公開：`f02555b`（街の直し・ダンジョンの人物12人。報告書 `docs/report-2026-10-28-town-fix-dungeon-people.md`）
- 2026-10-28 午後にしたこと（指示 ZIP「Mistral_Dungeon_People_24_20261028」。原本は `design-parts/dungeon-people-20261028/`）
  - **A 街の直し**（`bfd9607`。作業ブランチ `claude/town-fix-20261028`）：街の倍率 1.15→0.85（`worldScreen.ts` の `VIEW_ZOOM`）・石の橋のアーチの面と水を使わず道をデッキへ・
    東西のはしを林のへり（`FOREST_W` 300 は歩けない）・空き地に小物・行き止まりの道をなくして扉の前の小道（`DOOR_PATH_W`）・縁石を辺の向きに（`draw_curbs`）・欠片4つを街のすみへ。
    すべて `tools/design/town2026_build.py`。記録 `docs/design/town-20261028/10_受け取り結果_UTF8.txt` の最後と `fix/` の写真
  - **B ダンジョンの人物12人**（`f02555b`。作業ブランチ `claude/dungeon-people-20261028`）：守り手7人＝ボス（`enc-*-boss` の名前・`people.ts` の `opponentIds`）、
    新しい5つのバトラー5人（`dungeonRun.ts` の `runBattlerFace`。階の中の番号 1〜3 が奇数ならそのダンジョンの人）、名刺図鑑 29〜40、せりふ（`people.ts` の `lines`：meet・start・win・lose・after）、
    新しい5つのボス戦の背景＝そのダンジョンの絵（`dungeonRunScreen.ts` の `BOSS_OWN_BG`）、報酬の文「最奥の祭壇から、カードを受け取った！」、守り手に勝ったあとのひと言（`GameStore.flashKeeper` → `worldScreen.ts`）。
    絵 `tools/design/dungeon_people_build.py`、記録 `docs/dungeon-people.md`、テスト `tests/dungeonPeople.test.ts`
- せりふの文（Claude の案・英語は仮訳）と混ぜる今の3人（水＝フローラ・氷と火＝カイル・機械と聖域＝オスカー）は 2026-10-28 夕方にユーザー了承。
  守り手7人の立ち姿 `stand_guardian_*.webp` は作ったが未使用（地図はボスのしるしのまま）
- **未完了**：iPhone 実機での確認（A・B とも。ブラウザでは確認済み）
- 新しい街（2026-10-28 午前に作り直し）の要点：原本 `design-parts/town-20261028/`、組み立て `tools/design/town2026_build.py`（`seimon_world_build.py` から呼ぶ。約4分。
  `pip install scipy matplotlib` が要る）、色 `tools/design/town_tone_20261028.py`、テスト `tests/town2026.test.ts`。街は 6400×6784 単位。建物・木・小物は人と前後を比べる絵。
  住人：ピート＝ショップの前・ハロルド＝広場のベンチのそば（家の中は空）、マルタ・ロザリー＝店の中だけ。練習場は地面の高さ（ユーザー了承）
- **画面写真の撮り方**（道具はリポジトリに残した。`tools/e2e/README.md`）
  - セーブを作る：`tests/zz-*.test.ts` を一時的に置いて Vitest で JSON をスクラッチパッドに書き出す → 終わったら消す（Node で直接 ts を動かすと JSON の import で止まる）。
    `createNewSave` に `story.intro: 'skipped'`・`story.introV2: LEGACY_INTRO_V2`・`player: {gender:'male'}`。
    ダンジョンは `startRun(save, 'dungeon-0N', 12345)` のあと `runFloor` でボス・バトラー（ID は `…-npc-1`〜`3`・`…-boss`）のとなりの床に `x,y,dir` を置き、`explored` を全部 '1'・`cooldown: 999`。
    名刺図鑑は `recordPersonBattle(save, runBossOpponent(id), 'player')` などで会った記録を足す
  - `npx vite build` → `npx vite preview --port 4173 --host 127.0.0.1`（公開ページ `https://shunyamita0804-source.github.io/mistral-monsters-battle-card/` でも同じ）
  - 街：`node tools/e2e/town_shot.cjs URL 撮る場所.json 出力 セーブ.json`・入口11か所 `node tools/e2e/town_doors.cjs URL 出力 セーブ.json`。
    場所（マス）の例：家の前 (31,185)・広場 (96,120)・石の橋 (100,168)・木の橋 (47,145)・西のはし (16,105)・東の南側 (150,165)・商店街 (175,112)
  - ダンジョンの人：`node tools/e2e/dungeon_people_shot.cjs URL セーブのフォルダ 出力 [win]`、名刺図鑑：`node tools/e2e/people_book_shot.cjs URL セーブ.json 出力 [人物のID]`
  - 日本語の字の入った画像は作れない（作業環境に日本語のフォントが無い）。比較写真の見出しは英数字にした
- 公開のしかた（ユーザーが「公開して」と言ったときだけ）：`main` に取り込んで push → `gh workflow run deploy-pages.yml --ref main` → `gh run watch 番号` → 公開ページで写真を撮って確かめる
- それより前の公開：`a8b1fdd`（ダンジョン5つの絵・名前の絵）
- 2026-10-28 に公開したもの（どちらもユーザーの指示書どおり。公開ページで新しい絵が出ることを確認済み）
  - `9fc32e4`：新しいダンジョン5つ（水の神殿・氷の洞窟・炎の火山・機械の塔・天の聖域）の正式な絵30枚。床・壁・階段・水路（ふちの石）・氷・扉とスイッチ（閉→開・切→入）・
    床の飾り（火山のひび割れ・聖域の羽根／燭台／光の筋。`src/game/dungeon/decor.ts`、見た目だけ）・対戦の背景（番人・バトラー）・ボスの間のしるし・入ったときの挿絵と輪。
    原本 `design-parts/dungeons5-20261028/`、切り出し `tools/design/dungeons5_build.py`、受け取り記録 `docs/design/dungeons5-20261028/10_受け取り結果_UTF8.txt`
  - `a8b1fdd`：5つのダンジョン名の絵（入ったときの挿絵の上。遺跡・森と同じ大きさ・位置）と「新しいダンジョン発見」の帯（大会のランクアップで開いたとき、報酬の窓でランクアップの帯のあと。
    紺の帯に「新しいダンジョンが見つかった：」と名前の2行）。原本 `design-parts/dungeon-titles-20261028/`、切り出し `tools/design/dungeon_titles_build.py`
  - 記録はどちらも `docs/dungeons7.md`「見た目」
- 2026-10-28 の仮のもの：床の飾りの割合（火山7%・聖域6%。`decor.ts` の `DECOR_RULES`）。対戦の背景は対戦画面の決まりで暗い膜の下にうっすら（遺跡・森と同じ）
- その前の公開：`919248d`（2026-10-27 夜）シエナの代わり・エレノア・ダンジョン7つ・顔8人・名刺の台紙・カード図鑑の部品・研究所の外観と家具（記録 `docs/dungeons7.md`・`docs/people-book.md` の最後）
- ほかの画面写真の撮り方（2026-10-28 午前に使ったやり方）
  - セーブを作る：`tests/zz-*.test.ts` を一時的に置いて Vitest で `createNewSave`・`startRun`・`enterTournament`・`recordMatch` などを呼び、JSON をスクラッチパッドに書き出す → 終わったら消す
    （Node で直接 ts を動かすと JSON の import で止まる）。`story.intro: 'skipped'`・`story.introV2: LEGACY_INTRO_V2` で導入イベントを飛ばす
  - ダンジョンの中：`dungeonRun` を入れたセーブで「続きから」。全部見せるときは `explored` を全部 '1'、明るく見せるときは `torchFloor`、番人の予兆を出さないときは `cooldown: 999`
  - 入ったときの挿絵：街の南の出口の手前 `{mapId:'town', x:62, y:123, dir:'down'}` で下キー → 世界地図 → `[aria-label="水の神殿"]` などを押して約1.9秒後に撮る
  - 大会の報酬：`{mapId:'hall', x:20, y:27, dir:'up'}` で「調べる」→ 受付の画面 →「景品を受け取る」
  - 撮影は `npx vite build` のあと `npx vite preview --port 4173 --host 127.0.0.1`。公開ページは `https://shunyamita0804-source.github.io/mistral-monsters-battle-card/` で同じ操作
- その前に公開したもの（`0fe602c`）：大会の新しい形（`docs/tournament-v2.md`）・ブースターパック3箱（`docs/booster-select.md`。中身・値段は未定）・ガウルのバトル用カード
- そのさらに前（`e1542da`）：導入イベントV2（`docs/intro-v2.md`）・カードバトラー管理局（`docs/bureau-v01.md`）・人物28人と名刺図鑑・カード図鑑（`docs/people-book.md`）・ダンジョンの道具8種（`docs/design-ui33-20261027.md`）・カードの裏面
- 大会の未完了：ユリウスの試合の観客の声（音が見つかってから。ユーザー了承）
- **次に届く予定**：部屋の部品（家具・内装。指示書では「後日、別の便」）。イベントのダンジョン（霧の廃坑・忘れられた書庫）と最後のダンジョン（静かなる祭壇）は物語が決まってから別の指示書（霧の廃坑でシエナを助けたら「シエナがいなくなった」の記録を消す予定。消せば大会に戻るように作ってある）
- ダンジョン7つの仮のもの：ボスのモンスター（水ミュロル・氷カルシェル・火ガウル・機械ラズック・聖域ソラモ）・世界地図の置き場所・相手の強さ（`docs/dungeons7.md`）。床や壁の絵は 2026-10-28 に正式な絵へ
- 立ち姿（シエナ・エルンスト）は `design-parts/people-album-lab-20261027/` に置いただけ。画面にはまだ出ない
- 管理局の外観の依頼文（`docs/design/bureau-exterior-redo-20261027/`）は使わない（2026-10-28 に街ごと新しい絵へ）
- 開発用の文字（左下の screen …）は `?qa=1` のときだけ出る（公開ページで確認済み）。iPhone で出たのは、ホーム画面のアイコンやブックマークの URL に `?qa=1` が付いていたためと思われる
- iPhone 実機：上のどれも未確認（ブラウザでは確認済み）
- **ユーザーの判断待ち**：ブースターパック3種の中身・値段、初期デッキ60枚の正式な内訳、試験の先生のデッキとライフ、【仮】スキップのボタンを消す時期（販売前）、
  前のセーブの対戦成績（負けは 0）でよいか、道具の値段・歩数（すべて仮）
- 前からの判断待ち：すなをほるで隠れたカルシェルを特殊の技で狙えるか・図鑑のカードの1枚絵・いまのセーブに初期配布を足すか・レアリティと正式英語 など（`docs/review-2026-10-27-answer.md`）
- **未完了・気になる所**：店の中の入口から出るとき、一瞬だけ主人公の頭が戸枠の上の横木に隠れる。研究所の研究員の吹き出しの「正式カードは…」にカルシェルが無い
- NPC の歩く絵：`python3 tools/art/adult_walk_build.py design-parts/characters-adult npc_X design-parts/characters-adult/sheets-outlined/npc_X_walk.webp --scale 1.25 --outline 2 --npc` のあと `python3 tools/art/ground_figures.py`（中の SHEETS にその NPC を足す）
- 画面の自動操作：スクラッチパッドで Playwright。セーブを入れて試すときは新しいブラウザで `addInitScript`（開いたままだとアプリが上書きする）。対戦は `?qa=1` の「QA:即勝利／即敗北」

### 作業で使う道具（今回使ったもの）

- 街と部屋の絵：`python3 -I tools/design/seimon_world_build.py design-parts/seimon-world`（約4分半。街は `town2026_build.py`、ショップの内装は `cardshop_v2.py`）
- 販売機の画面の部品：`python3 -I tools/design/gacha_build.py design-parts/cardshop-20261027 design-parts/cardshop-assets-20261027/assets`
- モンスターの色の枠（新しいモンスターは色を足して全部作り直す。ほかの枠は1バイトも変わらない）：
  `python3 -I tools/art/battle_card_frame.py design-parts/cards-original/soramo-battle-20261025/04_Approved_Battle_Frame_Reference.png design-parts/cards-original/soramo-battle-20261025/MonsterColor_AccentMask_800x920.png assets/images/ui/battlecard soramo=#E4D2AC lazuck=#844DC5 nobiton=#FFD400 myurol=#84E5FA kalshell=#DFF2F6`
  技・サポートカードの枠は `npm run art:skillframes`（2026-10-28 から v3 の絵。色は `tools/art/skillcard_v3_build.py` の `MONSTER_COLORS`。scipy が要る）
- 新しいダンジョン5つの絵（2026-10-28）：`python3 -I tools/design/dungeons5_build.py design-parts/dungeons5-20261028 assets/images`（scipy が要る。約2分半）
- ダンジョン名の絵と発見の帯（2026-10-28）：`python3 -I tools/design/dungeon_titles_build.py design-parts/dungeon-titles-20261028 assets/images/ui`
- 作業環境（2026-10-28 も Node 22・`node_modules` なしで始まった）：`export NVM_DIR=/opt/nvm; . /opt/nvm/nvm.sh; nvm install 24` → `export PATH=/opt/nvm/versions/node/v24.22.1/bin:$PATH` → `npm install`。
  手元の `main` が古いことがあるので最初に `git checkout -B main origin/main`。切り出しの道具は `pip install scipy` が要る
- 正式モンスターの追加の型：`src/data/kalshell.ts`（新しいモンスター）・`src/data/myurol.ts`（技の入れ替え・ID の引き継ぎ・セーブの移し方）と、それぞれのテスト

### これまでの記録（新しい順）

- **2026-10-28 午後 ダンジョンの人物12人（`f02555b` で公開）**：守り手7人をボスに・新しい5つのバトラー5人・名刺図鑑 29〜40・新しい5つのボス戦の背景。記録 `docs/dungeon-people.md`、報告 `docs/report-2026-10-28-town-fix-dungeon-people.md`
- **2026-10-28 午後 街の直し（`bfd9607` で公開）**：カメラ 0.85・石の橋・林のへり・小物・道の終わり・縁石・欠片。記録 `docs/design/town-20261028/10_受け取り結果_UTF8.txt` の最後
- **2026-10-28 ダンジョン名の絵5つと「新しいダンジョン発見」の帯（作業ブランチ `claude/dungeon-titles-20261028`・main に取り込み `a8b1fdd` で公開）**。
  最初に届いた ZIP には指示書が入っておらず、ユーザーに確認して送り直してもらってから実装した。記録 `docs/dungeons7.md`「見た目」
- **2026-10-28 新しいダンジョン5つの正式な絵30枚（作業ブランチ `claude/dungeons5-art-20261028`・main に取り込み `9fc32e4` で公開）**。
  途中で見つけて直したこと：切り出しの並び順で火山の上り階段がひび割れに、機械の塔のスイッチの切／入が入れ替わっていた（どちらも公開前に直した）。記録 `docs/dungeons7.md`「見た目」
- **2026-10-27 カルシェル（ライフ8・技14・初期配布16枚）を入れた（作業ブランチ `claude/kalshell-20261027`・main に取り込み `e9f9ecd` で公開）**。記録 `docs/card-data-policy.md`「2026-10-27 カルシェル」。
  色は淡い氷色 `#DFF2F6`。新しい動き「すなをほる」（`hide`・`hiddenTurn`）。正式モンスターカードの1枚絵は資料の注意どおり貼らない。テスト `tests/kalshell.test.ts`
- **2026-10-27 カードショップ素材一式（A〜G）を組み込んだ（作業ブランチ `claude/cardshop-assets-20261027`・main に取り込み `e9f9ecd` で公開）**。原本 `design-parts/cardshop-assets-20261027/`、記録 `docs/design/cardshop-20261027/11_素材一式の受け取り_UTF8.txt`。
  街の外観を新しく（`tools/design/cardshop_v2.py` を `seimon_world_build.py` が呼ぶ。変わった街の絵はショップのある2枚だけ）、外と中の自動ドア（`worldScreen.ts` の `#buildDoors`。近づくと開く）、
  新しい内装（赤いガチャ機なし・家具ごとに前後・店の中に青い販売機。部屋は 1920×1280 単位・`fitHeight` 1024 で人の大きさをほかの部屋とそろえる）、店員は見た目だけ奥（`NpcObject.drawDy`）、
  販売機の画面を正式素材に（【仮】の切り出しは消した）。**iPhone 確認待ち**。戸の音は自動ドアの音（auto_door.mp3）を戸が開き始めるときに
- **2026-10-27 カードショップ改修：ガチャの流れ（作業ブランチ `claude/cardshop-gacha-20261027`・main に取り込み `c6786df` で公開）**。ZIP「MistralBC_CardShop_Handoff_FIXED」は `design-parts/cardshop-20261027/` に無改変。
  ユーザー指示どおり、販売機を調べる → パックを買う → 販売機の画面でハンドルを指で時計まわりに1周（「自動でまわす」もあり）→ 取り出し口が開いてパックが出る → 押すと開封（`src/ui/components/gachaTurn.ts`・`src/ui/styles/gacha.css`）。
  ハンドルは正式の絵を円盤と取っ手に分けた。機械の上半分・取り出し口は参考シートの【仮】切り出し（`tools/design/gacha_build.py`）。
  **未完了**：店の内装の差し替え（正式内装に赤いガチャ機が描き込まれている・家具が分かれていない）と自動ドア。足りない素材の依頼文 `docs/design/cardshop-20261027/`（A〜G。F＝店の外観と外の自動ドア〔ユーザー「外から入る時も自動ドアが動くように」〕。ZIP はチャットで渡した・ユーザーはまだデザイン担当に送っていない）。
- **2026-10-27 ミュロル正式14技・初期配布16枚・水色の枠のバトル用カード（作業ブランチ `claude/myurol14-20261027`・main に取り込み `c6786df` で公開）**。記録は `docs/card-data-policy.md`「2026-10-27 ミュロル正式14技」。ID は同じ名前の技を引き継ぐ（12＝旧14・13＝旧15・14＝旧16）、旧12・旧13 はセーブ version 14 で外す。色 `#84E5FA`。正式カードの1枚絵は無いので図鑑のカードは重ねて描く。テスト 485件
- **2026-10-27 物語の始まりの挿絵を入れた（作業ブランチ `claude/opening-art-20261027`・main に取り込み `b809812` で公開）**：主人公を選んで新しく始めたときに1回だけ、家の画面の上に画面いっぱいの絵→フェードアウト（`src/ui/components/openingIntro.ts`・`GameStore.openingIntro`。文字なし）。同じ日にユーザーの依頼でカルシェルの技データを本編（mystic-monsters・読み取りだけ）から集めて ZIP で渡した：本編の正式10技（育成ゲームの形）と技カードの絵10枚。**バトルカード用のカルシェル14技はどこにも無かった**
- **2026-10-27 ダンジョン試作をスティックに・街の建物を縦 1.1 倍（ユーザー「片手でできるように」「ドアが背より低い」）**。ダンジョン試作は十字キー・A・B の欄をやめ、街と同じ「なぞるとスティック」（`dungeonRunScreen.ts` の `#pointerDown` など）、タップか右下の「調べる」で話す・開ける、その左の丸い「メニュー」。地図は画面いっぱい。第12弾の十字キー・A・B の絵は使わなくなった（`assets/images/ui/dungeon/` に残す）。街の建物は `seimon_world_build.py` の `BUILDING_STRETCH_Y` 1.1（下の端＝玄関はそのまま上へ伸ばす。歩ける所にはかからない。大会会場は屋根のてっぺんの飾りの先が少し切れる）。看板の位置も上へ
- **2026-10-27 iPhone の試遊から（`main` の `6201719` で公開）**：ダンジョン試作の主人公を 1.2 倍（`PLAYER_H` 70→84。バトラー・番人も同じ高さ）。対戦の下のボタンを3つの場所に：左＝コマンド、真ん中（画面の真ん中に固定）＝攻撃終了・ターン終了・守備しない、右＝使う・やめる・マナにする。ボタンの高さ 46→52・文字 13→15（`battlePs.css` の `.battle-cmds`）。ユーザーの「十字キー・A・B がチープ」は公開中の古い版の画面（第12弾の絵はこのブランチで入れ替え済み）
- **2026-10-27 デザイン第12弾10枚・第13弾7枚を組み込んだ（作業ブランチ `claude/ui-quality12-13-prompts-20261027`・`main` の `6201719` で公開）**。原本 `design-parts/ui-quality1{2,3}-20261027/`、切り出し `tools/design/ui12_13_build.py`、見た目 `src/ui/styles/uiParts12.css`、記録は各フォルダの `10_受け取り結果_UTF8.txt`、比較画像は同じフォルダの `20_*.webp`。
  精霊の森の床・壁・階段・対戦の背景、ダンジョン試作のバトラー3人（地図の絵と顔。相手の定義の `face`）・ボスの間のしるし・見えない番人（「！」・現れる姿・顔）・十字キーと A・B・ミニマップの枠と印、主人公の勝ち・負けの姿（結果の窓の上）、相手のひと言の吹き出し、3回負けたときの帯（`flashBanner: 'retreat'`）と負けの灯り、優勝の場面、D ランク大会の対戦の背景。物語の始まりの挿絵は、あとでユーザーの指示で入れた（2026-10-27）。勝ったときの姿は画面で未確認
- **2026-10-27 デザイン第12弾・第13弾の依頼文を作成（作業ブランチ `claude/ui-quality12-13-prompts-20261027`・ZIP はチャットで渡した）**。ユーザーの言葉では「第10弾・第11弾」だが組み込み済みなので12・13 に。モンスターカード・技カードは別に作成中なので除く（ユーザー指示）。これから増やすダンジョンも除く（ユーザー「今回は入れない」）。
  第12弾＝ダンジョン10枚（精霊の森の床・壁・階段・対戦の背景、バトラー3人の立ち姿と顔、ボスの間のしるし、見えない番人、十字キーと A・B、ミニマップ）`docs/design/ui-quality12-20261027/`。第13弾＝7枚（主人公の勝ち・負けの姿 男女、相手のひと言の吹き出し、戻されるときの帯と負けの灯り、優勝の場面、D ランク大会の対戦の背景、物語の始まりの挿絵）`docs/design/ui-quality13-20261027/`。バトラー・番人の人物像と「使う場所」は Claude の案。物語の始まりの挿絵を入れるかはユーザーに聞く
- **2026-10-26 夜 ダンジョン試作（たたき台）を作った（`main` の `19162f7` で公開・iPhone 確認待ち）**。ユーザーの指示書「ミスモンBC ダンジョン試作（たたき台）」どおり、**太古の遺跡だけ**をランダム生成・手探り探索に：
  3階建て（3階にボス・上り階段なし）・部屋の格子 5×5 を通路でつなぐ・スタートから階段（ボス）まで必ず行ける（120 通りのシードでテスト）・最初は真っ暗で自分と隣のマスだけ見える・見たマスは暗く残る・右上にミニマップ・
  下に十字キー（押しっぱなしで歩く）と A（話す・宝箱）・B（メニュー〔仮〕：場所・負けた回数・獲得した技カード）。バトラー（話しかけると対戦）・宝箱・見えない番人（近づくと画面の端が紫に揺れて「！」、1歩ごとの抽選。戦うと 20 歩は出ない）・ボス（仮ジオル）。
  勝つと相手のモンスターの技から1枚ランダム。3回負けると街の入り口へ戻り、その挑戦で得た技カードを失う。中断しても同じ階・同じ位置から（セーブ version 13 の `dungeonRun`）。倍速・スキップなし。
  仮の数値は `src/data/dungeonRun.ts` の `DUNGEON_RUN` 1か所。ロジック `src/game/dungeon/`（`generate.ts`・`run.ts`）、画面 `src/ui/screens/dungeonRunScreen.ts`・`src/ui/styles/dungeonRun.css`、テスト `tests/dungeonRun.test.ts`。
  入ったときの挿絵は `src/ui/components/dungeonIntro.ts` に移した（歩行画面と共用）。精霊の森はそれまでの固定のマップのまま。隠しモンスターの欠片 05〜10 は遺跡の固定マップから、同じ形の森の同じ場所へ移した（`src/data/fragments.ts`）。
  **未決事項（ユーザーに確認する。推測で決めていない）**：宝箱の中身（いまは「中身はまだ決まっていません（仮）」と出るだけ）・途中で街へ帰る方法（いまは無い）・クリアの報酬（いまは固定ダンジョンと同じ仮のお金とジオルのカード）とクリア後の行き先（街の入り口）・
  バトラー／番人の編成と強さ（仮のテスト編成）・バトラーとボスの見た目（いまは固定ダンジョンの黒い霧のしるし）・負けたバトラーの扱い（いまはその場に残り再挑戦できる）・宝箱の数（各階2）・番人の確率（30%）と予兆の距離（3マス）・森も同じ作りにするか・B メニューに入れるもの
- **2026-10-26 夜 ユーザー：「初期デッキなどは後から指示を出す。待っていて。次はたぶんダンジョンの作成を頼む」**。ユーザーの次の指示を待つ（初期デッキ・ノビトンのモンスターカード本体を配るか・火／機械の BGM の割り当ての確認もまだ）
- **2026-10-26 iPhone の試遊から（対戦画面）**：手札の絵の右が黒い（横長の窓のすき間を暗くぼかした絵で埋めていた）→ 窓いっぱいに（上下を少し切る）。手札 70→82（狭い画面は 72 まで小さく・入りきらなければ少し重ねる）。
  選んだ手札を 20px 持ち上げて少し大きく。配った手札は裏向きで届き、左から1枚ずつ表に返る。相手の使ったカードは裏向きのまま大きくなりながら真ん中の大きなカード（112→150）の場所へ飛び、着いたら表に返る。
  音は Kenney「Casino Audio」（CC0）から3つ（効果音ラボ・OtoLogic は作業環境から取れなかった。`docs/audio-credits.md` 末尾）。**ユーザーの試聴・確認待ち**。`main` の `6a4cada` で公開
- **2026-10-26 iPhone の試遊から（2回目・`main` の `64bb7ce` で公開・iPhone 確認待ち）**：手札の緑の枠をやめた・手札の名前を消して縦長の枠に（絵の窓が大きい。`battleCard.ts` の 'tall'）・
  説明の欄の大きなカード 132→176・相手の列は情報の欄をモンスターの右に（向かい合わせ）・相手が使ったカードは相手の場所（相手の手札と列の上に重ねる `.battle-opp-spot`）で、カードを左・説明を右に大きく見せる（その間はカメラを上のまま）・相手がカードを引くときも配る音。配る音はユーザー提供の「Motion-Swish07」7種類（`sound.deal()`）
- **2026-10-26（`main` の `24fd622` で公開・iPhone 確認待ち）**：ノビトン正式14技・初期配布16枚（新しく始めたときの所持カードだけ）・黄色の枠のバトル用カード（届いた原画を無改変）。
  旧11 サイコガード・旧14 ねばりガードはセーブ version 12 で外す。記録は `docs/card-data-policy.md`「2026-10-26 ノビトン正式14技」。テスト 463件
- **2026-10-26（`main` の `24fd622` で公開・iPhone 確認待ち）**：ダンジョンの挿絵・名前・重ねる部品の6枚が届いて組み込んだ（記録 `docs/design/dungeon-intro-20261026/10_受け取り結果_UTF8.txt`）。挿絵は横長で届いたので画面いっぱいに切り抜く
- **2026-10-26 これから作るダンジョン用の BGM 6曲を保存**（`assets/audio/bgm/bgm_dungeon_{water,fire,ice,holy,machine,normal}.mp3`。まだ鳴らさない。曲名・gain は `docs/audio-credits.md`）。
  水・氷・神・普通は曲名から、火（Tower of Despair）・機械（Another Dimension）は推測でユーザーに確認中
- **2026-10-26（`main` の `887b490` で公開・iPhone 確認待ち）**：ダンジョン名が決定（太古の遺跡＝ジオル・精霊の森＝フルーネ）。世界地図は地方の名前をやめ、印と名前を大きく、押すとそのまま出発・街の印で街へ戻る（下の説明の欄はやめた）。
  入ったときは画面いっぱいの挿絵とダンジョン名がフェードアウト（`#dungeonIntro`。挿絵は仮で対戦の背景・名前は明朝体）。挿絵・ダンジョン名・重ねる部品の依頼一式 `docs/design/dungeon-intro-20261026/`（ZIP はユーザーに渡し済み）。
  ユーザーの「主人公選びが1回で始まる」は公開5分後の確認で古い版だった（タッチで最初から→1回目は選ぶだけ・2回目で開始を確認）。ユーザーの添付に私的な写真（書類の画面）が1枚まじっていたので使っていない
- **2026-10-26（`main` の `a565d0b` で公開・iPhone 確認待ち）**：ユーザー報告「建物に入ると一歩動かないと音が鳴らない」。iPhone はタップの処理の中で一度 play() した audio しか後から鳴らせないのに、
  曲を替えるたびに新しい audio を作っていた。最初のタップで audio を3つ作って鳴らせる状態にし、src を入れ替えて使い回すようにした（`bgm.ts` の `#pool`）
- **2026-10-26（`main` の `b2ebc8e` で公開・iPhone 確認待ち）**：主人公選びは1回目で札が光り、同じ札をもう1回で決定（`newGameScreen.ts`）。始めたあとの「ようこそ」の説明をやめた（ユーザー「自分で確かめさせるRPG要素に」）。
  ユーザーの「建物に入っても BGM が街のまま」は、公開（21:16）の2分後の録画で、GitHub Pages の10分のキャッシュで古い版だったとみられる（作業環境のブラウザではショップに入るとショップの曲に替わるのを確認）
- **2026-10-26（`main` の `64b16c8` で公開・iPhone 確認待ち）**：ダンジョンを2つに（`dungeon-01`＝月影の遺跡〔仮名〕・`dungeon-02`＝精霊の森〔仮名〕。森は遺跡の写し `copyFloor`、ボスだけ別の仮の編成）。
  ダンジョンに入った直後に挿絵と名前の札（`worldScreen.ts` の `#dungeonIntro`。挿絵は仮で対戦の背景）。BGM 5曲（遺跡・森・ショップ・練習場・研究所）。配る音は1つだけ。相手の手番をゆっくりに（AI_STEP_MS 1500・飛ぶ 620・返す 520・見せる 2400）。
  ユーザー「ジオルとフルーネの情報は後々送ります。今は仮で適当で」：仮ジオル（`mon-tmp-geol`）・仮フルーネ（`mon-tmp-flune`）と仮の技6つずつ（`cards.ts`）。
  ボスの真ん中に置き、初めて倒したときにモンスター1枚＋技1〜3を1枚ずつ（`DungeonDefinition.firstClearCards`）。正式データが届いたら新しい ID で足す。
  家の中の BGM 3曲（主人公の家・住人の家・案内人の家。割り当ては名前の文字数からの推測）。**未完了**：ダンジョンの挿絵・森のマップの絵
- **公開中：`main` の `e9f9ecd`**（2026-10-27：カードショップの新しい外観・内装・外と中の自動ドア・販売機の正式素材、カルシェル。**iPhone 確認待ち**）。その前の `c6786df`（ミュロル正式14技・ガチャの場面）。その前の `b809812`（物語の始まりの挿絵）。その前の `6201719`（2026-10-27：デザイン第12弾・第13弾、対戦のボタンを左／真ん中／右に、ダンジョン試作をスティックに、街の建物を縦 1.1 倍。**iPhone 確認待ち**）。その前の `19162f7`（ダンジョン試作：太古の遺跡をランダム生成・手探り探索に）。その前の `24fd622`（ノビトン正式14技・ダンジョンの挿絵）。その前の `887b490`（世界地図を押すだけで出発・ダンジョン名の決定・入ったときの挿絵を画面いっぱいに）。その前の `a565d0b`（建物に入った瞬間に BGM が鳴る iPhone 対応）。その前の `b2ebc8e`（主人公選びの2回押し・「ようこそ」なし）。その前の `64b16c8`（ダンジョン2つ・BGM 8曲・仮ジオルと仮フルーネ・配る音1つ・相手の手番をゆっくりに）。その前の `64bb7ce`（対戦画面の見直し2回目・配る音。その前の `6a4cada`（対戦画面の手応え）、その前の `44b693b`（2026-10-26：BGM 4曲をユーフルカの曲に差し替え＝街「放浪者の街」・野生モンスターとの対戦「神獣の試練」・ボス戦「己と仲間を信じて」・大会の対戦「Conflict」。ZIP の並びと指示の順が合わないので曲のファイル名で割り当てた。記録 `docs/audio-credits.md`・作り方 `tools/audio/make_bgm_loops_wingless.py`。**iPhone で聞いてもらうのを待つ**）。その前の `6c81fa7`（作業ブランチはすべて main に取り込み済み。テスト 449件）で公開したもの：タイトル（アイコンを消す・ロゴの位置・新しい背景）、
  デッキ編集を PS版の動画のように3段に（表 → モンスターを選ぶ／技カードを選ぶ）、デザイン第10弾・第11弾（各10枚）、ラズック正式14技（紫の枠・初期配布16枚・セーブ version 11）
- **ユーザーの確認待ち**：上のすべてを iPhone で見てもらうこと。ボス戦の背景は作業環境でボス戦まで進めず、画面では未確認
- **未確定（独断で決めない）**：初期デッキの3体目と13枚（いまは仮でソラモの技）、ガウルの初期配布、レアリティ・正式英語、ちょうはつ／ダストキックの細かい裁定、
  複数のデッキ（チーム管理。ユーザーが「今回は1つのまま」と決めた）
- **デザインの依頼の流れ**：Claude が全画面を撮って足りない所を探す → `docs/design/ui-qualityNN-日付/`（00＝一覧と理由・01＝プロンプト）と参考画像の ZIP を渡す →
  絵が届いたら原本を `design-parts/ui-qualityNN-日付/`、切り出しを `tools/design/uiNN_build.py`、見た目を `src/ui/styles/uiPartsNN.css`（`src/main.ts` で読み込む）、記録を `10_受け取り結果_UTF8.txt`。
  **ユーザーの言う「第○弾」は番号がずれることがある**（届いた順で数える）。背景がマゼンタで届いたら `tools/design/magenta_key.py`
- **正式カードの組み込みの流れ**（ソラモ・ガウル・ラズックと同じ）：ZIP を `design-parts/cards-original/…/` に無改変、JSON を `src/data/official/` に無改変、絵は PNG を無改変で
  `assets/images/cards/skills/`、枠の色は `tools/art/skillcard_v5_monster_color.py`・`battle_card_frame.py`、ID は名前で同じ技を引き継ぐ、外れた技はセーブの version を上げて外す
- **画面の確かめ方**：撮影用の一時ファイル（`zz-shot.html`・`zz-shot.ts`。コミットしない）を置いて `npx vite --port 5179` で開き、Playwright で 390×844 を撮る。
  `zz-shot.ts` は `src/main.ts` と同じ CSS を読み込み、URL の `screen=`・`map=`・`all=1`（全カード）などで状態を作る。作業が終わったら必ず消す

## 1. いまの状態

| 項目 | 状態 |
| --- | --- |
| 正式名称 | **ミストラルモンスターズ バトルカード**（Mistral Monsters Battle Card・短縮「ミストラルBC」。2026-10-24 ユーザー決定。本編もミストラルモンスターズ〔旧ミスティックモンスターズ〕）。旧称ミルティル・ミストリア・セイクリッドモンスターズ。リポジトリ名は **`mistral-monsters-battle-card`**（2026-10-24 ユーザーが GitHub 上で改名。`docs/rename-migration.md`） |
| アプリのアイコン | 2026-10-23 に新しい正式アイコンへ差し替え（原本 `assets/images/icons/sacred-monsters-bc-official-icon-v2.png`。作り方は `assets/README.md`）。タイトル画面のアイコンも同じ |
| 公開URL | **https://shunyamita0804-source.github.io/mistral-monsters-battle-card/** （`main` の `19162f7` を公開。2026-10-26 夜：ダンジョン試作〔太古の遺跡をランダム生成・手探り探索に〕。その前は `24fd622`：2026-10-26：ノビトン正式14技・初期配布16枚・黄色の枠のバトル用カード・ダンジョンの挿絵。その前は `887b490`：2026-10-26：世界地図は印を押すだけで出発・太古の遺跡と精霊の森・入ったときの挿絵を画面いっぱいに。その前は `a565d0b`：2026-10-26：建物に入った瞬間に BGM が鳴るように（iPhone）。その前は `b2ebc8e`：2026-10-26：主人公選びを2回押しで決定・始めたあとの「ようこそ」の説明をやめた。その前は `64b16c8`：2026-10-26：ダンジョン2つ（月影の遺跡・精霊の森。仮名）・入ったときの札・BGM 8曲・仮ジオルと仮フルーネ・配る音1つ・相手の手番をゆっくりに。その前は `64bb7ce`：2026-10-26：対戦画面の見直し2回目（手札の名前・緑の枠をやめて縦長の枠・大きなカード・相手の情報は右・相手のカードは相手の場所で）と配る音。その前は `6a4cada`：2026-10-26：対戦画面の手応え（手札の絵・大きさ・持ち上げ・配るときに裏から表へ・相手のカードを大きく裏から表へ・音3つ）。その前は `44b693b`：BGM 4曲の差し替え。その前は `6c81fa7`：2026-10-26：デザイン第11弾10枚（遊び方の挿絵・ルールの図・特別復元・ボス戦の背景・相手の番の札・提供割合の表・図鑑の割合・世界地図・設定・タイトルのボタン）。その前は `4d28f6e`（2026-10-26）：2026-10-26：デッキ編集を PS版のように3段に・デザイン第10弾10枚・ラズック正式14技と紫の枠。その前は `152c840`（2026-10-26）：2026-10-26：タイトル画面のアイコンを消してロゴの位置を調整・新しいタイトル背景。その前は `de1fbf8`（2026-10-26）：デザイン第9弾10枚（タイトルロゴ・対象の矢印・戦闘不能の印・状態のアイコン・ライフのゲージ・帯と欄の枠・マナの光・手札の印・練習試合の背景・ダンジョンの案内板）。その前は `cfbc6a7`（2026-10-26）：対戦画面の配分（情報をモンスターの列の左へ・上の帯で手番と経過を流す）・ソラモ14技の絵 Art Ver.2。その前は `b83dd4f`（2026-10-26）：カードショップの自動ドアの音・大会会場は出入りとも鉄の扉の音・建物を立体的に（案B）・NPC をなじませて呼吸の動き。その前は `d0599f0`（2026-10-26）：大会会場の鉄の扉と音・ガウル14技・デザイン第8弾10枚・カードショップの新しい絵・街の色の調子（弱め）。その前は `ba4ed74`（2026-10-25）：ソラモ14技・技カード新UI v5・場のモンスターをバトル用カードに。その前は `1087be5`（2026-10-25）：ミュロル16技・バトル画面リデザイン（PS版風）。その前は `e88f24f`（2026-10-25）：女性主人公の走り4方向を新しい絵に〔かがまない・足と腕が1歩ごとに交互〕。その前は `17559b9`（2026-10-25）：女性主人公の歩き4方向を新しい絵に。その前は `883b560`（2026-10-25）：正面・背中の歩きで腕も交互に振る〔左右反転した見本から画像AIが描き直した絵。正面はかばんが1歩ごとに左右へ移る〕。その前は `ac9787d`（2026-10-25）：人物が浮いて見えるのを直した〔影・縁取りなし・色〕。その前は `ac48e3e`（2026-10-25）：正面の歩きの左右の足を交互に〔腰から下の左右反転 `tools/art/front_flip_walk.py`〕・横の歩きの足・帽子と服の青を立ち絵に〔`tools/art/blue_tone.py`〕。その前は `be4e56e`：歩幅とコマの時間を新しい絵に合わせた。その前は `2ece98c`（2026-10-25）：男性主人公の4方向の立ち・歩き・走りを描き直した絵に（同じ頭の大きさ・背・色）・ノビトン。その前は `845008f`：立ち・歩き・走りの大きさと色味の統一（2回目）。その前は `f910b68`：試遊の直し5点。その前は `1cb1cd7`（2026-10-24）：人物の大きさを1コマずつそろえた版・NPC の横幅・女性の走り。旧 …/sacred-monsters-battle-card/ と …/mirtill-monsters-battle-card/ は 404） |
| リポジトリ | https://github.com/shunyamita0804-source/mistral-monsters-battle-card （Public。2026-10-24 ユーザーが改名。旧名 sacred-monsters-battle-card・mirtill-monsters-battle-card） |
| 最新版 | `main`（`19162f7` を公開済み＋引き継ぎメモ）。作業ブランチ `claude/dungeon-run-20261026` は main に取り込み済み。テスト 481件。作業ブランチ `claude/nobiton14-20261026`・`claude/dungeon-intro-art-20261026` は main に取り込み済み。テスト 463件。作業ブランチ `claude/worldmap-intro-20261026` は main に取り込み済み。作業ブランチ `claude/bgm-ios-pool-20261026` は main に取り込み済み。作業ブランチ `claude/newgame-twotap-20261026` は main に取り込み済み。作業ブランチ `claude/dungeons-bgm-20261026` は main に取り込み済み。テスト 459件。作業ブランチ `claude/battle-layout2-20261026` は main に取り込み済み。作業ブランチ `claude/battle-feel-20261026` は main に取り込み済み。作業ブランチ `claude/bgm-yufuruka-20261026` は main に取り込み済み。作業ブランチ `claude/ui-quality11-20261026` は main に取り込み済み。作業ブランチ `claude/ui-quality10-20261026` は main に取り込み済み。テスト 449件。作業ブランチ `claude/title-20261026` は main に取り込み済み。作業ブランチ `claude/ui-quality9-20261026` は main に取り込み済み。作業ブランチ `claude/battle-layout-20261026`・`claude/soramo-artv2-20261026` は main に取り込み済み。2026-10-26 の作業ブランチ `claude/ui-quality8-20261026`（`claude/gaul14-20261026`・`claude/arena-iron-door-20261026`・`claude/ui-quality8-prompts-20261026` を順に重ねたもの）は main に取り込み済み。テスト 444件。作業ブランチ `claude/soramo-battlecard-20261025` は main に取り込み済み。作業ブランチ `claude/myurol-16-skills-20261025`（ミュロル）・`claude/battle-redesign-20261025`（リデザイン。パートごとのコミット【A】〜【D】）は main に取り込み済み。テスト 433件 |
| ソラモ14技・技カード新UI（2026-10-25・`ba4ed74` で公開・**iPhone 確認待ち**） | ソラモの技を新しい14技に（`skl-soramo14-01〜14`、正本 `src/data/official/soramo14_skills_OFFICIAL_20261025.json`、絵 `sor14_sk_NN.png` は無改変）。旧16技は削除（セーブ version 9 で所持・デッキから外し、初期配布16枚〔02・03・04・07・09・10・11・13 を2枚ずつ〕を配る）。吠える＝相手の手札からランダムに1枚捨てる（新しい効果 `discardRandom`）。初期デッキ＝ソラモ16＋残り2体分29枚（仮：ラズック）＋サポート15枚（仮）。**技カードの表示はすべて新UI v5**（`skillCard.ts`。図鑑・デッキ編集・ガチャ・詳しい表示・対戦）。旧V4 の部品は `design-parts/ui-skillcard-v4-retired/` に退役。対戦の場のモンスター＝バトル用カード（800×920。まだソラモだけ。ほかは同じ縦横比のアイコン）、タップで正式カードの絵（名前・LIFE 入り。無いミュロルはいままでの詳しい表示）（2026-10-25 ユーザー指示）。その前：特殊の「効果」・相手の手札を裏向きでカメラ追従 |
| 歩き・走り（2026-10-24・公開済み） | 主人公は男女とも **4方向（正面・背中・左・右。右は左の反転）×「歩き8コマ＋走り8コマ」**。斜めに進むときは横の絵（ユーザー「斜めは無しで四方向に」）。シート `assets/images/characters/player_{male,female}_sheet.webp`＝9列（8コマ＋立ち）×8行（歩き4＋走り4）・1コマ 310×360。作り方：`python3 tools/art/adult_walk_build.py design-parts/characters-adult player_male assets/images/characters/player_male_sheet.webp --scale 1.25 --outline 2 --wide 248 --match-heads`（女性も同じ。1人10〜15分。scipy・OpenCV が要る）。原本は `design-parts/characters-adult/motion-v2/`（`{ID}_{向き}_walk_{r,l}.png`・`{ID}_{向き}_run8.png`）。頭の大きさを1コマずつ立ち姿にそろえる（男性 ±1.8%・女性の後ろ姿は帽子の幅）。歩く速さ 185・走り 315（論理px/秒）、1歩は絵に合わせて 歩き0.38・走り0.7（`src/game/world/walkAnim.ts`）、人物の表示 `FIGURE_ZOOM` 1.55・横 `FIGURE_WIDEN` 1.1（主人公も NPC も）。依頼文一式 `docs/design/walk-run-v3-20261024/`、受け取りの記録は同じフォルダの `10_RESULTS_UTF8.txt` |
| 主人公の見た目（2026-10-25・`e88f24f` で公開） | **男女とも**4方向の立ち・歩き・走りを描き直した絵（頭の大きさ・背・色をそろえた。男性はユーザー「容姿は合格」、女性の歩き・走りはユーザー OK）。画像AIは上の段と下の段（右足の1歩・左足の1歩）を同じ絵に描きやすいので、**正面・背中は「1歩としてつながる4コマを選び、人物だけ左右反転した見本」**を作って写させるか、Claude が反転して組む（女性は頭だけ元の向きに戻してリボンの位置をそろえた）。かばんは1歩ごとに左右へ移る（男女とも。ユーザーに説明済み）。**横は反転できない**ので、同じ会話で「下の段だけ手前と奥の足を入れ替えて」と頼み、正しいコマを使う。男性の走りは画像AIが沈んだ形に描いたので腰から下を伸縮。女性の走りは「かがまない」が守られた。背景は最初から緑一色（#00FF00）で頼むと切り抜きやすい。記録と手順は `docs/design/walk-unified-20261025/10_RESULTS_UTF8.txt`（依頼文・見本は同じフォルダの male/・female/）。道具：`tools/art/unified_build.py`（届いた絵→シートの1行。`--one-scale`・`--ratio` は帽子の照合が外れるとき）・`front_flip_walk.py`・`blue_tone.py`（男性の青だけ）・`ground_figures.py`（下の行） |
| 操作（2026-10-25） | 建物の中・ダンジョンは走らない（街だけ）、上下左右の4方向だけ、タップでは歩かない（近くの人・家具だけ話す/調べる）、スティック 208px・「調べる」144px |
| 歩幅とコマの時間（2026-10-25） | 1歩の長さを向きごとに（`walkAnim.ts` の `STEP_BY_VIEW`：横 歩き0.44・走り0.68〔絵で測った〕、縦 歩き0.5・走り0.8〔Claude の判断〕）。横はコマごとの表示の長さも（`SIDE_FRAME_WEIGHTS`） |
| 人物が浮いて見える（2026-10-25・ユーザーが見本 D を選択・`ac9787d` で公開・**iPhone 確認待ち**） | ①足元の影の真ん中を足の裏の線に・平たく（`worldScreen.ts` の `#addShadow`・`world.css` の `.world__shadow`） ②黒い縁取りを外す ③コントラスト 0.93・明るさ 0.95・足元を最大 28% 暗く（②③は `tools/art/ground_figures.py`。主人公2人と NPC 10人のシート。元の縁取りありのシートは `design-parts/characters-adult/sheets-outlined/`。**ほかの道具でシートを作り直したら、その出力を sheets-outlined/ に上書きしてからもう一度かける**） |
| 公開する版 | `main`。作業はブランチで行い、確認後に `main` へマージしてから公開する |
| 本編 | `mystic-monsters`（育成ゲーム本編）は**変更禁止**。素材の利用だけ許可済み（読み取りのみ） |
| バトルのルール | **PS版『モンスターファーム バトルカード』準拠。変えるのは3点だけ**：山札60枚・ガッツを「マナ」と表記・全体カードとブリーダー（プレイヤー）カードを「サポート」に集約（ユーザー決定。`docs/battle-rules.md`） |
| 街・部屋 | 大人向けの描き直し（2026-10-23 納品の36枚）を公開済み。部品の原本は `design-parts/seimon-world/`、組み立ては `tools/design/seimon_world_build.py`（`assets/images/maps/` と `src/data/worldArt.generated.ts` を作る） |
| デザインの方向 | **もう少し大人向けにする**（2026-10-23 ユーザー方針。いまの街などは小学生向けの見た目、という評価）。2026-10-23 にゲーム側でやったこと（main に反映・2026-10-23 に `7f0aa2b` を公開）：確認の窓をすべて「はい／いいえ」に、画面の色を濃い灰色＋くすんだ金に（紫・明るい黄色をやめた。`src/style.css` ほか）、ボタンの角を控えめに、タイトルを明朝体に、街・部屋・人物の絵に色の調整（`world.css` の `filter`：彩度 0.72）、ひらがなの多い言葉を漢字に（最初から／続きから・調べる など）。絵そのものの描き直しは依頼一式 `docs/design/adult-redesign-20261023/`（まず主人公の家1枚 → 比較 → 残り）。→ 2026-10-23 に描き直しが届き、街・部屋・家具の `filter` は外した（人物だけ残す。作業ブランチ） |
| 登場人物の年齢 | **主人公（男性・女性）と案内役は20代前半、ほかの人は20代〜50代**（子ども・お年寄りは出さない。2026-10-22 ユーザー決定）。主人公の選択は「男性／女性」。描き直しの依頼一式は `docs/design/characters-adult-20261022/`（AIには設定画・正面の立ち姿・歩き3枚〔1枚に3ポーズ〕だけ頼み、右向きの反転・切り抜き・コマ並べは Claude） |
| 人物の歩行の絵 | 大人の人物（主人公2人・案内役・店員・研究員・受付・先生・住人A〜E）を公開済み。原本は `design-parts/characters-adult/`、ゲーム用シートは `tools/art/adult_walk_build.py --scale 1.25 --outline 2`（主人公は `--diag` も。1コマ 270×360・WebP。2026-10-23 に色の落ち着かせ `--tone` をやめ、暗い輪郭 2px を付けた）。いまは4方向（右は左の反転）×「右足前・立つ・左足前・立つ」。主人公は斜め4方向も（下の行） |
| 序盤イベント | 公開済み。案内役（となりの家の女性）の会話の絵6表情・歩行の絵は正式。名前は仮の「隣家の女性」のまま |
| 直近の公開 | **`7f44c0a`（2026-10-24）：男性主人公の4方向の歩き8コマ・ガウル16技・ラズック改訂（いたずら・クロスガード削除）・回避の条件・バトルの音と演出・カメラ。iPhone 確認待ち（ユーザーは新しいタスクのあとで試遊）。** その前は **`199853b`（2026-10-24）：男性主人公の正面の歩きを1周8コマ（着く・沈む・足を運ぶ・伸び上がる。第2版の絵 `docs/design/motion-v2-20261024/`）に。iPhone 確認待ち。** その前は **`35b2c69`（2026-10-24）：歩き方の改善（体の縮み・前傾き・足の速さ）・画面の高さの補正の取り消し（画面の下が切れたため）・第7弾の描き直し6枚（両端の飾りなし）。iPhone 確認待ち。** その前は **`44b33e2`（2026-10-24）：改訂R2 フェーズ1（下の黒い帯の補正・ダンジョン 1.5 倍／街 1.15 倍とカメラ・人のまわり〔重ならない・「話す」・こちらを向く〕・スティックの輪）。iPhone 確認待ち。** その前は **`e1b48d9`（2026-10-24）：対戦画面の改訂R2（相手の手札を同じ大きさの裏向きで上に・操作のボタンは自分のモンスターの右・左右の欄は細くアイコンなし）。iPhone 確認待ち。** その前は **`8641fd1`（2026-10-24）：歩く人物（浮かない・クルクル回らない・足元の影）と、「コマンド」の一覧から攻撃終了を押してもマナ化へ進まない不具合の修正。iPhone 確認待ち。** その前は **`d8d3805`（2026-10-23）：ラズック（技16種・テスト用の編成）と対戦画面の見直し（相手の手札は裏向き・情報の箱は端・コマンドは自分の情報の下・相手のひと言）。iPhone 確認待ち。** その前は **`9a39707`（2026-10-23）：デザイン第6弾・第7弾・新しいアイコン。iPhone 確認待ち。** その前は **`9b6494b`（2026-10-23）：世界地図。** その前は **`b1fabc5`（2026-10-23）：効果音の第1弾16音・第2弾20音（足音・ドア・門・階段・宝箱・レジ・お金・水滴）。iPhone で音量の確認待ち。** その前は **`76cb030`（2026-10-23）：手応えの改善7点（上の行）。iPhone 確認待ち（人物の呼吸の動き・揺れでコマ飛びが出ないかも）。** その前は **`9a4bb5c`（2026-10-23）：デザイン第4弾10枚（対戦の枠・アイコン・販売機・スティック・ボスなど）と、研究員・先生・大会の対戦相手6人の顔の絵。iPhone 確認待ち。** その前は **`dd48eac`（2026-10-23）：デザイン第2弾10枚（ダンジョン・勝ち負けの帯・ランクの紋章・街の上の部品など）と住人5人の顔の絵。iPhone 確認待ち。ダンジョンの対戦の背景を新しい地下の絵にしたことの採否もユーザー確認待ち。** その前は **`57d6d5a`（2026-10-23）：ソラモの正式カード16種・モンスターカード・テスト用に仮カードをソラモへ・画面のデザイン10枚。iPhone 確認待ち。** その前は **`004eb5a`（2026-10-23）：主人公の斜め向きの歩き。iPhone 確認待ち。** その前は **`9daccb6`（2026-10-23）：コマ飛び対策・主人公の横幅 1.1 倍。** その前は **`07a768c`（2026-10-23）：人物1.2倍・走る・なめらかな歩き出しとカメラ。** その前は **`a2b5b51`（2026-10-23。ユーザーの「公開して」による）：歩きのカクつきの修正。** その前は **`bd4fcb4`（2026-10-23。ユーザーの「公開して」による）：大人向けの街・部屋・人物・歩き方（作業ブランチ `claude/happy-bardeen-1jlos0` を main にマージ）。**ユーザーの iPhone 確認 OK（2026-10-23）**。その前は `7f0aa2b`（2026-10-23）：大人向けの見た目（確認の窓をすべて「はい／いいえ」・ふつうのボタン・落ち着いた色・言葉づかい・街の絵の色調整）。**ユーザーの iPhone 確認 OK（2026-10-23）**。その前の公開は `d4ac1a2`（詰めた街＋ミスモン素材） |
| ミスモン素材 | 2026-10-22（公開済み）：BGM 7曲（`src/ui/bgm.ts`。タイトル・街・大会の受付・大会の対戦・ダンジョン・対戦・ボス）、ダンジョンの対戦の背景（階ごと）と宝箱の絵・開く動き、大会の景品のアイコン、金貨。ボタン（青・赤の金枠）は 2026-10-23 にユーザー指示でやめ、ふつうのボタンに戻し、タイトルの「はじめから」の確認は「はい／いいえ」に（main に反映・2026-10-23 に `7f0aa2b` を公開）。モンスター・技・NPC・闘技場の背景などは**使わない**（ユーザー指示）。調査の一覧は `docs/mismon-reuse-candidates.md` |
| 歩き方（公開済み） | 2026-10-23 に3回公開（`a2b5b51`→`07a768c`→`9daccb6`）：マスごとに1コマ止まっていたのを直す、地図の位置を画面の画素でそろえる、人物 1.2 倍（`FIGURE_ZOOM`）・主人公の横幅 1.1 倍（`PLAYER_WIDEN`）、走る（スティックを大きく倒す 36px 以上で 1.7 倍。パソコンは Shift。走る絵は無いので歩きの絵を大きな歩幅で）、歩き出しの加速・止まる前の減速、カメラが少し遅れて追う（`CAMERA_FOLLOW`）、iPhone のコマ飛び対策（人物の色調整を絵に焼き込み、主人公を別の層に、毎コマの余計な書き換えを減らす）。**コマ飛び対策の効果は iPhone で未確認**（作業環境の Chromium では再現しなかった）。すべて `src/ui/screens/worldScreen.ts` |
| 斜め向きの歩きの絵 | **公開済み（`004eb5a`。2026-10-23 ユーザー「いま渡しているもので全部。反映して」）**。主人公だけ、斜めに進むと斜めの絵（左下・右下・左上・右上。右は左の反転）。シートは8行（正面・背中・左・右・左下・右下・左上・右上）×5列、`tools/art/adult_walk_build.py … --scale 1.25 --tone --diag` で作る（斜めは1枚ずつ背の高さをそろえる）。原本は `design-parts/characters-adult/player_{male,female}_{downleft,upleft}_{stand,rightfoot,leftfoot}.png`。女性の斜め前の右足前は新しい版（旧 v3）を採用し、前の版は `_old` で保管。**女性の斜め前の左足前は最初に届いた版**（足の前後は正しいが、少しねじれて見える。作り直しは届かなかった）。ゲームの向き（セーブ・「しらべる」）は上下左右のまま、絵だけ8方向（`worldScreen.ts` の `#diag`）。シートが2倍の大きさ（1350×2880）になったので、iPhone でコマ飛びが出ないかは未確認 |
| 画面のデザイン10枚 | **組み込んだ（2026-10-23）**：タイトル背景・大会の対戦背景・カードの裏面・共通背景・窓の枠・見出しの帯・一覧のパネル・店員と受付の顔・パック3種。CSS は `src/ui/styles/uiFrames.css`、記録は `docs/design/ui-quality-20261023/10_受け取り結果_UTF8.txt` |
| デザイン第2弾10枚 | **組み込んだ（2026-10-23）**：ダンジョンの床・壁の上面・壁の正面・階段・魔物のしるし、ダンジョンの対戦の背景（ミスモンの野外の背景から入れ替え。ファイルは残してある）、勝ち負けの帯、ランクの紋章（ベッド画面）、街の上の札と丸いボタン、パックを開けるときの光。記録 `docs/design/ui-quality2-20261023/10_受け取り結果_UTF8.txt` |
| 住人5人の顔の絵 | **組み込んだ（2026-10-23）**：住人A〜Eに話しかけると会話の窓の右上に顔の絵（正方形・196px）。記録 `docs/design/faces-residents-20261023/10_受け取り結果_UTF8.txt`。同じ形で研究員・先生・大会の対戦相手もあとから頼める |
| 研究員・先生・大会の対戦相手の顔の絵 | **組み込んだ（2026-10-23）**：研究員＝図鑑の上、先生＝練習テーブルの会話（台詞は仮）、対戦相手6人＝大会の勝ち抜き表と対戦の相手の欄（`src/ui/components/opponentFace.ts`）。人物像は Claude の仮の案、名前は未定 |
| 手応えの改善（2026-10-23） | ユーザーの試遊の感想「人物の存在感が薄い・チープ・スーッと終わる」を受けて7点：①人物の色を戻し輪郭と濃い影 ②対戦で使ったカードを真ん中に大きく見せる（`battleScreen.ts` の showcase。技のアニメーションではない）・相手の1手の間 0.65→1.1秒 ③立っている人の呼吸のような動き（話しかけるとこちらを向くのは前から） ④場のカードを大きく（74→88）・中段は窓の枠・何も選んでいないときは直前に使われたカード ⑤ボタンの音（素材なし・その場で作る短い音 `sound.tap()`）と沈み込み、命中で画面の揺れと一瞬の間 ⑥店員・受付・研究員がひと言しゃべってから画面を開く（台詞は仮） ⑦見出し・ボタン・名前などを明朝体に |
| デザイン第6弾5枚 | **組み込んで公開（2026-10-23）**：カードを見せる光の帯・ターンの帯・ダメージと回復の数字・話しかけられる人の印・調べられる物のきらめき。記録 `docs/design/ui-quality6-20261023/10_受け取り結果_UTF8.txt` |
| デザイン第7弾10枚 | **組み込んで公開（2026-10-23）**：すべてのボタン・タブ・戻る・枚数の増減・音量・説明の台・世界地図の印・対戦の上のボタン（CSS `src/ui/styles/uiParts.css`、切り出し `tools/design/ui67_build.py`）。2026-10-24 に「両端の飾りなし」の描き直し6枚が届いて差し替え済み（`docs/design/ui-quality7fix-20261023/10_受け取り結果_UTF8.txt`） |
| 効果音の追加（2026-10-23・公開済み `b1fabc5`） | ユーザー提供の音（すべて利用確認済み）。第1弾75音のうち16音：カードの見せ場・倒れた・回復・反動・対戦の始まり・勝ち負け・パック・ごほうび・欠片。第2弾31音のうち20音：足音（街＝石畳・南の道＝土・建物の中＝板・ダンジョン＝砂利）、建物のドアの開け閉め、ダンジョンの門（入る・帰る）、階段、宝箱（鍵→ふた）、レジ、お金、ダンジョンの水滴（環境音）。ダンジョンごとの足音・環境音は `worldScreen.ts` の `DUNGEON_SOUND`（水・雪・砂のダンジョン用の音も用意済み）。記録 `docs/audio-credits.md` 末尾 |
| デザイン第4弾10枚 | **組み込んだ（2026-10-23）**：対戦の情報箱の枠・手番の帯・アイコン、図鑑の未入手カード、パックの販売機、主人公選びの背景、ショップ・大会受付・図鑑の場所の絵、スティック、ボスのしるし、景品の光の輪。記録 `docs/design/ui-quality4-20261023/10_受け取り結果_UTF8.txt` |
| 正式カード（ソラモ） | **2026-10-23 初めての正式カード**：ソラモ（ライフ7）と技16種。正本 `src/data/official/soramo_cards_OFFICIAL.json`、読み込み `src/data/soramo.ts`、ID 対応 `docs/card-data-policy.md` 5章。技の種別（ちから・かしこさ・特殊・防御・回避）・マナ0・数値なしの技に対応（`cardTypes.ts`・`engine.ts`・`skillCard.ts`）。テスト `tests/soramo.test.ts`。**テスト用**：ユーザー指示「仮のカードはすべてソラモに」で、スターター・相手をソラモ3体に、セーブ version 6 で旧セーブもソラモのデッキへ（仮カードは残す）、同じモンスターの重複を可に。**未定（決めていない）**：技カードのレアリティ、正式のスターター内訳・配布・パック・価格・入手場所、効果の裁定3点（`docs/battle-rules.md` 末尾）、英語の正式訳（いまは仮訳）。ガウル・ラズックは絵を登録だけ（`src/data/registeredMonsters.ts`） |
| 正式カード（ノビトン） | **2026-10-25 組み込み（`2ece98c` で公開・ユーザー確認待ち）**：ノビトン（ライフ8）と技16種（`src/data/nobiton.ts`・正本 TSV `src/data/official/nobiton_skills_OFFICIAL_20261025.tsv`・写し JSON・原本 `design-parts/cards-original/nobiton/`・テスト `tests/nobiton.test.ts`）。新しい効果：相手マナ−n（くしゃみ・ダウナーミスト）・次ターン行動不可（まきつく）・手札の引き直し（考える）・相手の手札の確認（不思議な嗅覚。対戦画面に表を見せる窓）。初期8・収集8はユーザー確定。**未定**：枠色（仮 `#E8C654`）・レアリティ・英語（仮訳）・配布枚数・パック・敵の編成（スターター・パック・相手には入れていない）。裁定は `docs/battle-rules.md` 末尾 |
| 正式カード（ラズック） | **2026-10-23 組み込んで公開（`d8d3805`）**：ラズック（ライフ6）と技16種（`src/data/lazuck.ts`・正本 `src/data/official/lazuck_cards_OFFICIAL.json`・テスト `tests/lazuck.test.ts`）。新しい効果：みだれづめ（回避されない）・ちょうはつ（次の手番ラズックにしか攻撃できない）・ダストキック（次の手番だけちから技−1）・軽減と限定回避。**用途は未定**（ユーザー「後から決める」）。**テスト用**：ソラモだけだった所にラズックも（スターター＝ソラモ・ラズック・ソラモ、相手は交互。セーブ version 7）。**初期・収集の配分が食い違い**（全体方針 8/8、1枚ずつの指定を足すと 10/6〔01〜08・11・14 が初期〕）＝ユーザー確認待ち。ちょうはつ・ダストキックの細かい裁定は `docs/battle-rules.md` 末尾 |
| 対戦画面の配置（2026-10-23・公開済み `d8d3805`） | ユーザー指示で3回見直し：相手の手札は**裏向き**。情報の箱は端に（相手＝右端・自分＝左端）、モンスターは残りの真ん中（幅 72）。**コマンドは自分の情報の下にまとめる**（使う／やめる／マナにする／ターン終了＋「コマンド」で一覧＝攻撃終了・ルール・降参。PS版の×ボタンのコマンド一覧にならう）。中段は高さを縮め、大きなカードは幅 132 に固定。相手のひと言は**顔の絵と吹き出しを大きく、場のカードの上に重ねて**約2.6秒（押すと消える。台詞は仮）。`battleScreen.ts`・`battle.css` 末尾 |
| 対戦画面の改訂R2（2026-10-24・公開済み `e1b48d9`・**iPhone 確認待ち**） | ユーザーの ZIP「Seimon_Claude_BattleLayout_R2_20261024」のフェーズ2だけ実装：相手の手札を自分と同じ大きさの裏向きで上に（実枚数・中身は出さない・引く/使う/マナ化で動く）、モンスターを 72→58（72/58/54 を比較）→ユーザー指示で左右の欄を細く・アイコンなしにして 66、手札（自分・相手とも）62→66、相手の列は 左＝状態・右＝マナ/山札/手札/捨札、真ん中の帯に最新の経過1行（押すと全部）、操作のボタンは自分のモンスターの右（ユーザー指示「下すぎて操作感に問題」で、いちばん下から移した。自分の列は 左＝マナなど・右＝ボタン）。ルール・カード・セーブ・画像は変更なし。記録と受入テストの結果は `docs/battle-layout-r2.md`、比較画像は `docs/design/battle-layout-r2-20261024/`。**フェーズ1（街・ダンジョン・NPC）は未着手**（動画4本・前の ZIP が届いていない） |
| 歩く人物の見え方（2026-10-24・公開済み `8641fd1`） | ユーザーの試遊「プカプカ浮いて見える」「指でなぞるとクルクル回って、切り抜いて貼った絵のようでチープ」から：立っている人の呼吸の動きをやめた（`world.css`）、歩くときの体の上下（弾み）を 0 に、足元の影を広く濃く・少し下へ（接地の影）。向き：壁ぞいにすべるときも押している向きの絵のまま（斜めと正面の絵が1歩ごとに入れ替わっていた）、進めない向きへは 0.22 秒押し続けたときだけその場で向く（`worldScreen.ts` の `TURN_IN_PLACE_MS`） |
| 世界地図 | **2026-10-23 作って公開（`9b6494b`）**（ユーザー案）：街の南の出口・家の壁の地図で開く画面を、ミスモンの世界地図（ユーザーが送った文字のない版。`assets/images/ui/worldmap/world_map.webp`）に。地方の名前6つ（ミスモン本編と同じ：フェルナ・ノルディス・アステリア・オルティガ・セイラン・ネブラシア。英語は仮訳）を絵の上に重ね、舞台の**フェルナ地方**は金色。街（現在地）とダンジョンを丸い印で置き、押すと下に説明。**南の出口からは出発できる・家の壁の地図は見るだけ**（それまでは家からも出発できた）。ダンジョンは各地方に置く方針（例：雪のダンジョン＝ノルディス地方）。印の位置・名前は**仮**（`src/data/worldMap.ts`）。画面は `dungeonSelectScreen.ts` |
| 正式カード（ミュロル） | **2026-10-25 組み込み・`1087be5` で公開（ユーザーは画像を見て OK）**：ミュロル（水系・ライフ7）と技16種（`src/data/myurol.ts`・正本 JSON `src/data/official/myurol_skills_OFFICIAL_20261025.json`・原本 `design-parts/cards-original/myurol/`・テスト `tests/myurol.test.ts`）。技の絵は**原本のまま**（PNG・JPEG を変換しない。ファイル名だけ `myu_sk_NN`）。新しい効果：しめったはだ（2手番、受けるちから技−1）・みずあび（自分を回復）・スリップガード（必要マナ3以上の攻撃にだけ使える防御）・すべってよける（必要マナ2以下の攻撃にだけ使える回避）。**初期／収集の区分は案のまま**（ゲームでは使わず画面にも出さない）。**未定**：モンスターカードの絵（届いていない・仮の絵）・枠色（仮 `#7EC4E8`）・レアリティ・英語（仮訳）・配布・敵の編成。裁定は `docs/battle-rules.md` 末尾 |
| バトル画面リデザイン | **2026-10-25 公開（`1087be5`）・iPhone 確認待ち**：PS版風。モンスターは正方形のアイコン（切り抜き位置 `src/data/monsterPortraits.ts`）、技カードの表面はマナ左上・威力右下（`src/ui/components/battleCard.ts`。対戦画面だけ）、技を使うとフォーカスエリアに大きく出して「誰が誰に」の1行（`SHOWCASE_MS` 1.2秒・タップで次へ）、守備の選択はその下、装飾は細い銅色の枠と紺の背景（`src/ui/styles/battlePs.css`）。相手の手札の裏向き表示・カメラの寄りはやめた。仮に決めたこと・気になっている点は `docs/battle-redesign-20261025.md` |
| ソラモのバトル用カード・特殊技の表示 | **2026-10-25 作業ブランチ `claude/soramo-battlecard-20261025`（未マージ・未公開）**：対戦中にソラモのアイコンをタップすると、正式素材のバトル用カード（共通背景→ソラモ→クリームの枠→名前・ライフはゲームが描く）を出す（`src/data/battleCards.ts`・`src/ui/components/battleMonsterCard.ts`）。枠は `tools/art/battle_card_frame.py` が正式採用の枠から市松模様と外縁の外の粒の透明度だけを変え、色替えマスクの所をクリームにして作る（原本 `design-parts/cards-original/soramo-battle-20261025/`）。技カードの数値の欄のきまり（攻撃＝ダメージ・防御＝盾と軽減値・回避＝「回避」・特殊＝「効果」）を `skillValueBadge`（`src/game/cards/cardFace.ts`）にまとめた。ソラモ14技の新データ・新しい技カードのテンプレートは**未実装**（手札の数字・セーブの移し方・初期配布の決定待ち） |
| ユーザーの決定（2026-10-25） | ①手札の数字の大きさは今のまま ②古いセーブのソラモのカードの移し方＝**削除**（新14技を入れるときに実装） ③初期配布・収集の分け方＝ユーザーが後で指示。対戦画面の技カードも、ソラモの技カード一式（指示）が届いたらすべて新しいUIのカードに替える。相手の手札の裏向き表示とカメラは、ユーザー指示で戻した（`claude/soramo-battlecard-20261025`） |
| 次の作業 | **新しいセッションでは、ユーザーの次の指示（新しいタスク）を待つ。** ユーザーの iPhone 確認待ち：⓪バトル画面リデザイン（PS版風）の見た目・操作と、仮に決めたこと（`docs/battle-redesign-20261025.md` 3章）①男女の歩き・走りで足と腕が交互に見えるか・カクカクしないか ②人物が地面に立って見えるか ③ノビトンの技。**気になっている点（ユーザーは「OK」で公開。直すのは頼まれたら）**：女性の横の走りは、着地の足の開きが男性より約2割大きい（足元の幅 ÷ 背 0.80 対 0.65）。1歩で進む長さ（`src/game/world/walkAnim.ts` の `STEP_BY_VIEW` 横・走り 0.68）は男女共通なので、女性は足が少しすべって見えるおそれ。直すなら女性だけ約 0.8 に（比較の動画 `docs/design/walk-unified-20261025/female/video/run_side_female_vs_male.mp4`）。女性の歩きは立ち姿より背が 5〜8% 低い（男性は 2〜4%）。候補（頼まれたら）：ノビトンの裁定の確認（`docs/battle-rules.md`「正式カード（ノビトン）」：まきつくの行動不可に守備を含めるか、回避されたら追加効果なし、など）・枠色（仮 `#E8C654`）。**注意**：主人公・NPC のシートを作り直したら、出力を `design-parts/characters-adult/sheets-outlined/` に上書きしてから `python3 tools/art/ground_figures.py` をかける（2回かけない）。作業環境の注意：`pkill -f "vite preview"` はコマンド自身にも当たってシェルが止まる（`ps -eo pid,args | awk '/vite preview --port 4173/ && !/awk/ {print $1}'` の PID を kill する）。scipy・OpenCV は `pip install scipy opencv-python-headless` |

## 2. これまでの作業（時系列・要点だけ）

1. 開発環境（Vite + TypeScript + Vitest、CI）→ スマホ向け基盤（390×844 の拡大縮小・画面遷移）
2. 夜間一括：名称「ミストリアモンスターズ バトルカード」、最小縦断体験（街 → 家でデッキ → ショップ → ダンジョン B1〜B3 ボス → 大会 → 報酬）
3. GitHub Pages 公開（Public 化はユーザー承認）。街の南の突き当たりにダンジョン入口
4. バトル画面：縦持ちの配置、伏せカード2枚で先攻・後攻、手札を1枚ずつ配る＋効果音
5. バトルルールの監査（`docs/battle-rules-audit.md`）→ PS版準拠へ5段階で改修（すべて `main` に取り込み・公開済み）
   - 1 マナ：自動で増えない・上限なし・カード1枚＝1マナ。攻撃のあとの「マナ化」で手札を何枚でもマナに。支払いは新しくマナにしたカードから捨て札へ
   - 2 ドロー：最初に手札5枚を引くのは先攻だけ。先攻1ターン目は攻撃なしでマナ化だけ（2枚まで）。後攻は最初のドローで5枚。
     ドローは5枚まで、5枚あれば山札の一番上を1枚マナに。引けなければ負け（効果のドローも）。手番の上限なし。同時全滅は攻撃側の勝ち
   - 3 守備：狙われたモンスターの防御・回避カードを何枚でも。守備を終えてからまとめてダメージ。回避＝0。攻撃の印「防御不可・回避不可・回避しても半分」
   - 4 サポート：仮サポート1〜3（すぐ効果・あわせて1ターン1回）、仮全体1〜3（場に1枚・入れ替わり）。パック1・2に収録、デッキ編集に「サポート」タブ
   - 5 デッキ：同じカードは3枚まで。スターターは技1〜6×3枚＋仮サポート6枚＝60枚。セーブ version 2（旧セーブは1回だけ不足カードを補填しデッキを組み直す）
6. 演出（ユーザー提供の PS版プレイ動画を参考。**技アニメーションは使わない**：ユーザー指示）
   - マナ化：カードが情報箱へ飛び、光って効果音。ダメージ：対象モンスターに衝撃の輪＋効果音
   - 守備待ちの対象にダメージ予定、場の全体カードを上の帯に表示、ターン・マナ化の切り替わりで帯の表示
7. 操作（ユーザー指示で何度か作り直した最終形）
   - 下の常設ボタンはなし。**必要なときだけ画面中央に帯を敷き、コマンドを縦に並べる**
   - ボタンはユーザー提供の金枠の画像（`assets/images/ui/button/`）に文字を重ねる。行うボタンは青、やめる／終えるボタンはワインレッド。控えめな見た目（150×51）
   - 確認は「はい／いいえ」を使わず、場面に合った文字（例：マナ化へ進む／攻撃を続ける）
   - カードを選ぶと「使う／やめる」、使えるカードがなければ帯に「攻撃終了」。ふだんの「攻撃終了」は上の帯の右端の小さなボタン（自分の攻撃中だけ）
   - マナ化は手札をタップで選んで「マナにする（N枚）」→「ターン終了」
   - 手札は指でなぞれる（2026-10-22・公開済み）：なぞると指の下のカードを中段に大きく出す。マナ化ではなぞったカードを
     まとめて候補に入れる（候補から始めると外す）。上へ持ち上げて離すと使う（マナ化では候補ごとマナに）。持ち上げて戻すと取り消し。タップは従来どおり

8. 次便（2026-10-22）：正式名称へ改名・正式アイコン（`public/icons/`。原本は `assets/images/icons/`）・日英切り替え（`docs/i18n.md`）・
   セーブの JSON 書き出し／復元・設定画面（言語・効果音・BGM〔将来用〕・ミュート・遊び方。タイトルとベッドから）・データ点検（`docs/card-data-policy.md`）
9. 街デザイン資料パック（2026-10-22）：ユーザーの ZIP（ChatGPT とのやり取りが行き詰まった街の設計）を受けて作成。
   設計図は `tools/design/seimon_town_pack.py` で作り、自動チェック（全玄関・出口へ歩ける、部屋の家具の前へ歩ける）付き。
   配布用 ZIP には参考画像（旧街・主人公素材）も入れる（リポジトリには画像を入れていない）
10. 序盤イベント（2026-10-22・公開済み）：ユーザーの ZIP「Seimon_Opening_Tutorial_DesignPack」（台本 V1・設計案）を実装。仮の街を新設計図に近い並びに作り直し
   （練習場・となりの家を追加、出入口・欠片・e2e の座標を更新）。会話 UI＝ミスモンの会話画像（`assets/images/ui/talk/`・`docs/audio-credits.md`）。
   通し確認は `tools/e2e/intro.cjs`（`flow.cjs`・`flow2.cjs` も新しい街に合わせて更新）
11. 歩く操作の作り直し（2026-10-22・公開済み）：画面のどこでも指でなぞると歩く（指を置いた所に半透明のスティック。4方向）。
   方向キーと下の帯をなくし、街を画面いっぱいに。「しらべる」は右下の半透明の丸（金のふち・虫めがね）。すべらせないタップは従来どおり
12. 正式素材の統合（2026-10-22・QA なしで公開：ユーザー指示）：街・7種類の部屋（家・となりの家・民家A〜E 共通・ショップ・研究所・大会会場・練習場）を正式な絵に。
   マスは設計図の 32px（街 150×150）、表示は設計図の 0.5625 倍。斜めも歩ける（8方向・角はすり抜けない。斜めの絵は無いので左右の絵）。
   主人公・案内役は正式な歩行の絵（216×288、約7コマ/秒、止まると待機の絵）。家具・人は足元の高さで前後を決める。
   効果音：回避成功・通常命中・強攻撃命中（仮：必要マナ3以上の技）・マナ消費をルールの結果で1回ずつ（`engine.ts` の `fx`）。旧 damageHit は廃止。
   マナ化はカードを裏返してから飛ばす演出に。セーブ version 4（街・部屋にいた旧セーブは主人公の家の前へ）。設定画面に素材のクレジット
13. 品質改善（2026-10-22・試遊動画を受けて。公開済み）：iPhone で左右に余白が出ないよう、ステージの論理幅を最大480まで伸ばす（`stageLayout.ts`）。
   場所を移るときの暗転と、絵を読み込み終えてから見せる処理・他の部屋の先読み。部屋は画面の高さに合わせて最大1.35倍に拡大し、まわりを暗い木の色に。
   人物の足元の影。草地の色むら・縁石・道のふちの陰・細かい石畳・空いた草地に木や花を自動で配置（`seimon_world_build.py`）。
   上の帯（場所の名前の札・金貨）・建物の看板・家具の名前の札・出口の印・調べられる物のとなりで「しらべる」が光る
14. 試遊の指摘（2026-10-22・公開済み）：男の子の背中で帽子の金の飾りがちらつく → 背中3枚から飾りを消した。横向きの足が動かない（4コマとも同じ形）→ 歩くときに体が少し弾むようにした（本当の直しは描き直し：依頼文 09）。
   会話の絵の髪が左右で切れている → 画面で両端をやわらかく消した（描き直し：依頼文 09）。街の看板が上の帯に隠れないように
15. 試遊の指摘2（2026-10-22・公開済み）：歩く・止まるで別の画像に切り替えていたため、iPhone で読み込み直しの間だけ主人公が消えていた →
   歩き4コマ＋立ち止まりを1枚にまとめたシート `player_{male,female}_sheet.png`（`tools/art/walk_passing.py` が作る）にし、画像は替えず位置だけ動かす。
   横向きの足が動かない → 届いた4コマ（全部足を開いた形）から、2・4コマ目を「足がそろう形」に作り替えた（足だけ真ん中へ寄せる。描き直しが届くまでの応急処置）
16. デザイン納品・優先A 環境8点（2026-10-22・公開済み）：草むら・小花・植え込みだけ使用（街に散らす・植え込みを入れ替え）。岩・広場の輪・会場前の飾り石・縁石は
   画風が合わないので不使用（理由と描き直しの一文は `docs/design/quality-pass-20261022/10_…`）
17. 手札を指でなぞる操作（2026-10-22・公開済み）：7章の最後のとおり（`battleScreen.ts` の「手札を指でなぞる」の部分）
18. マナ化専用の音（2026-10-22・公開済み）：ユーザーの ZIP「Seimon_ManaConvert_SE_EmergencyFix」。`engine.ts` の `fx` に `manaConvert`（手札→マナ・1枚1件）と
   `manaGain`（山札→マナ）を足し、音はマナの数の差ではなくこのきっかけで鳴らす。まとめてマナにするときは1枚ずつ着くたびにルールに渡す（音・絵・数がそろう）。
   飛んでいくカードは描き直しで消えないよう `fxLayer`（描き直しても外さない層）に置く
19. 人物の年齢（2026-10-22）：主人公・案内役は20代前半、ほかは20代〜50代。主人公の選択を「男性／女性」に（公開済み）。22歳版の歩く絵は大人に見えないので保留。
   描き直しの依頼一式（プロンプト日英・人物一覧12人・位置の目安の枠 T1/T2）を `docs/design/characters-adult-20261022/` に作り、ZIP でユーザーに渡した
20. ミスモン素材（2026-10-22・公開済み）：調査（`docs/mismon-reuse-candidates.md`）→ ユーザーが選んだものだけ使用：BGM 7曲（`src/ui/bgm.ts`・
   `tools/audio/make_bgm_loops.py`）、ダンジョンの対戦の背景（B1F 草原・B2F 海岸・B3F 火山）と宝箱（木・鉄・金、開く4コマ）、大会の景品のアイコン（金貨・勲章・小袋）、
   金貨（所持金の表示）、ボタン（2026-10-23 にやめて、`.btn--primary`・`.btn--danger` はふつうのボタンに戻した）。設定の BGM 音量・ミュートが効く
21. 部品の原本の保管（2026-10-22）：ユーザーが部品を消してしまったため、チャットの建物10枚と ZIP「Seimon_Town9_Room14_23Assets」で `design-parts/seimon-world/` に全部そろえた。
   いまの設計図で作り直して比べ、部屋は1ファイルも変わらない＝原本と確認。草むら・小花・植え込みの3枚だけ原本が無く、いまの街の絵から復元（同じ乱数で「3つだけ抜いた街」を作って差を取り、切り抜いた）
22. 街を詰めた（2026-10-22・公開済み）：ユーザー「街が広すぎ・移動が面倒」→ 設計図 4800→4032（`seimon_town_pack.py` の TOWN。住宅Dを東の通りの北の段へ、北東の小道をなくした）。
   建物の大きさは扉の高さ＝主人公の背たけで決めているので変えない（詰めても歩く時間は約2割しか減らない）→ 歩く速さも 1.25 倍（ユーザー選択）。家→大会会場 約11秒→約7秒。
   街灯は家と道の間に入らないので道の南側の芝生へ。欠片4つを新しい道の行き止まりへ。セーブ version 5（街にいたら家の前へ）
23. 街・部屋の大人向けの絵（2026-10-23・作業ブランチ）：届いた36枚で `design-parts/seimon-world/` を置き換えて作り直し。ベッドと本棚がくっついた家具の絵に切り分けの線、
   小物・草むらは元の大きさにそろえる処理を `seimon_world_build.py` に足した。街・部屋の色の調整（`filter`）は外した
24. 大人の人物（2026-10-23・作業ブランチ）：11人分が届き、女性主人公と案内役を入れ替え（`adult_walk_build.py`）。歩き方の調整（向きのちらつき・足のすべり）
25. 男性主人公（別便）・店員・研究員・受付・先生・住人A〜E を入れた。案内役は最初の練習試合のあと家へ。住人は仮の会話（2026-10-23・作業ブランチ）


（2026-10-23 夜）歩き方の改善を3回公開（上の「歩き方」）。斜め向きの歩きの絵を依頼・確認中（生成AIが斜めの「左足を前」で足をねじったり左右を取り違えたりしやすい。足の形の手本の画像〔正面と左向きの同じ足の絵・採用済みの対の絵〕を添付すると直りやすい）。画面のデザイン10枚を依頼。

## 3. 大事な約束（詳しくは CLAUDE.md）

- 指示書の範囲だけを実装する。終わったら止めて報告し、承認を待つ
- 指示の受け取り方：ユーザーは「ZIP に UTF-8 TXT の指示書1本」や、動画・画像・チャットで指示を出す
- カード・価格・提供割合・大会・敵編成・マップはすべて**仮**（`src/data/`）。仮カードは「仮」始まり
- 本編 `mystic-monsters` は変更しない。素材を使うときは読み取りでクローンし、`docs/audio-credits.md` や `assets/README.md` に記録する
- 公開は「公開して」と言われたときだけ。作業はブランチ → 報告 →「公開して」で main にマージして公開、の流れ（2026-10-22 はこれを何度も繰り返した）
- 通し確認の道具（`tools/e2e/*.cjs`）はいまの街では動かない（6章）。2026-10-22 以降、ユーザーは QA なしでの公開を了承している。公開前は `npm run check` と、画面を数枚撮って確かめる
- force push しない。報告・コメント・コミットメッセージは日本語。ユーザーは非エンジニア：報告は専門用語を避けて短く

## 4. 作業環境の手順

クラウドセッションでは開始時に Node 24 と依存関係が自動で入る（`.claude/hooks/session-start.sh`）はずだが、
**2026-10-22 は3つのセッションとも動かなかった**（Node 22 のまま・`node_modules` なし。原因は未調査。2026-10-26 も同じ）。手元の `main` が古いまま食い違っていることがある（2026-10-26）。マージ前に `git checkout -B main origin/main`。`node -v` が 24 でなければ：

```bash
# 作業用フォルダ（スクラッチパッド）に Node 24 を直接入れて使う
V=$(curl -sS https://nodejs.org/dist/index.tab | awk '$1 ~ /^v24\./ {print $1; exit}')
curl -sS -o node.tar.xz https://nodejs.org/dist/$V/node-$V-linux-x64.tar.xz && tar xf node.tar.xz
export PATH=$PWD/node-$V-linux-x64/bin:$PATH && npm install --no-audit --no-fund   # リポジトリで実行
```

```bash
npm run check            # 型チェック＋テスト（284件）＋ビルド
npx vite preview --port 4173 --host 127.0.0.1   # 画面の確認（ビルド後。バックグラウンドで動かす）
# 公開と同じ base で確かめるとき：npm run build:pages → npx vite preview --mode pages … → http://127.0.0.1:4173/mistral-monsters-battle-card/
```

- 街・部屋の絵を作り直すとき（8章）：Python の `scipy` が要る（`pip install scipy`）。1回 約3分。`python3 tools/design/seimon_world_build.py design-parts/seimon-world 確認画像の出力先`
  （部品は全部リポジトリにある。部屋は同じ部品から同じ絵になる＝変化なし）。設計図だけ試すときは `seimon_town_pack.py` の `town_mask()`・`town_checks()` を Python から呼ぶと、
  部品なしで「全部の玄関・出口へ歩けるか」を確かめられる
- 古い版と見比べたいとき：`git worktree add 作業用フォルダ main` で別の場所に取り出して作り直すと、作業中のブランチを汚さない（終わったら `git worktree remove --force`）
- BGM のファイルを作り直すとき：本編を読み取りでクローンして `python3 -I tools/audio/make_bgm_loops.py 本編/assets/audio/bgm assets/audio/bgm`（ffmpeg が要る。入っている）
- 人物のシートを作り直すとき：`python3 tools/art/adult_walk_build.py design-parts/characters-adult 人物ID 出力.webp --scale 1.25 --outline 2 [--npc] [--diag（主人公だけ）] [--idle 立ち絵.png]`（人物ID は player_male・npc_clerk など。`scipy` が要る）
- GitHub の MCP（公開のワークフロー実行に使う）は、セッションの途中でつながらなくなることがある。`ToolSearch` で `mcp__github__actions_run_trigger` を読み込み直すと使える
- ブラウザ確認：Playwright（`/opt/node-tools/node_modules/playwright`、Chromium は `/opt/pw-browsers`。`chromium.launch()` だけで動く）
  - 2026-10-22 夜のやり方：タイトル →「はじめから」→ 主人公を選ぶ（セーブができる）→ localStorage のセーブを読み、`location`・`story: {intro: 'skipped'}`・
    `activeDungeon` を書き換えて `addInitScript` で入れ直し → 再読み込み →「つづきから」。大会の受付は `{mapId:'hall', x:20, y:28, dir:'up'}` で「しらべる」、
    ダンジョンの敵は `{mapId:'dungeon-01-b2', x:7, y:5, dir:'up'}` で「しらべる」→「OK」→ 伏せカードを1枚。指の操作は CDP の `Input.dispatchTouchEvent`（`hasTouch: true`）
  - 音の確認：`HTMLMediaElement.prototype.play`（BGM）や `AudioBufferSourceNode.prototype.start`（効果音）を `addInitScript` で包んで、鳴らした順を記録する
  - `tools/e2e/flow.cjs`・`intro.cjs`・`flow2.cjs` は古い仮の街（1マス40px）向けで、**いまは動かない**。画面確認は短い Playwright のスクリプトを都度書く
    （iPhone のセーフエリア内と同じ 393×759・deviceScaleFactor 3 で撮ると、ユーザーの見え方に近い。セーブは localStorage の `mistria-battle-card/save` を
    `addInitScript` で入れると好きな場所から始められる）
  - 確認中に `npm run check`／`vite build` を動かさない（表示中のファイルが入れ替わる）
  - プレビューを止めるときは `pkill -f "vite previe[w]"`（`"vite preview"` と書くと自分のコマンドまで止まる）。
    **同じコマンドの中で pkill とプレビューの起動を書かない**（起動の文字に一致して自分ごと止まる）。起動はバックグラウンド実行で、時間の上限を長く（2時間）する
  - URL に `?qa=1` で QA 用ボタン（バトルのオート・即勝利、所持金追加など）
- 本編の素材を見るとき：`GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/shunyamita0804-source/mystic-monsters /home/user/shunyamita0804-source/mystic-monsters`（読み取りのみ）
- PS版の参考サイト：note は読める。tapatalk・gamefaqs・legendcup は相手サイトの制限で読めない（必要ならユーザーに文章を貼ってもらう）
- 公開URL（github.io）には、2026-10-22 の次便の公開後はこの作業環境から接続できた（curl・Playwright）。それでも最終の見た目はユーザーの iPhone で確認してもらう
- GitHub への push は `origin` = https://github.com/shunyamita0804-source/mistral-monsters-battle-card（2026-10-24 改名）。
  権限エラー（「authorized repository set にない」）が出たら、セッションに `mistral-monsters-battle-card` を追加（add_repo）してから push する。GitHub MCP も repo は `mistral-monsters-battle-card`
- **2026-10-24 も Node 22 のままだった**。このときは `export NVM_DIR=/opt/nvm; . /opt/nvm/nvm.sh; nvm install 24` で入り、
  以後のコマンドは `export PATH=/opt/nvm/versions/node/v24.22.1/bin:$PATH` を先に付けて動かした（`npm install` で `package-lock.json` が変わったら戻す）
- 対戦画面を Playwright で確かめるとき（2026-10-24）：大会会場は `{mapId:'hall', x:5, y:9, dir:'up'}` で入り、受付の人 `.world__npc[data-npc="receptionist"]` を押して会話を送る →
  「参加する」（英語は `text="Enter"` と完全一致で。部分一致だと別の文字に当たる）→ 確認は `.modal .btn--primary` →「を戦う」。
  攻撃の対象のモンスターは脈打つ動きがあるので `click(…, { force: true })`。相手の手札の枚数・秘匿の見張りのやり方は `docs/battle-layout-r2.md` 4章
- `main` への push は、作業環境の安全確認で止められることがある。そのときはユーザーに「main に入れてよいか」を確認してから行う

## 5. 公開（デプロイ）の手順

ユーザーが「公開して」と言ったときだけ行う。

1. （通し確認の道具はいま動かないので省略。ユーザー了承済み）
2. 作業ブランチを `main` にマージ（`git merge --no-ff`）→ `npm run check` → `git push origin main`
3. GitHub Actions のワークフロー `deploy-pages.yml` を `main` で手動実行
   （GitHub MCP の `actions_run_trigger`：owner `shunyamita0804-source`、repo `mistral-monsters-battle-card`、method `run_workflow`、workflow_id `deploy-pages.yml`、ref `main`）
4. build と deploy のジョブが成功したことを確認して報告（反映まで1〜2分）。新しいファイル（例：`dist/static/town_r1c1-*.webp`）が
   公開URLで 200 になるかを curl で見ると確実。このメモの公開URLの行を更新
5. ホーム画面に置いたアプリは「一度閉じて開き直す」と新しい版になる、とユーザーに伝える

## 6. 未完了・気になっている点

**2026-10-26：デザイン第11弾10枚の組み込み（`6c81fa7` で公開・iPhone 確認待ち）**
- 10枚とも使った（`docs/design/ui-quality11-20261026/10_受け取り結果_UTF8.txt`）。マゼンタの背景を `tools/design/magenta_key.py` で透明に、切り出しは `tools/design/ui11_build.py`、見た目は `src/ui/styles/uiParts11.css`
- ボス戦の背景は `worldScreen.ts`、特別復元の演出は `shopScreens.ts`、図鑑の割合は `collectionScreens.ts`、ルールの図は `battleScreen.ts`

**2026-10-26：ラズック正式14技・初期配布16枚・紫の枠・バトル用カード（`4d28f6e` で公開・iPhone 確認待ち）**
- ZIP「Razuk_Claude_Official14_Starter16_COMPLETE_20261026」。中身は `design-parts/cards-original/lazuck14-20261026/` に無改変、データは `src/data/lazuck.ts`
- ID は同じ名前の技のまま（しっぷうタックル＝`skl-lazuck-06`、シャドウスリップ＝`skl-lazuck-15` など）。旧05 しっぽアタック・旧16 ミラージュダッシュは削除（セーブ version 11 で所持・デッキから外す。代わりは配らない）
- 枠は紫（#844DC5）：技カード `frame_*_lazuck.png`・バトル用カード `frame_lazuck.png`。バトル用カードの絵 `lazuck_battlecard.png`
- 初期デッキ＝ソラモ16（正式）＋ラズック16（正式）＋3体目13（**未確定・仮**。いまの3体目はソラモなのでソラモの技）＋サポート15（仮）
- 未確定：3体目のモンスターと13枚・レアリティ・正式英語・ちょうはつ／ダストキックの細かい裁定。iPhone での確認は未

**2026-10-26：デザイン第10弾10枚の組み込み・第11弾の依頼文（`4d28f6e` で公開・iPhone 確認待ち）**
- 10枚とも使った（`docs/design/ui-quality10-20261026/10_受け取り結果_UTF8.txt`）。見た目は `src/ui/styles/uiParts10.css`、切り出しは `tools/design/ui10_build.py`
- ダンジョンの帯・敵とぶつかったときの光・手に入れたときの小窓は `worldScreen.ts`（クリアの帯は `GameStore.flashBanner`）
- 第11弾の依頼文 `docs/design/ui-quality11-20261026/`（遊び方の挿絵・ルールの図・特別復元の場面・ボス戦の背景・待ちの印・提供割合の表・図鑑の割合・世界地図の部品・設定の部品・タイトルのボタン）。ZIP はチャットで渡しただけ

**2026-10-26：デッキ編集を PS版の動画のように3段に（`4d28f6e` で公開・iPhone 確認待ち）**
- ユーザー指示「デッキ編成はこの動画（PS版モンスターファーム バトルカードのチーム改良）のようにしたい」。表（デッキ全体・モンスターごと・サポートの攻撃・守り・計）→ モンスターを選ぶ（3つの枠＋一覧＋大きな絵）／技カードを選ぶ（名前・使う・残り＋大きなカード＋説明）。持っていない技は「？？？」
- デッキは1つのまま（複数のデッキ〔チーム管理〕はユーザーの判断で今回は作らない）。セーブの形は変えていない
- 中身は `src/ui/screens/deckScreen.ts`、見た目は `src/ui/styles/screens.css` の「PS版の動画にならった3段」。表の枚数の数え方は `countRoles`（`src/game/deck/deck.ts`、テストあり）
- 第10弾の依頼文の10番は、この画面に合う部品（表の行の板・大きなカードの台・モンスターの枠）に書き直した

**2026-10-26：デザイン第10弾の依頼文（10枚）を作成（作業ブランチ `claude/ui-quality10-20261026`）**
- ユーザーの言葉では「第9弾」だが、第9弾は組み込み済みなので第10弾にした。依頼文は `docs/design/ui-quality10-20261026/`（00＝一覧と理由、01＝プロンプト10枚）
- 対戦の操作のボタン・対戦の窓の枠・説明の欄の枠・敵とぶつかったときの演出・ダンジョンの帯・歩く画面の小物・手に入れたときの小窓と欠片の絵・ショップのメニューの札・冒険の記録の板・デッキ編集の部品
- 参考画像つきの ZIP（Mistral_UI_Quality10_20261026.zip）はチャットで渡しただけ。組み込みは絵が届いてから

**2026-10-26：タイトル画面のアイコンを消してロゴを上に・新しいタイトル背景（`152c840` で公開・iPhone 確認待ち）**
- ユーザー指示「アイコンは消して、ロゴをその分上に」→「もう少し下に」（上の余白 100px）。アプリのアイコン（ホーム画面）はそのまま
- 新しいタイトル背景の依頼文 `docs/design/title-bg-20261026/`（案A モンスターたちとカード〔おすすめ〕・案B 空の祭壇・案C 決勝の舞台）
- 背景が届いたので差し替え済み（原本 `design-parts/title-bg-20261026/title_bg_v2.png` → `assets/images/backgrounds/title_bg.webp`）。明るい昼の絵なので、暗い膜は上と下だけうすく（`uiFrames.css`）。ロゴ下の日本語名と版の表示に暗い帯（`uiParts9.css`）

**2026-10-26：デザイン第9弾10枚の組み込み（`de1fbf8` で公開・iPhone 確認待ち）**
- 10枚とも使った（`docs/design/ui-quality9-20261026/10_受け取り結果_UTF8.txt`）。見た目は `src/ui/styles/uiParts9.css`、切り出しは `tools/design/ui9_build.py`

**2026-10-26：デザイン第9弾の依頼文（10枚）を作成**
- 依頼文は `docs/design/ui-quality9-20261026/`（00＝一覧と理由、01＝プロンプト10枚）。タイトルロゴ・対象の矢印・戦闘不能の印・状態のアイコン・ライフのゲージ・流れる文字の帯と情報の欄の枠・マナの光・手札の印・練習試合の背景・ダンジョンの案内板
- 参考画像つきの ZIP（Mistral_UI_Quality9_20261026.zip）はチャットで渡しただけ。組み込みは絵が届いてから

**2026-10-26：ソラモ14技の絵を Art Ver.2 に（`cfbc6a7` で公開・iPhone 確認待ち）**
- ZIP「Soramo_ArtV2_14Skills_Claude_Implementation_Starter16」を取り込み。技の中身（名前・数値・効果・初期配布16枚）は 10-25 の版と同じで、絵だけ新しい14枚（`sor14v2_sk_01〜14.png`。1バイトも変えていない）
- それまでの絵 `sor14_sk_*.png` と原本フォルダ・旧 JSON は外した（git の履歴にある）。原本は `design-parts/cards-original/soramo14-artv2-20261026/`

**2026-10-26：対戦画面の配分（`cfbc6a7` で公開・iPhone 確認待ち）**
- ユーザー指示（2回）：①情報（あなた・相手・状態・マナ・山札・手札・捨札）をモンスターの列の左へ（アイコン＋文字。文字も残す）②真ん中の経過の1行を画面上部へ、文字を自動で流す（「ダンジョン戦」「○手番・あなた・マナ化」も）③手札の上下を広く
- 上の帯：降参とルールの間に、手番・最新の経過・対戦の名前・先攻後攻を1行にして右から左へ流す（押すと経過をすべて見る。`battle__ticker`）。場の全体カードがあれば左に札
- 情報の帯（行）と真ん中の経過の行はなくした。空いた分で説明の欄は 275px（カードの大きさは元の 132・112 に戻した）。場面の札（あなたのターン）は相手と自分の列の間
- 相手の手札が上で半分隠れるのは「カメラ」（自分の番は寄せて説明の欄を広くする。2026-10-25 ユーザー指示で戻したもの）

**2026-10-26：自動ドアの音・建物を立体的に・NPC をなじませる（`b83dd4f` で公開・iPhone 確認待ち）**
- 前に届いた2つ目の音は自動ドアの音だった（鉄の扉を閉める音と取り違えていた）。ショップの出入り＝自動ドア、大会会場は出入りとも鉄の扉を開ける音（ユーザー指示「退出時は入室時と同じSEでOK」）
- 建物を立体的に（ユーザー指示「案B」＝落ち影・接地の影・建物に光と陰。`design-parts/seimon-world/README.md`）
- NPC：色を落ち着かせ、足元の影を大きく濃く、呼吸の動き（中の「体」の層だけを足の裏を軸に縦へ 1.2%。足元は動かない。ユーザー「足は地面にしっかり着地」）。近くの主人公の方を向く動きは前からある（3マス以内）。`src/ui/styles/world.css`・`worldScreen.ts`

**2026-10-26：デザイン第8弾10枚の組み込み・カードショップの新しい絵（`d0599f0` で公開・iPhone 確認待ち）**
- 10枚すべて使った（`docs/design/ui-quality8-20261026/10_受け取り結果_UTF8.txt`）。見た目は `src/ui/styles/uiParts8.css`、切り出しは `tools/design/ui8_build.py`
- カードショップをユーザー提供の絵に（`design-parts/seimon-world/README.md`）
- 街の色の調子：ユーザー指示「弱めで全体にかけて」で、街の部品に明るさ・あざやかさを少し足した（ショップ・大会会場・部屋の中は除く。`design-parts/seimon-world/README.md`）

**2026-10-26：ガウル14技（`d0599f0` で公開・iPhone 確認待ち）**
- 「ガウル全14技・最終実装パック」を取り込み（`src/data/gauul.ts`・`docs/card-data-policy.md`・`docs/battle-rules.md`）。旧16技はゲームから外した（セーブ version 10）
- 技カード新UIのガウルの枠はオレンジ（新しく作った）。初期配布は未確定のまま（スターター・パック・相手の編成には入れていない。QA の「全カード」で手に入る）
- ついでに直した：正式カードの攻撃の説明で「回避されない」が2回出る不具合（ラズック「みだれづめ」も直る）。すなかけ専用だった「攻撃できない」理由の文を、威嚇でも合う文に

**2026-10-26：大会会場を鉄の扉の絵に・扉の音（`d0599f0` で公開・iPhone 確認待ち）**
- 街の大会会場をユーザー提供の絵に（`design-parts/seimon-world/README.md`）。新しい絵はまわりの建物より明るく鮮やか（色は変えていない）
- 会場に入る＝鉄の扉を開ける音、出る＝ユーザー提供の閉める音（`ironDoorOpen`／`ironDoorClose`。`docs/audio-credits.md`）。届いた2つの音のどちらが開ける・閉めるかは推測（1つ目は宝箱の「鉄の扉を開ける」と同じファイルだった）
- カードショップの絵は、ユーザーがこのあと別に送る

**2026-10-26：デザイン第8弾の依頼文（10枚）を作成・ユーザーの返事待ち**
- 全画面を撮って、足りない絵・仮の見た目を洗い出した。依頼文は `docs/design/ui-quality8-20261026/`（00＝一覧と理由、01＝プロンプト10枚）。
  先攻・後攻のカードの表・VS の部品・主人公の立ち絵（男女）・主人公を選ぶ札・技の効果の絵・レア度と NEW の印・鍵つきパック・大会の勝ち抜き表・ランクアップの帯
- 参考画像つきの ZIP（Mistral_UI_Quality8_20261026.zip）はチャットで渡しただけで、リポジトリには入れていない（いまの画面の撮影＋見本。作り直すときは同じ画面を撮る）
- ゲームへの組み込みはまだ（絵が届いてから）

**2026-10-25 セッション終了時点（`ba4ed74` 公開済み。次のセッションはここから）**
- ユーザーの iPhone 確認待ち：ソラモ14技・技カード新UI v5・場のモンスターのバトル用カード・タップで正式カードの絵
- バトル用カード（800×920）はソラモだけ。ほかのモンスターは届いたら `src/data/battleCards.ts` に足す（枠は `tools/art/battle_card_frame.py`）。
  それまで場では同じ縦横比に切り抜いたアイコン。ミュロルは正式カードの絵も無い（タップでいままでの詳しい表示）
- 初期デッキの残り2体分29枚・サポート15枚は**未確定**（いまはラズックの技と仮サポートで埋めている。`createStarterDeck`）。初期配布・排出の正式はユーザーが指示する
- ソラモの 01・05・06・08・12・14 は初期配布0枚で、入手方法が未定（パックにも入れていない）
- 技カード新UI v5 の枠は参考画像からの切り出しなので解像度が低い（幅 253px まで）・右上の角が少し切れている。正式な枠画像が届けば差し替え
- （2026-10-26 に直した）ラズック「みだれづめ」の説明に「回避されない」が2回出る不具合
- ソラモ09 すなかけの「相手」は、いまは選んだ1体（`docs/battle-rules.md` の要仕様確定）

- 新URLは 2026-10-22 にユーザーが iPhone で開いて「すべてOK」。旧URLは 404（転送なし）
- iPhone のホーム画面版（PWA）は、URL が変わるとセーブが見えない可能性あり → 設定の「セーブをバックアップ」で引き継ぐ（書き出し・復元の iPhone での操作は個別には未確認）
- 正式アイコンの角の外側は白（原本のまま。透過加工は承認なしではしない）
- 英語はすべて仮訳（カード・パック・大会・マップ・能力名 POW/INT）。正式な英語名は未決。小さいモンスターカードでは英語名が「Temp Mo…」と省略される
- 次便の指示書で「次次便に保留」とされた事項は、まだ受け取っていない（ユーザーから届いたら対応）
- **未完了（2026-10-22 統合便）**：QA（通しの確認・iPhone 実機）はユーザー指示で行っていない。作業環境で各画面が出ることだけ確認。
  通し確認の道具 `tools/e2e/flow.cjs`・`intro.cjs`・`flow2.cjs` は古い仮の街（1マス40px）の座標のままで、**いまの街では動かない**（直していない）
- 統合便で仮・未完了のもの：強攻撃の基準（必要マナ3以上）は仮。効果音は受け取った MP3 をそのまま使い、素材サイトの原本とは未照合。
  民家A〜Eは無人（住人の絵が無い）。ショップの店員・研究所の研究員・大会の受付・練習場の先生の絵は無い（カウンターなどを調べると従来どおり画面が開く）。
  案内役は家の中には出さない（いまは街か練習場にいる。同じ人が2か所に出ないように）。ダンジョンは仮マップのまま（人物は小さめに表示）
- 歩く速さ（231 論理px/秒。2026-10-22 に 185 から 1.25 倍）・コマ送り（7コマ/秒）・スティックの反応・街の表示の大きさは、ユーザーの iPhone 確認しだいで調整
- BGM：MP3 なので、曲が一周して頭に戻るときにごく短く途切れることがある（気になれば形式か鳴らし方を変える）。最初のタップまでは鳴らない（ブラウザの決まり）。
  BGM の音量は曲ごとの gain（本編と同じ値）のまま。iPhone で効果音との大きさのつり合いは未確認
- ダンジョンの対戦の背景は野外の絵（草原・海岸・火山）で、地下のダンジョンという設定とは合っていない（仮の割り当て。ユーザーはこの素材を選んだ）
- NPC の依頼文（`docs/design/quality-pass-20261022/01・02`）は年齢が古い（頭に追記済み）。歩く絵は `characters-adult-20261022` に置き換え。NPC の会話の絵は設定画が決まってから別に頼む
- 商標の確認は未実施（名称変更＝商標の安全の保証ではない）
- 演出の簡略化（動きを減らす設定）は未実装（必要なら項目を追加する）
- PS版で未確認の裁定（ユーザーが実機で確認する約束）：`docs/battle-rules-audit.md` の5章、`docs/battle-rules.md` の「まだ確かめられていないこと」
- 正式カード待ちで未実装：防御の「0にする・はね返す・効果だけ消す・肩代わり」、全体カードを打ち消すカード、コンボ、派生モンスター（MAIN/SUB）の技、モンスターの特徴（地上・空中）
- 新ルールでは1戦が長め（自動対戦で1〜2分）。テンポ調整はユーザーの判断待ち
- 序盤イベントで仮のもの：となりの家の女性の正式な名前（「隣家の女性」）、正式な台詞（台本 V1 は仮）、練習相手のデッキ（スターターと同じ3体）
- 応急処置（描き直しが届いたら外す）：会話の絵の左右の端をぼかしている（`dialogue.css` の `mask-image`）
- 正式素材が無いもの：モンスター・技カードの絵、NPC（描き直しの依頼一式あり）・ダンジョンの床や壁・敵、大会の戦闘の背景（ミスモンの闘技場はユーザーが不使用と決定）。正式仕様が無いもの：カードデータ、価格・提供割合、大会、敵編成、隠しモンスター
- ダンジョンから帰ると家に戻る（街の入口の前には戻らない）。対戦の途中でアプリを閉じると、その対戦は最初からやり直し
- 不要になった作業ブランチ（main に取り込み済み）：`fix/smooth-walk`・`feature/walk-run-size`・`fix/walk-perf`・`docs/diagonal-redo`（2026-10-23。最後の1つは資料と原本だけ）・`fix/town-dungeon-gate`・`feature/battle-layout-deal`・`claude/cool-gauss-emyae1`・`feature/sacred-rename-i18n`・
  `feature/official-town-integration`・`feature/quality-pass`・`fix/walk-portrait`・`fix/walk-flicker`・`feature/env-assets-a`・
  `feature/hand-swipe`・`fix/mana-convert-se`・`fix/adult-labels`・`assets/town-parts`・`feature/mismon-assets`・`feature/compact-town`・`feature/plain-buttons`・`feature/adult-style`（この2つは 2026-10-23 に main へ取り込み済み）・`claude/happy-bardeen-1jlos0`（2026-10-23 の街・人物の大人向け。main へ取り込み済み）。消すかどうかはユーザーに確認してから
  （`nightbatch/2026-10-22`・`claude/sacred-monsters-battle-card-btgeie` は中身未確認）

## 7. 主なファイル

| 内容 | 場所 |
| --- | --- |
| 作業ルール・構成 | `CLAUDE.md` |
| 設計（画面・ロジック・セーブ） | `docs/architecture.md` |
| バトルのルール（PS版準拠・ユーザー承認済み） | `docs/battle-rules.md` |
| バトルルール監査（PS版との差分・改修順・実機確認のお願い） | `docs/battle-rules-audit.md` |
| ルール設定値（仮の数値含む） | `src/data/rules.ts` |
| カード（仮モンスター・仮技・仮サポート） | `src/data/cards.ts`・`src/game/cards/cardTypes.ts` |
| バトルのルール本体・相手の思考 | `src/game/battle/engine.ts`・`src/game/battle/ai.ts` |
| デッキの決まり・スターター・自動構築 | `src/game/deck/deck.ts` |
| セーブ（形式 version 6・変換） | `src/game/save/saveData.ts` |
| バトル画面・コマンドボタン | `src/ui/screens/battleScreen.ts`・`src/ui/components/commandButton.ts`・`src/ui/styles/battle.css` |
| 効果音の割り当て・出どころ | `src/ui/sound.ts`（`SE_REGISTRY`）・`docs/audio-credits.md` |
| BGM（場面ごとの曲・音量・切り替え） | `src/ui/bgm.ts`（`BGM_REGISTRY`。曲を決めるのは各画面の `bgm.play()`：タイトル・歩行画面〔街／ダンジョン〕・大会・対戦〔`BattleRequest.bgm`〕） |
| ミスモン素材の調査・使うもの | `docs/mismon-reuse-candidates.md`（使ったものの出どころは `docs/audio-credits.md`） |
| 街・部屋の部品の原本 | `design-parts/seimon-world/`（README に受け取り・復元の記録） |
| 人物の描き直しの依頼一式（大人の年齢） | `docs/design/characters-adult-20261022/`（枠は `tools/design/char_templates.py`） |
| 素材の置き場と記録 | `assets/README.md` |
| 公開の手順 | `docs/github-pages.md` |
| 日英の辞書・英訳表 | `src/i18n/`（`docs/i18n.md`） |
| 設定画面・バックアップ | `src/ui/screens/optionsScreen.ts`・`src/game/save/backup.ts`・`src/game/settings/settings.ts` |
| 名称変更の記録 | `docs/rename-migration.md` |
| 序盤イベント（進み具合・場面・台詞・会話UI・練習試合のヒント） | `src/game/story/`・`src/data/storyScenes.ts`・`src/i18n/messages/story.ts`・`src/ui/components/dialogue.ts`・`src/ui/styles/dialogue.css` |
| 歩行画面（なぞって歩く・しらべる・案内役の表示） | `src/ui/screens/worldScreen.ts`・`src/ui/styles/world.css`・地図 `src/data/maps.ts`（街・部屋の座標は `worldArt.generated.ts`。作るのは `tools/design/seimon_world_build.py 部品のフォルダ`） |
| 街・部屋のデザイン資料（設計図・ChatGPT 依頼文・QA） | `docs/design/seimon-town/`（入口は `00_最初に読む_UTF8.txt`）・`tools/design/seimon_town_pack.py` |
| デザイン依頼（いまの担当：NPC） | `docs/design/quality-pass-20261022/`（01・02。受け取り結果は 10） |
| ランダム生成のダンジョン（2026-10-26 試作） | 数値 `src/data/dungeonRun.ts`・生成と挑戦のルール `src/game/dungeon/`・画面 `src/ui/screens/dungeonRunScreen.ts`・見た目 `src/ui/styles/dungeonRun.css` |
| デザイン依頼（生成AI担当：それ以外） | `docs/design/genai-request-20261022/`（日本語・英語の依頼文） |
| 画面の大きさ（ステージ・最大幅480） | `src/core/stageLayout.ts`・`src/ui/stage.ts` |
| カードデータ・ID の決まり・点検 | `docs/card-data-policy.md`・`src/game/cards/dataChecks.ts` |

## 8. デザインが届いたときの組み込み方

- 受け取ったら、まず街や画面に実際に置いて、いまの絵と見比べてから使うか決める（2026-10-22 の環境8点は、平たい図形のような絵が多く半分不採用だった）。
  見比べの画像をユーザーに送り、使わないものは理由を `docs/design/…/10_受け取り結果` のように記録する
- **部品の原本**：`design-parts/seimon-world/` に全部ある（2026-10-22）。部品を直したら同じ名前で置き換えて `seimon_world_build.py design-parts/seimon-world …` で作り直す。
  ファイル名は `docs/design/seimon-town/05_補助資料/02_納品ファイル名一覧` のとおり（建物10棟はチャットの画像で届いたので、名前を付け直す：
  紫＝town_guide_home、オレンジのしましま屋根＝town_shop、郵便受けの赤茶屋根＝town_player_home、緑＝town_house_c、赤い横長＝town_training、
  茶＝town_house_a、青緑＝town_lab、青いドーム＝town_arena、赤＝town_house_d、青＝town_house_b）。草むら・小花・植え込みは decal_grass・decal_flowers・props_bush_v2
- NPC の歩く姿（1024×1536・4×4）：1コマ 256×384 を縦横比のまま 0.75 倍（192×288）にして 216×288 のコマの真ん中へ。足元 (108,270) をそろえる。
  `maps.ts` の `NpcObject.npcId` に人物を足し、ショップのカウンターの奥・研究所の机の奥・大会の受付・練習場の先生の位置（`rooms_layout.json` の *_SPOT）に置く。
  住人は民家の RESIDENT_SPOT。会話の絵は `dialogue.ts` の `PORTRAITS` に足す。話す内容（台詞）は決まっていないので、ユーザーに確認する
- 人物の歩きの描き直し：`design-parts/characters-adult/` の同じ名前を置き換えて `adult_walk_build.py` で作り直す（2026-10-23〜。前の `walk_passing.py` は廃止）
- 案内役の会話の絵の描き直し：`assets/images/characters/neighbor_guide_talk_*.webp` を作り直し（半分に縮小して WebP）、`dialogue.css` の端をぼかす `mask-image` を外す
- 縦長の部屋：`seimon_world_build.py` の `SHELL`（床の範囲・出入口）を測り直し、`ROOM_FILL`・`ROOM_ZOOM_MAX`（`worldScreen.ts`）を見直す
- 岩・広場の輪・飾り石・縁石：`seimon_world_build.py` の `USE_PLAZA_DECOR` などで、見比べてから入れる
- **大人の人物（`characters-adult-20261022`）の組み込み**（まだ道具は作っていない）：届くのは1人につき「正面の立ち姿（1024×1024）」と「歩き3枚（正面・背中・左向き。1536×1024 に3ポーズ）」。
  3つの枠（512 幅ずつ）から1人ずつ切り抜き → 背景を透明に → 足元（枠の y=940）と背の高さ（約 860）をそろえて 216×288 のコマ（足元 270・人物の高さ 約250）に縮める →
  歩きの4コマ＝「立つ・右足を前・立つ・左足を前」、右向き＝左向きの左右反転 → いまの歩行シートと同じ並び（4行×4列。行は正面・背中・左・右）の
  `player_{male,female}_walk.png` を作り、`walk_passing.py` でゲーム用のシートにする（「足を寄せたコマ」の応急処置は外す）。ゲームに入れたら動く様子をユーザーに返す

