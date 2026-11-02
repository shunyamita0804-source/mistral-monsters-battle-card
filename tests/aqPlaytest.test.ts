import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getMonster, getPlayCard, MONSTERS, skillsOf } from '../src/data/cards.ts';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS, type BoosterKey } from '../src/data/introV2.ts';
import { MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import type { OpponentDefinition } from '../src/data/tournaments.ts';
import { TSUMUJI_MONSTER_ID } from '../src/data/tsumuji.ts';
import { UZURIO_MONSTER_ID } from '../src/data/uzurio.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import {
  actingSide,
  activeField,
  applyAction,
  attackPower,
  availableUsers,
  cardUsability,
  createBattle,
  findMonster,
  targetsFor,
  type BattleState,
  type Side,
} from '../src/game/battle/engine.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { buildOpponentDeck, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/**
 * 指示書 AQ【5】の試遊（2026-11-02。数字は変えずに報告だけ。ボスの lifeScale だけは合わせ直す）。物差しは腕前 B（両方とも CPU の腕前 B・構えはふつう）。
 * 先攻・後攻は半分ずつ。PLAYTEST=回数（1つの組み合わせの回数。ふだんは少ない回数で動くことだけ確かめる）・PLAYTEST_OUT に JSON。
 * PLAYTEST_PART で測る所をしぼれる（swap・field・tornado・boss。カンマ区切り。無ければ全部）。ボスは PLAYTEST_BOSS（回数）・PLAYTEST_SCALES（"0.9:1.4:0.02"）
 * 1. ウズリオの1体入れ替え：旅立ちのノビトンをウズリオに（AL と同じ16枚の作り方。レア抜き＝物差し・レアあり）。烈火・蒼海と対戦
 * 2. 場のカードの組み合わせ：試す側の箱のサポート2枚（風まかせ×2）を試すカード2枚に入れ替え、入れない場合と比べる（ア〜エ）。オは相手側に しずめの祈り×2（ア・ウ）
 * 3. おおたつまき：使えた回数・空中の相手がいなくて使えなかった回数（まいあがる風があったとき／無いとき）
 * 4. 風の渓谷のゼフィラ：最初の手持ち3箱 × 回数。ツムジのときの勝つ割合（lifeScale 1.22）と、ウズリオで lifeScale を変えて測る
 * 5. 居場所の一覧
 */
const GAMES = Number(process.env.PLAYTEST ?? 2);
const BOSS_GAMES = Number(process.env.PLAYTEST_BOSS ?? GAMES);
const PARTS = (process.env.PLAYTEST_PART ?? 'swap,field,tornado,boss').split(',');
const KEYS = BOOSTERS.map((b) => b.key);
const MAX_STEPS = 6000;
const RISE = 'sup-12';
const SETTLE = 'sup-13';
const CALM = 'sup-14';
/** 試すカードと入れ替えるサポート（箱に2枚ある風まかせ）【Claude の決め】 */
const SWAP_OUT = 'sup-3';
const TORNADO = 'skl-uzurio-06';
const TABIDACHI: BoosterKey = 'booster-1';
const REKKA: BoosterKey = 'booster-2';
const SOUKAI: BoosterKey = 'booster-3';
/** 旅立ちのノビトン（3体目）の席 */
const NOBITON_SLOT = 2;

/** AL と同じ16枚の作り方（レア抜きは、レアでない技を1枚ずつ＋安い攻撃から足す） */
function playtest16(monsterId: string, withRare: boolean): { id: string; copies: number }[] {
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

/** 旅立ちのノビトンを monsterId に入れ替えた箱 */
const swapTabidachi = (monsterId: string, withRare: boolean): Deck => swapDeck(TABIDACHI, NOBITON_SLOT, monsterId, playtest16(monsterId, withRare));

/** サポート（風まかせ）を card に n 枚入れ替える */
function withCards(deck: Deck, card: string, n = 2): Deck {
  const skills = [...deck.skills];
  for (let i = 0; i < n; i++) {
    const at = skills.indexOf(SWAP_OUT);
    if (at < 0) throw new Error('風まかせが足りません');
    skills[at] = card;
  }
  return { ...deck, skills };
}

interface Count {
  games: number;
  wins: number;
  losses: number;
  winKo: number;
  winDeck: number;
  loseKo: number;
  loseDeck: number;
  turns: number;
  /** 試す側が居場所の場のカードを出した回数・その場が残っていた手番の数（出してから消えるまで。両方の手番を数える） */
  fieldPlays: number;
  fieldTurns: number;
  /** 試す側の攻撃で、場のカード（居場所）のおかげで増えたダメージ（場が無ければ当てられなかった相手へのダメージ全部＋うずまきショットの＋） */
  fieldDamage: number;
  /** しずめの祈りを使った回数（試す側・相手側） */
  calmMine: number;
  calmTheirs: number;
  /** おおたつまき（試す側）：使った回数・手番の終わりに手札にあって、空中の相手がいなくて使えなかった回数（まいあがる風あり／なし） */
  tornadoRise: number;
  tornadoNoRise: number;
  blockedRise: number;
  blockedNoRise: number;
}
const empty = (): Count => ({
  games: 0, wins: 0, losses: 0, winKo: 0, winDeck: 0, loseKo: 0, loseDeck: 0, turns: 0,
  fieldPlays: 0, fieldTurns: 0, fieldDamage: 0, calmMine: 0, calmTheirs: 0, tornadoRise: 0, tornadoNoRise: 0, blockedRise: 0, blockedNoRise: 0,
});
const add = (to: Count, c: Count): void => {
  for (const k of Object.keys(c) as (keyof Count)[]) to[k] += c[k];
};

const isHabitatField = (s: BattleState): boolean => {
  const f = activeField(s);
  const card = f ? getPlayCard(f.cardId) : null;
  return !!card && card.kind === 'support' && card.effect.type === 'habitat';
};
const lifeOf = (s: BattleState, uid: string): number => findMonster(s, uid)?.monster.life ?? 0;

/**
 * 1対戦（me＝試す側は player）。me の lifeScale は 1、相手は lifeScale（ボスのとき）。相手の構え・腕前は boss があればそれ
 */
function play(me: Deck, them: Deck, seed: number, first: Side, c: Count, lifeScale = 1, boss?: OpponentDefinition): void {
  let state = createBattle({ name: 'A', deck: me }, { name: 'B', deck: them, ...(lifeScale !== 1 ? { lifeScale } : {}) }, seed, first);
  let lastTurn = state.turn;
  /** 場のおかげの攻撃の、守りが終わるまでの記録（相手ごとに：場が無ければ当てられなかったか・うずまきショットの＋） */
  let watch: { before: Map<string, number>; whole: Set<string>; bonus: Map<string, number> } | null = null;
  for (let i = 0; i < MAX_STEPS && state.phase !== 'ended'; i++) {
    if (state.turn !== lastTurn) {
      lastTurn = state.turn;
      if (isHabitatField(state) && activeField(state)?.owner === 'player') c.fieldTurns++;
    }
    const side = actingSide(state);
    if (!side) break;
    const action = side === 'opponent' && boss ? chooseAction(state, side, boss.ai, boss.skill ?? 'B') : chooseAction(state, side, 'normal', 'B');
    if (!action) break;
    if (action.type === 'useCard' && state.phase === 'main') {
      const hand = state.sides[side].hand.find((h) => h.uid === action.cardUid);
      const card = hand ? getPlayCard(hand.cardId) : null;
      if (card?.kind === 'support' && card.effect.type === 'habitat' && side === 'player') c.fieldPlays++;
      if (card?.id === CALM) {
        if (side === 'player') c.calmMine++;
        else c.calmTheirs++;
      }
      if (card?.id === TORNADO && side === 'player') {
        if (isHabitatField(state) && activeField(state)?.cardId === RISE) c.tornadoRise++;
        else c.tornadoNoRise++;
      }
      // 場のカード（居場所）のおかげで増えたダメージ
      if (side === 'player' && card?.kind === 'skill' && card.effect.type === 'attack' && isHabitatField(state)) {
        const noField: BattleState = { ...state, field: null };
        const user = (action.userUid ? findMonster(state, action.userUid)?.monster : undefined) ?? availableUsers(state, side, card)[0];
        const all = !!card.effect.allTargets;
        const targets = all ? targetsFor(state, side, card, user) : targetsFor(state, side, card, user).filter((m) => m.uid === action.targetUid);
        const reachable = new Set(targetsFor(noField, side, card, user).map((m) => m.uid));
        const before = new Map(targets.map((m) => [m.uid, m.life]));
        const whole = new Set(targets.filter((m) => !reachable.has(m.uid)).map((m) => m.uid));
        const bonus = new Map(targets.map((m) => [m.uid, Math.max(0, attackPower(state, card, user, all ? undefined : m) - attackPower(noField, card, user, all ? undefined : m))]));
        watch = { before, whole, bonus };
      }
    }
    if (action.type === 'endAttack' && side === 'player') {
      const held = state.sides.player.hand.find((h) => h.cardId === TORNADO);
      if (held && cardUsability(state, 'player', held.uid).reason?.startsWith('空中の相手がいません')) {
        if (activeField(state)?.cardId === RISE) c.blockedRise++;
        else c.blockedNoRise++;
      }
    }
    state = applyAction(state, action);
    if (watch && state.phase !== 'defense') {
      for (const [uid, b] of watch.before) {
        const dealt = Math.max(0, b - lifeOf(state, uid));
        c.fieldDamage += watch.whole.has(uid) ? dealt : Math.min(dealt, watch.bonus.get(uid) ?? 0);
      }
      watch = null;
    }
  }
  c.games++;
  c.turns += state.turn;
  const deckOut = state.endReason === 'deckOut';
  if (state.winner === 'player') {
    c.wins++;
    if (deckOut) c.winDeck++;
    else c.winKo++;
  } else if (state.winner === 'opponent') {
    c.losses++;
    if (deckOut) c.loseDeck++;
    else c.loseKo++;
  }
}

function series(me: Deck, them: Deck, games: number, seedBase: number, lifeScale = 1, boss?: OpponentDefinition): Count {
  const c = empty();
  for (let i = 0; i < games; i++) play(me, them, seedBase + i * 7919, i % 2 === 0 ? 'player' : 'opponent', c, lifeScale, boss);
  return c;
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);
const per = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 100) / 100);
const view = (c: Count) => ({
  games: c.games,
  win: pct(c.wins, c.games),
  winKo: pct(c.winKo, c.games),
  winDeck: pct(c.winDeck, c.games),
  loseKo: pct(c.loseKo, c.games),
  loseDeck: pct(c.loseDeck, c.games),
  turns: per(c.turns, c.games),
  fieldPlays: per(c.fieldPlays, c.games),
  fieldTurnsPerPlay: per(c.fieldTurns, c.fieldPlays),
  fieldDamage: per(c.fieldDamage, c.games),
  calmMine: per(c.calmMine, c.games),
  calmTheirs: per(c.calmTheirs, c.games),
  tornadoRise: per(c.tornadoRise, c.games),
  tornadoNoRise: per(c.tornadoNoRise, c.games),
  blockedRise: per(c.blockedRise, c.games),
  blockedNoRise: per(c.blockedNoRise, c.games),
});

/** 試す箱 me を、相手 opponents それぞれと games 回。相手ごとと合計 */
function versus(me: Deck, opponents: Record<string, Deck>, seedBase: number): { byOpponent: Record<string, ReturnType<typeof view>>; total: ReturnType<typeof view> } {
  const total = empty();
  const byOpponent: Record<string, ReturnType<typeof view>> = {};
  Object.entries(opponents).forEach(([name, deck], i) => {
    const c = series(me, deck, GAMES, seedBase + i * 100000);
    byOpponent[name] = view(c);
    add(total, c);
  });
  return { byOpponent, total: view(total) };
}

describe('指示書 AQ の試遊（腕前 B）', () => {
  it('試遊の箱は60枚で、決まりに合う', () => {
    for (const d of [swapTabidachi(UZURIO_MONSTER_ID, false), swapTabidachi(UZURIO_MONSTER_ID, true), withCards(boosterDeck(REKKA), RISE), swapTabidachi('mon-geol', true)]) {
      expect(d.skills).toHaveLength(60);
      expect(isDeckValid(d)).toBe(true);
    }
    expect(swapTabidachi(UZURIO_MONSTER_ID, false).monsters).toEqual(['mon-soramo', 'mon-lilil', UZURIO_MONSTER_ID]);
  });

  it(`測る（1つの組み合わせ ${GAMES} 回・ボス ${BOSS_GAMES} 回）`, () => {
    const out: Record<string, unknown> = { games: GAMES, bossGames: BOSS_GAMES, skill: 'B', swapOut: SWAP_OUT };
    const rekka = boosterDeck(REKKA);
    const soukai = boosterDeck(SOUKAI);
    const tabidachi = boosterDeck(TABIDACHI);

    if (PARTS.includes('swap')) {
      out.swap = {
        noRare: versus(swapTabidachi(UZURIO_MONSTER_ID, false), { rekka, soukai }, 1000),
        rare: versus(swapTabidachi(UZURIO_MONSTER_ID, true), { rekka, soukai }, 2000),
        // 参考：入れ替える前の旅立ち（ノビトン）
        before: versus(tabidachi, { rekka, soukai }, 3000),
      };
    }

    if (PARTS.includes('field')) {
      const uzTab = swapTabidachi(UZURIO_MONSTER_ID, false);
      const geolTab = swapTabidachi('mon-geol', true);
      out.field = {
        a_rekka_rise: { before: versus(rekka, { tabidachi, soukai }, 4000), after: versus(withCards(rekka, RISE), { tabidachi, soukai }, 4000) },
        i_tabidachiUzurio_rise: { before: versus(uzTab, { rekka, soukai }, 5000), after: versus(withCards(uzTab, RISE), { rekka, soukai }, 5000) },
        u_rekka_settle: { before: versus(rekka, { tabidachi, soukai }, 6000), after: versus(withCards(rekka, SETTLE), { tabidachi, soukai }, 6000) },
        e_tabidachiGeol_settle: { before: versus(geolTab, { rekka, soukai }, 7000), after: versus(withCards(geolTab, SETTLE), { rekka, soukai }, 7000) },
        o_a_calm: versus(withCards(rekka, RISE), { tabidachi: withCards(tabidachi, CALM), soukai: withCards(soukai, CALM) }, 4000),
        o_u_calm: versus(withCards(rekka, SETTLE), { tabidachi: withCards(tabidachi, CALM), soukai: withCards(soukai, CALM) }, 6000),
      };
    }

    if (PARTS.includes('tornado')) {
      // おおたつまきはレアなので、レアありのウズリオ（旅立ちのノビトンと入れ替え）で。まいあがる風×2 あり／なし
      const uzRare = swapTabidachi(UZURIO_MONSTER_ID, true);
      out.tornado = { noRise: versus(uzRare, { rekka, soukai }, 8000), rise: versus(withCards(uzRare, RISE), { rekka, soukai }, 8000) };
    }

    if (PARTS.includes('boss')) {
      const zephyra = ENCOUNTERS['enc-wind-boss'];
      if (!zephyra) throw new Error('zephyra');
      const old: OpponentDefinition = { ...zephyra, monsters: ['mon-soramo', TSUMUJI_MONSTER_ID, 'mon-gauul'], ace: TSUMUJI_MONSTER_ID, lifeScale: 1.22 };
      const run = (boss: OpponentDefinition, scale: number, seed: number) => {
        const deck = buildOpponentDeck(boss);
        const total = empty();
        const byBox: Record<string, ReturnType<typeof view>> = {};
        KEYS.forEach((k, i) => {
          const c = empty();
          for (let g = 0; g < BOSS_GAMES; g++) play(boosterDeck(k), deck, seed + i * 100000 + g * 7919, g % 2 === 0 ? 'player' : 'opponent', c, scale, boss);
          byBox[k] = view(c);
          add(total, c);
        });
        const lives = boss.monsters.map((m) => Math.max(1, Math.round(getMonster(m).life * scale)));
        return { lifeScale: scale, lives, byBox, total: view(total) };
      };
      const [lo, hi, step] = (process.env.PLAYTEST_SCALES ?? '1.22:1.22:0.1').split(':').map(Number) as [number, number, number];
      const scales: number[] = [];
      for (let x = lo; x <= hi + 1e-9; x += step) scales.push(Math.round(x * 1000) / 1000);
      out.boss = { tsumuji_1_22: run(old, 1.22, 90000), uzurio: scales.map((sc) => run(zephyra, sc, 90000)) };
    }

    // 5. 居場所の一覧（正式のモンスター）
    out.habitat = Object.fromEntries(
      (['ground', 'air', 'water'] as const).map((h) => [h, MONSTERS.filter((m) => MONSTER_HABITAT[m.id] === h).map((m) => m.name)]),
    );

    const file = process.env.PLAYTEST_OUT;
    if (file) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
    }
    expect(out.habitat).toBeDefined();
  }, 3_600_000);
});
