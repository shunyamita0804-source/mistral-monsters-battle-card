"""ノウス・ガウルの枠の色の候補を、実際の枠（手札の枠・場の枠）で作って並べる（2026-11-07 指示書 BO）。ゲームの絵は変えない（出力は作業用フォルダ）。
python3 -I tools/art/bo_frame_candidates.py 出力フォルダ
- CANDS の候補ごとに、ノウス・ガウルの手札の枠（skillcard_simple_build.py と同じ色付け）と場の枠（battle_card_frame.py）を作り、
  ラディエル・ギアロス・タイラント・クロシオ・ノビトン・ソラモの今の枠と1行に並べる → cand_hand.png・cand_battle.png
"""
import sys, os, subprocess
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, ROOT+'/tools/art')
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import skillcard_simple_build as sb
S=sys.argv[1]
os.makedirs(S, exist_ok=True)
CANDS={'C0':('#B5500F','#F2A86B'),'C1':('#9A3F0A','#F7C08A'),'C2':('#8C3A10','#FAD4AE'),'C3':('#7A3A12','#F5B47C')}
src_im=Image.open(sb.SRC/'frame_hand_simple.png').convert('RGBA')
w,h=sb.GAME_SIZE['hand']
if h!=sb.HAND_SRC_H: src_im=sb.stretch_middle(src_im,h*4,sb.HAND_STRETCH)
src=np.array(src_im).astype(float); size=(w*sb.SCALE,h*sb.SCALE)
def hand(color): return sb.shrink(sb.tint(src,sb.hex_rgb(color),0.7),size)
D=ROOT+'/design-parts/cards-original/soramo-battle-20261025'
for c,(n,g) in CANDS.items():
    hand(n).save(f'{S}/hand_nous_{c}.png'); hand(g).save(f'{S}/hand_gauul_{c}.png')
    os.makedirs(f'{S}/b_{c}',exist_ok=True)
    subprocess.run([sys.executable,'-I',ROOT+'/tools/art/battle_card_frame.py',D+'/04_Approved_Battle_Frame_Reference.png',D+'/MonsterColor_AccentMask_800x920.png',f'{S}/b_{c}',f'nous={n}',f'gauul={g}'],check=True,capture_output=True)
font=ImageFont.truetype(os.environ.get('JA_FONT','/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf'),26)
others=[('radiel','ラディエル'),('gearos','ギアロス'),('tyrant','タイラント'),('kuroshio','クロシオ'),('nobiton','ノビトン'),('soramo','ソラモ')]
A=ROOT+'/assets/images/ui/'
def sheet(kind, scale, out):
    rows=[]
    for c,(n,g) in CANDS.items():
        if kind=='hand': items=[(f'{S}/hand_nous_{c}.png',f'ノウス {n}'),(f'{S}/hand_gauul_{c}.png',f'ガウル {g}')]+[(A+f'skillcard_simple/frame_hand_{m}.webp',l) for m,l in others]
        else: items=[(f'{S}/b_{c}/frame_nous.png',f'ノウス {n}'),(f'{S}/b_{c}/frame_gauul.png',f'ガウル {g}')]+[(A+f'battlecard/frame_{m}.png',l) for m,l in others]
        ims=[(Image.open(p).convert('RGBA'),l) for p,l in items]
        W=int(ims[0][0].width*scale); H=int(ims[0][0].height*scale)
        r=Image.new('RGB',((W+14)*len(ims)+90,H+44),(20,30,60)); d=ImageDraw.Draw(r)
        d.text((8,H//2),c,fill='yellow',font=font)
        for k,(im,l) in enumerate(ims):
            t=im.resize((W,H)); r.paste(t,(90+k*(W+14),0),t); d.text((90+k*(W+14)+4,H+6),l,fill='white',font=font)
        rows.append(r)
    out_im=Image.new('RGB',(rows[0].width,sum(r.height+10 for r in rows)),(20,30,60)); y=0
    for r in rows: out_im.paste(r,(0,y)); y+=r.height+10
    out_im.save(out)
sheet('hand',0.42,f'{S}/cand_hand.png'); sheet('battle',0.25,f'{S}/cand_battle.png'); print('ok')
