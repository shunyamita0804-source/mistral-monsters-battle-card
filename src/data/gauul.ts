import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import gaul14 from './official/gaul14_skills_OFFICIAL_20261026.json';
import themeColors from './official/monster_theme_colors.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * 【正式データ】ガウルの技カード14種（2026-10-26 ユーザー確定。Gaul_Implementation_Ver2_Claude「ガウル全14技・最終実装パック」）。
 *
 * 正本は届いた 02_SKILL_DATA/Gaul_14Skills_UTF8.json（無改変で src/data/official/gaul14_skills_OFFICIAL_20261026.json に置いた。
 * CSV も同じフォルダに無改変）。ZIP の中身はすべて design-parts/cards-original/gaul14-20261026/ に無改変で保管。
 * 技名・分類・マナ・ダメージ・効果の文は、ここで書き換えずに JSON からそのまま読む（tests/gauul.test.ts で CSV とも照合）。
 *
 * ゲーム内 ID：skl-gauul14-01〜14（JSON の id gaul_skill_01〜14 はデザイン ID として持つ）。モンスターは mon-gauul のまま。
 * 旧16技（skl-gauul-01〜16。2026-10-24）とは番号を流用しない。旧16技はゲームから外し、古いセーブからも外す（saveData.ts の version 10）
 * 絵：gau14_sk_01〜14.png（届いた 827×937 の PNG を1バイトも変えずに置いた。名前だけ素材の命名規則に合わせた）
 * 枠：技カード新UI（v5）のガウルの色（オレンジ。monster_theme_colors.json の gauul）
 *
 * 初期配布16枚（2026-10-26 ユーザー正式確定。2026-10-27 の検収で指示）：届いた JSON の starter_copies は null のままなので
 *   （JSON は無改変）、枚数はこのファイルの INITIAL_COPIES に持つ（ノビトンと同じ）。新しく始めたときの所持カードに入れる
 *   （初期デッキ60枚には入れない・モンスターカード本体は配らない・いまのセーブには配らない）。0枚の技は収集用（後から手に入る）
 *
 * まだ決まっていないこと（独断で決めない）：レアリティ・正式英語・パック・相手の編成
 */
export const GAUUL_MONSTER_ID = 'mon-gauul';
export const gauulSkillId = (no: number): string => `skl-gauul14-${twoDigits(no)}`;

/** 旧16技のゲーム内 ID（2026-10-26 に新しい14技へ置き換え。古いセーブから外すのに使う） */
export const GAUUL_OLD_SKILL_IDS: readonly string[] = Array.from({ length: 16 }, (_, i) => `skl-gauul-${twoDigits(i + 1)}`);

/** ガウルのモンスターカード。ライフ 6 は正式カードの絵に書かれた値（2026-10-24 の正式データと同じ）・内部ランク C（画面に出さない） */
export const GAUUL_MONSTER: MonsterCard = {
  kind: 'monster',
  id: GAUUL_MONSTER_ID,
  name: 'ガウル',
  rarity: null,
  life: 6,
  themeColor: themeColors.monsters.gauul.hex,
  description: 'ガウル。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'gauul_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'gauul_battle.webp', layout: 'full' },
  pendingSpec: ['rarity'],
};

/** 届いた JSON の1行 */
export interface Gaul14Row {
  readonly id: string;
  readonly number: number;
  readonly monster: string;
  readonly name: string;
  readonly category: string;
  readonly mana: number;
  readonly damage: number | null;
  readonly effect: string;
  readonly image: string;
  /** 届いた JSON では null（初期配布の枚数は INITIAL_COPIES） */
  readonly starter_copies: number | null;
  readonly sha256: string;
}

export const GAUL14_ROWS: readonly Gaul14Row[] = gaul14;

/**
 * 初期配布16枚（2026-10-26 ユーザー正式確定。正式の番号 → 枚数。0枚の技は書かない）。
 * 01・06 が3枚、02・07・10 が2枚、03・11・12・13 が1枚（04・05・08・09・14 は0枚）
 */
const INITIAL_COPIES: Readonly<Record<number, number>> = { 1: 3, 2: 2, 3: 1, 6: 3, 7: 2, 10: 2, 11: 1, 12: 1, 13: 1 };

/** JSON の分類 → ゲームの種別 */
const CATEGORY: Readonly<Record<string, string>> = { strength: 'force', intelligence: 'wisdom', special: 'special', defense: 'defense', dodge: 'evade' };

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す）。
 * - 09 聖なる炎「回避されない」：どの回避でも避けられない（条件の合う回避でも不可）。防御は使える（いままでの「回避されない」と同じ）
 * - 10 威嚇「相手モンスター1体は、次の攻撃を行えない」：ソラモのすなかけと同じ動き（選んだ1体は、持ち主の次の手番に攻撃の技を使えない）
 * - 11 翼の盾：ちから技−3。12 炎の壁：ちから技・かしこさ技−3（0未満にならない）
 * - 13 上に飛ぶ：攻撃カードの必要マナが2以上のちから・かしこさ技を回避。14 高速飛行：ちから・かしこさ技を回避（条件なし）
 */
const SPECIAL_EFFECTS: Readonly<Record<string, SkillEffect>> = {
  gaul_skill_09: { type: 'attack', undodgeable: true },
  gaul_skill_10: { type: 'seal' },
  gaul_skill_11: { type: 'defense', reduce: 3, against: 'force' },
  gaul_skill_12: { type: 'defense', reduce: 3, against: 'all' },
  gaul_skill_13: { type: 'evade', against: 'all', minCost: 2 },
  gaul_skill_14: { type: 'evade', against: 'all' },
};

function toOfficial(row: Gaul14Row): OfficialSkill {
  const category = CATEGORY[row.category];
  if (!category) throw new Error(`ガウルの技の分類が不明です: ${row.id} ${row.category}`);
  return {
    design_id: row.id,
    number: row.number,
    name_ja: row.name,
    mana: row.mana,
    damage: row.damage,
    category,
    effect_text_ja: row.effect === '' ? null : row.effect,
    availability: (INITIAL_COPIES[row.number] ?? 0) > 0 ? 'initial' : 'collect',
  };
}

/** 技の絵のファイル名（assets/images/cards/skills/）。JSON の image（01_SKILL_IMAGES/Gaul_Skill_NN.png）の番号どおり */
export function gaulArtFile(row: Gaul14Row): string {
  const no = /Gaul_Skill_(\d{2})\.png$/.exec(row.image)?.[1];
  if (!no || Number(no) !== row.number) throw new Error(`ガウルの技の絵の番号が合いません: ${row.id} ${row.image}`);
  return `gau14_sk_${no}.png`;
}

export const GAUUL_SKILLS: readonly SkillCard[] = GAUL14_ROWS.map((row) =>
  officialSkill(toOfficial(row), {
    label: 'ガウル',
    monsterId: GAUUL_MONSTER_ID,
    skillId: gauulSkillId,
    artFile: () => gaulArtFile(row),
    specialEffects: SPECIAL_EFFECTS,
  }),
);

/** 初期配布16枚（技の ID と枚数。0枚の技は入れない） */
export const GAUUL_STARTER: readonly { readonly id: string; readonly copies: number }[] = GAUL14_ROWS.filter(
  (r) => (INITIAL_COPIES[r.number] ?? 0) > 0,
).map((r) => ({ id: gauulSkillId(r.number), copies: INITIAL_COPIES[r.number] as number }));
