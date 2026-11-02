import { describe, expect, it } from 'vitest';
import { cardCatalog, getMonster, getSkill, skillsOf } from '../src/data/cards.ts';
import { BOOSTER_SHOP_PRICE, BOOSTERS, EXAM_LOAN_BOOSTER, type BoosterKey } from '../src/data/introV2.ts';
import { KALSHELL_MONSTER } from '../src/data/kalshell.ts';
import { MYUROL_MONSTER } from '../src/data/myurol.ts';
import amContents from '../src/data/official/booster_contents_20261102_AM.json';
import finalContents from '../src/data/official/booster_contents_20261102_final.json';
import { AJ_SKILLS } from '../src/data/skillRebuildAJ.ts';
import { guardReduction } from '../src/game/cards/cardTypes.ts';
import { applyAction, cardUsability, createBattle, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { DECK_RULES } from '../src/data/rules.ts';
import { countCards, isDeckValid } from '../src/game/deck/deck.ts';
import { startingGachaMonsters } from '../src/game/economy/gachaSeries.ts';
import { createNewGameSave, normalizeSave, type SaveData } from '../src/game/save/saveData.ts';
import { boosterDeck, boosterShelf, buyBooster, examLoanDeck } from '../src/game/story/introV2.ts';

/**
 * 2026-11-02 指示書 AM（ユーザー決定）：最初の3箱の作り直し（旅立ち＝ソラモ・リリル・ノビトン／烈火＝ガウル・ラズック・ツムジ／蒼海＝ミュロル・カルシェル・フォルン）。
 * 正本は src/data/official/booster_contents_20261102_AM.json。各モンスターの16枚は PR #1 の正式配布（booster_contents_20261102_final.json）のまま、ツムジだけ新しい（進行の案）。
 * あわせて PR #1 の4技の性能・ミュロル／カルシェルの LIFE。記録は docs/starter-boxes-am-20261102.md
 */

const CATEGORY: Record<string, string> = { ちから: 'ち', かしこさ: 'か', 特殊: '特', 防御: '防', 回避: '避' };
const SUPPORTS = { 'sup-2': 3, 'sup-7': 3, 'sup-1': 2, 'sup-3': 2, 'sup-10': 2 };
const group = (key: BoosterKey) => {
  const g = amContents.booster_groups.find((x) => x.booster_key === key);
  if (!g) throw new Error(key);
  return g;
};
/** PR #1 の正式配布の、そのモンスターの12行（どの箱でも同じ） */
const finalRows = (monsterId: string) => {
  const g = finalContents.booster_groups.find((x) => x.monster_ids.includes(monsterId));
  return g ? g.card_rows.filter((r) => r.monster_id === monsterId) : [];
};

describe('3箱・9枠（指示書 AM）', () => {
  it('旅立ち＝ソラモ・リリル・ノビトン／烈火＝ガウル・ラズック・ツムジ／蒼海＝ミュロル・カルシェル・フォルン。箱の中で同じモンスターは無い。箱は3つだけ・9体', () => {
    expect(BOOSTERS.map((b) => [b.key, b.name])).toEqual(amContents.booster_groups.map((g) => [g.booster_key, g.booster_name]));
    expect(BOOSTERS.map((b) => b.monsters)).toEqual([
      ['mon-soramo', 'mon-lilil', 'mon-nobiton'],
      ['mon-gauul', 'mon-lazuck', 'mon-tsumuji'],
      ['mon-myurol', 'mon-kalshell', 'mon-forn'],
    ]);
    for (const b of BOOSTERS) {
      expect(b.monsters, b.key).toEqual(group(b.key).monster_ids);
      expect(b.monsters.map((m) => getMonster(m).name), b.key).toEqual(group(b.key).monsters);
      expect(new Set(b.monsters).size, b.key).toBe(3);
    }
    expect(new Set(BOOSTERS.flatMap((b) => b.monsters)).size).toBe(9);
  });

  it('ツムジのほかは、PR #1 の正式配布の16枚のまま（ノビトンは前の烈火・蒼海の16枚、フォルンは前の旅立ちの16枚）', () => {
    for (const g of amContents.booster_groups) {
      for (const m of g.monster_ids) {
        if (m === 'mon-tsumuji') continue;
        const rows = g.card_rows.filter((r) => r.monster_id === m).map(({ monster: _m, ...r }) => r);
        expect(rows, `${g.booster_key} ${m}`).toEqual(finalRows(m).map(({ monster: _m, ...r }) => r));
      }
    }
  });

  it('ツムジの16枚：ひっかく1・Wひっかき2・とびかかる2・みだれぎり2・つむじかぜ2・かぜのやいば2・あらし1・ひらりとかわす3・★かまいたち1', () => {
    const c = countCards(boosterDeck('booster-2').skills);
    const by = Object.fromEntries(skillsOf('mon-tsumuji').map((k) => [k.name, c[k.id] ?? 0]));
    expect(by).toEqual({
      ひっかく: 1, Wひっかき: 2, とびかかる: 2, みだれぎり: 2, ストームブレイド: 0, かまいたち: 1, つむじかぜ: 2, かぜのやいば: 2, あらし: 1, かぜのり: 0, ひらりとかわす: 3, かぜよみ: 0,
    });
  });

  it('9枠それぞれ技16枚。箱ごとに技48枚＋サポート12枚＝山札60枚。同じカードは3枚まで。技 ID はどれもある', () => {
    let total = 0;
    for (const b of BOOSTERS) {
      const g = group(b.key);
      const deck = boosterDeck(b.key);
      expect(deck.skills).toHaveLength(DECK_RULES.skillCount);
      expect(deck.skills).toHaveLength(60);
      const skills = deck.skills.filter((id) => cardCatalog.get(id)?.kind === 'skill');
      const supports = deck.skills.filter((id) => cardCatalog.get(id)?.kind === 'support');
      expect(skills).toHaveLength(48);
      expect(countCards(supports)).toEqual(SUPPORTS);
      expect(g.support_cards.map((c) => [c.support_id, c.name, c.copies])).toEqual(finalContents.support_cards.map((c) => [c.support_id, c.name, c.copies]));
      for (const m of b.monsters) {
        const rows = g.card_rows.filter((r) => r.monster_id === m);
        expect(rows.reduce((n, r) => n + r.copies, 0), `${b.key} ${m}`).toBe(16);
        expect(skills.filter((id) => getSkill(id).monsterId === m), `${b.key} ${m}`).toHaveLength(16);
      }
      for (const [id, n] of Object.entries(countCards(deck.skills))) {
        expect(cardCatalog.get(id), id).toBeDefined();
        expect(n, id).toBeLessThanOrEqual(3);
      }
      expect(isDeckValid(deck, countCards([...deck.monsters, ...deck.skills]))).toBe(true);
      total += skills.length;
    }
    expect(total).toBe(144);
  });

  it('9体それぞれ12技（0枚の技も）を JSON と照らし合わせる：ID・名前・分類・マナ・ダメージ・レア・箱の枚数。名前で引くと1枚だけ', () => {
    for (const b of BOOSTERS) {
      const g = group(b.key);
      const deckCounts = countCards(boosterDeck(b.key).skills);
      for (const m of b.monsters) {
        const rows = g.card_rows.filter((r) => r.monster_id === m);
        const table = AJ_SKILLS[m] ?? [];
        expect(rows.map((r) => r.skill_id), `${b.key} ${m}`).toEqual(table.map((r) => r.id));
        expect(skillsOf(m).map((s) => s.id)).toEqual(rows.map((r) => r.skill_id));
        for (const r of rows) {
          const t = table.find((x) => x.id === r.skill_id);
          const why = `${b.key} ${r.skill_id}`;
          expect(t?.name, why).toBe(r.skill_name);
          expect(skillsOf(m).filter((s) => s.name === r.skill_name), why).toHaveLength(1);
          expect(t?.cat, why).toBe(CATEGORY[r.category]);
          expect(t?.mana, why).toBe(r.mana);
          expect(getSkill(r.skill_id).cost, why).toBe(r.mana);
          expect(t?.damage ?? null, why).toBe(r.damage);
          expect(!!t?.rare, why).toBe(r.rare);
          expect(t?.box ?? 0, why).toBe(r.copies);
          expect(deckCounts[r.skill_id] ?? 0, why).toBe(r.copies);
        }
      }
    }
  });

  it('レアの枚数：ソラモ1・リリル1・ノビトン0／ガウル1・ラズック0・ツムジ1／ミュロル0・カルシェル2・フォルン3', () => {
    const rare: Record<string, number> = {};
    for (const g of amContents.booster_groups) for (const r of g.card_rows) if (r.rare) rare[`${g.booster_key} ${r.monster}`] = (rare[`${g.booster_key} ${r.monster}`] ?? 0) + r.copies;
    expect(rare).toEqual({
      'booster-1 ソラモ': 1, 'booster-1 リリル': 1, 'booster-1 ノビトン': 0,
      'booster-2 ガウル': 1, 'booster-2 ラズック': 0, 'booster-2 ツムジ': 1,
      'booster-3 ミュロル': 0, 'booster-3 カルシェル': 2, 'booster-3 フォルン': 3,
    });
  });

  it('試験で先生が貸すデッキは旅立ちと同じ。値段 1,500G・各1回・管理局で選んだ箱は棚に出ない', () => {
    expect(EXAM_LOAN_BOOSTER).toBe('booster-1');
    expect(examLoanDeck()).toEqual(boosterDeck('booster-1'));
    expect(BOOSTER_SHOP_PRICE).toBe(1500);
    const base = createNewGameSave();
    const s: SaveData = { ...base, coins: 5000, story: { ...base.story, introV2: { ...base.story.introV2, state: 'completed', examPassed: true, selectedBoosterKey: 'booster-1', boosterClaimed: true, boosterGranted: true } } };
    expect(boosterShelf(s)).toEqual([{ key: 'booster-2', bought: false }, { key: 'booster-3', bought: false }]);
    const r = buyBooster(s, 'booster-3', 'tx-a');
    if (r.status !== 'ok') throw new Error(r.status);
    expect(r.save.coins).toBe(3500);
    expect(buyBooster(r.save, 'booster-3', 'tx-b').status).toBe('error');
  });
});

describe('4技の性能（ユーザー承認）とミュロル・カルシェルの LIFE', () => {
  const guardOf = (id: string) => {
    const k = getSkill(id);
    return { mana: k.cost, reduce: guardReduction(k), against: k.effect.type === 'defense' ? k.effect.against : null };
  };

  it('ミュロル しっぽガード・みずのまく：マナ1・ちから／かしこさ −3。みずあび（09）は変えない', () => {
    expect(guardOf('skl-myurol-10')).toEqual({ mana: 1, reduce: 3, against: 'force' });
    expect(guardOf('skl-myurol-11')).toEqual({ mana: 1, reduce: 3, against: 'wisdom' });
    expect(getSkill('skl-myurol-09')).toMatchObject({ name: 'みずあび', cost: 2, effect: { type: 'healSelf', amount: 2 } });
  });

  it('カルシェル からにこもる：マナ2・ちから −5。あわのまく：マナ2・かしこさ −5', () => {
    expect(guardOf('skl-kalshell-11')).toEqual({ mana: 2, reduce: 5, against: 'force' });
    expect(guardOf('skl-kalshell-12')).toEqual({ mana: 2, reduce: 5, against: 'wisdom' });
  });

  it('LIFE：ミュロル 6・カルシェル 7。対戦の最大ライフも同じで、回復しても超えない', () => {
    expect(MYUROL_MONSTER.life).toBe(6);
    expect(KALSHELL_MONSTER.life).toBe(7);
    const deck = { monsters: ['mon-myurol', 'mon-kalshell', 'mon-soramo'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-03') };
    let s: BattleState = createBattle({ name: 'P', deck }, { name: 'O', deck }, 3, 'player');
    expect(s.sides.player.monsters.map((m) => [m.maxLife, m.life])).toEqual([[6, 6], [7, 7], [7, 7]]);
    // 薬草（ライフ+1）：ライフ5のミュロル → 6、満タンのカルシェルは 7 のまま
    const hand = (cards: string[]) => cards.map((cardId, i) => ({ uid: `p${i}`, cardId }));
    const side = (k: Side, patch: Partial<BattleState['sides']['player']>) => ({ ...s, sides: { ...s.sides, [k]: { ...s.sides[k], ...patch } } });
    s = { ...side('player', { hand: hand(['sup-1', 'sup-1']), manaPile: Array.from({ length: 10 }, () => 'x') }), phase: 'main', manaConvertLimit: null };
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, monsters: s.sides.player.monsters.map((m) => (m.uid === 'p-m1' ? { ...m, life: 5 } : m)) } } };
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'p-m1' });
    expect(s.sides.player.monsters[0]?.life).toBe(6);
    if (cardUsability(s, 'player', 'p1').usable) s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p1', targetUid: 'p-m2' });
    expect(s.sides.player.monsters[1]?.life).toBe(7);
  });
});

describe('前のセーブ（箱を開けたあと）を変えない', () => {
  /** 前の版の中身で箱を開けたセーブ（その版のモンスターと、適当な技を持っている） */
  const opened = (key: BoosterKey, monsters: string[]): SaveData => {
    const base = createNewGameSave();
    const collection = { ...Object.fromEntries(monsters.map((m) => [m, 1])), 'skl-soramo14-03': 3, 'skl-lazuck-02': 3 };
    return {
      ...base,
      collection,
      storyFlags: ['booster-bought:booster-2'],
      story: { ...base.story, introV2: { ...base.story.introV2, state: 'completed', examPassed: true, selectedBoosterKey: key, boosterClaimed: true, boosterGranted: true } },
    };
  };

  it.each([
    ['booster-1', ['mon-soramo', 'mon-nobiton', 'mon-lazuck']], // 指示書 AJ（公開済み）
    ['booster-1', ['mon-soramo', 'mon-lilil', 'mon-lazuck']], // 指示書 AK・AL
    ['booster-3', ['mon-myurol', 'mon-kalshell', 'mon-nobiton']], // 指示書 AJ・AK
    ['booster-3', ['mon-myurol', 'mon-kalshell', 'mon-forn']], // 指示書 AL
    ['booster-1', ['mon-soramo', 'mon-lilil', 'mon-forn']], // 初期3箱の正式配布（PR #1）
    ['booster-2', ['mon-gauul', 'mon-lazuck', 'mon-nobiton']], // 指示書 AJ〜正式配布
    ['booster-1', ['mon-soramo', 'mon-lilil', 'mon-nobiton']], // 指示書 AM
    ['booster-2', ['mon-gauul', 'mon-lazuck', 'mon-tsumuji']], // 指示書 AM
  ] as const)('%s %j：読み込み直しても、所持カード・選んだ箱・買った箱は同じ。最初から並ぶガチャはその版の3体', (key, monsters) => {
    const s = opened(key, [...monsters]);
    const loaded = normalizeSave(JSON.parse(JSON.stringify(s)));
    if (!loaded) throw new Error('load');
    expect(loaded.collection).toEqual(s.collection);
    expect(loaded.story.introV2.selectedBoosterKey).toBe(key);
    expect(loaded.story.introV2.boosterClaimed).toBe(true);
    expect(loaded.storyFlags).toContain('booster-bought:booster-2');
    expect([...startingGachaMonsters(loaded)].sort()).toEqual([...monsters].sort());
  });
});
