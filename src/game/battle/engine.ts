import { getMonster, getPlayCard, getSkill, getSupport } from '../../data/cards.ts';
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
  /**
   * 受ける against の技のダメージを reduce 減らす。untilTurn の手番が終わるまで（正式：ミュロルのしめったはだ 2026-10-25。
   * 使った手番を含む2手番＝相手の次の手番まで）。重ねがけはしない
   */
  readonly shield?: { readonly against: StatType | 'all'; readonly reduce: number; readonly untilTurn: number } | null;
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
    }
  | { readonly type: 'defend'; readonly side: Side; readonly cardUid: string | null }
  /** 攻撃を終えてマナ化へ進む */
  | { readonly type: 'endAttack'; readonly side: Side }
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

/** その技を使えるモンスター（適合・生存・未行動・まきつくで止められていない。攻撃の技は、すなかけで封じられていないこと） */
export function availableUsers(state: BattleState, side: Side, skill: SkillCard): BattleMonster[] {
  const attack = skill.effect.type === 'attack';
  return state.sides[side].monsters.filter(
    (m) => m.cardId === skill.monsterId && m.life > 0 && !m.acted && m.stunnedTurn !== state.turn && !(attack && m.sealedTurn === state.turn),
  );
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
  return YES;
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
    if (type !== 'defense' && type !== 'evade') return NO(t('battle.ng.defenseOnly'));
    // 守備に使えるのは、狙われたモンスターの防御・回避カードだけ
    const target = state.sides[side].monsters.find((m) => m.uid === pending.targetUid);
    if (!target || target.cardId !== skill.monsterId) return NO(t('battle.ng.notTarget'));
    const against = guardAgainst(skill);
    if (against !== 'all' && against !== pending.stat) return NO(t('battle.ng.wrongStat', { stat: statLabel(pending.stat) }));
    const attackCard = getSkill(pending.cardId);
    const attack = attackCard.effect;
    if (attack.type === 'attack' && type === 'defense' && attack.unblockable) return NO(t('battle.ng.unblockable'));
    // 「回避されない」攻撃は、回避の条件が合っていても回避できない（防御はできる）
    if (attack.type === 'attack' && type === 'evade' && attack.undodgeable) return NO(t('battle.ng.undodgeable'));
    // 「必要マナ2以上の〜を回避」「消費マナ3以上の〜ダメージ−4」「消費マナ2以下の〜を回避」：
    // 受ける攻撃カードに印字された必要マナで判定（いまのマナの残りではない）
    const minCost = guardMinCost(skill);
    if (minCost > 0 && attackCard.cost < minCost) return NO(t('battle.ng.evadeMinCost', { n: minCost }));
    const maxCost = guardMaxCost(skill);
    if (maxCost !== null && attackCard.cost > maxCost) return NO(t('battle.ng.maxCost', { n: maxCost }));
    if (manaOf(state.sides[side]) < skill.cost) return NO(t('battle.ng.noMana'));
    return YES;
  }

  if (state.active !== side) return NO(t('battle.ng.opponentTurn'));
  if (state.phase === 'mana') return NO(t('battle.ng.manaPhase'));
  if (skill.effect.type === 'defense' || skill.effect.type === 'evade') return NO(t('battle.ng.defenseOnAttack'));
  // いたずら・不思議な嗅覚：相手の手札がないときは使えない（いたずらは 2026-10-24 ユーザー指示。嗅覚も同じ扱い）
  if ((skill.effect.type === 'handToDeck' || skill.effect.type === 'discardRandom' || skill.effect.type === 'revealHand') && state.sides[otherSide(side)].hand.length === 0) {
    return NO(t('battle.ng.noOpponentHand'));
  }
  // 考える：このカードのほかに戻す手札がないときは使えない
  if (skill.effect.type === 'redrawHand' && state.sides[side].hand.length <= 1) return NO(t('battle.ng.noHandToReturn'));
  if (manaOf(state.sides[side]) < skill.cost) return NO(t('battle.ng.noMana'));
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
  return aliveMonsters(state.sides[otherSide(side)]).some((m) => m.cardId === taunt.monsterId) ? taunt.monsterId : null;
}

/**
 * 対象を選ぶ必要があるカードなら、選べる対象を返す。
 * 攻撃の技は、ちょうはつで相手が限られていればそれに従う。user を渡さなければ、使えるモンスターのだれかが攻撃できる相手すべて。
 * 【要仕様確定】ちょうはつが限るのは攻撃の技だけ（特殊の技・防御・回避・サポートは限らない）
 */
export function targetsFor(state: BattleState, side: Side, card: PlayCard, user?: BattleMonster): BattleMonster[] {
  if (card.kind === 'skill' && targetsEnemy(card)) {
    const enemies = aliveMonsters(state.sides[otherSide(side)]);
    if (card.effect.type !== 'attack') return enemies;
    const users = user ? [user] : availableUsers(state, side, card);
    return enemies.filter((e) =>
      users.some((u) => {
        const only = tauntRestriction(state, side, u);
        return only === null || e.cardId === only;
      }),
    );
  }
  if (card.effect.type === 'heal') return aliveMonsters(state.sides[side]);
  return [];
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

/** 攻撃の威力（場の増減と、使うモンスターへの「吠える」「ダストキック」を反映。0未満にはならない） */
export function attackPower(state: BattleState, skill: SkillCard, user?: BattleMonster): number {
  if (!skill.stat) return 0;
  return Math.max(0, skill.stat.value + fieldModifier(state, skill.stat.type) - weakenOf(state, user, skill) - weakenTurnOf(state, user, skill));
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
  let next = updateMonster(state, targetUid, { life });
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
    const attack = getSkill(pending.cardId).effect;
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
  let withFx = next;
  if (damage > 0) withFx = addFx(next, hitKind(pending.cardId), pending.attacker);
  else if (evaded) withFx = addFx(next, 'evade', target?.side ?? otherSide(pending.attacker));
  const after = applyDamage(withFx, pending.targetUid, damage);
  const recoiled = damage > 0 ? selfDamageOnHit(after, pending.cardId, pending.userUid) : after;
  return evaded ? recoiled : attackRiders(recoiled, pending.cardId, pending.attacker, pending.targetUid);
}

/**
 * 技が当たったときの反動（正式：すてみタックル「技が当たった場合、自分のライフ−1」）。
 * 【要仕様確定】「当たった」はダメージが1以上のときとした（回避・防御で0のときは反動なし）。勝負がついたあとは何もしない
 */
function selfDamageOnHit(state: BattleState, skillId: string, userUid: string): BattleState {
  const e = getSkill(skillId).effect;
  if (e.type !== 'attack' || !e.selfDamageOnHit || state.phase === 'ended') return state;
  const user = findMonster(state, userUid);
  if (!user || user.monster.life <= 0) return state;
  const next = addLog(addFx(state, 'recoil', user.side), t('battle.log.recoil', { name: nameOf(user.monster.cardId), n: e.selfDamageOnHit }));
  return applyDamage(next, userUid, e.selfDamageOnHit);
}

/** 命中の音の種類（強攻撃は仮に必要マナ STRONG_ATTACK_COST 以上の技） */
function hitKind(skillId: string): BattleFxKind {
  return getSkill(skillId).cost >= STRONG_ATTACK_COST ? 'hitStrong' : 'hitNormal';
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
      return useCard(state, action.side, action.cardUid, action.userUid, action.targetUid);
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
): BattleState {
  if (state.phase !== 'main') return state;
  if (!cardUsability(state, side, cardUid).usable) return state;
  const hand = findHandCard(state, side, cardUid);
  if (!hand) return state;
  const card = getPlayCard(hand.cardId);
  if (card.kind === 'support') return useSupport(state, side, cardUid, card, targetUid);
  const skill = card;
  const users = availableUsers(state, side, skill);
  // 使うモンスターの指定がなければ、選んだ相手に攻撃できるモンスター（ちょうはつで限られていないもの）を選ぶ
  // みずあび（自分を回復）は、指定がなければライフの一番減っているモンスターが使う（同じモンスターが2体以上いるとき）
  const selfHealer = skill.effect.type === 'healSelf' ? [...users].sort((a, b) => a.life - a.maxLife - (b.life - b.maxLife))[0] : undefined;
  const user = userUid
    ? users.find((m) => m.uid === userUid)
    : (selfHealer ?? (targetUid ? users.find((u) => targetsFor(state, side, skill, u).some((m) => m.uid === targetUid)) : undefined) ?? users[0]);
  if (!user) return state;

  const targets = targetsFor(state, side, skill, user);
  let target: BattleMonster | undefined;
  if (targetsEnemy(skill) || skill.effect.type === 'heal') {
    target = targetUid ? targets.find((m) => m.uid === targetUid) : undefined;
    if (!target) return state;
  }

  let next = removeFromHand(state, side, cardUid);
  next = payMana(next, side, skill.cost);
  next = updateMonster(next, user.uid, { acted: true });
  next = addLog(next, t('battle.log.skill', { name: nameOf(user.cardId), skill: cardName(skill) }));

  switch (skill.effect.type) {
    case 'attack': {
      if (!target || !skill.stat) return state;
      const power = attackPower(state, skill, user);
      // 吠える（次の技のダメージ−）は、その種類の技を使ったら消える
      if (weakenOf(state, user, skill) > 0) next = updateMonster(next, user.uid, { weaken: null });
      // 防御も回避もできない攻撃は、守備を待たずにダメージ
      if (skill.effect.unblockable && skill.effect.undodgeable) {
        // しめったはだ（受けるダメージ−）は守備のカードではないので、防御できない攻撃にも効く【要仕様確定】
        const dealt = Math.max(0, power - shieldOf(state, target, skill.stat.type));
        const hit = applyDamage(dealt > 0 ? addFx(next, hitKind(skill.id), side) : next, target.uid, dealt);
        return attackRiders(dealt > 0 ? selfDamageOnHit(hit, skill.id, user.uid) : hit, skill.id, side, target.uid);
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
    case 'shield': {
      // しめったはだ：使った手番（turn）を含めて turns 手番のあいだ。重ねがけはせず、もう一度使ったら期限だけ新しく
      const e = skill.effect;
      next = updateMonster(next, user.uid, { shield: { against: e.against, reduce: e.reduce, untilTurn: state.turn + e.turns - 1 } });
      const stat = e.against === 'all' ? t('card.stat.all') : statLabel(e.against);
      return addLog(next, t('battle.log.shield', { name: nameOf(user.cardId), stat, n: e.reduce }));
    }
    case 'mana':
      return deckToMana(next, side, skillValue(skill));
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
  const drawn = drawCards(emptied.sides[side], n, emptied.nextUid);
  const next = updateSide({ ...emptied, nextUid: drawn.nextUid }, side, drawn.side);
  return addLog(next, t('battle.log.redrawHand', { side: sideLabel(side), n }));
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
  const e = getSkill(skillId).effect;
  if (e.type !== 'attack' || state.phase === 'ended') return state;
  let next = state;
  if (e.manaDrain) next = drainMana(next, attacker, e.manaDrain);
  if (e.stunTarget) {
    const target = findMonster(next, targetUid);
    if (target && target.monster.life > 0) {
      next = updateMonster(next, targetUid, { stunnedTurn: state.turn + 1 });
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

/** 効果のドロー。指示された枚数を引けなければ負け */
function drawByEffect(state: BattleState, side: Side, count: number): BattleState {
  if (state.sides[side].deck.length < count) return loseByDeckOut(state, side);
  const drawn = drawCards(state.sides[side], count, state.nextUid);
  const next = updateSide({ ...state, nextUid: drawn.nextUid }, side, drawn.side);
  return addLog(next, t('battle.log.draw', { n: drawn.drawn }));
}

/**
 * サポートを使う。モンスターの行動は使わない。回数制限のあるものは使用回数を数える。
 * 全体カードは場に残り、すでに場にあったカードは持ち主の捨て札へ。
 */
function useSupport(state: BattleState, side: Side, cardUid: string, card: SupportCard, targetUid: string | undefined): BattleState {
  let target: BattleMonster | undefined;
  if (card.effect.type === 'heal') {
    target = targetUid ? targetsFor(state, side, card).find((m) => m.uid === targetUid) : undefined;
    if (!target) return state;
  }
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
    const text = t(pending.responses.length === 0 ? 'battle.log.noDefense' : 'battle.log.defenseDone', { side: sideLabel(side) });
    return resolvePending(addLog(state, text));
  }
  if (!cardUsability(state, side, cardUid).usable) return state;
  const hand = findHandCard(state, side, cardUid);
  if (!hand) return state;
  const skill = getSkill(hand.cardId);
  let next = removeFromHand(state, side, cardUid);
  next = payMana(next, side, skill.cost);
  next = { ...next, pending: { ...pending, responses: [...pending.responses, skill.id] } };
  const params = { side: sideLabel(side), skill: cardName(skill), v: guardReduction(skill) };
  return addLog(next, t(skill.effect.type === 'evade' ? 'battle.log.evade' : 'battle.log.guard', params));
}

/** 行動を待っている側（防御待ちなら防御側） */
export function actingSide(state: BattleState): Side | null {
  if (state.phase === 'ended') return null;
  if (state.phase === 'defense' && state.pending) return otherSide(state.pending.attacker);
  return state.active;
}
