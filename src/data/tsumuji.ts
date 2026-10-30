import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import tsumujiData from './official/tsumuji14_skills_OFFICIAL_20261030.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * ツムジ（2026-10-30 指示書 U「風の渓谷とツムジ」。指示書 design-parts/cards-original/tsumuji/00_instructions_for_claude_code.txt）。
 * 試遊はしていない（JSON の status）。数字は JSON のとおりで確定。技8の名前は「かぜのり」（プカリムの「おいかぜ」とは別の技）。
 * 正本は src/data/official/tsumuji14_skills_OFFICIAL_20261030.json（届いた JSON を無改変。同じ内容の CSV も無改変で並べて置く）。
 * 技名・分類・マナ・ダメージ・ライフ（6）は JSON からそのまま読む（tests/tsumuji.test.ts で CSV とも照らし合わせる）。
 * 効果の文も JSON のまま。画面に出す短い文は src/data/skillCardText.ts（TSUMUJI_CARD_TEXT。フルーネと同じ作り）。
 * ルールの細かい決まりは docs/battle-rules.md「ツムジの効果の扱い」
 *
 * ふつうに遊ぶ人に出す：cards.ts の MONSTERS・SKILLS（図鑑・デッキ編集・敵の編成）。
 * 入手：風の渓谷のボスのゼフィラに初めて勝つと、最奥の祭壇でツムジのモンスターカード。2回目からはツムジの技カード1枚（src/data/dungeons.ts の trumpReward）。
 *
 * ゲーム内 ID：mon-tsumuji（ライフ6・内部ランク C。画面には出さない）、skl-tsumuji-01〜14（JSON の no）
 * 絵（原本は design-parts/cards-original/tsumuji/ に無改変）：
 * - 技 tsumuji_sk_01〜14.webp（届いた tsumuji_sk_NN.png を tools/art/card_art_webp.py で幅 827 の WebP に。番号＝技番号）
 * - 正式モンスターカード tsumuji_official.webp（届いた tsumuji_official_monstercard_LIFE6.png を幅 508 に縮めただけ。セレフィーンと同じ）
 * - バトル用 tsumuji_battlecard.png（届いた tsumuji_battleart.png を無改変。1169×1346）
 * 色：くすんだ青みの灰 #8FA3B8（モンスターカード枠・技カード枠とも）
 * ガチャのレアの枠（JSON の gacha_slot）：03 かまいたち・10 ストームブレイド・14 かぜよみ（TSUMUJI_GACHA_RARE）
 */
export const TSUMUJI_MONSTER_ID = 'mon-tsumuji';
export const tsumujiSkillId = (no: number): string => `skl-tsumuji-${twoDigits(no)}`;

/** ツムジの色（JSON の frame_color_hex） */
export const TSUMUJI_COLOR: string = tsumujiData.frame_color_hex;

export const TSUMUJI_MONSTER: MonsterCard = {
  kind: 'monster',
  id: TSUMUJI_MONSTER_ID,
  name: tsumujiData.monster,
  rarity: null,
  life: tsumujiData.life,
  themeColor: TSUMUJI_COLOR,
  description: 'ツムジ。',
  isPlaceholder: false,
  // 図鑑・ショップなどのカード：名前と LIFE 入りの正式モンスターカード（セレフィーンと同じ使い方）
  art: { category: 'monsterCards', file: 'tsumuji_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'tsumuji_battlecard.png', layout: 'full' },
};

export interface TsumujiRow {
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

export const TSUMUJI_ROWS: readonly TsumujiRow[] = tsumujiData.skills;

/** JSON の分類（フルーネと同じく「特殊技」「防御技」「回避技」と書く） */
const CATEGORY: Readonly<Record<string, string>> = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' };

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す。キーは JSON の no）。
 * - 02 Wひっかき：同じターンに、手札のもう1枚の Wひっかき を続けて使える（chain。「1体1ターン1回」のただ1つの例外。Wひっかき → Wひっかき の1回だけ）
 * - 04 つむじかぜ「回避されない」：セレフィーンのなみ打ちと同じ（防御はできる）
 * - 08 かぜのり：次の自分のターンの間、ツムジの攻撃技の消費マナ−1（windRide。0より下にはならない・重ねない）
 * - 11 かぜのまく：ちから技・かしこさ技−2（セレフィーンのミストヴェールと同じ）
 * - 12 ひらりとかわす：ちから技を回避。13 すりぬける：かしこさ技を回避。14 かぜよみ：消費マナに関係なく両方を回避（セレフィーンのウェーブダンスと同じ）
 * 細かい裁定は docs/battle-rules.md「ツムジの効果の扱い」
 */
const SPECIAL_EFFECTS: Readonly<Record<number, SkillEffect>> = {
  2: { type: 'attack', chain: true },
  4: { type: 'attack', undodgeable: true },
  8: { type: 'windRide', discount: 1 },
  11: { type: 'defense', reduce: 2, against: 'all' },
  12: { type: 'evade', against: 'force' },
  13: { type: 'evade', against: 'wisdom' },
  14: { type: 'evade', against: 'all' },
};

/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const tsumujiArtFile = (no: number): string => `tsumuji_sk_${twoDigits(no)}.webp`;

function toSkill(row: TsumujiRow): SkillCard {
  const category = CATEGORY[row.category];
  if (!category) throw new Error(`ツムジの技の分類が不明です: ${row.no} ${row.category}`);
  if (row.id !== tsumujiSkillId(row.no)) throw new Error(`ツムジの技の ID が番号と合いません: ${row.no} ${row.id}`);
  const attack = category === 'force' || category === 'wisdom';
  const damage = attack ? Number(row.damage) : null;
  if (attack && !Number.isInteger(damage)) throw new Error(`ツムジの攻撃の技のダメージが読めません: ${row.no} ${row.damage}`);
  const o: OfficialSkill = {
    design_id: `TSUMUJI-SK-${twoDigits(row.no)}`,
    number: row.no,
    name_ja: row.name,
    mana: row.mana,
    damage,
    category,
    effect_text_ja: row.effect === 'なし' ? null : row.effect,
  };
  return officialSkill(
    o,
    { label: 'ツムジ', monsterId: TSUMUJI_MONSTER_ID, skillId: tsumujiSkillId, artFile: tsumujiArtFile, specialEffects: {} },
    { displayNo: row.no, ...(SPECIAL_EFFECTS[row.no] ? { effect: SPECIAL_EFFECTS[row.no] } : {}) },
  );
}

/** ツムジの技14種（JSON の番号の順） */
export const TSUMUJI_SKILLS: readonly SkillCard[] = TSUMUJI_ROWS.map(toSkill);

/** ガチャのレアの枠（JSON の gacha_slot が「レア」：03 かまいたち・10 ストームブレイド・14 かぜよみ） */
export const TSUMUJI_GACHA_RARE: readonly string[] = TSUMUJI_ROWS.filter((r) => r.gacha_slot === 'レア').map((r) => r.id);
