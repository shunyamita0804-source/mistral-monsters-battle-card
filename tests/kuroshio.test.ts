import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { CARD_NAME_LOGOS, CARD_NAME_LOGOS_EN } from '../src/data/cardNameLogos.generated.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { getMonster, MONSTERS, QA_MONSTERS, QA_SKILLS, SKILLS, skillsOf } from '../src/data/cards.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { KUROSHIO_COLOR, KUROSHIO_MONSTER_ID, kuroshioArtFile, kuroshioSkillId } from '../src/data/kuroshio.ts';
import { AJ_MONSTER_IDS, AJ_QA_SKILLS, MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import {
  applyAction,
  badStatusKinds,
  cardUsability,
  createBattle,
  habitatOf,
  isDraggedUnder,
  targetsFor,
  undodgeableAgainst,
  type BattleMonster,
  type BattleState,
  type Side,
} from '../src/game/battle/engine.ts';
import { getSkill } from '../src/data/cards.ts';
import { availableGachaSeriesFor } from '../src/game/economy/gachaSeries.ts';
import { createNewSave } from '../src/game/save/saveData.ts';
import { AJ_EN_MISSING } from '../src/i18n/contentEnAJ.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';
import { skillEffectIcons } from '../src/ui/effectIcons.ts';

/** 指示書 BK（2026-11-06）：クロシオ（セイランの王者ナディアの切り札・B。置き場所ができるまで確かめ用だけ）と、新しい効果 ひきずりこむ・おおうずしお */

const kr = kuroshioSkillId;
const sor = (n: number): string => `skl-soramo14-${String(n).padStart(2, '0')}`;
const STAR_STEP = 'skl-soramo14-14'; // 星影ステップ（ちから技、かしこさ技を回避）
const STAR_GUARD = 'skl-soramo14-12'; // 星のまもり（ちから技、かしこさ技 −3）
const PURIFY = 'skl-kuyo-08'; // おはらい
const CHARM = 'skl-kuyo-09'; // まよけのふだ
const RISING_WIND = 'sup-12'; // まいあがる風（場：全員が空中）

describe('クロシオのデータ（指示書の表のとおり）', () => {
  it('LIFE 7・水中・珊瑚 #F08A78。ID は mon-kuroshio', () => {
    const m = getMonster(KUROSHIO_MONSTER_ID);
    expect(m.name).toBe('クロシオ');
    expect(m.life).toBe(7);
    expect(m.habitat).toBe('water');
    expect(MONSTER_HABITAT[KUROSHIO_MONSTER_ID]).toBe('water');
    expect(m.themeColor).toBe(KUROSHIO_COLOR);
    expect(KUROSHIO_COLOR).toBe('#F08A78');
    expect(m.isPlaceholder).toBe(false);
  });

  it('技12枚：名前・分類・マナ・ダメージ・レアは指示書のとおり（レア＝06・07・08・12）。防御の技は無い（回避だけ）', () => {
    const table = AJ_QA_SKILLS[KUROSHIO_MONSTER_ID] ?? [];
    const expected: [string, string, number, number | null][] = [
      ['ひれはたき', 'ち', 0, 1],
      ['くいつく', 'ち', 1, 2],
      ['テールスラップ', 'ち', 2, 3],
      ['ひきずりこむ', 'ち', 2, 2],
      ['ブリーチダイブ', 'ち', 4, 6],
      ['しおふきキャノン', 'か', 3, 4],
      ['おおうずしお', 'か', 5, 3],
      ['オルカストライク', 'ち', 5, 7],
      ['みちしお', '特', 2, null],
      ['よびごえ', '特', 2, null],
      ['もぐってかわす', '避', 1, null],
      ['うずまきターン', '避', 2, null],
    ];
    expect(table.map((r) => [r.name, r.cat, r.mana, r.damage])).toEqual(expected);
    expect(table.map((r) => r.id)).toEqual(expected.map((_, i) => kr(i + 1)));
    expect(table.map((r) => r.art)).toEqual(expected.map((_, i) => kuroshioArtFile(i + 1)));
    expect(table.filter((r) => r.rare).map((r) => r.id)).toEqual([kr(6), kr(7), kr(8), kr(12)]);
    expect(table.some((r) => r.cat === '防')).toBe(false);
    expect(skillsOf(KUROSHIO_MONSTER_ID).map((k) => k.displayNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('効果：04 ひきずりこむ・06 水中の相手は回避できない・07 水中の相手全員・08 回避されても半分・09 みちしお・10 よびごえ・11 マナ2以上の回避・12 回避', () => {
    const byId = new Map(QA_SKILLS.map((k) => [k.id, k]));
    expect(byId.get(kr(4))?.effect).toEqual({ type: 'attack', dragUnder: true });
    expect(byId.get(kr(6))?.effect).toEqual({ type: 'attack', undodgeableVsWater: true });
    expect(byId.get(kr(7))?.effect).toEqual({ type: 'attack', allTargets: true, waterOnly: true });
    expect(byId.get(kr(8))?.effect).toEqual({ type: 'attack', halfOnEvade: true });
    expect(byId.get(kr(9))?.effect).toEqual({ type: 'tide' });
    expect(byId.get(kr(10))?.effect).toEqual({ type: 'taunt' });
    expect(byId.get(kr(10))?.effectTextJa).toBe('相手は次のターン、クロシオしか攻撃できない');
    expect(byId.get(kr(11))?.effect).toEqual({ type: 'evade', against: 'all', minCost: 2 });
    expect(byId.get(kr(11))?.effectTextJa).toBe('マナ2以上のちから技、かしこさ技を回避する。');
    expect(byId.get(kr(12))?.effect).toEqual({ type: 'evade', against: 'all' });
    expect(byId.get(kr(12))?.effectTextJa).toBe('ちから技、かしこさ技を回避する。');
  });

  it('置き場所はまだ無い：一覧・ガチャに並ばない・箱・ダンジョン・敵の編成に出ない（確かめ用 QA_MONSTERS・QA_SKILLS）', () => {
    expect(QA_MONSTERS.map((m) => m.id)).toContain(KUROSHIO_MONSTER_ID);
    expect(QA_SKILLS.filter((k) => k.monsterId === KUROSHIO_MONSTER_ID)).toHaveLength(12);
    expect(MONSTERS.some((m) => m.id === KUROSHIO_MONSTER_ID)).toBe(false);
    expect(SKILLS.some((k) => k.monsterId === KUROSHIO_MONSTER_ID)).toBe(false);
    expect(AJ_MONSTER_IDS).not.toContain(KUROSHIO_MONSTER_ID);
    for (const b of BOOSTERS) expect(b.monsters).not.toContain(KUROSHIO_MONSTER_ID);
    for (const e of Object.values(ENCOUNTERS)) expect(e.monsters).not.toContain(KUROSHIO_MONSTER_ID);
    expect(JSON.stringify(DUNGEONS)).not.toContain('kuroshio');
    // ガチャのシリーズは準備だけ（クロシオのモンスターカードを持つまで並ばない）
    const series = GACHA_SERIES.find((g) => g.id === 'kuroshio');
    expect(series?.rareSkillNames).toEqual(['しおふきキャノン', 'おおうずしお', 'オルカストライク', 'うずまきターン']);
    expect(series?.unlockFlag).toBeUndefined();
    expect(availableGachaSeriesFor(createNewSave()).some((g) => g.id === 'kuroshio')).toBe(false);
  });

  it('図鑑：ラディエルのあと No.274〜286（本体 → 技12枚）。手に入れるまで「？？？」はクヨウと同じ', () => {
    const entries = cardBookEntries();
    const mine = entries.filter((e) => e.section.kind === 'monster' && e.section.monsterId === KUROSHIO_MONSTER_ID);
    expect(mine.map((e) => e.card.id)).toEqual([KUROSHIO_MONSTER_ID, ...Array.from({ length: 12 }, (_, i) => kr(i + 1))]);
    expect(mine.map((e) => e.no)).toEqual(Array.from({ length: 13 }, (_, i) => 274 + i));
    expect(entries.find((e) => e.card.id === 'mon-radiel')?.no).toBe(261);
  });

  it('絵：技12枚・正式カード・バトル用・枠・パック・販売機の窓・名前のロゴ（日英）', () => {
    for (let n = 1; n <= 12; n++) expect(existsSync(`assets/images/cards/skills/${kuroshioArtFile(n)}`)).toBe(true);
    for (const f of [
      'assets/images/cards/monsters/kuroshio_official.webp',
      'assets/images/cards/monsters/kuroshio_battlecard.png',
      'assets/images/ui/battlecard/frame_kuroshio.png',
      'assets/images/ui/skillcard_simple/frame_normal_kuroshio.webp',
      'assets/images/ui/skillcard_simple/frame_hand_kuroshio.webp',
      'assets/images/ui/gacha/pack_kuroshio.webp',
      'assets/images/ui/gacha/panel_kuroshio.webp',
    ]) {
      expect(existsSync(f), f).toBe(true);
    }
    expect(BATTLE_CARDS[KUROSHIO_MONSTER_ID]?.frame).toBe('kuroshio');
    expect(CARD_NAME_LOGOS[KUROSHIO_MONSTER_ID]?.frame).toBe('#F08A78');
    expect(CARD_NAME_LOGOS_EN[KUROSHIO_MONSTER_ID]?.frame).toBe('#F08A78');
  });

  it('英語の名前と効果の文（仮訳）がある', () => {
    setLanguage('en');
    try {
      expect(cardName(KUROSHIO_MONSTER_ID)).toBe('Kuroshio');
      expect(cardName(kr(4))).toBe('Drag Under');
      expect(cardName(kr(7))).toBe('Great Whirlpool');
    } finally {
      setLanguage('ja');
    }
    expect(AJ_EN_MISSING).toEqual([]);
  });

  it('効果のアイコン：ひきずりこむ＝水中の印・おおうずしお＝相手全員に水中の印・よびごえ＝おびきよせと同じ', () => {
    const icon = (n: number) => skillEffectIcons(getSkill(kr(n)));
    expect(icon(4)).toEqual([{ main: 't03', marks: ['target'], badge: { kind: 'turn', text: '1' } }]);
    expect(icon(7)).toEqual([{ main: 'e04', marks: ['water'] }]);
    expect(icon(10)).toEqual([{ main: 's13' }]);
  });
});

/* ---------- バトル ---------- */

// 自分：クロシオ（p-m1）・カルシェル（p-m2）・ミュロル（p-m3）。相手：ソラモ（o-m1・地上）・ラズック（o-m2・地上）・ガウル（o-m3・空中）
function scene(hand: Partial<Record<Side, string[]>>, opts: { mana?: Partial<Record<Side, number>>; foes?: string[]; mine?: string[] } = {}): BattleState {
  const filler = Array.from({ length: 60 }, () => sor(1));
  const s = createBattle(
    { name: 'P', deck: { monsters: opts.mine ?? [KUROSHIO_MONSTER_ID, 'mon-kalshell', 'mon-myurol'], skills: filler } },
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

describe('04 ひきずりこむ：当たった相手1体を、次の自分の手番の終わりまで水中にする', () => {
  it('当たったら水中（居場所・悪い状態「dragged」・記録の文）。期限は使った側の次の自分の手番の終わり', () => {
    let s = use(scene({ player: [kr(4)] }), 'player', 'p0', 'o-m1');
    s = defend(s, 'opponent', null);
    const t0 = s.turn;
    expect(monster(s, 'o-m1').life).toBe(monster(s, 'o-m1').maxLife - 2);
    expect(monster(s, 'o-m1').dragUnder).toEqual({ untilTurn: t0 + 2 });
    expect(habitatOf(s, monster(s, 'o-m1'))).toBe('water');
    expect(badStatusKinds(s, monster(s, 'o-m1'))).toEqual(['dragged']);
    expect(s.log.at(-1)?.text).toBe('ソラモは水中にひきずりこまれた（次の相手のターンの終わりまで水中）。');
    // ほかの相手は変わらない
    expect(habitatOf(s, monster(s, 'o-m2'))).toBe('ground');
    // 相手の手番 → 自分の次の手番の間は水中のまま
    s = toOpponent(s);
    expect(habitatOf(s, monster(s, 'o-m1'))).toBe('water');
    s = toPlayer(s);
    expect(s.turn).toBe(t0 + 2);
    expect(habitatOf(s, monster(s, 'o-m1'))).toBe('water');
    // その次の相手の手番では地上に戻る
    s = toOpponent(s);
    expect(isDraggedUnder(s, monster(s, 'o-m1'))).toBe(false);
    expect(habitatOf(s, monster(s, 'o-m1'))).toBe('ground');
    expect(badStatusKinds(s, monster(s, 'o-m1'))).toEqual([]);
  });

  it('防御でダメージが減っても（0 でも）水中になる。回避されたら水中にならない', () => {
    let s = use(scene({ player: [kr(4)], opponent: [STAR_GUARD] }), 'player', 'p0', 'o-m1');
    s = defend(s, 'opponent', 'o0');
    if (s.phase === 'defense') s = defend(s, 'opponent', null);
    expect(monster(s, 'o-m1').life).toBe(monster(s, 'o-m1').maxLife);
    expect(habitatOf(s, monster(s, 'o-m1'))).toBe('water');

    let e = use(scene({ player: [kr(4)], opponent: [STAR_STEP] }), 'player', 'p0', 'o-m1');
    e = defend(e, 'opponent', 'o0');
    if (e.phase === 'defense') e = defend(e, 'opponent', null);
    expect(monster(e, 'o-m1').dragUnder ?? null).toBeNull();
    expect(habitatOf(e, monster(e, 'o-m1'))).toBe('ground');
  });

  it('重ねない：水中の間にもう一度当てたら、期限を数え直す', () => {
    let s = defend(use(scene({ player: [kr(4)] }), 'player', 'p0', 'o-m1'), 'opponent', null);
    const first = monster(s, 'o-m1').dragUnder?.untilTurn ?? 0;
    s = toPlayer(toOpponent(s), [kr(4)]);
    s = defend(use(s, 'player', 'n0', 'o-m1'), 'opponent', null);
    expect(monster(s, 'o-m1').dragUnder).toEqual({ untilTurn: first + 2 });
  });

  it('場のカードとは別の「その子だけの状態」：場が空中（まいあがる風）でも水中のまま。ほかの子は空中', () => {
    let s = defend(use(scene({ player: [kr(4)] }), 'player', 'p0', 'o-m1'), 'opponent', null);
    s = { ...s, field: { cardId: RISING_WIND, owner: 'opponent', habitat: 'air' } };
    expect(habitatOf(s, monster(s, 'o-m1'))).toBe('water');
    expect(habitatOf(s, monster(s, 'o-m2'))).toBe('air');
    // みちしおが終わっても（場が無くなっても）残る
    s = { ...s, field: null };
    expect(habitatOf(s, monster(s, 'o-m1'))).toBe('water');
  });

  it('水中になった相手には、しおふきキャノン（水中の相手は回避できない）が回避されない', () => {
    let s = defend(use(scene({ player: [kr(4), kr(6)] }), 'player', 'p0', 'o-m1'), 'opponent', null);
    expect(undodgeableAgainst(s, getSkill(kr(6)), monster(s, 'o-m1'))).toBe(true);
    expect(undodgeableAgainst(s, getSkill(kr(6)), monster(s, 'o-m2'))).toBe(false);
  });

  it('クヨウのおはらいで消せる（悪い状態）', () => {
    let s = defend(use(scene({ player: [kr(4)] }, { foes: ['mon-kuyo', 'mon-soramo', 'mon-gauul'] }), 'player', 'p0', 'o-m2'), 'opponent', null);
    expect(habitatOf(s, monster(s, 'o-m2'))).toBe('water');
    s = toOpponent(s, [PURIFY]);
    s = use(s, 'opponent', 'q0', 'o-m2');
    expect(monster(s, 'o-m2').dragUnder).toBeNull();
    expect(habitatOf(s, monster(s, 'o-m2'))).toBe('ground');
    expect(s.log.some((l) => l.text === 'おはらい！ ソラモの悪い状態が消えた。')).toBe(true);
  });

  it('まよけのふだの間はつかない（ダメージは受ける）', () => {
    let s = toOpponent(scene({}, { foes: ['mon-kuyo', 'mon-soramo', 'mon-gauul'] }), [CHARM]);
    s = use(s, 'opponent', 'q0');
    s = toPlayer(s, [kr(4)]);
    s = defend(use(s, 'player', 'n0', 'o-m2'), 'opponent', null);
    expect(monster(s, 'o-m2').life).toBe(monster(s, 'o-m2').maxLife - 2);
    expect(monster(s, 'o-m2').dragUnder ?? null).toBeNull();
    expect(s.log.at(-1)?.text).toBe('まよけのふだが防いだ！ ソラモに悪い状態はつかない。');
  });
});

describe('07 おおうずしお：水中の相手全員に当たる（守りは1体ずつ）', () => {
  it('水中の相手がいないと使えない（灰色・理由を出す）', () => {
    const s = scene({ player: [kr(7)] });
    expect(cardUsability(s, 'player', 'p0')).toEqual({ usable: false, reason: '水中の相手がいません（水中の相手だけに当たる技）' });
  });

  it('当たるのは「いま水中の相手」だけ：生まれつき水中の子とひきずりこまれた子。ほかの子には当たらない', () => {
    let s = scene({ player: [kr(4), kr(7)] }, { foes: ['mon-soramo', 'mon-myurol', 'mon-gauul'] });
    s = defend(use(s, 'player', 'p0', 'o-m1'), 'opponent', null);
    s = toPlayer(toOpponent(s), [kr(7)]);
    expect(targetsFor(s, 'player', getSkill(kr(7))).map((m) => m.uid)).toEqual(['o-m1', 'o-m2']);
    const before = { m1: monster(s, 'o-m1').life, m2: monster(s, 'o-m2').life, m3: monster(s, 'o-m3').life };
    s = use(s, 'player', 'n0');
    expect(s.pending?.targetUid).toBe('o-m1');
    s = defend(s, 'opponent', null);
    expect(s.pending?.targetUid).toBe('o-m2');
    s = defend(s, 'opponent', null);
    expect(monster(s, 'o-m1').life).toBe(before.m1 - 3);
    expect(monster(s, 'o-m2').life).toBe(before.m2 - 3);
    expect(monster(s, 'o-m3').life).toBe(before.m3);
  });

  it('みちしおの間は全員が水中なので、全員に当たる', () => {
    let s = use(scene({ player: [kr(9), kr(7)] }), 'player', 'p0');
    // みちしおを使ったクロシオはこの手番もう動けないので、使う子を渡して確かめる
    expect(targetsFor(s, 'player', getSkill(kr(7)), monster(s, 'p-m1')).map((m) => m.uid)).toEqual(['o-m1', 'o-m2', 'o-m3']);
  });
});

describe('CPU（指示書 BK）', () => {
  const cpu = (s: BattleState) => chooseAction(s, 'player', 'normal', 'A');

  it('手札にしおふきキャノンがあれば、水中でない相手にひきずりこむを先に使う', () => {
    const s = scene({ player: [kr(4), kr(6)] });
    const a = cpu(s);
    expect(a).toMatchObject({ type: 'useCard', cardUid: 'p0' });
    expect(['o-m1', 'o-m2', 'o-m3']).toContain((a as { targetUid?: string }).targetUid);
  });

  it('水中の相手が2体以上なら、おおうずしおを先に使う', () => {
    // その手番に倒せる相手がいないように、相手のライフは多め
    let s = scene({ player: [kr(7), kr(3)] }, { foes: ['mon-myurol', 'mon-kalshell', 'mon-gauul'] });
    for (const uid of ['o-m1', 'o-m2', 'o-m3']) s = patchMonster(s, uid, { life: 6 });
    expect(cpu(s)).toMatchObject({ type: 'useCard', cardUid: 'p0' });
  });

  it('手札におおうずしおがあって水中の相手がいなければ、みちしおを使う', () => {
    const s = scene({ player: [kr(9), kr(7)] });
    expect(cpu(s)).toMatchObject({ type: 'useCard', cardUid: 'p0' });
  });

  it('よびごえ：クロシオの回避の技が手札にあれば使う', () => {
    const s = scene({ player: [kr(10), kr(12)] });
    expect(cpu(s)).toMatchObject({ type: 'useCard', cardUid: 'p0' });
  });
});
