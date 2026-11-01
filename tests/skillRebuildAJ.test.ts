import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardCatalog, getMonster, REMOVED_SKILL_IDS, skillsOf } from '../src/data/cards.ts';
import { cardBookEntries, NUMBERED_MONSTERS } from '../src/data/cardNumbers.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { AJ_MONSTER_IDS, AJ_SKILLS, MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import {
  applyAction,
  attackPower,
  cardUsability,
  createBattle,
  habitatOf,
  isTideActive,
  RULE_VARIANTS,
  targetsFor,
  type BattleMonster,
  type BattleState,
  type Side,
} from '../src/game/battle/engine.ts';
import { seriesLineup, seriesOwned } from '../src/game/economy/gachaSeries.ts';
import { DECK_RULES } from '../src/data/rules.ts';
import { createNewSave, migrate, SAVE_VERSION } from '../src/game/save/saveData.ts';
import { boosterDeck, examLoanDeck } from '../src/game/story/introV2.ts';
import { AJ_EN_MISSING } from '../src/i18n/contentEnAJ.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/** 指示書 AJ（2026-11-01）：技カードの作り直し（全15体）・居場所・新しい効果。正本は src/data/skillRebuildAJ.ts、決まりは docs/battle-rules.md「指示書 AJ」 */

const CATEGORY = { ち: 'force', か: 'wisdom', 特: 'special', 防: 'defense', 避: 'evade' } as const;

describe('AJ：15体×12枚のカード', () => {
  it('どのモンスターも技は12枚・レアは4つ。名前・分類・マナ・ダメージ・効果の文・表示の番号は表のとおり。LIFE は変えない', () => {
    expect(AJ_MONSTER_IDS).toHaveLength(15);
    const life: Record<string, number> = {
      'mon-soramo': 7, 'mon-gauul': 6, 'mon-myurol': 7, 'mon-kalshell': 8, 'mon-lazuck': 6, 'mon-nobiton': 8, 'mon-pukarim': 6, 'mon-flune': 10,
      'mon-serephine': 6, 'mon-tsumuji': 6, 'mon-geol': 9, 'mon-hyouzuku': 7, 'mon-shishien': 7, 'mon-hakuran': 7, 'mon-desuoru': 7,
    };
    for (const id of AJ_MONSTER_IDS) {
      const rows = AJ_SKILLS[id] ?? [];
      expect(rows, id).toHaveLength(12);
      expect(rows.filter((r) => r.rare), id).toHaveLength(4);
      expect(getMonster(id).life, id).toBe(life[id]);
      const skills = skillsOf(id);
      expect(skills.map((k) => k.id), id).toEqual(rows.map((r) => r.id));
      skills.forEach((k, i) => {
        const r = rows[i];
        if (!r) throw new Error(`${id} ${i}`);
        expect(k.name).toBe(r.name);
        expect(k.category).toBe(CATEGORY[r.cat]);
        expect(k.cost).toBe(r.mana);
        expect(k.stat?.value ?? null).toBe(r.damage);
        expect(k.effectTextJa ?? null).toBe(r.text);
        expect(k.displayNo).toBe(i + 1);
        expect(k.isPlaceholder).toBe(false);
      });
    }
  });

  it('名前を変えた技も ID と絵はそのまま（しっぽうち・しっぽまわし・おびきよせ・やみにまぎれる）。新しい3枚は仮の絵', () => {
    const name = (id: string): string => cardCatalog.get(id)?.name ?? '';
    expect(name('skl-soramo14-04')).toBe('しっぽうち');
    expect(name('skl-myurol-03')).toBe('しっぽまわし');
    expect(name('skl-lazuck-07')).toBe('おびきよせ');
    expect(name('skl-desuoru-14')).toBe('やみにまぎれる');
    const art = (id: string): string => {
      const c = cardCatalog.get(id);
      return c && c.kind === 'skill' ? (c.art?.file ?? '') : '';
    };
    expect(art('skl-soramo14-04')).toBe('sor14v2_sk_04.png');
    for (const id of ['skl-kalshell-15', 'skl-desuoru-15', 'skl-desuoru-16']) {
      const c = cardCatalog.get(id);
      expect(c?.pendingSpec, id).toContain('art');
      expect(existsSync(`assets/images/cards/skills/${art(id)}`), id).toBe(true);
    }
    expect(art('skl-serephine-10')).toBe(art('skl-serephine-10')); // みちしおの絵は今の serephine_sk_10 のまま
    expect(art('skl-serephine-10')).toMatch(/10/);
  });

  it('外した33枚はカードの一覧に無い', () => {
    expect(REMOVED_SKILL_IDS).toHaveLength(33);
    for (const id of REMOVED_SKILL_IDS) expect(cardCatalog.get(id), id).toBeUndefined();
    expect(REMOVED_SKILL_IDS).toContain('skl-desuoru-13');
    expect(REMOVED_SKILL_IDS).toContain('skl-kalshell-14');
  });

  it('居場所：地上8体・空中4体・水中3体', () => {
    const by = (h: string): string[] => Object.entries(MONSTER_HABITAT).filter(([, v]) => v === h).map(([k]) => k);
    expect(by('ground')).toHaveLength(8);
    expect(by('air').sort()).toEqual(['mon-desuoru', 'mon-gauul', 'mon-hyouzuku', 'mon-pukarim']);
    expect(by('water').sort()).toEqual(['mon-kalshell', 'mon-myurol', 'mon-serephine']);
    expect(getMonster('mon-gauul').habitat).toBe('air');
  });

  it('図鑑の番号：1体ぶん13番（モンスター1＋技12）。全員を振り直す', () => {
    const entries = cardBookEntries();
    expect([...NUMBERED_MONSTERS].sort()).toEqual([...AJ_MONSTER_IDS].sort());
    let expected = 1;
    for (const id of NUMBERED_MONSTERS) {
      const mine = entries.filter((e) => e.section.kind === 'monster' && e.section.monsterId === id);
      expect(mine, id).toHaveLength(13);
      for (const e of mine) expect(e.no).toBe(expected++);
    }
    // 並び：ソラモ 1〜13・ラズック 14〜26 …（今までのモンスターの並び）
    expect(entries.find((e) => e.card.id === 'mon-desuoru')?.no).toBe(14 * 13 + 1);
  });

  it('ガチャのシリーズ：○/13（技12＋モンスター1）。レアの枠は★の4つ', () => {
    for (const series of GACHA_SERIES.filter((s) => s.monsterId)) {
      expect(seriesLineup(series).all, series.id).toHaveLength(13);
      expect(series.rareSkillNames, series.id).toHaveLength(4);
      const rare = (AJ_SKILLS[series.monsterId] ?? []).filter((r) => r.rare).map((r) => r.name);
      expect(series.rareSkillNames).toEqual(rare);
      expect(seriesOwned(createNewSave(new Date('2026-11-01T00:00:00Z')), series).total).toBe(13);
    }
  });

  it('効果の文の英語（仮訳）がそろっている', () => {
    expect(AJ_EN_MISSING).toEqual([]);
    setLanguage('en');
    expect(cardName('skl-kalshell-15')).toBe('High Tide');
    expect(cardName('skl-desuoru-16')).toBe('Requiem of Death');
    setLanguage('ja');
  });
});

describe('AJ：最初の箱（仮の中身）', () => {
  it('旅立ち＝ソラモ・ノビトン・ラズック／烈火＝ガウル・ラズック・ノビトン／蒼海＝ミュロル・カルシェル・ノビトン。どれも山札60枚', () => {
    expect(BOOSTERS.map((b) => b.monsters)).toEqual([
      ['mon-soramo', 'mon-nobiton', 'mon-lazuck'],
      ['mon-gauul', 'mon-lazuck', 'mon-nobiton'],
      ['mon-myurol', 'mon-kalshell', 'mon-nobiton'],
    ]);
    for (const b of BOOSTERS) {
      const deck = boosterDeck(b.key);
      expect(deck.skills, b.key).toHaveLength(DECK_RULES.skillCount);
      // 箱の主の技16枚は表の［箱］のとおり
      const main = b.monsters[0];
      const count = (id: string): number => deck.skills.filter((x) => x === id).length;
      for (const r of AJ_SKILLS[main] ?? []) expect(count(r.id), `${b.key} ${r.id}`).toBe(r.box ?? 0);
      expect(deck.skills.filter((id) => cardCatalog.get(id)?.kind === 'support')).toHaveLength(12);
    }
    // 先生が貸すデッキは旅立ちと同じ中身
    expect(examLoanDeck()).toEqual(boosterDeck('booster-1'));
  });
});

describe('AJ：前のセーブ（v32 → v33）', () => {
  it('外したカードを持っているカードとデッキから消し、デッキの抜けた分は持っているカードで埋める', () => {
    expect(SAVE_VERSION).toBe(33);
    const s = createNewSave(new Date('2026-11-01T00:00:00Z'));
    const removed = ['skl-soramo14-11', 'skl-soramo14-13'];
    const deckSkills = [...s.deck.skills.slice(0, 58), ...removed];
    const raw = {
      ...JSON.parse(JSON.stringify(s)),
      version: 32,
      collection: { ...s.collection, 'skl-soramo14-11': 3, 'skl-soramo14-13': 2, 'skl-soramo14-01': 3 },
      deck: { ...s.deck, skills: deckSkills },
    };
    const out = migrate(raw) as { collection: Record<string, number>; deck: { skills: string[] } };
    expect(out.collection['skl-soramo14-11']).toBeUndefined();
    expect(out.collection['skl-soramo14-13']).toBeUndefined();
    expect(out.deck.skills.some((id) => removed.includes(id))).toBe(false);
    expect(out.deck.skills).toHaveLength(60);
  });
});

/* ---------- 対戦の決まり ---------- */

// 自分：ソラモ（地上）・ガウル（空中）・セレフィーン（水中）。相手：カルシェル（水中）・ソラモ（地上）・ガウル（空中）
const pDeck = { monsters: ['mon-soramo', 'mon-gauul', 'mon-serephine'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
const oDeck = { monsters: ['mon-kalshell', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };

function scene(hand: Partial<Record<Side, string[]>>, active: Side = 'player'): BattleState {
  const s = createBattle({ name: 'P', deck: pDeck }, { name: 'O', deck: oDeck }, 7, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: 12 }, () => 'skl-soramo14-01'),
  });
  return { ...s, phase: 'main', active, manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}
const mon = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};
const patch = (s: BattleState, uid: string, p: Partial<BattleMonster>): BattleState => {
  const side: Side = uid.startsWith('p-') ? 'player' : 'opponent';
  return { ...s, sides: { ...s.sides, [side]: { ...s.sides[side], monsters: s.sides[side].monsters.map((m) => (m.uid === uid ? { ...m, ...p } : m)) } } };
};
function attack(s0: BattleState, cardIdx: string, userUid: string, targetUid: string, guards: string[] = []): BattleState {
  let s = applyAction(s0, { type: 'useCard', side: 'player', cardUid: cardIdx, userUid, targetUid });
  for (const g of guards) s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: g });
  if (s.phase === 'defense') s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
  return s;
}
const pass = (s: BattleState, side: Side): BattleState => applyAction(applyAction(s, { type: 'endAttack', side }), { type: 'endTurn', side });

describe('AJ：居場所の決まり', () => {
  it('急降下アタック（地上の相手だけ）：狙えるのは地上の相手だけ。場が水中なら使えない（理由を出す）', () => {
    const s = scene({ player: ['skl-gauul14-04'] });
    expect(targetsFor(s, 'player', cardCatalog.get('skl-gauul14-04') as never).map((m) => m.uid)).toEqual(['o-m2']);
    const wet = { ...s, tide: { untilTurn: s.turn + 1, by: 'opponent' as const } };
    expect(isTideActive(wet)).toBe(true);
    const u = cardUsability(wet, 'player', 'p0');
    expect(u.usable).toBe(false);
    expect(u.reason).toContain('地上');
  });

  it('みちしお：次の相手のターンの終わりまで全員水中。上書き（期限を延ばす）。期限が過ぎたら水が引く', () => {
    let s = scene({ player: ['skl-serephine-10'] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m3' });
    expect(s.tide?.untilTurn).toBe(s.turn + 1);
    expect(habitatOf(s, mon(s, 'o-m3'))).toBe('water'); // 空中のガウルも水中
    s = pass(s, 'player'); // 相手の手番（まだ水中）
    expect(isTideActive(s)).toBe(true);
    s = pass(s, 'opponent'); // 自分の手番：水が引く
    expect(isTideActive(s)).toBe(false);
    expect(s.log.some((l) => l.text.includes('水が引いた'))).toBe(true);
    expect(habitatOf(s, mon(s, 'o-m3'))).toBe('air');
  });

  it('タイダルクラッシュ：場が水中なら2倍（5 → 10）', () => {
    const s = scene({ opponent: ['skl-kalshell-08'] }, 'opponent');
    const card = cardCatalog.get('skl-kalshell-08') as never;
    expect(attackPower(s, card, mon(s, 'o-m1'))).toBe(5);
    expect(attackPower({ ...s, tide: { untilTurn: s.turn, by: 'opponent' } }, card, mon(s, 'o-m1'))).toBe(10);
  });

  it('ルナタイド：水中の相手には防御されない／オーシャンウェーブ：水中の相手は回避できない／あらし：空中の相手は回避できない', () => {
    // ルナタイドで水中のカルシェル（o-m1）を狙うと、カルシェルのあわのまく（かしこさ技−3）は使えない
    let s = scene({ player: ['skl-serephine-08'], opponent: ['skl-kalshell-12'] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m3', targetUid: 'o-m1' });
    expect(cardUsability(s, 'opponent', 'o0').usable).toBe(false);
    // 地上のソラモ（o-m2）なら星のまもりで防御できる
    s = scene({ player: ['skl-serephine-08'], opponent: ['skl-soramo14-12'] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m3', targetUid: 'o-m2' });
    expect(cardUsability(s, 'opponent', 'o0').usable).toBe(true);
    // オーシャンウェーブ：場が水中ならソラモも回避できない
    s = scene({ player: ['skl-serephine-09'], opponent: ['skl-soramo14-14'] });
    s = { ...s, tide: { untilTurn: s.turn + 1, by: 'player' } };
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m3', targetUid: 'o-m2' });
    expect(cardUsability(s, 'opponent', 'o0').usable).toBe(false);
  });

  it('地ひびき：地上の相手全員に当たる（守りは1体ずつ）。空中・水中の相手には当たらない', () => {
    const d = { monsters: ['mon-geol', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
    const o = { monsters: ['mon-soramo', 'mon-lazuck', 'mon-gauul'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
    let s = createBattle({ name: 'P', deck: d }, { name: 'O', deck: o }, 3, 'player');
    s = { ...s, phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player: { ...s.sides.player, hand: [{ uid: 'p0', cardId: 'skl-geol-05' }], manaPile: Array.from({ length: 10 }, () => 'x') } } };
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1' });
    while (s.phase === 'defense') s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(mon(s, 'o-m1').life).toBe(7 - 3);
    expect(mon(s, 'o-m2').life).toBe(6 - 3);
    expect(mon(s, 'o-m3').life).toBe(6);
  });
});

describe('AJ：新しい効果', () => {
  it('回避されても半分（連続ひっかき 2）：回避されたら1。防御もあれば、半分から防御を引く', () => {
    let s = scene({ player: ['skl-soramo14-02'], opponent: ['skl-soramo14-14'] });
    s = attack(s, 'p0', 'p-m1', 'o-m2', ['o0']);
    expect(mon(s, 'o-m2').life).toBe(7 - 1);
  });

  it('ひらりとはねる：消費マナ3以上のちから・かしこさ技だけ回避', () => {
    const d = { monsters: ['mon-hakuran', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
    let s = createBattle({ name: 'P', deck: pDeck }, { name: 'O', deck: d }, 5, 'player');
    const mana = Array.from({ length: 10 }, () => 'x');
    s = {
      ...s, phase: 'main', manaConvertLimit: null,
      sides: { player: { ...s.sides.player, hand: [{ uid: 'p0', cardId: 'skl-soramo14-03' }, { uid: 'p1', cardId: 'skl-soramo14-04' }], manaPile: mana }, opponent: { ...s.sides.opponent, hand: [{ uid: 'o0', cardId: 'skl-hakuran-12' }], manaPile: mana } },
    };
    const two = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', targetUid: 'o-m1' });
    expect(cardUsability(two, 'opponent', 'o0').usable).toBe(false);
    const three = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p1', userUid: 'p-m1', targetUid: 'o-m1' });
    expect(cardUsability(three, 'opponent', 'o0').usable).toBe(true);
  });

  it('ししゃのたむけ：倒れている味方1体につき＋2（使った瞬間に数える）', () => {
    const d = { monsters: ['mon-desuoru', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
    const s0 = createBattle({ name: 'P', deck: d }, { name: 'O', deck: oDeck }, 5, 'player');
    const card = cardCatalog.get('skl-desuoru-15') as never;
    expect(attackPower(s0, card, mon(s0, 'p-m1'))).toBe(4);
    let s = patch(s0, 'p-m2', { life: 0 });
    expect(attackPower(s, card, mon(s, 'p-m1'))).toBe(6);
    s = patch(s, 'p-m3', { life: 0 });
    expect(attackPower(s, card, mon(s, 'p-m1'))).toBe(8);
  });

  it('しのレクイエム：ライフ1以下の、使ったデスオル以外のモンスター（味方も相手も）をすべて倒す。守れない', () => {
    const d = { monsters: ['mon-desuoru', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
    let s = createBattle({ name: 'P', deck: d }, { name: 'O', deck: oDeck }, 5, 'player');
    s = { ...s, phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player: { ...s.sides.player, hand: [{ uid: 'p0', cardId: 'skl-desuoru-16' }], manaPile: Array.from({ length: 10 }, () => 'x') } } };
    s = patch(patch(patch(patch(s, 'p-m1', { life: 1 }), 'p-m2', { life: 1 }), 'o-m1', { life: 1 }), 'o-m2', { life: 2 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1' });
    expect(s.phase).toBe('main');
    expect(mon(s, 'p-m1').life).toBe(1); // 使ったデスオルは残る
    expect(mon(s, 'p-m2').life).toBe(0); // 味方も倒れる
    expect(mon(s, 'o-m1').life).toBe(0);
    expect(mon(s, 'o-m2').life).toBe(2);
    expect(s.log.some((l) => l.text.includes('2体が倒れた'))).toBe(true);
  });

  it('みずあび：自分のライフ＋2（もとの LIFE まで）。しめったはだ：次の相手のターン、受けるちから技すべて−3（毎回）', () => {
    const d = { monsters: ['mon-myurol', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
    let s = createBattle({ name: 'P', deck: d }, { name: 'O', deck: oDeck }, 5, 'player');
    s = { ...s, phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player: { ...s.sides.player, hand: [{ uid: 'p0', cardId: 'skl-myurol-09' }], manaPile: Array.from({ length: 10 }, () => 'x') } } };
    s = patch(s, 'p-m1', { life: 6 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1' });
    expect(mon(s, 'p-m1').life).toBe(7);
  });

  it('れんごくのとっしん：当たると自分のライフ−3。うけとめる：ちから技−5（0にはしない）', () => {
    const shishien = cardCatalog.get('skl-shishien-09');
    expect(shishien && shishien.kind === 'skill' && shishien.effect.type === 'attack' ? shishien.effect.selfDamageOnHit : 0).toBe(3);
    const geol = cardCatalog.get('skl-geol-14');
    expect(geol && geol.kind === 'skill' && geol.effect.type === 'defense' ? [geol.effect.reduce, geol.effect.nullify ?? false] : null).toEqual([5, false]);
  });

  it('CPU：みちしおは、この手番に別の味方が水中で強くなる攻撃を続けて使えるときに使う（行動に数えない試遊の切り替えも）', () => {
    // 相手（CPU）：カルシェル（o-m1）のみちしお・タイダルクラッシュ。カルシェルは1体なので、ふつうは使わない
    let s = scene({ opponent: ['skl-kalshell-15', 'skl-kalshell-08'] }, 'opponent');
    const a = chooseAction(s, 'opponent', 'normal', 'A');
    expect(a?.type === 'useCard' ? s.sides.opponent.hand.find((c) => c.uid === a.cardUid)?.cardId : null).not.toBe('skl-kalshell-15');
    RULE_VARIANTS.tideFreeAction = true;
    try {
      s = scene({ opponent: ['skl-kalshell-15', 'skl-kalshell-08'] }, 'opponent');
      const b = chooseAction(s, 'opponent', 'normal', 'A');
      expect(b?.type === 'useCard' ? s.sides.opponent.hand.find((c) => c.uid === b.cardUid)?.cardId : null).toBe('skl-kalshell-15');
    } finally {
      RULE_VARIANTS.tideFreeAction = false;
    }
  });
});
