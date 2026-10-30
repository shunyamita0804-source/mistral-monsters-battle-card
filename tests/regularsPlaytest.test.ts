import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOOSTERS } from '../src/data/introV2.ts';
import { TOURNAMENTS } from '../src/data/tournaments.ts';
import { buildOpponentDeck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';
import { addCount, emptyCount, playCounted, summarize } from './support/boxCount.ts';

/**
 * 大会の常連7人（2026-10-30 指示書 Z の F-4。報告だけ）。出る大会（C・B・A・S）ごとの強さ（lifeScale）・構え・腕前で、
 * 最初の手持ち3箱（プレイヤー側は腕前 B）と GAMES 回ずつ（先攻・後攻は半分ずつ）。勝つ割合はプレイヤー側から見た値。
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。npm run playtest:regulars（PLAYTEST=200）
 */
const GAMES = Number(process.env.PLAYTEST ?? 2);
const KEYS = BOOSTERS.map((b) => b.key);

describe('大会の常連の試遊（自動の対戦）', () => {
  it(`常連7人 × 出る大会 × 3箱、各 ${GAMES} 回`, () => {
    const out: Record<string, unknown> = { games: GAMES, playerSkill: 'B' };
    const rows: Record<string, unknown> = {};
    let n = 0;
    for (const t of TOURNAMENTS) {
      for (const r of t.bracket?.regulars ?? []) {
        const deck = buildOpponentDeck(r);
        const all = emptyCount();
        const byBox: Record<string, number> = {};
        KEYS.forEach((key, k) => {
          const c = emptyCount();
          for (let g = 0; g < GAMES; g++) playCounted(boosterDeck(key), deck, 90000 + n * 1000 + k * 100 + g * 7919, g % 2 === 0 ? 'player' : 'opponent', c, r.lifeScale, 'B', { ai: r.ai, skill: r.skill });
          byBox[key] = Math.round((c.winsA / Math.max(1, c.games)) * 1000) / 10;
          addCount(all, c);
        });
        rows[`${t.id}:${r.name}`] = { tournament: t.name, name: r.name, ai: r.ai, skill: r.skill, lifeScale: r.lifeScale, ...summarize(all), byBox };
        n++;
      }
    }
    out.rows = rows;
    if (process.env.PLAYTEST_OUT) {
      mkdirSync(dirname(process.env.PLAYTEST_OUT), { recursive: true });
      writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 1));
    }
    expect(n).toBeGreaterThan(0);
  }, 3_600_000);
});
