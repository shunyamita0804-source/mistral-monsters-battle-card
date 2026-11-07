import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPlayCard, skillsOf } from '../src/data/cards.ts';
import { BOOSTERS, type BoosterKey } from '../src/data/introV2.ts';
import { AJ_QA_SKILLS, AJ_SKILLS } from '../src/data/skillRebuildAJ.ts';
import type { CpuSkill } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, cardUsability, createBattle, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/**
 * 指示書 BQ の試遊（数字は報告するだけ。カード・ルールの数字は変えない）。PLAYTEST=回数（ふだんは 1）・PLAYTEST_OUT に JSON。PLAYTEST_SUBJECT でモンスターを変えられる（ふだんはステラード。タイラントとくらべる）。
 * 1体入れ替え（指示書 AJ〜BP と同じやり方：3箱 × 3か所 × 相手の3箱 × 先攻・後攻 × 回数）。レア抜き・レアあり。腕前 A どうし。
 * 調べるもの（1対戦あたり）：あしばらい（使った・空中の相手しかいなくて使えなかった手番）・ふくつのいちげき・きしのとつげき（回避されて反動）・しゅうちゅう（マナが減らずにすんだ）・
 * 決着の理由・ステラードが倒された割合・対戦の終わりの残り LIFE の平均・相手の箱ごとの勝率。
 * PLAYTEST_PART=drain：マナを減らす相手（ノウス・リリル・ノビトンを1体入れ替えた相手の箱）との勝率
 */
const GAMES = Number(process.env.PLAYTEST ?? 1);
const KEYS = BOOSTERS.map((b) => b.key);
const MAX_STEPS = 6000;
const SKILL: CpuSkill = (process.env.PLAYTEST_SKILL ?? 'A') as CpuSkill;
const SUBJECT = process.env.PLAYTEST_SUBJECT ?? 'mon-stellard';
const DRAIN_FOES = ['mon-nous', 'mon-lilil', 'mon-nobiton'];

/** 入れ替えの16枚（tests/bhPlaytest.test.ts の bhPlaytest16 と同じ） */
function playtest16(monsterId: string, withRare: boolean): { id: string; copies: number }[] {
  const rare = new Set((AJ_SKILLS[monsterId] ?? AJ_QA_SKILLS[monsterId] ?? []).filter((r) => r.rare).map((r) => r.id));
  const cards = skillsOf(monsterId).filter((k) => withRare || !rare.has(k.id));
  const counts: Record<string, number> = Object.fromEntries(cards.map((k) => [k.id, 1]));
  let n = cards.length;
  const attacks = cards.filter((k) => k.effect.type === 'attack').sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
  for (let round = 0; n < 16 && round < 2; round++) {
    for (const k of attacks) {
      if (n >= 16) break;
      counts[k.id] = (counts[k.id] ?? 0) + 1;
      n++;
    }
  }
  return cards.map((k) => ({ id: k.id, copies: counts[k.id] ?? 1 }));
}

interface Count {
  games: number;
  wins: number;
  koWins: number;
  koLosses: number;
  deckOutWins: number;
  deckOutLosses: number;
  other: number;
  turns: number;
  sweep: number;
  sweepBlocked: number;
  last: number;
  charge: number;
  chargeRecoil: number;
  focus: number;
  focusBlocked: number;
  subjectDown: number;
  subjectLife: number;
  byFoe: Record<string, { games: number; wins: number }>;
}
const empty = (): Count => ({
  games: 0, wins: 0, koWins: 0, koLosses: 0, deckOutWins: 0, deckOutLosses: 0, other: 0, turns: 0, sweep: 0, sweepBlocked: 0, last: 0, charge: 0, chargeRecoil: 0,
  focus: 0, focusBlocked: 0, subjectDown: 0, subjectLife: 0, byFoe: {},
});

function play(a: Deck, b: Deck, seed: number, first: Side, c: Count, foeLabel: string): void {
  let s: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b }, seed, first);
  let seenTurn = -1;
  for (let i = 0; i < MAX_STEPS && s.phase !== 'ended'; i++) {
    const side = actingSide(s);
    if (!side) break;
    // 自分の攻撃の手番のはじめ：手札にあしばらいがあって「空中の相手には当たらない」で使えなかったか
    if (s.active === 'player' && s.phase === 'main' && s.turn !== seenTurn) {
      seenTurn = s.turn;
      const sweepCard = s.sides.player.hand.find((h) => getPlayCard(h.cardId).kind === 'skill' && (getPlayCard(h.cardId) as { effect: { notAir?: boolean } }).effect.notAir);
      if (sweepCard && cardUsability(s, 'player', sweepCard.uid).reason === '空中の相手には当たらない技です') c.sweepBlocked++;
    }
    const action = chooseAction(s, side, 'normal', SKILL);
    if (!action) break;
    if (side === 'player' && action.type === 'useCard' && s.phase === 'main') {
      const used = s.sides.player.hand.find((x) => x.uid === action.cardUid);
      const k = used ? getPlayCard(used.cardId) : null;
      if (k?.kind === 'skill' && k.monsterId === SUBJECT) {
        if (k.effect.type === 'focus') c.focus++;
        if (k.effect.type === 'attack' && k.effect.notAir) c.sweep++;
        if (k.effect.type === 'attack' && k.effect.lowLifeMax !== undefined) c.last++;
        if (k.effect.type === 'attack' && k.effect.selfDamageOnEvade) c.charge++;
      }
    }
    const logBefore = s.log.length;
    s = applyAction(s, action);
    for (const l of s.log.slice(logBefore).map((x) => x.text)) {
      if (l.endsWith('は突撃をかわされ、体勢をくずした！（LIFE−2）')) c.chargeRecoil++;
      // 減らす効果は守りの手番の終わり（守る側の行動）で起きるので、どちらの行動でも数える（しゅうちゅうを持つのはステラードの側だけ）
      if (l === 'しゅうちゅうでマナは減らなかった。') c.focusBlocked++;
    }
  }
  c.games++;
  c.turns += s.turn;
  const won = s.winner === 'player';
  if (won) c.wins++;
  if (s.endReason === 'knockout') won ? c.koWins++ : c.koLosses++;
  else if (s.endReason === 'deckOut') won ? c.deckOutWins++ : c.deckOutLosses++;
  else c.other++;
  const me = s.sides.player.monsters.find((m) => m.cardId === SUBJECT);
  if (me && me.life <= 0) c.subjectDown++;
  c.subjectLife += me?.life ?? 0;
  const f = (c.byFoe[foeLabel] ??= { games: 0, wins: 0 });
  f.games++;
  if (won) f.wins++;
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);
const per = (n: number, of: number): number => Math.round((n / Math.max(1, of)) * 1000) / 1000;
const summary = (c: Count): Record<string, unknown> => ({
  games: c.games,
  win: pct(c.wins, c.games),
  end: { koWin: pct(c.koWins, c.games), deckOutWin: pct(c.deckOutWins, c.games), koLoss: pct(c.koLosses, c.games), deckOutLoss: pct(c.deckOutLosses, c.games), other: pct(c.other, c.games) },
  avgTurns: Math.round((c.turns / Math.max(1, c.games)) * 10) / 10,
  sweepPerGame: per(c.sweep, c.games),
  sweepBlockedPerGame: per(c.sweepBlocked, c.games),
  lastStandPerGame: per(c.last, c.games),
  chargePerGame: per(c.charge, c.games),
  chargeRecoilPerGame: per(c.chargeRecoil, c.games),
  focusPerGame: per(c.focus, c.games),
  focusBlockedPerGame: per(c.focusBlocked, c.games),
  subjectDownRate: pct(c.subjectDown, c.games),
  subjectAvgLifeLeft: Math.round((c.subjectLife / Math.max(1, c.games)) * 100) / 100,
  byFoe: Object.fromEntries(Object.entries(c.byFoe).map(([k, v]) => [k, pct(v.wins, v.games)])),
});

function swapSlots(): { key: BoosterKey; slot: number }[] {
  return BOOSTERS.filter((b) => !b.monsters.includes(SUBJECT)).flatMap((b) => [0, 1, 2].map((slot) => ({ key: b.key, slot })));
}

describe('BQ の試遊', () => {
  it('入れ替えの16枚は16枚。入れ替えたデッキは山札60枚でルールに合う', () => {
    for (const withRare of [false, true]) expect(playtest16(SUBJECT, withRare).reduce((n, x) => n + x.copies, 0)).toBe(16);
    for (const { key, slot } of swapSlots()) {
      const d = swapDeck(key, slot, SUBJECT, playtest16(SUBJECT, false));
      expect(d.skills).toHaveLength(60);
      expect(isDeckValid(d, countCards([...d.monsters, ...d.skills])), `${key}#${slot}`).toBe(true);
    }
  });

  it(`1体入れ替え（各組み合わせ ${GAMES} 回）`, () => {
    const out: Record<string, unknown> = { games: GAMES, skill: SKILL, subject: SUBJECT };
    let seed = 1;
    let total = 0;
    const parts = (process.env.PLAYTEST_PART ?? 'swap,swapRare').split(',');
    for (const withRare of [false, true]) {
      if (!parts.includes(withRare ? 'swapRare' : 'swap')) continue;
      const c = empty();
      for (const { key, slot } of swapSlots()) {
        const deck = swapDeck(key, slot, SUBJECT, playtest16(SUBJECT, withRare));
        for (const opp of KEYS) for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(deck, boosterDeck(opp), seed++, first, c, opp);
      }
      out[withRare ? 'swapRare' : 'swap'] = summary(c);
      total += c.games;
    }
    // マナを減らす相手：相手の箱の1体（0番目）を、ノウス・リリル・ノビトン（レアあり）に入れ替えた箱
    if (parts.includes('drain')) {
      const c = empty();
      for (const { key, slot } of swapSlots()) {
        const deck = swapDeck(key, slot, SUBJECT, playtest16(SUBJECT, true));
        for (const foe of DRAIN_FOES) {
          for (const opp of KEYS) {
            const foeDeck = swapDeck(opp, 0, foe, playtest16(foe, true));
            for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(deck, foeDeck, seed++, first, c, foe);
          }
        }
      }
      out.drain = summary(c);
      total += c.games;
    }
    const file = process.env.PLAYTEST_OUT;
    if (file) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(out, null, 1));
    }
    expect(total).toBeGreaterThan(0);
  }, 7_200_000);
});
