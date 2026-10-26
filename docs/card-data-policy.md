# カードデータ・素材の決まり（正式カードを入れる前の土台）

2026-10-22 作成。いまのカード・パック・大会・敵・マップはすべて**仮**。正式データは許可が出るまで作らない。

## 1. カードは固定 ID で参照する

- 所持カード・デッキ・景品・パックの収録は、すべてカード ID（`mon-a`・`skl-a-1`・`sup-1` など）で持つ
- 名前・説明・画像・数値は ID にひもづく別の情報。表示するときに引く
  - 日本語の名前・説明：`src/data/cards.ts`
  - 英語の名前：`src/i18n/contentEn.ts`（`card:<ID>:name`）。技・サポートの効果説明は数値から組み立てる（`src/game/cards/cardTypes.ts`）
  - 画像：カードの `art`（`assets/images/cards/monsters|skills/` のファイル名）。なければ仮の絵
  - 数値（ライフ・マナ・ちから/かしこさ・効果）：`src/data/cards.ts`

## 2. 正式カードに入れ替えるとき（セーブを失わないために）

- **いまの仮カードの ID は消さない・使い回さない。** セーブの所持カードに残っているため、消すと読み込み時に捨てられる
- 正式カードは**新しい ID**で足す（例：`mon-<正式の英字名>`）。仮カードは `isPlaceholder: true` のまま残す
- 仮カードを正式カードに置き換える（持っている仮カードを正式カードに変える）ときは、`SAVE_VERSION` を上げ、
  `src/game/save/saveData.ts` の `MIGRATIONS` に「仮 ID → 正式 ID」の変換を1回だけ足す。テストで旧セーブを読んで確かめる
- 所持カードの ID を黙って書き換えない。変換するときは対応表を作り、ユーザーの承認を得る
- バックアップの読み込み（`src/game/save/backup.ts`）は、このバージョンにないカード ID があると止める。
  ID を消すとその ID を含むバックアップが読めなくなるので、その場合も変換を用意する

## 3. 点検（`tests/dataIntegrity.test.ts`・`tests/i18n.test.ts`）

毎回のテストで次を確かめる。仮カードと正式カードで基準を分けている（仮の画像がないことで CI が落ちないように）。

| 点検 | 仮カード | 正式カード |
| --- | --- | --- |
| ID の重複 | 不可 | 不可 |
| 技の適合モンスターが実在する | 必要 | 必要 |
| 名前 | 「仮」で始まる（隠し・未確定は「？？？」「隠し技（未確定）」） | 「仮」で始めない |
| 画像（art） | なくてよい | 必須・ファイルが実在 |
| 画像のファイル名 | 命名規則（小文字英数字・`-`・`_`） | 同じ |
| 英語名 | 仮訳あり（なくても日本語で表示） | 必須 |

ほかに：大会・ダンジョンの相手のモンスター、景品・宝箱のカードが実在すること、辞書の欠落・プレースホルダーのずれ、`assets/` のファイル名。

## 4. 決まっていないこと（正式確定待ち）

- ソラモ以外のカードの正式データ・正式画像、（技カードの UI は 2026-10-25 に新UI v5 で承認済み）。ソラモのカードのレアリティ・配布枚数・入手場所
- サポートカードの正式な効果、全体カードを打ち消すカード、コンボ
- ショップの価格・パックの提供割合、大会・敵の編成、隠しモンスターの正体
- 英語の正式な固有名（いまの英語はすべて仮訳）

## 5. 正式カード（2026-10-23〜）

初めての正式カードはソラモ（モンスター1枚・技16種）。2026-10-25 に技は14種に替わった（旧16技 `skl-soramo-01〜16` は削除し、番号は流用しない）。正本は `src/data/official/soramo14_artv2_skills_OFFICIAL_20261026.json`（2026-10-26 に届いた Art Ver.2 の版を無改変。技の中身は 10-25 の版と同じで、絵の版の欄が増えただけ）、読み込みは `src/data/soramo.ts`。技の絵は Art Ver.2（`sor14v2_sk_01〜14.png`）。

| デザイン ID | ゲーム内 ID | 技名 |
| --- | --- | --- |
| （モンスター） | `mon-soramo` | ソラモ（ライフ7・正式カードの絵の値） |
| soramo_skill_01〜14 | `skl-soramo14-01`〜`skl-soramo14-14`（番号は同じ） | ひっかき〜星影ステップ（2026-10-25） |
| （削除）SOR-SK-01〜16 | `skl-soramo-01`〜`skl-soramo-16` | 旧16技。セーブ version 9 で所持・デッキから外す |
| （モンスター） | `mon-lazuck` | ラズック（ライフ6。2026-10-23 に技が届き、登録のみから正式へ） |
| LAZ14-SK-01〜14 | 同じ名前の技の ID のまま（01〜04＝`skl-lazuck-01〜04`、05 しっぷうタックル＝`-06`、06・07＝`-09`・`-10`、08・09＝`-07`・`-08`、10 いたずら＝`skl-lazuck-itazura`、11・12＝`-11`・`-12`、13 シャドウスリップ＝`-15`、14 フェイントステップ＝`-14`） | ひっかき〜フェイントステップ（2026-10-26 正式14技） |
| （削除）LAZ-SK-05・13・16 | `skl-lazuck-05`・`-13`・`-16` | しっぽアタック・クロスガード・ミラージュダッシュ。セーブ version 8（13）・version 11（05・16）で所持・デッキから外す |
| （モンスター） | `mon-gauul` | ガウル（ライフ6。2026-10-24 に技が届き、登録のみから正式へ） |
| gaul_skill_01〜14 | `skl-gauul14-01`〜`skl-gauul14-14`（番号は同じ） | つつく〜高速飛行（2026-10-26。旧16技 `skl-gauul-01〜16` はゲームから外した） |
| （モンスター） | `mon-nobiton` | ノビトン（ライフ8。2026-10-25 に技16種と一緒に届き、正式へ） |
| NOB-SK-01〜16 | `skl-nobiton-01`〜`skl-nobiton-16`（番号は同じ） | はなビンタ〜必死によける |
| （モンスター） | `mon-myurol` | ミュロル（ライフ7。2026-10-25 に技16種が届き、正式へ。モンスターカードの絵はまだ無い） |
| myurol_01〜16 | `skl-myurol-01`〜`skl-myurol-16`（番号は同じ） | たいあたり〜すべってよける |

**2026-10-26 からラズックは正式14技**：正本 `src/data/official/lazuck14_skills_OFFICIAL_20261026.json`（無改変）、ZIP の中身は `design-parts/cards-original/lazuck14-20261026/`、
絵 `laz14_sk_NN.png`（827×937 の PNG を無改変）、枠は紫（#844DC5）。初期配布16枚（JSON の initial_copies のまま）。性能が変わった技も ID は同じ（しっぽいなしマナ2・シャドウガード−3・フェイントステップは両方の技）。
以下はそれまでの記録。ラズックの正本は `src/data/official/lazuck_cards_OFFICIAL.json`（無改変）、読み込みは `src/data/lazuck.ts`（ソラモと同じ作り方 `src/data/officialSkills.ts`）。
絵は `laz_sk_NN.webp`。**初期・収集の配分が食い違っている**（全体方針は初期8・収集8、1枚ずつの指定を足すと初期10〔01〜08・11・14〕・収集6）。データは1枚ずつの指定のまま持ち、配布・スターター・パックには使っていない（ユーザー確認待ち）

- 絵：技 `assets/images/cards/skills/sor_sk_NN.webp`（827×937 のまま WebP）、モンスター `soramo_official.webp`（ショップ・図鑑など）・`soramo_battle.webp`（バトル）
- レアリティは未定（`rarity: null`。モンスターのランク C とは別物）。パックには入れていない
- 英語は仮訳（`src/i18n/contentEnOfficialDraft.ts` に分けて管理）
- 登録だけのモンスターは、いまはいない（ガウルは 2026-10-24 に正式へ）

### 2026-10-25 ミュロル（Mistral_Myurol_16Skills_Claude_Approved_20261025）

- 届いたもの：技の絵16枚（01〜07 PNG・08〜16 JPEG。ユーザーが全16枚を正式採用）・技一覧 CSV・技データ JSON・画像の照合表・実装指示。
  ZIP の中身をすべて `design-parts/cards-original/myurol/` に無改変で保管
- 正本は JSON（`src/data/official/myurol_skills_OFFICIAL_20261025.json`・無改変。CSV も同じフォルダに無改変）。読み込みは `src/data/myurol.ts`
  （JSON の id `myurol_NN` はデザイン ID として持ち、ゲームの ID は `skl-myurol-NN`。技名・マナ・効果の文は書き換えない）
- 絵：`myu_sk_NN.png`（01〜07）・`myu_sk_NN.jpg`（08〜16）。JSON の image に書かれたファイルを番号で1対1に写しただけで、**中身は1バイトも変えていない**
  （変換・再圧縮・縮小・切り抜きなし。ファイル名だけ素材の命名規則に合わせた）。`tests/myurol.test.ts` で照合表の SHA-256・容量・寸法と突き合わせる。
  そのため1枚 0.6〜2.6MB と、ほかのモンスターの技の絵（WebP 約0.2MB）より重い（16枚で約23MB。カードを表示したときに読み込む）
- **初期配布／収集用は「案」のまま**（JSON の distribution_confirmed: false）。案（初期＝01・02・05・06・08・10・11・13、収集＝03・04・07・09・12・14・15・16）は
  `MYUROL_DISTRIBUTION_PROPOSAL` に持つだけで、カードの区分（availability）には入れず画面にも出さない（カードの説明に「まだ決まっていない項目：配布の区分」と出る）
- **未定**：モンスターカードの絵（届いていない。仮の絵「ル」と「仮」で表示）、枠色（`monster_theme_colors.json` に無いので、技の絵の水色 `#7EC4E8` を仮の候補に）、
  レアリティ、正式英語（仮訳）、配る枚数・パック・価格・敵の編成（ノビトンと同じく、スターター・パック・相手の編成には入れていない。QA の「全カード」で手に入る）
- 効果の裁定（要仕様確定）は `docs/battle-rules.md`「正式カード（ミュロル）」

### 2026-10-26 ノビトン正式14技（Nobiton_14Skills_Claude_Implementation_20261026）

- 届いたもの：技の絵 JPEG 14枚（1178×1335）・正式データ CSV・実装指示・README。チャットで、初期配布16枚の表とバトル用モンスターカードの正式原画（PNG 1179×1334・透明つき）。
  すべて `design-parts/cards-original/nobiton14-20261026/` に無改変で保管（チャットの指示の要点は `03_ユーザーの指示_初期配布とバトル用原画_UTF8.txt`）
- 正本は CSV（`src/data/official/nobiton14_skills_OFFICIAL_20261026.csv`・無改変）。`src/data/nobiton.ts` がそのまま読む（技名・分類・マナ・ダメージ・特殊効果の文は書き換えない）
- ゲーム内 ID は同じ名前の技を引き継ぐ：

| 正式の番号 | 技名 | ゲーム内 ID |
| --- | --- | --- |
| 01〜10 | はなビンタ〜鼻でまもる | `skl-nobiton-01〜10`（番号と同じ） |
| 11 | のびのびガード | `skl-nobiton-12`（旧12） |
| 12 | ぐっとがまん | `skl-nobiton-13`（旧13） |
| 13 | 横によける | `skl-nobiton-15`（旧15） |
| 14 | 必死によける | `skl-nobiton-16`（旧16） |

- 外れた技：旧11 サイコガード（`skl-nobiton-11`）・旧14 ねばりガード（`skl-nobiton-14`）。セーブ version 12 で所持・デッキから外す（`migrateNobiton14V12`）。古いバックアップは止めずに読む（`REMOVED_CARD_IDS`）
- 依頼文の「旧09 鼻でまもる→新10…新09 不思議な嗅覚・新12 ぐっとがまんを追加」は、ゲームに入っていた16技より前の番号。ゲームの16技には2つともあったので、名前で引き継いだ
- 絵：`nob14_sk_01〜14.jpg`（届いた JPEG を1バイトも変えずに置いた）。性能はそれまでと同じ（効果の文だけ CSV の新しい書き方）
- 初期配布16枚（01・02・05 が3枚、03 が1枚、08・10・13 が2枚）：新しく始めたときの所持カードに入れる（`createStarterCollection`）。初期デッキ60枚には入れない・モンスターカード本体は配らない・いまのセーブには配らない
- バトル用カード：届いた正式原画を無改変で `assets/images/cards/monsters/nobiton_battlecard.png` に。枠は黄色 `#FFD400`（`tools/art/battle_card_frame.py` で `frame_nobiton.png`）。
  技カードの枠は分類の色のまま（ノビトン専用の色の枠は作らない）。800×920 と違う縦横比なので、`cards.css` の `.battle-card__art` に `object-fit: contain`（ほかのモンスターの見え方は同じ）

### 2026-10-25 ノビトン（MistralMonstersBC_Nobiton_FINAL_Part1/Part2_20261025）

- 届いたもの：技の絵 PNG 16枚・モンスターカード2枚（正式 JPEG 921×1536・バトル用 PNG 556×941）・技データ TSV・実装指示・QA。
  すべて `design-parts/cards-original/nobiton/` に無改変で保管（`ASSET_SHA256.json` に照合表。`cards/` と `docs/` も）
- 正本は TSV（`src/data/official/nobiton_skills_OFFICIAL_20261025.tsv`・無改変）。ゲームはそれを写した `nobiton_cards_OFFICIAL_20261025.json` を読む
  （技名・マナ・効果の文・区分は書き換えない。`tests/nobiton.test.ts` で TSV と照らし合わせる）。読み込みは `src/data/nobiton.ts`
- 絵：技 `nob_sk_NN.webp`（`tools/art/card_art_webp.py` で幅 827 へ縮小のみ）。モンスター `nobiton_official.webp`（幅 508 へ縮小のみ）・
  `nobiton_battle.webp`（556×941 をそのまま WebP に。ソラモ・ガウルのバトル用と同じ大きさ）。絵の切り抜き・文字入れはしない
- 初期配布8種（01・02・05・08・10・11・13・15）／収集用8種（03・04・06・07・09・12・14・16）＝ユーザー正式確定（TSV の区分どおり）
- **未定**：枠色（`monster_theme_colors.json` に無いので、バトル用カードの枠の金色 `#E8C654` を仮の候補に）、レアリティ、正式英語（仮訳）、
  配る枚数・パック・価格・敵の編成（ガウルと同じく、スターター・パック・相手の編成には入れていない。QA の「全カード」で手に入る）
- 効果の裁定（要仕様確定）は `docs/battle-rules.md`「正式カード（ノビトン）」

### 2026-10-26：ガウル14技（Gaul_Implementation_Ver2_Claude「ガウル全14技・最終実装パック」）

- ZIP の中身はすべて `design-parts/cards-original/gaul14-20261026/` に無改変で保管（参考用の2枚 `05_REFERENCE/` もそのまま。ゲームでは読まない）
- JSON・CSV は無改変で `src/data/official/gaul14_skills_OFFICIAL_20261026.{json,csv}`。ゲームはこの JSON を読む（`src/data/gauul.ts`）
- 絵は届いた 827×937 の PNG を1バイトも変えずに `assets/images/cards/skills/gau14_sk_01〜14.png`
- 技カード新UI（v5）の枠はガウルの色（オレンジ `#E68A46`）を新しく作った（`frame_{normal,hand}_{分類}_gauul.png`。`tools/art/skillcard_v5_monster_color.py … soramo=#E4D2AC gauul=#E68A46`。ソラモ・分類の色の枠は1バイトも変わらない）
- 旧16技はゲームから外した：カードの一覧・絵（`gau_sk_NN.webp`）・原本（`design-parts/cards-original/gauul/`）・`gauul_cards_OFFICIAL_20261024.json` を削除（git の履歴にある）。
  セーブは version 10 で所持・デッキから外す（`migrateGaul14V10`。代わりのカードは配らない。デッキの抜けた分は持っているカードで埋め、足りなければ足りないまま）。古いバックアップも読める（`REMOVED_CARD_IDS`）
- 初期配布（`starter_copies`）は null＝**未確定**。0枚とは扱わず、区分（初期・収集）を持たせない。スターター・パック・相手の編成には入れていない（QA の「全カード」で手に入る）
- 英語：ガウル14技の技名・効果は Claude の仮訳

### 2026-10-24 の改訂（Seimon_Claude_Gaul16_RazukSoramoPatch_20261024_CONTROL）

- 届いた JSON は無改変で `src/data/official/` に置いた：`gauul_cards_OFFICIAL_20261024.json`（ガウル16技）・`lazuck_cards_LATEST_20261024.json`（ラズックの新しい並びと性能）・
  `lazuck_order_mapping_20261024.json`（新旧の番号の対応）・`evasion_LATEST_20261024.json`（回避8件の条件）。元の `soramo_cards_OFFICIAL.json`・`lazuck_cards_OFFICIAL.json` も変えていない
- **ラズックの並び替えは表示の番号（`displayNo`）だけ。** ゲーム内 ID・絵のファイル名・デザイン ID は元のまま（例：トリックショットは `skl-lazuck-09`・`laz_sk_09.webp` のまま表示 07）。
  カード詳細に「番号」を出す
- **旧13 クロスガード（`skl-lazuck-13`）はゲームから削除**（2026-10-24 ユーザー決定）。カードの一覧から外し、セーブは version 8 で所持・デッキから外す
  （`migrateRemoveCrossGuardV8`。デッキの抜けた分は持っているカードで埋め、足りなければ足りないまま＝デッキ編集で直す。代わりのカードは配らない）。
  古いバックアップに入っていても止めずに読み込む（`REMOVED_CARD_IDS`）。元の JSON と絵 `laz_sk_13.webp` は記録として残す
- （2026-10-26 にガウル14技へ置き換え、以下の旧16技の絵・原本は削除）ガウルの技の絵：原本 PNG 16枚を `design-parts/cards-original/gauul/` に無改変で保管（SHA-256 の照合表も）。ゲーム用は `tools/art/card_art_webp.py` で縦横比を変えずに幅 827 に縮めた WebP（`gau_sk_NN.webp`）。
  ラズックのいたずらは原本 JPEG（`design-parts/cards-original/lazuck/`。PNG ではない）から `laz_sk_itazura.webp`
- 技の絵は `object-fit: contain` で全体を入れる（ガウルの原本は縦横比がわずかに違うものがあるため）
- ガウルはパック・スターター・相手の編成に入れていない（配る枚数・敵の編成は未定）。QA の「全カード」で手に入り、デッキに組める
- 英語：ガウルの技名・効果、いたずらは Claude の仮訳
- 【テスト用】ユーザー指示「技の発動を見るため、仮のカードはすべてソラモに」：スターター・相手の編成をソラモ3体に（`createSoramoTestDeck`・`SORAMO_TEAM`）。
  旧セーブは version 6 で1回だけソラモのカードを受け取り、デッキがソラモに替わる（仮カードは消さない）。同じモンスターの重複を「可」に（`DECK_RULES`）
- 【テスト用】2026-10-23 ユーザー指示「仮置きで、ソラモしかいない所にラズックも出して」：スターター＝ソラモ・ラズック・ソラモ（`createMixedTestDeck`）、
  大会・ダンジョンの相手＝その編成とラズック・ソラモ・ラズックを交互に（`src/data/testTeams.ts`）。旧セーブは version 7 で1回だけラズックのカードを受け取り、
  デッキが version 6 で配ったソラモのデッキのままならソラモとラズックのデッキに替わる（自分で組み直したデッキはそのまま）
