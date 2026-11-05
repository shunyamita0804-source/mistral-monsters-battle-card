import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { getMonster, MONSTERS, QA_MONSTERS, QA_SKILLS, SKILLS, skillsOf } from '../src/data/cards.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { AJ_MONSTER_IDS, AJ_QA_SKILLS, MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import { TYRANT_COLOR, TYRANT_MONSTER_ID, tyrantArtFile, tyrantSkillId } from '../src/data/tyrant.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, cardUsability, createBattle, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { AJ_EN_MISSING } from '../src/i18n/contentEnAJ.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';
import { halfAlphaRatio } from './support/png.ts';

/** 指示書 AX【2】（2026-11-05）：タイラント（確かめ用だけ）。正本は src/data/official/tyrant_skills_20261105.csv */

const ORIGINAL = 'design-parts/cards-original/tyrant';
const ty = tyrantSkillId;
const sor = (n: number): string => `skl-soramo14-${String(n).padStart(2, '0')}`;
const CAT: Record<string, string> = { ちから: 'ち', かしこさ: 'か', 特殊: '特', 防御: '防', 回避: '避' };

function csvRows(path: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text.trim().split(/\r?\n/).slice(1).map((line) => line.split(','));
}

describe('タイラントのデータ（届いた CSV のとおり）', () => {
  it('CSV は届いたものを無改変で置いた', () => {
    expect(readFileSync('src/data/official/tyrant_skills_20261105.csv').equals(readFileSync(`${ORIGINAL}/tyrant_skills.csv`))).toBe(true);
  });

  it('LIFE 8・地上・真っ赤 #A31523。ID は mon-tyrant', () => {
    const m = getMonster(TYRANT_MONSTER_ID);
    expect(m.name).toBe('タイラント');
    expect(m.life).toBe(8);
    expect(m.habitat).toBe('ground');
    expect(MONSTER_HABITAT[TYRANT_MONSTER_ID]).toBe('ground');
    expect(m.themeColor).toBe(TYRANT_COLOR);
    expect(TYRANT_COLOR).toBe('#A31523');
    expect(m.isPlaceholder).toBe(false);
  });

  it('技12枚：名前・分類・マナ・ダメージ・効果の文・レアは CSV のとおり（レア＝04・08・09・12）', () => {
    const rows = csvRows('src/data/official/tyrant_skills_20261105.csv');
    const table = AJ_QA_SKILLS[TYRANT_MONSTER_ID] ?? [];
    expect(rows).toHaveLength(12);
    expect(table).toHaveLength(12);
    rows.forEach(([no, img, name, cat, mana, damage, text, rare], i) => {
      const r = table[i];
      if (!r) throw new Error(String(i));
      expect(r.id).toBe(ty(Number(no)));
      expect(r.name).toBe(name);
      expect(r.cat).toBe(CAT[cat ?? '']);
      expect(r.mana).toBe(Number(mana));
      expect(r.damage).toBe(damage ? Number(damage) : null);
      // 11 ウロコのガード：防御の文は「どの技に効くか」だけにそろえる決まり（tests/skillCardText.test.ts）。軽減の数 3 は effect に
      expect(r.text ?? 'なし').toBe(no === '11' ? 'ちから技に効く' : text);
      expect(!!r.rare).toBe(rare === '○');
      expect(r.art).toBe(tyrantArtFile(Number(no)));
      expect(img).toBe(`tyrant_sk_${String(no).padStart(2, '0')}.png`);
    });
    expect(table.filter((r) => r.rare).map((r) => r.id)).toEqual([ty(4), ty(8), ty(9), ty(12)]);
    expect(skillsOf(TYRANT_MONSTER_ID).map((k) => k.displayNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('効果：02 回避されない・06 回避されても半分・07 相手全員・09 竜のまなざし・10 竜のちから・11 ちから技−3・12 すべて回避', () => {
    const byId = new Map(QA_SKILLS.map((k) => [k.id, k]));
    expect(byId.get(ty(2))?.effect).toMatchObject({ type: 'attack', undodgeable: true });
    expect(byId.get(ty(6))?.effect).toMatchObject({ type: 'attack', halfOnEvade: true });
    expect(byId.get(ty(7))?.effect).toMatchObject({ type: 'attack', allTargets: true });
    expect(byId.get(ty(9))?.effect).toEqual({ type: 'dragonGaze' });
    expect(byId.get(ty(10))?.effect).toEqual({ type: 'dragonMight' });
    expect(byId.get(ty(11))?.effect).toEqual({ type: 'defense', reduce: 3, against: 'force' });
    expect(byId.get(ty(12))?.effect).toEqual({ type: 'evade', against: 'all' });
  });

  it('置き場所は決まっていない：ふつうの一覧・図鑑・ガチャ・箱・ダンジョン・敵の編成に出ない（確かめ用 QA_MONSTERS・QA_SKILLS だけ）', () => {
    expect(QA_MONSTERS.map((m) => m.id)).toEqual([TYRANT_MONSTER_ID]);
    expect(QA_SKILLS).toHaveLength(12);
    expect(MONSTERS.some((m) => m.id === TYRANT_MONSTER_ID)).toBe(false);
    expect(SKILLS.some((k) => k.monsterId === TYRANT_MONSTER_ID)).toBe(false);
    expect(AJ_MONSTER_IDS).not.toContain(TYRANT_MONSTER_ID);
    expect(cardBookEntries().some((e) => e.card.id.includes('tyrant'))).toBe(false);
    expect(GACHA_SERIES.some((g) => g.monsterId === TYRANT_MONSTER_ID)).toBe(false);
    for (const b of BOOSTERS) expect(b.monsters).not.toContain(TYRANT_MONSTER_ID);
    for (const e of Object.values(ENCOUNTERS)) expect(e.monsters).not.toContain(TYRANT_MONSTER_ID);
    expect(JSON.stringify(DUNGEONS)).not.toContain('tyrant');
  });

  it('絵：技12枚・正式カード・バトル用（透明度は 0／255。半透明は輪郭のふちだけ）・枠', () => {
    for (let n = 1; n <= 12; n++) {
      expect(existsSync(`assets/images/cards/skills/${tyrantArtFile(n)}`)).toBe(true);
      expect(existsSync(`${ORIGINAL}/tyrant_sk_${String(n).padStart(2, '0')}.png`)).toBe(true);
    }
    expect(existsSync('assets/images/cards/monsters/tyrant_official.webp')).toBe(true);
    expect(existsSync('assets/images/ui/battlecard/frame_tyrant.png')).toBe(true);
    expect(existsSync('assets/images/ui/skillcard_simple/frame_normal_tyrant.webp')).toBe(true);
    expect(BATTLE_CARDS[TYRANT_MONSTER_ID]?.art).toBe('tyrant_battlecard.png');
    expect(halfAlphaRatio('assets/images/cards/monsters/tyrant_battlecard.png')).toBeLessThan(0.03);
    expect(halfAlphaRatio(`${ORIGINAL}/tyrant_battle_transparent.png`)).toBeGreaterThan(0.5);
  });

  it('英語の名前と効果の文（仮訳）がある', () => {
    setLanguage('en');
    try {
      expect(cardName(TYRANT_MONSTER_ID)).toBe('Tyrandos');
      expect(cardName(ty(9))).toBe('Dragon Gaze');
    } finally {
      setLanguage('ja');
    }
    expect(AJ_EN_MISSING).toEqual([]);
  });
});

/* ---------- バトル ---------- */

// 自分：タイラント（p-m1 ライフ8）・ソラモ・ノビトン。相手：ソラモ（o-m1）・ソラモ（o-m2）・ノビトン（o-m3）
function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}): BattleState {
  const filler = Array.from({ length: 60 }, () => sor(1));
  const s = createBattle(
    { name: 'P', deck: { monsters: [TYRANT_MONSTER_ID, 'mon-soramo', 'mon-nobiton'], skills: filler } },
    { name: 'O', deck: { monsters: ['mon-soramo', 'mon-soramo', 'mon-nobiton'], skills: filler } },
    11,
    'player',
  );
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 12 }, () => sor(1)),
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

/** 次の自分の手番の攻撃のはじめへ（相手は何もしない）。手札を入れかえる */
function nextOwnTurn(s: BattleState, hand: string[]): BattleState {
  let x = applyAction(applyAction(s, { type: 'endAttack', side: 'player' }), { type: 'endTurn', side: 'player' });
  x = applyAction(applyAction(x, { type: 'endAttack', side: 'opponent' }), { type: 'endTurn', side: 'opponent' });
  expect(x.active).toBe('player');
  return { ...x, phase: 'main', sides: { ...x.sides, player: { ...x.sides.player, hand: hand.map((cardId, i) => ({ uid: `n${i}`, cardId })), manaPile: Array.from({ length: 12 }, () => sor(1)) } } };
}

const use = (s: BattleState, cardUid: string, targetUid?: string): BattleState => applyAction(s, { type: 'useCard', side: 'player', cardUid, ...(targetUid ? { targetUid } : {}) });

describe('09 竜のまなざし：次の自分のターン、最初の攻撃1回は回避されない', () => {
  it('かけた手番から効く手番まで印（dragonGaze）。効く手番の最初の攻撃は回避できず、防御はできる', () => {
    let s = use(scene({ player: [ty(9)] }), 'p0');
    expect(monster(s, 'p-m1').dragonGaze).toEqual({ turn: s.turn + 2 });
    // かけた同じ手番には効かない
    s = nextOwnTurn(s, [ty(3), ty(1)]);
    s = giveOpponent(s, [sor(14), sor(12)]);
    s = use(s, 'n0', 'o-m1');
    expect(s.phase).toBe('defense');
    expect(s.pending?.dragonGaze).toBe(true);
    expect(cardUsability(s, 'opponent', 'g0')).toMatchObject({ usable: false });
    expect(cardUsability(s, 'opponent', 'g1').usable).toBe(true);
    expect(monster(s, 'p-m1').dragonGaze).toBeNull();
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(monster(s, 'o-m1').life).toBe(1);
  });

  it('2回目の攻撃（同じ手番のほかのモンスター）には効かない。使わなければ、その手番の終わりで消える', () => {
    let s = use(scene({ player: [ty(9)] }), 'p0');
    s = nextOwnTurn(s, [sor(5)]);
    s = giveOpponent(s, [sor(14)]);
    // ソラモ（p-m2）の攻撃には効かない（タイラントの印）
    s = use(s, 'n0', 'o-m1');
    expect(s.pending?.dragonGaze).toBeUndefined();
    expect(cardUsability(s, 'opponent', 'g0').usable).toBe(true);
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    // タイラントは攻撃しないまま手番が終わる → 次の自分の手番には効かない
    s = nextOwnTurn(s, [ty(3)]);
    s = giveOpponent(s, [sor(14)]);
    s = use(s, 'n0', 'o-m1');
    expect(s.pending?.dragonGaze).toBeUndefined();
    expect(cardUsability(s, 'opponent', 'g0').usable).toBe(true);
  });

  it('重ねない：もう一度使っても1回分（効く手番だけ新しく）', () => {
    let s = use(scene({ player: [ty(9)] }), 'p0');
    s = nextOwnTurn(s, [ty(9)]);
    s = use(s, 'n0');
    expect(monster(s, 'p-m1').dragonGaze).toEqual({ turn: s.turn + 2 });
  });
});

describe('10 竜のちから：次の自分のターン、最初の攻撃1回は防御されない', () => {
  it('防御は使えず、回避はできる。倒れたら消える', () => {
    let s = use(scene({ player: [ty(10)] }), 'p0');
    expect(monster(s, 'p-m1').dragonMight).toEqual({ turn: s.turn + 2 });
    s = nextOwnTurn(s, [ty(3)]);
    s = giveOpponent(s, [sor(12), sor(14)]);
    s = use(s, 'n0', 'o-m1');
    expect(s.pending?.dragonMight).toBe(true);
    expect(cardUsability(s, 'opponent', 'g0')).toMatchObject({ usable: false, reason: 'この攻撃は防御できません' });
    expect(cardUsability(s, 'opponent', 'g1').usable).toBe(true);
  });

  it('まなざし＋ちから：回避も防御もされない（守りを待たずにダメージ）', () => {
    let s = scene({ player: [ty(9)] });
    s = use(s, 'p0');
    s = nextOwnTurn(s, []);
    // 次の手番に竜のちからもかける（もう一度、次の手番に2つとも効くように、まなざしもかけ直す）
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, hand: [{ uid: 'x0', cardId: ty(10) }] } } };
    s = use(s, 'x0');
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, monsters: s.sides.player.monsters.map((m) => (m.uid === 'p-m1' ? { ...m, dragonGaze: { turn: s.turn + 2 } } : m)) } } };
    s = nextOwnTurn(s, [ty(3)]);
    s = giveOpponent(s, [sor(12), sor(14)]);
    s = use(s, 'n0', 'o-m1');
    expect(s.phase).toBe('main');
    expect(monster(s, 'o-m1').life).toBe(1);
  });

  it('ドラゴンブレス（相手全員）に付いたときは相手全員に効く', () => {
    let s = use(scene({ player: [ty(9)] }), 'p0');
    s = nextOwnTurn(s, [ty(7)]);
    s = giveOpponent(s, [sor(14), sor(14)]);
    s = use(s, 'n0');
    expect(s.pending?.targetUid).toBe('o-m1');
    expect(cardUsability(s, 'opponent', 'g0').usable).toBe(false);
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(s.pending?.targetUid).toBe('o-m2');
    expect(s.pending?.dragonGaze).toBe(true);
    expect(cardUsability(s, 'opponent', 'g1').usable).toBe(false);
  });
});

describe('CPU：竜のまなざし・竜のちから', () => {
  it('次の手番に大きな攻撃（5以上）を払えそうで、相手に回避の技があれば、竜のまなざしを使う（腕前 B）', () => {
    // 次の手番のマナの見積もり：4 − 2 ＋（手札4枚 − 2）＝ 4 → かみつき（マナ4・6ダメージ）を払える
    let s = scene({ player: [ty(9), ty(3), sor(1), sor(1)] }, { player: 4 });
    // 相手を倒せる攻撃は無い（ライフを多く）
    s = { ...s, sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: [{ uid: 'h0', cardId: sor(1) }, { uid: 'h1', cardId: sor(1) }] } } };
    const a = chooseAction(s, 'player', 'normal', 'B');
    expect(a).toMatchObject({ type: 'useCard', cardUid: 'p0' });
  });

  it('大きな攻撃が手札に無ければ使わない', () => {
    const s = scene({ player: [ty(9), sor(1)] }, { player: 3 });
    const a = chooseAction(s, 'player', 'normal', 'B');
    expect(a).not.toMatchObject({ cardUid: 'p0' });
  });
});
