import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPlayCard, skillsOf } from '../src/data/cards.ts';
import { BOOSTERS, type BoosterKey } from '../src/data/introV2.ts';
import { AJ_QA_SKILLS, AJ_SKILLS } from '../src/data/skillRebuildAJ.ts';
import type { CpuSkill } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, createBattle, findMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/**
 * 指示書 BL の試遊（数字は報告するだけ。カード・ルールの数字は変えない）。PLAYTEST=回数（ふだんは 1）・PLAYTEST_OUT に JSON。PLAYTEST_SUBJECT でモンスターを変えられる（ふだんはロウガ）。
 * 1体入れ替え（指示書 AJ・AX・BH・BK と同じやり方：3箱 × 3か所 × 相手の3箱 × 先攻・後攻 × 回数）。レア抜き・レアあり。腕前 A どうし。
 * ロウガの側の1対戦あたり：とおぼえの回数・とおぼえの＋2 を攻撃に使えた回数／期限で消えた回数・こおりのきばが当たった（凍らせた）回数・
 * ひょうろうのいちげきの回数と、＋2 込み（11）で使った回数・それで倒した回数。山札切れで決まった対戦の割合
 */
const GAMES = Number(process.env.PLAYTEST ?? 1);
const KEYS = BOOSTERS.map((b) => b.key);
const MAX_STEPS = 6000;
const SKILL: CpuSkill = (process.env.PLAYTEST_SKILL ?? 'A') as CpuSkill;
const SUBJECT = process.env.PLAYTEST_SUBJECT ?? 'mon-rouga';
const BIG = 'skl-rouga-10';

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
  deckOut: number;
  turns: number;
  howl: number;
  howlUsed: number;
  howlFaded: number;
  iceFang: number;
  big: number;
  bigCharged: number;
  bigChargedKills: number;
}
const empty = (): Count => ({ games: 0, wins: 0, deckOut: 0, turns: 0, howl: 0, howlUsed: 0, howlFaded: 0, iceFang: 0, big: 0, bigCharged: 0, bigChargedKills: 0 });

function play(a: Deck, b: Deck, seed: number, first: Side, c: Count): void {
  let s: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b }, seed, first);
  let watch: { target: string; charged: boolean } | null = null;
  let fang = false;
  for (let i = 0; i < MAX_STEPS && s.phase !== 'ended'; i++) {
    const side = actingSide(s);
    if (!side) break;
    const action = chooseAction(s, side, 'normal', SKILL);
    if (!action) break;
    if (side === 'player' && action.type === 'useCard' && s.phase === 'main') {
      const used = s.sides.player.hand.find((x) => x.uid === action.cardUid);
      const k = used ? getPlayCard(used.cardId) : null;
      if (k?.kind === 'skill' && k.monsterId === SUBJECT) {
        if (k.effect.type === 'charge') c.howl++;
        if (k.id === 'skl-rouga-04') fang = true;
        if (k.effect.type === 'attack') {
          const user = s.sides.player.monsters.find((m) => m.uid === action.userUid) ?? s.sides.player.monsters.find((m) => m.cardId === SUBJECT);
          if (user?.charge && user.chargeUntil != null) c.howlUsed++;
          if (k.id === BIG) {
            c.big++;
            const charged = !!(user?.charge && user.chargeUntil != null);
            if (charged) c.bigCharged++;
            if (action.targetUid) watch = { target: action.targetUid, charged };
          }
        }
      }
    }
    const logBefore = s.log.length;
    const attacker = s.active;
    s = applyAction(s, action);
    const logs = s.log.slice(logBefore);
    c.howlFaded += logs.filter((l) => l.text.endsWith('のとおぼえの力が消えた。') && l.text.startsWith('ロウガ')).length;
    // こおりのきば：ロウガが使った攻撃の守りが終わるまでに出た「行動できない」の記録
    if (fang && attacker === 'player') c.iceFang += logs.filter((l) => l.text.endsWith('は次のターン行動できない。')).length;
    if (fang && s.phase !== 'defense') fang = false;
    // ひょうろうのいちげきの守りが終わったら、倒したかを見る
    if (watch && s.phase !== 'defense') {
      if (watch.charged && (findMonster(s, watch.target)?.monster.life ?? 0) <= 0) c.bigChargedKills++;
      watch = null;
    }
  }
  c.games++;
  c.turns += s.turn;
  if (s.winner === 'player') c.wins++;
  if (s.endReason === 'deckOut') c.deckOut++;
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);
const per = (n: number, of: number): number => Math.round((n / Math.max(1, of)) * 1000) / 1000;
const summary = (c: Count): Record<string, number> => ({
  games: c.games,
  win: pct(c.wins, c.games),
  deckOut: pct(c.deckOut, c.games),
  avgTurns: Math.round((c.turns / Math.max(1, c.games)) * 10) / 10,
  howlPerGame: per(c.howl, c.games),
  howlUsedRate: pct(c.howlUsed, c.howl),
  howlFadedRate: pct(c.howlFaded, c.howl),
  iceFangHitsPerGame: per(c.iceFang, c.games),
  bigPerGame: per(c.big, c.games),
  bigChargedPerGame: per(c.bigCharged, c.games),
  bigChargedKillsPerGame: per(c.bigChargedKills, c.games),
});

function swapSlots(): { key: BoosterKey; slot: number }[] {
  return BOOSTERS.filter((b) => !b.monsters.includes(SUBJECT)).flatMap((b) => [0, 1, 2].map((slot) => ({ key: b.key, slot })));
}

describe('BL の試遊', () => {
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
    for (const withRare of [false, true]) {
      const c = empty();
      for (const { key, slot } of swapSlots()) {
        const deck = swapDeck(key, slot, SUBJECT, playtest16(SUBJECT, withRare));
        for (const opp of KEYS) for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(deck, boosterDeck(opp), seed++, first, c);
      }
      out[withRare ? 'swapRare' : 'swap'] = summary(c);
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
