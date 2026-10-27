"""デザイン33点（2026-10-27「Mistral_UI_33」）を、ゲームで使う部品に切り分ける。

使い方：
  python3 -I tools/design/ui33_build.py design-parts/ui33-20261027

絵は描き直さない（切り抜く・余白を詰める・縮小する・WebP にするだけ）。原本は design-parts/ui33-20261027/ に無改変で保管。
番号は依頼の番号（design-parts/ui33-20261027/資料/依頼原文.txt）。書き出し先は assets/images/ の下：

【道具】（2026-10-27 指示書「ダンジョンの道具」）
  14 → ui/items/item_<道具ID>.webp（192px 角。ファイル名は小文字と _：guardianCharm → item_guardian_charm.webp）
  15 → ui/shop/menu_items.webp（ショップのメニューの4枚目の札。900×179）・ui/items/owned_tag.webp（持っている数の丸い札）
       品物の行の板（ふつう・選んだとき）は、いまの一覧の行（説明が2行入る）と形が合わないので使わない
  31・32 → effects/fx_smoke_N.webp・fx_charm_N.webp（コマが 512px の区切りをはみ出して描かれているので、絵のすき間で分けて同じ大きさの台の真ん中に）
  33 → ui/items/mark_<道具ID>.webp（効き目の印。残りの輪は絵に描かれたまま）・mark_sealed.webp（守ったカードの印）
【いまある画面・演出の差し替え】
  1 → effects/drun_light_N.webp（3コマ。黒は「加算」で消える）
  2 → ui/dungeon/omen_vignette.webp（白は「乗算」で消える）
  3・4 → maps/dungeon/ruins_b2_*.webp・ruins_b3_*.webp（床・壁の上面・壁の正面。512px）
  5 → effects/fx_leave_N.webp（3コマ）
  6 → ui/reward/card_get_stand.webp・card_get_light.webp（台座と光。同じ倍率で縮める）
  7 → ui/dungeon/pouch_N.webp（ふくらみ3段階）
  9 → ui/dungeon/menu_window.webp・menu_row.webp・menu_row_pressed.webp・menu_close.webp
  10 → ui/dungeon/menu_icon_<種類>.webp（deck・gained・losses・map・items・suspend）
  12・13 → ui/reward/clear_scene.webp・first_clear_seal.webp・first_clear_seal_small.webp
  18 → ui/dungeon/stairs_confirm.webp
  20 → backgrounds/deck_bg.webp
  23 → ui/frame/emblem_<種類>.webp（warn・ask・ok・ng）
  24 → ui/hud/btn_menu.webp・btn_menu_pressed.webp・btn_escape.webp・btn_escape_pressed.webp
  26 → ui/frame/empty_box.webp（手に入れたカードがない）・empty_shelf.webp（持っているもの・道具がない）
  27 → ui/settings/credits_top.webp・credits_paper.webp・credits_bottom.webp（巻物を上の軸・紙・下の軸に分ける。紙は縦につなげて敷く）
【まだ画面・機能がないもの：置くだけ】
  8・11・16・17・19・21・22・25 → ui/later/<原本の名前>.webp（シートのまま縮小。使うときに切り分ける）
  28・29・30（と追加書き出しのアイコン2枚）→ assets/store/（ストア用。原本の PNG をそのまま）
"""

import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / 'assets'
IMG = ROOT / 'images'


def snake(item_id: str) -> str:
    """道具 ID（guardianCharm）→ ファイル名の決まり（小文字と _）の guardian_charm"""
    return ''.join(f'_{c.lower()}' if c.isupper() else c for c in item_id)

ITEM_ORDER = ['returnFeather', 'incense', 'torch', 'smokeBall', 'ruinsMap', 'guardianCharm', 'sealBox', 'luckyCoin']
MARK_ORDER = ['incense', 'torch', 'guardianCharm', 'luckyCoin', 'sealed']
SMOKE_CUTS = [0, 350, 884, 1568, 2048]
CHARM_CUTS = [0, 470, 1070, 1536]
FX_WIDTH, FX_HEIGHT = 704, 512
MENU_ICONS = ['deck', 'gained', 'losses', 'map', 'items', 'suspend']
EMBLEMS = ['warn', 'ask', 'ok', 'ng']
LATER = ['card_lost', 'full_map_parts', 'splash_art', 'loading_mark', 'worldmap_locked', 'coin_burst', 'toast_plate', 'tutorial_pointer']
STORE = ['store_frame', 'feature_graphic_bg', 'adaptive_icon']


def save(img: Image.Image, rel: str) -> None:
    path = IMG / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, quality=88, method=6)


def trim(img: Image.Image, pad: int = 0) -> Image.Image:
    box = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if not box:
        return img
    return img.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(img.width, box[2] + pad), min(img.height, box[3] + pad)))


def square(img: Image.Image, size: int, pad: float = 0.0) -> Image.Image:
    part = trim(img)
    side = int(max(part.size) * (1 + pad * 2))
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.alpha_composite(part, ((side - part.width) // 2, (side - part.height) // 2))
    return sq.resize((size, size), Image.LANCZOS)


def by_height(img: Image.Image, height: int) -> Image.Image:
    return img.resize((round(img.width * height / img.height), height), Image.LANCZOS)


def by_width(img: Image.Image, width: int) -> Image.Image:
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


def cells(img: Image.Image, cols: int, rows: int = 1) -> list[Image.Image]:
    w, h = img.width // cols, img.height // rows
    return [img.crop((c * w, r * h, (c + 1) * w, (r + 1) * h)) for r in range(rows) for c in range(cols)]


def frames(img: Image.Image, cuts: list[int]) -> list[Image.Image]:
    out = []
    for left, right in zip(cuts, cuts[1:]):
        part = img.crop((left, 0, right, img.height))
        box = part.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        if box:
            part = part.crop((box[0], 0, box[2], img.height))
        canvas = Image.new('RGBA', (FX_WIDTH, FX_HEIGHT), (0, 0, 0, 0))
        canvas.alpha_composite(part, ((FX_WIDTH - part.width) // 2, 0))
        out.append(canvas)
    return out


def main(src: Path) -> None:
    png = src / 'PNG'
    o = lambda name: Image.open(png / f'{name}.png').convert('RGBA')  # noqa: E731

    # 道具
    for item_id, cell in zip(ITEM_ORDER, cells(o('dungeon_items'), 4, 2)):
        save(square(cell, 192, 0.04), f'ui/items/item_{snake(item_id)}.webp')
    parts = o('shop_item_parts')
    save(trim(parts.crop((0, 120, parts.width, 480))).resize((900, 179), Image.LANCZOS), 'ui/shop/menu_items.webp')
    save(square(parts.crop((1230, 560, parts.width, 900)), 96), 'ui/items/owned_tag.webp')
    for mark_id, cell in zip(MARK_ORDER, cells(o('item_status_marks'), 5)):
        save(square(cell, 96), f'ui/items/mark_{snake(mark_id)}.webp')
    for n, f in enumerate(frames(o('smoke_escape'), SMOKE_CUTS), 1):
        save(f, f'effects/fx_smoke_{n}.webp')
    for n, f in enumerate(frames(o('charm_break'), CHARM_CUTS), 1):
        save(f, f'effects/fx_charm_{n}.webp')

    # 1 暗闇の明かり（黒い背景のまま。加算で重ねる）
    for n, cell in enumerate(cells(o('dungeon_light').convert('RGB').convert('RGBA'), 3), 1):
        save(cell.convert('RGB').resize((512, 512), Image.LANCZOS), f'effects/drun_light_{n}.webp')
    # 2 気配のふち（白い背景のまま。乗算で重ねる）
    vignette = o('omen_vignette').convert('RGB').resize((585, 1266), Image.LANCZOS)
    save(vignette, 'ui/dungeon/omen_vignette.webp')
    # ダンジョン試作は画面のほとんどが真っ黒で、乗算の暗い霧は見えないので、霧を「透明度つきの明るめのこげ茶」にした版も作る
    # （白い所は透明、霧の濃い所ほど不透明。色は原本を 2.2 倍に明るくするだけ。金の筋も残る）
    import numpy as np
    v = np.asarray(vignette).astype(np.float32)
    lum = v.mean(axis=2, keepdims=True) / 255
    alpha = np.clip((1 - lum) ** 0.8 * 0.85, 0, 1) * 255
    fog = np.concatenate([np.clip(v * 2.2, 0, 255), alpha], axis=2).astype(np.uint8)
    save(Image.fromarray(fog, 'RGBA'), 'ui/dungeon/omen_fog.webp')
    # 3・4 床と壁
    for floor, name in ((2, 'ruins_b2_tiles'), (3, 'ruins_b3_tiles')):
        for kind, cell in zip(('floor', 'wall_top', 'wall_face'), cells(o(name), 3)):
            save(cell.convert('RGB'), f'maps/dungeon/ruins_b{floor}_{kind}.webp')
    # 5 去るときの光
    for n, cell in enumerate(cells(o('leave_fx'), 3), 1):
        save(cell.resize((256, 256), Image.LANCZOS), f'effects/fx_leave_{n}.webp')
    # 6 台座と光（同じ倍率）
    get = o('card_get')
    stand = trim(get.crop((0, 0, 780, get.height)))
    save(stand.resize((stand.width // 2, stand.height // 2), Image.LANCZOS), 'ui/reward/card_get_stand.webp')
    light = trim(get.crop((780, 0, get.width, get.height)))
    save(light.resize((light.width // 2, light.height // 2), Image.LANCZOS), 'ui/reward/card_get_light.webp')
    # 7 革袋
    for n, cell in enumerate(cells(o('gain_pouch'), 3), 1):
        save(by_height(trim(cell), 96), f'ui/dungeon/pouch_{n}.webp')
    # 9 メニューの窓
    win = o('drun_menu_window')
    save(by_width(trim(win.crop((0, 40, 790, 1000))), 390), 'ui/dungeon/menu_window.webp')
    save(by_width(trim(win.crop((782, 120, 1520, 300))), 360), 'ui/dungeon/menu_row.webp')
    save(by_width(trim(win.crop((782, 304, 1520, 490))), 360), 'ui/dungeon/menu_row_pressed.webp')
    save(square(win.crop((1370, 820, 1530, 990)), 64), 'ui/dungeon/menu_close.webp')
    # 10 メニューのアイコン
    for kind, cell in zip(MENU_ICONS, cells(o('drun_menu_icons'), 3, 2)):
        save(square(cell, 128), f'ui/dungeon/menu_icon_{kind}.webp')
    # 12・13 クリア報酬
    save(o('clear_reward_scene').convert('RGB').resize((585, 1266), Image.LANCZOS), 'ui/reward/clear_scene.webp')
    seal = o('first_clear_seal')
    save(by_width(trim(seal.crop((0, 0, 940, seal.height))), 256), 'ui/reward/first_clear_seal.webp')
    save(by_width(trim(seal.crop((940, 0, seal.width, seal.height))), 96), 'ui/reward/first_clear_seal_small.webp')
    # 18 階段の挿絵
    save(o('stairs_confirm').resize((512, 320), Image.LANCZOS), 'ui/dungeon/stairs_confirm.webp')
    # 20 デッキ編集の背景
    save(o('deck_bg').convert('RGB').resize((585, 1266), Image.LANCZOS), 'backgrounds/deck_bg.webp')
    # 23 確認の窓の紋章
    for kind, cell in zip(EMBLEMS, cells(o('dialog_emblems'), 4)):
        save(square(cell, 128), f'ui/frame/emblem_{kind}.webp')
    # 24 上の小さなボタン（左上＝メニュー、右上＝メニュー押した、左下＝脱出、右下＝脱出押した）
    btn = o('hud_top_buttons')
    for name, box in (('btn_menu', (0, 180, 768, 512)), ('btn_menu_pressed', (768, 180, 1536, 512)), ('btn_escape', (0, 512, 768, 840)), ('btn_escape_pressed', (768, 512, 1536, 840))):
        save(by_width(trim(btn.crop(box)), 240), f'ui/hud/{name}.webp')
    # 26 何もないとき
    empty = o('empty_states')
    save(by_height(trim(empty.crop((0, 0, 736, empty.height))), 240), 'ui/frame/empty_box.webp')
    save(by_height(trim(empty.crop((736, 0, empty.width, empty.height))), 240), 'ui/frame/empty_shelf.webp')
    # 27 クレジットの巻物（上の軸・紙・下の軸）
    scroll = o('credits_scroll').convert('RGB')
    w, h = scroll.size
    for name, (top, bottom) in (('credits_top', (0, 0.118)), ('credits_paper', (0.45, 0.55)), ('credits_bottom', (0.872, 1.0))):
        save(by_width(scroll.crop((0, round(h * top), w, round(h * bottom))), 585), f'ui/settings/{name}.webp')

    # 置くだけ
    for name in LATER:
        img = o(name)
        save(img.resize((img.width // 2, img.height // 2), Image.LANCZOS), f'ui/later/{name}.webp')
    store = ROOT / 'store'
    store.mkdir(parents=True, exist_ok=True)
    for name in STORE:
        shutil.copyfile(png / f'{name}.png', store / f'{name}.png')
    for extra in sorted((src / '追加書き出し').glob('*.png')):
        shutil.copyfile(extra, store / extra.name)


if __name__ == '__main__':
    main(Path(sys.argv[1]))
