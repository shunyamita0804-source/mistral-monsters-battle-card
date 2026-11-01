# -*- coding: utf-8 -*-
"""当たり（歩けないマス）の点検の道具（2026-11-01 指示書 AI【6】）。

使い方:
  python3 -I tools/design/collision_audit.py [出力フォルダ] [--crop 地図:x1,y1,x2,y2:名前 ...] [--json 結果.json]

- 街と全部屋の当たり（src/data/worldArt.generated.ts・rooms4Art.generated.ts・shopRoomsArt.generated.ts のマス目）を、
  ゲームと同じ絵（背景＋家具・建物などの重ねる絵）と比べる。ゲームのソースは変えない（読むだけ）
- 数えるもの
  1. 「透明なのに当たり」：歩けないマスのうち、となり（上下左右）に歩けるマスがあり、そのマスの重ねる絵（建物・家具など。背景の絵は数えない）の
     不透明な画素が 10% 未満のもの（地面に見えるのにぶつかる所の候補）。背景に描かれた壁・水・高台のふちなど、理由のある所は REASONS の範囲で除く
  2. 「幅1マスの細い通り道」：歩けるマスのうち、左右がどちらも歩けない（縦の細道）か、上下がどちらも歩けない（横の細道）もの。つながった所をまとめて数える
- 出力フォルダを渡すと、地図ごとの点検の絵（赤＝当たり・黄＝透明なのに当たり・水色＝細い通り道）と、--crop の切り抜きを書く
"""
from __future__ import annotations

import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ASSETS = os.path.join(ROOT, 'assets/images')
TS_FILES = ['src/data/worldArt.generated.ts', 'src/data/rooms4Art.generated.ts', 'src/data/shopRoomsArt.generated.ts']

# 不透明とみなす画素（アルファ）と、「ほぼ透明」とみなす割合
ALPHA_SOLID = 100
NEAR_EMPTY = 0.10

# 透明でも当たりにしてよい所（地図 ID → (x1, y1, x2, y2〔マス。x2・y2 はふくまない〕, 理由)）。
# 背景（地面・部屋の箱）に描かれた物は重ねる絵が無いので、ここで理由を書いて除く
REASONS: dict[str, list[tuple[int, int, int, int, str]]] = {
    'player': [(6, 18, 7, 19, '机の下（いすの横。立つと机に隠れる）')],
    'guide': [
        (10, 10, 11, 11, 'テーブルの奥（花びんの真下）'),
        (7, 15, 14, 16, 'テーブルの下（脚のあいだ）'),
        (3, 19, 4, 20, '花台の脚'),
    ],
    'house': [(6, 11, 14, 12, 'テーブルの下（脚のあいだ）')],
    'arena': [
        (32, 10, 44, 23, '舞台の段（部屋の絵に描かれた段。人は舞台に上がらない）'),
        (24, 22, 36, 23, '舞台のいちばん下の段のふち'),
        (4, 17, 5, 18, '長いすの背のはし'),
        (43, 22, 56, 25, '受付の奥（カウンターの裏・セリアの所。回りこまない）'),
        (6, 29, 13, 30, '長いすの下（脚のあいだ）'),
    ],
    'practice': [(44, 29, 54, 30, '机の前のいすの横（立つと机に隠れる）')],
    'lab': [
        (31, 15, 38, 20, '研究机の奥（ルーカスの所。回りこまない）'),
        (21, 18, 22, 19, '研究机の左の角（拡大鏡の台の下）'),
        (24, 23, 35, 24, '研究机の下（脚のあいだ）'),
    ],
    'florist': [(28, 15, 32, 16, '作業台の奥（マルタの所）'), (40, 22, 41, 23, '丸いすの脚のあいだ')],
    'tailor': [(28, 15, 33, 17, '作業台の奥（ロザリーの所）'), (40, 22, 41, 23, '丸いすの脚のあいだ')],
    'town': [
        (67, 47, 91, 59, '北の高台の石垣と大階段のわき（地面の絵に描かれた壁。高台のふちから落ちない）'),
        (109, 47, 134, 59, '北の高台の石垣と大階段のわき（同上）'),
        (56, 57, 69, 66, '西の高台への階段のわき・石垣'),
        (52, 147, 53, 153, '木の橋のわきの小川'),
        (55, 147, 89, 162, '小川の石垣（水のふち）'),
        (111, 152, 124, 168, '小川の石垣（水のふち）'),
        (91, 153, 92, 160, '石の橋のらんかんのわき（水）'),
        (108, 153, 109, 160, '石の橋のらんかんのわき（水）'),
    ],
}


def load_maps() -> dict[str, dict]:
    """生成された TS から地図（ArtMap）を読む。絵の変数名はファイルの場所に置きかえる"""
    maps: dict[str, dict] = {}
    for rel in TS_FILES:
        text = open(os.path.join(ROOT, rel), encoding='utf-8').read()
        files = dict(re.findall(r"import (\w+) from '@assets/images/([^']+)';", text))
        m = re.search(r'export const \w+: [^=]+= (\{.*?\n\});', text, re.S)
        body = m.group(1)
        body = re.sub(r'(?<=[\[\s:,])(\w+Img\d+|img\d+)(?=[\s,\]])', lambda k: json.dumps(files[k.group(1)]), body)
        for key, art in json.loads(body).items():
            maps[art['id'] if rel.endswith('worldArt.generated.ts') else key] = art
    return maps


_cache: dict[str, Image.Image] = {}


def compose(art: dict, scale: float, region: tuple[float, float, float, float] | None = None) -> tuple[Image.Image, np.ndarray]:
    """背景＋重ねる絵の合成（scale：設計図の単位 → px）と、重ねる絵だけの不透明の印（bool）。region（単位）を渡すとその所だけ"""
    rx, ry, rx2, ry2 = region or (0, 0, art['width'], art['height'])
    size = (round((rx2 - rx) * scale), round((ry2 - ry) * scale))
    im = Image.new('RGBA', size, (16, 18, 26, 255))
    over = Image.new('L', size, 0)

    def place(entry: dict, sprite: bool) -> None:
        if entry['x'] > rx2 or entry['y'] > ry2 or entry['x'] + entry['w'] < rx or entry['y'] + entry['h'] < ry:
            return
        if entry['file'] not in _cache:
            _cache[entry['file']] = Image.open(os.path.join(ASSETS, entry['file'])).convert('RGBA')
        src = _cache[entry['file']]
        w, h = max(1, round(entry['w'] * scale)), max(1, round(entry['h'] * scale))
        src = src.resize((w, h), Image.BILINEAR)
        xy = (round((entry['x'] - rx) * scale), round((entry['y'] - ry) * scale))
        im.paste(src, xy, src) if xy[0] < 0 or xy[1] < 0 else im.alpha_composite(src, xy)
        if sprite:
            a = src.getchannel('A').point(lambda v: 255 if v > ALPHA_SOLID else 0)
            over.paste(255, xy, a)

    for t in art['tiles']:
        place(t, False)
    for s in sorted(art['sprites'], key=lambda s: s['z']):
        place(s, True)
    return im, np.array(over) > 0


def audit(name: str, art: dict, scale: float) -> dict:
    grid = art['grid']
    rows, cols = len(grid), len(grid[0])
    cell = art['cell'] * scale
    im, solid = compose(art, scale)
    block = np.array([[ch == '#' for ch in row] for row in grid])
    walk = ~block

    def nb(a: np.ndarray, dy: int, dx: int) -> np.ndarray:
        out = np.zeros_like(a)
        ys = slice(max(0, dy), rows + min(0, dy))
        yd = slice(max(0, -dy), rows + min(0, -dy))
        xs = slice(max(0, dx), cols + min(0, dx))
        xd = slice(max(0, -dx), cols + min(0, -dx))
        out[yd, xd] = a[ys, xs]
        return out

    edge = block & (nb(walk, -1, 0) | nb(walk, 1, 0) | nb(walk, 0, -1) | nb(walk, 0, 1))
    frac = np.zeros((rows, cols))
    for r in range(rows):
        y1, y2 = round(r * cell), round((r + 1) * cell)
        for c in range(cols):
            if edge[r, c]:
                x1, x2 = round(c * cell), round((c + 1) * cell)
                frac[r, c] = solid[y1:y2, x1:x2].mean() if y2 > y1 and x2 > x1 else 0
    empty = edge & (frac < NEAR_EMPTY)
    # 理由のある所 1：外周・壁ぞい（そのマスから上下左右のどれかの向きに、地図のはしまで歩けるマスが無い。部屋の壁・街の外の塀・壁ぞいの家具の裏）
    up = np.maximum.accumulate(walk, axis=0)
    down = np.maximum.accumulate(walk[::-1], axis=0)[::-1]
    left = np.maximum.accumulate(walk, axis=1)
    right = np.maximum.accumulate(walk[:, ::-1], axis=1)[:, ::-1]
    outer = ~up | ~down | ~left | ~right
    # 理由のある所 2：REASONS に書いた所（背景に描かれた水・高台の壁、机の下など）
    manual = np.zeros_like(empty)
    for x1, y1, x2, y2, _why in REASONS.get(name, []):
        manual[y1:y2, x1:x2] = True
    reasoned = outer | manual
    flagged = empty & ~reasoned
    # 幅1マスの細い通り道（左右とも、または上下とも歩けない。地図の外は歩けない扱い）
    lr = walk & ~nb(walk, 0, -1) & ~nb(walk, 0, 1)
    ud = walk & ~nb(walk, -1, 0) & ~nb(walk, 1, 0)
    narrow = lr | ud
    return dict(name=name, rows=rows, cols=cols, im=im, block=block, frac=frac, empty=empty, reasoned=reasoned,
                outer=empty & outer, manual=empty & manual & ~outer,
                flagged=flagged, narrow=narrow, cell=cell)


def clusters(mask: np.ndarray) -> list[tuple[int, int, int, int, int]]:
    """つながった所（8方向）ごとの (x1, y1, x2, y2, マスの数)"""
    from scipy import ndimage
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    out = []
    for i, s in enumerate(ndimage.find_objects(lab)):
        ys, xs = s
        out.append((xs.start, ys.start, xs.stop, ys.stop, int((lab[s] == i + 1).sum())))
    return sorted(out, key=lambda b: (b[1], b[0]))


def overlay(res: dict) -> Image.Image:
    im = res['im'].copy()
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    c = res['cell']
    for r in range(res['rows']):
        for x in range(res['cols']):
            box = (x * c, r * c, (x + 1) * c - 1, (r + 1) * c - 1)
            if res['flagged'][r, x]:
                d.rectangle(box, fill=(255, 230, 0, 150), outline=(255, 120, 0, 255))
            elif res['block'][r, x]:
                d.rectangle(box, fill=(255, 30, 30, 70))
            elif res['narrow'][r, x]:
                d.rectangle(box, fill=(0, 220, 255, 110))
    im.alpha_composite(ov)
    return im


def crop_image(res: dict, art: dict, box: list[int], px: int = 24) -> Image.Image:
    """切り抜き（マス x1,y1,x2,y2）を 1マス px の大きさで。赤＝当たり・黄＝透明なのに当たり・水色＝細い通り道・うすい線＝マスの境"""
    x1, y1, x2, y2 = box
    u = art['cell']
    im, _ = compose(art, px / u, (x1 * u, y1 * u, x2 * u, y2 * u))
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for r in range(y1, y2):
        for c in range(x1, x2):
            b = ((c - x1) * px, (r - y1) * px, (c - x1 + 1) * px - 1, (r - y1 + 1) * px - 1)
            if res['flagged'][r, c]:
                d.rectangle(b, fill=(255, 230, 0, 140), outline=(255, 140, 0, 255))
            elif res['block'][r, c]:
                d.rectangle(b, fill=(255, 30, 30, 95), outline=(255, 60, 60, 120))
            elif res['narrow'][r, c]:
                d.rectangle(b, fill=(0, 220, 255, 110), outline=(255, 255, 255, 50))
            else:
                d.rectangle(b, outline=(255, 255, 255, 45))
    im.alpha_composite(ov)
    return im.convert('RGB')


def main() -> None:
    args = sys.argv[1:]
    out = None
    crops: list[str] = []
    json_out = None
    i = 0
    while i < len(args):
        if args[i] == '--crop':
            crops.append(args[i + 1])
            i += 2
        elif args[i] == '--json':
            json_out = args[i + 1]
            i += 2
        else:
            out = args[i]
            i += 1
    maps = load_maps()
    summary = {}
    crop_by_map: dict[str, list[tuple[list[int], str]]] = {}
    for spec in crops:
        mid, box, label = spec.split(':')
        crop_by_map.setdefault(mid, []).append(([int(v) for v in box.split(',')], label))
    for name, art in maps.items():
        scale = 0.5 if art['cols'] > 100 else 1.0
        res = audit(name, art, scale)
        fl = clusters(res['flagged'])
        nr = clusters(res['narrow'])
        summary[name] = dict(
            blocked=int(res['block'].sum()), edge_empty=int(res['empty'].sum()), reasoned=int((res['empty'] & res['reasoned']).sum()),
            reasoned_outer=int(res['outer'].sum()), reasoned_manual=int(res['manual'].sum()),
            flagged=int(res['flagged'].sum()), flagged_groups=[list(b) for b in fl],
            narrow=int(res['narrow'].sum()), narrow_groups=[list(b) for b in nr],
        )
        print(f"{name:12s} 当たり {summary[name]['blocked']:6d}  透明で当たり {summary[name]['edge_empty']:4d}・うち理由なし {summary[name]['flagged']:4d}"
              f"（理由あり 外周・壁ぞい {summary[name]['reasoned_outer']}・個別 {summary[name]['reasoned_manual']}）"
              f"  細い通り道 {summary[name]['narrow']:4d}マス・{len(nr)}か所")
        if out:
            os.makedirs(out, exist_ok=True)
            ov = overlay(res)
            if art['cols'] <= 100:
                ov.convert('RGB').save(os.path.join(out, f'audit_{name}.jpg'), quality=85)
            for box, label in crop_by_map.get(name, []):
                crop_image(res, art, box).save(os.path.join(out, f'{label}.png'))
    if json_out:
        with open(json_out, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
