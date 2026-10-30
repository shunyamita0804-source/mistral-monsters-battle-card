import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import hyouzukuData from './official/hyouzuku14_skills_OFFICIAL_20261030.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * ヒョウズク（2026-10-30 指示書 W「ヒョウズク（氷の洞窟の新しい切り札）」。指示書 design-parts/cards-original/hyouzuku/00_instructions_for_claude_code.txt）。
 * 氷の洞窟に住む白と紺のフクロウ（氷は翼と尾の羽先だけ）。数字は JSON のとおりで確定。新しい決まりは無い（今の決まりをそのまま使う）。
 * 正本は src/data/official/hyouzuku14_skills_OFFICIAL_20261030.json（届いた JSON を無改変。同じ内容の CSV も無改変で並べて置く）。
 * 技名・分類・マナ・ダメージ・ライフ（7）は JSON からそのまま読む（tests/hyouzuku.test.ts で CSV とも照らし合わせる）。
 * 効果の文も JSON のまま。画面に出す短い文は src/data/skillCardText.ts（HYOUZUKU_CARD_TEXT。ツムジと同じ作り）。
 * ルールの細かい決まりは docs/battle-rules.md「ヒョウズクの効果の扱い」
 *
 * ふつうに遊ぶ人に出す：cards.ts の MONSTERS・SKILLS（図鑑・デッキ編集・敵の編成）。
 * 入手：氷の洞窟のボスのイヴァンに初めて勝つと、最奥の祭壇でヒョウズクのモンスターカード。2回目からはヒョウズクの技カード1枚（src/data/dungeons.ts の trumpReward）。
 *
 * ゲーム内 ID：mon-hyouzuku（ライフ7・内部ランク B。画面には出さない）、skl-hyouzuku-01〜14（JSON の no）
 * 絵（原本は design-parts/cards-original/hyouzuku/ に無改変）：
 * - 技 hyouzuku_sk_01〜14.webp（届いた hyouzuku_sk_NN.png を tools/art/card_art_webp.py で幅 827 の WebP に。番号＝技番号）
 * - 正式モンスターカード hyouzuku_official.webp（届いた hyouzuku_official_monstercard_LIFE7.png を幅 508 に縮めただけ。ツムジと同じ）
 * - バトル用 hyouzuku_battlecard.png（届いた hyouzuku_battleart.png を無改変。1169×1346）
 * 色：銀に近い白 #C8CCD4（モンスターカード枠・技カード枠とも）
 * ガチャのレアの枠（JSON の gacha_slot）：09 ふぶき・10 ひょうが・14 おとなきはばたき（HYOUZUKU_GACHA_RARE）
 */
export const HYOUZUKU_MONSTER_ID = 'mon-hyouzuku';
export const hyouzukuSkillId = (no: number): string => `skl-hyouzuku-${twoDigits(no)}`;

/** ヒョウズクの色（JSON の frame_color_hex） */
export const HYOUZUKU_COLOR: string = hyouzukuData.frame_color_hex;

export const HYOUZUKU_MONSTER: MonsterCard = {
  kind: 'monster',
  id: HYOUZUKU_MONSTER_ID,
  name: hyouzukuData.monster,
  rarity: null,
  life: hyouzukuData.life,
  themeColor: HYOUZUKU_COLOR,
  description: 'ヒョウズク。',
  isPlaceholder: false,
  // 図鑑・ショップなどのカード：名前と LIFE 入りの正式モンスターカード（ツムジと同じ使い方）
  art: { category: 'monsterCards', file: 'hyouzuku_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'hyouzuku_battlecard.png', layout: 'full' },
};

export interface HyouzukuRow {
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

export const HYOUZUKU_ROWS: readonly HyouzukuRow[] = hyouzukuData.skills;

/** JSON の分類（「防御技」「回避技」と書く。特殊技は無いがツムジと同じ表） */
const CATEGORY: Readonly<Record<string, string>> = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' };

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す。キーは JSON の no）。どれも今の決まりのまま：
 * - 05 こおりのいき・09 ふぶき「相手は次のターン行動不可」：ノビトンのまきつくと同じ（stunTarget。回避されたらかからない・防御で0ダメージでもかかる・
 *   守りのカードは使える・もう一度かけたら期限だけ新しく。凍らせ続けを止める決まりは入れない〔ユーザー決定〕）。
 *   対戦の画面の印だけ「凍った」の絵にする（stunMark。2026-10-30 指示書 X）
 * - 06 こおりわり「防御されない」：ジオルのいわくだきと同じ（unblockable。回避はできる）
 * - 11 はねでつつむ：ちから技・かしこさ技−2。12 つばさのたて：ちから技−3（今の防御）
 * - 13 まいあがる：かしこさ技を回避。14 おとなきはばたき：消費マナに関係なく両方を回避（ツムジのかぜよみと同じ）
 * 細かい裁定は docs/battle-rules.md「ヒョウズクの効果の扱い」
 */
const SPECIAL_EFFECTS: Readonly<Record<number, SkillEffect>> = {
  5: { type: 'attack', stunTarget: true, stunMark: 'frozen' },
  6: { type: 'attack', unblockable: true },
  9: { type: 'attack', stunTarget: true, stunMark: 'frozen' },
  11: { type: 'defense', reduce: 2, against: 'all' },
  12: { type: 'defense', reduce: 3, against: 'force' },
  13: { type: 'evade', against: 'wisdom' },
  14: { type: 'evade', against: 'all' },
};

/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const hyouzukuArtFile = (no: number): string => `hyouzuku_sk_${twoDigits(no)}.webp`;

function toSkill(row: HyouzukuRow): SkillCard {
  const category = CATEGORY[row.category];
  if (!category) throw new Error(`ヒョウズクの技の分類が不明です: ${row.no} ${row.category}`);
  if (row.id !== hyouzukuSkillId(row.no)) throw new Error(`ヒョウズクの技の ID が番号と合いません: ${row.no} ${row.id}`);
  const attack = category === 'force' || category === 'wisdom';
  const damage = attack ? Number(row.damage) : null;
  if (attack && !Number.isInteger(damage)) throw new Error(`ヒョウズクの攻撃の技のダメージが読めません: ${row.no} ${row.damage}`);
  const o: OfficialSkill = {
    design_id: `HYOUZUKU-SK-${twoDigits(row.no)}`,
    number: row.no,
    name_ja: row.name,
    mana: row.mana,
    damage,
    category,
    effect_text_ja: row.effect === 'なし' ? null : row.effect,
  };
  return officialSkill(
    o,
    { label: 'ヒョウズク', monsterId: HYOUZUKU_MONSTER_ID, skillId: hyouzukuSkillId, artFile: hyouzukuArtFile, specialEffects: {} },
    { displayNo: row.no, ...(SPECIAL_EFFECTS[row.no] ? { effect: SPECIAL_EFFECTS[row.no] } : {}) },
  );
}

/** ヒョウズクの技14種（JSON の番号の順） */
export const HYOUZUKU_SKILLS: readonly SkillCard[] = HYOUZUKU_ROWS.map(toSkill);

/** ガチャのレアの枠（JSON の gacha_slot が「レア」：09 ふぶき・10 ひょうが・14 おとなきはばたき） */
export const HYOUZUKU_GACHA_RARE: readonly string[] = HYOUZUKU_ROWS.filter((r) => r.gacha_slot === 'レア').map((r) => r.id);

/**
 * 【試遊用・Claude の仮】ヒョウズクの16枚（2026-10-30 指示書 W「ヒョウズクそのものの強さ」。初期配布は無いので、試遊のデッキの入れ替えにだけ使う。山札60枚に合わせる）。
 * ジオルの試遊（GEOL_PLAYTEST_16）と同じく、1〜13 を1枚ずつ、安い攻撃（1 ついばむ・3 こなゆき・4 つららおとし）を2枚に。
 * 攻撃13（ついばむ2・かぎづめ1・こなゆき2・つららおとし2・こおりのいき1・こおりわり1・きゅうこうか1・つららのあめ1・ふぶき1・ひょうが1）、
 * 守り3（はねでつつむ1・つばさのたて1・まいあがる1）。おとなきはばたき（レアの回避）は入れない（ジオルのうけとめると同じ）
 */
export const HYOUZUKU_PLAYTEST_16: readonly { readonly id: string; readonly copies: number }[] = [
  [1, 2], [2, 1], [3, 2], [4, 2], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1],
].map(([no, copies]) => ({ id: hyouzukuSkillId(no as number), copies: copies as number }));
