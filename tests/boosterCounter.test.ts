import { describe, expect, it } from 'vitest';
import { cardCatalog, skillsOf } from '../src/data/cards.ts';
import { BOOSTER_SHOP_PRICE, BOOSTERS, type BoosterKey } from '../src/data/introV2.ts';
import contents from '../src/data/official/booster_contents_20261028.json';
import { countCards, isDeckValid } from '../src/game/deck/deck.ts';
import { createNewGameSave, createNewSave, normalizeSave, type SaveData } from '../src/game/save/saveData.ts';
import {
  beginExam,
  boosterCardCounts,
  boosterDeck,
  boosterShelf,
  buyBooster,
  claimBooster,
  examLoanDeck,
  finishExam,
  ownedBoosters,
  setIntroV2State,
  skipIntroV2,
  startIntroV2OnTown,
} from '../src/game/story/introV2.ts';

/** ブースターとカウンター（2026-10-28 ユーザー決定。design-parts/booster-decision-20261028/） */
const NOW = new Date('2026-10-28T00:00:00Z');
const newGame = (): SaveData => ({ ...createNewGameSave(NOW), player: { gender: 'male' } });
const throughExam = (s: SaveData): SaveData => setIntroV2State(finishExam(beginExam(setIntroV2State(startIntroV2OnTown(s), 'schoolArrival')), true), 'packSelection');
const name = (id: string): string => cardCatalog.get(id)?.name ?? id;

describe('ブースターの箱＝初期配布', () => {
  it('箱の中身はモンスター3枚＋技48枚（3体の初期配布16枚ずつ）＋仮サポート12枚。技は資料（06）の技名・枚数どおり', () => {
    for (const group of contents.booster_groups) {
      const key = group.booster_key as BoosterKey;
      const deck = boosterDeck(key);
      const def = BOOSTERS.find((b) => b.key === key);
      expect(deck.monsters).toEqual(def?.monsters);
      expect(deck.skills).toHaveLength(60);
      const skills = deck.skills.filter((id) => cardCatalog.get(id)?.kind === 'skill');
      const supports = deck.skills.filter((id) => cardCatalog.get(id)?.kind === 'support');
      expect(skills).toHaveLength(48);
      expect(supports).toHaveLength(12);
      // 資料の行（モンスター名・技名・枚数）と、今のデータの技（名前で引く）が一致する
      const want: Record<string, number> = {};
      for (const row of group.card_rows) {
        const monster = def?.monsters.find((m) => name(m) === row.monster);
        const hit = monster ? skillsOf(monster).filter((s) => s.name === row.skill_name) : [];
        expect(hit, `${row.monster} ${row.skill_name}`).toHaveLength(1);
        const id = hit[0]?.id ?? '';
        want[id] = (want[id] ?? 0) + row.copies;
      }
      expect(countCards(skills)).toEqual(want);
      expect(isDeckValid(deck, boosterCardCounts(key))).toBe(true);
    }
  });
});

describe('新しく始めた → 試験 → 管理局で箱を選ぶ', () => {
  it('新しく始めたときはカードを持たず、デッキも空', () => {
    const s = newGame();
    expect(s.collection).toEqual({});
    expect(s.deck).toEqual({ monsters: [], skills: [] });
    expect(s.story.introV2.selectedStarterDeckKey).toBeNull();
  });

  it('試験は先生が貸す「旅立ちのきらめき」と同じデッキ。所持カードには入らない（再挑戦でも同じ）', () => {
    const loan = examLoanDeck();
    expect(loan).toEqual(boosterDeck('booster-1'));
    const s = newGame();
    const lost = finishExam(beginExam(setIntroV2State(startIntroV2OnTown(s), 'schoolArrival')), false);
    expect(lost.collection).toEqual({});
    const won = finishExam(beginExam(lost), true);
    expect(won.collection).toEqual({});
    expect(won.deck.monsters).toHaveLength(0);
  });

  it.each(BOOSTERS.map((b) => [b.key] as const))('%s を選ぶと、持っているカードとデッキがその箱の3体＋60枚だけになる', (key) => {
    const s = claimBooster(throughExam(newGame()), key, `tx-${key}`);
    expect(s.collection).toEqual(boosterCardCounts(key));
    expect(s.deck).toEqual(boosterDeck(key));
    expect(isDeckValid(s.deck, s.collection)).toBe(true);
    expect(s.story.introV2.boosterGranted).toBe(true);
    // 開き直しても重ねて配らない
    const reloaded = normalizeSave(JSON.parse(JSON.stringify(s)));
    expect(reloaded?.collection).toEqual(s.collection);
  });
});

describe('カウンターで残りの2箱を買う', () => {
  const claimed = (key: BoosterKey): SaveData => ({ ...claimBooster(throughExam(newGame()), key, 'tx-claim'), coins: 5000 });

  it('棚には選ばなかった2箱。1箱 1,500G で各1回だけ買える。買ったら「購入済み」', () => {
    let s = claimed('booster-1');
    expect(boosterShelf(s).map((b) => b.key)).toEqual(['booster-2', 'booster-3']);
    const r = buyBooster(s, 'booster-2', 'tx-1');
    if (r.status !== 'ok') throw new Error(r.status);
    expect(r.save.coins).toBe(5000 - BOOSTER_SHOP_PRICE);
    expect(BOOSTER_SHOP_PRICE).toBe(1500);
    s = r.save;
    // 中身は所持カードに足すだけ（デッキは変えない。同じカードが重なってもそのまま持つ）
    expect(s.deck).toEqual(boosterDeck('booster-1'));
    const gauul = 'mon-gauul';
    expect(s.collection[gauul]).toBe(2);
    expect(boosterShelf(s)).toEqual([
      { key: 'booster-2', bought: true },
      { key: 'booster-3', bought: false },
    ]);
    // 2回目は買えない（別の購入 ID でも）
    const again = buyBooster(s, 'booster-2', 'tx-2');
    expect(again.status).toBe('error');
    expect(again.save.coins).toBe(s.coins);
    // 同じ購入 ID の連打は1回だけ
    expect(buyBooster(s, 'booster-3', 'tx-1').status).toBe('duplicate');
    // 管理局で受け取った箱も買えない
    expect(buyBooster(s, 'booster-1', 'tx-3').status).toBe('error');
    const r3 = buyBooster(s, 'booster-3', 'tx-4');
    if (r3.status !== 'ok') throw new Error(r3.status);
    expect(r3.save.coins).toBe(5000 - 2 * BOOSTER_SHOP_PRICE);
    expect(ownedBoosters(r3.save)).toEqual(['booster-1', 'booster-2', 'booster-3']);
    // 開き直しても「購入済み」のまま
    const reloaded = normalizeSave(JSON.parse(JSON.stringify(r3.save)));
    if (!reloaded) throw new Error('load');
    expect(buyBooster(reloaded, 'booster-2', 'tx-5').status).toBe('error');
  });

  it('お金が足りないときは買えない', () => {
    const s = { ...claimed('booster-2'), coins: 1499 };
    const r = buyBooster(s, 'booster-1', 'tx-poor');
    expect(r.status).toBe('error');
    expect(r.save.coins).toBe(1499);
  });
});

describe('前のセーブ', () => {
  it('前から遊んでいるセーブのカード・デッキは減らない。棚には3箱とも並ぶ', () => {
    const old = createNewSave(NOW);
    const loaded = normalizeSave(JSON.parse(JSON.stringify({ ...old, version: 20 })));
    if (!loaded) throw new Error('load');
    expect(loaded.collection).toEqual(old.collection);
    expect(loaded.deck).toEqual(old.deck);
    expect(boosterShelf(loaded).map((b) => b.key)).toEqual(['booster-1', 'booster-2', 'booster-3']);
  });

  it('中身が決まる前に箱を選んだセーブ（受け取りの記録だけ）には、中身を1回だけ配る。前のカードは減らない', () => {
    const old = createNewSave(NOW, 'attack');
    const v = { ...old.story.introV2, state: 'completed', examPassed: true, selectedBoosterKey: 'booster-3', boosterClaimed: true, boosterClaimId: 'tx-old', boosterGranted: false, tutorialCompleted: true };
    const raw = { ...old, version: 20, story: { ...old.story, introV2: v } };
    const once = normalizeSave(JSON.parse(JSON.stringify(raw)));
    if (!once) throw new Error('load');
    const add = boosterCardCounts('booster-3');
    for (const [id, n] of Object.entries(add)) expect(once.collection[id]).toBe((old.collection[id] ?? 0) + n);
    for (const [id, n] of Object.entries(old.collection)) expect(once.collection[id] ?? 0).toBeGreaterThanOrEqual(n);
    expect(once.deck).toEqual(old.deck);
    expect(once.story.introV2.boosterGranted).toBe(true);
    const twice = normalizeSave(JSON.parse(JSON.stringify(once)));
    expect(twice?.collection).toEqual(once.collection);
  });

  it('【仮】スキップ：カードを1枚も持っていなければ「旅立ちのきらめき」の中身でデッキを作る（棚では購入済み）', () => {
    const s = skipIntroV2(newGame());
    expect(s.deck).toEqual(boosterDeck('booster-1'));
    expect(isDeckValid(s.deck, s.collection)).toBe(true);
    expect(boosterShelf(s).find((b) => b.key === 'booster-1')?.bought).toBe(true);
    // 前から遊んでいるセーブはそのまま
    const old = createNewSave(NOW);
    const skipped = skipIntroV2({ ...old, story: { ...old.story, introV2: { ...old.story.introV2, state: 'notStarted' } } });
    expect(skipped.collection).toEqual(old.collection);
  });
});
