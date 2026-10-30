import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { cardCatalog, getSkill, MONSTERS, SKILLS, skillsOf, TMP_FLUNE_ID, TMP_FLUNE_SKILL_IDS } from '../src/data/cards.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { DUNGEONS, ENCOUNTERS, SERA_BEATEN_FLAG } from '../src/data/dungeons.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { availableGachaSeriesFor } from '../src/game/economy/gachaSeries.ts';
import { FLUNE_COLOR, FLUNE_GACHA_RARE, FLUNE_MONSTER, FLUNE_MONSTER_ID, FLUNE_SKILLS, fluneSkillId } from '../src/data/flune.ts';
import { geolSkillId } from '../src/data/geol.ts';
import fluneJson from '../src/data/official/flune14_skills_OFFICIAL_20261029.json';
import { pukarimSkillId } from '../src/data/pukarim.ts';
import { SKILL_CARD_TEXT } from '../src/data/skillCardText.ts';
import { soramoSkillId } from '../src/data/soramo.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, createBattle, manaOf, targetsFor, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { seriesLineup } from '../src/game/economy/gachaSeries.ts';
import { bossRewardCandidates, bossTrumpSkills, runFloor, startRun, winRunBattle } from '../src/game/dungeon/run.ts';
import { createNewSave, normalizeSave, REMOVED_CARD_IDS, SAVE_VERSION, type SaveData } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/**
 * フルーネ（2026-10-29 フルーネの最終。指示書 design-parts/cards-original/flune/00_instructions_for_claude_code.txt）
 * 細かい裁定は docs/battle-rules.md「フルーネの効果の扱い」
 */

const flu = (n: number): string => fluneSkillId(n);
const sor = (n: number): string => soramoSkillId(n);
const ORIGINAL_DIR = 'design-parts/cards-original/flune';

function csvRows(path: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text.trim().split(/\r?\n/).slice(1).map((line) => line.split(','));
}

describe('フルーネ：データ（届いた JSON・CSV を無改変で置き、ゲームはその JSON を読む）', () => {
  it('保管した JSON・CSV・バトル用の絵は ZIP の原本と同じバイト列', () => {
    for (const f of ['flune14_skills_OFFICIAL_20261029.json', 'flune14_skills_OFFICIAL_20261029.csv']) {
      expect(readFileSync(`src/data/official/${f}`).equals(readFileSync(`${ORIGINAL_DIR}/${f}`)), f).toBe(true);
    }
    expect(readFileSync('assets/images/cards/monsters/flune_battlecard.png').equals(readFileSync(`${ORIGINAL_DIR}/flune_battleart.png`))).toBe(true);
  });

  it('CSV の14行・JSON・ゲームのカードで、番号・名前・分類・マナ・ダメージ・効果がすべて一致する', () => {
    const CATEGORY = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' } as const;
    const rows = csvRows('src/data/official/flune14_skills_OFFICIAL_20261029.csv');
    expect(rows).toHaveLength(14);
    rows.forEach((row, i) => {
      const skill = FLUNE_SKILLS[i];
      const json = fluneJson.skills[i];
      if (!skill || !json) throw new Error(String(i));
      expect(row).toContain(json.name);
      expect(row).toContain(json.category);
      expect(row).toContain(String(json.mana));
      expect(skill.id).toBe(flu(i + 1));
      expect(json.id).toBe(skill.id);
      expect(skill.name).toBe(json.name);
      expect(skill.category).toBe(CATEGORY[json.category as keyof typeof CATEGORY]);
      expect(skill.cost).toBe(json.mana);
      expect(skill.stat?.value ?? '―').toBe(json.damage === '―' ? '―' : Number(json.damage));
      // 画面に出す文は短い文（skillCardText.ts）。JSON の文は変えない
      expect(skill.effectTextJa ?? 'なし').toBe(SKILL_CARD_TEXT[skill.id] ?? json.effect);
    });
  });

  it('大きなカード・対戦中の説明の効果の文（07・09・10）。守りは今の言い方', () => {
    expect(getSkill(flu(7)).effectTextJa).toBe('相手のマナを1減らす');
    expect(getSkill(flu(9)).effectTextJa).toBe('与えたダメージぶん、自分のライフを回復');
    expect(getSkill(flu(10)).effectTextJa).toBe('味方1体のライフを2回復');
    expect(getSkill(flu(11)).effectTextJa).toBe('ちから技に効く');
    expect(getSkill(flu(12)).effectTextJa).toBe('かしこさ技に効く');
    expect(getSkill(flu(13)).effectTextJa).toBe('ちから技・かしこさ技に効く');
    expect(getSkill(flu(14)).effectTextJa).toBe('ちから技を回避');
    // JSON の文は変えていない
    expect(fluneJson.skills[8]?.effect).toBe('与えたダメージぶん、フルーネのライフを回復');
  });

  it('モンスター：ライフ10・若葉色・ID mon-flune。レアの枠は 09。枠の絵がある。仮フルーネはゲームから外した', () => {
    expect(FLUNE_MONSTER).toMatchObject({ id: 'mon-flune', life: 10, name: 'フルーネ', isPlaceholder: false });
    expect(FLUNE_COLOR).toBe('#9CBF5A');
    expect(FLUNE_GACHA_RARE).toEqual([flu(8), flu(9), flu(10)]);
    expect(BATTLE_CARDS[FLUNE_MONSTER_ID]?.frame).toBe('flune');
    expect(existsSync('assets/images/ui/battlecard/frame_flune.png')).toBe(true);
    for (const size of ['normal', 'hand']) expect(existsSync(`assets/images/ui/skillcard_simple/frame_${size}_flune.webp`)).toBe(true);
    expect(cardCatalog.get(TMP_FLUNE_ID)).toBeUndefined();
    for (const id of TMP_FLUNE_SKILL_IDS) expect(cardCatalog.get(id)).toBeUndefined();
    expect(REMOVED_CARD_IDS).toEqual(expect.arrayContaining([TMP_FLUNE_ID, ...TMP_FLUNE_SKILL_IDS]));
  });

  it('ふつうの一覧に入り、図鑑の番号はジオルのあと（No.121〜135）', () => {
    expect(MONSTERS.some((m) => m.id === FLUNE_MONSTER_ID)).toBe(true);
    expect(SKILLS.filter((s) => s.monsterId === FLUNE_MONSTER_ID).map((s) => s.id)).toEqual(FLUNE_SKILLS.map((s) => s.id));
    const book = cardBookEntries();
    expect(book.find((e) => e.card.id === FLUNE_MONSTER_ID)?.no).toBe(121);
    expect(book.find((e) => e.card.id === flu(14))?.no).toBe(135);
    expect(book.find((e) => e.card.id === 'skl-geol-14')?.no).toBe(120);
  });

  it('絵：技14枚・正式モンスターカード。原本は無改変で保管（パック・ショップの原本も）', () => {
    for (let n = 1; n <= 14; n++) {
      const nn = String(n).padStart(2, '0');
      expect(getSkill(flu(n)).art?.file).toBe(`flune_sk_${nn}.webp`);
      expect(existsSync(`assets/images/cards/skills/flune_sk_${nn}.webp`)).toBe(true);
      expect(existsSync(`${ORIGINAL_DIR}/flune_sk_${nn}.png`)).toBe(true);
    }
    expect(FLUNE_MONSTER.art?.file).toBe('flune_official.webp');
    expect(existsSync('assets/images/cards/monsters/flune_official.webp')).toBe(true);
    for (const f of ['flune_official_monstercard_LIFE10.png', 'flune_design_sheet_approved.png', 'pack_flune.png', 'pack_art_flune.png', 'shop_pack_flune.png', 'shop_card_flune.png']) {
      expect(existsSync(`${ORIGINAL_DIR}/${f}`), f).toBe(true);
    }
    expect(readFileSync('design-parts/gacha-20261029/art/pack_flune.png').equals(readFileSync(`${ORIGINAL_DIR}/pack_flune.png`))).toBe(true);
    expect(existsSync('assets/images/ui/gacha/pack_flune.webp')).toBe(true);
  });

  it('英語の名前（仮訳）', () => {
    setLanguage('en');
    try {
      expect(cardName(FLUNE_MONSTER_ID)).toBe('Flune');
      expect(cardName(flu(9))).toBe('Flower Drain');
      expect(cardName(flu(10))).toBe('Healing Nectar');
    } finally {
      setLanguage('ja');
    }
  });
});

// 自分：フルーネ（p-m1 ライフ10）・ソラモ（p-m2 ライフ7）・ノビトン（p-m3 ライフ8）。相手も同じ（o-m1〜3）
const MONS = ['mon-flune', 'mon-soramo', 'mon-nobiton'];

function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}, active: Side = 'player', monsters: readonly string[] = MONS, opponentScale = 1): BattleState {
  const deck = { monsters: [...monsters], skills: Array.from({ length: 60 }, () => sor(1)) };
  const s = createBattle({ name: 'P', deck }, { name: 'O', deck, lifeScale: opponentScale }, 11, 'player');
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

const endDefense = (s: BattleState, side: Side = 'opponent'): BattleState => (s.phase === 'defense' ? applyAction(s, { type: 'defend', side, cardUid: null }) : s);

/** 自分のフルーネ（ライフ life）が相手 target にフラワードレインを使い、相手は guard（無ければ守らない）で守る */
function drain(life: number, target = 'o-m2', guard?: string, base?: BattleState): BattleState {
  let s = withMonster(base ?? scene({ player: [flu(9)] }), 'p-m1', { life });
  if (guard) s = giveOpponent(s, [guard]);
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: target });
  if (guard) s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'g0' });
  return endDefense(s);
}

describe('09 フラワードレイン：相手のライフが実際に減った量だけ回復', () => {
  it('当たれば与えたダメージ（3）ぶん回復', () => {
    const s = drain(5);
    expect(monster(s, 'o-m2').life).toBe(7 - 3);
    expect(monster(s, 'p-m1').life).toBe(5 + 3);
  });

  it('防御のあとは実際に減った分だけ（3軽減なら0・2軽減なら1）', () => {
    // 相手のフルーネ（o-m1）が自分の防御を使う
    const full = drain(5, 'o-m1', flu(12));
    expect(monster(full, 'o-m1').life).toBe(10);
    expect(monster(full, 'p-m1').life).toBe(5);
    const part = drain(5, 'o-m1', flu(13));
    expect(monster(part, 'o-m1').life).toBe(10 - 1);
    expect(monster(part, 'p-m1').life).toBe(5 + 1);
  });

  it('回避されたら回復しない', () => {
    const s = drain(5, 'o-m2', sor(14));
    expect(monster(s, 'o-m2').life).toBe(7);
    expect(monster(s, 'p-m1').life).toBe(5);
  });

  it('倒しすぎた分は入らない（相手のライフ1に3ダメージ → 回復1）', () => {
    const s = drain(5, 'o-m2', undefined, withMonster(scene({ player: [flu(9)] }), 'o-m2', { life: 1 }));
    expect(monster(s, 'o-m2').life).toBe(0);
    expect(monster(s, 'p-m1').life).toBe(6);
  });

  it('最大ライフを超えない', () => {
    expect(monster(drain(9), 'p-m1').life).toBe(10);
    expect(monster(drain(10), 'p-m1').life).toBe(10);
  });

  it('最大ライフはその対戦での最大（ボスの lifeScale 0.85 のフルーネは 9 まで）', () => {
    let s = withMonster(scene({ opponent: [flu(9)] }, {}, 'opponent', MONS, 0.85), 'o-m1', { life: 4 });
    expect(monster(s, 'o-m1').maxLife).toBe(9);
    s = endDefense(applyAction(s, { type: 'useCard', side: 'opponent', cardUid: 'o0', targetUid: 'p-m2' }), 'player');
    expect(monster(s, 'o-m1').life).toBe(7);
    s = withMonster(scene({ opponent: [flu(9)] }, {}, 'opponent', MONS, 0.85), 'o-m1', { life: 8 });
    s = endDefense(applyAction(s, { type: 'useCard', side: 'opponent', cardUid: 'o0', targetUid: 'p-m2' }), 'player');
    expect(monster(s, 'o-m1').life).toBe(9);
  });

  it('おいかぜ＋1 も、実際に減った量で数える（4ダメージ → 回復4）', () => {
    const base = withMonster(scene({ player: [flu(9)] }), 'p-m1', { tailwind: { amount: 1, turn: 1 } });
    const s = drain(4, 'o-m2', undefined, { ...base, turn: 1 });
    expect(monster(s, 'o-m2').life).toBe(7 - 4);
    expect(monster(s, 'p-m1').life).toBe(8);
  });

  it('ジオルの「かばう」で相手が変わったときも、実際に減った量で数える', () => {
    const base = scene({ player: [flu(9)] }, {}, 'player', ['mon-flune', 'mon-soramo', 'mon-geol']);
    const s = drain(5, 'o-m2', geolSkillId(11), base);
    expect(monster(s, 'o-m3').life).toBe(9 - 3);
    expect(monster(s, 'o-m2').life).toBe(7);
    expect(monster(s, 'p-m1').life).toBe(8);
  });
});

describe('10 いやしのみつ：味方1体（フルーネも可）のライフを2回復', () => {
  it('自分（フルーネ）も、ほかの味方も選べる。最大ライフを超えない', () => {
    let s = withMonster(scene({ player: [flu(10)] }), 'p-m1', { life: 5 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'p-m1' });
    expect(monster(s, 'p-m1').life).toBe(7);
    let a = withMonster(scene({ player: [flu(10)] }), 'p-m2', { life: 3 });
    a = applyAction(a, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'p-m2' });
    expect(monster(a, 'p-m2').life).toBe(5);
    expect(manaOf(a.sides.player)).toBe(10 - 3);
    let full = withMonster(scene({ player: [flu(10)] }), 'p-m2', { life: 6 });
    full = applyAction(full, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'p-m2' });
    expect(monster(full, 'p-m2').life).toBe(7);
  });

  it('倒れた味方は選べない（相手も選べない）', () => {
    const s = withMonster(scene({ player: [flu(10)] }), 'p-m3', { life: 0 });
    expect(targetsFor(s, 'player', getSkill(flu(10))).map((m) => m.uid)).toEqual(['p-m1', 'p-m2']);
    expect(applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'p-m3' })).toBe(s);
    expect(applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' })).toBe(s);
  });

  it('ミュロルのみずあび（自分だけ回復）は変えない', () => {
    expect(getSkill('skl-myurol-07').effect.type === 'healSelf' || skillsOf('mon-myurol').some((k) => k.effect.type === 'healSelf')).toBe(true);
  });
});

describe('07 かふん：相手のマナを1減らす（ノビトンのくしゃみと同じ）', () => {
  it('当たれば相手のマナ−1。回避されたら減らない', () => {
    let s = scene({ player: [flu(7)] }, { opponent: 5 });
    s = endDefense(applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' }));
    expect(manaOf(s.sides.opponent)).toBe(4);
    expect(monster(s, 'o-m1').life).toBe(10 - 1);
    let e = giveOpponent(scene({ player: [flu(7)] }, { opponent: 5 }), [sor(14)]);
    e = applyAction(e, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    e = endDefense(applyAction(e, { type: 'defend', side: 'opponent', cardUid: 'g0' }));
    expect(manaOf(e.sides.opponent)).toBe(5 - getSkill(sor(14)).cost);
  });
});

describe('相手の CPU（フルーネ）', () => {
  it('フラワードレイン：相手を倒せるときは、ほかの攻撃より先に', () => {
    const s = withMonster(scene({ opponent: [flu(4), flu(9)] }, { opponent: 10 }, 'opponent'), 'p-m2', { life: 3 });
    expect(chooseAction(s, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o1', targetUid: 'p-m2' });
  });

  it('フラワードレイン：倒せなくても、フルーネのライフが最大から2以上減っていれば使う。減っていなければ強い攻撃', () => {
    const hurt = withMonster(scene({ opponent: [flu(4), flu(9)] }, { opponent: 10 }, 'opponent'), 'o-m1', { life: 8 });
    expect(chooseAction(hurt, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o1' });
    const fine = withMonster(scene({ opponent: [flu(4), flu(9)] }, { opponent: 10 }, 'opponent'), 'o-m1', { life: 9 });
    expect(chooseAction(fine, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o0' });
    // マナが6より少なければ使えない
    const poor = withMonster(scene({ opponent: [flu(9), flu(1)] }, { opponent: 5 }, 'opponent'), 'o-m1', { life: 5 });
    expect(chooseAction(poor, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o1' });
  });

  it('いやしのみつ：倒せる攻撃が無く、味方が最大から2以上減っているとき。いちばん倒れそうな味方へ', () => {
    let s = scene({ opponent: [flu(10), flu(1)] }, { opponent: 4 }, 'opponent');
    s = withMonster(withMonster(s, 'o-m2', { life: 3 }), 'o-m3', { life: 6 });
    expect(chooseAction(s, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o0', targetUid: 'o-m2' });
    // 倒せる相手がいれば攻撃
    const kill = withMonster(s, 'p-m2', { life: 1 });
    expect(chooseAction(kill, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o1', targetUid: 'p-m2' });
    // 減りが1以下なら使わない
    const small = withMonster(scene({ opponent: [flu(10)] }, { opponent: 4 }, 'opponent'), 'o-m2', { life: 6 });
    expect(chooseAction(small, 'opponent')).toMatchObject({ type: 'endAttack' });
  });

  it('かふん：ふつうの攻撃と同じに使う', () => {
    const s = scene({ opponent: [flu(7)] }, { opponent: 3 }, 'opponent');
    expect(chooseAction(s, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o0' });
  });
});

/** 精霊の森の最後の階のボスに勝つ */
function beatSera(save: SaveData, seed: number): ReturnType<typeof winRunBattle> {
  const s = startRun(save, 'dungeon-02', seed);
  const run = s.dungeonRun;
  if (!run) throw new Error('run');
  const last = { ...run, floor: 2 };
  const boss = runFloor(last).entities.find((e) => e.kind === 'boss');
  if (!boss) throw new Error('boss');
  return winRunBattle({ ...s, dungeonRun: last }, { kind: 'boss', id: boss.id }, null);
}

describe('精霊の森のボス（セラ）・入手の流れ', () => {
  it('セラのデッキはプカリム・フルーネ・ミュロル（2026-10-29 夜 ユーザー指示）。lifeScale は試遊で 0.75、2026-10-30 指示書 V（切り札の技を2枚ずつ）で 0.7、指示書 Y（サポートの入れ替え）で 0.75', () => {
    expect(ENCOUNTERS['enc-forest-boss']).toMatchObject({ name: 'セラ', monsters: ['mon-pukarim', FLUNE_MONSTER_ID, 'mon-myurol'], ace: FLUNE_MONSTER_ID, lifeScale: 0.75 });
    expect(DUNGEONS.find((d) => d.id === 'dungeon-02')).toMatchObject({ trumpReward: true, bossFlag: SERA_BEATEN_FLAG, firstClearCards: [{ cardId: FLUNE_MONSTER_ID, count: 1 }] });
    expect(SERA_BEATEN_FLAG).toBe('sera-beaten');
  });

  it('初回クリア：祭壇でフルーネのモンスターカード1枚（技カードは出さない）。2回目から：フルーネの技カード。宝箱の技カードもフルーネの技', () => {
    const base = createNewSave();
    expect(bossRewardCandidates(base, 'dungeon-02', ['mon-lazuck', FLUNE_MONSTER_ID, 'mon-soramo'])).toEqual([]);
    const w = beatSera(base, 31);
    expect(w).toMatchObject({ cleared: true, firstClear: true });
    expect(w.clearCards).toEqual([{ cardId: FLUNE_MONSTER_ID, count: 1 }]);
    expect(w.save.collection[FLUNE_MONSTER_ID]).toBe(1);
    expect(bossRewardCandidates(w.save, 'dungeon-02', ['mon-lazuck', FLUNE_MONSTER_ID, 'mon-soramo'])).toEqual(FLUNE_SKILLS.map((k) => k.id));
    const again = beatSera(w.save, 32);
    expect(again.firstClear).toBe(false);
    expect(again.clearCards).toEqual([]);
    expect(bossTrumpSkills('dungeon-02')).toEqual(FLUNE_SKILLS.map((k) => k.id));
  });

  it('セラに初めて勝つと sera-beaten（1つだけ）。前に森をクリアしたセーブは読み込むと付く', () => {
    const base = createNewSave();
    const w = beatSera(base, 41);
    expect(w.save.storyFlags).toEqual([SERA_BEATEN_FLAG]);
    expect(beatSera(w.save, 42).save.storyFlags).toEqual([SERA_BEATEN_FLAG]);
    const old = normalizeSave(JSON.parse(JSON.stringify({ ...base, dungeons: { 'dungeon-02': { openedChests: [], bossDefeated: true, clears: 1 } } })));
    expect(old?.storyFlags).toContain(SERA_BEATEN_FLAG);
    expect(normalizeSave(JSON.parse(JSON.stringify(base)))?.storyFlags).not.toContain(SERA_BEATEN_FLAG);
  });
});

describe('フルーネのガチャのシリーズとショップ', () => {
  it('ジオルのあとに1行。レア枠ははなびらストーム・フラワードレイン・いやしのみつ。sera-beaten のあとだけ並ぶ', () => {
    const ids = GACHA_SERIES.map((s) => s.id);
    expect(ids.indexOf('flune')).toBe(ids.indexOf('geol') + 1);
    const series = GACHA_SERIES.find((s) => s.id === 'flune');
    expect(series).toEqual({ id: 'flune', monsterId: 'mon-flune', rareSkillNames: ['はなびらストーム', 'フラワードレイン', 'いやしのみつ'], unlockFlag: 'sera-beaten' });
    if (!series) throw new Error('series');
    const lineup = seriesLineup(series);
    expect(lineup.errors).toEqual([]);
    expect(lineup.rareIds).toEqual([flu(8), flu(9), flu(10)]);
    expect(lineup.all).toHaveLength(15);
    // 2026-10-30（指示書 K）：フルーネのモンスターカードを初めて手に入れたら並ぶ
    const base = createNewSave();
    expect(availableGachaSeriesFor(base).map((s) => s.id)).not.toContain('flune');
    expect(availableGachaSeriesFor({ ...base, collection: { ...base.collection, 'mon-flune': 1 } }).map((s) => s.id)).toContain('flune');
  });

  it('パックの絵の色（pack_tint.py）・ショップの棚（shop_goods_20261029.py）にフルーネがある', () => {
    expect(readFileSync('tools/design/pack_tint.py', 'utf8')).toContain("'flune': '#9CBF5A'");
    expect(readFileSync('tools/design/shop_goods_20261029.py', 'utf8')).toMatch(/MONSTERS = \[.*'flune', 'serephine'\]/);
  });
});

describe('フルーネの最終：前のセーブの仮フルーネ（セーブ version 25）', () => {
  it('仮フルーネのモンスターカードは mon-flune に置きかえ、技カードは消す。デッキ・名刺図鑑・挑戦中の獲得も', () => {
    const base = createNewSave();
    const tmp = TMP_FLUNE_SKILL_IDS;
    const deck = { monsters: [base.deck.monsters[0] as string, TMP_FLUNE_ID, base.deck.monsters[2] as string], skills: [...base.deck.skills.slice(0, 57), tmp[0], tmp[1], tmp[1]] };
    const old = {
      ...base,
      version: 24,
      collection: { ...base.collection, [TMP_FLUNE_ID]: 1, [tmp[0] as string]: 1, [tmp[1] as string]: 2 },
      deck,
      peopleBook: { met: ['sera'], records: { sera: { wins: 1, losses: 0, monsters: [TMP_FLUNE_ID, 'mon-soramo'], cards: [tmp[2], 'skl-lazuck-01'] } } },
      cardsSeen: [TMP_FLUNE_ID, tmp[0], 'mon-soramo'],
    };
    const s = normalizeSave(JSON.parse(JSON.stringify(old)));
    if (!s) throw new Error('load');
    expect(s.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(25);
    expect(s.collection[FLUNE_MONSTER_ID]).toBe(1);
    expect(Object.keys(s.collection).some((id) => id.includes('tmp-flune'))).toBe(false);
    expect(s.deck.monsters[1]).toBe(FLUNE_MONSTER_ID);
    expect(s.deck.skills.some((id) => id.includes('tmp-flune'))).toBe(false);
    expect(s.peopleBook.records.sera).toMatchObject({ monsters: [FLUNE_MONSTER_ID, 'mon-soramo'], cards: ['skl-lazuck-01'] });
    expect(s.cardsSeen).toEqual(['mon-soramo']);
  });

  it('仮フルーネを持っていないセーブは変わらない', () => {
    const base = createNewSave();
    const s = normalizeSave(JSON.parse(JSON.stringify({ ...base, version: 24 })));
    expect(s?.collection).toEqual(base.collection);
    expect(s?.deck).toEqual(base.deck);
  });

  it('プカリムのおいかぜなど、ほかのモンスターは変えていない', () => {
    expect(getSkill(pukarimSkillId(10)).effect).toEqual({ type: 'tailwind', amount: 1 });
  });
});
