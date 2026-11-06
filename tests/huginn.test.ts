import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { CARD_NAME_LOGOS, CARD_NAME_LOGOS_EN } from '../src/data/cardNameLogos.generated.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { getMonster, getSkill, MONSTERS, QA_MONSTERS, QA_SKILLS, SKILLS, skillsOf } from '../src/data/cards.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { HUGINN_COLOR, HUGINN_MONSTER_ID, huginnArtFile, huginnSkillId } from '../src/data/huginn.ts';
import { AJ_MONSTER_IDS, AJ_QA_SKILLS, MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import {
  applyAction,
  cardUsability,
  createBattle,
  defaultSearchEvade,
  guardCost,
  manaOf,
  searchEvadeChoices,
  type BattleMonster,
  type BattleState,
  type Side,
} from '../src/game/battle/engine.ts';
import { availableGachaSeriesFor } from '../src/game/economy/gachaSeries.ts';
import { createNewSave } from '../src/game/save/saveData.ts';
import { AJ_EN_MISSING } from '../src/i18n/contentEnAJ.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';
import { skillEffectIcons } from '../src/ui/effectIcons.ts';

/** 指示書 BM（2026-11-06）：フギン（ネブラシアの王者ザイレンの切り札・B の上。置き場所ができるまで確かめ用だけ）と、よみのまなざし・ちえのささやき・はねやすめ */

const hg = huginnSkillId;
const sor = (n: number): string => `skl-soramo14-${String(n).padStart(2, '0')}`;
/** ソラモの星影ステップ（回避・マナ2） */
const SORAMO_EVADE = sor(14);

describe('フギンのデータ（指示書の表のとおり）', () => {
  it('LIFE 6・空中・深い暗めの青緑 #1F5C58。ID は mon-huginn', () => {
    const m = getMonster(HUGINN_MONSTER_ID);
    expect(m.name).toBe('フギン');
    expect(m.life).toBe(6);
    expect(m.habitat).toBe('air');
    expect(MONSTER_HABITAT[HUGINN_MONSTER_ID]).toBe('air');
    expect(m.themeColor).toBe(HUGINN_COLOR);
    expect(HUGINN_COLOR).toBe('#1F5C58');
  });

  it('技12枚：名前・分類・マナ・ダメージ・レアは表のとおり（レア＝05・06・09・12）。防御0・回避2', () => {
    const table = AJ_QA_SKILLS[HUGINN_MONSTER_ID] ?? [];
    const expected: [string, string, number, number | null][] = [
      ['つつく', 'ち', 0, 1],
      ['ついばむ', 'ち', 1, 2],
      ['くろはねのつぶて', 'か', 1, 2],
      ['けっしょうのはね', 'か', 2, 3],
      ['ふたつのくちばし', 'ち', 3, 4],
      ['よみのまなざし', 'か', 3, 4],
      ['ちえのささやき', '特', 1, null],
      ['ひかりものをぬすむ', 'か', 2, 2],
      ['すいりのいちげき', 'か', 5, 8],
      ['はねやすめ', '特', 1, null],
      ['かぜよみ', '避', 2, null],
      ['さきよみ', '避', 0, null],
    ];
    expect(table.map((r) => [r.name, r.cat, r.mana, r.damage])).toEqual(expected);
    expect(table.map((r) => r.id)).toEqual(expected.map((_, i) => hg(i + 1)));
    expect(table.map((r) => r.art)).toEqual(expected.map((_, i) => huginnArtFile(i + 1)));
    expect(table.filter((r) => r.rare).map((r) => r.id)).toEqual([hg(5), hg(6), hg(9), hg(12)]);
    expect(table.filter((r) => r.cat === '防')).toHaveLength(0);
    expect(table.filter((r) => r.cat === '避')).toHaveLength(2);
    expect(skillsOf(HUGINN_MONSTER_ID).map((k) => k.displayNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('効果と文（回避は決まりの形。ひかりものをぬすむ はくしゃみと同じ書き方）', () => {
    const byId = new Map(QA_SKILLS.map((k) => [k.id, k]));
    expect(byId.get(hg(5))?.effect).toEqual({ type: 'attack', halfOnEvade: true });
    expect(byId.get(hg(6))?.effect).toEqual({ type: 'attack', sealTarget: true });
    expect(byId.get(hg(6))?.effectTextJa).toBe('回避されなければ、相手は次の攻撃を行えない');
    expect(byId.get(hg(7))?.effect).toEqual({ type: 'searchEvade' });
    expect(byId.get(hg(8))?.effect).toEqual({ type: 'attack', manaDrain: 1 });
    expect(byId.get(hg(8))?.effectTextJa).toBe('相手のマナ−1');
    expect(byId.get(hg(9))?.effect).toEqual({ type: 'attack', unblockable: true });
    expect(byId.get(hg(10))?.effect).toEqual({ type: 'featherRest' });
    expect(byId.get(hg(11))?.effectTextJa).toBe('ちから技、かしこさ技を回避する。');
    expect(byId.get(hg(12))?.effect).toEqual({ type: 'evade', against: 'all', minCost: 2 });
    expect(byId.get(hg(12))?.effectTextJa).toBe('マナ2以上のちから技、かしこさ技を回避する。');
  });

  it('置き場所はまだ無い：一覧・ガチャに並ばない・箱・ダンジョン・敵の編成に出ない', () => {
    expect(QA_MONSTERS.map((m) => m.id)).toContain(HUGINN_MONSTER_ID);
    expect(MONSTERS.some((m) => m.id === HUGINN_MONSTER_ID)).toBe(false);
    expect(SKILLS.some((k) => k.monsterId === HUGINN_MONSTER_ID)).toBe(false);
    expect(AJ_MONSTER_IDS).not.toContain(HUGINN_MONSTER_ID);
    for (const b of BOOSTERS) expect(b.monsters).not.toContain(HUGINN_MONSTER_ID);
    for (const e of Object.values(ENCOUNTERS)) expect(e.monsters).not.toContain(HUGINN_MONSTER_ID);
    expect(JSON.stringify(DUNGEONS)).not.toContain('huginn');
    expect(GACHA_SERIES.find((g) => g.id === 'huginn')?.rareSkillNames).toEqual(['ふたつのくちばし', 'よみのまなざし', 'すいりのいちげき', 'さきよみ']);
    expect(availableGachaSeriesFor(createNewSave()).some((g) => g.id === 'huginn')).toBe(false);
  });

  it('図鑑：ロウガのあと No.300〜312', () => {
    const mine = cardBookEntries().filter((e) => e.section.kind === 'monster' && e.section.monsterId === HUGINN_MONSTER_ID);
    expect(mine.map((e) => e.card.id)).toEqual([HUGINN_MONSTER_ID, ...Array.from({ length: 12 }, (_, i) => hg(i + 1))]);
    expect(mine.map((e) => e.no)).toEqual(Array.from({ length: 13 }, (_, i) => 300 + i));
  });

  it('絵・枠・名前のロゴ・英語・アイコン', () => {
    for (let n = 1; n <= 12; n++) expect(existsSync(`assets/images/cards/skills/${huginnArtFile(n)}`)).toBe(true);
    for (const f of ['cards/monsters/huginn_official.webp', 'cards/monsters/huginn_battlecard.png', 'ui/battlecard/frame_huginn.png', 'ui/skillcard_simple/frame_normal_huginn.webp', 'ui/skillcard_simple/frame_hand_huginn.webp', 'ui/gacha/pack_huginn.webp', 'ui/gacha/panel_huginn.webp']) {
      expect(existsSync(`assets/images/${f}`), f).toBe(true);
    }
    expect(BATTLE_CARDS[HUGINN_MONSTER_ID]?.frame).toBe('huginn');
    expect(CARD_NAME_LOGOS[HUGINN_MONSTER_ID]?.frame).toBe('#1F5C58');
    expect(CARD_NAME_LOGOS_EN[HUGINN_MONSTER_ID]?.frame).toBe('#1F5C58');
    setLanguage('en');
    try {
      expect(cardName(HUGINN_MONSTER_ID)).toBe('Huginn');
      expect(cardName(hg(7))).toBe('Whisper of Wisdom');
    } finally {
      setLanguage('ja');
    }
    expect(AJ_EN_MISSING).toEqual([]);
    expect(skillEffectIcons(getSkill(hg(6)))).toEqual([{ main: 's08' }]);
    expect(skillEffectIcons(getSkill(hg(7)))).toEqual([{ main: 'e21' }, { main: 'e15' }]);
    expect(skillEffectIcons(getSkill(hg(10)))).toEqual([{ main: 'e15', badge: { kind: 'value', text: '0' } }]);
    expect(skillEffectIcons(getSkill(hg(12)))).toEqual([{ main: 'e15', badge: { kind: 'value', text: '2+' } }]);
  });
});

/* ---------- バトル ---------- */

// 自分：フギン（p-m1 ライフ6）・ソラモ（p-m2）・ノビトン（p-m3）。相手：ソラモ（o-m1）・ラズック（o-m2）・ガウル（o-m3）
function scene(
  hand: Partial<Record<Side, string[]>>,
  opts: { mana?: Partial<Record<Side, number>>; deck?: Partial<Record<Side, string[]>>; foes?: string[]; mine?: string[] } = {},
): BattleState {
  const filler = Array.from({ length: 60 }, () => sor(1));
  const s = createBattle(
    { name: 'P', deck: { monsters: opts.mine ?? [HUGINN_MONSTER_ID, 'mon-soramo', 'mon-nobiton'], skills: filler } },
    { name: 'O', deck: { monsters: opts.foes ?? ['mon-soramo', 'mon-lazuck', 'mon-gauul'], skills: filler } },
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

const monster = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};

const patchMonster = (s: BattleState, uid: string, patch: Partial<BattleMonster>): BattleState => {
  const side: Side = s.sides.player.monsters.some((m) => m.uid === uid) ? 'player' : 'opponent';
  return { ...s, sides: { ...s.sides, [side]: { ...s.sides[side], monsters: s.sides[side].monsters.map((m) => (m.uid === uid ? { ...m, ...patch } : m)) } } };
};

const use = (s: BattleState, side: Side, cardUid: string, targetUid?: string, choice?: string): BattleState =>
  applyAction(s, { type: 'useCard', side, cardUid, ...(targetUid ? { targetUid } : {}), ...(choice ? { choice } : {}) });
const defend = (s: BattleState, side: Side, cardUid: string | null): BattleState => applyAction(s, { type: 'defend', side, cardUid });

/** 自分の手番を終えて相手の手番の攻撃のはじめへ（自分の手札・マナは keep で残す） */
function toOpponent(s: BattleState, hand: string[] = [], mana = 12, keep?: { hand: string[]; mana: number }): BattleState {
  const x = applyAction(applyAction(s, { type: 'endAttack', side: 'player' }), { type: 'endTurn', side: 'player' });
  expect(x.active).toBe('opponent');
  const player = keep
    ? { ...x.sides.player, hand: keep.hand.map((cardId, i) => ({ uid: `k${i}`, cardId })), manaPile: Array.from({ length: keep.mana }, () => sor(1)) }
    : x.sides.player;
  return { ...x, phase: 'main', sides: { player, opponent: { ...x.sides.opponent, hand: hand.map((cardId, i) => ({ uid: `q${i}`, cardId })), manaPile: Array.from({ length: mana }, () => sor(1)) } } };
}

/** 相手の手番を終えて自分の手番の攻撃のはじめへ */
function toPlayer(s: BattleState, hand: string[] = [], mana = 12): BattleState {
  const x = applyAction(applyAction(s, { type: 'endAttack', side: 'opponent' }), { type: 'endTurn', side: 'opponent' });
  expect(x.active).toBe('player');
  return { ...x, phase: 'main', sides: { ...x.sides, player: { ...x.sides.player, hand: hand.map((cardId, i) => ({ uid: `n${i}`, cardId })), manaPile: Array.from({ length: mana }, () => sor(1)) } } };
}

describe('06 よみのまなざし：回避されなければ、相手は次の攻撃を行えない', () => {
  it('当たったら（4ダメージ）、次の相手の手番は攻撃の技を使えない（すなかけと同じ封じ）', () => {
    let s = defend(use(scene({ player: [hg(6)] }), 'player', 'p0', 'o-m1'), 'opponent', null);
    expect(monster(s, 'o-m1').life).toBe(7 - 4);
    expect(monster(s, 'o-m1').sealedTurn).toBe(s.turn + 1);
    s = toOpponent(s, [sor(4)]);
    const u = cardUsability(s, 'opponent', 'q0');
    expect(u.usable).toBe(false);
  });

  it('回避されたら封じはつかない', () => {
    let s = use(scene({ player: [hg(6)], opponent: [SORAMO_EVADE] }), 'player', 'p0', 'o-m1');
    s = defend(defend(s, 'opponent', 'o0'), 'opponent', null);
    expect(monster(s, 'o-m1').life).toBe(7);
    expect(monster(s, 'o-m1').sealedTurn ?? null).toBeNull();
  });
});

describe('07 ちえのささやき：山札から回避の技カードを1枚選んで手札に加える。なければ1枚引く', () => {
  const deck = [sor(1), sor(2), hg(11), sor(3), hg(12), SORAMO_EVADE, sor(4)];

  it('選んだ回避（だれの回避でもよい）を手札に加え、山札は1枚減ってシャッフルされる', () => {
    const s0 = scene({ player: [hg(7)] }, { deck: { player: deck } });
    expect(searchEvadeChoices(s0, 'player')).toEqual([hg(11), hg(12), SORAMO_EVADE]);
    const s = use(s0, 'player', 'p0', undefined, SORAMO_EVADE);
    expect(s.sides.player.hand.map((c) => c.cardId)).toEqual([SORAMO_EVADE]);
    expect(s.sides.player.deck).toHaveLength(deck.length - 1);
    expect([...s.sides.player.deck].sort()).toEqual(deck.filter((id) => id !== SORAMO_EVADE).sort());
    expect(s.log.some((l) => l.text === 'あなたはちえのささやきで、山札から星影ステップを手札に加えた。')).toBe(true);
  });

  it('選ばないとき（CPU）：いまのマナで出せる回避を優先し、同じなら さきよみ → かぜよみ', () => {
    const s0 = scene({ player: [hg(7)] }, { deck: { player: deck } });
    expect(defaultSearchEvade(s0, 'player')).toBe(hg(12));
    expect(use(s0, 'player', 'p0').sides.player.hand.map((c) => c.cardId)).toEqual([hg(12)]);
    // さきよみが無ければ かぜよみ（ソラモの星影ステップより先）
    const noForesee = scene({ player: [hg(7)] }, { deck: { player: deck.filter((id) => id !== hg(12)) } });
    expect(defaultSearchEvade(noForesee, 'player')).toBe(hg(11));
    // マナ1（はねやすめの印なし）：かぜよみ（2）は出せないので、出せる回避が先
    const poor = scene({ player: [hg(7)] }, { mana: { player: 1 }, deck: { player: [sor(1), hg(11), sor(2)] } });
    expect(defaultSearchEvade(poor, 'player')).toBe(hg(11));
    const poor2 = scene({ player: [hg(7)] }, { mana: { player: 1 }, deck: { player: [hg(11), 'skl-gauul14-13'] } });
    expect(defaultSearchEvade(poor2, 'player')).toBe('skl-gauul14-13');
  });

  it('山札に回避が無ければ1枚引く。山札が0枚なら何もしない（負けにならない）', () => {
    const draw = use(scene({ player: [hg(7)] }, { deck: { player: [sor(3), sor(4)] } }), 'player', 'p0');
    expect(draw.sides.player.hand.map((c) => c.cardId)).toEqual([sor(3)]);
    expect(draw.sides.player.deck).toEqual([sor(4)]);
    expect(draw.log.at(-1)?.text).toBe('あなたの山札に回避のカードが無い。かわりに1枚引いた。');
    const none = use(scene({ player: [hg(7)] }, { deck: { player: [] } }), 'player', 'p0');
    expect(none.phase).not.toBe('ended');
    expect(none.sides.player.hand).toHaveLength(0);
    expect(manaOf(none.sides.player)).toBe(11);
  });
});

describe('10 はねやすめ：このあと自分が使う回避の技1回のマナを0にする', () => {
  it('印が付き、次の相手の手番に かぜよみ をマナ0で使える（マナが0でも）。使ったら印は消える', () => {
    let s = use(scene({ player: [hg(10)] }), 'player', 'p0');
    expect(monster(s, 'p-m1').featherRest).toBe(true);
    expect(s.log.at(-1)?.text).toBe('フギンははねをやすめた。次の回避のマナが0になる。');
    s = toOpponent(s, [sor(4)], 12, { hand: [hg(11)], mana: 0 });
    s = use(s, 'opponent', 'q0', 'p-m1');
    expect(s.phase).toBe('defense');
    expect(guardCost(s, getSkill(hg(11)), 'player')).toBe(0);
    expect(cardUsability(s, 'player', 'k0').usable).toBe(true);
    s = defend(defend(s, 'player', 'k0'), 'player', null);
    expect(monster(s, 'p-m1').life).toBe(6);
    expect(monster(s, 'p-m1').featherRest ?? null).toBeNull();
    expect(s.log.some((l) => l.text === 'フギンははねやすめの力で、マナを使わずに回避した。')).toBe(true);
  });

  it('期限なし：回避を使うまで手番をまたいでも残る。重ねない（もう一度使っても1回分）', () => {
    let s = use(scene({ player: [hg(10)] }), 'player', 'p0');
    s = toPlayer(toOpponent(s), [hg(10)]);
    expect(monster(s, 'p-m1').featherRest).toBe(true);
    s = use(s, 'player', 'n0');
    expect(monster(s, 'p-m1').featherRest).toBe(true);
    s = toOpponent(s, [sor(4), sor(4)], 12, { hand: [hg(11), hg(11)], mana: 2 });
    s = defend(defend(use(s, 'opponent', 'q0', 'p-m1'), 'player', 'k0'), 'player', null);
    expect(manaOf(s.sides.player)).toBe(2);
    expect(monster(s, 'p-m1').featherRest ?? null).toBeNull();
  });

  it('ほかのモンスターの回避には効かない。フギンが倒れたら消える', () => {
    let s = use(scene({ player: [hg(10)] }), 'player', 'p0');
    s = toOpponent(s, [sor(4)], 12, { hand: [SORAMO_EVADE], mana: 12 });
    s = use(s, 'opponent', 'q0', 'p-m2');
    expect(guardCost(s, getSkill(SORAMO_EVADE), 'player')).toBe(2);
    s = defend(defend(s, 'player', 'k0'), 'player', null);
    expect(manaOf(s.sides.player)).toBe(10);
    expect(monster(s, 'p-m1').featherRest).toBe(true);
    // フギンが倒れたら印は消える
    let k = patchMonster(use(scene({ player: [hg(10)] }), 'player', 'p0'), 'p-m1', { life: 1 } as Partial<BattleMonster>);
    k = toOpponent(k, [sor(4)]);
    k = defend(use(k, 'opponent', 'q0', 'p-m1'), 'player', null);
    expect(monster(k, 'p-m1').life).toBe(0);
    expect(monster(k, 'p-m1').featherRest ?? null).toBeNull();
  });
});

describe('11 かぜよみ・12 さきよみ・08 ひかりものをぬすむ', () => {
  it('さきよみ（マナ0）：マナ2以上の攻撃は回避できる。マナ1の攻撃は回避できない', () => {
    let s = toOpponent(scene({}), [sor(2), sor(3)], 12, { hand: [hg(12)], mana: 0 });
    const low = use(s, 'opponent', 'q0', 'p-m1');
    expect(cardUsability(low, 'player', 'k0').usable).toBe(false);
    s = use(s, 'opponent', 'q1', 'p-m1');
    expect(cardUsability(s, 'player', 'k0').usable).toBe(true);
    s = defend(defend(s, 'player', 'k0'), 'player', null);
    expect(monster(s, 'p-m1').life).toBe(6);
  });

  it('ひかりものをぬすむ：回避されなければ相手のマナ−1（0 より下にしない）', () => {
    const s = defend(use(scene({ player: [hg(8)] }, { mana: { opponent: 3 } }), 'player', 'p0', 'o-m1'), 'opponent', null);
    expect(monster(s, 'o-m1').life).toBe(5);
    expect(manaOf(s.sides.opponent)).toBe(2);
    const zero = defend(use(scene({ player: [hg(8)] }, { mana: { opponent: 0 } }), 'player', 'p0', 'o-m1'), 'opponent', null);
    expect(manaOf(zero.sides.opponent)).toBe(0);
  });
});

describe('CPU（指示書 BM）', () => {
  it('ちえのささやき：手札に回避が無いときに使う。あれば使わない', () => {
    const yes = scene({ player: [hg(7), sor(1)] }, { mana: { player: 1 }, deck: { player: [sor(1), hg(11), sor(2)] } });
    expect(chooseAction(yes, 'player', 'normal', 'A')).toMatchObject({ type: 'useCard', cardUid: 'p0' });
    const no = scene({ player: [hg(7), hg(11)] }, { mana: { player: 1 }, deck: { player: [sor(1), hg(12), sor(2)] } });
    const a = chooseAction(no, 'player', 'normal', 'A');
    expect(a && a.type === 'useCard' && a.cardUid === 'p0').toBe(false);
  });

  it('はねやすめ：かぜよみがあってマナが2に足りないときに使う。印があれば使わない', () => {
    const yes = scene({ player: [hg(10), hg(11)] }, { mana: { player: 2 }, deck: { player: [sor(1)] } });
    expect(chooseAction(yes, 'player', 'normal', 'A')).toMatchObject({ type: 'useCard', cardUid: 'p0', userUid: 'p-m1' });
    const marked = patchMonster(yes, 'p-m1', { featherRest: true } as Partial<BattleMonster>);
    const a = chooseAction(marked, 'player', 'normal', 'A');
    expect(a && a.type === 'useCard' && a.cardUid === 'p0').toBe(false);
  });
});
