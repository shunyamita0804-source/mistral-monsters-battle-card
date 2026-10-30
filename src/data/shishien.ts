import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import shishienData from './official/shishien14_skills_OFFICIAL_20261030.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * シシエン（2026-10-31 指示書 AB【1】「シシエン（炎の火山の新しい切り札）」。指示書 design-parts/cards-original/shishien/00_instructions_for_claude_code.txt）。
 * 炎の火山に住む、すす色の灰のライオンの子（たてがみの毛先だけ赤く光る）。数字は JSON のとおりで確定。
 * 正本は src/data/official/shishien14_skills_OFFICIAL_20261030.json（届いた JSON を無改変。同じ内容の CSV も無改変で並べて置く）。
 * 技名・分類・マナ・ダメージ・ライフ（7）は JSON からそのまま読む（tests/shishien.test.ts で CSV とも照らし合わせる）。
 * 効果の文も JSON のまま。画面に出す短い文は src/data/skillCardText.ts（ヒョウズクと同じ作り）。
 * ルールの細かい決まりは docs/battle-rules.md「シシエンの効果の扱い」
 *
 * ふつうに遊ぶ人に出す：cards.ts の MONSTERS・SKILLS（図鑑・デッキ編集・敵の編成）。
 * 入手：炎の火山のボスのバルカに初めて勝つと、最奥の祭壇でシシエンのモンスターカード。2回目からはシシエンの技カード1枚（src/data/dungeons.ts の trumpReward）。
 *
 * ゲーム内 ID：mon-shishien（ライフ7・内部ランク B。画面には出さない）、skl-shishien-01〜14（JSON の no）
 * 絵（原本は design-parts/cards-original/shishien/ に無改変）：
 * - 技 shishien_sk_01〜14.webp（届いた shishien_sk_NN.png を tools/art/card_art_webp.py で幅 827 の WebP に。番号＝技番号）
 * - 正式モンスターカード shishien_official.webp（届いた shishien_official_monstercard_LIFE7.png を幅 508 に縮めただけ。ヒョウズクと同じ）
 * - バトル用 shishien_battlecard.png（届いた shishien_battleart.png を無改変。1169×1346）
 * 色：炭色 #3E3A3F（モンスターカード枠・技カード枠とも）
 * ガチャのレアの枠（JSON の gacha_slot）：09 れんごくのとっしん・10 ほのおのほうこう・14 かげろう（SHISHIEN_GACHA_RARE）
 */
export const SHISHIEN_MONSTER_ID = 'mon-shishien';
export const shishienSkillId = (no: number): string => `skl-shishien-${twoDigits(no)}`;

/** シシエンの色（JSON の frame_color_hex） */
export const SHISHIEN_COLOR: string = shishienData.frame_color_hex;

export const SHISHIEN_MONSTER: MonsterCard = {
  kind: 'monster',
  id: SHISHIEN_MONSTER_ID,
  name: shishienData.monster,
  rarity: null,
  life: shishienData.life,
  themeColor: SHISHIEN_COLOR,
  description: 'シシエン。',
  isPlaceholder: false,
  // 図鑑・ショップなどのカード：名前と LIFE 入りの正式モンスターカード（ツムジと同じ使い方）
  art: { category: 'monsterCards', file: 'shishien_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'shishien_battlecard.png', layout: 'full' },
};

export interface ShishienRow {
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

export const SHISHIEN_ROWS: readonly ShishienRow[] = shishienData.skills;

/** JSON の分類（「防御技」「回避技」と書く。特殊技は無いがツムジと同じ表） */
const CATEGORY: Readonly<Record<string, string>> = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' };

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す。キーは JSON の no）：
 * - 07 すてみタックル・08 もえるたてがみ・09 れんごくのとっしん「当たったら自分のライフ−1（捨て身）」：今のエンジンの selfDamageOnHit。
 *   攻撃が当たった（ダメージ1以上）ときだけ使ったシシエンのライフ−1。回避・防御で0なら反動なし。反動で倒れてよい（ユーザー決定）。
 *   相手の最後の1体を倒して勝負がついたら反動の前に勝ち
 * - 11 たてがみでうける：ちから技−3。12 ねつのとばり：ちから技・かしこさ技−2（今の防御）
 * - 13 とびのく：ちから技を回避。14 かげろう：消費マナに関係なく両方を回避（ツムジのかぜよみと同じ）
 * 細かい裁定は docs/battle-rules.md「シシエンの効果の扱い」
 */
const SPECIAL_EFFECTS: Readonly<Record<number, SkillEffect>> = {
  7: { type: 'attack', selfDamageOnHit: 1 },
  8: { type: 'attack', selfDamageOnHit: 1 },
  9: { type: 'attack', selfDamageOnHit: 1 },
  11: { type: 'defense', reduce: 3, against: 'force' },
  12: { type: 'defense', reduce: 2, against: 'all' },
  13: { type: 'evade', against: 'force' },
  14: { type: 'evade', against: 'all' },
};

/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const shishienArtFile = (no: number): string => `shishien_sk_${twoDigits(no)}.webp`;

function toSkill(row: ShishienRow): SkillCard {
  const category = CATEGORY[row.category];
  if (!category) throw new Error(`シシエンの技の分類が不明です: ${row.no} ${row.category}`);
  if (row.id !== shishienSkillId(row.no)) throw new Error(`シシエンの技の ID が番号と合いません: ${row.no} ${row.id}`);
  const attack = category === 'force' || category === 'wisdom';
  const damage = attack ? Number(row.damage) : null;
  if (attack && !Number.isInteger(damage)) throw new Error(`シシエンの攻撃の技のダメージが読めません: ${row.no} ${row.damage}`);
  const o: OfficialSkill = {
    design_id: `SHISHIEN-SK-${twoDigits(row.no)}`,
    number: row.no,
    name_ja: row.name,
    mana: row.mana,
    damage,
    category,
    effect_text_ja: row.effect === 'なし' ? null : row.effect,
  };
  return officialSkill(
    o,
    { label: 'シシエン', monsterId: SHISHIEN_MONSTER_ID, skillId: shishienSkillId, artFile: shishienArtFile, specialEffects: {} },
    { displayNo: row.no, ...(SPECIAL_EFFECTS[row.no] ? { effect: SPECIAL_EFFECTS[row.no] } : {}) },
  );
}

/** シシエンの技14種（JSON の番号の順） */
export const SHISHIEN_SKILLS: readonly SkillCard[] = SHISHIEN_ROWS.map(toSkill);

/** ガチャのレアの枠（JSON の gacha_slot が「レア」：09 れんごくのとっしん・10 ほのおのほうこう・14 かげろう） */
export const SHISHIEN_GACHA_RARE: readonly string[] = SHISHIEN_ROWS.filter((r) => r.gacha_slot === 'レア').map((r) => r.id);

/**
 * 【試遊用・Claude の仮】シシエンの16枚（2026-10-31 指示書 AB【1】の試遊「レア抜きの16枚」。初期配布は無いので、試遊のデッキの入れ替えにだけ使う）。
 * レア以外の技（01〜08・11〜13 の11種）を1枚ずつ＋マナの少ない攻撃技（1 じゃれつく・3 ひのこ・2 がぶり・4 ねっぷう・5 とっしん）から2枚目を足して16枚。
 * 攻撃13（じゃれつく2・がぶり2・ひのこ2・ねっぷう2・とっしん2・たてがみのひばな1・すてみタックル1・もえるたてがみ1）、守り3（たてがみでうける1・ねつのとばり1・とびのく1）
 */
export const SHISHIEN_PLAYTEST_16: readonly { readonly id: string; readonly copies: number }[] = [
  [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 1], [7, 1], [8, 1], [11, 1], [12, 1], [13, 1],
].map(([no, copies]) => ({ id: shishienSkillId(no as number), copies: copies as number }));
