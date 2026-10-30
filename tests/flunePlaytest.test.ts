import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { FLUNE_MONSTER_ID, FLUNE_PLAYTEST_16 } from '../src/data/flune.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { emptyFluneStats, playFluneMatch, type FluneMatchOptions, type FluneStats } from '../src/game/battle/flunePlaytest.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { buildOpponentDeck, countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';
import { cardName } from '../src/i18n/content.ts';

/**
 * フルーネの自動の試遊（2026-10-29 フルーネの最終の追加の指示。数字は変えない。表を出すだけ）。ジオルの試遊（tests/geolPlaytest.test.ts）と同じ作り。
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。
 * npm run playtest:flune（PLAYTEST=200）で、各組み合わせ 200 回ずつ（先攻・後攻は半分ずつ）の勝率と数を出す（PLAYTEST_OUT に JSON）
 * - 3つの箱の1体をフルーネに入れ替えた9デッキ × 元の3箱
 * - 最初の手持ち（3つの箱）× 精霊の森のセラ（今の編成と、比べる案2つ。どれも lifeScale 0.85。デッキは変えない）
 */
const GAMES = Number(process.env.PLAYTEST ?? 4);
const KEYS = BOOSTERS.map((b) => b.key);
const fluneDeck = (key: (typeof KEYS)[number], slot: number): Deck => swapDeck(key, slot, FLUNE_MONSTER_ID, FLUNE_PLAYTEST_16);

/** セラの編成の候補（2026-10-29 の表：前の編成・案1・案2。2026-10-29 夜に案2 に決めた） */
const SERA = ENCOUNTERS['enc-forest-boss'];
const SERA_CANDIDATES: Readonly<Record<string, readonly string[]>> = {
  now: ['mon-lazuck', FLUNE_MONSTER_ID, 'mon-soramo'],
  plan1: ['mon-pukarim', FLUNE_MONSTER_ID, 'mon-nobiton'],
  plan2: ['mon-pukarim', FLUNE_MONSTER_ID, 'mon-myurol'],
};

interface Tally {
  wins: number;
  losses: number;
  draws: number;
  turns: number;
  /** a（player 側）のフルーネの数 */
  stats: FluneStats;
  /** b（opponent 側）のフルーネの数 */
  bStats: FluneStats;
}

function addStats(to: FluneStats, s: FluneStats): void {
  for (const k of Object.keys(to) as (keyof FluneStats)[]) to[k] += s[k];
}

/** a（player 側）と b を games 回。先攻・後攻は半分ずつ */
function series(a: Deck, b: Deck, games: number, seedBase: number, options: FluneMatchOptions = {}): Tally {
  const t: Tally = { wins: 0, losses: 0, draws: 0, turns: 0, stats: emptyFluneStats(), bStats: emptyFluneStats() };
  for (let i = 0; i < games; i++) {
    const r = playFluneMatch(a, b, seedBase + i * 7919, i % 2 === 0 ? 'player' : 'opponent', options);
    if (r.winner === 'player') t.wins++;
    else if (r.winner === 'opponent') t.losses++;
    else t.draws++;
    t.turns += r.turns;
    addStats(t.stats, r.stats.player);
    addStats(t.bStats, r.stats.opponent);
  }
  return t;
}

describe('フルーネの試遊（自動の対戦）', () => {
  it('入れ替えたデッキは、モンスター3体（1体がフルーネ）・山札60枚で、ルールに合う。セラの今の編成は ラズック・フルーネ・ソラモ（0.85）', () => {
    for (const key of KEYS) {
      for (let slot = 0; slot < 3; slot++) {
        const d = fluneDeck(key, slot);
        expect(d.monsters[slot]).toBe(FLUNE_MONSTER_ID);
        expect(d.skills).toHaveLength(60);
        expect(isDeckValid(d, countCards([...d.monsters, ...d.skills]))).toBe(true);
      }
    }
    // lifeScale は 0.75 から、2026-10-30 指示書 V（切り札の技を2枚ずつ）で 0.7 に、指示書 Y で 0.75 に（tests/bossPlaytest.test.ts）
    expect(SERA).toMatchObject({ monsters: ['mon-pukarim', FLUNE_MONSTER_ID, 'mon-myurol'], lifeScale: 0.75 });
  });

  it(`各組み合わせ ${GAMES} 回ずつ：勝率の表`, () => {
    const out: Record<string, unknown> = { games: GAMES };
    const flune: Record<string, Record<string, Tally>> = {};
    KEYS.forEach((a, i) => {
      for (let slot = 0; slot < 3; slot++) {
        const name = `${a}#${slot}`;
        flune[name] = {};
        KEYS.forEach((b, j) => {
          (flune[name] as Record<string, Tally>)[b] = series(fluneDeck(a, slot), boosterDeck(b), GAMES, 90000 + i * 1000 + slot * 100 + j * 10);
        });
      }
    });
    out.flune = flune;
    out.swapped = Object.fromEntries(KEYS.flatMap((k) => [0, 1, 2].map((slot) => [`${k}#${slot}`, cardName(boosterDeck(k).monsters[slot] ?? '')])));
    const sera: Record<string, Record<string, Tally>> = {};
    Object.entries(SERA_CANDIDATES).forEach(([plan, monsters], p) => {
      sera[plan] = {};
      const deck = buildOpponentDeck({ monsters: [...monsters] });
      KEYS.forEach((a, i) => {
        (sera[plan] as Record<string, Tally>)[a] = series(boosterDeck(a), deck, GAMES, 50000 + p * 1000 + i * 10, { bLifeScale: 0.85, ...(SERA?.ai ? { bStyle: SERA.ai } : {}) });
      });
    });
    out.sera = sera;
    // 2026-10-29 夜：セラを案2（プカリム・フルーネ・ミュロル）にするときの lifeScale を決める（0.85・0.75・0.7。勝つ割合が 45％ にいちばん近いもの）
    const scales: Record<string, Record<string, Tally>> = {};
    const plan2 = buildOpponentDeck({ monsters: [...(SERA_CANDIDATES.plan2 ?? [])] });
    [0.85, 0.75, 0.7].forEach((scale, p) => {
      const row: Record<string, Tally> = {};
      KEYS.forEach((a, i) => {
        row[a] = series(boosterDeck(a), plan2, GAMES, 60000 + p * 1000 + i * 10, { bLifeScale: scale });
      });
      scales[String(scale)] = row;
    });
    out.seraPlan2Scales = scales;
    if (process.env.PLAYTEST_OUT) writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 1));
    const all = [...Object.values(flune), ...Object.values(sera), ...Object.values(scales)].flatMap((row) => Object.values(row));
    const draws = all.reduce((n, t) => n + t.draws, 0);
    expect(draws).toBeLessThanOrEqual(all.length * GAMES * 0.02);
  }, 1_800_000);
});
