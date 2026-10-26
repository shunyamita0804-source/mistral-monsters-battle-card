【追加内容｜ラズック 完成版】

この完成版では、先行ZIPに不足していた「ラズックのバトル時モンスターカード用素材」を追加しています。

■ 追加したもの
01_Razuk_Battle_Original_RGBA.png
  ・ラズックの2Dバトル用原画（背景透過PNG）

02_Razuk_Battle_800x920_RGBA.png
  ・バトル時カードテンプレートに当て込みやすいよう、800×920へ収めた透過PNG

03_Battle_Common_Background_800x920.png
  ・全モンスター共通で使う、控えめな統一背景

04_BattleCard_Frame_800x920_Transparent.png
  ・承認済みバトルカード枠（透明PNG）

05_MonsterColor_AccentMask_800x920.png
  ・モンスター別アクセント色を変更するためのマスク

06_Razuk_PurpleAccent_800x920.png
  ・ラズック用の紫色アクセントの確認用PNG

07_Razuk_BattleCard_Preview_Purple.png
  ・背景＋ラズック＋紫色アクセント＋枠を重ねた確認用プレビュー

■ Claudeへの実装指示（要点）
・ラズックのモンスターカード枠色、技カード枠色は紫色。
・バトル時カードは、03背景 → 02ラズック本体 → 紫アクセント色 → 04枠 の順で使用。
・旧05「しっぽアタック」は削除済み。新しい正式14技のみ使用。
・技番号順は 01〜07攻撃、08〜10特殊、11〜12防御、13〜14回避。
・初期配布16枚は 04_INITIAL_DISTRIBUTION_UTF8.csv に従う。

■ 備考
このZIPは「ラズックの技カード実装素材」＋「バトル時モンスターカード素材」をまとめた完成版です。
