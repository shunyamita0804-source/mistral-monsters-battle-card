# 依頼文：プカリムのガチャのパック（pack_pukarim）

## 何を描くか
カードショップのガチャに並ぶ「プカリムのパック」1枚。いまある6つのパック（ソラモ・ガウル・ラズック・ノビトン・ミュロル・カルシェル）と同じシリーズの絵。
いまは絵が無いので、模様だけの「封をしたパック」で出している（写真 `00_pack_pukarim_now.png` のいちばん下）。

## 大きさ・形式
- 600×1080 px、PNG、背景は透明（パックの外は透明）
- 既存の `pack_kalshell` と同じ形・同じ位置（見本 `00_pack_pukarim_reference_kalshell.webp`）：
  上の封（紺の光沢・金のふち）、真ん中の金の額（青い宝石つき）、額の中にモンスター、下の封
- ※ 2026-10-29 にゲームでは上の封の青い所（y 110〜240）を切りとって短くしている（`tools/design/gacha_series_build.py`）。同じ 600×1080 で描いてもらえば、同じように切ってそろえる

## 色・中身
- パックの地の色：プカリムのミント #A8DCC4（カルシェルの淡い氷色の所をミントに）
- 額の中：プカリム（正式モンスターカード `design-parts/cards-original/pukarim/final-20261028/art/monster_card/` と同じ見た目）。
  空と草原の背景。カルシェルのパックのように、ハサミ・しっぽが額から少しはみ出してよい
- 塗り・明るさ・光沢は既存の6つのパックと同じ

## ゲームに置く所
`assets/images/ui/gacha/pack_pukarim.webp`（`tools/design/gacha_series_build.py` の PACKS に 'pukarim' を足して変換するだけ）
