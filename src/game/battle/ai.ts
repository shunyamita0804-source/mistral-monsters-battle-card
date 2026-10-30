import { getPlayCard, getSupport, skillsOf } from '../../data/cards.ts';
import { guardAgainst, guardReduction, skillValue, type PlayCard, type SkillCard, type StatType, type SupportCard } from '../cards/cardTypes.ts';
import {
  aliveMonsters,
  attackPower,
  availableUsers,
  canConvertToMana,
  chainReady,
  cardUsability,
  cheerTargets,
  coverUser,
  fieldModifier,
  guardCost,
  isPinned,
  recallChoices,
  manaOf,
  otherSide,
  incomingDamage,
  shieldOf,
  skillCost,
  attackableMonsters,
  tailwindTargets,
  targetsFor,
  undodgeableNow,
  windRideOf,
  type BattleAction,
  type BattleMonster,
  type BattleState,
  type HandCard,
  type Side,
} from './engine.ts';
import type { AiStyle, CpuSkill } from '../../data/tournaments.ts';

/**
 * 対戦相手（およびQA用のオート操作）の思考。
 * 単純な優先順位で1手ずつ返す（強さの調整は仮）。返した行動は必ず applyAction で有効になるものを選ぶ。
 *
 * 考え方の癖 style（2026-10-27 指示書「大会の新しい形」の常連。仮）：
 * - normal：今までどおり
 * - aggressive（ドルフ）：回復・全体カードより攻撃を先に。守りは倒されそうなときだけ。マナ化で守りのカードを残さない
 * - disrupt（レナード）：手番の最初に妨害（ちょうはつ・すなかけ など）を攻撃より先に使う
 * - guard（グレタ）：ダメージを受けるときはいつも守る。守りのカードを2枚まで残す。ドローで自分の山札を減らさない（相手の山札切れを待つ）
 * - flashy（ユリウス）：必要マナのいちばん多い攻撃（大技）を先に使う
 * - hunter（カミラ・アルヴィン）：相手のいちばん弱いモンスター（最大ライフの少ないモンスター）を先に狙う
 *
 * 腕前 skill（2026-10-30 指示書 Z。C 下手・B ふつう・A 上手。構えとは別。数字は CPU_SKILL にまとめた仮の値）：
 * - 倒せる相手がいるとき：C は 50%・B は 20% で見のがす。A は必ず倒し、倒せる技のうち倒しすぎない（ダメージがむだにならない）技を選ぶ
 * - 倒せないときの狙い：C・B はばらばら（対戦の seed から決まる）。A はいちばん危ない相手（技の最大ダメージ ÷ 残りライフ が大きい相手）
 * - 攻撃するか：C は攻撃できる手番の 15% で攻撃を見送る（記録に「〇〇は迷っている…」）
 * - 技の選び方：C は 30% で強くない技（使える技からばらばら）。A は倒せないとき、次の手番に大技を払えるようマナを残すことがある
 * - 守るか：C は守れるのに 40% で守らない（記録に「〇〇は守りそこねた！」）。B・A は 3ダメージ以上か倒されそうなとき回避（1〜2 には回避を使わない）・防御
 * - マナ化で残す守りのカード：C 0枚（さらに 30% の手番で、残したい攻撃より先に守りをマナにする）・B 1枚・A 2枚
 *   （A は相手の場のモンスターの技の種類に合う守りを優先し、守りの分のマナも残す）
 * - 「ライフの少ない相手から狙う」はやめた（ユーザー指示 2026-10-30 23:11）
 * - 構えは腕前より優先（aggressive は A でも守らない・守りを残さない。guard は守りを2枚残す）
 */

/** 腕前ごとのふるまい（2026-10-30 指示書 Z。数字は仮。ここでまとめて合わせる） */
export const CPU_SKILL: Readonly<
  Record<
    CpuSkill,
    {
      /** 倒せる相手を見のがす割合 */
      readonly missKill: number;
      /** 攻撃できる手番に攻撃を見送る割合 */
      readonly hesitate: number;
      /** 強くない技（使える技からばらばら）を選ぶ割合 */
      readonly weakSkill: number;
      /** 守れるのに守らない割合 */
      readonly misguard: number;
      /** マナ化で残す守りのカードの枚数 */
      readonly guardKeep: number;
      /** マナ化で、残したい攻撃より先に守りをマナにする手番の割合 */
      readonly guardFirst: number;
    }
  >
> = {
  C: { missKill: 0.5, hesitate: 0.15, weakSkill: 0.3, misguard: 0.4, guardKeep: 0, guardFirst: 0.3 },
  B: { missKill: 0.2, hesitate: 0, weakSkill: 0, misguard: 0, guardKeep: 1, guardFirst: 0 },
  A: { missKill: 0, hesitate: 0, weakSkill: 0, misguard: 0, guardKeep: 2, guardFirst: 0 },
};

/**
 * CPU のばらばら（決まった seed から）：対戦の seed・手番・側・用途（と、perAction なら記録の行数）から 0 以上 1 未満の数を作る。
 * 同じ場面では同じ値になる（対戦をやり直しても同じ）。perAction が false なら、その手番の中では同じ値
 */
export function cpuRoll(state: BattleState, side: Side, key: string, perAction = true): number {
  let h = (2166136261 ^ (state.seed >>> 0)) >>> 0;
  const text = `${state.turn}|${side}|${key}|${perAction ? state.log.length : ''}`;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** そのモンスターの攻撃の強さ（攻撃技の最大ダメージ。場の増減も入れる。腕前 A の「いちばん危ない相手」に使う） */
function threatOf(state: BattleState, m: BattleMonster): number {
  return Math.max(
    0,
    ...skillsOf(m.cardId)
      .filter((k) => k.effect.type === 'attack' && k.stat !== null)
      .map((k) => skillValue(k) + (k.stat ? fieldModifier(state, k.stat.type) : 0)),
  );
}

/** いちばん危ない相手から（攻撃の強さ ÷ 残りライフ が大きい順） */
const dangerOf = (state: BattleState, m: BattleMonster): number => threatOf(state, m) / Math.max(1, m.life);

/**
 * 倒せないときの狙い（2026-10-30 指示書 Z）：じならしをかけた相手（この手番に回避できない）を先に。hunter の構えは最大ライフの少ないモンスターから。
 * そのうえで、腕前 A はいちばん危ない相手、C・B はばらばら（key ごとの cpuRoll）
 */
function pickTarget(state: BattleState, side: Side, reach: readonly BattleMonster[], style: AiStyle, skill: CpuSkill, key: string): BattleMonster | undefined {
  let pool = [...reach];
  if (pool.length === 0) return undefined;
  const pinned = pool.filter((m) => isPinned(state, m));
  if (pinned.length > 0) pool = pinned;
  if (style === 'hunter') {
    const min = Math.min(...pool.map((m) => m.maxLife));
    pool = pool.filter((m) => m.maxLife === min);
  }
  if (skill === 'A') return pool.sort((a, b) => dangerOf(state, b) - dangerOf(state, a))[0];
  return pool[Math.min(pool.length - 1, Math.floor(cpuRoll(state, side, `target:${key}`) * pool.length))];
}
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
  // 守りの陣（2026-10-30 指示書 Y）：自分の手札に守りのカードが2枚以上あるとき
  if (e.type === 'guardDiscount') return state.sides[side].hand.filter(isGuard).length >= 2 ? 1 : 0;
  if (e.type !== 'field') return 0;
  return e.modifier * (attackersWith(state, side, e.stat) - attackersWith(state, otherSide(side), e.stat));
}

/** 山札を動かす効果の枚数（ドロー・山札からマナ） */
function deckAmount(card: PlayCard): number {
  if (card.kind === 'skill') return skillValue(card);
  const e = card.effect;
  return e.type === 'draw' || e.type === 'mana' ? e.value : 0;
}

export function chooseAction(state: BattleState, side: Side, style: AiStyle = 'normal', skill: CpuSkill = 'B'): BattleAction | null {
  if (state.phase === 'ended') return null;

  if (state.phase === 'defense') return chooseDefense(state, side, style, skill);

  if (state.active !== side) return null;
  if (state.phase === 'mana') return chooseManaAction(state, side, style, skill);
  const options = usableOptions(state, side);
  const mine = state.sides[side];
  const enemies = aliveMonsters(state.sides[otherSide(side)]);

  // 腕前 C：攻撃できる手番の一部で、攻撃を見送る（その手番の最初の1手のときだけ決める。記録に「〇〇は迷っている…」）
  const firstMove = aliveMonsters(mine).every((m) => !m.acted) && Object.keys(mine.turnUsage).length === 0;
  const canAttack = options.some((o) => o.def.effect.type === 'attack') && enemies.length > 0;
  if (firstMove && canAttack && cpuRoll(state, side, 'hesitate', false) < CPU_SKILL[skill].hesitate) return { type: 'endAttack', side, note: 'hesitate' };

  // ツムジ（2026-10-30 指示書 U）：Wひっかきを2回続けて使う（2回目が使えるなら必ず続ける）
  const scratch = chooseDoubleScratch(state, side, options, enemies, style, skill);
  if (scratch) return scratch;

  // 癖：攻撃・妨害を先に使う人
  if (style === 'aggressive' || style === 'flashy' || style === 'hunter') {
    const attack = chooseAttack(state, side, options, enemies, style, skill);
    if (attack) return attack;
  }
  // 妨害を先に：その手番の最初の1手（妨害のあとにほかのモンスターで攻撃できるよう、生きているモンスターが2体以上のとき）
  if (style === 'disrupt' && aliveMonsters(mine).length >= 2 && aliveMonsters(mine).every((m) => !m.acted)) {
    // 妨害のあとに攻撃できるマナ（2）を残せるときだけ
    const special = chooseSpecial(state, side, options, enemies, 2);
    if (special) return special;
  }

  // 1. ライフが半分以下の味方を回復（技・サポートどちらでも）
  const wounded = aliveMonsters(mine)
    .filter((m) => m.life <= m.maxLife / 2)
    .sort((a, b) => a.life / a.maxLife - b.life / b.maxLife)[0];
  const heal = options.find((o) => o.def.effect.type === 'heal');
  if (wounded && heal && style !== 'aggressive') {
    return { type: 'useCard', side, cardUid: heal.card.uid, targetUid: wounded.uid };
  }
  // みずあび（自分を回復）：使えるモンスターのライフが半分以下なら使う（仮の思考）
  const selfHeal = options.filter(isSkillOption).find((o) => o.def.effect.type === 'healSelf');
  const selfHealer = selfHeal ? availableUsers(state, side, selfHeal.def).find((m) => m.life <= m.maxLife / 2) : undefined;
  if (selfHeal && selfHealer) return { type: 'useCard', side, cardUid: selfHeal.card.uid, userUid: selfHealer.uid };
  // いやしのみつ（フルーネ。2026-10-29 指示書）：その手番に相手を倒せる攻撃が無く、味方（フルーネを含む）が最大から2以上減っているとき。
  // いちばん倒れそうな味方（残りライフの少ない順・同じなら最大に対する割合の少ない順）を選ぶ
  const nectar = options.filter(isSkillOption).find((o) => o.def.effect.type === 'healAlly');
  if (nectar && !canKillThisTurn(state, side, options)) {
    const ally = targetsFor(state, side, nectar.def)
      .filter((m) => m.maxLife - m.life >= 2)
      .sort((a, b) => a.life - b.life || a.life / a.maxLife - b.life / b.maxLife)[0];
    if (ally) return { type: 'useCard', side, cardUid: nectar.card.uid, targetUid: ally.uid };
  }

  // 1.5 サポートカード（2026-10-30 指示書 Y の仮の思考）：投石で倒す・声援で倒す・霧の香・思い出の箱・風まかせ
  const supportPlay = chooseSupportPlay(state, side, options, style);
  if (supportPlay) return supportPlay;

  // 2. 全体カード：いまの場より自分に得になるときだけ出す（入れ替え合いでマナを無駄にしない）
  const current = state.field ? fieldScore(state, side, getSupport(state.field.cardId)) : 0;
  const field = options
    .filter((o): o is Option & { def: SupportCard } => o.def.kind === 'support' && o.def.duration === 'field')
    .map((o) => ({ o, score: fieldScore(state, side, o.def) }))
    .sort((a, b) => b.score - a.score)[0];
  if (field && field.score > 0 && field.score > current) return { type: 'useCard', side, cardUid: field.o.card.uid };

  // 2.5 試遊中：プカリム（2026-10-28）。その手番に倒せる相手がいなければ、ほっぺにためる（次の手番に大きな攻撃）か、おいかぜ
  const puff = chooseChargeOrTailwind(state, side, options, enemies);
  if (puff) return puff;
  // 2.6 試遊中：ジオル（2026-10-29）。エネルギーをためる・じならし
  const geol = chooseEnergyOrPin(state, side, options, enemies, style, skill);
  if (geol) return geol;

  // 2.7 セレフィーン（2026-10-29）。みちしお
  const tide = chooseTide(state, side, options);
  if (tide) return tide;

  // 2.8 ツムジ（2026-10-30 指示書 U）。かぜのり（Wひっかきの2回続けては、いちばん先に考える）
  const windRide = chooseWindRide(state, side, options);
  if (windRide) return windRide;

  // 3. 攻撃：倒せる相手がいれば倒し、いなければ一番強い攻撃を（腕前ごとの狙いの）相手へ
  const attack = chooseAttack(state, side, options, enemies, style, skill);
  if (attack) return attack;

  // 4. 特殊（吠える・すなかけ・ダストキック・ちょうはつ）：一番ライフの多い相手に使う（仮の思考）
  const special = chooseSpecial(state, side, options, enemies);
  if (special) return special;
  // しめったはだ：まだかかっておらず、相手にその種類の攻撃技を持つモンスターがいるときに使う（仮の思考）
  const shield = options.filter(isSkillOption).find((o) => o.def.effect.type === 'shield');
  if (shield && shield.def.effect.type === 'shield') {
    const against = shield.def.effect.against;
    const user = availableUsers(state, side, shield.def)[0];
    const covered = user !== undefined && shieldOf(state, user, against === 'all' ? 'force' : against) > 0;
    if (user && !covered && attackersWith(state, otherSide(side), against) > 0) return { type: 'useCard', side, cardUid: shield.card.uid, userUid: user.uid };
  }
  // すなをほる：使えるモンスターのライフが半分以下で、まだ隠れておらず、相手に攻撃の技を持つモンスターがいるときに使う（仮の思考）
  const hide = options.filter(isSkillOption).find((o) => o.def.effect.type === 'hide');
  const hider = hide ? availableUsers(state, side, hide.def).find((m) => m.life <= m.maxLife / 2 && m.hiddenTurn !== state.turn + 1) : undefined;
  if (hide && hider && attackersWith(state, otherSide(side), 'all') > 0) return { type: 'useCard', side, cardUid: hide.card.uid, userUid: hider.uid };
  // いたずら：相手の手札が2枚以上あるときに使う（仮の思考）
  const prank = options.filter(isSkillOption).find((o) => o.def.effect.type === 'handToDeck' || o.def.effect.type === 'discardRandom');
  if (prank && state.sides[otherSide(side)].hand.length >= 2) return { type: 'useCard', side, cardUid: prank.card.uid };
  // 考える：攻撃できる技がなく、ほかの手札が2枚以上あるときに引き直す（仮の思考）
  const redraw = options.filter(isSkillOption).find((o) => o.def.effect.type === 'redrawHand');
  if (redraw && !options.some((o) => o.def.effect.type === 'attack') && mine.hand.length >= 3) return { type: 'useCard', side, cardUid: redraw.card.uid };
  // 不思議な嗅覚：相手の手札が3枚以上あり、マナに余裕があるときだけ（仮の思考。思考は手札を見なくても動く）
  const sniff = options.filter(isSkillOption).find((o) => o.def.effect.type === 'revealHand');
  if (sniff && state.sides[otherSide(side)].hand.length >= 3 && manaOf(mine) >= sniff.def.cost + 3) return { type: 'useCard', side, cardUid: sniff.card.uid };

  // 4.5 投石（攻撃のあと）：マナが投石の分＋2以上残っていれば。狙いは攻撃と同じ（2026-10-30 指示書 Z で「いちばんライフの少ない相手」をやめた）
  const stone = supportOf(options, 'stone');
  if (stone && manaOf(mine) >= stone.def.cost + 2) {
    const target = pickTarget(state, side, attackableMonsters(state, otherSide(side)), style, skill, 'stone');
    if (target) return { type: 'useCard', side, cardUid: stone.card.uid, targetUid: target.uid };
  }

  // 4.8 旅の手帳（2026-10-30 指示書 Z）：山札が20枚以上あり、攻撃のあとにマナが残っていて（払える）、手札に今のマナで使える攻撃技が無いとき。
  // 腕前 A は、手札に守りのカードが無いときも使う
  const journal = options.find((o): o is Option & { def: SupportCard } => o.def.kind === 'support' && o.def.effect.type === 'draw');
  if (journal && style !== 'guard' && mine.deck.length >= JOURNAL_MIN_DECK && manaOf(mine) >= journal.def.cost) {
    const noAttack = !options.some((o) => o.def.effect.type === 'attack');
    const noGuard = !mine.hand.some(isGuard);
    if (noAttack || (skill === 'A' && noGuard)) return { type: 'useCard', side, cardUid: journal.card.uid };
  }

  // 5. マナ・ドロー
  // 山札が足りないと負けになるので、山札を動かす効果は山札に余裕があるときだけ。
  // ドローは手札が少ないとき、山札からマナはマナが少ないときだけ使う（旅の手帳は 4.8 だけで考える）
  const support = options.find((o) => {
    if (o.def.kind === 'support' && o.def.effect.type === 'draw') return false;
    if (mine.deck.length <= deckAmount(o.def) + 15) return false;
    if (o.def.effect.type === 'draw') return style !== 'guard' && mine.hand.length <= 3;
    // みちしお（amount のある技）は chooseTide だけで考える
    if (o.def.effect.type === 'mana') return !(o.def.kind === 'skill' && o.def.effect.amount !== undefined) && manaOf(mine) <= 2;
    return false;
  });
  if (support) return { type: 'useCard', side, cardUid: support.card.uid };

  // 6. 使えるカードがなければ攻撃を終えてマナ化へ
  return { type: 'endAttack', side };
}

/** 旅の手帳を使う山札の枚数の下限（2026-10-30 指示書 Z） */
const JOURNAL_MIN_DECK = 20;

/** 手札の中の、その種類のサポート（使えるもの） */
function supportOf(options: Option[], type: SupportCard['effect']['type']): (Option & { def: SupportCard }) | undefined {
  return options.find((o): o is Option & { def: SupportCard } => o.def.kind === 'support' && o.def.effect.type === type);
}

/**
 * サポートカード（2026-10-30 指示書 Y。仮の思考）。すぐ効くカードは全部まとめて1ターン1回なので、上から順に1つだけ：
 * - 投石：ライフ1の相手（投石で倒せる相手）がいれば、その相手に先に使う
 * - 声援：その攻撃に＋1すれば相手を倒せるとき（＋1なしでは倒せないとき）、その攻撃をするモンスターに
 * - 霧の香：これから攻撃する手番に、相手のマナが1〜2（守りを払えそうな数）のとき、攻撃の前に
 * - 思い出の箱：マナが（3＋戻す技のマナ）以上あり、捨て札にダメージ3以上の攻撃技（使えるモンスターが生きている）があるとき、いちばんダメージの大きい技を
 * - 風まかせ：手札に倒れたモンスターの技があるか、今のマナ＋ほかの手札をみなマナにしても払えない重い技があるとき、その1枚を戻す
 */
function chooseSupportPlay(state: BattleState, side: Side, options: Option[], style: AiStyle): BattleAction | null {
  const mine = state.sides[side];
  const mana = manaOf(mine);
  const stone = supportOf(options, 'stone');
  if (stone && stone.def.effect.type === 'stone') {
    const power = Math.max(0, stone.def.effect.value + fieldModifier(state, 'force'));
    const kill = attackableMonsters(state, otherSide(side)).filter((e) => e.life <= power && power > 0)[0];
    if (kill) return { type: 'useCard', side, cardUid: stone.card.uid, targetUid: kill.uid };
  }
  const attacks = options.filter(isSkillOption).filter((o) => o.def.effect.type === 'attack');
  const cheer = supportOf(options, 'cheer');
  if (cheer && cheer.def.effect.type === 'cheer' && !canKillThisTurn(state, side, options)) {
    const plus = cheer.def.effect.value;
    const cheerable = new Set(cheerTargets(state, side).map((m) => m.uid));
    for (const o of attacks) {
      for (const u of availableUsers(state, side, o.def)) {
        if (!cheerable.has(u.uid) || mana - cheer.def.cost < skillCost(state, o.def, u)) continue;
        const power = attackPower(state, o.def, u);
        if (targetsFor(state, side, o.def, u).some((e) => e.life > power && e.life <= power + plus)) return { type: 'useCard', side, cardUid: cheer.card.uid, targetUid: u.uid };
      }
    }
  }
  const mist = supportOf(options, 'manaDrain');
  if (mist && style !== 'guard') {
    const theirs = manaOf(state.sides[otherSide(side)]);
    const canStillAttack = attacks.some((o) => availableUsers(state, side, o.def).some((u) => skillCost(state, o.def, u) <= mana - mist.def.cost));
    if (theirs >= 1 && theirs <= 2 && canStillAttack) return { type: 'useCard', side, cardUid: mist.card.uid };
  }
  const recall = supportOf(options, 'recall');
  if (recall) {
    const alive = new Set(aliveMonsters(mine).map((m) => m.cardId));
    const best = recallChoices(state, side)
      .map((id) => getPlayCard(id))
      .filter((k): k is SkillCard => k.kind === 'skill' && k.effect.type === 'attack' && skillValue(k) >= 3 && alive.has(k.monsterId) && mana >= recall.def.cost + k.cost)
      .sort((a, b) => skillValue(b) - skillValue(a))[0];
    if (best) return { type: 'useCard', side, cardUid: recall.card.uid, choice: best.id };
  }
  const swap = supportOf(options, 'swap');
  if (swap) {
    const alive = new Set(aliveMonsters(mine).map((m) => m.cardId));
    const others = mine.hand.filter((c) => c.uid !== swap.card.uid);
    const dead = others.find((c) => {
      const k = getPlayCard(c.cardId);
      return k.kind === 'skill' && !alive.has(k.monsterId);
    });
    const heavy = others.find((c) => getPlayCard(c.cardId).cost > mana + others.length - 1);
    const back = dead ?? heavy;
    if (back) return { type: 'useCard', side, cardUid: swap.card.uid, choice: back.uid };
  }
  return null;
}

/** みちしおを使うのに要る山札の枚数（これより少なければ山札が残り少ないので使わない） */
const TIDE_MIN_DECK = 10;
/** 大きい技（ルナタイド・オーシャンウェーブ）とみなす必要マナ */
const TIDE_BIG_COST = 4;

/**
 * みちしお（セレフィーン。2026-10-29 指示書）：その手番に攻撃で相手を倒せず、手札の大きい技（同じモンスターの必要マナ4以上の攻撃）が
 * 次の手番にマナが足りなくて使えないとき。次の手番のマナ＝いまのマナ＋この手番にマナにできる手札（みちしおと大きい技を除く）。
 * 山札が残り少ない（TIDE_MIN_DECK より少ない）ときは使わない
 */
function chooseTide(state: BattleState, side: Side, options: Option[]): BattleAction | null {
  const tide = options.filter(isSkillOption).find((o) => o.def.effect.type === 'mana' && o.def.effect.amount !== undefined);
  if (!tide) return null;
  const mine = state.sides[side];
  if (mine.deck.length < TIDE_MIN_DECK || canKillThisTurn(state, side, options)) return null;
  const user = availableUsers(state, side, tide.def)[0];
  if (!user) return null;
  const big = mine.hand
    .filter((c) => c.uid !== tide.card.uid)
    .map((c) => ({ c, def: getPlayCard(c.cardId) }))
    .filter(({ def }) => def.kind === 'skill' && def.monsterId === tide.def.monsterId && def.effect.type === 'attack' && def.cost >= TIDE_BIG_COST)
    .sort((a, b) => a.def.cost - b.def.cost)[0];
  if (!big) return null;
  const nextMana = manaOf(mine) + mine.hand.length - 2;
  if (big.def.cost <= nextMana) return null;
  return { type: 'useCard', side, cardUid: tide.card.uid, userUid: user.uid };
}

/**
 * Wひっかき（ツムジ。2026-10-30 指示書 U）：続けて使える2回目があれば必ず使う（1回目のあと）。
 * 1回目は、手札に2枚あり、2枚ぶんのマナ（かぜのりが効いていればそのぶん少なく）があるときに使う。1枚だけのときは、ふつうの攻撃と同じ考え方（chooseAttack）
 */
function chooseDoubleScratch(state: BattleState, side: Side, options: Option[], enemies: BattleMonster[], style: AiStyle, skill: CpuSkill): BattleAction | null {
  const scratches = options.filter(isSkillOption).filter((o) => o.def.effect.type === 'attack' && o.def.effect.chain);
  if (scratches.length === 0 || enemies.length === 0) return null;
  const pick = (o: SkillOption, user: BattleMonster): BattleAction | null => {
    const reach = targetsFor(state, side, o.def, user);
    const power = attackPower(state, o.def, user);
    const missKill = cpuRoll(state, side, 'kill') < CPU_SKILL[skill].missKill;
    const kill = missKill ? undefined : reach.filter((e) => e.life <= power).sort((a, b) => b.life - a.life)[0];
    const target = kill ?? pickTarget(state, side, reach, style, skill, 'scratch');
    return target ? { type: 'useCard', side, cardUid: o.card.uid, userUid: user.uid, targetUid: target.uid } : null;
  };
  // 2回目：1回目を使ったツムジが、続けてもう1回
  for (const o of scratches) {
    const user = availableUsers(state, side, o.def).find((m) => chainReady(state, m, o.def));
    if (user) return pick(o, user);
  }
  // 1回目：同じ技が手札に2枚あり、2回ぶん払えるとき
  const mana = manaOf(state.sides[side]);
  for (const o of scratches) {
    if (scratches.filter((x) => x.def.id === o.def.id).length < 2) continue;
    const user = availableUsers(state, side, o.def).find((m) => !m.acted && skillCost(state, o.def, m) * 2 <= mana);
    if (user) return pick(o, user);
  }
  return null;
}

/**
 * かぜのり（ツムジ。2026-10-30 指示書 U）：その手番に相手を倒せる攻撃が無く、手札にツムジの攻撃技（マナ1以上）があるとき。
 * もう次の手番に効くようにかけてあれば使わない
 */
function chooseWindRide(state: BattleState, side: Side, options: Option[]): BattleAction | null {
  const ride = options.filter(isSkillOption).find((o) => o.def.effect.type === 'windRide');
  if (!ride || canKillThisTurn(state, side, options)) return null;
  const user = availableUsers(state, side, ride.def).find((m) => m.windRide?.turn !== state.turn + 2);
  if (!user) return null;
  const hasAttack = state.sides[side].hand.some((c) => {
    if (c.uid === ride.card.uid) return false;
    const card = getPlayCard(c.cardId);
    return card.kind === 'skill' && card.effect.type === 'attack' && card.monsterId === ride.def.monsterId && card.cost >= 1;
  });
  return hasAttack ? { type: 'useCard', side, cardUid: ride.card.uid, userUid: user.uid } : null;
}

/** その手番に、手札の攻撃技で倒せる相手がいるか */
function canKillThisTurn(state: BattleState, side: Side, options: Option[]): boolean {
  return options
    .filter(isSkillOption)
    .filter((o) => o.def.effect.type === 'attack')
    .some((o) => availableUsers(state, side, o.def).some((u) => targetsFor(state, side, o.def, u).some((e) => e.life <= attackPower(state, o.def, u))));
}

/**
 * フラワードレイン（フルーネ。2026-10-29 指示書）：マナが足りる（6以上）とき、相手を倒せるならその相手（ライフの多い順）へ、
 * 倒せなくてもフルーネのライフが最大から2以上減っていれば、ふつうの攻撃と同じ選び方の相手へ、ほかの攻撃より先に使う
 */
function chooseDrain(state: BattleState, side: Side, attacks: SkillOption[], style: AiStyle, skill: CpuSkill): BattleAction | null {
  const drain = attacks.find((o) => o.def.effect.type === 'attack' && o.def.effect.drain);
  if (!drain) return null;
  for (const user of availableUsers(state, side, drain.def)) {
    const reach = targetsFor(state, side, drain.def, user);
    const power = attackPower(state, drain.def, user);
    const kill = reach.filter((e) => e.life <= power).sort((a, b) => b.life - a.life)[0];
    if (kill) return { type: 'useCard', side, cardUid: drain.card.uid, userUid: user.uid, targetUid: kill.uid };
    if (user.maxLife - user.life >= 2) {
      const target = pickTarget(state, side, reach, style, skill, 'drain');
      if (target) return { type: 'useCard', side, cardUid: drain.card.uid, userUid: user.uid, targetUid: target.uid };
    }
  }
  return null;
}

/** 攻撃（倒せる相手がいれば倒す。構えで技の順・狙う相手が、腕前で見のがし・技の選び方・狙いが変わる）。攻撃できなければ null */
function chooseAttack(state: BattleState, side: Side, options: Option[], enemies: BattleMonster[], style: AiStyle, skill: CpuSkill = 'B'): BattleAction | null {
  const attacks = options.filter(isSkillOption).filter((o) => o.def.effect.type === 'attack');
  if (attacks.length === 0 || enemies.length === 0) return null;
  const drained = chooseDrain(state, side, attacks, style, skill);
  if (drained) return drained;
  const power = (o: SkillOption): number => attackPower(state, o.def, availableUsers(state, side, o.def)[0]);
  // ためているときのぷはーっ（回避されない）は、少し強いものとして先に考える（試遊中：プカリム）
  const rank = (o: SkillOption): number => power(o) + (undodgeableNow(o.def, availableUsers(state, side, o.def)[0]) ? 1.5 : 0);
  // 大技を先に（flashy）は必要マナの多い順、ほかは強い順
  const byPower = [...attacks].sort((a, b) => (style === 'flashy' ? b.def.cost - a.def.cost : 0) || rank(b) - rank(a));
  // 攻撃できる相手（ちょうはつで限られていればそれだけ）
  const reachable = (o: SkillOption): BattleMonster[] => targetsFor(state, side, o.def);
  // 倒せる相手：腕前 C・B は一部を見のがす。A は倒せる組み合わせのうち、倒しすぎない（威力−残りライフが小さい）・安い・危ない相手の順
  const missKill = cpuRoll(state, side, 'kill') < CPU_SKILL[skill].missKill;
  if (style !== 'flashy' && !missKill) {
    if (skill === 'A') {
      const kills = byPower
        .flatMap((o) => reachable(o).filter((e) => e.life <= power(o)).map((e) => ({ o, e, over: power(o) - e.life })))
        .sort((a, b) => a.over - b.over || a.o.def.cost - b.o.def.cost || dangerOf(state, b.e) - dangerOf(state, a.e));
      const best = kills[0];
      if (best) return attackAction(state, side, best.o, best.e.uid);
    } else {
      for (const option of byPower) {
        const killable = reachable(option).filter((e) => e.life <= power(option));
        // hunter は最大ライフの少ないモンスターから。ほかはライフの多い相手（倒せるうちの大物）から
        const kill = killable.sort((a, b) => (style === 'hunter' ? a.maxLife - b.maxLife : 0) || b.life - a.life)[0];
        if (kill) return attackAction(state, side, option, kill.uid);
      }
    }
  }
  // かぜのり（ツムジ）が効いている間は、マナが減った分で使える大きい攻撃を先に（2026-10-30 指示書 U）
  const ridden = byPower.find((o) => availableUsers(state, side, o.def).some((u) => windRideOf(state, u) > 0));
  if (ridden) {
    const rider = availableUsers(state, side, ridden.def).find((u) => windRideOf(state, u) > 0);
    const target = rider ? pickTarget(state, side, targetsFor(state, side, ridden.def, rider), style, skill, 'ride') : undefined;
    if (rider && target) return { type: 'useCard', side, cardUid: ridden.card.uid, userUid: rider.uid, targetUid: target.uid };
  }
  // 試遊中：ジオルの地ひびき（相手全体）。倒せる相手がいなければ、相手が2体以上生きているときに使う（2026-10-29 指示書）
  const quake = byPower.find((o) => o.def.effect.type === 'attack' && o.def.effect.allTargets);
  if (quake && reachable(quake).length >= 2) return attackAction(state, side, quake, reachable(quake)[0]?.uid ?? '');
  // 相手全体への攻撃は、相手が1体のときはふつうの攻撃と同じに考える
  const candidates = byPower.filter((o) => !(o.def.effect.type === 'attack' && o.def.effect.allTargets && reachable(o).length >= 2));
  // 腕前 C：一部の手番で、強くない技（使える技からばらばら）を選ぶ
  const weak = cpuRoll(state, side, 'weak') < CPU_SKILL[skill].weakSkill;
  const strongest = weak ? candidates[Math.min(candidates.length - 1, Math.floor(cpuRoll(state, side, 'weakPick') * candidates.length))] : candidates[0];
  if (!strongest) return null;
  // 腕前 A：倒せないときは、次の手番に大技を払えるようマナを残すことがある
  if (skill === 'A' && style !== 'aggressive' && saveManaForBig(state, side, strongest, power(strongest))) return null;
  const target = pickTarget(state, side, reachable(strongest), style, skill, 'attack');
  return target ? attackAction(state, side, strongest, target.uid) : null;
}

/** 大技とみなすダメージ（腕前 A のマナを残す考え方） */
const BIG_POWER = 3;

/**
 * 腕前 A（2026-10-30 指示書 Z）：倒せない手番に、弱い攻撃（ダメージ2以下）を使うと次の手番に手札の大技（ダメージ3以上・今のマナでは足りない）が
 * 払えなくなり、使わなければ払えるとき、その攻撃をやめる（無理をしない程度）。次の手番のマナ＝今のマナ＋この手番の終わりにマナにできる手札（2枚は残す）
 */
function saveManaForBig(state: BattleState, side: Side, chosen: SkillOption, chosenPower: number): boolean {
  if (chosenPower > 2) return false;
  const mine = state.sides[side];
  const mana = manaOf(mine);
  const alive = new Set(aliveMonsters(mine).map((m) => m.cardId));
  const holdNext = mana + Math.max(0, mine.hand.length - 2);
  const useNext = mana - chosen.def.cost + Math.max(0, mine.hand.length - 1 - 2);
  return mine.hand.some((c) => {
    if (c.uid === chosen.card.uid) return false;
    const k = getPlayCard(c.cardId);
    return k.kind === 'skill' && k.effect.type === 'attack' && alive.has(k.monsterId) && skillValue(k) >= BIG_POWER && k.cost > mana && k.cost > useNext && k.cost <= holdNext;
  });
}

/**
 * 試遊中：ジオル（2026-10-29。指示書の CPU の考え方）。
 * - エネルギーをためる：ジオルがその手番に相手を倒せず、次の手番にクリスタルショット・クリスタルレイ（ジオルのかしこさ技）を使えそうなとき
 * - じならし：同じ手番に、まだ動いていない味方が攻撃技（ダメージ3以上）を使えそうなとき。狙うのはその味方が攻撃する相手
 */
function chooseEnergyOrPin(state: BattleState, side: Side, options: Option[], enemies: BattleMonster[], style: AiStyle, skill: CpuSkill): BattleAction | null {
  const skills = options.filter(isSkillOption);
  const special = skills.filter((o) => o.def.effect.type === 'energy' || o.def.effect.type === 'pin');
  if (special.length === 0 || enemies.length === 0) return null;
  const mine = state.sides[side];
  const attacks = skills.filter((o) => o.def.effect.type === 'attack');
  const canKill = (user: BattleMonster): boolean =>
    attacks.some((o) => availableUsers(state, side, o.def).some((u) => u.uid === user.uid) && targetsFor(state, side, o.def, user).some((e) => e.life <= attackPower(state, o.def, user)));
  const energy = special.find((o) => o.def.effect.type === 'energy');
  if (energy) {
    const nextTurn = state.turn + 2;
    const manaNext = manaOf(mine) - energy.def.cost + Math.max(0, mine.hand.length - 2);
    const user = availableUsers(state, side, energy.def).find((m) => m.energy?.turn !== nextTurn && !canKill(m));
    const wisdomNext =
      user &&
      mine.hand.some((c) => {
        if (c.uid === energy.card.uid) return false;
        const card = getPlayCard(c.cardId);
        return card.kind === 'skill' && card.effect.type === 'attack' && card.monsterId === user.cardId && card.stat?.type === 'wisdom' && card.cost <= manaNext;
      });
    if (user && wisdomNext) return { type: 'useCard', side, cardUid: energy.card.uid, userUid: user.uid };
  }
  const pin = special.find((o) => o.def.effect.type === 'pin');
  if (!pin) return null;
  const user = availableUsers(state, side, pin.def)[0];
  if (!user) return null;
  const manaAfter = manaOf(mine) - pin.def.cost;
  // まだ動いていない味方（じならしを使うモンスター以外）の、払える攻撃技（ダメージ3以上）で一番強いもの
  const followUps = attacks
    .filter((o) => o.def.cost <= manaAfter)
    .flatMap((o) => availableUsers(state, side, o.def).filter((u) => u.uid !== user.uid).map((ally) => ({ o, ally, power: attackPower(state, o.def, ally) })))
    .filter((f) => f.power >= 3)
    .sort((a, b) => b.power - a.power);
  const follow = followUps[0];
  if (!follow) return null;
  // その味方が攻撃する相手：倒せる相手がいればそれ（ライフの多い順）、いなければ腕前ごとの狙い（chooseAttack と同じ選び方）
  const reach = targetsFor(state, side, follow.o.def, follow.ally);
  const victim = reach.filter((e) => e.life <= follow.power).sort((a, b) => b.life - a.life)[0] ?? pickTarget(state, side, reach, style, skill, 'pin');
  if (!victim || isPinned(state, victim)) return null;
  return { type: 'useCard', side, cardUid: pin.card.uid, userUid: user.uid, targetUid: victim.uid };
}

/**
 * 試遊中：プカリム（2026-10-28。仮の思考）。ためていないプカリムが、その手番に攻撃で相手を倒せないとき：
 * - ほっぺにためる（次の手番に、ためた攻撃〔ぷはーっ・おおつむじ〕を使えるように）
 * - ほっぺにためるが無ければ、おいかぜ：まだ動いていない味方が、おいかぜのあとのマナで攻撃技を使えるならその味方に
 *   （2026-10-29 からおいかぜは次の自分のターンだけ効くが、選び方は試遊のときのまま。ユーザー了承）
 */
function chooseChargeOrTailwind(state: BattleState, side: Side, options: Option[], enemies: BattleMonster[]): BattleAction | null {
  const skills = options.filter(isSkillOption);
  const special = skills.filter((o) => o.def.effect.type === 'charge' || o.def.effect.type === 'tailwind');
  if (special.length === 0 || enemies.length === 0) return null;
  const attacks = skills.filter((o) => o.def.effect.type === 'attack');
  const canKill = (user: BattleMonster): boolean =>
    attacks.some((o) => availableUsers(state, side, o.def).some((u) => u.uid === user.uid) && targetsFor(state, side, o.def, user).some((e) => e.life <= attackPower(state, o.def, user)));
  const charge = special.find((o) => o.def.effect.type === 'charge');
  if (charge) {
    const user = availableUsers(state, side, charge.def).find((m) => !m.charge && !canKill(m));
    if (user) return { type: 'useCard', side, cardUid: charge.card.uid, userUid: user.uid };
  }
  const wind = special.find((o) => o.def.effect.type === 'tailwind');
  if (!wind) return null;
  const user = availableUsers(state, side, wind.def).find((m) => !m.charge && !canKill(m));
  if (!user) return null;
  // おいかぜは「次の自分のターン」の攻撃だけ＋1 なので、次の自分のターンに攻撃できそうな味方にかける（2026-10-29 ユーザー指示）。
  // 攻撃できそう＝その味方の攻撃技が手札にあり、次のターンに払えそうなマナ（おいかぜを払った残り＋この手番の終わりにマナにできる残りの手札）で足りる。
  // 今の手番で動いたかどうかは関係ない（次のターンには動ける）
  const mine = state.sides[side];
  const nextTurn = state.turn + 2;
  const manaNext = manaOf(mine) - wind.def.cost + Math.max(0, mine.hand.length - 2);
  const canAttackNext = (m: BattleMonster): boolean =>
    mine.hand.some((c) => {
      if (c.uid === wind.card.uid) return false;
      const card = getPlayCard(c.cardId);
      return card.kind === 'skill' && card.effect.type === 'attack' && card.monsterId === m.cardId && card.cost <= manaNext;
    });
  const ally = tailwindTargets(state, side, wind.def).find((m) => m.tailwind?.turn !== nextTurn && canAttackNext(m));
  return ally ? { type: 'useCard', side, cardUid: wind.card.uid, userUid: user.uid, targetUid: ally.uid } : null;
}

/** 特殊（吠える・すなかけ・ダストキック・ちょうはつ）：一番ライフの多い相手に使う（仮の思考）。使えなければ null */
function chooseSpecial(state: BattleState, side: Side, options: Option[], enemies: BattleMonster[], spare = 0): BattleAction | null {
  const mana = manaOf(state.sides[side]);
  const special = options.filter(isSkillOption).find((o) => ['weaken', 'seal', 'taunt'].includes(o.def.effect.type) && o.def.cost + spare <= mana);
  const strongestEnemy = [...enemies].sort((a, b) => b.life - a.life)[0];
  return special && strongestEnemy ? attackAction(state, side, special, strongestEnemy.uid) : null;
}

/** 防御・回避・かばうのカードか */
const isGuard = (c: HandCard): boolean => ['defense', 'evade', 'cover'].includes(getPlayCard(c.cardId).effect.type);

/** 守備カードの強さ（並べ替え用。かばうは −2 の防御くらいに数える） */
const guardValue = (c: HandCard): number => {
  const card = getPlayCard(c.cardId);
  if (card.kind !== 'skill') return 0;
  if (card.effect.type === 'cover') return 2;
  return card.effect.type === 'defense' ? guardReduction(card) : skillValue(card);
};

/**
 * マナ化（仮の思考）：残す手札を絞り、残りをすべてマナにする。
 * - 防御・回避カード（2026-10-30 指示書 Z：腕前 C 0枚・B 1枚・A 2枚。構えの aggressive は0枚・guard は2枚）：いまのマナで払える中で強いもの（相手の攻撃に備える）。
 *   腕前 A は、相手の場のモンスターの攻撃技の種類に合う守りを先に
 * - 技・サポート1枚：マナ化し終えたあとのマナで払える中で一番重いもの（次のターンに使う）。腕前 A は、それを残すと守りの分のマナが足りなくなるなら残さない
 * - 腕前 C は一部の手番で、残したい攻撃より先に守りをマナにする（マナにできる枚数に上限がある手番〔先攻の1手番目〕で差が出る）
 * マナ化するたびにマナ+1・手札-1 なので「マナ化し終えたあとのマナ」は途中で変わらず、残す札が安定する。
 */
function chooseManaAction(state: BattleState, side: Side, style: AiStyle = 'normal', skill: CpuSkill = 'B'): BattleAction {
  const mine = state.sides[side];
  const mana = manaOf(mine);
  const cost = (c: HandCard): number => {
    const card = getPlayCard(c.cardId);
    return card.kind === 'skill' ? guardCost(state, card) : card.cost;
  };
  const guardKeep = style === 'aggressive' ? 0 : style === 'guard' ? 2 : CPU_SKILL[skill].guardKeep;
  // 腕前 A：相手の生きているモンスターの攻撃技の種類（ちから・かしこさの多い方）に効く守りを先に
  const theirs = otherSide(side);
  const force = attackersWith(state, theirs, 'force');
  const wisdom = attackersWith(state, theirs, 'wisdom');
  const fits = (c: HandCard): number => {
    if (skill !== 'A') return 0;
    const card = getPlayCard(c.cardId);
    if (card.kind !== 'skill') return 0;
    const against = guardAgainst(card);
    return against === 'all' ? 2 : (against === 'force' && force >= wisdom) || (against === 'wisdom' && wisdom >= force) ? 1 : 0;
  };
  const keepGuards = mine.hand
    .filter((c) => isGuard(c) && cost(c) <= mana)
    .sort((a, b) => fits(b) - fits(a) || guardValue(b) - guardValue(a))
    .slice(0, guardKeep);
  const others = mine.hand.filter((c) => !keepGuards.includes(c) && (!isGuard(c) || guardKeep === 0));
  const manaAfter = mana + mine.hand.length - keepGuards.length - 1;
  let keepSkill = [...others].sort((a, b) => cost(b) - cost(a)).find((c) => cost(c) <= manaAfter);
  // 腕前 A：守りの分のマナも残す（残した守りのカードの必要マナに足りないなら、その技もマナにする）
  if (skill === 'A' && keepSkill && keepGuards.length > 0 && manaAfter < Math.max(...keepGuards.map(cost))) keepSkill = undefined;
  const rest = mine.hand.filter((c) => !keepGuards.includes(c) && c !== keepSkill);
  const guardFirst = cpuRoll(state, side, 'guardFirst', false) < CPU_SKILL[skill].guardFirst;
  const convert = guardFirst ? (rest.find(isGuard) ?? rest[0]) : (rest.find((c) => !isGuard(c)) ?? rest[0]);
  if (convert && canConvertToMana(state, side)) return { type: 'convertToMana', side, cardUid: convert.uid };
  return { type: 'endTurn', side };
}

/**
 * 守備（仮の思考）：1枚ずつ選び、ダメージが0になるか使えるカードがなくなったら守備を終える。
 * 回避は倒されそうなときか大きなダメージのときに使い、そうでなければ防御で減らす。
 */
function chooseDefense(state: BattleState, side: Side, style: AiStyle = 'normal', skill: CpuSkill = 'B'): BattleAction | null {
  const guard = chooseGuard(state, side, style);
  // 腕前 C：守れるのに一部で守らない（その攻撃の最初の守りのときだけ決める。記録に「〇〇は守りそこねた！」）
  if (guard?.type === 'defend' && guard.cardUid !== null && state.pending?.responses.length === 0 && cpuRoll(state, side, 'misguard') < CPU_SKILL[skill].misguard) {
    return { type: 'defend', side, cardUid: null, note: 'misguard' };
  }
  return guard;
}

/** 守るカード（腕前で変わる前の考え方。B・A はこのまま） */
function chooseGuard(state: BattleState, side: Side, style: AiStyle): BattleAction | null {
  const pending = state.pending;
  if (!pending || pending.attacker === side) return null;
  const end: BattleAction = { type: 'defend', side, cardUid: null };
  const damage = incomingDamage(state, pending);
  if (damage === 0) return end;
  const target = state.sides[side].monsters.find((m) => m.uid === pending.targetUid);
  const lethal = target !== undefined && damage >= target.life;
  const options = usableOptions(state, side).filter(isSkillOption);
  // 試遊中：ジオルのかばう（2026-10-29 指示書）。味方が倒れそうでジオルは倒れないとき、またはジオルの防御で大きく減らせるとき
  const coverOpt = options.find((o) => o.def.effect.type === 'cover');
  if (coverOpt && target && shouldCover(state, side, coverOpt, damage, lethal, options)) return { type: 'defend', side, cardUid: coverOpt.card.uid };
  // いつも攻撃（aggressive）は、倒されそうなときだけ守る
  if (style === 'aggressive' && !lethal) return end;
  const evade = options.filter((o) => o.def.effect.type === 'evade').sort((a, b) => a.def.cost - b.def.cost)[0];
  if (evade && (damage >= (style === 'guard' ? 2 : 3) || lethal)) {
    return { type: 'defend', side, cardUid: evade.card.uid };
  }
  const defense = options.filter((o) => o.def.effect.type === 'defense').sort((a, b) => guardReduction(b.def) - guardReduction(a.def))[0];
  if (defense) return { type: 'defend', side, cardUid: defense.card.uid };
  return end;
}

/**
 * かばうを使うか（試遊中：ジオル）。ジオルが受けるダメージ＝攻撃の威力−ジオルのしめったはだ等−ジオルの防御（かばうを払った残りのマナで使える一番強いもの）。
 * - 味方が倒れそうで（その味方に使える回避が無い）、ジオルは倒れない
 * - または、ジオルの防御（いわのうで・すいしょうのたて・うけとめる）でダメージを3以上減らせる
 */
function shouldCover(state: BattleState, side: Side, cover: SkillOption, damage: number, lethal: boolean, options: SkillOption[]): boolean {
  const pending = state.pending;
  const geol = coverUser(state, side, cover.def);
  if (!pending || !geol) return false;
  const mana = manaOf(state.sides[side]) - cover.def.cost;
  const guards = state.sides[side].hand
    .filter((c) => c.uid !== cover.card.uid)
    .map((c) => getPlayCard(c.cardId))
    .filter((k): k is SkillCard => k.kind === 'skill' && k.effect.type === 'defense' && k.monsterId === geol.cardId && k.cost <= mana)
    .filter((k) => {
      const against = guardAgainst(k);
      return against === 'all' || against === pending.stat;
    });
  const bestGuard = Math.max(0, ...guards.map((k) => guardReduction(k)));
  const toGeol = Math.max(0, pending.power - shieldOf(state, geol, pending.stat) - bestGuard);
  const geolSurvives = toGeol < geol.life;
  const allyCanEvade = options.some((o) => o.def.effect.type === 'evade');
  if (lethal && !allyCanEvade && geolSurvives) return true;
  return geolSurvives && damage >= 3 && Math.min(bestGuard, pending.power) >= 3;
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
