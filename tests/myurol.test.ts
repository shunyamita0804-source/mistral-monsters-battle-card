import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { getSkill, MONSTERS, SKILLS } from '../src/data/cards.ts';
import { PACKS } from '../src/data/economy.ts';
import {
  MYUROL14_ROWS,
  MYUROL_COLOR,
  MYUROL_MONSTER,
  MYUROL_REMOVED_14_IDS,
  MYUROL_SKILLS,
  MYUROL_STARTER,
  myurolSkillId,
} from '../src/data/myurol.ts';
import myurol14Json from '../src/data/official/myurol14_skills_OFFICIAL_20261027.json';
import { soramoSkillId } from '../src/data/soramo.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import {
  actingSide,
  applyAction,
  cardUsability,
  createBattle,
  incomingDamage,
  manaOf,
  type BattleMonster,
  type BattleState,
  type Side,
} from '../src/game/battle/engine.ts';
import { skillCardFace } from '../src/game/cards/cardFace.ts';
import { createNewSave, migrate, REMOVED_CARD_IDS, SAVE_VERSION } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';
import { SKILL_CARD_TEXT } from '../src/data/skillCardText.ts';

/** ゲーム内 ID で引く（それまでの番号。旧14〜16 のスリップガード・ひらりよける・すべってよけるは ID 14〜16 のまま） */
const myu = (n: number): string => myurolSkillId(n);
const sor = (n: number): string => soramoSkillId(n);
/** 正式の番号（表示の番号）で引く */
const m14 = (displayNo: number): string => {
  const s = MYUROL_SKILLS.find((x) => x.displayNo === displayNo);
  if (!s) throw new Error(String(displayNo));
  return s.id;
};
const ORIGINAL_DIR = 'design-parts/cards-original/myurol14-20261027';
/** 2026-10-31 指示書 AC【3】：正式モンスターカード・バトル用の絵・パックの窓の絵（無改変） */
const NEW_ORIGINAL_DIR = 'design-parts/cards-original/myurol-official-20261031';

/** 届いた CSV の行（BOM 付き・カンマ区切り。効果の文にカンマは無い） */
function csvRows(path: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text.trim().split(/\r?\n/).slice(1).map((line) => line.split(','));
}

const sha256 = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

describe('ミュロル正式14技：データ（2026-10-27。届いた JSON・CSV を無改変で置き、ゲームはその JSON を読む）', () => {
  const CATEGORY = { ちから: 'force', かしこさ: 'wisdom', 特殊: 'special', 防御: 'defense', 回避: 'evade' } as const;

  it('保管した JSON・CSV は ZIP の原本と同じバイト列', () => {
    expect(readFileSync('src/data/official/myurol14_skills_OFFICIAL_20261027.json').equals(readFileSync(`${ORIGINAL_DIR}/02_正式技データ_初期配布_UTF8.json`))).toBe(true);
    expect(readFileSync('src/data/official/myurol14_skills_OFFICIAL_20261027.csv').equals(readFileSync(`${ORIGINAL_DIR}/01_正式技一覧と初期配布_UTF8.csv`))).toBe(true);
  });

  it('番号・技名・分類・マナ・ダメージ・効果・画像・初期配布が、CSV の14行と JSON とゲームのカードですべて一致する', () => {
    const rows = csvRows(`${ORIGINAL_DIR}/01_正式技一覧と初期配布_UTF8.csv`);
    expect(rows).toHaveLength(14);
    expect(myurol14Json.skills).toHaveLength(14);
    rows.forEach(([no, name, cat, mana, damage, effect, image, copies], i) => {
      const n = i + 1;
      const nn = String(n).padStart(2, '0');
      expect(no).toBe(nn);
      expect(myurol14Json.skills[i]).toEqual({
        number: n,
        name,
        category: cat,
        mana: Number(mana),
        damage: damage === 'なし' ? null : Number(damage),
        effect,
        image,
        initial_count: Number(copies),
      });
      const s = getSkill(m14(n));
      expect(s.displayNo).toBe(n);
      expect(s.name).toBe(name);
      expect(s.category).toBe(CATEGORY[cat as keyof typeof CATEGORY]);
      expect(s.cost).toBe(Number(mana));
      expect(s.monsterId).toBe('mon-myurol');
      expect(s.isPlaceholder).toBe(false);
      if (damage === 'なし') {
        expect(s.stat).toBeNull();
        expect(s.effectTextJa).toBe(SKILL_CARD_TEXT[s.id] ?? effect);
      } else {
        expect(s.stat).toEqual({ type: s.category, value: Number(damage) });
        expect(s.effectTextJa).toBeNull();
      }
      expect(image).toBe(`Myurol_SK${nn}_ArtV2.png`);
      expect(s.art).toEqual({ category: 'skillCards', file: `myu14_sk_${nn}.png`, layout: 'frame' });
      expect(s.availability).toBe(Number(copies) > 0 ? 'initial' : 'collect');
    });
    expect(MYUROL_SKILLS).toHaveLength(14);
    expect(MYUROL14_ROWS).toHaveLength(14);
    expect(new Set(MYUROL_SKILLS.map((s) => s.id)).size).toBe(14);
  });

  it('ID は同じ名前の技を引き継ぐ：01〜11 は同じ番号、12＝旧14・13＝旧15・14＝旧16。旧12・旧13 はゲームから外した', () => {
    expect(MYUROL_SKILLS.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16].map(myu));
    expect(MYUROL_REMOVED_14_IDS).toEqual([myu(12), myu(13)]);
    for (const id of MYUROL_REMOVED_14_IDS) {
      expect(SKILLS.some((s) => s.id === id)).toBe(false);
      expect(REMOVED_CARD_IDS).toContain(id);
    }
    expect(myurol14Json.deleted_old_skill_numbers).toEqual([12, 13]);
    expect(myurol14Json.old_to_new_number_mapping).toEqual({ '14': 12, '15': 13, '16': 14 });
    // 古い16技の名前と、引き継いだ技の名前が同じ
    const old = JSON.parse(readFileSync('src/data/official/myurol_skills_OFFICIAL_20261025.json', 'utf8')) as { skills: { number: number; name: string }[] };
    for (const s of MYUROL_SKILLS) {
      const no = Number(s.id.slice(-2));
      expect(old.skills.find((o) => o.number === no)?.name).toBe(s.name);
    }
  });

  it('性能の一覧（技名・分類・マナ・ダメージ・軽減・回避の条件）。それまでの16技から性能は変わらない', () => {
    const summary = MYUROL_SKILLS.map((s) => [s.displayNo, s.name, s.category, s.cost, s.stat?.value ?? null, s.effect]);
    expect(summary).toEqual([
      [1, 'たいあたり', 'force', 1, 1, { type: 'attack' }],
      [2, 'しっぽたたき', 'force', 2, 2, { type: 'attack' }],
      [3, '連続ひっかき', 'force', 3, 3, { type: 'attack' }],
      [4, 'アクアテール', 'force', 4, 4, { type: 'attack' }],
      [5, 'みずでっぽう', 'wisdom', 1, 1, { type: 'attack' }],
      [6, 'バブルショット', 'wisdom', 2, 2, { type: 'attack' }],
      [7, 'アクアボール', 'wisdom', 3, 3, { type: 'attack' }],
      [8, 'しめったはだ', 'special', 2, null, { type: 'shield', against: 'force', reduce: 1, turns: 2 }],
      [9, 'みずあび', 'special', 3, null, { type: 'healSelf', amount: 1 }],
      [10, 'しっぽガード', 'defense', 1, null, { type: 'defense', reduce: 2, against: 'force' }],
      [11, 'みずのまく', 'defense', 1, null, { type: 'defense', reduce: 2, against: 'wisdom' }],
      [12, 'スリップガード', 'defense', 2, null, { type: 'defense', reduce: 4, against: 'all', minCost: 3 }],
      [13, 'ひらりよける', 'evade', 2, null, { type: 'evade', against: 'force' }],
      [14, 'すべってよける', 'evade', 3, null, { type: 'evade', against: 'all', maxCost: 2 }],
    ]);
  });
});

describe('ミュロル正式14技：画像（届いた PNG を無改変）', () => {
  it('ゲームの絵14枚は届いた原本と1バイトも違わず、画像監査の SHA-256 どおり。827×937 の PNG', () => {
    const audit = csvRows(`${ORIGINAL_DIR}/04_画像監査_SHA256_UTF8.csv`);
    expect(audit).toHaveLength(14);
    for (const [no, file, , , size, hash] of audit) {
      const n = Number(no);
      const game = readFileSync(`assets/images/cards/skills/${getSkill(m14(n)).art?.file}`);
      expect(game.equals(readFileSync(`${ORIGINAL_DIR}/SKILLS/${file}`))).toBe(true);
      expect(sha256(game)).toBe(hash);
      expect(game.length).toBe(Number(size));
      expect(game.readUInt32BE(0)).toBe(0x89504e47);
      expect([game.readUInt32BE(16), game.readUInt32BE(20)]).toEqual([827, 937]);
    }
    expect(new Set(audit.map((r) => r[5])).size).toBe(14);
  }, 30000);

  it('それまでの16技の絵（myu_sk_*）はゲームの素材から外した（原本は design-parts/cards-original/myurol/ に残る）', () => {
    for (let n = 1; n <= 16; n++) {
      const nn = String(n).padStart(2, '0');
      expect(existsSync(`assets/images/cards/skills/myu_sk_${nn}.png`) || existsSync(`assets/images/cards/skills/myu_sk_${nn}.jpg`)).toBe(false);
    }
    expect(existsSync('design-parts/cards-original/myurol/SKILLS/Myurol_12_ぬるぬるガード.jpg')).toBe(true);
  });
});

describe('ミュロル正式14技：初期配布16枚・モンスター', () => {
  it('初期配布16枚（2026-10-26 正式確定）：01・02・05・06・08・12・13 が2枚、03・07 が1枚。9種類', () => {
    const byNo = Object.fromEntries(MYUROL_STARTER.map((s) => [getSkill(s.id).displayNo, s.copies]));
    expect(byNo).toEqual({ 1: 2, 2: 2, 3: 1, 5: 2, 6: 2, 7: 1, 8: 2, 12: 2, 13: 2 });
    expect(MYUROL_STARTER.reduce((n, s) => n + s.copies, 0)).toBe(16);
    expect(MYUROL_STARTER).toHaveLength(9);
    expect(myurol14Json.total_initial_skill_cards).toBe(16);
    expect(myurol14Json.initial_distribution_confirmed).toBe(true);
  });

  it('新しく始めたときの所持カードにだけ入る（初期デッキ60枚・モンスターカード本体には入れない）', () => {
    const save = createNewSave();
    for (const s of MYUROL_STARTER) expect(save.collection[s.id]).toBe(s.copies);
    for (const id of [4, 9, 10, 11].map(m14)) expect(save.collection[id]).toBeUndefined();
    expect(save.collection['mon-myurol']).toBeUndefined();
    expect(save.deck.skills.some((id) => id.startsWith('skl-myurol-'))).toBe(false);
    expect(save.deck.monsters).not.toContain('mon-myurol');
    for (const p of PACKS) expect(p.cardIds.some((id) => id.includes('myurol'))).toBe(false);
  });

  it(`いまのセーブ（version 13）：外れた2技だけ所持・デッキから外す。ほかの所持カードはそのまま。初期配布は配らない（version ${SAVE_VERSION}）`, () => {
    const base = createNewSave();
    const collection = { ...Object.fromEntries(Object.entries(base.collection).filter(([id]) => !id.startsWith('skl-myurol-'))), [myu(1)]: 3, [myu(12)]: 2, [myu(13)]: 1, [myu(16)]: 2 };
    const deckSkills = [...base.deck.skills.slice(0, 58), myu(12), myu(1)];
    const migrated = migrate({ ...base, version: 13, collection, deck: { ...base.deck, skills: deckSkills } });
    if (!migrated) throw new Error('migrate');
    expect(migrated.version).toBe(SAVE_VERSION);
    const c = migrated.collection as Record<string, number>;
    expect(c[myu(12)]).toBeUndefined();
    expect(c[myu(13)]).toBeUndefined();
    expect(c[myu(1)]).toBe(3);
    expect(c[myu(16)]).toBe(2);
    expect(c[myu(2)]).toBeUndefined();
    const deck = migrated.deck as { skills: string[] };
    expect(deck.skills).not.toContain(myu(12));
    expect(deck.skills).toContain(myu(1));
  });

  it('モンスター：ライフ7・水色。正式モンスターカード（2026-10-31 指示書 AC【3】）。バトル用カードは届いた透過 PNG（無改変）と水色の枠。技カードの枠も水色', () => {
    expect(MYUROL_MONSTER.life).toBe(7);
    expect(MYUROL_MONSTER.name).toBe('ミュロル');
    expect(MYUROL_MONSTER.themeColor).toBe(MYUROL_COLOR);
    expect(MYUROL_COLOR).toBe('#84E5FA');
    expect(MYUROL_MONSTER.art).toEqual({ category: 'monsterCards', file: 'myurol_official.webp', layout: 'full' });
    expect(existsSync('assets/images/cards/monsters/myurol_official.webp')).toBe(true);
    expect(existsSync(`${NEW_ORIGINAL_DIR}/myurol_official_monstercard_LIFE7.png`)).toBe(true);
    expect(MONSTERS.filter((m) => m.id === 'mon-myurol')).toHaveLength(1);
    expect(SKILLS.filter((s) => s.monsterId === 'mon-myurol')).toHaveLength(14);
    expect(BATTLE_CARDS['mon-myurol']).toMatchObject({ art: 'myurol_battlecard.png', frame: 'myurol' });
    // 2026-10-31 指示書 AC【3】：足4本・えら片側3本の描き直し（前の版は ORIGINAL_DIR/MONSTER/Myurol_Battle_800x920_RGBA.png に残る）
    expect(existsSync(`${ORIGINAL_DIR}/MONSTER/Myurol_Battle_800x920_RGBA.png`)).toBe(true);
    const original = readFileSync(`${NEW_ORIGINAL_DIR}/myurol_battlecard.png`);
    expect(readFileSync('assets/images/cards/monsters/myurol_battlecard.png').equals(original)).toBe(true);
    expect([original.readUInt32BE(16), original.readUInt32BE(20)]).toEqual([800, 920]);
    expect(existsSync('assets/images/ui/battlecard/frame_myurol.png')).toBe(true);
    for (const size of ['normal', 'hand']) expect(existsSync(`assets/images/ui/skillcard_simple/frame_${size}_myurol.webp`)).toBe(true);
  });

  it('日本語はカードに書く短い文（skillCardText.ts）か JSON の効果の文。英語は仮訳で、日本語が残らない', () => {
    setLanguage('ja');
    expect(skillCardFace(getSkill(m14(8))).description).toBe('今と次のターン、ちから技を1軽減（重ねられない）');
    expect(skillCardFace(getSkill(m14(14))).description).toBe('マナ2以下のちから技・かしこさ技を回避');
    for (const s of MYUROL_SKILLS) expect(skillCardFace(s).mana).toBe(s.cost);
    setLanguage('en');
    expect(cardName(MYUROL_MONSTER)).toBe('Myurol');
    for (const s of MYUROL_SKILLS) {
      expect(cardName(s)).not.toMatch(/[ぁ-んァ-ン一-龯]/);
      expect(skillCardFace(s).description).not.toMatch(/[ぁ-んァ-ン一-龯]/);
    }
    setLanguage('ja');
  });
});

/* ---------- バトル ---------- */

// 自分：ミュロル（m1）・ソラモ（m2）・ラズック（m3）。相手も同じ
const deck = { monsters: ['mon-myurol', 'mon-soramo', 'mon-lazuck'], skills: Array.from({ length: 60 }, () => sor(1)) };

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

/** player が o-m1（ミュロル）に attack を使い、opponent が guards を使ったあとの状態 */
function attackWith(attack: string, guards: string[], mana: Partial<Record<Side, number>> = {}, from: BattleState | null = null): BattleState {
  let s = from ?? scene({ player: [attack], opponent: guards }, mana);
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
  expect(s.phase).toBe('defense');
  guards.forEach((_, i) => {
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: `o${i}` });
  });
  if (s.phase === 'defense') s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
  return s;
}

/** 攻撃を受けて守備を選ぶところまで進めた状態 */
function underAttack(attack: string, guards: string[], mana: Partial<Record<Side, number>> = {}): BattleState {
  const s = applyAction(scene({ player: [attack], opponent: guards }, mana), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
  expect(s.phase).toBe('defense');
  return s;
}

/** 手番を相手へ渡す（攻撃を終える → マナ化を終える） */
function passTurn(s: BattleState, side: Side): BattleState {
  const ended = applyAction(applyAction(s, { type: 'endAttack', side }), { type: 'endTurn', side });
  expect(ended.active).not.toBe(side);
  return ended;
}

describe('ミュロル正式14技：効果（細かい裁定は docs/battle-rules.md「正式カード（ミュロル）」。ID の番号で書く：12 スリップガード＝ID 14 など）', () => {
  it('01〜07 攻撃：守らなければ書かれたダメージがそのまま入る（ちから 1〜4・かしこさ 1〜3）', () => {
    const expected = [1, 2, 3, 4, 1, 2, 3];
    expected.forEach((dmg, i) => {
      const s = attackWith(myu(i + 1), []);
      expect(monster(s, 'o-m1').life).toBe(7 - dmg);
      expect(manaOf(s.sides.player)).toBe(10 - getSkill(myu(i + 1)).cost);
    });
  });

  it('08 しめったはだ：使った手番と相手の次の手番、受けるちから技のダメージ−1。かしこさ技には効かない。最低0', () => {
    // 相手（ミュロル）が自分の手番に使う
    let s = scene({ opponent: [myu(8)] }, {}, 'opponent');
    const turn = s.turn;
    s = applyAction(s, { type: 'useCard', side: 'opponent', cardUid: 'o0' });
    expect(monster(s, 'o-m1').shield).toEqual({ against: 'force', reduce: 1, untilTurn: turn + 1 });
    expect(manaOf(s.sides.opponent)).toBe(8);
    expect(s.log.at(-1)?.text).toBe('ミュロルが受けるちから技のダメージ-1（相手の次のターンまで）。');
    // 次の手番（こちら）：ちから3 → 2、かしこさ3 → 3、ちから1 → 0
    s = passTurn(s, 'opponent');
    expect(s.turn).toBe(turn + 1);
    const at = (attack: string, guards: string[] = []): BattleState => {
      const hand = [attack, ...s.sides.player.hand.map((c) => c.cardId)].map((cardId, i) => ({ uid: `p${i}`, cardId }));
      const opp = guards.map((cardId, i) => ({ uid: `o${i}`, cardId }));
      const base = { ...s, sides: { player: { ...s.sides.player, hand }, opponent: { ...s.sides.opponent, hand: opp } } };
      return attackWith(attack, guards, {}, base);
    };
    expect(monster(at(myu(3)), 'o-m1').life).toBe(5);
    expect(monster(at(myu(7)), 'o-m1').life).toBe(4);
    expect(monster(at(myu(1)), 'o-m1').life).toBe(7);
    // 防御（しっぽガード −2）と合わせても0未満にならない：ちから2 −2 −1 → 0
    expect(monster(at(myu(2), [myu(10)]), 'o-m1').life).toBe(7);
    // さらに次の手番（相手）→ その次（こちら）では切れている
    const later = passTurn(passTurn(s, 'player'), 'opponent');
    expect(later.turn).toBe(turn + 3);
    const hand = [{ uid: 'p0', cardId: myu(3) }];
    const expired = attackWith(myu(3), [], {}, { ...later, sides: { ...later.sides, player: { ...later.sides.player, hand } } });
    expect(monster(expired, 'o-m1').life).toBe(4);
  });

  it('08 しめったはだ：重ねがけはしない（もう一度使っても −1 のまま、期限だけ新しく）。守備待ちの表示のダメージにも反映', () => {
    let s = scene({ opponent: [myu(8), myu(8)] }, {}, 'opponent');
    s = applyAction(s, { type: 'useCard', side: 'opponent', cardUid: 'o0' });
    // 同じ手番にもう一度：ミュロルは行動済みなので使えない
    expect(cardUsability(s, 'opponent', 'o1').usable).toBe(false);
    // 2手番あとにもう一度使う
    const again = withMonster({ ...s, turn: s.turn + 2 }, 'o-m1', { acted: false });
    const used = applyAction(again, { type: 'useCard', side: 'opponent', cardUid: 'o1' });
    expect(monster(used, 'o-m1').shield).toEqual({ against: 'force', reduce: 1, untilTurn: again.turn + 1 });
    // 守備待ちのダメージ：ちから4 → 3（しめったはだ）
    const shielded = withMonster(underAttack(myu(4), []), 'o-m1', { shield: { against: 'force', reduce: 1, untilTurn: 99 } });
    expect(shielded.pending && incomingDamage(shielded, shielded.pending)).toBe(3);
  });

  it('09 みずあび：使ったミュロルのライフ+1。最大ライフ（7）を超えない', () => {
    let s = withMonster(scene({ player: [myu(9)] }), 'p-m1', { life: 5 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(monster(s, 'p-m1').life).toBe(6);
    expect(manaOf(s.sides.player)).toBe(7);
    expect(s.log.at(-1)?.text).toBe('ミュロルのライフが1回復。');
    const full = applyAction(scene({ player: [myu(9)] }), { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(monster(full, 'p-m1').life).toBe(7);
    const almost = applyAction(withMonster(scene({ player: [myu(9)] }), 'p-m1', { life: 6 }), { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(monster(almost, 'p-m1').life).toBe(7);
  });

  it('10・11 防御：ちから−2／かしこさ−2。0未満にならない。種類が違えば使えない', () => {
    expect(monster(attackWith(myu(4), [myu(10)]), 'o-m1').life).toBe(5);
    expect(monster(attackWith(myu(7), [myu(11)]), 'o-m1').life).toBe(6);
    expect(monster(attackWith(myu(1), [myu(10)]), 'o-m1').life).toBe(7);
    const w = underAttack(myu(5), [myu(10), myu(11)]);
    expect(cardUsability(w, 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'かしこさ攻撃には使えません' });
    expect(cardUsability(w, 'opponent', 'o1').usable).toBe(true);
    const f = underAttack(myu(1), [myu(10), myu(11)]);
    expect(cardUsability(f, 'opponent', 'o0').usable).toBe(true);
    expect(cardUsability(f, 'opponent', 'o1')).toMatchObject({ usable: false, reason: 'ちから攻撃には使えません' });
  });

  it('12 スリップガード（ID 14）：攻撃カードの必要マナが3以上のときだけ使える（−4）。攻撃側・守備側のいまのマナの残りでは決まらない', () => {
    expect(monster(attackWith(myu(4), [myu(14)]), 'o-m1').life).toBe(7);
    expect(monster(attackWith(myu(7), [myu(14)]), 'o-m1').life).toBe(7);
    expect(monster(attackWith(myu(3), [myu(14)]), 'o-m1').life).toBe(7);
    // 必要マナ2の攻撃には使えない（攻撃側のマナが10残っていても、守備側のマナが十分でも）
    const cheap = underAttack(myu(2), [myu(14)], { player: 10, opponent: 10 });
    expect(cardUsability(cheap, 'opponent', 'o0')).toMatchObject({ usable: false, reason: '必要マナ3以上の攻撃にしか使えません' });
    expect(cardUsability(underAttack(myu(6), [myu(14)]), 'opponent', 'o0').usable).toBe(false);
    // 必要マナ3の攻撃を、ちょうど3マナで撃って残り0：それでも使える
    const exact = underAttack(myu(3), [myu(14)], { player: 3, opponent: 2 });
    expect(manaOf(exact.sides.player)).toBe(0);
    expect(cardUsability(exact, 'opponent', 'o0').usable).toBe(true);
    // 守備側のマナが足りなければ使えない（スリップガードは2マナ）
    expect(cardUsability(underAttack(myu(4), [myu(14)], { opponent: 1 }), 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'マナが足りません' });
  });

  it('13 ひらりよける（ID 15）：ちから技を完全回避。かしこさ技には使えない', () => {
    expect(monster(attackWith(myu(4), [myu(15)]), 'o-m1').life).toBe(7);
    const w = underAttack(myu(5), [myu(15)]);
    expect(cardUsability(w, 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'かしこさ攻撃には使えません' });
  });

  it('14 すべってよける（ID 16）：攻撃カードの必要マナが2以下のちから・かしこさ技を完全回避。3以上には使えない（いまのマナの残りでは決まらない）', () => {
    for (const n of [1, 2, 5, 6]) expect(monster(attackWith(myu(n), [myu(16)]), 'o-m1').life).toBe(7);
    for (const n of [3, 4, 7]) {
      const s = underAttack(myu(n), [myu(16)], { player: 10 });
      expect(cardUsability(s, 'opponent', 'o0')).toMatchObject({ usable: false, reason: '必要マナ2以下の攻撃にしか使えません' });
    }
    // 攻撃側のマナが残り0でも、必要マナ2の攻撃なら回避できる
    const low = underAttack(myu(2), [myu(16)], { player: 2 });
    expect(manaOf(low.sides.player)).toBe(0);
    expect(cardUsability(low, 'opponent', 'o0').usable).toBe(true);
  });

  it('守備に使えるのは狙われたミュロルのカードだけ。攻撃の手番には防御・回避を使えない', () => {
    const s = scene({ player: [myu(10), myu(15)] });
    expect(cardUsability(s, 'player', 'p0')).toMatchObject({ usable: false });
    expect(cardUsability(s, 'player', 'p1')).toMatchObject({ usable: false });
    // ソラモ（o-m2）が狙われたときは、ミュロルの防御は使えない
    let other = scene({ player: [myu(4)], opponent: [myu(10)] });
    other = applyAction(other, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(cardUsability(other, 'opponent', 'o0').usable).toBe(false);
  });

  it('ミュロル同士で、相手の思考どうしが最後まで対戦できる（14種すべてを含むデッキ）', () => {
    const skills = [...Array.from({ length: 42 }, (_, i) => MYUROL_SKILLS[i % 14]?.id as string), ...Array.from({ length: 18 }, () => sor(1))];
    const d = { monsters: ['mon-myurol', 'mon-soramo', 'mon-lazuck'], skills };
    const used = new Set<string>();
    for (const [seed, first] of [[1, 'player'], [2, 'opponent'], [3, 'player'], [4, 'opponent']] as const) {
      let s = createBattle({ name: 'P', deck: d }, { name: 'O', deck: d }, seed, first);
      let steps = 0;
      while (s.phase !== 'ended' && steps < 5000) {
        const side = actingSide(s);
        if (!side) break;
        const action = chooseAction(s, side);
        if (!action) break;
        if (action.type === 'useCard' || (action.type === 'defend' && action.cardUid)) {
          const uid = action.cardUid;
          const card = [...s.sides.player.hand, ...s.sides.opponent.hand].find((c) => c.uid === uid);
          if (card) used.add(card.cardId);
        }
        const next = applyAction(s, action);
        expect(next).not.toBe(s);
        s = next;
        steps += 1;
      }
      expect(s.phase).toBe('ended');
      expect(s.winner).not.toBeNull();
    }
    // 思考がミュロルの技を実際に使っている（攻撃・特殊・防御・回避）
    expect([...used].filter((id) => id.startsWith('skl-myurol-')).length).toBeGreaterThanOrEqual(8);
  });
});
