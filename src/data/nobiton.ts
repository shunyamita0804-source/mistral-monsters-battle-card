import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import officialSkills from './official/nobiton_cards_OFFICIAL_20261025.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * 【正式データ】ノビトンの技カード16種（2026-10-25 ユーザー正式確定。MistralMonstersBC_Nobiton_FINAL_Part1/Part2_20261025）。
 *
 * 正本は届いた docs/02_SKILL_DATA_UTF8.tsv（無改変で src/data/official/nobiton_skills_OFFICIAL_20261025.tsv と
 * design-parts/cards-original/nobiton/docs/ に保管）。ゲームはそれを写した src/data/official/nobiton_cards_OFFICIAL_20261025.json を読む
 * （技名・マナ・ダメージ・効果の文・初期/収集の区分は書き換えていない。テストで TSV と照らし合わせる）。
 *
 * ゲーム内 ID とデザイン ID の対応（docs/card-data-policy.md にも記録）：
 *   mon-nobiton＝ノビトン（ライフ8）、skl-nobiton-01〜16＝NOB-SK-01〜16（番号は同じ）
 * 絵：技 nob_sk_01〜16.webp（原本 PNG は design-parts/cards-original/nobiton/ に無改変。縦横比を変えずに幅 827 へ縮めただけ）。
 *   モンスター nobiton_official.webp（正式モンスターカード JPEG を幅 508 に）・nobiton_battle.webp（バトル用 PNG 556×941 をそのまま WebP に）
 * 初期配布8種（01・02・05・08・10・11・13・15）／収集用8種（03・04・06・07・09・12・14・16）はユーザー確定。TSV の区分どおり
 *
 * まだ決まっていないこと（独断で決めない）：
 * - 枠色（テーマ色）：monster_theme_colors.json にノビトンが無いので、バトル用カードの枠の金色から仮に決めた（THEME_COLOR_CANDIDATE）
 * - レアリティ・正式英語（いまは仮訳）・配る枚数・パック・価格・敵の編成（ガウルと同じく、スターター・パック・相手の編成には入れていない）
 * - 効果の細かい裁定（docs/battle-rules.md の「正式カード（ノビトン）」）
 */
export const NOBITON_MONSTER_ID = 'mon-nobiton';
export const nobitonSkillId = (no: number): string => `skl-nobiton-${twoDigits(no)}`;

/** 枠色の仮の候補：バトル用カード（battle_card_official.png）の枠の金色。承認された色ではない */
export const THEME_COLOR_CANDIDATE = '#E8C654';

/** ノビトンのモンスターカード。ライフ 8 は正式モンスターカードの絵の値（LIFE 8）。内部ランク C（画面に出さない） */
export const NOBITON_MONSTER: MonsterCard = {
  kind: 'monster',
  id: NOBITON_MONSTER_ID,
  name: officialSkills.name_ja,
  rarity: null,
  life: officialSkills.monster_life,
  themeColor: THEME_COLOR_CANDIDATE,
  description: 'ノビトン（モンスターランクC）。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'nobiton_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'nobiton_battle.webp', layout: 'full' },
  pendingSpec: ['rarity'],
};

/**
 * 効果テキストのある技の、ゲームでの動き（効果テキストの文は書き換えず、動きだけをここで表す）。
 * - 03 まきつく「対象は次ターン行動不可」：回避されなければ、対象は次の手番に技を使えない（攻撃も特殊も。守備のカードは使える）
 * - 05 くしゃみ・07 ダウナーミスト「相手マナ−1／−3」：回避されなければ、相手のマナを減らす（0 より下にはならない）
 * - 06 ミラージュノーズ「回避不可」：回避カードは使えない（回避の条件が合っていても）。防御は使える
 * - 08 考える：使ったカードを除く手札をすべて山札へ戻してシャッフルし、同じ枚数を引く
 * - 09 不思議な嗅覚：相手の手札をすべて確認（画面に表を見せる。手札は動かさない）
 * - 10〜14 防御：ちから技−2／かしこさ技−2／両方−3／両方−1（マナ0）／両方−5
 * - 15 横によける：ちから技を回避。16 必死によける：ちから・かしこさ技を回避（条件なし）
 * 【要仕様確定】docs/battle-rules.md「正式カード（ノビトン）」
 */
const SPECIAL_EFFECTS: Readonly<Record<string, SkillEffect>> = {
  'NOB-SK-03': { type: 'attack', stunTarget: true },
  'NOB-SK-05': { type: 'attack', manaDrain: 1 },
  'NOB-SK-06': { type: 'attack', undodgeable: true },
  'NOB-SK-07': { type: 'attack', manaDrain: 3 },
  'NOB-SK-08': { type: 'redrawHand' },
  'NOB-SK-09': { type: 'revealHand' },
  'NOB-SK-10': { type: 'defense', reduce: 2, against: 'force' },
  'NOB-SK-11': { type: 'defense', reduce: 2, against: 'wisdom' },
  'NOB-SK-12': { type: 'defense', reduce: 3, against: 'all' },
  'NOB-SK-13': { type: 'defense', reduce: 1, against: 'all' },
  'NOB-SK-14': { type: 'defense', reduce: 5, against: 'all' },
  'NOB-SK-15': { type: 'evade', against: 'force' },
  'NOB-SK-16': { type: 'evade', against: 'all' },
};

export const NOBITON_SKILLS: readonly SkillCard[] = (officialSkills.skill_cards as readonly OfficialSkill[]).map((o) =>
  officialSkill(o, {
    label: 'ノビトン',
    monsterId: NOBITON_MONSTER_ID,
    skillId: nobitonSkillId,
    artFile: (no) => `nob_sk_${twoDigits(no)}.webp`,
    specialEffects: SPECIAL_EFFECTS,
  }),
);
