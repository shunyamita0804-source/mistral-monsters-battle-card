/**
 * カードのデータ型。
 *
 * 技カードの表示は「技カード UI テンプレート V4」（マナ＝青、ちから＝赤、かしこさ＝緑、数字1〜10）に合わせる。
 * 数値・効果の具体的な値は正式仕様が未確定のため、src/data/ の仮データで与える。
 */
import { OFFICIAL_DRAFT_EN } from '../../i18n/contentEnOfficialDraft.ts';
import { getLanguage, t } from '../../i18n/i18n.ts';

/** カードの種類は3つ：モンスター／技／サポート（原作の全体カード・ブリーダーカードはサポートにまとめる） */
export type CardKind = 'monster' | 'skill' | 'support';
export type StatType = 'force' | 'wisdom';
export type Rarity = 'C' | 'U' | 'R';
/**
 * 技の種別（カード右側のバー）：ちから・かしこさ（数値のある攻撃）／特殊・防御・回避（2026-10-23 正式カードから）。
 * 仮カードは種別を持たず、stat.type（ちから or かしこさ）をそのまま使う
 */
export type SkillCategory = StatType | 'special' | 'defense' | 'evade';

/* 表示名はいまの言語で返す（辞書は src/i18n/messages/cards.ts） */
export const kindLabel = (kind: CardKind): string => t(`card.kind.${kind}`);
export const statLabel = (stat: StatType): string => t(`card.stat.${stat}`);
/** レアリティの表示（正式カードでまだ決まっていないものは null →「未定」） */
export const rarityLabel = (rarity: Rarity | null): string => t(rarity ? `card.rarity.${rarity}` : 'card.rarity.none');
export const categoryLabel = (category: SkillCategory): string => t(`card.category.${category}`);

/**
 * カード画像の参照先。assets/ のカテゴリとファイル名で指定する。
 * - layout 'frame': 画像をカード枠の絵の部分に表示し、名前などは枠に描画する
 * - layout 'full' : 画像をカード全面に表示する
 */
export interface CardArt {
  readonly category: 'monsterCards' | 'skillCards';
  readonly file: string;
  readonly layout: 'frame' | 'full';
}

interface CardBase {
  readonly id: string;
  readonly name: string;
  /** レアリティ（C/U/R）。正式カードでまだ決まっていなければ null（モンスターのランクとは別物） */
  readonly rarity: Rarity | null;
  /** 正式カードのデザイン上の ID（例：SOR-SK-01）。ゲームの ID（id）とは別 */
  readonly designId?: string;
  /**
   * 正式カードで、まだ決まっていない項目（例：['life', 'art']）。
   * 動かすために仮の値を入れているものは画面にも「仮」と出す
   */
  readonly pendingSpec?: readonly string[];
  /** 仮カード（正式データではない）なら true */
  readonly isPlaceholder: boolean;
  /** 正式画像。未指定なら仮の絵で表示する */
  readonly art?: CardArt;
}

export interface MonsterCard extends CardBase {
  readonly kind: 'monster';
  /** バトル開始時のライフ（仮） */
  readonly life: number;
  /** 技カード外枠の着色色（テーマ色） */
  readonly themeColor: string;
  readonly description: string;
  /** 欠片限定の隠しモンスター。通常のパック・ガチャでは排出しない */
  readonly hidden?: boolean;
  /** 正式名称・画像が未確定 */
  readonly undetermined?: boolean;
  /**
   * バトル用の絵（文字・UIなし。2026-10-23 正式）。art はショップ・図鑑・自宅などで見せる正式カード（名前・ライフ入り）。
   * バトルでは battleArt に、ゲーム側で名前とライフを重ねる
   */
  readonly battleArt?: CardArt;
}

/**
 * 技の効果（数値は仮。決まりは docs/battle-rules.md）。
 * 攻撃の印：unblockable＝防御できない、undodgeable＝回避できない、halfOnEvade＝回避されても半分のダメージ。
 */
export type SkillEffect =
  | {
      readonly type: 'attack';
      readonly unblockable?: boolean;
      readonly undodgeable?: boolean;
      readonly halfOnEvade?: boolean;
      /** 技が当たったとき、使ったモンスターのライフを減らす量（正式：すてみタックル） */
      readonly selfDamageOnHit?: number;
      /** 回避されなかったとき、相手（守る側）のマナを減らす量。0 より下にはならない（正式：ノビトンのくしゃみ・ダウナーミスト 2026-10-25） */
      readonly manaDrain?: number;
      /** 回避されなかったとき、対象は次の手番に行動できない（正式：ノビトンのまきつく 2026-10-25） */
      readonly stunTarget?: boolean;
    }
  /**
   * 防御：ダメージを減らす。正式カードは reduce（減らす量）と against（効く攻撃の種類。'all'＝攻撃すべて）を持つ。
   * 仮カードは持たず、stat の値と種類を使う
   */
  | {
      readonly type: 'defense';
      readonly reduce?: number;
      readonly against?: StatType | 'all';
      /** 受ける攻撃カードに印字された必要マナがこの値以上のときだけ使える（正式：ミュロルのスリップガード 2026-10-25。いまのマナの残りではない） */
      readonly minCost?: number;
    }
  /**
   * 回避：ダメージを0に。正式カードは against（'all'＝攻撃すべて）。仮カードは stat の種類。
   * minCost（2026-10-24）：受ける攻撃カードに印字された必要マナがこの値以上のときだけ回避できる（なければ条件なし）
   * maxCost（2026-10-25 正式：ミュロルのすべってよける）：受ける攻撃カードに印字された必要マナがこの値以下のときだけ回避できる
   */
  | { readonly type: 'evade'; readonly against?: StatType | 'all'; readonly minCost?: number; readonly maxCost?: number }
  /**
   * 特殊：選んだ相手モンスターの stat の技のダメージを amount 減らす。
   * duration なし（正式：ソラモの吠える）＝次にその種類の技を使うまで。'nextTurn'（正式：ラズックのダストキック）＝相手の次の手番の間だけ
   */
  | {
      readonly type: 'weaken';
      readonly stat: StatType;
      readonly amount: number;
      /**
       * なし（正式：ソラモの吠える）＝次にその種類の技を使うまで。'nextTurn'（正式：ラズックのダストキック）＝相手の次の手番の間だけ（使っても消えない）。
       * 'nextUseByNextTurn'（正式：ガウルの熱風の威嚇 2026-10-24）＝次にその種類の技を使ったら消え、使わなくても相手の次の手番が終われば消える
       */
      readonly duration?: 'nextTurn' | 'nextUseByNextTurn';
    }
  /** 特殊（正式：すなかけ）：選んだ相手モンスターは次回攻撃できない */
  | { readonly type: 'seal' }
  /** 特殊（正式：ラズックのちょうはつ）：選んだ相手モンスターは次の手番、使ったモンスターと同じ種類（ラズック）にしか攻撃できない */
  | { readonly type: 'taunt' }
  /** 特殊（正式：ラズックのいたずら 2026-10-24）：相手の手札からランダムに1枚を相手の山札へ戻してシャッフルする。相手は補充しない */
  | { readonly type: 'handToDeck' }
  /** 特殊（正式：ノビトンの考える 2026-10-25）：自分の手札をすべて山札へ戻してシャッフルし、戻した枚数だけ引く */
  | { readonly type: 'redrawHand' }
  /** 特殊（正式：ノビトンの不思議な嗅覚 2026-10-25）：相手の手札をすべて確認する（画面に表を見せる。手札は動かさない） */
  | { readonly type: 'revealHand' }
  /**
   * 特殊（正式：ミュロルのしめったはだ 2026-10-25）：使ったモンスターが受ける against の技のダメージを reduce 減らす。
   * 使った手番を含めて turns 手番のあいだ続く。重ねがけはしない（もう一度使っても reduce は同じまま、期限だけ新しく）
   */
  | { readonly type: 'shield'; readonly against: StatType | 'all'; readonly reduce: number; readonly turns: number }
  /** 特殊（正式：ミュロルのみずあび 2026-10-25）：使ったモンスターのライフを amount 回復する（最大ライフまで） */
  | { readonly type: 'healSelf'; readonly amount: number }
  | { readonly type: 'heal' }
  | { readonly type: 'mana' }
  | { readonly type: 'draw' };

export type SkillEffectType = SkillEffect['type'];

export const effectLabel = (type: SkillEffectType): string => t(`card.effect.${type}`);

export interface SkillCard extends CardBase {
  readonly kind: 'skill';
  /** 使えるモンスター（適合技） */
  readonly monsterId: string;
  /** 使用に必要なマナ（0〜10。0 も正式に使える） */
  readonly cost: number;
  /**
   * 右側の能力（ちから or かしこさ の一方のみ）と数値（1〜10）。
   * 正式カードの特殊・防御・回避は攻撃の数値を持たないので null（ダミーの値は作らない）
   */
  readonly stat: { readonly type: StatType; readonly value: number } | null;
  /** 技の種別（正式カード）。仮カードは持たず stat.type を使う */
  readonly category?: SkillCategory;
  /** 正式の効果テキスト（日本語。ユーザー確定の文をそのまま）。なければ null */
  readonly effectTextJa?: string | null;
  /** 正式カードの区分：initial＝初期、collect＝収集（配布の枚数・入手場所は未定） */
  readonly availability?: 'initial' | 'collect';
  /**
   * 表示の番号（正式カード。2026-10-24〜）。並び順を変えても、ゲーム内 ID・絵のファイル名は変えずにこの番号だけ変える。
   * 例：ラズックのトリックショットは ID skl-lazuck-09 のまま表示は 7
   */
  readonly displayNo?: number;
  readonly effect: SkillEffect;
}

/** 技の種別（右側のバー）。仮カードは stat.type */
export function skillCategory(skill: SkillCard): SkillCategory {
  return skill.category ?? skill.stat?.type ?? 'special';
}

/** 攻撃のダメージの数値（数値のない技は 0） */
export function skillValue(skill: SkillCard): number {
  return skill.stat?.value ?? 0;
}

/** 防御で減らす量 */
export function guardReduction(skill: SkillCard): number {
  return skill.effect.type === 'defense' ? (skill.effect.reduce ?? skillValue(skill)) : 0;
}

/** 防御・回避が効く攻撃の種類（'all'＝攻撃すべて）。仮カードは stat の種類 */
export function guardAgainst(skill: SkillCard): StatType | 'all' {
  const e = skill.effect;
  const against = e.type === 'defense' || e.type === 'evade' ? e.against : undefined;
  return against ?? skill.stat?.type ?? 'all';
}

/** 回避できる攻撃の必要マナの下限（「必要マナ2以上の〜を回避」）。条件がなければ 0 */
export function evadeMinCost(skill: SkillCard): number {
  return skill.effect.type === 'evade' ? (skill.effect.minCost ?? 0) : 0;
}

/** 防御・回避が使える攻撃カードの必要マナの下限（防御：ミュロルのスリップガード、回避：evadeMinCost と同じ）。条件がなければ 0 */
export function guardMinCost(skill: SkillCard): number {
  const e = skill.effect;
  return e.type === 'defense' || e.type === 'evade' ? (e.minCost ?? 0) : 0;
}

/** 回避が使える攻撃カードの必要マナの上限（正式：ミュロルのすべってよける「消費マナ2以下」）。条件がなければ null */
export function guardMaxCost(skill: SkillCard): number | null {
  return skill.effect.type === 'evade' ? (skill.effect.maxCost ?? null) : null;
}

/** 相手モンスター1体を選んで使う技か（攻撃・特殊） */
export function targetsEnemy(skill: SkillCard): boolean {
  const type = skill.effect.type;
  return type === 'attack' || type === 'weaken' || type === 'seal' || type === 'taunt';
}

/**
 * サポートの効果（仮カード用。正式カードが決まったら足す）。
 * field は「場に残る」効果：その能力の攻撃のダメージを双方とも modifier だけ増減する（stat 'all' は全攻撃）。
 */
export type SupportEffect =
  | { readonly type: 'heal'; readonly value: number }
  | { readonly type: 'draw'; readonly value: number }
  | { readonly type: 'mana'; readonly value: number }
  | { readonly type: 'field'; readonly stat: StatType | 'all'; readonly modifier: number };

export interface SupportCard extends CardBase {
  readonly kind: 'support';
  /** 使用に必要なマナ */
  readonly cost: number;
  /**
   * 効果の区分（内部属性。表示上はどれも「サポート」）
   * - instant：使ったらすぐ効果が出て捨て札へ（旧ブリーダーカード）
   * - field：場に1枚だけ残り、双方に効果が続く（旧全体カード）。新しく出たら古い方は持ち主の捨て札へ
   */
  readonly duration: 'instant' | 'field';
  /** 回数制限のまとまり。同じまとまりは1ターンに limitPerTurn 回まで（旧ブリーダーは 'breeder' で1回） */
  readonly limitGroup?: string;
  readonly limitPerTurn?: number;
  readonly effect: SupportEffect;
}

/** バトルで手札・山札に入るカード（技とサポート） */
export type PlayCard = SkillCard | SupportCard;

export type CardDefinition = MonsterCard | SkillCard | SupportCard;

export function isMonster(card: CardDefinition): card is MonsterCard {
  return card.kind === 'monster';
}

export function isSkill(card: CardDefinition): card is SkillCard {
  return card.kind === 'skill';
}

export function isSupport(card: CardDefinition): card is SupportCard {
  return card.kind === 'support';
}

const statOrAll = (stat: StatType | 'all'): string => (stat === 'all' ? t('card.stat.all') : statLabel(stat));
const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** サポートカードの効果説明 */
export function describeSupport(card: SupportCard): string {
  const e = card.effect;
  const limit = card.limitPerTurn ? t('card.support.limit', { n: card.limitPerTurn }) : '';
  switch (e.type) {
    case 'heal':
    case 'draw':
    case 'mana':
      return t(`card.support.${e.type}`, { v: e.value, limit });
    case 'field':
      return t('card.support.field', { stat: statOrAll(e.stat), sign: signed(e.modifier) });
  }
}

/** サポートカードの短い説明（カード面・場の表示） */
export function supportShortText(card: SupportCard): string {
  const e = card.effect;
  switch (e.type) {
    case 'heal':
    case 'draw':
    case 'mana':
      return t(`card.short.${e.type}`, { v: e.value });
    case 'field':
      return t('card.short.field', { stat: statOrAll(e.stat), sign: signed(e.modifier) });
  }
}

/** 技・サポートどちらでも説明文 */
export function describePlayCard(card: PlayCard): string {
  return card.kind === 'skill' ? describeSkill(card) : describeSupport(card);
}

/**
 * 正式の効果テキスト（いまの言語）。日本語はデータの文そのまま、英語は仮訳（src/i18n/contentEnOfficialDraft.ts）。
 * 英語の仮訳がなければ日本語のまま。効果テキストのない正式カード（数値だけの攻撃）と仮カードは null
 */
export function officialEffectText(skill: SkillCard): string | null {
  const ja = skill.effectTextJa ?? null;
  if (ja === null || getLanguage() !== 'en') return ja;
  return OFFICIAL_DRAFT_EN[`card:${skill.id}:effect`] ?? ja;
}

/** 説明をゲーム側で組み立てない特殊の効果（正式カードの効果テキストをそのまま出す。仮カードには無い） */
type TextOnlySpecial = 'weaken' | 'seal' | 'taunt' | 'handToDeck' | 'redrawHand' | 'revealHand' | 'shield' | 'healSelf';
const TEXT_ONLY_SPECIALS: readonly SkillEffectType[] = ['weaken', 'seal', 'taunt', 'handToDeck', 'redrawHand', 'revealHand', 'shield', 'healSelf'];
function isTextOnlySpecial(type: SkillEffectType): type is TextOnlySpecial {
  return TEXT_ONLY_SPECIALS.includes(type);
}

/** 技カードの効果説明（ゲーム側で表示する文字） */
export function describeSkill(card: SkillCard): string {
  const official = officialEffectText(card);
  const stat = card.stat ? statLabel(card.stat.type) : '';
  const v = skillValue(card);
  if (card.effect.type === 'attack') {
    const base = card.stat ? t('card.skill.attack', { stat, v, note: attackNote(card.effect) }).trim() : '';
    return official ? `${base}${getLanguage() === 'en' ? ' ' : ''}${official}`.trim() : base;
  }
  if (official) return official;
  if (isTextOnlySpecial(card.effect.type)) return '';
  return t(`card.skill.${card.effect.type}`, { stat, v });
}

/** 技カードの短い説明（カード面に書く文字）。正式カードは効果テキストをそのまま */
export function skillShortText(skill: SkillCard): string {
  const official = officialEffectText(skill);
  if (official) return official;
  const v = skillValue(skill);
  const e = skill.effect;
  if (e.type === 'attack') return t(e.unblockable && e.undodgeable ? 'card.short.attackSure' : 'card.short.attack', { v });
  if (isTextOnlySpecial(e.type)) return '';
  return t(`card.short.${e.type}`, { v });
}

/** 攻撃の印の説明 */
function attackNote(effect: Extract<SkillEffect, { type: 'attack' }>): string {
  if (effect.unblockable && effect.undodgeable) return t('card.attackNote.both');
  const notes = [
    effect.unblockable ? t('card.attackNote.unblockable') : '',
    effect.undodgeable ? t('card.attackNote.undodgeable') : '',
    effect.halfOnEvade ? t('card.attackNote.halfOnEvade') : '',
  ];
  return notes.filter((n) => n !== '').join(getLanguage() === 'en' ? ' ' : '');
}
