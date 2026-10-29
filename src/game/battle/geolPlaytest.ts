import { getPlayCard, getSkill } from '../../data/cards.ts';
import { GEOL_MONSTER_ID, geolSkillId } from '../../data/geol.ts';
import type { Deck } from '../deck/deck.ts';
import { chooseAction } from './ai.ts';
import { actingSide, applyAction, createBattle, findMonster, otherSide, shieldOf, type BattleState, type BattleWinner, type Side } from './engine.ts';

/**
 * ジオルの試遊（2026-10-29 手順 4・G4）。プカリムの試遊（playtest.ts）と同じく、両方とも相手の CPU と同じ思考で最後まで自動で対戦し、
 * ジオルの新しい効果を数える。DOM に依存しない純粋関数。決まった seed なら毎回同じ結果。
 * 使い方は tests/geolPlaytest.test.ts（npm run playtest:geol で全部の組み合わせを 200 回ずつ）
 */

const KNUCKLE = geolSkillId(3);
const HAMMER = geolSkillId(6);
const CRYSTAL_RAY = geolSkillId(8);

/** 試遊で数えること（片方の側について。数はすべて合計） */
export interface GeolStats {
  /** 地ひびきを使った回数・与えたダメージの合計（守りのあと）・倒した数 */
  quakes: number;
  quakeDamage: number;
  quakeKos: number;
  /** エネルギーをためるを使った回数・ためたあとに2倍のかしこさ技を使えた回数・その攻撃のダメージの合計・2倍のクリスタルレイで1回で倒した回数 */
  energies: number;
  energizedAttacks: number;
  energizedDamage: number;
  energizedRayKos: number;
  /** かばうを使った回数・そのあとジオルが受けたダメージの合計・かばわなければ味方が倒れた（守りなしの威力が味方のライフ以上）回数 */
  covers: number;
  coverDamage: number;
  coverSaves: number;
  /** じならしを使った回数・そのあと（同じ手番に）その相手が攻撃を受けた回数・そのうちダメージが通った回数 */
  pins: number;
  pinFollowed: number;
  pinHits: number;
  /** ナックル・グランドハンマーを使った回数と与えたダメージの合計 */
  knuckles: number;
  knuckleDamage: number;
  hammers: number;
  hammerDamage: number;
  /** ジオルが場にいた（生きていた）手番の数の合計（両方の手番を数える）と、ジオルがいた対戦の数 */
  geolTurns: number;
  geolMatches: number;
}

export const emptyGeolStats = (): GeolStats => ({
  quakes: 0,
  quakeDamage: 0,
  quakeKos: 0,
  energies: 0,
  energizedAttacks: 0,
  energizedDamage: 0,
  energizedRayKos: 0,
  covers: 0,
  coverDamage: 0,
  coverSaves: 0,
  pins: 0,
  pinFollowed: 0,
  pinHits: 0,
  knuckles: 0,
  knuckleDamage: 0,
  hammers: 0,
  hammerDamage: 0,
  geolTurns: 0,
  geolMatches: 0,
});

export interface GeolMatchResult {
  /** 勝った側（打ち切りは null） */
  readonly winner: BattleWinner | null;
  readonly turns: number;
  readonly stats: Readonly<Record<Side, GeolStats>>;
}

/** 打ち切り（行動の数） */
const MAX_STEPS = 6000;

const lives = (state: BattleState, side: Side): Map<string, number> => new Map(state.sides[side].monsters.map((m) => [m.uid, m.life]));

const geolAlive = (state: BattleState, side: Side): boolean => state.sides[side].monsters.some((m) => m.cardId === GEOL_MONSTER_ID && m.life > 0);

/** player＝a・opponent＝b で、先攻 first の対戦を最後まで自動で進め、ジオルの効果を数える */
export function playGeolMatch(a: Deck, b: Deck, seed: number, first: Side): GeolMatchResult {
  let state: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b }, seed, first);
  const stats: Record<Side, GeolStats> = { player: emptyGeolStats(), opponent: emptyGeolStats() };
  for (const side of ['player', 'opponent'] as const) {
    if (state.sides[side].monsters.some((m) => m.cardId === GEOL_MONSTER_ID)) {
      stats[side].geolMatches = 1;
      stats[side].geolTurns = 1;
    }
  }
  // 使った攻撃（守りが全部終わってダメージが決まるまで覚えておく）
  let attack: { side: Side; skillId: string; energized: boolean; before: Map<string, number> } | null = null;
  // かばったあとの攻撃
  let cover: { side: Side; geolUid: string; before: number } | null = null;
  // じならしをかけた相手（その手番に攻撃を受けるまで）
  let pin: { side: Side; uid: string; turn: number; before: number | null } | null = null;
  for (let i = 0; i < MAX_STEPS && state.phase !== 'ended'; i++) {
    const side = actingSide(state);
    if (!side) break;
    const action = chooseAction(state, side);
    if (!action) break;
    const prev = state;
    if (action.type === 'useCard' && side === state.active && state.phase === 'main') {
      const hand = state.sides[side].hand.find((c) => c.uid === action.cardUid);
      const card = hand ? getPlayCard(hand.cardId) : null;
      if (card?.kind === 'skill' && card.monsterId === GEOL_MONSTER_ID) {
        if (card.effect.type === 'energy') stats[side].energies++;
        if (card.effect.type === 'pin' && action.targetUid) {
          stats[side].pins++;
          pin = { side, uid: action.targetUid, turn: state.turn, before: null };
        }
        if (card.effect.type === 'attack') {
          if (card.effect.allTargets) stats[side].quakes++;
          if (card.id === KNUCKLE) stats[side].knuckles++;
          if (card.id === HAMMER) stats[side].hammers++;
        }
      }
      if (card?.kind === 'skill' && card.effect.type === 'attack') attack = { side, skillId: card.id, energized: false, before: lives(state, otherSide(side)) };
    }
    if (action.type === 'defend' && action.cardUid && state.pending) {
      const hand = state.sides[side].hand.find((c) => c.uid === action.cardUid);
      const card = hand ? getSkill(hand.cardId) : null;
      if (card?.effect.type === 'cover') {
        const ally = findMonster(state, state.pending.targetUid)?.monster;
        if (ally && state.pending.power - shieldOf(state, ally, state.pending.stat) >= ally.life) stats[side].coverSaves++;
        stats[side].covers++;
      }
    }
    state = applyAction(state, action);
    // かばったあと：狙いが変わったジオルのライフを覚えておく
    if (action.type === 'defend' && state.pending?.coveredFrom && !prev.pending?.coveredFrom) {
      const g = findMonster(state, state.pending.targetUid)?.monster;
      if (g) cover = { side, geolUid: g.uid, before: g.life };
    }
    if (attack && state.pending?.energized) attack.energized = true;
    // じならしの相手が攻撃を受け始めた
    if (pin && state.pending && state.pending.targetUid === pin.uid && state.pending.attacker === pin.side && pin.before === null && state.turn === pin.turn) {
      pin.before = findMonster(state, pin.uid)?.monster.life ?? 0;
      stats[pin.side].pinFollowed++;
    }
    if (pin && pin.before !== null && (!state.pending || state.pending.targetUid !== pin.uid)) {
      const after = findMonster(state, pin.uid)?.monster.life ?? 0;
      if (after < pin.before) stats[pin.side].pinHits++;
      pin = null;
    }
    if (pin && state.turn !== pin.turn) pin = null;
    // 攻撃が全部終わった（守りの手番でなくなった）
    if (attack && state.phase !== 'defense') {
      const s = stats[attack.side];
      const foe = otherSide(attack.side);
      let damage = 0;
      let kos = 0;
      for (const [uid, before] of attack.before) {
        const after = findMonster(state, uid)?.monster.life ?? 0;
        damage += before - after;
        if (before > 0 && after === 0) kos++;
      }
      const skill = getSkill(attack.skillId);
      if (skill.monsterId === GEOL_MONSTER_ID) {
        if (skill.effect.type === 'attack' && skill.effect.allTargets) {
          s.quakeDamage += damage;
          s.quakeKos += kos;
        }
        if (attack.energized) {
          s.energizedAttacks++;
          s.energizedDamage += damage;
          if (attack.skillId === CRYSTAL_RAY && kos > 0) s.energizedRayKos++;
        }
        if (attack.skillId === KNUCKLE) s.knuckleDamage += damage;
        if (attack.skillId === HAMMER) s.hammerDamage += damage;
      }
      if (cover && cover.side === foe) {
        const after = findMonster(state, cover.geolUid)?.monster.life ?? 0;
        stats[cover.side].coverDamage += cover.before - after;
        cover = null;
      }
      attack = null;
    }
    // 新しい手番：ジオルが生きていれば数える
    if (state.turn !== prev.turn && state.phase !== 'ended') {
      for (const k of ['player', 'opponent'] as const) if (geolAlive(state, k)) stats[k].geolTurns++;
    }
  }
  return { winner: state.winner, turns: state.turn, stats };
}
