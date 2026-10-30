import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOOSTERS } from '../src/data/introV2.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';
import { addCount, emptyCount, playCounted, summarize } from './support/boxCount.ts';

/**
 * 最初の箱どうしの試遊（2026-10-30 指示書 Y の E-1）。3箱 × 3箱、各 GAMES 回（先攻・後攻は半分ずつ・両方とも CPU の思考）。
 * 勝つ割合・決着の理由（倒した／山札切れ）・平均の手番・攻撃が回避／防御された割合・サポートを使った回数（種類ごと・1対戦あたり）。
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。npm run playtest:boxes（PLAYTEST=200）で 200 回ずつ（PLAYTEST_OUT に JSON）
 */
const GAMES = Number(process.env.PLAYTEST ?? 2);
const KEYS = BOOSTERS.map((b) => b.key);
describe('最初の箱どうしの試遊（自動の対戦）', () => {
  it(`3箱 × 3箱、各 ${GAMES} 回ずつ`, () => {
    const table: Record<string, Record<string, unknown>> = {};
    const all = emptyCount();
    KEYS.forEach((a, i) => {
      table[a] = {};
      KEYS.forEach((b, j) => {
        const c = emptyCount();
        for (let g = 0; g < GAMES; g++) playCounted(boosterDeck(a), boosterDeck(b), 1000 + i * 100 + j * 10 + g * 7919, g % 2 === 0 ? 'player' : 'opponent', c);
        (table[a] as Record<string, unknown>)[b] = summarize(c);
        addCount(all, c);
      });
    });
    const out = { games: GAMES, all: summarize(all), table };
    if (process.env.PLAYTEST_OUT) {
      mkdirSync(dirname(process.env.PLAYTEST_OUT), { recursive: true });
      writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 1));
    }
    expect(all.games).toBe(GAMES * 9);
  }, 3_600_000);
});
