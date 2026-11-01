import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { cardCatalog, getSkill, MONSTERS, QA_MONSTERS, QA_SKILLS, REMOVED_SKILL_IDS, SKILLS, skillsOf, TMP_GEOL_ID, TMP_GEOL_SKILL_IDS } from '../src/data/cards.ts';
import { GEOL_COLOR, GEOL_GACHA_RARE, GEOL_MONSTER, GEOL_MONSTER_ID, GEOL_PLAYTEST_16, GEOL_SKILLS, geolSkillId } from '../src/data/geol.ts';
import geolJson from '../src/data/official/geol14_skills_DRAFT_20261029.json';
import { lazuckSkillId } from '../src/data/lazuck.ts';
import { nobitonSkillId } from '../src/data/nobiton.ts';
import { soramoSkillId } from '../src/data/soramo.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { GRANT_BEATEN_FLAG } from '../src/data/dungeons.ts';
import { seriesLineup } from '../src/game/economy/gachaSeries.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, attackPower, cardUsability, createBattle, energyOf, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { INITIAL_DISTRIBUTION } from '../src/game/deck/deck.ts';
import { createNewGameSave, createNewSave, normalizeSave, REMOVED_CARD_IDS, SAVE_VERSION } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';
import { SKILL_CARD_TEXT } from '../src/data/skillCardText.ts';
import { AJ_SKILLS, ajRareNames } from '../src/data/skillRebuildAJ.ts';

/**
 * ジオル（2026-10-29。新モンスター制作の手順 4・G4 の試遊のあと、手順 8 の最終でふつうの一覧へ。指示書 design-parts/cards-original/geol/00_instructions_for_claude_code.txt）
 * 細かい裁定は docs/battle-rules.md「ジオル」
 */

const geo = (n: number): string => geolSkillId(n);
const sor = (n: number): string => soramoSkillId(n);
const nob = (n: number): string => nobitonSkillId(n);
const laz = (n: number): string => lazuckSkillId(n);
/** 前の14技（GEOL_SKILLS。絵と前のデータのためだけに残す）から引く */
const legacy = (id: string) => {
  const s = GEOL_SKILLS.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};
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

  it('CSV の14行・JSON・前の14技（GEOL_SKILLS）で、番号・名前・分類・マナ・ダメージ・効果がすべて一致する', () => {
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
      // 画面に出す文は短い文（skillCardText.ts）。JSON・CSV の文は変えない
      expect(json.effect).toBe(effect);
      expect(skill.effectTextJa ?? 'なし').toBe(SKILL_CARD_TEXT[skill.id] ?? effect);
      expect(json.gacha_slot).toBe(slot);
    });
  });

  it('ゲームのカード12枚は指示書 AJ の表どおり（名前・分類・マナ・ダメージ・効果・効果の文・表示の番号）。絵は前の同じ ID の技から', () => {
    const CAT = { ち: 'force', か: 'wisdom', 特: 'special', 防: 'defense', 避: 'evade' } as const;
    const rows = AJ_SKILLS[GEOL_MONSTER_ID] ?? [];
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 13, 14].map(geo));
    rows.forEach((r, i) => {
      const s = getSkill(r.id);
      expect(s.name).toBe(r.name);
      expect(s.category).toBe(CAT[r.cat]);
      expect(s.cost).toBe(r.mana);
      expect(s.stat?.value ?? null).toBe(r.damage);
      expect(s.effect).toEqual(r.effect ?? { type: 'attack' });
      expect(s.effectTextJa).toBe(r.text);
      expect(s.displayNo).toBe(i + 1);
      expect(s.monsterId).toBe(GEOL_MONSTER_ID);
      expect(s.art).toEqual(legacy(r.id).art);
    });
    // 09 じならし・12 いわのうでは外した
    for (const n of [9, 12]) {
      expect(cardCatalog.get(geo(n))).toBeUndefined();
      expect(REMOVED_CARD_IDS).toContain(geo(n));
    }
  });

  it('画面に出す短い文（2026-10-29 ユーザー指示。2026-11-01 指示書 AJ の効果の文）', () => {
    expect(getSkill(geo(5)).effectTextJa).toBe('地上の相手全員に当たる（守りは1体ずつ）');
    expect(getSkill(geo(10)).effectTextJa).toBe('次のターン、最初のかしこさ技を2倍に');
    expect(getSkill(geo(11)).effectTextJa).toBe('味方への攻撃を代わりに受ける');
    expect(getSkill(geo(14)).effectTextJa).toBe('ちから技に効く');
  });

  it('モンスター：ライフ9・色は岩の茶・ID mon-geol。ガチャのレアの枠は 3・5・6・14（指示書 AJ）。仮ジオルはゲームから外した', () => {
    expect(GEOL_MONSTER).toMatchObject({ id: 'mon-geol', life: 9, name: 'ジオル' });
    expect(GEOL_COLOR).toBe('#9A7B5C');
    // 前のレアの枠（JSON の gacha_slot。前のデータとして残す）
    expect(GEOL_GACHA_RARE).toEqual([geo(3), geo(6), geo(14)]);
    // ガチャのシリーズ：レア枠は指示書 AJ の ★（ナックル・地ひびき・グランドハンマー・うけとめる）。グラントに初めて勝ったあとに並ぶ
    const series = GACHA_SERIES.find((s) => s.monsterId === GEOL_MONSTER_ID);
    expect(series).toMatchObject({ id: 'geol', unlockFlag: GRANT_BEATEN_FLAG });
    if (!series) throw new Error('series');
    expect(ajRareNames(GEOL_MONSTER_ID)).toEqual(['ナックル', '地ひびき', 'グランドハンマー', 'うけとめる']);
    const lineup = seriesLineup(series);
    expect(lineup.errors).toEqual([]);
    expect(lineup.rareIds).toEqual([geo(3), geo(5), geo(6), geo(14)]);
    expect(lineup.all).toHaveLength(13); // 技12枚＋モンスター
    expect(BATTLE_CARDS[GEOL_MONSTER_ID]?.frame).toBe('geol');
    expect(existsSync('assets/images/ui/battlecard/frame_geol.png')).toBe(true);
    for (const size of ['normal', 'hand']) expect(existsSync(`assets/images/ui/skillcard_simple/frame_${size}_geol.webp`)).toBe(true);
    expect(cardCatalog.get(TMP_GEOL_ID)).toBeUndefined();
    for (const id of TMP_GEOL_SKILL_IDS) expect(cardCatalog.get(id)).toBeUndefined();
    expect(REMOVED_CARD_IDS).toEqual(expect.arrayContaining([TMP_GEOL_ID, ...TMP_GEOL_SKILL_IDS]));
  });

  it('ふつうの一覧（図鑑・デッキ編集・敵の編成）に入る。初期配布・ブースターの箱・新しいセーブには入らない。確認用の一覧（QA）は空', () => {
    expect(MONSTERS.some((m) => m.id === GEOL_MONSTER_ID)).toBe(true);
    const ajIds = (AJ_SKILLS[GEOL_MONSTER_ID] ?? []).map((r) => r.id);
    expect(SKILLS.filter((s) => s.monsterId === GEOL_MONSTER_ID).map((s) => s.id)).toEqual(ajIds);
    expect(INITIAL_DISTRIBUTION.some((d) => d.monsterId === GEOL_MONSTER_ID)).toBe(false);
    for (const b of BOOSTERS) expect(b.monsters).not.toContain(GEOL_MONSTER_ID);
    expect(Object.keys(createNewGameSave().collection).some((id) => id.includes('geol'))).toBe(false);
    expect(QA_MONSTERS).toEqual([]);
    expect(QA_SKILLS).toEqual([]);
    expect(skillsOf(GEOL_MONSTER_ID).map((s) => s.id)).toEqual(ajIds);
  });

  it('絵：技14枚・正式モンスターカードがあり、原本は無改変で保管', () => {
    for (let n = 1; n <= 14; n++) {
      const nn = String(n).padStart(2, '0');
      // 指示書 AJ で外した技（09・12）は前の14技で確かめる
      expect(legacy(geo(n)).art?.file).toBe(`geol_sk_${nn}.webp`);
      if (!REMOVED_SKILL_IDS.includes(geo(n))) expect(getSkill(geo(n)).art?.file).toBe(`geol_sk_${nn}.webp`);
      expect(existsSync(`assets/images/cards/skills/geol_sk_${nn}.webp`)).toBe(true);
      expect(existsSync(`${ORIGINAL_DIR}/geol_sk_${nn}.png`)).toBe(true);
    }
    expect(GEOL_MONSTER.art?.file).toBe('geol_official.webp');
    expect(existsSync('assets/images/cards/monsters/geol_official.webp')).toBe(true);
    expect(existsSync(`${ORIGINAL_DIR}/geol_official_monstercard_LIFE9.png`)).toBe(true);
  });

  it('試遊用の16枚（進行の仮。前の14技のときのもの）：攻撃11・特殊2・守り3。うけとめるは入れない', () => {
    const cards = GEOL_PLAYTEST_16.flatMap((c) => Array<string>(c.copies).fill(c.id)).map(legacy);
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
    let s = giveOpponent(scene({ player: [geo(2)] }), [sor(12), sor(14)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(s.phase).toBe('defense');
    expect(cardUsability(s, 'opponent', 'g0')).toMatchObject({ usable: false, reason: 'この攻撃は防御できません' });
    expect(cardUsability(s, 'opponent', 'g1').usable).toBe(true);
    s = endDefense(applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g1' }));
    expect(monster(s, 'o-m2').life).toBe(7);
  });
});

describe('05 地ひびき：地上の相手全体に3ダメージ（指示書 AJ）。防御・回避は1体ずつ', () => {
  it('相手を選ばずに使い、左から1体ずつ守りを選ぶ（防御・回避・守らない）', () => {
    let s = giveOpponent(scene({ player: [geo(5)] }), [geo(14), sor(14)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(s.phase).toBe('defense');
    expect(s.pending?.targetUid).toBe('o-m1');
    expect(s.pending?.queue).toEqual(['o-m2', 'o-m3']);
    // ジオル（o-m1）はうけとめる（ちから技−5）で0に
    s = endDefense(applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g0' }));
    expect(s.pending?.targetUid).toBe('o-m2');
    // ソラモ（o-m2）は星影ステップで回避
    expect(cardUsability(s, 'opponent', 'g0').usable).toBe(false);
    s = endDefense(applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g1' }));
    expect(s.pending?.targetUid).toBe('o-m3');
    // ノビトン（o-m3）は守らない
    s = endDefense(s);
    expect(s.phase).toBe('main');
    expect([monster(s, 'o-m1').life, monster(s, 'o-m2').life, monster(s, 'o-m3').life]).toEqual([9, 7, 5]);
  });

  it('空中・水中の相手には当たらない（地上の相手だけ）', () => {
    // 相手：ジオル（地上）・ガウル（空中）・ミュロル（水中）
    let s = scene({ player: [geo(5)] }, {}, 'player', ['mon-geol', 'mon-gauul', 'mon-myurol']);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(s.pending?.targetUid).toBe('o-m1');
    expect(s.pending?.queue ?? []).toEqual([]);
    s = endDefense(s);
    expect(s.phase).toBe('main');
    expect([monster(s, 'o-m1').life, monster(s, 'o-m2').life, monster(s, 'o-m3').life]).toEqual([6, 6, 7]);
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

// 指示書 AJ で外した技（skl-geol-09 じならし）のテストは消した

describe('10 エネルギーをためる：次の自分のターンに最初に使うかしこさ技1回だけダメージ2倍', () => {
  it('次のターンのかしこさ技が2倍（同じターンには効かない）。使ったら消える', () => {
    let s = applyAction(scene({ player: [geo(10)] }), { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(monster(s, 'p-m1').energy).toEqual({ turn: s.turn + 2 });
    expect(energyOf(s, monster(s, 'p-m1'), getSkill(geo(8)))).toBe(false);
    s = nextOwnTurn(s, [geo(7)]);
    expect(attackPower(s, getSkill(geo(8)), monster(s, 'p-m1'))).toBe(8);
    // クリスタルショット（かしこさ3。指示書 AJ）→ 6
    s = endDefense(applyAction(s, { type: 'useCard', side: 'player', cardUid: 'n0', targetUid: 'o-m2' }));
    expect(monster(s, 'o-m2').life).toBe(7 - 6);
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
    // スターフォール（かしこさ6）→ ジオルのすいしょうのたて（かしこさ−3）で3
    let s = giveOpponent(scene({ player: [sor(8)] }), [geo(11), geo(13)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(cardUsability(s, 'opponent', 'g0').usable).toBe(true);
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g0' });
    expect(s.pending).toMatchObject({ targetUid: 'o-m1', coveredFrom: 'o-m2' });
    s = endDefense(applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g1' }));
    expect(monster(s, 'o-m1').life).toBe(9 - 3);
    expect(monster(s, 'o-m2').life).toBe(7);
  });

  it('使えないとき：ジオル自身が狙われた・防御されない攻撃・ほかの守りのあと・ジオルが倒れている', () => {
    const self = applyAction(giveOpponent(scene({ player: [sor(5)] }), [geo(11)]), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(self, 'opponent', 'g0').usable).toBe(false);
    const unblock = applyAction(giveOpponent(scene({ player: [geo(2)] }), [geo(11)]), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(cardUsability(unblock, 'opponent', 'g0')).toMatchObject({ usable: false, reason: 'この攻撃は防御できません' });
    let after = applyAction(giveOpponent(scene({ player: [sor(5)] }), [sor(12), geo(11)]), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
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

describe('14 うけとめる：ちから技−5 の防御（指示書 AJ。「0にする」はやめた）', () => {
  it('回避されない攻撃（ラズックのみだれづめ）にも使える。−5 で0未満にならない。防御されない攻撃・かしこさ技には使えない', () => {
    const team = ['mon-geol', 'mon-soramo', 'mon-lazuck'];
    let s = giveOpponent(scene({ player: [laz(4)] }, {}, 'player', team), [geo(14)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(s, 'opponent', 'g0').usable).toBe(true);
    s = endDefense(applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g0' }));
    expect(monster(s, 'o-m1').life).toBe(9); // 3 − 5 → 0
    // 0 にはしない：グランドハンマー 9 − 5 → 4
    let big = giveOpponent(scene({ player: [geo(6)] }), [geo(14)]);
    big = applyAction(big, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    big = endDefense(applyAction(big, { type: 'defend', side: 'opponent', cardUid: 'g0' }));
    expect(monster(big, 'o-m1').life).toBe(9 - 4);
    const unblock = applyAction(giveOpponent(scene({ player: [geo(2)] }), [geo(14)]), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(unblock, 'opponent', 'g0').usable).toBe(false);
    const wisdom = applyAction(giveOpponent(scene({ player: [sor(6)] }), [geo(14)]), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(wisdom, 'opponent', 'g0').usable).toBe(false);
  });
});

describe('相手の CPU（ジオル）', () => {
  it('地ひびき：相手が2体以上生きていて、倒せる相手がいないとき', () => {
    const s = scene({ opponent: [geo(5), geo(1)] }, { opponent: 6 }, 'opponent'); // 地ひびきはマナ6（指示書 AJ）
    expect(chooseAction(s, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o0' });
  });

  it('エネルギーをためる：倒せず、次の手番にクリスタルレイを使えそうなとき', () => {
    const s = scene({ opponent: [geo(10), geo(8)] }, { opponent: 6 }, 'opponent');
    expect(chooseAction(s, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o0', userUid: 'o-m1' });
  });

  // 指示書 AJ で外した技（skl-geol-09 じならし）の CPU のテストは消した

  it('かばう：味方が倒れそうでジオルは倒れないとき。ジオルの防御で大きく減らせるとき', () => {
    const lethal = applyAction(withMonster(giveOpponent(scene({ player: [sor(5)] }, { opponent: 2 }), [geo(11)]), 'o-m2', { life: 3 }), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(chooseAction(lethal, 'opponent')).toEqual({ type: 'defend', side: 'opponent', cardUid: 'g0' });
    const reduce = applyAction(giveOpponent(scene({ player: [sor(5)] }, { opponent: 4 }), [geo(11), geo(14)]), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
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
    const { availableGachaSeriesFor } = await import('../src/game/economy/gachaSeries.ts');
    const { startRun, winRunBattle, runFloor } = await import('../src/game/dungeon/run.ts');
    const base = createNewSave();
    expect(availableGachaSeriesFor(base).map((s) => s.id)).not.toContain('geol');
    const s = startRun(base, 'dungeon-01', 77);
    const run = s.dungeonRun;
    if (!run) throw new Error('run');
    const last = { ...run, floor: 3 };
    const boss = runFloor(last).entities.find((e) => e.kind === 'boss');
    if (!boss) throw new Error('boss');
    const w = winRunBattle({ ...s, dungeonRun: last }, { kind: 'boss', id: boss.id }, null);
    expect(w.save.storyFlags).toEqual([GRANT_BEATEN_FLAG]);
    // 2026-10-30（指示書 K）：ジオルのモンスターカードを受け取ったら並ぶ
    expect(availableGachaSeriesFor(w.save).map((s) => s.id)).toContain('geol');
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
