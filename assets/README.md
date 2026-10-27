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
| `images/ui/frame/*.webp`・`images/ui/card_back.webp`（2026-10-27 装飾なしの裏面に差し替え：`tools/design/card_back_build.py`。400×600）・`images/ui/packs/pack_0N.webp` | 共通背景・見出しの帯・窓の枠・一覧のパネル・カードの裏面・パック3種（同） | 切り抜きと 1/2 縮小（枠・帯・パネル）、背景は 512px、裏面は幅400、パックは幅240。描き換えなし |
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
| `images/cards/skills/sor14v2_sk_01〜14.png` | ソラモ14技の絵・技イラスト Art Ver.2（ZIP「Soramo_ArtV2_14Skills_Claude_Implementation_Starter16」の 01_SKILL_IMAGES。2026-10-26） | ユーザー承認の正式画像。827×937 の PNG を1バイトも変えずに置いた（名前だけ命名規則に合わせた）。原本は `design-parts/cards-original/soramo14-artv2-20261026/` |
| （削除）`images/cards/skills/sor14_sk_01〜14.png` | それまでのソラモ14技の絵（2026-10-25）。2026-10-26 に Art Ver.2 へ替えたので削除（git の履歴にある） | 削除 |
| `images/cards/skills/gau14_sk_01〜14.png` | ガウル14技の絵（ZIP「Gaul_Implementation_Ver2_Claude」の 01_SKILL_IMAGES。2026-10-26） | ユーザー承認の正式画像。827×937 の PNG を1バイトも変えずに置いた（名前だけ命名規則に合わせた）。原本は `design-parts/cards-original/gaul14-20261026/` |
| （削除）`images/cards/skills/gau_sk_01〜16.webp` | 旧ガウルの技16種の絵。2026-10-26 にガウル14技へ替えたので削除（git の履歴にある） | 削除 |
| `images/ui/{order,vs,newgame,badges,tournament}/`・`images/ui/packs/pack_locked.webp`・`images/ui/banners/banner_rankup.webp`・`images/effects/fx_*.webp`・`images/characters/{hero,face_hero}_{male,female}.webp` | デザイン第8弾（2026-10-26）：先攻・後攻のカードの表・VS の部品・主人公を選ぶ札・主人公の立ち絵と顔・技の光・レア度と NEW の印・鍵つきパック・勝ち抜き表・ランクアップの帯 | 原本 `design-parts/ui-quality8-20261026/` から `tools/design/ui8_build.py` で切り出し・縮小（描き直しなし）。記録は `docs/design/ui-quality8-20261026/10_受け取り結果_UTF8.txt` |
| `images/ui/title/title_logo.webp`・`images/ui/battle/{target_*,knockout_mark,status_*,life_*,ticker_frame,stats_frame_*,hand_*}.webp`・`images/effects/fx_mana_*.webp`・`images/backgrounds/battle_practice.webp`・`images/maps/dungeon/sign_*.webp` | デザイン第9弾（2026-10-26）：タイトルロゴ・対象の矢印・戦闘不能の印・状態のアイコン・ライフのゲージ・帯と情報の欄の枠・マナの光・手札の印・練習試合の背景・ダンジョンの案内板 | 原本 `design-parts/ui-quality9-20261026/` から `tools/design/ui9_build.py` で切り出し・縮小（描き直しなし）。記録は `docs/design/ui-quality9-20261026/10_受け取り結果_UTF8.txt` |
| `images/ui/skillcard_v5/frame_{normal,hand}_*.png`・`mana_0〜10.png`・`icon_*.png` | 技カードの新UI（v5）の枠・マナの玉・技種別アイコン | 承認済みの参考画像から切り出し（`tools/art/skillcard_v5_extract.py`）、全分類を同じ形にして色付け（`tools/art/skillcard_v5_monster_color.py`。モンスターの色：ソラモ＝クリーム、ガウル＝オレンジ）。参考画像の解像度の都合で、枠は幅 253px（手札用 208px）まで |

## 配置した素材（2026-10-27）

| パス | 内容 | 状態 |
| --- | --- | --- |
| `images/maps/dungeon/forest_*.webp`・`boss_mark_{ruins,forest}.webp`・`images/backgrounds/battle_forest.webp`・`images/characters/{battler_1〜3,face_battler_1〜3,guardian,face_guardian}.webp`・`images/ui/dungeon/*.webp` | デザイン第12弾（2026-10-27）：精霊の森の床・壁・階段・対戦の背景、ダンジョンのバトラー3人と顔、ボスの間のしるし、見えない番人、十字キーと A・B、ミニマップの枠と印 | 原本 `design-parts/ui-quality12-20261027/` から `tools/design/ui12_13_build.py` で切り出し・縮小（描き直しなし）。記録は `docs/design/ui-quality12-20261027/10_受け取り結果_UTF8.txt` |
| `images/characters/hero_{male,female}_{win,lose}.webp`・`images/ui/battle/talk_{bubble,face_frame}.webp`・`images/ui/dungeon/{banner_retreat,lantern_on,lantern_off}.webp`・`images/backgrounds/{tournament_champion,battle_arena_d}.webp` | デザイン第13弾（2026-10-27）：主人公の勝ち・負けの姿、相手のひと言の吹き出しと顔の枠、戻されるときの帯と負けの灯り、優勝の場面、D ランク大会の対戦の背景（物語の始まりの挿絵は原本だけ） | 原本 `design-parts/ui-quality13-20261027/` から同じ道具で切り出し・縮小。記録は `docs/design/ui-quality13-20261027/10_受け取り結果_UTF8.txt` |
| `images/ui/gacha/handle_{disc,crank}.webp` | 販売機のハンドル（動かない円盤・回る取っ手。2026-10-27 ZIP「MistralBC_CardShop_Handoff_FIXED」の正式 Handle_Official_Reference.jpeg） | 白い背景を透明にして2枚に分けた（`tools/design/gacha_build.py`）。取っ手に隠れていた円盤は、円盤の見えている所を回して写して埋めた。描き換えなし |
| `images/ui/gacha/{machine_*,outlet_*,pack_sealed,turn_bg}.webp` | 販売機の正面図・ガラスの光・ハンドルの座・取り出し口（閉・開・受け皿のふち）・無地のパック・回す画面の背景（2026-10-27 ZIP「MistralBC_CardShop_Assets_20261027」の A・B・G） | 原本 `design-parts/cardshop-assets-20261027/assets/`。900×1300 のまま WebP（`tools/design/gacha_build.py`）。背景だけ幅 780 に縮小。描き換えなし |
| `images/maps/rooms/cardshop_*.webp`・`images/maps/town/shop_door_{left,right}.webp`（と街の絵 `town_r1c0`・`town_r2c0` のカードショップ） | カードショップの新しい内装（床と壁・家具・店の中の販売機・入口の戸・戸袋・戸枠・手前の壁）と外観・外の戸（同じ ZIP の C・D・E・F） | 同じ原本から `tools/design/cardshop_v2.py`（`seimon_world_build.py` から呼ぶ）で切り抜き・形式の変換。外観は街に焼き込み、戸だけ別の絵。描き換えなし |
| `images/cards/skills/myu14_sk_01〜14.png`・`images/cards/monsters/myurol_battlecard.png`・`images/ui/battlecard/frame_myurol.png`・`images/ui/skillcard_v5/frame_*_myurol.png` | ミュロル正式14技の絵・バトル用の透過 PNG（2026-10-27）と水色の枠 | 絵は届いた PNG を無改変（原本 `design-parts/cards-original/myurol14-20261027/`）。枠は既存のテンプレートから道具で色替え。それまでの `myu_sk_01〜16` は外した |
| `images/cards/skills/kal_sk_01〜14.png`・`images/cards/monsters/kalshell_battlecard.png`・`images/ui/battlecard/frame_kalshell.png`・`images/ui/skillcard_v5/frame_*_kalshell.png` | カルシェルの技の絵14枚・バトル用の透過 PNG（2026-10-27）と淡い氷色の枠 | 絵は届いた PNG を無改変（原本 `design-parts/cards-original/kalshell14-20261027/`）。枠は既存のテンプレートから道具で色替え |
| `images/ui/items/*.webp`・`images/ui/shop/menu_items.webp`・`images/effects/fx_{smoke,charm}_N.webp` | ダンジョンの道具の絵8つ・効き目の印・守ったカードの印・持っている数の札・ショップの4枚目の札・煙玉とお守りの演出（2026-10-27 デザイン33点の 14・15・31〜33） | 原本 `design-parts/ui33-20261027/`。`tools/design/ui33_build.py` で切り抜き・縮小。描き換えなし。ファイル名は小文字と _（guardianCharm → `item_guardian_charm.webp`） |
| `images/effects/{drun_light,fx_leave}_N.webp`・`images/ui/dungeon/{omen_vignette,omen_fog,stairs_confirm,pouch_N,menu_*}.webp`・`images/maps/dungeon/ruins_b{2,3}_*.webp`・`images/ui/reward/{card_get_*,clear_scene,first_clear_seal*}.webp`・`images/ui/frame/{emblem_*,empty_*}.webp`・`images/ui/hud/btn_*.webp`・`images/backgrounds/deck_bg.webp`・`images/ui/settings/credits_*.webp` | デザイン33点のうち、いまある画面・演出に組み込んだもの（明かり・気配・地下2/3階・去る光・技カードを得た台・革袋・メニュー・クリア報酬・階段・紋章・右上のボタン・空のとき・デッキ編集の背景・クレジットの巻物） | 同じ原本・同じ道具。`omen_fog` だけは、乗算用の原本を「白を透明に・霧を 2.2 倍に明るく」した版（真っ黒な画面でも見えるように） |
| `images/ui/later/*.webp` | デザイン33点のうち、まだ画面・機能がないもの（8 技カードを失う〔古い裏面の絵のため保留〕・11 全体地図・16 起動画面・17 読み込みの印・19 まだ行けない場所・21 売ったときのお金・22 短いお知らせ・25 初めての人への案内） | シートのまま 1/2 に縮小して置いただけ（ゲームでは使っていない）。使うときに切り分ける |
| `store/*.png` | ストア用（28 スクリーンショットの台紙・29 Google Play の横長の絵・30 Android のアイコン〔前景・背景の分けた版も〕） | 原本の PNG をそのまま（ゲームでは使わない） |
