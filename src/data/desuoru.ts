import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import desuoruData from './official/desuoru14_skills_OFFICIAL_20261031.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * デスオル（2026-10-31 指示書 AG「新しいモンスター『デスオル』（A ランク・見通す王）を入れて試遊する」）。
 * 黒いフードと王の衣・角2本・青白く光る目・爪の手甲・槍・カラス2羽・下半身は煙で宙に浮く。数字は JSON のとおりで確定。
 * **ゲームで初めての内部ランク A**（画面に出さない）。これからの A の数字のものさしになるモンスター。
 * 正本は src/data/official/desuoru14_skills_OFFICIAL_20261031.json（届いた JSON を無改変。同じ内容の CSV も無改変で並べて置く）。
 * 技名・分類・マナ・ダメージ・ライフ（7）は JSON からそのまま読む（tests/desuoru.test.ts で CSV とも照らし合わせる）。
 * 効果の文も JSON のまま。画面に出す短い文は src/data/skillCardText.ts。ルールの細かい決まりは docs/battle-rules.md「デスオルの効果の扱い」
 *
 * ふつうの一覧（cards.ts の MONSTERS・SKILLS）に入れる。図鑑の番号はハクランのあと。
 * 入手：まだ無い（置き場所は決まっていない）。どのダンジョン・相手・箱にも入れない（試遊の中だけで使う）。
 * ガチャのシリーズは economy.ts の GACHA_SERIES に1行あるが、モンスターカードを持つまで並ばない
 *
 * ゲーム内 ID：mon-desuoru（ライフ7・内部ランク A）、skl-desuoru-01〜14（JSON の no）
 * 絵（原本は design-parts/cards-original/desuoru/ に無改変）：
 * - 技 desuoru_sk_01〜14.webp（届いた desuoru_sk_NN.png を tools/art/card_art_webp.py で幅 827 の WebP に。番号＝技番号）
 * - 正式モンスターカード desuoru_official.webp（届いた desuoru_official_monstercard_LIFE7.png〔970×1622〕を tools/art/official_card_webp.py で 508×849 に）
 * - バトル用 desuoru_battlecard.png（届いた desuoru_battleart.png を無改変。1169×1346 透過）
 * 色：紺 #1E2B58（モンスターカード枠・技カード枠とも。暗い色なのでシシエンと同じ暗い色のしかた）。
 *   2026-11-01 指示書 AG2：技カードの名前の帯が鋼色でシシエンの灰色に近かったので、紺に寄せた（tools/art/skillcard_simple_build.py の LIGHT_MIX）
 * 2026-11-01 指示書 AG2（A の目安 70% 以上にするため）：4 しのささやき ダメージ 3→4・5 めいかいのかぜ ダメージ 4→5。JSON・CSV を直し、前の版は *_v1_20261031.* に残す
 * ガチャのレアの枠（JSON の gacha_slot）：08 ヘルのもん・10 カラスのめ・14 かげにとける（DESUORU_GACHA_RARE）
 */
export const DESUORU_MONSTER_ID = 'mon-desuoru';
export const desuoruSkillId = (no: number): string => `skl-desuoru-${twoDigits(no)}`;

/** デスオルの色（JSON の frame_color_hex） */
export const DESUORU_COLOR: string = desuoruData.frame_color_hex;

export const DESUORU_MONSTER: MonsterCard = {
  kind: 'monster',
  id: DESUORU_MONSTER_ID,
  name: desuoruData.monster,
  rarity: null,
  life: desuoruData.life,
  themeColor: DESUORU_COLOR,
  description: 'デスオル。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'desuoru_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'desuoru_battlecard.png', layout: 'full' },
};

export interface DesuoruRow {
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

export const DESUORU_ROWS: readonly DesuoruRow[] = desuoruData.skills;

const CATEGORY: Readonly<Record<string, string>> = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' };

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す。キーは JSON の no）：
 * - 01 いしづきでつく：マナ0の攻撃（フルーネのつたはたきと同じ扱い。効果の文は無いのでふつうの攻撃）
 * - 06 しのゆびさし「回避されない」：ガウルの聖なる炎と同じ（undodgeable）
 * - 07 やみのやり「防御されない」：ジオルのいわくだきと同じ（unblockable。回避はできる）
 * - 09 にらみつける：ソラモのすなかけ・ガウルの威嚇と同じ（seal。選んだ相手1体は次の手番に攻撃技を使えない）
 * - 10 カラスのめ（新しい効果）：相手の手札をすべて見て、1枚選んで相手の捨て札へ（discardChoice。相手は補充しない）
 * - 11 やみのころも：ちから技−3。12 ルーンのまもり：かしこさ技−3（カルシェルの 11・12 と同じ）
 * - 13 マントでそらす：消費マナ2以上のちから技を回避（カルシェルのしおのステップと同じ）
 * - 14 かげにとける：消費マナに関係なく両方を回避（ウェーブダンスと同じ。マナだけ1）
 */
const SPECIAL_EFFECTS: Readonly<Record<number, SkillEffect>> = {
  6: { type: 'attack', undodgeable: true },
  7: { type: 'attack', unblockable: true },
  9: { type: 'seal' },
  10: { type: 'discardChoice' },
  11: { type: 'defense', reduce: 3, against: 'force' },
  12: { type: 'defense', reduce: 3, against: 'wisdom' },
  13: { type: 'evade', against: 'force', minCost: 2 },
  14: { type: 'evade', against: 'all' },
};

/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const desuoruArtFile = (no: number): string => `desuoru_sk_${twoDigits(no)}.webp`;

function toSkill(row: DesuoruRow): SkillCard {
  const category = CATEGORY[row.category];
  if (!category) throw new Error(`デスオルの技の分類が不明です: ${row.no} ${row.category}`);
  if (row.id !== desuoruSkillId(row.no)) throw new Error(`デスオルの技の ID が番号と合いません: ${row.no} ${row.id}`);
  const attack = category === 'force' || category === 'wisdom';
  const damage = attack ? Number(row.damage) : null;
  if (attack && !Number.isInteger(damage)) throw new Error(`デスオルの攻撃の技のダメージが読めません: ${row.no} ${row.damage}`);
  const o: OfficialSkill = {
    design_id: `DESUORU-SK-${twoDigits(row.no)}`,
    number: row.no,
    name_ja: row.name,
    mana: row.mana,
    damage,
    category,
    effect_text_ja: row.effect === 'なし' ? null : row.effect,
  };
  return officialSkill(
    o,
    { label: 'デスオル', monsterId: DESUORU_MONSTER_ID, skillId: desuoruSkillId, artFile: desuoruArtFile, specialEffects: {} },
    { displayNo: row.no, ...(SPECIAL_EFFECTS[row.no] ? { effect: SPECIAL_EFFECTS[row.no] } : {}) },
  );
}

/** デスオルの技14種（JSON の番号の順） */
export const DESUORU_SKILLS: readonly SkillCard[] = DESUORU_ROWS.map(toSkill);

/** ガチャのレアの枠（JSON の gacha_slot が「レア」：08 ヘルのもん・10 カラスのめ・14 かげにとける） */
export const DESUORU_GACHA_RARE: readonly string[] = DESUORU_ROWS.filter((r) => r.gacha_slot === 'レア').map((r) => r.id);
