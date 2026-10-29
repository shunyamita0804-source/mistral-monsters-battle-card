# -*- coding: utf-8 -*-
"""街・部屋の部品を並べ、ゲーム用の絵と当たり判定を作る

使い方:
  python3 tools/design/seimon_world_build.py 部屋の部品のフォルダ [確認画像の出力フォルダ]
  （ふつうは design-parts/seimon-world。scipy が要る）

- 街：2026-10-28 から tools/design/town2026_build.py（新しい部品 design-parts/town-20261028/）。前の街の組み立ては消した
- 部屋：部品のファイル名は docs/design/seimon-town/05_補助資料/02_納品ファイル名一覧 の保存名。配置の正本は
  tools/design/seimon_town_pack.py の ROOMS（設計図と同じ座標）
- 出力
  - assets/images/maps/town/                       街の絵（town2026_build.py の説明を見る）
  - assets/images/maps/rooms/{部屋}_shell.webp      部屋の箱（床と壁）
  - assets/images/maps/rooms/{部屋}_{家具}.webp     家具（1つずつ切り出し。人より奥／手前の重なりをゲームで決める）
  - src/data/worldArt.generated.ts                  マス目（歩ける所）・扉・家具の位置（ゲームが読む）
- 絵は描き直さない。縮小・切り抜き・透明部分のふちの整理・影を付けて並べるだけ
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import seimon_town_pack as pack  # noqa: E402  部屋の設計図（ROOMS）
import cardshop_v2 as shop2  # noqa: E402  2026-10-27 カードショップの内装・中の自動ドア
import town2026_build as town2026  # noqa: E402  2026-10-28 新しい街

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_ROOMS = os.path.join(ROOT, 'assets/images/maps/rooms')
OUT_TS = os.path.join(ROOT, 'src/data/worldArt.generated.ts')

CELL = 32                 # 当たり判定のマス（完成図のピクセル）
WEBP_Q = 82

# ───────────── 部品の読み込み ─────────────
def clean_alpha(im: Image.Image, cut: int = 128) -> Image.Image:
    """透明部分のふちの色にじみを消す：半透明を切り、1px 内側に縮める（絵そのものは変えない）"""
    a = np.array(im.convert('RGBA'))
    al = np.where(a[..., 3] > cut, 255, 0).astype(np.uint8)
    al = np.array(Image.fromarray(al).filter(ImageFilter.MinFilter(3)))
    a[..., 3] = al
    return Image.fromarray(a)


def load_part(parts: str, name: str) -> Image.Image:
    im = clean_alpha(Image.open(f'{parts}/{name}.png'))
    return im.crop(im.getbbox())


def split_sheet(parts: str, name: str, dilate: int = 3, cuts: tuple = ()) -> list[Image.Image]:
    """家具・小物の1枚の絵から、1つずつ切り出す（左上から読む順）
    cuts：くっついて描かれた2つを横の線で分ける (x1, x2, y)。y の行から下を別の物にする"""
    im = Image.open(f'{parts}/{name}.png').convert('RGBA')
    a = np.array(im)[..., 3] > 40
    grown = ndimage.binary_dilation(a, iterations=dilate)
    for x1, x2, y in cuts:
        grown[y - 1, x1:x2] = False
        a[y - 1, x1:x2] = False
    lab, _ = ndimage.label(grown)
    boxes = []
    for i, s in enumerate(ndimage.find_objects(lab)):
        ys, xs = s
        if (a[s] & (lab[s] == i + 1)).sum() < 1500:
            continue
        boxes.append((xs.start, ys.start, xs.stop, ys.stop, i + 1))
    boxes.sort(key=lambda b: (round(((b[1] + b[3]) / 2) / 250), b[0]))
    out = []
    for x1, y1, x2, y2, k in boxes:
        piece = np.array(im.crop((x1, y1, x2, y2)))
        piece[..., 3] = np.where(lab[y1:y2, x1:x2] == k, piece[..., 3], 0)
        p = clean_alpha(Image.fromarray(piece), 96)
        out.append(p.crop(p.getbbox()))
    return out


# ───────────── 街（2026-10-28 から tools/design/town2026_build.py が作る） ─────────────
# 建物に光と陰（2026-10-26 ユーザー指示「案B」。光は左上から）。新しい街の建物にも同じものをかける
def shade_building(part: Image.Image) -> Image.Image:
    """建物に光と陰：左上 ×1.06 → 右 ×0.90、下の45%はさらに最大 ×0.90（形にそって）"""
    arr = np.array(part).astype(np.float32)
    h, w = arr.shape[:2]
    xs = np.linspace(0, 1, w)[None, :]
    ys = np.linspace(0, 1, h)[:, None]
    k = 1.06 - 0.16 * xs - 0.10 * np.clip((ys - 0.55) / 0.45, 0, 1)
    arr[..., :3] = np.clip(arr[..., :3] * k[..., None], 0, 255)
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')


# ───────────── 部屋 ─────────────
# 部屋の箱の絵（1024×1024）の中の床の範囲：奥の壁の下 top、手前の壁の上 bottom、
# 左右の壁（奥 lt/rt・手前 lb/rb）、手前の壁の出入口の左右 door
SHELL = {
    'ROOM_PLAYER': dict(file='room_shell_player', top=300, bottom=938, lt=70, rt=955, lb=25, rb=1000, door=(444, 582)),
    'ROOM_GUIDE': dict(file='room_shell_guide', top=250, bottom=932, lt=50, rt=975, lb=12, rb=1012, door=(444, 582)),
    'ROOM_HOUSE': dict(file='room_shell_house', top=290, bottom=905, lt=95, rt=930, lb=25, rb=1000, door=(416, 608)),
    'ROOM_SHOP': dict(file='room_shell_shop', top=335, bottom=888, lt=95, rt=932, lb=18, rb=1008, door=(414, 612)),
    'ROOM_LAB': dict(file='room_shell_lab', top=340, bottom=905, lt=75, rt=950, lb=22, rb=1002, door=(416, 610)),
    'ROOM_TRAINING': dict(file='room_shell_training', top=318, bottom=932, lt=75, rt=950, lb=22, rb=1002, door=(448, 576)),
    'ROOM_ARENA': dict(file='room_shell_arena', top=330, bottom=850, lt=60, rt=965, lb=40, rb=985, door=(390, 650)),
}

# 家具の部品（部品の何番目か）。分割の広げ幅（大会会場の客席は板が離れているので広く）
FURN = {
    'furn_player': (3, ['bed', 'desk', 'bookshelf', 'wall_map']),
    'furn_common': (3, ['rug', 'plant', 'table', 'shelf']),
    'furn_guide': (3, ['fireplace', 'kitchen', 'round_table', 'flower_stand']),
    'furn_shop': (3, ['shelf_wall', 'pack_machine', 'counter', 'showcase']),
    'furn_lab': (3, ['big_shelf', 'crystal', 'specimen', 'desk', 'shelf2', 'reading_table']),
    # 2026-10-27 に届いた研究所の新しい家具5つ（読む順：解析台・標本棚・記録の投影機・薬品の作業台・黒板）
    'furn_lab_v2': (3, ['analysis', 'cabinet', 'projector', 'chem', 'blackboard']),
    'furn_training': (3, ['board', 'table', 'bench', 'shelf']),
    'furn_arena': (12, ['flags', 'stage', 'seats', 'reception']),
}
# くっついて描かれた家具を分ける線（2026-10-23 の大人向けの絵：ベッドの脚と本棚の上がふれている）
FURN_CUTS = {
    'furn_player': ((0, 460, 496),),
}

# 設計図の家具 ID → 使う部品。kind: furniture（床に置く・歩けない）／rug（敷物・歩ける）／wall（壁に掛ける）
ROOM_ITEMS = {
    'ROOM_PLAYER': {'BED': 'furn_player:bed', 'WALL_MAP': 'furn_player:wall_map', 'BOOKSHELF': 'furn_player:bookshelf',
                    'DESK': 'furn_player:desk', 'RUG': 'furn_common:rug', 'PLANT': 'furn_common:plant'},
    'ROOM_GUIDE': {'FIREPLACE': 'furn_guide:fireplace', 'KITCHEN': 'furn_guide:kitchen', 'BOOKSHELF': 'furn_player:bookshelf',
                   'TABLE': 'furn_guide:round_table', 'FLOWER': 'furn_guide:flower_stand'},
    'ROOM_HOUSE': {'SHELF': 'furn_common:shelf', 'PLANT': 'furn_common:plant', 'TABLE': 'furn_common:table'},
    'ROOM_SHOP': {'SHELF_WALL': 'furn_shop:shelf_wall', 'PACK_MACHINE': 'furn_shop:pack_machine', 'COUNTER': 'furn_shop:counter',
                  'CASE_L': 'furn_shop:showcase', 'CASE_R': 'furn_shop:showcase'},
    'ROOM_LAB': {'BIG_SHELF': 'furn_lab:big_shelf', 'CRYSTAL': 'furn_lab:crystal', 'SPECIMEN': 'furn_lab:specimen',
                 'DESK': 'furn_lab:desk', 'SHELF2': 'furn_lab:shelf2', 'TABLE': 'furn_lab:reading_table',
                 'BLACKBOARD': 'furn_lab_v2:blackboard', 'CABINET': 'furn_lab_v2:cabinet', 'PROJECTOR': 'furn_lab_v2:projector',
                 'ANALYSIS': 'furn_lab_v2:analysis', 'CHEM': 'furn_lab_v2:chem'},
    'ROOM_TRAINING': {'BOARD': 'furn_training:board', 'SHELF': 'furn_training:shelf', 'TABLE_1': 'furn_training:table',
                      'TABLE_2': 'furn_training:table', 'BENCH_L': 'furn_training:bench', 'BENCH_R': 'furn_training:bench'},
    'ROOM_ARENA': {'FLAGS': 'furn_arena:flags', 'STAGE': 'furn_arena:stage', 'SEATS_L': 'furn_arena:seats',
                   'SEATS_R': 'furn_arena:seats', 'RECEPTION': 'furn_arena:reception'},
}

ROOM_SLUG = {'ROOM_PLAYER': 'player', 'ROOM_GUIDE': 'guide', 'ROOM_HOUSE': 'house', 'ROOM_SHOP': 'shop',
             'ROOM_LAB': 'lab', 'ROOM_TRAINING': 'training', 'ROOM_ARENA': 'arena'}


def load_furniture(parts: str) -> dict[str, Image.Image]:
    out = {}
    for sheet, (dil, names) in FURN.items():
        pieces = split_sheet(parts, sheet, dil, FURN_CUTS.get(sheet, ()))
        assert len(pieces) == len(names), (sheet, len(pieces))
        for p, n in zip(pieces, names):
            out[f'{sheet}:{n}'] = p
    return out


def build_room(parts: str, room: dict, furn: dict[str, Image.Image], check_dir: str | None):
    rid = room['id']
    sh = SHELL[rid]
    W, H = room['size']
    k = W / 1024                       # 部屋の箱の絵 1px → 部屋の単位（設計図と同じ。主人公 108×144）
    top, bottom = sh['top'] * k, sh['bottom'] * k
    wall = pack.ROOM_WALL

    def map_y(by: float) -> float:
        """設計図の y → 部屋の絵の上の y（奥の壁と床をそれぞれ縦に合わせる）"""
        if by <= wall:
            return by / wall * top
        return top + (by - wall) / (H - wall) * (bottom - top)

    slug = ROOM_SLUG[rid]
    os.makedirs(OUT_ROOMS, exist_ok=True)
    # 書き出しの細かさ：表示（論理px＝単位×0.5625）の約2倍、元の大きさまで
    out_scale = min(1.0, 2 * 0.5625 * W / 1024)
    shell = Image.open(f'{parts}/{sh["file"]}.png').convert('RGB')
    shell.resize((round(1024 * out_scale), round(1024 * out_scale)), Image.LANCZOS).save(
        f'{OUT_ROOMS}/{slug}_shell.webp', quality=WEBP_Q + 4, method=6)

    cols = rows = W // CELL
    unit = W  # 部屋の絵は正方形
    grid = [['#'] * cols for _ in range(rows)]

    def floor_x(y: float) -> tuple[float, float]:
        t = (y / k - sh['top']) / (sh['bottom'] - sh['top'])
        return (sh['lt'] + (sh['lb'] - sh['lt']) * t) * k, (sh['rt'] + (sh['rb'] - sh['rt']) * t) * k

    for ry in range(rows):
        for cx in range(cols):
            px, py = cx * CELL + CELL / 2, ry * CELL + CELL / 2
            if top + 8 <= py <= bottom - 4:
                lx, rx = floor_x(py)
                if lx + 10 <= px <= rx - 10:
                    grid[ry][cx] = '.'
    # 出入口：手前の壁のすき間（床の下から絵の下まで）
    dl, dr = sh['door'][0] * k, sh['door'][1] * k
    door_cols = [cx for cx in range(cols) if dl + 6 <= cx * CELL + CELL / 2 <= dr - 6]
    for ry in range(rows):
        if ry * CELL + CELL / 2 > bottom - 4:
            for cx in door_cols:
                grid[ry][cx] = '.'

    sprites = []
    items = {}
    saved_files = {}
    for it in room['items']:
        key = ROOM_ITEMS[rid].get(it['id'])
        bx1, by1, bx2, by2 = it['rect']
        y1, y2 = map_y(by1), map_y(by2)
        rect_u = [bx1, y1, bx2, y2]
        if key:
            src = furn[key]
            w = bx2 - bx1
            s = w / src.width
            h = src.height * s
            if it['kind'] == 'wall':
                # 壁の物：枠の中に収める（縦横の小さい方に合わせる）
                s = min(w / src.width, (y2 - y1) / src.height)
                w, h = src.width * s, src.height * s
                x = (bx1 + bx2) / 2 - w / 2
                y = (y1 + y2) / 2 - h / 2
            else:
                x, y = bx1, y2 - h
            fname = f'{slug}_{key.split(":")[1]}.webp'
            if fname not in saved_files:
                px_w = max(1, round(w * 0.5625 * 2))
                src.resize((px_w, max(1, round(src.height * px_w / src.width))), Image.LANCZOS).save(
                    f'{OUT_ROOMS}/{fname}', quality=WEBP_Q + 6, method=6)
                saved_files[fname] = True
            # 敷物は床の一部（いつも人より奥）。壁の物も奥
            z = 0 if it['kind'] in ('rug', 'wall') else y2
            sprites.append(dict(file=f'maps/rooms/{fname}', x=round(x), y=round(y), w=round(w), h=round(h), z=round(z)))
        # 当たり判定：床に置く家具は、設計図の枠（床に当たる部分）を歩けなくする
        c1, c2 = int(bx1 // CELL), int(-(-bx2 // CELL))
        r1, r2 = int(y1 // CELL), int(-(-y2 // CELL))
        if it['kind'] == 'furniture':
            for ry in range(max(r1, 0), min(r2, rows)):
                for cx in range(max(c1, 0), min(c2, cols)):
                    if ry * CELL + CELL / 2 < y2 + 4:
                        grid[ry][cx] = '#'
        # 調べる範囲（マス）：家具の枠。上が歩けないマスなら絵の上までのばす（壁ぎわの家具・壁の物）
        rr1 = r1
        if key:
            img_top = int(sprites[-1]['y'] // CELL)
            while rr1 > max(img_top, 0) and all(grid[rr1 - 1][cx] == '#' for cx in range(max(c1, 0), min(c2, cols))):
                rr1 -= 1
        if it['kind'] == 'wall':
            # 壁の物は床に届くまで下にのばす（床の一番奥から調べられるように）
            while r2 < rows and all(grid[r2][cx] == '#' for cx in range(max(c1, 0), min(c2, cols))):
                r2 += 1
        items[it['id']] = dict(x=c1, y=rr1, w=c2 - c1, h=max(1, r2 - rr1))
    # 2026-10-30 点検 L：壁と家具のあいだにできた幅1マスの行き止まり（となりの家の台所の棚の左右など。主人公が棚の上に立って見えた）は
    # ふさぐ（上と左右が歩けないマスを、上から順に）
    changed = True
    while changed:
        changed = False
        for ry in range(1, rows - 1):
            for cx in range(1, cols - 1):
                if grid[ry][cx] == '.' and grid[ry - 1][cx] == '#' and grid[ry][cx - 1] == '#' and grid[ry][cx + 1] == '#':
                    grid[ry][cx] = '#'
                    changed = True
    exit_row = rows - 1
    spawn_row = max(ry for ry in range(rows) if ry * CELL + CELL / 2 <= bottom - 4)
    data = dict(
        id=slug, cols=cols, rows=rows, width=unit, height=unit, cell=CELL,
        grid=[''.join(r) for r in grid],
        tiles=[dict(file=f'maps/rooms/{slug}_shell.webp', x=0, y=0, w=unit, h=unit)],
        sprites=sprites, items=items,
        exit=dict(x=door_cols[0], y=exit_row, w=len(door_cols), h=1),
        spawn=dict(x=(door_cols[0] + door_cols[-1] + 1) // 2, y=spawn_row),
    )
    if check_dir:
        im = shell.resize((unit, unit), Image.LANCZOS).convert('RGBA')
        for s in sorted(sprites, key=lambda s: s['z']):
            f = Image.open(f'{OUT_ROOMS}/{s["file"].split("/")[-1]}').convert('RGBA').resize((s['w'], s['h']), Image.LANCZOS)
            im.alpha_composite(f, (s['x'], s['y']))
        d = ImageDraw.Draw(im, 'RGBA')
        for ry in range(rows):
            for cx in range(cols):
                if grid[ry][cx] == '.':
                    d.rectangle([cx * CELL, ry * CELL, cx * CELL + CELL - 1, ry * CELL + CELL - 1], outline=(0, 120, 255, 120), fill=(0, 120, 255, 35))
        for iid, r in items.items():
            d.rectangle([r['x'] * CELL, r['y'] * CELL, (r['x'] + r['w']) * CELL - 1, (r['y'] + r['h']) * CELL - 1], outline=(255, 0, 0, 200), width=2)
            d.text((r['x'] * CELL + 3, r['y'] * CELL + 3), iid, fill=(255, 255, 0, 255))
        e = data['exit']
        d.rectangle([e['x'] * CELL, e['y'] * CELL, (e['x'] + e['w']) * CELL - 1, (e['y'] + 1) * CELL - 1], fill=(0, 255, 0, 140))
        im.convert('RGB').save(f'{check_dir}/room_{slug}.jpg', quality=88)
    return data


# ───────────── TypeScript に書き出す ─────────────
def to_ts(town: dict, rooms: list[dict]) -> str:
    files: list[str] = []

    def ref(d: dict) -> dict:
        f = d['file']
        if f not in files:
            files.append(f)
        return {**d, 'file': f'@@{files.index(f)}@@'}

    maps = []
    for m in [town, *rooms]:
        m = dict(m)
        m['tiles'] = [ref(t) for t in m['tiles']]
        m['sprites'] = [ref(s) for s in m['sprites']]
        if 'doorAnims' in m:
            m['doorAnims'] = [{**d, 'left': ref(d['left']), 'right': ref(d['right'])} for d in m['doorAnims']]
        if 'loops' in m:
            m['loops'] = [{**lp, 'frames': [ref({'file': f})['file'] for f in lp['frames']]} for lp in m['loops']]
        maps.append(m)
    body = json.dumps({m['id']: m for m in maps}, ensure_ascii=False, indent=1)
    for i, _ in enumerate(files):
        body = body.replace(f'"@@{i}@@"', f'img{i}')
    imports = '\n'.join(f"import img{i} from '@assets/images/{f}';" for i, f in enumerate(files))
    return (
        '// このファイルは tools/design/seimon_world_build.py が自動で作る（手で直さない）\n'
        '// 正式な街・部屋の絵（ユーザー承認済みの部品を設計図どおりに並べたもの）と、歩ける所のマス目・扉・家具の位置\n'
        f'{imports}\n\n'
        'export interface ArtImage { readonly file: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly z?: number }\n'
        'export interface CellRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }\n'
        '/** 自動ドア：左右の戸を clip（設計図の単位）の中で travel だけ左右へ動かす。near（マス）に人がいる間は開く */\n'
        'export interface ArtDoorAnim {\n  readonly id: string;\n  readonly clip: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };\n'
        '  readonly left: ArtImage;\n  readonly right: ArtImage;\n  readonly travel: number;\n  readonly z: number;\n  readonly near: CellRect;\n}\n'
        '/** くり返す絵（噴水のしぶき）：frames を ms ごとに順に切り替える。z は人と前後を比べる足元の y */\n'
        'export interface ArtLoop {\n  readonly frames: readonly string[];\n  readonly x: number;\n  readonly y: number;\n  readonly w: number;\n  readonly h: number;\n  readonly z: number;\n  readonly ms: number;\n}\n'
        'export interface ArtMap {\n'
        '  readonly id: string;\n  readonly cols: number;\n  readonly rows: number;\n'
        '  /** 絵の大きさ（設計図の単位。表示は 0.5625 倍の論理px） */\n  readonly width: number;\n  readonly height: number;\n'
        '  /** 1マスの大きさ（設計図の単位） */\n  readonly cell: number;\n'
        "  /** マス目：'#' 歩けない・'=' 道（石畳）・',' 草・'.' 床 */\n  readonly grid: readonly string[];\n"
        '  readonly tiles: readonly ArtImage[];\n  /** 人と前後を比べて重ねる絵（z＝足元の y。0 はいつも奥） */\n  readonly sprites: readonly ArtImage[];\n'
        '  readonly exit: CellRect;\n  readonly spawn: { readonly x: number; readonly y: number };\n'
        '  readonly doors?: Readonly<Record<string, CellRect & { readonly back: { readonly x: number; readonly y: number }; readonly label: { readonly x: number; readonly y: number } }>>;\n'
        '  readonly items?: Readonly<Record<string, CellRect>>;\n  readonly fountain?: CellRect;\n'
        '  /** 自動ドア */\n  readonly doorAnims?: readonly ArtDoorAnim[];\n'
        '  /** くり返す絵 */\n  readonly loops?: readonly ArtLoop[];\n'
        '  /** 部屋を画面の高さに合わせるときの基準の高さ（無ければ絵の高さ） */\n  readonly fitHeight?: number;\n'
        '}\n\n'
        f'export const WORLD_ART: Readonly<Record<string, ArtMap>> = {body};\n'
    )


# 2026-10-28 から rooms4_build.py が作る部屋（設計図の ID）
ROOMS4_IDS = ('ROOM_ARENA', 'ROOM_TRAINING', 'ROOM_LAB')


def main() -> None:
    parts = sys.argv[1]
    check = sys.argv[2] if len(sys.argv) > 2 else None
    if check:
        os.makedirs(check, exist_ok=True)
    # 街：2026-10-28 の新しい部品（design-parts/town-20261028/。色の処理は town_tone_20261028.py）
    town = town2026.build_town(shade_building, check)
    furn = load_furniture(parts)
    # カードショップは 2026-10-27 の新しい内装（cardshop_v2）。
    # 大会会場・練習場・研究所は 2026-10-28 の新しい部屋の絵（tools/design/rooms4_build.py → src/data/rooms4Art.generated.ts）なので、ここでは作らない
    rooms = [
        shop2.build_shop_room() if r['id'] == 'ROOM_SHOP' else build_room(parts, r, furn, check)
        for r in pack.ROOMS
        if r['id'] not in ROOMS4_IDS
    ]
    with open(OUT_TS, 'w', encoding='utf-8') as f:
        f.write(to_ts(town, rooms))
    print('ok', OUT_TS)


if __name__ == '__main__':
    main()
