import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPlayCard, skillsOf } from '../src/data/cards.ts';
import { OVERDRIVE_CHOICE } from '../src/data/gearos.ts';
import { BOOSTERS, type BoosterKey } from '../src/data/introV2.ts';
import { AJ_QA_SKILLS, AJ_SKILLS } from '../src/data/skillRebuildAJ.ts';
import type { CpuSkill } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, aliveMonsters, applyAction, cardUsability, createBattle, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/**
 * 指示書 AX【6】の試遊（数字は報告するだけ。カード・ルールの数字は変えない）。PLAYTEST=回数（ふだんは 1）・PLAYTEST_OUT に JSON。
 * 1. 1体入れ替え（指示書 AJ と同じやり方：入れられる箱 × 3か所 × 相手の3箱 × 先攻・後攻）：タイラント・ギアロス・デスオル。レア抜き・レアあり。腕前 A どうし・B どうし
 * 2. ギアロスの3枚コンボ：1対戦で使った回数・それで倒した数・コンボを使った対戦の勝つ割合
 * 3. 竜のまなざし・竜のちから：使った回数・効いた回数（守る側が、その印が無ければ使えた回避〔防御・かばう〕のカードを手札に持っていた回数）
 * 入れ替えの16枚は tests/ajPlaytest.test.ts の ajPlaytest16 と同じ作り方（レアは表の rare。タイラントはガチャのシリーズが無いので表から）
 */
const GAMES = Number(process.env.PLAYTEST ?? 1);
const KEYS = BOOSTERS.map((b) => b.key);
const MAX_STEPS = 6000;
const SUBJECTS = (process.env.PLAYTEST_SUBJECTS ?? 'mon-tyrant,mon-gearos,mon-desuoru').split(',');
const SKILLS_TO_TEST = (process.env.PLAYTEST_SKILLS ?? 'A,B').split(',') as CpuSkill[];

type Pick = { readonly id: string; readonly copies: number }[];

function rows(monsterId: string) {
  return AJ_SKILLS[monsterId] ?? AJ_QA_SKILLS[monsterId] ?? [];
}

/** 入れ替えの16枚（ajPlaytest16 と同じ：レア抜き〔またはレアあり〕を1枚ずつ、足りない分は安い攻撃からもう1枚ずつ） */
export function axPlaytest16(monsterId: string, withRare: boolean): Pick {
  const rare = new Set(rows(monsterId).filter((r) => r.rare).map((r) => r.id));
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
  winsA: number;
  deckOut: number;
  deckOutLossA: number;
  turns: number;
  combo: number;
  comboKills: number;
  comboGames: number;
  comboGameWins: number;
  gaze: number;
  gazeBlocked: number;
  might: number;
  mightBlocked: number;
  sysChange: number;
  sysCheck: number;
}
const empty = (): Count => ({ games: 0, winsA: 0, deckOut: 0, deckOutLossA: 0, turns: 0, combo: 0, comboKills: 0, comboGames: 0, comboGameWins: 0, gaze: 0, gazeBlocked: 0, might: 0, mightBlocked: 0, sysChange: 0, sysCheck: 0 });

/** 守る側が、印（まなざし＝回避・ちから＝防御とかばう）が無ければ使えたカードを持っているか */
function blockedGuard(s: BattleState, kind: 'gaze' | 'might'): boolean {
  const p = s.pending;
  if (!p) return false;
  const defender = p.attacker === 'player' ? 'opponent' : 'player';
  const without: BattleState = { ...s, pending: kind === 'gaze' ? { ...p, dragonGaze: false } : { ...p, dragonMight: false } };
  const types = kind === 'gaze' ? ['evade'] : ['defense', 'cover'];
  return s.sides[defender].hand.some((c) => {
    const k = getPlayCard(c.cardId);
    return types.includes(k.effect.type) && cardUsability(without, defender, c.uid).usable && !cardUsability(s, defender, c.uid).usable;
  });
}

/** a（player）と b（opponent）の1対戦。数えるのは player（入れ替えたデッキ）の側の新しい効果 */
function play(a: Deck, b: Deck, seed: number, first: Side, c: Count, skillA: CpuSkill, skillB: CpuSkill): void {
  let s: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b }, seed, first);
  let comboWatch: number | null = null;
  let usedCombo = false;
  const seen = new Set<string>();
  for (let i = 0; i < MAX_STEPS && s.phase !== 'ended'; i++) {
    const side = actingSide(s);
    if (!side) break;
    // 竜のまなざし・竜のちから：守る相手ごとに1回だけ数える
    if (s.phase === 'defense' && s.pending && s.pending.attacker === 'player') {
      const key = `${s.turn}:${s.pending.targetUid}:${s.log.length > 0 ? s.pending.cardId : ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        if (s.pending.dragonGaze && blockedGuard(s, 'gaze')) c.gazeBlocked++;
        if (s.pending.dragonMight && blockedGuard(s, 'might')) c.mightBlocked++;
      }
    }
    const action = chooseAction(s, side, 'normal', side === 'player' ? skillA : skillB);
    if (!action) break;
    if (action.type === 'useCard' && side === 'player' && s.phase === 'main') {
      const hand = s.sides.player.hand.find((x) => x.uid === action.cardUid);
      const card = hand ? getPlayCard(hand.cardId) : null;
      if (action.choice === OVERDRIVE_CHOICE) {
        c.combo++;
        usedCombo = true;
        comboWatch = aliveMonsters(s.sides.opponent).length;
      } else if (card?.kind === 'skill') {
        if (card.effect.type === 'dragonGaze') c.gaze++;
        if (card.effect.type === 'dragonMight') c.might++;
        if (card.effect.type === 'systemChange') c.sysChange++;
        if (card.effect.type === 'systemCheck') c.sysCheck++;
      }
    }
    s = applyAction(s, action);
    if (comboWatch !== null && (s.phase !== 'defense' || s.pending?.attacker !== 'player')) {
      c.comboKills += comboWatch - aliveMonsters(s.sides.opponent).length;
      comboWatch = null;
    }
  }
  c.games++;
  c.turns += s.turn;
  if (s.winner === 'player') c.winsA++;
  if (s.endReason === 'deckOut') {
    c.deckOut++;
    if (s.winner === 'opponent') c.deckOutLossA++;
  }
  if (usedCombo) {
    c.comboGames++;
    if (s.winner === 'player') c.comboGameWins++;
  }
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);
const per = (n: number, of: number): number => Math.round((n / Math.max(1, of)) * 100) / 100;
const summary = (c: Count): Record<string, number> => ({
  games: c.games,
  winA: pct(c.winsA, c.games),
  deckOut: pct(c.deckOut, c.games),
  deckOutLossA: pct(c.deckOutLossA, c.games),
  avgTurns: Math.round((c.turns / Math.max(1, c.games)) * 10) / 10,
  comboPerGame: per(c.combo, c.games),
  comboKillsPerUse: per(c.comboKills, c.combo),
  comboGames: c.comboGames,
  comboGameWin: pct(c.comboGameWins, c.comboGames),
  gazePerGame: per(c.gaze, c.games),
  gazeBlocked: c.gazeBlocked,
  gazeUses: c.gaze,
  mightPerGame: per(c.might, c.games),
  mightBlocked: c.mightBlocked,
  mightUses: c.might,
  sysChangePerGame: per(c.sysChange, c.games),
  sysCheckPerGame: per(c.sysCheck, c.games),
});

/** 3枚コンボを測る用のギアロスの16枚 */
const COMBO16: Pick = [
  [5, 3], [6, 3], [7, 3], [1, 1], [2, 1], [3, 1], [4, 1], [10, 1], [11, 1], [12, 1],
].map(([no, copies]) => ({ id: `skl-gearos-${String(no).padStart(2, '0')}`, copies: copies as number }));

/** X を入れられる（箱に X がいない）箱と入れ替える場所 */
function swapSlots(monsterId: string): { key: BoosterKey; slot: number }[] {
  return BOOSTERS.filter((b) => !b.monsters.includes(monsterId)).flatMap((b) => [0, 1, 2].map((slot) => ({ key: b.key, slot })));
}

describe('AX の試遊', () => {
  it('入れ替えの16枚は16枚。入れ替えたデッキは山札60枚でルールに合う', () => {
    for (const id of SUBJECTS) {
      for (const withRare of [false, true]) expect(axPlaytest16(id, withRare).reduce((n, c) => n + c.copies, 0), id).toBe(16);
      for (const { key, slot } of swapSlots(id)) {
        const d = swapDeck(key, slot, id, axPlaytest16(id, false));
        expect(d.skills).toHaveLength(60);
        expect(isDeckValid(d, countCards([...d.monsters, ...d.skills])), `${id} ${key}#${slot}`).toBe(true);
      }
    }
  });

  it(`1体入れ替え（各組み合わせ ${GAMES} 回）`, () => {
    const out: Record<string, unknown> = { games: GAMES };
    let seed = 1;
    let total = 0;
    for (const skill of SKILLS_TO_TEST) {
      for (const withRare of [false, true]) {
        const table: Record<string, unknown> = {};
        for (const id of SUBJECTS) {
          const c = empty();
          for (const { key, slot } of swapSlots(id)) {
            const deck = swapDeck(key, slot, id, axPlaytest16(id, withRare));
            for (const opp of KEYS) for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(deck, boosterDeck(opp), seed++, first, c, skill, skill);
          }
          table[id] = summary(c);
          total += c.games;
        }
        out[`${skill}:${withRare ? 'swapRare' : 'swap'}`] = table;
      }
    }
    // 2'. 3枚コンボを測る用：ギアロスの16枚を α・β・γ ×3 ＋ 01・02・03・04・10・11・12 ×1 にした入れ替え（ふつうの16枚では α・β・γ が1枚ずつで、そろうことがほとんど無いため）
    if (SUBJECTS.includes('mon-gearos')) {
      for (const skill of SKILLS_TO_TEST) {
        const c = empty();
        for (const { key, slot } of swapSlots('mon-gearos')) {
          const deck = swapDeck(key, slot, 'mon-gearos', COMBO16);
          for (const opp of KEYS) for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(deck, boosterDeck(opp), seed++, first, c, skill, skill);
        }
        out[`${skill}:combo16`] = { 'mon-gearos': summary(c) };
        total += c.games;
      }
    }
    const file = process.env.PLAYTEST_OUT;
    if (file) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(out, null, 1));
    }
    expect(total).toBeGreaterThan(0);
  }, 7_200_000);
});
