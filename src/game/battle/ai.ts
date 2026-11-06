import { getPlayCard, skillsOf } from '../../data/cards.ts';
import { guardAgainst, guardReduction, skillValue, type PlayCard, type SkillCard, type StatType, type SupportCard } from '../cards/cardTypes.ts';
import {
  aliveMonsters,
  attackPower,
  availableUsers,
  badStatusKinds,
  purifyTargets,
  wardCharmActive,
  canConvertToMana,
  chainReady,
  cardUsability,
  cheerTargets,
  coverUser,
  defaultDiscardChoice,
  defaultSystemChange,
  overdriveHandCards,
  overdriveUsability,
  drawToPreview,
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
  findMonster,
  requiemVictims,
  activeField,
  airBonusAgainst,
  habitatOf,
  fieldSupport,
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
import { OVERDRIVE_CHOICE, OVERDRIVE_COMBO_COST, OVERDRIVE_IDS } from '../../data/gearos.ts';

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
 * - 攻撃するか：C は攻撃できる手番の 15% で攻撃を見送る（2026-10-31 指示書 AB から、相手の構えのセリフをふきだしで。src/data/cpuLines.ts）
 * - 技の選び方：C は 30% で強くない技（使える技からばらばら）。A は倒せないとき、次の手番に大技を払えるようマナを残すことがある
 * - 守るか：C は守れるのに 40% で守らない（セリフをふきだしで）。B・A は 3ダメージ以上か倒されそうなとき回避（1〜2 には回避を使わない）・防御
 * - マナ化で残す守りのカード：C 0枚（さらに 30% の手番で、残したい攻撃より先に守りをマナにする）・B 1枚・A 2枚
 *   （A は相手の場のモンスターの技の種類に合う守りを優先し、守りの分のマナも残す）
 * - 「ライフの少ない相手から狙う」はやめた（ユーザー指示 2026-10-30 23:11）
 * - 捨て身の技（シシエン。2026-10-31 指示書 AB）：使うモンスターのライフが反動で倒れるほど少ないときは、相手の最後の1体を倒せるときだけ使う。C は 30% でこの気づかいを忘れる
 * - カラスのめ（デスオル。2026-10-31 指示書 AG）：その手番に相手を倒せる攻撃が無く、相手の手札が3枚以上のときに使う。
 *   捨てさせる1枚は A・B が engine.ts の defaultDiscardChoice（倒せる攻撃 → いちばん強い攻撃 → 条件の無い回避 → 防御）、C はランダム
 * - 構えは腕前より優先（aggressive は A でも守らない・守りを残さない。guard は守りを2枚残す）
 * - リリルのうっとりウインク・うそなき（2026-11-02 指示書 AK2。リリルだけ。ラズックのおびきよせ・カルシェルのすなをほるは前のまま）：chooseLililTrick。
 *   ウインクは、手札にリリルの回避があり次の相手の手番に払えるときだけ使う。相手の攻撃が強い（リリル以外の味方が倒されそう・相手のマナが4以上）ときは攻撃より先に、
 *   そうでなければ攻撃のあとに。ウインクのあとはリリルの回避をマナにしないで残し、ウインクの効いている手番にリリルが狙われたら小さなダメージでも回避する。
 *   うそなきは、リリルのライフが半分以下で、相手の攻撃で倒されそうなとき（その手番に倒せる攻撃が無ければ攻撃より先に）。腕前 C は 30% で使いそこねる
 * - フォルン（2026-11-02 指示書 AL。フォルンだけ）：chooseFornTrick。はげましのふえは今のおいかぜの考え方（次の手番に攻撃できそうな味方）。
 *   そなえのふえは狙われそうな味方（相手がいまのマナで払える攻撃で倒されそうな味方。そなえで助かるなら攻撃より先に）。こもりうたはいちばん強い攻撃を持つ相手へ。
 *   もりのたよりは手札が3枚以下（指示書 AM。前は2枚以下）で山札が10枚以上あるとき（攻撃より先に。捨てる1枚は pickDrawToDiscard＝マナにする順）。みがわりのふえは狙われた味方のライフが半分以下でフォルンが倒れないとき。
 *   腕前 C は forgetTrick の割合で使いそこねる
 * - クヨウ（2026-11-05 指示書 BH。クヨウだけ）：chooseKuyoTrick（攻撃より先）。
 *   おはらいは、この手番に動かしたい味方（まだ動いていない）に悪い状態がついているとき（行動できない → 攻撃できない → 技のダメージ− → おびきよせ の順に見る）。いなければライフの減った味方を回復（半分以下なら攻撃より先、ほかは攻撃のあと。BH の直し）。
 *   腕前 A は、消したあとその味方が払える攻撃を手札に持っているときだけ（技のダメージ−はその種類の攻撃）。B・C は手札に攻撃があれば。
 *   まよけのふだは、相手に状態をつける技（すなかけ・まきつく・ダストキック・ちょうはつ など）を持つ生きたモンスターがいて、まだ効いていないとき（その手番に倒せる攻撃が無いとき）。
 *   腕前 A は、相手がいまのマナで払える状態の技を持っているときだけ。
 *   みがわりは、狙われた味方のライフが低く（倒されそう・半分以下）、クヨウのライフに余裕があるとき（shouldCover。受けるのは威力−2〔BH の直しで守りは重ねられない〕。A は受けたあともライフ2以上・B は1以上残るとき）。
 *   腕前 C は forgetTrick の割合で使いそこねる。まよけのふだの効いている相手には、腕前 A・B は悪い状態をつける特殊の技を使わない
 * - ラディエル（2026-11-05 指示書 BI。ラディエルだけ）：chooseRadielTrick。
 *   攻撃より先：天の恵み（大きな技〔てんりんのさばき・てんのはどう〕が手札にあってマナが足りないとき。A は捨て札が2枚以上あるときだけ）・
 *   最後の審判（自分の手札が使えないカードばかりのとき、または相手の手札が多いとき）。どちらもその手番に倒せる攻撃が無いとき。
 *   攻撃のあと：しんぱんのせんこく（相手のいちばん強そうな攻撃役へ。A は相手が次の手番に払える攻撃でいちばん大きいダメージの相手、B は技の最大ダメージ、C はばらばら）。
 *   腕前 C は forgetTrick の割合で使いそこねる
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
      /** 反動で倒れるのに捨て身の技を使ってしまう割合（2026-10-31 指示書 AB） */
      readonly forgetRecoil: number;
      /** リリルのうっとりウインク・うそなきを使いそこねる割合（2026-11-02 指示書 AK2） */
      readonly forgetTrick: number;
    }
  >
> = {
  C: { missKill: 0.5, hesitate: 0.15, weakSkill: 0.3, misguard: 0.4, guardKeep: 0, guardFirst: 0.3, forgetRecoil: 0.3, forgetTrick: 0.3 },
  B: { missKill: 0.2, hesitate: 0, weakSkill: 0, misguard: 0, guardKeep: 1, guardFirst: 0, forgetRecoil: 0, forgetTrick: 0 },
  A: { missKill: 0, hesitate: 0, weakSkill: 0, misguard: 0, guardKeep: 2, guardFirst: 0, forgetRecoil: 0, forgetTrick: 0 },
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
  // まいあがる風・しずまる大地（2026-11-02 指示書 AQ）：自分の手札・山札に、その居場所の相手に強くなる技があり（使うモンスターが生きている）、
  // その居場所でない相手が1体以上生きているとき
  if (e.type === 'habitat') {
    const strong = e.habitat === 'air' ? isAirStrong : e.habitat === 'ground' ? isGroundStrong : null;
    if (!strong || !ownsSkill(state, side, strong)) return 0;
    return aliveMonsters(state.sides[otherSide(side)]).some((m) => habitatOf(state, m) !== e.habitat) ? 1 : 0;
  }
  if (e.type !== 'field') return 0;
  return e.modifier * (attackersWith(state, side, e.stat) - attackersWith(state, otherSide(side), e.stat));
}

/** 空中の相手に強くなる技（うずまきショット・おおたつまき・あらし。2026-11-02 指示書 AQ） */
const isAirStrong = (k: SkillCard): boolean => k.effect.type === 'attack' && !!(k.effect.airBonus || k.effect.undodgeableVsAir);
/** 地上の相手に強くなる技（地上の相手だけに使える急降下アタック・地ひびき。今の効果で地上の相手に強くなるのはこの2つだけ） */
const isGroundStrong = (k: SkillCard): boolean => k.effect.type === 'attack' && !!k.effect.groundOnly;

/** 自分の手札・山札に、生きているモンスターの、条件に合う技があるか */
function ownsSkill(state: BattleState, side: Side, pred: (k: SkillCard) => boolean): boolean {
  const mine = state.sides[side];
  const alive = new Set(aliveMonsters(mine).map((m) => m.cardId));
  return [...mine.hand.map((c) => c.cardId), ...mine.deck].some((id) => {
    const k = getPlayCard(id);
    return k.kind === 'skill' && alive.has(k.monsterId) && pred(k);
  });
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
  // テオ（指示書 AY）：取っておく α・β・γ は1枚ずつ使わない（3枚コンボは chooseOverdrive が overdriveUsability で別に見る）
  const held = overdriveHold(state, side, style, OVERDRIVE_HOLD_MIN);
  // 取っておいている間は、3枚コンボのマナ5を残す（払うとマナが5より少なくなるカードは使わない。マナ0のカードは使う）
  const reserve = held.size > 0 ? OVERDRIVE_COMBO_COST : 0;
  const allOptions = usableOptions(state, side);
  const kept = allOptions.filter((o) => !held.has(o.card.uid) && (reserve === 0 || o.def.cost === 0 || manaOf(state.sides[side]) - o.def.cost >= reserve));
  // 2026-11-05 指示書 AY2：取っておくと使える技が無くなる手番は、取っておくのをやめてふつうに使う
  const options0 = held.size > 0 && !kept.some(isSkillOption) && allOptions.some(isSkillOption) ? allOptions : kept;
  // まよけのふだ（クヨウ 指示書 BH）の効いている相手には、悪い状態をつけるだけの技は使わない（腕前 C は forgetTrick の割合で気づかない）
  const charmed = wardCharmActive(state, otherSide(side)) && cpuRoll(state, side, 'wardCharmSeen', false) >= CPU_SKILL[skill].forgetTrick;
  const options = charmed ? options0.filter((o) => !['seal', 'taunt', 'weaken', 'pin'].includes(o.def.effect.type)) : options0;
  const mine = state.sides[side];
  const enemies = aliveMonsters(state.sides[otherSide(side)]);

  // 腕前 C：攻撃できる手番の一部で、攻撃を見送る（その手番の最初の1手のときだけ決める。画面が相手のセリフをふきだしで出す）
  const firstMove = aliveMonsters(mine).every((m) => !m.acted) && Object.keys(mine.turnUsage).length === 0;
  const canAttack = options.some((o) => o.def.effect.type === 'attack') && enemies.length > 0;
  if (firstMove && canAttack && cpuRoll(state, side, 'hesitate', false) < CPU_SKILL[skill].hesitate) return { type: 'endAttack', side, note: 'hesitate' };

  // ツムジ（2026-10-30 指示書 U）：Wひっかきを2回続けて使う（2回目が使えるなら必ず続ける）
  const scratch = chooseDoubleScratch(state, side, options, enemies, style, skill);
  if (scratch) return scratch;
  // ギアロス（2026-11-05 指示書 AX）：オーバードライブの3枚コンボは使えるときは使う（腕前 C は forgetTrick の割合で見落とす）
  const overdrive = chooseOverdrive(state, side, skill);
  if (overdrive) return overdrive;
  // テオ（2026-11-05 ユーザー決定）：α・β・γ のどれかを持っていて残りが手札に無ければ、システムチェンジ・システムチェックで探す
  const dig = chooseOverdriveDig(state, side, style, options);
  if (dig) return dig;

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
  const fieldCard = fieldSupport(state);
  const current = fieldCard ? fieldScore(state, side, fieldCard) : 0;
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
  // 2.65 タイラント（2026-11-05 指示書 AX）。竜のまなざし・竜のちから
  const dragon = chooseDragonFocus(state, side, options, enemies, skill);
  if (dragon) return dragon;

  // 2.69 クロシオ（2026-11-06 指示書 BK）：おおうずしお（水中の相手が2体以上）・ひきずりこむ・みちしお・よびごえは、ふつうの攻撃より先
  const kuroshio = chooseKuroshioTrick(state, side, options, style, skill);
  if (kuroshio) return kuroshio;

  // 2.7 カルシェル・セレフィーン（指示書 AJ）。みちしお（このあと水中で強くなる攻撃を使う）・デスオルの死のレクイエム
  const tide = chooseTide(state, side, options);
  if (tide) return tide;
  const requiemPlay = chooseRequiem(state, side, options);
  if (requiemPlay) return requiemPlay;

  // 2.8 ツムジ（2026-10-30 指示書 U）。かぜのり（Wひっかきの2回続けては、いちばん先に考える）
  const windRide = chooseWindRide(state, side, options);
  if (windRide) return windRide;

  // 2.9 デスオル（2026-10-31 指示書 AG）。カラスのめ
  const crow = chooseCrowEye(state, side, options, skill);
  if (crow) return crow;

  // 2.95 リリル（2026-11-02 指示書 AK2）：相手の攻撃が強いときは、攻撃より先にうっとりウインク・うそなき
  const trickFirst = chooseLililTrick(state, side, options, enemies, skill, true);
  if (trickFirst) return trickFirst;
  // 2.96 フォルン（2026-11-02 指示書 AL）：もりのたより・倒されそうな味方へのそなえのふえは、攻撃より先に
  const fornFirst = chooseFornTrick(state, side, options, enemies, style, skill, true);
  if (fornFirst) return fornFirst;

  // 2.965 ラディエル（2026-11-05 指示書 BI）：天の恵み・最後の審判は攻撃より先
  const radielFirst = chooseRadielTrick(state, side, options, skill, true);
  if (radielFirst) return radielFirst;
  // 2.97 クヨウ（2026-11-05 指示書 BH）：おはらい・まよけのふだは攻撃より先
  const kuyo = chooseKuyoTrick(state, side, options, skill);
  if (kuyo) return kuyo;

  // 3. 攻撃：倒せる相手がいれば倒し、いなければ一番強い攻撃を（腕前ごとの狙いの）相手へ
  const attack = chooseAttack(state, side, options, enemies, style, skill);
  if (attack) return attack;

  // 3.35 ラディエル（指示書 BI）：攻撃のあと、しんぱんのせんこく
  const radielAfter = chooseRadielTrick(state, side, options, skill, false);
  if (radielAfter) return radielAfter;
  // 3.4 クヨウ（BH の直し）：攻撃のあと、おはらいでライフの減った味方を回復
  const kuyoAfter = chooseKuyoTrick(state, side, options, skill, false);
  if (kuyoAfter) return kuyoAfter;

  // 3.5 リリル（2026-11-02 指示書 AK2）：攻撃のあと、回避を払えるならうっとりウインク
  const trickAfter = chooseLililTrick(state, side, options, enemies, skill, false);
  if (trickAfter) return trickAfter;
  // 3.6 フォルン（2026-11-02 指示書 AL）：攻撃のあと、こもりうた・そなえのふえ
  const fornAfter = chooseFornTrick(state, side, options, enemies, style, skill, false);
  if (fornAfter) return fornAfter;

  // 3.7 ギアロス（2026-11-05 指示書 AX）：攻撃のあと、使えない手札があればシステムチェンジ
  const sysChange = chooseSystemChange(state, side, options);
  if (sysChange) return sysChange;

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

  // 5.5 ギアロス（2026-11-05 指示書 AX）：システムチェックは、ほかに使うカードが無いときだけ
  const check = options.filter(isSkillOption).find((o) => o.def.effect.type === 'systemCheck');
  if (check) return { type: 'useCard', side, cardUid: check.card.uid };

  // 6. 使えるカードがなければ攻撃を終えてマナ化へ
  return { type: 'endAttack', side };
}

/**
 * テオ（構え 'overdrive'。2026-11-05 指示書 AY）が取っておく手札の α・β・γ（uid）。それ以外の構えは空。
 * α・β・γ のうち min 種類以上（技として使わないのは2種類から。マナにしないのは1枚から）が手札にあり、取っておいても危なくない（自分の生きているモンスターのどれも、相手がいまのマナで払える
 * いちばん大きい攻撃〔affordableThreat〕で倒れない）ときだけ、その種類の1枚ずつを取っておく。危ないときは空（ふつうに使う・マナにする）
 */
/** テオが α・β・γ を技として使わずに取っておく、手札の種類の数（指示書 AY の「2枚」。1にするとコンボの対戦が少し増える：docs/ay-card-names-teo-20261105.md） */
export const OVERDRIVE_HOLD_MIN = 2;
/** マナにしないで取っておく α・β・γ の種類の数・危ないときも取っておくか（2026-11-05 指示書 AY2 で見直し） */
export const OVERDRIVE_MANA_HOLD_MIN = 2;
export const OVERDRIVE_MANA_HOLD_IN_DANGER = false;

export function overdriveHold(state: BattleState, side: Side, style: AiStyle, min = 2, ignoreDanger = false): Set<string> {
  if (style !== 'overdrive') return new Set();
  const hand = state.sides[side].hand;
  const cards = OVERDRIVE_IDS.map((id) => hand.find((c) => c.cardId === id)).filter((c): c is HandCard => !!c);
  // システムチェックで、手札に無い α・β・γ が山札の上にあると分かっていれば（2026-11-05 ユーザー決定）、1種類でも取っておく
  if (cards.length < min && !(cards.length >= 1 && peekShowsMissing(state, side))) return new Set();
  if (!aliveMonsters(state.sides[side]).some((m) => OVERDRIVE_IDS.some((id) => skillsOf(m.cardId).some((k) => k.id === id)))) return new Set();
  const threat = affordableThreat(state, side);
  if (!ignoreDanger && aliveMonsters(state.sides[side]).some((m) => m.life <= threat)) return new Set();
  return new Set(cards.map((c) => c.uid));
}

/** 手札に無い α・β・γ（ID） */
function missingOverdrive(state: BattleState, side: Side): string[] {
  const hand = state.sides[side].hand;
  return OVERDRIVE_IDS.filter((id) => !hand.some((c) => c.cardId === id));
}

/** 前に見たシステムチェックの山札の上がまだそのままで、その中に手札に無い α・β・γ があるか */
function peekShowsMissing(state: BattleState, side: Side): boolean {
  const peek = state.deckPeek;
  if (!peek || peek.viewer !== side || peek.cardIds.length === 0) return false;
  const top = state.sides[side].deck.slice(0, peek.cardIds.length);
  if (top.length !== peek.cardIds.length || top.some((id, i) => id !== peek.cardIds[i])) return false;
  const missing = missingOverdrive(state, side);
  return peek.cardIds.some((id) => missing.includes(id));
}

/**
 * テオ（構え overdrive。2026-11-05 ユーザー決定）：α・β・γ のどれかを手札に持っていて、残りが手札に無いとき、探すために
 * システムチェンジ（α・β・γ でない札を山札に戻して1枚引く）・システムチェック（山札の上を見る）を使う。
 * システムチェックで上にあると分かっているあいだは使わない（overdriveHold が取っておく）。チェンジを先に考える（1枚引けるため）
 */
function chooseOverdriveDig(state: BattleState, side: Side, style: AiStyle, options: Option[]): BattleAction | null {
  if (style !== 'overdrive') return null;
  const hand = state.sides[side].hand;
  const have = OVERDRIVE_IDS.filter((id) => hand.some((c) => c.cardId === id));
  if (have.length === 0 || have.length === OVERDRIVE_IDS.length) return null;
  if (peekShowsMissing(state, side)) return null;
  const skills = options.filter(isSkillOption);
  const change = skills.find((o) => o.def.effect.type === 'systemChange');
  if (change) {
    const cost = (c: HandCard): number => getPlayCard(c.cardId).cost;
    const out = hand
      .filter((c) => c.uid !== change.card.uid && !OVERDRIVE_IDS.includes(c.cardId) && !isGuard(c))
      .sort((a, b) => cost(b) - cost(a))[0];
    if (out) return { type: 'useCard', side, cardUid: change.card.uid, choice: out.uid };
  }
  const check = skills.find((o) => o.def.effect.type === 'systemCheck');
  if (check && state.sides[side].deck.length > 0) return { type: 'useCard', side, cardUid: check.card.uid };
  return null;
}

/** オーバードライブの3枚コンボ（ギアロス 指示書 AX）：使えるときは使う。腕前 C は forgetTrick の割合で見落とす */
function chooseOverdrive(state: BattleState, side: Side, skill: CpuSkill): BattleAction | null {
  if (!overdriveUsability(state, side).usable) return null;
  if (cpuRoll(state, side, 'overdrive-forget') < CPU_SKILL[skill].forgetTrick) return null;
  const first = overdriveHandCards(state, side)[0];
  return first ? { type: 'useCard', side, cardUid: first.uid, choice: OVERDRIVE_CHOICE } : null;
}

/**
 * システムチェンジ（ギアロス 指示書 AX）：手札に「いま使えない札」（守りの札を除く。このあとのマナで払えない・届く相手がいない）があり、
 * 山札に余裕（10枚以上）があるときに使う。戻す札は engine の defaultSystemChange（使えない札のうち必要マナのいちばん多いもの）
 */
function chooseSystemChange(state: BattleState, side: Side, options: Option[]): BattleAction | null {
  const change = options.filter(isSkillOption).find((o) => o.def.effect.type === 'systemChange');
  if (!change) return null;
  const mine = state.sides[side];
  if (mine.deck.length < 10) return null;
  const manaAfter = manaOf(mine) - change.def.cost;
  const stuck = mine.hand.some((c) => {
    if (c.uid === change.card.uid) return false;
    const k = getPlayCard(c.cardId);
    if (k.kind === 'skill' && (k.effect.type === 'defense' || k.effect.type === 'evade' || k.effect.type === 'cover')) return false;
    return k.cost > manaAfter || !cardUsability(state, side, c.uid).usable;
  });
  if (!stuck) return null;
  const out = defaultSystemChange({ ...state, sides: { ...state.sides, [side]: { ...mine, hand: mine.hand.filter((c) => c.uid !== change.card.uid) } } }, side);
  return out ? { type: 'useCard', side, cardUid: change.card.uid, choice: out.uid } : null;
}

/** カラスのめを使う、相手の手札の枚数の下限（2026-10-31 指示書 AG） */
const CROW_EYE_MIN_HAND = 3;

/**
 * カラスのめ（デスオル 2026-10-31 指示書 AG）：その手番に相手を倒せる攻撃が無く、相手の手札が3枚以上のときに使う。
 * 同じ手番に2回は使わない（デスオルは1手番に1回しか動けないので、もともと1回）。捨てさせる1枚は pickDiscardChoice
 */
function chooseCrowEye(state: BattleState, side: Side, options: Option[], skill: CpuSkill): BattleAction | null {
  const crow = options.filter(isSkillOption).find((o) => o.def.effect.type === 'discardChoice');
  if (!crow) return null;
  if (state.sides[otherSide(side)].hand.length < CROW_EYE_MIN_HAND) return null;
  if (canKillThisTurn(state, side, options)) return null;
  const choice = pickDiscardChoice(state, side, skill);
  return choice ? { type: 'useCard', side, cardUid: crow.card.uid, choice } : null;
}

/** カラスのめで捨てさせる相手の手札の uid（腕前 A・B は engine.ts の defaultDiscardChoice、C はランダムに1枚） */
export function pickDiscardChoice(state: BattleState, side: Side, skill: CpuSkill = 'B'): string | null {
  const hand = state.sides[otherSide(side)].hand;
  if (hand.length === 0) return null;
  if (skill === 'C') return hand[Math.floor(cpuRoll(state, side, 'crowEye') * hand.length)]?.uid ?? null;
  return defaultDiscardChoice(state, side)?.uid ?? null;
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
  // しずめの祈り（2026-11-02 指示書 AQ）：場のカードが相手に有利なとき（相手が出した場、または自分に損になる場のカード）
  const calm = supportOf(options, 'clearField');
  const field = activeField(state);
  if (calm && field) {
    const support = fieldSupport(state);
    if (field.owner !== side || (support && fieldScore(state, side, support) < 0)) return { type: 'useCard', side, cardUid: calm.card.uid };
  }
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

/** 場が水中で強くなる攻撃か（場が水中なら2倍・水中の相手に防御／回避されない・水中の相手全員に〔クロシオのおおうずしお 指示書 BK〕） */
const isWaterAttack = (k: SkillCard): boolean => k.effect.type === 'attack' && !!(k.effect.doubleInWater || k.effect.unblockableVsWater || k.effect.undodgeableVsWater || k.effect.waterOnly);
/** 相手が水中なら強くなる攻撃か（場でなく相手の居場所で決まる：しおふきキャノン・オーシャンウェーブ・ルナタイド・おおうずしお。ひきずりこむで水中にすれば効く） */
const isVsWaterAttack = (k: SkillCard): boolean => k.effect.type === 'attack' && !!(k.effect.unblockableVsWater || k.effect.undodgeableVsWater || k.effect.waterOnly);

/**
 * みちしお（指示書 AJ の追加その3：カルシェル・セレフィーン。使った側の次の自分の手番の終わりまで水中）。手札に水中で強くなる攻撃があり、
 * この手番に別の味方がすぐ使える（マナが足りる）か、次の自分の手番に使えそう（そのモンスターが生きていて、次の手番のマナで払えそう）なときに使う。
 * もう水中で次の自分の手番まで続くとき・自分に得なサポートの場を上書きしてしまうときは使わない
 */
function chooseTide(state: BattleState, side: Side, options: Option[]): BattleAction | null {
  // クロシオのみちしおは chooseKuroshioTrick だけで考える（2026-11-06 指示書 BK）
  const tide = options.filter(isSkillOption).find((o) => o.def.effect.type === 'tide' && !KUROSHIO_MONSTERS.includes(o.def.monsterId));
  if (!tide) return null;
  const field = activeField(state);
  if (field?.habitat === 'water' && (field.untilTurn ?? Infinity) >= state.turn + 2) return null;
  const support = fieldSupport(state);
  if (support && field?.owner === side && fieldScore(state, side, support) > 0) return null;
  const mine = state.sides[side];
  const mana = manaOf(mine);
  const caster = availableUsers(state, side, tide.def)[0];
  if (!caster) return null;
  // 次の自分の手番のマナ：いまのマナ − みちしお ＋ この手番の終わりにマナにできる手札（みちしお・水の攻撃のほかに1枚は残す）
  const nextMana = mana - tide.def.cost + Math.max(0, mine.hand.length - 3);
  const alive = new Set(aliveMonsters(mine).map((m) => m.cardId));
  for (const c of mine.hand) {
    if (c.uid === tide.card.uid) continue;
    const k = getPlayCard(c.cardId);
    if (k.kind !== 'skill' || !isWaterAttack(k) || !alive.has(k.monsterId)) continue;
    const now = tide.def.cost + k.cost <= mana && availableUsers(state, side, k).some((u) => u.uid !== caster.uid);
    if (now || k.cost <= nextMana) return { type: 'useCard', side, cardUid: tide.card.uid, userUid: caster.uid };
  }
  return null;
}

/**
 * 死のレクイエム（指示書 AJ：デスオル）：倒れる相手（ライフ1以下）が1体以上いて、倒れる味方より多いとき。
 * 倒れる相手が1体だけなら、その手番に攻撃で倒せないときだけ
 */
function chooseRequiem(state: BattleState, side: Side, options: Option[]): BattleAction | null {
  const req = options.filter(isSkillOption).find((o) => o.def.effect.type === 'requiem');
  if (!req) return null;
  const user = availableUsers(state, side, req.def)[0];
  if (!user) return null;
  const victims = requiemVictims(state, user.uid);
  const foes = victims.filter((m) => findMonster(state, m.uid)?.side !== side).length;
  const friends = victims.length - foes;
  if (foes === 0 || foes <= friends) return null;
  if (foes === 1 && canKillThisTurn(state, side, options)) return null;
  return { type: 'useCard', side, cardUid: req.card.uid, userUid: user.uid };
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
  // 捨て身の技（シシエン）：反動で倒れるなら、相手の最後の1体を倒せるときだけ（腕前 C は一部の手番で忘れる）
  const forgetRecoil = cpuRoll(state, side, 'recoil') < CPU_SKILL[skill].forgetRecoil;
  const attacks = options
    .filter(isSkillOption)
    .filter((o) => o.def.effect.type === 'attack')
    .filter((o) => forgetRecoil || recoilSafe(state, side, o, enemies));
  if (attacks.length === 0 || enemies.length === 0) return null;
  const drained = chooseDrain(state, side, attacks, style, skill);
  if (drained) return drained;
  // うずまきショット（2026-11-02 指示書 AQ）：相手しだいでダメージが変わるので、相手ごとの威力（powerOn）で倒せるかを見る。技の強さは当てられる相手のうちいちばん大きい値
  const powerOn = (o: SkillOption, e: BattleMonster): number => attackPower(state, o.def, availableUsers(state, side, o.def)[0], e);
  const power = (o: SkillOption): number => Math.max(attackPower(state, o.def, availableUsers(state, side, o.def)[0]), ...targetsFor(state, side, o.def).map((e) => powerOn(o, e)));
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
        .flatMap((o) => reachable(o).filter((e) => e.life <= powerOn(o, e)).map((e) => ({ o, e, over: powerOn(o, e) - e.life })))
        .sort((a, b) => a.over - b.over || a.o.def.cost - b.o.def.cost || dangerOf(state, b.e) - dangerOf(state, a.e));
      const best = kills[0];
      if (best) return attackAction(state, side, best.o, best.e.uid);
    } else {
      for (const option of byPower) {
        const killable = reachable(option).filter((e) => e.life <= powerOn(option, e));
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
  // おおたつまき（相手全員に1・空中の相手には2。2026-11-02 指示書 AS）：相手に与えるダメージの合計が3以上のとき（1体でも倒せるときは上の倒す所で使う）
  const isTornado = (o: SkillOption): boolean => o.def.effect.type === 'attack' && !!o.def.effect.allTargets && !!o.def.effect.airBonus;
  const tornado = byPower.find(isTornado);
  if (tornado && reachable(tornado).reduce((sum, e) => sum + powerOn(tornado, e), 0) >= TORNADO_TOTAL) return attackAction(state, side, tornado, reachable(tornado)[0]?.uid ?? '');
  // 試遊中：ジオルの地ひびき（相手全体）。倒せる相手がいなければ、相手が2体以上生きているときに使う（2026-10-29 指示書）
  const quake = byPower.find((o) => o.def.effect.type === 'attack' && o.def.effect.allTargets && !isTornado(o));
  if (quake && reachable(quake).length >= 2) return attackAction(state, side, quake, reachable(quake)[0]?.uid ?? '');
  // 相手全体への攻撃は、相手が1体のときはふつうの攻撃と同じに考える。おおたつまきは上の2つ（倒せる・合計3以上）のときだけ
  const candidates = byPower.filter((o) => !(o.def.effect.type === 'attack' && o.def.effect.allTargets && (reachable(o).length >= 2 || isTornado(o))));
  // 腕前 C：一部の手番で、強くない技（使える技からばらばら）を選ぶ
  const weak = cpuRoll(state, side, 'weak') < CPU_SKILL[skill].weakSkill;
  const strongest = weak ? candidates[Math.min(candidates.length - 1, Math.floor(cpuRoll(state, side, 'weakPick') * candidates.length))] : candidates[0];
  if (!strongest) return null;
  // 腕前 A：倒せないときは、次の手番に大技を払えるようマナを残すことがある
  if (skill === 'A' && style !== 'aggressive' && saveManaForBig(state, side, strongest, power(strongest))) return null;
  // うずまきショット（2026-11-02 指示書 AQ）：空中の相手がいればそちらをねらう
  const reach = reachable(strongest);
  const air = reach.filter((e) => airBonusAgainst(state, strongest.def, e) > 0);
  const target = pickTarget(state, side, air.length > 0 ? air : reach, style, skill, 'attack');
  return target ? attackAction(state, side, strongest, target.uid) : null;
}

/**
 * 捨て身の技（selfDamageOnHit。シシエン 2026-10-31 指示書 AB）を使ってよいか：反動で使ったモンスターが倒れないか、
 * 倒れても相手の最後の1体を倒せる（勝負がつくので反動は無い）とき。捨て身でない技はいつもよい
 */
function recoilSafe(state: BattleState, side: Side, o: SkillOption, enemies: readonly BattleMonster[]): boolean {
  const e = o.def.effect;
  if (e.type !== 'attack' || !e.selfDamageOnHit) return true;
  const user = availableUsers(state, side, o.def)[0];
  if (!user || user.life > e.selfDamageOnHit) return true;
  const last = enemies.length === 1 ? enemies[0] : undefined;
  return !!last && targetsFor(state, side, o.def, user).some((m) => m.uid === last.uid) && last.life <= attackPower(state, o.def, user);
}

/** おおたつまきを使う、相手に与えるダメージの合計（2026-11-02 指示書 AS） */
const TORNADO_TOTAL = 3;

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

/** 竜のまなざし・竜のちからを考える「大きな攻撃」のダメージ（指示書 AX：5以上） */
const DRAGON_BIG_POWER = 5;

/**
 * 相手が回避（kind＝'evade'）・防御（'defense'）のカードを持っていそうか（指示書 AX。CPU は相手の手札を見ない。腕前で見積もりの細かさを変える）。
 * - A：相手の生きているモンスターにその種類の技があり、相手の手札が2枚以上で、相手のマナでいちばん安いその種類の技を払える
 * - B：相手の生きているモンスターにその種類の技がある（手札・マナは見ない）
 * - C：B と同じ見方を、半分の割合で見落とす
 */
function guardLikely(state: BattleState, side: Side, kind: 'evade' | 'defense', skill: CpuSkill): boolean {
  const foe = state.sides[otherSide(side)];
  const guards = aliveMonsters(foe).flatMap((m) => skillsOf(m.cardId).filter((k) => k.effect.type === kind));
  if (guards.length === 0) return false;
  if (skill === 'C') return cpuRoll(state, side, `dragon-${kind}`) >= 0.5;
  if (skill === 'B') return true;
  return foe.hand.length >= 2 && manaOf(foe) >= Math.min(...guards.map((k) => k.cost));
}

/**
 * タイラント（2026-11-05 指示書 AX）：竜のまなざし（次のターン最初の攻撃は回避されない）・竜のちから（防御されない）。
 * そのモンスターがこの手番に相手を倒せず、次の手番に大きな攻撃（ダメージ5以上）を払えそうで、相手が回避（防御）のカードを持っていそうなとき。
 * 両方使えるときは回避の方を先に見る（回避されると0になるため）。もうかかっていれば使わない。腕前 C は forgetTrick の割合で使いそこねる
 */
function chooseDragonFocus(state: BattleState, side: Side, options: Option[], enemies: BattleMonster[], skill: CpuSkill): BattleAction | null {
  const skills = options.filter(isSkillOption);
  const focus = skills.filter((o) => o.def.effect.type === 'dragonGaze' || o.def.effect.type === 'dragonMight');
  if (focus.length === 0 || enemies.length === 0) return null;
  if (cpuRoll(state, side, 'dragon-forget') < CPU_SKILL[skill].forgetTrick) return null;
  const mine = state.sides[side];
  const attacks = skills.filter((o) => o.def.effect.type === 'attack');
  const nextTurn = state.turn + 2;
  for (const kind of ['evade', 'defense'] as const) {
    const type = kind === 'evade' ? 'dragonGaze' : 'dragonMight';
    const o = focus.find((f) => f.def.effect.type === type);
    if (!o) continue;
    const user = availableUsers(state, side, o.def).find((m) => {
      const already = kind === 'evade' ? m.dragonGaze?.turn === nextTurn : m.dragonMight?.turn === nextTurn;
      const canKill = attacks.some((a) => availableUsers(state, side, a.def).some((u) => u.uid === m.uid) && targetsFor(state, side, a.def, m).some((e) => e.life <= attackPower(state, a.def, m)));
      return !already && !canKill;
    });
    if (!user) continue;
    // 次の手番に払えるマナの見積もり（エネルギーをためると同じ：いまのマナ − このカード ＋ 手札からマナにできそうな枚数）
    const manaNext = manaOf(mine) - o.def.cost + Math.max(0, mine.hand.length - 2);
    const bigNext = mine.hand.some((c) => {
      if (c.uid === o.card.uid) return false;
      const card = getPlayCard(c.cardId);
      return card.kind === 'skill' && card.effect.type === 'attack' && card.monsterId === user.cardId && skillValue(card) >= DRAGON_BIG_POWER && card.cost <= manaNext;
    });
    if (bigNext && guardLikely(state, side, kind, skill)) return { type: 'useCard', side, cardUid: o.card.uid, userUid: user.uid };
  }
  return null;
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

/** うっとりウインク・うそなきを指示書 AK2 の考え方で使うモンスター（2026-11-02。ほかのモンスターのおびきよせ・すなをほるは前の考え方のまま） */
const WINK_MONSTERS: readonly string[] = ['mon-lilil'];

/** その手札のカードが、モンスター monsterId の回避か */
const isEvadeOf = (c: HandCard, monsterId: string): boolean => {
  const card = getPlayCard(c.cardId);
  return card.kind === 'skill' && card.effect.type === 'evade' && card.monsterId === monsterId;
};

/** 次の相手の手番に、相手のだれかが「自分のこのモンスターしか攻撃できない」（うっとりウインクが効く）モンスターの種類 */
function winkedNextTurn(state: BattleState, side: Side): string[] {
  return aliveMonsters(state.sides[otherSide(side)])
    .map((m) => m.taunt)
    .filter((t): t is { monsterId: string; turn: number } => !!t && t.turn === state.turn + 1 && WINK_MONSTERS.includes(t.monsterId))
    .map((t) => t.monsterId);
}

/**
 * リリルのうっとりウインク・うそなき（2026-11-02 指示書 AK2）。first が true のときは「相手の攻撃が強い」ときだけ（攻撃より先）、false は攻撃のあと。
 * - うそなき：リリルのライフが半分以下で、相手のいちばん強い攻撃で倒されるほどのとき（first はその手番に倒せる攻撃が無いときだけ）
 * - うっとりウインク：手札にリリルの回避があり、次の相手の手番に払える（ウインクを払った残り＋この手番にマナにできる手札で足りる）とき。
 *   相手の攻撃が強い＝リリル以外の味方が相手のいちばん強い攻撃（いまの相手のマナで払えるもの）で倒されそう、または相手のマナが4以上。狙いはいちばん攻撃の強い相手
 * - 腕前 C は forgetTrick の割合で使いそこねる
 */
function chooseLililTrick(state: BattleState, side: Side, options: Option[], enemies: BattleMonster[], skill: CpuSkill, first: boolean): BattleAction | null {
  const tricks = options.filter(isSkillOption).filter((o) => WINK_MONSTERS.includes(o.def.monsterId) && (o.def.effect.type === 'taunt' || o.def.effect.type === 'hide'));
  if (tricks.length === 0 || enemies.length === 0) return null;
  if (cpuRoll(state, side, 'lililTrick', false) < CPU_SKILL[skill].forgetTrick) return null;
  const mine = state.sides[side];
  const mana = manaOf(mine);
  // 相手のいちばん強い攻撃（次の相手の手番に、いまの相手のマナで払える攻撃技の中で）
  const foeMana = manaOf(state.sides[otherSide(side)]);
  const strongest = Math.max(
    0,
    ...enemies.flatMap((e) =>
      skillsOf(e.cardId)
        .filter((k) => k.effect.type === 'attack' && k.stat !== null && k.cost <= foeMana)
        .map((k) => skillValue(k) + (k.stat ? fieldModifier(state, k.stat.type) : 0)),
    ),
  );
  // うそなき
  const hide = tricks.find((o) => o.def.effect.type === 'hide');
  if (hide && (!first || !canKillThisTurn(state, side, options))) {
    const user = availableUsers(state, side, hide.def).find((m) => m.life <= m.maxLife / 2 && m.life <= strongest && m.hiddenTurn !== state.turn + 1);
    if (user) return { type: 'useCard', side, cardUid: hide.card.uid, userUid: user.uid };
  }
  // うっとりウインク
  const wink = tricks.find((o) => o.def.effect.type === 'taunt');
  if (!wink) return null;
  const user = availableUsers(state, side, wink.def)[0];
  if (!user) return null;
  const others = aliveMonsters(mine).filter((m) => m.uid !== user.uid);
  if (others.length === 0) return null;
  const evades = mine.hand.filter((c) => c.uid !== wink.card.uid && isEvadeOf(c, user.cardId));
  if (evades.length === 0) return null;
  const manaNext = mana - wink.def.cost + Math.max(0, mine.hand.length - 2);
  if (!evades.some((c) => skillCost(state, getPlayCard(c.cardId) as SkillCard) <= manaNext)) return null;
  const danger = foeMana >= 4 || others.some((m) => strongest >= m.life);
  if (first && !danger) return null;
  const target = targetsFor(state, side, wink.def, user)
    .filter((e) => e.taunt?.turn !== state.turn + 1)
    .sort((a, b) => threatOf(state, b) - threatOf(state, a) || b.life - a.life)[0];
  return target ? { type: 'useCard', side, cardUid: wink.card.uid, userUid: user.uid, targetUid: target.uid } : null;
}

/** 指示書 AL の考え方で、そなえのふえ・こもりうた・もりのたより・みがわりのふえを使うモンスター（2026-11-02。ほかのモンスターのすなかけ・かばうは前の考え方のまま） */
const FORN_MONSTERS: readonly string[] = ['mon-forn'];
/** もりのたよりを使う手札・山札の枚数（指示書 AL：手札が2枚以下・山札が10枚以上。2026-11-02 指示書 AM で手札3枚以下に広げた） */
const DRAW_TO_MAX_HAND = 3;
const DRAW_TO_MIN_DECK = 10;

/** 相手が、いまの相手のマナで払える攻撃技の中でいちばん大きいダメージ（場の増減を入れる） */
function affordableThreat(state: BattleState, side: Side): number {
  const foe = otherSide(side);
  const foeMana = manaOf(state.sides[foe]);
  return Math.max(
    0,
    ...aliveMonsters(state.sides[foe]).flatMap((e) =>
      skillsOf(e.cardId)
        .filter((k) => k.effect.type === 'attack' && k.stat !== null && k.cost <= foeMana)
        .map((k) => skillValue(k) + (k.stat ? fieldModifier(state, k.stat.type) : 0)),
    ),
  );
}

/**
 * フォルン（2026-11-02 指示書 AL）。first が true のときは攻撃より先（もりのたより・そなえで助かる味方へのそなえのふえ）、false は攻撃のあと（こもりうた・そなえのふえ）。
 * はげましのふえは今のおいかぜの考え方（chooseChargeOrTailwind）。腕前 C は forgetTrick の割合で使いそこねる
 */
function chooseFornTrick(state: BattleState, side: Side, options: Option[], enemies: BattleMonster[], style: AiStyle, skill: CpuSkill, first: boolean): BattleAction | null {
  const mine = options.filter(isSkillOption).filter((o) => FORN_MONSTERS.includes(o.def.monsterId));
  if (mine.length === 0 || enemies.length === 0) return null;
  if (cpuRoll(state, side, 'fornTrick', false) < CPU_SKILL[skill].forgetTrick) return null;
  const me = state.sides[side];
  // もりのたより：手札が3枚以下（指示書 AM）で、山札が10枚以上
  const tidings = mine.find((o) => o.def.effect.type === 'drawTo');
  if (first && tidings && me.hand.length <= DRAW_TO_MAX_HAND && me.deck.length >= DRAW_TO_MIN_DECK) {
    const choice = pickDrawToDiscard(state, side, tidings.card.uid, style, skill);
    return { type: 'useCard', side, cardUid: tidings.card.uid, ...(choice ? { choice } : {}) };
  }
  const threat = affordableThreat(state, side);
  // そなえのふえ：狙われそうな味方（相手の攻撃で倒されそうな味方。first はそなえの −1 で助かるときだけ）。いなければ、攻撃のあとに残りライフのいちばん少ない味方
  const ward = mine.find((o) => o.def.effect.type === 'ward');
  if (ward && ward.def.effect.type === 'ward') {
    const reduce = ward.def.effect.reduce;
    const user = availableUsers(state, side, ward.def)[0];
    const allies = user ? tailwindTargets(state, side, ward.def).filter((m) => m.ward?.untilTurn !== state.turn + 1) : [];
    const atRisk = allies.filter((m) => threat >= m.life).sort((a, b) => a.life - b.life);
    const saved = atRisk.find((m) => threat - reduce < m.life);
    const pick = first ? saved : (saved ?? atRisk[0] ?? (threat > 0 ? [...allies].sort((a, b) => a.life - b.life)[0] : undefined));
    if (user && pick && (!first || !canKillThisTurn(state, side, options))) return { type: 'useCard', side, cardUid: ward.card.uid, userUid: user.uid, targetUid: pick.uid };
  }
  if (first) return null;
  // こもりうた：いちばん強い攻撃を持つ相手（まだ封じられていない）へ
  const lull = mine.find((o) => o.def.effect.type === 'seal');
  if (lull) {
    const target = targetsFor(state, side, lull.def)
      .filter((e) => e.sealedTurn !== state.turn + 1)
      .sort((a, b) => threatOf(state, b) - threatOf(state, a) || b.life - a.life)[0];
    if (target) return attackAction(state, side, lull, target.uid);
  }
  return null;
}

/**
 * もりのたより（フォルン 2026-11-02 指示書 AL）で捨てる1枚：引いたあとの手札で、マナ化のときにいちばん先にマナにする札（chooseManaAction と同じ考え方）。
 * 払ったあとのマナ・引いたあとの手札で考える
 */
export function pickDrawToDiscard(state: BattleState, side: Side, cardUid: string, style: AiStyle = 'normal', skill: CpuSkill = 'B'): string | null {
  const card = state.sides[side].hand.find((c) => c.uid === cardUid);
  if (!card) return null;
  const s = state.sides[side];
  const hand = drawToPreview(state, side, cardUid);
  const drawn = hand.length - (s.hand.length - 1);
  const cost = getPlayCard(card.cardId).cost;
  const after: BattleState = {
    ...state,
    phase: 'mana',
    sides: { ...state.sides, [side]: { ...s, hand, deck: s.deck.slice(drawn), manaPile: s.manaPile.slice(cost) } },
  };
  return manaPick(after, side, style, skill)?.uid ?? hand[hand.length - 1]?.uid ?? null;
}

/** 指示書 BH の考え方で、おはらい・まよけのふだ・みがわりを使うモンスター */
const KUYO_MONSTERS: readonly string[] = ['mon-kuyo'];

/** 相手に悪い状態をつける技か（すなかけ・ちょうはつ・ダストキック などの特殊、まきつく・こおりのいき などの「行動できない」攻撃） */
const isStatusSkill = (k: SkillCard): boolean => ['seal', 'taunt', 'weaken', 'pin'].includes(k.effect.type) || (k.effect.type === 'attack' && !!k.effect.stunTarget);

/**
 * クヨウ（2026-11-05 指示書 BH）。first（攻撃より先）：おはらい（悪い状態の味方 → いなければライフが半分以下の味方）→ まよけのふだ。
 * first でない（攻撃のあと）：おはらいでライフの減った味方を回復（BH の直し・ユーザー決定「悪い状態の味方がいれば先に、いなければライフの減った味方」）。
 * 腕前 C は forgetTrick の割合で使いそこねる
 */
function chooseKuyoTrick(state: BattleState, side: Side, options: Option[], skill: CpuSkill, first = true): BattleAction | null {
  const mine = options.filter(isSkillOption).filter((o) => KUYO_MONSTERS.includes(o.def.monsterId));
  if (mine.length === 0) return null;
  if (cpuRoll(state, side, 'kuyoTrick', false) < CPU_SKILL[skill].forgetTrick) return null;
  const me = state.sides[side];
  const mana = manaOf(me);
  const purify = mine.find((o) => o.def.effect.type === 'purify');
  if (purify) {
    const left = mana - purify.def.cost;
    const handAttacks = (m: BattleMonster): SkillCard[] =>
      me.hand
        .filter((c) => c.uid !== purify.card.uid)
        .map((c) => getPlayCard(c.cardId))
        .filter((k): k is SkillCard => k.kind === 'skill' && k.monsterId === m.cardId && k.effect.type === 'attack' && (skill !== 'A' || k.cost <= left));
    const ORDER = ['stunned', 'sealed', 'weaken', 'taunt'] as const;
    const wants = (m: BattleMonster): number => {
      if (m.acted) return -1;
      const kinds = badStatusKinds(state, m);
      const attacks = handAttacks(m);
      if (attacks.length === 0) return -1;
      for (const [i, kind] of ORDER.entries()) {
        if (!kinds.includes(kind)) continue;
        // 腕前 A：技のダメージ−は、その種類の攻撃を持っているときだけ
        if (kind === 'weaken' && skill === 'A') {
          const stats = [m.weaken?.stat, m.weakenTurn?.stat].filter((x): x is StatType => !!x);
          if (!attacks.some((k) => k.stat && stats.includes(k.stat.type))) continue;
        }
        return ORDER.length - i;
      }
      return -1;
    };
    const pick = purifyTargets(state, side)
      .map((m) => ({ m, w: wants(m) }))
      .filter((x) => x.w > 0)
      .sort((a, b) => b.w - a.w)[0];
    const user = availableUsers(state, side, purify.def)[0];
    // クヨウ自身を消すときは、おはらいでクヨウの手番を使うので、消したあと動けない（自分のためには使わない）
    if (first && pick && user && pick.m.uid !== user.uid) return { type: 'useCard', side, cardUid: purify.card.uid, userUid: user.uid, targetUid: pick.m.uid };
    // 悪い状態の味方がいなければ、ライフの減った味方（いちばん減っている割合の多い味方。クヨウ自身も）を回復。
    // 攻撃より先は、ライフが半分以下でその手番に倒せる攻撃が無いときだけ
    const hurt = aliveMonsters(me)
      .filter((m) => m.life < m.maxLife && (!first || (m.life <= m.maxLife / 2 && !canKillThisTurn(state, side, options))))
      .sort((a, b) => a.life / a.maxLife - b.life / b.maxLife || a.life - b.life)[0];
    if (!pick && hurt && user) return { type: 'useCard', side, cardUid: purify.card.uid, userUid: user.uid, targetUid: hurt.uid };
  }
  if (!first) return null;
  const charm = mine.find((o) => o.def.effect.type === 'wardCharm');
  if (charm && !(me.wardCharm && me.wardCharm.untilTurn >= state.turn + 1) && !canKillThisTurn(state, side, options)) {
    const foe = state.sides[otherSide(side)];
    const foeMana = manaOf(foe);
    const threat = aliveMonsters(foe).some((e) => skillsOf(e.cardId).some((k) => isStatusSkill(k) && (skill !== 'A' || k.cost <= foeMana + 1)));
    if (threat) return { type: 'useCard', side, cardUid: charm.card.uid };
  }
  return null;
}

/** 指示書 BK の考え方で、ひきずりこむ・おおうずしお・みちしお・よびごえを使うモンスター */
const KUROSHIO_MONSTERS: readonly string[] = ['mon-kuroshio'];
/** よびごえ：クロシオ以外の味方のライフがこれ以下なら「少ない」 */
const KUROSHIO_CALL_LOW_LIFE = 2;

/**
 * クロシオ（2026-11-06 指示書 BK）。その手番に倒せる相手がいるときはふつうの攻撃に任せる。それ以外は次の順：
 * 1. おおうずしお：いま水中の相手が2体以上
 * 2. みちしお（手札におおうずしおがあり、相手が2体以上いて、水中の相手がいないとき）
 * 3. ひきずりこむ：手札に「相手が水中なら強い攻撃」（しおふきキャノン・おおうずしお・味方のオーシャンウェーブ など。ひきずりこむのほか）があり、水中でない相手がいるとき
 *    （その相手を水中に。まよけのふだの効いている相手には使わない）
 * 4. みちしお：手札に水中で強い攻撃（味方のタイダルクラッシュ〔場が水中なら2倍〕も）があるのに、水中の相手がいないとき（タイダルクラッシュは水中の相手がいても）
 * 5. よびごえ：クロシオの回避の技が手札にある（よびごえのあとのマナで払える）か、クロシオ以外の味方のライフが少ない（2以下）とき。いちばん危ない相手に
 * 腕前 C は forgetTrick の割合で使いそこねる
 */
function chooseKuroshioTrick(state: BattleState, side: Side, options: Option[], style: AiStyle, skill: CpuSkill): BattleAction | null {
  const mine = options.filter(isSkillOption).filter((o) => KUROSHIO_MONSTERS.includes(o.def.monsterId));
  if (mine.length === 0) return null;
  if (cpuRoll(state, side, 'kuroshioTrick', false) < CPU_SKILL[skill].forgetTrick) return null;
  if (canKillThisTurn(state, side, options)) return null;
  const me = state.sides[side];
  const foe = otherSide(side);
  const mana = manaOf(me);
  const alive = new Set(aliveMonsters(me).map((m) => m.cardId));
  const foes = attackableMonsters(state, foe);
  const wetFoes = foes.filter((m) => habitatOf(state, m) === 'water');
  const handSkills = (except: string): SkillCard[] =>
    me.hand
      .filter((c) => c.uid !== except)
      .map((c) => getPlayCard(c.cardId))
      .filter((k): k is SkillCard => k.kind === 'skill' && alive.has(k.monsterId));

  const whirl = mine.find((o) => o.def.effect.type === 'attack' && !!o.def.effect.waterOnly);
  if (whirl && targetsFor(state, side, whirl.def).length >= 2) return attackAction(state, side, whirl, targetsFor(state, side, whirl.def)[0]?.uid ?? '');

  const tide = mine.find((o) => o.def.effect.type === 'tide');
  const field = activeField(state);
  const tideLasts = field?.habitat === 'water' && (field.untilTurn ?? Infinity) >= state.turn + 2;
  const tideUser = tide ? availableUsers(state, side, tide.def)[0] : undefined;
  const useTide = (): BattleAction | null => (tide && tideUser ? { type: 'useCard', side, cardUid: tide.card.uid, userUid: tideUser.uid } : null);
  const whirlInHand = handSkills(tide?.card.uid ?? '').some((k) => k.effect.type === 'attack' && !!k.effect.waterOnly);
  if (tide && !tideLasts && whirlInHand && wetFoes.length === 0 && foes.length >= 2) {
    const act = useTide();
    if (act) return act;
  }

  const drag = mine.find((o) => o.def.effect.type === 'attack' && !!o.def.effect.dragUnder);
  if (drag && !wardCharmActive(state, foe) && handSkills(drag.card.uid).some(isVsWaterAttack)) {
    const dry = targetsFor(state, side, drag.def).filter((m) => habitatOf(state, m) !== 'water');
    const target = pickTarget(state, side, dry, style, skill, 'drag');
    if (target) return attackAction(state, side, drag, target.uid);
  }

  if (tide && !tideLasts) {
    const rest = handSkills(tide.card.uid);
    const wantVs = wetFoes.length === 0 && rest.some(isVsWaterAttack);
    const wantDouble = rest.some((k) => k.effect.type === 'attack' && !!k.effect.doubleInWater);
    const support = fieldSupport(state);
    const keepField = !!support && field?.owner === side && fieldScore(state, side, support) > 0;
    if ((wantVs || wantDouble) && !keepField) {
      const act = useTide();
      if (act) return act;
    }
  }

  const call = mine.find((o) => o.def.effect.type === 'taunt');
  if (call) {
    const left = mana - call.def.cost;
    const evade = handSkills(call.card.uid).some((k) => KUROSHIO_MONSTERS.includes(k.monsterId) && k.effect.type === 'evade' && k.cost <= left);
    const weakAlly = aliveMonsters(me).some((m) => !KUROSHIO_MONSTERS.includes(m.cardId) && m.life <= KUROSHIO_CALL_LOW_LIFE);
    const free = aliveMonsters(state.sides[foe]).filter((m) => !(m.taunt && m.taunt.turn >= state.turn + 1));
    const target = [...free].sort((a, b) => threatOf(state, b) - threatOf(state, a) || b.life - a.life)[0];
    if ((evade || weakAlly) && target && !wardCharmActive(state, foe)) return attackAction(state, side, call, target.uid);
  }
  return null;
}

/** 指示書 BI の考え方で、しんぱんのせんこく・最後の審判・天の恵みを使うモンスター */
const RADIEL_MONSTERS: readonly string[] = ['mon-radiel'];
/** 天の恵みで払いたい「大きな技」の消費マナ（てんりんのさばき 6・てんのはどう 7） */
const RADIEL_BIG_COST = 6;
/** 最後の審判：相手の手札がこの枚数以上なら「多い」 */
const JUDGMENT_FOE_HAND = 5;

/** ラディエル（2026-11-05 指示書 BI）。first：天の恵み → 最後の審判（攻撃より先）。first でない：しんぱんのせんこく（攻撃のあと） */
function chooseRadielTrick(state: BattleState, side: Side, options: Option[], skill: CpuSkill, first: boolean): BattleAction | null {
  const mine = options.filter(isSkillOption).filter((o) => RADIEL_MONSTERS.includes(o.def.monsterId));
  if (mine.length === 0) return null;
  if (cpuRoll(state, side, 'radielTrick', false) < CPU_SKILL[skill].forgetTrick) return null;
  const me = state.sides[side];
  const mana = manaOf(me);
  if (first) {
    if (canKillThisTurn(state, side, options)) return null;
    const grace = mine.find((o) => o.def.effect.type === 'heavenGrace');
    if (grace) {
      const big = me.hand.map((c) => getPlayCard(c.cardId)).filter((k) => k.kind === 'skill' && RADIEL_MONSTERS.includes(k.monsterId) && k.effect.type === 'attack' && k.cost >= RADIEL_BIG_COST);
      const short = big.some((k) => k.cost > mana);
      if (short && (skill !== 'A' || me.discard.length >= 2)) return { type: 'useCard', side, cardUid: grace.card.uid };
    }
    const judgment = mine.find((o) => o.def.effect.type === 'lastJudgment');
    if (judgment) {
      const rest = me.hand.filter((c) => c.uid !== judgment.card.uid);
      const stuck = rest.filter((c) => !isGuard(c) && !cardUsability(state, side, c.uid).usable).length;
      const foeHand = state.sides[otherSide(side)].hand.length;
      const badHand = rest.length >= 3 && stuck / rest.length >= (skill === 'A' ? 0.6 : 0.5);
      const bigFoe = foeHand >= JUDGMENT_FOE_HAND && (skill !== 'A' || foeHand >= rest.length);
      if (badHand || bigFoe) return { type: 'useCard', side, cardUid: judgment.card.uid };
    }
    return null;
  }
  const verdict = mine.find((o) => o.def.effect.type === 'seal');
  if (!verdict) return null;
  const foe = otherSide(side);
  const foeMana = manaOf(state.sides[foe]);
  const reach = targetsFor(state, side, verdict.def).filter((e) => e.sealedTurn !== state.turn + 1);
  if (reach.length === 0) return null;
  // A：相手が次の手番に払える攻撃でいちばん大きいダメージ。B：技の最大ダメージ。C：ばらばら
  const afford = (e: BattleMonster): number =>
    Math.max(0, ...skillsOf(e.cardId).filter((k) => k.effect.type === 'attack' && k.stat !== null && k.cost <= foeMana + 1).map((k) => skillValue(k)));
  const target =
    skill === 'C'
      ? reach[Math.floor(cpuRoll(state, side, 'verdictTarget') * reach.length)]
      : [...reach].sort((a, b) => (skill === 'A' ? afford(b) - afford(a) : 0) || threatOf(state, b) - threatOf(state, a) || b.life - a.life)[0];
  return target ? attackAction(state, side, verdict, target.uid) : null;
}

/** 特殊（吠える・すなかけ・ダストキック・ちょうはつ）：一番ライフの多い相手に使う（仮の思考）。使えなければ null */
function chooseSpecial(state: BattleState, side: Side, options: Option[], enemies: BattleMonster[], spare = 0): BattleAction | null {
  const mana = manaOf(state.sides[side]);
  // リリルのうっとりウインクは chooseLililTrick、フォルンのこもりうたは chooseFornTrick だけで考える（2026-11-02 指示書 AK2・AL）
  const special = options
    .filter(isSkillOption)
    .find((o) => ['weaken', 'seal', 'taunt'].includes(o.def.effect.type) && !WINK_MONSTERS.includes(o.def.monsterId) && !FORN_MONSTERS.includes(o.def.monsterId) && !RADIEL_MONSTERS.includes(o.def.monsterId) && !KUROSHIO_MONSTERS.includes(o.def.monsterId) && o.def.cost + spare <= mana);
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
  const convert = manaPick(state, side, style, skill);
  if (convert && canConvertToMana(state, side)) return { type: 'convertToMana', side, cardUid: convert.uid };
  return { type: 'endTurn', side };
}

/** マナ化で次にマナにする手札（chooseManaAction の考え方。もりのたよりで捨てる1枚にも使う。2026-11-02 指示書 AL で関数に分けた） */
function manaPick(state: BattleState, side: Side, style: AiStyle, skill: CpuSkill): HandCard | undefined {
  const mine0 = state.sides[side];
  // テオ（指示書 AY）：α・β・γ は（1枚でも・危ないときも）マナにしない（危ないときは技としてふつうに使う）
  const held = overdriveHold(state, side, style, OVERDRIVE_MANA_HOLD_MIN, OVERDRIVE_MANA_HOLD_IN_DANGER);
  const mine = held.size > 0 ? { ...mine0, hand: mine0.hand.filter((c) => !held.has(c.uid)) } : mine0;
  const mana = manaOf(mine);
  const cost = (c: HandCard): number => {
    const card = getPlayCard(c.cardId);
    return card.kind === 'skill' ? guardCost(state, card) : card.cost;
  };
  // 次の相手の手番も場が水中で、相手に水中で強くなる攻撃を持つモンスターがいれば、守りを1枚多く残す（指示書 AJ の追加その3。3枚まで）
  const field = activeField(state);
  const wetNext = field?.habitat === 'water' && (field.untilTurn ?? Infinity) >= state.turn + 1;
  const waterThreat = wetNext && aliveMonsters(state.sides[otherSide(side)]).some((m) => skillsOf(m.cardId).some(isWaterAttack));
  const guardKeep = Math.min(3, (style === 'aggressive' ? 0 : style === 'guard' ? 2 : CPU_SKILL[skill].guardKeep) + (waterThreat && style !== 'aggressive' ? 1 : 0));
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
  // うっとりウインクを使った（次の相手の手番に効く）モンスターの回避は、マナにしないで残す（2026-11-02 指示書 AK2）
  const winked = winkedNextTurn(state, side);
  const winkKeep = mine.hand.filter((c) => winked.some((id) => isEvadeOf(c, id)) && cost(c) <= mana + mine.hand.length - 1);
  const keepGuards = [
    ...winkKeep,
    ...mine.hand
      .filter((c) => !winkKeep.includes(c) && isGuard(c) && cost(c) <= mana)
      .sort((a, b) => fits(b) - fits(a) || guardValue(b) - guardValue(a))
      .slice(0, Math.max(0, guardKeep - winkKeep.length)),
  ];
  const others = mine.hand.filter((c) => !keepGuards.includes(c) && (!isGuard(c) || guardKeep === 0));
  const manaAfter = mana + mine.hand.length - keepGuards.length - 1;
  let keepSkill = [...others].sort((a, b) => cost(b) - cost(a)).find((c) => cost(c) <= manaAfter);
  // 腕前 A：守りの分のマナも残す（残した守りのカードの必要マナに足りないなら、その技もマナにする）
  if (skill === 'A' && keepSkill && keepGuards.length > 0 && manaAfter < Math.max(...keepGuards.map(cost))) keepSkill = undefined;
  const rest = mine.hand.filter((c) => !keepGuards.includes(c) && c !== keepSkill);
  const guardFirst = cpuRoll(state, side, 'guardFirst', false) < CPU_SKILL[skill].guardFirst;
  return guardFirst ? (rest.find(isGuard) ?? rest[0]) : (rest.find((c) => !isGuard(c)) ?? rest[0]);
}

/**
 * 守備（仮の思考）：1枚ずつ選び、ダメージが0になるか使えるカードがなくなったら守備を終える。
 * 回避は倒されそうなときか大きなダメージのときに使い、そうでなければ防御で減らす。
 */
function chooseDefense(state: BattleState, side: Side, style: AiStyle = 'normal', skill: CpuSkill = 'B'): BattleAction | null {
  const guard = chooseGuard(state, side, style, skill);
  // 腕前 C：守れるのに一部で守らない（その攻撃の最初の守りのときだけ決める。画面が相手のセリフをふきだしで出す）
  if (guard?.type === 'defend' && guard.cardUid !== null && state.pending?.responses.length === 0 && cpuRoll(state, side, 'misguard') < CPU_SKILL[skill].misguard) {
    return { type: 'defend', side, cardUid: null, note: 'misguard' };
  }
  return guard;
}

/** 守るカード（腕前で変わる前の考え方。B・A はこのまま） */
function chooseGuard(state: BattleState, side: Side, style: AiStyle, skill: CpuSkill = 'B'): BattleAction | null {
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
  if (coverOpt && target && shouldCover(state, side, coverOpt, damage, lethal, options, skill)) return { type: 'defend', side, cardUid: coverOpt.card.uid };
  // うっとりウインクの効いている手番に狙われたリリルは、小さなダメージでも回避する（2026-11-02 指示書 AK2）
  const attacker = findMonster(state, pending.userUid)?.monster;
  if (target && WINK_MONSTERS.includes(target.cardId) && attacker?.taunt?.turn === state.turn && attacker.taunt.monsterId === target.cardId) {
    const free = options.filter((o) => o.def.effect.type === 'evade').sort((a, b) => a.def.cost - b.def.cost)[0];
    if (free) return { type: 'defend', side, cardUid: free.card.uid };
  }
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
function shouldCover(state: BattleState, side: Side, cover: SkillOption, damage: number, lethal: boolean, options: SkillOption[], skill: CpuSkill = 'B'): boolean {
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
  // みがわり（クヨウ 指示書 BH）：代わりに受けたダメージ −reduce
  const reduce = cover.def.effect.type === 'cover' ? (cover.def.effect.reduce ?? 0) : 0;
  const toGeol = Math.max(0, pending.power - shieldOf(state, geol, pending.stat) - bestGuard - reduce);
  const geolSurvives = toGeol < geol.life;
  const allyCanEvade = options.some((o) => o.def.effect.type === 'evade');
  if (KUYO_MONSTERS.includes(geol.cardId)) {
    // みがわり：狙われた味方のライフが低く（倒されそう・半分以下）、クヨウのライフに余裕があるとき。
    // 腕前 A：受けたあともライフ2以上。B・C：受けたあともライフ1以上。C は forgetTrick の割合で使いそこねる
    const target = findMonster(state, pending.targetUid)?.monster;
    if (!target || damage <= 0) return false;
    if (cpuRoll(state, side, 'standIn') < CPU_SKILL[skill].forgetTrick) return false;
    const low = lethal || target.life <= target.maxLife / 2;
    // BH の直し：みがわりのあとはクヨウの守りを重ねられないので、防御は見積もりに入れない
    const toKuyo = Math.max(0, pending.power - shieldOf(state, geol, pending.stat) - reduce);
    const roomy = geol.life - toKuyo >= (skill === 'A' ? 2 : 1);
    // 倒されそうでない味方が自分で回避できるなら、そちらにまかせる
    return low && roomy && !(allyCanEvade && !lethal);
  }
  if (lethal && !allyCanEvade && geolSurvives) return true;
  // フォルンのみがわりのふえ（2026-11-02 指示書 AL）：狙われた味方のライフが半分以下で、フォルンは倒れないとき
  const target = findMonster(state, pending.targetUid)?.monster;
  if (FORN_MONSTERS.includes(geol.cardId) && target && target.life <= target.maxLife / 2 && geolSurvives && damage > 0) return true;
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
