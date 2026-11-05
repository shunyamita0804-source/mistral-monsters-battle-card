import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runConfig, runGuardianOpponent, runNpcOpponent } from '../src/data/dungeonRun.ts';
import type { OpponentDefinition } from '../src/data/tournaments.ts';
import { buildOpponentDeck } from '../src/game/deck/deck.ts';
import { addBalanceCount, BOX_KEYS, emptyBalanceCount, makeBalancePlayer, playBalanceMatch } from './support/balancePlayer.ts';

/**
 * 指示書 BD【2】の試遊：機械の塔のバトラー・見えない番人に、目安のプレイヤー（A の枠・3箱・腕前 B）が勝つ割合。
 * PLAYTEST=1箱あたりの回数（ふだんは 2）。PLAYTEST_OUT に JSON。
 * PLAYTEST_BD_TEAMS（JSON：{ npc: [[..],[..]], guardian: [..] }）と PLAYTEST_BD_SCALES（"0.8,0.9"：番人の足し引きの前の floorLife）を渡すと、その編成・強さで測る
 * （渡さなければ、いまの src/data/dungeonRun.ts の編成と floorLife）
 */
const GAMES = Number(process.env.PLAYTEST ?? 2);
const ID = 'dungeon-06';

function rateOf(opp: OpponentDefinition, games: number, seedBase: number): number {
  const deck = buildOpponentDeck(opp);
  const all = emptyBalanceCount();
  BOX_KEYS.forEach((box, k) => {
    const c = emptyBalanceCount();
    const player = makeBalancePlayer(box, 'A').deck;
    for (let g = 0; g < games; g++) playBalanceMatch(player, { deck, lifeScale: opp.lifeScale ?? 1, ai: opp.ai, skill: opp.skill }, seedBase + k * 100000 + g * 7919, g % 2 === 0 ? 'player' : 'opponent', c, 'B');
    addBalanceCount(all, c);
  });
  return Math.round((all.wins / Math.max(1, all.games)) * 1000) / 10;
}

describe('指示書 BD【2】機械の塔の敵の試遊', () => {
  it('バトラー・見えない番人に勝つ割合（階ごと）', () => {
    const c = runConfig(ID);
    const teams = process.env.PLAYTEST_BD_TEAMS ? (JSON.parse(process.env.PLAYTEST_BD_TEAMS) as { npc: string[][]; guardian: string[] }) : { npc: c.npcTeams.map((t) => [...t]), guardian: [...c.guardianTeam] };
    const scales = process.env.PLAYTEST_BD_SCALES ? process.env.PLAYTEST_BD_SCALES.split(',').map(Number) : [...c.floorLife];
    const rows = scales.map((life, floor) => {
      const npc = teams.npc.map((m, i) => {
        const base = runNpcOpponent(floor, i, ID);
        return rateOf({ ...base, monsters: m, lifeScale: life }, GAMES, 1000 + floor * 37 + i * 11);
      });
      const g = runGuardianOpponent(floor, ID);
      const guardian = rateOf({ ...g, monsters: teams.guardian, lifeScale: Math.round((life + c.guardianLifeBonus) * 100) / 100 }, GAMES, 5000 + floor * 37);
      return { floor: floor + 1, life, npc, guardian };
    });
    const out = { games: GAMES * BOX_KEYS.length, teams, rows };
    if (process.env.PLAYTEST_OUT) {
      mkdirSync(dirname(process.env.PLAYTEST_OUT), { recursive: true });
      writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 2));
    }
    console.log(JSON.stringify(out));
    expect(rows.length).toBe(scales.length);
  }, 3_600_000);
});
