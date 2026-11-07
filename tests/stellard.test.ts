import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { CARD_NAME_LOGOS, CARD_NAME_LOGOS_EN } from '../src/data/cardNameLogos.generated.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { getMonster, getSkill, MONSTERS, QA_MONSTERS, QA_SKILLS, SKILLS, skillsOf } from '../src/data/cards.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { AJ_MONSTER_IDS, AJ_QA_SKILLS, MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import { STELLARD_COLOR, STELLARD_MONSTER_ID, stellardArtFile, stellardSkillId } from '../src/data/stellard.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, cardUsability, createBattle, focusActive, manaOf, targetsFor, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { availableGachaSeriesFor } from '../src/game/economy/gachaSeries.ts';
import { createNewSave } from '../src/game/save/saveData.ts';
import { AJ_EN_MISSING } from '../src/i18n/contentEnAJ.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';
import { skillEffectIcons } from '../src/ui/effectIcons.ts';

/** 指示書 BQ（2026-11-07）：ステラード（アステリアの王者ランスロットの切り札・A の上。置き場所ができるまで確かめ用だけ）と、あしばらい・ふくつのいちげき・きしのとつげき・しゅうちゅう */

const st = stellardSkillId;
const sor = (n: number): string => `skl-soramo14-${String(n).padStart(2, '0')}`;
const SORAMO_EVADE = sor(14);

describe('ステラードのデータ（指示書の表のとおり）', () => {
  it('LIFE 8・地上・シルバー #C8CCD4。ID は mon-stellard。説明に神様・信仰の言葉を使わない', () => {
    const m = getMonster(STELLARD_MONSTER_ID);
    expect(m.name).toBe('ステラード');
    expect(m.life).toBe(8);
    expect(m.habitat).toBe('ground');
    expect(MONSTER_HABITAT[STELLARD_MONSTER_ID]).toBe('ground');
    expect(m.themeColor).toBe(STELLARD_COLOR);
    expect(STELLARD_COLOR).toBe('#C8CCD4');
    expect(m.description).not.toMatch(/神|祈|信仰/);
  });

  it('技12枚：名前・分類・マナ・ダメージ・レアは表のとおり（レア＝05・06・08・09）。防御2（マナ0）・回避0', () => {
    const table = AJ_QA_SKILLS[STELLARD_MONSTER_ID] ?? [];
    const expected: [string, string, number, number | null][] = [
      ['やりのひとつき', 'ち', 1, 2],
      ['あしばらい', 'ち', 2, 4],
      ['たてくだき', 'ち', 3, 3],
      ['ほしのやり', 'ち', 3, 5],
      ['ふくつのいちげき', 'ち', 3, 7],
      ['きしのとつげき', 'ち', 4, 8],
      ['みちびきのほし', 'か', 3, 3],
      ['りゅうせいのやり', 'か', 4, 5],
      ['ぎんがのかがやき', 'か', 4, 7],
      ['しゅうちゅう', '特', 0, null],
      ['やりでうける', '防', 0, null],
      ['たてでうける', '防', 0, null],
    ];
    expect(table.map((r) => [r.name, r.cat, r.mana, r.damage])).toEqual(expected);
    expect(table.map((r) => r.id)).toEqual(expected.map((_, i) => st(i + 1)));
    expect(table.map((r) => r.art)).toEqual(expected.map((_, i) => stellardArtFile(i + 1)));
    expect(table.filter((r) => r.rare).map((r) => r.id)).toEqual([st(5), st(6), st(8), st(9)]);
    expect(table.filter((r) => r.cat === '避')).toHaveLength(0);
    expect(skillsOf(STELLARD_MONSTER_ID).map((k) => k.displayNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('効果と文（CSV のとおり。防御の文は決まりの形）', () => {
    const byId = new Map(QA_SKILLS.map((k) => [k.id, k]));
    expect(byId.get(st(2))?.effect).toEqual({ type: 'attack', notAir: true });
    expect(byId.get(st(3))?.effect).toEqual({ type: 'attack', unblockable: true });
    expect(byId.get(st(5))?.effect).toEqual({ type: 'attack', lowLifeMax: 2 });
    expect(byId.get(st(6))?.effect).toEqual({ type: 'attack', selfDamageOnEvade: 2 });
    expect(byId.get(st(7))?.effect).toEqual({ type: 'attack', undodgeable: true });
    expect(byId.get(st(8))?.effect).toEqual({ type: 'attack', undodgeable: true });
    expect(byId.get(st(10))?.effect).toEqual({ type: 'focus' });
    expect(byId.get(st(11))?.effectTextJa).toBe('ちから技の受けるダメージを3減らす。');
    expect(byId.get(st(12))?.effectTextJa).toBe('かしこさ技の受けるダメージを3減らす。');
  });

  it('置き場所はまだ無い：一覧・ガチャに並ばない・箱・ダンジョン・敵の編成に出ない', () => {
    expect(QA_MONSTERS.map((m) => m.id)).toContain(STELLARD_MONSTER_ID);
    expect(MONSTERS.some((m) => m.id === STELLARD_MONSTER_ID)).toBe(false);
    expect(SKILLS.some((k) => k.monsterId === STELLARD_MONSTER_ID)).toBe(false);
    expect(AJ_MONSTER_IDS).not.toContain(STELLARD_MONSTER_ID);
    for (const b of BOOSTERS) expect(b.monsters).not.toContain(STELLARD_MONSTER_ID);
    for (const e of Object.values(ENCOUNTERS)) expect(e.monsters).not.toContain(STELLARD_MONSTER_ID);
    expect(JSON.stringify(DUNGEONS)).not.toContain('stellard');
    expect(GACHA_SERIES.find((g) => g.id === 'stellard')?.rareSkillNames).toEqual(['ふくつのいちげき', 'きしのとつげき', 'りゅうせいのやり', 'ぎんがのかがやき']);
    expect(availableGachaSeriesFor(createNewSave()).some((g) => g.id === 'stellard')).toBe(false);
  });

  it('図鑑：ベニオウのあと No.339〜351', () => {
    const mine = cardBookEntries().filter((e) => e.section.kind === 'monster' && e.section.monsterId === STELLARD_MONSTER_ID);
    expect(mine.map((e) => e.card.id)).toEqual([STELLARD_MONSTER_ID, ...Array.from({ length: 12 }, (_, i) => st(i + 1))]);
    expect(mine.map((e) => e.no)).toEqual(Array.from({ length: 13 }, (_, i) => 339 + i));
  });

  it('絵・枠・名前のロゴ・英語・アイコン', () => {
    for (let n = 1; n <= 12; n++) expect(existsSync(`assets/images/cards/skills/${stellardArtFile(n)}`)).toBe(true);
    for (const f of ['cards/monsters/stellard_official.webp', 'cards/monsters/stellard_battlecard.png', 'ui/battlecard/frame_stellard.png', 'ui/skillcard_simple/frame_normal_stellard.webp', 'ui/skillcard_simple/frame_hand_stellard.webp', 'ui/gacha/pack_stellard.webp', 'ui/gacha/panel_stellard.webp']) {
      expect(existsSync(`assets/images/${f}`), f).toBe(true);
    }
    expect(BATTLE_CARDS[STELLARD_MONSTER_ID]?.frame).toBe('stellard');
    expect(CARD_NAME_LOGOS[STELLARD_MONSTER_ID]?.frame).toBe('#C8CCD4');
    expect(CARD_NAME_LOGOS_EN[STELLARD_MONSTER_ID]?.frame).toBe('#C8CCD4');
    setLanguage('en');
    try {
      expect(cardName(STELLARD_MONSTER_ID)).toBe('Stellard');
      expect(cardName(st(10))).toBe('Focus');
    } finally {
      setLanguage('ja');
    }
    expect(AJ_EN_MISSING).toEqual([]);
    expect(skillEffectIcons(getSkill(st(6)))).toEqual([{ main: 'e15' }, { main: 'e24', badge: { kind: 'value', text: '−2' } }]);
    expect(skillEffectIcons(getSkill(st(10)))).toEqual([{ main: 'b13', marks: ['ally'], badge: { kind: 'value', text: '0' } }]);
  });
});

/* ---------- バトル ---------- */

// 自分：ステラード（p-m1 ライフ8）・ソラモ（p-m2）・クヨウ（p-m3）。相手：ソラモ（o-m1 ライフ7）・ラズック（o-m2）・ガウル（o-m3）
function scene(
  hand: Partial<Record<Side, string[]>>,
  opts: { mana?: Partial<Record<Side, number>>; deck?: Partial<Record<Side, string[]>>; mine?: string[]; foes?: string[] } = {},
): BattleState {
  const filler = Array.from({ length: 60 }, () => sor(1));
  const s = createBattle(
    { name: 'P', deck: { monsters: opts.mine ?? [STELLARD_MONSTER_ID, 'mon-soramo', 'mon-kuyo'], skills: filler } },
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

describe('02 あしばらい：空中の相手には使えない', () => {
  it('空中の相手（ガウル）は選べない。地上・水中の相手は選べる', () => {
    const s = scene({ player: [st(2)] });
    expect(targetsFor(s, 'player', getSkill(st(2))).map((m) => m.cardId)).toEqual(['mon-soramo', 'mon-lazuck']);
  });

  it('選べる相手がみな空中なら使えない（灰色・理由）', () => {
    const s = scene({ player: [st(2)] }, { foes: ['mon-gauul', 'mon-pukarim', 'mon-lilil'] });
    expect(cardUsability(s, 'player', 'p0')).toEqual({ usable: false, reason: '空中の相手には当たらない技です' });
  });
});

describe('05 ふくつのいちげき：自分の LIFE が2以下のときだけ使える', () => {
  it('LIFE 3 では使えない（理由）。LIFE 2 なら使えて7ダメージ', () => {
    const s3 = patchMonster(scene({ player: [st(5)] }), 'p-m1', { life: 3 });
    expect(cardUsability(s3, 'player', 'p0')).toEqual({ usable: false, reason: 'LIFE が2以下のときだけ使えます' });
    const s2 = patchMonster(scene({ player: [st(5)] }), 'p-m1', { life: 2 });
    expect(cardUsability(s2, 'player', 'p0').usable).toBe(true);
    const s = defend(use(s2, 'player', 'p0', 'o-m1'), 'opponent', null);
    expect(monster(s, 'o-m1').life).toBe(0);
  });
});

describe('06 きしのとつげき：回避されると自分の LIFE−2', () => {
  it('回避されたら LIFE 8 → 6。記録が出る', () => {
    let s = use(scene({ player: [st(6)], opponent: [SORAMO_EVADE] }), 'player', 'p0', 'o-m1');
    s = defend(defend(s, 'opponent', 'o0'), 'opponent', null);
    expect(monster(s, 'o-m1').life).toBe(7);
    expect(monster(s, 'p-m1').life).toBe(6);
    expect(s.log.some((l) => l.text === 'ステラードは突撃をかわされ、体勢をくずした！（LIFE−2）')).toBe(true);
  });

  it('当たった・防御されたときは反動なし。反動で倒れてよい', () => {
    const hit = defend(use(scene({ player: [st(6)] }), 'player', 'p0', 'o-m1'), 'opponent', null);
    expect(monster(hit, 'p-m1').life).toBe(8);
    let low = use(patchMonster(scene({ player: [st(6)], opponent: [SORAMO_EVADE] }), 'p-m1', { life: 2 }), 'player', 'p0', 'o-m1');
    low = defend(defend(low, 'opponent', 'o0'), 'opponent', null);
    expect(monster(low, 'p-m1').life).toBe(0);
  });
});

describe('10 しゅうちゅう：次の自分の手番の終わりまで、マナを減らす効果を受けない', () => {
  it('使った側のマナは、相手のくしゃみ・からっぽのつぼで減らない。記録が出る', () => {
    let s = use(scene({ player: [st(10)] }, { foes: ['mon-nobiton', 'mon-nous', 'mon-gauul'] }), 'player', 'p0');
    expect(focusActive(s, 'player')).toBe(true);
    expect(s.log.at(-1)?.text).toBe('しゅうちゅう！ 次の自分のターンの終わりまでマナを減らされない。');
    s = applyAction(applyAction(s, { type: 'endAttack', side: 'player' }), { type: 'endTurn', side: 'player' });
    s = { ...s, phase: 'main', sides: { ...s.sides, player: { ...s.sides.player, manaPile: Array.from({ length: 5 }, () => sor(1)) }, opponent: { ...s.sides.opponent, hand: [{ uid: 'q0', cardId: 'skl-nous-06' }], manaPile: Array.from({ length: 12 }, () => sor(1)) } } };
    s = defend(use(s, 'opponent', 'q0', 'p-m1', 'o-m2'), 'player', null);
    expect(manaOf(s.sides.player)).toBe(5);
    expect(s.log.some((l) => l.text === 'しゅうちゅうでマナは減らなかった。')).toBe(true);
  });

  it('期限：次の自分の手番の終わりまで（その次の手番には消える）。ステラードが倒れても残る', () => {
    let s = use(scene({ player: [st(10)] }), 'player', 'p0');
    s = patchMonster(s, 'p-m1', { life: 0 });
    s = nextOwnTurn(s, []);
    expect(focusActive(s, 'player')).toBe(true);
    s = nextOwnTurn(s, []);
    expect(focusActive(s, 'player')).toBe(false);
  });
});

describe('CPU（指示書 BQ）', () => {
  it('しゅうちゅう：相手にマナを減らす技を持つ子（ノウス）がいて、マナが3以上なら使う。いなければ使わない', () => {
    const yes = scene({ player: [st(10), st(1)] }, { mana: { player: 4 }, foes: ['mon-nous', 'mon-lazuck', 'mon-soramo'] });
    expect(chooseAction(yes, 'player', 'normal', 'A')).toMatchObject({ type: 'useCard', cardUid: 'p0' });
    const no = scene({ player: [st(10), st(1)] }, { mana: { player: 4 } });
    const a = chooseAction(no, 'player', 'normal', 'A');
    expect(a && a.type === 'useCard' && a.cardUid === 'p0').toBe(false);
  });

  it('あしばらい：空中の相手は選ばない', () => {
    const s = scene({ player: [st(2)] }, { mana: { player: 2 } });
    const a = chooseAction(s, 'player', 'normal', 'A');
    if (a?.type === 'useCard' && a.cardUid === 'p0') expect(a.targetUid).not.toBe('o-m3');
  });

  it('きしのとつげき：当てられる相手がみな回避の技を持つときは選ばない', () => {
    // ソラモ・ラズック・ガウルはどれも回避の技を持つ
    const s = scene({ player: [st(6), st(4)] }, { mana: { player: 4 } });
    const a = chooseAction(s, 'player', 'normal', 'A');
    expect(a && a.type === 'useCard' && a.cardUid === 'p0').toBe(false);
  });
});
