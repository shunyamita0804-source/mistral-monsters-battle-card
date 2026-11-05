import { describe, expect, it } from 'vitest';
import { skillsOf } from '../src/data/cards.ts';
import { GACHA, GACHA_SERIES, gachaSeenFlag } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { AJ_QA_SKILLS, AJ_SKILLS } from '../src/data/skillRebuildAJ.ts';
import {
  availableGachaSeriesFor,
  canReselectSeries,
  isNewGachaSeries,
  drawSeriesPack,
  markGachaSeriesSeen,
  purchaseSeriesPack,
  seriesLineup,
  seriesOwned,
  startingGachaMonsters,
  tierOf,
} from '../src/game/economy/gachaSeries.ts';
import { addCards, createNewGameSave, createNewSave, normalizeSave, SAVE_VERSION, type SaveData } from '../src/game/save/saveData.ts';
import { PETE_BEATEN_FLAG, winPete } from '../src/game/story/pete.ts';

/**
 * プカリムのカードを持っていない createNewSave（2026-10-30 指示書 V で仮の編成 TEST_TEAM の3体目がプカリムになり、
 * createNewSave の手持ちにプカリムが入るようになったため。「最初から」の本当のセーブ createNewGameSave はカードを持たない）
 */
const newSaveWithoutPukarim = (): SaveData => {
  const s = createNewSave();
  const { 'mon-pukarim': _p, ...collection } = s.collection;
  return { ...s, collection };
};

const SORAMO = GACHA_SERIES.find((s) => s.id === 'soramo');
if (!SORAMO) throw new Error('soramo');

describe('ガチャのシリーズ（2026-10-28）', () => {
  it('16シリーズ（2026-10-29 にプカリム、夜にジオル、深夜にフルーネ・セレフィーン。2026-10-30 にツムジ・ヒョウズク・道具のパック。2026-10-31 にシシエン・ハクラン・デスオル。2026-11-02 にリリル〔カルシェルのあと〕）。どれも 150G・5枚', () => {
    expect(GACHA_SERIES.map((s) => s.id)).toEqual(['soramo', 'gauul', 'lazuck', 'nobiton', 'myurol', 'kalshell', 'lilil', 'forn', 'uzurio', 'gearos', 'kuyo', 'pukarim', 'geol', 'flune', 'serephine', 'tsumuji', 'hyouzuku', 'shishien', 'hakuran', 'desuoru', 'tools']);
    expect(GACHA.price).toBe(150);
    expect(GACHA.cardsPerPack).toBe(5);
  });

  it('中身はそのモンスターの技12種＋モンスターカード＝13枠（指示書 AJ）。レア枠の名前はすべて今のデータにある', () => {
    for (const series of GACHA_SERIES.filter((s) => !s.cardIds)) {
      const lineup = seriesLineup(series);
      expect(lineup.errors).toEqual([]);
      expect(lineup.skillIds).toHaveLength(12);
      expect(lineup.all).toHaveLength(13);
      expect(lineup.rareIds).toHaveLength(series.rareSkillNames.length);
      expect(lineup.skillIds).toEqual(skillsOf(series.monsterId).map((s) => s.id));
    }
  });

  it('レア枠はユーザー決定の技（指示書 AJ の表の★。どのモンスターもレア4つ）', () => {
    const names = (id: string): string[] => {
      const series = GACHA_SERIES.find((s) => s.id === id);
      if (!series) throw new Error(id);
      const lineup = seriesLineup(series);
      return skillsOf(series.monsterId).filter((s) => lineup.rareIds.includes(s.id)).map((s) => s.name);
    };
    // 2026-11-01 指示書 AJ：表の★（rare）の4つ
    const want: Record<string, string[]> = {
      soramo: ['連続ひっかき', 'ソラモビーム', 'スターフォール', '星影ステップ'],
      gauul: ['火の粉', '聖なる炎', 'フレアレイ', '高速飛行'],
      lazuck: ['トリックショット', 'シャドウバースト', 'いたずら', 'フェイントステップ'],
      nobiton: ['まきつく', 'ギガントノーズ', 'ダウナーミスト', '不思議な嗅覚'],
      myurol: ['しっぽまわし', 'アクアテール', 'みずあび', 'スリップガード'],
      kalshell: ['シェルブレイカー', 'あわだま', 'タイダルクラッシュ', 'てっぺきシェル'],
      pukarim: ['ぷはーっ', 'おおつむじ', 'おいかぜ', 'くうきのクッション'],
      geol: ['ナックル', '地ひびき', 'グランドハンマー', 'うけとめる'],
      flune: ['かふん', 'はなびらストーム', 'フラワードレイン', 'いやしのみつ'],
      serephine: ['アクアニードル', 'ルナタイド', 'オーシャンウェーブ', 'ウェーブダンス'],
      tsumuji: ['ストームブレイド', 'かまいたち', 'かぜのり', 'かぜよみ'],
      hyouzuku: ['こおりのいき', 'ふぶき', 'ひょうが', 'おとなきはばたき'],
      shishien: ['れんごくのとっしん', 'もえるたてがみ', 'ほのおのほうこう', 'ねつのとばり'],
      hakuran: ['てんをかける', 'らいうん', 'せいなるいかずち', 'かすみのあゆみ'],
      desuoru: ['しのゆびさし', 'ヘルのもん', 'カラスのめ', 'やみにまぎれる'],
      lilil: ['デビーム', 'あまいかおり', 'うそなき', 'よつばねのまい'],
      forn: ['そうこうげき', 'そなえのふえ', 'もりのたより', 'みがわりのふえ'],
      uzurio: ['かぜのうず', 'おおたつまき', 'ふきとばし', 'つむじがくれ'], // 2026-11-02 指示書 AQ
      gearos: ['ロックオンビーム', 'オーバードライブβ', 'オーバードライブγ', '高速機動'], // 2026-11-05 指示書 AX（進行の案）
      kuyo: ['ここのつのめ', 'はらえのひかり', 'まよけのふだ', 'きりのなかへ'], // 2026-11-05 指示書 BH（確かめ用の表 AJ_QA_SKILLS）
    };
    for (const s of GACHA_SERIES.filter((x) => !x.cardIds)) {
      expect(names(s.id).sort(), s.id).toEqual([...(want[s.id] ?? [])].sort());
      expect((AJ_SKILLS[s.monsterId] ?? AJ_QA_SKILLS[s.monsterId] ?? []).filter((r) => r.rare).map((r) => r.name).sort(), s.id).toEqual([...(want[s.id] ?? [])].sort());
    }
  });

  it('1パック5枚。シリーズのカードだけが出て、開ける順はノーマル → レア → モンスター', () => {
    for (const series of GACHA_SERIES) {
      const lineup = seriesLineup(series);
      let seed = 7;
      for (let i = 0; i < 400; i++) {
        const r = drawSeriesPack(series, seed);
        seed = r.seed;
        expect(r.cards).toHaveLength(5);
        for (const c of r.cards) expect(lineup.all).toContain(c);
        const order = r.cards.map((c) => ({ normal: 0, rare: 1, monster: 2 })[tierOf(lineup, c)]);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(r.cards.filter((c) => c === series.monsterId).length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('1万回で、モンスターカードは約5％のパックに出て、レア1種はノーマル1種の約4分の1', () => {
    const lineup = seriesLineup(SORAMO);
    const counts = new Map<string, number>();
    let monsterPacks = 0;
    let seed = 20261028;
    const N = 10000;
    for (let i = 0; i < N; i++) {
      const r = drawSeriesPack(SORAMO, seed);
      seed = r.seed;
      if (r.cards.includes(lineup.monsterId)) monsterPacks += 1;
      for (const c of r.cards) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    expect(monsterPacks / N).toBeGreaterThan(0.04);
    expect(monsterPacks / N).toBeLessThan(0.06);
    const avg = (ids: readonly string[]): number => ids.reduce((s, id) => s + (counts.get(id) ?? 0), 0) / ids.length;
    const normals = lineup.skillIds.filter((id) => !lineup.rareIds.includes(id));
    const ratio = avg(lineup.rareIds) / avg(normals);
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(0.3);
  });

  it('買うと 150G 減り、5枚が所持に入る。4枚目からもそのまま持つ', () => {
    let save = { ...createNewSave(), coins: 2000 };
    const r = purchaseSeriesPack(save, 'soramo', 'tx-1', 123);
    if (r.status !== 'ok') throw new Error(r.status);
    expect(r.save.coins).toBe(1850);
    expect(r.save.stats.packsOpened).toBe(save.stats.packsOpened + 1);
    expect(r.cards).toHaveLength(5);
    for (const id of new Set(r.cards)) {
      expect(r.save.collection[id] ?? 0).toBe((save.collection[id] ?? 0) + r.cards.filter((c) => c === id).length);
    }
    // 同じカードを何枚でも持てる（お金にかえない）
    save = { ...save, collection: { ...save.collection, [r.cards[0] ?? '']: 9 } };
    const r2 = purchaseSeriesPack(save, 'soramo', 'tx-1b', 123);
    if (r2.status !== 'ok') throw new Error(r2.status);
    expect(r2.save.collection[r.cards[0] ?? '']).toBeGreaterThan(9);
    expect(r2.save.coins).toBe(1850);
  });

  it('同じ購入 ID で2回呼んでも1回しか払わない（連打で二重に払わない）', () => {
    const save = { ...createNewSave(), coins: 1000 };
    const r1 = purchaseSeriesPack(save, 'gauul', 'tx-dup', 5);
    if (r1.status !== 'ok') throw new Error(r1.status);
    const r2 = purchaseSeriesPack(r1.save, 'gauul', 'tx-dup', 5);
    expect(r2.status).toBe('duplicate');
    expect(r2.save.coins).toBe(850);
  });

  it('お金が足りないときは買えない', () => {
    const save = { ...createNewSave(), coins: 149 };
    const r = purchaseSeriesPack(save, 'soramo', 'tx-poor', 1);
    expect(r.status).toBe('error');
    expect(r.save.coins).toBe(149);
  });

  it('プカリム・ジオル・フルーネ以外は最初から選べる（新しいセーブでも買える。リリル〔2026-11-02〕は旅立ちのきらめきを開けてから）', () => {
    // ウズリオ（2026-11-02 指示書 AQ）は風の渓谷でモンスターカードを受け取ってから
    // ギアロス（2026-11-05 指示書 AX）は機械の塔でモンスターカードを受け取ってから。クヨウ（指示書 BH）は霧の廃坑（まだ無い）でモンスターカードを受け取ってから
    for (const series of GACHA_SERIES.filter((s) => !s.unlockFlag && s.id !== 'lilil' && s.id !== 'forn' && s.id !== 'uzurio' && s.id !== 'gearos' && s.id !== 'kuyo')) {
      const r = purchaseSeriesPack({ ...createNewSave(), coins: 150 }, series.id, `tx-${series.id}`, 3);
      expect(r.status).toBe('ok');
    }
  });

  it('プカリムはモンスターカード（ピートに勝つと受け取る）を手に入れたあとだけ並び、買える。レア枠は 7 ぷはーっ・8 おおつむじ・10 おいかぜ・12 くうきのクッション（指示書 AJ）', () => {
    const before = { ...newSaveWithoutPukarim(), coins: 150 };
    expect(availableGachaSeriesFor(before).map((s) => s.id)).not.toContain('pukarim');
    expect(purchaseSeriesPack(before, 'pukarim', 'tx-p', 3).status).toBe('error');
    // ピートに勝った記録だけ（カードなし）では並ばない（2026-10-30 指示書 K）
    expect(availableGachaSeriesFor({ ...before, storyFlags: [PETE_BEATEN_FLAG] }).map((s) => s.id)).not.toContain('pukarim');
    const after = addCards(before, [{ cardId: 'mon-pukarim', count: 1 }]);
    expect(availableGachaSeriesFor(after).map((s) => s.id)).toContain('pukarim');
    expect(purchaseSeriesPack(after, 'pukarim', 'tx-p', 3).status).toBe('ok');
    const pukarim = GACHA_SERIES.find((s) => s.id === 'pukarim');
    if (!pukarim) throw new Error('pukarim');
    expect(seriesLineup(pukarim).rareIds).toEqual(['skl-pukarim-07', 'skl-pukarim-08', 'skl-pukarim-10', 'skl-pukarim-12']);
  });

  it('「パックを選び直す」は払う前だけ', () => {
    expect(canReselectSeries(false)).toBe(true);
    expect(canReselectSeries(true)).toBe(false);
  });

  it('そろった数：13枠（指示書 AJ）のうち持っている種類', () => {
    const lineup = seriesLineup(SORAMO);
    const save = { ...createNewSave(), collection: {} as Record<string, number> };
    expect(seriesOwned(save, SORAMO)).toEqual({ owned: 0, total: 13 });
    const some = { ...save, collection: { [lineup.skillIds[0] ?? '']: 3, [lineup.monsterId]: 1 } };
    expect(seriesOwned(some, SORAMO)).toEqual({ owned: 2, total: 13 });
  });
});

/** 管理局で箱を選んだセーブ（新しく始めた人） */
function boxSave(key: 'booster-1' | 'booster-2' | 'booster-3'): SaveData {
  const base = createNewGameSave();
  const box = BOOSTERS.find((b) => b.key === key);
  if (!box) throw new Error(key);
  const withCards = addCards(base, box.monsters.map((cardId) => ({ cardId, count: 1 })));
  return { ...withCards, coins: 1000, story: { ...withCards.story, introV2: { ...withCards.story.introV2, state: 'completed', selectedBoosterKey: key, boosterClaimed: true } } };
}
const ids = (save: SaveData): string[] => availableGachaSeriesFor(save).map((s) => s.id);
/** 前の版の中身で箱を開けたセーブ（その版の3体のモンスターカードを持っている） */
function opened(key: 'booster-1' | 'booster-2' | 'booster-3', monsters: readonly string[]): SaveData {
  const base = createNewGameSave();
  const withCards = addCards(base, monsters.map((cardId) => ({ cardId, count: 1 })));
  return { ...withCards, coins: 1000, story: { ...withCards.story, introV2: { ...withCards.story.introV2, state: 'completed', selectedBoosterKey: key, boosterClaimed: true, boosterGranted: true } } };
}
const series = (id: string) => {
  const g = GACHA_SERIES.find((x) => x.id === id);
  if (!g) throw new Error(id);
  return g;
};

describe('シリーズの開く条件（2026-10-30 指示書 K。ユーザー決定）', () => {
  it('最初から並ぶのは、管理局で選んだ箱の3体のシリーズだけ', () => {
    // 指示書 AJ の箱：旅立ち＝ソラモ・ノビトン・ラズック／烈火＝ガウル・ラズック・ノビトン／蒼海＝ミュロル・カルシェル・ノビトン（並びはシリーズの順）
    // 2026-11-02 ユーザー決定の正式配布：旅立ち＝ソラモ・リリル・フォルン／烈火＝ガウル・ラズック・ノビトン／蒼海＝ミュロル・カルシェル・ノビトン
    // 2026-11-02 指示書 AM：旅立ち＝ソラモ・リリル・ノビトン／烈火＝ガウル・ラズック・ツムジ／蒼海＝ミュロル・カルシェル・フォルン
    expect(ids(boxSave('booster-1'))).toEqual(['soramo', 'nobiton', 'lilil', 'tools']);
    expect(ids(boxSave('booster-2'))).toEqual(['gauul', 'lazuck', 'tsumuji', 'tools']);
    expect(ids(boxSave('booster-3'))).toEqual(['myurol', 'kalshell', 'forn', 'tools']);
    // 箱の3体には NEW を出さない
    const s = boxSave('booster-1');
    for (const g of availableGachaSeriesFor(s)) expect(isNewGachaSeries(s, g)).toBe(false);
  });

  it('並んでいないシリーズは買えない（箱の外のモンスター）', () => {
    expect(purchaseSeriesPack(boxSave('booster-1'), 'kalshell', 'tx-k', 1).status).toBe('error');
    expect(purchaseSeriesPack(boxSave('booster-1'), 'soramo', 'tx-s', 1).status).toBe('ok');
  });

  it('そのモンスターのモンスターカードを初めて手に入れたら開き、NEW が出る（ショップで箱を買った・ボスから受け取った など）', () => {
    const s = addCards(boxSave('booster-1'), [{ cardId: 'mon-kalshell', count: 1 }, { cardId: 'mon-geol', count: 1 }]);
    expect(ids(s)).toEqual(['soramo', 'nobiton', 'kalshell', 'lilil', 'geol', 'tools']);
    expect(isNewGachaSeries(s, series('kalshell'))).toBe(true);
    expect(isNewGachaSeries(s, series('geol'))).toBe(true);
    // 技カードだけでは開かない
    const skill = addCards(boxSave('booster-1'), [{ cardId: 'skl-kalshell-01', count: 1 }]);
    expect(ids(skill)).not.toContain('kalshell');
  });

  it('ピートに勝つ（プカリムのカードを受け取る）とプカリムのシリーズが開き、NEW。一度選ぶと NEW は消える', () => {
    const won = winPete(boxSave('booster-2'), 'tx-pete', () => 0.1).save;
    expect(ids(won)).toContain('pukarim');
    expect(isNewGachaSeries(won, series('pukarim'))).toBe(true);
    const seen = markGachaSeriesSeen(won, series('pukarim'));
    expect(isNewGachaSeries(seen, series('pukarim'))).toBe(false);
    expect(ids(seen)).toContain('pukarim');
  });

  it('一度開いた（選んだ）シリーズは、カードがなくても閉じない', () => {
    const s = { ...boxSave('booster-1'), storyFlags: [gachaSeenFlag('flune')] };
    expect(ids(s)).toContain('flune');
    expect(isNewGachaSeries(s, series('flune'))).toBe(false);
  });

  it('チュートリアルをスキップした（箱を選んでいない）セーブは、今のまま6つ並ぶ', () => {
    const skipped = { ...createNewGameSave(), story: { ...createNewGameSave().story, introV2: { ...createNewGameSave().story.introV2, state: 'skipped' as const } } };
    expect(startingGachaMonsters(skipped)).toHaveLength(6);
    expect(ids(skipped)).toEqual(['soramo', 'gauul', 'lazuck', 'nobiton', 'myurol', 'kalshell', 'tools']);
    for (const g of availableGachaSeriesFor(skipped)) expect(isNewGachaSeries(skipped, g)).toBe(false);
  });

  it('前のセーブ（v27）で、もう並んでいるシリーズは閉じない・NEW も出さない（箱を選んだセーブでも6つのまま）', () => {
    const box = boxSave('booster-1');
    const old = { ...box, version: 27, storyFlags: [PETE_BEATEN_FLAG] };
    const s = normalizeSave(JSON.parse(JSON.stringify(old)));
    if (!s) throw new Error('load');
    expect(s.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(28);
    expect(ids(s)).toEqual(['soramo', 'gauul', 'lazuck', 'nobiton', 'myurol', 'kalshell', 'lilil', 'pukarim', 'tools']);
    // リリル・フォルンは、この変換では開かない（v28 より後のシリーズ）。指示書 AM の旅立ち（ソラモ・リリル・ノビトン）はリリルのカードを持っているので並ぶ
    // 前の中身の旅立ち（リリルのカードなし）の v27 のセーブでは、リリルもフォルンも開かない
    const oldBox = addCards(createNewGameSave(), ['mon-soramo', 'mon-nobiton', 'mon-lazuck'].map((cardId) => ({ cardId, count: 1 })));
    const v27 = normalizeSave(JSON.parse(JSON.stringify({ ...oldBox, version: 27, story: { ...oldBox.story, introV2: { ...oldBox.story.introV2, state: 'completed', selectedBoosterKey: 'booster-1', boosterClaimed: true, boosterGranted: true } } })));
    if (!v27) throw new Error('load');
    expect(ids(v27)).not.toContain('lilil');
    expect(ids(v27)).not.toContain('forn');
    for (const g of GACHA_SERIES) expect(isNewGachaSeries(s, g)).toBe(false);
  });
});

describe('リリルを入れた旅立ちのきらめき（2026-11-02 指示書 AK）', () => {
  /** 前の中身（ソラモ・ノビトン・ラズック）で旅立ちを開けたセーブ */
  const oldBox = (): SaveData => {
    const base = createNewGameSave();
    const withCards = addCards(base, ['mon-soramo', 'mon-nobiton', 'mon-lazuck'].map((cardId) => ({ cardId, count: 1 })));
    return { ...withCards, coins: 1000, story: { ...withCards.story, introV2: { ...withCards.story.introV2, state: 'completed', selectedBoosterKey: 'booster-1', boosterClaimed: true, boosterGranted: true } } };
  };

  it('前のセーブ（前の中身で旅立ちを開けた）は今までと同じ：ソラモ・ラズック・ノビトン。リリルは並ばず買えない。NEW も出さない', () => {
    const s = oldBox();
    expect(ids(s)).toEqual(['soramo', 'lazuck', 'nobiton', 'tools']);
    for (const g of availableGachaSeriesFor(s)) expect(isNewGachaSeries(s, g)).toBe(false);
    expect(purchaseSeriesPack(s, 'lilil', 'tx-l', 1).status).toBe('error');
    const loaded = normalizeSave(JSON.parse(JSON.stringify(s)));
    if (!loaded) throw new Error('load');
    expect(loaded.collection['mon-lilil'] ?? 0).toBe(0);
    expect(ids(loaded)).toEqual(['soramo', 'lazuck', 'nobiton', 'tools']);
  });

  it('正式配布（PR #1：ソラモ・リリル・フォルン）で旅立ちを開けた人：リリル・フォルンが並び（NEW なし）、リリルのパックが買える。ノビトンは並ばない', () => {
    const s = opened('booster-1', ['mon-soramo', 'mon-lilil', 'mon-forn']);
    expect(ids(s)).toEqual(['soramo', 'lilil', 'forn', 'tools']);
    expect(ids(s)).not.toContain('nobiton');
    for (const g of availableGachaSeriesFor(s)) expect(isNewGachaSeries(s, g)).toBe(false);
    expect(purchaseSeriesPack(s, 'lilil', 'tx-l', 1).status).toBe('ok');
    // あとでノビトンのモンスターカードを手に入れたら、ノビトンが並ぶ（前の箱のモンスターなので NEW の印は出ない）
    const got = addCards(s, [{ cardId: 'mon-nobiton', count: 1 }]);
    expect(ids(got)).toContain('nobiton');
  });

  it('指示書 AK・AL の中身（ソラモ・リリル・ラズック）で旅立ちを開けた人は、今までと同じ：ソラモ・ラズック・リリル（NEW なし）。フォルンは並ばない', () => {
    const base = createNewGameSave();
    const withCards = addCards(base, ['mon-soramo', 'mon-lilil', 'mon-lazuck'].map((cardId) => ({ cardId, count: 1 })));
    const s: SaveData = { ...withCards, coins: 1000, story: { ...withCards.story, introV2: { ...withCards.story.introV2, state: 'completed', selectedBoosterKey: 'booster-1', boosterClaimed: true, boosterGranted: true } } };
    expect(ids(s)).toEqual(['soramo', 'lazuck', 'lilil', 'tools']);
    for (const g of availableGachaSeriesFor(s)) expect(isNewGachaSeries(s, g)).toBe(false);
    expect(purchaseSeriesPack(s, 'forn', 'tx-f', 1).status).toBe('error');
  });

  it('ほかの箱を選んだ人は、リリルのモンスターカードを手に入れるまで並ばない', () => {
    expect(ids(boxSave('booster-2'))).not.toContain('lilil');
    expect(ids(boxSave('booster-3'))).not.toContain('lilil');
    const got = addCards(boxSave('booster-2'), [{ cardId: 'mon-lilil', count: 1 }]);
    expect(ids(got)).toContain('lilil');
    expect(isNewGachaSeries(got, series('lilil'))).toBe(true);
  });
});

describe('フォルンを入れた蒼海の守り（2026-11-02 指示書 AL）', () => {
  const oldSoukai = (): SaveData => {
    const base = createNewGameSave();
    const withCards = addCards(base, ['mon-myurol', 'mon-kalshell', 'mon-nobiton'].map((cardId) => ({ cardId, count: 1 })));
    return { ...withCards, coins: 1000, story: { ...withCards.story, introV2: { ...withCards.story.introV2, state: 'completed', selectedBoosterKey: 'booster-3', boosterClaimed: true, boosterGranted: true } } };
  };

  it('前のセーブ（前の中身で蒼海を開けた）は今までと同じ：ノビトン・ミュロル・カルシェル。フォルンは並ばず、NEW も出さない', () => {
    const s = oldSoukai();
    expect(ids(s)).toEqual(['nobiton', 'myurol', 'kalshell', 'tools']);
    for (const g of availableGachaSeriesFor(s)) expect(isNewGachaSeries(s, g)).toBe(false);
    expect(purchaseSeriesPack(s, 'forn', 'tx-f', 1).status).toBe('error');
    const loaded = normalizeSave(JSON.parse(JSON.stringify(s)));
    if (!loaded) throw new Error('load');
    expect(loaded.collection['mon-forn'] ?? 0).toBe(0);
    expect(ids(loaded)).toEqual(['nobiton', 'myurol', 'kalshell', 'tools']);
  });

  it('正式配布（PR #1：ミュロル・カルシェル・ノビトン）で蒼海を開けた人：フォルンは並ばず買えない。NEW なし', () => {
    const s = opened('booster-3', ['mon-myurol', 'mon-kalshell', 'mon-nobiton']);
    expect(ids(s)).toEqual(['nobiton', 'myurol', 'kalshell', 'tools']);
    for (const g of availableGachaSeriesFor(s)) expect(isNewGachaSeries(s, g)).toBe(false);
    expect(purchaseSeriesPack(s, 'forn', 'tx-f', 1).status).toBe('error');
  });

  it('指示書 AL の中身（ミュロル・カルシェル・フォルン）で蒼海を開けた人は、今までと同じ：ミュロル・カルシェル・フォルン（NEW なし）。ノビトンは並ばない', () => {
    const base = createNewGameSave();
    const withCards = addCards(base, ['mon-myurol', 'mon-kalshell', 'mon-forn'].map((cardId) => ({ cardId, count: 1 })));
    const s: SaveData = { ...withCards, coins: 1000, story: { ...withCards.story, introV2: { ...withCards.story.introV2, state: 'completed', selectedBoosterKey: 'booster-3', boosterClaimed: true, boosterGranted: true } } };
    expect(ids(s)).toEqual(['myurol', 'kalshell', 'forn', 'tools']);
    for (const g of availableGachaSeriesFor(s)) expect(isNewGachaSeries(s, g)).toBe(false);
    expect(purchaseSeriesPack(s, 'forn', 'tx-f', 1).status).toBe('ok');
  });

  it('旅立ち・烈火を選んだ人は、フォルンのモンスターカードを手に入れるまで並ばない（指示書 AM でフォルンは蒼海に戻った）', () => {
    expect(ids(boxSave('booster-1'))).not.toContain('forn');
    expect(ids(boxSave('booster-2'))).not.toContain('forn');
    const got = addCards(boxSave('booster-2'), [{ cardId: 'mon-forn', count: 1 }]);
    expect(isNewGachaSeries(got, series('forn'))).toBe(true);
  });

  it('指示書 AM で蒼海を開けた人（ミュロル・カルシェル・フォルン）：フォルンのパックが買える。NEW なし', () => {
    const s = boxSave('booster-3');
    expect(ids(s)).toEqual(['myurol', 'kalshell', 'forn', 'tools']);
    for (const g of availableGachaSeriesFor(s)) expect(isNewGachaSeries(s, g)).toBe(false);
    expect(purchaseSeriesPack(s, 'forn', 'tx-f', 1).status).toBe('ok');
  });
});

describe('ツムジを入れた烈火の猛攻（2026-11-02 指示書 AM）', () => {
  it('新しく烈火を開けた人：ツムジが最初から並び（NEW なし）、ツムジのパックが買える（風の渓谷に勝つ前でも）', () => {
    const s = boxSave('booster-2');
    expect(ids(s)).toEqual(['gauul', 'lazuck', 'tsumuji', 'tools']);
    for (const g of availableGachaSeriesFor(s)) expect(isNewGachaSeries(s, g)).toBe(false);
    expect(purchaseSeriesPack(s, 'tsumuji', 'tx-t', 1).status).toBe('ok');
  });

  it('前の中身（ガウル・ラズック・ノビトン）で烈火を開けた人は今までと同じ。ツムジは並ばない', () => {
    const s = opened('booster-2', ['mon-gauul', 'mon-lazuck', 'mon-nobiton']);
    expect(ids(s)).toEqual(['gauul', 'lazuck', 'nobiton', 'tools']);
    for (const g of availableGachaSeriesFor(s)) expect(isNewGachaSeries(s, g)).toBe(false);
    expect(purchaseSeriesPack(s, 'tsumuji', 'tx-t', 1).status).toBe('error');
  });

  it('指示書 AM で旅立ちを開けた人：ノビトンが最初から並ぶ（NEW なし）', () => {
    const s = boxSave('booster-1');
    expect(ids(s)).toContain('nobiton');
    expect(isNewGachaSeries(s, series('nobiton'))).toBe(false);
  });
});

describe('新しく並んだシリーズの NEW の印（2026-10-29 夜）', () => {
  const PUKARIM = GACHA_SERIES.find((s) => s.id === 'pukarim');
  if (!PUKARIM) throw new Error('pukarim');

  it('並んだばかりのシリーズだけ NEW。最初から並ぶシリーズ・まだ並ばないシリーズには出さない', () => {
    const base = newSaveWithoutPukarim();
    expect(isNewGachaSeries(addCards(base, [{ cardId: 'mon-pukarim', count: 1 }]), PUKARIM)).toBe(true);
    expect(isNewGachaSeries(base, PUKARIM)).toBe(false);
    expect(isNewGachaSeries(addCards(base, [{ cardId: 'mon-pukarim', count: 1 }]), SORAMO)).toBe(false);
  });

  it('一度選ぶと消える（記録は1回だけ付く）', () => {
    const save = addCards({ ...createNewSave(), storyFlags: [PETE_BEATEN_FLAG] }, [{ cardId: 'mon-pukarim', count: 1 }]);
    const seen = markGachaSeriesSeen(save, PUKARIM);
    expect(seen.storyFlags).toEqual([PETE_BEATEN_FLAG, gachaSeenFlag('pukarim')]);
    expect(isNewGachaSeries(seen, PUKARIM)).toBe(false);
    expect(markGachaSeriesSeen(seen, PUKARIM)).toBe(seen);
  });

  it('前のセーブ（v26）で、もう並んでいるシリーズは選んだことにする（ボスのダンジョンのクリアで並ぶものも）', () => {
    const base = createNewSave();
    const old = {
      ...base,
      version: 26,
      storyFlags: [PETE_BEATEN_FLAG],
      dungeons: { ...base.dungeons, 'dungeon-03': { ...(base.dungeons['dungeon-03'] ?? {}), bossDefeated: true } },
    };
    const s = normalizeSave(JSON.parse(JSON.stringify(old)));
    if (!s) throw new Error('load');
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.storyFlags).toContain(gachaSeenFlag('pukarim'));
    expect(s.storyFlags).toContain(gachaSeenFlag('serephine'));
    expect(s.storyFlags).not.toContain(gachaSeenFlag('geol'));
    expect(s.storyFlags).not.toContain(gachaSeenFlag('flune'));
    for (const g of GACHA_SERIES) expect(isNewGachaSeries(s, g)).toBe(false);
  });
});
