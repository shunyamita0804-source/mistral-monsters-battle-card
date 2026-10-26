# 音源の出どころ（効果音）

ゲームで鳴らす音は `src/ui/sound.ts` の `SE_REGISTRY` で管理する。素材を差し替えるときは、ファイルを `assets/audio/se/` に置き、
`SE_REGISTRY` とこの表を更新する。

（2026-10-24：本編の名前はミスティックモンスターズ → ミストラルモンスターズに変更。リポジトリ名 `mystic-monsters`・素材のフォルダ名はそのまま）

2026-10-22：ユーザー（ミストラルモンスターズとバトルカードの両方の所有者）の許可により、ミストラルモンスターズ
（`shunyamita0804-source/mystic-monsters`）の素材を利用。本編リポジトリは読み取りのみで、変更していない。
後から別の素材・UI を用意する可能性がある（ユーザー）。

| 場面（SE_REGISTRY） | ファイル | 元の素材（ミストラルモンスターズ） | 作者・ライセンス | 加工 |
| --- | --- | --- | --- | --- |
| `cardDraw`：カードを引く・手札に配る（1枚ごと） | `card_draw.ogg` / `card_draw.m4a` | `assets/audio/se/interface_sfx_pack_1/cursor_style_2.ogg`（本編の UI_SELECT） | Interface SFX Pack 1 / ObsydianX（CC0・クレジット不要） | 末尾の無音を切り落とし、iPhone 用に M4A（AAC）も作成。音色は変えていない |
| `manaGain`：山札からマナが増えた（手札5枚のときのドロー・カードの効果）。2026-10-22 からマナ化では鳴らさない | `mana_gain.ogg` / `mana_gain.m4a` | `assets/audio/se/ivokard/bell.ogg`（本編の GOLD_GET） | Mix of SFX by Ivokard（CC0・クレジット不要） | 先頭1.0秒に切り、最後0.3秒をフェードアウト。M4A も作成 |
| `turnOrderSelect`：先攻・後攻のカードを選んだ瞬間 | `turn_order_select.ogg` / `turn_order_select.m4a` | `assets/audio/se/mystic_monsters_official/15_branch_select.ogg`（本編の BRANCH_SELECT） | ミストラルモンスターズ正式素材（ユーザー提供・ゲーム所有） | 同上 |

- 2026-10-22：以前の `damageHit`（本編の BATTLE_HIT）は、正式採用の命中音（下の表）と二重に鳴らないよう使うのをやめ、ファイルも削除した

## 正式採用の効果音（ユーザー承認 2026-10-22）

ユーザーが試聴して承認した4音。受け取った MP3（`Seimon_Claude_IntegrationBatch_SE_NPC_Town_Player_20261022.zip` の `ASSETS/SE_APPROVED/`）を
**加工せずそのまま**使う（ファイル名だけ英字に変更）。素材サイトの元のファイル（原本）とは照合していない＝**原本未検証**。
原本が手に入ったら、同じ音であることを聞き比べてから差し替える。元の PS 版の音は使っていない。

| 場面（SE_REGISTRY）・鳴らすとき | ファイル | 素材 | 利用条件 |
| --- | --- | --- | --- |
| `evade`：回避が成功してダメージ0が確定した瞬間（1回の攻撃で1回） | `evade_success.mp3`（受け取り名 03_回避成功.mp3） | 効果音ラボ「高速移動」 | 効果音ラボの利用規約に従う（商用可） |
| `hitNormal`：攻撃が命中した瞬間（通常） | `hit_normal.mp3`（04_通常攻撃命中.mp3） | OtoLogic「Hit-Punch02-1(Dry)」 | 無料で使うときはクレジット表記が必要 → 設定画面の「素材のクレジット」に表示 |
| `hitStrong`：強攻撃が命中した瞬間（**仮の基準：必要マナ3以上の技**。ユーザー指定） | `hit_strong.mp3`（05_強攻撃命中.mp3） | 効果音ラボ「大パンチ」 | 効果音ラボの利用規約に従う |
| `manaSpend`：マナを支払った瞬間（技・サポート・守備。1回の支払いで1回。マナ化では鳴らさない） | `mana_spend.mp3`（06_マナ消費_正式採用済み.mp3） | 効果音ラボ「ワープ」 | 効果音ラボの利用規約に従う |

- 参照：https://soundeffect-lab.info/ ・ https://otologic.jp/ （最新の規約に従う）
- 鳴らすきっかけはバトルのルール（`src/game/battle/engine.ts` の `fx`）で、結果が確定したときに1件ずつ記録する。画面は描き直しても同じ音を2回鳴らさない
- **使わない音（不採用・未承認）**：01 カード使用・02 防御・07 KO・08 回復（旧素材は NG、代わりの候補も未承認）。
  防御が成功してダメージ0のとき・KO のときは無音

## マナ化の音（09・2026-10-22 追加）

統合便のときは「未承認の候補」として送られておらず、ゲームに届いていなかった（ユーザーの指摘で判明）。
2026-10-22 にユーザーが `Seimon_ManaConvert_SE_EmergencyFix_Claude_20261022.zip` で送り、使うよう指示した。
**ChatGPT が作った独自の電子音の試作**で、原作 PS版の音のコピーではない。正式採用の4音（03〜06）とは別の経緯。

| 場面（SE_REGISTRY）・鳴らすとき | ファイル | 加工 |
| --- | --- | --- |
| `manaConvert`：手札のカードをマナにした瞬間（マナ化。1枚につき1回。カードが情報箱に着いてマナが1増えるのと同時。相手のマナ化も） | `mana_convert.ogg` / `mana_convert.m4a`（受け取ったまま。SHA-256 は ZIP の照合表と一致） | なし（音量は `SE_REGISTRY` で 0.7 倍） |

- 原本 `mana_convert_original_44100.wav`（44.1kHz・モノラル・約0.55秒）も `assets/audio/se/` に保管（ゲームでは読み込まない）。試聴用 MP3 は使っていない
- 鳴らすきっかけはルール（`engine.ts` の `fx`）の `manaConvert`。山札からマナが増えたときは `manaGain`（従来のベル）で、マナ化と二重には鳴らない

- 再生は Web Audio。OGG を再生できるブラウザは OGG、できないブラウザ（iPhone Safari の一部など）は M4A を使う（正式採用の4音は MP3 をどのブラウザでも使う）
- iPhone は最初のタップまで音を出せないため、最初のタップで音を使えるようにしてから読み込む

## BGM（2026-10-22 追加・ミスモンの曲）

ユーザー指示「BGM を使って。曲の規約は確認済み OK」（2026-10-22）。ミスモン（本編）で使っている曲から選んだ。本編のリポジトリは読み取りだけ。
`tools/audio/make_bgm_loops.py` が本編の OGG から「ループする範囲だけを切り出し、終わりを頭へつないだ」MP3（128kbps）を作る（範囲は本編の audio-registry.js と同じ）。
鳴らし方は `src/ui/bgm.ts`（`BGM_REGISTRY`）。ゲーム内のクレジット（設定 → 素材のクレジット）にも曲名・作者を出す。

| 場面（BGM_REGISTRY） | ファイル | 曲名 / 作者 | 出典 | 本編のファイル |
| --- | --- | --- | --- | --- |
| `title`：タイトル | bgm_title.mp3 | Bon Voyage! / HarumachiMusic | Pixabay | licensed_20261007/06_prologue_departure.ogg |
| `tournament`：大会の受付 | bgm_tournament.mp3 | Battle - スタンバイフェイズ / lei | DOVA-SYNDROME | licensed_20261007/08_tournament_table_start17s.ogg（17秒から） |
| `dungeon`：ダンジョンの探索 | bgm_dungeon.mp3 | Spirits Forest / HydroGene（CC0） | itch.io | hydrogene_16bit_rpg/07_spirits_forest_full.ogg（前奏を除いたループ部） |

- 本編の作品固有の曲（タイトル曲・本編の正式 BGM・作者不明の「公式ランク」）は使っていない
- 切れ目：MP3 は頭と終わりにごく短い無音が入るため、ループの継ぎ目でほんの一瞬切れることがある（気になれば形式を変える）
- 2026-10-26 まで使っていたミスモンの曲（街「冒険への誘い」のる・対戦「通常戦闘曲 - α」lei・大会の対戦「戦いの旅路を征く」MATSU・ボス「中ボスくらいの戦闘風」Motoyuki）は、
  下のユーフルカの曲に替えた（ゲームでは鳴らさない。ファイルは同じ名前で上書き）

## BGM（2026-10-26 差し替え・ユーフルカの4曲）

ユーザー指示「順番に野生モンスターバトルBGM、Boss戦BGM、公式ランク戦BGM、街のBGM。使用確認は取れていてOK」（2026-10-26）。
ユーザーが ZIP 4つ（Battle-HolyBeast_loop・Wanderers-City_loop・Battle-Conflict_loop・Boss-battle_loop）で届けた。
ZIP の並び順と「順番に」の並びが合わないため、**曲のファイル名で割り当てた**（Boss-battle＝ボス戦・Wanderers-City＝街）。
`tools/audio/make_bgm_loops_wingless.py` が ZIP の「ツクール用」OGG と .txt のループ位置（LOOPSTART・LOOPLENGTH）から、
前奏を外したループ部だけの MP3（128kbps）を作る。音量は測って、いままでの曲と同じくらい（約 -18.5 LUFS）になるよう `BGM_REGISTRY` の gain で合わせた。
元の ZIP はリポジトリに入れていない（素材の再配布にならないよう。作り直すときはユーザーから受け取った ZIP を展開して使う）。

| 場面（BGM_REGISTRY） | ファイル | 曲名 / 作者 | 出典 | 届いた ZIP |
| --- | --- | --- | --- | --- |
| `town`：街・部屋（ショップなどの画面も続けて） | bgm_town.mp3 | 放浪者の街 / ユーフルカ | Wingless Seraph（http://wingless-seraph.net/） | Wanderers-City_loop.zip |
| `battle`：ダンジョン・練習の対戦（野生モンスター） | bgm_battle.mp3 | 神獣の試練 / ユーフルカ | 同上 | Battle-HolyBeast_loop.zip |
| `bossBattle`：ダンジョンのボス | bgm_boss_battle.mp3 | 己と仲間を信じて / ユーフルカ | 同上 | Boss-battle_loop.zip |
| `tournamentBattle`：大会の対戦（公式ランク戦） | bgm_tournament_battle.mp3 | Conflict / ユーフルカ | 同上 | Battle-Conflict_loop.zip |

- 英語の曲名はローマ字の仮表記（Hourousha no Machi・Shinju no Shiren・Onore to Nakama wo Shinjite）

### 2026-10-26 追加の5曲（ダンジョン2つ・カードショップ・カード練習場・カード研究所）

ユーザー指示「ダンジョンのBGM送りました（遺跡と森）」「カードショップのBGM、教習所、研究所のBGM送ります」（2026-10-26。利用確認済み）。
届いたファイル名は文字化けしていたので、曲の中身と名前の文字数で割り当てた（教習所＝ゲームの「カード練習場」）。
ユーフルカの3曲は `make_bgm_loops_wingless.py`（.txt のループ位置）、BGMer の2曲は曲の終わりがフェードアウトするので
`tools/audio/find_loop.py` で同じ音がもう一度始まる所を探し、`tools/audio/make_bgm_loops_bgmer.py` でその間を切り出した。音量は gain で約 -18.5 LUFS に。

| 場面（BGM_REGISTRY） | ファイル | 曲名 / 作者 | 出典 | ループ |
| --- | --- | --- | --- | --- |
| `dungeonRuins`：遺跡のダンジョン（dungeon-01） | bgm_dungeon_ruins.mp3 | 月の廃墟 / ユーフルカ | Wingless Seraph | .txt の位置 |
| `dungeonForest`：森のダンジョン（dungeon-02） | bgm_dungeon_forest.mp3 | 古代エルフの聖域 / ユーフルカ | Wingless Seraph | .txt の位置 |
| `lab`：カード研究所（図鑑の画面も続けて） | bgm_lab.mp3 | 開かれし封印の扉 / ユーフルカ | Wingless Seraph | .txt の位置 |
| `shop`：カードショップ（ショップの画面も続けて） | bgm_shop.mp3 | セールストーク / BGMer | BGMer | 170.02〜266.02 秒（96 秒ごとに同じ曲がくり返す） |
| `practice`：カード練習場 | bgm_practice.mp3 | 無心になれる作業 / BGMer | BGMer | 27.89〜87.36 秒 |

- いままでのダンジョンの曲 `dungeon`（Spirits Forest / HydroGene）は、曲の決まっていないダンジョン用に残した（いまは鳴る場所なし）

## ミスモンの画像（2026-10-22 追加）

ユーザー指示「ダンジョンと景品のアイコン、ボタン、金貨を使って。残りは使わない」（2026-10-22）。本編の正式素材をそのまま（大きさの縮小だけ）。

| 使う所 | ファイル | 本編のファイル | 加工 |
| --- | --- | --- | --- |
| ダンジョンの対戦の背景（B1F 草原・B2F 海岸・B3F 火山。仮の割り当て） | `assets/images/backgrounds/battle_field_{meadow,coast,volcano}.webp` | battle/field_1012/ch1_meadow・ch2_coast・ch4_volcano.webp | なし |
| ダンジョンの宝箱（木・鉄・金）と開く動き | `assets/images/maps/dungeon/chest_0{1,2,3}_{base,anim_01〜04}.webp` | chests/chest_0{1,2,3}_*.webp | 高さ 160px に縮小 |
| 大会の景品のアイコン（初回優勝＝勲章・再優勝＝小袋） | `assets/images/icons/prize_{medal,pouch}.webp` | items/body_1012/27・15.webp | 128px に縮小 |
| 金貨（所持金・参加報酬） | `assets/images/icons/coin.png` | ui/gold/coin.png | なし |
| ボタン（行う＝青・やめる＝赤） | `assets/images/ui/button/mm_btn_blue_ornate.png`・`mm_btn_red.webp` | ui/a_group/a19・a04 | **2026-10-23 から使っていない**（ユーザー指示でふつうのボタンに戻した。ファイルだけ残している） |

## 本編の画像素材（会話の UI）

2026-10-22：ユーザー指示「セリフの UI はミスモンのものを使う。NPC の名前の UI も同様」により、ミストラルモンスターズの会話 UI の画像を利用。
本編リポジトリは読み取りのみで、変更していない。画像だけを使い、本編のソースコードは流用していない（表示の CSS はこのリポジトリで書いたもの）。

| 使う場所 | ファイル | 元の素材（ミストラルモンスターズ） | 加工 |
| --- | --- | --- | --- |
| 会話のセリフ枠（四隅の飾りは縮尺のまま、中央だけ伸ばす） | `assets/images/ui/talk/dialogue_window_blank.png` | `assets/ui/recovery_1006/talk/dialogue_window_blank.png`（780×242） | なし（そのままコピー） |
| 話している人の名前の札 | `assets/images/ui/talk/name_label_blank.png` | `assets/ui/recovery_1006/talk/name_label_blank.png`（360×79） | なし |
| 会話の選択肢のボタン | `assets/images/ui/talk/button_blank.png` | `assets/ui/recovery_1006/talk/button_blank.png`（420×113） | なし |

元のコミット：`bc3160cf391616000883f2d3089588df835b9ae4`（本編の最新、2026-10-21）。

## ユーザー提供の効果音（2026-10-23）

ユーザーが ZIP「Downloads」（75音）で送り、「必要であれば使用してください」と指示。ファイル名（「構えを取る」「パンチを受け止める」など）から
**効果音ラボの素材とみられる**（クレジットは設定画面の「効果音ラボ」の表記に含まれる）。
2026-10-23 ユーザーから「SEは全て利用して良い確認が出来ているため、全て使用してOK」と連絡あり＝**利用の確認済み**（ユーザー確認）。
使ったのは次の16音（最初の7音＋追加の9音）。長い音は先頭だけを使い、最後 0.25 秒をフェードアウトした（音色は変えていない）。残りの59音はまだ使っていない（技のアニメーションを使わない方針のため、技ごとの音は付けていない）。

| 場面（SE_REGISTRY）・鳴らすとき | ファイル | 元のファイル名 | 加工 |
| --- | --- | --- | --- |
| `cardAttack`：攻撃の技のカードを使って、真ん中に大きく見せたとき | `card_attack.mp3` | 構えを取る.mp3 | なし（MP3 128k に変換） |
| `cardGuard`：防御のカードを使ったとき | `card_guard.mp3` | パンチを受け止める.mp3 | なし |
| `cardEvade`：回避のカードを使ったとき（回避の成功の音は今までどおり `evade`） | `card_evade.mp3` | 踏み込む.mp3 | 0.6 秒に |
| `cardSpecial`：特殊の技（吠える）のカードを使ったとき | `card_special.mp3` | 重力魔法1.mp3 | 1.1 秒に |
| `cardSupport`：サポートのカードを使ったとき | `card_support.mp3` | 魔法陣を展開.mp3 | 1.2 秒に |
| `knockout`：モンスターのライフが0になった瞬間（命中の音のすぐあと） | `knockout.mp3` | 倒れる.mp3 | なし |
| `heal`：モンスターのライフが回復した瞬間 | `heal.mp3` | 回復魔法1.mp3 | 1.3 秒に |
| `cardWisdom`：かしこさの攻撃の技を使ったとき（ちからの技は今までどおり `cardAttack`） | `card_wisdom.mp3` | 気弾1.mp3 | 1.0 秒に |
| `cardSeal`：すなかけ（相手の攻撃を封じる技）を使ったとき | `card_seal.mp3` | 風魔法1.mp3 | なし |
| `recoil`：すてみタックルの反動で自分がダメージを受けた瞬間 | `recoil.mp3` | 打撃2.mp3 | 0.6 秒に |
| `battleStart`：バトル画面が始まったとき | `battle_start.mp3` | パワーチャージ.mp3 | なし |
| `battleWin`：バトルに勝ったとき（1回だけ） | `battle_win.mp3` | 聖魔法.mp3 | 2.0 秒に |
| `battleLose`：バトルに負けたとき（1回だけ） | `battle_lose.mp3` | 暗黒魔法.mp3 | 2.0 秒に |
| `packOpen`：ショップでパック・ガチャを開けたとき | `pack_open.mp3` | ステータス上昇魔法2.mp3 | 1.5 秒に |
| `reward`：宝箱・大会の賞品・修復の成功など、ごほうびを受け取ったとき | `reward.mp3` | ステータス上昇魔法1.mp3 | 1.5 秒に |
| `fragment`：ダンジョンで欠片を拾ったとき | `fragment.mp3` | ステータス治療1.mp3 | 1.5 秒に |

- 上の「使わない音（不採用・未承認）」のうち、防御・KO・回復は、この新しい素材で鳴らすようになった（2026-10-23。ユーザーの「必要であれば使用して」による）
- ボタンを押したときの小さな音（`sound.tap()`）は素材ファイルではなく、ゲームの中でその場で作っている

## ユーザー提供の効果音 第2弾（2026-10-23）

ユーザーが ZIP「Downloads 2」（31音）で送り、「全部確認 OK で使える。使えるところに使って」と指示（利用の確認済み）。
足音・環境音の作り方は `tools/audio/world_se_build.py`（受け取ったファイルから作り直せる）。

| 場面（SE_REGISTRY ほか）・鳴らすとき | ファイル | 元のファイル名 | 加工 |
| --- | --- | --- | --- |
| `doorOpen`：街から建物に入るとき | `door_open.mp3` | ドアを開ける2.mp3 | なし |
| `doorClose`：建物から街に出るとき | `door_close.mp3` | ドアを閉める2.mp3 | なし |
| `gateOpen`：ダンジョンを選んで入るとき | `gate_open.mp3` | 門を開ける.mp3 | なし |
| `gateClose`：ダンジョンから街へ帰るとき | `gate_close.mp3` | 牢屋の扉を閉める.mp3 | なし |
| `stairs`：ダンジョンの階段で上の階・下の階へ移るとき | `stairs.mp3` | 家の階段を駆け上る.mp3 | 1.4 秒に（最後 0.25 秒フェードアウト） |
| `chestUnlock` → `chestOpenWood`／`chestOpenIron`：宝箱を開けるとき（鍵 → ふた。木の箱はきしむ音、鉄・金の箱は重い扉の音） | `chest_unlock.mp3`・`chest_open_wood.mp3`・`chest_open_iron.mp3` | 鍵を開ける1.mp3・dooropen6.mp3・鉄の扉を開ける.mp3 | なし |
| `register`：ショップでパックを買ったとき（このあとパックを開ける音） | `register.mp3` | レジスターで精算.mp3 | なし |
| `coins`：お金をもらったとき（宝箱にお金が入っていた・大会の賞金） | `coins.mp3` | 財布をジャラッ.mp3 | なし |
| `ironDoorOpen`：大会会場に入るとき・出るとき（2026-10-26。会場の扉を鉄にしたため。出るときも同じ音＝ユーザー指示） | `chest_open_iron.mp3`（宝箱と同じファイル） | 鉄の扉を開ける.mp3（2026-10-26 にユーザーが同じ音を再送・利用確認済み） | なし |
| `autoDoor`：カードショップに入る・出るとき（2026-10-26） | `auto_door.mp3` | 2026-10-26 ユーザー提供の自動ドアの音（利用確認済み。チャットで届き、元の名前は読めなかった。はじめは鉄の扉を閉める音と取り違えて大会会場から出るときに使っていた） | なし（録音が小さいので、鳴らす大きさ gain を 4.0 に） |
| `drip`：洞窟のダンジョンの環境音。入ってすぐ1滴、そのあと 2〜6秒おきに大きさを少し変えて | `drip.mp3` | 水滴3.mp3 | なし |
| 足音（`sound.step`）：人物の足が地面に着くコマで1歩ずつ。4個から毎回ちがう音を選ぶ | `steps/<地面>_1〜4.mp3` | 下の表 | 1歩ぶん（0.22 秒）を切り出し、大きさをそろえた |
| 水中の環境音（`sound.ambient('underwater')`）：水のダンジョン用に用意。**いまは使う場所なし** | `underwater_loop.mp3` | 水中.mp3 | 終わりを頭につないで切れ目なく繰り返せるように |

足音の地面：

| 地面 | 元のファイル名 | 使う場所 |
| --- | --- | --- |
| stone（石） | アスファルトの上を走る2.mp3 | 街の石畳・大会会場 |
| dirt（土） | 土の上を走る.mp3 | 街の南の出口へ続く土の道 |
| wood（板） | 体育館で走る.mp3 | 建物の中（大会会場以外） |
| gravel（砂利） | 砂利の上を走る.mp3 | 第1ダンジョン（洞窟） |
| grass・sand・snow・wet（芝生・砂・雪・濡れた床） | 芝生の上を走る・砂の上を走る・雪の上を走る2・プールサイドを走る | **いまは使う場所なし**（これからのダンジョン用。`worldScreen.ts` の `DUNGEON_SOUND` に1行足すと使える） |

使っていない音（合う場面がまだない）：アスファルトの上を走る1・スリッパで走る・下駄で走る・畳の上を走る・大勢の人が走る・バタ足で泳ぐ・
自動ドアが開く・ドアノブをひねる1・鉄のドアをノック1・お金を落とす2・落ち葉の上を走る（足音が連続していて1歩ぶんを切り出せなかった）

## 2026-10-24 のバトルの音の変更（ユーザーの試遊結果から）

ユーザー指示：①ダメージを与えたときの音を変える ②マナにしたときはカードが1枚ずつ消える演出と音（マナの欄へ行くときの音は不要）
③ライフが1減るごとに「カタカタ」のような音（「−2」の表示は削除）⑤手札に配るときはカード・トランプの音。
素材は **効果音ラボ**（https://soundeffect-lab.info/ 。これまでも使っている・商用可・クレジット任意。設定画面の「効果音ラボ」の表記に含まれる）から Claude が選んで取得した。
長い音は先頭や1粒だけを切り出し、終わりを短くフェードアウトした（音色は変えていない）。**ユーザーの試聴はまだ**（気に入らなければ差し替える）。

| 場面（SE_REGISTRY）・鳴らすとき | ファイル | 元の素材（効果音ラボ） | 加工 |
| --- | --- | --- | --- |
| `cardDraw`：カードを引く・手札に配る（1枚ごと） | `card_deal.mp3` | 「カードを配る」（card-hand-out1.mp3） | 1枚ぶん（1.60〜1.89秒）を切り出し |
| `manaVanish`：マナ化でカードが光って消える瞬間（1枚1回。相手のマナ化も） | `mana_vanish.mp3` | 「シャキーン1」（shakin1.mp3）。最初は「パッ」だったが、ユーザー「イメージと違う。PS版みたいな音に」で候補6つ（キラッ1・シャキーン1・きらーん2・チリン・ゲージ回復1・データ表示1）を試聴に出し、ユーザーが2番（シャキーン1）を選んだ（2026-10-24） | 0.8 秒に（最後 0.2 秒フェードアウト） |
| `lifeTick`：ダメージでライフが1減るごとに1回 | `life_tick.mp3` | 「カタカタ震える」（shivering1.mp3） | 1粒（0.105 秒から 0.055 秒）を切り出し |
| `hitNormal`：攻撃が命中した（通常） | `hit_blow.mp3` | 「打撃2」（blow2.mp3） | 0.6 秒に |
| `hitStrong`：攻撃が命中した（強攻撃。仮に必要マナ3以上） | `hit_super.mp3` | 「必殺技ヒット」（super-arts-hit1.mp3） | なし |

- 使わなくなった音（ファイルは残している）：`card_draw.ogg/m4a`（Interface SFX Pack 1）、`mana_convert.ogg/m4a`（マナ化の電子音）、`hit_normal.mp3`（OtoLogic）、`hit_strong.mp3`（効果音ラボ「大パンチ」）。
  OtoLogic の音はゲームで鳴らさなくなったが、設定画面のクレジット表記は残している（戻す可能性があるため）

## 2026-10-26 カードの動きの音（Kenney「Casino Audio」・CC0）

ユーザー指示「手札配られた時に、最初裏返しで、その後パラパラーっと表向きに」「相手がカード使用した時に…裏返しから表向きに」「SEも適切なもの探してみてください」（2026-10-26）。
効果音ラボ・OtoLogic はこの作業環境からダウンロードを断られた（403）ため、**Kenney「Casino Audio」1.1**（https://kenney.nl/assets/casino-audio 。
CC0＝誰でも自由に使える・クレジット不要）から選んだ。**ユーザーの試聴はまだ**（気に入らなければ差し替える）。
加工：頭の無音を切って短くし、最後 0.05 秒をフェードアウト、最大の大きさを −12dB にそろえて MP3（128k）に。

| 場面（SE_REGISTRY）・鳴らすとき | ファイル | 元の素材 | 切り出し |
| --- | --- | --- | --- |
| `cardFlip`：配った手札が1枚ずつ表に返るとき（パラパラ） | `card_flip.mp3` | card-place-1.ogg | 0.12〜0.40 秒 |
| `cardSlide`：相手の使ったカードが裏向きのまま真ん中へ飛んでくるとき | `card_slide.mp3` | card-shove-3.ogg | 0.08〜0.53 秒 |
| `cardReveal`：真ん中に来た相手のカードが表に返るとき（カードの種類の音もいっしょに鳴る） | `card_reveal.mp3` | card-slide-3.ogg | 0.03〜0.33 秒 |

## 2026-10-26 カードを配る音の差し替え（ユーザー提供「Motion-Swish07」）

ユーザー指示「カード配られる音これ使ってみてください。許可確認OKです」（2026-10-26。ZIP の中は `Motion-Swish07/Motion-Swish07-1〜7.mp3`。名前から OtoLogic の素材とみられる。
OtoLogic は設定画面のクレジットに前から表記している）。
`assets/audio/se/card_deal/swish_1〜7.mp3`：頭の無音を切り、0.05〜0.47 秒を使って最後 0.08 秒をフェードアウト（音色・大きさは変えていない。鳴らす大きさは `DEAL_GAIN` 0.45）。
自分・相手がカードを引く・配るたびに、7種類から前と違うものを選んで鳴らす（`sound.deal()`）。`cardDraw`（設定画面の試し鳴らし）も swish_1 に。
前の `card_deal.mp3`（効果音ラボ「カードを配る」）は使わなくなった（ファイルは残している）。
- 2026-10-26（同じ日の2回目）：ユーザー指示「カードの音はこれ1つで1枚に1度鳴らすように」で、届いた `Motion-Swish07-5.mp3` だけにした
  （`assets/audio/se/card_deal/swish.mp3`。切り出しは同じ。7種類から選ぶのはやめた）
