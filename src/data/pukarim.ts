import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import pukarimData from './official/pukarim14_skills_DRAFT_20261028.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * 【試遊中・2026-10-28】プカリム（新モンスター制作の手順 4「仮の絵で入れて試遊する」。指示書 design-parts/cards-original/pukarim/00_instructions_for_claude_code.txt）。
 * 正本は src/data/official/pukarim14_skills_DRAFT_20261028.json（届いた JSON を無改変。同じ内容の CSV も無改変で並べて置く）。
 * 技名・分類・マナ・ダメージ・効果の文・ライフは JSON からそのまま読む（tests/pukarim.test.ts で CSV とも照らし合わせる）。
 *
 * ふつうに遊んでいる人には出さない（確認用の ?qa=1 のときだけ使う）：カードの一覧（cards.ts の MONSTERS・SKILLS）には入れず、
 * カードを引く台帳（cardCatalog）と QA 用の一覧（QA_MONSTERS・QA_SKILLS）にだけ入れる。図鑑・デッキ編集・ガチャ・初期配布・敵の編成には出ない。
 * 遊ぶ人の入手の流れ（街のピート・ガチャのシリーズ・ダンジョンのバトラー）は、絵がそろってから別の指示書で入れる。
 *
 * ゲーム内 ID：mon-pukarim（ライフ6・内部ランク C は画面に出さない）、skl-pukarim-01〜14（JSON の no）
 * 絵：バトル用 pukarim_battlecard.png（届いた art/pukarim_battleart.png を無改変。1169×1345。カルシェルと同じく表示のときに縮める）。
 *   技カードの絵・名前と LIFE の入った正式モンスターカードはまだ無い（技カードは「絵が無いとき」の見た目）
 * 色：ミント #A8DCC4（モンスターカード枠・技カード枠とも）
 * ガチャの枠（JSON の gacha_slot）：レア＝7 ぷはーっ・14 ぷかぷか。今回はガチャに入れない（PUKARIM_GACHA_RARE にデータとして持つだけ）
 */
export const PUKARIM_MONSTER_ID = 'mon-pukarim';
export const pukarimSkillId = (no: number): string => `skl-pukarim-${twoDigits(no)}`;

/** プカリムの色（JSON の frame_color_hex） */
export const PUKARIM_COLOR: string = pukarimData.frame_color_hex;

export const PUKARIM_MONSTER: MonsterCard = {
  kind: 'monster',
  id: PUKARIM_MONSTER_ID,
  name: pukarimData.monster,
  rarity: null,
  life: pukarimData.life,
  themeColor: PUKARIM_COLOR,
  description: 'プカリム（試遊中）。',
  isPlaceholder: false,
  battleArt: { category: 'monsterCards', file: 'pukarim_battlecard.png', layout: 'full' },
  pendingSpec: ['rarity'],
};

export interface PukarimRow {
  readonly no: number;
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly mana: number;
  readonly damage: string;
  readonly effect: string;
  readonly gacha_slot: string;
}

export const PUKARIM_ROWS: readonly PukarimRow[] = pukarimData.skills;

const CATEGORY: Readonly<Record<string, string>> = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' };

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す。キーは JSON の no）。
 * - 07 ぷはーっ「ほっぺにためているときに使うと、回避されない」：ためているときだけ回避できない（防御の軽減はふつうに受ける）
 * - 09 ほっぺにためる：プカリムの次の攻撃技のダメージ＋2（使うまで続く・重ねない・倒れたら消える）
 * - 10 おいかぜ：プカリム以外の味方1体の次の攻撃技のダメージ＋1（1回使うか、次の自分のターンが終わったら消える）
 * - 11・12 防御：ちから技−2／ちから技・かしこさ技−2
 * - 13・14 回避：ちから技／ちから技・かしこさ技（消費マナに関係なく）
 * 細かい裁定は docs/battle-rules.md「プカリム（試遊中）」
 */
const SPECIAL_EFFECTS: Readonly<Record<number, SkillEffect>> = {
  7: { type: 'attack', undodgeableWhenCharged: true },
  9: { type: 'charge', amount: 2 },
  10: { type: 'tailwind', amount: 1 },
  11: { type: 'defense', reduce: 2, against: 'force' },
  12: { type: 'defense', reduce: 2, against: 'all' },
  13: { type: 'evade', against: 'force' },
  14: { type: 'evade', against: 'all' },
};

/** 技の絵のファイル名（まだ無い。届いたら assets/images/cards/skills/ に置き、toSkill で art を戻す） */
export const pukarimArtFile = (no: number): string => `puk_sk_${twoDigits(no)}.png`;

function toSkill(row: PukarimRow): SkillCard {
  const category = CATEGORY[row.category];
  if (!category) throw new Error(`プカリムの技の分類が不明です: ${row.no} ${row.category}`);
  if (row.id !== pukarimSkillId(row.no)) throw new Error(`プカリムの技の ID が番号と合いません: ${row.no} ${row.id}`);
  const attack = category === 'force' || category === 'wisdom';
  const damage = attack ? Number(row.damage) : null;
  if (attack && !Number.isInteger(damage)) throw new Error(`プカリムの攻撃の技のダメージが読めません: ${row.no} ${row.damage}`);
  const o: OfficialSkill = {
    design_id: `PUK-SK-${twoDigits(row.no)}`,
    number: row.no,
    name_ja: row.name,
    mana: row.mana,
    damage,
    category,
    effect_text_ja: row.effect === 'なし' ? null : row.effect,
  };
  const skill = officialSkill(
    o,
    { label: 'プカリム', monsterId: PUKARIM_MONSTER_ID, skillId: pukarimSkillId, artFile: pukarimArtFile, specialEffects: {} },
    { displayNo: row.no, ...(SPECIAL_EFFECTS[row.no] ? { effect: SPECIAL_EFFECTS[row.no] } : {}) },
  );
  // 技の絵はまだ無い（pendingSpec の 'art'。届くまでは「絵が無いとき」の見た目。届いたら art を戻す）
  const { art: _pending, ...rest } = skill;
  return { ...rest, pendingSpec: ['art', 'rarity'] };
}

/** プカリムの技14種（JSON の番号の順） */
export const PUKARIM_SKILLS: readonly SkillCard[] = PUKARIM_ROWS.map(toSkill);

/** ガチャのレアの枠（JSON の gacha_slot が「レア」。今回はガチャに入れない） */
export const PUKARIM_GACHA_RARE: readonly string[] = PUKARIM_ROWS.filter((r) => r.gacha_slot === 'レア').map((r) => r.id);

/**
 * 【試遊用・Claude の仮】プカリムの16枚（初期配布はまだ無いので、試遊のデッキの入れ替えに使う。山札60枚に合わせる）。
 * 攻撃11（しっぽ1・たいあたり1・ころがる2・ボディプレス1・とっぷう1・エアショット2・ぷはーっ2・おおつむじ1）、
 * 特殊3（ほっぺにためる2・おいかぜ1）、守り2（ぷにぷにボディ1・ぷかっとうく1）。新しい効果を試せるよう 7・9・10 を必ず入れる
 */
export const PUKARIM_PLAYTEST_16: readonly { readonly id: string; readonly copies: number }[] = [
  [1, 1], [2, 1], [3, 2], [4, 1], [5, 1], [6, 2], [7, 2], [8, 1], [9, 2], [10, 1], [11, 1], [13, 1],
].map(([no, copies]) => ({ id: pukarimSkillId(no as number), copies: copies as number }));
