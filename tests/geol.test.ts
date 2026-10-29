import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { cardCatalog, getSkill, MONSTERS, QA_MONSTERS, QA_SKILLS, SKILLS, skillsOf, TMP_GEOL_ID, TMP_GEOL_SKILL_IDS } from '../src/data/cards.ts';
import { GEOL_CARD_TEXT, GEOL_COLOR, GEOL_GACHA_RARE, GEOL_MONSTER, GEOL_MONSTER_ID, GEOL_PLAYTEST_16, GEOL_SKILLS, geolSkillId } from '../src/data/geol.ts';
import geolJson from '../src/data/official/geol14_skills_DRAFT_20261029.json';
import { nobitonSkillId } from '../src/data/nobiton.ts';
import { soramoSkillId } from '../src/data/soramo.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { GRANT_BEATEN_FLAG } from '../src/data/dungeons.ts';
import { seriesLineup } from '../src/game/economy/gachaSeries.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, attackPower, cardUsability, createBattle, energyOf, isPinned, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { INITIAL_DISTRIBUTION } from '../src/game/deck/deck.ts';
import { createNewGameSave, createNewSave, normalizeSave, REMOVED_CARD_IDS, SAVE_VERSION } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/**
 * ジオル（2026-10-29。新モンスター制作の手順 4・G4 の試遊のあと、手順 8 の最終でふつうの一覧へ。指示書 design-parts/cards-original/geol/00_instructions_for_claude_code.txt）
 * 細かい裁定は docs/battle-rules.md「ジオル」
 */

const geo = (n: number): string => geolSkillId(n);
const sor = (n: number): string => soramoSkillId(n);
const nob = (n: number): string => nobitonSkillId(n);
const ORIGINAL_DIR = 'design-parts/cards-original/geol';

function csvRows(path: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text.trim().split(/\r?\n/).slice(1).map((line) => line.split(','));
}

describe('ジオル：データ（届いた JSON・CSV を無改変で置き、ゲームはその JSON を読む）', () => {
  it('保管した JSON・CSV・バトル用の絵は ZIP の原本と同じバイト列', () => {
    for (const f of ['geol14_skills_DRAFT_20261029.json', 'geol14_skills_DRAFT_20261029.csv']) {
      expect(readFileSync(`src/data/official/${f}`).equals(readFileSync(`${ORIGINAL_DIR}/${f}`)), f).toBe(true);
    }
    expect(readFileSync('assets/images/cards/monsters/geol_battlecard.png').equals(readFileSync(`${ORIGINAL_DIR}/geol_battleart.png`))).toBe(true);
  });

  it('CSV の14行・JSON・ゲームのカードで、番号・名前・分類・マナ・ダメージ・効果がすべて一致する', () => {
    const CATEGORY = { ちから技: 'force', かしこさ技: 'wisdom', 特殊: 'special', 防御: 'defense' } as const;
    const rows = csvRows('src/data/official/geol14_skills_DRAFT_20261029.csv');
    expect(rows).toHaveLength(14);
    rows.forEach(([no, name, cat, mana, damage, effect, slot], i) => {
      const skill = GEOL_SKILLS[i];
      const json = geolJson.skills[i];
      if (!skill || !json) throw new Error(String(i));
      expect(Number(no)).toBe(i + 1);
      expect(skill.id).toBe(geo(i + 1));
      expect(json.id).toBe(skill.id);
      expect([skill.name, json.name]).toEqual([name, name]);
      expect(skill.category).toBe(CATEGORY[cat as keyof typeof CATEGORY]);
      expect(skill.cost).toBe(Number(mana));
      expect(skill.stat?.value ?? '―').toBe(damage === '―' ? '―' : Number(damage));
      // 大きなカードに書く文は 05・09・10・11 だけ短い文（GEOL_CARD_TEXT）。JSON・CSV の文は変えない
      expect(json.effect).toBe(effect);
      expect(skill.effectTextJa ?? 'なし').toBe(GEOL_CARD_TEXT[i + 1] ?? effect);
      expect(json.gacha_slot).toBe(slot);
    });
  });

  it('大きなカードの短い文（05・09・10・11。2026-10-29 ユーザー指示）', () => {
    expect(getSkill(geo(5)).effectTextJa).toBe('相手全員に当たる（守りは1体ずつ）');
    expect(getSkill(geo(9)).effectTextJa).toBe('選んだ相手1体は、このターン次の攻撃を回避できない');
    expect(getSkill(geo(10)).effectTextJa).toBe('次のターン、最初のかしこさ技のダメージ2倍');
    expect(getSkill(geo(11)).effectTextJa).toBe('味方への攻撃を代わりに受ける');
    expect(Object.keys(GEOL_CARD_TEXT).map(Number)).toEqual([5, 9, 10, 11]);
  });

  it('モンスター：ライフ9・色は岩の茶・ID mon-geol。ガチャのレアの枠は 3・5・10・14。仮ジオルはゲームから外した', () => {
    expect(GEOL_MONSTER).toMatchObject({ id: 'mon-geol', life: 9, name: 'ジオル' });
    expect(GEOL_COLOR).toBe('#9A7B5C');
    expect(GEOL_GACHA_RARE).toEqual([geo(3), geo(5), geo(10), geo(14)]);
    // ガチャのシリーズ（2026-10-29 夜）：レア枠は JSON の gacha_slot と同じ。グラントに初めて勝ったあとに並ぶ
    const series = GACHA_SERIES.find((s) => s.monsterId === GEOL_MONSTER_ID);
    expect(series).toMatchObject({ id: 'geol', unlockFlag: GRANT_BEATEN_FLAG });
    if (!series) throw new Error('series');
    expect(seriesLineup(series).rareIds).toEqual(GEOL_GACHA_RARE);
    expect(BATTLE_CARDS[GEOL_MONSTER_ID]?.frame).toBe('geol');
    expect(existsSync('assets/images/ui/battlecard/frame_geol.png')).toBe(true);
    for (const size of ['normal', 'hand']) expect(existsSync(`assets/images/ui/skillcard_simple/frame_${size}_geol.webp`)).toBe(true);
    expect(cardCatalog.get(TMP_GEOL_ID)).toBeUndefined();
    for (const id of TMP_GEOL_SKILL_IDS) expect(cardCatalog.get(id)).toBeUndefined();
    expect(REMOVED_CARD_IDS).toEqual(expect.arrayContaining([TMP_GEOL_ID, ...TMP_GEOL_SKILL_IDS]));
  });

  it('ふつうの一覧（図鑑・デッキ編集・敵の編成）に入る。初期配布・ブースターの箱・新しいセーブには入らない。確認用の一覧（QA）は空', () => {
    expect(MONSTERS.some((m) => m.id === GEOL_MONSTER_ID)).toBe(true);
    expect(SKILLS.filter((s) => s.monsterId === GEOL_MONSTER_ID).map((s) => s.id)).toEqual(GEOL_SKILLS.map((s) => s.id));
    expect(INITIAL_DISTRIBUTION.some((d) => d.monsterId === GEOL_MONSTER_ID)).toBe(false);
    for (const b of BOOSTERS) expect(b.monsters).not.toContain(GEOL_MONSTER_ID);
    expect(Object.keys(createNewGameSave().collection).some((id) => id.includes('geol'))).toBe(false);
    expect(QA_MONSTERS).toEqual([]);
    expect(QA_SKILLS).toEqual([]);
    expect(skillsOf(GEOL_MONSTER_ID).map((s) => s.id)).toEqual(GEOL_SKILLS.map((s) => s.id));
  });

  it('絵：技14枚・正式モンスターカードがあり、原本は無改変で保管', () => {
    for (let n = 1; n <= 14; n++) {
      const nn = String(n).padStart(2, '0');
      expect(getSkill(geo(n)).art?.file).toBe(`geol_sk_${nn}.webp`);
      expect(existsSync(`assets/images/cards/skills/geol_sk_${nn}.webp`)).toBe(true);
      expect(existsSync(`${ORIGINAL_DIR}/geol_sk_${nn}.png`)).toBe(true);
    }
    expect(GEOL_MONSTER.art?.file).toBe('geol_official.webp');
    expect(existsSync('assets/images/cards/monsters/geol_official.webp')).toBe(true);
    expect(existsSync(`${ORIGINAL_DIR}/geol_official_monstercard_LIFE9.png`)).toBe(true);
  });

  it('試遊用の16枚（進行の仮）：攻撃11・特殊2・守り3。うけとめるは入れない', () => {
    const cards = GEOL_PLAYTEST_16.flatMap((c) => Array<string>(c.copies).fill(c.id)).map(getSkill);
    expect(cards).toHaveLength(16);
    expect(cards.filter((c) => c.effect.type === 'attack')).toHaveLength(11);
    expect(cards.filter((c) => c.category === 'special')).toHaveLength(2);
    expect(cards.filter((c) => c.category === 'defense')).toHaveLength(3);
    expect(cards.some((c) => c.id === geo(14))).toBe(false);
  });

  it('英語の名前（仮訳）', () => {
    setLanguage('en');
    expect(cardName(GEOL_MONSTER_ID)).toBe('Geol');
    expect(cardName(geo(5))).toBe('Earth Tremor');
    setLanguage('ja');
  });
});

/* ---------- バトル ---------- */

// 自分：ジオル（p-m1 ライフ9）・ソラモ（p-m2 ライフ7）・ノビトン（p-m3 ライフ8）。相手も同じ（o-m1〜3）
const MONS = ['mon-geol', 'mon-soramo', 'mon-nobiton'];

function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}, active: Side = 'player', monsters: readonly string[] = MONS): BattleState {
  const deck = { monsters: [...monsters], skills: Array.from({ length: 60 }, () => sor(1)) };
  const s = createBattle({ name: 'P', deck }, { name: 'O', deck }, 11, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 10 }, () => sor(1)),
  });
  return { ...s, phase: 'main', active, manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const monster = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};

const withMonster = (s: BattleState, uid: string, patch: Partial<BattleMonster>): BattleState => {
  const side: Side = uid.startsWith('p-') ? 'player' : 'opponent';
  return { ...s, sides: { ...s.sides, [side]: { ...s.sides[side], monsters: s.sides[side].monsters.map((m) => (m.uid === uid ? { ...m, ...patch } : m)) } } };
};

/** 相手の手札に足す（守りのカード。uid は g0〜） */
const giveOpponent = (s: BattleState, cards: string[]): BattleState => ({
  ...s,
  sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: [...s.sides.opponent.hand, ...cards.map((cardId, i) => ({ uid: `g${i}`, cardId }))] } },
});

/** 次の自分の手番の攻撃のはじめへ（相手は何もしない） */
function nextOwnTurn(s: BattleState, hand: string[] = []): BattleState {
  let x = applyAction(applyAction(s, { type: 'endAttack', side: 'player' }), { type: 'endTurn', side: 'player' });
  x = applyAction(applyAction(x, { type: 'endAttack', side: 'opponent' }), { type: 'endTurn', side: 'opponent' });
  expect(x.active).toBe('player');
  return { ...x, phase: 'main', sides: { ...x.sides, player: { ...x.sides.player, hand: hand.map((cardId, i) => ({ uid: `n${i}`, cardId })) } } };
}

const endDefense = (s: BattleState, side: Side = 'opponent'): BattleState => (s.phase === 'defense' ? applyAction(s, { type: 'defend', side, cardUid: null }) : s);

describe('02 いわくだき：防御されない（回避はできる）', () => {
  it('防御のカードは使えず、回避は使える', () => {
    let s = giveOpponent(scene({ player: [geo(2)] }), [sor(11), sor(14)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(s.phase).toBe('defense');
    expect(cardUsability(s, 'opponent', 'g0')).toMatchObject({ usable: false, reason: 'この攻撃は防御できません' });
    expect(cardUsability(s, 'opponent', 'g1').usable).toBe(true);
    s = endDefense(applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g1' }));
    expect(monster(s, 'o-m2').life).toBe(7);
  });
});

describe('05 地ひびき：相手全体に2ダメージ。防御・回避は1体ずつ', () => {
  it('相手を選ばずに使い、左から1体ずつ守りを選ぶ（防御・回避・守らない）', () => {
    let s = giveOpponent(scene({ player: [geo(5)] }), [geo(12), sor(14)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(s.phase).toBe('defense');
    expect(s.pending?.targetUid).toBe('o-m1');
    expect(s.pending?.queue).toEqual(['o-m2', 'o-m3']);
    // ジオル（o-m1）はいわのうで（ちから技−3）で0に
    s = endDefense(applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g0' }));
    expect(s.pending?.targetUid).toBe('o-m2');
    // ソラモ（o-m2）は星影ステップで回避
    expect(cardUsability(s, 'opponent', 'g0').usable).toBe(false);
    s = endDefense(applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g1' }));
    expect(s.pending?.targetUid).toBe('o-m3');
    // ノビトン（o-m3）は守らない
    s = endDefense(s);
    expect(s.phase).toBe('main');
    expect([monster(s, 'o-m1').life, monster(s, 'o-m2').life, monster(s, 'o-m3').life]).toEqual([9, 7, 6]);
  });

  it('倒れている相手は飛ばす。最後の1体を倒したら勝負がつく', () => {
    let s = withMonster(withMonster(scene({ player: [geo(5)] }), 'o-m2', { life: 0 }), 'o-m3', { life: 2 });
    s = withMonster(s, 'o-m1', { life: 1 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(s.pending?.queue).toEqual(['o-m3']);
    s = endDefense(endDefense(s));
    expect(s.phase).toBe('ended');
    expect(s.winner).toBe('player');
  });

  it('相手全体への攻撃には、かばうを使えない', () => {
    let s = giveOpponent(scene({ player: [geo(5)] }), [geo(11)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    s = endDefense(s);
    expect(s.pending?.targetUid).toBe('o-m2');
    expect(cardUsability(s, 'opponent', 'g0')).toMatchObject({ usable: false, reason: '相手全体への攻撃にはかばうを使えません' });
  });
});

describe('09 じならし：指定した相手1体は、このターンに受ける次の攻撃1回を回避できない', () => {
  it('回避できず（防御はできる）、ジオルはこのターン攻撃できない。攻撃を1回受けたら消える', () => {
    let s = applyAction(scene({ player: [geo(9), geo(1), sor(3), nob(1)] }), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(isPinned(s, monster(s, 'o-m2'))).toBe(true);
    // じならしを使ったジオルは、このターンもう攻撃できない
    expect(cardUsability(s, 'player', 'p1').usable).toBe(false);
    s = giveOpponent(s, [sor(14), sor(11), sor(14)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p2', targetUid: 'o-m2' });
    expect(cardUsability(s, 'opponent', 'g0')).toMatchObject({ usable: false, reason: 'じならしで、この攻撃は回避できません' });
    expect(cardUsability(s, 'opponent', 'g1').usable).toBe(true);
    s = endDefense(s);
    expect(monster(s, 'o-m2').life).toBe(5);
    expect(isPinned(s, monster(s, 'o-m2'))).toBe(false);
    // 2回目の攻撃は回避できる
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p3', targetUid: 'o-m2' });
    expect(cardUsability(s, 'opponent', 'g2').usable).toBe(true);
  });

  it('ターンが終わったら消える。1ターンに1回（ジオルが2体いても）', () => {
    let s = applyAction(scene({ player: [geo(9), geo(9)] }, {}, 'player', ['mon-geol', 'mon-geol', 'mon-soramo']), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m3' });
    expect(cardUsability(s, 'player', 'p1')).toMatchObject({ usable: false, reason: 'このターンはもう使えません（1ターンに1回）' });
    s = nextOwnTurn(s);
    expect(isPinned(s, monster(s, 'o-m3'))).toBe(false);
  });
});

describe('10 エネルギーをためる：次の自分のターンに最初に使うかしこさ技1回だけダメージ2倍', () => {
  it('次のターンのかしこさ技が2倍（同じターンには効かない）。使ったら消える', () => {
    let s = applyAction(scene({ player: [geo(10)] }), { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(monster(s, 'p-m1').energy).toEqual({ turn: s.turn + 2 });
    expect(energyOf(s, monster(s, 'p-m1'), getSkill(geo(8)))).toBe(false);
    s = nextOwnTurn(s, [geo(7)]);
    expect(attackPower(s, getSkill(geo(8)), monster(s, 'p-m1'))).toBe(8);
    s = endDefense(applyAction(s, { type: 'useCard', side: 'player', cardUid: 'n0', targetUid: 'o-m2' }));
    expect(monster(s, 'o-m2').life).toBe(7 - 4);
    expect(monster(s, 'p-m1').energy ?? null).toBeNull();
  });

  it('ちから技を使っても消えない（そのターンの終わりに消える）', () => {
    let s = applyAction(scene({ player: [geo(10)] }), { type: 'useCard', side: 'player', cardUid: 'p0' });
    s = nextOwnTurn(s, [geo(1)]);
    expect(attackPower(s, getSkill(geo(1)), monster(s, 'p-m1'))).toBe(2);
    s = endDefense(applyAction(s, { type: 'useCard', side: 'player', cardUid: 'n0', targetUid: 'o-m2' }));
    expect(monster(s, 'p-m1').energy).not.toBeNull();
    s = nextOwnTurn(s);
    expect(energyOf(s, monster(s, 'p-m1'), getSkill(geo(8)))).toBe(false);
  });

  it('重ねられない（2回ためても2倍のまま）。おいかぜ＋1 は2倍のあと、防御の軽減はそのあと', () => {
    let s = applyAction(scene({ player: [geo(10)] }), { type: 'useCard', side: 'player', cardUid: 'p0' });
    s = withMonster(s, 'p-m1', { energy: { turn: s.turn + 2 } });
    s = nextOwnTurn(s, [geo(8)]);
    s = withMonster(s, 'p-m1', { tailwind: { amount: 1, turn: s.turn } });
    expect(attackPower(s, getSkill(geo(8)), monster(s, 'p-m1'))).toBe(4 * 2 + 1);
    s = giveOpponent(s, [sor(12)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'n0', targetUid: 'o-m2' });
    s = endDefense(applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g0' }));
    expect(monster(s, 'o-m2').life).toBe(7 - (9 - 3));
  });
});

describe('11 かばう：ジオル以外の味方が狙われたとき、ジオルが代わりに受ける', () => {
  it('攻撃の相手がジオルに変わり、そのあとジオルは自分の防御を使える', () => {
    let s = giveOpponent(scene({ player: [sor(5)] }), [geo(11), geo(12)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(cardUsability(s, 'opponent', 'g0').usable).toBe(true);
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g0' });
    expect(s.pending).toMatchObject({ targetUid: 'o-m1', coveredFrom: 'o-m2' });
    s = endDefense(applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g1' }));
    expect(monster(s, 'o-m1').life).toBe(9 - 1);
    expect(monster(s, 'o-m2').life).toBe(7);
  });

  it('使えないとき：ジオル自身が狙われた・防御されない攻撃・ほかの守りのあと・ジオルが倒れている', () => {
    const self = applyAction(giveOpponent(scene({ player: [sor(5)] }), [geo(11)]), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(self, 'opponent', 'g0').usable).toBe(false);
    const unblock = applyAction(giveOpponent(scene({ player: [geo(2)] }), [geo(11)]), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(cardUsability(unblock, 'opponent', 'g0')).toMatchObject({ usable: false, reason: 'この攻撃は防御できません' });
    let after = applyAction(giveOpponent(scene({ player: [sor(5)] }), [sor(11), geo(11)]), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    after = applyAction(after, { type: 'defend', side: 'opponent', cardUid: 'g0' });
    expect(cardUsability(after, 'opponent', 'g1')).toMatchObject({ usable: false, reason: 'ほかの守りを使ったあとは、かばえません' });
    const down = applyAction(withMonster(giveOpponent(scene({ player: [sor(5)] }), [geo(11)]), 'o-m1', { life: 0 }), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(cardUsability(down, 'opponent', 'g0').usable).toBe(false);
  });

  it('まきつく（次の手番に行動できない）も、代わりに受けたジオルが受ける', () => {
    let s = giveOpponent(scene({ player: [nob(3)] }), [geo(11)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    s = endDefense(applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g0' }));
    expect(monster(s, 'o-m1').stunnedTurn).toBe(s.turn + 1);
    expect(monster(s, 'o-m2').stunnedTurn ?? null).toBeNull();
    expect(monster(s, 'o-m1').life).toBe(9 - 2);
  });
});

describe('14 うけとめる：ちから技のダメージを0にする防御', () => {
  it('回避されない攻撃（じならし）にも使える。防御されない攻撃・かしこさ技には使えない', () => {
    let s = applyAction(scene({ player: [geo(9), sor(5)] }), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    s = giveOpponent(s, [geo(14)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p1', targetUid: 'o-m1' });
    expect(s.pending?.pinned).toBe(true);
    expect(cardUsability(s, 'opponent', 'g0').usable).toBe(true);
    s = endDefense(applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g0' }));
    expect(monster(s, 'o-m1').life).toBe(9);
    expect(s.log.some((l) => l.text === '相手は「うけとめる」でうけとめた（ダメージ0）！')).toBe(true);
    const unblock = applyAction(giveOpponent(scene({ player: [geo(2)] }), [geo(14)]), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(unblock, 'opponent', 'g0').usable).toBe(false);
    const wisdom = applyAction(giveOpponent(scene({ player: [sor(6)] }), [geo(14)]), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(wisdom, 'opponent', 'g0').usable).toBe(false);
  });
});

describe('相手の CPU（ジオル）', () => {
  it('地ひびき：相手が2体以上生きていて、倒せる相手がいないとき', () => {
    const s = scene({ opponent: [geo(5), geo(1)] }, { opponent: 5 }, 'opponent');
    expect(chooseAction(s, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o0' });
  });

  it('エネルギーをためる：倒せず、次の手番にクリスタルレイを使えそうなとき', () => {
    const s = scene({ opponent: [geo(10), geo(8)] }, { opponent: 6 }, 'opponent');
    expect(chooseAction(s, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o0', userUid: 'o-m1' });
  });

  it('じならし：まだ動いていない味方が攻撃技（ダメージ3以上）を使えそうなとき、その味方が攻撃する相手に', () => {
    const s = withMonster(scene({ opponent: [geo(9), sor(5)] }, { opponent: 7 }, 'opponent'), 'p-m3', { life: 4 });
    expect(chooseAction(s, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o0', targetUid: 'p-m3' });
  });

  it('かばう：味方が倒れそうでジオルは倒れないとき。ジオルの防御で大きく減らせるとき', () => {
    const lethal = applyAction(withMonster(giveOpponent(scene({ player: [sor(5)] }, { opponent: 2 }), [geo(11)]), 'o-m2', { life: 3 }), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(chooseAction(lethal, 'opponent')).toEqual({ type: 'defend', side: 'opponent', cardUid: 'g0' });
    const reduce = applyAction(giveOpponent(scene({ player: [sor(5)] }, { opponent: 4 }), [geo(11), geo(12)]), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(chooseAction(reduce, 'opponent')).toEqual({ type: 'defend', side: 'opponent', cardUid: 'g0' });
    // ジオルも倒れてしまうときは使わない
    const both = applyAction(withMonster(withMonster(giveOpponent(scene({ player: [sor(5)] }, { opponent: 2 }), [geo(11)]), 'o-m2', { life: 3 }), 'o-m1', { life: 2 }), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(chooseAction(both, 'opponent')).toEqual({ type: 'defend', side: 'opponent', cardUid: null });
  });
});

describe('ジオルの最終：前のセーブの仮ジオル（セーブ version 23）', () => {
  it('仮ジオルのモンスターカードは mon-geol に置きかえ、技カードは消す。デッキの仮ジオルもジオルに', () => {
    const base = createNewSave();
    const tmpSkills = TMP_GEOL_SKILL_IDS;
    const deck = { monsters: [base.deck.monsters[0] as string, TMP_GEOL_ID, base.deck.monsters[2] as string], skills: [...base.deck.skills.slice(0, 57), tmpSkills[0], tmpSkills[1], tmpSkills[1]] };
    const old = {
      ...base,
      version: 22,
      collection: { ...base.collection, [TMP_GEOL_ID]: 2, [tmpSkills[0] as string]: 1, [tmpSkills[1] as string]: 3 },
      deck,
      peopleBook: { met: ['grant'], records: { grant: { wins: 1, losses: 0, monsters: [TMP_GEOL_ID, 'mon-soramo'], cards: [tmpSkills[2], 'skl-lazuck-01'] } } },
      cardsSeen: [TMP_GEOL_ID, tmpSkills[0], 'mon-soramo'],
    };
    const s = normalizeSave(JSON.parse(JSON.stringify(old)));
    if (!s) throw new Error('load');
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.collection[GEOL_MONSTER_ID]).toBe(2);
    expect(Object.keys(s.collection).some((id) => id.includes('tmp-geol'))).toBe(false);
    expect(s.deck.monsters[1]).toBe(GEOL_MONSTER_ID);
    expect(s.deck.skills.some((id) => id.includes('tmp-geol'))).toBe(false);
    expect(s.peopleBook.records.grant).toMatchObject({ monsters: [GEOL_MONSTER_ID, 'mon-soramo'], cards: ['skl-lazuck-01'] });
    expect(s.cardsSeen).toEqual(['mon-soramo']);
  });

  it('仮ジオルを持っていないセーブは変わらない', () => {
    const base = createNewSave();
    const s = normalizeSave(JSON.parse(JSON.stringify({ ...base, version: 22 })));
    expect(s?.collection).toEqual(base.collection);
    expect(s?.deck).toEqual(base.deck);
  });
});

describe('ジオルのガチャのシリーズ（2026-10-29 夜）', () => {
  it('グラントに初めて勝つまでは並ばず、勝つと並ぶ。前にグラントに勝っているセーブは読み込むと並ぶ', async () => {
    const { availableGachaSeries } = await import('../src/data/economy.ts');
    const { startRun, winRunBattle, runFloor } = await import('../src/game/dungeon/run.ts');
    const base = createNewSave();
    expect(availableGachaSeries(base.storyFlags).map((s) => s.id)).not.toContain('geol');
    const s = startRun(base, 'dungeon-01', 77);
    const run = s.dungeonRun;
    if (!run) throw new Error('run');
    const last = { ...run, floor: 3 };
    const boss = runFloor(last).entities.find((e) => e.kind === 'boss');
    if (!boss) throw new Error('boss');
    const w = winRunBattle({ ...s, dungeonRun: last }, { kind: 'boss', id: boss.id }, null);
    expect(w.save.storyFlags).toEqual([GRANT_BEATEN_FLAG]);
    expect(availableGachaSeries(w.save.storyFlags).map((s) => s.id)).toContain('geol');
    // 2回目に勝っても記録は1つだけ
    const again = startRun(w.save, 'dungeon-01', 78);
    const w2 = winRunBattle({ ...again, dungeonRun: { ...(again.dungeonRun as NonNullable<typeof again.dungeonRun>), floor: 3 } }, { kind: 'boss', id: boss.id }, null);
    expect(w2.save.storyFlags).toEqual([GRANT_BEATEN_FLAG]);
    // 前のセーブ：遺跡のボスに勝った記録があれば、読み込むと並ぶ
    const old = normalizeSave(JSON.parse(JSON.stringify({ ...base, dungeons: { 'dungeon-01': { openedChests: [], bossDefeated: true, clears: 1 } } })));
    expect(old?.storyFlags).toContain(GRANT_BEATEN_FLAG);
    expect(normalizeSave(JSON.parse(JSON.stringify(base)))?.storyFlags).not.toContain(GRANT_BEATEN_FLAG);
  });
});
