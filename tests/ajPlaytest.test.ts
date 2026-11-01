import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPlayCard, getSkill, skillsOf } from '../src/data/cards.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS, type BoosterKey } from '../src/data/introV2.ts';
import { AJ_MONSTER_IDS } from '../src/data/skillRebuildAJ.ts';
import type { CpuSkill } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import {
  actingSide,
  applyAction,
  createBattle,
  fallenAllies,
  findMonster,
  incomingDamage,
  isTideActive,
  requiemVictims,
  activeField,
  type BattleState,
  type Side,
} from '../src/game/battle/engine.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/**
 * 指示書 AJ【7】の試遊（数字は報告するだけ。カードの数字は変えない）。
 * PLAYTEST=回数 で、1体入れ替え（15体・レア抜き／レアあり）・箱どうし（腕前 A・B・C）・決着の理由・新しい効果の回数を数えて PLAYTEST_OUT に書く。
 * 追加その3（みちしおは使った側の次の自分の手番の終わりまで）：tideTidal＝みちしおを使った側が、水中のあいだに水中で強くなる攻撃（2倍・水中の相手に防御／回避されない）を使った回数、tideTidalKo＝それで倒した回数
 */
const GAMES = Number(process.env.PLAYTEST ?? 1);
const KEYS = BOOSTERS.map((b) => b.key);
const MAX_STEPS = 6000;

type Pick = { readonly id: string; readonly copies: number }[];

/** 入れ替えの16枚：レア抜き（またはレアあり）の技を1枚ずつ、16枚に足りない分は安い攻撃からもう1枚ずつ（同じカード3枚まで） */
export function ajPlaytest16(monsterId: string, withRare: boolean): Pick {
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

interface Count {
  games: number;
  winsA: number;
  ko: number;
  deckOut: number;
  turns: number;
  halfOnEvade: number;
  tide: number;
  tideTidal: number;
  tideTidalKo: number;
  requiem: number;
  requiemFoes: number;
  requiemFriends: number;
  fallenBonusUses: number;
  fallenBonusTotal: number;
  recoil: number;
  recoilKo: number;
  recoilLoss: number;
}
const empty = (): Count => ({ games: 0, winsA: 0, ko: 0, deckOut: 0, turns: 0, halfOnEvade: 0, tide: 0, tideTidal: 0, tideTidalKo: 0, requiem: 0, requiemFoes: 0, requiemFriends: 0, fallenBonusUses: 0, fallenBonusTotal: 0, recoil: 0, recoilKo: 0, recoilLoss: 0 });
const add = (to: Count, c: Count): void => {
  for (const k of Object.keys(c) as (keyof Count)[]) to[k] += c[k];
};

/** a（player）と b（opponent）の1対戦（両方の腕前 skillA・skillB） */
function play(a: Deck, b: Deck, seed: number, first: Side, c: Count, skillA: CpuSkill = 'A', skillB: CpuSkill = 'A'): void {
  let s: BattleState = createBattle({ name: 'A', deck: a }, { name: 'B', deck: b }, seed, first);
  let watchTidal: { target: string } | null = null;
  for (let i = 0; i < MAX_STEPS && s.phase !== 'ended'; i++) {
    const side = actingSide(s);
    if (!side) break;
    const action = chooseAction(s, side, 'normal', side === 'player' ? skillA : skillB);
    if (!action) break;
    if (action.type === 'useCard' && s.phase === 'main') {
      const hand = s.sides[side].hand.find((x) => x.uid === action.cardUid);
      const card = hand ? getPlayCard(hand.cardId) : null;
      if (card?.kind === 'skill') {
        const e = card.effect;
        const user = action.userUid ? findMonster(s, action.userUid)?.monster : undefined;
        if (e.type === 'tide') c.tide++;
        if (e.type === 'attack' && (e.doubleInWater || e.unblockableVsWater || e.undodgeableVsWater) && isTideActive(s) && activeField(s)?.owner === side) {
          c.tideTidal++;
          if (action.targetUid) watchTidal = { target: action.targetUid };
        }
        if (e.type === 'requiem' && user) {
          const v = requiemVictims(s, user.uid);
          c.requiem++;
          c.requiemFoes += v.filter((m) => findMonster(s, m.uid)?.side !== side).length;
          c.requiemFriends += v.filter((m) => findMonster(s, m.uid)?.side === side).length;
        }
        if (e.type === 'attack' && e.fallenAllyBonus) {
          c.fallenBonusUses++;
          c.fallenBonusTotal += e.fallenAllyBonus * fallenAllies(s, user);
        }
      }
    }
    if (action.type === 'defend' && action.cardUid === null && s.pending) {
      const evaded = s.pending.responses.some((id) => getSkill(id).effect.type === 'evade');
      const atk = getPlayCard(s.pending.cardId);
      if (evaded && atk.kind === 'skill' && atk.effect.type === 'attack' && atk.effect.halfOnEvade && incomingDamage(s, s.pending) > 0) c.halfOnEvade++;
    }
    const before = s;
    s = applyAction(s, action);
    // 反動
    for (const f of s.fx.filter((x) => x.seq > (before.fxSeq ?? 0) && x.kind === 'recoil')) {
      c.recoil++;
      const fell = s.sides[f.side].monsters.some((m) => m.life === 0 && (before.sides[f.side].monsters.find((x) => x.uid === m.uid)?.life ?? 0) > 0);
      if (fell) {
        c.recoilKo++;
        if (s.phase === 'ended' && s.winner !== f.side) c.recoilLoss++;
      }
    }
    if (watchTidal && !s.pending && s.phase !== 'defense') {
      if ((findMonster(s, watchTidal.target)?.monster.life ?? 1) === 0) c.tideTidalKo++;
      watchTidal = null;
    }
  }
  c.games++;
  c.turns += s.turn;
  if (s.winner === 'player') c.winsA++;
  if (s.winner === 'player' || s.winner === 'opponent') {
    if (s.endReason === 'deckOut') c.deckOut++;
    else c.ko++;
  }
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);
const per = (n: number, of: number): number => Math.round((n / Math.max(1, of)) * 100) / 100;
const summary = (c: Count): Record<string, number> => ({
  games: c.games,
  winA: pct(c.winsA, c.games),
  ko: pct(c.ko, c.games),
  deckOut: pct(c.deckOut, c.games),
  avgTurns: Math.round((c.turns / Math.max(1, c.games)) * 10) / 10,
  halfOnEvade: c.halfOnEvade,
  tide: c.tide,
  tideTidal: c.tideTidal,
  tideTidalKo: c.tideTidalKo,
  requiem: c.requiem,
  requiemFoes: c.requiemFoes,
  requiemFriends: c.requiemFriends,
  fallenBonusUses: c.fallenBonusUses,
  fallenBonusAvg: Math.round((c.fallenBonusTotal / Math.max(1, c.fallenBonusUses)) * 100) / 100,
  recoil: c.recoil,
  recoilPerGame: per(c.recoil, c.games),
  recoilKo: c.recoilKo,
  recoilLoss: c.recoilLoss,
});

/** X を入れられる（箱に X がいない）箱と入れ替える場所 */
function swapSlots(monsterId: string): { key: BoosterKey; slot: number }[] {
  return BOOSTERS.filter((b) => !b.monsters.includes(monsterId)).flatMap((b) => [0, 1, 2].map((slot) => ({ key: b.key, slot })));
}

describe('AJ の試遊', () => {
  it('入れ替えの16枚はレア抜き・16枚。入れ替えたデッキは山札60枚でルールに合う', () => {
    for (const id of AJ_MONSTER_IDS) {
      for (const withRare of [false, true]) {
        const cards = ajPlaytest16(id, withRare);
        expect(cards.reduce((n, c) => n + c.copies, 0), id).toBe(16);
      }
      for (const { key, slot } of swapSlots(id)) {
        const d = swapDeck(key, slot, id, ajPlaytest16(id, false));
        expect(d.skills).toHaveLength(60);
        expect(isDeckValid(d, countCards([...d.monsters, ...d.skills])), `${id} ${key}#${slot}`).toBe(true);
      }
    }
  });

  it(`入れ替え・箱どうし（各組み合わせ ${GAMES} 回）`, () => {
    {
      const out: Record<string, unknown> = { games: GAMES, tide: '使った側の次の自分の手番の終わりまで（追加その3）' };
      const subjects = process.env.PLAYTEST_SUBJECTS ? AJ_MONSTER_IDS.filter((id) => process.env.PLAYTEST_SUBJECTS?.split(',').includes(id)) : AJ_MONSTER_IDS;
      const all = empty();
      let seed = 1;
      // 1・2：1体入れ替え（腕前 A どうし）。レア抜き・レアあり
      for (const withRare of process.env.PLAYTEST_SKIP_SWAP === '1' ? [] : [false, true]) {
        const table: Record<string, unknown> = {};
        for (const id of subjects) {
          const c = empty();
          for (const { key, slot } of swapSlots(id)) {
            const deck = swapDeck(key, slot, id, ajPlaytest16(id, withRare));
            for (const opp of KEYS) {
              for (let g = 0; g < GAMES; g++) {
                for (const first of ['player', 'opponent'] as const) play(deck, boosterDeck(opp), seed++, first, c);
              }
            }
          }
          table[id] = c.games > 0 ? summary(c) : { note: '3箱すべてに入っているので、1体入れ替えでは測れない' };
          add(all, c);
        }
        out[withRare ? 'swapRare' : 'swap'] = table;
      }
      // 3：箱どうし（腕前 A・B・C）
      const boxes: Record<string, unknown> = {};
      for (const skill of ['A', 'B', 'C'] as const) {
        for (const a of KEYS) {
          for (const b of KEYS) {
            if (a === b) continue;
            const c = empty();
            for (let g = 0; g < GAMES; g++) for (const first of ['player', 'opponent'] as const) play(boosterDeck(a), boosterDeck(b), seed++, first, c, skill, skill);
            boxes[`${skill}:${a}>${b}`] = summary(c);
            add(all, c);
          }
        }
      }
      out.boxes = boxes;
      out.all = summary(all);
      const file = process.env.PLAYTEST_OUT;
      if (file) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, JSON.stringify(out, null, 1));
      }
      expect(all.games).toBeGreaterThan(0);
    }
  }, 3_600_000);
});
