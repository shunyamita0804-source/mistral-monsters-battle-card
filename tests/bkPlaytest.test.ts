import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPlayCard, getSkill, skillsOf } from '../src/data/cards.ts';
import { BOOSTERS, type BoosterKey } from '../src/data/introV2.ts';
import type { CpuSkill } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, createBattle, habitatOf, isDraggedUnder, isTideActive, targetsFor, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';
import { AJ_QA_SKILLS, AJ_SKILLS } from '../src/data/skillRebuildAJ.ts';
import { BOX_KEYS, emptyBalanceCount, makeBalancePlayer, playBalanceMatch, summarizeBalance } from './support/balancePlayer.ts';

/**
 * 指示書 BK の試遊（数字は報告するだけ。カード・ルールの数字は変えない）。PLAYTEST=回数（ふだんは 1）・PLAYTEST_OUT に JSON。PLAYTEST_PART=swap|party で片方だけ。
 * 1. 1体入れ替え（指示書 AJ・AX・BH と同じやり方：3箱 × 3か所 × 相手の3箱 × 先攻・後攻 × 回数）：クロシオ。レア抜き・レアあり。腕前 A どうし
 * 2. ナディアの海のパーティー（クロシオ・カルシェル・ミュロル。16枚ずつレアあり＋カルシェルの箱のサポート）：
 *    最初の3つの箱（腕前 A どうし）・S の目安のプレイヤー（tests/support/balancePlayer.ts。3箱。プレイヤーは腕前 B・パーティーは腕前 A・ライフの倍率 1）との、パーティーの勝つ割合
 * 3. 新しい効果（クロシオの側。1対戦あたり）：ひきずりこむが当たった回数・水中にした相手がいた手番の数・おおうずしおを使えた回数と平均の当たった数・
 *    みちしおの回数・よびごえのあとに回避できた割合
 * 4. 山札切れで決まった対戦の割合（deckOut）
 */
const GAMES = Number(process.env.PLAYTEST ?? 1);
const PART = process.env.PLAYTEST_PART ?? 'all';
const KEYS = BOOSTERS.map((b) => b.key);
const MAX_STEPS = 6000;
const SKILL: CpuSkill = (process.env.PLAYTEST_SKILL ?? 'A') as CpuSkill;
const KUROSHIO = 'mon-kuroshio';
const PARTY = [KUROSHIO, 'mon-kalshell', 'mon-myurol'] as const;

/** 入れ替えの16枚（tests/bhPlaytest.test.ts の bhPlaytest16 と同じ：レア抜き〔またはレアあり〕を1枚ずつ、足りない分は安い攻撃からもう1枚ずつ） */
function bhPlaytest16(monsterId: string, withRare: boolean): { id: string; copies: number }[] {
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

/** ナディアの海のパーティー（16枚ずつ・レアあり）＋ カルシェルのいる箱のサポート */
export function seaPartyDeck(): Deck {
  const box = BOOSTERS.find((b) => b.monsters.includes('mon-kalshell'));
  if (!box) throw new Error('カルシェルの箱');
  const base = boosterDeck(box.key);
  const own = new Set(base.monsters.flatMap((m) => [...bhPlaytest16(m, true).map((c) => c.id)]));
  const supports = base.skills.filter((id) => getPlayCard(id).kind === 'support' && !own.has(id));
  const skills = PARTY.flatMap((m) => bhPlaytest16(m, true).flatMap((c) => Array<string>(c.copies).fill(c.id)));
  return { monsters: [...PARTY], skills: [...skills, ...supports].slice(0, base.skills.length) };
}

interface Count {
  games: number;
  wins: number;
  deckOut: number;
  turns: number;
  /** ひきずりこむが当たった（水中にした）回数 */
  dragHits: number;
  /** 自分の手番のはじめに、ひきずりこむで水中にした相手がいた手番 */
  draggedTurns: number;
  /** 自分の手番のはじめに、水中にした相手（ひきずりこむ・自分のみちしお）がいた手番 */
  wetTurns: number;
  /** おおうずしおを使えた手番（自分の手番のはじめに、手札のおおうずしおが使えた） */
  whirlUsable: number;
  whirlUsed: number;
  whirlTargets: number;
  tide: number;
  call: number;
  /** よびごえの次の相手の手番に、クロシオが狙われた攻撃の数・そのうち回避した数 */
  callAttacks: number;
  callEvaded: number;
}
const empty = (): Count => ({ games: 0, wins: 0, deckOut: 0, turns: 0, dragHits: 0, draggedTurns: 0, wetTurns: 0, whirlUsable: 0, whirlUsed: 0, whirlTargets: 0, tide: 0, call: 0, callAttacks: 0, callEvaded: 0 });

/** 1対戦。数えるのは me の側（クロシオのいる側）の新しい効果。勝ち＝me の勝ち */
function play(a: Deck, b: Deck, seed: number, first: Side, c: Count, me: Side = 'player', skills: Record<Side, CpuSkill> = { player: SKILL, opponent: SKILL }, lifeScale = 1): void {
  let s: BattleState = createBattle({ name: 'A', deck: a, ...(me === 'player' ? {} : { lifeScale }) }, { name: 'B', deck: b, ...(me === 'opponent' ? { lifeScale } : {}) }, seed, first);
  const foe: Side = me === 'player' ? 'opponent' : 'player';
  let seenTurn = -1;
  let callTurn = -1;
  for (let i = 0; i < MAX_STEPS && s.phase !== 'ended'; i++) {
    const side = actingSide(s);
    if (!side) break;
    // 自分の手番のはじめ（まだだれも動いていない）
    if (s.phase === 'main' && s.active === me && s.turn !== seenTurn && s.sides[me].monsters.every((m) => !m.acted)) {
      seenTurn = s.turn;
      const foes = s.sides[foe].monsters.filter((m) => m.life > 0);
      if (foes.some((m) => isDraggedUnder(s, m))) c.draggedTurns++;
      const myTide = isTideActive(s) && s.field?.owner === me;
      if (foes.some((m) => isDraggedUnder(s, m)) || (myTide && foes.some((m) => habitatOf(s, m) === 'water'))) c.wetTurns++;
      if (s.sides[me].hand.some((h) => {
        const k = getPlayCard(h.cardId);
        return k.kind === 'skill' && k.effect.type === 'attack' && !!k.effect.waterOnly && targetsFor(s, me, k).length > 0;
      })) c.whirlUsable++;
    }
    const action = chooseAction(s, side, 'normal', skills[side]);
    if (!action) break;
    if (side === me && action.type === 'useCard' && s.phase === 'main') {
      const used = s.sides[me].hand.find((x) => x.uid === action.cardUid);
      const k = used ? getPlayCard(used.cardId) : null;
      if (k?.kind === 'skill' && k.monsterId === KUROSHIO) {
        if (k.effect.type === 'attack' && k.effect.waterOnly) {
          c.whirlUsed++;
          c.whirlTargets += targetsFor(s, me, k).length;
        }
        if (k.effect.type === 'tide') c.tide++;
        if (k.effect.type === 'taunt') {
          c.call++;
          callTurn = s.turn + 1;
        }
      }
    }
    // 守りを終える（攻撃1回のダメージが決まる）とき：よびごえの次の相手の手番に、クロシオが狙われた攻撃
    if (action.type === 'defend' && action.cardUid === null && s.pending && s.pending.attacker === foe && s.turn === callTurn) {
      const target = s.sides[me].monsters.find((m) => m.uid === s.pending?.targetUid);
      if (target?.cardId === KUROSHIO) {
        c.callAttacks++;
        if (s.pending.responses.some((id) => getSkill(id).effect.type === 'evade')) c.callEvaded++;
      }
    }
    const logBefore = s.log.length;
    const attacker = s.active;
    s = applyAction(s, action);
    if (attacker === me) c.dragHits += s.log.slice(logBefore).filter((l) => l.text.includes('ひきずりこまれた')).length;
  }
  c.games++;
  c.turns += s.turn;
  if (s.winner === me) c.wins++;
  if (s.endReason === 'deckOut') c.deckOut++;
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);
const per = (n: number, of: number): number => Math.round((n / Math.max(1, of)) * 1000) / 1000;
const summary = (c: Count): Record<string, number> => ({
  games: c.games,
  win: pct(c.wins, c.games),
  deckOut: pct(c.deckOut, c.games),
  avgTurns: Math.round((c.turns / Math.max(1, c.games)) * 10) / 10,
  dragHitsPerGame: per(c.dragHits, c.games),
  draggedTurnsPerGame: per(c.draggedTurns, c.games),
  wetTurnsPerGame: per(c.wetTurns, c.games),
  whirlUsableTurnsPerGame: per(c.whirlUsable, c.games),
  whirlUsedPerGame: per(c.whirlUsed, c.games),
  whirlTargetsPerUse: per(c.whirlTargets, c.whirlUsed),
  tidePerGame: per(c.tide, c.games),
  callPerGame: per(c.call, c.games),
  callAttacks: c.callAttacks,
  callEvadedRate: pct(c.callEvaded, c.callAttacks),
});

function swapSlots(): { key: BoosterKey; slot: number }[] {
  return BOOSTERS.filter((b) => !b.monsters.includes(KUROSHIO)).flatMap((b) => [0, 1, 2].map((slot) => ({ key: b.key, slot })));
}

describe('BK の試遊', () => {
  it('入れ替えの16枚・海のパーティーのデッキは山札60枚でルールに合う', () => {
    for (const withRare of [false, true]) expect(bhPlaytest16(KUROSHIO, withRare).reduce((n, c) => n + c.copies, 0)).toBe(16);
    for (const { key, slot } of swapSlots()) {
      const d = swapDeck(key, slot, KUROSHIO, bhPlaytest16(KUROSHIO, false));
      expect(d.skills).toHaveLength(60);
      expect(isDeckValid(d, countCards([...d.monsters, ...d.skills])), `${key}#${slot}`).toBe(true);
    }
    const sea = seaPartyDeck();
    expect(sea.skills).toHaveLength(60);
    expect(isDeckValid(sea, countCards([...sea.monsters, ...sea.skills]))).toBe(true);
  });

  it(`1体入れ替え・海のパーティー（各組み合わせ ${GAMES} 回）`, () => {
    const out: Record<string, unknown> = { games: GAMES, skill: SKILL };
    let seed = 1;
    let total = 0;
    if (PART === 'all' || PART === 'swap') {
      for (const withRare of [false, true]) {
        const c = empty();
        for (const { key, slot } of swapSlots()) {
          const deck = swapDeck(key, slot, KUROSHIO, bhPlaytest16(KUROSHIO, withRare));
          for (const opp of KEYS) for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(deck, boosterDeck(opp), seed++, first, c);
        }
        out[withRare ? 'swapRare' : 'swap'] = summary(c);
        total += c.games;
      }
    }
    if (PART === 'all' || PART === 'party') {
      const sea = seaPartyDeck();
      const party: Record<string, unknown> = {};
      // 最初の3つの箱（腕前 A どうし）。海のパーティーは player の側
      for (const key of KEYS) {
        const c = empty();
        for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(sea, boosterDeck(key), seed++, first, c);
        party[`box:${key}`] = summary(c);
        total += c.games;
      }
      // S の目安のプレイヤー（腕前 B）と海のパーティー（腕前 A・ライフの倍率 1）。プレイヤーの勝つ割合と、パーティーの側の効果の回数
      for (const key of BOX_KEYS) {
        const player = makeBalancePlayer(key, 'S');
        const c = empty();
        for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(player.deck, sea, seed++, first, c, 'opponent', { player: 'B', opponent: 'A' });
        // win はパーティーの勝つ割合（プレイヤーの勝つ割合＝100 − win − 引き分け）
        party[`S:${key}`] = { playerMonsters: player.monsters, ...summary(c) };
        total += c.games;
      }
      out.party = party;
      // 4. 山札切れ（指示書 AU と同じ表。tests/support/balancePlayer.ts の playBalanceMatch）：相手（海のパーティー・腕前 A）から見たプレイヤーの側の数。
      //    最初の3つの箱（プレイヤー腕前 A）・S の目安のプレイヤー（腕前 B）
      const au: Record<string, unknown> = {};
      for (const key of KEYS) {
        const bc = emptyBalanceCount();
        for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) playBalanceMatch(boosterDeck(key), { deck: sea, lifeScale: 1, skill: 'A' }, seed++, first, bc, 'A');
        au[`box:${key}`] = summarizeBalance(bc);
        total += bc.games;
      }
      for (const key of BOX_KEYS) {
        const bc = emptyBalanceCount();
        const player = makeBalancePlayer(key, 'S');
        for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) playBalanceMatch(player.deck, { deck: sea, lifeScale: 1, skill: 'A' }, seed++, first, bc, 'B');
        au[`S:${key}`] = summarizeBalance(bc);
        total += bc.games;
      }
      out.deckOutTable = au;
    }
    const file = process.env.PLAYTEST_OUT;
    if (file) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(out, null, 1));
    }
    expect(total).toBeGreaterThan(0);
  }, 7_200_000);
});
