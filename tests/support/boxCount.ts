import { getPlayCard, getSkill } from '../../src/data/cards.ts';
import { chooseAction } from '../../src/game/battle/ai.ts';
import { actingSide, applyAction, cardUsability, createBattle, guardCost, manaOf, type BattleState, type Side } from '../../src/game/battle/engine.ts';
import { guardMaxCost, guardMinCost } from '../../src/game/cards/cardTypes.ts';
import { t } from '../../src/i18n/i18n.ts';
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
  /** 捨て身の反動（2026-10-31 指示書 AB。シシエン）：反動の回数・反動で倒れた回数・反動で倒れて負けた対戦の数（両方の側の合計） */
  recoil: number;
  recoilKo: number;
  recoilLoss: number;
  /** 決着の理由（a＝player の側から。2026-10-31 指示書 AF）：倒して勝ち・山札切れで勝ち（負けは ko−winKo・deckOut−winDeckOut） */
  winKo: number;
  winDeckOut: number;
  /**
   * 「回避されない」攻撃（カードの undodgeable。2026-10-31 指示書 AF。ハクラン）：a（player）の側が使った回数・
   * そのうち、狙われた相手が「回避されない」でなければ使えた回避のカードを手札に持っていた回数（持っていたのに使えなかった）
   */
  undodgeableA: number;
  undodgeableBlockedA: number;
  /** 上の2つを、技のモンスターごとに（ハクランの技だけを見るため） */
  undodgeableByMonster: Record<string, number>;
  undodgeableBlockedByMonster: Record<string, number>;
  /** カラスのめ（2026-10-31 指示書 AG。デスオル）：a（player）の側が使った回数と、捨てさせたカードの種類（attack・guard・special・support） */
  crowEye: number;
  crowEyeDiscards: Record<string, number>;
}

export const emptyCount = (): MatchCount => ({ winsA: 0, games: 0, ko: 0, deckOut: 0, draws: 0, turns: 0, attacks: 0, evaded: 0, defended: 0, supports: {}, hesitate: 0, misguard: 0, tsuta: 0, recoil: 0, recoilKo: 0, recoilLoss: 0, winKo: 0, winDeckOut: 0, undodgeableA: 0, undodgeableBlockedA: 0, undodgeableByMonster: {}, undodgeableBlockedByMonster: {}, crowEye: 0, crowEyeDiscards: {} });

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
    const before = state;
    state = applyAction(state, action);
    countRecoil(before, state, c);
    if (side === 'player' && action.type === 'useCard' && before.phase === 'main') countUndodgeable(state, c);
    if (side === 'player' && state.crowEye && state.crowEye.seq !== before.crowEye?.seq) {
      c.crowEye++;
      const kind = discardKind(state.crowEye.cardId);
      c.crowEyeDiscards[kind] = (c.crowEyeDiscards[kind] ?? 0) + 1;
    }
  }
  c.games++;
  c.turns += state.turn;
  if (state.winner === 'player') {
    c.winsA++;
    if (state.endReason === 'deckOut') c.winDeckOut++;
    else c.winKo++;
  }
  if (state.winner === 'player' || state.winner === 'opponent') {
    if (state.endReason === 'deckOut') c.deckOut++;
    else c.ko++;
  } else c.draws++;
}

/** 1手のあいだに起きた反動を数える（新しい recoil の演出。その側のモンスターがその手で倒れたら反動で倒れた。それで負けたら自滅の負け） */
function countRecoil(before: BattleState, after: BattleState, c: MatchCount): void {
  const sides = after.fx.filter((f) => f.seq > (before.fxSeq ?? 0) && f.kind === 'recoil').map((f) => f.side);
  for (const side of sides) {
    c.recoil++;
    const fell = after.sides[side].monsters.some((m) => m.life === 0 && (before.sides[side].monsters.find((x) => x.uid === m.uid)?.life ?? 0) > 0);
    if (!fell) continue;
    c.recoilKo++;
    if (after.phase === 'ended' && after.winner !== side) c.recoilLoss++;
  }
}

/** a（player）の「回避されない」攻撃で守りの番になったとき：数える。相手が「回避されない」でなければ使えた回避のカードを持っていたら、使えなかった回数も数える */
function countUndodgeable(state: BattleState, c: MatchCount): void {
  const pending = state.pending;
  if (state.phase !== 'defense' || !pending || pending.attacker !== 'player') return;
  // 投石（サポート）の攻撃もここに来るので、技カードだけを見る
  const attack = getPlayCard(pending.cardId);
  if (attack.kind !== 'skill' || attack.effect.type !== 'attack' || !attack.effect.undodgeable) return;
  c.undodgeableA++;
  c.undodgeableByMonster[attack.monsterId] = (c.undodgeableByMonster[attack.monsterId] ?? 0) + 1;
  const blocked = t('battle.ng.undodgeable');
  const def = state.sides.opponent;
  const could = def.hand.some((h) => {
    const card = getPlayCard(h.cardId);
    if (card.kind !== 'skill' || card.effect.type !== 'evade') return false;
    if (cardUsability(state, 'opponent', h.uid).reason !== blocked) return false;
    // 「回避されない」の判定のあとの条件（必要マナ・残りのマナ）も合うものだけ
    const max = guardMaxCost(card);
    return attack.cost >= guardMinCost(card) && (max === null || attack.cost <= max) && !pending.pinned && manaOf(def) >= guardCost(state, card);
  });
  if (!could) return;
  c.undodgeableBlockedA++;
  c.undodgeableBlockedByMonster[attack.monsterId] = (c.undodgeableBlockedByMonster[attack.monsterId] ?? 0) + 1;
}

/** カラスのめで捨てさせたカードの種類：攻撃・守り（防御・回避など）・特殊・サポート */
function discardKind(cardId: string): string {
  const card = getPlayCard(cardId);
  if (card.kind === 'support') return 'support';
  const type = card.effect.type;
  if (type === 'attack') return 'attack';
  if (type === 'defense' || type === 'evade' || type === 'cover') return 'guard';
  return 'special';
}

export function addCount(to: MatchCount, c: MatchCount): void {
  for (const k of ['winsA', 'games', 'ko', 'deckOut', 'draws', 'turns', 'attacks', 'evaded', 'defended', 'hesitate', 'misguard', 'tsuta', 'recoil', 'recoilKo', 'recoilLoss', 'winKo', 'winDeckOut', 'undodgeableA', 'undodgeableBlockedA'] as const) to[k] += c[k];
  for (const [k, v] of Object.entries(c.supports)) to.supports[k] = (to.supports[k] ?? 0) + v;
  for (const [k, v] of Object.entries(c.undodgeableByMonster)) to.undodgeableByMonster[k] = (to.undodgeableByMonster[k] ?? 0) + v;
  for (const [k, v] of Object.entries(c.undodgeableBlockedByMonster)) to.undodgeableBlockedByMonster[k] = (to.undodgeableBlockedByMonster[k] ?? 0) + v;
  to.crowEye += c.crowEye;
  for (const [k, v] of Object.entries(c.crowEyeDiscards)) to.crowEyeDiscards[k] = (to.crowEyeDiscards[k] ?? 0) + v;
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
    recoilPerGame: Math.round((c.recoil / Math.max(1, c.games)) * 100) / 100,
    recoilKoPerGame: Math.round((c.recoilKo / Math.max(1, c.games)) * 100) / 100,
    recoilLossGames: pct(c.recoilLoss, c.games),
    // 決着の理由の表（a の側から。％）
    winKo: pct(c.winKo, c.games),
    winDeckOut: pct(c.winDeckOut, c.games),
    loseKo: pct(c.ko - c.winKo, c.games),
    loseDeckOut: pct(c.deckOut - c.winDeckOut, c.games),
    undodgeablePerGame: Math.round((c.undodgeableA / Math.max(1, c.games)) * 100) / 100,
    undodgeableBlockedPerGame: Math.round((c.undodgeableBlockedA / Math.max(1, c.games)) * 100) / 100,
    undodgeableByMonsterPerGame: Object.fromEntries(Object.entries(c.undodgeableByMonster).sort().map(([k, v]) => [k, Math.round((v / Math.max(1, c.games)) * 100) / 100])),
    undodgeableBlockedByMonsterPerGame: Object.fromEntries(Object.entries(c.undodgeableBlockedByMonster).sort().map(([k, v]) => [k, Math.round((v / Math.max(1, c.games)) * 100) / 100])),
    crowEyePerGame: Math.round((c.crowEye / Math.max(1, c.games)) * 100) / 100,
    crowEyeDiscards: { ...c.crowEyeDiscards },
    supportsPerGame: Object.fromEntries(Object.entries(c.supports).sort().map(([k, v]) => [k, Math.round((v / Math.max(1, c.games)) * 100) / 100])),
  };
}
