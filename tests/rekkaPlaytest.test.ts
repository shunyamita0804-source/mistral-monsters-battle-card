import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardCatalog, LEGACY_SUPPORT_IDS, skillsOf } from '../src/data/cards.ts';
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
 */
const GAMES = Number(process.env.PLAYTEST ?? 4);
const KEYS = BOOSTERS.map((b) => b.key);

interface Row {
  readonly monster: string;
  readonly skill_name: string;
  readonly copies: number;
}

const name = (id: string): string => cardCatalog.get(id)?.name ?? id;

/** 資料の行（モンスター名・技名・枚数）から箱のデッキを作る。サポートは 2026-10-29 の箱と同じ12枚（sup-1〜6 を2枚ずつ。中身は 2026-10-30 指示書 Y から新しいカード） */
function deckFromRows(key: BoosterKey, rows: readonly Row[]): Deck {
  const base = boosterDeck(key);
  const skills: string[] = [];
  for (const row of rows) {
    const monster = base.monsters.find((m) => name(m) === row.monster);
    const hit = monster ? skillsOf(monster).filter((s) => s.name === row.skill_name) : [];
    if (hit.length !== 1 || !hit[0]) throw new Error(`${row.monster} ${row.skill_name}`);
    for (let i = 0; i < row.copies; i++) skills.push(hit[0].id);
  }
  const supports = LEGACY_SUPPORT_IDS.flatMap((id) => [id, id]);
  return { monsters: [...base.monsters], skills: [...skills, ...supports] };
}

const rowsOf = (data: { booster_groups: readonly { booster_key: string; card_rows: readonly Row[] }[] }, key: string): readonly Row[] =>
  data.booster_groups.find((g) => g.booster_key === key)?.card_rows ?? [];

/** 案3（案2 で目安に入らなかったときの入れかえ。草案の JSON の trial_variants に同じものを書く） */
const variantRows = (id: string): readonly Row[] | null => (draft as { trial_variants?: { id: string; card_rows: Row[] }[] }).trial_variants?.find((v) => v.id === id)?.card_rows ?? null;

/** 試す烈火の猛攻：今・新しい（案）・案3 */
const REKKA: Readonly<Record<string, Deck>> = {
  now: deckFromRows('booster-2', rowsOf(now, 'booster-2')),
  draft: deckFromRows('booster-2', rowsOf(draft, 'booster-2')),
  ...(variantRows('plan3') ? { plan3: deckFromRows('booster-2', variantRows('plan3') ?? []) } : {}),
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
  it('案3 は 2026-10-29 の箱と同じ（2026-10-30 指示書 Y で今の箱は技を8枚足した）。どれも技48枚・同じカード3枚まで・ルールに合う。ほかの箱の行は変えない', () => {
    const plan3 = countCards((REKKA.plan3?.skills ?? []).filter((c) => cardCatalog.get(c)?.kind === 'skill'));
    const now3 = countCards(boosterDeck('booster-2').skills.filter((c) => cardCatalog.get(c)?.kind === 'skill'));
    const added = Object.entries(now3).filter(([id, n]) => n !== (plan3[id] ?? 0)).map(([id, n]) => n - (plan3[id] ?? 0));
    expect(added).toEqual(Array(8).fill(1));
    for (const [id, deck] of Object.entries(REKKA)) {
      const skills = deck.skills.filter((c) => cardCatalog.get(c)?.kind === 'skill');
      expect(skills, id).toHaveLength(48);
      expect(Math.max(...Object.values(countCards(skills))), id).toBeLessThanOrEqual(3);
      expect(isDeckValid(deck, countCards([...deck.monsters, ...deck.skills])), id).toBe(true);
    }
    for (const key of ['booster-1', 'booster-3']) expect(rowsOf(draft, key)).toEqual(rowsOf(now, key));
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
