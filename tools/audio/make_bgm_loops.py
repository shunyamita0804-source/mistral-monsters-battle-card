# -*- coding: utf-8 -*-
"""BGM のループ用ファイルを作る（ミスモンの曲を使う。2026-10-22 ユーザー指示・規約はユーザー確認済み）

使い方: python3 -I tools/audio/make_bgm_loops.py <ミスモンの assets/audio/bgm フォルダ> assets/audio/bgm

- 曲の「ループする範囲」（ミスモンの audio-registry.js と同じ値）だけを切り出し、終わりの数秒を頭へなめらかにつなぐ（クロスフェード）。
  そのまま頭から繰り返せば、切れ目なく続く（ブラウザの audio の loop で鳴らせる）
- MP3（128kbps・ステレオ）。どのブラウザでも鳴る
- 音量はファイルでは変えない（ゲームの BGM_REGISTRY の gain で合わせる）
- 2026-10-26 から town・tournament_battle・battle・boss_battle はユーフルカの曲（make_bgm_loops_wingless.py）。
  このスクリプトをそのまま流すとミスモンの曲で上書きするので、残りの3曲（departure・tournament・dungeon）だけを作るときは TRACKS を絞る
"""
import os
import subprocess
import sys

import numpy as np

SR = 44100
# id: (元ファイル, ループの始め, ループの終わり（None＝最後まで）, つなぎの秒数)
TRACKS = {
    # 2026-10-30：タイトルは「異世界へようこそ」（make_bgm_loops_bgmer.py）に替えたので、この曲は bgm_departure.mp3（主人公を選ぶ場面の候補）
    'departure': ('licensed_20261007/06_prologue_departure.ogg', 0.3, None, 1.5),
    'town': ('licensed_20261008/town_bouken_e_no_izanai.ogg', 0.0, 178.6, 1.2),
    'tournament': ('licensed_20261007/08_tournament_table_start17s.ogg', 17.0, 135.2, 1.0),
    'tournament_battle': ('licensed_20261007/14_official_rank_battle.ogg', 0.0, 233.4, 0.5),
    'dungeon': ('hydrogene_16bit_rpg/07_spirits_forest_full.ogg', 27.344, 81.98, 0.2),
    'battle': ('licensed_20261007/12_wild_battle.ogg', 0.0, 108.0, 0.5),
    'boss_battle': ('licensed_20261007/13_rare_monster_battle.ogg', 0.0, None, 0.5),
}


def decode(path: str) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)


def make_loop(a: np.ndarray, start: float, end: float | None, xfade: float) -> np.ndarray:
    s, e, x = round(start * SR), (round(end * SR) if end else len(a)), round(xfade * SR)
    t = np.linspace(0, 1, x, dtype=np.float32)[:, None]
    # 終わりの x を、ループの頭の x と重ねる（等パワーのクロスフェード）。頭の x はつなぎに使ったので本体からは外す
    tail = a[e - x:e] * np.cos(t * np.pi / 2) + a[s:s + x] * np.sin(t * np.pi / 2)
    return np.concatenate([a[s + x:e - x], tail])


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for tid, (f, start, end, xfade) in TRACKS.items():
        loop = make_loop(decode(os.path.join(src, f)), start, end, xfade)
        dst = os.path.join(out, f'bgm_{tid}.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-',
                        '-c:a', 'libmp3lame', '-b:a', '128k', dst], input=loop.astype(np.float32).tobytes(), check=True)
        print(f'{dst}  {len(loop) / SR:.1f}秒  {os.path.getsize(dst) // 1024}KB')


if __name__ == '__main__':
    main()
