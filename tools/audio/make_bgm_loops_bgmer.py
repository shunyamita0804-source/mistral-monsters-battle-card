# -*- coding: utf-8 -*-
"""BGM のループ用ファイルを作る（BGMer の曲など、ループの位置が書かれていない曲。2026-10-26 ユーザー提供・利用確認済み）

使い方: python3 -I tools/audio/make_bgm_loops_bgmer.py assets/audio/bgm shop=<セールストークのファイル> practice=<無心になれる作業のファイル> home=… house=… neighbor=… title=… bureau=…

- 届いた曲は終わりがフェードアウトするので、曲の中で同じ音がもう一度始まる所（tools/audio/find_loop.py で探した）を
  ループの始め・終わりにして、その間だけを切り出す
- 終わりの短い区間は「ループの頭の直前の音」と重ねてなめらかにする（make_bgm_loops_wingless.py と同じ）
- MP3（128kbps・ステレオ）。音量はファイルでは変えない（ゲームの BGM_REGISTRY の gain で合わせる）
"""
import os
import subprocess
import sys

import numpy as np

SR = 44100
XFADE_S = 0.3
# id: (ループの始め秒, 終わり秒)。find_loop.py の結果
TRACKS = {
    'shop': (170.0229, 266.0229),  # カードショップ：セールストーク（96 秒ごとに同じ曲がくり返す）
    'practice': (27.8873, 87.3564),  # カード練習場：無心になれる作業
    # 2026-10-26 追加（ユーザー提供・利用確認済み。曲名・作者はファイルに書かれていない）
    'home': (2.7488, 46.4100),  # 主人公の部屋
    'house': (4.6479, 112.6479),  # 住人の家（民家A〜E 共通）
    'neighbor': (2.7987, 115.6941),  # 案内人（となりの家の女性）の家
    # 2026-10-30 追加（ユーザー提供・OpenTracks〔旧 DOVA-SYNDROME〕・利用確認済み。指示書 I）
    # タイトル：異世界へようこそ / 蒲鉾さちこ（68.9 秒。約 56 秒からフェードアウト）。テンポ 約94 の 16 小節（約 41 秒）
    'title': (0.3998, 41.4668),
    # カードバトラー管理局：白銀の城 / マニーラ（83.7 秒。曲の終わりは最後の音が約 1.4 秒かけて消えるので、頭へはそのままつながらない）。
    # 6.85 秒からの所と 64.72 秒からの所が同じ音（約 58 秒）
    'bureau': (6.8469, 64.7231),
}


def decode(path: str) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)


def make_loop(a: np.ndarray, s: int, e: int) -> np.ndarray:
    x = round(XFADE_S * SR)
    t = np.linspace(0, 1, x, dtype=np.float32)[:, None]
    body = a[s:e].copy()
    body[-x:] = a[e - x:e] * np.cos(t * np.pi / 2) + a[s - x:s] * np.sin(t * np.pi / 2)
    return body


def main() -> None:
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for arg in sys.argv[2:]:
        tid, path = arg.split('=', 1)
        start, end = TRACKS[tid]
        loop = make_loop(decode(path), round(start * SR), round(end * SR))
        dst = os.path.join(out, f'bgm_{tid}.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-',
                        '-c:a', 'libmp3lame', '-b:a', '128k', dst], input=loop.astype(np.float32).tobytes(), check=True)
        print(f'{dst}  {len(loop) / SR:.1f}秒  {os.path.getsize(dst) // 1024}KB')


if __name__ == '__main__':
    main()
