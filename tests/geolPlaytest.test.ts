import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GEOL_MONSTER_ID, GEOL_PLAYTEST_16 } from '../src/data/geol.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { emptyGeolStats, playGeolMatch, type GeolStats } from '../src/game/battle/geolPlaytest.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';
import { cardName } from '../src/i18n/content.ts';

/**
 * ジオルの試遊（2026-10-29 手順 4・G4。指示書「試遊」）。プカリムの試遊（tests/pukarimPlaytest.test.ts）と同じ作り。
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。
 * npm run playtest:geol（PLAYTEST=200）で、各組み合わせ 200 回ずつ（先攻・後攻は半分ずつ）の勝率と数を出す（PLAYTEST_OUT に JSON）
 */
const GAMES = Number(process.env.PLAYTEST ?? 4);
const KEYS = BOOSTERS.map((b) => b.key);
const geolDeck = (key: (typeof KEYS)[number], slot: number): Deck => swapDeck(key, slot, GEOL_MONSTER_ID, GEOL_PLAYTEST_16);

interface Tally {
  wins: number;
  losses: number;
  draws: number;
  /** 対戦の手番の数の合計（ジオルが場にいた手番の数とくらべる） */
  turns: number;
  stats: GeolStats;
}

function addStats(to: GeolStats, s: GeolStats): void {
  for (const k of Object.keys(to) as (keyof GeolStats)[]) to[k] += s[k];
}

/** a（player 側）と b を games 回。先攻・後攻は半分ずつ。a の勝ち・負けと、a の側の数 */
function series(a: Deck, b: Deck, games: number, seedBase: number): Tally {
  const t: Tally = { wins: 0, losses: 0, draws: 0, turns: 0, stats: emptyGeolStats() };
  for (let i = 0; i < games; i++) {
    const r = playGeolMatch(a, b, seedBase + i * 7919, i % 2 === 0 ? 'player' : 'opponent');
    if (r.winner === 'player') t.wins++;
    else if (r.winner === 'opponent') t.losses++;
    else t.draws++;
    t.turns += r.turns;
    addStats(t.stats, r.stats.player);
  }
  return t;
}

describe('ジオルの試遊（自動の対戦）', () => {
  it('入れ替えたデッキは、モンスター3体（1体がジオル）・山札60枚で、ルールに合う', () => {
    for (const key of KEYS) {
      for (let slot = 0; slot < 3; slot++) {
        const d = geolDeck(key, slot);
        expect(d.monsters[slot]).toBe(GEOL_MONSTER_ID);
        expect(d.skills).toHaveLength(60);
        expect(isDeckValid(d, countCards([...d.monsters, ...d.skills]))).toBe(true);
      }
    }
  });

  it(`各組み合わせ ${GAMES} 回ずつ：勝率の表`, () => {
    const out: Record<string, unknown> = { games: GAMES };
    const base: Record<string, Record<string, Tally>> = {};
    KEYS.forEach((a, i) => {
      base[a] = {};
      KEYS.forEach((b, j) => {
        (base[a] as Record<string, Tally>)[b] = series(boosterDeck(a), boosterDeck(b), GAMES, 1000 + i * 100 + j * 10);
      });
    });
    out.base = base;
    const geol: Record<string, Record<string, Tally>> = {};
    KEYS.forEach((a, i) => {
      for (let slot = 0; slot < 3; slot++) {
        const name = `${a}#${slot}`;
        geol[name] = {};
        KEYS.forEach((b, j) => {
          (geol[name] as Record<string, Tally>)[b] = series(geolDeck(a, slot), boosterDeck(b), GAMES, 70000 + i * 1000 + slot * 100 + j * 10);
        });
      }
    });
    out.geol = geol;
    out.swapped = Object.fromEntries(KEYS.flatMap((k) => [0, 1, 2].map((slot) => [`${k}#${slot}`, cardName(boosterDeck(k).monsters[slot] ?? '')])));
    if (process.env.PLAYTEST_OUT) writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 1));
    const all = [...Object.values(base), ...Object.values(geol)].flatMap((row) => Object.values(row));
    const draws = all.reduce((n, t) => n + t.draws, 0);
    expect(draws).toBeLessThanOrEqual(all.length * GAMES * 0.02);
  }, 1_200_000);
});
