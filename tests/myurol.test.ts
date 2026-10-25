import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSkill, MONSTERS, SKILLS } from '../src/data/cards.ts';
import { PACKS } from '../src/data/economy.ts';
import { MYUROL_DISTRIBUTION_PROPOSAL, MYUROL_MONSTER, MYUROL_ROWS, MYUROL_SKILLS, myurolSkillId } from '../src/data/myurol.ts';
import myurolJson from '../src/data/official/myurol_skills_OFFICIAL_20261025.json';
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
import { createNewSave } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

const myu = (n: number): string => myurolSkillId(n);
const sor = (n: number): string => soramoSkillId(n);
const ORIGINAL_DIR = 'design-parts/cards-original/myurol';

/** 届いた 01_技一覧_UTF8.csv の行（BOM 付き・カンマ区切り。効果の文にカンマは無い） */
function csvRows(path: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text.trim().split(/\r?\n/).slice(1).map((line) => line.split(','));
}

/** 画像の幅・高さ（PNG は IHDR、JPEG は SOF0〜SOF2 の印から読む） */
function imageSize(buf: Buffer): [number, number] {
  if (buf.readUInt32BE(0) === 0x89504e47) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error('JPEG の印が読めません');
    const marker = buf[i + 1] as number;
    if (marker >= 0xc0 && marker <= 0xc2) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error('JPEG の大きさが見つかりません');
}

const sha256 = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

describe('ミュロル16技：正式データ（2026-10-25。届いた JSON・CSV を無改変で置き、ゲームはその JSON を読む）', () => {
  const CATEGORY = { ちから: 'force', かしこさ: 'wisdom', 特殊: 'special', 防御: 'defense', 回避: 'evade' } as const;

  it('保管した JSON・CSV は ZIP の原本と同じバイト列', () => {
    expect(readFileSync('src/data/official/myurol_skills_OFFICIAL_20261025.json')).toEqual(readFileSync(`${ORIGINAL_DIR}/02_技データ_UTF8.json`));
    expect(readFileSync('src/data/official/myurol_skills_OFFICIAL_20261025.csv')).toEqual(readFileSync(`${ORIGINAL_DIR}/01_技一覧_UTF8.csv`));
  });

  it('番号・技名・種別・マナ・効果・画像ファイル名が、CSV の16行と JSON とゲームのカードですべて一致する', () => {
    const rows = csvRows(`${ORIGINAL_DIR}/01_技一覧_UTF8.csv`);
    expect(rows).toHaveLength(16);
    expect(myurolJson.skills).toHaveLength(16);
    rows.forEach(([id, no, name, type, mana, effect, proposal, confirmed, image], i) => {
      const j = myurolJson.skills[i];
      expect(j).toEqual({
        id,
        number: Number(no),
        name,
        type,
        mana: Number(mana),
        effect_text: effect,
        distribution_proposal: proposal,
        distribution_confirmed: confirmed === 'True',
        image,
      });
      const nn = String(no).padStart(2, '0');
      expect(id).toBe(`myurol_${nn}`);
      expect(Number(no)).toBe(i + 1);
      const s = getSkill(myu(Number(no)));
      expect(s.id).toBe(`skl-myurol-${nn}`);
      expect(s.designId).toBe(id);
      expect(s.name).toBe(name);
      expect(s.category).toBe(CATEGORY[type as keyof typeof CATEGORY]);
      expect(s.cost).toBe(Number(mana));
      expect(s.monsterId).toBe('mon-myurol');
      expect(s.isPlaceholder).toBe(false);
      expect(s.rarity).toBeNull();
      // 攻撃は「ダメージn」の数値だけ（効果の文なし）。それ以外は効果の文をそのまま
      if (s.stat) {
        expect(effect).toBe(`ダメージ${s.stat.value}`);
        expect(s.stat.type).toBe(s.category);
        expect(s.effectTextJa).toBeNull();
      } else expect(s.effectTextJa).toBe(effect);
      // 画像：JSON の image（SKILLS/Myurol_NN_技名.png|jpg）の番号・拡張子どおり
      expect(image).toBe(`SKILLS/Myurol_${nn}_${name}.${Number(no) <= 7 ? 'png' : 'jpg'}`);
      expect(s.art).toEqual({ category: 'skillCards', file: `myu_sk_${nn}.${Number(no) <= 7 ? 'png' : 'jpg'}`, layout: 'frame' });
    });
    expect(MYUROL_SKILLS).toHaveLength(16);
    expect(new Set(MYUROL_SKILLS.map((s) => s.id)).size).toBe(16);
    expect(new Set(MYUROL_SKILLS.map((s) => s.art?.file)).size).toBe(16);
  });

  it('性能の一覧（技名・種別・マナ・ダメージ・軽減・回避の条件）', () => {
    const summary = MYUROL_SKILLS.map((s) => [s.name, s.category, s.cost, s.stat?.value ?? null, s.effect]);
    expect(summary).toEqual([
      ['たいあたり', 'force', 1, 1, { type: 'attack' }],
      ['しっぽたたき', 'force', 2, 2, { type: 'attack' }],
      ['連続ひっかき', 'force', 3, 3, { type: 'attack' }],
      ['アクアテール', 'force', 4, 4, { type: 'attack' }],
      ['みずでっぽう', 'wisdom', 1, 1, { type: 'attack' }],
      ['バブルショット', 'wisdom', 2, 2, { type: 'attack' }],
      ['アクアボール', 'wisdom', 3, 3, { type: 'attack' }],
      ['しめったはだ', 'special', 2, null, { type: 'shield', against: 'force', reduce: 1, turns: 2 }],
      ['みずあび', 'special', 3, null, { type: 'healSelf', amount: 1 }],
      ['しっぽガード', 'defense', 1, null, { type: 'defense', reduce: 2, against: 'force' }],
      ['みずのまく', 'defense', 1, null, { type: 'defense', reduce: 2, against: 'wisdom' }],
      ['ぬるぬるガード', 'defense', 1, null, { type: 'defense', reduce: 2, against: 'all' }],
      ['ぷるぷるガード', 'defense', 0, null, { type: 'defense', reduce: 1, against: 'all' }],
      ['スリップガード', 'defense', 2, null, { type: 'defense', reduce: 4, against: 'all', minCost: 3 }],
      ['ひらりよける', 'evade', 2, null, { type: 'evade', against: 'force' }],
      ['すべってよける', 'evade', 3, null, { type: 'evade', against: 'all', maxCost: 2 }],
    ]);
  });

  it('モンスター：ミュロル・ライフ7・ランクは画面に出さない。モンスターカードの絵はまだ無い（仮の絵で表示）', () => {
    expect(myurolJson.monster).toBe('ミュロル');
    expect(myurolJson.rank).toBe('C');
    expect(myurolJson.life).toBe(7);
    expect(myurolJson.images_approved).toBe(true);
    expect(MYUROL_MONSTER.id).toBe('mon-myurol');
    expect(MYUROL_MONSTER.name).toBe('ミュロル');
    expect(MYUROL_MONSTER.life).toBe(7);
    expect(MYUROL_MONSTER.art).toBeUndefined();
    expect(MYUROL_MONSTER.pendingSpec).toContain('art');
    expect(MONSTERS.filter((m) => m.id === 'mon-myurol')).toHaveLength(1);
    expect(SKILLS.filter((s) => s.monsterId === 'mon-myurol')).toHaveLength(16);
  });
});

describe('ミュロル16技：画像（正式採用。変換・再圧縮・描き直しなし）', () => {
  // 03_画像対応・検証_UTF8.txt：番号・ファイル名・形式・寸法・容量・SHA256（タブ区切り）
  const table = readFileSync(`${ORIGINAL_DIR}/03_画像対応・検証_UTF8.txt`, 'utf8')
    .replace(/^﻿/, '')
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split('\t'));

  it('ゲームの絵16枚は、JSON の image に書かれた原本と1バイトも違わない（SHA-256・容量・形式・寸法が照合表どおり）', () => {
    expect(table).toHaveLength(16);
    for (const row of MYUROL_ROWS) {
      const nn = String(row.number).padStart(2, '0');
      const [no, file, format, dims, size, hash] = table[row.number - 1] as string[];
      expect(no).toBe(nn);
      expect(`SKILLS/${file}`).toBe(row.image);
      const original = readFileSync(`${ORIGINAL_DIR}/${row.image}`);
      const skill = getSkill(myu(row.number));
      const game = readFileSync(`assets/images/cards/skills/${skill.art?.file}`);
      expect(sha256(original)).toBe(hash);
      expect(sha256(game)).toBe(hash);
      expect(game.length).toBe(Number(size?.replace(' bytes', '')));
      expect(format).toBe(row.number <= 7 ? 'PNG' : 'JPEG');
      expect(imageSize(game).join('x')).toBe(dims);
    }
    // 16枚とも別の絵
    expect(new Set(table.map((r) => r[5])).size).toBe(16);
  }, 30000);

  it('カードの絵の枠（827×937）とほぼ同じ縦横比。表示は縦横比を保って全体を入れる（切れない）', () => {
    const frame = 827 / 937;
    for (const row of table) {
      const [w, h] = (row[3] as string).split('x').map(Number) as [number, number];
      expect(Math.abs(w / h - frame) / frame).toBeLessThan(0.002);
    }
    expect(readFileSync('src/ui/styles/cards.css', 'utf8')).toMatch(/\.skill-card__art \{[^}]*object-fit: contain;/);
  });
});

describe('ミュロル16技：初期配布・収集用は「案」のまま（確定していない）', () => {
  it('JSON の区分は案（distribution_confirmed: false）。ゲームの区分には入れず、画面にも出さない', () => {
    expect(myurolJson.distribution_confirmed).toBe(false);
    for (const row of MYUROL_ROWS) expect(row.distribution_confirmed).toBe(false);
    for (const s of MYUROL_SKILLS) {
      expect(s.availability).toBeUndefined();
      expect(s.pendingSpec).toEqual(['rarity', 'availability']);
    }
    const initial = Object.entries(MYUROL_DISTRIBUTION_PROPOSAL).filter(([, v]) => v === 'initial').map(([k]) => k);
    expect(initial).toEqual([1, 2, 5, 6, 8, 10, 11, 13].map(myu));
    const collect = Object.entries(MYUROL_DISTRIBUTION_PROPOSAL).filter(([, v]) => v === 'collectible').map(([k]) => k);
    expect(collect).toEqual([3, 4, 7, 9, 12, 14, 15, 16].map(myu));
  });

  it('パック・スターター・相手の編成にはまだ入れていない（配る枚数・敵の編成は未定）', () => {
    for (const p of PACKS) expect(p.cardIds.some((id) => id.includes('myurol'))).toBe(false);
    expect(createNewSave().deck.monsters).not.toContain('mon-myurol');
  });
});

describe('ミュロル16技：表示（既存の技カードの部品で描く）', () => {
  it('カード面：日本語は効果の文のまま・マナの数字。英語は仮訳で、日本語が残らない', () => {
    setLanguage('ja');
    expect(skillCardFace(getSkill(myu(8))).description).toBe('発動ターンを含む2ターン、受けるちから技ダメージ-1（重複なし）');
    expect(skillCardFace(getSkill(myu(16))).description).toBe('相手の消費マナ2以下のちから・かしこさ技を完全回避');
    expect(skillCardFace(getSkill(myu(13))).mana).toBe(0);
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

describe('ミュロル16技：効果（細かい裁定は docs/battle-rules.md「正式カード（ミュロル）」）', () => {
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

  it('10〜13 防御：ちから−2／かしこさ−2／両方−2／両方−1（マナ0）。0未満にならない。種類が違えば使えない', () => {
    expect(monster(attackWith(myu(4), [myu(10)]), 'o-m1').life).toBe(5);
    expect(monster(attackWith(myu(7), [myu(11)]), 'o-m1').life).toBe(6);
    expect(monster(attackWith(myu(4), [myu(12)]), 'o-m1').life).toBe(5);
    expect(monster(attackWith(myu(7), [myu(12)]), 'o-m1').life).toBe(6);
    expect(monster(attackWith(myu(3), [myu(13)], { opponent: 0 }), 'o-m1').life).toBe(5);
    expect(monster(attackWith(myu(1), [myu(10)]), 'o-m1').life).toBe(7);
    const w = underAttack(myu(5), [myu(10), myu(11), myu(12), myu(13)]);
    expect(cardUsability(w, 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'かしこさ攻撃には使えません' });
    for (const uid of ['o1', 'o2', 'o3']) expect(cardUsability(w, 'opponent', uid).usable).toBe(true);
    const f = underAttack(myu(1), [myu(10), myu(11)]);
    expect(cardUsability(f, 'opponent', 'o0').usable).toBe(true);
    expect(cardUsability(f, 'opponent', 'o1')).toMatchObject({ usable: false, reason: 'ちから攻撃には使えません' });
  });

  it('14 スリップガード：攻撃カードの必要マナが3以上のときだけ使える（−4）。攻撃側・守備側のいまのマナの残りでは決まらない', () => {
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

  it('15 ひらりよける：ちから技を完全回避。かしこさ技には使えない', () => {
    expect(monster(attackWith(myu(4), [myu(15)]), 'o-m1').life).toBe(7);
    const w = underAttack(myu(5), [myu(15)]);
    expect(cardUsability(w, 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'かしこさ攻撃には使えません' });
  });

  it('16 すべってよける：攻撃カードの必要マナが2以下のちから・かしこさ技を完全回避。3以上には使えない（いまのマナの残りでは決まらない）', () => {
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
    let other = scene({ player: [myu(4)], opponent: [myu(12)] });
    other = applyAction(other, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(cardUsability(other, 'opponent', 'o0').usable).toBe(false);
  });

  it('ミュロル同士で、相手の思考どうしが最後まで対戦できる（16種すべてを含むデッキ）', () => {
    const skills = [...Array.from({ length: 48 }, (_, i) => myu((i % 16) + 1)), ...Array.from({ length: 12 }, () => sor(1))];
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
