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
/** 原本の中の字の部分（左・上・高さ。指示書 AZ） */
export const LOGO_GLYPH = { left: 40, top: 55, height: 170 } as const;
export const CARD_NAME_LOGOS: Readonly<Record<string, CardNameLogo>> = {
  'mon-desuoru': { file: 'name_ja_desuoru.webp', x: 31, y: 48, w: 675, h: 189, frame: '#405586' },
  'mon-flune': { file: 'name_ja_flune.webp', x: 31, y: 47, w: 775, h: 191, frame: '#C4DB7C' },
  'mon-forn': { file: 'name_ja_forn.webp', x: 31, y: 48, w: 666, h: 189, frame: '#AAAA57' },
  'mon-gauul': { file: 'name_ja_gauul.webp', x: 31, y: 48, w: 545, h: 189, frame: '#F37544' },
  'mon-gearos': { file: 'name_ja_gearos.webp', x: 31, y: 48, w: 692, h: 189, frame: '#974D3C' },
  'mon-geol': { file: 'name_ja_geol.webp', x: 32, y: 48, w: 579, h: 190, frame: '#E3C4A2' },
  'mon-hakuran': { file: 'name_ja_hakuran.webp', x: 32, y: 48, w: 753, h: 189, frame: '#23818C' },
  'mon-hyouzuku': { file: 'name_ja_hyouzuku.webp', x: 32, y: 48, w: 730, h: 189, frame: '#D3D3D7' },
  'mon-kalshell': { file: 'name_ja_kalshell.webp', x: 32, y: 48, w: 908, h: 189, frame: '#D0E7ED' },
  'mon-lazuck': { file: 'name_ja_lazuck.webp', x: 31, y: 48, w: 583, h: 189, frame: '#8D65D6' },
  'mon-lilil': { file: 'name_ja_lilil.webp', x: 32, y: 48, w: 511, h: 189, frame: '#F3B3D2' },
  'mon-myurol': { file: 'name_ja_myurol.webp', x: 31, y: 47, w: 699, h: 190, frame: '#B8F1F6' },
  'mon-nobiton': { file: 'name_ja_nobiton.webp', x: 32, y: 48, w: 686, h: 189, frame: '#FBCC57' },
  'mon-pukarim': { file: 'name_ja_pukarim.webp', x: 32, y: 48, w: 648, h: 190, frame: '#B7E5D3' },
  'mon-serephine': { file: 'name_ja_serephine.webp', x: 31, y: 48, w: 962, h: 190, frame: '#B1C1F2' },
  'mon-shishien': { file: 'name_ja_shishien.webp', x: 30, y: 47, w: 864, h: 190, frame: '#666766' },
  'mon-soramo': { file: 'name_ja_soramo.webp', x: 31, y: 48, w: 532, h: 189, frame: '#FACC79' },
  'mon-tsumuji': { file: 'name_ja_tsumuji.webp', x: 32, y: 48, w: 558, h: 189, frame: '#95AFC6' },
  'mon-tyrant': { file: 'name_ja_tyrant.webp', x: 31, y: 48, w: 795, h: 189, frame: '#A31523' },
  'mon-uzurio': { file: 'name_ja_uzurio.webp', x: 32, y: 48, w: 652, h: 189, frame: '#5AC2F3' },
};
