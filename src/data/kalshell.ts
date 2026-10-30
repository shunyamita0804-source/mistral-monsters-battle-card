import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import kalshellData from './official/kalshell14_skills_OFFICIAL_20261027.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * 【正式データ・2026-10-27】カルシェル（Kalshell_Part1〜3「カルシェル 統合管理パック」）。
 * 正本は src/data/official/kalshell14_skills_OFFICIAL_20261027.json（届いた 03_正式技データと初期配布_UTF8.json を無改変。
 * 同じ内容の CSV 2つ〔正式技一覧・初期配布16枚〕も無改変で並べて置く）。ZIP の中身は design-parts/cards-original/kalshell14-20261027/ に無改変で保管。
 * 技名・分類・マナ・ダメージ・効果の文・ライフ・初期配布の枚数は JSON からそのまま読む（tests/kalshell.test.ts で CSV とも照らし合わせる）。
 *
 * ゲーム内 ID：mon-kalshell＝カルシェル（ライフ8）、skl-kalshell-01〜14＝正式の番号 1〜14（新しいモンスターなので引き継ぐ ID はない）
 * 絵：技 kal_sk_01〜14.png（届いた 02_ASSETS/Skills/Kalshell_SKNN_…_ArtV2.png を番号で1対1に、1バイトも変えずに置いた）。
 *   バトル用：kalshell_battlecard.png（02_ASSETS/BattleArt/Kalshell_BattleArt_Transparent_Approved.png を無改変。1169×1345。
 *   資料「800×920 に合わせる必要があれば縮小・配置調整のみ」→ ゲームは表示のときに縮めて置くので、ファイルは変えていない）
 * 名前・LIFE 入りの正式モンスターカード（02_ASSETS/MonsterCard/）は「そのまま1枚絵として流用しない」との資料の注意に従い貼らない
 *   （ミュロルと同じく、図鑑などのカードは背景・モンスター・枠・名前・LIFE をゲームが重ねて描く。monsterCard.ts）
 * 色：淡い氷色 #DFF2F6（資料の「推奨基準色」。モンスターカード枠・技カード枠とも）。枠は既存の正式な枠のテンプレートをこの色にした
 *   （tools/art/battle_card_frame.py・skillcard_v5_monster_color.py）
 * 初期配布16枚（JSON の initial_distribution）：新しく始めたときの所持カードに入れる（初期デッキ60枚には入れない・
 *   モンスターカード本体は配らない・いまのセーブには配らない。ノビトン・ミュロルと同じ）。0枚の技は収集用（後から手に入る）
 *
 * まだ決まっていないこと（独断で決めない）：レアリティ・正式英語（仮訳）・パック・敵の編成・効果の細かい裁定（docs/battle-rules.md「正式カード（カルシェル）」）
 */
export const KALSHELL_MONSTER_ID = 'mon-kalshell';
export const kalshellSkillId = (no: number): string => `skl-kalshell-${twoDigits(no)}`;

/** カルシェルの色（資料の推奨基準色。JSON の frame_color_hex） */
export const KALSHELL_COLOR: string = kalshellData.frame_color_hex;

/** カルシェルのモンスターカード。ライフは JSON の life（8）・内部ランクは未定（画面に出さない） */
export const KALSHELL_MONSTER: MonsterCard = {
  kind: 'monster',
  id: KALSHELL_MONSTER_ID,
  name: kalshellData.monster,
  rarity: null,
  life: kalshellData.life,
  themeColor: KALSHELL_COLOR,
  description: 'カルシェル（水系）。',
  isPlaceholder: false,
  // 図鑑・箱を受け取る窓・取得カード・祭壇などのカード：名前と LIFE 入りの正式モンスターカード（2026-10-30 指示書 P。
  // 届いた design-parts/cards-original/kalshell-official-20261030/kalshell_official_monstercard_LIFE8.png を幅 508 に縮めただけ。ソラモ・プカリムと同じ使い方）
  art: { category: 'monsterCards', file: 'kalshell_official.webp', layout: 'full' },
  // 対戦画面のアイコンの切り抜き：正式のバトル用の絵（src/data/battleCards.ts と同じファイル）
  battleArt: { category: 'monsterCards', file: 'kalshell_battlecard.png', layout: 'full' },
  pendingSpec: ['rarity'],
};

export interface KalshellRow {
  readonly no: number;
  readonly name: string;
  readonly category: string;
  readonly mana: number;
  /** 攻撃はダメージの数字（文字）、それ以外は「なし」 */
  readonly damage: string;
  /** 効果の文（なければ「なし」） */
  readonly effect: string;
}

export const KALSHELL_ROWS: readonly KalshellRow[] = kalshellData.skills;

const CATEGORY: Readonly<Record<string, string>> = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' };

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す。キーは正式の番号）。
 * - 04 コーラルスピア「回避されない」：どの回避でも避けられない。防御は使える（ガウルの聖なる炎と同じ）
 * - 09 いかくのハサミ「指定した相手モンスター1体は次のターン攻撃技を使えない」：ソラモのすなかけ・ガウルの威嚇と同じ（seal）
 * - 10 すなをほる「次のターン攻撃対象にならない」：使ったカルシェルは、相手の次の手番のあいだ攻撃の技の対象にならない（hide。2026-10-27 新しい動き）
 * - 11〜13 防御：ちから技−3／かしこさ技−3／両方−5
 * - 14 しおのステップ「消費マナ2以上のちから技を回避」：攻撃カードの必要マナが2以上のちから技だけ回避
 * 【要仕様確定】docs/battle-rules.md「正式カード（カルシェル）」
 */
const SPECIAL_EFFECTS: Readonly<Record<number, SkillEffect>> = {
  4: { type: 'attack', undodgeable: true },
  9: { type: 'seal' },
  10: { type: 'hide' },
  11: { type: 'defense', reduce: 3, against: 'force' },
  12: { type: 'defense', reduce: 3, against: 'wisdom' },
  13: { type: 'defense', reduce: 5, against: 'all' },
  14: { type: 'evade', against: 'force', minCost: 2 },
};

/** 初期配布の枚数（技の番号 → 枚数。JSON の initial_distribution） */
const INITIAL_COUNT: ReadonlyMap<number, number> = new Map(kalshellData.initial_distribution.map((d) => [d.no, d.count]));

/** 技の絵のファイル名（届いた Kalshell_SKNN_…_ArtV2.png を番号で置いたもの） */
export const kalshellArtFile = (no: number): string => `kal_sk_${twoDigits(no)}.png`;

function toSkill(row: KalshellRow): SkillCard {
  const category = CATEGORY[row.category];
  if (!category) throw new Error(`カルシェルの技の分類が不明です: ${row.no} ${row.category}`);
  const attack = category === 'force' || category === 'wisdom';
  const damage = attack ? Number(row.damage) : null;
  if (attack && !Number.isInteger(damage)) throw new Error(`カルシェルの攻撃の技のダメージが読めません: ${row.no} ${row.damage}`);
  if (!INITIAL_COUNT.has(row.no)) throw new Error(`カルシェルの技の初期配布の枚数がありません: ${row.no}`);
  const o: OfficialSkill = {
    design_id: `KAL-SK-${twoDigits(row.no)}`,
    number: row.no,
    name_ja: row.name,
    mana: row.mana,
    damage,
    category,
    // 「なし」は効果の文なし（攻撃はダメージの数字だけ）。それ以外は効果の文をそのまま
    effect_text_ja: row.effect === 'なし' ? null : row.effect,
    availability: (INITIAL_COUNT.get(row.no) ?? 0) > 0 ? 'initial' : 'collect',
  };
  return officialSkill(
    o,
    { label: 'カルシェル', monsterId: KALSHELL_MONSTER_ID, skillId: kalshellSkillId, artFile: kalshellArtFile, specialEffects: {} },
    { displayNo: row.no, ...(SPECIAL_EFFECTS[row.no] ? { effect: SPECIAL_EFFECTS[row.no] } : {}) },
  );
}

/** カルシェルの技14種（正式の番号の順） */
export const KALSHELL_SKILLS: readonly SkillCard[] = KALSHELL_ROWS.map(toSkill);

/** 初期配布16枚（技の ID と枚数。0枚の技は入れない） */
export const KALSHELL_STARTER: readonly { readonly id: string; readonly copies: number }[] = kalshellData.initial_distribution
  .filter((d) => d.count > 0)
  .map((d) => ({ id: kalshellSkillId(d.no), copies: d.count }));
