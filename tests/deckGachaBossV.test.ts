import { describe, expect, it } from 'vitest';
import { skillsOf } from '../src/data/cards.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { RUN_DUNGEONS } from '../src/data/dungeonRun.ts';
import { GACHA, GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS, EXAM_OPPONENT, STARTER_DECKS } from '../src/data/introV2.ts';
import { DECK_RULES } from '../src/data/rules.ts';
import { TEST_TEAM, TEST_TEAM_ALT } from '../src/data/testTeams.ts';
import { getTournament, TOURNAMENTS, tournamentOpponents } from '../src/data/tournaments.ts';
import {
  ACE_SKILL_COPIES,
  buildOpponentDeck,
  countCards,
  createMixedTestDeck,
  createStarterDeck,
  deckInvalidText,
  hasDuplicateMonsters,
  isDeckValid,
  validateDeck,
} from '../src/game/deck/deck.ts';
import { drawSeriesPack, purchaseSeriesPack, seriesLineup } from '../src/game/economy/gachaSeries.ts';
import { entryCheck } from '../src/game/progress/tournament.ts';
import { createNewSave, normalizeSave, SAVE_VERSION, type SaveData } from '../src/game/save/saveData.ts';
import { PETE_OPPONENT } from '../src/game/story/pete.ts';
import { t, setLanguage } from '../src/i18n/i18n.ts';

/**
 * 2026-10-30 指示書 V：同じモンスターは1つのデッキに1体まで・ガチャのモンスターカードは「まだ持っていないとき」だけ・ボスのデッキは切り札の技を2枚ずつ
 */
const base = (): SaveData => createNewSave(new Date('2026-10-30T00:00:00Z'), 'balance');

/** ゲームに出てくる相手の編成（3体）をすべて */
function allOpponentTeams(): { who: string; monsters: readonly string[] }[] {
  const out: { who: string; monsters: readonly string[] }[] = [];
  for (const o of Object.values(ENCOUNTERS)) out.push({ who: o.id, monsters: o.monsters });
  for (const tour of TOURNAMENTS) for (const o of tournamentOpponents(tour)) out.push({ who: `${tour.id}:${o.id}`, monsters: o.monsters });
  for (const [id, c] of Object.entries(RUN_DUNGEONS)) {
    c.npcTeams.forEach((team, i) => out.push({ who: `${id}:npc${i}`, monsters: team }));
    out.push({ who: `${id}:guardian`, monsters: c.guardianTeam });
  }
  out.push({ who: 'exam', monsters: EXAM_OPPONENT.monsters }, { who: 'pete', monsters: PETE_OPPONENT.monsters });
  out.push({ who: 'TEST_TEAM', monsters: TEST_TEAM }, { who: 'TEST_TEAM_ALT', monsters: TEST_TEAM_ALT });
  return out;
}

describe('V1 同じモンスターは1つのデッキに1体まで', () => {
  it('決まり：allowDuplicateMonsters は false。同じモンスターが2体のデッキは正しくない', () => {
    expect(DECK_RULES.allowDuplicateMonsters).toBe(false);
    const ok = createStarterDeck();
    expect(new Set(ok.monsters).size).toBe(3);
    expect(isDeckValid(ok)).toBe(true);
    const dup = { ...ok, monsters: [ok.monsters[0] as string, ok.monsters[0] as string, ok.monsters[2] as string] };
    expect(validateDeck(dup).map((i) => i.code)).toContain('duplicateMonster');
    expect(hasDuplicateMonsters(dup)).toBe(true);
  });

  it('どの相手のモンスターも3体ちがう（ダンジョン・大会・試験・ピート・練習）', () => {
    const teams = allOpponentTeams();
    expect(teams.length).toBeGreaterThan(40);
    const bad = teams.filter((x) => new Set(x.monsters).size !== x.monsters.length).map((x) => `${x.who}:${x.monsters.join(',')}`);
    expect(bad).toEqual([]);
    for (const d of [...STARTER_DECKS, ...BOOSTERS]) expect(new Set(d.monsters).size, d.key).toBe(3);
  });

  it('見えない番人の組みかえ（そのダンジョンらしさを残す）', () => {
    expect(RUN_DUNGEONS['dungeon-01']?.guardianTeam).toEqual(['mon-kalshell', 'mon-nobiton', 'mon-myurol']);
    expect(RUN_DUNGEONS['dungeon-03']?.guardianTeam).toEqual(['mon-kalshell', 'mon-myurol', 'mon-nobiton']);
    expect(RUN_DUNGEONS['dungeon-04']?.guardianTeam).toEqual(['mon-kalshell', 'mon-nobiton', 'mon-myurol']);
    expect(RUN_DUNGEONS['dungeon-05']?.guardianTeam).toEqual(['mon-gauul', 'mon-lazuck', 'mon-nobiton']);
    expect(RUN_DUNGEONS['dungeon-06']?.guardianTeam).toEqual(['mon-lazuck', 'mon-nobiton', 'mon-gauul']);
    expect(TEST_TEAM).toEqual(['mon-soramo', 'mon-lazuck', 'mon-pukarim']);
    expect(TEST_TEAM_ALT).toEqual(['mon-lazuck', 'mon-soramo', 'mon-pukarim']);
  });

  it('組みかえで変わった強さは、ライフで前の勝つ割合に近づけた（番人の guardianLifeBonus・練習の相手の lifeScale）', () => {
    expect(Object.fromEntries(Object.entries(RUN_DUNGEONS).map(([id, c]) => [id, c.guardianLifeBonus]))).toEqual({
      'dungeon-01': -0.2,
      'dungeon-02': 0,
      'dungeon-03': 0,
      'dungeon-08': 0,
      'dungeon-04': -0.2,
      'dungeon-05': -0.2,
      'dungeon-06': -0.3,
      'dungeon-07': 0.3,
    });
    expect(ENCOUNTERS['enc-practice']?.lifeScale).toBe(0.65);
  });

  it('前の仮の編成（ソラモ・ラズック・ソラモ）のデッキは、前のセーブを見分けるためだけに残す', () => {
    expect(createMixedTestDeck().monsters).toEqual(['mon-soramo', 'mon-lazuck', 'mon-soramo']);
  });

  it('前のセーブ：同じモンスターが2体のデッキは壊さずに読み込む（カードもそのまま）。対戦・ダンジョン・大会の前に組み直しの案内', () => {
    const b = base();
    const first = b.deck.monsters[0] as string;
    const old = {
      ...b,
      version: 29,
      collection: { ...b.collection, [first]: 2 },
      deck: { ...b.deck, monsters: [first, first, b.deck.monsters[2] as string] },
    };
    const s = normalizeSave(JSON.parse(JSON.stringify(old)));
    if (!s) throw new Error('load');
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.deck.monsters).toEqual(old.deck.monsters);
    expect(s.collection[first]).toBe(2);
    expect(isDeckValid(s.deck, s.collection)).toBe(false);
    expect(deckInvalidText(s.deck, 'world.deckInvalidBattle')).toBe(t('deck.duplicateGuide'));
    expect(deckInvalidText(b.deck, 'world.deckInvalidBattle')).toBe(t('world.deckInvalidBattle'));
    const e = getTournament('tournament-e');
    if (!e) throw new Error('e');
    expect(entryCheck({ ...s, calendar: { year: 1, month: 6 } }, e).reasons).toContain(t('deck.duplicateGuide'));
    setLanguage('en');
    try {
      expect(t('deck.duplicateGuide')).toMatch(/only once/);
    } finally {
      setLanguage('ja');
    }
  });

  it('セーブの version は上げていない（デッキ・カードは書きかえないので。2026-10-30 指示書 W で氷の洞窟の祭壇のために 30 に）', () => {
    expect(SAVE_VERSION).toBe(30);
  });
});

describe('V2 ガチャのモンスターカードは「まだ持っていないとき」だけ', () => {
  const series = GACHA_SERIES.find((s) => s.id === 'soramo');
  if (!series) throw new Error('soramo');
  const lineup = seriesLineup(series);

  it('持っていないときは 5％ のまま（たくさん引くと出る）。持っていればモンスターの抽選をしない（技14種だけ）', () => {
    let hit = 0;
    for (let seed = 1; seed <= 4000; seed++) {
      if (drawSeriesPack(series, seed).cards.includes(lineup.monsterId)) hit++;
      const owned = drawSeriesPack(series, seed, true).cards;
      expect(owned.includes(lineup.monsterId)).toBe(false);
      expect(owned).toHaveLength(GACHA.cardsPerPack);
      for (const id of owned) expect(lineup.skillIds).toContain(id);
    }
    expect(hit / 4000).toBeGreaterThan(0.03);
    expect(hit / 4000).toBeLessThan(0.07);
    expect(GACHA.monsterRate).toBe(0.05);
  });

  it('買うとき：持っているモンスターのシリーズからはモンスターが出ない。持っていないシリーズ（チュートリアルを飛ばしたセーブ）からは出る', () => {
    const b = { ...base(), coins: 10_000_000 };
    expect(b.collection['mon-soramo'] ?? 0).toBeGreaterThan(0);
    let s: SaveData = b;
    for (let i = 0; i < 400; i++) {
      const r = purchaseSeriesPack(s, 'soramo', `tx-${i}`, i * 97 + 5);
      if (r.status !== 'ok') throw new Error(r.status);
      expect(r.cards).not.toContain('mon-soramo');
      s = r.save;
    }
    // チュートリアルを飛ばしたセーブ（箱を選んでいない）：最初から並ぶ6シリーズ。ノビトンを持っていなければモンスターが出てよい
    const skip: SaveData = { ...b, collection: Object.fromEntries(Object.entries(b.collection).filter(([id]) => id !== 'mon-nobiton')) };
    let got = false;
    let x = skip;
    for (let i = 0; i < 2000 && !got; i++) {
      const r = purchaseSeriesPack(x, 'nobiton', `ty-${i}`, i * 131 + 7);
      if (r.status !== 'ok') throw new Error(`${r.status}`);
      got = r.cards.includes('mon-nobiton');
      x = r.save;
    }
    expect(got).toBe(true);
    // 一度当たったら、そのあとは出ない
    for (let i = 0; i < 300; i++) {
      const r = purchaseSeriesPack(x, 'nobiton', `tz-${i}`, i * 17 + 3);
      if (r.status !== 'ok') throw new Error(`${r.status}`);
      expect(r.cards).not.toContain('mon-nobiton');
      x = r.save;
    }
  });

  it('提供割合の文（日本語・英語）', () => {
    expect(t('gacha.ratesMonster', { rate: 5 })).toBe('モンスターカード：まだ持っていないときだけ、1パックに5％');
    setLanguage('en');
    try {
      expect(t('gacha.ratesMonster', { rate: 5 })).toBe("Monster card: 5% per pack, only while you don't have it yet");
    } finally {
      setLanguage('ja');
    }
  });
});

describe('V3 ボスのデッキ：切り札の技を2枚ずつ', () => {
  const ACES: Readonly<Record<string, string>> = {
    'enc-b3-boss': 'mon-geol',
    'enc-forest-boss': 'mon-flune',
    'enc-water-boss': 'mon-serephine',
    'enc-wind-boss': 'mon-tsumuji',
    'enc-ice-boss': 'mon-hyouzuku', // 2026-10-30 指示書 W：カルシェルからヒョウズクに
    'enc-fire-boss': 'mon-gauul',
    'enc-machine-boss': 'mon-lazuck',
    'enc-holy-boss': 'mon-soramo',
  };

  it('ボス8人の切り札（真ん中・祭壇でもらえるモンスターと同じ）', () => {
    for (const [id, ace] of Object.entries(ACES)) {
      const boss = ENCOUNTERS[id];
      expect(boss?.ace, id).toBe(ace);
      expect(boss?.monsters[1], id).toBe(ace);
      const dungeon = DUNGEONS.find((d) => RUN_DUNGEONS[d.id]?.bossId === id);
      expect(dungeon?.firstClearCards?.[0]?.cardId, id).toBe(ace);
    }
    expect(Object.values(RUN_DUNGEONS).map((c) => c.bossId).sort()).toEqual(Object.keys(ACES).sort());
  });

  it('ボス8人の lifeScale（直す前の勝つ割合から ±3 ポイントに合わせ直した。イヴァン・バルカは入らず、いちばん近い値）', () => {
    expect(Object.fromEntries(Object.keys(ACES).map((id) => [id, ENCOUNTERS[id]?.lifeScale]))).toEqual({
      'enc-b3-boss': 1.05,
      'enc-forest-boss': 0.7,
      'enc-water-boss': 1.2,
      'enc-wind-boss': 1.1,
      'enc-ice-boss': 1.3, // 2026-10-30 指示書 W：ヒョウズクに替えて合わせ直した（±3 には入らない）
      'enc-fire-boss': 1.75,
      'enc-machine-boss': 1.2,
      'enc-holy-boss': 1.75,
    });
  });

  it('デッキは60枚で、切り札の技14種が2枚ずつ。ほかのモンスターの技も入る。ほかの相手（ボス以外）は今の作り方のまま', () => {
    for (const [id, ace] of Object.entries(ACES)) {
      const boss = ENCOUNTERS[id];
      if (!boss) throw new Error(id);
      const deck = buildOpponentDeck(boss);
      expect(deck.skills, id).toHaveLength(DECK_RULES.skillCount);
      expect(deck.monsters).toEqual(boss.monsters);
      const counts = countCards(deck.skills);
      for (const k of skillsOf(ace)) expect(counts[k.id], `${id} ${k.id}`).toBe(ACE_SKILL_COPIES);
      for (const m of boss.monsters.filter((x) => x !== ace)) expect(skillsOf(m).some((k) => (counts[k.id] ?? 0) > 0), `${id} ${m}`).toBe(true);
      expect(isDeckValid(deck), id).toBe(true);
    }
    // 切り札の無い相手（大会のノエル）は前と同じ作り方（左のモンスターの技が多い）
    const noel = getTournament('tournament-e')?.rounds[0];
    if (!noel) throw new Error('noel');
    const counts = countCards(buildOpponentDeck(noel).skills);
    expect(counts[skillsOf(noel.monsters[0] as string)[0]?.id ?? '']).toBe(2);
    expect(counts[skillsOf(noel.monsters[1] as string)[0]?.id ?? '']).toBe(1);
  });
});
