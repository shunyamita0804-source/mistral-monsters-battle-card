import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSkill, skillsOf } from '../src/data/cards.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { FLUNE_MONSTER_ID } from '../src/data/flune.ts';
import { GEOL_MONSTER_ID } from '../src/data/geol.ts';
import { HYOUZUKU_MONSTER_ID } from '../src/data/hyouzuku.ts';
import { SHISHIEN_MONSTER_ID } from '../src/data/shishien.ts';
import { HAKURAN_MONSTER_ID } from '../src/data/hakuran.ts';
import { DESUORU_MONSTER_ID } from '../src/data/desuoru.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { PUKARIM_MONSTER_ID } from '../src/data/pukarim.ts';
import { SEREPHINE_MONSTER_ID } from '../src/data/serephine.ts';
import type { CpuSkill } from '../src/data/tournaments.ts';
import { TSUMUJI_MONSTER_ID } from '../src/data/tsumuji.ts';
import { swapDeck } from '../src/game/battle/playtest.ts';
import { countCards, isDeckValid } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';
import { cardName } from '../src/i18n/content.ts';
import { addCount, emptyCount, playCounted, summarize } from './support/boxCount.ts';

/**
 * 入れ替えの試遊（2026-10-30 指示書 Y の E-3。指示書 Z の F-2 で、腕前 A どうし・レア抜きの16枚に。報告だけで、値は直さない）。
 * 最初の箱のモンスター1体を入れ替えたデッキ（3箱 × 3通り＝9つ）で、元の3箱と対戦する（先攻・後攻は半分ずつ・両方とも腕前 A の CPU）。
 * 入れる16枚（6体とも同じ決め方）：レア以外の技（11種）を1枚ずつ＋マナの少ない攻撃技（レア以外。同じなら番号の小さい方）から2枚目を足して16枚
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。npm run playtest:swap（PLAYTEST=200）で各組み合わせ 200 回（PLAYTEST_OUT に JSON）
 */
const GAMES = Number(process.env.PLAYTEST ?? 2);
const KEYS = BOOSTERS.map((b) => b.key);
const SKILL: CpuSkill = 'A';
/** レアありの16枚で測る（2026-10-31 指示書 AG：カラスのめが強すぎないかを見る） */
const WITH_RARE = process.env.PLAYTEST_WITH_RARE === '1';

type Pick = readonly { readonly id: string; readonly copies: number }[];

/**
 * レア以外の技を1枚ずつ＋マナの少ない攻撃技（レア以外）から2枚目を足して16枚。
 * withRare（2026-10-31 指示書 AG。PLAYTEST_WITH_RARE=1）：レア3種も1枚ずつ入れ（14種）、マナの少ない攻撃技（レア以外）から2枚目を足して16枚
 */
export function playtest16(monsterId: string, withRare = WITH_RARE): Pick {
  const rare = new Set(GACHA_SERIES.find((g) => g.monsterId === monsterId)?.rareSkillNames ?? []);
  const normal = skillsOf(monsterId).filter((k) => withRare || !rare.has(k.name));
  const second = normal
    .filter((k) => k.effect.type === 'attack' && !rare.has(k.name))
    .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))
    .slice(0, 16 - normal.length)
    .map((k) => k.id);
  return normal.map((k) => ({ id: k.id, copies: second.includes(k.id) ? 2 : 1 }));
}

// 2026-10-31 指示書 AB：シシエンを足した（PLAYTEST_SUBJECTS=mon-shishien でしぼれる）。指示書 AF：ハクランを足した（PLAYTEST_SUBJECTS=mon-hakuran）。指示書 AG：デスオル（mon-desuoru。PLAYTEST_WITH_RARE=1 でレアありの16枚）
const ALL_SUBJECTS: readonly string[] = [GEOL_MONSTER_ID, FLUNE_MONSTER_ID, HYOUZUKU_MONSTER_ID, TSUMUJI_MONSTER_ID, PUKARIM_MONSTER_ID, SEREPHINE_MONSTER_ID, SHISHIEN_MONSTER_ID, HAKURAN_MONSTER_ID, DESUORU_MONSTER_ID];
const SUBJECTS: readonly string[] = process.env.PLAYTEST_SUBJECTS ? ALL_SUBJECTS.filter((id) => process.env.PLAYTEST_SUBJECTS?.split(',').includes(id)) : ALL_SUBJECTS;

describe('入れ替えの試遊（腕前 A どうし・レア抜きの16枚）', () => {
  it('16枚ずつ・レアは入らない', () => {
    for (const id of SUBJECTS) {
      const cards = playtest16(id);
      expect(cards.reduce((n, c) => n + c.copies, 0), id).toBe(16);
      const rare = GACHA_SERIES.find((g) => g.monsterId === id)?.rareSkillNames ?? [];
      expect(rare, id).toHaveLength(3);
      expect(cards.filter((c) => rare.includes(getSkill(c.id).name)).length, id).toBe(WITH_RARE ? 3 : 0);
    }
  });

  it('入れ替えたデッキは、山札60枚で、ルールに合う', () => {
    for (const id of SUBJECTS) {
      for (const key of KEYS) {
        for (let slot = 0; slot < 3; slot++) {
          const d = swapDeck(key, slot, id, playtest16(id));
          expect(d.skills).toHaveLength(60);
          expect(isDeckValid(d, countCards([...d.monsters, ...d.skills])), `${id} ${key}#${slot}`).toBe(true);
        }
      }
    }
  });

  it(`各組み合わせ ${GAMES} 回ずつ：入れ替えたデッキの勝つ割合・決着の理由`, () => {
    const base = emptyCount();
    KEYS.forEach((a, i) => {
      KEYS.forEach((b, j) => {
        for (let g = 0; g < GAMES; g++) playCounted(boosterDeck(a), boosterDeck(b), 1000 + i * 100 + j * 10 + g * 7919, g % 2 === 0 ? 'player' : 'opponent', base, 1, SKILL);
      });
    });
    const subjects: Record<string, unknown> = {};
    SUBJECTS.forEach((id, n) => {
      const cards = playtest16(id);
      const all = emptyCount();
      const rows: Record<string, unknown> = {};
      KEYS.forEach((a, i) => {
        for (let slot = 0; slot < 3; slot++) {
          const deck = swapDeck(a, slot, id, cards);
          const row = emptyCount();
          KEYS.forEach((b, j) => {
            for (let g = 0; g < GAMES; g++) playCounted(deck, boosterDeck(b), 70000 + n * 10000 + i * 1000 + slot * 100 + j * 10 + g * 7919, g % 2 === 0 ? 'player' : 'opponent', row, 1, SKILL);
          });
          rows[`${a}#${slot}`] = { out: cardName(boosterDeck(a).monsters[slot] ?? ''), ...summarize(row) };
          addCount(all, row);
        }
      });
      subjects[id] = { name: cardName(id), cards, all: summarize(all), rows };
    });
    const out = { games: GAMES, skill: SKILL, base: summarize(base), subjects };
    if (process.env.PLAYTEST_OUT) {
      mkdirSync(dirname(process.env.PLAYTEST_OUT), { recursive: true });
      writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 1));
    }
    expect(Object.keys(subjects)).toHaveLength(SUBJECTS.length);
  }, 3_600_000);
});
