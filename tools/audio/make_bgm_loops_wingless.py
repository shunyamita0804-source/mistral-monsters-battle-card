# -*- coding: utf-8 -*-
"""BGM のループ用ファイルを作る（ユーフルカ〔Wingless Seraph〕の曲。2026-10-26 ユーザー提供・利用確認済み。届いた ZIP をすべて同じフォルダに展開して使う）

使い方: python3 -I tools/audio/make_bgm_loops_wingless.py <ZIP を展開したフォルダ> assets/audio/bgm

- 届いた ZIP の「ツクール用」OGG（フォルダ直下の *_loop.ogg）と、同じ名前の .txt に書かれたループの位置
  （LOOPSTART・LOOPLENGTH。単位はサンプル）を使う
- 前奏（LOOPSTART より前）は外し、ループする範囲だけを切り出す。終わりの短い区間は「ループの頭の直前の音」と
  重ねてなめらかにする（拍がずれないよう、元の曲でループの頭へつながる音とそろえて重ねる）
- MP3（128kbps・ステレオ）。音量はファイルでは変えない（ゲームの BGM_REGISTRY の gain で合わせる）
"""
import os
import re
import subprocess
import sys

import numpy as np

SR = 44100
XFADE_S = 0.3
# id: 届いたフォルダの中の曲の名前（<名前>_loop.ogg と <名前>_loop.txt）
TRACKS = {
    'battle': 'Battle-HolyBeast',  # 野生モンスターとの対戦：神獣の試練
    'boss_battle': 'Boss-battle',  # ボス戦：己と仲間を信じて
    'tournament_battle': 'Battle-Conflict',  # 公式ランク戦（大会の対戦）：Conflict
    'town': 'Wanderers-City',  # 街：放浪者の街
    # 2026-10-26 追加（ユーザー提供・利用確認済み）
    'dungeon_ruins': 'Moon-ruins',  # 遺跡のダンジョン：月の廃墟
    'dungeon_forest': 'Elven-Sanctuary',  # 森のダンジョン：古代エルフの聖域
    'lab': 'sealed_room',  # カード研究所：開かれし封印の扉
    # 2026-10-26 追加：これから作るダンジョン用（ユーザー提供・利用確認済み。まだゲームでは鳴らさない）
    'dungeon_tower': 'Tower-of-despair',  # Tower of Despair
    'dungeon_dimension': 'Es-STAGE4',  # Another Dimension
    'dungeon_sacred': 'The-sacred-place',  # The Sacred Place
    'dungeon_snow': 'Everlasting-Snow',  # 永遠の雪原
    'dungeon_undersea': 'Undersea-palace',  # Undersea Palace ～海底神殿～
}


def find(root: str, name: str) -> str:
    for dirpath, dirnames, filenames in os.walk(root):
        if 'Assets_for_Unity' in dirpath:
            continue
        if name in filenames:
            return os.path.join(dirpath, name)
    raise FileNotFoundError(name)


def decode(path: str) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)


def loop_points(txt: str) -> tuple[int, int]:
    with open(txt, 'rb') as f:
        text = f.read().decode('cp932', errors='replace')
    start = int(re.search(r'LOOPSTART:(\d+)', text).group(1))
    length = int(re.search(r'LOOPLENGTH:(\d+)', text).group(1))
    return start, start + length


def make_loop(a: np.ndarray, s: int, e: int) -> np.ndarray:
    x = round(XFADE_S * SR)
    t = np.linspace(0, 1, x, dtype=np.float32)[:, None]
    body = a[s:e].copy()
    # 終わりの x を、ループの頭の直前 a[s-x:s] へ移していく（どちらも「このあと a[s] が続く」音なので拍がそろう）
    body[-x:] = a[e - x:e] * np.cos(t * np.pi / 2) + a[s - x:s] * np.sin(t * np.pi / 2)
    return body


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for tid, name in TRACKS.items():
        s, e = loop_points(find(src, f'{name}_loop.txt'))
        loop = make_loop(decode(find(src, f'{name}_loop.ogg')), s, e)
        dst = os.path.join(out, f'bgm_{tid}.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-',
                        '-c:a', 'libmp3lame', '-b:a', '128k', dst], input=loop.astype(np.float32).tobytes(), check=True)
        print(f'{dst}  {len(loop) / SR:.1f}秒  {os.path.getsize(dst) // 1024}KB')


if __name__ == '__main__':
    main()
