import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';
import soramo14 from './official/soramo14_artv2_skills_OFFICIAL_20261026.json';
import themeColors from './official/monster_theme_colors.json';

/**
 * 【正式データ】ソラモの技カード14種（2026-10-25 ユーザー確定。MistralBC_Soramo14_Claude_NewUI_Implementation_20261025）。
 *
 * 正本は 2026-10-26 に届いた 02_SKILL_DATA/Soramo_14Skills_ArtV2_Starter16_UTF8.json（Soramo_ArtV2_14Skills_Claude_Implementation_Starter16。
 * 無改変で src/data/official/soramo14_artv2_skills_OFFICIAL_20261026.json に置いた。CSV も同じフォルダに無改変）。
 * ZIP の中身はすべて design-parts/cards-original/soramo14-artv2-20261026/ に無改変で保管。
 * 技名・分類・マナ・ダメージ・効果・初期配布は 2026-10-25 の版と同じ（違いは絵の版 art_version: "2" の欄が増えたことだけ）
 * 技名・分類・マナ・ダメージ・効果の文・初期配布の枚数は、ここで書き換えずに JSON からそのまま読む（tests/soramo.test.ts で CSV とも照合）。
 *
 * ゲーム内 ID：skl-soramo14-01〜14（JSON の id soramo_skill_01〜14 はデザイン ID として持つ）。
 * 旧16技（skl-soramo-01〜16）とは番号を流用しない。旧16技はゲームから削除し、古いセーブからも外す（2026-10-25 ユーザー決定「削除」。saveData.ts の version 9）
 * 絵：sor14v2_sk_01〜14.png＝技イラスト Art Ver.2（2026-10-26。届いた 827×937 の PNG を1バイトも変えずに置いた。名前だけ素材の命名規則に合わせた）。
 *   それまでの絵（sor14_sk_01〜14.png）と原本（design-parts/cards-original/soramo14-20261025/）は外した（git の履歴にある）
 *
 * 初期配布（JSON の starter_copies）：02・03・04・07・09・10・11・13 を2枚ずつ＝16枚（ユーザー確定）。
 * 01・05・06・08・12・14 は初期配布0枚（登録はする。入手方法・排出率は未定なので、パックなどには入れていない）
 */
export const SORAMO_MONSTER_ID = 'mon-soramo';
export const soramoSkillId = (no: number): string => `skl-soramo14-${twoDigits(no)}`;

/** 旧16技のゲーム内 ID（2026-10-25 に削除。古いセーブから外すのに使う） */
export const SORAMO_OLD_SKILL_IDS: readonly string[] = Array.from({ length: 16 }, (_, i) => `skl-soramo-${twoDigits(i + 1)}`);

/**
 * ソラモのモンスターカード（2026-10-23 正式。Mismon_MonsterCards_Official_and_Battle_20261023）。
 * ライフ 7 は正式カードの絵に書かれた値。絵は2種類：正式カード（名前・LIFE 入り。ショップ・図鑑・自宅）とバトル用（文字なし）
 */
export const SORAMO_MONSTER: MonsterCard = {
  kind: 'monster',
  id: SORAMO_MONSTER_ID,
  name: 'ソラモ',
  rarity: null,
  life: 7,
  themeColor: themeColors.monsters.soramo.hex,
  description: 'ソラモ（モンスターランクC）。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'soramo_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'soramo_battle.webp', layout: 'full' },
  pendingSpec: ['rarity'],
};

/** 届いた JSON の1行 */
export interface Soramo14Row {
  readonly id: string;
  readonly number: number;
  readonly monster: string;
  readonly name: string;
  readonly category: string;
  readonly mana: number;
  readonly damage: number | null;
  readonly effect: string;
  readonly image: string;
  readonly starter_copies: number;
  /** 技イラストの版（2026-10-26 の Art Ver.2 は "2"） */
  readonly art_version?: string;
}

export const SORAMO14_ROWS: readonly Soramo14Row[] = soramo14;

/** JSON の分類 → ゲームの種別 */
const CATEGORY: Readonly<Record<string, string>> = { strength: 'force', intelligence: 'wisdom', special: 'special', defense: 'defense', dodge: 'evade' };

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す）。
 * - 09 すなかけ「相手は次の攻撃を行えなくなる」：選んだ相手モンスター1体は、持ち主の次の手番に攻撃の技を使えない（いまのすなかけと同じ動き）
 * - 10 吠える「相手の手札からランダムに1枚を捨てさせる」：相手の手札からランダムに1枚を相手の捨て札へ。相手の手札がなければ使えない（新しい動き）
 * - 11 まるまる・12 星のまもり：ちから技−3／かしこさ技−3（0未満にならない）
 * - 13 ひらりジャンプ：攻撃カードの必要マナが2以上のちから・かしこさ技を回避。14 星影ステップ：ちから・かしこさ技を回避（条件なし）
 * 【要仕様確定】docs/battle-rules.md「正式カード（ソラモ14技）」
 */
const SPECIAL_EFFECTS: Readonly<Record<string, SkillEffect>> = {
  soramo_skill_09: { type: 'seal' },
  soramo_skill_10: { type: 'discardRandom' },
  soramo_skill_11: { type: 'defense', reduce: 3, against: 'force' },
  soramo_skill_12: { type: 'defense', reduce: 3, against: 'wisdom' },
  soramo_skill_13: { type: 'evade', against: 'all', minCost: 2 },
  soramo_skill_14: { type: 'evade', against: 'all' },
};

function toOfficial(row: Soramo14Row): OfficialSkill {
  const category = CATEGORY[row.category];
  if (!category) throw new Error(`ソラモの技の分類が不明です: ${row.id} ${row.category}`);
  return {
    design_id: row.id,
    number: row.number,
    name_ja: row.name,
    mana: row.mana,
    damage: row.damage,
    category,
    effect_text_ja: row.effect === '' ? null : row.effect,
    availability: row.starter_copies > 0 ? 'initial' : 'collect',
  };
}

/** 技の絵のファイル名（assets/images/cards/skills/。Art Ver.2）。JSON の image（01_SKILL_IMAGES/Soramo_Skill_NN.png）の番号どおり */
export function soramoArtFile(row: Soramo14Row): string {
  const no = /Soramo_Skill_(\d{2})\.png$/.exec(row.image)?.[1];
  if (!no || Number(no) !== row.number) throw new Error(`ソラモの技の絵の番号が合いません: ${row.id} ${row.image}`);
  return `sor14v2_sk_${no}.png`;
}

export const SORAMO_SKILLS: readonly SkillCard[] = SORAMO14_ROWS.map((row) =>
  officialSkill(toOfficial(row), {
    label: 'ソラモ',
    monsterId: SORAMO_MONSTER_ID,
    skillId: soramoSkillId,
    artFile: () => soramoArtFile(row),
    specialEffects: SPECIAL_EFFECTS,
  }),
);

/** ソラモの初期配布（ゲーム内 ID と枚数。JSON の starter_copies のまま。合計16枚） */
export const SORAMO_STARTER: readonly { readonly id: string; readonly copies: number }[] = SORAMO14_ROWS.filter((r) => r.starter_copies > 0).map((r) => ({
  id: soramoSkillId(r.number),
  copies: r.starter_copies,
}));

/**
 * 【テスト用】相手（大会・ダンジョン・練習試合）のモンスター：ソラモ3体（2026-10-23 ユーザー指示「技の発動を見るため、仮のカードはすべてソラモに」）。
 * 正式な相手の編成は未定
 */
export const SORAMO_TEAM: readonly string[] = [SORAMO_MONSTER_ID, SORAMO_MONSTER_ID, SORAMO_MONSTER_ID];
