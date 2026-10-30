import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLUNE_MONSTER_ID, FLUNE_PLAYTEST_16 } from '../src/data/flune.ts';
import { GEOL_MONSTER_ID, GEOL_PLAYTEST_16 } from '../src/data/geol.ts';
import { HYOUZUKU_MONSTER_ID, HYOUZUKU_PLAYTEST_16 } from '../src/data/hyouzuku.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { PUKARIM_MONSTER_ID, PUKARIM_PLAYTEST_16 } from '../src/data/pukarim.ts';
import { playFluneMatch } from '../src/game/battle/flunePlaytest.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';
import { cardName } from '../src/i18n/content.ts';

/**
 * ヒョウズクそのものの強さ（2026-10-30 指示書 W）。ジオルの試遊（tests/geolPlaytest.test.ts・docs/geol.md 3章）と同じしかた：
 * 最初の手持ちの箱のモンスター1体を入れ替えたデッキ（3箱 × 3通り＝9つ）で、元の3箱と対戦する（先攻・後攻は半分ずつ・両方とも CPU の思考）。
 * 比べるため、ジオル（内部ランク B の下のほう）・フルーネ・プカリム（C）も、同じしかたで今のデータで測る（それぞれの試遊用の16枚）。
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。npm run playtest:hyouzuku（PLAYTEST=200）で各組み合わせ 200 回（PLAYTEST_OUT に JSON）
 */
const GAMES = Number(process.env.PLAYTEST ?? 2);
const KEYS = BOOSTERS.map((b) => b.key);
const SUBJECTS: readonly { readonly id: string; readonly cards: readonly { readonly id: string; readonly copies: number }[] }[] = [
  { id: HYOUZUKU_MONSTER_ID, cards: HYOUZUKU_PLAYTEST_16 },
  { id: GEOL_MONSTER_ID, cards: GEOL_PLAYTEST_16 },
  { id: FLUNE_MONSTER_ID, cards: FLUNE_PLAYTEST_16 },
  { id: PUKARIM_MONSTER_ID, cards: PUKARIM_PLAYTEST_16 },
];

/** a（player 側）が b に games 回で勝った割合（％。先攻・後攻は半分ずつ） */
function winRate(a: Deck, b: Deck, games: number, seedBase: number): number {
  let wins = 0;
  for (let i = 0; i < games; i++) if (playFluneMatch(a, b, seedBase + i * 7919, i % 2 === 0 ? 'player' : 'opponent').winner === 'player') wins++;
  return (wins / games) * 100;
}

describe('ヒョウズクの試遊（自動の対戦）', () => {
  it('入れ替えたデッキは、モンスター3体（1体がヒョウズク）・山札60枚で、ルールに合う', () => {
    for (const key of KEYS) {
      for (let slot = 0; slot < 3; slot++) {
        const d = swapDeck(key, slot, HYOUZUKU_MONSTER_ID, HYOUZUKU_PLAYTEST_16);
        expect(d.monsters[slot]).toBe(HYOUZUKU_MONSTER_ID);
        expect(d.skills).toHaveLength(60);
        expect(isDeckValid(d, countCards([...d.monsters, ...d.skills]))).toBe(true);
      }
    }
  });

  it(`各組み合わせ ${GAMES} 回ずつ：入れ替えたデッキの勝つ割合（元の3箱と比べる）`, () => {
    const base: Record<string, Record<string, number>> = {};
    KEYS.forEach((a, i) => {
      base[a] = Object.fromEntries(KEYS.map((b, j) => [b, winRate(boosterDeck(a), boosterDeck(b), GAMES, 1000 + i * 100 + j * 10)]));
    });
    const subjects: Record<string, unknown> = {};
    for (const s of SUBJECTS) {
      const rows: Record<string, Record<string, number>> = {};
      KEYS.forEach((a, i) => {
        for (let slot = 0; slot < 3; slot++) {
          const deck = swapDeck(a, slot, s.id, s.cards);
          rows[`${a}#${slot}`] = Object.fromEntries(KEYS.map((b, j) => [b, winRate(deck, boosterDeck(b), GAMES, 70000 + i * 1000 + slot * 100 + j * 10)]));
        }
      });
      const all = Object.values(rows).flatMap((r) => Object.values(r));
      subjects[s.id] = { name: cardName(s.id), average: all.reduce((n, v) => n + v, 0) / all.length, rows };
    }
    const swapped = Object.fromEntries(KEYS.flatMap((k) => [0, 1, 2].map((slot) => [`${k}#${slot}`, cardName(boosterDeck(k).monsters[slot] ?? '')])));
    const baseAll = Object.values(base).flatMap((r) => Object.values(r));
    const out = { games: GAMES, baseAverage: baseAll.reduce((n, v) => n + v, 0) / baseAll.length, base, swapped, subjects };
    if (process.env.PLAYTEST_OUT) {
      mkdirSync(dirname(process.env.PLAYTEST_OUT), { recursive: true });
      writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 1));
    }
    expect(Object.keys(subjects)).toHaveLength(SUBJECTS.length);
  }, 3_600_000);
});
