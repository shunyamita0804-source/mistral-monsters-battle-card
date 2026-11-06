import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { CARD_NAME_LOGOS, CARD_NAME_LOGOS_EN } from '../src/data/cardNameLogos.generated.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { getMonster, getSkill, MONSTERS, QA_MONSTERS, QA_SKILLS, SKILLS, skillsOf } from '../src/data/cards.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { NOUS_COLOR, NOUS_MONSTER_ID, nousArtFile, nousSkillId } from '../src/data/nous.ts';
import { AJ_MONSTER_IDS, AJ_QA_SKILLS, MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, cardUsability, createBattle, defaultSearchAny, manaOf, searchAnyChoices, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { availableGachaSeriesFor } from '../src/game/economy/gachaSeries.ts';
import { createNewSave } from '../src/game/save/saveData.ts';
import { AJ_EN_MISSING } from '../src/i18n/contentEnAJ.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';
import { skillEffectIcons } from '../src/ui/effectIcons.ts';

/** 指示書 BN（2026-11-07）：ノウス（ネブラシアの王者ザイレンの本当の切り札・B の上。置き場所ができるまで確かめ用だけ）と、からっぽのつぼ・ときをすいとる・ぜんちぜんのう */

const ns = nousSkillId;
const sor = (n: number): string => `skl-soramo14-${String(n).padStart(2, '0')}`;
/** ソラモの星影ステップ（回避・マナ2） */
const SORAMO_EVADE = sor(14);

describe('ノウスのデータ（指示書の表のとおり）', () => {
  it('LIFE 7・空中・深い琥珀 #CC6A1F。ID は mon-nous', () => {
    const m = getMonster(NOUS_MONSTER_ID);
    expect(m.name).toBe('ノウス');
    expect(m.life).toBe(7);
    expect(m.habitat).toBe('air');
    expect(MONSTER_HABITAT[NOUS_MONSTER_ID]).toBe('air');
    expect(m.themeColor).toBe(NOUS_COLOR);
    expect(NOUS_COLOR).toBe('#CC6A1F');
    expect(m.description).not.toMatch(/神|祈|信仰/);
  });

  it('技12枚：名前・分類・マナ・ダメージ・レアは表のとおり（レア＝05・06・07・10）。防御1・回避1', () => {
    const table = AJ_QA_SKILLS[NOUS_MONSTER_ID] ?? [];
    const expected: [string, string, number, number | null][] = [
      ['ろっぽんづき', 'ち', 1, 2],
      ['マナをすう', 'か', 1, 1],
      ['ひかりのわ', 'か', 2, 3],
      ['うずまくつぼ', 'か', 3, 2],
      ['ろっぽんうでのらんぶ', 'ち', 4, 6],
      ['からっぽのつぼ', 'か', 4, 2],
      ['ずのうのせんこう', 'か', 4, 7],
      ['ろっぽんのてさばき', '特', 1, null],
      ['ときをすいとる', '特', 2, null],
      ['ぜんちぜんのう', '特', 3, null],
      ['ろっぽんうででうける', '防', 1, null],
      ['みらいよち', '避', 2, null],
    ];
    expect(table.map((r) => [r.name, r.cat, r.mana, r.damage])).toEqual(expected);
    expect(table.map((r) => r.id)).toEqual(expected.map((_, i) => ns(i + 1)));
    expect(table.map((r) => r.art)).toEqual(expected.map((_, i) => nousArtFile(i + 1)));
    expect(table.filter((r) => r.rare).map((r) => r.id)).toEqual([ns(5), ns(6), ns(7), ns(10)]);
    expect(table.filter((r) => r.cat === '防')).toHaveLength(1);
    expect(table.filter((r) => r.cat === '避')).toHaveLength(1);
    expect(skillsOf(NOUS_MONSTER_ID).map((k) => k.displayNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('効果と文（CSV のとおり。特殊技はマナを減らさない）', () => {
    const byId = new Map(QA_SKILLS.map((k) => [k.id, k]));
    expect(byId.get(ns(2))?.effect).toEqual({ type: 'attack', manaDrain: 1 });
    expect(byId.get(ns(2))?.effectTextJa).toBe('回避されなければ、相手のマナを1減らす');
    expect(byId.get(ns(4))?.effect).toEqual({ type: 'attack', manaDrain: 2 });
    expect(byId.get(ns(6))?.effect).toEqual({ type: 'attack', manaZero: true });
    expect(byId.get(ns(6))?.effectTextJa).toBe('回避されなければ、相手のマナを0にする');
    expect(byId.get(ns(8))?.effect).toEqual({ type: 'redrawHand' });
    expect(byId.get(ns(9))?.effect).toEqual({ type: 'millDeck', count: 2 });
    expect(byId.get(ns(10))?.effect).toEqual({ type: 'searchAny' });
    expect(byId.get(ns(11))?.effectTextJa).toBe('ちから技の受けるダメージを3減らす。');
    expect(byId.get(ns(12))?.effectTextJa).toBe('ちから技、かしこさ技を回避する。');
    for (const no of [8, 9, 10]) expect(JSON.stringify(byId.get(ns(no))?.effect)).not.toMatch(/mana/i);
  });

  it('置き場所はまだ無い：一覧・ガチャに並ばない・箱・ダンジョン・敵の編成に出ない', () => {
    expect(QA_MONSTERS.map((m) => m.id)).toContain(NOUS_MONSTER_ID);
    expect(MONSTERS.some((m) => m.id === NOUS_MONSTER_ID)).toBe(false);
    expect(SKILLS.some((k) => k.monsterId === NOUS_MONSTER_ID)).toBe(false);
    expect(AJ_MONSTER_IDS).not.toContain(NOUS_MONSTER_ID);
    for (const b of BOOSTERS) expect(b.monsters).not.toContain(NOUS_MONSTER_ID);
    for (const e of Object.values(ENCOUNTERS)) expect(e.monsters).not.toContain(NOUS_MONSTER_ID);
    expect(JSON.stringify(DUNGEONS)).not.toContain('nous');
    expect(GACHA_SERIES.find((g) => g.id === 'nous')?.rareSkillNames).toEqual(['ろっぽんうでのらんぶ', 'からっぽのつぼ', 'ずのうのせんこう', 'ぜんちぜんのう']);
    expect(availableGachaSeriesFor(createNewSave()).some((g) => g.id === 'nous')).toBe(false);
  });

  it('図鑑：フギンのあと No.313〜325', () => {
    const mine = cardBookEntries().filter((e) => e.section.kind === 'monster' && e.section.monsterId === NOUS_MONSTER_ID);
    expect(mine.map((e) => e.card.id)).toEqual([NOUS_MONSTER_ID, ...Array.from({ length: 12 }, (_, i) => ns(i + 1))]);
    expect(mine.map((e) => e.no)).toEqual(Array.from({ length: 13 }, (_, i) => 313 + i));
  });

  it('絵・枠・名前のロゴ・英語・アイコン', () => {
    for (let n = 1; n <= 12; n++) expect(existsSync(`assets/images/cards/skills/${nousArtFile(n)}`)).toBe(true);
    for (const f of ['cards/monsters/nous_official.webp', 'cards/monsters/nous_battlecard.png', 'ui/battlecard/frame_nous.png', 'ui/skillcard_simple/frame_normal_nous.webp', 'ui/skillcard_simple/frame_hand_nous.webp', 'ui/gacha/pack_nous.webp', 'ui/gacha/panel_nous.webp']) {
      expect(existsSync(`assets/images/${f}`), f).toBe(true);
    }
    expect(BATTLE_CARDS[NOUS_MONSTER_ID]?.frame).toBe('nous');
    expect(CARD_NAME_LOGOS[NOUS_MONSTER_ID]?.frame).toBe('#CC6A1F');
    expect(CARD_NAME_LOGOS_EN[NOUS_MONSTER_ID]?.frame).toBe('#CC6A1F');
    setLanguage('en');
    try {
      expect(cardName(NOUS_MONSTER_ID)).toBe('Nous');
      expect(cardName(ns(10))).toBe('Omniscience');
    } finally {
      setLanguage('ja');
    }
    expect(AJ_EN_MISSING).toEqual([]);
    expect(skillEffectIcons(getSkill(ns(2)))).toEqual([{ main: 'b13', badge: { kind: 'value', text: '−1' } }]);
    expect(skillEffectIcons(getSkill(ns(6)))).toEqual([{ main: 'b13', badge: { kind: 'value', text: '0' } }]);
    expect(skillEffectIcons(getSkill(ns(9)))).toEqual([{ main: 'e21' }, { main: 'e17', badge: { kind: 'value', text: '2' } }]);
    expect(skillEffectIcons(getSkill(ns(10)))).toEqual([{ main: 'e21' }]);
  });
});

/* ---------- バトル ---------- */

// 自分：ノウス（p-m1 ライフ7）・ソラモ（p-m2）・ノビトン（p-m3）。相手：ソラモ（o-m1 ライフ7）・ラズック（o-m2）・ガウル（o-m3）
function scene(
  hand: Partial<Record<Side, string[]>>,
  opts: { mana?: Partial<Record<Side, number>>; deck?: Partial<Record<Side, string[]>> } = {},
): BattleState {
  const filler = Array.from({ length: 60 }, () => sor(1));
  const s = createBattle(
    { name: 'P', deck: { monsters: [NOUS_MONSTER_ID, 'mon-soramo', 'mon-nobiton'], skills: filler } },
    { name: 'O', deck: { monsters: ['mon-soramo', 'mon-lazuck', 'mon-gauul'], skills: filler } },
    11,
    'player',
  );
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: opts.mana?.[k] ?? 12 }, () => sor(1)),
    ...(opts.deck?.[k] ? { deck: opts.deck[k] } : {}),
  });
  return { ...s, phase: 'main', active: 'player', manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const life = (s: BattleState, uid: string): number => [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid)?.life ?? -1;
const use = (s: BattleState, side: Side, cardUid: string, targetUid?: string, choice?: string): BattleState =>
  applyAction(s, { type: 'useCard', side, cardUid, ...(targetUid ? { targetUid } : {}), ...(choice ? { choice } : {}) });
const defend = (s: BattleState, side: Side, cardUid: string | null): BattleState => applyAction(s, { type: 'defend', side, cardUid });

describe('02・04 マナをすう・うずまくつぼ（今ある manaDrain）', () => {
  it('回避されなければ相手のマナを1・2減らす（0 より下にしない）', () => {
    const a = defend(use(scene({ player: [ns(2)] }, { mana: { opponent: 3 } }), 'player', 'p0', 'o-m1'), 'opponent', null);
    expect(life(a, 'o-m1')).toBe(6);
    expect(manaOf(a.sides.opponent)).toBe(2);
    const b = defend(use(scene({ player: [ns(4)] }, { mana: { opponent: 1 } }), 'player', 'p0', 'o-m1'), 'opponent', null);
    expect(manaOf(b.sides.opponent)).toBe(0);
  });
});

describe('06 からっぽのつぼ：回避されなければ、相手のマナを0にする', () => {
  it('当たったら相手のマナが0に（くしゃみと同じ記録）。減ったマナは捨て札へ', () => {
    const s0 = scene({ player: [ns(6)] }, { mana: { opponent: 7 } });
    const discard0 = s0.sides.opponent.discard.length;
    const s = defend(use(s0, 'player', 'p0', 'o-m1'), 'opponent', null);
    expect(life(s, 'o-m1')).toBe(5);
    expect(manaOf(s.sides.opponent)).toBe(0);
    expect(s.sides.opponent.discard.length).toBe(discard0 + 7);
    expect(s.log.some((l) => l.text === '相手のマナが7減った。')).toBe(true);
  });

  it('回避されたらマナは減らない', () => {
    let s = use(scene({ player: [ns(6)], opponent: [SORAMO_EVADE] }, { mana: { opponent: 7 } }), 'player', 'p0', 'o-m1');
    s = defend(defend(s, 'opponent', 'o0'), 'opponent', null);
    expect(life(s, 'o-m1')).toBe(7);
    expect(manaOf(s.sides.opponent)).toBe(5);
  });
});

describe('09 ときをすいとる：相手の山札の上から2枚を捨て札にする', () => {
  it('上から2枚が相手の捨て札に。記録にカードの名前を出す', () => {
    const s0 = scene({ player: [ns(9)] }, { deck: { opponent: [sor(3), SORAMO_EVADE, sor(4), sor(5)] } });
    const d0 = s0.sides.opponent.discard;
    const s = use(s0, 'player', 'p0');
    expect(s.sides.opponent.deck).toEqual([sor(4), sor(5)]);
    expect(s.sides.opponent.discard).toEqual([...d0, sor(3), SORAMO_EVADE]);
    expect(s.log.at(-1)?.text).toMatch(/^相手の山札の上から2枚が捨て札になった（.+・星影ステップ）。$/);
    expect(manaOf(s.sides.player)).toBe(10);
  });

  it('山札が1枚なら1枚、0枚なら何もしない（この技で山札切れの負けにはしない）', () => {
    const one = use(scene({ player: [ns(9)] }, { deck: { opponent: [sor(3)] } }), 'player', 'p0');
    expect(one.sides.opponent.deck).toEqual([]);
    expect(one.phase).not.toBe('ended');
    expect(one.log.at(-1)?.text).toMatch(/^相手の山札の上から1枚が捨て札になった/);
    const empty = scene({ player: [ns(9)] }, { deck: { opponent: [] } });
    expect(cardUsability(empty, 'player', 'p0').usable).toBe(true);
    const none = use(empty, 'player', 'p0');
    expect(none.phase).not.toBe('ended');
    expect(none.log.at(-1)?.text).toBe('相手の山札が無い。何も起きなかった。');
  });
});

describe('10 ぜんちぜんのう：山札から好きなカードを1枚選んで手札に加える', () => {
  const deck = [sor(1), ns(7), sor(3), SORAMO_EVADE, ns(1), sor(1)];

  it('選んだカードを手札に加え、山札は1枚減ってシャッフルされる（同じカードは1つにまとめて見せる）', () => {
    const s0 = scene({ player: [ns(10)] }, { deck: { player: deck } });
    expect(searchAnyChoices(s0, 'player')).toEqual([sor(1), ns(7), sor(3), SORAMO_EVADE, ns(1)]);
    const s = use(s0, 'player', 'p0', undefined, sor(3));
    expect(s.sides.player.hand.map((c) => c.cardId)).toEqual([sor(3)]);
    expect([...s.sides.player.deck].sort()).toEqual(deck.filter((id) => id !== sor(3)).sort());
    expect(s.log.some((l) => l.text.startsWith('あなたはぜんちぜんのうで、山札から'))).toBe(true);
  });

  it('選ばないとき（CPU）：撃てるいちばんダメージの大きい攻撃 → 無ければ回避', () => {
    // マナ 12−3＝9：ずのうのせんこう（7）
    expect(defaultSearchAny(scene({ player: [ns(10)] }, { deck: { player: deck } }), 'player')).toBe(ns(7));
    // マナ 3：撃てるのはソラモ・ノウスのマナの少ない攻撃。いちばんダメージの大きいもの
    const poor = scene({ player: [ns(10)] }, { mana: { player: 3 }, deck: { player: [ns(7), SORAMO_EVADE, ns(1)] } });
    expect(defaultSearchAny(poor, 'player')).toBe(ns(1));
    // 撃てる攻撃が無ければ回避
    const none = scene({ player: [ns(10)] }, { mana: { player: 3 }, deck: { player: [ns(7), SORAMO_EVADE, ns(9)] } });
    expect(defaultSearchAny(none, 'player')).toBe(SORAMO_EVADE);
  });

  it('山札が0枚なら使えない（ちえのささやきと同じ）', () => {
    const empty = scene({ player: [ns(10)] }, { deck: { player: [] } });
    expect(cardUsability(empty, 'player', 'p0')).toEqual({ usable: false, reason: '山札がありません' });
  });
});

describe('08 ろっぽんのてさばき（考える と同じ）', () => {
  it('ほかの手札をすべて山札に戻し、同じ枚数を引く', () => {
    const s = use(scene({ player: [ns(8), sor(2), sor(3)] }, { deck: { player: [sor(5), sor(6)] } }), 'player', 'p0');
    expect(s.sides.player.hand).toHaveLength(2);
    expect(s.sides.player.deck).toHaveLength(2);
  });
});

describe('CPU（指示書 BN）', () => {
  it('からっぽのつぼ：相手のマナが3以上なら、ほかの強い攻撃より先に使う。2以下なら使わない', () => {
    const yes = scene({ player: [ns(6), ns(3)] }, { mana: { player: 6, opponent: 3 } });
    expect(chooseAction(yes, 'player', 'normal', 'A')).toMatchObject({ type: 'useCard', cardUid: 'p0' });
    const no = scene({ player: [ns(6), ns(3)] }, { mana: { player: 6, opponent: 2 } });
    const a = chooseAction(no, 'player', 'normal', 'A');
    expect(a && a.type === 'useCard' && a.cardUid === 'p0').toBe(false);
  });

  it('ときをすいとる：相手の山札が10枚以下なら攻撃より先に使う', () => {
    const yes = scene({ player: [ns(9), ns(3)] }, { mana: { player: 4 }, deck: { opponent: Array.from({ length: 8 }, () => sor(1)) } });
    expect(chooseAction(yes, 'player', 'normal', 'A')).toMatchObject({ type: 'useCard', cardUid: 'p0' });
  });

  it('ぜんちぜんのう：撃てる攻撃が手札に無いときに使う', () => {
    const yes = scene({ player: [ns(10), ns(11)] }, { mana: { player: 8 }, deck: { player: [sor(1), ns(7)] } });
    expect(chooseAction(yes, 'player', 'normal', 'A')).toMatchObject({ type: 'useCard', cardUid: 'p0' });
  });
});
