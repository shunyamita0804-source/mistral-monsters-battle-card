import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { getSkill, MONSTERS, SKILLS } from '../src/data/cards.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { DUNGEONS, ENCOUNTERS, LUCIA_ALTAR_OWED_FLAG, LUCIA_BEATEN_FLAG } from '../src/data/dungeons.ts';
import { RUN_DUNGEONS } from '../src/data/dungeonRun.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { availableGachaSeriesFor } from '../src/game/economy/gachaSeries.ts';
import serephineJson from '../src/data/official/serephine14_skills_OFFICIAL_20261029.json';
import {
  SEREPHINE_COLOR,
  SEREPHINE_GACHA_RARE,
  SEREPHINE_MONSTER,
  SEREPHINE_MONSTER_ID,
  SEREPHINE_SKILLS,
  serephineSkillId,
} from '../src/data/serephine.ts';
import { SKILL_CARD_TEXT } from '../src/data/skillCardText.ts';
import { soramoSkillId } from '../src/data/soramo.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, cardUsability, createBattle, manaOf, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { seriesLineup } from '../src/game/economy/gachaSeries.ts';
import { bossRewardCandidates, bossTrumpSkills, rollChest, runFloor, startRun, winRunBattle } from '../src/game/dungeon/run.ts';
import { createNewSave, normalizeSave, SAVE_VERSION, type SaveData } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/**
 * セレフィーン（2026-10-29 セレフィーンの最終。指示書 design-parts/cards-original/serephine/00_instructions_for_claude_code.txt）
 * 細かい裁定は docs/battle-rules.md「セレフィーンの効果の扱い」
 */

const ser = (n: number): string => serephineSkillId(n);
const sor = (n: number): string => soramoSkillId(n);
const ORIGINAL_DIR = 'design-parts/cards-original/serephine';

function csvRows(path: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text.trim().split(/\r?\n/).slice(1).map((line) => line.split(','));
}

describe('セレフィーン：データ（届いた JSON・CSV を無改変で置き、ゲームはその JSON を読む）', () => {
  it('保管した JSON・CSV・バトル用の絵は ZIP の原本と同じバイト列', () => {
    for (const f of ['serephine14_skills_OFFICIAL_20261029.json', 'serephine14_skills_OFFICIAL_20261029.csv']) {
      expect(readFileSync(`src/data/official/${f}`).equals(readFileSync(`${ORIGINAL_DIR}/${f}`)), f).toBe(true);
    }
    expect(readFileSync('assets/images/cards/monsters/serephine_battlecard.png').equals(readFileSync(`${ORIGINAL_DIR}/serephine_battleart.png`))).toBe(true);
  });

  it('CSV の14行・JSON・ゲームのカードで、番号・名前・分類・マナ・ダメージ・効果がすべて一致する', () => {
    const CATEGORY = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' } as const;
    const rows = csvRows('src/data/official/serephine14_skills_OFFICIAL_20261029.csv');
    expect(rows).toHaveLength(14);
    rows.forEach((row, i) => {
      const skill = SEREPHINE_SKILLS[i];
      const json = serephineJson.skills[i];
      if (!skill || !json) throw new Error(String(i));
      expect(row).toContain(json.name);
      expect(row).toContain(json.category);
      expect(row).toContain(String(json.mana));
      expect(skill.id).toBe(ser(i + 1));
      expect(json.id).toBe(skill.id);
      expect(skill.name).toBe(json.name);
      expect(skill.category).toBe(CATEGORY[json.category as keyof typeof CATEGORY]);
      expect(skill.cost).toBe(json.mana);
      expect(skill.stat?.value ?? '―').toBe(json.damage === '―' ? '―' : Number(json.damage));
      // 画面に出す文は短い文（skillCardText.ts）。JSON の文は変えない
      expect(skill.effectTextJa ?? 'なし').toBe(SKILL_CARD_TEXT[skill.id] ?? json.effect);
    });
  });

  it('カードに書く短い文（指示書の表のとおり）。JSON の文は変えない', () => {
    expect(getSkill(ser(5)).effectTextJa).toBe('回避されない');
    expect(getSkill(ser(7)).effectTextJa).toBe('回避されない');
    expect(getSkill(ser(10)).effectTextJa).toBe('山札の上から1枚をマナにする');
    expect(getSkill(ser(11)).effectTextJa).toBe('ちから技・かしこさ技に効く');
    expect(getSkill(ser(12)).effectTextJa).toBe('ちから技を回避');
    expect(getSkill(ser(13)).effectTextJa).toBe('かしこさ技を回避');
    expect(getSkill(ser(14)).effectTextJa).toBe('マナに関係なく、ちから技・かしこさ技を回避');
    expect(serephineJson.skills[9]?.effect).toBe('山札の上から1枚を、そのままマナにする');
  });

  it('モンスター：ライフ6・月の青紫・ID mon-serephine。レアの枠は 07・09・14。枠の絵がある', () => {
    expect(SEREPHINE_MONSTER).toMatchObject({ id: 'mon-serephine', life: 6, name: 'セレフィーン', isPlaceholder: false });
    expect(SEREPHINE_COLOR).toBe('#8FA6E8');
    expect(SEREPHINE_GACHA_RARE).toEqual([ser(7), ser(9), ser(14)]);
    expect(BATTLE_CARDS[SEREPHINE_MONSTER_ID]?.frame).toBe('serephine');
    expect(existsSync('assets/images/ui/battlecard/frame_serephine.png')).toBe(true);
    for (const size of ['normal', 'hand']) expect(existsSync(`assets/images/ui/skillcard_simple/frame_${size}_serephine.webp`)).toBe(true);
  });

  it('ふつうの一覧に入り、図鑑の番号はフルーネのあと（No.136〜150）', () => {
    expect(MONSTERS.some((m) => m.id === SEREPHINE_MONSTER_ID)).toBe(true);
    expect(SKILLS.filter((s) => s.monsterId === SEREPHINE_MONSTER_ID).map((s) => s.id)).toEqual(SEREPHINE_SKILLS.map((s) => s.id));
    const book = cardBookEntries();
    expect(book.find((e) => e.card.id === SEREPHINE_MONSTER_ID)?.no).toBe(136);
    expect(book.find((e) => e.card.id === ser(14))?.no).toBe(150);
    expect(book.find((e) => e.card.id === 'skl-flune-14')?.no).toBe(135);
  });

  it('絵：技14枚・正式モンスターカード。原本は無改変で保管（パック・ショップの原本も）', () => {
    for (let n = 1; n <= 14; n++) {
      const nn = String(n).padStart(2, '0');
      expect(getSkill(ser(n)).art?.file).toBe(`serephine_sk_${nn}.webp`);
      expect(existsSync(`assets/images/cards/skills/serephine_sk_${nn}.webp`)).toBe(true);
      expect(existsSync(`${ORIGINAL_DIR}/serephine_sk_${nn}.png`)).toBe(true);
    }
    expect(SEREPHINE_MONSTER.art?.file).toBe('serephine_official.webp');
    expect(existsSync('assets/images/cards/monsters/serephine_official.webp')).toBe(true);
    const originals = ['serephine_official_monstercard_LIFE6.png', 'serephine_design_sheet_approved.png', 'pack_serephine.png', 'pack_art_serephine.png', 'shop_pack_serephine.png', 'shop_card_serephine.png'];
    for (const f of originals) expect(existsSync(`${ORIGINAL_DIR}/${f}`), f).toBe(true);
    expect(readFileSync('design-parts/gacha-20261029/art/pack_serephine.png').equals(readFileSync(`${ORIGINAL_DIR}/pack_serephine.png`))).toBe(true);
    expect(readFileSync('design-parts/gacha-20261029/pack_art/pack_art_serephine.png').equals(readFileSync(`${ORIGINAL_DIR}/pack_art_serephine.png`))).toBe(true);
    for (const k of ['pack', 'card']) {
      expect(readFileSync(`design-parts/gacha-20261029/shop/shop_${k}_serephine.png`).equals(readFileSync(`${ORIGINAL_DIR}/shop_${k}_serephine.png`))).toBe(true);
    }
    expect(existsSync('assets/images/ui/gacha/pack_serephine.webp')).toBe(true);
  });

  it('英語の名前（仮訳）', () => {
    setLanguage('en');
    try {
      expect(cardName(SEREPHINE_MONSTER_ID)).toBe('Serephine');
      expect(cardName(ser(10))).toBe('High Tide');
      expect(cardName(ser(14))).toBe('Wave Dance');
    } finally {
      setLanguage('ja');
    }
  });
});

// 自分：セレフィーン（p-m1 ライフ6）・ソラモ（p-m2 ライフ7）・ノビトン（p-m3 ライフ8）。相手も同じ（o-m1〜3）
const MONS = ['mon-serephine', 'mon-soramo', 'mon-nobiton'];

function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}, active: Side = 'player', deckSize = 40): BattleState {
  const deck = { monsters: [...MONS], skills: Array.from({ length: 60 }, () => sor(1)) };
  const s = createBattle({ name: 'P', deck }, { name: 'O', deck }, 11, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 10 }, () => sor(1)),
    deck: Array.from({ length: deckSize }, (_, i) => (i === 0 ? 'skl-nobiton-01' : sor(2))),
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

describe('10 みちしお：山札のいちばん上の1枚を、手札に入れずにそのままマナにする', () => {
  it('山札の上の1枚がマナになる。手札は増えない（みちしおの分だけ減る）。マナ0で使える', () => {
    const s0 = scene({ player: [ser(10), sor(1)] }, { player: 0 });
    const top = s0.sides.player.deck[0];
    const s = applyAction(s0, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1' });
    expect(manaOf(s.sides.player)).toBe(1);
    expect(s.sides.player.manaPile.at(-1)).toBe(top);
    expect(s.sides.player.deck).toHaveLength(s0.sides.player.deck.length - 1);
    expect(s.sides.player.hand.map((c) => c.cardId)).toEqual([sor(1)]);
    expect(s.sides.player.discard).toContain(ser(10));
    expect(s.phase).toBe('main');
  });

  it('使った手番は、セレフィーンは攻撃しない（特殊技を使った扱い）。ほかのモンスターは攻撃できる', () => {
    let s = scene({ player: [ser(10), ser(1), sor(1)] }, { player: 3 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1' });
    expect(monster(s, 'p-m1').acted).toBe(true);
    expect(cardUsability(s, 'player', 'p1').usable).toBe(false);
    expect(cardUsability(s, 'player', 'p2').usable).toBe(true);
  });

  it('山札が0枚なら使えない（灰色。負けにならない）', () => {
    const s = scene({ player: [ser(10)] }, { player: 3 }, 'player', 0);
    const u = cardUsability(s, 'player', 'p0');
    expect(u.usable).toBe(false);
    expect(applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1' })).toBe(s);
    expect(cardUsability(scene({ player: [ser(10)] }, { player: 3 }, 'player', 1), 'player', 'p0').usable).toBe(true);
  });
});

/** 自分の attack（手札 p0）を相手 target に。相手は guard を出そうとする（出せるかを返す） */
function guardAgainst(attack: string, guard: string, target = 'o-m1'): { usable: boolean; s: BattleState } {
  let s = giveOpponent(scene({ player: [attack] }), [guard]);
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: target });
  return { usable: cardUsability(s, 'opponent', 'g0').usable, s };
}

describe('回避（12・13・14）', () => {
  it('13 ゆらりとかわす：かしこさ技だけを回避（ちから技は回避できない）', () => {
    const wis = guardAgainst(ser(4), ser(13));
    expect(wis.usable).toBe(true);
    let s = applyAction(wis.s, { type: 'defend', side: 'opponent', cardUid: 'g0' });
    if (s.phase === 'defense') s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(monster(s, 'o-m1').life).toBe(6);
    expect(guardAgainst(ser(1), ser(13)).usable).toBe(false);
  });

  it('12 すいっとよける：ちから技だけ。14 ウェーブダンス：マナに関係なく両方', () => {
    expect(guardAgainst(ser(1), ser(12)).usable).toBe(true);
    expect(guardAgainst(ser(4), ser(12)).usable).toBe(false);
    expect(guardAgainst(ser(1), ser(14)).usable).toBe(true);
    expect(guardAgainst(ser(4), ser(14)).usable).toBe(true);
    expect(guardAgainst(ser(9), ser(14)).usable).toBe(true);
  });

  it('11 ミストヴェール：ちから技・かしこさ技のダメージを2軽減', () => {
    expect(getSkill(ser(11)).effect).toEqual({ type: 'defense', reduce: 2, against: 'all' });
    const r = guardAgainst(ser(6), ser(11));
    expect(r.usable).toBe(true);
    let s = applyAction(r.s, { type: 'defend', side: 'opponent', cardUid: 'g0' });
    if (s.phase === 'defense') s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(monster(s, 'o-m1').life).toBe(6);
  });
});

describe('05 なみ打ち・07 アクアニードル：回避されない（防御はできる）', () => {
  it('どの回避でも避けられない。防御は使える', () => {
    for (const atk of [ser(5), ser(7)]) {
      expect(guardAgainst(atk, ser(13)).usable, atk).toBe(false);
      expect(guardAgainst(atk, ser(14)).usable, atk).toBe(false);
      expect(guardAgainst(atk, ser(11)).usable, atk).toBe(true);
    }
    // ソラモの星影ステップでも避けられない
    expect(guardAgainst(ser(7), sor(14), 'o-m2').usable).toBe(false);
  });
});

describe('相手の CPU（みちしお）', () => {
  it('倒せる攻撃が無く、大きい技（ルナタイド）が次の手番もマナ不足なら、みちしおを使う', () => {
    const s = scene({ opponent: [ser(10), ser(8), ser(1)] }, { opponent: 1 }, 'opponent');
    expect(chooseAction(s, 'opponent')).toMatchObject({ type: 'useCard', cardUid: 'o0', userUid: 'o-m1' });
  });

  it('使わない：倒せる相手がいる／大きい技が無い／次の手番にマナが足りる／山札が残り少ない', () => {
    const kill = withMonster(scene({ opponent: [ser(10), ser(8), ser(1)] }, { opponent: 1 }, 'opponent'), 'p-m2', { life: 1 });
    expect(chooseAction(kill, 'opponent')).not.toMatchObject({ cardUid: 'o0' });
    const noBig = scene({ opponent: [ser(10), ser(1), ser(2)] }, { opponent: 1 }, 'opponent');
    expect(chooseAction(noBig, 'opponent')).not.toMatchObject({ cardUid: 'o0' });
    const rich = scene({ opponent: [ser(10), ser(8), ser(1)] }, { opponent: 3 }, 'opponent');
    expect(chooseAction(rich, 'opponent')).not.toMatchObject({ cardUid: 'o0' });
    const shortDeck = scene({ opponent: [ser(10), ser(8), ser(1)] }, { opponent: 1 }, 'opponent', 9);
    expect(chooseAction(shortDeck, 'opponent')).not.toMatchObject({ cardUid: 'o0' });
  });
});

/** 水の神殿の最後の階のボス（ルシア）に勝つ */
function beatLucia(save: SaveData, seed: number): ReturnType<typeof winRunBattle> {
  const s = startRun(save, 'dungeon-03', seed);
  const run = s.dungeonRun;
  if (!run) throw new Error('run');
  const last = { ...run, floor: (RUN_DUNGEONS['dungeon-03']?.floors ?? 4) - 1 };
  const boss = runFloor(last).entities.find((e) => e.kind === 'boss');
  if (!boss) throw new Error('boss');
  return winRunBattle({ ...s, dungeonRun: last }, { kind: 'boss', id: boss.id }, null);
}

const LUCIA_TEAM = ['mon-kalshell', SEREPHINE_MONSTER_ID, 'mon-myurol'];

describe('水の神殿のボス（ルシア）・入手の流れ', () => {
  it('ルシアのデッキはカルシェル・セレフィーン・ミュロル（ソラモを外した）・lifeScale 1.2（指示書 Y で 1.22）', () => {
    expect(ENCOUNTERS['enc-water-boss']).toMatchObject({ name: 'ルシア', monsters: LUCIA_TEAM, lifeScale: 1.25, skill: 'B' });
    expect(DUNGEONS.find((d) => d.id === 'dungeon-03')).toMatchObject({
      trumpReward: true,
      bossFlag: LUCIA_BEATEN_FLAG,
      firstClearCards: [{ cardId: SEREPHINE_MONSTER_ID, count: 1 }],
    });
    expect(LUCIA_BEATEN_FLAG).toBe('lucia-beaten');
    // バトラー・見えない番人のチームは今のまま
    expect(RUN_DUNGEONS['dungeon-03']).toMatchObject({
      npcTeams: [
        ['mon-myurol', 'mon-kalshell', 'mon-soramo'],
        ['mon-kalshell', 'mon-myurol', 'mon-nobiton'],
      ],
      // 2026-10-30 指示書 V（同じモンスターは1体まで）：2体目のカルシェルをノビトンに
      guardianTeam: ['mon-kalshell', 'mon-myurol', 'mon-nobiton'],
    });
  });

  it('初回クリア：祭壇でセレフィーンのモンスターカード1枚（技カードは出さない）。2回目から：セレフィーンの技カード。宝箱の技カードもセレフィーンの技', () => {
    const base = createNewSave();
    expect(bossRewardCandidates(base, 'dungeon-03', LUCIA_TEAM)).toEqual([]);
    const w = beatLucia(base, 31);
    expect(w).toMatchObject({ cleared: true, firstClear: true });
    expect(w.clearCards).toEqual([{ cardId: SEREPHINE_MONSTER_ID, count: 1 }]);
    expect(w.save.collection[SEREPHINE_MONSTER_ID]).toBe(1);
    expect(bossRewardCandidates(w.save, 'dungeon-03', LUCIA_TEAM)).toEqual(SEREPHINE_SKILLS.map((k) => k.id));
    const again = beatLucia(w.save, 32);
    expect(again.firstClear).toBe(false);
    expect(again.clearCards).toEqual([]);
    expect(bossTrumpSkills('dungeon-03')).toEqual(SEREPHINE_SKILLS.map((k) => k.id));
    const chestCards = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const r = rollChest('dungeon-03', i, 'f1-chest-1');
      if (r.kind === 'card') chestCards.add(r.card);
    }
    expect(chestCards.size).toBeGreaterThan(0);
    for (const c of chestCards) expect(c.startsWith('skl-serephine-')).toBe(true);
  });

  it('ルシアに初めて勝つと lucia-beaten（1つだけ）', () => {
    const w = beatLucia(createNewSave(), 41);
    // v27 から、もう並んでいるガチャのシリーズは「選んだ」記録（gacha-seen-*）も付く
    expect(w.save.storyFlags.filter((f) => !f.startsWith('gacha-seen-'))).toEqual([LUCIA_BEATEN_FLAG]);
    expect(beatLucia(w.save, 42).save.storyFlags).toEqual([LUCIA_BEATEN_FLAG]);
  });

  it('すでに水の神殿をクリアしたセーブ：読み込むと lucia-beaten が付き、次にルシアに勝ったとき祭壇でセレフィーンを受け取る（技カードは出さない）', () => {
    const base = createNewSave();
    const old = { ...base, version: 25, dungeons: { 'dungeon-03': { openedChests: [], bossDefeated: true, clears: 2 } } };
    const s = normalizeSave(JSON.parse(JSON.stringify(old)));
    if (!s) throw new Error('load');
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(26);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.storyFlags).toEqual(expect.arrayContaining([LUCIA_BEATEN_FLAG, LUCIA_ALTAR_OWED_FLAG]));
    expect(bossRewardCandidates(s, 'dungeon-03', LUCIA_TEAM)).toEqual([]);
    const w = beatLucia(s, 51);
    expect(w.firstClear).toBe(false);
    expect(w.clearCards).toEqual([{ cardId: SEREPHINE_MONSTER_ID, count: 1 }]);
    expect(w.save.collection[SEREPHINE_MONSTER_ID]).toBe(1);
    // v27 から、もう並んでいるガチャのシリーズは「選んだ」記録（gacha-seen-*）も付く
    expect(w.save.storyFlags.filter((f) => !f.startsWith('gacha-seen-'))).toEqual([LUCIA_BEATEN_FLAG]);
    // その次からはふつうの2回目と同じ（セレフィーンの技カード）
    expect(bossRewardCandidates(w.save, 'dungeon-03', LUCIA_TEAM)).toEqual(SEREPHINE_SKILLS.map((k) => k.id));
    expect(beatLucia(w.save, 52).clearCards).toEqual([]);
  });

  it('クリアしていないセーブ・もうセレフィーンを持っているセーブには「まだ受け取っていない」記録を付けない', () => {
    const base = createNewSave();
    const fresh = normalizeSave(JSON.parse(JSON.stringify({ ...base, version: 25 })));
    expect(fresh?.storyFlags).not.toContain(LUCIA_ALTAR_OWED_FLAG);
    expect(fresh?.storyFlags).not.toContain(LUCIA_BEATEN_FLAG);
    const has = {
      ...base,
      version: 25,
      collection: { ...base.collection, [SEREPHINE_MONSTER_ID]: 1 },
      dungeons: { 'dungeon-03': { openedChests: [], bossDefeated: true, clears: 1 } },
    };
    expect(normalizeSave(JSON.parse(JSON.stringify(has)))?.storyFlags.filter((f) => !f.startsWith('gacha-seen-'))).toEqual([LUCIA_BEATEN_FLAG]);
  });
});

describe('セレフィーンのガチャのシリーズとショップ', () => {
  it('フルーネのあとに1行。レア枠はアクアニードル・オーシャンウェーブ・ウェーブダンス。lucia-beaten のあとだけ並ぶ', () => {
    const ids = GACHA_SERIES.map((s) => s.id);
    expect(ids.indexOf('serephine')).toBe(ids.indexOf('flune') + 1);
    const series = GACHA_SERIES.find((s) => s.id === 'serephine');
    expect(series).toEqual({ id: 'serephine', monsterId: 'mon-serephine', rareSkillNames: ['アクアニードル', 'オーシャンウェーブ', 'ウェーブダンス'], unlockFlag: 'lucia-beaten' });
    if (!series) throw new Error('series');
    const lineup = seriesLineup(series);
    expect(lineup.errors).toEqual([]);
    expect(lineup.rareIds).toEqual([ser(7), ser(9), ser(14)]);
    expect(lineup.all).toHaveLength(15);
    // 2026-10-30（指示書 K）：セレフィーンのモンスターカードを初めて手に入れたら並ぶ
    const base = createNewSave();
    expect(availableGachaSeriesFor(base).map((s) => s.id)).not.toContain('serephine');
    expect(availableGachaSeriesFor({ ...base, collection: { ...base.collection, 'mon-serephine': 1 } }).map((s) => s.id)).toContain('serephine');
  });

  it('パックの絵の色（pack_tint.py）・ショップの棚（shop_goods_20261029.py）にセレフィーンがある', () => {
    expect(readFileSync('tools/design/pack_tint.py', 'utf8')).toContain("'serephine': '#8FA6E8'");
    expect(readFileSync('tools/design/shop_goods_20261029.py', 'utf8')).toMatch(/MONSTERS = \[.*'serephine'\]/);
    expect(readFileSync('tools/design/gacha_series_build.py', 'utf8')).toMatch(/PACKS = \[.*'serephine'(, '[a-z]+')*\]/);
  });
});
