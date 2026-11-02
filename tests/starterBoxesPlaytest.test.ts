import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPlayCard } from '../src/data/cards.ts';
import type { BoosterKey } from '../src/data/introV2.ts';
import type { CpuSkill } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, cardUsability, createBattle, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/**
 * 3箱の総当たり（実際の対戦の決まりと CPU の思考で最後まで）。2026-11-02 の正式配布（PR #1）で作り、指示書 AM の箱（旅立ち＝ソラモ・リリル・ノビトン／
 * 烈火＝ガウル・ラズック・ツムジ／蒼海＝ミュロル・カルシェル・フォルン）でも同じ作り方で測る。
 * - 組み合わせ3つ（旅立ち×烈火・旅立ち×蒼海・烈火×蒼海）× 席の入れ替え2方向 × GAMES 回。1方向の中で先攻・後攻は半分ずつ（偶数回目は player が先攻）
 * - 種（seed）は組み合わせ・方向・回数から決まる（同じ回数なら同じ結果）
 * - 両方とも同じ腕前の CPU（PLAYTEST_SKILL。ふだんは B）。人の遊び方を測ったものではない
 * - 数えること：勝ち・引き分け・決着の理由（倒した／山札切れ）・先攻と後攻の勝ち・カードを使った回数（箱ごと）・
 *   おかしな動き（使えないカードを選んだ・選んでも何も変わらなかった・手数の上限で終わらない・ライフが 0 未満や最大より上）
 * - ツムジの Wひっかき：2枚目まで続けて使えた回数（chain。同じ手番に、Wひっかきを使ったツムジがもう1枚 Wひっかきを使った）
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。npm run playtest:starter-am-a・starter-am-b（PLAYTEST=200）で腕前ごとに 1,200 戦（PLAYTEST_OUT に JSON）
 */
const GAMES = Number(process.env.PLAYTEST ?? 2);
const SKILL = (process.env.PLAYTEST_SKILL ?? 'B') as CpuSkill;
const MAX_STEPS = 6000;
const W_SCRATCH = 'skl-tsumuji-02';
const PAIRS: readonly (readonly [BoosterKey, BoosterKey])[] = [
  ['booster-1', 'booster-2'],
  ['booster-1', 'booster-3'],
  ['booster-2', 'booster-3'],
];

interface Tally {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winKo: number;
  winDeckOut: number;
  loseKo: number;
  loseDeckOut: number;
  firstGames: number;
  firstWins: number;
  secondGames: number;
  secondWins: number;
  turns: number;
}
const tally = (): Tally => ({ games: 0, wins: 0, losses: 0, draws: 0, winKo: 0, winDeckOut: 0, loseKo: 0, loseDeckOut: 0, firstGames: 0, firstWins: 0, secondGames: 0, secondWins: 0, turns: 0 });

interface Oddities {
  /** CPU が使えないカードを選んだ回数 */
  unusablePick: number;
  /** 選んだ手で何も変わらなかった回数 */
  noProgress: number;
  /** 手数の上限まで終わらなかった対戦 */
  timeout: number;
  /** ライフが 0 未満・最大より上になった回数 */
  lifeOutOfRange: number;
}

/** 1対戦：a（player）と b（opponent） */
function playOne(a: BoosterKey, b: BoosterKey, seed: number, first: Side, use: Record<BoosterKey, Record<string, number>>, odd: Oddities, chained: Record<BoosterKey, number>): BattleState {
  const box: Record<Side, BoosterKey> = { player: a, opponent: b };
  let state = createBattle({ name: 'A', deck: boosterDeck(a) }, { name: 'B', deck: boosterDeck(b) }, seed, first);
  let steps = 0;
  for (; steps < MAX_STEPS && state.phase !== 'ended'; steps++) {
    const side = actingSide(state);
    if (!side) break;
    const action = chooseAction(state, side, 'normal', SKILL);
    if (!action) break;
    const cardUid = action.type === 'useCard' ? action.cardUid : action.type === 'defend' ? action.cardUid : null;
    if (cardUid) {
      if (!cardUsability(state, side, cardUid).usable) odd.unusablePick++;
      const card = state.sides[side].hand.find((h) => h.uid === cardUid);
      if (card) {
        const counts = use[box[side]];
        counts[card.cardId] = (counts[card.cardId] ?? 0) + 1;
        // Wひっかきの2枚目（この手番に Wひっかきを1回使ったツムジが、もう1枚使う）
        if (action.type === 'useCard' && card.cardId === W_SCRATCH && state.sides[side].monsters.some((m) => m.acted && m.chain?.turn === state.turn && m.chain.cardId === W_SCRATCH)) {
          chained[box[side]] += 1;
        }
      }
    }
    const next = applyAction(state, action);
    if (next === state) odd.noProgress++;
    state = next;
    for (const s of ['player', 'opponent'] as const) for (const m of state.sides[s].monsters) if (m.life < 0 || m.life > m.maxLife) odd.lifeOutOfRange++;
  }
  if (state.phase !== 'ended') odd.timeout++;
  return state;
}

function record(t: Tally, state: BattleState, me: Side, first: Side): void {
  t.games++;
  t.turns += state.turn;
  const deckOut = state.endReason === 'deckOut';
  if (me === first) t.firstGames++;
  else t.secondGames++;
  if (state.winner === me) {
    t.wins++;
    if (deckOut) t.winDeckOut++;
    else t.winKo++;
    if (me === first) t.firstWins++;
    else t.secondWins++;
  } else if (state.winner === 'player' || state.winner === 'opponent') {
    t.losses++;
    if (deckOut) t.loseDeckOut++;
    else t.loseKo++;
  } else t.draws++;
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);
const summary = (t: Tally) => ({
  games: t.games,
  win: pct(t.wins, t.games),
  lose: pct(t.losses, t.games),
  draws: t.draws,
  winKo: pct(t.winKo, t.games),
  winDeckOut: pct(t.winDeckOut, t.games),
  loseKo: pct(t.loseKo, t.games),
  loseDeckOut: pct(t.loseDeckOut, t.games),
  winWhenFirst: pct(t.firstWins, t.firstGames),
  winWhenSecond: pct(t.secondWins, t.secondGames),
  avgTurns: Math.round((t.turns / Math.max(1, t.games)) * 10) / 10,
});

describe('2026-11-02 正式配布の3箱の総当たり（自動の対戦）', () => {
  it(`3組み合わせ × 2方向 × ${GAMES} 回（腕前 ${SKILL} どうし）`, () => {
    const boxes: Record<BoosterKey, Tally> = { 'booster-1': tally(), 'booster-2': tally(), 'booster-3': tally() };
    const use: Record<BoosterKey, Record<string, number>> = { 'booster-1': {}, 'booster-2': {}, 'booster-3': {} };
    const odd: Oddities = { unusablePick: 0, noProgress: 0, timeout: 0, lifeOutOfRange: 0 };
    const chained: Record<BoosterKey, number> = { 'booster-1': 0, 'booster-2': 0, 'booster-3': 0 };
    const matchups: Record<string, unknown> = {};
    const firstSide = tally();
    let total = 0;
    PAIRS.forEach(([x, y], p) => {
      // x から見た数（2方向の合計）と、方向ごと
      const pair = tally();
      const dirs: Record<string, unknown> = {};
      ([[x, y], [y, x]] as const).forEach(([a, b], d) => {
        const dir = tally();
        for (let g = 0; g < GAMES; g++) {
          const first: Side = g % 2 === 0 ? 'player' : 'opponent';
          const seed = 20261102 + p * 100000 + d * 10000 + g;
          const end = playOne(a, b, seed, first, use, odd, chained);
          record(dir, end, 'player', first);
          record(pair, end, a === x ? 'player' : 'opponent', first);
          record(boxes[a], end, 'player', first);
          record(boxes[b], end, 'opponent', first);
          // 先攻の側から見た勝ち
          record(firstSide, end, first, first);
          total++;
        }
        dirs[`${a}(player) vs ${b}(opponent)`] = summary(dir);
      });
      matchups[`${x} vs ${y}`] = { fromFirstBox: summary(pair), directions: dirs };
    });
    expect(total).toBe(PAIRS.length * 2 * GAMES);
    // 箱ごとのカードを使った回数（1対戦あたり。多い順に、技と名前）
    const perGame = (key: BoosterKey) => {
      const g = boxes[key].games;
      return Object.entries(use[key])
        .sort((p, q) => q[1] - p[1])
        .map(([id, n]) => ({ id, name: getPlayCard(id).name, perGame: Math.round((n / Math.max(1, g)) * 100) / 100 }));
    };
    const out = {
      date: '2026-11-02',
      boxes: Object.fromEntries(PAIRS.flat().filter((k, i, all) => all.indexOf(k) === i).map((k) => [k, boosterDeck(k).monsters])),
      cpuSkill: SKILL,
      gamesPerDirection: GAMES,
      totalGames: total,
      note: 'CPU どうしの対戦（両方とも同じ腕前・ふつうの構え）。人の遊び方を測ったものではない',
      byBox: Object.fromEntries((Object.keys(boxes) as BoosterKey[]).map((k) => [k, summary(boxes[k])])),
      firstPlayer: { win: pct(firstSide.wins, firstSide.games), lose: pct(firstSide.losses, firstSide.games), draws: firstSide.draws },
      matchups,
      oddities: odd,
      cardUse: Object.fromEntries((Object.keys(boxes) as BoosterKey[]).map((k) => [k, perGame(k)])),
      // Wひっかきの2枚目を続けて使えた回数（1対戦あたり。箱ごと）
      chainSecondPerGame: Object.fromEntries((Object.keys(boxes) as BoosterKey[]).map((k) => [k, Math.round((chained[k] / Math.max(1, boxes[k].games)) * 100) / 100])),
    };
    // おかしな動きは無い
    expect(odd).toEqual({ unusablePick: 0, noProgress: 0, timeout: 0, lifeOutOfRange: 0 });
    if (process.env.PLAYTEST_OUT) {
      mkdirSync(dirname(process.env.PLAYTEST_OUT), { recursive: true });
      writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 1));
    }
  }, 3_600_000);
});
