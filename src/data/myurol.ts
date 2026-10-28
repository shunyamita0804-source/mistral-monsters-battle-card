import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import myurol14Data from './official/myurol14_skills_OFFICIAL_20261027.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * ミュロル。2026-10-27 から技は正式14種（下の MYUROL_SKILLS の説明）。ここから下の段落は、それまでの経緯の記録。
 *
 * 【それまでの正式データ】ミュロルの技カード16種（2026-10-25。Mistral_Myurol_16Skills_Claude_Approved_20261025）。
 * 正本は src/data/official/myurol_skills_OFFICIAL_20261025.json・.csv（記録として残す。原本は design-parts/cards-original/myurol/）。
 * ゲーム内 ID：mon-myurol＝ミュロル（ライフ7）、skl-myurol-01〜16＝myurol_01〜16。絵は myu_sk_01〜16（2026-10-27 に assets から外した。原本は同じフォルダ）
 */
export const MYUROL_MONSTER_ID = 'mon-myurol';
export const myurolSkillId = (no: number): string => `skl-myurol-${twoDigits(no)}`;

/**
 * ミュロルの色（2026-10-27 ユーザー確定「モンスターカード枠：水色・技カード枠：水色」）。
 * 色の値は、届いた完成カード見本（REFERENCES/02_正式完成カード見本.jpeg。確認用）の枠の水色の中央値。
 * 見本から枠を切り抜いてはいない（枠は既存の正式な枠のテンプレートをこの色にした：tools/art/battle_card_frame.py・skillcard_v5_monster_color.py）
 */
export const MYUROL_COLOR = '#84E5FA';

/** ミュロルのモンスターカード。ライフ 7（2026-10-27 ユーザー確定）・内部ランク C（画面に出さない） */
export const MYUROL_MONSTER: MonsterCard = {
  kind: 'monster',
  id: MYUROL_MONSTER_ID,
  name: myurol14Data.monster,
  rarity: null,
  life: 7,
  themeColor: MYUROL_COLOR,
  description: 'ミュロル（水系）。',
  isPlaceholder: false,
  // 対戦画面のアイコンの切り抜きに使う絵：正式のバトル用の絵（透明つき 800×920。src/data/battleCards.ts と同じファイル）。
  // 名前・LIFE 入りの正式カードの1枚絵は無い（見本は確認用で貼らない）ので、図鑑などのカードはバトル用カードを重ねて描く（monsterCard.ts）
  battleArt: { category: 'monsterCards', file: 'myurol_battlecard.png', layout: 'full' },
  pendingSpec: ['rarity'],
};

/**
 * 【正式データ・2026-10-27】ミュロルの技14種（Myurol_Claude_Part1_SK01-07・Part2_SK08-14_and_Monster「ミュロル Claude実装用 統合パック」）。
 * 正本は src/data/official/myurol14_skills_OFFICIAL_20261027.json（届いた 02_正式技データ_初期配布_UTF8.json を無改変。同じ内容の CSV も無改変で並べて置く）。
 * ZIP の中身は design-parts/cards-original/myurol14-20261027/ に無改変で保管。技名・分類・マナ・ダメージ・効果の文は JSON からそのまま読む。
 *
 * ゲーム内 ID：それまでの同じ名前の技の ID をそのまま使う（ソラモ・ガウル・ラズック・ノビトンと同じ決まり。セーブの所持カードを守るため）。
 *   正式の番号（表示の番号 displayNo）が変わった技：スリップガード（旧14→12）・ひらりよける（旧15→13）・すべってよける（旧16→14）
 *   正式14技の外になった技：旧12 ぬるぬるガード（skl-myurol-12）・旧13 ぷるぷるガード（skl-myurol-13）。古いセーブは version 14 で所持・デッキから外す
 * 性能はそれまでと同じ（マナ・ダメージ・軽減値・回避の条件。効果の文だけ JSON の新しい書き方）
 * 絵：myu14_sk_01〜14.png（届いた 827×937 の PNG を1バイトも変えずに置いた。番号は正式の番号）
 * 初期配布16枚（2026-10-26 ユーザー正式確定。JSON の initial_count）：新しく始めたときの所持カードに入れる（初期デッキ60枚には入れない・
 *   モンスターカード本体は配らない・いまのセーブには配らない。ノビトンと同じ）。0枚の技は収集用（後から手に入る）
 *
 * まだ決まっていないこと（独断で決めない）：レアリティ・正式英語（仮訳）・効果の細かい裁定（docs/battle-rules.md「正式カード（ミュロル）」）
 */
export interface Myurol14Row {
  readonly number: number;
  readonly name: string;
  readonly category: string;
  readonly mana: number;
  readonly damage: number | null;
  readonly effect: string;
  readonly image: string;
  readonly initial_count: number;
}

export const MYUROL14_ROWS: readonly Myurol14Row[] = myurol14Data.skills;

const CATEGORY: Readonly<Record<string, string>> = { ちから: 'force', かしこさ: 'wisdom', 特殊: 'special', 防御: 'defense', 回避: 'evade' };

/** 正式の番号 → ゲーム内 ID（それまでの同じ名前の技の ID。tests/myurol.test.ts で名前の一致を確かめる） */
const MYUROL14_IDS: Readonly<Record<number, string>> = {
  1: myurolSkillId(1), // たいあたり
  2: myurolSkillId(2), // しっぽたたき
  3: myurolSkillId(3), // 連続ひっかき
  4: myurolSkillId(4), // アクアテール
  5: myurolSkillId(5), // みずでっぽう
  6: myurolSkillId(6), // バブルショット
  7: myurolSkillId(7), // アクアボール
  8: myurolSkillId(8), // しめったはだ
  9: myurolSkillId(9), // みずあび
  10: myurolSkillId(10), // しっぽガード
  11: myurolSkillId(11), // みずのまく
  12: myurolSkillId(14), // スリップガード（旧14）
  13: myurolSkillId(15), // ひらりよける（旧15）
  14: myurolSkillId(16), // すべってよける（旧16）
};

/** 2026-10-27 の正式14技で外れた技（旧12 ぬるぬるガード・旧13 ぷるぷるガード）。古いセーブは version 14 で所持・デッキから外す */
export const MYUROL_REMOVED_14_IDS: readonly string[] = [myurolSkillId(12), myurolSkillId(13)];

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す。キーは正式の番号。動きは 2026-10-25 からと同じ）。
 * - 08 しめったはだ：使ったミュロルが受けるちから技のダメージ−1。使った手番を含む2手番（＝相手の次の手番の終わりまで）。重ねがけなし。0未満にならない
 * - 09 みずあび：使ったミュロルのライフ+1（最大ライフ 7 まで）
 * - 10・11 防御：ちから技−2／かしこさ技−2
 * - 12 スリップガード：攻撃カードの必要マナが3以上のときだけ使える防御（両方−4）。いまのマナの残りとは関係ない
 * - 13 ひらりよける：ちから技を回避。14 すべってよける：攻撃カードの必要マナが2以下のちから・かしこさ技を回避
 */
const SPECIAL_EFFECTS: Readonly<Record<number, SkillEffect>> = {
  8: { type: 'shield', against: 'force', reduce: 1, turns: 2 },
  9: { type: 'healSelf', amount: 1 },
  10: { type: 'defense', reduce: 2, against: 'force' },
  11: { type: 'defense', reduce: 2, against: 'wisdom' },
  12: { type: 'defense', reduce: 4, against: 'all', minCost: 3 },
  13: { type: 'evade', against: 'force' },
  14: { type: 'evade', against: 'all', maxCost: 2 },
};

/** 技の絵のファイル名。JSON の image（Myurol_SKNN_ArtV2.png）の番号どおり */
export function myurolArtFile(row: Myurol14Row): string {
  const no = /^Myurol_SK(\d{2})_ArtV2\.png$/.exec(row.image)?.[1];
  if (!no || Number(no) !== row.number) throw new Error(`ミュロルの技の絵の番号が合いません: ${row.number} ${row.image}`);
  return `myu14_sk_${no}.png`;
}

function toSkill(row: Myurol14Row): SkillCard {
  const id = MYUROL14_IDS[row.number];
  const category = CATEGORY[row.category];
  if (!id || !category) throw new Error(`ミュロルの技の ID・分類がありません: ${row.number} ${row.category}`);
  const o: OfficialSkill = {
    design_id: `MYU14-SK-${twoDigits(row.number)}`,
    number: row.number,
    name_ja: row.name,
    mana: row.mana,
    damage: row.damage,
    category,
    // 攻撃は「なし」（ダメージの数字だけ）。それ以外は効果の文をそのまま
    effect_text_ja: row.effect === 'なし' ? null : row.effect,
    availability: row.initial_count > 0 ? 'initial' : 'collect',
  };
  return officialSkill(
    o,
    { label: 'ミュロル', monsterId: MYUROL_MONSTER_ID, skillId: () => id, artFile: () => myurolArtFile(row), specialEffects: {} },
    { id, displayNo: row.number, ...(SPECIAL_EFFECTS[row.number] ? { effect: SPECIAL_EFFECTS[row.number] } : {}) },
  );
}

/** ミュロルの技14種（正式の番号の順。2026-10-27） */
export const MYUROL_SKILLS: readonly SkillCard[] = MYUROL14_ROWS.map(toSkill);

/** 初期配布16枚（技の ID と枚数。0枚の技は入れない） */
export const MYUROL_STARTER: readonly { readonly id: string; readonly copies: number }[] = MYUROL14_ROWS.filter((r) => r.initial_count > 0).map((r) => ({
  id: MYUROL14_IDS[r.number] as string,
  copies: r.initial_count,
}));
