import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardCatalog, skillsOf } from '../src/data/cards.ts';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { BOOSTERS, type BoosterKey } from '../src/data/introV2.ts';
import now from '../src/data/official/booster_contents_20261028.json';
import draft from '../src/data/official/booster_contents_20261029_draft.json';
import { playFluneMatch, type FluneMatchOptions } from '../src/game/battle/flunePlaytest.ts';
import { buildOpponentDeck, countCards, isDeckValid, type Deck } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';

/**
 * 「烈火の猛攻」（booster-2）が弱いのを直す試遊（2026-10-29 夜 ユーザー指示）。表を見て、ユーザーが案3 に決めた（ゲームの箱＝booster_contents_20261029.json）。
 * 箱の技の中身を資料の JSON（前＝booster_contents_20261028.json、案・案3＝booster_contents_20261029_draft.json）から作り、
 * 仮サポート12枚・モンスターは今の箱のまま。両方とも相手の CPU と同じ思考で最後まで自動で対戦する（flunePlaytest.ts の playFluneMatch）。
 * ふだん（npm run check）は少ない回数で動くことだけ確かめる。npm run playtest:rekka（PLAYTEST=200）で各 200 回（先攻・後攻は半分ずつ）
 * 2026-11-01 指示書 AJ：前の資料の箱は外した技が入っていて作れないので、いまの箱（booster_contents_20261101_AJ.json・仮）だけで表を出す
 */
const GAMES = Number(process.env.PLAYTEST ?? 4);
const KEYS = BOOSTERS.map((b) => b.key);

interface Row {
  readonly monster: string;
  readonly skill_name: string;
  readonly copies: number;
}

const name = (id: string): string => cardCatalog.get(id)?.name ?? id;

const rowsOf = (data: { booster_groups: readonly { booster_key: string; card_rows: readonly Row[] }[] }, key: string): readonly Row[] =>
  data.booster_groups.find((g) => g.booster_key === key)?.card_rows ?? [];

// 指示書 AJ で外した技（skl-gauul14-11 翼の盾・skl-gauul14-12 炎の壁 など）が前の資料の行に入っていて、前の烈火の猛攻・案・案3 の箱はもう作れないので、
// 資料の行から箱を作って比べるテスト（案3 と 2026-10-30 の箱の差が8枚）は消した。いまの箱（指示書 AJ・仮）だけで勝率の表を出す
/** 試す烈火の猛攻：今の箱（指示書 AJ） */
const REKKA: Readonly<Record<string, Deck>> = {
  now: boosterDeck('booster-2'),
};

interface Tally {
  wins: number;
  losses: number;
  draws: number;
  turns: number;
}

function series(a: Deck, b: Deck, games: number, seedBase: number, options: FluneMatchOptions = {}): Tally {
  const t: Tally = { wins: 0, losses: 0, draws: 0, turns: 0 };
  for (let i = 0; i < games; i++) {
    const r = playFluneMatch(a, b, seedBase + i * 7919, i % 2 === 0 ? 'player' : 'opponent', options);
    if (r.winner === 'player') t.wins++;
    else if (r.winner === 'opponent') t.losses++;
    else t.draws++;
    t.turns += r.turns;
  }
  return t;
}

describe('烈火の猛攻の試遊（自動の対戦）', () => {
  it('前の資料（20261028・20261029_draft）は変えない：ほかの箱の行は同じ。資料の行に、指示書 AJ で外した技が入っている。いまの烈火の猛攻は技48枚・同じカード3枚まで・ルールに合う', () => {
    for (const key of ['booster-1', 'booster-3']) expect(rowsOf(draft, key)).toEqual(rowsOf(now, key));
    const box = boosterDeck('booster-2');
    const missing = rowsOf(now, 'booster-2').filter((row) => {
      const monster = box.monsters.find((m) => name(m) === row.monster);
      return !monster || !skillsOf(monster).some((s) => s.name === row.skill_name);
    });
    expect(missing.map((r) => r.skill_name)).toContain('翼の盾');
    for (const [id, deck] of Object.entries(REKKA)) {
      const skills = deck.skills.filter((c) => cardCatalog.get(c)?.kind === 'skill');
      expect(skills, id).toHaveLength(48);
      expect(Math.max(...Object.values(countCards(skills))), id).toBeLessThanOrEqual(3);
      expect(isDeckValid(deck, countCards([...deck.monsters, ...deck.skills])), id).toBe(true);
    }
  });

  it(`各組み合わせ ${GAMES} 回ずつ：勝率の表`, () => {
    const out: Record<string, unknown> = { games: GAMES };
    const sera = ENCOUNTERS['enc-forest-boss'];
    if (!sera) throw new Error('sera');
    const seraDeck = buildOpponentDeck({ monsters: [...sera.monsters] });
    const seraOpt: FluneMatchOptions = { bLifeScale: sera.lifeScale ?? 1, ...(sera.ai ? { bStyle: sera.ai } : {}) };
    const all: Tally[] = [];
    for (const [id, rekka] of Object.entries(REKKA)) {
      const deckOf = (key: BoosterKey): Deck => (key === 'booster-2' ? rekka : boosterDeck(key));
      // 箱どうし（A が B に勝つ。同じ seed で、烈火の中身だけを変える）
      const boxes: Record<string, Record<string, Tally>> = {};
      KEYS.forEach((a, i) => {
        boxes[a] = {};
        KEYS.forEach((b, j) => {
          if (a === b) return;
          const t = series(deckOf(a), deckOf(b), GAMES, 30000 + i * 100 + j * 10);
          (boxes[a] as Record<string, Tally>)[b] = t;
          all.push(t);
        });
      });
      const seraRow = Object.fromEntries(KEYS.map((a, i) => [a, series(deckOf(a), seraDeck, GAMES, 50000 + i * 10, seraOpt)]));
      all.push(...Object.values(seraRow));
      out[id] = { boxes, sera: seraRow };
    }
    if (process.env.PLAYTEST_OUT) writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify(out, null, 1));
    expect(all.reduce((n, t) => n + t.draws, 0)).toBeLessThanOrEqual(all.length * GAMES * 0.02);
  }, 1_800_000);
});
