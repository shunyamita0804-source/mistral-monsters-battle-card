import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cardCatalog, getPlayCard, getSkill, skillsOf } from '../src/data/cards.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS, type BoosterKey } from '../src/data/introV2.ts';
import { LILIL_MONSTER_ID } from '../src/data/lilil.ts';
import ajContents from '../src/data/official/booster_contents_20261101_AJ.json';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, createBattle, findMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/**
 * 指示書 AK【5】の試遊（2026-11-02。数字は報告するだけ。カードの数字は変えない。物差しは Z・AB・AJ と同じ：腕前 A どうし・先攻後攻を半分ずつ）。
 * PLAYTEST=回数 で、次を LIFE 5 と LIFE 6（PLAYTEST の中だけ。対戦の初めにリリルのライフを書きかえる）の両方で数えて PLAYTEST_OUT に書く。
 * 1. リリルの1体入れ替え（レア抜きの16枚：レア以外の8種から AJ と同じ作り方）。リリルは旅立ちにいるので、烈火・蒼海の3体と入れ替えて、3箱と対戦。
 *    うそなき・あまいかおり・デビーム・よつばねのまい（レア）の数も見るため、参考に「レアあり」の16枚（AJ と同じ作り方）も測る
 * 2. 箱どうし：新しい旅立ち（ソラモ・リリル・ラズック）と前の旅立ち（ソラモ・ノビトン・ラズック。booster_contents_20261101_AJ.json）を、烈火・蒼海と
 * 3. 1対戦あたり：うっとりウインクの回数・そのあと相手の攻撃をリリルが回避できた割合／うそなきの回数／マナを削った数／リリルの回避の成功の回数
 * 4. 決着の理由（倒して勝ち・山札切れで勝ち・倒されて負け・山札切れで負け）
 * 数えるのは player（入れ替えたデッキ・旅立ち）の側のリリルだけ。相手の箱の旅立ちにもリリルがいるが、そのリリルは数えない（ライフは同じに書きかえる）
 */
const GAMES = Number(process.env.PLAYTEST ?? 1);
const LIVES = (process.env.PLAYTEST_LIVES ?? '5,6').split(',').map(Number);
const KEYS = BOOSTERS.map((b) => b.key);
const MAX_STEPS = 6000;
const WINK = 'skl-lilil-08';
const FAKE_TEARS = 'skl-lilil-09';
const DRAIN = ['skl-lilil-04', 'skl-lilil-07'];

/** 入れ替えの16枚（tests/ajPlaytest.test.ts の ajPlaytest16 と同じ作り方：レア抜き〔またはレアあり〕の技を1枚ずつ、足りない分は安い攻撃からもう1枚ずつ） */
function playtest16(monsterId: string, withRare = false): { id: string; copies: number }[] {
  const rare = new Set(GACHA_SERIES.find((g) => g.monsterId === monsterId)?.rareSkillNames ?? []);
  const cards = skillsOf(monsterId).filter((k) => withRare || !rare.has(k.name));
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

/** 前の旅立ち（指示書 AJ の版：ソラモ・ノビトン・ラズック）のデッキ（src/game/story/introV2.ts の boosterDeck と同じ作り方） */
export function formerTabidachi(): Deck {
  const group = ajContents.booster_groups.find((g) => g.booster_key === 'booster-1');
  if (!group) throw new Error('booster-1');
  const monsters = ['mon-soramo', 'mon-nobiton', 'mon-lazuck'];
  const skills = group.card_rows.flatMap((row) => {
    const m = monsters.find((x) => cardCatalog.get(x)?.name === row.monster);
    const hit = m ? skillsOf(m).filter((s) => s.name === row.skill_name) : [];
    if (hit.length !== 1 || !hit[0]) throw new Error(`${row.monster} ${row.skill_name}`);
    return Array<string>(row.copies).fill(hit[0].id);
  });
  const supports = group.support_cards.flatMap((row) => Array<string>(row.copies).fill(row.support_id));
  return { monsters, skills: [...skills, ...supports] };
}

interface Count {
  games: number;
  wins: number;
  winKo: number;
  winDeck: number;
  loseKo: number;
  loseDeck: number;
  turns: number;
  wink: number;
  winkAttacks: number;
  winkEvaded: number;
  fakeTears: number;
  drainUses: number;
  drained: number;
  attacked: number;
  evaded: number;
}
const empty = (): Count => ({ games: 0, wins: 0, winKo: 0, winDeck: 0, loseKo: 0, loseDeck: 0, turns: 0, wink: 0, winkAttacks: 0, winkEvaded: 0, fakeTears: 0, drainUses: 0, drained: 0, attacked: 0, evaded: 0 });

/** 対戦の初めに、両方のリリルのライフを life にする（試遊の中だけ） */
function withLililLife(s: BattleState, life: number): BattleState {
  const fix = (side: Side) => ({ ...s.sides[side], monsters: s.sides[side].monsters.map((m) => (m.cardId === LILIL_MONSTER_ID ? { ...m, life, maxLife: life } : m)) });
  return { ...s, sides: { player: fix('player'), opponent: fix('opponent') } };
}

const isLilil = (s: BattleState, uid: string): boolean => {
  const f = findMonster(s, uid);
  return !!f && f.side === 'player' && f.monster.cardId === LILIL_MONSTER_ID;
};
/** いまの手番が、player のリリルのうっとりウインクの効いている手番か（相手のだれかが「リリルしか攻撃できない」） */
const winkTurn = (s: BattleState): boolean => s.sides.opponent.monsters.some((m) => m.taunt?.monsterId === LILIL_MONSTER_ID && m.taunt.turn === s.turn);

/** a（player）と b（opponent）の1対戦（腕前 A どうし） */
function play(a: Deck, b: Deck, seed: number, first: Side, life: number, c: Count): void {
  let s: BattleState = withLililLife(createBattle({ name: 'A', deck: a }, { name: 'B', deck: b }, seed, first), life);
  for (let i = 0; i < MAX_STEPS && s.phase !== 'ended'; i++) {
    const side = actingSide(s);
    if (!side) break;
    const action = chooseAction(s, side, 'normal', 'A');
    if (!action) break;
    let drainFrom: number | null = null;
    if (action.type === 'useCard' && s.phase === 'main' && side === 'player') {
      const id = s.sides.player.hand.find((x) => x.uid === action.cardUid)?.cardId;
      if (id === WINK) c.wink++;
      if (id === FAKE_TEARS) c.fakeTears++;
      if (id && DRAIN.includes(id)) {
        c.drainUses++;
        drainFrom = s.sides.opponent.manaPile.length;
      }
    }
    // 攻撃が決まるとき（守りがすべて終わった）：player のリリルが狙われていたら、回避したかを数える
    if (action.type === 'defend' && action.cardUid === null && s.pending) {
      if (s.pending.attacker === 'opponent' && isLilil(s, s.pending.targetUid)) {
        const evaded = s.pending.responses.some((id) => getSkill(id).effect.type === 'evade');
        c.attacked++;
        if (evaded) c.evaded++;
        if (winkTurn(s)) {
          c.winkAttacks++;
          if (evaded) c.winkEvaded++;
        }
      }
      if (s.pending.attacker === 'player' && DRAIN.includes(s.pending.cardId)) drainFrom = s.sides.opponent.manaPile.length;
    }
    // 守りなしで決まった攻撃（相手が守れない）もリリルが狙われたら数える
    const before = s;
    s = applyAction(s, action);
    if (action.type === 'useCard' && before.phase === 'main' && side === 'opponent' && !s.pending && s !== before && action.targetUid && isLilil(before, action.targetUid)) {
      const card = getPlayCard(before.sides.opponent.hand.find((x) => x.uid === action.cardUid)?.cardId ?? '');
      if (card.kind === 'skill' && card.effect.type === 'attack') {
        c.attacked++;
        if (winkTurn(before)) c.winkAttacks++;
      }
    }
    if (drainFrom !== null && !s.pending) c.drained += Math.max(0, drainFrom - s.sides.opponent.manaPile.length);
  }
  c.games++;
  c.turns += s.turn;
  const won = s.winner === 'player';
  if (won) c.wins++;
  if (s.winner === 'player' || s.winner === 'opponent') {
    const deckOut = s.endReason === 'deckOut';
    if (won) c[deckOut ? 'winDeck' : 'winKo']++;
    else c[deckOut ? 'loseDeck' : 'loseKo']++;
  }
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);
const per = (n: number, of: number): number => Math.round((n / Math.max(1, of)) * 100) / 100;
const summary = (c: Count): Record<string, number> => ({
  games: c.games,
  win: pct(c.wins, c.games),
  winKo: pct(c.winKo, c.games),
  winDeck: pct(c.winDeck, c.games),
  loseKo: pct(c.loseKo, c.games),
  loseDeck: pct(c.loseDeck, c.games),
  avgTurns: Math.round((c.turns / Math.max(1, c.games)) * 10) / 10,
  winkPerGame: per(c.wink, c.games),
  winkAttacksOnLilil: c.winkAttacks,
  winkEvadedPct: pct(c.winkEvaded, c.winkAttacks),
  fakeTearsPerGame: per(c.fakeTears, c.games),
  drainUsesPerGame: per(c.drainUses, c.games),
  drainedManaPerGame: per(c.drained, c.games),
  attacksOnLililPerGame: per(c.attacked, c.games),
  evadesPerGame: per(c.evaded, c.games),
  evadedPct: pct(c.evaded, c.attacked),
});
const add = (to: Count, c: Count): void => {
  for (const k of Object.keys(c) as (keyof Count)[]) to[k] += c[k];
};

/** リリルを入れる場所：旅立ち以外の箱（烈火・蒼海）の3体 */
const SLOTS: { key: BoosterKey; slot: number }[] = BOOSTERS.filter((b) => !b.monsters.includes(LILIL_MONSTER_ID)).flatMap((b) => [0, 1, 2].map((slot) => ({ key: b.key, slot })));

describe('AK の試遊（リリル）', () => {
  it('入れ替えの16枚はレア抜きの8種で16枚。入れ替えたデッキ・前の旅立ちは山札60枚でルールに合う', () => {
    const cards = playtest16(LILIL_MONSTER_ID);
    expect(cards).toHaveLength(8);
    expect(cards.reduce((n, x) => n + x.copies, 0)).toBe(16);
    expect(SLOTS.map((x) => x.key)).toEqual(['booster-2', 'booster-2', 'booster-2', 'booster-3', 'booster-3', 'booster-3']);
    for (const { key, slot } of SLOTS) {
      const d = swapDeck(key, slot, LILIL_MONSTER_ID, cards);
      expect(d.skills).toHaveLength(60);
      expect(isDeckValid(d, countCards([...d.monsters, ...d.skills]))).toBe(true);
    }
    const old = formerTabidachi();
    expect(old.skills).toHaveLength(60);
    expect(isDeckValid(old, countCards([...old.monsters, ...old.skills]))).toBe(true);
  });

  it(`入れ替え・箱どうし（各組み合わせ・先攻後攻 ${GAMES} 回ずつ。LIFE ${LIVES.join('・')}）`, () => {
    const out: Record<string, unknown> = { games: GAMES, lives: LIVES, sixteen: playtest16(LILIL_MONSTER_ID), sixteenRare: playtest16(LILIL_MONSTER_ID, true) };
    let seed = 1;
    for (const life of LIVES) {
      const result: Record<string, unknown> = {};
      // 1：1体入れ替え（レア抜き＝物差し・レアあり＝参考）
      for (const withRare of [false, true]) {
        const swap: Record<string, unknown> = {};
        const all = empty();
        for (const { key, slot } of SLOTS) {
          const c = empty();
          const deck = swapDeck(key, slot, LILIL_MONSTER_ID, playtest16(LILIL_MONSTER_ID, withRare));
          for (const opp of KEYS) for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(deck, boosterDeck(opp), seed++, first, life, c);
          swap[`${key}#${slot}:${boosterDeck(key).monsters[slot]}`] = summary(c);
          add(all, c);
        }
        swap.all = summary(all);
        result[withRare ? 'swapRare' : 'swap'] = swap;
      }
      // 2：箱どうし（新しい旅立ち・前の旅立ち と 烈火・蒼海）
      const boxes: Record<string, unknown> = {};
      for (const [name, deck] of [['new', boosterDeck('booster-1')], ['former', formerTabidachi()]] as const) {
        const both = empty();
        for (const opp of ['booster-2', 'booster-3'] as const) {
          const c = empty();
          for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(deck, boosterDeck(opp), seed++, first, life, c);
          boxes[`${name}>${opp}`] = summary(c);
          add(both, c);
        }
        boxes[`${name}>all`] = summary(both);
      }
      result.boxes = boxes;
      out[`life${life}`] = result;
    }
    const file = process.env.PLAYTEST_OUT;
    if (file) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(out, null, 1));
    }
    expect(seed).toBeGreaterThan(1);
  }, 3_600_000);
});
