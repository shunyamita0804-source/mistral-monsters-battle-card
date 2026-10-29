import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import fluneData from './official/flune14_skills_OFFICIAL_20261029.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * フルーネ（新モンスター制作の手順 8「フルーネの最終」2026-10-29。指示書 design-parts/cards-original/flune/00_instructions_for_claude_code.txt）。
 * 試遊（手順 4）はユーザーの判断でしていない。数字は JSON のとおりで確定。
 * 正本は src/data/official/flune14_skills_OFFICIAL_20261029.json（届いた JSON を無改変。同じ内容の CSV も無改変で並べて置く）。
 * 技名・分類・マナ・ダメージ・ライフ（10）は JSON からそのまま読む（tests/flune.test.ts で CSV とも照らし合わせる）。
 * 効果の文も JSON のまま。画面に出す短い文は src/data/skillCardText.ts（ジオルと同じ作り）。ルールの細かい決まりは docs/battle-rules.md「フルーネの効果の扱い」
 *
 * ふつうに遊ぶ人に出す：cards.ts の MONSTERS・SKILLS（図鑑・デッキ編集・敵の編成）。
 * 入手：精霊の森のボスのセラに初めて勝つと、最奥の祭壇でフルーネのモンスターカード。2回目からはフルーネの技カード1枚（src/data/dungeons.ts の trumpReward）。
 * 仮フルーネ（tmp-flune）はゲームから外した（セーブ version 25 で mon-flune に置きかえ）
 *
 * ゲーム内 ID：mon-flune（ライフ10・内部ランク C。画面には出さない）、skl-flune-01〜14（JSON の no）
 * 絵（原本は design-parts/cards-original/flune/ に無改変）：
 * - 技 flune_sk_01〜14.webp（届いた flune_sk_NN.png を tools/art/card_art_webp.py で幅 827 の WebP に。番号＝技番号）
 * - 正式モンスターカード flune_official.webp（届いた flune_official_monstercard_LIFE10.png を幅 508 に縮めただけ。ジオルと同じ）
 * - バトル用 flune_battlecard.png（届いた flune_battleart.png を無改変。1169×1346）
 * 色：若葉色 #9CBF5A（モンスターカード枠・技カード枠とも）
 * ガチャのレアの枠（JSON の gacha_slot）：09 フラワードレイン（FLUNE_GACHA_RARE）
 */
export const FLUNE_MONSTER_ID = 'mon-flune';
export const fluneSkillId = (no: number): string => `skl-flune-${twoDigits(no)}`;

/** フルーネの色（JSON の frame_color_hex） */
export const FLUNE_COLOR: string = fluneData.frame_color_hex;

export const FLUNE_MONSTER: MonsterCard = {
  kind: 'monster',
  id: FLUNE_MONSTER_ID,
  name: fluneData.monster,
  rarity: null,
  life: fluneData.life,
  themeColor: FLUNE_COLOR,
  description: 'フルーネ。',
  isPlaceholder: false,
  // 図鑑・ショップなどのカード：名前と LIFE 入りの正式モンスターカード（ジオルと同じ使い方）
  art: { category: 'monsterCards', file: 'flune_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'flune_battlecard.png', layout: 'full' },
};

export interface FluneRow {
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

export const FLUNE_ROWS: readonly FluneRow[] = fluneData.skills;

/** JSON の分類（フルーネの JSON は「特殊技」「防御技」「回避技」と書く） */
const CATEGORY: Readonly<Record<string, string>> = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' };

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す。キーは JSON の no）。
 * - 07 かふん「相手のマナを1減らす」：ノビトンのくしゃみと同じ manaDrain: 1
 * - 09 フラワードレイン：攻撃のあと、相手のライフが実際に減った量だけフルーネのライフを回復（drain）
 * - 10 いやしのみつ：味方1体（フルーネも選べる）のライフを2回復（healAlly）
 * - 11・12 防御：ちから技−3／かしこさ技−3。13 つるのかべ：ちから技・かしこさ技−2。14 はっぱにかくれる：ちから技を回避（消費マナの条件なし）
 * 細かい裁定は docs/battle-rules.md「フルーネの効果の扱い」
 */
const SPECIAL_EFFECTS: Readonly<Record<number, SkillEffect>> = {
  7: { type: 'attack', manaDrain: 1 },
  9: { type: 'attack', drain: true },
  10: { type: 'healAlly', amount: 2 },
  11: { type: 'defense', reduce: 3, against: 'force' },
  12: { type: 'defense', reduce: 3, against: 'wisdom' },
  13: { type: 'defense', reduce: 2, against: 'all' },
  14: { type: 'evade', against: 'force' },
};

/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const fluneArtFile = (no: number): string => `flune_sk_${twoDigits(no)}.webp`;

function toSkill(row: FluneRow): SkillCard {
  const category = CATEGORY[row.category];
  if (!category) throw new Error(`フルーネの技の分類が不明です: ${row.no} ${row.category}`);
  if (row.id !== fluneSkillId(row.no)) throw new Error(`フルーネの技の ID が番号と合いません: ${row.no} ${row.id}`);
  const attack = category === 'force' || category === 'wisdom';
  const damage = attack ? Number(row.damage) : null;
  if (attack && !Number.isInteger(damage)) throw new Error(`フルーネの攻撃の技のダメージが読めません: ${row.no} ${row.damage}`);
  const o: OfficialSkill = {
    design_id: `FLUNE-SK-${twoDigits(row.no)}`,
    number: row.no,
    name_ja: row.name,
    mana: row.mana,
    damage,
    category,
    effect_text_ja: row.effect === 'なし' ? null : row.effect,
  };
  return officialSkill(
    o,
    { label: 'フルーネ', monsterId: FLUNE_MONSTER_ID, skillId: fluneSkillId, artFile: fluneArtFile, specialEffects: {} },
    { displayNo: row.no, ...(SPECIAL_EFFECTS[row.no] ? { effect: SPECIAL_EFFECTS[row.no] } : {}) },
  );
}

/** フルーネの技14種（JSON の番号の順） */
export const FLUNE_SKILLS: readonly SkillCard[] = FLUNE_ROWS.map(toSkill);

/** ガチャのレアの枠（JSON の gacha_slot が「レア」：09 フラワードレイン） */
export const FLUNE_GACHA_RARE: readonly string[] = FLUNE_ROWS.filter((r) => r.gacha_slot === 'レア').map((r) => r.id);
