import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { BOOSTERS, EXAM_OPPONENT, examLifeScale } from '../src/data/introV2.ts';
import { playFluneMatch, type FluneMatchOptions } from '../src/game/battle/flunePlaytest.ts';
import { buildOpponentDeck, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck, examLoanDeck } from '../src/game/story/introV2.ts';

/**
 * ラズックの数字の直し（2026-10-29 夜 ユーザー決定：6 トリックショット 2マナ3→2マナ2、7 シャドウバースト 4マナ5→3マナ4）の前と後の自動の試遊。
 * 両方とも相手の CPU と同じ思考で最後まで自動で対戦する（flunePlaytest.ts の playFluneMatch を使う。フルーネの数は使わない）。
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。npm run playtest:lazuck（PLAYTEST=200）で各 200 回（先攻・後攻は半分ずつ）
 * - 元の3つの箱どうし（A が B に勝つ割合）
 * - 太古の遺跡のグラント（ガウル・ジオル・ラズック。lifeScale 1.2）に、最初の手持ち（3つの箱）で勝つ割合
 * - 練習場の試験（ガレス先生：ラズック・カルシェル・ノビトン）に、先生が貸すデッキで勝つ割合（1回目 0.35・2回目 0.25・3回目から 0.15）
 */
const GAMES = Number(process.env.PLAYTEST ?? 4);
const KEYS = BOOSTERS.map((b) => b.key);

interface Tally {
  wins: number;
  losses: number;
  draws: number;
  turns: number;
}

function series(a: Deck, b: Deck, games: number, seedBase: number, options: FluneMatchOptions = {}): Tally {
  const t: Tally = { wins: 0, losses: 0, draws: 0, turns: 0 };
  for (let i = 0; i < games; i++) {
    const r = playFluneMatch(a, b, seedBase + i * 7919, i % 2 === 0 ? 'player' : 'opponent', options);
    if (r.winner === 'player') t.wins++;
    else if (r.winner === 'opponent') t.losses++;
    else t.draws++;
    t.turns += r.turns;
  }
  return t;
}

describe('ラズックの数字の直しの試遊（自動の対戦）', () => {
  it(`各組み合わせ ${GAMES} 回ずつ：勝率の表`, () => {
    const out: Record<string, unknown> = { games: GAMES };
    const boxes: Record<string, Record<string, Tally>> = {};
    KEYS.forEach((a, i) => {
      boxes[a] = {};
      KEYS.forEach((b, j) => {
        if (a !== b) (boxes[a] as Record<string, Tally>)[b] = series(boosterDeck(a), boosterDeck(b), GAMES, 30000 + i * 100 + j * 10);
      });
    });
    out.boxes = boxes;
    const grant = ENCOUNTERS['enc-b3-boss'];
    if (!grant) throw new Error('grant');
    const grantDeck = buildOpponentDeck({ monsters: [...grant.monsters] });
    out.grant = Object.fromEntries(KEYS.map((a, i) => [a, series(boosterDeck(a), grantDeck, GAMES, 40000 + i * 10, { bLifeScale: grant.lifeScale ?? 1, ...(grant.ai ? { bStyle: grant.ai } : {}) })]));
    const examDeck = buildOpponentDeck({ monsters: [...EXAM_OPPONENT.monsters] });
    out.exam = Object.fromEntries([1, 2, 3].map((attempt) => [attempt, series(examLoanDeck(), examDeck, GAMES, 45000 + attempt * 10, { bLifeScale: examLifeScale(attempt) })]));
    if (process.env.PLAYTEST_OUT) writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 1));
    const all = [...Object.values(boxes).flatMap((row) => Object.values(row)), ...Object.values(out.grant as Record<string, Tally>), ...Object.values(out.exam as Record<string, Tally>)];
    expect(all.reduce((n, t) => n + t.draws, 0)).toBeLessThanOrEqual(all.length * GAMES * 0.02);
  }, 1_800_000);
});
