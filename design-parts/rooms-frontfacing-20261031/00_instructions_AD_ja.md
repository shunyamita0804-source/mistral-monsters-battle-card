指示書 AD：研究所・花屋・仕立て屋の部屋を正面向きに・家3つの床と壁（2026-10-31 進行チャット）

AC のあとに作業してください（AC が終わっていなければ AC を先に）。返事・報告は日本語。
新しいブランチで作業し、npm run check を通してから main に取り込んでください。最後に作業報告書の ZIP（報告書.html・写真・資料）をお願いします。公開はユーザーの「公開して」を待ってください。

■ ZIP：Mistral_CC_AD_Rooms_20261031.zip（絵はすべてユーザー合格。原本は無改変で保管）
- 研究所：lab_shell.png・lab_01_glass_cabinet.png・lab_02_desk.png・lab_03_machine.png・lab_04_lab_counter.png・lab_05_diagram_board.png・lab_preview.png（確認用）
- 花屋：florist_shell.png・florist_01_counter.png・florist_02_flower_steps_left.png・florist_03_flower_steps_right.png・florist_04_plant_stand.png・florist_05_floor_plant_left.png・florist_06_floor_plant_right.png・florist_preview.png（確認用）
- 仕立て屋：tailor_shell.png・tailor_01_counter.png・tailor_02_torso_left.png・tailor_03_cloth_table.png・tailor_04_fitting_room.png・tailor_05_torso_right.png・tailor_06_mirror.png・tailor_07_left_cabinet.png・tailor_08_rear_cabinet.png・tailor_09_floor_plant_right.png・tailor_10_plant_stand.png・tailor_preview.png（確認用）
- 家3つの床と壁：player_shell.png（864×864・主人公の家）・guide_shell.png（864×864・となりの家）・house_shell.png（720×720・住人の家）
- 部屋の絵は 1536×1024。shell は不透明、家具は 1536×1024 の透明な画像に置く位置で描いたもの（X の管理局・練習場・大会会場と同じ形。preview は shell の上に家具を番号順に重ねたもの）

━━━━━━━━━━━━━━━━━━━━
【1】研究所・花屋・仕立て屋（X と同じやり方で）
━━━━━━━━━━━━━━━━━━━━
- 原本は design-parts/rooms-frontfacing-20261031/{lab,florist,tailor}/ に。前の部品（rooms-20261028/Mistral_Room_lab_parts・rooms-20261029/Mistral_Room_florist_parts・Mistral_Room_tailor_parts）は消さずに残す
- 組み立ては rooms4_build.py の v2（X の front_cut のやり方）に3部屋を足す。手前の低い壁・入口の柱・柱の上の植木は shell から切り抜いて「いつも人より手前」の層に。入口の位置と幅は前の絵とほぼ同じ
- 左右の壁がまっすぐになり、家具の場所が変わったので、床の当たり（歩ける所）・家具の当たり・人の立つ所・調べる所・重なりの順（人が家具の前と後ろに回るとき）を、新しい絵に合わせて作り直す
- 人と調べる所（名前・できることは今のまま）：
  - 研究所：ルーカスは真ん中の机の奥。記録の投影機（奥の右の金の機械）・解析台（右の手前寄りの実験台）・図形の板（右の壁ぞいに立つ板。前は右の壁に貼った板）・ガラスの棚（左の壁ぞい）。奥の壁の本棚と植木は shell に描いてある
  - 花屋：マーサは真ん中の作業台の奥。左右の花のひな壇・花台・床の鉢植え
  - 仕立て屋：ロザリーは真ん中の作業台の奥。トルソー2つ・布の陳列台（左の手前）・試着の囲い（右奥）・姿見（右）・左の棚2つ
- 主人公の大きさは今の部屋と同じ（家具の大きさは前の絵とほぼ同じに描いてもらった）。入口から作業台（机）の前まで、ふつうに歩いて行けること。家具の後ろの細いすき間に入りこんで出られなくならないこと
- 研究所の床の真ん中に、管理局と同じカードの紋がうっすら入っている（机の下でほとんど隠れる）。直さなくてよい。机をずらして紋が目立つ場合だけ報告

━━━━━━━━━━━━━━━━━━━━
【2】家3つの床と壁（主人公の家・となりの家・住人の家）
━━━━━━━━━━━━━━━━━━━━
- 床と壁だけの差し替え（左右のななめの壁を、まっすぐ縦の細い壁にした）。家具は今のまま。進行が今の家具をゲームと同じ位置に重ねて、ずれないことを確かめた（大きさ・奥の壁の高さ・窓・入口は前と同じ）
- 原本は design-parts/ の今の家の部品の横に _frontwall_20261031 を付けて保管（前の版は残す）
- 左右の壁が細くなって床が少し広く見えるので、歩ける所を左右のはしまで広げるかは、絵の壁のふちに合わせて決める（壁の中に入らないこと）。住人の家（民家 A〜E）は同じ絵を使っているなら全部で変わること

━━━━━━━━━━━━━━━━━━━━
■ 報告に入れてほしいもの
━━━━━━━━━━━━━━━━━━━━
- 部屋ごとに前と今を並べた写真：入った所・部屋の真ん中・店の人と話す所・調べる所1つずつ・家具の後ろを回る所（重なり）・当たりの網目
- 家3つ：前と今（入った所・左右のはしまで歩いた所）
- 小さい画面（375×667）で1部屋
- npm run check（テストの数）・docs/handoff.md の更新
