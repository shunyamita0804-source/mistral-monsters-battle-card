import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { cardCatalog, getSkill, MONSTERS, QA_MONSTERS, SKILLS, skillsOf } from '../src/data/cards.ts';
import pukarimJson from '../src/data/official/pukarim14_skills_DRAFT_20261028.json';
import {
  PUKARIM_COLOR,
  PUKARIM_GACHA_RARE,
  PUKARIM_MONSTER,
  PUKARIM_MONSTER_ID,
  PUKARIM_PLAYTEST_16,
  PUKARIM_SKILLS,
  pukarimSkillId,
} from '../src/data/pukarim.ts';
import { soramoSkillId } from '../src/data/soramo.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, attackPower, cardUsability, createBattle, targetsFor, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { INITIAL_DISTRIBUTION } from '../src/game/deck/deck.ts';
import { createNewGameSave } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/**
 * プカリム（2026-10-28 試遊中。新モンスター制作の手順 4。指示書 design-parts/cards-original/pukarim/00_instructions_for_claude_code.txt）
 * 細かい裁定は docs/battle-rules.md「プカリム（試遊中）」
 */

const puk = (n: number): string => pukarimSkillId(n);
const sor = (n: number): string => soramoSkillId(n);
const ORIGINAL_DIR = 'design-parts/cards-original/pukarim';

function csvRows(path: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text.trim().split(/\r?\n/).slice(1).map((line) => line.split(','));
}

describe('プカリム：データ（届いた JSON・CSV を無改変で置き、ゲームはその JSON を読む）', () => {
  it('保管した JSON・CSV・バトル用の絵は ZIP の原本と同じバイト列', () => {
    expect(readFileSync('src/data/official/pukarim14_skills_DRAFT_20261028.json').equals(readFileSync(`${ORIGINAL_DIR}/data/pukarim14_skills_DRAFT_20261028.json`))).toBe(true);
    expect(readFileSync('src/data/official/pukarim14_skills_DRAFT_20261028.csv').equals(readFileSync(`${ORIGINAL_DIR}/data/pukarim14_skills_DRAFT_20261028.csv`))).toBe(true);
    expect(readFileSync('assets/images/cards/monsters/pukarim_battlecard.png').equals(readFileSync(`${ORIGINAL_DIR}/art/pukarim_battleart.png`))).toBe(true);
  });

  it('CSV の14行・JSON・ゲームのカードで、番号・名前・分類・マナ・ダメージ・効果がすべて一致する', () => {
    const CATEGORY = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' } as const;
    const rows = csvRows('src/data/official/pukarim14_skills_DRAFT_20261028.csv');
    expect(rows).toHaveLength(14);
    rows.forEach(([no, name, cat, mana, damage, effect, slot], i) => {
      const skill = PUKARIM_SKILLS[i];
      const json = pukarimJson.skills[i];
      if (!skill || !json) throw new Error(String(i));
      expect(Number(no)).toBe(i + 1);
      expect(skill.id).toBe(puk(i + 1));
      expect(json.id).toBe(skill.id);
      expect([skill.name, json.name]).toEqual([name, name]);
      expect(skill.category).toBe(CATEGORY[cat as keyof typeof CATEGORY]);
      expect(skill.cost).toBe(Number(mana));
      expect(skill.stat?.value ?? 'なし').toBe(damage === 'なし' ? 'なし' : Number(damage));
      expect(skill.effectTextJa ?? 'なし').toBe(effect);
      expect(json.gacha_slot).toBe(slot);
    });
  });

  it('モンスター：ライフ6・色ミント・ID mon-pukarim。ガチャのレアの枠は 7 ぷはーっ・14 ぷかぷか', () => {
    expect(PUKARIM_MONSTER).toMatchObject({ id: 'mon-pukarim', life: 6, name: 'プカリム' });
    expect(PUKARIM_COLOR).toBe('#A8DCC4');
    expect(PUKARIM_GACHA_RARE).toEqual([puk(7), puk(14)]);
    expect(BATTLE_CARDS[PUKARIM_MONSTER_ID]?.frame).toBe('pukarim');
    expect(existsSync('assets/images/ui/battlecard/frame_pukarim.png')).toBe(true);
    for (const size of ['normal', 'hand']) expect(existsSync(`assets/images/ui/skillcard_simple/frame_${size}_pukarim.webp`)).toBe(true);
  });

  it('ふつうに遊んでいる人には出ない：カードの一覧・初期配布・新しいセーブには入らない（台帳と適合技にはある）', () => {
    expect(MONSTERS.some((m) => m.id === PUKARIM_MONSTER_ID)).toBe(false);
    expect(SKILLS.some((s) => s.monsterId === PUKARIM_MONSTER_ID)).toBe(false);
    expect(INITIAL_DISTRIBUTION.some((d) => d.monsterId === PUKARIM_MONSTER_ID)).toBe(false);
    expect(Object.keys(createNewGameSave().collection).some((id) => id.includes('pukarim'))).toBe(false);
    expect(QA_MONSTERS.map((m) => m.id)).toEqual([PUKARIM_MONSTER_ID]);
    expect(cardCatalog.get(PUKARIM_MONSTER_ID)?.kind).toBe('monster');
    expect(skillsOf(PUKARIM_MONSTER_ID).map((s) => s.id)).toEqual(PUKARIM_SKILLS.map((s) => s.id));
  });

  it('試遊用の16枚（Claude の仮）：14種から、同じカード3枚まで、16枚。7・9・10 を入れる', () => {
    expect(PUKARIM_PLAYTEST_16.reduce((n, c) => n + c.copies, 0)).toBe(16);
    expect(PUKARIM_PLAYTEST_16.every((c) => c.copies >= 1 && c.copies <= 3 && skillsOf(PUKARIM_MONSTER_ID).some((s) => s.id === c.id))).toBe(true);
    for (const n of [7, 9, 10]) expect(PUKARIM_PLAYTEST_16.some((c) => c.id === puk(n))).toBe(true);
  });

  it('英語の名前（仮訳）', () => {
    setLanguage('en');
    expect(cardName(PUKARIM_MONSTER_ID)).toBe('Pukarim');
    expect(cardName(puk(9))).toBe('Puff Cheeks');
    setLanguage('ja');
  });
});

/* ---------- バトル ---------- */

// 自分：プカリム（p-m1 ライフ6）・ソラモ（p-m2）・ラズック（p-m3）。相手も同じ
const deck = { monsters: ['mon-pukarim', 'mon-soramo', 'mon-lazuck'], skills: Array.from({ length: 60 }, () => sor(1)) };

function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}, active: Side = 'player'): BattleState {
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

/** 次の自分の手番の攻撃のはじめへ（相手は何もしない） */
function nextOwnTurn(s: BattleState, hand: string[] = []): BattleState {
  let x = applyAction(applyAction(s, { type: 'endAttack', side: 'player' }), { type: 'endTurn', side: 'player' });
  x = applyAction(applyAction(x, { type: 'endAttack', side: 'opponent' }), { type: 'endTurn', side: 'opponent' });
  expect(x.active).toBe('player');
  return { ...x, phase: 'main', sides: { ...x.sides, player: { ...x.sides.player, hand: hand.map((cardId, i) => ({ uid: `n${i}`, cardId })) } } };
}

/** player の攻撃（uid の手札）を o-m2（ソラモ・ライフ7）へ。相手は guards を順に使い、終える */
function attack(s0: BattleState, cardUid: string, guards: string[] = [], target = 'o-m2'): BattleState {
  const handBefore = s0.sides.opponent.hand.length;
  let s: BattleState = { ...s0, sides: { ...s0.sides, opponent: { ...s0.sides.opponent, hand: [...s0.sides.opponent.hand, ...guards.map((cardId, i) => ({ uid: `g${i}`, cardId }))] } } };
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid, targetUid: target });
  expect(s.phase).toBe('defense');
  guards.forEach((_, i) => {
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: `g${i}` });
  });
  if (s.phase === 'defense') s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
  expect(s.sides.opponent.hand.length).toBeGreaterThanOrEqual(handBefore);
  return s;
}

const SORAMO_LIFE = 7;

describe('09 ほっぺにためる：プカリムの次の攻撃技のダメージ＋2', () => {
  it('ためると次の攻撃が＋2。使うまで続き（ターンをまたいでも消えない）、使ったら消える', () => {
    let s = applyAction(scene({ player: [puk(9)] }), { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(monster(s, 'p-m1').charge).toBe(2);
    expect(s.log.at(-1)?.text).toBe('プカリムはほっぺに空気をためた。次の攻撃技のダメージ＋2。');
    s = nextOwnTurn(s, [puk(3), puk(3)]);
    expect(monster(s, 'p-m1').charge).toBe(2);
    expect(attackPower(s, getSkill(puk(3)), monster(s, 'p-m1'))).toBe(4);
    s = attack(s, 'n0');
    expect(monster(s, 'o-m2').life).toBe(SORAMO_LIFE - 4);
    expect(monster(s, 'p-m1').charge ?? null).toBeNull();
  });

  it('重ねられない：2回ためても＋2のまま', () => {
    let s = applyAction(scene({ player: [puk(9)] }), { type: 'useCard', side: 'player', cardUid: 'p0' });
    s = nextOwnTurn(s, [puk(9)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'n0' });
    expect(monster(s, 'p-m1').charge).toBe(2);
    expect(attackPower(s, getSkill(puk(8)), monster(s, 'p-m1'))).toBe(7);
  });

  it('守られても・回避されても消える（ためた分はなくなる）', () => {
    const charged = withMonster(scene({ player: [puk(3)] }), 'p-m1', { charge: 2 });
    const guarded = attack(charged, 'p0', [sor(11)]);
    expect(monster(guarded, 'p-m1').charge ?? null).toBeNull();
    const evaded = attack(withMonster(scene({ player: [puk(1)] }), 'p-m1', { charge: 2 }), 'p0', [sor(14)]);
    expect(monster(evaded, 'p-m1').charge ?? null).toBeNull();
  });

  it('プカリムが倒れたら消える', () => {
    let s = withMonster(scene({ opponent: [sor(8)] }, {}, 'opponent'), 'p-m1', { charge: 2, life: 1 });
    s = applyAction(s, { type: 'useCard', side: 'opponent', cardUid: 'o0', targetUid: 'p-m1' });
    s = applyAction(s, { type: 'defend', side: 'player', cardUid: null });
    expect(monster(s, 'p-m1').life).toBe(0);
    expect(monster(s, 'p-m1').charge ?? null).toBeNull();
  });

  it('ためてから「おおつむじ」で 5＋2＝7（ソラモを1回で倒せる）', () => {
    const s = attack(withMonster(scene({ player: [puk(8)] }), 'p-m1', { charge: 2 }), 'p0');
    expect(monster(s, 'o-m2').life).toBe(0);
  });
});

describe('07 ぷはーっ：ためているときは回避されない', () => {
  it('ためているとき：回避のカードは使えない。防御の軽減はふつうに受ける（3＋2−2＝3）', () => {
    let s = withMonster(scene({ player: [puk(7)], opponent: [sor(14), puk(12)] }), 'p-m1', { charge: 2 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(s.pending?.undodgeable).toBe(true);
    expect(s.pending?.power).toBe(5);
    expect(s.log.at(-1)?.text).toBe('プカリムはためた空気をいっきに吐き出した！ この攻撃は回避されない！');
    // o-m1 は相手のプカリム：ぷかぷか（14）は使えず、くうきのクッション（12）は使える
    const withEvade = { ...s, sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: [{ uid: 'e', cardId: puk(14) }, { uid: 'd', cardId: puk(12) }] } } };
    expect(cardUsability(withEvade, 'opponent', 'e')).toMatchObject({ usable: false });
    expect(cardUsability(withEvade, 'opponent', 'd').usable).toBe(true);
    let after = applyAction(withEvade, { type: 'defend', side: 'opponent', cardUid: 'd' });
    after = applyAction(after, { type: 'defend', side: 'opponent', cardUid: null });
    expect(monster(after, 'o-m1').life).toBe(6 - 3);
  });

  it('ためていないとき：ふつうの 3 ダメージで、回避できる', () => {
    let s = applyAction(scene({ player: [puk(7)], opponent: [puk(14)] }), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(s.pending?.undodgeable ?? false).toBe(false);
    expect(s.pending?.power).toBe(3);
    expect(cardUsability(s, 'opponent', 'o0').usable).toBe(true);
    s = applyAction(applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'o0' }), { type: 'defend', side: 'opponent', cardUid: null });
    expect(monster(s, 'o-m1').life).toBe(6);
  });
});

describe('10 おいかぜ：プカリム以外の味方1体の、次の自分のターンの攻撃技のダメージ＋1', () => {
  it('選べるのはプカリム以外の、生きている味方', () => {
    const s = scene({ player: [puk(10)] });
    expect(targetsFor(s, 'player', getSkill(puk(10))).map((m) => m.uid)).toEqual(['p-m2', 'p-m3']);
    const none = withMonster(withMonster(s, 'p-m2', { life: 0 }), 'p-m3', { life: 0 });
    expect(cardUsability(none, 'player', 'p0')).toMatchObject({ usable: false, reason: 'おいかぜをかけられる味方がいません' });
  });

  it('かけた同じ手番には効かない。次の自分のターンの攻撃だけ＋1（2026-10-29 カードの文のとおり）', () => {
    let s = applyAction(scene({ player: [puk(10), sor(1)] }), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'p-m2' });
    expect(monster(s, 'p-m2').tailwind).toEqual({ amount: 1, turn: s.turn + 2 });
    expect(s.log.at(-1)?.text).toBe('ソラモにおいかぜ。次のターンの攻撃技のダメージ＋1。');
    const base = getSkill(sor(1)).stat?.value ?? 0;
    // 同じ手番：まだ動いていないソラモが攻撃しても＋1 にならず、おいかぜは残る
    expect(attackPower(s, getSkill(sor(1)), monster(s, 'p-m2'))).toBe(base);
    s = attack(s, 'p1');
    expect(monster(s, 'o-m2').life).toBe(SORAMO_LIFE - base);
    expect(monster(s, 'p-m2').tailwind).toEqual({ amount: 1, turn: s.turn + 2 });
    // 次の自分のターン：＋1
    s = nextOwnTurn(s, [sor(1)]);
    expect(attackPower(s, getSkill(sor(1)), monster(s, 'p-m2'))).toBe(base + 1);
    s = attack(s, 'n0');
    expect(monster(s, 'o-m2').life).toBe(SORAMO_LIFE - base - (base + 1));
  });

  it('おいかぜは1回：次のターンに攻撃技を1回使ったら消える', () => {
    let s = applyAction(scene({ player: [puk(10)] }), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'p-m2' });
    s = nextOwnTurn(s, [sor(1)]);
    s = attack(s, 'n0');
    expect(monster(s, 'p-m2').tailwind ?? null).toBeNull();
    expect(attackPower(s, getSkill(sor(1)), monster(s, 'p-m2'))).toBe(getSkill(sor(1)).stat?.value ?? 0);
  });

  it('使わなければ、次の自分のターンが終わったら消える（印もそのターンまで）', () => {
    const lazuck = getSkill('skl-lazuck-01');
    const base = lazuck.stat?.value ?? 0;
    let s = applyAction(scene({ player: [puk(10)] }), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'p-m3' });
    const w = monster(s, 'p-m3').tailwind;
    // 相手の手番：効かない（印は出したまま：w.turn >= いまの手番）
    const opp = applyAction(applyAction(s, { type: 'endAttack', side: 'player' }), { type: 'endTurn', side: 'player' });
    expect(attackPower(opp, lazuck, monster(opp, 'p-m3'))).toBe(base);
    expect((w?.turn ?? 0) >= opp.turn).toBe(true);
    s = nextOwnTurn(s, [sor(1)]);
    expect(attackPower(s, lazuck, monster(s, 'p-m3'))).toBe(base + 1);
    s = nextOwnTurn(s);
    expect(attackPower(s, lazuck, monster(s, 'p-m3'))).toBe(base);
    expect((w?.turn ?? 0) >= s.turn).toBe(false);
  });
});

describe('相手の CPU：おいかぜは「次の自分のターンに攻撃できそうな味方」にかける（2026-10-29 ユーザー指示）', () => {
  it('この手番にもう動いた味方でも、攻撃技が手札にあり次のターンに払えそうならかける', () => {
    const s = withMonster(scene({ player: [puk(10), sor(3), puk(11)] }, { player: 3 }), 'p-m2', { acted: true });
    expect(chooseAction(s, 'player')).toMatchObject({ type: 'useCard', cardUid: 'p0', targetUid: 'p-m2' });
  });

  it('味方の攻撃技が手札に無いときはかけない', () => {
    const s = scene({ player: [puk(10), puk(11), puk(12)] }, { player: 5 });
    expect(chooseAction(s, 'player')).not.toMatchObject({ cardUid: 'p0' });
  });

  it('次のターンにもマナが足りなさそうな攻撃技しか無いときはかけない', () => {
    // マナ2：おいかぜを払うと0。残りの手札は1枚（マナにできても1）で、ラズックの 06（マナ4）は払えない
    const s = scene({ player: [puk(10), 'skl-lazuck-06'] }, { player: 2 });
    expect(chooseAction(s, 'player')).not.toMatchObject({ cardUid: 'p0' });
  });

  it('次のターンのおいかぜがもうかかっている味方にはかけない', () => {
    const s0 = scene({ player: [puk(10), sor(3), puk(11)] }, { player: 3 });
    const s = withMonster(s0, 'p-m2', { acted: true, tailwind: { amount: 1, turn: s0.turn + 2 } });
    expect(chooseAction(s, 'player')).not.toMatchObject({ cardUid: 'p0' });
  });
});

describe('相手の CPU：ためてから大きな攻撃', () => {
  it('その手番に倒せないときは、ほっぺにためる。ためたら次の手番に攻撃する', () => {
    // 相手はどれもライフ6以上（おおつむじ 5 では倒せない）
    let s = withMonster(scene({ player: [puk(9), puk(8)] }, { player: 6 }), 'o-m3', { life: 6 });
    const first = chooseAction(s, 'player');
    expect(first).toMatchObject({ type: 'useCard', cardUid: 'p0' });
    if (!first) throw new Error('行動なし');
    s = applyAction(s, first);
    expect(monster(s, 'p-m1').charge).toBe(2);
    s = nextOwnTurn(s, [puk(8)]);
    const second = chooseAction(s, 'player');
    expect(second).toMatchObject({ type: 'useCard', cardUid: 'n0' });
  });
});

describe('確認用の画面の入口', () => {
  it('?lab=pukarim で直接開けるのは ?qa=1 のときだけ', async () => {
    const { initialScreen } = await import('../src/ui/app.ts');
    expect(initialScreen(true, '?qa=1&lab=pukarim')).toBe('pukarimLab');
    expect(initialScreen(false, '?lab=pukarim')).toBe('title');
    expect(initialScreen(true, '?qa=1')).toBe('title');
  });
});
