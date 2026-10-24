# 名称変更の移行（→ ミストラルモンスターズ）

## 2026-10-24 の変更（ユーザー決定：セイクリッドモンスターズ → ミストラルモンスターズ）

| 項目 | 値 |
| --- | --- |
| シリーズ名 | ミストラルモンスターズ（英語：Mistral Monsters） |
| ゲーム名 | ミストラルモンスターズ バトルカード（英語：Mistral Monsters Battle Card） |
| ホーム画面などの短縮表示 | ミストラルBC（前の「セイクリッドBC」に合わせて Claude が決めた。変えるならユーザーの指示で） |
| 本編 | ミストラルモンスターズ（旧ミスティックモンスターズ）。本編のリポジトリ `mystic-monsters` は変更禁止なので触っていない |

変えたもの：`src/config/app.ts`・`index.html`・`public/manifest.webmanifest`・`package.json` の説明・バックアップのファイル名（`mistral-monsters-bc-backup-…`。
中身の形は同じで、前のファイルも読み込める）・テスト・`CLAUDE.md`・`README.md`・資料の本編の名前。

変えていないもの：
- セーブのキー `mistria-battle-card/…`・バックアップの形の名前 `sacred-monsters-battle-card/save-backup`（変えると前のセーブ・バックアップが読めない）
- アイコンの原本のファイル名（`sacred-monsters-bc-official-icon*.png`）・過去の依頼文や報告の中の旧称（当時の記録）

### リポジトリ名・公開URLの変更（2026-10-24 ユーザー指示「GitHub のリポジトリ名と公開URLも変更して」）

新しい名前：`mistral-monsters-battle-card`。新しい公開URL：https://shunyamita0804-source.github.io/mistral-monsters-battle-card/

- コード側（済み）：`vite.config.ts` の `REPO_NAME`・`package.json`/`package-lock.json` の name・テスト。
  公開の仕組み（`deploy-pages.yml`）は実際のリポジトリ名から base を作るので、改名の前に公開しても壊れない
- GitHub 上の改名（ユーザーが行う。Claude には改名の手段がない）：
  https://github.com/shunyamita0804-source/sacred-monsters-battle-card/settings → General → Repository name を
  `mistral-monsters-battle-card` にして「Rename」
- そのあと Claude が：手元の接続先を新しい URL に、`CLAUDE.md` のリポジトリ名を更新、「Deploy to GitHub Pages」を実行、新しいURLで表示を確認
- **2026-10-24 完了**：ユーザーが改名 → Claude が接続先を変更・新しいリポジトリで公開
- 旧URL（…/sacred-monsters-battle-card/）は改名後 404 になる（転送されない）。ホーム画面のアプリは新しいURLで置き直す。
  セーブは同じドメインなので Safari では読める見込みだが、ホーム画面のアプリでは見えないことがある → 改名の前に「設定 → セーブをバックアップ」

※ 名称を変えたことは、商標として安全であることの保証ではない（商標の確認は未実施）。

---

（以下は 2026-10-22 の変更の記録）

## 旧：名称変更の移行（→ セイクリッドモンスターズ）

## 正式名称（2026-10-22 ユーザー決定）

| 項目 | 値 |
| --- | --- |
| シリーズ名 | セイクリッドモンスターズ（英語：Sacred Monsters） |
| ゲーム名 | セイクリッドモンスターズ バトルカード（英語：Sacred Monsters Battle Card） |
| ホーム画面などの短縮表示 | セイクリッドBC（勝手に変えない） |
| 旧称 | ミルティル（Mirtill）→ ミストリア（Mistria）→ いまの名前。画面・アプリ情報からは除いた。過去の報告・記録の旧称は当時の記録として残す |

※ 名称を変えたことは、商標として安全であることの保証ではない（商標の確認は未実施）。

## コード側（このブランチで完了）

| 場所 | 内容 |
| --- | --- |
| `src/config/app.ts` | 正式名称・英語名・短縮表示。バージョン 0.4.0 |
| `package.json`・`package-lock.json` | `sacred-monsters-battle-card` |
| `index.html`・`public/manifest.webmanifest` | 題名・ホーム画面名（セイクリッドBC）・正式アイコン |
| `vite.config.ts` | `REPO_NAME = 'sacred-monsters-battle-card'`（Pages の base `/sacred-monsters-battle-card/`） |
| `.github/workflows/ci.yml`・`deploy-pages.yml` | base は**実際のリポジトリ名**から作る（`VITE_BASE_PATH: /${{ github.event.repository.name }}/`）。改名の前に動かしても旧URLで壊れない |
| テスト | `tests/viteConfig.test.ts`・`tests/assetPath.test.ts`・`tests/app.test.ts`・`tests/compat.test.ts` |

## GitHub 上の改名（2026-10-22 ユーザーが実施・完了）

新URLへの公開も完了（`main` の `7f72020`）。手順の記録：

1. https://github.com/shunyamita0804-source/mirtill-monsters-battle-card → Settings → General → Repository name を
   `sacred-monsters-battle-card` にして「Rename」
2. そのあと Claude が：手元の接続先を新しい URL に変更（`git remote set-url origin https://github.com/shunyamita0804-source/sacred-monsters-battle-card`）、
   Actions の「Deploy to GitHub Pages」を `main` で実行、新URLで表示を確認
3. 新しい公開URL：https://shunyamita0804-source.github.io/sacred-monsters-battle-card/

- 旧リポジトリの Web・git の URL は GitHub が新 URL へ転送する
- **旧 Pages の URL（…/mirtill-monsters-battle-card/）は転送されない**（404 になる）。別のリポジトリで旧URLを残すことはしない
- 旧リポジトリの削除・新しいリポジトリの作成はしない

## セーブの引き継ぎ

- セーブのキー `mistria-battle-card/save`（読めなかったときの退避 `…/save-unreadable-backup`、復元前の退避 `…/save-before-restore`、設定 `…/settings`）は**変えない**
- localStorage はドメインごと（`shunyamita0804-source.github.io`）なので、**Safari で開く場合**はパスが変わっても同じセーブを読める見込み（実機は未確認）
- **ホーム画面に追加したアプリ（PWA）**：iPhone ではホーム画面のアプリごとに保存領域が別になることがあり、
  新しい URL でホーム画面に追加し直すと、前のセーブが見えない可能性がある。旧URLのアイコンは開けなくなる
- 引き継ぎを保証しないため、設定画面の「セーブをバックアップ（書き出し）」→ 新しい URL で「バックアップから復元」を案内する
