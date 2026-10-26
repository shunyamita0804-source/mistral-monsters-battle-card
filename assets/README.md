# assets/ — ゲーム素材

ゲームで使う画像・音声・フォント・データを置く場所です。
ここに置いたファイルはコードから `import` して使い、Vite がビルド時にハッシュ付きファイル名で出力し、
GitHub Pages のサブパス（`/sacred-monsters-battle-card/`）にも自動で対応します。

```ts
import monsterUrl from '@assets/images/cards/monsters/monster_001.png';
```

## ディレクトリ構成

| パス | 用途 | コード上のカテゴリ名 |
| --- | --- | --- |
| `images/cards/monsters/` | モンスターカード画像 | `monsterCards` |
| `images/cards/skills/` | 技カード画像 | `skillCards` |
| `images/characters/` | キャラクター立ち絵・ドット絵 | `characters` |
| `images/backgrounds/` | 背景画像 | `backgrounds` |
| `images/ui/` | ボタン・枠などUI部品 | `ui` |
| `images/icons/` | アイコン | `icons` |
| `images/maps/town/` | 街マップ | `townMaps` |
| `images/maps/rooms/` | 部屋（建物の中）の絵・家具 | `roomMaps` |
| `images/maps/dungeon/` | ダンジョンマップ | `dungeonMaps` |
| `images/effects/` | エフェクト | `effects` |
| `audio/bgm/` | BGM | `bgm` |
| `audio/se/` | 効果音 | `se` |
| `fonts/` | フォント | `fonts` |
| `data/` | カード・モンスター等の定義データ（JSON） | `data` |

カテゴリ定義は `src/core/assetCategories.ts` にあり、テストでこの構成と一致することを確認しています。
ディレクトリを増やす場合は両方を更新してください。

## 配置済みの素材（2026-10-22）

| パス | 内容 | 状態 |
| --- | --- | --- |
| （退役）`images/ui/skillcard/` | 技カードUIテンプレート V4。2026-10-25 に新UI v5 へ替えたので `design-parts/ui-skillcard-v4-retired/` に移した（ゲームでは使わない） | 退役 |
| `images/ui/button/btn_command_blank.png`・`btn_command_blank_wine.png` | コマンドボタン（金の枠・青地／ワインレッド地）。無地に場面ごとの文字を重ねて使う | ユーザー提供（2026-10-22）の「はい／いいえ」画像から切り出し、1/2 に縮小。「はい」の文字の部分を左右の色でつないで消した（「はい／いいえ」の文字入りは使わない：ユーザー指示）。ワインレッドは青地だけを塗り替えたもの（金の枠はそのまま） |
| `images/characters/player_{male,female}_idle_front.png` | 主人公の正面の立ち姿（主人公を選ぶ画面） | 2026-10-23 の大人の絵の正面「立つ」コマ（`tools/art/adult_walk_build.py --idle`） |
| `images/characters/player_{male,female}_sheet.webp` | **ゲームで使う主人公の絵**（5列×4行：右足を前・立つ・左足を前・立つ・立ち止まり） | 2026-10-23 納品の大人の絵（男性は同じ日の別便）（原本 `design-parts/characters-adult/`）から `tools/art/adult_walk_build.py` が作る。人ごとに背の高さをそろえて縮小・位置合わせ（足元と上半身）・右向きは左向きの反転だけ（描き換えなし）。2026-10-23 に人物を 1.2 倍で表示するため、全員 `--scale 1.5`（1コマ 324×432）・WebP で作り直した |
| `images/characters/npc_neighbor_guide_walk.webp` | となりの家の女性（案内役）の歩行（4方向×4コマ、324×432。右足を前・立つ・左足を前・立つ）。待機の絵は2コマ目 | 2026-10-23 納品の大人の絵から `tools/art/adult_walk_build.py --npc` が作る（描き換えなし） |
| `images/characters/npc_{clerk,researcher,receptionist,teacher,resident_a〜e}_walk.webp` | 店員・研究員・受付・練習場の先生・住人A〜E の歩行（形は案内役と同じ） | 2026-10-23 納品の大人の絵から `tools/art/adult_walk_build.py --npc` が作る（描き換えなし） |
| `images/characters/neighbor_guide_talk_{normal,smile,explain,surprised,worried,happy}.webp` | 案内役の会話の絵（胸から上・表情6種。困り顔 troubled は worried） | ユーザー提供・**正式**。原本 1122×1402 PNG を半分（561×701）に縮小して WebP にしただけ（描き換えなし） |
| `images/maps/town/town_r{0-2}c{0-2}.webp` | 街の完成図（3×3 に分割） | ユーザー承認済みの部品（建物11・噴水・地面3・小物4）を `tools/design/seimon_world_build.py` が設計図どおりに並べたもの。4800 を 3600 に縮小。部品の絵は描き換えていない（縮小・切り抜き・ふちの整理・影） |
| `images/maps/rooms/*.webp` | 7種類の部屋の箱と家具（1つずつ切り出し） | 同上（部屋の箱7・家具7） |
| `images/ui/talk/dialogue_window_blank.png`・`name_label_blank.png`・`button_blank.png` | 会話のセリフ枠・名前の札・選択肢のボタン（無地。文字はゲーム側で重ねる） | ミストラルモンスターズの会話 UI を許可により利用（ユーザー指示 2026-10-22。`docs/audio-credits.md`）。加工なし |

| `audio/se/card_draw.*`・`turn_order_select.*`・`mana_gain.*` | 効果音（カードを引く・先攻後攻を選ぶ・マナが増える）。OGG と M4A | ミストラルモンスターズの素材を許可により利用（`docs/audio-credits.md`） |
| `audio/se/mana_convert.ogg`・`mana_convert.m4a`（原本 `mana_convert_original_44100.wav`） | マナ化の効果音（09）。ChatGPT 作の独自の電子音（2026-10-22 ユーザー送付・指示） | 受け取ったまま（`docs/audio-credits.md`）。原本 WAV はビルドに含めない |
| `audio/se/evade_success.mp3`・`hit_normal.mp3`・`hit_strong.mp3`・`mana_spend.mp3` | 正式採用の効果音（回避成功・通常命中・強攻撃命中・マナ消費） | ユーザー承認の MP3 をそのまま（`docs/audio-credits.md`） |

ミスモン（本編）の素材（2026-10-22）：ダンジョンの対戦の背景（`images/backgrounds/battle_field_*`）・宝箱（`images/maps/dungeon/chest_*`）・景品のアイコンと金貨（`images/icons/`）・ボタン（`images/ui/button/mm_*`。2026-10-23 から未使用）・BGM（`audio/bgm/bgm_*.mp3`）。出どころは `docs/audio-credits.md`。

街・部屋の部品の原本（絵を作り直すときの材料。ゲームには直接入らない）は `design-parts/seimon-world/`（2026-10-22〜。何がそろっているかは中の README）。

アプリアイコンは `public/icons/`。**2026-10-23 に新しい正式アイコンへ差し替え**：原本 `images/icons/sacred-monsters-bc-official-icon-v2.png`（1254×1254。受け取った画像をそのまま保管・改変なし）から、
高品質縮小（Lanczos）で 512・192・48・32・16 を作成。外側の黒い角だけ透明にした（絵は描き換えていない）。180（apple-touch-icon）は iPhone が角を丸めるので黒い角のまま。
以下は前の版の記録：2026-10-22 にユーザー承認の正式アイコンへ差し替え：
原本 `images/icons/sacred-monsters-bc-official-icon.png`（1254×1254 RGBA。受け取ったファイル「セイクリッドモンスターズBC_正式アイコン.png」をそのまま保管・改変なし）から、
高品質縮小（Lanczos）だけで 512・192・180（apple-touch-icon）・48・32・16 を作成。透過加工・切り抜き・加筆はしていない（原本の角の外側は白）。
原本はビルドに含めない（画面では `public/icons/icon-512.png` を使う）。

## 命名規則

- 小文字英数字・ハイフン・アンダースコアのみ（例: `monster_001.png`, `bgm-title.ogg`）
- 日本語・スペース・大文字は使わない（環境によりURLやビルドで問題が出るため）
- 連番は3桁ゼロ埋め（`_001`）

## 推奨フォーマット

- 画像: PNG（ドット絵・透過）／WebP（写真調・背景）
- 音声: OGG と M4A（iOS Safari 対応のため両方用意を推奨）

## 注意

- 権利が確認できていない素材は置かないでください。
- `.psd` `.clip` などの作業用ファイルは `.gitignore` で除外しています。
- ビルドを通さずにURLで直接参照したいファイル（`robots.txt` 等）は `public/` に置きます。

## 配置した素材（2026-10-23）

| パス | 内容 | 状態 |
| --- | --- | --- |
| （削除）`images/cards/skills/sor_sk_01〜16.webp` | 旧ソラモの技16種の絵。2026-10-25 にソラモ14技へ替えたので削除（原本は design-parts に残る） | 削除 |
| `images/cards/monsters/{soramo,gauul,lazuck}_{official,battle}.webp` | モンスターカード（正式カード＝名前・LIFE 入り／バトル用＝文字なし）（ZIP「Mismon_MonsterCards_Official_and_Battle_20261023」） | ユーザー提供。WebP（品質90）。ガウル・ラズックは登録のみ（ゲームで未使用） |
| `images/backgrounds/title_bg.webp`・`battle_arena.webp` | タイトルの背景・大会の対戦の背景（ZIP「UI画像10種」） | ユーザー提供（画像生成）。WebP |
| `images/ui/frame/*.webp`・`images/ui/card_back.webp`・`images/ui/packs/pack_0N.webp` | 共通背景・見出しの帯・窓の枠・一覧のパネル・カードの裏面・パック3種（同） | 切り抜きと 1/2 縮小（枠・帯・パネル）、背景は 512px、裏面は幅400、パックは幅240。描き換えなし |
| `images/characters/face_{clerk,receptionist}.webp` | 店員・受付の顔（ショップ・大会受付の画面） | 384px に縮小 |
| `images/maps/dungeon/dungeon_{floor,wall_top,wall_face}.webp`・`stairs_{down,up}.webp`・`enemy_symbol.webp` | ダンジョンの床・壁の上面・壁の正面・階段・魔物のしるし（ZIP「Seimon_UI_Quality2_20261023」） | ユーザー提供（画像生成）。床・上面は 512px、正面は上下の端を切り落として幅768、部品は切り抜きと縮小 |
| `images/backgrounds/battle_dungeon.webp`・`pack_open_bg.webp` | ダンジョンの対戦の背景・パックを開けるときの光（同） | WebP |
| `images/ui/result_{win,lose}.webp`・`images/ui/rank/rank_?.webp`・`images/ui/hud/*.webp` | 勝ち負けの帯・ランクの紋章6つ・街の上の札とボタン（同） | 切り抜きと縮小。描き換えなし |
| `images/characters/face_resident_{a,b,c,d,e}.webp` | 住人A〜E の顔の絵（ZIP「Seimon_Faces_Residents_20261023」） | ユーザー提供（画像生成）。384px に縮小。会話の絵として使う |
| `images/ui/battle/*.webp`・`images/ui/card_unknown.webp`・`images/ui/gacha_machine.webp`・`images/ui/banners/*.webp`・`images/ui/hud/joystick_*.webp`・`images/ui/reward_glow.webp`・`images/maps/dungeon/boss_symbol.webp`・`images/backgrounds/newgame_bg.webp` | デザイン第4弾10種（ZIP「Seimon_UI_Quality4_20261023」） | ユーザー提供（画像生成）。切り抜きと縮小。描き換えなし |
| `images/characters/face_{researcher,teacher,opponent_e1〜e3,opponent_d1〜d3}.webp` | 研究員・先生・大会の対戦相手6人の顔の絵（ZIP「Seimon_Faces_FIXED」） | ユーザー提供（画像生成）。384px に縮小 |

## 配置した素材（2026-10-25）

| パス | 内容 | 状態 |
| --- | --- | --- |
| `images/cards/skills/sor14_sk_01〜14.png` | ソラモ14技の絵（ZIP「MistralBC_Soramo14_Claude_NewUI_Implementation_20261025」の 01_SKILL_IMAGES） | ユーザー承認の正式画像。827×937 の PNG を1バイトも変えずに置いた（名前だけ命名規則に合わせた）。原本は `design-parts/cards-original/soramo14-20261025/` |
| `images/cards/skills/gau14_sk_01〜14.png` | ガウル14技の絵（ZIP「Gaul_Implementation_Ver2_Claude」の 01_SKILL_IMAGES。2026-10-26） | ユーザー承認の正式画像。827×937 の PNG を1バイトも変えずに置いた（名前だけ命名規則に合わせた）。原本は `design-parts/cards-original/gaul14-20261026/` |
| （削除）`images/cards/skills/gau_sk_01〜16.webp` | 旧ガウルの技16種の絵。2026-10-26 にガウル14技へ替えたので削除（git の履歴にある） | 削除 |
| `images/ui/skillcard_v5/frame_{normal,hand}_*.png`・`mana_0〜10.png`・`icon_*.png` | 技カードの新UI（v5）の枠・マナの玉・技種別アイコン | 承認済みの参考画像から切り出し（`tools/art/skillcard_v5_extract.py`）、全分類を同じ形にして色付け（`tools/art/skillcard_v5_monster_color.py`。モンスターの色：ソラモ＝クリーム、ガウル＝オレンジ）。参考画像の解像度の都合で、枠は幅 253px（手札用 208px）まで |
