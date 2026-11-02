import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cardCatalog, getPlayCard, skillsOf } from '../src/data/cards.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { FORN_MONSTER_ID } from '../src/data/forn.ts';
import { BOOSTERS, type BoosterKey } from '../src/data/introV2.ts';
import akContents from '../src/data/official/booster_contents_20261102_AK.json';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, createBattle, findMonster, incomingDamage, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/**
 * 指示書 AL【5】の試遊（2026-11-02。数字は報告するだけ。物差しは AK と同じ：腕前 A どうし・先攻後攻を半分ずつ）。PLAYTEST=回数 で PLAYTEST_OUT に書く。
 * 1. フォルンの1体入れ替え（レア抜き＝物差し・レアあり＝参考。AJ と同じ16枚の作り方）。フォルンは蒼海にいるので、旅立ち・烈火の3体と入れ替えて、3箱と対戦
 * 2. 箱どうし：新しい蒼海（ミュロル・カルシェル・フォルン）と前の蒼海（ミュロル・カルシェル・ノビトン。booster_contents_20261102_AK.json）を、旅立ち・烈火と
 * 3. 1対戦あたり（player 側のフォルンだけ）：はげましのふえ・そなえのふえ・こもりうた・もりのたより・みがわりのふえの回数／そなえのふえで減らしたダメージ／もりのたよりで引いた枚数
 * 4. 決着の理由（倒して勝ち・山札切れで勝ち・倒されて負け・山札切れで負け）
 */
const GAMES = Number(process.env.PLAYTEST ?? 1);
const KEYS = BOOSTERS.map((b) => b.key);
const MAX_STEPS = 6000;
const fo = (n: number): string => `skl-forn-${String(n).padStart(2, '0')}`;
const COUNTED: Record<string, keyof Count> = { [fo(6)]: 'rally', [fo(7)]: 'ward', [fo(8)]: 'lullaby', [fo(9)]: 'tidings' };

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

/** 前の蒼海（指示書 AK の版：ミュロル・カルシェル・ノビトン） */
export function formerSoukai(): Deck {
  const group = akContents.booster_groups.find((g) => g.booster_key === 'booster-3');
  if (!group) throw new Error('booster-3');
  const monsters = ['mon-myurol', 'mon-kalshell', 'mon-nobiton'];
  const skills = group.card_rows.flatMap((row) => {
    const m = monsters.find((x) => cardCatalog.get(x)?.name === row.monster);
    const hit = m ? skillsOf(m).filter((s) => s.name === row.skill_name) : [];
    if (hit.length !== 1 || !hit[0]) throw new Error(`${row.monster} ${row.skill_name}`);
    return Array<string>(row.copies).fill(hit[0].id);
  });
  return { monsters, skills: [...skills, ...group.support_cards.flatMap((row) => Array<string>(row.copies).fill(row.support_id))] };
}

interface Count {
  games: number;
  wins: number;
  winKo: number;
  winDeck: number;
  loseKo: number;
  loseDeck: number;
  turns: number;
  rally: number;
  ward: number;
  wardSaved: number;
  lullaby: number;
  tidings: number;
  tidingsDrawn: number;
  cover: number;
}
const empty = (): Count => ({ games: 0, wins: 0, winKo: 0, winDeck: 0, loseKo: 0, loseDeck: 0, turns: 0, rally: 0, ward: 0, wardSaved: 0, lullaby: 0, tidings: 0, tidingsDrawn: 0, cover: 0 });
const add = (to: Count, c: Count): void => {
  for (const k of Object.keys(c) as (keyof Count)[]) to[k] += c[k];
};

/** そなえのふえが無かったときとの、受けるダメージの差 */
function wardSaving(s: BattleState): number {
  const p = s.pending;
  const target = p ? findMonster(s, p.targetUid) : undefined;
  if (!p || !target || target.side !== 'player' || !target.monster.ward) return 0;
  const without: BattleState = {
    ...s,
    sides: { ...s.sides, player: { ...s.sides.player, monsters: s.sides.player.monsters.map((m) => (m.uid === p.targetUid ? { ...m, ward: null } : m)) } },
  };
  return incomingDamage(without, p) - incomingDamage(s, p);
}

function play(a: Deck, b: Deck, seed: number, first: Side, c: Count): void {
  let s: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b }, seed, first);
  for (let i = 0; i < MAX_STEPS && s.phase !== 'ended'; i++) {
    const side = actingSide(s);
    if (!side) break;
    const action = chooseAction(s, side, 'normal', 'A');
    if (!action) break;
    let deckBefore: number | null = null;
    if (action.type === 'useCard' && s.phase === 'main' && side === 'player') {
      const id = s.sides.player.hand.find((x) => x.uid === action.cardUid)?.cardId;
      const key = id ? COUNTED[id] : undefined;
      if (key) c[key]++;
      if (id === fo(9)) deckBefore = s.sides.player.deck.length;
    }
    if (action.type === 'defend' && side === 'player' && action.cardUid) {
      const id = s.sides.player.hand.find((x) => x.uid === action.cardUid)?.cardId;
      if (id && getPlayCard(id).effect.type === 'cover') c.cover++;
    }
    if (action.type === 'defend' && action.cardUid === null && s.pending?.attacker === 'opponent') c.wardSaved += wardSaving(s);
    s = applyAction(s, action);
    if (deckBefore !== null) c.tidingsDrawn += deckBefore - s.sides.player.deck.length;
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
  rallyPerGame: per(c.rally, c.games),
  wardPerGame: per(c.ward, c.games),
  wardSavedPerGame: per(c.wardSaved, c.games),
  lullabyPerGame: per(c.lullaby, c.games),
  tidingsPerGame: per(c.tidings, c.games),
  tidingsDrawnPerUse: per(c.tidingsDrawn, c.tidings),
  coverPerGame: per(c.cover, c.games),
});

/** フォルンを入れる場所：蒼海以外の箱（旅立ち・烈火）の3体 */
const SLOTS: { key: BoosterKey; slot: number }[] = BOOSTERS.filter((b) => !b.monsters.includes(FORN_MONSTER_ID)).flatMap((b) => [0, 1, 2].map((slot) => ({ key: b.key, slot })));

describe('AL の試遊（フォルン）', () => {
  it('入れ替えの16枚はレア抜きの8種で16枚。入れ替えたデッキ・前の蒼海は山札60枚でルールに合う', () => {
    const cards = playtest16(FORN_MONSTER_ID);
    expect(cards).toHaveLength(8);
    expect(cards.reduce((n, x) => n + x.copies, 0)).toBe(16);
    // 2026-11-02 の正式配布からフォルンは旅立ちにいるので、入れ替えるのは烈火・蒼海の3体（指示書 AL の記録の数字は、旅立ち・烈火で測った当時のもの）
    expect(SLOTS.map((x) => x.key)).toEqual(['booster-2', 'booster-2', 'booster-2', 'booster-3', 'booster-3', 'booster-3']);
    for (const { key, slot } of SLOTS) {
      const d = swapDeck(key, slot, FORN_MONSTER_ID, cards);
      expect(d.skills).toHaveLength(60);
      expect(isDeckValid(d, countCards([...d.monsters, ...d.skills]))).toBe(true);
    }
    const old = formerSoukai();
    expect(old.skills).toHaveLength(60);
    expect(isDeckValid(old, countCards([...old.monsters, ...old.skills]))).toBe(true);
  });

  it(`入れ替え・箱どうし（各組み合わせ・先攻後攻 ${GAMES} 回ずつ）`, () => {
    const out: Record<string, unknown> = { games: GAMES, sixteen: playtest16(FORN_MONSTER_ID), sixteenRare: playtest16(FORN_MONSTER_ID, true) };
    let seed = 1;
    for (const withRare of [false, true]) {
      const swap: Record<string, unknown> = {};
      const all = empty();
      for (const { key, slot } of SLOTS) {
        const c = empty();
        const deck = swapDeck(key, slot, FORN_MONSTER_ID, playtest16(FORN_MONSTER_ID, withRare));
        for (const opp of KEYS) for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(deck, boosterDeck(opp), seed++, first, c);
        swap[`${key}#${slot}:${boosterDeck(key).monsters[slot]}`] = summary(c);
        add(all, c);
      }
      swap.all = summary(all);
      out[withRare ? 'swapRare' : 'swap'] = swap;
    }
    const boxes: Record<string, unknown> = {};
    for (const [name, deck] of [['new', boosterDeck('booster-3')], ['former', formerSoukai()]] as const) {
      const both = empty();
      for (const opp of ['booster-1', 'booster-2'] as const) {
        const c = empty();
        for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(deck, boosterDeck(opp), seed++, first, c);
        boxes[`${name}>${opp}`] = summary(c);
        add(both, c);
      }
      boxes[`${name}>all`] = summary(both);
    }
    out.boxes = boxes;
    const file = process.env.PLAYTEST_OUT;
    if (file) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(out, null, 1));
    }
    expect(seed).toBeGreaterThan(1);
  }, 3_600_000);
});
