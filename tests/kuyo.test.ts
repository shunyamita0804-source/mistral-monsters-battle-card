import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { CARD_NAME_LOGOS, CARD_NAME_LOGOS_EN } from '../src/data/cardNameLogos.generated.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { getMonster, MONSTERS, QA_MONSTERS, QA_SKILLS, SKILLS, skillsOf } from '../src/data/cards.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { KUYO_COLOR, KUYO_MONSTER_ID, kuyoArtFile, kuyoSkillId } from '../src/data/kuyo.ts';
import { AJ_MONSTER_IDS, AJ_QA_SKILLS, MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import {
  applyAction,
  badStatusKinds,
  cardUsability,
  createBattle,
  incomingDamage,
  wardCharmActive,
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

/** 指示書 BH（2026-11-05）：クヨウ（霧の廃坑の切り札・B。霧の廃坑ができるまで確かめ用だけ）と、新しい効果 おはらい・まよけのふだ・みがわり */

const ky = kuyoSkillId;
const sor = (n: number): string => `skl-soramo14-${String(n).padStart(2, '0')}`;
const SAND = 'skl-soramo14-09'; // すなかけ（攻撃できない）
const LURE = 'skl-lazuck-07'; // おびきよせ
const DUST = 'skl-lazuck-08'; // ダストキック（ちから技−1）
const WRAP = 'skl-nobiton-03'; // まきつく（行動できない）

describe('クヨウのデータ（指示書の表のとおり）', () => {
  it('LIFE 8・地上・霧の藤ねず #87649C。ID は mon-kuyo', () => {
    const m = getMonster(KUYO_MONSTER_ID);
    expect(m.name).toBe('クヨウ');
    expect(m.life).toBe(8);
    expect(m.habitat).toBe('ground');
    expect(MONSTER_HABITAT[KUYO_MONSTER_ID]).toBe('ground');
    expect(m.themeColor).toBe(KUYO_COLOR);
    expect(KUYO_COLOR).toBe('#87649C');
    expect(m.isPlaceholder).toBe(false);
  });

  it('技12枚：名前・分類・マナ・ダメージ・レアは指示書のとおり（レア＝06・07・09・12）', () => {
    const table = AJ_QA_SKILLS[KUYO_MONSTER_ID] ?? [];
    const expected: [string, string, number, number | null][] = [
      ['しっぽはらい', 'ち', 0, 1],
      ['まえあしでおす', 'ち', 1, 1], // 2026-11-05 案G（2 → 1）
      ['つのでつく', 'ち', 2, 3],
      ['たてがみをふるう', 'ち', 3, 4],
      ['ひかるまなざし', 'か', 1, 1],
      ['ここのつのめ', 'か', 3, 3],
      ['はらえのひかり', 'か', 4, 5],
      ['おはらい', '特', 1, null],
      ['まよけのふだ', '特', 2, null],
      ['たてがみのまもり', '防', 1, null],
      ['みがわり', '防', 1, null],
      ['きりのなかへ', '避', 2, null],
    ];
    expect(table.map((r) => [r.name, r.cat, r.mana, r.damage])).toEqual(expected);
    expect(table.map((r) => r.id)).toEqual(expected.map((_, i) => ky(i + 1)));
    expect(table.map((r) => r.art)).toEqual(expected.map((_, i) => kuyoArtFile(i + 1)));
    expect(table.filter((r) => r.rare).map((r) => r.id)).toEqual([ky(6), ky(7), ky(9), ky(12)]);
    expect(skillsOf(KUYO_MONSTER_ID).map((k) => k.displayNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('効果：05・06 回避されない・08 おはらい・09 まよけのふだ・10 ちから・かしこさ −3・11 みがわり（かばう＋−2）・12 条件なしの回避', () => {
    const byId = new Map(QA_SKILLS.map((k) => [k.id, k]));
    expect(byId.get(ky(5))?.effect).toMatchObject({ type: 'attack', undodgeable: true });
    expect(byId.get(ky(6))?.effect).toMatchObject({ type: 'attack', undodgeable: true });
    expect(byId.get(ky(7))?.effect).toEqual({ type: 'attack' });
    expect(byId.get(ky(8))?.effect).toEqual({ type: 'purify', heal: 1 });
    expect(byId.get(ky(8))?.effectTextJa).toBe('味方1体の悪い状態をすべて消し、ライフ＋1（もとのLIFEまで）');
    expect(byId.get(ky(9))?.effect).toEqual({ type: 'wardCharm' });
    expect(byId.get(ky(10))?.effect).toEqual({ type: 'defense', reduce: 3, against: 'all' });
    expect(byId.get(ky(11))?.effect).toEqual({ type: 'cover', reduce: 2 });
    expect(byId.get(ky(12))?.effect).toEqual({ type: 'evade', against: 'all' });
  });

  it('入手は霧の廃坑（まだ無い）：一覧・ガチャに並ばない・箱・ダンジョン・敵の編成に出ない（確かめ用 QA_MONSTERS・QA_SKILLS）', () => {
    expect(QA_MONSTERS.map((m) => m.id)).toContain(KUYO_MONSTER_ID);
    expect(QA_SKILLS.filter((k) => k.monsterId === KUYO_MONSTER_ID)).toHaveLength(12);
    expect(MONSTERS.some((m) => m.id === KUYO_MONSTER_ID)).toBe(false);
    expect(SKILLS.some((k) => k.monsterId === KUYO_MONSTER_ID)).toBe(false);
    expect(AJ_MONSTER_IDS).not.toContain(KUYO_MONSTER_ID);
    for (const b of BOOSTERS) expect(b.monsters).not.toContain(KUYO_MONSTER_ID);
    for (const e of Object.values(ENCOUNTERS)) expect(e.monsters).not.toContain(KUYO_MONSTER_ID);
    expect(JSON.stringify(DUNGEONS)).not.toContain('kuyo');
    // ガチャのシリーズは作ってあるが、クヨウのモンスターカードを持つまで並ばない
    const series = GACHA_SERIES.find((g) => g.id === 'kuyo');
    expect(series?.rareSkillNames).toEqual(['ここのつのめ', 'はらえのひかり', 'まよけのふだ', 'きりのなかへ']);
    const save = createNewSave();
    expect(availableGachaSeriesFor(save).some((g) => g.id === 'kuyo')).toBe(false);
    expect(availableGachaSeriesFor({ ...save, collection: { ...save.collection, [KUYO_MONSTER_ID]: 1 } }).some((g) => g.id === 'kuyo')).toBe(true);
  });

  it('図鑑：ギアロスのあと No.248〜260（本体 → 技12枚）', () => {
    const entries = cardBookEntries();
    const mine = entries.filter((e) => e.section.kind === 'monster' && e.section.monsterId === KUYO_MONSTER_ID);
    expect(mine.map((e) => e.card.id)).toEqual([KUYO_MONSTER_ID, ...Array.from({ length: 12 }, (_, i) => ky(i + 1))]);
    expect(mine.map((e) => e.no)).toEqual(Array.from({ length: 13 }, (_, i) => 248 + i));
    const gearos = entries.find((e) => e.card.id === 'mon-gearos');
    expect(gearos?.no).toBe(235);
  });

  it('絵：技12枚・正式カード・バトル用・枠・パック・販売機の窓・名前のロゴ（日英）', () => {
    for (let n = 1; n <= 12; n++) expect(existsSync(`assets/images/cards/skills/${kuyoArtFile(n)}`)).toBe(true);
    for (const f of [
      'assets/images/cards/monsters/kuyo_official.webp',
      'assets/images/cards/monsters/kuyo_battlecard.png',
      'assets/images/ui/battlecard/frame_kuyo.png',
      'assets/images/ui/skillcard_simple/frame_normal_kuyo.webp',
      'assets/images/ui/skillcard_simple/frame_hand_kuyo.webp',
      'assets/images/ui/gacha/pack_kuyo.webp',
      'assets/images/ui/gacha/panel_kuyo.webp',
    ]) {
      expect(existsSync(f), f).toBe(true);
    }
    expect(BATTLE_CARDS[KUYO_MONSTER_ID]?.frame).toBe('kuyo');
    expect(CARD_NAME_LOGOS[KUYO_MONSTER_ID]?.frame).toBe('#87649C');
    expect(CARD_NAME_LOGOS_EN[KUYO_MONSTER_ID]?.frame).toBe('#87649C');
  });

  it('英語の名前と効果の文（仮訳）がある', () => {
    setLanguage('en');
    try {
      expect(cardName(KUYO_MONSTER_ID)).toBe('Kuyo');
      expect(cardName(ky(8))).toBe('Purify');
      expect(cardName(ky(9))).toBe('Ward Charm');
      expect(cardName(ky(11))).toBe('Stand-In');
      expect(cardName(ky(12))).toBe('Into the Fog');
    } finally {
      setLanguage('ja');
    }
    expect(AJ_EN_MISSING).toEqual([]);
  });

  it('効果のアイコン：みがわりは かばう に −2 の札。おはらい・まよけのふだは【仮】のアイコン', () => {
    const byId = new Map(QA_SKILLS.map((k) => [k.id, k]));
    const icon = (n: number) => {
      const k = byId.get(ky(n));
      return k ? skillEffectIcons(k) : null;
    };
    expect(icon(11)).toEqual([{ main: 'b05', marks: ['ally'], badge: { kind: 'value', text: '−2' } }]);
    expect(icon(8)).not.toBeNull();
    expect(icon(9)).not.toBeNull();
    expect(icon(10)).toEqual([{ main: 'e05' }, { main: 'e06' }]);
  });
});

/* ---------- バトル ---------- */

// 自分：クヨウ（p-m1 ライフ8）・ソラモ（p-m2）・ノビトン（p-m3）。相手：ソラモ（o-m1）・ラズック（o-m2）・ノビトン（o-m3）
function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}, active: Side = 'player'): BattleState {
  const filler = Array.from({ length: 60 }, () => sor(1));
  const s = createBattle(
    { name: 'P', deck: { monsters: [KUYO_MONSTER_ID, 'mon-soramo', 'mon-nobiton'], skills: filler } },
    { name: 'O', deck: { monsters: ['mon-soramo', 'mon-lazuck', 'mon-nobiton'], skills: filler } },
    11,
    'player',
  );
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 12 }, () => sor(1)),
  });
  return { ...s, phase: 'main', active, manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
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

/** 自分の手番を終えて相手の手番の攻撃のはじめへ（相手の手札・マナを入れかえる） */
function toOpponent(s: BattleState, hand: string[], mana = 12): BattleState {
  const x = applyAction(applyAction(s, { type: 'endAttack', side: 'player' }), { type: 'endTurn', side: 'player' });
  expect(x.active).toBe('opponent');
  return { ...x, phase: 'main', sides: { ...x.sides, opponent: { ...x.sides.opponent, hand: hand.map((cardId, i) => ({ uid: `q${i}`, cardId })), manaPile: Array.from({ length: mana }, () => sor(1)) } } };
}

/** 相手の手番を終えて自分の手番の攻撃のはじめへ */
function toPlayer(s: BattleState, hand: string[], mana = 12): BattleState {
  const x = applyAction(applyAction(s, { type: 'endAttack', side: 'opponent' }), { type: 'endTurn', side: 'opponent' });
  expect(x.active).toBe('player');
  return { ...x, phase: 'main', sides: { ...x.sides, player: { ...x.sides.player, hand: hand.map((cardId, i) => ({ uid: `n${i}`, cardId })), manaPile: Array.from({ length: mana }, () => sor(1)) } } };
}

describe('悪い状態（相手の技で味方についたもの）', () => {
  it('すなかけ・まきつく・ダストキック・おびきよせ は悪い状態。自分でかけた良い状態（ためている・しめったはだ など）は入らない', () => {
    let s = scene({});
    s = patchMonster(s, 'p-m2', { sealedTurn: s.turn, stunnedTurn: s.turn, weakenTurn: { stat: 'force', amount: 1, turn: s.turn }, taunt: { monsterId: 'mon-lazuck', turn: s.turn } });
    expect(badStatusKinds(s, monster(s, 'p-m2'))).toEqual(['sealed', 'stunned', 'weaken', 'taunt']);
    s = patchMonster(s, 'p-m3', { charge: 2, shield: { against: 'all', reduce: 3, untilTurn: s.turn + 1 }, energy: { turn: s.turn } });
    expect(badStatusKinds(s, monster(s, 'p-m3'))).toEqual([]);
    // 期限の過ぎたもの（前の手番の印）は数えない
    s = patchMonster(s, 'p-m3', { sealedTurn: s.turn - 1 });
    expect(badStatusKinds(s, monster(s, 'p-m3'))).toEqual([]);
  });
});

describe('08 おはらい：味方1体の悪い状態をすべて消す', () => {
  it('悪い状態も無く、ライフも満タンの味方しかいないときだけ使えない（理由を出す）', () => {
    const s = scene({ player: [ky(8)] });
    expect(cardUsability(s, 'player', 'p0')).toEqual({ usable: false, reason: '悪い状態のある味方も、ライフの減った味方もいません' });
    const hurt = patchMonster(s, 'p-m3', { life: 5 });
    expect(cardUsability(hurt, 'player', 'p0').usable).toBe(true);
  });

  it('BH の直し：悪い状態が無くても、ライフの減った味方を +1（もとの LIFE まで）', () => {
    let s = patchMonster(scene({ player: [ky(8), ky(8)] }), 'p-m3', { life: 5 });
    s = use(s, 'player', 'p0', 'p-m3');
    expect(monster(s, 'p-m3').life).toBe(6);
    expect(s.log.some((l) => l.text.startsWith('おはらい！'))).toBe(false);
    // 満タンなら上がらない（悪い状態だけ消す）
    let f = patchMonster(scene({ player: [ky(8)] }), 'p-m2', { sealedTurn: 1 });
    f = use(f, 'player', 'p0', 'p-m2');
    expect(monster(f, 'p-m2').life).toBe(monster(f, 'p-m2').maxLife);
    expect(badStatusKinds(f, monster(f, 'p-m2'))).toEqual([]);
  });

  it('BH の直し：じならし（回避できない）も悪い状態。消せる', () => {
    let s = patchMonster(scene({ player: [ky(8)] }), 'p-m2', { pinTurn: 1, life: 4 });
    expect(badStatusKinds(s, monster(s, 'p-m2'))).toEqual(['pinned']);
    s = use(s, 'player', 'p0', 'p-m2');
    expect(monster(s, 'p-m2').pinTurn).toBeNull();
    expect(monster(s, 'p-m2').life).toBe(5);
  });

  it('相手のすなかけ・まきつくのあと、自分の手番に消すと、その味方はすぐ動ける。記録の文が出る', () => {
    let s = scene({});
    s = toOpponent(s, [SAND, WRAP]);
    s = use(s, 'opponent', 'q0', 'p-m2'); // ソラモにすなかけ
    s = use(s, 'opponent', 'q1', 'p-m3'); // ノビトンにまきつく
    s = applyAction(s, { type: 'defend', side: 'player', cardUid: null });
    s = toPlayer(s, [ky(8), sor(3), 'skl-nobiton-01']);
    expect(badStatusKinds(s, monster(s, 'p-m2'))).toEqual(['sealed']);
    expect(badStatusKinds(s, monster(s, 'p-m3'))).toEqual(['stunned']);
    // ソラモの攻撃は封じられている
    expect(cardUsability(s, 'player', 'n1').usable).toBe(false);
    s = use(s, 'player', 'n0', 'p-m2');
    expect(badStatusKinds(s, monster(s, 'p-m2'))).toEqual([]);
    expect(s.log.at(-1)?.text).toBe('おはらい！ ソラモの悪い状態が消えた。');
    expect(cardUsability(s, 'player', 'n1').usable).toBe(true);
    // ノビトンはまだ止まったまま（1体だけ）
    expect(badStatusKinds(s, monster(s, 'p-m3'))).toEqual(['stunned']);
  });

  it('悪い状態をすべて消す（攻撃できない・行動できない・技のダメージ−・おびきよせ）。クヨウ自身も選べる', () => {
    let s = scene({ player: [ky(8)] });
    s = patchMonster(s, 'p-m1', { sealedTurn: s.turn, weakenTurn: { stat: 'force', amount: 1, turn: s.turn }, taunt: { monsterId: 'mon-lazuck', turn: s.turn } });
    s = use(s, 'player', 'p0', 'p-m1');
    const m = monster(s, 'p-m1');
    expect(m.sealedTurn).toBeNull();
    expect(m.weakenTurn).toBeNull();
    expect(m.taunt).toBeNull();
    expect(badStatusKinds(s, m)).toEqual([]);
    expect(m.acted).toBe(true);
  });
});

describe('09 まよけのふだ：次の相手の手番が終わるまで、味方全員に悪い状態がつかない', () => {
  it('すなかけ・ダストキック・おびきよせ・まきつく を防ぐ（まきつくのダメージは受ける）。記録に「まよけのふだが防いだ」', () => {
    let s = use(scene({ player: [ky(9)] }), 'player', 'p0');
    expect(wardCharmActive(s, 'player')).toBe(true);
    expect(s.sides.player.wardCharm).toEqual({ untilTurn: s.turn + 1 });
    // 相手の3体（ソラモ・ラズック・ノビトン）がそれぞれ1回ずつ
    s = toOpponent(s, [SAND, DUST, WRAP]);
    expect(wardCharmActive(s, 'player')).toBe(true);
    s = use(s, 'opponent', 'q0', 'p-m2');
    expect(s.log.at(-1)?.text).toBe('まよけのふだが防いだ！ ソラモに悪い状態はつかない。');
    s = use(s, 'opponent', 'q1', 'p-m2');
    s = use(s, 'opponent', 'q2', 'p-m1');
    s = applyAction(s, { type: 'defend', side: 'player', cardUid: null });
    expect(monster(s, 'p-m1').life).toBe(6);
    for (const uid of ['p-m1', 'p-m2', 'p-m3']) expect(badStatusKinds(s, monster(s, uid))).toEqual([]);
    expect(s.log.filter((l) => l.text.startsWith('まよけのふだが防いだ')).length).toBe(3);
  });

  it('おびきよせも防ぐ', () => {
    let s = use(scene({ player: [ky(9)] }), 'player', 'p0');
    s = toOpponent(s, [LURE]);
    s = use(s, 'opponent', 'q0', 'p-m3');
    expect(badStatusKinds(s, monster(s, 'p-m3'))).toEqual([]);
    expect(s.log.at(-1)?.text).toBe('まよけのふだが防いだ！ ノビトンに悪い状態はつかない。');
  });

  it('次の相手の手番が終わったら効かない。重ねて使っても長さは延びない', () => {
    let s = use(scene({ player: [ky(9), ky(9)] }), 'player', 'p0');
    const until = s.sides.player.wardCharm?.untilTurn;
    // 同じ手番に2枚目：クヨウはもう動いたので使えない（1体1ターンに技1回）
    expect(cardUsability(s, 'player', 'p1').usable).toBe(false);
    s = toOpponent(s, []);
    s = toPlayer(s, []);
    expect(wardCharmActive(s, 'player')).toBe(false);
    expect(until).toBe(s.turn - 1);
    s = toOpponent(s, [SAND]);
    s = use(s, 'opponent', 'q0', 'p-m2');
    expect(badStatusKinds(s, monster(s, 'p-m2'))).toEqual(['sealed']);
  });

  it('相手の味方には効かない（使った側の味方だけ）', () => {
    let s = use(scene({ player: [ky(9), SAND] }), 'player', 'p0');
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, monsters: s.sides.player.monsters } } };
    s = use(s, 'player', 'p1', 'o-m1');
    expect(badStatusKinds(s, monster(s, 'o-m1'))).toEqual(['sealed']);
  });
});

describe('11 みがわり：味方（クヨウ以外）への攻撃1回をクヨウが代わりに受け、ダメージ −2', () => {
  it('ソラモへの攻撃（5）をクヨウが受け、3ダメージ。記録の文', () => {
    let s = scene({});
    s = toOpponent(s, [sor(5)]);
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, hand: [{ uid: 'z0', cardId: ky(11) }] } } };
    s = use(s, 'opponent', 'q0', 'p-m2');
    expect(cardUsability(s, 'player', 'z0').usable).toBe(true);
    s = applyAction(s, { type: 'defend', side: 'player', cardUid: 'z0' });
    expect(s.pending?.targetUid).toBe('p-m1');
    expect(s.pending?.coveredFrom).toBe('p-m2');
    expect(s.pending?.coverReduce).toBe(2);
    expect(incomingDamage(s, s.pending!)).toBe(3);
    expect(s.log.at(-1)?.text).toBe('みがわり！ ソラモへの攻撃をクヨウが受ける（ダメージ−2）。');
    s = applyAction(s, { type: 'defend', side: 'player', cardUid: null });
    expect(monster(s, 'p-m1').life).toBe(5);
    expect(monster(s, 'p-m2').life).toBe(monster(s, 'p-m2').maxLife);
  });

  it('BH の直し：代わりに受けたあと、クヨウの防御・回避は重ねて使えない（−2 だけ）。0 未満にはならない', () => {
    let s = scene({});
    s = toOpponent(s, [sor(5)]);
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, hand: [{ uid: 'z0', cardId: ky(11) }, { uid: 'z1', cardId: ky(10) }, { uid: 'z2', cardId: ky(12) }] } } };
    s = use(s, 'opponent', 'q0', 'p-m2');
    s = applyAction(s, { type: 'defend', side: 'player', cardUid: 'z0' });
    expect(cardUsability(s, 'player', 'z1')).toEqual({ usable: false, reason: 'みがわりで受けた攻撃には、守りを重ねて使えません' });
    expect(cardUsability(s, 'player', 'z2').usable).toBe(false);
    expect(applyAction(s, { type: 'defend', side: 'player', cardUid: 'z1' })).toBe(s);
    s = applyAction(s, { type: 'defend', side: 'player', cardUid: null });
    expect(monster(s, 'p-m1').life).toBe(5);
    // 威力1（−2 で 0 未満にならない）
    let w = scene({});
    w = toOpponent(w, [sor(1)]);
    w = { ...w, sides: { ...w.sides, player: { ...w.sides.player, hand: [{ uid: 'z0', cardId: ky(11) }] } } };
    w = use(w, 'opponent', 'q0', 'p-m2');
    w = applyAction(w, { type: 'defend', side: 'player', cardUid: 'z0' });
    expect(incomingDamage(w, w.pending!)).toBe(0);
  });

  it('ジオルのかばうは今までどおり、代わりに受けたあと自分の防御を使える', () => {
    let s = createBattle(
      { name: 'P', deck: { monsters: ['mon-geol', 'mon-soramo', 'mon-nobiton'], skills: Array.from({ length: 60 }, () => sor(1)) } },
      { name: 'O', deck: { monsters: ['mon-soramo', 'mon-lazuck', 'mon-nobiton'], skills: Array.from({ length: 60 }, () => sor(1)) } },
      5,
      'opponent',
    );
    const guard = skillsOf('mon-geol').find((k) => k.effect.type === 'defense' && (k.effect.against === 'all' || k.effect.against === 'force'));
    if (!guard) throw new Error('ジオルの防御');
    s = {
      ...s,
      phase: 'main',
      manaConvertLimit: null,
      sides: {
        player: { ...s.sides.player, hand: [{ uid: 'z0', cardId: 'skl-geol-11' }, { uid: 'z1', cardId: guard.id }], manaPile: Array.from({ length: 9 }, () => sor(1)) },
        opponent: { ...s.sides.opponent, hand: [{ uid: 'q0', cardId: sor(5) }], manaPile: Array.from({ length: 9 }, () => sor(1)) },
      },
    };
    s = use(s, 'opponent', 'q0', 'p-m2');
    s = applyAction(s, { type: 'defend', side: 'player', cardUid: 'z0' });
    expect(cardUsability(s, 'player', 'z1').usable).toBe(true);
  });

  it('クヨウが狙われたとき・相手全員への攻撃・クヨウが倒れているときは使えない', () => {
    let s = scene({});
    s = toOpponent(s, [sor(5)]);
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, hand: [{ uid: 'z0', cardId: ky(11) }] } } };
    const self = use(s, 'opponent', 'q0', 'p-m1');
    expect(cardUsability(self, 'player', 'z0').usable).toBe(false);
    const down = use(patchMonster(s, 'p-m1', { life: 0 }), 'opponent', 'q0', 'p-m2');
    expect(cardUsability(down, 'player', 'z0').usable).toBe(false);
    // 相手全員への攻撃（ジオルの地ひびきと同じ当て方：ヒョウズクのつららのあめ）
    let all = createBattle(
      { name: 'P', deck: { monsters: [KUYO_MONSTER_ID, 'mon-soramo', 'mon-nobiton'], skills: Array.from({ length: 60 }, () => sor(1)) } },
      { name: 'O', deck: { monsters: ['mon-hyouzuku', 'mon-lazuck', 'mon-nobiton'], skills: Array.from({ length: 60 }, () => sor(1)) } },
      3,
      'opponent',
    );
    const rain = skillsOf('mon-hyouzuku').find((k) => k.effect.type === 'attack' && k.effect.allTargets);
    if (!rain) throw new Error('つららのあめ');
    all = {
      ...all,
      phase: 'main',
      manaConvertLimit: null,
      sides: {
        player: { ...all.sides.player, hand: [{ uid: 'z0', cardId: ky(11) }], manaPile: Array.from({ length: 9 }, () => sor(1)) },
        opponent: { ...all.sides.opponent, hand: [{ uid: 'q0', cardId: rain.id }], manaPile: Array.from({ length: 9 }, () => sor(1)) },
      },
    };
    all = use(all, 'opponent', 'q0');
    expect(all.phase).toBe('defense');
    // 左から順：クヨウ（使えない）→ ソラモ（相手全員への攻撃なので使えない）
    expect(all.pending?.targetUid).toBe('p-m1');
    expect(cardUsability(all, 'player', 'z0')).toMatchObject({ usable: false });
    all = applyAction(all, { type: 'defend', side: 'player', cardUid: null });
    expect(all.pending?.targetUid).toBe('p-m2');
    expect(cardUsability(all, 'player', 'z0')).toMatchObject({ usable: false });
  });
});

describe('CPU：おはらい・まよけのふだ・みがわり', () => {
  it('BH の直し：悪い状態の味方がいなければ、ライフの減った味方に使う（半分以下なら攻撃より先）', () => {
    // ライフ半分以下のノビトン（3/8）。クヨウの攻撃も手札にあるが、先におはらいで回復
    const s = patchMonster(scene({ player: [ky(8), ky(3)] }), 'p-m3', { life: 3 });
    expect(chooseAction(s, 'player', 'normal', 'A')).toMatchObject({ type: 'useCard', cardUid: 'p0', targetUid: 'p-m3' });
    // 少しだけ減っている（6/8）なら、攻撃が先
    const t = patchMonster(scene({ player: [ky(8), ky(3)] }), 'p-m3', { life: 6 });
    expect(chooseAction(t, 'player', 'normal', 'A')).toMatchObject({ type: 'useCard', cardUid: 'p1' });
    // 攻撃できないとき（クヨウの攻撃が手札に無い）は回復に使う
    const u = patchMonster(scene({ player: [ky(8)] }), 'p-m3', { life: 6 });
    expect(chooseAction(u, 'player', 'normal', 'A')).toMatchObject({ type: 'useCard', cardUid: 'p0', targetUid: 'p-m3' });
  });

  it('おはらい：まだ動いていない味方が攻撃を封じられていて、その味方の攻撃が手札にあれば消す', () => {
    let s = scene({ player: [ky(8), sor(3)] });
    s = patchMonster(s, 'p-m2', { sealedTurn: s.turn });
    expect(chooseAction(s, 'player', 'normal', 'A')).toMatchObject({ type: 'useCard', cardUid: 'p0', targetUid: 'p-m2' });
    // その味方の攻撃が手札に無ければ使わない
    const no = patchMonster(scene({ player: [ky(8), ky(3)] }), 'p-m2', { sealedTurn: 1 });
    expect(chooseAction(no, 'player', 'normal', 'A')).not.toMatchObject({ cardUid: 'p0' });
  });

  it('まよけのふだ：相手に状態をつける技を持つモンスター（ソラモ・ラズック・ノビトン）がいれば使う（倒せる攻撃が無いとき）', () => {
    const s = scene({ player: [ky(9), sor(1)] });
    expect(chooseAction(s, 'player', 'normal', 'B')).toMatchObject({ type: 'useCard', cardUid: 'p0' });
    // もう効いていれば使わない
    const on = { ...s, sides: { ...s.sides, player: { ...s.sides.player, wardCharm: { untilTurn: s.turn + 1 } } } };
    expect(chooseAction(on, 'player', 'normal', 'B')).not.toMatchObject({ cardUid: 'p0' });
  });

  it('まよけのふだが効いている相手には、腕前 A・B はすなかけを使わない', () => {
    let s = scene({});
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, wardCharm: { untilTurn: s.turn + 1 } } } };
    s = toOpponent(s, [SAND]);
    expect(chooseAction(s, 'opponent', 'normal', 'A')).not.toMatchObject({ cardUid: 'q0' });
  });

  it('みがわり：狙われた味方のライフが低く、クヨウのライフに余裕があれば使う', () => {
    let s = scene({});
    s = toOpponent(s, [sor(5)]);
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, hand: [{ uid: 'z0', cardId: ky(11) }] } } };
    s = patchMonster(s, 'p-m2', { life: 3 });
    s = use(s, 'opponent', 'q0', 'p-m2');
    expect(chooseAction(s, 'player', 'normal', 'A')).toEqual({ type: 'defend', side: 'player', cardUid: 'z0' });
    // クヨウのライフが少なければ使わない（受けると倒れる・余裕が無い）
    const weak = patchMonster(s, 'p-m1', { life: 3 });
    expect(chooseAction(weak, 'player', 'normal', 'A')).not.toEqual({ type: 'defend', side: 'player', cardUid: 'z0' });
    // 狙われた味方のライフが多ければ使わない
    const healthy = patchMonster(s, 'p-m2', { life: 7 });
    expect(chooseAction(healthy, 'player', 'normal', 'A')).not.toEqual({ type: 'defend', side: 'player', cardUid: 'z0' });
  });
});
