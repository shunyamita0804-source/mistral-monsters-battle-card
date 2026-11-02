import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPlayCard } from '../src/data/cards.ts';
import type { BoosterKey } from '../src/data/introV2.ts';
import type { CpuSkill } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, cardUsability, createBattle, isTideActive, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';
import { SOUKAI_TIDE_T1 } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';

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
/**
 * 試遊用の中身（ゲームの箱は変えない）。PLAYTEST_VARIANT で選ぶ。足し引きは「いまのゲームの箱」からの枚数。
 * 2026-11-02 指示書 AP でゲームの箱が V1（烈火のラズックの直し）になったので、V1 がいまの箱（足し引きなし）。
 * - V0：指示書 AO のときの箱（V1 の直しを戻す：とびかかり 2→3・みだれづめ 1→2・おびきよせ 2→1・ダストキック 2→1）
 * - V1：いまの箱（指示書 AP）
 * - V2：V1 ＋ 烈火のガウル 連続つつき 3→2、威嚇 2→3（指示書 AO）
 * - T1：V1 ＋ 蒼海のカルシェル はさむ 3→2・すなをほる 2→1・みちしお 0→1・タイダルクラッシュ 0→1（指示書 AP）
 * - T2：V1 ＋ 蒼海のカルシェル はさむ 3→2・すなをほる 2→1・みちしお 0→2（指示書 AP）
 * - F1：V1 ＋ 蒼海のフォルン こもりうた 2→1・つのでつく 2→3（指示書 AP・参考）
 * - TF：T1 ＋ F1
 */
export type PlaytestVariant = 'V0' | 'V1' | 'V2' | 'T1' | 'T2' | 'F1' | 'TF';
const VARIANT = (process.env.PLAYTEST_VARIANT ?? 'V1') as PlaytestVariant;
/** T1 は確かめ用の入口（?qa=1&lab=soukai）と同じ足し引き（src/game/battle/playtest.ts） */
const T1_SOUKAI = SOUKAI_TIDE_T1;
const F1_SOUKAI = { 'skl-forn-08': -1, 'skl-forn-02': 1 };
export const VARIANT_CHANGES: Record<PlaytestVariant, Partial<Record<BoosterKey, Record<string, number>>>> = {
  V0: { 'booster-2': { 'skl-lazuck-03': 1, 'skl-lazuck-04': 1, 'skl-lazuck-07': -1, 'skl-lazuck-08': -1 } },
  V1: {},
  V2: { 'booster-2': { 'skl-gauul14-02': -1, 'skl-gauul14-10': 1 } },
  T1: { 'booster-3': T1_SOUKAI },
  T2: { 'booster-3': { 'skl-kalshell-01': -1, 'skl-kalshell-10': -1, 'skl-kalshell-15': 2 } },
  F1: { 'booster-3': F1_SOUKAI },
  TF: { 'booster-3': { ...T1_SOUKAI, ...F1_SOUKAI } },
};
/** 試遊の箱の中身（VARIANT の足し引きをした山札。枚数は60のまま） */
export function playtestDeck(key: BoosterKey, variant: PlaytestVariant = VARIANT): Deck {
  const deck = boosterDeck(key);
  const change = VARIANT_CHANGES[variant][key];
  if (!change) return deck;
  const skills = [...deck.skills];
  for (const [id, n] of Object.entries(change)) {
    if (n > 0) for (let i = 0; i < n; i++) skills.push(id);
    else for (let i = 0; i < -n; i++) skills.splice(skills.indexOf(id), 1);
  }
  return { ...deck, skills };
}

/** みちしお・タイダルクラッシュ（指示書 AP）：箱ごとの数 */
interface TideStats {
  /** みちしおを使った回数 */
  tide: number;
  /** タイダルクラッシュを使った回数（場が水中のとき・水中でないとき）と、水中のときに与えたダメージの合計 */
  tidalWater: number;
  tidalDry: number;
  tidalWaterDamage: number;
  /** 自分の攻撃の番の終わりに、場が水中で、タイダルクラッシュを手札に持ち、動けるカルシェルがいて、マナも足りたのに使わなかった回数 */
  heldInWater: number;
  /** 自分の攻撃の番の終わりに、手札にみちしおがあった回数・みちしおとタイダルクラッシュの両方があった回数（CPU が使う条件がそろう回数の目安） */
  tideInHand: number;
  bothInHand: number;
}
const TIDE = 'skl-kalshell-15';
const TIDAL = 'skl-kalshell-08';
const emptyTide = (): TideStats => ({ tide: 0, tidalWater: 0, tidalDry: 0, tidalWaterDamage: 0, heldInWater: 0, tideInHand: 0, bothInHand: 0 });
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
function playOne(a: BoosterKey, b: BoosterKey, seed: number, first: Side, use: Record<BoosterKey, Record<string, number>>, odd: Oddities, chained: Record<BoosterKey, number>, tides: Record<BoosterKey, TideStats>): BattleState {
  const box: Record<Side, BoosterKey> = { player: a, opponent: b };
  let state = createBattle({ name: 'A', deck: playtestDeck(a) }, { name: 'B', deck: playtestDeck(b) }, seed, first);
  let steps = 0;
  /** 水中で使ったタイダルクラッシュの、守りが終わるまでの記録（狙われた子とそのときのライフ） */
  let tidal: { box: BoosterKey; targetUid: string; before: number } | null = null;
  const lifeOf = (st: BattleState, uid: string): number => [...st.sides.player.monsters, ...st.sides.opponent.monsters].find((m) => m.uid === uid)?.life ?? 0;
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
        if (action.type === 'useCard' && card.cardId === TIDE) tides[box[side]].tide += 1;
        if (action.type === 'useCard' && card.cardId === TIDAL) {
          if (isTideActive(state)) {
            tides[box[side]].tidalWater += 1;
            if (action.targetUid) tidal = { box: box[side], targetUid: action.targetUid, before: lifeOf(state, action.targetUid) };
          } else tides[box[side]].tidalDry += 1;
        }
        // Wひっかきの2枚目（この手番に Wひっかきを1回使ったツムジが、もう1枚使う）
        if (action.type === 'useCard' && card.cardId === W_SCRATCH && state.sides[side].monsters.some((m) => m.acted && m.chain?.turn === state.turn && m.chain.cardId === W_SCRATCH)) {
          chained[box[side]] += 1;
        }
      }
    }
    // 攻撃の番を終えるとき：水中で、タイダルクラッシュを手札に持ち、動けるカルシェルがいて、マナも足りたのに使っていない
    if (action.type === 'endAttack') {
      const ids = state.sides[side].hand.map((h) => h.cardId);
      if (ids.includes(TIDE)) tides[box[side]].tideInHand += 1;
      if (ids.includes(TIDE) && ids.includes(TIDAL)) tides[box[side]].bothInHand += 1;
    }
    if (action.type === 'endAttack' && isTideActive(state)) {
      const me = state.sides[side];
      const held = me.hand.find((h) => h.cardId === TIDAL);
      const canAct = me.monsters.some((m) => m.cardId === 'mon-kalshell' && m.life > 0 && !m.acted);
      if (held && canAct && cardUsability(state, side, held.uid).usable) tides[box[side]].heldInWater += 1;
    }
    const next = applyAction(state, action);
    if (next === state) odd.noProgress++;
    state = next;
    if (tidal && state.phase !== 'defense') {
      tides[tidal.box].tidalWaterDamage += Math.max(0, tidal.before - lifeOf(state, tidal.targetUid));
      tidal = null;
    }
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
  it('試遊用の中身（V0・V1・V2・T1・T2・F1・TF）は山札60枚・同じカード3枚まで・ルールに合う。V1 はゲームの箱と同じ（指示書 AP）', () => {
    for (const v of ['V0', 'V1', 'V2', 'T1', 'T2', 'F1', 'TF'] as const) {
      for (const key of ['booster-1', 'booster-2', 'booster-3'] as const) {
        const d = playtestDeck(key, v);
        expect(d.skills, `${v} ${key}`).toHaveLength(60);
        expect(Math.max(...Object.values(countCards(d.skills))), `${v} ${key}`).toBeLessThanOrEqual(3);
        expect(isDeckValid(d, countCards([...d.monsters, ...d.skills])), `${v} ${key}`).toBe(true);
      }
    }
    for (const key of ['booster-1', 'booster-2', 'booster-3'] as const) expect(playtestDeck(key, 'V1')).toEqual(boosterDeck(key));
    const c = (v: PlaytestVariant, key: BoosterKey, ids: string[]) => ids.map((id) => countCards(playtestDeck(key, v).skills)[id] ?? 0);
    const laz = ['skl-lazuck-03', 'skl-lazuck-04', 'skl-lazuck-07', 'skl-lazuck-08'];
    expect(c('V0', 'booster-2', laz)).toEqual([3, 2, 1, 1]);
    expect(c('V1', 'booster-2', laz)).toEqual([2, 1, 2, 2]);
    expect(c('V2', 'booster-2', ['skl-gauul14-02', 'skl-gauul14-10'])).toEqual([2, 3]);
    const kal = ['skl-kalshell-01', 'skl-kalshell-10', 'skl-kalshell-15', 'skl-kalshell-08'];
    expect(c('V1', 'booster-3', kal)).toEqual([3, 2, 0, 0]);
    expect(c('T1', 'booster-3', kal)).toEqual([2, 1, 1, 1]);
    expect(c('T2', 'booster-3', kal)).toEqual([2, 1, 2, 0]);
    expect(c('F1', 'booster-3', ['skl-forn-08', 'skl-forn-02'])).toEqual([1, 3]);
    expect(c('TF', 'booster-3', [...kal, 'skl-forn-08', 'skl-forn-02'])).toEqual([2, 1, 1, 1, 1, 3]);
  });

  it(`3組み合わせ × 2方向 × ${GAMES} 回（腕前 ${SKILL} どうし）`, () => {
    const boxes: Record<BoosterKey, Tally> = { 'booster-1': tally(), 'booster-2': tally(), 'booster-3': tally() };
    const use: Record<BoosterKey, Record<string, number>> = { 'booster-1': {}, 'booster-2': {}, 'booster-3': {} };
    const odd: Oddities = { unusablePick: 0, noProgress: 0, timeout: 0, lifeOutOfRange: 0 };
    const chained: Record<BoosterKey, number> = { 'booster-1': 0, 'booster-2': 0, 'booster-3': 0 };
    const tides: Record<BoosterKey, TideStats> = { 'booster-1': emptyTide(), 'booster-2': emptyTide(), 'booster-3': emptyTide() };
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
          const end = playOne(a, b, seed, first, use, odd, chained, tides);
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
      variant: VARIANT,
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
      // みちしお・タイダルクラッシュ（1対戦あたり。箱ごと。指示書 AP）
      tidePerGame: Object.fromEntries(
        (Object.keys(boxes) as BoosterKey[]).map((k) => {
          const g = Math.max(1, boxes[k].games);
          const t = tides[k];
          const r = (n: number) => Math.round((n / g) * 100) / 100;
          return [k, { tide: r(t.tide), tidalInWater: r(t.tidalWater), tidalDry: r(t.tidalDry), tidalWaterDamage: r(t.tidalWaterDamage), heldInWater: r(t.heldInWater), tideInHand: r(t.tideInHand), bothInHand: r(t.bothInHand) }];
        }),
      ),
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
