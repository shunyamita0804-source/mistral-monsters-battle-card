import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { getSkill, MONSTERS, SKILLS } from '../src/data/cards.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { BARCA_ALTAR_OWED_FLAG, BARCA_BEATEN_FLAG, DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { RUN_DUNGEONS } from '../src/data/dungeonRun.ts';
import { GACHA_SERIES, gachaSeenFlag } from '../src/data/economy.ts';
import shishienJson from '../src/data/official/shishien14_skills_OFFICIAL_20261030.json';
import { SHISHIEN_COLOR, SHISHIEN_GACHA_RARE, SHISHIEN_MONSTER, SHISHIEN_MONSTER_ID, SHISHIEN_PLAYTEST_16, SHISHIEN_SKILLS, shishienSkillId } from '../src/data/shishien.ts';
import { SKILL_CARD_TEXT } from '../src/data/skillCardText.ts';
import { soramoSkillId } from '../src/data/soramo.ts';
import { chooseAction, CPU_SKILL } from '../src/game/battle/ai.ts';
import { applyAction, cardUsability, createBattle, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { availableGachaSeriesFor } from '../src/game/economy/gachaSeries.ts';
import { bossRewardCandidates, bossTrumpSkills, rollChest, runFloor, startRun, winRunBattle } from '../src/game/dungeon/run.ts';
import { createNewSave, normalizeSave, SAVE_VERSION, type SaveData } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/**
 * シシエン（2026-10-31 指示書 AB【1】「シシエン（炎の火山の新しい切り札）」。design-parts/cards-original/shishien/00_instructions_for_claude_code.txt）。
 * 新しい決まり：07・08・09 の捨て身（今のエンジンの selfDamageOnHit）。裁定は docs/battle-rules.md「シシエンの効果の扱い」
 */

const shi = (n: number): string => shishienSkillId(n);
const sor = (n: number): string => soramoSkillId(n);
const ORIGINAL_DIR = 'design-parts/cards-original/shishien';
const FIRE = 'dungeon-05';
const BARCA_TEAM = ['mon-gauul', SHISHIEN_MONSTER_ID, 'mon-lazuck'];
const base = (): SaveData => createNewSave(new Date('2026-10-31T00:00:00Z'), 'balance');

function csvRows(path: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text.trim().split(/\r?\n/).slice(1).map((line) => line.split(','));
}

describe('シシエン：データ（届いた JSON・CSV を無改変で置き、ゲームはその JSON を読む）', () => {
  it('保管した JSON・CSV・バトル用の絵は ZIP の原本と同じバイト列', () => {
    for (const f of ['shishien14_skills_OFFICIAL_20261030.json', 'shishien14_skills_OFFICIAL_20261030.csv']) {
      expect(readFileSync(`src/data/official/${f}`).equals(readFileSync(`${ORIGINAL_DIR}/${f}`)), f).toBe(true);
    }
    expect(readFileSync('assets/images/cards/monsters/shishien_battlecard.png').equals(readFileSync(`${ORIGINAL_DIR}/shishien_battleart.png`))).toBe(true);
  });

  it('CSV の14行・JSON・ゲームのカードで、番号・名前・分類・マナ・ダメージ・効果がすべて一致する', () => {
    const CATEGORY = { ちから技: 'force', かしこさ技: 'wisdom', 防御技: 'defense', 回避技: 'evade' } as const;
    const rows = csvRows('src/data/official/shishien14_skills_OFFICIAL_20261030.csv');
    expect(rows).toHaveLength(14);
    rows.forEach((row, i) => {
      const skill = SHISHIEN_SKILLS[i];
      const json = shishienJson.skills[i];
      if (!skill || !json) throw new Error(String(i));
      expect(row[0]).toBe(String(json.no));
      expect(row[1]).toBe(json.name);
      expect(row[2]).toBe(json.category);
      expect(row[3]).toBe(String(json.mana));
      expect(row[4]).toBe(json.damage);
      expect(row[5]).toBe(json.effect);
      expect(skill.id).toBe(shi(i + 1));
      expect(json.id).toBe(skill.id);
      expect(skill.name).toBe(json.name);
      expect(skill.category).toBe(CATEGORY[json.category as keyof typeof CATEGORY]);
      expect(skill.cost).toBe(json.mana);
      expect(skill.stat?.value ?? '―').toBe(json.damage === '―' ? '―' : Number(json.damage));
      expect(skill.effectTextJa ?? 'なし').toBe(SKILL_CARD_TEXT[skill.id] ?? json.effect);
    });
  });

  it('カードに書く短い文：捨て身は「当たると自分のライフ−1」・14 はかぜよみと同じ文。JSON の文は変えない', () => {
    for (const n of [7, 8, 9]) expect(getSkill(shi(n)).effectTextJa).toBe('当たると自分のライフ−1');
    expect(getSkill(shi(14)).effectTextJa).toBe(getSkill('skl-tsumuji-14').effectTextJa);
    expect(getSkill(shi(11)).effectTextJa).toBe('ちから技に効く');
    expect(getSkill(shi(12)).effectTextJa).toBe('ちから技・かしこさ技に効く');
    expect(getSkill(shi(13)).effectTextJa).toBe('ちから技を回避');
    expect(shishienJson.skills[6]?.effect).toBe('当たったら自分のライフ−1（捨て身）');
  });

  it('モンスター：ライフ7・炭色・ID mon-shishien。内部ランク B。レアの枠は 09・10・14。枠の絵がある', () => {
    expect(SHISHIEN_MONSTER).toMatchObject({ id: 'mon-shishien', life: 7, name: 'シシエン', isPlaceholder: false });
    expect(shishienJson.monster_rank).toBe('B');
    expect(SHISHIEN_COLOR).toBe('#3E3A3F');
    expect(SHISHIEN_GACHA_RARE).toEqual([shi(9), shi(10), shi(14)]);
    expect(BATTLE_CARDS[SHISHIEN_MONSTER_ID]?.frame).toBe('shishien');
    expect(existsSync('assets/images/ui/battlecard/frame_shishien.png')).toBe(true);
    for (const size of ['normal', 'hand']) expect(existsSync(`assets/images/ui/skillcard_simple/frame_${size}_shishien.webp`)).toBe(true);
  });

  it('ふつうの一覧に入り、図鑑の番号はヒョウズクのあと（No.181〜195）', () => {
    expect(MONSTERS.some((m) => m.id === SHISHIEN_MONSTER_ID)).toBe(true);
    expect(SKILLS.filter((s) => s.monsterId === SHISHIEN_MONSTER_ID).map((s) => s.id)).toEqual(SHISHIEN_SKILLS.map((s) => s.id));
    const book = cardBookEntries();
    expect(book.find((e) => e.card.id === SHISHIEN_MONSTER_ID)?.no).toBe(181);
    expect(book.find((e) => e.card.id === shi(14))?.no).toBe(195);
    expect(book.find((e) => e.card.id === 'skl-hyouzuku-14')?.no).toBe(180);
  });

  it('絵：技14枚・正式モンスターカード・投石の描き直し。原本は無改変で保管（パックの窓の絵は gacha-20261029/ にも）', () => {
    for (let n = 1; n <= 14; n++) {
      const nn = String(n).padStart(2, '0');
      expect(getSkill(shi(n)).art?.file).toBe(`shishien_sk_${nn}.webp`);
      expect(existsSync(`assets/images/cards/skills/shishien_sk_${nn}.webp`)).toBe(true);
      expect(existsSync(`${ORIGINAL_DIR}/shishien_sk_${nn}.png`)).toBe(true);
    }
    expect(SHISHIEN_MONSTER.art?.file).toBe('shishien_official.webp');
    expect(existsSync('assets/images/cards/monsters/shishien_official.webp')).toBe(true);
    // 2026-10-31 指示書 AC【4】：枠の金色をなくした v2 を足した（前の版も残す）
    for (const f of ['shishien_official_monstercard_LIFE7.png', 'shishien_official_monstercard_LIFE7_v2_20261031.png', 'shishien_original_approved.png', 'shishien_3view_approved.png', 'pack_art_shishien.png']) {
      expect(existsSync(`${ORIGINAL_DIR}/${f}`), f).toBe(true);
    }
    expect(readFileSync('design-parts/gacha-20261029/pack_art/pack_art_shishien.png').equals(readFileSync(`${ORIGINAL_DIR}/pack_art_shishien.png`))).toBe(true);
    for (const f of ['art/pack_shishien.png', 'shop/shop_pack_shishien.png', 'shop/shop_card_shishien.png']) expect(existsSync(`design-parts/gacha-20261029/${f}`), f).toBe(true);
    expect(existsSync('assets/images/ui/gacha/pack_shishien.webp')).toBe(true);
    expect(existsSync('assets/images/ui/gacha/panel_shishien.webp')).toBe(true);
    expect(existsSync('design-parts/support-art-ab-20261031/sup_art_01_toseki.png')).toBe(true);
    expect(existsSync('design-parts/support-art-ab-20261031/sup_art_01_toseki_original_1179x1334.png')).toBe(true);
  });

  it('英語の名前（仮訳）', () => {
    setLanguage('en');
    try {
      expect(cardName(SHISHIEN_MONSTER_ID)).toBe('Shishien');
      expect(cardName(shi(9))).toBe('Inferno Rush');
      expect(cardName(shi(14))).toBe('Heat Haze');
    } finally {
      setLanguage('ja');
    }
  });

  it('パックの色（pack_tint.py）・パックの絵・販売機の窓・ショップの棚・枠の色の表にシシエンがある', () => {
    expect(readFileSync('tools/design/pack_tint.py', 'utf8')).toContain("'shishien': '#3E3A3F'");
    expect(readFileSync('tools/design/gacha_series_build.py', 'utf8')).toMatch(/PACKS = \[.*'hyouzuku', 'shishien'(, '[a-z]+')*\]/);
    expect(readFileSync('tools/design/shop_goods_20261030.py', 'utf8')).toMatch(/MONSTERS = \[.*'hyouzuku', 'shishien'.*\]/);
    expect(readFileSync('tools/design/gacha_panel_build.py', 'utf8')).toContain("'shishien': (");
    for (const f of ['tools/art/skillcard_simple_build.py', 'tools/art/skillcard_v3_build.py']) expect(readFileSync(f, 'utf8')).toContain("'shishien': '#3E3A3F'");
  });

  it('試遊用の16枚（Claude の仮）：レア以外の11種を1枚ずつ＋安い攻撃5種の2枚目。レアは入れない', () => {
    expect(SHISHIEN_PLAYTEST_16.reduce((n, x) => n + x.copies, 0)).toBe(16);
    for (const rare of SHISHIEN_GACHA_RARE) expect(SHISHIEN_PLAYTEST_16.some((x) => x.id === rare)).toBe(false);
  });
});

// 自分：シシエン（p-m1 ライフ7）・ソラモ（p-m2）・ノビトン（p-m3）。相手も同じ（o-m1〜3）
const MONS = [SHISHIEN_MONSTER_ID, 'mon-soramo', 'mon-nobiton'];

function scene(hand: Partial<Record<Side, string[]>>, active: Side = 'player', turn = 3): BattleState {
  const deck = { monsters: [...MONS], skills: Array.from({ length: 60 }, () => sor(1)) };
  const s = createBattle({ name: 'P', deck }, { name: 'O', deck }, 11, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: 10 }, () => sor(1)),
    deck: Array.from({ length: 40 }, () => sor(2)),
  });
  return { ...s, turn, phase: 'main', active, manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const monster = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};

/** モンスターのライフを書きかえる（0 は倒れた） */
function withLife(s: BattleState, lives: Record<string, number>): BattleState {
  const fix = (k: Side) => ({ ...s.sides[k], monsters: s.sides[k].monsters.map((m) => (m.uid in lives ? { ...m, life: lives[m.uid] as number } : m)) });
  return { ...s, sides: { player: fix('player'), opponent: fix('opponent') } };
}

/** 自分の attack（手札 p0）を相手 target に。相手は手札 g0 の guard を出そうとする（出せるかと、出したあと〔出せなければ守らない〕を返す） */
function attackWith(attack: string, guard: string | null, target = 'o-m1', start?: BattleState): { usable: boolean; after: BattleState } {
  let s = start ?? scene({ player: [attack] });
  if (guard) s = { ...s, sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: [{ uid: 'g0', cardId: guard }] } } };
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', targetUid: target });
  const usable = guard ? cardUsability(s, 'opponent', 'g0').usable : false;
  let after = s.phase === 'defense' ? applyAction(s, { type: 'defend', side: 'opponent', cardUid: usable ? 'g0' : null }) : s;
  if (after.phase === 'defense') after = applyAction(after, { type: 'defend', side: 'opponent', cardUid: null });
  return { usable, after };
}

describe('07・08・09 捨て身：当たったら自分のライフ−1（selfDamageOnHit）', () => {
  it('当たると、相手にダメージ・使ったシシエンのライフ−1。反動の演出（recoil）と記録が出る', () => {
    for (const [no, dmg] of [[7, 5], [8, 6], [9, 7]] as const) {
      expect(getSkill(shi(no)).effect).toEqual({ type: 'attack', selfDamageOnHit: 1 });
      const s = withLife(scene({ player: [shi(no)] }), { 'o-m1': 9 });
      const after = attackWith(shi(no), null, 'o-m1', s).after;
      expect(monster(after, 'o-m1').life, String(no)).toBe(9 - dmg);
      expect(monster(after, 'p-m1').life, String(no)).toBe(6);
      expect(after.fx?.some((f) => f.kind === 'recoil')).toBe(true);
    }
  });

  it('回避されたら反動なし（とびのく・かげろう）', () => {
    for (const [atk, guard] of [[shi(7), shi(13)], [shi(8), shi(14)], [shi(9), shi(14)]] as const) {
      const r = attackWith(atk, guard);
      expect(r.usable, atk).toBe(true);
      expect(monster(r.after, 'o-m1').life).toBe(7);
      expect(monster(r.after, 'p-m1').life).toBe(7);
    }
  });

  it('防御で0なら反動なし。防御で減っても1以上当たれば反動あり', () => {
    // すてみタックル5 を、ソラモの防御で…（ここではシシエンの防御2枚を続けて出せないので、ダメージ1以上の場合と、威力を下げて0の場合を確かめる）
    const partial = attackWith(shi(7), shi(11));
    expect(partial.usable).toBe(true);
    expect(monster(partial.after, 'o-m1').life).toBe(7 - 2);
    expect(monster(partial.after, 'p-m1').life).toBe(6);
    // もえるたてがみ6 から ねつのとばり−2 → 4 当たる（反動あり）
    const partial2 = attackWith(shi(8), shi(12));
    expect(monster(partial2.after, 'o-m1').life).toBe(7 - 4);
    expect(monster(partial2.after, 'p-m1').life).toBe(6);
    // 威力を2に下げたすてみタックル（相手の いかく などの代わりに、受けるダメージ−3 のしめったはだで0にする）
    let s = scene({ player: [shi(7)] });
    s = { ...s, sides: { ...s.sides, opponent: { ...s.sides.opponent, monsters: s.sides.opponent.monsters.map((m) => (m.uid === 'o-m1' ? { ...m, shield: { reduce: 5, against: 'all', untilTurn: s.turn + 1 } } : m)) } } };
    const zero = attackWith(shi(7), null, 'o-m1', s).after;
    expect(monster(zero, 'o-m1').life).toBe(7);
    expect(monster(zero, 'p-m1').life).toBe(7);
  });

  it('反動で倒れてよい（ユーザー決定）。自分の最後の1体が反動で倒れたら負け', () => {
    const s = withLife(scene({ player: [shi(7)] }), { 'p-m1': 1, 'o-m1': 9 });
    const down = attackWith(shi(7), null, 'o-m1', s).after;
    expect(monster(down, 'p-m1').life).toBe(0);
    expect(down.phase).not.toBe('ended');
    const last = withLife(scene({ player: [shi(7)] }), { 'p-m1': 1, 'p-m2': 0, 'p-m3': 0, 'o-m1': 9 });
    const lost = attackWith(shi(7), null, 'o-m1', last).after;
    expect(monster(lost, 'p-m1').life).toBe(0);
    expect(lost).toMatchObject({ phase: 'ended', winner: 'opponent', endReason: 'knockout' });
  });

  it('相手の最後の1体を倒して勝負がついたら、反動の前に勝ち（反動なし）', () => {
    const s = withLife(scene({ player: [shi(7)] }), { 'p-m1': 1, 'o-m1': 3, 'o-m2': 0, 'o-m3': 0 });
    const won = attackWith(shi(7), null, 'o-m1', s).after;
    expect(won).toMatchObject({ phase: 'ended', winner: 'player' });
    expect(monster(won, 'p-m1').life).toBe(1);
  });
});

describe('守り（11〜14）', () => {
  it('14 かげろう：マナに関係なく、ちから技・かしこさ技を回避（ツムジのかぜよみと同じ）', () => {
    expect(getSkill(shi(14)).effect).toEqual(getSkill('skl-tsumuji-14').effect);
    for (const atk of [shi(1), shi(9), shi(3), shi(10)]) {
      const r = attackWith(atk, shi(14));
      expect(r.usable, atk).toBe(true);
      expect(monster(r.after, 'o-m1').life, atk).toBe(7);
    }
  });

  it('11 たてがみでうける：ちから技 −3。12 ねつのとばり：両方 −2。13 とびのく：ちから技だけ回避', () => {
    expect(getSkill(shi(11)).effect).toEqual({ type: 'defense', reduce: 3, against: 'force' });
    expect(getSkill(shi(12)).effect).toEqual({ type: 'defense', reduce: 2, against: 'all' });
    expect(attackWith(shi(3), shi(11)).usable).toBe(false);
    expect(monster(attackWith(shi(5), shi(11)).after, 'o-m1').life).toBe(7);
    expect(attackWith(shi(3), shi(13)).usable).toBe(false);
    expect(attackWith(shi(1), shi(13)).usable).toBe(true);
  });
});

describe('相手の CPU：捨て身の技の使い方', () => {
  // 相手（CPU）：シシエン（o-m1）の手札に すてみタックル だけ。自分のモンスターを狙う
  const cpuScene = (oLife: number, pLives: Record<string, number>): BattleState => withLife(scene({ opponent: [shi(7)] }, 'opponent'), { 'o-m1': oLife, ...pLives });
  const usesRecoil = (s: BattleState, skill: 'A' | 'B' | 'C'): boolean => {
    const a = chooseAction(s, 'opponent', 'normal', skill);
    return a?.type === 'useCard' && a.cardUid === 'o0';
  };

  it('ライフ2以上なら、ふつうの攻撃として使う', () => {
    for (const skill of ['A', 'B'] as const) expect(usesRecoil(cpuScene(2, { 'p-m1': 9 }), skill), skill).toBe(true);
  });

  it('ライフ1：相手の最後の1体を倒せるときだけ使う（腕前 A・B）', () => {
    for (const skill of ['A', 'B'] as const) {
      expect(usesRecoil(cpuScene(1, { 'p-m1': 9 }), skill), skill).toBe(false);
      // 倒せても最後の1体でなければ使わない（反動で倒れるので）
      expect(usesRecoil(cpuScene(1, { 'p-m1': 3 }), skill), skill).toBe(false);
      expect(usesRecoil(cpuScene(1, { 'p-m1': 3, 'p-m2': 0, 'p-m3': 0 }), skill), skill).toBe(true);
    }
  });

  it('腕前 C は 30% の割合でこの気づかいを忘れる（決まった seed から）', () => {
    expect(CPU_SKILL.C.forgetRecoil).toBe(0.3);
    expect(CPU_SKILL.B.forgetRecoil).toBe(0);
    expect(CPU_SKILL.A.forgetRecoil).toBe(0);
    let used = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed++) {
      const s = { ...cpuScene(1, { 'p-m1': 9 }), seed };
      if (usesRecoil(s, 'C')) used++;
    }
    // 見のがし・迷う・強くない技の選び方も入るので、だいたい 30% 前後
    expect(used / N).toBeGreaterThan(0.15);
    expect(used / N).toBeLessThan(0.4);
  });
});

function beatBarca(save: SaveData, seed: number): ReturnType<typeof winRunBattle> {
  const s = startRun(save, FIRE, seed);
  const run = s.dungeonRun;
  if (!run) throw new Error('run');
  const last = { ...run, floor: (RUN_DUNGEONS[FIRE]?.floors ?? 5) - 1 };
  const boss = runFloor(last).entities.find((e) => e.kind === 'boss');
  if (!boss) throw new Error('boss');
  return winRunBattle({ ...s, dungeonRun: last }, { kind: 'boss', id: boss.id }, null);
}

describe('炎の火山のボス（バルカ）・入手の流れ', () => {
  it('バルカの編成：ガウル・シシエン（真ん中・切り札）・ラズック。ノビトンは外した', () => {
    expect(ENCOUNTERS['enc-fire-boss']).toMatchObject({ name: 'バルカ', monsters: BARCA_TEAM, ace: SHISHIEN_MONSTER_ID, skill: 'A' });
    expect(ENCOUNTERS['enc-fire-boss']?.monsters).not.toContain('mon-nobiton');
    expect(DUNGEONS.find((d) => d.id === FIRE)).toMatchObject({
      trumpReward: true,
      bossFlag: BARCA_BEATEN_FLAG,
      altarOwedFlag: BARCA_ALTAR_OWED_FLAG,
      firstClearCards: [{ cardId: SHISHIEN_MONSTER_ID, count: 1 }],
    });
    expect(BARCA_BEATEN_FLAG).toBe('barca-beaten');
  });

  it('初回クリア：祭壇でシシエンのモンスターカード1枚。2回目から：シシエンの技カード1枚。宝箱の技カードもシシエンの技', () => {
    const b = base();
    expect(bossRewardCandidates(b, FIRE, BARCA_TEAM)).toEqual([]);
    const w = beatBarca(b, 31);
    expect(w).toMatchObject({ cleared: true, firstClear: true });
    expect(w.clearCards).toEqual([{ cardId: SHISHIEN_MONSTER_ID, count: 1 }]);
    expect(w.save.collection[SHISHIEN_MONSTER_ID]).toBe(1);
    expect(bossRewardCandidates(w.save, FIRE, BARCA_TEAM)).toEqual(SHISHIEN_SKILLS.map((k) => k.id));
    const again = beatBarca(w.save, 32);
    expect(again.firstClear).toBe(false);
    expect(again.clearCards).toEqual([]);
    expect(bossTrumpSkills(FIRE)).toEqual(SHISHIEN_SKILLS.map((k) => k.id));
    const chestCards = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const r = rollChest(FIRE, i, 'f1-chest-1');
      if (r.kind === 'card') chestCards.add(r.card);
    }
    expect(chestCards.size).toBeGreaterThan(0);
    for (const c of chestCards) expect(c.startsWith('skl-shishien-')).toBe(true);
  });

  it('バルカに初めて勝つと barca-beaten（1つだけ）', () => {
    const w = beatBarca(base(), 41);
    expect(w.save.storyFlags.filter((f) => !f.startsWith('gacha-seen-'))).toEqual([BARCA_BEATEN_FLAG]);
    expect(beatBarca(w.save, 42).save.storyFlags.filter((f) => f === BARCA_BEATEN_FLAG)).toHaveLength(1);
  });

  it('前に炎の火山をクリアしたセーブ（v30）：読み込むと barca-beaten と「まだ受け取っていない」が付き、次にバルカに勝つと祭壇でシシエンを受け取る。ガウルはそのまま', () => {
    const b = base();
    const old = {
      ...b,
      version: 30,
      collection: { ...b.collection, 'mon-gauul': 1, 'skl-gauul14-01': 3 },
      dungeons: { [FIRE]: { openedChests: [], bossDefeated: true, clears: 2 } },
    };
    const s = normalizeSave(JSON.parse(JSON.stringify(old)));
    if (!s) throw new Error('load');
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(31); // 2026-11-01 指示書 AH で 32 に
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.storyFlags).toEqual(expect.arrayContaining([BARCA_BEATEN_FLAG, BARCA_ALTAR_OWED_FLAG]));
    expect(availableGachaSeriesFor(s).map((x) => x.id)).not.toContain('shishien');
    expect(bossRewardCandidates(s, FIRE, BARCA_TEAM)).toEqual([]);
    const w = beatBarca(s, 51);
    expect(w.firstClear).toBe(false);
    expect(w.clearCards).toEqual([{ cardId: SHISHIEN_MONSTER_ID, count: 1 }]);
    expect(w.save.collection[SHISHIEN_MONSTER_ID]).toBe(1);
    expect(w.save.collection['mon-gauul']).toBe(1);
    expect(w.save.collection['skl-gauul14-01']).toBe(3);
    expect(w.save.storyFlags).not.toContain(BARCA_ALTAR_OWED_FLAG);
    expect(availableGachaSeriesFor(w.save).map((x) => x.id)).toContain('shishien');
    expect(bossRewardCandidates(w.save, FIRE, BARCA_TEAM)).toEqual(SHISHIEN_SKILLS.map((k) => k.id));
    expect(beatBarca(w.save, 52).clearCards).toEqual([]);
  });

  it('クリアしていないセーブ・もうシシエンを持っているセーブには「まだ受け取っていない」を付けない。v30 までに付いたシリーズの記録は外す', () => {
    const b = base();
    const fresh = normalizeSave(JSON.parse(JSON.stringify({ ...b, version: 30, storyFlags: [...b.storyFlags, gachaSeenFlag('shishien')] })));
    expect(fresh?.storyFlags).not.toContain(BARCA_ALTAR_OWED_FLAG);
    expect(fresh?.storyFlags).not.toContain(BARCA_BEATEN_FLAG);
    expect(fresh?.storyFlags).not.toContain(gachaSeenFlag('shishien'));
    const has = { ...b, version: 30, collection: { ...b.collection, [SHISHIEN_MONSTER_ID]: 1 }, dungeons: { [FIRE]: { openedChests: [], bossDefeated: true, clears: 1 } } };
    expect(normalizeSave(JSON.parse(JSON.stringify(has)))?.storyFlags).not.toContain(BARCA_ALTAR_OWED_FLAG);
    // とても前のセーブ（v26）で炎の火山をクリアしていても、シシエンを受け取るまでシリーズは並ばない
    const older = normalizeSave(JSON.parse(JSON.stringify({ ...b, version: 26, dungeons: { [FIRE]: { openedChests: [], bossDefeated: true, clears: 1 } } })));
    if (!older) throw new Error('load');
    expect(older.storyFlags).toContain(BARCA_ALTAR_OWED_FLAG);
    expect(availableGachaSeriesFor(older).map((x) => x.id)).not.toContain('shishien');
  });
});

describe('シシエンのガチャのシリーズ', () => {
  it('ヒョウズクのあとに1行。レア枠はれんごくのとっしん・ほのおのほうこう・かげろう。barca-beaten のあと（シシエンのカードを受け取ってから）だけ並ぶ', () => {
    const ids = GACHA_SERIES.map((s) => s.id);
    expect(ids.indexOf('shishien')).toBe(ids.indexOf('hyouzuku') + 1);
    expect(GACHA_SERIES.find((s) => s.id === 'shishien')).toEqual({
      id: 'shishien',
      monsterId: 'mon-shishien',
      rareSkillNames: ['れんごくのとっしん', 'ほのおのほうこう', 'かげろう'],
      unlockFlag: 'barca-beaten',
    });
    const b = base();
    expect(availableGachaSeriesFor(b).map((s) => s.id)).not.toContain('shishien');
    const w = beatBarca(b, 61);
    expect(availableGachaSeriesFor(w.save).map((s) => s.id)).toContain('shishien');
  });
});
