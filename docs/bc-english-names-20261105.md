# 指示書 BC：英語の名前の変更＋英語の名前のロゴ（2026-11-05）

指示書：`design-parts/card-names-20261105/00_instructions_BC_20261105.md`（素材 `logos_en/`）。ブランチ `bc-english-names`。**公開はしていない。**

## 【1】英語の名前を変えた所（日本語の名前は変えていない）

| 日本語 | 前の英語 | 新しい英語 |
| --- | --- | --- |
| ガウル | Gaul | **Pyrrow** |
| デスオル | Desuoru | **Desorl** |
| タイラント | Tyrant | **Tyrandos** |

| ファイル | 場所 |
| --- | --- |
| `src/i18n/contentEnOfficialDraft.ts` | 3体のカードの名前と説明（`card:mon-gauul` など） |
| `src/i18n/contentEnAJ.ts` | デスオルの技の文「…except Desorl.」 |
| `src/i18n/messages/introV2.ts` | 箱をえらぶ所の文「It's Pyrrow's pack…」 |
| `src/i18n/messages/screens.ts` | 図鑑の上の文（正式カードの名前の一覧） |
| `tests/gauul.test.ts`・`tests/desuoru.test.ts`・`tests/tyrant.test.ts` | 英語の名前を確かめるテスト |

- 変えたあと、`src`・`tests`・`public` に Gaul・Desuoru・Tyrant（英語の文）は残っていない（変えた記録のコメントだけ）
- カードの ID（`mon-gauul`・`mon-desuoru`・`mon-tyrant`）と絵のファイル名は変えていない（セーブがこの ID を使うため）

## 【2】英語の名前のロゴ

- 素材 `name_en_*.png`（1400×300）を `python3 -I tools/art/card_name_logos.py` で `assets/images/ui/card_name/logos/name_en_*.webp`（20枚）にした
- 文字の位置は指示書のとおり 左 約40・上 約48（`LOGO_GLYPH_EN`）。日本語と同じしくみ・位置・大きさ（枠の色のスウッシュも同じ）
- 英語にしたときは英語のロゴ、日本語のときは日本語のロゴ（`src/ui/components/cardNameLayer.ts`）
- 長い名前（Serephine・Tyrandos・Hyozuku）は LIFE の札に重ならないよう小さくなる。p・y・j などの下に出る所も切れていない（写真で確認）
- 英語の仮の字体 Bangers とライセンスの文をビルドから外した（`assets/fonts/card-name/`・`public/licenses/card-name-fonts/`）。名前の字体はもう1つも入っていない

## 【3】確かめたこと

- テスト 1443件が通った。セーブの version は 35 のまま（名前はセーブに入っていないので、前のセーブもそのまま遊べる）
- 写真：20体（英語）・日本語と英語を並べた一覧・箱を開けた画面（英語）・図鑑の小さいカード（英語）。390×844・320×568
- 写真の道具：`tools/e2e/ay_names_shot.cjs`（`LANG=en`）・`tools/e2e/bc_book_shot.cjs`（図鑑）

## 要確認

1. 図鑑の上の文（正式カードの名前の一覧）にタイラント（Tyrandos）は入っていない。タイラントは今「確かめ用だけ」で図鑑に出ないため、そのままにした
2. 一番小さいカード（320×568 の小さい表示）で、Hyozuku は LIFE の札とのすき間が少し狭い（重なってはいない）
3. 絵のファイル名は ID に合わせて `name_en_gauul.webp`・`name_en_tyrant.webp` のまま（画面には出ない）
