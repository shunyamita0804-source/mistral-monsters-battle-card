import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import serephineData from './official/serephine14_skills_OFFICIAL_20261029.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * セレフィーン（新モンスター制作の手順 8「セレフィーンの最終」2026-10-29。指示書 design-parts/cards-original/serephine/00_instructions_for_claude_code.txt）。
 * 試遊（手順 4）はユーザーの判断でしていない。数字は JSON のとおりで確定。初めての人の形のモンスター。
 * 正本は src/data/official/serephine14_skills_OFFICIAL_20261029.json（届いた JSON を無改変。同じ内容の CSV も無改変で並べて置く）。
 * 技名・分類・マナ・ダメージ・ライフ（6）は JSON からそのまま読む（tests/serephine.test.ts で CSV とも照らし合わせる）。
 * 効果の文も JSON のまま。画面に出す短い文は src/data/skillCardText.ts（フルーネと同じ作り）。ルールの細かい決まりは docs/battle-rules.md「セレフィーンの効果の扱い」
 *
 * ふつうに遊ぶ人に出す：cards.ts の MONSTERS・SKILLS（図鑑・デッキ編集・敵の編成）。
 * 入手：水の神殿のボスのルシアに初めて勝つと、最奥の祭壇でセレフィーンのモンスターカード。2回目からはセレフィーンの技カード1枚（src/data/dungeons.ts の trumpReward）。
 *
 * ゲーム内 ID：mon-serephine（ライフ6・内部ランク C。画面には出さない）、skl-serephine-01〜14（JSON の no）
 * 絵（原本は design-parts/cards-original/serephine/ に無改変）：
 * - 技 serephine_sk_01〜14.webp（届いた serephine_sk_NN.png を tools/art/card_art_webp.py で幅 827 の WebP に。番号＝技番号）
 * - 正式モンスターカード serephine_official.webp（届いた serephine_official_monstercard_LIFE6.png を幅 508 に縮めただけ。フルーネと同じ）
 * - バトル用 serephine_battlecard.png（届いた serephine_battleart.png を無改変。1169×1345）
 * 色：月の青紫 #8FA6E8（モンスターカード枠・技カード枠とも）
 * ガチャのレアの枠（JSON の gacha_slot）：07 アクアニードル・09 オーシャンウェーブ・14 ウェーブダンス（SEREPHINE_GACHA_RARE）
 */
export const SEREPHINE_MONSTER_ID = 'mon-serephine';
export const serephineSkillId = (no: number): string => `skl-serephine-${twoDigits(no)}`;

/** セレフィーンの色（JSON の frame_color_hex） */
export const SEREPHINE_COLOR: string = serephineData.frame_color_hex;

export const SEREPHINE_MONSTER: MonsterCard = {
  kind: 'monster',
  id: SEREPHINE_MONSTER_ID,
  name: serephineData.monster,
  rarity: null,
  life: serephineData.life,
  themeColor: SEREPHINE_COLOR,
  description: 'セレフィーン。',
  isPlaceholder: false,
  // 図鑑・ショップなどのカード：名前と LIFE 入りの正式モンスターカード（フルーネと同じ使い方）
  art: { category: 'monsterCards', file: 'serephine_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'serephine_battlecard.png', layout: 'full' },
};

export interface SerephineRow {
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

export const SEREPHINE_ROWS: readonly SerephineRow[] = serephineData.skills;

/** JSON の分類（フルーネと同じく「特殊技」「防御技」「回避技」と書く） */
const CATEGORY: Readonly<Record<string, string>> = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' };

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す。キーは JSON の no）。新しい仕組みは作らない（指示書）。
 * - 05 なみ打ち・07 アクアニードル「回避されない」：ガウルの聖なる炎・カルシェルのコーラルスピアと同じ（防御はできる）
 * - 10 みちしお：山札のいちばん上の1枚を、手札に入れずにそのままマナにする（mana。手札があふれたときに山札の上をマナにするのと同じ動き）。山札が0枚なら使えない
 * - 11 ミストヴェール：ちから技・かしこさ技−2（プカリムのくうきのクッションと同じ）
 * - 12 すいっとよける：ちから技を回避。13 ゆらりとかわす：かしこさ技を回避。14 ウェーブダンス：マナに関係なく両方を回避（ソラモの星影ステップと同じ）
 * 細かい裁定は docs/battle-rules.md「セレフィーンの効果の扱い」
 */
const SPECIAL_EFFECTS: Readonly<Record<number, SkillEffect>> = {
  5: { type: 'attack', undodgeable: true },
  7: { type: 'attack', undodgeable: true },
  10: { type: 'mana', amount: 1 },
  11: { type: 'defense', reduce: 2, against: 'all' },
  12: { type: 'evade', against: 'force' },
  13: { type: 'evade', against: 'wisdom' },
  14: { type: 'evade', against: 'all' },
};

/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const serephineArtFile = (no: number): string => `serephine_sk_${twoDigits(no)}.webp`;

function toSkill(row: SerephineRow): SkillCard {
  const category = CATEGORY[row.category];
  if (!category) throw new Error(`セレフィーンの技の分類が不明です: ${row.no} ${row.category}`);
  if (row.id !== serephineSkillId(row.no)) throw new Error(`セレフィーンの技の ID が番号と合いません: ${row.no} ${row.id}`);
  const attack = category === 'force' || category === 'wisdom';
  const damage = attack ? Number(row.damage) : null;
  if (attack && !Number.isInteger(damage)) throw new Error(`セレフィーンの攻撃の技のダメージが読めません: ${row.no} ${row.damage}`);
  const o: OfficialSkill = {
    design_id: `SEREPHINE-SK-${twoDigits(row.no)}`,
    number: row.no,
    name_ja: row.name,
    mana: row.mana,
    damage,
    category,
    effect_text_ja: row.effect === 'なし' ? null : row.effect,
  };
  return officialSkill(
    o,
    { label: 'セレフィーン', monsterId: SEREPHINE_MONSTER_ID, skillId: serephineSkillId, artFile: serephineArtFile, specialEffects: {} },
    { displayNo: row.no, ...(SPECIAL_EFFECTS[row.no] ? { effect: SPECIAL_EFFECTS[row.no] } : {}) },
  );
}

/** セレフィーンの技14種（JSON の番号の順） */
export const SEREPHINE_SKILLS: readonly SkillCard[] = SEREPHINE_ROWS.map(toSkill);

/** ガチャのレアの枠（JSON の gacha_slot が「レア」：07 アクアニードル・09 オーシャンウェーブ・14 ウェーブダンス） */
export const SEREPHINE_GACHA_RARE: readonly string[] = SEREPHINE_ROWS.filter((r) => r.gacha_slot === 'レア').map((r) => r.id);
