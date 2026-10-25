# -*- coding: utf-8 -*-
"""主人公の「立ち・歩き・走り」を同じ大きさ・同じ色で描き直してもらう依頼一式を作る（2026-10-25）

ユーザー「立ち絵と四方向の歩き、走りの全てが統一でなければいけません。若干サイズが変わったり、走りの際は背が低くなります」。
いまの絵は、立ち姿・歩き・走り・横の立ち姿が別々の日に別々の絵として描かれていて、体の割合・頭の大きさ・色が少しずつ違う。
走りは前傾してかがんだ形に描かれているので、同じ大きさでも頭の位置が 15〜25% 低い。縮小・色合わせでは同じにできない。

今回の枠（2_frame_*.png・1536×1024）：5列×2段。各段の左端（見本のマス）に「この大きさで描く」立ち姿を貼ってある。
画像AIは同じ絵の中にある見本には大きさ・色を合わせやすい（別の絵を参考にするより確実）。
走りは「かがまない・前傾は 5 度まで・頭のてっぺんは水色の線から下げない」と頼む。

使い方:
  python3 tools/design/walk_unified_pack.py
出力: docs/design/walk-unified-20261025/（README・male/・female/）
"""
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/design/walk-unified-20261025'
PREV = ROOT / 'docs/design/walk-run-v3-20261024'
FONT = '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf'
W, H = 1536, 1024
COLS, ROWS = 5, 2
CW, RH = W // COLS, H // ROWS  # 307×512
TOP, FOOT = 44, 486  # 頭のてっぺん・足元の線（段の中の y）
FIG_H = FOOT - TOP  # 人物の高さ 442px

STANDS = {
    'male': ROOT / 'design-parts/characters-adult/player_male_stand_v2.png',
    'female': ROOT / 'design-parts/characters-adult/player_female_stand_v2.png',
}
OLD_STANDS = {
    ('male', 'left'): ROOT / 'docs/design/walk-run-v3-20261024/left/1_ref_male_left.png',
    ('male', 'back'): ROOT / 'docs/design/walk-run-v3-20261024/back/1_ref_male_back.png',
    ('female', 'left'): ROOT / 'docs/design/walk-run-v3-20261024/female/1_ref_female_left.png',
    ('female', 'back'): ROOT / 'docs/design/walk-run-v3-20261024/female/1_ref_female_back.png',
}
DIR_JA = {'front': '正面（こちらを向く）', 'left': '左向き', 'back': '背中（画面の奥を向く）'}


def cut_out(im: Image.Image) -> Image.Image:
    """白い背景の立ち絵を透明に（透明な絵はそのまま）"""
    from scipy import ndimage

    arr = np.array(im.convert('RGBA'))
    if (arr[..., 3] < 250).mean() > 0.2:
        return Image.fromarray(arr)
    white = arr[..., :3].min(axis=-1) > 232
    lab, _ = ndimage.label(white)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = ndimage.binary_dilation(np.isin(lab, list(edge)), iterations=1)
    arr[..., 3] = np.where(bg, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def fit_stand(im: Image.Image) -> Image.Image:
    """立ち絵を人物の高さ FIG_H にして、足元を FOOT、横の真ん中を列の真ん中に置いた 1マス（CW×RH）の絵"""
    a = np.array(im)[..., 3] > 128
    ys = np.nonzero(a.any(axis=1))[0]
    xs = np.nonzero(a.any(axis=0))[0]
    crop = im.crop((int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1))
    k = FIG_H / crop.height
    small = crop.convert('RGBa').resize((round(crop.width * k), FIG_H), Image.LANCZOS).convert('RGBA')
    cell = Image.new('RGBA', (CW, RH), (0, 0, 0, 0))
    cell.alpha_composite(small, ((CW - small.width) // 2, TOP))
    return cell


def frame(stand: Image.Image | None, label0: str) -> Image.Image:
    """枠：5列×2段。左端の列は見本（stand を貼る。無ければ「ここに立ち姿を描く」）。1〜4・5〜8 の番号、頭の上・足元の線、体の真ん中の点線"""
    img = Image.new('RGBA', (W, H), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, 26)
    small = ImageFont.truetype(FONT, 18)
    for r in range(ROWS):
        y0 = r * RH
        for c in range(COLS):
            x0 = c * CW
            d.rectangle([x0, y0, x0 + CW - 1, y0 + RH - 1], outline=(120, 120, 120, 255), width=2)
            # 頭の上（水色）・足元（緑）の線。見本の列もふくめて全部のマスに
            d.line([(x0 + 10, y0 + TOP), (x0 + CW - 10, y0 + TOP)], fill=(0, 170, 220, 255), width=3)
            d.line([(x0 + 10, y0 + FOOT), (x0 + CW - 10, y0 + FOOT)], fill=(40, 170, 60, 255), width=3)
            for yy in range(y0 + TOP, y0 + FOOT, 14):
                d.line([(x0 + CW // 2, yy), (x0 + CW // 2, yy + 7)], fill=(200, 200, 200, 255), width=1)
            if c == 0:
                d.rectangle([x0, y0, x0 + CW - 1, y0 + RH - 1], outline=(220, 140, 0, 255), width=5)
                d.text((x0 + 8, y0 + 6), '見本', fill=(220, 140, 0, 255), font=font)
                if stand is not None:
                    img.alpha_composite(stand, (x0, y0))
                else:
                    d.text((x0 + 10, y0 + RH // 2 - 30), label0, fill=(220, 140, 0, 255), font=small)
            else:
                n = r * 4 + c
                d.text((x0 + 8, y0 + 6), str(n), fill=(40, 40, 40, 255), font=font)
        d.text((W - 150, y0 + 8), '頭の上', fill=(0, 170, 220, 255), font=small)
        d.text((W - 150, y0 + FOOT + 4), '足元', fill=(40, 170, 60, 255), font=small)
    return img.convert('RGB')


def ref_image(stand: Image.Image, old: Path | None) -> Image.Image:
    """参考画像：左＝新しい立ち絵（正面）、右＝その向きのいまの絵（あれば。人物の見た目の参考。大きさの参考ではない）"""
    s = cut_out(stand)
    a = np.array(s)[..., 3] > 128
    ys = np.nonzero(a.any(axis=1))[0]
    xs = np.nonzero(a.any(axis=0))[0]
    s = s.crop((int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1))
    k = 900 / s.height
    s = s.convert('RGBa').resize((round(s.width * k), 900), Image.LANCZOS).convert('RGBA')
    panels = [s]
    if old is not None:
        o = Image.open(old).convert('RGBA')
        k2 = 900 / o.height
        panels.append(o.resize((round(o.width * k2), 900), Image.LANCZOS))
    width = sum(p.width for p in panels) + 40 * (len(panels) + 1)
    img = Image.new('RGBA', (width, 1030), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, 24)
    x = 40
    for i, p in enumerate(panels):
        img.alpha_composite(p, (x, 100))
        d.text((x, 20), '正式の立ち姿\n（この大きさ・この色）' if i == 0 else '参考：この向きのいまの絵\n（大きさ・色は左に合わせる）', fill=(0, 0, 0, 255), font=font)
        x += p.width + 40
    return img.convert('RGB')


COMMON_RULES = """【大きさと色の決まり（今回いちばん大事。これが守れていない絵は使えません）】
・2枚目の枠の左端「見本」のマスに、この主人公の立ち姿が貼ってあります。描く8人は、見本と「同じ人物・同じ大きさ・同じ色」です
・頭のてっぺんは水色の線、地面に着いている足の裏は緑の線。8人全員。見本と比べて 3% より大きい・小さいは禁止
・帽子の横幅・顔の大きさ・体の幅は見本と同じ。足を広げても、腕を振っても、頭と体の大きさは変わりません
・色は見本とまったく同じ（鮮やかにしない・明るくしない・暗くしない。肌・髪・帽子・服・ブーツの色をそのまま）
・見本のマスは描き直さない（そのまま残す）。描くのは番号のマス 1〜8 だけ
"""

RUN_UPRIGHT = """【走りの姿勢（今回の変更）】
・かがまない。体の前傾は 5 度まで（ほぼ立ったまま、足と腕だけ大きく動く「ゲームの走り」）
・頭のてっぺんは水色の線のまま。沈むコマ（2・6）でも水色の線から 3% より下げない
・歩幅は歩きより大きく、腕はひじを曲げて大きく振る。両足が浮くコマ（4・8）あり
"""


def prompt_walk(gender: str, direction: str) -> str:
    who = {'front': 'こちらへ向かって歩く（正面）', 'left': '左へ歩く', 'back': '画面の奥へ歩く（背中を見せて歩く）'}[direction]
    draw_stand = '' if direction == 'front' else f"""【見本のマス（左端）も描く】
・この向き（{DIR_JA[direction]}）の立ち姿がまだ無いので、左端の「見本」のマスに、この向きの立ち姿（足をそろえて立つ・腕は体の横）を描いてください。
  大きさ・色は1枚目の左の正式の立ち姿（正面）とまったく同じ（頭のてっぺん＝水色の線、足の裏＝緑の線）。上の段と下の段の見本は同じ絵
・1枚目の右の絵は、この向きの服・かばん・髪の見え方の参考（大きさと色は左の正式の立ち姿に合わせる）
"""
    guide = {
        'front': '動きの見本（横から見た棒の人形。正面から見たときの奥行きは、前の足＝少し下・大きめ、後ろの足＝少し上・小さめ）。赤＝人物の右足・右腕（正面から見ると画面の左側）、青＝人物の左足・左腕（画面の右側）',
        'left': '動きの見本（棒の人形）。赤＝人物の右足・右腕＝奥（体の向こう側）、青＝人物の左足・左腕＝手前（体のこちら側）',
        'back': '動きの見本（横から見た棒の人形。背中から見たときの奥行きは、前の足＝少し上・小さめ、後ろの足＝少し下・靴の裏が見える）。赤＝人物の右足・右腕（背中から見ると画面の右側）、青＝人物の左足・左腕（画面の左側）',
    }[direction]
    poses = PREV_WALK_POSES[direction]
    return f"""添付の3枚を使って、ゲームの主人公が「{who}」アニメーション1周分（8ポーズ）を、1枚の絵に描いてください。

【添付】
・1枚目（1_ref）：この主人公の正式の立ち姿。この人物とまったく同じ人物・同じ絵柄・同じ大きさ・同じ色で描く
・2枚目（2_frame）：描く枠。横長 1536×1024。5列×2段。左端の列は「見本」。上の段に1〜4、下の段に5〜8。各ポーズを1マスに1人
・3枚目（3_guide）：{guide}。マスの番号と同じ番号のポーズを描く

{COMMON_RULES}{draw_stand}
【いちばん大事な動き】
上の段と下の段は「同じ絵」ではありません。前に出る足と腕が入れ替わります。1と5を並べると前に出ている足・腕が逆、3と7も立っている足と持ち上げている足が逆。
絵を左右反転しない（8人とも同じ向き。かばん・服の模様の位置はそのまま）。

{poses}
【人がしっかり歩いて見えるように】
・体の高さの上下は小さく（2・6が少し低く、4・8が少し高い。差は背たけの 2% まで。頭のてっぺんが水色の線から大きく離れない）
・腕は足と反対に振る。ひじは軽く曲げる
・上着のすそ・髪・かばんは、体の動きから少し遅れてついてくる

【守ること】
・1枚目とまったく同じ人物・絵柄。顔・髪・帽子・服の模様・ベルト・かばん・ブーツ・手袋・色・線の太さ・塗り方を変えない
・地面に着いている足を緑の線に置く。マスからはみ出さない・重ねない
・筆で塗り重ねた手描きの質感（フラットな絵・3DCG風にしない）
・文字・数字・枠の線・影・地面・背景は描かない（枠の線や見本の人物は、できた絵には入れない。入ってしまっても Claude が消せます）
・背景は透明（できなければマゼンタ一色 #FF00FF）。横長 1536×1024 の PNG
"""


def prompt_run(gender: str, direction: str) -> str:
    who = {'front': 'こちらへ向かって走る（正面）', 'left': '左へ走る', 'back': '画面の奥へ走る（背中を見せて走る）'}[direction]
    poses = PREV_RUN_POSES[direction]
    return f"""添付の3枚を使って、ゲームの主人公が「{who}」アニメーション1周分（8ポーズ）を、1枚の絵に描いてください。
歩きではなく「走り」です。ただし、かがんだ走りではなく、背すじを伸ばしたまま足と腕を大きく動かす「ゲームの走り」です。

【添付】
・1枚目（1_ref）：この主人公の正式の立ち姿（この向き）。この人物とまったく同じ人物・同じ絵柄・同じ大きさ・同じ色で描く
・2枚目（2_frame）：描く枠。横長 1536×1024。5列×2段。左端の列は「見本」。上の段に1〜4、下の段に5〜8。各ポーズを1マスに1人
・3枚目（3_guide）：動きの見本（棒の人形）。マスの番号と同じ番号のポーズを描く。見本は前傾していますが、今回は体を起こして描く

{COMMON_RULES}{RUN_UPRIGHT}
【いちばん大事な動き】
上の段と下の段は「同じ絵」ではありません。着地する足と前に振る腕が入れ替わります。1と5を並べると、着いている足・前の腕が逆。
絵を左右反転しない（8人とも同じ向き。かばん・服の模様の位置はそのまま）。

{poses}
【走って見えるように】
・腕はひじを 90 度近くに曲げ、大きく前後に振る。手はにぎる
・上着のすそ・髪・かばんは後ろへ流れ、はねる
・顔は前を見る

【守ること】
・1枚目とまったく同じ人物・絵柄。顔・髪・帽子・服の模様・ベルト・かばん・ブーツ・手袋・色・線の太さ・塗り方を変えない
・着地している足を緑の線に置く。浮くコマ（4・8）も頭のてっぺんは水色の線。マスからはみ出さない・重ねない
・筆で塗り重ねた手描きの質感（フラットな絵・3DCG風にしない）
・文字・数字・枠の線・影・地面・速さの線（効果線）・背景は描かない（入ってしまっても Claude が消せます）
・背景は透明（できなければマゼンタ一色 #FF00FF）。横長 1536×1024 の PNG
"""


def section(text: str, start: str, end: str) -> str:
    i = text.index(start)
    j = text.index(end, i)
    return text[i:j]


# 前回（第3版）の依頼文から、8つのポーズの説明だけを使い回す
PREV_WALK_POSES: dict[str, str] = {}
PREV_RUN_POSES: dict[str, str] = {}
for _d, _f in (('front', None), ('left', 'left/4_PROMPT_left_walk.txt'), ('back', 'back/4_PROMPT_back_walk.txt')):
    if _f:
        PREV_WALK_POSES[_d] = section((PREV / _f).read_text(encoding='utf-8'), '【8つのポーズ】', '【人がしっかり歩いて見えるように】')
PREV_WALK_POSES['front'] = """【8つのポーズ】
1 着く：右足（画面の左）を前（手前・少し下）へ出し、かかとが着いた瞬間。左足（画面の右）は後ろ（奥・少し上）でつま先が着く。左腕が前、右腕が後ろ
2 沈む：前の右足で体重を受け、ひざが曲がって体が少し低い。後ろの左足のかかとが上がる
3 足を運ぶ：右足でまっすぐ立ち、左足（画面の右）をひざを曲げて持ち上げ、前へ運ぶ途中。腕は体の横
4 伸び上がる：右足のつま先でけり出し、体が少し高い。左足は前へのびて、いまにも着きそう
5 着く：左足（画面の右）を前へ出し、かかとが着いた瞬間。右足（画面の左）は後ろでつま先が着く。右腕が前、左腕が後ろ
6 沈む：前の左足で体重を受け、体が少し低い。後ろの右足のかかとが上がる
7 足を運ぶ：左足でまっすぐ立ち、右足（画面の左）を持ち上げて前へ運ぶ途中。腕は体の横
8 伸び上がる：左足のつま先でけり出し、体が少し高い。右足は前へのびて、いまにも着きそう

"""
for _d, _f in (('front', 'front/5_PROMPT_front_run.txt'), ('left', 'left/5_PROMPT_left_run.txt'), ('back', 'back/5_PROMPT_back_run.txt')):
    PREV_RUN_POSES[_d] = section((PREV / _f).read_text(encoding='utf-8'), '【8つのポーズ】', '【走って見えるように】')

README = """ミストラルモンスターズ バトルカード　主人公の「立ち・歩き・走り」をひとつの大きさ・色にそろえる依頼一式（2026-10-25）
作成：Claude（ゲームの組み込み担当）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ なぜ、いまの絵を縮めたり色を合わせたりしても「同一」にならないか
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
いまの主人公の絵は、次の4つが別々の日に・別々の絵として描かれたものです。
  (1) 立ち姿（正面）＝新しい正式の立ち絵　(2) 歩き（正面・背中・横の各8コマ）　(3) 走り（同じく8コマ）　(4) 横・背中の立ち姿（前の絵）
絵ごとに「頭の大きさ」「胴の長さ」「ブーツの大きさ」「色の鮮やかさ」が少しずつ違います。
縮小で合わせられるのは1つの物差しだけです。背の高さを合わせると頭の大きさが違い、頭を合わせると体の大きさが違う。
走りは「前に傾いてかがんだ姿勢」で描かれているので、同じ大きさのままでも頭の位置が 15〜25% 低く、背が低く見えます。
走りを立ち姿の背の高さまで拡大すると、今度は体と頭が 15〜25% 大きくなります（画像 why_run.png）。
つまり、別々に描いた絵を「同一」にするのは、どの物差しで合わせても無理です。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ どうすれば同一にできるか（この一式のやり方）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
歩き・走りを、正式の立ち姿を「同じ絵の中の見本」にして描き直す。
  ・枠（2_frame）の左端のマスに、正式の立ち姿を「この大きさ・この色」として貼ってある。8ポーズは必ずその見本と同じ大きさ・色
  ・走りは「かがまない」走り（前傾 5 度まで、頭のてっぺんは線のまま）として頼む。かがむ走りは、どう描いても背が低く見える
  ・1枚ごとに Claude が、帽子の幅・背の高さ・色を見本と比べて、3% より違うコマは直しを頼む（または Claude がその範囲で直す）
これで「立ち・歩き・走りが同じ人物の同じ大きさ」になります。残るのは歩くときの自然な上下（2% まで）だけで、それは動きとして必要です。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 頼む順番（1枚できるごとに Claude へ。Claude が測って組み込み、動画を返す）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
男性（male/）
 1. front/ 歩き（4_PROMPT_front_walk）  ← 見本＝新しい立ち絵。ここで「同じ大きさ・色」になるかを確かめる
 2. front/ 走り（5_PROMPT_front_run）
 3. left/  歩き（4_PROMPT_left_walk）   ← 見本のマスに「左向きの立ち姿」も描いてもらう（左向きの正式の立ち絵が無いため）
 4. left/  走り（5_PROMPT_left_run）    ← 3 で描かれた左向きの立ち姿を、Claude が見本のマスに貼った枠を作ってから
 5. back/  歩き（4_PROMPT_back_walk）   ← 見本のマスに「背中の立ち姿」も描いてもらう
 6. back/  走り（5_PROMPT_back_run）    ← 5 の立ち姿を貼った枠を Claude が作ってから
女性（female/）
 7〜12. 同じ順番（見本は女性の新しい立ち絵）
合計 12 枚。右向きは左向きの反転なので頼まない

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 1枚の頼み方（毎回同じ）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 画像AIで「新しい会話」を始める
2. そのフォルダの 1_ref・2_frame・3_guide の3枚を添付
3. 4_（歩き）か 5_（走り）の文をそのまま貼って送る
4. できた絵を見て
   ・見本より明らかに大きい／小さい、色が違う → 7_FIX の「大きさ・色」の一言を貼る
   ・上下の段が同じ形 → 6_IF_SAME の文を貼る
   ・足が逆など → 7_FIX の当てはまる一言
5. 1536×1024 の PNG で保存して Claude に送る（名前：player_male_front_walk8_u.png のように 人物_向き_動作8_u）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ それでも大きさがそろわないとき
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
・画像AIは同じ絵の中の見本には合わせやすいが、それでも 2〜5% ずれることがある。3% までなら Claude が帽子の幅で1コマずつ直す
・それ以上ずれる絵が続くときは、人に頼む（2Dアニメが描ける人。この一式をそのまま渡せる。目安 3〜8万円／1人）
・いまの絵のまま使い続ける場合の限界：正面と背中は立ち・歩きがそろっているが、横の立ち姿と走り4方向は、絵が違うため同一にはならない

■ このフォルダ
why_run.png   いまの走りの絵が「背が低く見える」理由と、拡大すると体が大きくなる様子（男性）
male/front/   1_ref（新しい立ち絵）・2_frame（見本を貼った枠）・3_guide（動きの見本：歩き _walk・走り _run）・4_/5_（依頼文）・6_IF_SAME・7_FIX
male/left/    1_ref（左＝新しい立ち絵、右＝いまの左向きの絵）・2_frame（見本のマスは空。立ち姿も描いてもらう）・3_guide・4_・6_・7_
              走り（5_）の枠は、歩きの絵が届いて左向きの立ち姿ができてから Claude が作る（5_ の文は先に入れてある）
male/back/    同じ構成
female/       同じ構成（見本は女性の新しい立ち絵）
"""

FIX = """直しの一言（当てはまるものを1つずつ、同じ会話で貼る。番号は直したいマスの番号に書きかえる）

■ 大きさが見本と違う（今回いちばん多い直し）
「3の人物が見本より大きい（小さい）です。見本とまったく同じ大きさに描き直してください。頭のてっぺんは水色の線、足の裏は緑の線。
　帽子の幅・顔の大きさを見本と同じに。ポーズはそのまま。ほかのマス・背景（透明）はそのまま。」

■ 色が見本と違う（鮮やか・明るい・暗い）
「色が見本と違います。見本とまったく同じ色（肌・髪・帽子・服・ブーツ）に直してください。鮮やかにしない・明るくしない。形はそのまま。」

■ 走りでかがんでいる（頭が低い）
「走りの体が前に倒れすぎています。背すじを起こして、頭のてっぺんを水色の線に。前傾は 5 度まで。足と腕の動きはそのまま。」

■ 足が逆（立っている足と持ち上げている足が入れ替わっている）
「3のポーズだけ描き直してください。右足でまっすぐ立ち、左足をひざを曲げて持ち上げている形です。いまは逆になっています。
　ほかのマス・人物・大きさ・背景（透明）はそのまま。」

■ 腕が振れていない（8人とも同じ腕）
「腕を直してください。上の段（1〜4）は左腕が前・右腕が後ろ、下の段（5〜8）は右腕が前・左腕が後ろです。足はそのまま。」

■ 見本のマスまで描き直してしまった
「左端の見本のマスは元のままにしてください（描き直さない）。番号のマスだけ描きます。」

■ 枠の線や文字が絵に入った
→ そのまま Claude に送ってよい（Claude が消す）
"""

IF_SAME = (PREV / 'left/6_IF_SAME.txt').read_text(encoding='utf-8')


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    (OUT / '00_README_UTF8.txt').write_text(README, encoding='utf-8')
    for gender in ('male', 'female'):
        stand = cut_out(Image.open(STANDS[gender]))
        cell = fit_stand(stand)
        for direction in ('front', 'left', 'back'):
            d = OUT / gender / direction
            d.mkdir(parents=True)
            old = OLD_STANDS.get((gender, direction))
            ref_image(stand, old).save(d / '1_ref.png')
            if direction == 'front':
                frame(cell, '').save(d / '2_frame.png')
            else:
                frame(None, f'ここに{DIR_JA[direction]}の\n立ち姿を描く\n（大きさ・色は1枚目）').save(d / '2_frame.png')
            for kind in ('walk', 'run'):
                # 動きの見本は第3版のものを使い回す。正面の歩きの見本は無かったので、横から見た左向きの見本を使う
                src = PREV / direction / f'3_guide8_{direction}_{kind}.png'
                if not src.exists():
                    src = PREV / 'left' / f'3_guide8_left_{kind}.png'
                shutil.copy(src, d / f'3_guide_{kind}.png')
            (d / f'4_PROMPT_{direction}_walk.txt').write_text(prompt_walk(gender, direction), encoding='utf-8')
            (d / f'5_PROMPT_{direction}_run.txt').write_text(prompt_run(gender, direction), encoding='utf-8')
            (d / '6_IF_SAME.txt').write_text(IF_SAME, encoding='utf-8')
            (d / '7_FIX_UTF8.txt').write_text(FIX, encoding='utf-8')
    print('出力:', OUT)


if __name__ == '__main__':
    main()
