// 自動で作った表（tools/art/card_name_logos.py）。手で直さない
/** 名前のロゴ（原本 1400×300 から絵のある所を切り抜いた位置と大きさ・原本の px）と、そのカードの枠の色（スウッシュを染める色） */
export interface CardNameLogo {
  readonly file: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly frame: string;
}
/** 原本の中の字の部分（左・上・高さ。日本語は指示書 AZ、英語は指示書 BC：字の上 48px） */
export const LOGO_GLYPH = { left: 40, top: 55, height: 170 } as const;
export const LOGO_GLYPH_EN = { left: 40, top: 48, height: 170 } as const;
export const CARD_NAME_LOGOS: Readonly<Record<string, CardNameLogo>> = {
  'mon-beniou': { file: 'name_ja_beniou.webp', x: 35, y: 50, w: 563, h: 180, frame: '#6B1E3A' },
  'mon-desuoru': { file: 'name_ja_desuoru.webp', x: 31, y: 48, w: 675, h: 189, frame: '#405586' },
  'mon-flune': { file: 'name_ja_flune.webp', x: 31, y: 47, w: 775, h: 191, frame: '#C4DB7C' },
  'mon-forn': { file: 'name_ja_forn.webp', x: 31, y: 48, w: 666, h: 189, frame: '#AAAA57' },
  'mon-gauul': { file: 'name_ja_gauul.webp', x: 31, y: 48, w: 545, h: 189, frame: '#F37544' },
  'mon-gearos': { file: 'name_ja_gearos.webp', x: 31, y: 48, w: 692, h: 189, frame: '#974D3C' },
  'mon-geol': { file: 'name_ja_geol.webp', x: 32, y: 48, w: 579, h: 190, frame: '#E3C4A2' },
  'mon-hakuran': { file: 'name_ja_hakuran.webp', x: 32, y: 48, w: 753, h: 189, frame: '#23818C' },
  'mon-huginn': { file: 'name_ja_huginn.webp', x: 35, y: 51, w: 415, h: 179, frame: '#1E6B45' },
  'mon-hyouzuku': { file: 'name_ja_hyouzuku.webp', x: 32, y: 48, w: 730, h: 189, frame: '#D3D3D7' },
  'mon-kalshell': { file: 'name_ja_kalshell.webp', x: 32, y: 48, w: 908, h: 189, frame: '#D0E7ED' },
  'mon-kuroshio': { file: 'name_ja_kuroshio.webp', x: 36, y: 51, w: 635, h: 179, frame: '#F08A78' },
  'mon-kuyo': { file: 'name_ja_kuyo.webp', x: 34, y: 50, w: 470, h: 184, frame: '#87649C' },
  'mon-lazuck': { file: 'name_ja_lazuck.webp', x: 31, y: 48, w: 583, h: 189, frame: '#8D65D6' },
  'mon-lilil': { file: 'name_ja_lilil.webp', x: 32, y: 48, w: 511, h: 189, frame: '#F3B3D2' },
  'mon-myurol': { file: 'name_ja_myurol.webp', x: 31, y: 47, w: 699, h: 190, frame: '#B8F1F6' },
  'mon-nobiton': { file: 'name_ja_nobiton.webp', x: 32, y: 48, w: 686, h: 189, frame: '#FBCC57' },
  'mon-nous': { file: 'name_ja_nous.webp', x: 35, y: 50, w: 452, h: 179, frame: '#CC6A1F' },
  'mon-pukarim': { file: 'name_ja_pukarim.webp', x: 32, y: 48, w: 648, h: 190, frame: '#B7E5D3' },
  'mon-radiel': { file: 'name_ja_radiel.webp', x: 35, y: 50, w: 708, h: 194, frame: '#BE7410' },
  'mon-rouga': { file: 'name_ja_rouga.webp', x: 35, y: 50, w: 481, h: 179, frame: '#B7A3DA' },
  'mon-serephine': { file: 'name_ja_serephine.webp', x: 31, y: 48, w: 962, h: 190, frame: '#B1C1F2' },
  'mon-shishien': { file: 'name_ja_shishien.webp', x: 30, y: 47, w: 864, h: 190, frame: '#666766' },
  'mon-soramo': { file: 'name_ja_soramo.webp', x: 31, y: 48, w: 532, h: 189, frame: '#FACC79' },
  'mon-tsumuji': { file: 'name_ja_tsumuji.webp', x: 32, y: 48, w: 558, h: 189, frame: '#95AFC6' },
  'mon-tyrant': { file: 'name_ja_tyrant.webp', x: 31, y: 48, w: 795, h: 189, frame: '#A31523' },
  'mon-uzurio': { file: 'name_ja_uzurio.webp', x: 32, y: 48, w: 652, h: 189, frame: '#5AC2F3' },
};
export const CARD_NAME_LOGOS_EN: Readonly<Record<string, CardNameLogo>> = {
  'mon-beniou': { file: 'name_en_beniou.webp', x: 36, y: 50, w: 519, h: 166, frame: '#6B1E3A' },
  'mon-desuoru': { file: 'name_en_desuoru.webp', x: 32, y: 47, w: 596, h: 175, frame: '#405586' },
  'mon-flune': { file: 'name_en_flune.webp', x: 31, y: 48, w: 588, h: 175, frame: '#C4DB7C' },
  'mon-forn': { file: 'name_en_forn.webp', x: 31, y: 48, w: 468, h: 177, frame: '#AAAA57' },
  'mon-gauul': { file: 'name_en_gauul.webp', x: 32, y: 47, w: 666, h: 213, frame: '#F37544' },
  'mon-gearos': { file: 'name_en_gearos.webp', x: 30, y: 47, w: 614, h: 177, frame: '#974D3C' },
  'mon-geol': { file: 'name_en_geol.webp', x: 31, y: 47, w: 415, h: 175, frame: '#E3C4A2' },
  'mon-hakuran': { file: 'name_en_hakuran.webp', x: 32, y: 47, w: 769, h: 177, frame: '#23818C' },
  'mon-huginn': { file: 'name_en_huginn.webp', x: 35, y: 50, w: 472, h: 165, frame: '#1E6B45' },
  'mon-hyouzuku': { file: 'name_en_hyouzuku.webp', x: 31, y: 48, w: 849, h: 217, frame: '#D3D3D7' },
  'mon-kalshell': { file: 'name_en_kalshell.webp', x: 32, y: 47, w: 734, h: 174, frame: '#D0E7ED' },
  'mon-kuroshio': { file: 'name_en_kuroshio.webp', x: 35, y: 50, w: 717, h: 166, frame: '#F08A78' },
  'mon-kuyo': { file: 'name_en_kuyo.webp', x: 35, y: 49, w: 460, h: 214, frame: '#87649C' },
  'mon-lazuck': { file: 'name_en_lazuck.webp', x: 32, y: 47, w: 665, h: 177, frame: '#8D65D6' },
  'mon-lilil': { file: 'name_en_lilil.webp', x: 32, y: 48, w: 431, h: 173, frame: '#F3B3D2' },
  'mon-myurol': { file: 'name_en_myurol.webp', x: 32, y: 48, w: 678, h: 226, frame: '#B8F1F6' },
  'mon-nobiton': { file: 'name_en_nobiton.webp', x: 32, y: 48, w: 689, h: 174, frame: '#FBCC57' },
  'mon-nous': { file: 'name_en_nous.webp', x: 36, y: 50, w: 435, h: 166, frame: '#CC6A1F' },
  'mon-pukarim': { file: 'name_en_pukarim.webp', x: 32, y: 48, w: 778, h: 180, frame: '#B7E5D3' },
  'mon-radiel': { file: 'name_en_radiel.webp', x: 34, y: 50, w: 545, h: 167, frame: '#BE7410' },
  'mon-rouga': { file: 'name_en_rouga.webp', x: 36, y: 51, w: 437, h: 163, frame: '#B7A3DA' },
  'mon-serephine': { file: 'name_en_serephine.webp', x: 31, y: 47, w: 836, h: 220, frame: '#B1C1F2' },
  'mon-shishien': { file: 'name_en_shishien.webp', x: 31, y: 47, w: 707, h: 176, frame: '#666766' },
  'mon-soramo': { file: 'name_en_soramo.webp', x: 32, y: 48, w: 679, h: 174, frame: '#FACC79' },
  'mon-tsumuji': { file: 'name_en_tsumuji.webp', x: 31, y: 48, w: 724, h: 219, frame: '#95AFC6' },
  'mon-tyrant': { file: 'name_en_tyrant.webp', x: 31, y: 48, w: 814, h: 221, frame: '#A31523' },
  'mon-uzurio': { file: 'name_en_uzurio.webp', x: 30, y: 48, w: 641, h: 175, frame: '#5AC2F3' },
};
