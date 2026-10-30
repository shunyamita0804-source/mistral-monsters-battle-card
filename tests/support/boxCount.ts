import { getPlayCard, getSkill } from '../../src/data/cards.ts';
import { chooseAction } from '../../src/game/battle/ai.ts';
import { actingSide, applyAction, createBattle, type BattleState, type Side } from '../../src/game/battle/engine.ts';
import type { Deck } from '../../src/game/deck/deck.ts';
import type { AiStyle, CpuSkill } from '../../src/data/tournaments.ts';

/** 箱どうし・入れ替えの試遊で数えること（2026-10-30 指示書 Y の E。tests/boxPlaytest.test.ts・tests/swapPlaytest.test.ts） */
const MAX_STEPS = 6000;

export interface MatchCount {
  winsA: number;
  games: number;
  ko: number;
  deckOut: number;
  draws: number;
  turns: number;
  attacks: number;
  evaded: number;
  defended: number;
  /** サポートを使った回数（表示の番号ごと。両方の側の合計） */
  supports: Record<string, number>;
  /** 腕前 C の記録：攻撃を見送った（迷っている）・守りそこねた の回数（両方の側の合計。2026-10-30 指示書 Z） */
  hesitate: number;
  misguard: number;
  /** フルーネのつたはたき（マナ0の攻撃技）を使った回数（むだに使いすぎないかを見る。2026-10-30 指示書 Z） */
  tsuta: number;
}

export const emptyCount = (): MatchCount => ({ winsA: 0, games: 0, ko: 0, deckOut: 0, draws: 0, turns: 0, attacks: 0, evaded: 0, defended: 0, supports: {}, hesitate: 0, misguard: 0, tsuta: 0 });

/** a（player）と b（opponent）の1対戦を最後まで進めて数える */
/** skill：両方の腕前（b の構え・腕前を opponent で別にできる。大会の常連など） */
export function playCounted(a: Deck, b: Deck, seed: number, first: Side, c: MatchCount, bLifeScale = 1, skill: CpuSkill = 'B', opponent?: { readonly ai?: AiStyle | undefined; readonly skill?: CpuSkill | undefined }): void {
  let state: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b, lifeScale: bLifeScale }, seed, first);
  for (let i = 0; i < MAX_STEPS && state.phase !== 'ended'; i++) {
    const side = actingSide(state);
    if (!side) break;
    const action = side === 'opponent' && opponent ? chooseAction(state, side, opponent.ai, opponent.skill ?? 'B') : chooseAction(state, side, 'normal', skill);
    if (!action) break;
    if (action.type === 'endAttack' && action.note === 'hesitate') c.hesitate++;
    if (action.type === 'defend' && action.note === 'misguard') c.misguard++;
    if (action.type === 'useCard' && state.phase === 'main') {
      const hand = state.sides[side].hand.find((x) => x.uid === action.cardUid);
      const card = hand ? getPlayCard(hand.cardId) : null;
      if (card?.kind === 'support') c.supports[card.code ?? card.id] = (c.supports[card.code ?? card.id] ?? 0) + 1;
      if (card?.id === 'skl-flune-01') c.tsuta++;
    }
    // 守りを終える（＝攻撃1回のダメージが決まる）ときに、回避・防御を数える
    if (action.type === 'defend' && action.cardUid === null && state.pending) {
      c.attacks++;
      const used = state.pending.responses.map((id) => getSkill(id).effect.type);
      if (used.includes('evade')) c.evaded++;
      else if (used.includes('defense')) c.defended++;
    }
    state = applyAction(state, action);
  }
  c.games++;
  c.turns += state.turn;
  if (state.winner === 'player') c.winsA++;
  if (state.winner === 'player' || state.winner === 'opponent') {
    if (state.endReason === 'deckOut') c.deckOut++;
    else c.ko++;
  } else c.draws++;
}

export function addCount(to: MatchCount, c: MatchCount): void {
  for (const k of ['winsA', 'games', 'ko', 'deckOut', 'draws', 'turns', 'attacks', 'evaded', 'defended', 'hesitate', 'misguard', 'tsuta'] as const) to[k] += c[k];
  for (const [k, v] of Object.entries(c.supports)) to.supports[k] = (to.supports[k] ?? 0) + v;
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);

export function summarize(c: MatchCount): Record<string, unknown> {
  return {
    games: c.games,
    winA: pct(c.winsA, c.games),
    ko: pct(c.ko, c.games),
    deckOut: pct(c.deckOut, c.games),
    draws: c.draws,
    avgTurns: Math.round((c.turns / Math.max(1, c.games)) * 10) / 10,
    attacksPerGame: Math.round((c.attacks / Math.max(1, c.games)) * 10) / 10,
    evaded: pct(c.evaded, c.attacks),
    defended: pct(c.defended, c.attacks),
    hesitatePerGame: Math.round((c.hesitate / Math.max(1, c.games)) * 100) / 100,
    misguardPerGame: Math.round((c.misguard / Math.max(1, c.games)) * 100) / 100,
    tsutaPerGame: Math.round((c.tsuta / Math.max(1, c.games)) * 100) / 100,
    supportsPerGame: Object.fromEntries(Object.entries(c.supports).sort().map(([k, v]) => [k, Math.round((v / Math.max(1, c.games)) * 100) / 100])),
  };
}
