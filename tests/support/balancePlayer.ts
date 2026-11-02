import { cardCatalog, getMonster, getPlayCard, getSkill } from '../../src/data/cards.ts';
import { ENCOUNTERS } from '../../src/data/dungeons.ts';
import { GACHA_SERIES } from '../../src/data/economy.ts';
import { BOOSTERS, type BoosterKey } from '../../src/data/introV2.ts';
import type { AiStyle, CpuSkill } from '../../src/data/tournaments.ts';
import { chooseAction } from '../../src/game/battle/ai.ts';
import { actingSide, applyAction, createBattle, type BattleState, type Side } from '../../src/game/battle/engine.ts';
import { summarizeBattle, type BattleSummary } from '../../src/game/battle/simulate.ts';
import { buildDeckFromCollection, isDeckValid, type Deck } from '../../src/game/deck/deck.ts';
import { drawSeriesPack } from '../../src/game/economy/gachaSeries.ts';
import { nextRandom } from '../../src/game/rng.ts';
import { boosterCardCounts } from '../../src/game/story/introV2.ts';

/**
 * 「目安のプレイヤー」（2026-11-02 指示書 AU：全体バランス）。守り手・大会の強さを、その時点のプレイヤーで測るための持ち物とデッキ。
 * tests/balancePlaytest.test.ts（npm run playtest:balance）で使う。新しいモンスターを足したら、下の MONSTER_RANK と BALANCE_SLOTS に足す。
 *
 * 作り方（指示書 AU の 1）：
 * - 持っているカード：選んだ箱の中身（V1）＋枠ごとのモンスターのモンスターカード＋パック
 * - パック：今のガチャの中身と確率（drawSeriesPack）。7割をデッキの3体のシリーズ、3割をほかの持っているモンスターのシリーズに。道具のパックは開けない。種は固定
 * - デッキの3体：内部ランクの高い順に3体。同じランクなら箱の子を先に。対戦の並びは、箱の子を箱の順、そのあとに手に入れた順
 *   同じランクの箱の子どうし・箱の子でないものどうしは、ライフの高い順 → 箱の子は箱の並び順、箱の子でないものはあとで手に入れた順（Claude が決めた。要確認）
 * - デッキ：持っているカードから今の「おまかせ」（buildDeckFromCollection）
 */

/**
 * 内部ランク（画面に出さない。各モンスターのデータのコメントに書いてある値）。
 * ソラモ・ガウル・ラズック・カルシェル（未定）は書いた所が無いので C として扱う（要確認）
 */
export const MONSTER_RANK: Readonly<Record<string, 'C' | 'B' | 'A'>> = {
  'mon-soramo': 'C', 'mon-gauul': 'C', 'mon-lazuck': 'C', 'mon-nobiton': 'C', 'mon-myurol': 'C', 'mon-kalshell': 'C',
  'mon-lilil': 'C', 'mon-forn': 'C', 'mon-tsumuji': 'C', 'mon-uzurio': 'C', 'mon-pukarim': 'C', 'mon-flune': 'C', 'mon-serephine': 'C',
  'mon-hyouzuku': 'B', 'mon-shishien': 'B', 'mon-geol': 'B', 'mon-hakuran': 'B',
  'mon-desuoru': 'A',
};

const RANK_ORDER: Readonly<Record<'C' | 'B' | 'A', number>> = { C: 0, B: 1, A: 2 };

export type SlotId = 'first' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface BalanceSlot {
  readonly id: SlotId;
  /** 開けたパック（合計） */
  readonly packs: number;
  /** 箱の3体のほかに持っているモンスター（手に入れた順） */
  readonly extra: readonly string[];
}

/** 機械の塔の切り札（今の仮のまま。テオの ace） */
const MACHINE_ACE = ENCOUNTERS['enc-machine-boss']?.ace ?? 'mon-lazuck';

/** 枠ごとの目安（指示書 AU の表。モンスターは前の枠の分も持っている） */
export const BALANCE_SLOTS: readonly BalanceSlot[] = (() => {
  const steps: readonly [SlotId, number, readonly string[]][] = [
    ['first', 8, ['mon-pukarim']],
    ['D', 25, ['mon-uzurio']],
    ['C', 45, ['mon-serephine', 'mon-flune']],
    ['B', 70, ['mon-hyouzuku', 'mon-shishien']],
    ['A', 95, ['mon-geol', 'mon-hakuran']],
    ['S', 120, [MACHINE_ACE]],
  ];
  const owned: string[] = [];
  return steps.map(([id, packs, add]) => {
    for (const m of add) if (!owned.includes(m)) owned.push(m);
    return { id, packs, extra: [...owned] };
  });
})();

export const getSlot = (id: SlotId): BalanceSlot => BALANCE_SLOTS.find((s) => s.id === id) as BalanceSlot;

export const BOX_KEYS: readonly BoosterKey[] = BOOSTERS.map((b) => b.key);

const rankOf = (id: string): 'C' | 'B' | 'A' => {
  const r = MONSTER_RANK[id];
  if (!r) throw new Error(`内部ランクが書いてありません：${id}（tests/support/balancePlayer.ts の MONSTER_RANK に足してください）`);
  return r;
};

/** デッキの3体を選ぶ（上の決め方） */
export function pickDeckMonsters(boxMonsters: readonly string[], extra: readonly string[]): string[] {
  const owned = [...new Set([...boxMonsters, ...extra])];
  const info = owned.map((id) => {
    const box = boxMonsters.indexOf(id);
    return { id, rank: RANK_ORDER[rankOf(id)], box: box >= 0, order: box >= 0 ? box : extra.indexOf(id), life: getMonster(id).life };
  });
  info.sort((a, b) => b.rank - a.rank || Number(b.box) - Number(a.box) || b.life - a.life || (a.box ? a.order - b.order : b.order - a.order));
  // 並び（対戦の並び）：箱の子は箱の順、そのあとに手に入れた順
  return info
    .slice(0, 3)
    .sort((a, b) => Number(b.box) - Number(a.box) || a.order - b.order)
    .map((x) => x.id);
}

export interface BalancePlayer {
  readonly box: BoosterKey;
  readonly slot: SlotId;
  readonly monsters: readonly string[];
  readonly deck: Deck;
  readonly collection: Readonly<Record<string, number>>;
  /** 開けたパックのシリーズ（モンスター ID → 数） */
  readonly packsBySeries: Readonly<Record<string, number>>;
  readonly deckValid: boolean;
}

const seriesOf = (monsterId: string) => {
  const s = GACHA_SERIES.find((x) => x.monsterId === monsterId);
  if (!s) throw new Error(`ガチャのシリーズがありません：${monsterId}`);
  return s;
};

/** 目安のプレイヤーを1人作る（箱 × 枠。seed を変えなければ毎回同じ） */
export function makeBalancePlayer(box: BoosterKey, slotId: SlotId, seed = 20261102): BalancePlayer {
  const slot = getSlot(slotId);
  const def = BOOSTERS.find((b) => b.key === box);
  if (!def) throw new Error(`箱がありません：${box}`);
  const collection: Record<string, number> = { ...boosterCardCounts(box) };
  for (const m of slot.extra) collection[m] = Math.max(1, collection[m] ?? 0);
  const monsters = pickDeckMonsters(def.monsters, slot.extra);
  const others = [...new Set([...def.monsters, ...slot.extra])].filter((m) => !monsters.includes(m));
  let s = (seed ^ (BOX_KEYS.indexOf(box) * 0x9e3779b1) ^ (BALANCE_SLOTS.indexOf(slot) * 0x85ebca6b)) | 0;
  const roll = (): number => {
    const r = nextRandom(s);
    s = r.seed;
    return r.value;
  };
  const packsBySeries: Record<string, number> = {};
  for (let i = 0; i < slot.packs; i++) {
    const pool = others.length > 0 && roll() >= 0.7 ? others : monsters;
    const m = pool[Math.min(pool.length - 1, Math.floor(roll() * pool.length))] as string;
    packsBySeries[m] = (packsBySeries[m] ?? 0) + 1;
    const pack = drawSeriesPack(seriesOf(m), s, true);
    s = pack.seed;
    for (const id of pack.cards) collection[id] = (collection[id] ?? 0) + 1;
  }
  const deck = buildDeckFromCollection(monsters, collection);
  return { box, slot: slotId, monsters, deck, collection, packsBySeries, deckValid: isDeckValid(deck, collection) };
}

/** デッキの中身の内訳（報告用：モンスターごとの技の枚数・攻撃／守り／ほか、サポート） */
export function deckBreakdown(deck: Deck): Record<string, unknown> {
  const byMonster: Record<string, { attack: number; guard: number; other: number }> = {};
  let supports = 0;
  for (const id of deck.skills) {
    const card = getPlayCard(id);
    if (card.kind !== 'skill') {
      supports++;
      continue;
    }
    const row = (byMonster[card.monsterId] ??= { attack: 0, guard: 0, other: 0 });
    const type = card.effect.type;
    if (type === 'attack') row.attack++;
    else if (type === 'defense' || type === 'evade') row.guard++;
    else row.other++;
  }
  const names: Record<string, unknown> = {};
  for (const [m, row] of Object.entries(byMonster)) names[cardCatalog.get(m)?.name ?? m] = row;
  return { monsters: deck.monsters.map((m) => cardCatalog.get(m)?.name ?? m), skills: deck.skills.length, supports, byMonster: names };
}

/* ---------- 1対戦を数える ---------- */

const MAX_STEPS = 6000;

export interface BalanceCount {
  games: number;
  wins: number;
  koWins: number;
  deckOutWins: number;
  koLosses: number;
  deckOutLosses: number;
  draws: number;
  turns: number;
  /** プレイヤーの攻撃（相手が守った回数）・相手の攻撃 */
  playerAttacks: number;
  playerAttacksEvaded: number;
  playerAttacksDefended: number;
  opponentAttacks: number;
  opponentAttacksEvaded: number;
  opponentAttacksDefended: number;
  /** 使った守りのカード（防御・回避）の枚数 */
  playerGuards: number;
  opponentGuards: number;
}

export const emptyBalanceCount = (): BalanceCount => ({
  games: 0, wins: 0, koWins: 0, deckOutWins: 0, koLosses: 0, deckOutLosses: 0, draws: 0, turns: 0,
  playerAttacks: 0, playerAttacksEvaded: 0, playerAttacksDefended: 0, opponentAttacks: 0, opponentAttacksEvaded: 0, opponentAttacksDefended: 0, playerGuards: 0, opponentGuards: 0,
});

export function addBalanceCount(to: BalanceCount, from: BalanceCount): void {
  for (const k of Object.keys(to) as (keyof BalanceCount)[]) to[k] += from[k];
}

export interface BalanceOpponent {
  readonly deck: Deck;
  readonly lifeScale: number;
  readonly ai?: AiStyle | undefined;
  readonly skill?: CpuSkill | undefined;
}

/** プレイヤー（腕前 playerSkill・構えはふつう）と相手の1対戦。勝ったか・終わりの様子を返し、c に数える */
export function playBalanceMatch(player: Deck, opp: BalanceOpponent, seed: number, first: Side, c: BalanceCount, playerSkill: CpuSkill = 'B'): { won: boolean; summary: BattleSummary } {
  let state: BattleState = createBattle({ name: 'A', deck: player }, { name: 'B', deck: opp.deck, lifeScale: opp.lifeScale }, seed, first);
  for (let i = 0; i < MAX_STEPS && state.phase !== 'ended'; i++) {
    const side = actingSide(state);
    if (!side) break;
    const action = side === 'opponent' ? chooseAction(state, side, opp.ai, opp.skill ?? 'B') : chooseAction(state, side, 'normal', playerSkill);
    if (!action) break;
    // 守りを終える（＝攻撃1回のダメージが決まる）ときに、回避・防御と使った守りのカードを数える
    if (action.type === 'defend' && action.cardUid === null && state.pending) {
      const used = state.pending.responses.map((id) => getSkill(id).effect.type);
      const evaded = used.includes('evade');
      const defended = !evaded && used.includes('defense');
      const guards = used.filter((x) => x === 'evade' || x === 'defense').length;
      if (state.pending.attacker === 'player') {
        c.playerAttacks++;
        if (evaded) c.playerAttacksEvaded++;
        if (defended) c.playerAttacksDefended++;
        c.opponentGuards += guards;
      } else {
        c.opponentAttacks++;
        if (evaded) c.opponentAttacksEvaded++;
        if (defended) c.opponentAttacksDefended++;
        c.playerGuards += guards;
      }
    }
    state = applyAction(state, action);
  }
  c.games++;
  c.turns += state.turn;
  const won = state.winner === 'player';
  if (won) {
    c.wins++;
    if (state.endReason === 'deckOut') c.deckOutWins++;
    else c.koWins++;
  } else if (state.winner === 'opponent') {
    if (state.endReason === 'deckOut') c.deckOutLosses++;
    else c.koLosses++;
  } else c.draws++;
  return { won, summary: summarizeBattle(state) };
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);
const avg = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 100) / 100);

/** 報告用のまとめ（％・平均） */
export function summarizeBalance(c: BalanceCount): Record<string, number> {
  return {
    games: c.games,
    win: pct(c.wins, c.games),
    koWin: pct(c.koWins, c.games),
    deckOutWin: pct(c.deckOutWins, c.games),
    koLoss: pct(c.koLosses, c.games),
    deckOutLoss: pct(c.deckOutLosses, c.games),
    draw: pct(c.draws, c.games),
    deckOut: pct(c.deckOutWins + c.deckOutLosses, c.games),
    avgTurns: avg(c.turns, c.games),
    playerAttackEvaded: pct(c.playerAttacksEvaded, c.playerAttacks),
    playerAttackDefended: pct(c.playerAttacksDefended, c.playerAttacks),
    opponentAttackEvaded: pct(c.opponentAttacksEvaded, c.opponentAttacks),
    opponentAttackDefended: pct(c.opponentAttacksDefended, c.opponentAttacks),
    playerGuardsPerGame: avg(c.playerGuards, c.games),
    opponentGuardsPerGame: avg(c.opponentGuards, c.games),
  };
}
