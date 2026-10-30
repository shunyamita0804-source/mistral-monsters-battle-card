import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOOSTERS } from '../src/data/introV2.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';
import type { CpuSkill } from '../src/data/tournaments.ts';
import { addCount, emptyCount, playCounted, summarize } from './support/boxCount.ts';

/**
 * 最初の箱どうしの試遊（2026-10-30 指示書 Y の E-1。指示書 Z の F-1 で CPU の腕前 A どうし・B どうし・C どうしの3つに）。
 * 3箱 × 3箱、各 GAMES 回（先攻・後攻は半分ずつ・両方とも CPU の思考）。
 * 勝つ割合・決着の理由（倒した／山札切れ）・平均の手番・攻撃が回避／防御された割合・サポートを使った回数（種類ごと・1対戦あたり）・
 * 腕前 C の「迷っている」「守りそこねた」の回数（1対戦あたり）・行の箱の平均の勝つ割合（箱どうしのつり合い：腕前 A で 44〜56%）。
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。npm run playtest:boxes（PLAYTEST=200）で 200 回ずつ（PLAYTEST_OUT に JSON）。
 * PLAYTEST_SKILLS="A" で腕前をしぼれる
 */
const GAMES = Number(process.env.PLAYTEST ?? 2);
const KEYS = BOOSTERS.map((b) => b.key);
const SKILLS = (process.env.PLAYTEST_SKILLS ?? 'A,B,C').split(',') as CpuSkill[];
describe('最初の箱どうしの試遊（自動の対戦）', () => {
  it(`腕前ごとに 3箱 × 3箱、各 ${GAMES} 回ずつ`, () => {
    const out: Record<string, unknown> = { games: GAMES };
    for (const skill of SKILLS) {
      const table: Record<string, Record<string, Record<string, unknown>>> = {};
      const rows: Record<string, number> = {};
      const all = emptyCount();
      KEYS.forEach((a, i) => {
        table[a] = {};
        const row = emptyCount();
        KEYS.forEach((b, j) => {
          const c = emptyCount();
          for (let g = 0; g < GAMES; g++) playCounted(boosterDeck(a), boosterDeck(b), 1000 + i * 100 + j * 10 + g * 7919, g % 2 === 0 ? 'player' : 'opponent', c, 1, skill);
          (table[a] as Record<string, Record<string, unknown>>)[b] = summarize(c);
          addCount(all, c);
          addCount(row, c);
        });
        rows[a] = Math.round((row.winsA / Math.max(1, row.games)) * 1000) / 10;
      });
      out[skill] = { all: summarize(all), rowAverage: rows, table };
      expect(all.games).toBe(GAMES * 9);
    }
    if (process.env.PLAYTEST_OUT) {
      mkdirSync(dirname(process.env.PLAYTEST_OUT), { recursive: true });
      writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 1));
    }
  }, 3_600_000);
});
