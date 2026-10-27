import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSkill, MONSTERS, SKILLS, skillsOf } from '../src/data/cards.ts';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { PACKS } from '../src/data/economy.ts';
import { GAUL14_ROWS, GAUUL_MONSTER, GAUUL_OLD_SKILL_IDS, GAUUL_SKILLS, GAUUL_STARTER, gauulSkillId } from '../src/data/gauul.ts';
import { LAZUCK_CROSS_GUARD_ID, LAZUCK_ITAZURA_ID, lazuckSkillId } from '../src/data/lazuck.ts';
import evasionJson from '../src/data/official/evasion_LATEST_20261024.json';
import gaulJson from '../src/data/official/gaul14_skills_OFFICIAL_20261026.json';
import { soramoSkillId } from '../src/data/soramo.ts';
import { TOURNAMENTS } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, cardUsability, createBattle, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { skillCardFace, skillValueBadge, skillValueBadgeText } from '../src/game/cards/cardFace.ts';
import { describeSkill } from '../src/game/cards/cardTypes.ts';
import { countCards, createStarterDeck, validateDeck } from '../src/game/deck/deck.ts';
import { BACKUP_FORMAT, parseBackup } from '../src/game/save/backup.ts';
import { createNewSave, normalizeSave, REMOVED_CARD_IDS, SAVE_VERSION } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

const gau = (n: number): string => gauulSkillId(n);
const laz = (n: number): string => lazuckSkillId(n);
const sor = (n: number): string => soramoSkillId(n);
const ORIGINAL = 'design-parts/cards-original/gaul14-20261026';
/** 初期配布16枚（2026-10-26 ユーザー正式確定。正式の番号 → 枚数。2026-10-27 の検収の指示のとおり） */
const GAUUL_INITIAL: Readonly<Record<number, number>> = { 1: 3, 2: 2, 3: 1, 6: 3, 7: 2, 10: 2, 11: 1, 12: 1, 13: 1 };
const sha256 = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

describe('ガウル14技：正式データ（2026-10-26。届いた JSON・CSV を無改変で置き、ゲームはその JSON を読む）', () => {
  it('保管した JSON・CSV は ZIP の原本と同じ。絵14枚は照合表（SHA-256）どおりで、ゲームの絵は1バイトも変えていない', () => {
    expect(readFileSync('src/data/official/gaul14_skills_OFFICIAL_20261026.json').equals(readFileSync(`${ORIGINAL}/02_SKILL_DATA/Gaul_14Skills_UTF8.json`))).toBe(true);
    expect(readFileSync('src/data/official/gaul14_skills_OFFICIAL_20261026.csv').equals(readFileSync(`${ORIGINAL}/02_SKILL_DATA/Gaul_14Skills_UTF8_BOM.csv`))).toBe(true);
    const manifest = readFileSync(`${ORIGINAL}/04_QA/ImageManifest_SHA256_UTF8.txt`, 'utf8')
      .split('\n')
      .map((l) => /^(\d{2}) (\S+) ([0-9a-f]{64})$/.exec(l.trim()))
      .filter((m): m is RegExpExecArray => m !== null);
    expect(manifest).toHaveLength(14);
    for (const [, no, name, hash] of manifest) {
      const row = GAUL14_ROWS[Number(no) - 1];
      expect(row?.name).toBe(name);
      expect(row?.sha256).toBe(hash);
      const original = readFileSync(`${ORIGINAL}/01_SKILL_IMAGES/Gaul_Skill_${no}.png`);
      expect(sha256(original)).toBe(hash);
      expect([original.readUInt32BE(16), original.readUInt32BE(20)]).toEqual([827, 937]);
      expect(readFileSync(`assets/images/cards/skills/gau14_sk_${no}.png`).equals(original)).toBe(true);
      expect(getSkill(gau(Number(no))).art).toEqual({ category: 'skillCards', file: `gau14_sk_${no}.png`, layout: 'frame' });
    }
  }, 30000);

  it('番号・技名・分類・マナ・ダメージ・効果が、CSV の14行と JSON とゲームのカードですべて一致する', () => {
    const csv = readFileSync(`${ORIGINAL}/02_SKILL_DATA/Gaul_14Skills_UTF8_BOM.csv`, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).slice(1);
    expect(csv).toHaveLength(14);
    const CAT = { strength: 'force', intelligence: 'wisdom', special: 'special', defense: 'defense', dodge: 'evade' } as const;
    csv.forEach((line, i) => {
      const [no, name, category, mana, damage, effect, image, copies] = line.split(',');
      const j = gaulJson[i];
      expect(j).toMatchObject({
        number: Number(no),
        monster: 'ガウル',
        name,
        category,
        mana: Number(mana),
        damage: damage === '' ? null : Number(damage),
        effect,
        image,
        starter_copies: null,
      });
      expect(copies).toBe('');
      const s = getSkill(gau(Number(no)));
      expect(s.id).toBe(`skl-gauul14-${String(no).padStart(2, '0')}`);
      expect(s.designId).toBe(j?.id);
      expect(s.name).toBe(name);
      expect(s.category).toBe(CAT[category as keyof typeof CAT]);
      expect(s.cost).toBe(Number(mana));
      expect(s.stat?.value ?? null).toBe(damage === '' ? null : Number(damage));
      expect(s.effectTextJa ?? '').toBe(effect);
      expect(s.monsterId).toBe('mon-gauul');
      expect(s.isPlaceholder).toBe(false);
      expect(s.rarity).toBeNull();
      // 届いた JSON の初期配布は null のまま（無改変）。区分は 2026-10-26 ユーザー正式確定の初期配布の枚数から（下のテスト）
      expect(s.availability).toBe(GAUUL_INITIAL[Number(no)] ? 'initial' : 'collect');
    });
    expect(GAUUL_SKILLS).toHaveLength(14);
  });

  it('性能の一覧（動き）', () => {
    expect(GAUUL_SKILLS.map((s) => [s.name, s.cost, s.stat?.value ?? null, s.effect])).toEqual([
      ['つつく', 1, 1, { type: 'attack' }],
      ['連続つつき', 2, 2, { type: 'attack' }],
      ['かぎ爪', 3, 3, { type: 'attack' }],
      ['急降下アタック', 4, 4, { type: 'attack' }],
      ['スパイラルダイブ', 5, 5, { type: 'attack' }],
      ['火の粉', 2, 2, { type: 'attack' }],
      ['ファイアボール', 3, 3, { type: 'attack' }],
      ['フレアレイ', 5, 4, { type: 'attack' }],
      ['聖なる炎', 4, 4, { type: 'attack', undodgeable: true }],
      ['威嚇', 2, null, { type: 'seal' }],
      ['翼の盾', 2, null, { type: 'defense', reduce: 3, against: 'force' }],
      ['炎の壁', 2, null, { type: 'defense', reduce: 3, against: 'all' }],
      ['上に飛ぶ', 2, null, { type: 'evade', against: 'all', minCost: 2 }],
      ['高速飛行', 2, null, { type: 'evade', against: 'all' }],
    ]);
  });

  it('旧16技（skl-gauul-01〜16）はカードの一覧にない。削除したカードとして扱う', () => {
    expect(GAUUL_OLD_SKILL_IDS).toHaveLength(16);
    for (const id of GAUUL_OLD_SKILL_IDS) {
      expect(SKILLS.some((s) => s.id === id)).toBe(false);
      expect(REMOVED_CARD_IDS).toContain(id);
    }
    expect(skillsOf('mon-gauul').map((s) => s.id)).toEqual(Array.from({ length: 14 }, (_, i) => gau(i + 1)));
    expect(existsSync('assets/images/cards/skills/gau_sk_01.webp')).toBe(false);
  });

  it('モンスター：ライフ 6・枠色オレンジ・正式カードとバトル用の絵', () => {
    expect(GAUUL_MONSTER.id).toBe('mon-gauul');
    expect(GAUUL_MONSTER.life).toBe(6);
    expect(GAUUL_MONSTER.themeColor).toBe('#E68A46');
    expect(GAUUL_MONSTER.art?.file).toBe('gauul_official.webp');
    expect(GAUUL_MONSTER.battleArt?.file).toBe('gauul_battle.webp');
    expect(MONSTERS.filter((m) => m.id === 'mon-gauul')).toHaveLength(1);
  });

  it('技カード新UI（v5）のガウルの色（オレンジ）の枠が全分類にある', () => {
    for (const size of ['normal', 'hand']) {
      for (const cat of ['force', 'wisdom', 'special', 'defense', 'evade']) {
        expect(existsSync(`assets/images/ui/skillcard_v5/frame_${size}_${cat}_gauul.png`)).toBe(true);
      }
    }
  });

  it('初期配布16枚（2026-10-26 ユーザー正式確定）：01・06 が3枚、02・07・10 が2枚、03・11・12・13 が1枚', () => {
    expect(GAUUL_STARTER).toEqual(Object.entries(GAUUL_INITIAL).map(([no, copies]) => ({ id: gau(Number(no)), copies })));
    expect(GAUUL_STARTER.reduce((n, s) => n + s.copies, 0)).toBe(16);
    GAUUL_SKILLS.forEach((s, i) => expect(s.availability).toBe(GAUUL_INITIAL[i + 1] ? 'initial' : 'collect'));
  });

  it('新しく始めたときの所持カードにだけ入る（初期デッキ60枚・モンスターカード本体・パック・相手の編成には入れない）', () => {
    const save = createNewSave();
    for (const s of GAUUL_STARTER) expect(save.collection[s.id]).toBe(s.copies);
    for (const n of [4, 5, 8, 9, 14]) expect(save.collection[gau(n)]).toBeUndefined();
    expect(save.collection['mon-gauul']).toBeUndefined();
    for (const p of PACKS) expect(p.cardIds.some((id) => id.includes('gauul'))).toBe(false);
    const starter = createStarterDeck();
    expect(starter.monsters).not.toContain('mon-gauul');
    expect(starter.skills.some((id) => id.includes('gauul'))).toBe(false);
    for (const e of Object.values(ENCOUNTERS)) expect(e.monsters).not.toContain('mon-gauul');
    for (const t of TOURNAMENTS) for (const r of t.rounds) expect(r.monsters).not.toContain('mon-gauul');
  });

  it('数値の欄：攻撃＝ダメージ、防御＝−3、回避＝「回避」、威嚇＝「効果」', () => {
    setLanguage('ja');
    expect(GAUUL_SKILLS.map((s) => skillValueBadgeText(skillValueBadge(s)))).toEqual(['1', '2', '3', '4', '5', '2', '3', '4', '4', '効果', '-3', '-3', '回避', '回避']);
  });

  it('日本語は効果の文のまま。英語は仮訳で、日本語が残らない', () => {
    setLanguage('ja');
    expect(skillCardFace(getSkill(gau(9))).description).toBe('回避されない');
    // 詳しい表示の説明：「回避されない」は1回だけ（効果テキストと攻撃の印で2回にならない。ラズックのみだれづめも同じ）
    expect(describeSkill(getSkill(gau(9)))).toBe('相手モンスター1体にかしこさで4ダメージ。回避されない');
    expect(describeSkill(getSkill(laz(4))).match(/回避されない/g)).toHaveLength(1);
    expect(skillCardFace(getSkill(gau(14))).description).toBe('消費マナに関係なく、すべてのちから技・かしこさ技を回避する。');
    setLanguage('en');
    expect(cardName(GAUUL_MONSTER)).toBe('Gaul');
    for (const s of GAUUL_SKILLS) {
      expect(cardName(s)).not.toMatch(/[ぁ-んァ-ン一-龯]/);
      expect(skillCardFace(s).description).not.toMatch(/[ぁ-んァ-ン一-龯]/);
    }
    setLanguage('ja');
  });
});

/* ---------- バトル ---------- */

// 自分：ガウル（m1）・ラズック（m2）・ソラモ（m3）。相手も同じ
const deck = { monsters: ['mon-gauul', 'mon-lazuck', 'mon-soramo'], skills: Array.from({ length: 60 }, () => sor(1)) };

function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}): BattleState {
  const s = createBattle({ name: 'P', deck }, { name: 'O', deck }, 11, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 10 }, () => sor(1)),
  });
  return { ...s, phase: 'main', active: 'player', manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const monster = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};

/** player が target に attack を使い、守備側（opponent）の guard の使用可否を返す */
function guardUsable(attack: string, target: string, guard: string): { usable: boolean; reason: string | null } {
  let s = scene({ player: [attack], opponent: [guard] });
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: target });
  expect(s.phase).toBe('defense');
  return cardUsability(s, 'opponent', 'o0');
}

/** player が攻撃し、opponent が guards を使ったあとの、狙われたモンスターのライフ */
function lifeAfter(attack: string, target: string, guards: string[]): number {
  let s = scene({ player: [attack], opponent: guards });
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: target });
  guards.forEach((_, i) => {
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: `o${i}` });
  });
  if (s.phase === 'defense') s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
  return monster(s, target).life;
}

describe('ガウルの技の効果', () => {
  it('攻撃01〜08：マナを払い、印字のダメージをそのまま与える（守備なし）', () => {
    for (let n = 1; n <= 8; n++) {
      const s = getSkill(gau(n));
      expect(lifeAfter(gau(n), 'o-m3', [])).toBe(Math.max(0, 7 - (s.stat?.value ?? 0)));
    }
  });

  it('09 聖なる炎：マナ4・ダメージ4。どの回避でも避けられない（条件の合う回避でも不可）が、防御はできる', () => {
    const atk = gau(9);
    expect(lifeAfter(atk, 'o-m3', [])).toBe(3); // ソラモ 7 − 4
    // 回避：ガウル13（マナ2以上）・ガウル14（条件なし）・ラズック14 フェイントステップ（条件なし）・ソラモ13・14
    expect(guardUsable(atk, 'o-m1', gau(13))).toEqual({ usable: false, reason: 'この攻撃は回避できません' });
    expect(guardUsable(atk, 'o-m1', gau(14))).toEqual({ usable: false, reason: 'この攻撃は回避できません' });
    expect(guardUsable(atk, 'o-m2', laz(14)).usable).toBe(false);
    expect(guardUsable(atk, 'o-m3', sor(13)).usable).toBe(false);
    expect(guardUsable(atk, 'o-m3', sor(14)).usable).toBe(false);
    // 防御は使える：炎の壁（ちから・かしこさ−3）。翼の盾（ちから−3）はかしこさ技なので使えない
    expect(guardUsable(atk, 'o-m1', gau(12)).usable).toBe(true);
    expect(guardUsable(atk, 'o-m1', gau(11)).usable).toBe(false);
    expect(lifeAfter(atk, 'o-m1', [gau(12)])).toBe(5); // 4 − 3 → 1
  });

  it('09 の「回避されない」は相手の思考（AI）でも同じ：回避を選ばず、守備しない', () => {
    let s = scene({ player: [gau(9)], opponent: [gau(14)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(chooseAction(s, 'opponent')).toEqual({ type: 'defend', side: 'opponent', cardUid: null });
  });

  it('10 威嚇：選んだ相手モンスター1体は、持ち主の次の手番に攻撃の技を使えない（ほかのモンスターは使える）', () => {
    const s = applyAction(scene({ player: [gau(10)] }), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(monster(s, 'o-m1').sealedTurn).toBe(s.turn + 1);
    expect(monster(s, 'o-m2').sealedTurn ?? null).toBeNull();
    expect(s.sides.player.manaPile).toHaveLength(8);
    // 相手の次の手番：ガウル（o-m1）の攻撃は使えない
    const next: BattleState = {
      ...s,
      turn: s.turn + 1,
      active: 'opponent',
      phase: 'main',
      sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: [{ uid: 'x0', cardId: gau(1) }] } },
    };
    expect(cardUsability(next, 'opponent', 'x0')).toEqual({ usable: false, reason: 'このターンは攻撃できません（攻撃を封じられています）' });
  });

  it('11 翼の盾：ちから技だけ−3。12 炎の壁：ちから技・かしこさ技とも−3。0 未満にならない', () => {
    expect(lifeAfter(gau(5), 'o-m1', [gau(11)])).toBe(4); // スパイラルダイブ 5 − 3 → 2
    expect(lifeAfter(gau(2), 'o-m1', [gau(11)])).toBe(6); // 2 − 3 → 0
    expect(guardUsable(gau(7), 'o-m1', gau(11))).toEqual({ usable: false, reason: 'かしこさ攻撃には使えません' });
    expect(lifeAfter(gau(5), 'o-m1', [gau(12)])).toBe(4);
    expect(lifeAfter(gau(8), 'o-m1', [gau(12)])).toBe(5); // フレアレイ 4 − 3 → 1
    expect(lifeAfter(gau(6), 'o-m1', [gau(12)])).toBe(6); // 火の粉 2 − 3 → 0
  });

  it('13 上に飛ぶ：攻撃カードの必要マナが2以上のちから・かしこさ技を回避。1以下は使えない', () => {
    expect(guardUsable(gau(1), 'o-m1', gau(13))).toEqual({ usable: false, reason: '必要マナ2以上の攻撃にしか使えません' }); // つつく マナ1
    expect(guardUsable(laz(1), 'o-m1', gau(13)).usable).toBe(false); // ひっかき マナ0
    expect(guardUsable(gau(2), 'o-m1', gau(13)).usable).toBe(true); // 連続つつき マナ2（境目）
    expect(guardUsable(gau(6), 'o-m1', gau(13)).usable).toBe(true); // 火の粉 マナ2（かしこさ）
    expect(lifeAfter(gau(5), 'o-m1', [gau(13)])).toBe(6);
    expect(lifeAfter(gau(8), 'o-m1', [gau(13)])).toBe(6);
  });

  it('14 高速飛行：必要マナ0・1も含む、すべてのちから・かしこさ技を回避（回避されない攻撃は除く）', () => {
    expect(guardUsable(laz(1), 'o-m1', gau(14)).usable).toBe(true); // ひっかき マナ0
    expect(guardUsable(gau(1), 'o-m1', gau(14)).usable).toBe(true);
    expect(guardUsable(gau(7), 'o-m1', gau(14)).usable).toBe(true);
    expect(lifeAfter(gau(5), 'o-m1', [gau(14)])).toBe(6);
    expect(lifeAfter(gau(8), 'o-m1', [gau(14)])).toBe(6);
    expect(guardUsable(laz(4), 'o-m1', gau(14)).usable).toBe(false); // みだれづめ（回避されない）
  });

  it('必要マナの判定は攻撃カードの印字の値で、攻撃側の残りマナには左右されない', () => {
    // 攻撃側のマナをちょうど使い切っても（残り0）、マナ2の攻撃は「必要マナ2以上」
    let s = scene({ player: [gau(6)], opponent: [gau(13)] }, { player: 2 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(s.sides.player.manaPile).toHaveLength(0);
    expect(cardUsability(s, 'opponent', 'o0').usable).toBe(true);
  });

  it('相手の思考（AI）は使えない回避を選ばない', () => {
    let s = scene({ player: [gau(1)], opponent: [gau(13)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(chooseAction(s, 'opponent')).toEqual({ type: 'defend', side: 'opponent', cardUid: null });
  });
});

describe('回避の改訂（2026-10-24）', () => {
  // ソラモの2件は 2026-10-25 のソラモ14技、ガウルの3件は 2026-10-26 のガウル14技（13 上に飛ぶ・14 高速飛行）に置き換わった
  it('ラズックの回避は 2026-10-26 の正式14技に置き換わった（evasion_LATEST の3件は記録として残す）', () => {
    expect(evasionJson.updates.filter((u) => u.monster === 'lazuck')).toHaveLength(3);
    // 13 シャドウスリップ（旧15 の ID）：マナ2・必要マナ2以上のちから/かしこさ。14 フェイントステップ：マナ2・条件なし。旧16 ミラージュダッシュは削除
    expect(getSkill(laz(15)).effect).toEqual({ type: 'evade', against: 'all', minCost: 2 });
    expect(getSkill(laz(14)).effect).toEqual({ type: 'evade', against: 'all' });
    expect(SKILLS.some((s) => s.id === laz(16))).toBe(false);
  });

  it('ソラモの回避（13 ひらりジャンプ・14 星影ステップ）も同じきまりで動く', () => {
    expect(guardUsable(gau(1), 'o-m3', sor(13)).usable).toBe(false); // マナ1 は避けられない
    expect(guardUsable(gau(2), 'o-m3', sor(13)).usable).toBe(true); // マナ2 は避けられる
    expect(guardUsable(laz(1), 'o-m3', sor(14)).usable).toBe(true); // マナ0 も避けられる
  });
});

describe('ラズックのいたずら（2026-10-24）', () => {
  const itazura = getSkill(LAZUCK_ITAZURA_ID);

  it('特殊・マナ2・相手を選ばない。表示は 10（2026-10-26 の正式14技）', () => {
    expect(itazura.category).toBe('special');
    expect(itazura.cost).toBe(2);
    expect(itazura.displayNo).toBe(10);
    expect(itazura.effect).toEqual({ type: 'handToDeck' });
    expect(itazura.availability).toBe('collect');
  });

  const useItazura = (opponentHand: string[]): BattleState => {
    const s = scene({ player: [LAZUCK_ITAZURA_ID], opponent: opponentHand });
    return applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
  };

  it('相手の手札が複数：1枚が相手の山札に戻り、山札がシャッフルされる。補充はしない', () => {
    const before = scene({ player: [LAZUCK_ITAZURA_ID], opponent: [gau(1), gau(2), gau(3)] });
    const after = useItazura([gau(1), gau(2), gau(3)]);
    expect(after.sides.opponent.hand).toHaveLength(2);
    expect(after.sides.opponent.deck).toHaveLength(before.sides.opponent.deck.length + 1);
    const returned = [gau(1), gau(2), gau(3)].find((id) => !after.sides.opponent.hand.some((c) => c.cardId === id));
    expect(after.sides.opponent.deck).toContain(returned);
    expect(after.seed).not.toBe(before.seed);
    expect(after.sides.player.manaPile).toHaveLength(8); // マナ2を払った
    expect(after.phase).toBe('main');
  });

  it('相手の手札が1枚：その1枚が戻り、手札は0枚', () => {
    const after = useItazura([gau(5)]);
    expect(after.sides.opponent.hand).toEqual([]);
    expect(after.sides.opponent.deck).toContain(gau(5));
  });

  it('相手の手札が0枚：「相手は手札がありません」と出て使えない（2026-10-24 ユーザー決定）', () => {
    const before = scene({ player: [LAZUCK_ITAZURA_ID], opponent: [] });
    expect(cardUsability(before, 'player', 'p0')).toEqual({ usable: false, reason: '相手は手札がありません' });
    expect(applyAction(before, { type: 'useCard', side: 'player', cardUid: 'p0' })).toBe(before);
  });

  it('戻したカードは、相手の次のドローで引かれることがある（山札のどこかに入る）', () => {
    const after = useItazura([gau(10)]);
    const pos = after.sides.opponent.deck.indexOf(gau(10));
    expect(pos).toBeGreaterThanOrEqual(0);
    expect(after.sides.opponent.deck.filter((id) => id === gau(10))).toHaveLength(1);
  });

  it('相手の思考（AI）は、相手の手札が2枚以上あるときに使う', () => {
    const s: BattleState = { ...scene({ opponent: [LAZUCK_ITAZURA_ID], player: [gau(1), gau(2)] }), active: 'opponent' };
    const action = chooseAction(s, 'opponent');
    expect(action).toEqual({ type: 'useCard', side: 'opponent', cardUid: 'o0' });
  });
});

describe('クロスガードの削除と旧セーブ（version 8）', () => {
  /** version 7 のセーブ（新しいデッキのかみつき〔3枚〕のうち2枚をクロスガードに替え、クロスガードを2枚持っている） */
  const oldSave = () => {
    const save = createNewSave();
    let swapped = 0;
    const deckSkills = save.deck.skills.map((id) => (id === laz(2) && swapped < 2 ? (swapped++, LAZUCK_CROSS_GUARD_ID) : id));
    const collection: Record<string, number> = { ...save.collection, [laz(2)]: 1, [LAZUCK_CROSS_GUARD_ID]: 2 };
    return { ...save, version: 7, deck: { ...save.deck, skills: deckSkills }, collection };
  };

  it('所持・デッキからクロスガードが消え、デッキの抜けた分は持っているカードで埋まる（代わりのカードは配らない）', () => {
    // デッキに入れていない予備のカード（かみつきをもう2枚）を持っている
    const save = oldSave();
    expect(save.deck.skills.filter((id) => id === LAZUCK_CROSS_GUARD_ID)).toHaveLength(2);
    const loaded = normalizeSave(JSON.parse(JSON.stringify({ ...save, collection: { ...save.collection, [laz(2)]: 3 } })));
    if (!loaded) throw new Error('読み込めない');
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.collection[LAZUCK_CROSS_GUARD_ID]).toBeUndefined();
    expect(loaded.deck.skills).not.toContain(LAZUCK_CROSS_GUARD_ID);
    expect(loaded.deck.skills).toHaveLength(60);
    expect(validateDeck(loaded.deck, loaded.collection)).toEqual([]);
  });

  it('埋める予備のカードがなければ、デッキは足りないまま（デッキ編集で直す。カードは配らない）', () => {
    const loaded = normalizeSave(JSON.parse(JSON.stringify(oldSave())));
    if (!loaded) throw new Error('読み込めない');
    expect(loaded.deck.skills).toHaveLength(58);
    expect(loaded.deck.skills).not.toContain(LAZUCK_CROSS_GUARD_ID);
    expect(validateDeck(loaded.deck, loaded.collection).length).toBeGreaterThan(0);
  });

  it('クロスガードの入ったバックアップも読み込める（読み込むときに外す）', () => {
    const text = JSON.stringify({ format: BACKUP_FORMAT, formatVersion: 1, exportedAt: null, save: oldSave() });
    const result = parseBackup(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.save.deck.skills).not.toContain(LAZUCK_CROSS_GUARD_ID);
  });

  it('クロスガードはカードの一覧にない', () => {
    expect(SKILLS.some((s) => s.id === LAZUCK_CROSS_GUARD_ID)).toBe(false);
    expect(skillsOf('mon-lazuck')).toHaveLength(14);
  });
});

describe('旧ガウル16技の削除と旧セーブ（version 10）', () => {
  /** version 9 のセーブ：旧ガウルの技を持ち、デッキにも入れている。spare＝デッキから外した4枚もまだ持っている */
  const oldSave = (spare = false) => {
    const save = createNewSave();
    const oldGaul = ['skl-gauul-01', 'skl-gauul-02'];
    const kept = save.deck.skills.slice(0, 56);
    const skills = [...kept, ...oldGaul, ...oldGaul];
    // 持っているのはデッキに入っている分だけ（予備なし）＋旧ガウル（spare のときは外した4枚も）
    const own = countCards([...save.deck.monsters, ...(spare ? save.deck.skills : kept)]);
    const collection: Record<string, number> = { ...own, 'skl-gauul-01': 2, 'skl-gauul-02': 2, 'skl-gauul-16': 3 };
    return { ...save, version: 9, deck: { ...save.deck, skills }, collection };
  };

  it('所持・デッキから旧16技が消え、デッキの抜けた分は持っているカードで埋まる（代わりのカードは配らない）', () => {
    const loaded = normalizeSave(JSON.parse(JSON.stringify(oldSave(true))));
    if (!loaded) throw new Error('読み込めない');
    expect(loaded.version).toBe(SAVE_VERSION);
    for (const id of GAUUL_OLD_SKILL_IDS) expect(loaded.collection[id]).toBeUndefined();
    expect(loaded.deck.skills.some((id) => id.startsWith('skl-gauul-'))).toBe(false);
    expect(Object.keys(loaded.collection).some((id) => id.startsWith('skl-gauul14-'))).toBe(false);
    expect(loaded.deck.skills).toHaveLength(60);
    expect(validateDeck(loaded.deck, loaded.collection)).toEqual([]);
  });

  it('埋める予備のカードがなければ、デッキは足りないまま（デッキ編集で直す）', () => {
    const loaded = normalizeSave(JSON.parse(JSON.stringify(oldSave())));
    if (!loaded) throw new Error('読み込めない');
    expect(loaded.deck.skills.some((id) => id.startsWith('skl-gauul-'))).toBe(false);
    expect(loaded.deck.skills.length).toBeLessThan(60);
  });

  it('旧ガウルの技の入ったバックアップも読み込める（読み込むときに外す）', () => {
    const text = JSON.stringify({ format: BACKUP_FORMAT, formatVersion: 1, exportedAt: null, save: oldSave() });
    const result = parseBackup(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.save.collection['skl-gauul-16']).toBeUndefined();
  });
});
