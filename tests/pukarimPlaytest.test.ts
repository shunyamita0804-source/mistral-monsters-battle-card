import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOOSTERS } from '../src/data/introV2.ts';
import { PUKARIM_MONSTER_ID } from '../src/data/pukarim.ts';
import { playMatch, pukarimSwapDeck, type PlaytestStats } from '../src/game/battle/playtest.ts';
import { isDeckValid, countCards, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';
import { cardName } from '../src/i18n/content.ts';

/**
 * プカリムの試遊（2026-10-28 手順 4。指示書 3章）。
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。
 * npm run playtest:pukarim（PLAYTEST=200）で、各組み合わせ 200 回ずつ（先攻・後攻は半分ずつ）の勝率と数を出す（PLAYTEST_OUT に JSON）
 */
const GAMES = Number(process.env.PLAYTEST ?? 4);
const KEYS = BOOSTERS.map((b) => b.key);

interface Tally {
  wins: number;
  losses: number;
  draws: number;
  stats: PlaytestStats;
}

function addStats(to: PlaytestStats, s: PlaytestStats): void {
  for (const k of Object.keys(to) as (keyof PlaytestStats)[]) to[k] += s[k];
}

/** a（player 側）と b を games 回。先攻・後攻は半分ずつ。a の勝ち・負けと、a の側の数 */
function series(a: Deck, b: Deck, games: number, seedBase: number): Tally {
  const t: Tally = { wins: 0, losses: 0, draws: 0, stats: { charges: 0, chargedAttacks: 0, chargedDamage: 0, chargedPuhaa: 0, chargedOtsumuji: 0, otsumujiKo: 0, otsumujiKoFromFull: 0, tailwinds: 0 } };
  for (let i = 0; i < games; i++) {
    const r = playMatch(a, b, seedBase + i * 7919, i % 2 === 0 ? 'player' : 'opponent');
    if (r.winner === 'player') t.wins++;
    else if (r.winner === 'opponent') t.losses++;
    else t.draws++;
    addStats(t.stats, r.stats.player);
  }
  return t;
}

describe('プカリムの試遊（自動の対戦）', () => {
  it('入れ替えたデッキは、モンスター3体（1体がプカリム）・山札60枚で、ルールに合う', () => {
    for (const key of KEYS) {
      for (let slot = 0; slot < 3; slot++) {
        const d = pukarimSwapDeck(key, slot);
        expect(d.monsters[slot]).toBe(PUKARIM_MONSTER_ID);
        expect(d.skills).toHaveLength(60);
        expect(isDeckValid(d, countCards([...d.monsters, ...d.skills]))).toBe(true);
      }
    }
  });

  it(`各組み合わせ ${GAMES} 回ずつ：勝率の表`, () => {
    const out: Record<string, unknown> = { games: GAMES };
    // 元のデッキどうし
    const base: Record<string, Record<string, Tally>> = {};
    KEYS.forEach((a, i) => {
      base[a] = {};
      KEYS.forEach((b, j) => {
        (base[a] as Record<string, Tally>)[b] = series(boosterDeck(a), boosterDeck(b), GAMES, 1000 + i * 100 + j * 10);
      });
    });
    out.base = base;
    // プカリム入り（入れ替える位置 slot ごと）× 元のデッキ
    const puk: Record<string, Record<string, Tally>> = {};
    KEYS.forEach((a, i) => {
      for (let slot = 0; slot < 3; slot++) {
        const name = `${a}#${slot}`;
        puk[name] = {};
        KEYS.forEach((b, j) => {
          (puk[name] as Record<string, Tally>)[b] = series(pukarimSwapDeck(a, slot), boosterDeck(b), GAMES, 50000 + i * 1000 + slot * 100 + j * 10);
        });
      }
    });
    out.pukarim = puk;
    out.swapped = Object.fromEntries(KEYS.flatMap((k) => [0, 1, 2].map((slot) => [`${k}#${slot}`, cardName(boosterDeck(k).monsters[slot] ?? '')])));
    if (process.env.PLAYTEST_OUT) writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 1));
    // どの組み合わせも最後まで進む（打ち切りがほとんど無い）
    const all = [...Object.values(base), ...Object.values(puk)].flatMap((row) => Object.values(row));
    const draws = all.reduce((n, t) => n + t.draws, 0);
    expect(draws).toBeLessThanOrEqual(all.length * GAMES * 0.02);
  }, 600_000);
});

