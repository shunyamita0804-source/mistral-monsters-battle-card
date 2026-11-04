import type { MonsterCard } from '../game/cards/cardTypes.ts';

/**
 * ギアロス（2026-11-05 指示書 AX【3】）。機械の塔の切り札。人工の機械に意思が宿った、浮いている単眼のモンスター。
 * LIFE 8・**内部ランク A**（画面に出さない）・居場所は空中（src/data/skillRebuildAJ.ts の MONSTER_HABITAT）。
 * 技12枚は届いた gearos_skills.csv のとおり（src/data/official/gearos_skills_20261105.csv に無改変。表は skillRebuildAJ.ts の AJ_SKILLS['mon-gearos']。
 * tests/gearos.test.ts で CSV と照らし合わせる）。レア＝01 ロックオンビーム・06 オーバードライブβ・07 オーバードライブγ・11 高速機動（進行の案。CSV の ○ と同じ）。
 * 新しい効果：オーバードライブの3枚コンボ（α・β・γ）・08 システムチェンジ・09 システムチェック。11 高速機動は今の「消費マナ2以上を回避」。
 * 決まりは docs/battle-rules.md「ギアロスの効果の扱い」
 *
 * 入手：機械の塔の守り手テオの切り札（enc-machine-boss の ace。初回クリアで祭壇から）・ガチャのシリーズ（モンスターカードを初めて手に入れたら並ぶ）。最初の箱には入れない。
 * 機械の塔は今「仮」（中身は作っていない）。テオとの対戦は確かめ用の画面（?qa=1&lab=gearos）から
 *
 * 絵（原本は design-parts/cards-original/gearos/ に無改変）：
 * - 技 gearos_sk_01〜12.webp（届いた 827×937 の PNG を tools/art/card_art_webp.py で WebP に）
 * - 正式モンスターカード gearos_official.webp（gearos_official_monstercard_LIFE8.png〔970×1622〕を 508×849 に）
 * - バトル用 gearos_battlecard.png（gearos_battle_transparent.png〔800×920〕の透明度を tools/art/alpha_binarize.py で 0／255 に。ふちの半透明だけ残す）
 * - パックの窓の絵 gearos_pack_window_art.png（パック pack_gearos.webp・販売機の窓 panel_gearos.webp・ショップの棚の商品）
 * 色：赤銅 #945247（ユーザー決定：今の絵の枠の色のまま。バトル用カードの枠・技カードの枠・パックの色の表）
 */
export const GEAROS_MONSTER_ID = 'mon-gearos';
export const GEAROS_COLOR = '#945247';

export const GEAROS_MONSTER: MonsterCard = {
  kind: 'monster',
  id: GEAROS_MONSTER_ID,
  name: 'ギアロス',
  rarity: null,
  life: 8,
  themeColor: GEAROS_COLOR,
  description: '意思を宿した、浮かぶ機械の番人。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'gearos_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'gearos_battlecard.png', layout: 'full' },
};

export const gearosSkillId = (no: number): string => `skl-gearos-${String(no).padStart(2, '0')}`;

/** オーバードライブ α・β・γ（3枚そろうとコンボ）の ID */
export const OVERDRIVE_IDS: readonly string[] = [gearosSkillId(5), gearosSkillId(6), gearosSkillId(7)];

/**
 * 3枚コンボの攻撃を表すカード（台帳 cardCatalog にだけ入れる。一覧・図鑑・デッキ・ガチャには出ない。持てない）。
 * 使った記録・大きく見せる絵・守りの判定（攻撃の印・必要マナ）に使う。マナ5・かしこさ・相手全員に8。α・β・γ の「回避されない」などは付かない
 */
export const OVERDRIVE_COMBO_ID = 'skl-gearos-od';
/** 3枚コンボを選んだときの useCard の choice（α・β・γ のどれかの uid と一緒に送る） */
export const OVERDRIVE_CHOICE = 'overdrive';
export const OVERDRIVE_COMBO_COST = 5;
export const OVERDRIVE_COMBO_DAMAGE = 8;
