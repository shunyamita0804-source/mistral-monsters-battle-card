import { cardCatalog, getMonster, getPlayCard, getSkill, getSupport } from '../../data/cards.ts';
import { BATTLE_RULES } from '../../data/rules.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import {
  guardAgainst,
  guardMaxCost,
  guardMinCost,
  guardReduction,
  skillValue,
  statLabel,
  targetsEnemy,
  type PlayCard,
  type SkillCard,
  type StatType,
  type SupportCard,
} from '../cards/cardTypes.ts';
import type { Deck } from '../deck/deck.ts';
import { nextInt, nextRandom, shuffle } from '../rng.ts';

/**
 * カードバトルのルール（DOM 非依存の純粋関数）。
 *
 * 【仮実装】指示書の構成（双方モンスター3体・ライフ・手札・マナ・攻撃/防御・対象選択・使用不可状態・
 * ターン進行・勝敗）に沿っているが、数値と細部は src/data/rules.ts の仮ルール。正式ルール資料が届いたら合わせる。
 */
export type Side = 'player' | 'opponent';

/** 陣営の呼び名（いまの言語。「あなた」「相手」） */
export function sideLabel(side: Side): string {
  return t(`battle.side.${side}`);
}

export function otherSide(side: Side): Side {
  return side === 'player' ? 'opponent' : 'player';
}

export interface BattleMonster {
  readonly uid: string;
  readonly cardId: string;
  readonly maxLife: number;
  readonly life: number;
  /** このターンに技を使ったか */
  readonly acted: boolean;
  /**
   * 次に使う stat の技のダメージを amount 減らす（正式：吠える）。使ったら消える。
   * untilTurn があれば、その手番が過ぎたら効かない（正式：ガウルの熱風の威嚇「次のターンまで」）
   */
  readonly weaken?: { readonly stat: StatType; readonly amount: number; readonly untilTurn?: number } | null;
  /** この手番（turn）の間は攻撃の技を使えない（正式：すなかけ） */
  readonly sealedTurn?: number | null;
  /** この手番（turn）の間だけ、stat の技のダメージを amount 減らす（正式：ラズックのダストキック。吠えると違い、使っても消えず、手番が過ぎたら効かない） */
  readonly weakenTurn?: { readonly stat: StatType; readonly amount: number; readonly turn: number } | null;
  /** この手番（turn）の間は、monsterId の種類のモンスターにしか攻撃できない（正式：ラズックのちょうはつ） */
  readonly taunt?: { readonly monsterId: string; readonly turn: number } | null;
  /** この手番（turn）の間は技を使えない（攻撃も特殊も。正式：ノビトンのまきつく「次ターン行動不可」2026-10-25。守備のカードは使える） */
  readonly stunnedTurn?: number | null;
  /** 行動不可を付けた技の印（'frozen'＝ヒョウズクの技で凍った。null・無し＝まきつく。印の絵を分けるだけで、決まりは同じ。2026-10-30 指示書 X） */
  readonly stunMark?: 'frozen' | null;
  /**
   * 受ける against の技のダメージを reduce 減らす。untilTurn の手番が終わるまで（正式：ミュロルのしめったはだ 2026-10-25。
   * 使った手番を含む2手番＝相手の次の手番まで）。重ねがけはしない
   */
  readonly shield?: { readonly against: StatType | 'all'; readonly reduce: number; readonly untilTurn: number } | null;
  /** この手番（turn）の間は攻撃の技の対象にならない（正式：カルシェルのすなをほる「次のターン攻撃対象にならない」2026-10-27） */
  readonly hiddenTurn?: number | null;
  /** 次に使う攻撃技のダメージ＋（試遊中：プカリムのほっぺにためる 2026-10-28）。使うまで続く。攻撃技を使ったら・倒れたら消える */
  readonly charge?: number | null;
  /**
   * 攻撃技のダメージ＋amount（プカリムのおいかぜ。2026-10-29 ユーザー指示でカードの文のとおりに）。効くのは turn の手番（かけた側の次の自分の手番）だけ。
   * その手番にそのモンスターが攻撃技を1回使ったら消え、使わなくてもその手番が終わったら効かない。倒れたら消える
   */
  readonly tailwind?: { readonly amount: number; readonly turn: number } | null;
  /** この手番（turn）に受ける次の攻撃1回を回避できない（試遊中：ジオルのじならし 2026-10-29）。攻撃を1回受けたら・倒れたら消える */
  readonly pinTurn?: number | null;
  /**
   * 効く手番（turn。かけた側の次の自分の手番）に最初に使うかしこさ技1回だけダメージ2倍（試遊中：ジオルのエネルギーをためる 2026-10-29）。
   * かしこさ技を使ったら消え、使わなくてもその手番が終わったら効かない。倒れたら消える。ちから技では消えない
   */
  readonly energy?: { readonly turn: number } | null;
  /** このターン（turn）に次に使う攻撃技のダメージ＋amount（2026-10-30 指示書 Y：声援）。攻撃を1回使うか、ターンが終わったら効かない。倒れたら消える */
  readonly cheer?: { readonly amount: number; readonly turn: number } | null;
  /**
   * 効く手番（turn。かけた側の次の自分の手番）の間、このモンスターの攻撃技の消費マナ−discount（正式：ツムジのかぜのり 2026-10-30）。
   * 0より下にはならない。重ねない。その手番が終わったら効かない。倒れたら消える
   */
  readonly windRide?: { readonly discount: number; readonly turn: number } | null;
  /**
   * この手番（turn）に、続けて使える技（cardId）をもう1回使える（正式：ツムジの Wひっかき 2026-10-30）。
   * 「1体1ターン1回」のただ1つの例外：その手番の最初の技が続けて使える技のときに付き、2回目を使ったら消える（1ターンに最大2回）
   */
  readonly chain?: { readonly turn: number; readonly cardId: string } | null;
}

export interface HandCard {
  readonly uid: string;
  readonly cardId: string;
}

export interface BattleSide {
  readonly name: string;
  readonly monsters: readonly BattleMonster[];
  /** 山札（先頭が一番上） */
  readonly deck: readonly string[];
  readonly hand: readonly HandCard[];
  readonly discard: readonly string[];
  /** マナにしたカード（積んだ順。先頭が一番古い）。マナの量＝枚数 */
  readonly manaPile: readonly string[];
  /** このターンに使ったサポートの回数（回数制限のまとまりごと）。ターン開始で空に戻す */
  readonly turnUsage: Readonly<Record<string, number>>;
}

/** 場に出ている全体カード（場に1枚だけ） */
export interface FieldCard {
  readonly cardId: string;
  readonly owner: Side;
}

/** いまのマナの量 */
export function manaOf(side: BattleSide): number {
  return side.manaPile.length;
}

/** 守備待ちの攻撃 */
export interface PendingAttack {
  readonly attacker: Side;
  readonly userUid: string;
  readonly targetUid: string;
  readonly cardId: string;
  readonly stat: StatType;
  /** 攻撃の威力（場の全体カードの増減を反映した値） */
  readonly power: number;
  /** 守備側がこの攻撃に使ったカード（使った順）。守備がすべて終わってからまとめてダメージを計算する */
  readonly responses: readonly string[];
  /** この攻撃は回避されない（試遊中：ほっぺにためているときのぷはーっ。カードの「回避されない」とは別に、使ったときの状態で決まる） */
  readonly undodgeable?: boolean;
  /** いま狙われているモンスターは、じならしでこの攻撃を回避できない（試遊中：ジオル 2026-10-29。狙われたモンスターが変わったら決め直す） */
  readonly pinned?: boolean;
  /** 相手全体への攻撃（試遊中：ジオルの地ひびき）で、このあとに守りの順が来る相手（uid。左から順） */
  readonly queue?: readonly string[];
  /** かばうで狙いが変わったとき、もとの狙われたモンスター（uid。試遊中：ジオルのかばう） */
  readonly coveredFrom?: string;
  /** エネルギーをためるで2倍になった攻撃（記録・試遊の数え用） */
  readonly energized?: boolean;
}

/** main＝技を使う（攻撃）、defense＝相手の防御待ち、mana＝攻撃のあとのマナ化 */
export type BattlePhase = 'main' | 'defense' | 'mana' | 'ended';
export type BattleWinner = Side | 'draw';

export interface LogEntry {
  readonly turn: number;
  readonly text: string;
}

/**
 * 効果音を鳴らすきっかけ（ルール上の結果が確定した瞬間に1件ずつ記録する。画面は seq で「まだ鳴らしていない分」だけ鳴らす）
 * - manaSpend：マナを支払った（1回の支払いで1件。何枚でも1件）
 * - manaConvert：手札のカードをマナにした（マナ化。1枚につき1件）
 * - manaGain：山札からマナが増えた（手札5枚のときのドロー・カードの効果。1回で1件）
 * - evade：回避が成功してダメージ0が確定した
 * - hit：攻撃が命中してダメージを与えた（strong＝強攻撃。いまは仮に「必要マナ3以上の技」）
 * - recoil：技の反動で使ったモンスターのライフが減った（正式：すてみタックル）
 * 防御でダメージ0になったときは記録しない（防御の音は未承認のため無音）
 */
export type BattleFxKind = 'manaSpend' | 'manaConvert' | 'manaGain' | 'evade' | 'hitNormal' | 'hitStrong' | 'recoil';
export interface BattleFx {
  readonly seq: number;
  readonly kind: BattleFxKind;
  readonly side: Side;
}

/** 強攻撃（命中の音を「強」にする）とみなす必要マナ。仮の基準（ユーザー指定 2026-10-22。正式な技が決まったら見直す） */
export const STRONG_ATTACK_COST = 3;

export interface BattleState {
  readonly seed: number;
  /** 手番の通し番号（1から） */
  readonly turn: number;
  readonly active: Side;
  readonly first: Side;
  readonly phase: BattlePhase;
  readonly pending: PendingAttack | null;
  readonly sides: Readonly<Record<Side, BattleSide>>;
  /** 場の全体カード（なければ null） */
  readonly field: FieldCard | null;
  readonly winner: BattleWinner | null;
  /** knockout＝3体KO、deckOut＝引くべきカードを引けなかった（山札切れ） */
  readonly endReason: 'knockout' | 'deckOut' | null;
  /** このターンにあと何枚マナにできるか（null＝制限なし。先攻1ターン目だけ制限あり） */
  readonly manaConvertLimit: number | null;
  readonly log: readonly LogEntry[];
  readonly nextUid: number;
  /** 効果音のきっかけ（新しい順に最大20件だけ残す） */
  readonly fx: readonly BattleFx[];
  readonly fxSeq: number;
  /**
   * 手札の確認（正式：ノビトンの不思議な嗅覚 2026-10-25）。viewer が cardIds（相手の手札）を見た。
   * 画面は seq が変わったときだけ表を見せる（手札そのものは動かさない。ふだん相手の手札は裏向きのまま）
   */
  readonly reveal?: { readonly seq: number; readonly viewer: Side; readonly cardIds: readonly string[] } | null;
}

export type BattleAction =
  | {
      readonly type: 'useCard';
      readonly side: Side;
      readonly cardUid: string;
      /** 技を使うモンスター（省略時は使えるモンスターを自動で選ぶ。サポートには不要） */
      readonly userUid?: string;
      /** 対象（攻撃：相手モンスター、回復：味方モンスター） */
      readonly targetUid?: string;
      /** 選んだカード（2026-10-30 指示書 Y：思い出の箱＝捨て札の技カードの ID、風まかせ＝山札に戻す手札の uid） */
      readonly choice?: string;
    }
  /** note（2026-10-30 指示書 Z）：腕前 C の CPU が守れるのに守らなかったとき 'misguard'（2026-10-31 指示書 AB から記録には書かず、画面が相手のセリフをふきだしで出す。src/data/cpuLines.ts） */
  | { readonly type: 'defend'; readonly side: Side; readonly cardUid: string | null; readonly note?: 'misguard' }
  /** 攻撃を終えてマナ化へ進む。note：腕前 C の CPU が攻撃を見送ったとき 'hesitate'（2026-10-30 指示書 Z。2026-10-31 指示書 AB から記録には書かず、画面が相手のセリフをふきだしで出す） */
  | { readonly type: 'endAttack'; readonly side: Side; readonly note?: 'hesitate' }
  /** マナ化：手札1枚をマナにする（マナ化の間は何回でも） */
  | { readonly type: 'convertToMana'; readonly side: Side; readonly cardUid: string }
  | { readonly type: 'endTurn'; readonly side: Side };

export interface CombatantSetup {
  readonly name: string;
  readonly deck: Deck;
  /** ライフ倍率（敵の強さ調整・仮） */
  readonly lifeScale?: number;
}

/* ---------- 開始 ---------- */

function makeMonsters(prefix: string, ids: readonly string[], scale: number): BattleMonster[] {
  return ids.map((cardId, i) => {
    const maxLife = Math.max(1, Math.round(getMonster(cardId).life * scale));
    return { uid: `${prefix}-m${i + 1}`, cardId, maxLife, life: maxLife, acted: false };
  });
}

function drawCards(side: BattleSide, count: number, nextUid: number): { side: BattleSide; nextUid: number; drawn: number } {
  const n = Math.max(0, Math.min(count, side.deck.length));
  const drawnIds = side.deck.slice(0, n);
  let uid = nextUid;
  const hand = [...side.hand, ...drawnIds.map((cardId) => ({ uid: `c${uid++}`, cardId }))];
  return { side: { ...side, deck: side.deck.slice(n), hand }, nextUid: uid, drawn: n };
}

export function createBattle(
  player: CombatantSetup,
  opponent: CombatantSetup,
  seed: number,
  first?: Side,
): BattleState {
  let s = seed;
  const pShuffle = shuffle(player.deck.skills, s);
  s = pShuffle.seed;
  const oShuffle = shuffle(opponent.deck.skills, s);
  s = oShuffle.seed;
  let firstSide = first;
  if (!firstSide) {
    const r = nextRandom(s);
    s = r.seed;
    firstSide = r.value < 0.5 ? 'player' : 'opponent';
  }
  const base = (setup: CombatantSetup, prefix: string, deck: string[]): BattleSide => ({
    name: setup.name,
    monsters: makeMonsters(prefix, setup.deck.monsters, setup.lifeScale ?? 1),
    deck,
    hand: [],
    discard: [],
    manaPile: [],
    turnUsage: {},
  });
  const sides: Record<Side, BattleSide> = { player: base(player, 'p', pShuffle.items), opponent: base(opponent, 'o', oShuffle.items) };
  // PS版：最初に手札を引くのは先攻だけ。後攻は自分の最初のドローで5枚引く
  const dealt = drawCards(sides[firstSide], BATTLE_RULES.initialHand, 1);
  sides[firstSide] = dealt.side;
  const uid = dealt.nextUid;
  // 先攻1ターン目（PS版）：攻撃はなく、すぐマナ化。マナにできるのは決まった枚数まで
  return {
    seed: s,
    turn: 1,
    active: firstSide,
    first: firstSide,
    phase: 'mana',
    pending: null,
    sides,
    field: null,
    winner: null,
    endReason: null,
    manaConvertLimit: BATTLE_RULES.firstTurnManaLimit,
    log: [
      { turn: 1, text: t(`battle.log.start.${firstSide}`) },
      { turn: 1, text: t('battle.log.firstTurnMana', { n: BATTLE_RULES.firstTurnManaLimit }) },
    ],
    nextUid: uid,
    fx: [],
    fxSeq: 0,
  };
}

/* ---------- 参照用 ---------- */

export function aliveMonsters(side: BattleSide): BattleMonster[] {
  return side.monsters.filter((m) => m.life > 0);
}

export function findMonster(state: BattleState, uid: string): { side: Side; monster: BattleMonster } | null {
  for (const side of ['player', 'opponent'] as const) {
    const monster = state.sides[side].monsters.find((m) => m.uid === uid);
    if (monster) return { side, monster };
  }
  return null;
}

export function findHandCard(state: BattleState, side: Side, cardUid: string): HandCard | undefined {
  return state.sides[side].hand.find((c) => c.uid === cardUid);
}

/**
 * その技を使えるモンスター（適合・生存・未行動・まきつくで止められていない。攻撃の技は、すなかけで封じられていないこと）。
 * 続けて使える技（ツムジの Wひっかき）は、この手番にその技を1回だけ使ったモンスターも使える（chainReady）
 */
export function availableUsers(state: BattleState, side: Side, skill: SkillCard): BattleMonster[] {
  const attack = skill.effect.type === 'attack';
  return state.sides[side].monsters.filter(
    (m) =>
      m.cardId === skill.monsterId &&
      m.life > 0 &&
      (!m.acted || chainReady(state, m, skill)) &&
      m.stunnedTurn !== state.turn &&
      !(attack && m.sealedTurn === state.turn),
  );
}

/** このモンスターが、この手番に続けてもう1回 skill を使えるか（Wひっかき → Wひっかき。1ターンに最大2回） */
export function chainReady(state: BattleState, m: BattleMonster, skill: SkillCard): boolean {
  return skill.effect.type === 'attack' && !!skill.effect.chain && m.chain?.turn === state.turn && m.chain.cardId === skill.id;
}

/** 使うモンスターにかかっている「この手番の攻撃技の消費マナ−」（かぜのり。効く手番のときだけ。かけた同じ手番には効かない） */
export function windRideOf(state: BattleState, user: BattleMonster | undefined): number {
  const w = user?.windRide;
  return w && user.life > 0 && state.turn === w.turn ? w.discount : 0;
}

/** その技を user が使うときの消費マナ（かぜのりで攻撃技は−1。0より下にはならない） */
export function skillCost(state: BattleState, skill: SkillCard, user?: BattleMonster): number {
  return skill.effect.type === 'attack' ? Math.max(0, skill.cost - windRideOf(state, user)) : skill.cost;
}

/** 手札のその技を、いま使えるモンスターのだれかが使うときのいちばん少ない消費マナ（使えるモンスターがいなければカードのマナ） */
export function handSkillCost(state: BattleState, side: Side, skill: SkillCard): number {
  if (isGuardSkill(skill)) return guardCost(state, skill);
  const users = availableUsers(state, side, skill);
  return users.length === 0 ? skill.cost : Math.min(...users.map((u) => skillCost(state, skill, u)));
}

export interface Usability {
  readonly usable: boolean;
  readonly reason: string | null;
}

const NO: (reason: string) => Usability = (reason) => ({ usable: false, reason });
const YES: Usability = { usable: true, reason: null };

/** サポートの残り使用回数（制限なしなら null） */
export function supportUsesLeft(state: BattleState, side: Side, card: SupportCard): number | null {
  if (!card.limitGroup || card.limitPerTurn === undefined) return null;
  return card.limitPerTurn - (state.sides[side].turnUsage[card.limitGroup] ?? 0);
}

function supportUsability(state: BattleState, side: Side, card: SupportCard): Usability {
  if (state.phase === 'defense') return NO(t('battle.ng.defenseOnly'));
  if (state.active !== side) return NO(t('battle.ng.opponentTurn'));
  if (state.phase === 'mana') return NO(t('battle.ng.manaPhase'));
  if (manaOf(state.sides[side]) < card.cost) return NO(t('battle.ng.noMana'));
  const left = supportUsesLeft(state, side, card);
  if (left !== null && left <= 0) return NO(t('battle.ng.usedThisTurn'));
  if (card.effect.type === 'heal' && aliveMonsters(state.sides[side]).length === 0) return NO(t('battle.ng.noHealTarget'));
  // 2026-10-30 指示書 Y：サポートカード フェーズ1
  const s = state.sides[side];
  switch (card.effect.type) {
    case 'stone':
      if (attackableMonsters(state, otherSide(side)).length === 0) return NO(t('battle.ng.noAttackTarget'));
      break;
    case 'recall':
      if (recallChoices(state, side).length === 0) return NO(t('battle.ng.noRecall'));
      if (s.hand.length - 1 >= BATTLE_RULES.maxHand) return NO(t('battle.ng.handFull'));
      break;
    case 'swap':
      if (s.hand.length <= 1) return NO(t('battle.ng.noHandToReturn'));
      break;
    case 'manaDrain':
      if (manaOf(state.sides[otherSide(side)]) <= 0) return NO(t('battle.ng.noOpponentMana'));
      break;
    case 'cheer':
      if (cheerTargets(state, side).length === 0) return NO(t('battle.ng.noCheerTarget'));
      break;
    default:
      break;
  }
  return YES;
}

/** 思い出の箱で選べるカード（自分の捨て札の技カード。同じカードは1つにまとめる。捨て札の順） */
export function recallChoices(state: BattleState, side: Side): string[] {
  return [...new Set(state.sides[side].discard.filter((id) => cardCatalog.get(id)?.kind === 'skill'))];
}

/** 声援をかけられる味方（生きていて、このターンまだ動いていない） */
export function cheerTargets(state: BattleState, side: Side): BattleMonster[] {
  return aliveMonsters(state.sides[side]).filter((m) => !m.acted);
}

/** 手札のカードを今使えるか（使用不可状態の表示に使う） */
export function cardUsability(state: BattleState, side: Side, cardUid: string): Usability {
  if (state.phase === 'ended') return NO(t('battle.ng.ended'));
  const hand = findHandCard(state, side, cardUid);
  if (!hand) return NO(t('battle.ng.notInHand'));
  const card = getPlayCard(hand.cardId);
  if (card.kind === 'support') return supportUsability(state, side, card);
  const skill = card;
  const owner = state.sides[side].monsters.filter((m) => m.cardId === skill.monsterId);
  if (owner.length === 0) return NO(t('battle.ng.noOwner'));
  if (owner.every((m) => m.life <= 0)) return NO(t('battle.ng.ownerDown'));

  if (state.phase === 'defense') {
    const pending = state.pending;
    if (!pending || pending.attacker === side) return NO(t('battle.ng.waitDefense'));
    const type = skill.effect.type;
    if (type !== 'defense' && type !== 'evade' && type !== 'cover') return NO(t('battle.ng.defenseOnly'));
    // かばう：狙われたほかの味方の代わりに受ける（狙われたモンスターのカードでなくてよい）
    if (type === 'cover') return coverUsability(state, side, skill, pending);
    // 守備に使えるのは、狙われたモンスターの防御・回避カードだけ
    const target = state.sides[side].monsters.find((m) => m.uid === pending.targetUid);
    if (!target || target.cardId !== skill.monsterId) return NO(t('battle.ng.notTarget'));
    const against = guardAgainst(skill);
    if (against !== 'all' && against !== pending.stat) return NO(t('battle.ng.wrongStat', { stat: statLabel(pending.stat) }));
    const attackCard = attackCardOf(pending.cardId);
    const attack = attackCard.effect;
    if (attack.type === 'attack' && type === 'defense' && attack.unblockable) return NO(t('battle.ng.unblockable'));
    // 「回避されない」攻撃は、回避の条件が合っていても回避できない（防御はできる）
    if (attack.type === 'attack' && type === 'evade' && (attack.undodgeable || pending.undodgeable)) return NO(t('battle.ng.undodgeable'));
    // じならしをかけられたモンスターは、この手番の次の攻撃1回を回避できない（防御はできる）
    if (type === 'evade' && pending.pinned) return NO(t('battle.ng.pinned'));
    // 「必要マナ2以上の〜を回避」「消費マナ3以上の〜ダメージ−4」「消費マナ2以下の〜を回避」：
    // 受ける攻撃カードに印字された必要マナで判定（いまのマナの残りではない）
    const minCost = guardMinCost(skill);
    if (minCost > 0 && attackCard.cost < minCost) return NO(t('battle.ng.evadeMinCost', { n: minCost }));
    const maxCost = guardMaxCost(skill);
    if (maxCost !== null && attackCard.cost > maxCost) return NO(t('battle.ng.maxCost', { n: maxCost }));
    if (manaOf(state.sides[side]) < guardCost(state, skill)) return NO(t('battle.ng.noMana'));
    return YES;
  }

  if (state.active !== side) return NO(t('battle.ng.opponentTurn'));
  if (state.phase === 'mana') return NO(t('battle.ng.manaPhase'));
  if (skill.effect.type === 'defense' || skill.effect.type === 'evade' || skill.effect.type === 'cover') return NO(t('battle.ng.defenseOnAttack'));
  // じならし：1ターンに1回（2026-10-29 指示書）
  if (skill.effect.type === 'pin' && (state.sides[side].turnUsage[PIN_USAGE] ?? 0) >= 1) return NO(t('battle.ng.usedThisTurn'));
  // いたずら・不思議な嗅覚：相手の手札がないときは使えない（いたずらは 2026-10-24 ユーザー指示。嗅覚も同じ扱い）
  if ((skill.effect.type === 'handToDeck' || skill.effect.type === 'discardRandom' || skill.effect.type === 'revealHand') && state.sides[otherSide(side)].hand.length === 0) {
    return NO(t('battle.ng.noOpponentHand'));
  }
  // みちしお（セレフィーン 2026-10-29）：山札が足りないときは使えない（灰色。使って負けにはしない）
  if (skill.effect.type === 'mana' && skill.effect.amount !== undefined && state.sides[side].deck.length < skill.effect.amount) return NO(t('battle.ng.noDeck'));
  // 考える：このカードのほかに戻す手札がないときは使えない
  if (skill.effect.type === 'redrawHand' && state.sides[side].hand.length <= 1) return NO(t('battle.ng.noHandToReturn'));
  // おいかぜ：かけられる味方（使ったモンスターと同じ種類以外で、生きている）がいないときは使えない
  if (skill.effect.type === 'tailwind' && tailwindTargets(state, side, skill).length === 0) return NO(t('battle.ng.noTailwindTarget'));
  // かぜのり（ツムジ）が効いていれば、攻撃技の消費マナ−1
  if (manaOf(state.sides[side]) < handSkillCost(state, side, skill)) return NO(t('battle.ng.noMana'));
  if (availableUsers(state, side, skill).length === 0) {
    // まきつくで止められている・すなかけで攻撃を封じられているだけのとき
    const stunned = owner.some((m) => m.life > 0 && !m.acted && m.stunnedTurn === state.turn);
    if (stunned) return NO(t('battle.ng.stunned'));
    const sealed = owner.some((m) => m.life > 0 && !m.acted && m.sealedTurn === state.turn);
    return NO(t(sealed && skill.effect.type === 'attack' ? 'battle.ng.sealed' : 'battle.ng.acted'));
  }
  if (targetsEnemy(skill) && aliveMonsters(state.sides[otherSide(side)]).length === 0) {
    return NO(t('battle.ng.noAttackTarget'));
  }
  // すなをほる：相手が全員隠れていれば攻撃の技は使えない
  if (skill.effect.type === 'attack' && attackableMonsters(state, otherSide(side)).length === 0) return NO(t('battle.ng.allHidden'));
  return YES;
}

/** じならしの回数を数える turnUsage のキー（1ターンに1回） */
const PIN_USAGE = 'skill:pin';

/** かばうで代わりに受けるモンスター（狙われたモンスター以外の、生きている同じ種類〔ジオル〕。左から） */
export function coverUser(state: BattleState, side: Side, skill: SkillCard): BattleMonster | undefined {
  const targetUid = state.pending?.targetUid;
  return aliveMonsters(state.sides[side]).find((m) => m.cardId === skill.monsterId && m.uid !== targetUid);
}

/**
 * かばうを使えるか（試遊中：ジオル 2026-10-29）。ジオル以外の味方が攻撃で狙われていて、ジオルが生きていて、マナが足りるとき。
 * 「防御されない」攻撃・相手全体への攻撃には使えない。1回の攻撃に1回だけで、狙われた味方がほかの守りを使う前（最初の守り）だけ【Claude の裁定】
 */
function coverUsability(state: BattleState, side: Side, skill: SkillCard, pending: PendingAttack): Usability {
  const attack = attackCardOf(pending.cardId).effect;
  if (attack.type === 'attack' && attack.unblockable) return NO(t('battle.ng.unblockable'));
  if (attack.type === 'attack' && attack.allTargets) return NO(t('battle.ng.coverAllTargets'));
  if (pending.coveredFrom) return NO(t('battle.ng.coverOnce'));
  if (pending.responses.length > 0) return NO(t('battle.ng.coverFirst'));
  const target = state.sides[side].monsters.find((m) => m.uid === pending.targetUid);
  if (!target || target.cardId === skill.monsterId) return NO(t('battle.ng.coverSelf'));
  if (!coverUser(state, side, skill)) return NO(t('battle.ng.ownerDown'));
  if (manaOf(state.sides[side]) < guardCost(state, skill)) return NO(t('battle.ng.noMana'));
  return YES;
}

/**
 * ちょうはつで、このモンスターがこの手番に攻撃できる相手が限られているなら、その種類（モンスター ID）。限られていなければ null。
 * 【要仕様確定】相手の場にその種類（ラズック）が1体も生きていなければ、制限なしとした（対戦が止まらないように）。
 * ラズックが複数いれば、どのラズックにも攻撃できる
 */
export function tauntRestriction(state: BattleState, side: Side, user: BattleMonster): string | null {
  const taunt = user.taunt;
  if (!taunt || taunt.turn !== state.turn) return null;
  // すなをほるで隠れているラズックは数えない（攻撃できるラズックがいなければ制限なし）
  return attackableMonsters(state, otherSide(side)).some((m) => m.cardId === taunt.monsterId) ? taunt.monsterId : null;
}

/** 攻撃の技の対象にできるモンスター（生きていて、すなをほるで隠れていない） */
export function attackableMonsters(state: BattleState, side: Side): BattleMonster[] {
  return aliveMonsters(state.sides[side]).filter((m) => m.hiddenTurn !== state.turn);
}

/**
 * 対象を選ぶ必要があるカードなら、選べる対象を返す。
 * 攻撃の技は、ちょうはつで相手が限られていればそれに従う。user を渡さなければ、使えるモンスターのだれかが攻撃できる相手すべて。
 * 【要仕様確定】ちょうはつが限るのは攻撃の技だけ（特殊の技・防御・回避・サポートは限らない）
 */
export function targetsFor(state: BattleState, side: Side, card: PlayCard, user?: BattleMonster): BattleMonster[] {
  if (card.kind === 'skill' && targetsEnemy(card)) {
    if (card.effect.type !== 'attack') return aliveMonsters(state.sides[otherSide(side)]);
    // 攻撃の技は、すなをほるで隠れている相手を選べない
    const enemies = attackableMonsters(state, otherSide(side));
    const users = user ? [user] : availableUsers(state, side, card);
    return enemies.filter((e) =>
      users.some((u) => {
        const only = tauntRestriction(state, side, u);
        return only === null || e.cardId === only;
      }),
    );
  }
  // 回復（薬草）・いやしのみつ（フルーネ。使ったモンスターも選べる）：生きている味方（倒れた味方は選べない）
  if (card.effect.type === 'heal' || card.effect.type === 'healAlly') return aliveMonsters(state.sides[side]);
  // 投石（2026-10-30 指示書 Y）：すなをほるで隠れていない相手（ちょうはつの制限は受けない）。声援：まだ動いていない味方
  if (card.kind === 'support' && card.effect.type === 'stone') return attackableMonsters(state, otherSide(side));
  if (card.kind === 'support' && card.effect.type === 'cheer') return cheerTargets(state, side);
  if (card.kind === 'skill' && card.effect.type === 'tailwind') return tailwindTargets(state, side, card);
  return [];
}

/** おいかぜをかけられる味方（生きていて、使ったモンスターと同じ種類〔プカリム〕でない） */
export function tailwindTargets(state: BattleState, side: Side, skill: SkillCard): BattleMonster[] {
  return aliveMonsters(state.sides[side]).filter((m) => m.cardId !== skill.monsterId);
}

/**
 * 攻撃のカード（守りの判定・ダメージ・攻撃に付いた効果に使う）。投石（2026-10-30 指示書 Y）はサポートだが、
 * ちから技（マナ＝カードのマナ・ダメージ value・効果なし）として扱う。使うモンスターはいない
 */
export function attackCardOf(cardId: string): SkillCard {
  const card = getPlayCard(cardId);
  if (card.kind === 'skill') return card;
  const value = card.effect.type === 'stone' ? card.effect.value : 0;
  return { kind: 'skill', id: card.id, name: card.name, rarity: card.rarity, isPlaceholder: false, monsterId: '', cost: card.cost, category: 'force', stat: { type: 'force', value }, effect: { type: 'attack' } } as SkillCard;
}

/** 声援（2026-10-30 指示書 Y）：このターンの、次の攻撃技のダメージ＋ */
export function cheerOf(state: BattleState, user: BattleMonster | undefined): number {
  const c = user?.cheer;
  return c && user.life > 0 && c.turn === state.turn ? c.amount : 0;
}

/** 場のカード「守りの陣」（2026-10-30 指示書 Y）：防御・回避のカードの必要マナを減らす量（場に無ければ 0） */
export function guardDiscountOf(state: BattleState): number {
  if (!state.field) return 0;
  const e = getSupport(state.field.cardId).effect;
  return e.type === 'guardDiscount' ? e.value : 0;
}

/** 守りのカード（防御・回避・かばう）か */
const isGuardSkill = (skill: SkillCard): boolean => skill.effect.type === 'defense' || skill.effect.type === 'evade' || skill.effect.type === 'cover';

/** 守りのカードの必要マナ（守りの陣が場にあれば−。0より下にならない） */
export function guardCost(state: BattleState, skill: SkillCard): number {
  return isGuardSkill(skill) ? Math.max(0, skill.cost - guardDiscountOf(state)) : skill.cost;
}

/** 使うモンスターがためている「次の攻撃技のダメージ＋」（ほっぺにためる） */
export function chargeOf(user: BattleMonster | undefined): number {
  return user && user.life > 0 ? (user.charge ?? 0) : 0;
}

/** 使うモンスターにかかっている「次のターンの攻撃技のダメージ＋」（おいかぜ。効く手番〔turn〕のときだけ。かけた同じ手番には効かない） */
export function tailwindOf(state: BattleState, user: BattleMonster | undefined): number {
  const w = user?.tailwind;
  return w && user.life > 0 && state.turn === w.turn ? w.amount : 0;
}

/** じならしで、この手番に受ける次の攻撃を回避できないか（倒れていれば false） */
export function isPinned(state: BattleState, monster: BattleMonster | undefined): boolean {
  return !!monster && monster.life > 0 && monster.pinTurn === state.turn;
}

/** エネルギーをためるで、この攻撃（かしこさ技）のダメージが2倍になるか（効く手番で、まだかしこさ技を使っていないとき） */
export function energyOf(state: BattleState, user: BattleMonster | undefined, skill: SkillCard): boolean {
  const e = user?.energy;
  return !!e && user.life > 0 && state.turn === e.turn && skill.effect.type === 'attack' && skill.stat?.type === 'wisdom';
}

/** 場の全体カードによる、その能力の攻撃のダメージの増減 */
export function fieldModifier(state: BattleState, stat: StatType): number {
  if (!state.field) return 0;
  const e = getSupport(state.field.cardId).effect;
  if (e.type !== 'field') return 0;
  return e.stat === 'all' || e.stat === stat ? e.modifier : 0;
}

/** 使うモンスターにかかっている「次の技のダメージ−」（吠える・熱風の威嚇）。その技の種類に効き、期限（untilTurn）が過ぎていないときだけ */
export function weakenOf(state: BattleState, user: BattleMonster | undefined, skill: SkillCard): number {
  const w = user?.weaken;
  if (!w || (w.untilTurn !== undefined && state.turn > w.untilTurn)) return 0;
  return skill.stat && w.stat === skill.stat.type ? w.amount : 0;
}

/** 使うモンスターにかかっている「この手番の技のダメージ−」（ダストキック）。この手番で、その技の種類に効くときだけ */
export function weakenTurnOf(state: BattleState, user: BattleMonster | undefined, skill: SkillCard): number {
  const w = user?.weakenTurn;
  return w && w.turn === state.turn && skill.stat && w.stat === skill.stat.type ? w.amount : 0;
}

/**
 * 攻撃の威力（場の増減と、使うモンスターへの「吠える」「ダストキック」「ほっぺにためる」「おいかぜ」「エネルギーをためる」を反映。0未満にはならない）。
 * エネルギーをためるの2倍は「カードのダメージ」にかけ、ほかの＋・−はそのあとに足す（2026-10-29 指示書。防御の軽減はさらにそのあと）
 */
export function attackPower(state: BattleState, skill: SkillCard, user?: BattleMonster): number {
  if (!skill.stat) return 0;
  const base = skill.stat.value * (energyOf(state, user, skill) ? 2 : 1);
  const boost = chargeOf(user) + tailwindOf(state, user) + cheerOf(state, user);
  return Math.max(0, base + boost + fieldModifier(state, skill.stat.type) - weakenOf(state, user, skill) - weakenTurnOf(state, user, skill));
}

/** その攻撃が、使うモンスターの今の状態で「回避されない」か（ぷはーっ：ためているとき） */
export function undodgeableNow(skill: SkillCard, user: BattleMonster | undefined): boolean {
  return skill.effect.type === 'attack' && (!!skill.effect.undodgeable || (!!skill.effect.undodgeableWhenCharged && chargeOf(user) > 0));
}

/** 手札をマナにできるか（攻撃のあとのマナ化の間だけ。枚数の制限なし） */
export function canConvertToMana(state: BattleState, side: Side): boolean {
  return (
    state.phase === 'mana' &&
    state.active === side &&
    state.sides[side].hand.length > 0 &&
    (state.manaConvertLimit === null || state.manaConvertLimit > 0)
  );
}

/* ---------- 進行 ---------- */

function addLog(state: BattleState, text: string): BattleState {
  return { ...state, log: [...state.log, { turn: state.turn, text }] };
}

function addFx(state: BattleState, kind: BattleFxKind, side: Side): BattleState {
  const seq = (state.fxSeq ?? 0) + 1;
  return { ...state, fxSeq: seq, fx: [...(state.fx ?? []), { seq, kind, side }].slice(-20) };
}

function updateSide(state: BattleState, side: Side, patch: Partial<BattleSide>): BattleState {
  return { ...state, sides: { ...state.sides, [side]: { ...state.sides[side], ...patch } } };
}

function updateMonster(state: BattleState, uid: string, patch: Partial<BattleMonster>): BattleState {
  const found = findMonster(state, uid);
  if (!found) return state;
  const monsters = state.sides[found.side].monsters.map((m) => (m.uid === uid ? { ...m, ...patch } : m));
  return updateSide(state, found.side, { monsters });
}

function removeFromHand(state: BattleState, side: Side, cardUid: string): BattleState {
  const s = state.sides[side];
  const card = s.hand.find((c) => c.uid === cardUid);
  if (!card) return state;
  return updateSide(state, side, {
    hand: s.hand.filter((c) => c.uid !== cardUid),
    discard: [...s.discard, card.cardId],
  });
}

/** マナを支払う。支払ったカードはマナから捨て札へ移す（呼ぶ前に足りることを確認しておく） */
function payMana(state: BattleState, side: Side, cost: number): BattleState {
  const s = state.sides[side];
  const n = Math.max(0, Math.min(cost, s.manaPile.length));
  const oldest = BATTLE_RULES.manaPayOrder === 'oldest';
  const paid = oldest ? s.manaPile.slice(0, n) : s.manaPile.slice(s.manaPile.length - n);
  const manaPile = oldest ? s.manaPile.slice(n) : s.manaPile.slice(0, s.manaPile.length - n);
  const next = updateSide(state, side, { manaPile, discard: [...s.discard, ...paid] });
  return n > 0 ? addFx(next, 'manaSpend', side) : next;
}

const nameOf = (cardId: string): string => cardName(cardId);

function checkKnockout(state: BattleState): BattleState {
  const pAlive = aliveMonsters(state.sides.player).length;
  const oAlive = aliveMonsters(state.sides.opponent).length;
  if (pAlive > 0 && oAlive > 0) return state;
  // 双方が同時に全滅したら攻撃側（いまの手番の側）の勝ち。引き分けにはならない
  const winner: Side = pAlive === 0 && oAlive === 0 ? state.active : pAlive === 0 ? 'opponent' : 'player';
  const ended: BattleState = { ...state, phase: 'ended', pending: null, winner, endReason: 'knockout' };
  return addLog(ended, t(`battle.log.win.${winner}`));
}

/** 引くべきカードを引けなかった側の負け */
function loseByDeckOut(state: BattleState, loser: Side): BattleState {
  const winner = otherSide(loser);
  const ended: BattleState = { ...state, phase: 'ended', pending: null, winner, endReason: 'deckOut' };
  return addLog(ended, t(`battle.log.deckOut.${loser}`));
}

function applyDamage(state: BattleState, targetUid: string, damage: number): BattleState {
  const found = findMonster(state, targetUid);
  if (!found) return state;
  const life = Math.max(0, found.monster.life - damage);
  // 倒れたら、ほっぺにためた分・おいかぜ・じならし・エネルギーをためる・かぜのり・Wひっかきの続きは消える
  let next = updateMonster(state, targetUid, life === 0 ? { life, charge: null, tailwind: null, pinTurn: null, energy: null, windRide: null, chain: null, cheer: null } : { life });
  next = addLog(next, t(life === 0 ? 'battle.log.damageDown' : 'battle.log.damage', { name: nameOf(found.monster.cardId), n: damage }));
  return checkKnockout(next);
}

/**
 * 守備がすべて終わったあとのダメージ計算。
 * 回避が1枚でもあれば0（「回避しても半分」の攻撃なら半分・端数切り捨て）。なければ防御の合計だけ減らす。
 * 反射・無効などは正式カードが決まってから足す。
 */
export function pendingDamage(pending: PendingAttack): number {
  const cards = pending.responses.map(getSkill);
  if (cards.some((c) => c.effect.type === 'evade')) {
    const attack = attackCardOf(pending.cardId).effect;
    return attack.type === 'attack' && attack.halfOnEvade ? Math.floor(pending.power / 2) : 0;
  }
  const reduction = cards.filter((c) => c.effect.type === 'defense').reduce((sum, c) => sum + guardReduction(c), 0);
  return Math.max(0, pending.power - reduction);
}

/** monster にかかっている「受ける stat の技のダメージ−」の量（正式：ミュロルのしめったはだ。期限が過ぎていれば 0） */
export function shieldOf(state: BattleState, monster: BattleMonster | undefined, stat: StatType): number {
  const sh = monster?.shield;
  if (!sh || state.turn > sh.untilTurn) return 0;
  return sh.against === 'all' || sh.against === stat ? sh.reduce : 0;
}

/**
 * 守備のあとに実際に受けるダメージ（pendingDamage から、狙われたモンスターのしめったはだの分を引く。0未満にならない）。
 * 防御カードの合計と同じく、引いてから最後に0で止める
 */
export function incomingDamage(state: BattleState, pending: PendingAttack): number {
  const target = findMonster(state, pending.targetUid)?.monster;
  return Math.max(0, pendingDamage(pending) - shieldOf(state, target, pending.stat));
}

function resolvePending(state: BattleState): BattleState {
  const pending = state.pending;
  if (!pending) return state;
  const next: BattleState = { ...state, phase: 'main', pending: null };
  const damage = incomingDamage(state, pending);
  const target = findMonster(state, pending.targetUid);
  const evaded = pending.responses.some((id) => getSkill(id).effect.type === 'evade');
  // 相手のライフが実際に減った量（倒しすぎた分は入らない。フラワードレインの回復に使う）
  const lost = Math.min(damage, target?.monster.life ?? 0);
  let withFx = next;
  if (damage > 0) withFx = addFx(next, hitKind(pending.cardId), pending.attacker);
  else if (evaded) withFx = addFx(next, 'evade', target?.side ?? otherSide(pending.attacker));
  // じならしは、攻撃を1回受けたら消える（当たっても・守っても）
  const after = clearPin(applyDamage(withFx, pending.targetUid, damage), pending.targetUid);
  const recoiled = damage > 0 ? selfDamageOnHit(after, pending.cardId, pending.userUid) : after;
  const drained = evaded ? recoiled : drainHeal(recoiled, pending.cardId, pending.userUid, lost);
  const done = evaded ? drained : attackRiders(drained, pending.cardId, pending.attacker, pending.targetUid);
  return nextAllTarget(done, pending);
}

/** じならしを消す（その手番に攻撃を1回受けた） */
function clearPin(state: BattleState, uid: string): BattleState {
  const m = findMonster(state, uid)?.monster;
  return m?.pinTurn != null ? updateMonster(state, uid, { pinTurn: null }) : state;
}

/**
 * 相手全体への攻撃（地ひびき）：1体の守りとダメージが終わったら、次の相手（まだ生きている・隠れていない）の守りへ。
 * 威力は使ったときのまま（ほっぺにためる・おいかぜ などは使ったときに1回だけ数える）。全員終わったら攻撃の手番に戻る
 */
function nextAllTarget(state: BattleState, done: PendingAttack): BattleState {
  if (!done.queue || state.phase === 'ended') return state;
  const rest = done.queue.filter((uid) => {
    const m = findMonster(state, uid)?.monster;
    return !!m && m.life > 0 && m.hiddenTurn !== state.turn;
  });
  const [nextUid, ...more] = rest;
  if (!nextUid) return state;
  const target = findMonster(state, nextUid)?.monster;
  const { pinned: _p, coveredFrom: _c, ...base } = done;
  const pending: PendingAttack = { ...base, targetUid: nextUid, responses: [], queue: more, ...(isPinned(state, target) ? { pinned: true } : {}) };
  return { ...state, phase: 'defense', pending };
}

/**
 * 技が当たったときの反動（正式：すてみタックル「技が当たった場合、自分のライフ−1」）。
 * 【要仕様確定】「当たった」はダメージが1以上のときとした（回避・防御で0のときは反動なし）。勝負がついたあとは何もしない
 */
function selfDamageOnHit(state: BattleState, skillId: string, userUid: string): BattleState {
  const e = attackCardOf(skillId).effect;
  if (e.type !== 'attack' || !e.selfDamageOnHit || state.phase === 'ended') return state;
  const user = findMonster(state, userUid);
  if (!user || user.monster.life <= 0) return state;
  const next = addLog(addFx(state, 'recoil', user.side), t('battle.log.recoil', { name: nameOf(user.monster.cardId), n: e.selfDamageOnHit }));
  return applyDamage(next, userUid, e.selfDamageOnHit);
}

/**
 * フラワードレイン（正式：フルーネ 2026-10-29）：攻撃のあと、相手のライフが実際に減った量（lost）だけ、使ったモンスターのライフを回復する。
 * 最大ライフ（その対戦での最大。ボスの lifeScale がかかっていればその値）を超えない。0 なら何もしない。勝負がついたあと・使ったモンスターが倒れていれば何もしない
 */
function drainHeal(state: BattleState, skillId: string, userUid: string, lost: number): BattleState {
  const e = attackCardOf(skillId).effect;
  if (e.type !== 'attack' || !e.drain || lost <= 0 || state.phase === 'ended') return state;
  const user = findMonster(state, userUid)?.monster;
  if (!user || user.life <= 0 || user.life >= user.maxLife) return state;
  return healMonster(state, user, lost);
}

/** 命中の音の種類（強攻撃は仮に必要マナ STRONG_ATTACK_COST 以上の技） */
function hitKind(skillId: string): BattleFxKind {
  return attackCardOf(skillId).cost >= STRONG_ATTACK_COST ? 'hitStrong' : 'hitNormal';
}

/**
 * ターン開始とドローステップ。
 * 手札が5枚より少なければ5枚まで引く。5枚あれば山札の一番上を1枚そのままマナにする。
 * どちらも山札が足りなければ、その時点で負け。
 */
function startTurn(state: BattleState, side: Side): BattleState {
  const s = state.sides[side];
  // すなかけの「攻撃できない」は手番の番号（sealedTurn）で決まるので、過ぎた手番のものは何もしなくても効かない
  const monsters = s.monsters.map((m) => ({ ...m, acted: false }));
  let next: BattleState = { ...state, active: side, phase: 'main', manaConvertLimit: null };
  next = addLog(updateSide(next, side, { monsters, turnUsage: {} }), t(`battle.log.turn.${side}`));
  const need = BATTLE_RULES.refillHandTo - s.hand.length;
  if (need > 0) {
    if (s.deck.length < need) return loseByDeckOut(next, side);
    const drawn = drawCards(next.sides[side], need, next.nextUid);
    return updateSide({ ...next, nextUid: drawn.nextUid }, side, drawn.side);
  }
  const top = s.deck[0];
  if (top === undefined) return loseByDeckOut(next, side);
  next = updateSide(next, side, { deck: s.deck.slice(1), manaPile: [...s.manaPile, top] });
  return addLog(addFx(next, 'manaGain', side), t('battle.log.fullHandMana', { n: BATTLE_RULES.refillHandTo }));
}

/**
 * 行動を適用する。ルール上できない行動は無視して state をそのまま返す
 * （UI の二重タップや AI の誤りで状態が壊れないようにする）。
 */
export function applyAction(state: BattleState, action: BattleAction): BattleState {
  if (state.phase === 'ended') return state;
  switch (action.type) {
    case 'useCard':
      return useCard(state, action.side, action.cardUid, action.userUid, action.targetUid, action.choice);
    case 'defend':
      return defend(state, action.side, action.cardUid);
    case 'endAttack': {
      if (state.phase !== 'main' || state.active !== action.side) return state;
      return addLog({ ...state, phase: 'mana' }, t(`battle.log.manaPhase.${action.side}`));
    }
    case 'convertToMana': {
      if (!canConvertToMana(state, action.side)) return state;
      const s = state.sides[action.side];
      const card = s.hand.find((c) => c.uid === action.cardUid);
      if (!card) return state;
      const limit = state.manaConvertLimit;
      const next = updateSide({ ...state, manaConvertLimit: limit === null ? null : limit - 1 }, action.side, {
        hand: s.hand.filter((c) => c.uid !== action.cardUid),
        manaPile: [...s.manaPile, card.cardId],
      });
      return addLog(
        addFx(next, 'manaConvert', action.side),
        t('battle.log.convert', { side: sideLabel(action.side), card: nameOf(card.cardId), n: manaOf(next.sides[action.side]) }),
      );
    }
    case 'endTurn': {
      if (state.phase !== 'mana' || state.active !== action.side) return state;
      return startTurn({ ...state, turn: state.turn + 1 }, otherSide(action.side));
    }
  }
}

function useCard(
  state: BattleState,
  side: Side,
  cardUid: string,
  userUid: string | undefined,
  targetUid: string | undefined,
  choice?: string,
): BattleState {
  if (state.phase !== 'main') return state;
  if (!cardUsability(state, side, cardUid).usable) return state;
  const hand = findHandCard(state, side, cardUid);
  if (!hand) return state;
  const card = getPlayCard(hand.cardId);
  if (card.kind === 'support') return useSupport(state, side, cardUid, card, targetUid, choice);
  const skill = card;
  const users = availableUsers(state, side, skill);
  // 使うモンスターの指定がなければ、選んだ相手に攻撃できるモンスター（ちょうはつで限られていないもの）を選ぶ
  // みずあび（自分を回復）は、指定がなければライフの一番減っているモンスターが使う（同じモンスターが2体以上いるとき）
  const selfHealer = skill.effect.type === 'healSelf' ? [...users].sort((a, b) => a.life - a.maxLife - (b.life - b.maxLife))[0] : undefined;
  // かぜのり（消費マナ−1）が効いているモンスターを先に
  const byCost = [...users].sort((a, b) => skillCost(state, skill, a) - skillCost(state, skill, b));
  const user = userUid
    ? users.find((m) => m.uid === userUid)
    : (selfHealer ?? (targetUid ? byCost.find((u) => targetsFor(state, side, skill, u).some((m) => m.uid === targetUid)) : undefined) ?? byCost[0]);
  if (!user) return state;
  const cost = skillCost(state, skill, user);
  if (manaOf(state.sides[side]) < cost) return state;

  const targets = targetsFor(state, side, skill, user);
  let target: BattleMonster | undefined;
  // 相手全体への攻撃（地ひびき）は相手を選ばない。攻撃できる相手の左から順に守りを聞く
  const allTargets = skill.effect.type === 'attack' && !!skill.effect.allTargets;
  if (allTargets) {
    target = targets[0];
    if (!target) return state;
  } else if (targetsEnemy(skill) || skill.effect.type === 'heal' || skill.effect.type === 'healAlly' || skill.effect.type === 'tailwind') {
    target = targetUid ? targets.find((m) => m.uid === targetUid) : undefined;
    if (!target) return state;
  }

  let next = removeFromHand(state, side, cardUid);
  next = payMana(next, side, cost);
  // Wひっかき：その手番の最初の技なら、もう1回続けて使える印を付ける。2回目を使ったら印を消す（3回目は使えない）
  const chained = user.acted;
  const chain = !chained && skill.effect.type === 'attack' && skill.effect.chain ? { turn: state.turn, cardId: skill.id } : null;
  next = updateMonster(next, user.uid, { acted: true, chain });
  next = addLog(next, t('battle.log.skill', { name: nameOf(user.cardId), skill: cardName(skill) }));
  if (chained) next = addLog(next, t('battle.log.chain', { name: nameOf(user.cardId), skill: cardName(skill) }));
  if (cost < skill.cost) next = addLog(next, t('battle.log.windRideCost', { name: nameOf(user.cardId), n: cost }));

  switch (skill.effect.type) {
    case 'attack': {
      if (!target || !skill.stat) return state;
      const power = attackPower(state, skill, user);
      const energized = energyOf(state, user, skill);
      const undodgeable = undodgeableNow(skill, user) && !skill.effect.undodgeable;
      // 吠える（次の技のダメージ−）は、その種類の技を使ったら消える
      if (weakenOf(state, user, skill) > 0) next = updateMonster(next, user.uid, { weaken: null });
      // ほっぺにためる・おいかぜは、攻撃技を使ったら消える（当たっても・守られても・回避されても）。おいかぜは効く手番に使ったときだけ消える
      if (user.charge) next = updateMonster(next, user.uid, { charge: null });
      if (tailwindOf(state, user) > 0) next = updateMonster(next, user.uid, { tailwind: null });
      // 声援：攻撃技を1回使ったら消える
      if (cheerOf(state, user) > 0) next = updateMonster(next, user.uid, { cheer: null });
      // エネルギーをためる：効く手番の最初のかしこさ技で消える（ちから技では消えない）
      if (energized) next = addLog(updateMonster(next, user.uid, { energy: null }), t('battle.log.energyDouble', { name: nameOf(user.cardId) }));
      if (undodgeable) next = addLog(next, t('battle.log.chargedUndodgeable', { name: nameOf(user.cardId) }));
      if (allTargets) next = addLog(next, t('battle.log.allTargets', { name: nameOf(user.cardId) }));
      // 防御も回避もできない攻撃は、守備を待たずにダメージ
      if (skill.effect.unblockable && skill.effect.undodgeable) {
        // しめったはだ（受けるダメージ−）は守備のカードではないので、防御できない攻撃にも効く【要仕様確定】
        const dealt = Math.max(0, power - shieldOf(state, target, skill.stat.type));
        const lost = Math.min(dealt, target.life);
        const hit = clearPin(applyDamage(dealt > 0 ? addFx(next, hitKind(skill.id), side) : next, target.uid, dealt), target.uid);
        return attackRiders(drainHeal(dealt > 0 ? selfDamageOnHit(hit, skill.id, user.uid) : hit, skill.id, user.uid, lost), skill.id, side, target.uid);
      }
      return {
        ...next,
        phase: 'defense',
        pending: {
          attacker: side,
          userUid: user.uid,
          targetUid: target.uid,
          cardId: skill.id,
          stat: skill.stat.type,
          power,
          responses: [],
          ...(undodgeable ? { undodgeable: true } : {}),
          ...(isPinned(state, target) ? { pinned: true } : {}),
          ...(allTargets ? { queue: targets.slice(1).map((m) => m.uid) } : {}),
          ...(energized ? { energized: true } : {}),
        },
      };
    }
    case 'heal':
      return target ? healMonster(next, target, skillValue(skill)) : state;
    case 'healSelf': {
      // みずあび：使ったモンスター自身を回復（最大ライフまで）
      const self = findMonster(next, user.uid)?.monster;
      return self ? healMonster(next, self, skill.effect.amount) : state;
    }
    case 'healAlly': {
      // いやしのみつ：選んだ味方1体（使ったモンスターも選べる）を回復（最大ライフまで）。使ったモンスターを選んだときは、払ったあとの今の状態で
      const ally = target ? findMonster(next, target.uid)?.monster : undefined;
      return ally ? healMonster(next, ally, skill.effect.amount) : state;
    }
    case 'shield': {
      // しめったはだ：使った手番（turn）を含めて turns 手番のあいだ。重ねがけはせず、もう一度使ったら期限だけ新しく
      const e = skill.effect;
      next = updateMonster(next, user.uid, { shield: { against: e.against, reduce: e.reduce, untilTurn: state.turn + e.turns - 1 } });
      const stat = e.against === 'all' ? t('card.stat.all') : statLabel(e.against);
      return addLog(next, t('battle.log.shield', { name: nameOf(user.cardId), stat, n: e.reduce }));
    }
    case 'mana':
      // みちしお（セレフィーン）：amount 枚。使えるのは山札が足りるときだけ（skillUsability）
      return deckToMana(next, side, skill.effect.amount ?? skillValue(skill));
    case 'draw':
      return drawByEffect(next, side, skillValue(skill));
    case 'weaken': {
      // 【要仕様確定】重ねがけはしない（すでにかかっていても同じ量のまま）
      if (!target) return state;
      const e = skill.effect;
      if (e.duration === 'nextTurn') {
        // ダストキック：相手の次の手番（turn + 1）の間だけ。手番が過ぎたら何もしなくても効かない
        next = updateMonster(next, target.uid, { weakenTurn: { stat: e.stat, amount: e.amount, turn: state.turn + 1 } });
        return addLog(next, t('battle.log.weakenTurn', { name: nameOf(target.cardId), stat: statLabel(e.stat), n: e.amount }));
      }
      if (e.duration === 'nextUseByNextTurn') {
        // 熱風の威嚇：次にその種類の技を使ったら消える。使わなくても、相手の次の手番（turn + 1）が過ぎたら効かない
        next = updateMonster(next, target.uid, { weaken: { stat: e.stat, amount: e.amount, untilTurn: state.turn + 1 } });
        return addLog(next, t('battle.log.weakenTurn', { name: nameOf(target.cardId), stat: statLabel(e.stat), n: e.amount }));
      }
      next = updateMonster(next, target.uid, { weaken: { stat: e.stat, amount: e.amount } });
      return addLog(next, t('battle.log.weaken', { name: nameOf(target.cardId), stat: statLabel(e.stat), n: e.amount }));
    }
    case 'seal': {
      // 相手の次の手番（turn + 1）の間、攻撃の技を使えない
      if (!target) return state;
      next = updateMonster(next, target.uid, { sealedTurn: state.turn + 1 });
      return addLog(next, t('battle.log.seal', { name: nameOf(target.cardId) }));
    }
    case 'taunt': {
      // ちょうはつ：相手の次の手番（turn + 1）の間、使ったモンスターと同じ種類にしか攻撃できない
      if (!target) return state;
      next = updateMonster(next, target.uid, { taunt: { monsterId: user.cardId, turn: state.turn + 1 } });
      return addLog(next, t('battle.log.taunt', { name: nameOf(target.cardId), only: nameOf(user.cardId) }));
    }
    case 'hide': {
      // すなをほる：相手の次の手番（turn + 1）の間、使ったモンスターは攻撃の技の対象にならない
      next = updateMonster(next, user.uid, { hiddenTurn: state.turn + 1 });
      return addLog(next, t('battle.log.hide', { name: nameOf(user.cardId) }));
    }
    case 'charge': {
      // ほっぺにためる：次の攻撃技のダメージ＋amount。重ねない（もう一度使っても amount のまま）
      next = updateMonster(next, user.uid, { charge: skill.effect.amount });
      return addLog(next, t('battle.log.charge', { name: nameOf(user.cardId), n: skill.effect.amount }));
    }
    case 'tailwind': {
      // おいかぜ：選んだ味方の、次の自分の手番（turn + 2）の攻撃技のダメージ＋amount（2026-10-29 カードの文のとおり。かけた同じ手番には効かない）。
      // 重ねない（もう一度かけたら、効く手番だけ新しく）
      if (!target) return state;
      next = updateMonster(next, target.uid, { tailwind: { amount: skill.effect.amount, turn: state.turn + 2 } });
      return addLog(next, t('battle.log.tailwind', { name: nameOf(target.cardId), n: skill.effect.amount }));
    }
    case 'pin': {
      // じならし：選んだ相手は、この手番に受ける次の攻撃1回を回避できない。1ターンに1回（turnUsage で数える）
      if (!target) return state;
      next = updateMonster(next, target.uid, { pinTurn: state.turn });
      const usage = next.sides[side].turnUsage;
      next = updateSide(next, side, { turnUsage: { ...usage, [PIN_USAGE]: (usage[PIN_USAGE] ?? 0) + 1 } });
      return addLog(next, t('battle.log.pin', { name: nameOf(target.cardId) }));
    }
    case 'energy': {
      // エネルギーをためる：次の自分の手番（turn + 2）に最初に使うかしこさ技1回だけ2倍。重ねない（もう一度使ったら効く手番だけ新しく）
      next = updateMonster(next, user.uid, { energy: { turn: state.turn + 2 } });
      return addLog(next, t('battle.log.energy', { name: nameOf(user.cardId) }));
    }
    case 'windRide': {
      // かぜのり：次の自分の手番（turn + 2）の間、使ったモンスターの攻撃技の消費マナ−discount。重ねない（もう一度使ったら効く手番だけ新しく）
      next = updateMonster(next, user.uid, { windRide: { discount: skill.effect.discount, turn: state.turn + 2 } });
      return addLog(next, t('battle.log.windRide', { name: nameOf(user.cardId), n: skill.effect.discount }));
    }
    case 'handToDeck':
      return handToDeck(next, otherSide(side));
    case 'discardRandom':
      return discardRandom(next, otherSide(side));
    case 'redrawHand':
      return redrawHand(next, side);
    case 'revealHand':
      return revealHand(next, side);
    case 'defense':
    case 'evade':
    case 'cover':
      return state;
  }
}

/**
 * 考える（正式：ノビトン 2026-10-25）：使ったカードを除いた自分の手札をすべて山札へ戻してシャッフルし、戻した枚数だけ引く。
 * 戻す手札がないときは使えない（cardUsability）
 */
function redrawHand(state: BattleState, side: Side): BattleState {
  const s = state.sides[side];
  const n = s.hand.length;
  if (n === 0) return state;
  const mixed = shuffle([...s.deck, ...s.hand.map((c) => c.cardId)], state.seed);
  const emptied = updateSide({ ...state, seed: mixed.seed }, side, { hand: [], deck: mixed.items });
  return drawUpToMax(emptied, side, n, (drawn) => t('battle.log.redrawHand', { side: sideLabel(side), n: drawn }));
}

/**
 * 不思議な嗅覚（正式：ノビトン 2026-10-25）：相手の手札をすべて確認する。手札は動かさず、画面に表を見せる（state.reveal）。
 * 相手の手札がないときは使えない（cardUsability）
 */
function revealHand(state: BattleState, side: Side): BattleState {
  const other = otherSide(side);
  const cardIds = state.sides[other].hand.map((c) => c.cardId);
  const next: BattleState = { ...state, reveal: { seq: (state.reveal?.seq ?? 0) + 1, viewer: side, cardIds } };
  return addLog(next, t('battle.log.revealHand', { side: sideLabel(side), other: sideLabel(other), n: cardIds.length }));
}

/** 相手（side の反対）のマナを n 減らす（0 より下にはならない）。減らしたカードは捨て札へ */
function drainMana(state: BattleState, side: Side, n: number): BattleState {
  const victim = otherSide(side);
  const before = manaOf(state.sides[victim]);
  const next = payMana(state, victim, n);
  const lost = before - manaOf(next.sides[victim]);
  return addLog(next, t('battle.log.manaDrain', { side: sideLabel(victim), n: lost }));
}

/**
 * 攻撃に付いた効果（正式：ノビトン 2026-10-25。くしゃみ・ダウナーミストの「相手マナ−」、まきつくの「対象は次ターン行動不可」）。
 * 【要仕様確定】回避されなければ発動する（防御でダメージが0になっても発動。回避されたら発動しない）。勝負がついたあとは何もしない
 */
function attackRiders(state: BattleState, skillId: string, attacker: Side, targetUid: string): BattleState {
  const e = attackCardOf(skillId).effect;
  if (e.type !== 'attack' || state.phase === 'ended') return state;
  let next = state;
  if (e.manaDrain) next = drainMana(next, attacker, e.manaDrain);
  if (e.stunTarget) {
    const target = findMonster(next, targetUid);
    if (target && target.monster.life > 0) {
      next = updateMonster(next, targetUid, { stunnedTurn: state.turn + 1, stunMark: e.stunMark ?? null });
      next = addLog(next, t('battle.log.stun', { name: nameOf(target.monster.cardId) }));
    }
  }
  return next;
}

/**
 * 吠える（正式：ソラモ14技 2026-10-25）「相手の手札からランダムに1枚を捨てさせる」：side の手札からランダムに1枚を、その捨て札へ。補充はしない。
 * 手札が0枚のときは使えない（cardUsability。いたずらと同じ）
 */
function discardRandom(state: BattleState, side: Side): BattleState {
  const s = state.sides[side];
  if (s.hand.length === 0) return state;
  const pick = nextInt(state.seed, s.hand.length);
  const card = s.hand[pick.value] as HandCard;
  const next = updateSide({ ...state, seed: pick.seed }, side, { hand: s.hand.filter((c) => c.uid !== card.uid), discard: [...s.discard, card.cardId] });
  return addLog(next, t('battle.log.discardRandom', { player: s.name, card: nameOf(card.cardId) }));
}

/**
 * いたずら（正式：ラズック 2026-10-24）：side の手札からランダムに1枚を、その山札へ戻してシャッフルする。補充はしない。
 * 手札が0枚のときは使えない（cardUsability。2026-10-24 ユーザー指示）
 */
function handToDeck(state: BattleState, side: Side): BattleState {
  const s = state.sides[side];
  if (s.hand.length === 0) return state;
  const pick = nextInt(state.seed, s.hand.length);
  const card = s.hand[pick.value] as HandCard;
  const mixed = shuffle([...s.deck, card.cardId], pick.seed);
  const next = updateSide({ ...state, seed: mixed.seed }, side, { hand: s.hand.filter((c) => c.uid !== card.uid), deck: mixed.items });
  return addLog(next, t('battle.log.handToDeck', { player: s.name }));
}

function healMonster(state: BattleState, target: BattleMonster, value: number): BattleState {
  const healed = Math.min(target.maxLife, target.life + value);
  const next = updateMonster(state, target.uid, { life: healed });
  return addLog(next, t('battle.log.heal', { name: nameOf(target.cardId), n: healed - target.life }));
}

/** 山札の上から数枚をそのままマナにする（マナは必ずカード1枚＝1マナ）。決められた枚数を動かせなければ負け */
function deckToMana(state: BattleState, side: Side, count: number): BattleState {
  const s = state.sides[side];
  if (s.deck.length < count) return loseByDeckOut(state, side);
  const moved = s.deck.slice(0, count);
  const next = updateSide(state, side, { deck: s.deck.slice(moved.length), manaPile: [...s.manaPile, ...moved] });
  return addLog(moved.length > 0 ? addFx(next, 'manaGain', side) : next, t('battle.log.deckToMana', { n: moved.length }));
}

/**
 * 引く効果で count 枚を山札から取る。手札の上限（BATTLE_RULES.maxHand）までは手札へ、超える分は引かずに山札の上からそのままマナへ
 * （2026-10-28 ユーザー決定。捨てる画面は作らない）。山札が count 枚あることは呼ぶ側で確かめる。
 * 引いた記録（drawLog。1枚も引けなかったときは出さない）のあと、マナにした分があれば「手札がいっぱいなので…」の記録を足す
 */
function drawUpToMax(state: BattleState, side: Side, count: number, drawLog: (drawn: number) => string): BattleState {
  const room = Math.max(0, BATTLE_RULES.maxHand - state.sides[side].hand.length);
  const drawn = drawCards(state.sides[side], Math.min(count, room), state.nextUid);
  let next = updateSide({ ...state, nextUid: drawn.nextUid }, side, drawn.side);
  if (drawn.drawn > 0) next = addLog(next, drawLog(drawn.drawn));
  const toMana = Math.min(count - drawn.drawn, next.sides[side].deck.length);
  if (toMana > 0) {
    const s = next.sides[side];
    next = updateSide(next, side, { deck: s.deck.slice(toMana), manaPile: [...s.manaPile, ...s.deck.slice(0, toMana)] });
    next = addLog(addFx(next, 'manaGain', side), t('battle.log.handFullMana', { max: BATTLE_RULES.maxHand, n: toMana }));
  }
  return next;
}

/** 効果のドロー。指示された枚数を引けなければ負け（手札の上限を超える分はマナになるが、山札から取る枚数は同じ） */
function drawByEffect(state: BattleState, side: Side, count: number): BattleState {
  if (state.sides[side].deck.length < count) return loseByDeckOut(state, side);
  return drawUpToMax(state, side, count, (n) => t('battle.log.draw', { n }));
}

/**
 * サポートを使う。モンスターの行動は使わない。回数制限のあるものは使用回数を数える。
 * 全体カードは場に残り、すでに場にあったカードは持ち主の捨て札へ。
 */
function useSupport(state: BattleState, side: Side, cardUid: string, card: SupportCard, targetUid: string | undefined, choice?: string): BattleState {
  let target: BattleMonster | undefined;
  const type = card.effect.type;
  if (type === 'heal' || type === 'stone' || type === 'cheer') {
    target = targetUid ? targetsFor(state, side, card).find((m) => m.uid === targetUid) : undefined;
    if (!target) return state;
  }
  // 思い出の箱：捨て札の技カード（choice＝カードの ID）。風まかせ：このカード以外の手札（choice＝uid）
  if (type === 'recall' && (!choice || !recallChoices(state, side).includes(choice))) return state;
  if (type === 'swap' && (!choice || choice === cardUid || !findHandCard(state, side, choice))) return state;
  const s = state.sides[side];
  let next: BattleState;
  if (card.duration === 'field') {
    // 場に置く（捨て札には行かない）
    next = updateSide(state, side, { hand: s.hand.filter((c) => c.uid !== cardUid) });
  } else {
    next = removeFromHand(state, side, cardUid);
  }
  next = payMana(next, side, card.cost);
  if (card.limitGroup) {
    const usage = next.sides[side].turnUsage;
    next = updateSide(next, side, { turnUsage: { ...usage, [card.limitGroup]: (usage[card.limitGroup] ?? 0) + 1 } });
  }
  next = addLog(next, t('battle.log.support', { side: sideLabel(side), card: cardName(card) }));
  const e = card.effect;
  switch (e.type) {
    case 'heal':
      return target ? healMonster(next, target, e.value) : state;
    case 'draw':
      return drawByEffect(next, side, e.value);
    case 'mana':
      return deckToMana(next, side, e.value);
    case 'stone': {
      // 投石：ちから技（マナ1・ダメージ1）として、相手の守り（防御・回避）を待つ。場の増減・しめったはだ・防御の軽減は今の決まりどおり
      if (!target) return state;
      const power = Math.max(0, e.value + fieldModifier(state, 'force'));
      return {
        ...next,
        phase: 'defense',
        pending: {
          attacker: side,
          userUid: '',
          targetUid: target.uid,
          cardId: card.id,
          stat: 'force',
          power,
          responses: [],
          ...(isPinned(state, target) ? { pinned: true } : {}),
        },
      };
    }
    case 'recall': {
      const s2 = next.sides[side];
      const at = s2.discard.lastIndexOf(choice as string);
      if (at < 0) return state;
      const discard = [...s2.discard.slice(0, at), ...s2.discard.slice(at + 1)];
      next = updateSide({ ...next, nextUid: next.nextUid + 1 }, side, { discard, hand: [...s2.hand, { uid: `c${next.nextUid}`, cardId: choice as string }] });
      return addLog(next, t('battle.log.recall', { side: sideLabel(side), card: nameOf(choice as string) }));
    }
    case 'swap': {
      const s2 = next.sides[side];
      const back = s2.hand.find((c) => c.uid === choice);
      if (!back) return state;
      const mixed = shuffle([...s2.deck, back.cardId], next.seed);
      next = updateSide({ ...next, seed: mixed.seed }, side, { hand: s2.hand.filter((c) => c.uid !== back.uid), deck: mixed.items });
      next = addLog(next, t('battle.log.swap', { side: sideLabel(side) }));
      return drawByEffect(next, side, 1);
    }
    case 'manaDrain':
      return drainMana(next, side, e.value);
    case 'cheer':
      if (!target) return state;
      next = updateMonster(next, target.uid, { cheer: { amount: e.value, turn: state.turn } });
      return addLog(next, t('battle.log.cheer', { name: nameOf(target.cardId), n: e.value }));
    case 'guardDiscount':
    case 'field': {
      const old = next.field;
      if (old) {
        const owner = next.sides[old.owner];
        next = updateSide(next, old.owner, { discard: [...owner.discard, old.cardId] });
        next = addLog(next, t('battle.log.fieldDiscard', { card: nameOf(old.cardId) }));
      }
      return addLog({ ...next, field: { cardId: card.id, owner: side } }, t('battle.log.fieldEnter', { card: cardName(card) }));
    }
  }
}

/**
 * 守備：防御・回避カードを1枚使う（条件を満たす限り1回の攻撃に何枚でも）。
 * cardUid が null なら守備を終えて、ダメージを計算する。
 */
function defend(state: BattleState, side: Side, cardUid: string | null): BattleState {
  const pending = state.pending;
  if (state.phase !== 'defense' || !pending || pending.attacker === side) return state;
  if (cardUid === null) {
    return resolvePending(addLog(state, t(pending.responses.length === 0 ? 'battle.log.noDefense' : 'battle.log.defenseDone', { side: sideLabel(side) })));
  }
  if (!cardUsability(state, side, cardUid).usable) return state;
  const hand = findHandCard(state, side, cardUid);
  if (!hand) return state;
  const skill = getSkill(hand.cardId);
  if (skill.effect.type === 'cover') return cover(state, side, cardUid, skill, pending);
  let next = removeFromHand(state, side, cardUid);
  next = payMana(next, side, guardCost(next, skill));
  next = { ...next, pending: { ...pending, responses: [...pending.responses, skill.id] } };
  const params = { side: sideLabel(side), skill: cardName(skill), v: guardReduction(skill) };
  const logKey = skill.effect.type === 'evade' ? 'battle.log.evade' : skill.effect.type === 'defense' && skill.effect.nullify ? 'battle.log.nullify' : 'battle.log.guard';
  return addLog(next, t(logKey, params));
}

/**
 * かばう（試遊中：ジオル 2026-10-29）：攻撃の狙いをジオルに変える。そのあとジオルは自分の防御・回避もふつうに使える（マナがあれば）。
 * 攻撃に付いた効果（まきつく など）も、代わりに受けたジオルが受ける（resolvePending は狙いの uid に効かせる）
 */
function cover(state: BattleState, side: Side, cardUid: string, skill: SkillCard, pending: PendingAttack): BattleState {
  const user = coverUser(state, side, skill);
  const ally = findMonster(state, pending.targetUid)?.monster;
  if (!user || !ally) return state;
  let next = removeFromHand(state, side, cardUid);
  next = payMana(next, side, guardCost(next, skill));
  const { pinned: _p, ...base } = pending;
  next = { ...next, pending: { ...base, targetUid: user.uid, coveredFrom: ally.uid, responses: [], ...(isPinned(next, user) ? { pinned: true } : {}) } };
  return addLog(next, t('battle.log.cover', { name: nameOf(user.cardId), ally: nameOf(ally.cardId) }));
}

/** 行動を待っている側（防御待ちなら防御側） */
export function actingSide(state: BattleState): Side | null {
  if (state.phase === 'ended') return null;
  if (state.phase === 'defense' && state.pending) return otherSide(state.pending.attacker);
  return state.active;
}
