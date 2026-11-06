import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { CARD_NAME_LOGOS, CARD_NAME_LOGOS_EN } from '../src/data/cardNameLogos.generated.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { getMonster, getSkill, MONSTERS, QA_MONSTERS, QA_SKILLS, SKILLS, skillsOf } from '../src/data/cards.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { ROUGA_COLOR, ROUGA_MONSTER_ID, rougaArtFile, rougaSkillId } from '../src/data/rouga.ts';
import { AJ_MONSTER_IDS, AJ_QA_SKILLS, MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, cardUsability, createBattle, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { availableGachaSeriesFor } from '../src/game/economy/gachaSeries.ts';
import { createNewSave } from '../src/game/save/saveData.ts';
import { AJ_EN_MISSING } from '../src/i18n/contentEnAJ.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';
import { skillEffectIcons } from '../src/ui/effectIcons.ts';

/** 指示書 BL（2026-11-06）：ロウガ（ノルディスの王者の切り札・B の上。置き場所ができるまで確かめ用だけ）と、とおぼえ（期限つきの次の攻撃＋2） */

const rg = rougaSkillId;
const sor = (n: number): string => `skl-soramo14-${String(n).padStart(2, '0')}`;

describe('ロウガのデータ（指示書の表のとおり）', () => {
  it('LIFE 8・地上・淡い藤色 #B7A3DA。ID は mon-rouga', () => {
    const m = getMonster(ROUGA_MONSTER_ID);
    expect(m.name).toBe('ロウガ');
    expect(m.life).toBe(8);
    expect(m.habitat).toBe('ground');
    expect(MONSTER_HABITAT[ROUGA_MONSTER_ID]).toBe('ground');
    expect(m.themeColor).toBe(ROUGA_COLOR);
    expect(ROUGA_COLOR).toBe('#B7A3DA');
  });

  it('技12枚：名前・分類・マナ・ダメージ・レアは表のとおり（レア＝05・08・10・12）。防御1・回避1', () => {
    const table = AJ_QA_SKILLS[ROUGA_MONSTER_ID] ?? [];
    const expected: [string, string, number, number | null][] = [
      ['ひっかく', 'ち', 0, 1],
      ['かみつき', 'ち', 1, 2],
      ['とびかかる', 'ち', 1, 2],
      ['こおりのきば', 'ち', 3, 2],
      ['ゆきけむりダッシュ', 'ち', 1, 2],
      ['ひょうけつのかぎづめ', 'ち', 3, 5],
      ['けっしょうのつぶて', 'か', 1, 2],
      ['ひょうしょうのやいば', 'か', 3, 4],
      ['とおぼえ', '特', 1, null],
      ['ひょうろうのいちげき', 'ち', 6, 9],
      ['けがわでうける', '防', 1, null],
      ['ジャンプ', '避', 2, null],
    ];
    expect(table.map((r) => [r.name, r.cat, r.mana, r.damage])).toEqual(expected);
    expect(table.map((r) => r.id)).toEqual(expected.map((_, i) => rg(i + 1)));
    expect(table.map((r) => r.art)).toEqual(expected.map((_, i) => rougaArtFile(i + 1)));
    expect(table.filter((r) => r.rare).map((r) => r.id)).toEqual([rg(5), rg(8), rg(10), rg(12)]);
    expect(skillsOf(ROUGA_MONSTER_ID).map((k) => k.displayNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('効果と文（防御・回避は決まりの形）', () => {
    const byId = new Map(QA_SKILLS.map((k) => [k.id, k]));
    expect(byId.get(rg(4))?.effect).toEqual({ type: 'attack', stunTarget: true, stunMark: 'frozen' });
    expect(byId.get(rg(5))?.effect).toEqual({ type: 'attack', undodgeable: true });
    expect(byId.get(rg(8))?.effect).toEqual({ type: 'attack', unblockable: true });
    expect(byId.get(rg(9))?.effect).toEqual({ type: 'charge', amount: 2, untilNextTurn: true });
    expect(byId.get(rg(9))?.effectTextJa).toBe('次の自分のターンの終わりまで、次の攻撃＋2');
    expect(byId.get(rg(11))?.effectTextJa).toBe('ちから技の受けるダメージを3減らす。');
    expect(byId.get(rg(12))?.effectTextJa).toBe('ちから技、かしこさ技を回避する。');
  });

  it('置き場所はまだ無い：一覧・ガチャに並ばない・箱・ダンジョン・敵の編成に出ない', () => {
    expect(QA_MONSTERS.map((m) => m.id)).toContain(ROUGA_MONSTER_ID);
    expect(MONSTERS.some((m) => m.id === ROUGA_MONSTER_ID)).toBe(false);
    expect(SKILLS.some((k) => k.monsterId === ROUGA_MONSTER_ID)).toBe(false);
    expect(AJ_MONSTER_IDS).not.toContain(ROUGA_MONSTER_ID);
    for (const b of BOOSTERS) expect(b.monsters).not.toContain(ROUGA_MONSTER_ID);
    for (const e of Object.values(ENCOUNTERS)) expect(e.monsters).not.toContain(ROUGA_MONSTER_ID);
    expect(JSON.stringify(DUNGEONS)).not.toContain('rouga');
    expect(GACHA_SERIES.find((g) => g.id === 'rouga')?.rareSkillNames).toEqual(['ゆきけむりダッシュ', 'ひょうしょうのやいば', 'ひょうろうのいちげき', 'ジャンプ']);
    expect(availableGachaSeriesFor(createNewSave()).some((g) => g.id === 'rouga')).toBe(false);
  });

  it('図鑑：クロシオのあと No.287〜299', () => {
    const mine = cardBookEntries().filter((e) => e.section.kind === 'monster' && e.section.monsterId === ROUGA_MONSTER_ID);
    expect(mine.map((e) => e.card.id)).toEqual([ROUGA_MONSTER_ID, ...Array.from({ length: 12 }, (_, i) => rg(i + 1))]);
    expect(mine.map((e) => e.no)).toEqual(Array.from({ length: 13 }, (_, i) => 287 + i));
  });

  it('絵・枠・名前のロゴ・英語', () => {
    for (let n = 1; n <= 12; n++) expect(existsSync(`assets/images/cards/skills/${rougaArtFile(n)}`)).toBe(true);
    for (const f of ['cards/monsters/rouga_official.webp', 'cards/monsters/rouga_battlecard.png', 'ui/battlecard/frame_rouga.png', 'ui/skillcard_simple/frame_normal_rouga.webp', 'ui/skillcard_simple/frame_hand_rouga.webp', 'ui/gacha/pack_rouga.webp', 'ui/gacha/panel_rouga.webp']) {
      expect(existsSync(`assets/images/${f}`), f).toBe(true);
    }
    expect(BATTLE_CARDS[ROUGA_MONSTER_ID]?.frame).toBe('rouga');
    expect(CARD_NAME_LOGOS[ROUGA_MONSTER_ID]?.frame).toBe('#B7A3DA');
    expect(CARD_NAME_LOGOS_EN[ROUGA_MONSTER_ID]?.frame).toBe('#B7A3DA');
    setLanguage('en');
    try {
      expect(cardName(ROUGA_MONSTER_ID)).toBe('Rouga');
      expect(cardName(rg(9))).toBe('Howl');
    } finally {
      setLanguage('ja');
    }
    expect(AJ_EN_MISSING).toEqual([]);
    expect(skillEffectIcons(getSkill(rg(9)))).toEqual([{ main: 'b09', badge: { kind: 'value', text: '+2' } }]);
    expect(skillEffectIcons(getSkill(rg(4)))).toEqual([{ main: 's07' }]);
  });
});

/* ---------- バトル ---------- */

// 自分：ロウガ（p-m1 ライフ8）・ソラモ（p-m2）・ノビトン（p-m3）。相手：ソラモ（o-m1）・ラズック（o-m2）・ガウル（o-m3）
function scene(hand: Partial<Record<Side, string[]>>, opts: { mana?: Partial<Record<Side, number>>; foes?: string[]; mine?: string[] } = {}): BattleState {
  const filler = Array.from({ length: 60 }, () => sor(1));
  const s = createBattle(
    { name: 'P', deck: { monsters: opts.mine ?? [ROUGA_MONSTER_ID, 'mon-soramo', 'mon-nobiton'], skills: filler } },
    { name: 'O', deck: { monsters: opts.foes ?? ['mon-soramo', 'mon-lazuck', 'mon-gauul'], skills: filler } },
    11,
    'player',
  );
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: opts.mana?.[k] ?? 12 }, () => sor(1)),
  });
  return { ...s, phase: 'main', active: 'player', manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const monster = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};

const patchMonster = (s: BattleState, uid: string, patch: Partial<BattleMonster>): BattleState => {
  const side: Side = s.sides.player.monsters.some((m) => m.uid === uid) ? 'player' : 'opponent';
  return { ...s, sides: { ...s.sides, [side]: { ...s.sides[side], monsters: s.sides[side].monsters.map((m) => (m.uid === uid ? { ...m, ...patch } : m)) } } };
};

const use = (s: BattleState, side: Side, cardUid: string, targetUid?: string): BattleState =>
  applyAction(s, { type: 'useCard', side, cardUid, ...(targetUid ? { targetUid } : {}) });
const defend = (s: BattleState, side: Side, cardUid: string | null): BattleState => applyAction(s, { type: 'defend', side, cardUid });

/** 自分の手番を終えて相手の手番の攻撃のはじめへ */
function toOpponent(s: BattleState, hand: string[] = [], mana = 12): BattleState {
  const x = applyAction(applyAction(s, { type: 'endAttack', side: 'player' }), { type: 'endTurn', side: 'player' });
  expect(x.active).toBe('opponent');
  return { ...x, phase: 'main', sides: { ...x.sides, opponent: { ...x.sides.opponent, hand: hand.map((cardId, i) => ({ uid: `q${i}`, cardId })), manaPile: Array.from({ length: mana }, () => sor(1)) } } };
}

/** 相手の手番を終えて自分の手番の攻撃のはじめへ */
function toPlayer(s: BattleState, hand: string[] = [], mana = 12): BattleState {
  const x = applyAction(applyAction(s, { type: 'endAttack', side: 'opponent' }), { type: 'endTurn', side: 'opponent' });
  expect(x.active).toBe('player');
  return { ...x, phase: 'main', sides: { ...x.sides, player: { ...x.sides.player, hand: hand.map((cardId, i) => ({ uid: `n${i}`, cardId })), manaPile: Array.from({ length: mana }, () => sor(1)) } } };
}

describe('09 とおぼえ：次の自分のターンの終わりまで、次の攻撃＋2', () => {
  it('次の自分の手番の攻撃に＋2（ひょうろうのいちげき 9 → 11）。使ったら消える', () => {
    let s = use(scene({ player: [rg(9)] }), 'player', 'p0');
    expect(monster(s, 'p-m1').charge).toBe(2);
    expect(monster(s, 'p-m1').chargeUntil).toBe(s.turn + 2);
    expect(s.log.at(-1)?.text).toBe('ロウガのとおぼえ！ 次の攻撃のダメージ＋2（次の自分のターンの終わりまで）。');
    s = toPlayer(toOpponent(s), [rg(10)]);
    expect(monster(s, 'p-m1').charge).toBe(2);
    s = patchMonster(s, 'o-m1', { life: 12 } as Partial<BattleMonster>);
    s = defend(use(s, 'player', 'n0', 'o-m1'), 'opponent', null);
    expect(monster(s, 'o-m1').life).toBe(1);
    expect(monster(s, 'p-m1').charge).toBeNull();
    expect(monster(s, 'p-m1').chargeUntil).toBeNull();
  });

  it('次の自分の手番の終わりまでに攻撃しなければ消える（記録の文が出る）', () => {
    let s = use(scene({ player: [rg(9)] }), 'player', 'p0');
    s = toPlayer(toOpponent(s));
    expect(monster(s, 'p-m1').charge).toBe(2);
    s = toOpponent(s);
    expect(monster(s, 'p-m1').charge).toBeNull();
    expect(s.log.some((l) => l.text === 'ロウガのとおぼえの力が消えた。')).toBe(true);
  });

  it('重ねない：もう一度使っても＋2 のまま、期限を数え直す', () => {
    let s = use(scene({ player: [rg(9)] }), 'player', 'p0');
    const first = monster(s, 'p-m1').chargeUntil ?? 0;
    s = toPlayer(toOpponent(s), [rg(9)]);
    s = use(s, 'player', 'n0');
    expect(monster(s, 'p-m1').charge).toBe(2);
    expect(monster(s, 'p-m1').chargeUntil).toBe(first + 2);
  });

  it('プカリムのほっぺにためるは期限なしのまま', () => {
    let s = use(scene({ player: ['skl-pukarim-09'] }, { mine: ['mon-pukarim', 'mon-soramo', 'mon-nobiton'] }), 'player', 'p0');
    expect(monster(s, 'p-m1').chargeUntil).toBeNull();
    s = toOpponent(toPlayer(toOpponent(s)));
    expect(monster(s, 'p-m1').charge).toBe(2);
  });
});

describe('04 こおりのきば：相手は次のターン行動できない（凍る）', () => {
  it('当たったら次の相手の手番は行動できない・凍った印', () => {
    let s = defend(use(scene({ player: [rg(4)] }), 'player', 'p0', 'o-m1'), 'opponent', null);
    expect(monster(s, 'o-m1').stunnedTurn).toBe(s.turn + 1);
    expect(monster(s, 'o-m1').stunMark).toBe('frozen');
    // ソラモは凍っているので、ソラモの技は使えない
    s = toOpponent(s, [sor(1)]);
    expect(cardUsability(s, 'opponent', 'q0').usable).toBe(false);
  });
});

describe('CPU（指示書 BL）', () => {
  it('とおぼえ：次の手番にひょうろうのいちげきを払えるなら使う。払えないなら使わない', () => {
    // いまはマナ5（ひょうろうのいちげき 6 は払えない）。次の手番は 5 − 1 ＋ 手札からのマナ 2 ＝ 6 で払える
    const yes = scene({ player: [rg(9), rg(10), sor(1), sor(1), sor(1)] }, { mana: { player: 5 } });
    expect(chooseAction(yes, 'player', 'normal', 'A')).toMatchObject({ type: 'useCard', cardUid: 'p0', userUid: 'p-m1' });
    const no = scene({ player: [rg(9), rg(10)] }, { mana: { player: 2 } });
    const a = chooseAction(no, 'player', 'normal', 'A');
    expect(a && a.type === 'useCard' && a.cardUid === 'p0').toBe(false);
  });
});
