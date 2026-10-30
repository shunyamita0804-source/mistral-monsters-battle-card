import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { getSkill, MONSTERS, SKILLS } from '../src/data/cards.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import tsumujiJson from '../src/data/official/tsumuji14_skills_OFFICIAL_20261030.json';
import { SKILL_CARD_TEXT } from '../src/data/skillCardText.ts';
import { soramoSkillId } from '../src/data/soramo.ts';
import { TSUMUJI_COLOR, TSUMUJI_GACHA_RARE, TSUMUJI_MONSTER, TSUMUJI_MONSTER_ID, TSUMUJI_SKILLS, tsumujiSkillId } from '../src/data/tsumuji.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, cardUsability, createBattle, handSkillCost, manaOf, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { seriesLineup } from '../src/game/economy/gachaSeries.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/**
 * ツムジ（2026-10-30 指示書 U「風の渓谷とツムジ」。design-parts/cards-original/tsumuji/00_instructions_for_claude_code.txt）。
 * 細かい裁定は docs/battle-rules.md「ツムジの効果の扱い」。風の渓谷・ゼフィラ・入手の流れは tests/windValley.test.ts
 */

const tsu = (n: number): string => tsumujiSkillId(n);
const sor = (n: number): string => soramoSkillId(n);
const ORIGINAL_DIR = 'design-parts/cards-original/tsumuji';

function csvRows(path: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text.trim().split(/\r?\n/).slice(1).map((line) => line.split(','));
}

describe('ツムジ：データ（届いた JSON・CSV を無改変で置き、ゲームはその JSON を読む）', () => {
  it('保管した JSON・CSV・バトル用の絵は ZIP の原本と同じバイト列', () => {
    for (const f of ['tsumuji14_skills_OFFICIAL_20261030.json', 'tsumuji14_skills_OFFICIAL_20261030.csv']) {
      expect(readFileSync(`src/data/official/${f}`).equals(readFileSync(`${ORIGINAL_DIR}/${f}`)), f).toBe(true);
    }
    expect(readFileSync('assets/images/cards/monsters/tsumuji_battlecard.png').equals(readFileSync(`${ORIGINAL_DIR}/tsumuji_battleart.png`))).toBe(true);
  });

  it('CSV の14行・JSON・ゲームのカードで、番号・名前・分類・マナ・ダメージ・効果がすべて一致する', () => {
    const CATEGORY = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' } as const;
    const rows = csvRows('src/data/official/tsumuji14_skills_OFFICIAL_20261030.csv');
    expect(rows).toHaveLength(14);
    rows.forEach((row, i) => {
      const skill = TSUMUJI_SKILLS[i];
      const json = tsumujiJson.skills[i];
      if (!skill || !json) throw new Error(String(i));
      expect(row).toContain(json.name);
      expect(row).toContain(json.category);
      expect(row).toContain(String(json.mana));
      expect(skill.id).toBe(tsu(i + 1));
      expect(json.id).toBe(skill.id);
      expect(skill.name).toBe(json.name);
      expect(skill.category).toBe(CATEGORY[json.category as keyof typeof CATEGORY]);
      expect(skill.cost).toBe(json.mana);
      expect(skill.stat?.value ?? '―').toBe(json.damage === '―' ? '―' : Number(json.damage));
      expect(skill.effectTextJa ?? 'なし').toBe(SKILL_CARD_TEXT[skill.id] ?? json.effect);
    });
  });

  it('技8の名前は「かぜのり」（プカリムの「おいかぜ」とは別の技）', () => {
    expect(getSkill(tsu(8)).name).toBe('かぜのり');
    expect(getSkill(tsu(8)).effect.type).toBe('windRide');
    expect(SKILLS.find((s) => s.name === 'おいかぜ')?.monsterId).toBe('mon-pukarim');
  });

  it('カードに書く短い文（指示書の表のとおり）。JSON の文は変えない', () => {
    expect(getSkill(tsu(2)).effectTextJa).toBe('同じターンに、もう1枚の「Wひっかき」を続けて使える');
    expect(getSkill(tsu(4)).effectTextJa).toBe('回避されない');
    expect(getSkill(tsu(8)).effectTextJa).toBe('次のターン、ツムジの攻撃技のマナ−1');
    expect(getSkill(tsu(11)).effectTextJa).toBe('ちから技・かしこさ技に効く');
    expect(getSkill(tsu(14)).effectTextJa).toBe('ちから技・かしこさ技を、消費マナに関係なく回避');
    expect(tsumujiJson.skills[7]?.effect).toBe('次の自分のターン、ツムジの攻撃技の消費マナを1減らす（0より下にはならない・重ねられない）');
  });

  it('モンスター：ライフ6・くすんだ青みの灰・ID mon-tsumuji。レアの枠は 03・10・14。枠の絵がある', () => {
    expect(TSUMUJI_MONSTER).toMatchObject({ id: 'mon-tsumuji', life: 6, name: 'ツムジ', isPlaceholder: false });
    expect(TSUMUJI_COLOR).toBe('#8FA3B8');
    expect(TSUMUJI_GACHA_RARE).toEqual([tsu(3), tsu(10), tsu(14)]);
    expect(BATTLE_CARDS[TSUMUJI_MONSTER_ID]?.frame).toBe('tsumuji');
    expect(existsSync('assets/images/ui/battlecard/frame_tsumuji.png')).toBe(true);
    for (const size of ['normal', 'hand']) expect(existsSync(`assets/images/ui/skillcard_simple/frame_${size}_tsumuji.webp`)).toBe(true);
  });

  it('ふつうの一覧に入り、図鑑の番号はセレフィーンのあと（No.151〜165）', () => {
    expect(MONSTERS.some((m) => m.id === TSUMUJI_MONSTER_ID)).toBe(true);
    expect(SKILLS.filter((s) => s.monsterId === TSUMUJI_MONSTER_ID).map((s) => s.id)).toEqual(TSUMUJI_SKILLS.map((s) => s.id));
    const book = cardBookEntries();
    expect(book.find((e) => e.card.id === TSUMUJI_MONSTER_ID)?.no).toBe(151);
    expect(book.find((e) => e.card.id === tsu(14))?.no).toBe(165);
    expect(book.find((e) => e.card.id === 'skl-serephine-14')?.no).toBe(150);
  });

  it('絵：技14枚・正式モンスターカード。原本は無改変で保管（パック・ショップの原本も）', () => {
    for (let n = 1; n <= 14; n++) {
      const nn = String(n).padStart(2, '0');
      expect(getSkill(tsu(n)).art?.file).toBe(`tsumuji_sk_${nn}.webp`);
      expect(existsSync(`assets/images/cards/skills/tsumuji_sk_${nn}.webp`)).toBe(true);
      expect(existsSync(`${ORIGINAL_DIR}/tsumuji_sk_${nn}.png`)).toBe(true);
    }
    expect(TSUMUJI_MONSTER.art?.file).toBe('tsumuji_official.webp');
    expect(existsSync('assets/images/cards/monsters/tsumuji_official.webp')).toBe(true);
    const originals = ['tsumuji_official_monstercard_LIFE6.png', 'tsumuji_original_approved.png', 'tsumuji_3view_approved.png', 'pack_tsumuji.png', 'pack_art_tsumuji.png', 'shop_pack_tsumuji.png', 'shop_card_tsumuji.png'];
    for (const f of originals) expect(existsSync(`${ORIGINAL_DIR}/${f}`), f).toBe(true);
    expect(readFileSync('design-parts/gacha-20261029/art/pack_tsumuji.png').equals(readFileSync(`${ORIGINAL_DIR}/pack_tsumuji.png`))).toBe(true);
    expect(readFileSync('design-parts/gacha-20261029/pack_art/pack_art_tsumuji.png').equals(readFileSync(`${ORIGINAL_DIR}/pack_art_tsumuji.png`))).toBe(true);
    for (const k of ['pack', 'card']) {
      expect(readFileSync(`design-parts/gacha-20261029/shop/shop_${k}_tsumuji.png`).equals(readFileSync(`${ORIGINAL_DIR}/shop_${k}_tsumuji.png`))).toBe(true);
    }
    expect(existsSync('assets/images/ui/gacha/pack_tsumuji.webp')).toBe(true);
    expect(existsSync('assets/images/ui/gacha/panel_tsumuji.webp')).toBe(true);
  });

  it('英語の名前（仮訳）', () => {
    setLanguage('en');
    try {
      expect(cardName(TSUMUJI_MONSTER_ID)).toBe('Tsumuji');
      expect(cardName(tsu(2))).toBe('Double Scratch');
      expect(cardName(tsu(8))).toBe('Wind Ride');
    } finally {
      setLanguage('ja');
    }
  });
});

// 自分：ツムジ（p-m1 ライフ6）・ソラモ（p-m2 ライフ7）・ノビトン（p-m3 ライフ8）。相手も同じ（o-m1〜3）
const MONS = ['mon-tsumuji', 'mon-soramo', 'mon-nobiton'];

function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}, active: Side = 'player', turn = 3): BattleState {
  const deck = { monsters: [...MONS], skills: Array.from({ length: 60 }, () => sor(1)) };
  const s = createBattle({ name: 'P', deck }, { name: 'O', deck }, 11, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 10 }, () => sor(1)),
    deck: Array.from({ length: 40 }, () => sor(2)),
  });
  return { ...s, turn, phase: 'main', active, manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
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

const giveOpponent = (s: BattleState, cards: string[]): BattleState => ({
  ...s,
  sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: [...s.sides.opponent.hand, ...cards.map((cardId, i) => ({ uid: `g${i}`, cardId }))] } },
});

/** 守りを出さずに攻撃を受ける（守り待ちなら「守らない」） */
const noGuard = (s: BattleState, side: Side = 'opponent'): BattleState => (s.phase === 'defense' ? applyAction(s, { type: 'defend', side, cardUid: null }) : s);

/** 手札の uid のカードを使う（攻撃は target へ） */
const use = (s: BattleState, cardUid: string, targetUid?: string, side: Side = 'player'): BattleState =>
  noGuard(applyAction(s, { type: 'useCard', side, cardUid, ...(targetUid ? { targetUid } : {}) }), side === 'player' ? 'opponent' : 'player');

/** 次の自分の手番まで進める（相手の手番は何もしない） */
function nextOwnTurn(s: BattleState): BattleState {
  let x = applyAction({ ...s, phase: 'mana' }, { type: 'endTurn', side: s.active });
  x = applyAction({ ...x, phase: 'mana' }, { type: 'endTurn', side: x.active });
  return x;
}

describe('02 Wひっかき：同じターンにもう1枚を続けて使える（1ターンに最大2回）', () => {
  it('1枚目のあと、手札のもう1枚の Wひっかき を続けて使える。2枚目もマナ1を払い、相手は選び直してよい', () => {
    let s = scene({ player: [tsu(2), tsu(2)] }, { player: 5 });
    s = use(s, 'p0', 'o-m1');
    expect(monster(s, 'o-m1').life).toBe(5);
    expect(manaOf(s.sides.player)).toBe(4);
    expect(monster(s, 'p-m1').acted).toBe(true);
    expect(cardUsability(s, 'player', 'p1').usable).toBe(true);
    s = use(s, 'p1', 'o-m2');
    expect(monster(s, 'o-m2').life).toBe(6);
    expect(manaOf(s.sides.player)).toBe(3);
  });

  it('3枚目は使えない（1ターンに2回まで）', () => {
    let s = scene({ player: [tsu(2), tsu(2), tsu(2)] }, { player: 5 });
    s = use(s, 'p0', 'o-m1');
    s = use(s, 'p1', 'o-m1');
    expect(cardUsability(s, 'player', 'p2').usable).toBe(false);
    expect(applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p2', targetUid: 'o-m1' })).toBe(s);
  });

  it('Wひっかき のあとにほかの技は使えない。ほかの技のあとに Wひっかき も使えない（今の決まりどおり）', () => {
    let s = scene({ player: [tsu(2), tsu(1), tsu(2)] }, { player: 5 });
    s = use(s, 'p0', 'o-m1');
    expect(cardUsability(s, 'player', 'p1').usable).toBe(false);
    let t = scene({ player: [tsu(1), tsu(2)] }, { player: 5 });
    t = use(t, 'p0', 'o-m1');
    expect(cardUsability(t, 'player', 'p1').usable).toBe(false);
  });

  it('2枚目はマナが足りないと使えない。使わずにターンを進めてもよく、次のターンには続きは残らない', () => {
    let s = scene({ player: [tsu(2), tsu(2)] }, { player: 1 });
    s = use(s, 'p0', 'o-m1');
    expect(manaOf(s.sides.player)).toBe(0);
    expect(cardUsability(s, 'player', 'p1').usable).toBe(false);
    s = nextOwnTurn({ ...s, sides: { ...s.sides, player: { ...s.sides.player, manaPile: [sor(1), sor(1), sor(1)] } } });
    expect(monster(s, 'p-m1').chain ?? null).not.toMatchObject({ turn: s.turn });
    // 次のターンはまた1枚目から（2回まで）
    const hand = s.sides.player.hand.find((c) => c.cardId === tsu(2));
    expect(hand && cardUsability(s, 'player', hand.uid).usable).toBe(true);
  });

  it('回避されても・防御されても、2枚目は使える（1枚目を使ったことで決まる）', () => {
    let s = giveOpponent(scene({ player: [tsu(2), tsu(2)] }, { player: 5 }), [tsu(12)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g0' });
    s = noGuard(s);
    expect(monster(s, 'o-m1').life).toBe(6);
    expect(cardUsability(s, 'player', 'p1').usable).toBe(true);
  });

  it('相手（CPU）も2枚あってマナ2以上なら2回続けて使う', () => {
    let s = scene({ opponent: [tsu(2), tsu(2), tsu(5)] }, { opponent: 2 }, 'opponent');
    const first = chooseAction(s, 'opponent');
    expect(first).toMatchObject({ type: 'useCard', cardUid: 'o0', userUid: 'o-m1' });
    if (!first) throw new Error('first');
    s = noGuard(applyAction(s, first), 'player');
    const second = chooseAction(s, 'opponent');
    expect(second).toMatchObject({ type: 'useCard', cardUid: 'o1', userUid: 'o-m1' });
    if (!second) throw new Error('second');
    s = noGuard(applyAction(s, second), 'player');
    expect(manaOf(s.sides.opponent)).toBe(0);
  });

  it('CPU：1枚だけのときは、ふつうの攻撃と同じ考え方（大きい攻撃を先に）', () => {
    const s = scene({ opponent: [tsu(2), tsu(5)] }, { opponent: 3 }, 'opponent');
    expect(chooseAction(s, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o1' });
  });
});

describe('08 かぜのり：次の自分のターン、ツムジの攻撃技の消費マナ−1', () => {
  it('使ったターンは下がらず、次の自分のターンだけ −1。その次のターンには消える', () => {
    let s = scene({ player: [tsu(8), tsu(5)] }, { player: 1 });
    s = use(s, 'p0');
    expect(monster(s, 'p-m1').windRide).toEqual({ discount: 1, turn: s.turn + 2 });
    expect(handSkillCost(s, 'player', getSkill(tsu(5)))).toBe(2);
    s = nextOwnTurn(s);
    expect(handSkillCost(s, 'player', getSkill(tsu(5)))).toBe(1);
    // マナ1で とびかかる（マナ2）が使える
    const s1 = { ...s, sides: { ...s.sides, player: { ...s.sides.player, manaPile: [sor(1)] } } };
    const card = s1.sides.player.hand.find((c) => c.cardId === tsu(5));
    if (!card) throw new Error('card');
    expect(cardUsability(s1, 'player', card.uid).usable).toBe(true);
    const after = use(s1, card.uid, 'o-m2');
    expect(manaOf(after.sides.player)).toBe(0);
    expect(monster(after, 'o-m2').life).toBe(5);
    // その次の自分のターン：もとのマナに戻る
    expect(handSkillCost(nextOwnTurn(after), 'player', getSkill(tsu(5)))).toBe(2);
  });

  it('0より下にはならない（ひっかく：マナ0のまま）。守り・特殊の技は下がらない', () => {
    const s = withMonster(scene({ player: [tsu(1), tsu(11), tsu(8)] }), 'p-m1', { windRide: { discount: 1, turn: 3 } });
    expect(handSkillCost(s, 'player', getSkill(tsu(1)))).toBe(0);
    expect(handSkillCost(s, 'player', getSkill(tsu(11)))).toBe(2);
    expect(handSkillCost(s, 'player', getSkill(tsu(8)))).toBe(0);
  });

  it('重ならない（2回使っても −1 のまま）', () => {
    let s = withMonster(scene({ player: [tsu(8), tsu(10)] }), 'p-m1', { windRide: { discount: 1, turn: 3 } });
    s = use(s, 'p0');
    expect(monster(s, 'p-m1').windRide).toEqual({ discount: 1, turn: 5 });
    s = nextOwnTurn(s);
    expect(handSkillCost(s, 'player', getSkill(tsu(10)))).toBe(4);
  });

  it('Wひっかき は1枚目も2枚目も −1（マナ0）', () => {
    let s = withMonster(scene({ player: [tsu(2), tsu(2)] }, { player: 0 }), 'p-m1', { windRide: { discount: 1, turn: 3 } });
    expect(cardUsability(s, 'player', 'p0').usable).toBe(true);
    s = use(s, 'p0', 'o-m1');
    expect(cardUsability(s, 'player', 'p1').usable).toBe(true);
    s = use(s, 'p1', 'o-m1');
    expect(monster(s, 'o-m1').life).toBe(4);
    expect(manaOf(s.sides.player)).toBe(0);
  });

  it('倒れたら消える。ほかのモンスターの攻撃技は下がらない', () => {
    const s = withMonster(scene({ player: [sor(5)] }), 'p-m1', { windRide: { discount: 1, turn: 3 } });
    expect(handSkillCost(s, 'player', getSkill(sor(5)))).toBe(getSkill(sor(5)).cost);
    const down = withMonster(s, 'p-m1', { life: 0 });
    expect(handSkillCost(down, 'player', getSkill(tsu(5)))).toBe(2);
  });

  it('CPU：倒せる攻撃が無く、手札にツムジの攻撃技（マナ1以上）があるときに使う。効いている間は大きい攻撃を先に', () => {
    const s = scene({ opponent: [tsu(8), tsu(10)] }, { opponent: 1 }, 'opponent');
    expect(chooseAction(s, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o0', userUid: 'o-m1' });
    // 倒せる相手がいれば使わない
    const kill = withMonster(scene({ opponent: [tsu(8), tsu(1)] }, { opponent: 1 }, 'opponent'), 'p-m2', { life: 1 });
    expect(chooseAction(kill, 'opponent')).not.toMatchObject({ cardUid: 'o0' });
    // ツムジの攻撃技（マナ1以上）が無ければ使わない
    const none = scene({ opponent: [tsu(8), tsu(1)] }, { opponent: 0 }, 'opponent');
    expect(chooseAction(none, 'opponent')).not.toMatchObject({ cardUid: 'o0' });
    // 効いている間：マナ4でストームブレイド（マナ5→4）を先に
    const ridden = withMonster(scene({ opponent: [tsu(6), tsu(10)] }, { opponent: 4 }, 'opponent'), 'o-m1', { windRide: { discount: 1, turn: 3 } });
    expect(chooseAction(ridden, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o1', userUid: 'o-m1' });
  });
});

/** 自分の attack（手札 p0）を相手 target に。相手は guard を出そうとする（出せるかを返す） */
function guardAgainst(attack: string, guard: string, target = 'o-m1'): { usable: boolean; s: BattleState } {
  let s = giveOpponent(scene({ player: [attack] }), [guard]);
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: target });
  return { usable: cardUsability(s, 'opponent', 'g0').usable, s };
}

describe('04 つむじかぜ：回避されない（防御はできる）', () => {
  it('どの回避でも避けられない。防御は使える', () => {
    expect(getSkill(tsu(4)).effect).toEqual({ type: 'attack', undodgeable: true });
    expect(guardAgainst(tsu(4), tsu(13)).usable).toBe(false);
    expect(guardAgainst(tsu(4), tsu(14)).usable).toBe(false);
    expect(guardAgainst(tsu(4), tsu(11)).usable).toBe(true);
    expect(guardAgainst(tsu(4), sor(14), 'o-m2').usable).toBe(false);
  });
});

describe('14 かぜよみ：ちから技・かしこさ技を、消費マナに関係なく回避', () => {
  it('マナ0・マナ5のちから技も、かしこさ技も回避できる', () => {
    expect(getSkill(tsu(14)).effect).toEqual({ type: 'evade', against: 'all' });
    for (const atk of [tsu(1), tsu(10), tsu(3), tsu(9)]) {
      const r = guardAgainst(atk, tsu(14));
      expect(r.usable, atk).toBe(true);
      const s = noGuard(applyAction(r.s, { type: 'defend', side: 'opponent', cardUid: 'g0' }));
      expect(monster(s, 'o-m1').life, atk).toBe(6);
    }
  });

  it('12 ひらりとかわす：ちから技だけ。13 すりぬける：かしこさ技だけ。11 かぜのまく：両方 −2', () => {
    expect(guardAgainst(tsu(1), tsu(12)).usable).toBe(true);
    expect(guardAgainst(tsu(3), tsu(12)).usable).toBe(false);
    expect(guardAgainst(tsu(3), tsu(13)).usable).toBe(true);
    expect(guardAgainst(tsu(1), tsu(13)).usable).toBe(false);
    expect(getSkill(tsu(11)).effect).toEqual({ type: 'defense', reduce: 2, against: 'all' });
  });
});

describe('ツムジのガチャのシリーズ', () => {
  it('セレフィーンのあとに1行。レア枠はかまいたち・ストームブレイド・かぜよみ。zephyra-beaten', () => {
    const ids = GACHA_SERIES.map((s) => s.id);
    expect(ids.indexOf('tsumuji')).toBe(ids.indexOf('serephine') + 1);
    const series = GACHA_SERIES.find((s) => s.id === 'tsumuji');
    expect(series).toEqual({ id: 'tsumuji', monsterId: 'mon-tsumuji', rareSkillNames: ['かまいたち', 'ストームブレイド', 'かぜよみ'], unlockFlag: 'zephyra-beaten' });
    if (!series) throw new Error('series');
    const lineup = seriesLineup(series);
    expect(lineup.errors).toEqual([]);
    expect(lineup.rareIds).toEqual([tsu(3), tsu(10), tsu(14)]);
    expect(lineup.all).toHaveLength(15);
  });

  it('パックの色（pack_tint.py）・パックの絵（gacha_series_build.py）・ショップの棚（shop_goods_20261030.py）にツムジがある', () => {
    expect(readFileSync('tools/design/pack_tint.py', 'utf8')).toContain("'tsumuji': '#8FA3B8'");
    expect(readFileSync('tools/design/gacha_series_build.py', 'utf8')).toMatch(/PACKS = \[.*'tsumuji'.*\]/);
    expect(readFileSync('tools/design/shop_goods_20261030.py', 'utf8')).toMatch(/MONSTERS = \[.*'tsumuji'.*\]/);
  });
});
