import { createCardCatalog } from '../game/cards/cardCatalog.ts';
import type { MonsterCard, PlayCard, Rarity, SkillCard, SkillEffect, StatType, SupportCard } from '../game/cards/cardTypes.ts';
import { GAUUL_MONSTER, GAUUL_SKILLS } from './gauul.ts';
import { LAZUCK_MONSTER, LAZUCK_SKILLS } from './lazuck.ts';
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

export const MONSTERS: readonly MonsterCard[] = [...MONSTER_SEEDS.map(makeMonster), HIDDEN_MONSTER, SORAMO_MONSTER, LAZUCK_MONSTER, GAUUL_MONSTER, NOBITON_MONSTER];

export const SKILLS: readonly SkillCard[] = [
  ...MONSTER_SEEDS.flatMap((seed, i) => makeSkills(seed.key, seed.main, skillSeeds(i))),
  ...HIDDEN_SKILLS,
  ...SORAMO_SKILLS,
  ...LAZUCK_SKILLS,
  ...GAUUL_SKILLS,
  ...NOBITON_SKILLS,
];

/**
 * 仮のサポートカード（ユーザー承認 2026-10-22：仮サポートの追加）。
 * - 仮サポート1〜3：旧ブリーダーカードにあたる。すぐ効果が出て、まとめて1ターンに1回まで
 * - 仮全体1〜3：旧全体カードにあたる。場に1枚だけ残り、双方に効果が続く
 * 効果・数値はすべて仮（原作のカードの写しではない）。
 */
export const supportId = (no: number): string => `sup-${no}`;

const BREEDER = { duration: 'instant', limitGroup: 'breeder', limitPerTurn: 1 } as const;

export const SUPPORTS: readonly SupportCard[] = [
  { no: 1, name: '仮サポート1', cost: 2, rarity: 'U', ...BREEDER, effect: { type: 'heal', value: 3 } },
  { no: 2, name: '仮サポート2', cost: 1, rarity: 'U', ...BREEDER, effect: { type: 'draw', value: 2 } },
  { no: 3, name: '仮サポート3', cost: 1, rarity: 'U', ...BREEDER, effect: { type: 'mana', value: 2 } },
  { no: 4, name: '仮全体1', cost: 2, rarity: 'U', duration: 'field', effect: { type: 'field', stat: 'force', modifier: -1 } },
  { no: 5, name: '仮全体2', cost: 2, rarity: 'U', duration: 'field', effect: { type: 'field', stat: 'wisdom', modifier: -1 } },
  { no: 6, name: '仮全体3', cost: 3, rarity: 'R', duration: 'field', effect: { type: 'field', stat: 'all', modifier: 1 } },
].map(({ no, ...rest }) => ({ ...rest, kind: 'support', id: supportId(no), isPlaceholder: true }) as SupportCard);

export const cardCatalog = createCardCatalog([...MONSTERS, ...SKILLS, ...SUPPORTS]);

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
  return SKILLS.filter((s) => s.monsterId === monster);
}
