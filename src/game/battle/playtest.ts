import { getPlayCard, skillsOf } from '../../data/cards.ts';
import type { BoosterKey } from '../../data/introV2.ts';
import { PUKARIM_MONSTER_ID, PUKARIM_PLAYTEST_16, pukarimSkillId } from '../../data/pukarim.ts';
import { DECK_RULES } from '../../data/rules.ts';
import { countCards, type Deck } from '../deck/deck.ts';
import { boosterDeck } from '../story/introV2.ts';
import { chooseAction } from './ai.ts';
import { actingSide, applyAction, createBattle, findMonster, type BattleState, type BattleWinner, type Side } from './engine.ts';

/**
 * 試遊（強さの確かめ）の部品（2026-10-28 プカリムの手順 4）。DOM に依存しない純粋関数。
 * 両方とも相手の CPU と同じ思考（ai.ts の chooseAction・normal）で、最後まで自動で対戦する。決まった seed なら毎回同じ結果。
 * 使い方は tests/pukarimPlaytest.test.ts（npm run playtest:pukarim で全部の組み合わせを 200 回ずつ）
 */

/** プカリムのおおつむじ（5 ダメージ。ためると 7） */
const OTSUMUJI = pukarimSkillId(8);

/**
 * ブースターの箱のデッキ（旅立ちのきらめき・烈火の猛攻・蒼海の守り）の slot 番目のモンスターをプカリムに入れ替える。
 * そのモンスターの技16枚を抜き、プカリムの試遊用の16枚（PUKARIM_PLAYTEST_16）を入れる（山札は60枚のまま）
 */
export function pukarimSwapDeck(key: BoosterKey, slot: number, pukarimCards: readonly { readonly id: string; readonly copies: number }[] = PUKARIM_PLAYTEST_16): Deck {
  return swapDeck(key, slot, PUKARIM_MONSTER_ID, pukarimCards);
}

/**
 * ブースターの箱のデッキの slot 番目のモンスターを monsterId に入れ替える（2026-10-29 ジオルでも使うように分けた）。
 * そのモンスターの技を抜き、cards（入れるモンスターの16枚）を入れる（山札は60枚のまま）。
 * 2026-10-30 指示書 Y で箱の技が56枚（1体あたり16〜20枚）になったので、抜いた枚数が16より多いときは、cards の順にもう1枚ずつ
 * （同じカード3枚まで）足して、抜いた枚数と同じにする
 */
export function swapDeck(key: BoosterKey, slot: number, monsterId: string, cards: readonly { readonly id: string; readonly copies: number }[]): Deck {
  const base = boosterDeck(key);
  const out = base.monsters[slot];
  if (!out) throw new Error(`入れ替えるモンスターがいません: ${key} ${slot}`);
  const removed = new Set(skillsOf(out).map((s) => s.id));
  const kept = base.skills.filter((id) => !removed.has(id));
  const added = cards.flatMap((c) => Array<string>(c.copies).fill(c.id));
  const counts = countCards(added);
  for (let round = 0; kept.length + added.length < base.skills.length && round < DECK_RULES.maxCopies; round++) {
    for (const c of cards) {
      if (kept.length + added.length >= base.skills.length) break;
      if ((counts[c.id] ?? 0) < DECK_RULES.maxCopies) {
        counts[c.id] = (counts[c.id] ?? 0) + 1;
        added.push(c.id);
      }
    }
  }
  return { monsters: base.monsters.map((m, i) => (i === slot ? monsterId : m)), skills: [...kept, ...added] };
}

/**
 * 確認用の画面で、新しい効果を目で確かめるためのプカリムの16枚（ほっぺにためる・おいかぜ・ぷはーっ・おおつむじを3枚ずつ。試遊の勝率には使わない）
 */
export const PUKARIM_EFFECT_CHECK_16: readonly { readonly id: string; readonly copies: number }[] = [
  [9, 3], [10, 3], [7, 3], [8, 3], [3, 2], [13, 2],
].map(([no, copies]) => ({ id: pukarimSkillId(no as number), copies: copies as number }));

/** 試遊で数えること（片方の側について） */
export interface PlaytestStats {
  /** ほっぺにためるを使った回数 */
  charges: number;
  /** ためてから使った攻撃の回数と、その攻撃で実際に与えたダメージの合計（守り・回避のあと） */
  chargedAttacks: number;
  chargedDamage: number;
  /** ためてからのぷはーっ（回避されない）の回数 */
  chargedPuhaa: number;
  /** ためてからおおつむじ（7）を使った回数・その1回で相手を倒した回数・そのうち相手のライフが満タンだった回数 */
  chargedOtsumuji: number;
  otsumujiKo: number;
  otsumujiKoFromFull: number;
  /** おいかぜを使った回数 */
  tailwinds: number;
}

const emptyStats = (): PlaytestStats => ({
  charges: 0,
  chargedAttacks: 0,
  chargedDamage: 0,
  chargedPuhaa: 0,
  chargedOtsumuji: 0,
  otsumujiKo: 0,
  otsumujiKoFromFull: 0,
  tailwinds: 0,
});

export interface MatchResult {
  /** 勝った側（打ち切りは null） */
  readonly winner: BattleWinner | null;
  readonly turns: number;
  readonly stats: Readonly<Record<Side, PlaytestStats>>;
}

/** 打ち切り（行動の数） */
const MAX_STEPS = 6000;

/** player＝a・opponent＝b で、先攻 first の対戦を最後まで自動で進める */
export function playMatch(a: Deck, b: Deck, seed: number, first: Side): MatchResult {
  let state: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b }, seed, first);
  const stats: Record<Side, PlaytestStats> = { player: emptyStats(), opponent: emptyStats() };
  // ためてから使った攻撃（守りが終わってダメージが決まるまで覚えておく）
  let watch: { side: Side; targetUid: string; lifeBefore: number; maxLife: number; skillId: string } | null = null;
  for (let i = 0; i < MAX_STEPS && state.phase !== 'ended'; i++) {
    const side = actingSide(state);
    if (!side) break;
    const action = chooseAction(state, side);
    if (!action) break;
    if (action.type === 'useCard' && side === state.active && state.phase === 'main') {
      const hand = state.sides[side].hand.find((c) => c.uid === action.cardUid);
      const card = hand ? getPlayCard(hand.cardId) : null;
      if (card?.kind === 'skill') {
        if (card.effect.type === 'charge') stats[side].charges++;
        if (card.effect.type === 'tailwind') stats[side].tailwinds++;
        const user = action.userUid ? findMonster(state, action.userUid)?.monster : undefined;
        const target = action.targetUid ? findMonster(state, action.targetUid)?.monster : undefined;
        if (card.effect.type === 'attack' && user?.charge && target) {
          stats[side].chargedAttacks++;
          if (card.effect.undodgeableWhenCharged) stats[side].chargedPuhaa++;
          if (card.id === OTSUMUJI) stats[side].chargedOtsumuji++;
          watch = { side, targetUid: target.uid, lifeBefore: target.life, maxLife: target.maxLife, skillId: card.id };
        }
      }
    }
    state = applyAction(state, action);
    if (watch && !state.pending) {
      const after = findMonster(state, watch.targetUid)?.monster.life ?? 0;
      const s = stats[watch.side];
      s.chargedDamage += watch.lifeBefore - after;
      if (watch.skillId === OTSUMUJI && after === 0) {
        s.otsumujiKo++;
        if (watch.lifeBefore === watch.maxLife) s.otsumujiKoFromFull++;
      }
      watch = null;
    }
  }
  return { winner: state.winner, turns: state.turn, stats };
}
