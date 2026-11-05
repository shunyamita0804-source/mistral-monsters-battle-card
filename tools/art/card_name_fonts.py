"""モンスターカードの名前の字体（2026-11-05 指示書 AY【4】）を、使う文字だけに減らして WOFF2 にする。
入力フォルダに Google Fonts の TTF（下の SOURCES の名前）を置いて動かす（TTF はリポジトリに入れない。出どころは SOURCES の URL）。
python3 -I tools/art/card_name_fonts.py 入力フォルダ assets/fonts/card-name
- 日本語の字体：カタカナ全部（ァ〜ヶ・ヴ）・ー・・・仮・数字・ラテン文字（英語名の予備）
- 英語の字体：ラテン文字（A〜Z・a〜z）・数字・空白と - ' . &
どれも SIL Open Font License 1.1（Permanent Marker は Apache License 2.0）。ライセンスの文は同じフォルダの license_*.txt
"""
import sys
from pathlib import Path

from fontTools import subset

SOURCES = {
    # 名前: (TTF のファイル名, 出どころ, ライセンス, 日本語か)
    'reggae-one': ('ReggaeOne.ttf', 'https://fonts.google.com/specimen/Reggae+One', 'OFL-1.1', True),
    'dela-gothic-one': ('DelaGothicOne.ttf', 'https://fonts.google.com/specimen/Dela+Gothic+One', 'OFL-1.1', True),
    'yuji-boku': ('YujiBoku.ttf', 'https://fonts.google.com/specimen/Yuji+Boku', 'OFL-1.1', True),
    'bangers': ('Bangers.ttf', 'https://fonts.google.com/specimen/Bangers', 'OFL-1.1', False),
    'bungee': ('Bungee.ttf', 'https://fonts.google.com/specimen/Bungee', 'OFL-1.1', False),
    'permanent-marker': ('PermanentMarker.ttf', 'https://fonts.google.com/specimen/Permanent+Marker', 'Apache-2.0', False),
}

LATIN = ''.join(chr(c) for c in range(0x20, 0x7F))
KATAKANA = ''.join(chr(c) for c in range(0x30A1, 0x30F7)) + 'ー・仮'


def main(src: Path, dst: Path) -> None:
    dst.mkdir(parents=True, exist_ok=True)
    for name, (ttf, _url, _lic, ja) in SOURCES.items():
        text = (KATAKANA + LATIN) if ja else LATIN
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.notdef_outline = True
        font = subset.load_font(str(src / ttf), opts)
        sub = subset.Subsetter(opts)
        sub.populate(text=text)
        sub.subset(font)
        out = dst / f'{name}.woff2'
        subset.save_font(font, str(out), opts)
        print(name, (src / ttf).stat().st_size, '->', out.stat().st_size)


if __name__ == '__main__':
    main(Path(sys.argv[1]), Path(sys.argv[2]))
