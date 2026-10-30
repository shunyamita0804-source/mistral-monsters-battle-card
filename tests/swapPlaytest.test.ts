import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSkill } from '../src/data/cards.ts';
import { FLUNE_MONSTER_ID, FLUNE_PLAYTEST_16 } from '../src/data/flune.ts';
import { GEOL_MONSTER_ID, GEOL_PLAYTEST_16 } from '../src/data/geol.ts';
import { HYOUZUKU_MONSTER_ID, HYOUZUKU_PLAYTEST_16 } from '../src/data/hyouzuku.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { PUKARIM_MONSTER_ID, PUKARIM_PLAYTEST_16 } from '../src/data/pukarim.ts';
import { SEREPHINE_MONSTER_ID, serephineSkillId } from '../src/data/serephine.ts';
import { TSUMUJI_MONSTER_ID, tsumujiSkillId } from '../src/data/tsumuji.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';
import { cardName } from '../src/i18n/content.ts';
import { addCount, emptyCount, playCounted, summarize } from './support/boxCount.ts';

/**
 * 入れ替えの試遊（2026-10-30 指示書 Y の E-3。報告だけで、値は直さない）。
 * 新しい最初の箱（サポートは旅の手帳2・投石2）のモンスター1体を入れ替えたデッキ（3箱 × 3通り＝9つ）で、元の3箱と対戦する（先攻・後攻は半分ずつ・両方とも CPU の思考）。
 * ジオル・プカリム・フルーネ・ヒョウズクはそれぞれの試遊用の16枚。セレフィーン・ツムジは試遊用の16枚が無いので、ヒョウズク・ジオルに近い決め方
 * （1〜13 を1枚ずつ、消費マナがいちばん少ない攻撃3つ〔同じなら番号の小さい方〕を2枚に）で、ここで作る【Claude の仮】。
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。npm run playtest:swap（PLAYTEST=200）で各組み合わせ 200 回（PLAYTEST_OUT に JSON）
 */
const GAMES = Number(process.env.PLAYTEST ?? 2);
const KEYS = BOOSTERS.map((b) => b.key);

type Pick = readonly { readonly id: string; readonly copies: number }[];

/** 1〜13 を1枚ずつ、消費マナがいちばん少ない攻撃3つ（同じなら番号の小さい方）を2枚に */
export function playtest16(skillId: (no: number) => string): Pick {
  const ids = Array.from({ length: 13 }, (_, i) => skillId(i + 1));
  const cheap = ids
    .filter((id) => getSkill(id).effect.type === 'attack')
    .sort((a, b) => getSkill(a).cost - getSkill(b).cost || a.localeCompare(b))
    .slice(0, 3);
  return ids.map((id) => ({ id, copies: cheap.includes(id) ? 2 : 1 }));
}

const SUBJECTS: readonly { readonly id: string; readonly cards: Pick }[] = [
  { id: GEOL_MONSTER_ID, cards: GEOL_PLAYTEST_16 },
  { id: PUKARIM_MONSTER_ID, cards: PUKARIM_PLAYTEST_16 },
  { id: FLUNE_MONSTER_ID, cards: FLUNE_PLAYTEST_16 },
  { id: SEREPHINE_MONSTER_ID, cards: playtest16(serephineSkillId) },
  { id: TSUMUJI_MONSTER_ID, cards: playtest16(tsumujiSkillId) },
  { id: HYOUZUKU_MONSTER_ID, cards: HYOUZUKU_PLAYTEST_16 },
];

describe('入れ替えの試遊（新しい最初の箱）', () => {
  it('16枚ずつ（セレフィーン：ビンタ・おびれ・みずたまを2枚。ツムジ：ひっかく・Wひっかき・かまいたちを2枚）', () => {
    expect(playtest16(serephineSkillId).filter((c) => c.copies === 2).map((c) => c.id)).toEqual([1, 2, 4].map(serephineSkillId));
    expect(playtest16(tsumujiSkillId).filter((c) => c.copies === 2).map((c) => c.id)).toEqual([1, 2, 3].map(tsumujiSkillId));
    for (const s of SUBJECTS) expect(s.cards.reduce((n, c) => n + c.copies, 0), s.id).toBe(16);
  });

  it('入れ替えたデッキは、山札60枚で、ルールに合う', () => {
    for (const s of SUBJECTS) {
      for (const key of KEYS) {
        for (let slot = 0; slot < 3; slot++) {
          const d = swapDeck(key, slot, s.id, s.cards);
          expect(d.skills).toHaveLength(60);
          expect(isDeckValid(d, countCards([...d.monsters, ...d.skills])), `${s.id} ${key}#${slot}`).toBe(true);
        }
      }
    }
  });

  it(`各組み合わせ ${GAMES} 回ずつ：入れ替えたデッキの勝つ割合・決着の理由`, () => {
    const base = emptyCount();
    KEYS.forEach((a, i) => {
      KEYS.forEach((b, j) => {
        for (let g = 0; g < GAMES; g++) playCounted(boosterDeck(a), boosterDeck(b), 1000 + i * 100 + j * 10 + g * 7919, g % 2 === 0 ? 'player' : 'opponent', base);
      });
    });
    const subjects: Record<string, unknown> = {};
    SUBJECTS.forEach((s, n) => {
      const all = emptyCount();
      const rows: Record<string, unknown> = {};
      KEYS.forEach((a, i) => {
        for (let slot = 0; slot < 3; slot++) {
          const deck = swapDeck(a, slot, s.id, s.cards);
          const row = emptyCount();
          KEYS.forEach((b, j) => {
            for (let g = 0; g < GAMES; g++) playCounted(deck, boosterDeck(b), 70000 + n * 10000 + i * 1000 + slot * 100 + j * 10 + g * 7919, g % 2 === 0 ? 'player' : 'opponent', row);
          });
          rows[`${a}#${slot}`] = { out: cardName(boosterDeck(a).monsters[slot] ?? ''), ...summarize(row) };
          addCount(all, row);
        }
      });
      subjects[s.id] = { name: cardName(s.id), cards: s.cards, all: summarize(all), rows };
    });
    const out = { games: GAMES, base: summarize(base), subjects };
    if (process.env.PLAYTEST_OUT) {
      mkdirSync(dirname(process.env.PLAYTEST_OUT), { recursive: true });
      writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 1));
    }
    expect(Object.keys(subjects)).toHaveLength(SUBJECTS.length);
  }, 3_600_000);
});
