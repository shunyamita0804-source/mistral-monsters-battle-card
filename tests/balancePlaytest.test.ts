import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { LEAGUE_SCALE, RANK_SCALE, tournamentAtScale, type CpuSkill, type OpponentDefinition, type TournamentDefinition } from '../src/data/tournaments.ts';
import { buildOpponentDeck, type Deck } from '../src/game/deck/deck.ts';
import { advanceTournament, nextOpponent } from '../src/game/progress/tournament.ts';
import { drawEntrants } from '../src/game/progress/tournamentDraw.ts';
import type { ActiveTournament } from '../src/game/save/saveData.ts';
import {
  addBalanceCount,
  BALANCE_SLOTS,
  BOX_KEYS,
  deckBreakdown,
  emptyBalanceCount,
  makeBalancePlayer,
  pickDeckMonsters,
  playBalanceMatch,
  summarizeBalance,
  type BalanceCount,
  type SlotId,
} from './support/balancePlayer.ts';

/**
 * 全体バランスの試遊（2026-11-02 指示書 AU）。守り手9人と大会6つを、その時点の「目安のプレイヤー」（tests/support/balancePlayer.ts）で測る。
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。npm run playtest:balance（PLAYTEST=1000）で 1000 回 × 3箱。
 * - PLAYTEST_PART="bosses" / "tournaments"（無ければ両方）
 * - PLAYTEST_ONLY="enc-forest-boss,tournament-c" で測るものをしぼる
 * - PLAYTEST_SCALES="0.9:1.3:0.02" または "1.0,1.1"：守り手は lifeScale、大会は全体の倍率（E・D は LEAGUE_SCALE、C〜S は RANK_SCALE）を変えて測る
 * - PLAYTEST_PLAYER_SKILL="A"：プレイヤーの腕前（ふだんは B）
 * - PLAYTEST_SIENNA_LEFT=1：シエナがいない版の大会
 * - PLAYTEST_OUT：結果の JSON
 * 新しいモンスター・守り手・大会を足したら、tests/support/balancePlayer.ts の MONSTER_RANK・BALANCE_SLOTS と、下の GUARDIANS・TOURNAMENT_TARGETS に足す
 */
const GAMES = Number(process.env.PLAYTEST ?? 2);
const PART = process.env.PLAYTEST_PART ?? 'all';
const ONLY = process.env.PLAYTEST_ONLY?.split(',');
const PLAYER_SKILL = (process.env.PLAYTEST_PLAYER_SKILL ?? 'B') as CpuSkill;
const SIENNA_LEFT = !!process.env.PLAYTEST_SIENNA_LEFT;

function parseScales(v: string | undefined): number[] | null {
  if (!v) return null;
  if (v.includes(':')) {
    const [from, to, step] = v.split(':').map(Number) as [number, number, number];
    const out: number[] = [];
    for (let s = from; s <= to + 1e-9; s += step) out.push(Math.round(s * 1000) / 1000);
    return out;
  }
  return v.split(',').map(Number);
}
const SCALES = parseScales(process.env.PLAYTEST_SCALES);

/** 守り手と、測る目安のプレイヤーの枠・目標（目安のプレイヤーが勝つ割合％・3箱の平均） */
export const GUARDIANS: readonly { id: string; slot: SlotId; target: number }[] = [
  { id: 'enc-wind-boss', slot: 'first', target: 27 },
  { id: 'enc-water-boss', slot: 'D', target: 22 },
  { id: 'enc-forest-boss', slot: 'D', target: 22 },
  { id: 'enc-ice-boss', slot: 'C', target: 19 },
  { id: 'enc-fire-boss', slot: 'C', target: 19 },
  { id: 'enc-b3-boss', slot: 'B', target: 16 },
  { id: 'enc-thunder-boss', slot: 'B', target: 16 },
  { id: 'enc-machine-boss', slot: 'A', target: 13 },
  { id: 'enc-holy-boss', slot: 'S', target: 10 },
];

/** 大会と、測る目安のプレイヤーの枠・目標（優勝する割合％） */
export const TOURNAMENT_TARGETS: readonly { id: string; slot: SlotId; target: number }[] = [
  { id: 'tournament-e', slot: 'first', target: 45 },
  { id: 'tournament-d', slot: 'D', target: 40 },
  { id: 'tournament-c', slot: 'C', target: 30 },
  { id: 'tournament-b', slot: 'B', target: 25 },
  { id: 'tournament-a', slot: 'A', target: 20 },
  { id: 'tournament-s', slot: 'S', target: 15 },
];

/** 大会の今の全体の倍率 */
export function currentTournamentScale(id: string): number {
  const rank = id.replace('tournament-', '').toUpperCase();
  if (rank === 'E' || rank === 'D') return LEAGUE_SCALE[rank];
  return RANK_SCALE[rank as keyof typeof RANK_SCALE];
}

const round1 = (v: number): number => Math.round(v * 10) / 10;
const decks = new Map<string, Deck>();
const playerDeck = (box: (typeof BOX_KEYS)[number], slot: SlotId): Deck => {
  const key = `${box}:${slot}`;
  let d = decks.get(key);
  if (!d) {
    d = makeBalancePlayer(box, slot).deck;
    decks.set(key, d);
  }
  return d;
};

/* ---------- 守り手 ---------- */

function guardianSeries(boss: OpponentDefinition, slot: SlotId, lifeScale: number, games: number, seedBase: number) {
  const deck = buildOpponentDeck(boss);
  const byBox: Record<string, BalanceCount> = {};
  const all = emptyBalanceCount();
  BOX_KEYS.forEach((box, k) => {
    const c = emptyBalanceCount();
    for (let g = 0; g < games; g++) playBalanceMatch(playerDeck(box, slot), { deck, lifeScale, ai: boss.ai, skill: boss.skill, openingAny: boss.openingAny }, seedBase + k * 100000 + g * 7919, g % 2 === 0 ? 'player' : 'opponent', c, PLAYER_SKILL);
    byBox[box] = c;
    addBalanceCount(all, c);
  });
  const boxRates = Object.fromEntries(Object.entries(byBox).map(([k, c]) => [k, round1((c.wins / Math.max(1, c.games)) * 100)]));
  // 勝つ割合は3箱の平均（どの箱も同じ回数なので合計の割合と同じ）
  return { lifeScale, rate: round1((all.wins / Math.max(1, all.games)) * 100), byBox: boxRates, summary: summarizeBalance(all), byBoxSummary: Object.fromEntries(Object.entries(byBox).map(([k, c]) => [k, summarizeBalance(c)])) };
}

/* ---------- 大会 ---------- */

interface TourCount {
  runs: number;
  champion: number;
  /** 回戦ごと（総当たりは1〜3試合目）：戦った数・勝った数 */
  roundPlayed: number[];
  roundWon: number[];
  /** 相手ごと：戦った数・勝った数 */
  byOpponent: Record<string, { name: string; played: number; won: number }>;
  match: BalanceCount;
}

const emptyTour = (): TourCount => ({ runs: 0, champion: 0, roundPlayed: [0, 0, 0], roundWon: [0, 0, 0], byOpponent: {}, match: emptyBalanceCount() });

/** 目安のプレイヤーで大会を1回、最後まで（ゲームと同じ組み合わせ・ほかの人の試合・順位の決め方。src/game/progress/tournament.ts） */
function playTournament(t: TournamentDefinition, deck: Deck, seed: number, c: TourCount): void {
  let active: ActiveTournament = { tournamentId: t.id, entryId: `bal-${seed}`, round: 0, status: 'inProgress', seed, entrants: drawEntrants(t, seed, SIENNA_LEFT), matches: [] };
  const oppDecks = new Map<string, Deck>();
  for (let guard = 0; guard < 4 && active.status === 'inProgress'; guard++) {
    const opp = nextOpponent(t, active);
    if (!opp) break;
    let od = oppDecks.get(opp.id);
    if (!od) {
      od = buildOpponentDeck(opp);
      oppDecks.set(opp.id, od);
    }
    const round = active.round;
    const first = (seed + round) % 2 === 0 ? 'player' : 'opponent';
    const r = playBalanceMatch(deck, { deck: od, lifeScale: opp.lifeScale, ai: opp.ai, skill: opp.skill }, (seed * 31 + round * 104729) % 0x7fffffff, first, c.match, PLAYER_SKILL);
    c.roundPlayed[round] = (c.roundPlayed[round] ?? 0) + 1;
    if (r.won) c.roundWon[round] = (c.roundWon[round] ?? 0) + 1;
    const o = (c.byOpponent[opp.id] ??= { name: opp.name, played: 0, won: 0 });
    o.played++;
    if (r.won) o.won++;
    const next = advanceTournament(t, active, round, { won: r.won, ...r.summary });
    if (!next) break;
    active = next;
  }
  c.runs++;
  if (active.status === 'won') c.champion++;
}

function tournamentSeries(id: string, slot: SlotId, scale: number, games: number, seedBase: number) {
  const t = tournamentAtScale(id, scale) as TournamentDefinition;
  const byBox: Record<string, TourCount> = {};
  const all = emptyTour();
  BOX_KEYS.forEach((box, k) => {
    const c = emptyTour();
    for (let g = 0; g < games; g++) playTournament(t, playerDeck(box, slot), seedBase + k * 100000 + g * 7919, c);
    byBox[box] = c;
    all.runs += c.runs;
    all.champion += c.champion;
    c.roundPlayed.forEach((n, i) => (all.roundPlayed[i] = (all.roundPlayed[i] ?? 0) + n));
    c.roundWon.forEach((n, i) => (all.roundWon[i] = (all.roundWon[i] ?? 0) + n));
    for (const [oid, o] of Object.entries(c.byOpponent)) {
      const a = (all.byOpponent[oid] ??= { name: o.name, played: 0, won: 0 });
      a.played += o.played;
      a.won += o.won;
    }
    addBalanceCount(all.match, c.match);
  });
  const pctOf = (n: number, of: number): number => round1((n / Math.max(1, of)) * 100);
  return {
    scale,
    opponents: [...t.rounds, ...(t.bracket ? [...t.bracket.regulars, ...t.bracket.pool] : []), ...(t.siennaLeft ? [t.siennaLeft.with] : [])].map((o) => ({ id: o.id, name: o.name, lifeScale: o.lifeScale })),
    rate: pctOf(all.champion, all.runs),
    byBox: Object.fromEntries(Object.entries(byBox).map(([k, c]) => [k, pctOf(c.champion, c.runs)])),
    roundWin: all.roundPlayed.map((n, i) => pctOf(all.roundWon[i] ?? 0, n)),
    roundPlayed: all.roundPlayed,
    byOpponent: Object.fromEntries(Object.entries(all.byOpponent).map(([oid, o]) => [oid, { name: o.name, played: o.played, win: pctOf(o.won, o.played) }])),
    summary: summarizeBalance(all.match),
    byBoxSummary: Object.fromEntries(Object.entries(byBox).map(([k, c]) => [k, summarizeBalance(c.match)])),
  };
}

describe('目安のプレイヤー（tests/support/balancePlayer.ts）', () => {
  it('どの枠・どの箱でも、60枚のデッキが組める。同じ種なら毎回同じ', () => {
    for (const slot of BALANCE_SLOTS) {
      for (const box of BOX_KEYS) {
        const p = makeBalancePlayer(box, slot.id);
        expect(p.deckValid, `${box} ${slot.id}`).toBe(true);
        expect(new Set(p.monsters).size).toBe(3);
        expect(Object.values(p.packsBySeries).reduce((a, b) => a + b, 0)).toBe(slot.packs);
        expect(makeBalancePlayer(box, slot.id).deck).toEqual(p.deck);
      }
    }
  });

  it('デッキの3体：内部ランクの高い順。同じランクなら箱の子が先', () => {
    const box = BOOSTERS[0]?.monsters as readonly string[];
    // C だけなら箱の3体
    expect(new Set(pickDeckMonsters(box, ['mon-pukarim', 'mon-uzurio']))).toEqual(new Set(box));
    // B が2体なら、その2体と箱の子1体
    const b = pickDeckMonsters(box, ['mon-pukarim', 'mon-hyouzuku', 'mon-shishien']);
    expect(b).toContain('mon-hyouzuku');
    expect(b).toContain('mon-shishien');
    // 並びは箱の子が先
    expect(box).toContain(b[0]);
  });

  it('パックの7割はデッキの3体のシリーズ（B の枠・3箱の合計で 60〜80％）', () => {
    let deckPacks = 0;
    let total = 0;
    for (const box of BOX_KEYS) {
      const p = makeBalancePlayer(box, 'B');
      for (const [m, n] of Object.entries(p.packsBySeries)) {
        total += n;
        if (p.monsters.includes(m)) deckPacks += n;
      }
    }
    expect(deckPacks / total).toBeGreaterThan(0.6);
    expect(deckPacks / total).toBeLessThan(0.8);
  });
});

describe('全体バランスの試遊（自動の対戦）', () => {
  it(`守り手9人と大会6つ：目安のプレイヤーで ${GAMES} 回 × 3箱`, () => {
    const out: Record<string, unknown> = { games: GAMES, playerSkill: PLAYER_SKILL, siennaLeft: SIENNA_LEFT };
    out.players = Object.fromEntries(BALANCE_SLOTS.map((s) => [s.id, Object.fromEntries(BOX_KEYS.map((box) => {
      const p = makeBalancePlayer(box, s.id);
      return [box, { ...deckBreakdown(p.deck), packsBySeries: p.packsBySeries }];
    }))]));
    if (PART !== 'tournaments') {
      const rows: Record<string, unknown> = {};
      GUARDIANS.forEach((g, b) => {
        if (ONLY && !ONLY.includes(g.id)) return;
        const boss = ENCOUNTERS[g.id] as OpponentDefinition;
        const seedBase = 50000 + b * 1000;
        const row: Record<string, unknown> = { name: boss.name, slot: g.slot, target: g.target, current: guardianSeries(boss, g.slot, boss.lifeScale, GAMES, seedBase) };
        if (SCALES) row.scan = Object.fromEntries(SCALES.map((s) => [s.toFixed(2), guardianSeries(boss, g.slot, s, GAMES, seedBase)]));
        rows[g.id] = row;
      });
      out.guardians = rows;
      expect(Object.keys(rows).length).toBeGreaterThan(ONLY ? -1 : 8);
    }
    if (PART !== 'bosses') {
      const rows: Record<string, unknown> = {};
      TOURNAMENT_TARGETS.forEach((tt, b) => {
        if (ONLY && !ONLY.includes(tt.id)) return;
        const seedBase = 70000 + b * 1000;
        const row: Record<string, unknown> = { slot: tt.slot, target: tt.target, current: tournamentSeries(tt.id, tt.slot, currentTournamentScale(tt.id), GAMES, seedBase) };
        if (SCALES) row.scan = Object.fromEntries(SCALES.map((s) => [s.toFixed(2), tournamentSeries(tt.id, tt.slot, s, GAMES, seedBase)]));
        rows[tt.id] = row;
      });
      out.tournaments = rows;
      expect(Object.keys(rows).length).toBeGreaterThan(ONLY ? -1 : 5);
    }
    if (process.env.PLAYTEST_OUT) {
      mkdirSync(dirname(process.env.PLAYTEST_OUT), { recursive: true });
      writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 1));
    }
  }, 7_200_000);
});
