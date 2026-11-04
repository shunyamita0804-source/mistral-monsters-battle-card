"""指示書 AX（2026-11-05）：イベント第2弾の小挿絵7枚・説明の絵4枚・シエナの会話の絵4枚を WebP にする（描き換えなし。縮小と WebP だけ）。

原本（無改変）：
- design-parts/ax-events-20261105/small/event_small_ev2_*.png（1200×700）→ assets/images/backgrounds/event_ev2_*.webp（780×455）
- design-parts/ax-events-20261105/tutorial/tutorial_*.png（1024×1024）→ assets/images/backgrounds/tutorial_*.webp（600×600）
- design-parts/talk-portraits-20261030/talk_sienna_{smile,happy,normal,worried}.png（561×701）→ assets/images/characters/talk_sienna_*.webp（同じ大きさ）

使い方: python3 -I tools/art/ax_event_pictures.py
"""
import glob
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def save(src: str, dst: str, width: int | None) -> None:
    im = Image.open(src)
    im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
    if width and im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=88, method=6)
    print(os.path.relpath(dst, ROOT), im.size, os.path.getsize(dst))


def main() -> None:
    parts = os.path.join(ROOT, 'design-parts', 'ax-events-20261105')
    bg = os.path.join(ROOT, 'assets', 'images', 'backgrounds')
    ch = os.path.join(ROOT, 'assets', 'images', 'characters')
    for f in sorted(glob.glob(os.path.join(parts, 'small', 'event_small_ev2_*.png'))):
        name = os.path.basename(f).replace('event_small_ev2_', 'event_ev2_').replace('.png', '.webp')
        save(f, os.path.join(bg, name), 780)
    for f in sorted(glob.glob(os.path.join(parts, 'tutorial', 'tutorial_*.png'))):
        save(f, os.path.join(bg, os.path.basename(f).replace('.png', '.webp')), 600)
    for face in ('smile', 'happy', 'normal', 'worried'):
        f = os.path.join(ROOT, 'design-parts', 'talk-portraits-20261030', f'talk_sienna_{face}.png')
        save(f, os.path.join(ch, f'talk_sienna_{face}.webp'), None)


if __name__ == '__main__':
    main()
