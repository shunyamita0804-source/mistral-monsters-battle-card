import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { cardCatalog, getMonster, getSkill, MONSTERS, SKILLS, skillsOf } from '../src/data/cards.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { GEAROS_COLOR, GEAROS_MONSTER_ID, gearosSkillId, OVERDRIVE_CHOICE, OVERDRIVE_COMBO_ID } from '../src/data/gearos.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { AJ_SKILLS, MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, cardUsability, createBattle, overdriveUsability, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';
import { halfAlphaRatio } from './support/png.ts';

/** 指示書 AX【3】（2026-11-05）：ギアロス。正本は src/data/official/gearos_skills_20261105.csv */

const ORIGINAL = 'design-parts/cards-original/gearos';
const ge = gearosSkillId;
const sor = (n: number): string => `skl-soramo14-${String(n).padStart(2, '0')}`;
const CAT: Record<string, string> = { ちから: 'ち', かしこさ: 'か', 特殊: '特', 防御: '防', 回避: '避' };

/** CSV の1行（効果の文は "" でくくられ、中に , がある） */
function csvRows(path: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].map((m) => m[2] ?? m[1] ?? '').slice(0, 8));
}

describe('ギアロスのデータ（届いた CSV のとおり）', () => {
  it('CSV は届いたものを無改変で置いた', () => {
    expect(readFileSync('src/data/official/gearos_skills_20261105.csv').equals(readFileSync(`${ORIGINAL}/gearos_skills.csv`))).toBe(true);
  });

  it('LIFE 8・空中・赤銅 #945247。ふつうの一覧・図鑑（No.235〜247）に入る。最初の箱には入らない', () => {
    const m = getMonster(GEAROS_MONSTER_ID);
    expect(m.name).toBe('ギアロス');
    expect(m.life).toBe(8);
    expect(m.habitat).toBe('air');
    expect(MONSTER_HABITAT[GEAROS_MONSTER_ID]).toBe('air');
    expect(m.themeColor).toBe(GEAROS_COLOR);
    expect(GEAROS_COLOR).toBe('#945247');
    expect(MONSTERS.some((x) => x.id === GEAROS_MONSTER_ID)).toBe(true);
    for (const b of BOOSTERS) expect(b.monsters).not.toContain(GEAROS_MONSTER_ID);
    const book = cardBookEntries();
    const first = book.find((e) => e.card.id === GEAROS_MONSTER_ID);
    expect(first?.no).toBe(235);
    expect(book.find((e) => e.card.id === ge(12))?.no).toBe(247);
    // 3枚コンボのカードは図鑑・一覧に出ない（台帳だけ）
    expect(book.some((e) => e.card.id === OVERDRIVE_COMBO_ID)).toBe(false);
    expect(SKILLS.some((k) => k.id === OVERDRIVE_COMBO_ID)).toBe(false);
    expect(cardCatalog.get(OVERDRIVE_COMBO_ID)).toBeDefined();
  });

  it('技12枚：名前・分類・マナ・ダメージ・効果の文・レアは CSV のとおり（レア＝01・06・07・11）', () => {
    const rows = csvRows('src/data/official/gearos_skills_20261105.csv');
    const table = AJ_SKILLS[GEAROS_MONSTER_ID] ?? [];
    expect(rows).toHaveLength(12);
    expect(table).toHaveLength(12);
    rows.forEach(([no, img, name, cat, mana, damage, text, rare], i) => {
      const r = table[i];
      if (!r) throw new Error(String(i));
      expect(r.id).toBe(ge(Number(no)));
      expect(r.name).toBe(name);
      expect(r.cat).toBe(CAT[cat ?? '']);
      expect(r.mana).toBe(Number(mana));
      expect(r.damage).toBe(damage ? Number(damage) : null);
      // 10 エネルギーシールド：防御の文は「どの技に効くか」だけにそろえる決まり（軽減の数 3 は effect に）
      expect(r.text ?? 'なし').toBe(no === '10' ? 'かしこさ技に効く' : text);
      expect(!!r.rare).toBe(rare === '○');
      expect(img).toBe(`gearos_sk_${String(no).padStart(2, '0')}.png`);
    });
    expect(table.filter((r) => r.rare).map((r) => r.id)).toEqual([ge(1), ge(6), ge(7), ge(11)]);
    expect(GACHA_SERIES.find((g) => g.monsterId === GEAROS_MONSTER_ID)?.rareSkillNames).toEqual(['ロックオンビーム', 'オーバードライブβ', 'オーバードライブγ', '高速機動']);
    expect(skillsOf(GEAROS_MONSTER_ID).map((k) => k.displayNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('効果：01・05 回避されない・06 防御されない・07 回避されても半分・10 かしこさ技−3・11 消費マナ2以上を回避', () => {
    expect(getSkill(ge(1)).effect).toMatchObject({ type: 'attack', undodgeable: true });
    expect(getSkill(ge(5)).effect).toMatchObject({ type: 'attack', undodgeable: true });
    expect(getSkill(ge(6)).effect).toMatchObject({ type: 'attack', unblockable: true });
    expect(getSkill(ge(7)).effect).toMatchObject({ type: 'attack', halfOnEvade: true });
    expect(getSkill(ge(8)).effect).toEqual({ type: 'systemChange' });
    expect(getSkill(ge(9)).effect).toEqual({ type: 'systemCheck', count: 3 });
    expect(getSkill(ge(10)).effect).toEqual({ type: 'defense', reduce: 3, against: 'wisdom' });
    expect(getSkill(ge(11)).effect).toEqual({ type: 'evade', against: 'all', minCost: 2 });
    // 3枚コンボ：マナ5・かしこさ・相手全員に8。α・β・γ の印は付かない
    const combo = getSkill(OVERDRIVE_COMBO_ID);
    expect(combo.cost).toBe(5);
    expect(combo.stat).toEqual({ type: 'wisdom', value: 8 });
    expect(combo.effect).toEqual({ type: 'attack', allTargets: true });
  });

  it('テオ（機械の塔）の切り札がギアロス。初回クリアの祭壇はギアロス（雷の高原と同じ形）。ガチャのシリーズ・絵', () => {
    const teo = ENCOUNTERS['enc-machine-boss'];
    expect(teo?.ace).toBe(GEAROS_MONSTER_ID);
    expect(teo?.monsters).toEqual(['mon-nobiton', GEAROS_MONSTER_ID, 'mon-gauul']);
    const tower = DUNGEONS.find((d) => d.id === 'dungeon-06');
    expect(tower?.firstClearCards).toEqual([{ cardId: GEAROS_MONSTER_ID, count: 1 }]);
    expect(tower?.trumpReward).toBe(true);
    expect(GACHA_SERIES.find((g) => g.id === 'gearos')?.unlockFlag).toBeUndefined();
    for (let n = 1; n <= 12; n++) expect(existsSync(`assets/images/cards/skills/gearos_sk_${String(n).padStart(2, '0')}.webp`)).toBe(true);
    for (const f of ['assets/images/cards/monsters/gearos_official.webp', 'assets/images/ui/battlecard/frame_gearos.png', 'assets/images/ui/skillcard_simple/frame_normal_gearos.webp', 'assets/images/ui/gacha/pack_gearos.webp', 'assets/images/ui/gacha/panel_gearos.webp']) {
      expect(existsSync(f), f).toBe(true);
    }
    expect(BATTLE_CARDS[GEAROS_MONSTER_ID]?.art).toBe('gearos_battlecard.png');
    expect(halfAlphaRatio('assets/images/cards/monsters/gearos_battlecard.png')).toBeLessThan(0.03);
    expect(halfAlphaRatio(`${ORIGINAL}/gearos_battle_transparent.png`)).toBeGreaterThan(0.3);
  });

  it('英語の名前（仮訳）', () => {
    setLanguage('en');
    try {
      expect(cardName(GEAROS_MONSTER_ID)).toBe('Gearos');
      expect(cardName(ge(5))).toBe('Overdrive α');
      expect(cardName(OVERDRIVE_COMBO_ID)).toBe('Overdrive (3-card combo)');
    } finally {
      setLanguage('ja');
    }
  });
});

/* ---------- バトル ---------- */

// 自分：ギアロス（p-m1 ライフ8）・ソラモ（p-m2）・ノビトン（p-m3）。相手：ソラモ（o-m1 ライフ7）・ソラモ（o-m2）・ノビトン（o-m3 ライフ8）
function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}, deck: string[] = []): BattleState {
  const filler = Array.from({ length: 60 }, () => sor(1));
  const s = createBattle(
    { name: 'P', deck: { monsters: [GEAROS_MONSTER_ID, 'mon-soramo', 'mon-nobiton'], skills: filler } },
    { name: 'O', deck: { monsters: ['mon-soramo', 'mon-soramo', 'mon-nobiton'], skills: filler } },
    11,
    'player',
  );
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 10 }, () => sor(1)),
    ...(k === 'player' && deck.length > 0 ? { deck } : {}),
  });
  return { ...s, phase: 'main', active: 'player', manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const monster = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};

const giveOpponent = (s: BattleState, cards: string[]): BattleState => ({
  ...s,
  sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: [...s.sides.opponent.hand, ...cards.map((cardId, i) => ({ uid: `g${i}`, cardId }))] } },
});

const ABG = [ge(5), ge(6), ge(7)];

describe('オーバードライブの3枚コンボ', () => {
  it('3枚そろって、ギアロスが動いていなくて、マナ5あれば使える。2枚・マナ4・動いたあとは使えない', () => {
    expect(overdriveUsability(scene({ player: ABG }), 'player').usable).toBe(true);
    expect(overdriveUsability(scene({ player: [ge(5), ge(6)] }), 'player').usable).toBe(false);
    expect(overdriveUsability(scene({ player: ABG }, { player: 4 }), 'player').usable).toBe(false);
    let s = scene({ player: [...ABG, ge(12)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p3', targetUid: 'o-m1' });
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(overdriveUsability(s, 'player').usable).toBe(false);
  });

  it('マナ5。3枚とも捨て札へ。相手全員に8（守りは1体ずつ）。記録の文。ギアロスの技1回', () => {
    let s = giveOpponent(scene({ player: [...ABG, sor(5)] }), [sor(14), sor(12)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p1', choice: OVERDRIVE_CHOICE });
    expect(s.phase).toBe('defense');
    expect(s.sides.player.hand.map((c) => c.cardId)).toEqual([sor(5)]);
    expect(s.sides.player.discard.filter((id) => ABG.includes(id))).toHaveLength(3);
    expect(s.sides.player.manaPile).toHaveLength(5);
    expect(monster(s, 'p-m1').acted).toBe(true);
    expect(s.log.some((l) => l.text === 'オーバードライブ！ α・β・γ のコンボで、相手全員に8ダメージ')).toBe(true);
    expect(s.pending?.cardId).toBe(OVERDRIVE_COMBO_ID);
    expect(s.pending?.power).toBe(8);
    expect(s.pending?.targetUid).toBe('o-m1');
    // 1体目：回避できる（α の「回避されない」は付かない）
    expect(cardUsability(s, 'opponent', 'g0').usable).toBe(true);
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g0' });
    s = s.phase === 'defense' && s.pending?.targetUid === 'o-m1' ? applyAction(s, { type: 'defend', side: 'opponent', cardUid: null }) : s;
    expect(monster(s, 'o-m1').life).toBe(7);
    // 2体目：防御できる（β の「防御されない」は付かない）。8−3＝5
    expect(s.pending?.targetUid).toBe('o-m2');
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g1' });
    s = s.phase === 'defense' && s.pending?.targetUid === 'o-m2' ? applyAction(s, { type: 'defend', side: 'opponent', cardUid: null }) : s;
    expect(monster(s, 'o-m2').life).toBe(2);
    // 3体目：守らない → 8（ノビトン ライフ8 は倒れる）
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(monster(s, 'o-m3').life).toBe(0);
    expect(s.phase).toBe('main');
  });

  it('γ の「回避されても半分」も付かない（回避されたら0）', () => {
    let s = giveOpponent(scene({ player: ABG }), [sor(14)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p2', choice: OVERDRIVE_CHOICE });
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g0' });
    if (s.pending?.targetUid === 'o-m1') s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(monster(s, 'o-m1').life).toBe(7);
  });

  it('choice を付けずに使えば1枚の技（今までどおり）', () => {
    let s = scene({ player: ABG });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(s.pending?.cardId).toBe(ge(5));
    expect(s.sides.player.hand).toHaveLength(2);
  });

  it('CPU（腕前 B）は使えるときは使う', () => {
    const s = scene({ player: [...ABG, sor(5)] });
    expect(chooseAction(s, 'player', 'normal', 'B')).toMatchObject({ type: 'useCard', choice: OVERDRIVE_CHOICE });
  });
});

describe('システムチェンジ・システムチェック・高速機動', () => {
  it('システムチェンジ：選んだ手札を山札のいちばん下へ → 1枚引く → シャッフル。ほかに手札が無ければ使えない', () => {
    expect(cardUsability(scene({ player: [ge(8)] }), 'player', 'p0').usable).toBe(false);
    const deck = [ge(3), ge(4), ge(12), sor(1), sor(1)];
    let s = scene({ player: [ge(8), ge(1)] }, {}, deck);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', choice: 'p1' });
    const hand = s.sides.player.hand.map((c) => c.cardId);
    expect(hand).toEqual([ge(3)]);
    expect(s.sides.player.deck).toHaveLength(5);
    expect([...s.sides.player.deck].sort()).toEqual([ge(1), ge(4), ge(12), sor(1), sor(1)].sort());
    expect(s.sides.player.manaPile).toHaveLength(9);
    expect(s.log.at(-1)?.text).toBe('あなたは手札を1枚山札に戻して1枚引き、山札をシャッフルした。');
  });

  it('システムチェック：山札の上から3枚を使った人だけが見る（山札は動かない）。山札が0枚なら使えない', () => {
    const deck = [ge(3), ge(4), ge(12), sor(2)];
    let s = scene({ player: [ge(9)] }, {}, deck);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(s.deckPeek).toEqual({ seq: 1, viewer: 'player', cardIds: [ge(3), ge(4), ge(12)] });
    expect(s.sides.player.deck).toEqual(deck);
    expect(s.log.at(-1)?.text).toBe('あなたは山札の上を確かめた。');
    const empty = scene({ player: [ge(9)] });
    expect(cardUsability({ ...empty, sides: { ...empty.sides, player: { ...empty.sides.player, deck: [] } } }, 'player', 'p0').usable).toBe(false);
  });

  it('高速機動：消費マナ2以上の攻撃を回避（1以下は回避できない）', () => {
    const s0 = scene({ opponent: [] });
    // 相手（ソラモ）が自分のギアロスを攻撃する場面
    const atk = (cost: string) => {
      let s: BattleState = { ...s0, active: 'opponent', sides: { ...s0.sides, opponent: { ...s0.sides.opponent, hand: [{ uid: 'a0', cardId: cost }] }, player: { ...s0.sides.player, hand: [{ uid: 'h0', cardId: ge(11) }] } } };
      s = applyAction(s, { type: 'useCard', side: 'opponent', cardUid: 'a0', targetUid: 'p-m1' });
      return cardUsability(s, 'player', 'h0').usable;
    };
    expect(atk(sor(3))).toBe(true); // たいあたり マナ2
    expect(atk(sor(1))).toBe(false); // ひっかき マナ0
  });
});
