import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import hakuranData from './official/hakuran14_skills_OFFICIAL_20261031.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * ハクラン（2026-10-31 指示書 AF「新しいモンスター『ハクラン』（雷の高原の切り札・麒麟）を入れて試遊する」）。
 * 雷の高原（新しい B のダンジョン。まだ作っていない）に住む、白い体に青緑の鱗・金の角と蹄・雲のたてがみの麒麟。数字は JSON のとおりで確定。
 * 正本は src/data/official/hakuran14_skills_OFFICIAL_20261031.json（届いた JSON を無改変。同じ内容の CSV も無改変で並べて置く）。
 * 技名・分類・マナ・ダメージ・ライフ（7）は JSON からそのまま読む（tests/hakuran.test.ts で CSV とも照らし合わせる）。
 * 効果の文も JSON のまま。画面に出す短い文は src/data/skillCardText.ts（シシエンと同じ作り）。
 * ルールの細かい決まりは docs/battle-rules.md「ハクランの効果の扱い」（今ある効果だけ）
 *
 * ふつうの一覧（cards.ts の MONSTERS・SKILLS）に入れる。図鑑の番号はシシエンのあと。
 * 入手：まだ無い（雷の高原を作るときに決める）。どのダンジョン・相手・箱にも入れない（試遊の中だけで使う）。
 * ガチャのシリーズは economy.ts の GACHA_SERIES に1行あるが、モンスターカードを持つまで並ばない
 *
 * 2026-10-31 指示書 AF2（ユーザー決定）：LIFE 6→7・4 ひづめげり ダメージ 2→3・9 てんをかける ダメージ 4→5。JSON・CSV を直し、前の版は
 *   design-parts/cards-original/hakuran/*_v1_20261031.* に残す。正式モンスターカードの絵は LIFE 7 の版に差し替えた（下の「絵」）。モンスターカードの枠・パックの縁はハクランだけ暗く（ミュロルと見分けるため）
 *
 * ゲーム内 ID：mon-hakuran（ライフ7・内部ランク B。画面には出さない）、skl-hakuran-01〜14（JSON の no）
 * 絵（原本は design-parts/cards-original/hakuran/ に無改変）：
 * - 技 hakuran_sk_01〜14.webp（届いた hakuran_sk_NN.png を tools/art/card_art_webp.py で幅 827 の WebP に。番号＝技番号）
 * - 正式モンスターカード hakuran_official.webp（届いた hakuran_official_monstercard_LIFE6.png〔970×1622〕を tools/art/official_card_webp.py で 508×849 に）。
 *   2026-10-31 指示書 AF2 の追加：LIFE 7 に直した hakuran_official_monstercard_LIFE7.png から作り直した（LIFE6 の原本も残す）
 * - バトル用 hakuran_battlecard.png（届いた hakuran_battleart.png を無改変。1169×1346）
 * 色：青緑（ティール）#237C7A（モンスターカード枠・技カード枠とも）
 * ガチャのレアの枠（JSON の gacha_slot）：08 らいうん・10 せいなるいかずち・14 かすみのあゆみ（HAKURAN_GACHA_RARE）
 */
export const HAKURAN_MONSTER_ID = 'mon-hakuran';
export const hakuranSkillId = (no: number): string => `skl-hakuran-${twoDigits(no)}`;

/** ハクランの色（JSON の frame_color_hex） */
export const HAKURAN_COLOR: string = hakuranData.frame_color_hex;

export const HAKURAN_MONSTER: MonsterCard = {
  kind: 'monster',
  id: HAKURAN_MONSTER_ID,
  name: hakuranData.monster,
  rarity: null,
  life: hakuranData.life,
  themeColor: HAKURAN_COLOR,
  description: 'ハクラン。',
  isPlaceholder: false,
  // 図鑑・ショップなどのカード：名前と LIFE 入りの正式モンスターカード（シシエンと同じ使い方）
  art: { category: 'monsterCards', file: 'hakuran_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'hakuran_battlecard.png', layout: 'full' },
};

export interface HakuranRow {
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

export const HAKURAN_ROWS: readonly HakuranRow[] = hakuranData.skills;

/** JSON の分類（「防御技」「回避技」と書く。特殊技は無いがシシエンと同じ表） */
const CATEGORY: Readonly<Record<string, string>> = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' };

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す。キーは JSON の no）。新しい決まりは無い：
 * - 02 つのでこづく・05 みぬくひとみ・07 つのつき・08 らいうん・10 せいなるいかずち「回避されない」：
 *   ガウルの聖なる炎・セレフィーンのなみ打ちと同じ（どの回避でも避けられない。防御はできる）
 * - 01 ひづめならし：マナ0の攻撃（フルーネのつたはたきと同じ扱い。「消費マナ2以上」の回避ではよけられない）。効果の文は無いのでふつうの攻撃
 * - 11 くものころも：ちから技・かしこさ技−2（セレフィーンのミストヴェールと同じ）
 * - 12 ひらりとはねる：ちから技を回避。13 くもがくれ：かしこさ技を回避。14 かすみのあゆみ：消費マナに関係なく両方を回避（ウェーブダンスと同じ）
 */
const SPECIAL_EFFECTS: Readonly<Record<number, SkillEffect>> = {
  2: { type: 'attack', undodgeable: true },
  5: { type: 'attack', undodgeable: true },
  7: { type: 'attack', undodgeable: true },
  8: { type: 'attack', undodgeable: true },
  10: { type: 'attack', undodgeable: true },
  11: { type: 'defense', reduce: 2, against: 'all' },
  12: { type: 'evade', against: 'force' },
  13: { type: 'evade', against: 'wisdom' },
  14: { type: 'evade', against: 'all' },
};

/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const hakuranArtFile = (no: number): string => `hakuran_sk_${twoDigits(no)}.webp`;

function toSkill(row: HakuranRow): SkillCard {
  const category = CATEGORY[row.category];
  if (!category) throw new Error(`ハクランの技の分類が不明です: ${row.no} ${row.category}`);
  if (row.id !== hakuranSkillId(row.no)) throw new Error(`ハクランの技の ID が番号と合いません: ${row.no} ${row.id}`);
  const attack = category === 'force' || category === 'wisdom';
  const damage = attack ? Number(row.damage) : null;
  if (attack && !Number.isInteger(damage)) throw new Error(`ハクランの攻撃の技のダメージが読めません: ${row.no} ${row.damage}`);
  const o: OfficialSkill = {
    design_id: `HAKURAN-SK-${twoDigits(row.no)}`,
    number: row.no,
    name_ja: row.name,
    mana: row.mana,
    damage,
    category,
    effect_text_ja: row.effect === 'なし' ? null : row.effect,
  };
  return officialSkill(
    o,
    { label: 'ハクラン', monsterId: HAKURAN_MONSTER_ID, skillId: hakuranSkillId, artFile: hakuranArtFile, specialEffects: {} },
    { displayNo: row.no, ...(SPECIAL_EFFECTS[row.no] ? { effect: SPECIAL_EFFECTS[row.no] } : {}) },
  );
}

/** ハクランの技14種（JSON の番号の順） */
export const HAKURAN_SKILLS: readonly SkillCard[] = HAKURAN_ROWS.map(toSkill);

/** ガチャのレアの枠（JSON の gacha_slot が「レア」：08 らいうん・10 せいなるいかずち・14 かすみのあゆみ） */
export const HAKURAN_GACHA_RARE: readonly string[] = HAKURAN_ROWS.filter((r) => r.gacha_slot === 'レア').map((r) => r.id);

/**
 * 【試遊用・Claude の仮】ハクランの16枚（2026-10-31 指示書 AF の試遊「レア抜きの16枚」。初期配布は無いので、試遊のデッキの入れ替えにだけ使う）。
 * レア以外の技（01〜07・09・11〜13 の11種）を1枚ずつ＋マナの少ない攻撃技（1 ひづめならし・2 つのでこづく・3 くもだま・4 ひづめげり・5 みぬくひとみ）から2枚目を足して16枚（シシエンと同じ作り方）。
 * 攻撃13（ひづめならし2・つのでこづく2・くもだま2・ひづめげり2・みぬくひとみ2・くもをける1・つのつき1・てんをかける1。AF2 でも同じ16枚）、守り3（くものころも1・ひらりとはねる1・くもがくれ1）
 */
export const HAKURAN_PLAYTEST_16: readonly { readonly id: string; readonly copies: number }[] = [
  [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 1], [7, 1], [9, 1], [11, 1], [12, 1], [13, 1],
].map(([no, copies]) => ({ id: hakuranSkillId(no as number), copies: copies as number }));
