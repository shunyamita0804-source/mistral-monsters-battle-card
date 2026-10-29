import type { SkillCard, SkillCategory, SkillEffect } from '../game/cards/cardTypes.ts';
import { SKILL_CARD_TEXT } from './skillCardText.ts';

/**
 * 正式の技カードの JSON（src/data/official/*_cards_OFFICIAL.json）の1件を、ゲームの技カードにする（2026-10-23。ソラモ・ラズック共通）。
 * 技名・マナ・ダメージ・種別・効果テキスト・初期/収集の区分は、書き換えずに JSON からそのまま読む。
 * 効果テキストのある技の「ゲームでの動き」だけを specialEffects で渡す（文は書き換えない）。
 * 画面に出す効果の文だけ、skillCardText.ts の短い文があればそちらにする（2026-10-29。JSON の文は変えない）
 */
export interface OfficialSkill {
  readonly design_id: string;
  readonly number: number;
  readonly name_ja: string;
  readonly mana: number;
  readonly damage: number | null;
  readonly category: string;
  readonly effect_text_ja: string | null;
  /** initial＝初期、それ以外＝収集。なし＝配布区分が未確定（画面に区分を出さない。ミュロル 2026-10-25） */
  readonly availability?: string;
}

export interface OfficialSkillSource {
  /** モンスター名（エラーの文に使う） */
  readonly label: string;
  readonly monsterId: string;
  readonly skillId: (no: number) => string;
  /** 技の絵のファイル名（assets/images/cards/skills/） */
  readonly artFile: (no: number) => string;
  readonly specialEffects: Readonly<Record<string, SkillEffect>>;
}

const CATEGORIES: readonly SkillCategory[] = ['force', 'wisdom', 'special', 'defense', 'evade'];

export const twoDigits = (no: number): string => String(no).padStart(2, '0');

/** 1枚ずつの上書き（2026-10-24〜。並び順の変更・新しい技・回避の条件の改訂に使う） */
export interface OfficialSkillOverride {
  /** ゲーム内 ID（なければ src.skillId(o.number)） */
  readonly id?: string;
  /** 技の絵のファイル名（なければ src.artFile(o.number)） */
  readonly artFile?: string;
  /** デザイン ID（null＝なし。なければ o.design_id） */
  readonly designId?: string | null;
  /** 表示の番号 */
  readonly displayNo?: number;
  /** ゲームでの動き（なければ src.specialEffects[o.design_id] か攻撃） */
  readonly effect?: SkillEffect;
}

/** 回避の条件（承認 JSON の against・min_incoming_attack_required_mana）を回避の動きにする */
export function evadeFromCriteria(against: readonly string[], minCost: number | null): SkillEffect {
  const force = against.includes('force');
  const wisdom = against.includes('wisdom');
  if (!force && !wisdom) throw new Error(`回避の対象が不明です: ${against.join(',')}`);
  const target = force && wisdom ? 'all' : force ? 'force' : 'wisdom';
  return minCost !== null && minCost > 0 ? { type: 'evade', against: target, minCost } : { type: 'evade', against: target };
}

export function officialSkill(o: OfficialSkill, src: OfficialSkillSource, over: OfficialSkillOverride = {}): SkillCard {
  const category = CATEGORIES.find((c) => c === o.category);
  if (!category) throw new Error(`${src.label}の技の種別が不明です: ${o.design_id} ${o.category}`);
  const attack = category === 'force' || category === 'wisdom';
  if (attack !== (o.damage !== null)) throw new Error(`${src.label}の技のダメージと種別が合いません: ${o.design_id}`);
  const effect = over.effect ?? src.specialEffects[o.design_id] ?? (attack ? { type: 'attack' } : undefined);
  if (!effect) throw new Error(`${src.label}の技の動きが未定義です: ${o.design_id}`);
  const designId = over.designId === undefined ? o.design_id : over.designId;
  const id = over.id ?? src.skillId(o.number);
  return {
    kind: 'skill',
    id,
    ...(designId !== null ? { designId } : {}),
    name: o.name_ja,
    monsterId: src.monsterId,
    rarity: null,
    cost: o.mana,
    stat: attack && o.damage !== null ? { type: category as 'force' | 'wisdom', value: o.damage } : null,
    category,
    effectTextJa: SKILL_CARD_TEXT[id] ?? o.effect_text_ja,
    ...(o.availability !== undefined ? { availability: o.availability === 'initial' ? ('initial' as const) : ('collect' as const) } : {}),
    ...(over.displayNo !== undefined ? { displayNo: over.displayNo } : {}),
    effect,
    isPlaceholder: false,
    art: { category: 'skillCards', file: over.artFile ?? src.artFile(o.number), layout: 'frame' },
    pendingSpec: ['rarity'],
  };
}
