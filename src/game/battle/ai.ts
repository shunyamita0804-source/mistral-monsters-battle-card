import { getPlayCard, getSupport, skillsOf } from '../../data/cards.ts';
import { guardReduction, skillValue, type PlayCard, type SkillCard, type StatType, type SupportCard } from '../cards/cardTypes.ts';
import {
  aliveMonsters,
  attackPower,
  availableUsers,
  canConvertToMana,
  cardUsability,
  manaOf,
  otherSide,
  incomingDamage,
  shieldOf,
  targetsFor,
  type BattleAction,
  type BattleMonster,
  type BattleState,
  type HandCard,
  type Side,
} from './engine.ts';

/**
 * 対戦相手（およびQA用のオート操作）の思考。
 * 単純な優先順位で1手ずつ返す（強さの調整は仮）。返した行動は必ず applyAction で有効になるものを選ぶ。
 */
interface Option {
  readonly card: HandCard;
  readonly def: PlayCard;
}

interface SkillOption extends Option {
  readonly def: SkillCard;
}

const isSkillOption = (o: Option): o is SkillOption => o.def.kind === 'skill';

function usableOptions(state: BattleState, side: Side): Option[] {
  return state.sides[side].hand
    .filter((c) => cardUsability(state, side, c.uid).usable)
    .map((card) => ({ card, def: getPlayCard(card.cardId) }));
}

/** その能力の攻撃技を持つ、生きているモンスターの数（'all' はどれかの攻撃技を持つ数） */
function attackersWith(state: BattleState, side: Side, stat: StatType | 'all'): number {
  return aliveMonsters(state.sides[side]).filter((m) =>
    skillsOf(m.cardId).some((k) => k.effect.type === 'attack' && k.stat !== null && (stat === 'all' || k.stat.type === stat)),
  ).length;
}

/** 全体カードが自分にとってどれだけ得か（自分の攻撃が強くなる・相手の攻撃が弱くなるほど大きい） */
function fieldScore(state: BattleState, side: Side, card: SupportCard): number {
  const e = card.effect;
  if (e.type !== 'field') return 0;
  return e.modifier * (attackersWith(state, side, e.stat) - attackersWith(state, otherSide(side), e.stat));
}

/** 山札を動かす効果の枚数（ドロー・山札からマナ） */
function deckAmount(card: PlayCard): number {
  if (card.kind === 'skill') return skillValue(card);
  const e = card.effect;
  return e.type === 'draw' || e.type === 'mana' ? e.value : 0;
}

export function chooseAction(state: BattleState, side: Side): BattleAction | null {
  if (state.phase === 'ended') return null;

  if (state.phase === 'defense') return chooseDefense(state, side);

  if (state.active !== side) return null;
  if (state.phase === 'mana') return chooseManaAction(state, side);
  const options = usableOptions(state, side);
  const mine = state.sides[side];
  const enemies = aliveMonsters(state.sides[otherSide(side)]);

  // 1. ライフが半分以下の味方を回復（技・サポートどちらでも）
  const wounded = aliveMonsters(mine)
    .filter((m) => m.life <= m.maxLife / 2)
    .sort((a, b) => a.life / a.maxLife - b.life / b.maxLife)[0];
  const heal = options.find((o) => o.def.effect.type === 'heal');
  if (wounded && heal) {
    return { type: 'useCard', side, cardUid: heal.card.uid, targetUid: wounded.uid };
  }
  // みずあび（自分を回復）：使えるモンスターのライフが半分以下なら使う（仮の思考）
  const selfHeal = options.filter(isSkillOption).find((o) => o.def.effect.type === 'healSelf');
  const selfHealer = selfHeal ? availableUsers(state, side, selfHeal.def).find((m) => m.life <= m.maxLife / 2) : undefined;
  if (selfHeal && selfHealer) return { type: 'useCard', side, cardUid: selfHeal.card.uid, userUid: selfHealer.uid };

  // 2. 全体カード：いまの場より自分に得になるときだけ出す（入れ替え合いでマナを無駄にしない）
  const current = state.field ? fieldScore(state, side, getSupport(state.field.cardId)) : 0;
  const field = options
    .filter((o): o is Option & { def: SupportCard } => o.def.kind === 'support' && o.def.duration === 'field')
    .map((o) => ({ o, score: fieldScore(state, side, o.def) }))
    .sort((a, b) => b.score - a.score)[0];
  if (field && field.score > 0 && field.score > current) return { type: 'useCard', side, cardUid: field.o.card.uid };

  // 3. 攻撃：倒せる相手がいれば倒し、いなければ一番強い攻撃をライフの少ない相手へ
  const attacks = options.filter(isSkillOption).filter((o) => o.def.effect.type === 'attack');
  if (attacks.length > 0 && enemies.length > 0) {
    const power = (o: SkillOption): number => attackPower(state, o.def, availableUsers(state, side, o.def)[0]);
    const byPower = [...attacks].sort((a, b) => power(b) - power(a));
    // 攻撃できる相手（ちょうはつで限られていればそれだけ）
    const reachable = (o: SkillOption): BattleMonster[] => targetsFor(state, side, o.def);
    for (const option of byPower) {
      const kill = reachable(option).filter((e) => e.life <= power(option)).sort((a, b) => b.life - a.life)[0];
      if (kill) return attackAction(state, side, option, kill.uid);
    }
    const strongest = byPower[0];
    const weakest = strongest ? [...reachable(strongest)].sort((a, b) => a.life - b.life)[0] : undefined;
    if (weakest && strongest) return attackAction(state, side, strongest, weakest.uid);
  }

  // 4. 特殊（吠える・すなかけ・ダストキック・ちょうはつ）：一番ライフの多い相手に使う（仮の思考）
  const special = options.filter(isSkillOption).find((o) => ['weaken', 'seal', 'taunt'].includes(o.def.effect.type));
  const strongestEnemy = [...enemies].sort((a, b) => b.life - a.life)[0];
  if (special && strongestEnemy) return attackAction(state, side, special, strongestEnemy.uid);
  // しめったはだ：まだかかっておらず、相手にその種類の攻撃技を持つモンスターがいるときに使う（仮の思考）
  const shield = options.filter(isSkillOption).find((o) => o.def.effect.type === 'shield');
  if (shield && shield.def.effect.type === 'shield') {
    const against = shield.def.effect.against;
    const user = availableUsers(state, side, shield.def)[0];
    const covered = user !== undefined && shieldOf(state, user, against === 'all' ? 'force' : against) > 0;
    if (user && !covered && attackersWith(state, otherSide(side), against) > 0) return { type: 'useCard', side, cardUid: shield.card.uid, userUid: user.uid };
  }
  // いたずら：相手の手札が2枚以上あるときに使う（仮の思考）
  const prank = options.filter(isSkillOption).find((o) => o.def.effect.type === 'handToDeck');
  if (prank && state.sides[otherSide(side)].hand.length >= 2) return { type: 'useCard', side, cardUid: prank.card.uid };
  // 考える：攻撃できる技がなく、ほかの手札が2枚以上あるときに引き直す（仮の思考）
  const redraw = options.filter(isSkillOption).find((o) => o.def.effect.type === 'redrawHand');
  if (redraw && attacks.length === 0 && mine.hand.length >= 3) return { type: 'useCard', side, cardUid: redraw.card.uid };
  // 不思議な嗅覚：相手の手札が3枚以上あり、マナに余裕があるときだけ（仮の思考。思考は手札を見なくても動く）
  const sniff = options.filter(isSkillOption).find((o) => o.def.effect.type === 'revealHand');
  if (sniff && state.sides[otherSide(side)].hand.length >= 3 && manaOf(mine) >= sniff.def.cost + 3) return { type: 'useCard', side, cardUid: sniff.card.uid };

  // 5. マナ・ドロー
  // 山札が足りないと負けになるので、山札を動かす効果は山札に余裕があるときだけ。
  // ドローは手札が少ないとき、山札からマナはマナが少ないときだけ使う
  const support = options.find((o) => {
    if (mine.deck.length <= deckAmount(o.def) + 15) return false;
    if (o.def.effect.type === 'draw') return mine.hand.length <= 3;
    if (o.def.effect.type === 'mana') return manaOf(mine) <= 2;
    return false;
  });
  if (support) return { type: 'useCard', side, cardUid: support.card.uid };

  // 6. 使えるカードがなければ攻撃を終えてマナ化へ
  return { type: 'endAttack', side };
}

/** 防御・回避カードか */
const isGuard = (c: HandCard): boolean => ['defense', 'evade'].includes(getPlayCard(c.cardId).effect.type);

/** 守備カードの強さ（並べ替え用） */
const guardValue = (c: HandCard): number => {
  const card = getPlayCard(c.cardId);
  if (card.kind !== 'skill') return 0;
  return card.effect.type === 'defense' ? guardReduction(card) : skillValue(card);
};

/**
 * マナ化（仮の思考）：残す手札を最大2枚に絞り、残りをすべてマナにする。
 * - 防御・回避カード1枚：いまのマナで払える中で一番強いもの（相手の攻撃に備える）
 * - 技・サポート1枚：マナ化し終えたあとのマナで払える中で一番重いもの（次のターンに使う）
 * マナ化するたびにマナ+1・手札-1 なので「マナ化し終えたあとのマナ」は途中で変わらず、残す札が安定する。
 */
function chooseManaAction(state: BattleState, side: Side): BattleAction {
  const mine = state.sides[side];
  const mana = manaOf(mine);
  const cost = (c: HandCard): number => getPlayCard(c.cardId).cost;
  const keepDefense = mine.hand.filter((c) => isGuard(c) && cost(c) <= mana).sort((a, b) => guardValue(b) - guardValue(a))[0];
  const others = mine.hand.filter((c) => c !== keepDefense && !isGuard(c));
  const manaAfter = mana + mine.hand.length - (keepDefense ? 1 : 0) - 1;
  const keepSkill = [...others].sort((a, b) => cost(b) - cost(a)).find((c) => cost(c) <= manaAfter);
  const convert = mine.hand.find((c) => c !== keepDefense && c !== keepSkill);
  if (convert && canConvertToMana(state, side)) return { type: 'convertToMana', side, cardUid: convert.uid };
  return { type: 'endTurn', side };
}

/**
 * 守備（仮の思考）：1枚ずつ選び、ダメージが0になるか使えるカードがなくなったら守備を終える。
 * 回避は倒されそうなときか大きなダメージのときに使い、そうでなければ防御で減らす。
 */
function chooseDefense(state: BattleState, side: Side): BattleAction | null {
  const pending = state.pending;
  if (!pending || pending.attacker === side) return null;
  const end: BattleAction = { type: 'defend', side, cardUid: null };
  const damage = incomingDamage(state, pending);
  if (damage === 0) return end;
  const target = state.sides[side].monsters.find((m) => m.uid === pending.targetUid);
  const options = usableOptions(state, side).filter(isSkillOption);
  const evade = options.filter((o) => o.def.effect.type === 'evade').sort((a, b) => a.def.cost - b.def.cost)[0];
  if (evade && (damage >= 3 || (target !== undefined && damage >= target.life))) {
    return { type: 'defend', side, cardUid: evade.card.uid };
  }
  const defense = options.filter((o) => o.def.effect.type === 'defense').sort((a, b) => guardReduction(b.def) - guardReduction(a.def))[0];
  if (defense) return { type: 'defend', side, cardUid: defense.card.uid };
  return end;
}

function attackAction(state: BattleState, side: Side, option: SkillOption, targetUid: string): BattleAction {
  const targets = targetsFor(state, side, option.def);
  const target = targets.find((t) => t.uid === targetUid) ?? targets[0];
  // その相手に攻撃できるモンスター（ちょうはつで限られていないもの）を使う
  const users = availableUsers(state, side, option.def);
  const user = (target ? users.find((u) => targetsFor(state, side, option.def, u).some((m) => m.uid === target.uid)) : undefined) ?? users[0];
  return {
    type: 'useCard',
    side,
    cardUid: option.card.uid,
    ...(user ? { userUid: user.uid } : {}),
    ...(target ? { targetUid: target.uid } : {}),
  };
}
