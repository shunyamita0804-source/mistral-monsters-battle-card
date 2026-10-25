import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import officialData from './official/myurol_skills_OFFICIAL_20261025.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * 【正式データ】ミュロルの技カード16種（2026-10-25 ユーザーが技の絵16枚を正式採用。Mistral_Myurol_16Skills_Claude_Approved_20261025）。
 *
 * 正本は届いた 02_技データ_UTF8.json（無改変で src/data/official/myurol_skills_OFFICIAL_20261025.json に置いた。
 * 01_技一覧_UTF8.csv も同じフォルダに無改変）。ZIP の中身はすべて design-parts/cards-original/myurol/ に無改変で保管。
 * 技名・種別・マナ・効果の文は、ここで書き換えずに JSON からそのまま読む（tests/myurol.test.ts で CSV とも照らし合わせる）。
 *
 * ゲーム内 ID と JSON の ID の対応（docs/card-data-policy.md にも記録）：
 *   mon-myurol＝ミュロル（ライフ7）、skl-myurol-01〜16＝myurol_01〜16（番号は同じ。JSON の id はデザイン ID として持つ）
 * 絵：技 myu_sk_01〜07.png・myu_sk_08〜16.jpg。JSON の image（SKILLS/Myurol_NN_技名.png|jpg）を番号で1対1に写したもので、
 *   中身は1バイトも変えていない（変換・再圧縮・縮小・切り抜きなし。ファイル名だけ素材の命名規則〔英小文字〕に合わせた）。
 *   名前の似ている絵を探すのではなく、JSON の image に書かれたファイルをそのまま使う
 *
 * まだ決まっていないこと（独断で決めない）：
 * - 初期配布／収集用の区分：JSON の distribution_proposal は「案」（distribution_confirmed: false）。ゲームの区分（availability）には入れず、
 *   画面にも出さない（pendingSpec に 'availability'）。案は MYUROL_DISTRIBUTION_PROPOSAL に持つだけ
 * - モンスターカードの絵（届いていない。pendingSpec に 'art'。仮の絵で表示）・枠色（仮の候補 THEME_COLOR_CANDIDATE）
 * - レアリティ・正式英語（いまは仮訳）・配る枚数・パック・敵の編成（ノビトンと同じく、スターター・パック・相手の編成には入れていない）
 * - 効果の細かい裁定（docs/battle-rules.md の「正式カード（ミュロル）」）
 */
export const MYUROL_MONSTER_ID = 'mon-myurol';
export const myurolSkillId = (no: number): string => `skl-myurol-${twoDigits(no)}`;

/** 枠色の仮の候補：技の絵のミュロルの水色。承認された色ではない（monster_theme_colors.json にミュロルが無い） */
export const THEME_COLOR_CANDIDATE = '#7EC4E8';

interface MyurolSkillRow {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly type: string;
  readonly mana: number;
  readonly effect_text: string;
  readonly distribution_proposal: string;
  readonly distribution_confirmed: boolean;
  readonly image: string;
}

export const MYUROL_ROWS: readonly MyurolSkillRow[] = officialData.skills;

/** JSON の種別（日本語）→ ゲームの種別 */
const CATEGORY: Readonly<Record<string, string>> = { ちから: 'force', かしこさ: 'wisdom', 特殊: 'special', 防御: 'defense', 回避: 'evade' };

/** 技の絵のファイル名（assets/images/cards/skills/）。拡張子は JSON の image のまま（01〜07 は png、08〜16 は jpg） */
export function myurolArtFile(row: MyurolSkillRow): string {
  const ext = /\.(png|jpg)$/.exec(row.image)?.[1];
  if (!ext) throw new Error(`ミュロルの技の絵の形式が不明です: ${row.image}`);
  return `myu_sk_${twoDigits(row.number)}.${ext}`;
}

/** 初期配布／収集用の「案」（未確定。ゲームでは使わない） */
export const MYUROL_DISTRIBUTION_PROPOSAL: Readonly<Record<string, 'initial' | 'collectible'>> = Object.fromEntries(
  MYUROL_ROWS.map((r) => [myurolSkillId(r.number), r.distribution_proposal === 'initial' ? 'initial' : 'collectible']),
);

/** ミュロルのモンスターカード。ライフ 7・内部ランク C（画面に出さない）。モンスターカードの絵はまだ無い */
export const MYUROL_MONSTER: MonsterCard = {
  kind: 'monster',
  id: MYUROL_MONSTER_ID,
  name: officialData.monster,
  rarity: null,
  life: officialData.life,
  themeColor: THEME_COLOR_CANDIDATE,
  description: 'ミュロル（水系・モンスターランクC）。',
  isPlaceholder: false,
  pendingSpec: ['rarity', 'art'],
};

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す）。
 * - 08 しめったはだ：使ったミュロルが受けるちから技のダメージ−1。使った手番を含む2手番（＝相手の次の手番の終わりまで）。重ねがけなし。0未満にならない
 * - 09 みずあび：使ったミュロルのライフ+1（最大ライフ 7 まで）
 * - 10〜13 防御：ちから技−2／かしこさ技−2／両方−2／両方−1（マナ0）
 * - 14 スリップガード：攻撃カードの必要マナが3以上のときだけ使える防御（両方−4）。いまのマナの残りとは関係ない
 * - 15 ひらりよける：ちから技を回避。16 すべってよける：攻撃カードの必要マナが2以下のちから・かしこさ技を回避
 * 【要仕様確定】docs/battle-rules.md「正式カード（ミュロル）」
 */
const SPECIAL_EFFECTS: Readonly<Record<string, SkillEffect>> = {
  myurol_08: { type: 'shield', against: 'force', reduce: 1, turns: 2 },
  myurol_09: { type: 'healSelf', amount: 1 },
  myurol_10: { type: 'defense', reduce: 2, against: 'force' },
  myurol_11: { type: 'defense', reduce: 2, against: 'wisdom' },
  myurol_12: { type: 'defense', reduce: 2, against: 'all' },
  myurol_13: { type: 'defense', reduce: 1, against: 'all' },
  myurol_14: { type: 'defense', reduce: 4, against: 'all', minCost: 3 },
  myurol_15: { type: 'evade', against: 'force' },
  myurol_16: { type: 'evade', against: 'all', maxCost: 2 },
};

/** JSON の1行を、ほかの正式カードと同じ形（OfficialSkill）にする。攻撃は「ダメージn」だけなので効果の文はなし */
function toOfficial(row: MyurolSkillRow): OfficialSkill {
  const category = CATEGORY[row.type];
  if (!category) throw new Error(`ミュロルの技の種別が不明です: ${row.id} ${row.type}`);
  const attack = category === 'force' || category === 'wisdom';
  const damage = attack ? /^ダメージ(\d+)$/.exec(row.effect_text)?.[1] : undefined;
  if (attack && damage === undefined) throw new Error(`ミュロルの攻撃の技のダメージが読めません: ${row.id} ${row.effect_text}`);
  return {
    design_id: row.id,
    number: row.number,
    name_ja: row.name,
    mana: row.mana,
    damage: damage !== undefined ? Number(damage) : null,
    category,
    effect_text_ja: attack ? null : row.effect_text,
  };
}

export const MYUROL_SKILLS: readonly SkillCard[] = MYUROL_ROWS.map((row) => ({
  ...officialSkill(toOfficial(row), {
    label: 'ミュロル',
    monsterId: MYUROL_MONSTER_ID,
    skillId: myurolSkillId,
    artFile: () => myurolArtFile(row),
    specialEffects: SPECIAL_EFFECTS,
  }),
  pendingSpec: ['rarity', 'availability'],
}));
