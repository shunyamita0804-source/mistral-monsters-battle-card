import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPlayCard, skillsOf } from '../src/data/cards.ts';
import { BOOSTERS, type BoosterKey } from '../src/data/introV2.ts';
import { AJ_QA_SKILLS, AJ_SKILLS } from '../src/data/skillRebuildAJ.ts';
import type { CpuSkill } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, attackPower, createBattle, findMonster, isMenaced, roarOf, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

import { cardName } from '../src/i18n/content.ts';
/**
 * 指示書 BP の試遊（数字は報告するだけ。カード・ルールの数字は変えない）。PLAYTEST=回数（ふだんは 1）・PLAYTEST_OUT に JSON。PLAYTEST_SUBJECT でモンスターを変えられる（ふだんはベニオウ）。
 * 1体入れ替え（指示書 AJ〜BN と同じやり方：3箱 × 3か所 × 相手の3箱 × 先攻・後攻 × 回数）。レア抜き・レアあり。腕前 A どうし。
 * 調べるもの（ベニオウの側・1対戦あたり）：おたけびの回数・2倍になったちから技の数と平均ダメージ・その攻撃で相手が倒れた割合・満タンの相手を1回で倒した割合（2倍の攻撃・ベニオウの攻撃すべて）・
 * いかりが効いた回数・おにのいあつの回数と、かかった相手への攻撃（回避できずに当たった数・手札に回避があったのに使えなかった数）。決着の理由。
 * PLAYTEST_PART=wisdom：かしこさ技の多い相手（ノウス・セレフィーン・ラディエルを1体入れ替えた相手の箱）との勝率
 */
const GAMES = Number(process.env.PLAYTEST ?? 1);
const KEYS = BOOSTERS.map((b) => b.key);
const MAX_STEPS = 6000;
const SKILL: CpuSkill = (process.env.PLAYTEST_SKILL ?? 'A') as CpuSkill;
const SUBJECT = process.env.PLAYTEST_SUBJECT ?? 'mon-beniou';
const WISDOM_FOES = ['mon-nous', 'mon-serephine', 'mon-radiel'];

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
  roar: number;
  doubled: number;
  doubledDamage: number;
  doubledKo: number;
  doubledOneShot: number;
  attacks: number;
  attackKo: number;
  attackOneShot: number;
  rage: number;
  menace: number;
  menacedAttacks: number;
  menacedHits: number;
  menacedBlockedEvade: number;
  byFoe: Record<string, { games: number; wins: number }>;
}
const empty = (): Count => ({
  games: 0, wins: 0, koWins: 0, koLosses: 0, deckOutWins: 0, deckOutLosses: 0, other: 0, turns: 0, roar: 0, doubled: 0, doubledDamage: 0, doubledKo: 0, doubledOneShot: 0,
  attacks: 0, attackKo: 0, attackOneShot: 0, rage: 0, menace: 0, menacedAttacks: 0, menacedHits: 0, menacedBlockedEvade: 0, byFoe: {},
});

function play(a: Deck, b: Deck, seed: number, first: Side, c: Count, foeLabel: string): void {
  let s: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b }, seed, first);
  /** ベニオウの攻撃（守りが終わったら結果を見る） */
  let mine: { targetUid: string; before: number; full: boolean; doubled: boolean } | null = null;
  /** おにのいあつがかかった相手への、自分の側の攻撃 */
  let menaced: { targetUid: string; evadeInHand: boolean } | null = null;
  for (let i = 0; i < MAX_STEPS && s.phase !== 'ended'; i++) {
    const side = actingSide(s);
    if (!side) break;
    const action = chooseAction(s, side, 'normal', SKILL);
    if (!action) break;
    if (side === 'player' && action.type === 'useCard' && s.phase === 'main') {
      const used = s.sides.player.hand.find((x) => x.uid === action.cardUid);
      const k = used ? getPlayCard(used.cardId) : null;
      const user = action.userUid ? findMonster(s, action.userUid)?.monster : undefined;
      const target = action.targetUid ? findMonster(s, action.targetUid)?.monster : undefined;
      if (k?.kind === 'skill' && k.monsterId === SUBJECT) {
        if (k.effect.type === 'roar') c.roar++;
        if (k.effect.type === 'menace') c.menace++;
        if (k.effect.type === 'attack' && target && user) {
          const doubled = roarOf(s, user, k);
          mine = { targetUid: target.uid, before: target.life, full: target.life === target.maxLife, doubled };
          if (doubled) {
            c.doubled++;
            c.doubledDamage += attackPower(s, k, user, target);
          }
        }
      }
      if (k?.kind === 'skill' && k.effect.type === 'attack' && target && isMenaced(s, target)) {
        const foeHand = s.sides.opponent.hand.map((h) => getPlayCard(h.cardId));
        menaced = { targetUid: target.uid, evadeInHand: foeHand.some((x) => x.kind === 'skill' && x.effect.type === 'evade' && x.monsterId === target.cardId) };
      }
    }
    const logBefore = s.log.length;
    s = applyAction(s, action);
    c.rage += s.log.slice(logBefore).filter((l) => l.text.startsWith(`${cardName(SUBJECT)}のいかり！`)).length;
    if (mine && s.phase !== 'defense') {
      const after = findMonster(s, mine.targetUid)?.monster.life ?? 0;
      c.attacks++;
      const ko = mine.before > 0 && after === 0;
      if (ko) c.attackKo++;
      if (ko && mine.full) c.attackOneShot++;
      if (mine.doubled && ko) c.doubledKo++;
      if (mine.doubled && ko && mine.full) c.doubledOneShot++;
      mine = null;
    }
    if (menaced && s.phase !== 'defense') {
      c.menacedAttacks++;
      const t = findMonster(s, menaced.targetUid)?.monster;
      if (t) c.menacedHits++;
      if (menaced.evadeInHand) c.menacedBlockedEvade++;
      menaced = null;
    }
  }
  c.games++;
  c.turns += s.turn;
  const won = s.winner === 'player';
  if (won) c.wins++;
  if (s.endReason === 'knockout') won ? c.koWins++ : c.koLosses++;
  else if (s.endReason === 'deckOut') won ? c.deckOutWins++ : c.deckOutLosses++;
  else c.other++;
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
  roarPerGame: per(c.roar, c.games),
  doubledPerGame: per(c.doubled, c.games),
  doubledAvgDamage: Math.round((c.doubledDamage / Math.max(1, c.doubled)) * 10) / 10,
  doubledKoRate: pct(c.doubledKo, c.doubled),
  doubledOneShotRate: pct(c.doubledOneShot, c.doubled),
  attacksPerGame: per(c.attacks, c.games),
  attackKoRate: pct(c.attackKo, c.attacks),
  oneShotPerGame: per(c.attackOneShot, c.games),
  oneShotRate: pct(c.attackOneShot, c.attacks),
  ragePerGame: per(c.rage, c.games),
  menacePerGame: per(c.menace, c.games),
  menacedAttacksPerGame: per(c.menacedAttacks, c.games),
  menacedBlockedEvadePerGame: per(c.menacedBlockedEvade, c.games),
  byFoe: Object.fromEntries(Object.entries(c.byFoe).map(([k, v]) => [k, pct(v.wins, v.games)])),
});

function swapSlots(): { key: BoosterKey; slot: number }[] {
  return BOOSTERS.filter((b) => !b.monsters.includes(SUBJECT)).flatMap((b) => [0, 1, 2].map((slot) => ({ key: b.key, slot })));
}

describe('BP の試遊', () => {
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
    // かしこさ技の多い相手：相手の箱の1体（0番目）を、ノウス・セレフィーン・ラディエル（レアあり）に入れ替えた箱
    if (parts.includes('wisdom')) {
      const c = empty();
      for (const { key, slot } of swapSlots()) {
        const deck = swapDeck(key, slot, SUBJECT, playtest16(SUBJECT, true));
        for (const foe of WISDOM_FOES) {
          for (const opp of KEYS) {
            const foeDeck = swapDeck(opp, 0, foe, playtest16(foe, true));
            for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(deck, foeDeck, seed++, first, c, foe);
          }
        }
      }
      out.wisdom = summary(c);
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
