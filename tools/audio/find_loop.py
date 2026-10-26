# -*- coding: utf-8 -*-
"""曲の中で「同じ音がもう一度始まる所」を探して、ループの始め・終わり（秒）の候補を出す（2026-10-26）

使い方: python3 -I tools/audio/find_loop.py <曲のファイル> [最短の長さ秒] [最長の長さ秒] [終わりの余白秒]

- 0.05 秒ごとの音の特徴（周波数の帯ごとの大きさ）を作り、i から始まる数秒と j から始まる数秒が
  いちばん似ている i・j を探す（j で i へ戻れば、続きの音が同じなので自然につながる）
- 見つけた i・j は波形の形で 1 サンプル単位まで合わせ直す
- 終わりのフェードアウトには入らないよう、曲の最後から「終わりの余白秒」より前で探す
"""
import subprocess
import sys

import numpy as np

SR = 22050
HOP = 1102  # 約 0.05 秒
WIN = 80  # 比べる長さ（コマ数。約 4 秒）


def decode(path: str, sr: int) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def features(a: np.ndarray) -> np.ndarray:
    n = 2048
    frames = (len(a) - n) // HOP
    window = np.hanning(n).astype(np.float32)
    spec = np.abs(np.fft.rfft(np.stack([a[i * HOP:i * HOP + n] * window for i in range(frames)]), axis=1))
    edges = np.unique(np.geomspace(2, spec.shape[1] - 1, 40).astype(int))
    bands = np.stack([spec[:, edges[k]:edges[k + 1]].sum(axis=1) for k in range(len(edges) - 1)], axis=1)
    f = np.log1p(bands * 10)
    f -= f.mean(axis=1, keepdims=True)
    return f / (np.linalg.norm(f, axis=1, keepdims=True) + 1e-9)


def main() -> None:
    path = sys.argv[1]
    min_len = float(sys.argv[2]) if len(sys.argv) > 2 else 30
    max_len = float(sys.argv[3]) if len(sys.argv) > 3 else 240
    tail = float(sys.argv[4]) if len(sys.argv) > 4 else 8
    a = decode(path, SR)
    f = features(a)
    total = len(f)
    fps = SR / HOP
    last = total - int(tail * fps) - WIN
    best: list[tuple[float, int, int]] = []
    for lag in range(int(min_len * fps), min(int(max_len * fps), last - WIN) + 1):
        # 同じ時間差 lag で並べた2本の特徴の似ている度合いを、WIN コマ続けて足す
        sim = (f[:last - lag] * f[lag:last]).sum(axis=1)
        run = np.convolve(sim, np.ones(WIN), 'valid') / WIN
        i = int(np.argmax(run))
        best.append((float(run[i]), i, i + lag))
    best.sort(reverse=True)
    print(f'長さ {len(a) / SR:.2f}秒')
    shown: list[int] = []
    hi = 44100
    b = decode(path, hi)
    for score, i, j in best:
        if any(abs((j - i) - s) < fps * 2 for s in shown):
            continue
        shown.append(j - i)
        # 波形で合わせ直す（j のまわり ±0.05 秒で、i からの 0.5 秒といちばん形が合う所）
        si, sj = int(i * HOP / SR * hi), int(j * HOP / SR * hi)
        ref = b[si:si + hi // 2]
        offs = range(-hi // 20, hi // 20)
        k = max(offs, key=lambda o: float(np.dot(ref, b[sj + o:sj + o + len(ref)])))
        print(f'似ている度合い {score:.3f}  始め {si / hi:.4f}秒  終わり {(sj + k) / hi:.4f}秒  長さ {(sj + k - si) / hi:.2f}秒')
        if len(shown) >= 5:
            break


if __name__ == '__main__':
    main()
