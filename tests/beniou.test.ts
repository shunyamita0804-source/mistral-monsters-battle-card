import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { BENIOU_COLOR, BENIOU_MONSTER_ID, beniouArtFile, beniouSkillId } from '../src/data/beniou.ts';
import { CARD_NAME_LOGOS, CARD_NAME_LOGOS_EN } from '../src/data/cardNameLogos.generated.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { getMonster, getSkill, MONSTERS, QA_MONSTERS, QA_SKILLS, SKILLS, skillsOf } from '../src/data/cards.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { AJ_MONSTER_IDS, AJ_QA_SKILLS, MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import {
  applyAction,
  attackPower,
  badStatusKinds,
  cardUsability,
  createBattle,
  isMenaced,
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

/** 指示書 BP（2026-11-07）：ベニオウ（オルティガの王者ゼルガンの切り札・A。置き場所ができるまで確かめ用だけ）と、いかり・おたけび・おにのいあつ */

const bn = beniouSkillId;
const sor = (n: number): string => `skl-soramo14-${String(n).padStart(2, '0')}`;
/** ソラモの星影ステップ（回避・マナ2）・ソラモの防御（星のまもり・マナ1・3減らす） */
const SORAMO_EVADE = sor(14);
const SORAMO_GUARD = sor(12);
const PURIFY = 'skl-kuyo-08';

describe('ベニオウのデータ（指示書の表のとおり）', () => {
  it('LIFE 8・地上・深いえんじ #6B1E3A。ID は mon-beniou。説明に神様・信仰の言葉を使わない', () => {
    const m = getMonster(BENIOU_MONSTER_ID);
    expect(m.name).toBe('ベニオウ');
    expect(m.life).toBe(8);
    expect(m.habitat).toBe('ground');
    expect(MONSTER_HABITAT[BENIOU_MONSTER_ID]).toBe('ground');
    expect(m.themeColor).toBe(BENIOU_COLOR);
    expect(BENIOU_COLOR).toBe('#6B1E3A');
    expect(m.description).not.toMatch(/神|祈|信仰|閻魔/);
  });

  it('技12枚：名前・分類・マナ・ダメージ・レアは表のとおり（レア＝05・06・07・12）。防御2・回避0', () => {
    const table = AJ_QA_SKILLS[BENIOU_MONSTER_ID] ?? [];
    const expected: [string, string, number, number | null][] = [
      ['はりて', 'ち', 1, 2],
      ['なぎはらい', 'ち', 2, 4],
      ['ふみつけ', 'ち', 3, 5],
      ['おにのいかり', 'ち', 3, 3],
      ['かなぼうくだき', 'ち', 4, 6],
      ['いかりのかなぼう', 'ち', 5, 6],
      ['おにのいちげき', 'ち', 7, 11],
      ['おにび', 'か', 2, 3],
      ['おたけび', '特', 2, null],
      ['おにのいあつ', '特', 2, null],
      ['かなぼうでうける', '防', 1, null],
      ['ごうりきのはだ', '防', 2, null],
    ];
    expect(table.map((r) => [r.name, r.cat, r.mana, r.damage])).toEqual(expected);
    expect(table.map((r) => r.id)).toEqual(expected.map((_, i) => bn(i + 1)));
    expect(table.map((r) => r.art)).toEqual(expected.map((_, i) => beniouArtFile(i + 1)));
    expect(table.filter((r) => r.rare).map((r) => r.id)).toEqual([bn(5), bn(6), bn(7), bn(12)]);
    expect(table.filter((r) => r.cat === '防')).toHaveLength(2);
    expect(table.filter((r) => r.cat === '避')).toHaveLength(0);
    expect(skillsOf(BENIOU_MONSTER_ID).map((k) => k.displayNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('効果と文（CSV のとおり。防御の文は決まりの形）', () => {
    const byId = new Map(QA_SKILLS.map((k) => [k.id, k]));
    expect(byId.get(bn(4))?.effect).toEqual({ type: 'attack', rageBonus: 3 });
    expect(byId.get(bn(4))?.effectTextJa).toBe('自分のLIFEが半分以下ならダメージ＋3');
    expect(byId.get(bn(5))?.effect).toEqual({ type: 'attack', unblockable: true });
    expect(byId.get(bn(6))?.effect).toEqual({ type: 'attack', rageBonus: 4 });
    expect(byId.get(bn(9))?.effect).toEqual({ type: 'roar' });
    expect(byId.get(bn(9))?.effectTextJa).toBe('次の自分の手番の終わりまでに使う次のちから技のダメージを2倍');
    expect(byId.get(bn(10))?.effect).toEqual({ type: 'menace' });
    expect(byId.get(bn(10))?.effectTextJa).toBe('相手1体は次の自分の手番の終わりまで回避できない');
    expect(byId.get(bn(11))?.effectTextJa).toBe('ちから技の受けるダメージを3減らす。');
    expect(byId.get(bn(12))?.effectTextJa).toBe('ちから技、かしこさ技の受けるダメージを3減らす。');
  });

  it('置き場所はまだ無い：一覧・ガチャに並ばない・箱・ダンジョン・敵の編成に出ない', () => {
    expect(QA_MONSTERS.map((m) => m.id)).toContain(BENIOU_MONSTER_ID);
    expect(MONSTERS.some((m) => m.id === BENIOU_MONSTER_ID)).toBe(false);
    expect(SKILLS.some((k) => k.monsterId === BENIOU_MONSTER_ID)).toBe(false);
    expect(AJ_MONSTER_IDS).not.toContain(BENIOU_MONSTER_ID);
    for (const b of BOOSTERS) expect(b.monsters).not.toContain(BENIOU_MONSTER_ID);
    for (const e of Object.values(ENCOUNTERS)) expect(e.monsters).not.toContain(BENIOU_MONSTER_ID);
    expect(JSON.stringify(DUNGEONS)).not.toContain('beniou');
    expect(GACHA_SERIES.find((g) => g.id === 'beniou')?.rareSkillNames).toEqual(['かなぼうくだき', 'いかりのかなぼう', 'おにのいちげき', 'ごうりきのはだ']);
    expect(availableGachaSeriesFor(createNewSave()).some((g) => g.id === 'beniou')).toBe(false);
  });

  it('図鑑：ノウスのあと No.326〜338', () => {
    const mine = cardBookEntries().filter((e) => e.section.kind === 'monster' && e.section.monsterId === BENIOU_MONSTER_ID);
    expect(mine.map((e) => e.card.id)).toEqual([BENIOU_MONSTER_ID, ...Array.from({ length: 12 }, (_, i) => bn(i + 1))]);
    expect(mine.map((e) => e.no)).toEqual(Array.from({ length: 13 }, (_, i) => 326 + i));
  });

  it('絵・枠・名前のロゴ・英語・アイコン', () => {
    for (let n = 1; n <= 12; n++) expect(existsSync(`assets/images/cards/skills/${beniouArtFile(n)}`)).toBe(true);
    for (const f of ['cards/monsters/beniou_official.webp', 'cards/monsters/beniou_battlecard.png', 'ui/battlecard/frame_beniou.png', 'ui/skillcard_simple/frame_normal_beniou.webp', 'ui/skillcard_simple/frame_hand_beniou.webp', 'ui/gacha/pack_beniou.webp', 'ui/gacha/panel_beniou.webp']) {
      expect(existsSync(`assets/images/${f}`), f).toBe(true);
    }
    expect(BATTLE_CARDS[BENIOU_MONSTER_ID]?.frame).toBe('beniou');
    expect(CARD_NAME_LOGOS[BENIOU_MONSTER_ID]?.frame).toBe('#6B1E3A');
    expect(CARD_NAME_LOGOS_EN[BENIOU_MONSTER_ID]?.frame).toBe('#6B1E3A');
    setLanguage('en');
    try {
      expect(cardName(BENIOU_MONSTER_ID)).toBe('Beniou');
      expect(cardName(bn(9))).toBe('War Cry');
    } finally {
      setLanguage('ja');
    }
    expect(AJ_EN_MISSING).toEqual([]);
    expect(skillEffectIcons(getSkill(bn(4)))).toEqual([{ main: 'b09', badge: { kind: 'value', text: '+3' } }]);
    expect(skillEffectIcons(getSkill(bn(9)))).toEqual([{ main: 'b01', marks: ['force'], badge: { kind: 'value', text: '×2' } }]);
    expect(skillEffectIcons(getSkill(bn(10)))).toEqual([{ main: 's09', badge: { kind: 'turn', text: '1' } }]);
  });
});

/* ---------- バトル ---------- */

// 自分：ベニオウ（p-m1 ライフ8）・ソラモ（p-m2）・クヨウ（p-m3）。相手：ソラモ（o-m1 ライフ7）・ラズック（o-m2）・ガウル（o-m3）
function scene(
  hand: Partial<Record<Side, string[]>>,
  opts: { mana?: Partial<Record<Side, number>>; deck?: Partial<Record<Side, string[]>>; mine?: string[] } = {},
): BattleState {
  const filler = Array.from({ length: 60 }, () => sor(1));
  const s = createBattle(
    { name: 'P', deck: { monsters: opts.mine ?? [BENIOU_MONSTER_ID, 'mon-soramo', 'mon-kuyo'], skills: filler } },
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

const monster = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};
const patchMonster = (s: BattleState, uid: string, patch: Partial<BattleMonster>): BattleState => {
  const side: Side = s.sides.player.monsters.some((m) => m.uid === uid) ? 'player' : 'opponent';
  return { ...s, sides: { ...s.sides, [side]: { ...s.sides[side], monsters: s.sides[side].monsters.map((m) => (m.uid === uid ? { ...m, ...patch } : m)) } } };
};
const use = (s: BattleState, side: Side, cardUid: string, targetUid?: string, userUid?: string): BattleState =>
  applyAction(s, { type: 'useCard', side, cardUid, ...(targetUid ? { targetUid } : {}), ...(userUid ? { userUid } : {}) });
const defend = (s: BattleState, side: Side, cardUid: string | null): BattleState => applyAction(s, { type: 'defend', side, cardUid });

/** 自分の手番を終えて相手の手番へ → 相手の手番を終えて自分の手番へ（手札・マナを置きなおす） */
function nextOwnTurn(s: BattleState, hand: string[], mana = 12): BattleState {
  let x = applyAction(applyAction(s, { type: 'endAttack', side: 'player' }), { type: 'endTurn', side: 'player' });
  x = { ...x, phase: 'main', sides: { ...x.sides, opponent: { ...x.sides.opponent, hand: [] } } };
  x = applyAction(applyAction(x, { type: 'endAttack', side: 'opponent' }), { type: 'endTurn', side: 'opponent' });
  expect(x.active).toBe('player');
  return { ...x, phase: 'main', sides: { ...x.sides, player: { ...x.sides.player, hand: hand.map((cardId, i) => ({ uid: `n${i}`, cardId })), manaPile: Array.from({ length: mana }, () => sor(1)) } } };
}

describe('04・06 いかり：自分の LIFE が半分以下ならダメージ＋', () => {
  it('LIFE 4（8 の半分）で おにのいかり 3＋3＝6。LIFE 5 では 3。記録「ベニオウのいかり！ ダメージ＋3」', () => {
    const half = patchMonster(scene({ player: [bn(4)] }), 'p-m1', { life: 4 });
    expect(attackPower(half, getSkill(bn(4)), monster(half, 'p-m1'))).toBe(6);
    const s = defend(use(half, 'player', 'p0', 'o-m1'), 'opponent', null);
    expect(monster(s, 'o-m1').life).toBe(7 - 6);
    expect(s.log.some((l) => l.text === 'ベニオウのいかり！ ダメージ＋3')).toBe(true);
    const five = patchMonster(scene({ player: [bn(4)] }), 'p-m1', { life: 5 });
    expect(attackPower(five, getSkill(bn(4)), monster(five, 'p-m1'))).toBe(3);
    expect(defend(use(five, 'player', 'p0', 'o-m1'), 'opponent', null).log.some((l) => l.text.startsWith('ベニオウのいかり！'))).toBe(false);
  });

  it('いかりのかなぼう：LIFE 半分以下で 6＋4＝10', () => {
    const half = patchMonster(scene({}), 'p-m1', { life: 2 });
    expect(attackPower(half, getSkill(bn(6)), monster(half, 'p-m1'))).toBe(10);
  });
});

describe('09 おたけび：次のちから技のダメージを2倍（次の自分の手番の終わりまで）', () => {
  it('次の手番の なぎはらい 4 → 8。使ったら消える。記録が出る', () => {
    let s = use(scene({ player: [bn(9)] }), 'player', 'p0');
    expect(monster(s, 'p-m1').roar).toEqual({ untilTurn: s.turn + 2 });
    expect(s.log.at(-1)?.text).toBe('ベニオウのおたけび！ 次のちから技のダメージ2倍（次の自分のターンの終わりまで）。');
    s = nextOwnTurn(s, [bn(2)]);
    expect(attackPower(s, getSkill(bn(2)), monster(s, 'p-m1'))).toBe(8);
    s = defend(use(s, 'player', 'n0', 'o-m1'), 'opponent', null);
    expect(monster(s, 'o-m1').life).toBe(7 - 8 < 0 ? 0 : 7 - 8);
    expect(monster(s, 'p-m1').roar ?? null).toBeNull();
    expect(s.log.some((l) => l.text === 'ベニオウのおたけびの力で、ダメージ2倍！')).toBe(true);
  });

  it('計算の順番：いかり込みのダメージ ×2 → ほかの増減（ほっぺにためる・とおぼえ＋2）', () => {
    const s = patchMonster(scene({}), 'p-m1', { life: 4, roar: { untilTurn: 5 }, charge: 2, chargeUntil: 5 });
    // おにのいかり (3＋3)×2＋2＝14
    expect(attackPower(s, getSkill(bn(4)), monster(s, 'p-m1'))).toBe(14);
  });

  it('かしこさ技（おにび）には効かず、消えもしない。回避されても、ちから技を使えば消える', () => {
    let s = patchMonster(scene({ player: [bn(8)] }), 'p-m1', { roar: { untilTurn: 5 } });
    expect(attackPower(s, getSkill(bn(8)), monster(s, 'p-m1'))).toBe(3);
    s = defend(use(s, 'player', 'p0', 'o-m1'), 'opponent', null);
    expect(monster(s, 'p-m1').roar).toEqual({ untilTurn: 5 });
    let e = patchMonster(scene({ player: [bn(2)], opponent: [SORAMO_EVADE] }), 'p-m1', { roar: { untilTurn: 5 } });
    e = defend(defend(use(e, 'player', 'p0', 'o-m1'), 'opponent', 'o0'), 'opponent', null);
    expect(monster(e, 'o-m1').life).toBe(7);
    expect(monster(e, 'p-m1').roar ?? null).toBeNull();
  });

  it('期限：次の自分の手番の終わりまで。過ぎたら消えて記録「ベニオウのおたけびの力が消えた。」', () => {
    let s = use(scene({ player: [bn(9)] }), 'player', 'p0');
    s = nextOwnTurn(s, []);
    expect(monster(s, 'p-m1').roar).not.toBeNull();
    s = nextOwnTurn(s, []);
    expect(monster(s, 'p-m1').roar ?? null).toBeNull();
    expect(s.log.some((l) => l.text === 'ベニオウのおたけびの力が消えた。')).toBe(true);
  });
});

describe('10 おにのいあつ：相手1体は次の自分の手番の終わりまで回避できない', () => {
  it('かけた相手は回避の技を使えない（防御は使える）。仲間の攻撃にも効く。悪い状態に入る', () => {
    let s = use(scene({ player: [bn(10), sor(2)], opponent: [SORAMO_EVADE, SORAMO_GUARD] }), 'player', 'p0', 'o-m1');
    expect(isMenaced(s, monster(s, 'o-m1'))).toBe(true);
    expect(badStatusKinds(s, monster(s, 'o-m1'))).toContain('menaced');
    expect(s.log.at(-1)?.text).toBe('ソラモはおにのいあつで足がすくんだ！（回避できない）');
    // 仲間（ソラモ p-m2）の攻撃：回避はできない・防御はできる
    s = use(s, 'player', 'p1', 'o-m1', 'p-m2');
    expect(s.phase).toBe('defense');
    expect(cardUsability(s, 'opponent', 'o0')).toEqual({ usable: false, reason: 'おにのいあつで、回避できません' });
    expect(cardUsability(s, 'opponent', 'o1').usable).toBe(true);
  });

  it('期限：次の自分の手番の間も回避できない。その次の手番には消える', () => {
    let s = use(scene({ player: [bn(10)] }), 'player', 'p0', 'o-m1');
    s = nextOwnTurn(s, []);
    expect(isMenaced(s, monster(s, 'o-m1'))).toBe(true);
    s = nextOwnTurn(s, []);
    expect(isMenaced(s, monster(s, 'o-m1'))).toBe(false);
    expect(monster(s, 'o-m1').menace ?? null).toBeNull();
  });

  it('クヨウのおはらいで消える。まよけのふだの間はつかない', () => {
    // 相手の側にかかったものを、相手のクヨウが消す（ここでは自分の側にかけて自分のクヨウ p-m3 で消す）
    let s = patchMonster(scene({ player: [PURIFY] }), 'p-m2', { menace: { untilTurn: 9 } });
    expect(isMenaced(s, monster(s, 'p-m2'))).toBe(true);
    s = use(s, 'player', 'p0', 'p-m2', 'p-m3');
    expect(isMenaced(s, monster(s, 'p-m2'))).toBe(false);
    // まよけのふだ（相手の側）
    const base = scene({ player: [bn(10)] });
    const c = use({ ...base, sides: { ...base.sides, opponent: { ...base.sides.opponent, wardCharm: { untilTurn: 9 } } } }, 'player', 'p0', 'o-m1');
    expect(isMenaced(c, monster(c, 'o-m1'))).toBe(false);
    expect(c.log.at(-1)?.text).toBe('まよけのふだが防いだ！ ソラモに悪い状態はつかない。');
  });

  it('倒れたら消える', () => {
    let s = patchMonster(scene({ player: [bn(1)] }), 'o-m1', { life: 1, menace: { untilTurn: 9 } });
    s = defend(use(s, 'player', 'p0', 'o-m1'), 'opponent', null);
    expect(monster(s, 'o-m1').life).toBe(0);
    expect(monster(s, 'o-m1').menace ?? null).toBeNull();
  });
});

describe('CPU（指示書 BP）', () => {
  it('おにのいあつ：回避の技を持つ相手（ソラモ）にかける', () => {
    const s = scene({ player: [bn(10), bn(1)] }, { mana: { player: 3 } });
    const a = chooseAction(s, 'player', 'normal', 'A');
    expect(a).toMatchObject({ type: 'useCard', cardUid: 'p0' });
    if (a?.type === 'useCard') expect(['o-m1', 'o-m2', 'o-m3']).toContain(a.targetUid);
  });

  it('おたけび：手札にダメージ4以上のちから技があり、次の手番に払えるとき使う', () => {
    const s = scene({ player: [bn(9), bn(3)] }, { mana: { player: 3 } });
    expect(chooseAction(s, 'player', 'normal', 'A')).toMatchObject({ type: 'useCard', cardUid: 'p0' });
    const no = scene({ player: [bn(9), bn(1)] }, { mana: { player: 3 } });
    const a = chooseAction(no, 'player', 'normal', 'A');
    expect(a && a.type === 'useCard' && a.cardUid === 'p0').toBe(false);
  });
});
