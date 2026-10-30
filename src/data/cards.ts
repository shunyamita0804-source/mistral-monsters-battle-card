import { createCardCatalog } from '../game/cards/cardCatalog.ts';
import type { MonsterCard, PlayCard, Rarity, SkillCard, SkillEffect, StatType, SupportCard } from '../game/cards/cardTypes.ts';
import { GAUUL_MONSTER, GAUUL_SKILLS } from './gauul.ts';
import { KALSHELL_MONSTER, KALSHELL_SKILLS } from './kalshell.ts';
import { PUKARIM_MONSTER, PUKARIM_SKILLS } from './pukarim.ts';
import { GEOL_MONSTER, GEOL_SKILLS } from './geol.ts';
import { FLUNE_MONSTER, FLUNE_SKILLS } from './flune.ts';
import { SEREPHINE_MONSTER, SEREPHINE_SKILLS } from './serephine.ts';
import { TSUMUJI_MONSTER, TSUMUJI_SKILLS } from './tsumuji.ts';
import { HYOUZUKU_MONSTER, HYOUZUKU_SKILLS } from './hyouzuku.ts';
import { SHISHIEN_MONSTER, SHISHIEN_SKILLS } from './shishien.ts';
import { LAZUCK_MONSTER, LAZUCK_SKILLS } from './lazuck.ts';
import { MYUROL_MONSTER, MYUROL_SKILLS } from './myurol.ts';
import { NOBITON_MONSTER, NOBITON_SKILLS } from './nobiton.ts';
import { SORAMO_MONSTER, SORAMO_SKILLS } from './soramo.ts';

/**
 * 【仮データ】カード一覧。
 *
 * 正式なモンスター・技カードのデータと画像は、このリポジトリにはまだない（docs/nightbatch-2026-10-22-report.md の不足一覧）。
 * そのため、名前は「仮モンスターA」「仮技A-1」のように仮であることがわかる形にしている。
 * 数値（ライフ・マナ・ちから/かしこさ）もすべて仮。正式データが届いたらこのファイルを差し替える。
 *
 * 2026-10-23：初めての正式カード（ソラモの技16種）を src/data/soramo.ts から足した。仮カードは消さずに残す（セーブの所持カードを守るため）。
 * 2026-10-23：ラズックと技16種を src/data/lazuck.ts から足した（用途は未定）。
 * 2026-10-25：ノビトンと技16種を src/data/nobiton.ts から足した。
 * 2026-10-25：ミュロルと技16種を src/data/myurol.ts から足した。2026-10-27 に正式14技・バトル用カード（水色の枠）に。
 * 2026-10-27：カルシェルと技14種を src/data/kalshell.ts から足した。
 * 2026-10-29：プカリムと技14種を確認用の一覧からふつうの一覧へ移した（src/data/pukarim.ts）。
 * 2026-10-29：ジオルと技14種も確認用の一覧からふつうの一覧へ移した（src/data/geol.ts。ジオルの最終）。仮ジオル（tmp-geol）はゲームから外した
 * 2026-10-29：フルーネと技14種を足した（src/data/flune.ts。フルーネの最終）。仮フルーネ（tmp-flune）はゲームから外した
 * 2026-10-29：セレフィーンと技14種を足した（src/data/serephine.ts。セレフィーンの最終）
 * 2026-10-30：ツムジと技14種を足した（src/data/tsumuji.ts。指示書 U）
 * 2026-10-30：ヒョウズクと技14種を足した（src/data/hyouzuku.ts。指示書 W）
 * 2026-10-31：シシエンと技14種を足した（src/data/shishien.ts。指示書 AB）
 */

interface MonsterSeed {
  readonly key: string;
  readonly life: number;
  readonly color: string;
  /** 得意な能力（技の数値の割り当てに使う） */
  readonly main: StatType;
}

const MONSTER_SEEDS: readonly MonsterSeed[] = [
  { key: 'a', life: 10, color: '#d65a4a', main: 'force' },
  { key: 'b', life: 11, color: '#3f7fd6', main: 'wisdom' },
  { key: 'c', life: 12, color: '#4aa65a', main: 'force' },
  { key: 'd', life: 10, color: '#d9a13a', main: 'wisdom' },
  { key: 'e', life: 12, color: '#8a5bd0', main: 'force' },
  { key: 'f', life: 11, color: '#2bb0b0', main: 'wisdom' },
  { key: 'g', life: 13, color: '#c0504d', main: 'force' },
  { key: 'h', life: 11, color: '#5b8bd0', main: 'wisdom' },
  { key: 'i', life: 12, color: '#9aa63a', main: 'force' },
];

const other = (s: StatType): StatType => (s === 'force' ? 'wisdom' : 'force');

export const monsterId = (key: string): string => `mon-${key}`;
export const skillId = (key: string, no: number): string => `skl-${key}-${no}`;

function makeMonster(seed: MonsterSeed): MonsterCard {
  const label = seed.key.toUpperCase();
  return {
    kind: 'monster',
    id: monsterId(seed.key),
    name: `仮モンスター${label}`,
    rarity: 'R',
    life: seed.life,
    themeColor: seed.color,
    description: '画面確認用の仮モンスターです。正式なモンスターデータではありません。',
    isPlaceholder: true,
  };
}

interface SkillSeed {
  readonly no: number;
  readonly cost: number;
  readonly stat: 'main' | 'other';
  readonly value: number;
  readonly effect: SkillEffect;
  readonly rarity: Rarity;
}

/** 6番目の技（モンスターごとに種類を変える） */
const SIXTH_SKILLS: readonly Omit<SkillSeed, 'no'>[] = [
  { cost: 2, stat: 'other', value: 4, effect: { type: 'heal' }, rarity: 'U' },
  { cost: 1, stat: 'other', value: 3, effect: { type: 'mana' }, rarity: 'U' },
  { cost: 1, stat: 'other', value: 2, effect: { type: 'draw' }, rarity: 'U' },
  { cost: 4, stat: 'main', value: 6, effect: { type: 'attack', unblockable: true, undodgeable: true }, rarity: 'R' },
];

function skillSeeds(index: number): SkillSeed[] {
  const sixth = SIXTH_SKILLS[index % SIXTH_SKILLS.length] as Omit<SkillSeed, 'no'>;
  return [
    { no: 1, cost: 1, stat: 'main', value: 3, effect: { type: 'attack' }, rarity: 'C' },
    { no: 2, cost: 2, stat: 'main', value: 5, effect: { type: 'attack' }, rarity: 'C' },
    { no: 3, cost: 3, stat: 'other', value: 6, effect: { type: 'attack' }, rarity: 'U' },
    { no: 4, cost: 1, stat: 'main', value: 2, effect: { type: 'defense' }, rarity: 'C' },
    { no: 5, cost: 2, stat: 'other', value: 2, effect: { type: 'evade' }, rarity: 'C' },
    { no: 6, ...sixth },
  ];
}

function makeSkills(key: string, main: StatType, seeds: readonly SkillSeed[]): SkillCard[] {
  const label = key.toUpperCase();
  return seeds.map((s) => ({
    kind: 'skill',
    id: skillId(key, s.no),
    name: `仮技${label}-${s.no}`,
    monsterId: monsterId(key),
    rarity: s.rarity,
    cost: s.cost,
    stat: { type: s.stat === 'main' ? main : other(main), value: s.value },
    effect: s.effect,
    isPlaceholder: true,
  }));
}

/** 欠片限定の隠しモンスター。正式名称・画像は未確定のため、正体は創作しない */
export const HIDDEN_MONSTER_ID = 'mon-hidden';

const HIDDEN_MONSTER: MonsterCard = {
  kind: 'monster',
  id: HIDDEN_MONSTER_ID,
  name: '？？？（隠しモンスター・未確定）',
  rarity: 'R',
  life: 13,
  themeColor: '#7a7f8c',
  description: '欠片を10個集めると復元できる隠しモンスター。正式な名称・画像・能力は未確定です。',
  isPlaceholder: true,
  hidden: true,
  undetermined: true,
};

const HIDDEN_SKILLS: SkillCard[] = makeSkills('hidden', 'wisdom', [
  { no: 1, cost: 2, stat: 'main', value: 4, effect: { type: 'attack' }, rarity: 'U' },
  { no: 2, cost: 1, stat: 'other', value: 2, effect: { type: 'defense' }, rarity: 'U' },
  { no: 3, cost: 4, stat: 'main', value: 7, effect: { type: 'attack', unblockable: true, undodgeable: true }, rarity: 'R' },
]).map((s) => ({ ...s, name: s.name.replace('仮技HIDDEN', '隠し技（未確定）') }));

/**
 * 【仮】ダンジョンのボスのモンスター（2026-10-26 ユーザー指示：遺跡のボスはジオル、森のボスはフルーネを使い、勝つとそのカードが少しもらえる）は、
 * 正式データが届いたのでどちらもゲームから外した（ユーザー指示：発売前なので、セーブの仮のモンスターカードは正式なモンスターに置きかえ、技カードは消す）。
 * - 仮ジオル（tmp-geol）：2026-10-29 ジオルの最終。セーブ version 23
 * - 仮フルーネ（tmp-flune）：2026-10-29 フルーネの最終。セーブ version 25
 * ID は前のセーブ・バックアップの読み込みで使う（REMOVED_CARD_IDS）
 */
export const TMP_GEOL_ID = monsterId('tmp-geol');
export const TMP_GEOL_SKILL_IDS: readonly string[] = [1, 2, 3, 4, 5, 6].map((no) => skillId('tmp-geol', no));
export const TMP_FLUNE_ID = monsterId('tmp-flune');
export const TMP_FLUNE_SKILL_IDS: readonly string[] = [1, 2, 3, 4, 5, 6].map((no) => skillId('tmp-flune', no));

export const MONSTERS: readonly MonsterCard[] = [
  ...MONSTER_SEEDS.map(makeMonster),
  HIDDEN_MONSTER,
  SORAMO_MONSTER,
  LAZUCK_MONSTER,
  GAUUL_MONSTER,
  NOBITON_MONSTER,
  MYUROL_MONSTER,
  KALSHELL_MONSTER,
  PUKARIM_MONSTER,
  GEOL_MONSTER,
  FLUNE_MONSTER,
  SEREPHINE_MONSTER,
  TSUMUJI_MONSTER,
  HYOUZUKU_MONSTER,
  SHISHIEN_MONSTER,
];

export const SKILLS: readonly SkillCard[] = [
  ...MONSTER_SEEDS.flatMap((seed, i) => makeSkills(seed.key, seed.main, skillSeeds(i))),
  ...HIDDEN_SKILLS,
  ...SORAMO_SKILLS,
  ...LAZUCK_SKILLS,
  ...GAUUL_SKILLS,
  ...NOBITON_SKILLS,
  ...MYUROL_SKILLS,
  ...KALSHELL_SKILLS,
  ...PUKARIM_SKILLS,
  ...GEOL_SKILLS,
  ...FLUNE_SKILLS,
  ...SEREPHINE_SKILLS,
  ...TSUMUJI_SKILLS,
  ...HYOUZUKU_SKILLS,
  ...SHISHIEN_SKILLS,
];

/**
 * サポートカード フェーズ1（2026-10-30 指示書 Y・ユーザー決定）。11種類。前の仮サポート6種（sup-1〜6）の ID の中身を置きかえ、新しい5つは sup-7〜11
 * （前のセーブで持っている仮サポートは、変換なしでそのまま新しいカードになる）。名前は投石・薬草・思い出の箱のほかは仮。英語は仮訳。絵はまだ無い（文字だけのカード）。
 * - すぐ効くカード（S01〜S07。旧ブリーダー）：使ったらすぐ効いて捨て札へ。全部まとめて1ターンに1回（limitGroup 'breeder'）。モンスターの行動は使わない
 * - 場に残るカード（F01〜F04。旧全体カード）：場に1枚だけ・双方に効く・新しいのが出たら古いのは持ち主の捨て札へ
 * 細かい決まりは docs/battle-rules.md「サポートカード（フェーズ1）」
 */
export const supportId = (no: number): string => `sup-${no}`;

const BREEDER = { duration: 'instant', limitGroup: 'breeder', limitPerTurn: 1 } as const;
/** 名前が決まっているサポート（ほかは仮の名前） */
const FIXED_SUPPORT_NAMES: readonly string[] = ['投石', '薬草', '思い出の箱'];

/** 絵のファイルの名前（sup_art_NN_〇〇.webp の〇〇。並びは SUPPORTS と同じ） */
const SUPPORT_ART_NAMES: readonly string[] = ['toseki', 'techou', 'yakusou', 'omoide', 'kazemakase', 'kirinoka', 'seien', 'omoikuuki', 'yuragukiri', 'nekki', 'mamorinojin'];

/** 並び＝表示の番号の順（S01〜S07・F01〜F04） */
export const SUPPORTS: readonly SupportCard[] = [
  { no: 7, code: 'S01', name: '投石', nameEn: 'Stone Throw', cost: 1, rarity: 'C', ...BREEDER, effect: { type: 'stone', value: 1 }, text: '相手1体に1ダメージ', textEn: '1 dmg to 1 enemy' },
  { no: 2, code: 'S02', name: '旅の手帳', nameEn: 'Travel Journal', cost: 1, rarity: 'C', ...BREEDER, effect: { type: 'draw', value: 2 }, text: 'カードを2枚引く', textEn: 'Draw 2 cards' },
  { no: 1, code: 'S03', name: '薬草', nameEn: 'Herb', cost: 2, rarity: 'C', ...BREEDER, effect: { type: 'heal', value: 1 }, text: '味方1体のライフを1回復', textEn: 'Restore 1 life to 1 ally' },
  { no: 8, code: 'S04', name: '思い出の箱', nameEn: 'Memory Box', cost: 3, rarity: 'R', ...BREEDER, effect: { type: 'recall' }, text: '捨て札の技カード1枚を選んで手札に戻す', textEn: 'Return 1 skill card from your discard to your hand' },
  { no: 3, code: 'S05', name: '風まかせ', nameEn: 'Drift', cost: 0, rarity: 'C', ...BREEDER, effect: { type: 'swap' }, text: '手札1枚を山札に戻してシャッフルし、1枚引く', textEn: 'Shuffle 1 hand card into your deck, then draw 1' },
  { no: 9, code: 'S06', name: '霧の香', nameEn: 'Mist Incense', cost: 1, rarity: 'C', ...BREEDER, effect: { type: 'manaDrain', value: 1 }, text: '相手のマナを1減らす', textEn: "Opponent's mana -1" },
  { no: 10, code: 'S07', name: '声援', nameEn: 'Cheer', cost: 1, rarity: 'C', ...BREEDER, effect: { type: 'cheer', value: 1 }, text: 'このターン、味方1体が次に使う攻撃のダメージ＋1', textEn: "This turn, 1 ally's next attack +1 dmg" },
  { no: 4, code: 'F01', name: '重い空気', nameEn: 'Heavy Air', cost: 3, rarity: 'C', duration: 'field', effect: { type: 'field', stat: 'force', modifier: -1 }, text: 'ちから技のダメージ−1', textEn: 'POW skill damage -1' },
  { no: 5, code: 'F02', name: 'ゆらぐ霧', nameEn: 'Wavering Mist', cost: 3, rarity: 'C', duration: 'field', effect: { type: 'field', stat: 'wisdom', modifier: -1 }, text: 'かしこさ技のダメージ−1', textEn: 'INT skill damage -1' },
  { no: 6, code: 'F03', name: '熱気', nameEn: 'Heat Wave', cost: 3, rarity: 'R', duration: 'field', effect: { type: 'field', stat: 'all', modifier: 1 }, text: 'すべての攻撃のダメージ＋1', textEn: 'All attack damage +1' },
  { no: 11, code: 'F04', name: '守りの陣', nameEn: 'Guard Formation', cost: 3, rarity: 'C', duration: 'field', effect: { type: 'guardDiscount', value: 1 }, text: '防御・回避のカードの消費マナ−1', textEn: 'Guard/dodge cards cost -1 mana' },
].map(({ no, ...rest }, i) => ({
  ...rest,
  kind: 'support',
  id: supportId(no),
  isPlaceholder: false,
  // 絵（2026-10-30 指示書 Z。原本は design-parts/support-art-z-20261030/ に無改変）：sup_art_01〜11 は表示の番号の順（S01〜F04）。
  // tools/art/card_art_webp.py で幅 827 の WebP に。sup_art_01_toseki（投石）は 2026-10-31 指示書 AB で描き直しに差し替えた（原本 design-parts/support-art-ab-20261031/）
  art: { category: 'skillCards', file: `sup_art_${String(i + 1).padStart(2, '0')}_${SUPPORT_ART_NAMES[i]}.webp`, layout: 'frame' },
  // 名前は投石・薬草・思い出の箱のほかは仮（ユーザー決定 2026-10-30）
  ...(FIXED_SUPPORT_NAMES.includes(rest.name) ? {} : { pendingSpec: ['name'] }),
}) as SupportCard);

/** 前の仮サポート6種の ID（sup-1〜6。古いセーブの変換・前からある仮のデッキの組み方で使う。中身は 2026-10-30 から新しいカード） */
export const LEGACY_SUPPORT_IDS: readonly string[] = [1, 2, 3, 4, 5, 6].map(supportId);

/**
 * 確認用（?qa=1）だけで使うカード。カードの一覧（MONSTERS・SKILLS）には入れないので、図鑑・デッキ編集・ガチャ・全カード追加・初期配布・敵の編成には出ない。
 * 台帳（cardCatalog）と適合技（skillsOf）には入れる（対戦で使えるように）。
 * 2026-10-28 に試遊中のプカリムを入れていたが、2026-10-29 の最終でふつうの一覧へ移した。
 * 2026-10-29：試遊中のジオル（src/data/geol.ts）を入れていたが、同じ日のジオルの最終でふつうの一覧へ移した。いまは空
 */
export const QA_MONSTERS: readonly MonsterCard[] = [];
export const QA_SKILLS: readonly SkillCard[] = [];

export const cardCatalog = createCardCatalog([...MONSTERS, ...SKILLS, ...SUPPORTS, ...QA_MONSTERS, ...QA_SKILLS]);

export function getMonster(id: string): MonsterCard {
  const card = cardCatalog.get(id);
  if (!card || card.kind !== 'monster') throw new Error(`モンスターが見つかりません: ${id}`);
  return card;
}

export function getSkill(id: string): SkillCard {
  const card = cardCatalog.get(id);
  if (!card || card.kind !== 'skill') throw new Error(`技カードが見つかりません: ${id}`);
  return card;
}

export function getSupport(id: string): SupportCard {
  const card = cardCatalog.get(id);
  if (!card || card.kind !== 'support') throw new Error(`サポートカードが見つかりません: ${id}`);
  return card;
}

/** 手札・山札のカード（技かサポート） */
export function getPlayCard(id: string): PlayCard {
  const card = cardCatalog.get(id);
  if (!card || card.kind === 'monster') throw new Error(`技・サポートカードが見つかりません: ${id}`);
  return card;
}

/** モンスターの適合技（そのモンスターが使える技）一覧 */
export function skillsOf(monster: string): SkillCard[] {
  return [...SKILLS, ...QA_SKILLS].filter((s) => s.monsterId === monster);
}
