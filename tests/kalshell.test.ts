import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { getSkill, MONSTERS, REMOVED_SKILL_IDS, SKILLS, skillsOf } from '../src/data/cards.ts';
import { PACKS } from '../src/data/economy.ts';
import { KALSHELL_COLOR, KALSHELL_MONSTER, KALSHELL_SKILLS, KALSHELL_STARTER, kalshellSkillId } from '../src/data/kalshell.ts';
import kalshellJson from '../src/data/official/kalshell14_skills_OFFICIAL_20261027.json';
import { soramoSkillId } from '../src/data/soramo.ts';
import { lazuckSkillId } from '../src/data/lazuck.ts';
import { AJ_SKILLS } from '../src/data/skillRebuildAJ.ts';
import { INITIAL_DISTRIBUTION } from '../src/game/deck/deck.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, cardUsability, createBattle, manaOf, targetsFor, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { skillCardFace } from '../src/game/cards/cardFace.ts';
import { getPlayCard } from '../src/data/cards.ts';
import { createNewSave } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

const kal = (n: number): string => kalshellSkillId(n);
const sor = (n: number): string => soramoSkillId(n);
/** 指示書 AJ の表のカルシェルの12枚（ゲームのカードの正本） */
const AJ = AJ_SKILLS['mon-kalshell'] ?? [];
const ORIGINAL_DIR = 'design-parts/cards-original/kalshell14-20261027';

/** 届いた CSV の行（BOM 付き・カンマ区切り。効果の文にカンマは無い） */
function csvRows(path: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text.trim().split(/\r?\n/).slice(1).map((line) => line.split(','));
}

describe('カルシェル正式14技：データ（2026-10-27。届いた JSON・CSV を無改変で置き、ゲームはその JSON を読む）', () => {
  const CATEGORY = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' } as const;

  it('保管した JSON・CSV は ZIP の原本と同じバイト列', () => {
    expect(readFileSync('src/data/official/kalshell14_skills_OFFICIAL_20261027.json').equals(readFileSync(`${ORIGINAL_DIR}/03_DATA/03_正式技データと初期配布_UTF8.json`))).toBe(true);
    expect(readFileSync('src/data/official/kalshell14_skills_OFFICIAL_20261027.csv').equals(readFileSync(`${ORIGINAL_DIR}/03_DATA/01_正式技一覧_UTF8.csv`))).toBe(true);
    expect(readFileSync('src/data/official/kalshell14_initial_OFFICIAL_20261027.csv').equals(readFileSync(`${ORIGINAL_DIR}/03_DATA/02_初期配布16枚_UTF8.csv`))).toBe(true);
  });

  it('番号・技名・分類・マナ・ダメージ・効果が、CSV の14行と JSON（前の14技のデータ）ですべて一致する', () => {
    const rows = csvRows('src/data/official/kalshell14_skills_OFFICIAL_20261027.csv');
    expect(rows).toHaveLength(14);
    rows.forEach(([no, name, cat, mana, damage, effect], i) => {
      const n = i + 1;
      expect(Number(no)).toBe(n);
      expect(kalshellJson.skills[i]).toEqual({ no: n, name, category: cat, mana: Number(mana), damage, effect });
      const s = KALSHELL_SKILLS[i];
      expect(s?.displayNo).toBe(n);
      expect(s?.name).toBe(name);
      expect(s?.category).toBe(CATEGORY[cat as keyof typeof CATEGORY]);
      expect(s?.cost).toBe(Number(mana));
      expect(s?.art).toEqual({ category: 'skillCards', file: `kal_sk_${String(n).padStart(2, '0')}.png`, layout: 'frame' });
    });
    expect(KALSHELL_SKILLS).toHaveLength(14);
    expect(new Set(KALSHELL_SKILLS.map((s) => s.id)).size).toBe(14);
  });

  it('ゲームのカードは指示書 AJ の表の12枚（並び・技名・分類・マナ・ダメージ・効果・効果の文）。絵は同じ ID の前の絵（みちしおは仮の絵）', () => {
    const AJ_CATEGORY = { ち: 'force', か: 'wisdom', 特: 'special', 防: 'defense', 避: 'evade' } as const;
    expect(AJ).toHaveLength(12);
    expect(skillsOf('mon-kalshell').map((s) => s.id)).toEqual(AJ.map((r) => r.id));
    AJ.forEach((row, i) => {
      const s = getSkill(row.id);
      expect(s.displayNo).toBe(i + 1);
      expect(s.name).toBe(row.name);
      expect(s.category).toBe(AJ_CATEGORY[row.cat]);
      expect(s.cost).toBe(row.mana);
      expect(s.monsterId).toBe('mon-kalshell');
      expect(s.isPlaceholder).toBe(false);
      expect(s.stat).toEqual(row.damage === null ? null : { type: s.category, value: row.damage });
      expect(s.effect).toEqual(row.effect ?? { type: 'attack' });
      expect(s.effectTextJa).toBe(row.text);
      const legacy = KALSHELL_SKILLS.find((k) => k.id === row.id);
      expect(s.art).toEqual(legacy ? legacy.art : { category: 'skillCards', file: row.tempArt, layout: 'frame' });
    });
    // 新しい技：みちしお（場を水中にする。絵が届くまでタイダルクラッシュの絵）
    expect(getSkill('skl-kalshell-15')).toMatchObject({ name: 'みちしお', category: 'special', cost: 2, effect: { type: 'tide' } });
    expect(getSkill('skl-kalshell-15').art?.file).toBe('kal_sk_08.png');
    // 外した技（アクアバースト・いかくのハサミ・しおのステップ）はゲームに無い
    for (const n of [7, 9, 14]) {
      expect(REMOVED_SKILL_IDS).toContain(kal(n));
      expect(() => getSkill(kal(n))).toThrow();
    }
  });

  it('技の構成：ちから5・かしこさ3・特殊2・防御3・回避1', () => {
    const count = (c: string): number => KALSHELL_SKILLS.filter((s) => s.category === c).length;
    expect([count('force'), count('wisdom'), count('special'), count('defense'), count('evade')]).toEqual([5, 3, 2, 3, 1]);
  });

  it('性能の一覧（ゲームでの動き）', () => {
    const summary = KALSHELL_SKILLS.map((s) => [s.displayNo, s.name, s.category, s.cost, s.stat?.value ?? null, s.effect]);
    expect(summary).toEqual([
      [1, 'はさむ', 'force', 1, 1, { type: 'attack' }],
      [2, 'シェルタックル', 'force', 2, 2, { type: 'attack' }],
      [3, 'クラッシュクロー', 'force', 4, 3, { type: 'attack' }],
      [4, 'コーラルスピア', 'force', 3, 2, { type: 'attack', undodgeable: true }],
      [5, 'シェルブレイカー', 'force', 5, 5, { type: 'attack' }],
      [6, 'あわだま', 'wisdom', 2, 2, { type: 'attack' }],
      [7, 'アクアバースト', 'wisdom', 3, 3, { type: 'attack' }],
      [8, 'タイダルクラッシュ', 'wisdom', 5, 5, { type: 'attack' }],
      [9, 'いかくのハサミ', 'special', 2, null, { type: 'seal' }],
      [10, 'すなをほる', 'special', 2, null, { type: 'hide' }],
      [11, 'からにこもる', 'defense', 1, null, { type: 'defense', reduce: 3, against: 'force' }],
      [12, 'あわのまく', 'defense', 1, null, { type: 'defense', reduce: 3, against: 'wisdom' }],
      [13, 'てっぺきシェル', 'defense', 2, null, { type: 'defense', reduce: 5, against: 'all' }],
      [14, 'しおのステップ', 'evade', 2, null, { type: 'evade', against: 'force', minCost: 2 }],
    ]);
  });
});

describe('カルシェル：画像（届いた PNG を無改変）', () => {
  it('技の絵14枚は届いた原本と1バイトも違わない（番号で1対1）。827×937 の PNG', () => {
    const files = [
      'Hasamu', 'ShellTackle', 'CrashClaw', 'CoralSpear', 'ShellBreaker', 'Awadama', 'AquaBurst',
      'TidalCrash', 'IkakuNoHasami', 'SunaWoHoru', 'KaraNiKomoru', 'AwaNoMaku', 'TeppekiShell', 'ShioNoStep',
    ];
    files.forEach((name, i) => {
      const nn = String(i + 1).padStart(2, '0');
      const game = readFileSync(`assets/images/cards/skills/${KALSHELL_SKILLS[i]?.art?.file}`);
      expect(game.equals(readFileSync(`${ORIGINAL_DIR}/02_ASSETS/Skills/Kalshell_SK${nn}_${name}_ArtV2.png`))).toBe(true);
      expect([game.readUInt32BE(16), game.readUInt32BE(20)]).toEqual([827, 937]);
    });
  });

  it('バトル用の絵は届いた透過 PNG（無改変）。枠は淡い氷色（バトル用カード・技カードとも）', () => {
    expect(BATTLE_CARDS['mon-kalshell']).toMatchObject({ art: 'kalshell_battlecard.png', frame: 'kalshell' });
    const original = readFileSync(`${ORIGINAL_DIR}/02_ASSETS/BattleArt/Kalshell_BattleArt_Transparent_Approved.png`);
    expect(readFileSync('assets/images/cards/monsters/kalshell_battlecard.png').equals(original)).toBe(true);
    expect(existsSync('assets/images/ui/battlecard/frame_kalshell.png')).toBe(true);
    for (const size of ['normal', 'hand']) expect(existsSync(`assets/images/ui/skillcard_simple/frame_${size}_kalshell.webp`)).toBe(true);
  });
});

describe('カルシェル：モンスター・初期配布16枚', () => {
  it('モンスター：ライフ8・淡い氷色 #DFF2F6。名前・LIFE 入りの正式モンスターカード（2026-10-30 指示書 P）', () => {
    expect(KALSHELL_MONSTER.name).toBe('カルシェル');
    expect(KALSHELL_MONSTER.life).toBe(8);
    expect(KALSHELL_COLOR).toBe('#DFF2F6');
    expect(KALSHELL_MONSTER.themeColor).toBe('#DFF2F6');
    expect(KALSHELL_MONSTER.art).toEqual({ category: 'monsterCards', file: 'kalshell_official.webp', layout: 'full' });
    expect(existsSync('assets/images/cards/monsters/kalshell_official.webp')).toBe(true);
    expect(existsSync('design-parts/cards-original/kalshell-official-20261030/kalshell_official_monstercard_LIFE8.png')).toBe(true);
    expect(MONSTERS.filter((m) => m.id === 'mon-kalshell')).toHaveLength(1);
    // 指示書 AJ：技カードは12枚
    expect(SKILLS.filter((s) => s.monsterId === 'mon-kalshell')).toHaveLength(12);
  });

  it('初期配布16枚（指示書 AJ の箱の枚数）：はさむ2・シェルタックル3・クラッシュクロー3・シェルブレイカー1・あわだま1・すなをほる2・からにこもる2・あわのまく2', () => {
    const cards = INITIAL_DISTRIBUTION.find((d) => d.monsterId === 'mon-kalshell')?.cards ?? [];
    const byNo = Object.fromEntries(cards.map((s) => [getSkill(s.id).displayNo, s.copies]));
    expect(byNo).toEqual({ 1: 2, 2: 3, 4: 3, 5: 1, 6: 1, 8: 2, 10: 2, 11: 2 });
    expect(cards.reduce((n, s) => n + s.copies, 0)).toBe(16);
    expect(cards).toEqual(AJ.filter((r) => (r.box ?? 0) > 0).map((r) => ({ id: r.id, copies: r.box })));
    // 前の配布（JSON の initial_distribution）は保管のまま：01・02・03・06・07・09・10 が2枚、11・12 が1枚
    const legacyByNo = Object.fromEntries(KALSHELL_STARTER.map((s) => [Number(s.id.slice(-2)), s.copies]));
    expect(legacyByNo).toEqual({ 1: 2, 2: 2, 3: 2, 6: 2, 7: 2, 9: 2, 10: 2, 11: 1, 12: 1 });
    const csv = csvRows('src/data/official/kalshell14_initial_OFFICIAL_20261027.csv').filter((r) => /^\d+$/.test(r[0] ?? ''));
    expect(csv.map(([no, , c]) => [Number(no), Number(c)])).toEqual(kalshellJson.initial_distribution.map((d) => [d.no, d.count]));
  });

  it('新しく始めたときの所持カードにだけ入る（初期デッキ60枚・モンスターカード本体・パックには入れない）', () => {
    const save = createNewSave();
    for (const r of AJ) expect(save.collection[r.id]).toBe((r.box ?? 0) > 0 ? r.box : undefined);
    // 箱に0枚の技（コーラルスピア・タイダルクラッシュ・みちしお・てっぺきシェル）と外した技は持っていない
    for (const id of [kal(4), kal(8), kal(15), kal(13), kal(7), kal(9), kal(14)]) expect(save.collection[id]).toBeUndefined();
    expect(save.collection['mon-kalshell']).toBeUndefined();
    expect(save.deck.skills.some((id) => id.startsWith('skl-kalshell-'))).toBe(false);
    for (const p of PACKS) expect(p.cardIds.some((id) => id.includes('kalshell'))).toBe(false);
  });

  it('日本語は指示書 AJ の表の効果の文。英語は仮訳で、日本語が残らない', () => {
    setLanguage('ja');
    expect(skillCardFace(getSkill(kal(10))).description).toBe('次のターン攻撃の的にならない');
    expect(skillCardFace(getSkill(kal(15))).description).toBe('次の自分のターンの終わりまで、全モンスターを水中にする');
    expect(skillCardFace(getSkill(kal(13))).description).toBe('ちから技・かしこさ技に効く');
    setLanguage('en');
    expect(cardName(KALSHELL_MONSTER)).toBe('Kalshell');
    for (const s of skillsOf('mon-kalshell')) {
      expect(cardName(s)).not.toMatch(/[ぁ-んァ-ン一-龯]/);
      expect(skillCardFace(s).description).not.toMatch(/[ぁ-んァ-ン一-龯]/);
    }
    setLanguage('ja');
  });
});

/* ---------- バトル ---------- */

// 自分：カルシェル（m1）・ソラモ（m2）・ラズック（m3）。相手も同じ
const deck = { monsters: ['mon-kalshell', 'mon-soramo', 'mon-lazuck'], skills: Array.from({ length: 60 }, () => sor(1)) };

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

/** player が o-m1（カルシェル）に attack を使い、opponent が guards を使ったあとの状態 */
function attackWith(attack: string, guards: string[], from: BattleState | null = null, targetUid = 'o-m1'): BattleState {
  let s = from ?? scene({ player: [attack], opponent: guards });
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid });
  expect(s.phase).toBe('defense');
  guards.forEach((_, i) => {
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: `o${i}` });
  });
  if (s.phase === 'defense') s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
  return s;
}

function underAttack(attack: string, guards: string[], targetUid = 'o-m1'): BattleState {
  const s = applyAction(scene({ player: [attack], opponent: guards }), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid });
  expect(s.phase).toBe('defense');
  return s;
}

function passTurn(s: BattleState, side: Side): BattleState {
  const ended = applyAction(applyAction(s, { type: 'endAttack', side }), { type: 'endTurn', side });
  expect(ended.active).not.toBe(side);
  return ended;
}

describe('カルシェル正式14技：効果（細かい裁定は docs/battle-rules.md「正式カード（カルシェル）」）', () => {
  it('攻撃の7枚（指示書 AJ）：守らなければ表のダメージがそのまま入る（タイダルクラッシュは場が水中でなければ5）', () => {
    const attacks = AJ.filter((r) => r.damage !== null);
    expect(attacks.map((r) => [r.name, r.mana, r.damage])).toEqual([
      ['はさむ', 1, 1], ['シェルタックル', 2, 2], ['コーラルスピア', 3, 3], ['クラッシュクロー', 3, 4],
      ['シェルブレイカー', 5, 6], ['あわだま', 1, 2], ['タイダルクラッシュ', 4, 5],
    ]);
    for (const r of attacks) {
      const s = attackWith(r.id, []);
      expect(monster(s, 'o-m1').life).toBe(8 - (r.damage ?? 0));
      expect(manaOf(s.sides.player)).toBe(10 - r.mana);
    }
  });

  it('コーラルスピア：回避されない（ソラモの星影ステップは使えない）。防御は使える', () => {
    // 指示書 AJ でカルシェルの回避（しおのステップ）を外したので、回避はソラモ（o-m2）で確かめる
    const s = underAttack(kal(4), [sor(14), sor(12)], 'o-m2');
    expect(cardUsability(s, 'opponent', 'o0').usable).toBe(false);
    expect(cardUsability(s, 'opponent', 'o1').usable).toBe(true);
    expect(monster(attackWith(kal(4), [kal(11)]), 'o-m1').life).toBe(8);
  });

  // 指示書 AJ で外した技（skl-kalshell-09 いかくのハサミ）と同じ封じ：ソラモのすなかけ（skl-soramo14-09）で確かめる
  it('封じ（すなかけ）：選んだ相手1体は、持ち主の次の手番に攻撃の技を使えない', () => {
    let s = scene({ player: [sor(9)], opponent: [kal(1)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(monster(s, 'o-m1').sealedTurn).toBe(s.turn + 1);
    s = passTurn(s, 'player');
    s = { ...s, phase: 'main' };
    expect(cardUsability(s, 'opponent', 'o0').usable).toBe(false);
  });

  it('10 すなをほる：使ったカルシェルは、相手の次の手番のあいだ攻撃の対象にならない（ほかの味方は狙える）。そのあとは元どおり', () => {
    let s = scene({ player: [kal(10)], opponent: [sor(1)] });
    const turn = s.turn;
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(monster(s, 'p-m1').hiddenTurn).toBe(turn + 1);
    expect(manaOf(s.sides.player)).toBe(8);
    expect(s.log.at(-1)?.text).toBe('カルシェルは砂にもぐった。次のターン攻撃の対象にならない。');
    s = { ...passTurn(s, 'player'), phase: 'main' };
    const attack = getPlayCard(sor(1));
    const targets = targetsFor(s, 'opponent', attack).map((m) => m.uid);
    expect(targets).not.toContain('p-m1');
    expect(targets).toContain('p-m2');
    // 特殊の技（攻撃でない）は選べる
    expect(targetsFor(s, 'opponent', getPlayCard(sor(9))).map((m) => m.uid)).toContain('p-m1');
    // 相手の思考も隠れたカルシェルを狙わない
    const ai = chooseAction(s, 'opponent');
    if (ai?.type === 'useCard' && ai.targetUid) expect(ai.targetUid).not.toBe('p-m1');
    // さらに次の手番（こちら）→ その次（相手）では狙える
    const later = { ...passTurn(passTurn(s, 'opponent'), 'player'), phase: 'main' as const };
    expect(later.turn).toBe(turn + 3);
    expect(targetsFor(later, 'opponent', attack).map((m) => m.uid)).toContain('p-m1');
  });

  it('10 すなをほる：相手が全員隠れていれば、攻撃の技は使えない', () => {
    let s = scene({ player: [kal(10)], opponent: [sor(1)] });
    s = withMonster(withMonster(s, 'p-m2', { life: 0 }), 'p-m3', { life: 0 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    s = { ...passTurn(s, 'player'), phase: 'main' };
    expect(cardUsability(s, 'opponent', 'o0')).toMatchObject({ usable: false, reason: '相手はもぐっていて攻撃できません' });
  });

  it('防御（指示書 AJ）：からにこもる ちから−5／あわのまく かしこさ−3／てっぺきシェル 両方0に。0未満にならない', () => {
    expect(monster(attackWith(kal(5), [kal(11)]), 'o-m1').life).toBe(7);
    expect(monster(attackWith(kal(8), [kal(12)]), 'o-m1').life).toBe(6);
    expect(monster(attackWith(kal(5), [kal(13)]), 'o-m1').life).toBe(8);
    expect(monster(attackWith(kal(8), [kal(13)]), 'o-m1').life).toBe(8);
    expect(monster(attackWith(kal(1), [kal(11)]), 'o-m1').life).toBe(8);
    // てっぺきシェルは回避ではないので「回避されない」攻撃にも使える
    expect(monster(attackWith(kal(4), [kal(13)]), 'o-m1').life).toBe(8);
    expect(cardUsability(underAttack(kal(6), [kal(11)]), 'opponent', 'o0').usable).toBe(false);
    expect(cardUsability(underAttack(kal(1), [kal(12)]), 'opponent', 'o0').usable).toBe(false);
  });

  // 指示書 AJ で外した技（skl-kalshell-14 しおのステップ）と同じ「マナ2以上の回避」：ラズック（o-m3）のシャドウスリップ（skl-lazuck-15）で確かめる
  it('マナ2以上の回避（シャドウスリップ）：攻撃カードの必要マナが2以上なら回避。1マナの技には使えない', () => {
    expect(monster(attackWith(kal(2), [lazuckSkillId(15)], null, 'o-m3'), 'o-m3').life).toBe(6);
    expect(monster(attackWith(kal(5), [lazuckSkillId(15)], null, 'o-m3'), 'o-m3').life).toBe(6);
    expect(cardUsability(underAttack(kal(1), [lazuckSkillId(15)], 'o-m3'), 'opponent', 'o0').usable).toBe(false);
    expect(cardUsability(underAttack(kal(6), [lazuckSkillId(15)], 'o-m3'), 'opponent', 'o0').usable).toBe(false);
  });
});
