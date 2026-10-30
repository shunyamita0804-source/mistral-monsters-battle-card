import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { getSkill, MONSTERS, SKILLS } from '../src/data/cards.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { DUNGEONS, ENCOUNTERS, IVAN_ALTAR_OWED_FLAG, IVAN_BEATEN_FLAG } from '../src/data/dungeons.ts';
import { RUN_DUNGEONS } from '../src/data/dungeonRun.ts';
import { GACHA_SERIES, gachaSeenFlag } from '../src/data/economy.ts';
import { HYOUZUKU_COLOR, HYOUZUKU_GACHA_RARE, HYOUZUKU_MONSTER, HYOUZUKU_MONSTER_ID, HYOUZUKU_SKILLS, hyouzukuSkillId } from '../src/data/hyouzuku.ts';
import hyouzukuJson from '../src/data/official/hyouzuku14_skills_OFFICIAL_20261030.json';
import { SKILL_CARD_TEXT } from '../src/data/skillCardText.ts';
import { soramoSkillId } from '../src/data/soramo.ts';
import { applyAction, cardUsability, createBattle, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { availableGachaSeriesFor } from '../src/game/economy/gachaSeries.ts';
import { bossRewardCandidates, bossTrumpSkills, rollChest, runFloor, startRun, winRunBattle } from '../src/game/dungeon/run.ts';
import { createNewSave, normalizeSave, SAVE_VERSION, type SaveData } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/**
 * ヒョウズク（2026-10-30 指示書 W「ヒョウズク（氷の洞窟の新しい切り札）」。design-parts/cards-original/hyouzuku/00_instructions_for_claude_code.txt）。
 * 新しい決まりは無い（こおりのいき・ふぶき＝まきつく、こおりわり＝いわくだき、おとなきはばたき＝かぜよみ）。裁定は docs/battle-rules.md「ヒョウズクの効果の扱い」
 */

const hyo = (n: number): string => hyouzukuSkillId(n);
const sor = (n: number): string => soramoSkillId(n);
const ORIGINAL_DIR = 'design-parts/cards-original/hyouzuku';
const ICE = 'dungeon-04';
const IVAN_TEAM = ['mon-myurol', HYOUZUKU_MONSTER_ID, 'mon-kalshell'];
const base = (): SaveData => createNewSave(new Date('2026-10-30T00:00:00Z'), 'balance');

function csvRows(path: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text.trim().split(/\r?\n/).slice(1).map((line) => line.split(','));
}

describe('ヒョウズク：データ（届いた JSON・CSV を無改変で置き、ゲームはその JSON を読む）', () => {
  it('保管した JSON・CSV・バトル用の絵は ZIP の原本と同じバイト列', () => {
    for (const f of ['hyouzuku14_skills_OFFICIAL_20261030.json', 'hyouzuku14_skills_OFFICIAL_20261030.csv']) {
      expect(readFileSync(`src/data/official/${f}`).equals(readFileSync(`${ORIGINAL_DIR}/${f}`)), f).toBe(true);
    }
    expect(readFileSync('assets/images/cards/monsters/hyouzuku_battlecard.png').equals(readFileSync(`${ORIGINAL_DIR}/hyouzuku_battleart.png`))).toBe(true);
  });

  it('CSV の14行・JSON・ゲームのカードで、番号・名前・分類・マナ・ダメージ・効果がすべて一致する', () => {
    const CATEGORY = { ちから技: 'force', かしこさ技: 'wisdom', 防御技: 'defense', 回避技: 'evade' } as const;
    const rows = csvRows('src/data/official/hyouzuku14_skills_OFFICIAL_20261030.csv');
    expect(rows).toHaveLength(14);
    rows.forEach((row, i) => {
      const skill = HYOUZUKU_SKILLS[i];
      const json = hyouzukuJson.skills[i];
      if (!skill || !json) throw new Error(String(i));
      expect(row[0]).toBe(String(json.no));
      expect(row[1]).toBe(json.name);
      expect(row[2]).toBe(json.category);
      expect(row[3]).toBe(String(json.mana));
      expect(row[4]).toBe(json.damage);
      expect(row[5]).toBe(json.effect);
      expect(row[7]).toBe(json.art);
      expect(skill.id).toBe(hyo(i + 1));
      expect(json.id).toBe(skill.id);
      expect(skill.name).toBe(json.name);
      expect(skill.category).toBe(CATEGORY[json.category as keyof typeof CATEGORY]);
      expect(skill.cost).toBe(json.mana);
      expect(skill.stat?.value ?? '―').toBe(json.damage === '―' ? '―' : Number(json.damage));
      expect(skill.effectTextJa ?? 'なし').toBe(SKILL_CARD_TEXT[skill.id] ?? json.effect);
    });
  });

  it('カードに書く短い文（指示書の HYOUZUKU_CARD_TEXT）。JSON の文は変えない', () => {
    expect(getSkill(hyo(5)).effectTextJa).toBe('相手は次のターン行動不可');
    expect(getSkill(hyo(9)).effectTextJa).toBe('相手は次のターン行動不可');
    expect(getSkill(hyo(6)).effectTextJa).toBe('防御されない');
    expect(getSkill(hyo(14)).effectTextJa).toBe(getSkill('skl-tsumuji-14').effectTextJa);
    expect(getSkill(hyo(11)).effectTextJa).toBe('ちから技・かしこさ技に効く');
    expect(getSkill(hyo(12)).effectTextJa).toBe('ちから技に効く');
    expect(getSkill(hyo(13)).effectTextJa).toBe('かしこさ技を回避');
    expect(hyouzukuJson.skills[10]?.effect).toBe('ちから技・かしこさ技のダメージを2軽減');
  });

  it('モンスター：ライフ7・銀に近い白・ID mon-hyouzuku。レアの枠は 09・10・14。枠の絵がある', () => {
    expect(HYOUZUKU_MONSTER).toMatchObject({ id: 'mon-hyouzuku', life: 7, name: 'ヒョウズク', isPlaceholder: false });
    expect(hyouzukuJson.monster_rank).toBe('B');
    expect(HYOUZUKU_COLOR).toBe('#C8CCD4');
    expect(HYOUZUKU_GACHA_RARE).toEqual([hyo(9), hyo(10), hyo(14)]);
    expect(BATTLE_CARDS[HYOUZUKU_MONSTER_ID]?.frame).toBe('hyouzuku');
    expect(existsSync('assets/images/ui/battlecard/frame_hyouzuku.png')).toBe(true);
    for (const size of ['normal', 'hand']) expect(existsSync(`assets/images/ui/skillcard_simple/frame_${size}_hyouzuku.webp`)).toBe(true);
  });

  it('ふつうの一覧に入り、図鑑の番号はツムジのあと（No.166〜180）', () => {
    expect(MONSTERS.some((m) => m.id === HYOUZUKU_MONSTER_ID)).toBe(true);
    expect(SKILLS.filter((s) => s.monsterId === HYOUZUKU_MONSTER_ID).map((s) => s.id)).toEqual(HYOUZUKU_SKILLS.map((s) => s.id));
    const book = cardBookEntries();
    expect(book.find((e) => e.card.id === HYOUZUKU_MONSTER_ID)?.no).toBe(166);
    expect(book.find((e) => e.card.id === hyo(14))?.no).toBe(180);
    expect(book.find((e) => e.card.id === 'skl-tsumuji-14')?.no).toBe(165);
  });

  it('絵：技14枚・正式モンスターカード。原本は無改変で保管（パック・ショップの原本も）', () => {
    for (let n = 1; n <= 14; n++) {
      const nn = String(n).padStart(2, '0');
      expect(getSkill(hyo(n)).art?.file).toBe(`hyouzuku_sk_${nn}.webp`);
      expect(existsSync(`assets/images/cards/skills/hyouzuku_sk_${nn}.webp`)).toBe(true);
      expect(existsSync(`${ORIGINAL_DIR}/hyouzuku_sk_${nn}.png`)).toBe(true);
    }
    expect(HYOUZUKU_MONSTER.art?.file).toBe('hyouzuku_official.webp');
    expect(existsSync('assets/images/cards/monsters/hyouzuku_official.webp')).toBe(true);
    const originals = ['hyouzuku_official_monstercard_LIFE7.png', 'hyouzuku_original_approved.png', 'hyouzuku_3view_approved.png', 'pack_hyouzuku.png', 'pack_art_hyouzuku.png', 'shop_pack_hyouzuku.png', 'shop_card_hyouzuku.png'];
    for (const f of originals) expect(existsSync(`${ORIGINAL_DIR}/${f}`), f).toBe(true);
    expect(readFileSync('design-parts/gacha-20261029/art/pack_hyouzuku.png').equals(readFileSync(`${ORIGINAL_DIR}/pack_hyouzuku.png`))).toBe(true);
    expect(readFileSync('design-parts/gacha-20261029/pack_art/pack_art_hyouzuku.png').equals(readFileSync(`${ORIGINAL_DIR}/pack_art_hyouzuku.png`))).toBe(true);
    for (const k of ['pack', 'card']) {
      expect(readFileSync(`design-parts/gacha-20261029/shop/shop_${k}_hyouzuku.png`).equals(readFileSync(`${ORIGINAL_DIR}/shop_${k}_hyouzuku.png`))).toBe(true);
    }
    expect(existsSync('assets/images/ui/gacha/pack_hyouzuku.webp')).toBe(true);
    expect(existsSync('assets/images/ui/gacha/panel_hyouzuku.webp')).toBe(true);
  });

  it('英語の名前（仮訳）', () => {
    setLanguage('en');
    try {
      expect(cardName(HYOUZUKU_MONSTER_ID)).toBe('Hyozuku');
      expect(cardName(hyo(9))).toBe('Blizzard');
      expect(cardName(hyo(14))).toBe('Silent Wings');
    } finally {
      setLanguage('ja');
    }
  });

  it('パックの色（pack_tint.py）・パックの絵・販売機の窓・ショップの棚・枠の色の表にヒョウズクがある', () => {
    expect(readFileSync('tools/design/pack_tint.py', 'utf8')).toContain("'hyouzuku': '#C8CCD4'");
    expect(readFileSync('tools/design/gacha_series_build.py', 'utf8')).toMatch(/PACKS = \[.*'tsumuji', 'hyouzuku'(, '[a-z]+')*\]/);
    expect(readFileSync('tools/design/shop_goods_20261030.py', 'utf8')).toMatch(/MONSTERS = \[.*'tsumuji', 'hyouzuku'\]/);
    expect(readFileSync('tools/design/gacha_panel_build.py', 'utf8')).toContain("'hyouzuku': (");
    for (const f of ['tools/art/skillcard_simple_build.py', 'tools/art/skillcard_v3_build.py']) expect(readFileSync(f, 'utf8')).toContain("'hyouzuku': '#C8CCD4'");
  });
});

// 自分：ヒョウズク（p-m1 ライフ7）・ソラモ（p-m2）・ノビトン（p-m3）。相手も同じ（o-m1〜3）
const MONS = [HYOUZUKU_MONSTER_ID, 'mon-soramo', 'mon-nobiton'];

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

/** 自分の attack（手札 p0）を相手 target に。相手は手札 g0 の guard を出そうとする（出せるかと、出したあと〔出せなければ守らない〕を返す） */
function attackWith(attack: string, guard: string | null, target = 'o-m1', start?: BattleState): { usable: boolean; after: BattleState } {
  let s = start ?? scene({ player: [attack] });
  if (guard) s = { ...s, sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: [{ uid: 'g0', cardId: guard }] } } };
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: target });
  const usable = guard ? cardUsability(s, 'opponent', 'g0').usable : false;
  let after = s.phase === 'defense' ? applyAction(s, { type: 'defend', side: 'opponent', cardUid: usable ? 'g0' : null }) : s;
  // 守りのカードのあとも守りの番が続くときは「守らない」で攻撃を終える
  if (after.phase === 'defense') after = applyAction(after, { type: 'defend', side: 'opponent', cardUid: null });
  return { usable, after };
}

describe('05 こおりのいき・09 ふぶき：相手は次のターン行動不可（ノビトンのまきつくと同じ）', () => {
  it('当たると、相手は次の手番に技を使えない。ほかのモンスターは使える。その次の手番は使える', () => {
    for (const no of [5, 9]) {
      expect(getSkill(hyo(no)).effect).toEqual({ type: 'attack', stunTarget: true, stunMark: 'frozen' });
      let s = attackWith(hyo(no), null).after;
      expect(monster(s, 'o-m1').stunnedTurn).toBe(s.turn + 1);
      expect(monster(s, 'o-m1').life).toBe(7 - (no === 5 ? 1 : 3));
      s = { ...s, turn: s.turn + 1, active: 'opponent', phase: 'main' };
      s = { ...s, sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: [hyo(1), sor(1)].map((cardId, i) => ({ uid: `o${i}`, cardId })) } } };
      expect(cardUsability(s, 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'このターンは行動できません（行動不可）' });
      expect(cardUsability(s, 'opponent', 'o1').usable).toBe(true);
      expect(cardUsability({ ...s, turn: s.turn + 2 }, 'opponent', 'o0').usable).toBe(true);
    }
  });

  it('対戦の画面の印：ヒョウズクの技で付いた行動不可は「凍った」（stunMark）、まきつくはつる草のまま（決まりは同じ。2026-10-30 指示書 X）', () => {
    expect(monster(attackWith(hyo(5), null).after, 'o-m1').stunMark).toBe('frozen');
    expect(monster(attackWith(hyo(9), null).after, 'o-m1').stunMark).toBe('frozen');
    const coil = scene({ player: ['skl-nobiton-03'] });
    const nobi = { ...coil, sides: { ...coil.sides, player: { ...coil.sides.player, monsters: coil.sides.player.monsters.map((m, i) => (i === 0 ? { ...m, cardId: 'mon-nobiton' } : m)) } } };
    const after = attackWith('skl-nobiton-03', null, 'o-m1', nobi).after;
    expect(monster(after, 'o-m1').stunnedTurn).toBe(after.turn + 1);
    expect(monster(after, 'o-m1').stunMark ?? null).toBeNull();
  });

  it('回避されたらかからない（まいあがる・おとなきはばたき）', () => {
    for (const [atk, guard] of [[hyo(5), hyo(13)], [hyo(9), hyo(14)]] as const) {
      const r = attackWith(atk, guard);
      expect(r.usable).toBe(true);
      expect(monster(r.after, 'o-m1').stunnedTurn).toBeUndefined();
      expect(monster(r.after, 'o-m1').life).toBe(7);
    }
  });

  it('防御で0ダメージになってもかかる（はねでつつむ −2 で こおりのいき 1 を0に）', () => {
    const r = attackWith(hyo(5), hyo(11));
    expect(r.usable).toBe(true);
    expect(monster(r.after, 'o-m1').life).toBe(7);
    expect(monster(r.after, 'o-m1').stunnedTurn).toBe(r.after.turn + 1);
  });

  it('行動不可のあいだも、守りのカード（防御・回避）は使える', () => {
    let s = scene({ player: [hyo(1)] });
    s = { ...s, sides: { ...s.sides, opponent: { ...s.sides.opponent, monsters: s.sides.opponent.monsters.map((m) => (m.uid === 'o-m1' ? { ...m, stunnedTurn: s.turn } : m)) } } };
    const r = attackWith(hyo(1), hyo(11), 'o-m1', s);
    expect(r.usable).toBe(true);
    expect(monster(r.after, 'o-m1').life).toBe(7);
  });

  it('もう一度かけたら期限だけ新しく（重ならない。凍らせ続けを止める決まりは入れない）', () => {
    let s = scene({ player: [hyo(5)] });
    s = { ...s, sides: { ...s.sides, opponent: { ...s.sides.opponent, monsters: s.sides.opponent.monsters.map((m) => (m.uid === 'o-m1' ? { ...m, stunnedTurn: s.turn - 1 } : m)) } } };
    const after = attackWith(hyo(5), null, 'o-m1', s).after;
    expect(monster(after, 'o-m1').stunnedTurn).toBe(after.turn + 1);
  });
});

describe('06 こおりわり：防御されない（ジオルのいわくだきと同じ。回避はできる）', () => {
  it('防御のカードは出せない。回避は出せる', () => {
    expect(getSkill(hyo(6)).effect).toEqual({ type: 'attack', unblockable: true });
    expect(getSkill(hyo(6)).effect).toEqual(getSkill('skl-geol-02').effect);
    expect(attackWith(hyo(6), hyo(12)).usable).toBe(false);
    expect(attackWith(hyo(6), hyo(11)).usable).toBe(false);
    const evaded = attackWith(hyo(6), hyo(14));
    expect(evaded.usable).toBe(true);
    expect(monster(evaded.after, 'o-m1').life).toBe(7);
  });
});

describe('守り（11〜14）', () => {
  it('14 おとなきはばたき：マナに関係なく、ちから技・かしこさ技を回避（ツムジのかぜよみと同じ）', () => {
    expect(getSkill(hyo(14)).effect).toEqual(getSkill('skl-tsumuji-14').effect);
    for (const atk of [hyo(1), hyo(7), hyo(3), hyo(10)]) {
      const r = attackWith(atk, hyo(14));
      expect(r.usable, atk).toBe(true);
      expect(monster(r.after, 'o-m1').life, atk).toBe(7);
    }
  });

  it('11 はねでつつむ：両方 −2。12 つばさのたて：ちから技 −3。13 まいあがる：かしこさ技だけ回避', () => {
    expect(getSkill(hyo(11)).effect).toEqual({ type: 'defense', reduce: 2, against: 'all' });
    expect(getSkill(hyo(12)).effect).toEqual({ type: 'defense', reduce: 3, against: 'force' });
    expect(attackWith(hyo(3), hyo(12)).usable).toBe(false);
    expect(monster(attackWith(hyo(7), hyo(12)).after, 'o-m1').life).toBe(7);
    expect(attackWith(hyo(1), hyo(13)).usable).toBe(false);
    expect(attackWith(hyo(4), hyo(13)).usable).toBe(true);
  });
});

function beatIvan(save: SaveData, seed: number): ReturnType<typeof winRunBattle> {
  const s = startRun(save, ICE, seed);
  const run = s.dungeonRun;
  if (!run) throw new Error('run');
  const last = { ...run, floor: (RUN_DUNGEONS[ICE]?.floors ?? 4) - 1 };
  const boss = runFloor(last).entities.find((e) => e.kind === 'boss');
  if (!boss) throw new Error('boss');
  return winRunBattle({ ...s, dungeonRun: last }, { kind: 'boss', id: boss.id }, null);
}

describe('氷の洞窟のボス（イヴァン）・入手の流れ', () => {
  it('イヴァンの編成：ミュロル・ヒョウズク（真ん中・切り札）・カルシェル。ノビトンは外した。lifeScale 1.3 → 指示書 Y で 1.2', () => {
    expect(ENCOUNTERS['enc-ice-boss']).toMatchObject({ name: 'イヴァン', monsters: IVAN_TEAM, ace: HYOUZUKU_MONSTER_ID, lifeScale: 1.2 });
    expect(ENCOUNTERS['enc-ice-boss']?.monsters).not.toContain('mon-nobiton');
    expect(DUNGEONS.find((d) => d.id === ICE)).toMatchObject({
      trumpReward: true,
      bossFlag: IVAN_BEATEN_FLAG,
      altarOwedFlag: IVAN_ALTAR_OWED_FLAG,
      firstClearCards: [{ cardId: HYOUZUKU_MONSTER_ID, count: 1 }],
    });
    expect(IVAN_BEATEN_FLAG).toBe('ivan-beaten');
    // 氷の洞窟のバトラー・見えない番人の編成は今のまま
    expect(RUN_DUNGEONS[ICE]?.guardianTeam).toEqual(['mon-kalshell', 'mon-nobiton', 'mon-myurol']);
  });

  it('初回クリア：祭壇でヒョウズクのモンスターカード1枚（技カードは出さない）。2回目から：ヒョウズクの技カード1枚。宝箱の技カードもヒョウズクの技', () => {
    const b = base();
    expect(bossRewardCandidates(b, ICE, IVAN_TEAM)).toEqual([]);
    const w = beatIvan(b, 31);
    expect(w).toMatchObject({ cleared: true, firstClear: true });
    expect(w.clearCards).toEqual([{ cardId: HYOUZUKU_MONSTER_ID, count: 1 }]);
    expect(w.save.collection[HYOUZUKU_MONSTER_ID]).toBe(1);
    expect(bossRewardCandidates(w.save, ICE, IVAN_TEAM)).toEqual(HYOUZUKU_SKILLS.map((k) => k.id));
    const again = beatIvan(w.save, 32);
    expect(again.firstClear).toBe(false);
    expect(again.clearCards).toEqual([]);
    expect(bossTrumpSkills(ICE)).toEqual(HYOUZUKU_SKILLS.map((k) => k.id));
    const chestCards = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const r = rollChest(ICE, i, 'f1-chest-1');
      if (r.kind === 'card') chestCards.add(r.card);
    }
    expect(chestCards.size).toBeGreaterThan(0);
    for (const c of chestCards) expect(c.startsWith('skl-hyouzuku-')).toBe(true);
  });

  it('イヴァンに初めて勝つと ivan-beaten（1つだけ）', () => {
    const w = beatIvan(base(), 41);
    expect(w.save.storyFlags.filter((f) => !f.startsWith('gacha-seen-'))).toEqual([IVAN_BEATEN_FLAG]);
    expect(beatIvan(w.save, 42).save.storyFlags.filter((f) => f === IVAN_BEATEN_FLAG)).toHaveLength(1);
  });

  it('前に氷の洞窟をクリアしたセーブ（v29）：読み込むと ivan-beaten と「まだ受け取っていない」が付き、次にイヴァンに勝つと祭壇でヒョウズクを受け取る。カルシェルはそのまま', () => {
    const b = base();
    const old = {
      ...b,
      version: 29,
      collection: { ...b.collection, 'mon-kalshell': 1, 'skl-kalshell-01': 1 },
      dungeons: { [ICE]: { openedChests: [], bossDefeated: true, clears: 2 } },
    };
    const s = normalizeSave(JSON.parse(JSON.stringify(old)));
    if (!s) throw new Error('load');
    expect(SAVE_VERSION).toBe(30);
    expect(s.version).toBe(30);
    expect(s.storyFlags).toEqual(expect.arrayContaining([IVAN_BEATEN_FLAG, IVAN_ALTAR_OWED_FLAG]));
    // まだヒョウズクを持っていないので、シリーズは並ばない
    expect(availableGachaSeriesFor(s).map((x) => x.id)).not.toContain('hyouzuku');
    expect(bossRewardCandidates(s, ICE, IVAN_TEAM)).toEqual([]);
    const w = beatIvan(s, 51);
    expect(w.firstClear).toBe(false);
    expect(w.clearCards).toEqual([{ cardId: HYOUZUKU_MONSTER_ID, count: 1 }]);
    expect(w.save.collection[HYOUZUKU_MONSTER_ID]).toBe(1);
    expect(w.save.collection['mon-kalshell']).toBe(1);
    expect(w.save.collection['skl-kalshell-01']).toBe(1);
    expect(w.save.storyFlags).not.toContain(IVAN_ALTAR_OWED_FLAG);
    expect(availableGachaSeriesFor(w.save).map((x) => x.id)).toContain('hyouzuku');
    // その次からはふつうの2回目と同じ（ヒョウズクの技カード）
    expect(bossRewardCandidates(w.save, ICE, IVAN_TEAM)).toEqual(HYOUZUKU_SKILLS.map((k) => k.id));
    expect(beatIvan(w.save, 52).clearCards).toEqual([]);
  });

  it('クリアしていないセーブ・もうヒョウズクを持っているセーブには「まだ受け取っていない」を付けない。v29 までに付いたシリーズの記録は外す', () => {
    const b = base();
    const fresh = normalizeSave(JSON.parse(JSON.stringify({ ...b, version: 29, storyFlags: [...b.storyFlags, gachaSeenFlag('hyouzuku')] })));
    expect(fresh?.storyFlags).not.toContain(IVAN_ALTAR_OWED_FLAG);
    expect(fresh?.storyFlags).not.toContain(IVAN_BEATEN_FLAG);
    expect(fresh?.storyFlags).not.toContain(gachaSeenFlag('hyouzuku'));
    const has = { ...b, version: 29, collection: { ...b.collection, [HYOUZUKU_MONSTER_ID]: 1 }, dungeons: { [ICE]: { openedChests: [], bossDefeated: true, clears: 1 } } };
    expect(normalizeSave(JSON.parse(JSON.stringify(has)))?.storyFlags).not.toContain(IVAN_ALTAR_OWED_FLAG);
    // とても前のセーブ（v26）で氷の洞窟をクリアしていても、ヒョウズクを受け取るまでシリーズは並ばない
    const older = normalizeSave(JSON.parse(JSON.stringify({ ...b, version: 26, dungeons: { [ICE]: { openedChests: [], bossDefeated: true, clears: 1 } } })));
    if (!older) throw new Error('load');
    expect(older.storyFlags).toContain(IVAN_ALTAR_OWED_FLAG);
    expect(availableGachaSeriesFor(older).map((x) => x.id)).not.toContain('hyouzuku');
  });
});

describe('ヒョウズクのガチャのシリーズ', () => {
  it('ツムジのあとに1行。レア枠はふぶき・ひょうが・おとなきはばたき。ivan-beaten のあと（ヒョウズクのカードを受け取ってから）だけ並ぶ', () => {
    const ids = GACHA_SERIES.map((s) => s.id);
    expect(ids.indexOf('hyouzuku')).toBe(ids.indexOf('tsumuji') + 1);
    expect(GACHA_SERIES.find((s) => s.id === 'hyouzuku')).toEqual({
      id: 'hyouzuku',
      monsterId: 'mon-hyouzuku',
      rareSkillNames: ['ふぶき', 'ひょうが', 'おとなきはばたき'],
      unlockFlag: 'ivan-beaten',
    });
    const b = base();
    expect(availableGachaSeriesFor(b).map((s) => s.id)).not.toContain('hyouzuku');
    const w = beatIvan(b, 61);
    expect(availableGachaSeriesFor(w.save).map((s) => s.id)).toContain('hyouzuku');
  });
});
