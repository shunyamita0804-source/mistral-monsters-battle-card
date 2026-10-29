import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import geolData from './official/geol14_skills_DRAFT_20261029.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * ジオル（新モンスター制作の手順 4・G4 の試遊のあと、2026-10-29 の手順 8「ジオルの最終」でふつうの一覧へ。指示書 design-parts/cards-original/geol/00_instructions_for_claude_code.txt）。
 * 正本は src/data/official/geol14_skills_DRAFT_20261029.json（届いた JSON を無改変。同じ内容の CSV も無改変で並べて置く）。
 * 数字はユーザー確定「届いている JSON の数字のまま」：技名・分類・マナ・ダメージ・ライフ（9）は JSON からそのまま読む（tests/geol.test.ts で CSV とも照らし合わせる）。
 * 効果の文も JSON のまま。ただし画面に出す文は、ユーザー指示の短い文がある技はそちら（src/data/skillCardText.ts。2026-10-29 に GEOL_CARD_TEXT からまとめた）。
 * ルールの細かい決まりは docs/battle-rules.md「ジオル」と、ルールの画面の説明のまま
 *
 * ふつうに遊ぶ人に出す：cards.ts の MONSTERS・SKILLS（図鑑・デッキ編集・敵の編成）。確認用の画面「ジオルの試遊」（?qa=1）は残す。
 * 入手：太古の遺跡（C ランクで開く）のボスのグラントに初めて勝つと、最奥の祭壇でジオルのモンスターカード。2回目からはジオルの技カード1枚（src/data/dungeons.ts の trumpReward）。
 * 仮ジオル（tmp-geol）はゲームから外した（セーブ version 23 で mon-geol に置きかえ）
 *
 * ゲーム内 ID：mon-geol（ライフ9・内部ランク B〔B の下の方〕。2026-10-29 ユーザー指示で C から B に。JSON の monster_rank は C のまま。画面には出さない）、skl-geol-01〜14（JSON の no）
 * 絵（原本は design-parts/cards-original/geol/ に無改変）：
 * - 技 geol_sk_01〜14.webp（届いた geol_sk_NN.png を tools/art/card_art_webp.py で幅 827 の WebP に。番号＝技番号）
 * - 正式モンスターカード geol_official.webp（届いた geol_official_monstercard_LIFE9.png を幅 508 に縮めただけ。プカリムと同じ）
 * - バトル用 geol_battlecard.png（届いた geol_battleart.png を無改変。1169×1345）
 * 色：岩の茶 #9A7B5C（モンスターカード枠・技カード枠とも）
 * ガチャのレアの枠（JSON の gacha_slot）：3 ナックル・5 地ひびき・10 エネルギーをためる・14 うけとめる（GEOL_GACHA_RARE）
 */
export const GEOL_MONSTER_ID = 'mon-geol';
export const geolSkillId = (no: number): string => `skl-geol-${twoDigits(no)}`;

/** ジオルの色（JSON の frame_color_hex） */
export const GEOL_COLOR: string = geolData.frame_color_hex;

export const GEOL_MONSTER: MonsterCard = {
  kind: 'monster',
  id: GEOL_MONSTER_ID,
  name: geolData.monster,
  rarity: null,
  life: geolData.life,
  themeColor: GEOL_COLOR,
  description: 'ジオル。',
  isPlaceholder: false,
  // 図鑑・ショップなどのカード：名前と LIFE 入りの正式モンスターカード（プカリムと同じ使い方）
  art: { category: 'monsterCards', file: 'geol_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'geol_battlecard.png', layout: 'full' },
};

export interface GeolRow {
  readonly no: number;
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly mana: number;
  readonly damage: string;
  readonly effect: string;
  readonly gacha_slot: string;
  readonly art: string;
}

export const GEOL_ROWS: readonly GeolRow[] = geolData.skills;

const CATEGORY: Readonly<Record<string, string>> = { ちから技: 'force', かしこさ技: 'wisdom', 特殊: 'special', 防御: 'defense', 回避: 'evade' };

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す。キーは JSON の no）。
 * - 02 いわくだき「防御されない」：今の unblockable（回避はできる）
 * - 05 地ひびき「相手全体に。防御・回避は1体ずつ」：生きている相手全員に（allTargets）。守りは1体ずつ順に
 * - 09 じならし：指定した相手1体は、このターンに受ける次の攻撃1回を回避できない（pin）
 * - 10 エネルギーをためる：次の自分のターンにジオルが最初に使うかしこさ技のダメージ2倍（energy）
 * - 11 かばう：ジオル以外の味方が狙われたとき、ジオルが代わりに受ける（cover。守りの手番に使う）
 * - 12・13 防御：ちから技−3／かしこさ技−3
 * - 14 うけとめる：ちから技のダメージを0にする防御（nullify。回避ではないので「回避されない」攻撃にも使える）
 * 細かい裁定は docs/battle-rules.md「ジオル」
 */
const SPECIAL_EFFECTS: Readonly<Record<number, SkillEffect>> = {
  2: { type: 'attack', unblockable: true },
  5: { type: 'attack', allTargets: true },
  9: { type: 'pin' },
  10: { type: 'energy' },
  11: { type: 'cover' },
  12: { type: 'defense', reduce: 3, against: 'force' },
  13: { type: 'defense', reduce: 3, against: 'wisdom' },
  14: { type: 'defense', against: 'force', nullify: true },
};

/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const geolArtFile = (no: number): string => `geol_sk_${twoDigits(no)}.webp`;

function toSkill(row: GeolRow): SkillCard {
  const category = CATEGORY[row.category];
  if (!category) throw new Error(`ジオルの技の分類が不明です: ${row.no} ${row.category}`);
  if (row.id !== geolSkillId(row.no)) throw new Error(`ジオルの技の ID が番号と合いません: ${row.no} ${row.id}`);
  const attack = category === 'force' || category === 'wisdom';
  const damage = attack ? Number(row.damage) : null;
  if (attack && !Number.isInteger(damage)) throw new Error(`ジオルの攻撃の技のダメージが読めません: ${row.no} ${row.damage}`);
  const o: OfficialSkill = {
    design_id: `GEOL-SK-${twoDigits(row.no)}`,
    number: row.no,
    name_ja: row.name,
    mana: row.mana,
    damage,
    category,
    effect_text_ja: row.effect === 'なし' ? null : row.effect,
  };
  return officialSkill(
    o,
    { label: 'ジオル', monsterId: GEOL_MONSTER_ID, skillId: geolSkillId, artFile: geolArtFile, specialEffects: {} },
    { displayNo: row.no, ...(SPECIAL_EFFECTS[row.no] ? { effect: SPECIAL_EFFECTS[row.no] } : {}) },
  );
}

/** ジオルの技14種（JSON の番号の順） */
export const GEOL_SKILLS: readonly SkillCard[] = GEOL_ROWS.map(toSkill);

/** ガチャのレアの枠（JSON の gacha_slot が「レア」：3 ナックル・5 地ひびき・10 エネルギーをためる・14 うけとめる） */
export const GEOL_GACHA_RARE: readonly string[] = GEOL_ROWS.filter((r) => r.gacha_slot === 'レア').map((r) => r.id);

/**
 * 【試遊用・進行の仮】ジオルの16枚（初期配布はまだ無いので、試遊のデッキの入れ替えにだけ使う。山札60枚に合わせる）。
 * 攻撃11（いしなげ2・いわくだき1・ナックル2・ぶんまわし1・地ひびき1・グランドハンマー1・クリスタルショット2・クリスタルレイ1）、
 * 特殊2（じならし1・エネルギーをためる1）、守り3（かばう1・いわのうで1・すいしょうのたて1）。うけとめる（レアの守り）は入れない
 */
export const GEOL_PLAYTEST_16: readonly { readonly id: string; readonly copies: number }[] = [
  [1, 2], [2, 1], [3, 2], [4, 1], [5, 1], [6, 1], [7, 2], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1],
].map(([no, copies]) => ({ id: geolSkillId(no as number), copies: copies as number }));

/** 確認用の画面で、新しい効果を目で確かめるための16枚（地ひびき・じならし・エネルギーをためる・かばう・うけとめる・クリスタルレイ。試遊の勝率には使わない） */
export const GEOL_EFFECT_CHECK_16: readonly { readonly id: string; readonly copies: number }[] = [
  [5, 3], [9, 2], [10, 3], [8, 3], [11, 3], [14, 2],
].map(([no, copies]) => ({ id: geolSkillId(no as number), copies: copies as number }));
