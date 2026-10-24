# CLAUDE.md — ミストラルモンスターズ バトルカード

スマホ縦持ち 2D カードゲーム（モンスターファームバトルカード風。街・ダンジョンは GB版風、バトルは PS版風）。
正式名称：ミストラルモンスターズ バトルカード（Mistral Monsters Battle Card、短縮表示「ミストラルBC」。2026-10-24 ユーザー決定）。旧名「ミルティル」「ミストリア」「セイクリッドモンスターズ」。
本編（`shunyamita0804-source/mystic-monsters`）の名前もミストラルモンスターズ（旧ミスティックモンスターズ）。
リポジトリ名は `mistral-monsters-battle-card`（2026-10-24 ユーザーが改名。旧 `sacred-monsters-battle-card`・`mirtill-monsters-battle-card`。名前の変更は `docs/rename-migration.md`）。
公開URL：https://shunyamita0804-source.github.io/mistral-monsters-battle-card/セーブのキー `mistria-battle-card/…` は互換のため変えない。

## 資料の読み方（時間短縮のため必ず守る）

- **セッション開始時に読むのはこのファイルと `docs/handoff.md` だけ。** 他の資料をまとめて読まない
- それ以外は、作業に必要になったときに該当する1つだけ読む：

| こんなとき | 読む資料 |
| --- | --- |
| 構成・画面・ロジックを知りたい | `docs/architecture.md`（必要な章だけ） |
| 公開する | `docs/handoff.md` の「公開の手順」 |
| 効果音・本編素材を使う | `docs/audio-credits.md` |
| 素材を置く | `assets/README.md` |
| 名称変更 | `docs/rename-migration.md` |
| 画面の文字・英語 | `docs/i18n.md` |
| カードデータ・ID の決まり | `docs/card-data-policy.md` |
| 過去の経緯を確認したい（ふだんは読まない） | `docs/nightbatch-2026-10-22-report.md`・`docs/phase-*-report.md` |

- ソースも全体を読まず、`grep` で該当箇所を探してから読む
- 作業を終えたら `docs/handoff.md` の「いまの状態」を短く更新する（長い経緯は書かない）

## 絶対に守るルール

1. 指示書・指示の範囲だけ実装する。終わったら止めて報告し、承認を待つ。曖昧なら実装前に確認
2. 本編 `shunyamita0804-source/mystic-monsters` は**変更禁止**。素材の利用だけ許可済み（読み取りのみ、`docs/audio-credits.md` に記録）。ソースの流用はしない
3. **公開（GitHub Pages）はユーザーが「公開して」と言ったときだけ**
4. リポジトリ設定は変えない（Public 化と Pages はユーザー承認済み）。force push しない
5. カード・ルール・価格・提供割合・大会・敵編成・マップはすべて**仮**（`src/data/`）。正式データは許可されるまで作らない
6. できなかったことは「未完了」と明記する
7. ユーザーは日本語・非エンジニア。報告は短く、専門用語を避ける。コメント・ドキュメント・コミットも日本語

## 作業のしかた

- 作業はブランチで行い、確認後に `main` へマージ（公開する版は `main`）
- Node 24 と依存関係はセッション開始時に自動で入る（`.claude/hooks/session-start.sh`）
- コミット前に `npm run check`（型チェック＋テスト＋ビルド）
- 画面確認：`npx vite preview --port 4173 --host 127.0.0.1`、URL に `?qa=1` で QA ボタン

## コードの約束

- import は拡張子付き。型だけなら `import type`。エイリアス `@/`=`src/`、`@assets/`=`assets/`
- `assets/` は `import url from '@assets/...'`、`public/` は必ず `resolvePublicPath()` を通す（絶対パス直書き禁止）
- ゲームルールは DOM 非依存（`src/game/`）にして Vitest でテスト。UI は `src/ui/`
- 390×844 の論理 px で CSS を書く。タップ領域は高さ 40px 以上
- 画面追加：`config/screens.ts` → `ui/screens/` → `registry.ts`
- セーブ変更は `GameStore.update(純粋関数)`。形式を変えたら `SAVE_VERSION` と `MIGRATIONS`
- 一度きりの処理（購入・景品など）は ID で1回だけ処理する
- 仮カードは `isPlaceholder: true`・名前「仮」始まり。画面にも「仮」と出す（英語では「Temp」）
- 画面の文字は直書きせず `t('キー')`（`src/i18n/messages/`）。カード名などは `cardName()` など（`src/i18n/content.ts`）。日英両方を書く
