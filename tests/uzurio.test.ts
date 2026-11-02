import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { getMonster, getSupport, skillsOf, SUPPORTS } from '../src/data/cards.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { PORTRAIT_FOCUS } from '../src/data/monsterPortraits.ts';
import { AJ_SKILLS, MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import { UZURIO_COLOR, UZURIO_MONSTER_ID, UZURIO_ROWS, UZURIO_SUPPORT_ROWS, uzurioArtFile } from '../src/data/uzurio.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import {
  activeField,
  applyAction,
  attackPower,
  cardUsability,
  createBattle,
  habitatOf,
  targetsFor,
  undodgeableAgainst,
  type BattleMonster,
  type BattleState,
  type Side,
} from '../src/game/battle/engine.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';
import { getSkill } from '../src/data/cards.ts';

/** 指示書 AQ（2026-11-02）：ウズリオとサポート3枚。正本は src/data/official/uzurio12_and_support3_OFFICIAL_20261102.json、カードは src/data/skillRebuildAJ.ts の表 */

const ORIGINAL = 'design-parts/cards-original/uzurio';
const CAT: Record<string, string> = { power: 'ち', wisdom: 'か', special: '特', evade: '避' };
const uz = (n: number): string => `skl-uzurio-${String(n).padStart(2, '0')}`;
const SHOT = uz(4);
const TORNADO = uz(6);
const RISE = 'sup-12'; // まいあがる風
const SETTLE = 'sup-13'; // しずまる大地
const CALM = 'sup-14'; // しずめの祈り
const TIDE = 'skl-kalshell-15'; // みちしお

describe('ウズリオのデータ（届いた JSON のとおり）', () => {
  it('JSON・CSV は届いたものを無改変で置いた', () => {
    for (const f of ['uzurio12_and_support3_OFFICIAL_20261102.json', 'uzurio12_skills_OFFICIAL_20261102.csv']) {
      expect(readFileSync(`src/data/official/${f}`).equals(readFileSync(`${ORIGINAL}/${f}`)), f).toBe(true);
    }
  });

  it('LIFE 6・地上・空色 #3D8FD6。名前はウズリオ。ID は mon-uzurio', () => {
    const m = getMonster(UZURIO_MONSTER_ID);
    expect(m.name).toBe('ウズリオ');
    expect(m.life).toBe(6);
    expect(m.habitat).toBe('ground');
    expect(MONSTER_HABITAT[UZURIO_MONSTER_ID]).toBe('ground');
    expect(UZURIO_COLOR).toBe('#3D8FD6');
    expect(m.themeColor).toBe('#3D8FD6');
    expect(m.isPlaceholder).toBe(false);
    expect(m.art?.file).toBe('uzurio_official.webp');
  });

  it('技12枚：名前・分類・マナ・ダメージ・レアは JSON のとおり。ID は skl-uzurio-01〜12。最初の箱には入らない', () => {
    const rows = AJ_SKILLS[UZURIO_MONSTER_ID] ?? [];
    expect(rows).toHaveLength(12);
    UZURIO_ROWS.forEach((j, i) => {
      const r = rows[i];
      if (!r) throw new Error(String(i));
      expect(r.id).toBe(uz(j.no));
      expect(r.id).toBe(j.id);
      expect(r.name).toBe(j.name_ja);
      expect(r.cat).toBe(CAT[j.class]);
      expect(r.mana).toBe(j.mana);
      expect(r.damage).toBe(j.damage);
      expect(!!r.rare).toBe(j.rare);
      expect(r.box ?? 0).toBe(0);
      expect(r.art).toBe(uzurioArtFile(j.no));
    });
    expect(skillsOf(UZURIO_MONSTER_ID).map((k) => k.displayNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const b of BOOSTERS) expect(b.monsters).not.toContain(UZURIO_MONSTER_ID);
  });

  it('同じ効果：7 すなけむり＝すなかけ（seal）・8 ふきとばし＝いたずら（handToDeck）・9／10／12＝今ある回避。防御の技は無い', () => {
    expect(getSkill(uz(7)).effect).toEqual(getSkill('skl-soramo14-09').effect);
    expect(getSkill(uz(8)).effect).toEqual(getSkill('skl-lazuck-itazura').effect);
    expect(getSkill(uz(9)).effect).toEqual({ type: 'evade', against: 'force' });
    expect(getSkill(uz(10)).effect).toEqual({ type: 'evade', against: 'wisdom' });
    expect(getSkill(uz(12)).effect).toEqual({ type: 'evade', against: 'all' });
    expect(skillsOf(UZURIO_MONSTER_ID).some((k) => k.effect.type === 'defense')).toBe(false);
  });

  it('絵：技12枚（827×937 の WebP）・正式モンスターカード（508×849）・バトル用（無改変）・枠・パック・販売機の窓。原本は無改変で保管', () => {
    for (let n = 1; n <= 12; n++) {
      expect(existsSync(`assets/images/cards/skills/${uzurioArtFile(n)}`)).toBe(true);
      expect(existsSync(`${ORIGINAL}/uzurio_sk_${String(n).padStart(2, '0')}.png`)).toBe(true);
    }
    expect(readFileSync('assets/images/cards/monsters/uzurio_battlecard.png').equals(readFileSync(`${ORIGINAL}/uzurio_battleart.png`))).toBe(true);
    for (const f of [
      'assets/images/cards/monsters/uzurio_official.webp',
      'assets/images/ui/battlecard/frame_uzurio.png',
      'assets/images/ui/skillcard_simple/frame_normal_uzurio.webp',
      'assets/images/ui/skillcard_simple/frame_hand_uzurio.webp',
      'assets/images/ui/gacha/pack_uzurio.webp',
      'assets/images/ui/gacha/panel_uzurio.webp',
      `${ORIGINAL}/pack_art_uzurio.png`,
      `${ORIGINAL}/uzurio_official_monstercard_LIFE6.png`,
    ]) {
      expect(existsSync(f), f).toBe(true);
    }
    expect(BATTLE_CARDS[UZURIO_MONSTER_ID]?.frame).toBe('uzurio');
    expect(PORTRAIT_FOCUS[UZURIO_MONSTER_ID]).toBeDefined();
  });

  it('英語は仮訳（Uzurio・技名）', () => {
    setLanguage('en');
    try {
      expect(cardName(UZURIO_MONSTER_ID)).toBe('Uzurio');
      expect(cardName(SHOT)).toBe('Swirl Shot');
      expect(cardName(TORNADO)).toBe('Great Tornado');
      expect(cardName(RISE)).toBe('Rising Wind');
    } finally {
      setLanguage('ja');
    }
  });

  it('サポート3枚：JSON のとおり（名前・種類・マナ）。ID は sup-12〜14、ふつう', () => {
    const want = UZURIO_SUPPORT_ROWS.map((r) => [r.name_ja, r.kind === 'field' ? 'field' : 'instant', r.mana]);
    expect([RISE, SETTLE, CALM].map((id) => getSupport(id)).map((c) => [c.name, c.duration, c.cost])).toEqual(want);
    for (const id of [RISE, SETTLE, CALM]) {
      expect(getSupport(id).rarity).toBe('C');
      expect(getSupport(id).isPlaceholder).toBe(false);
      expect(existsSync(`assets/images/cards/skills/${getSupport(id).art?.file}`)).toBe(true);
    }
    expect(getSupport(CALM)).toMatchObject({ limitGroup: 'breeder', limitPerTurn: 1 });
    expect(SUPPORTS.slice(-3).map((c) => c.id)).toEqual([RISE, SETTLE, CALM]);
  });

  it('ガチャ：ウズリオのシリーズ（フォルンの次）・道具のパックに3枚（ふつうの枠）', () => {
    const ids = GACHA_SERIES.map((s) => s.id);
    expect(ids.indexOf('uzurio')).toBe(ids.indexOf('forn') + 1);
    const tools = GACHA_SERIES.find((s) => s.id === 'tools');
    expect(tools?.cardIds).toEqual(expect.arrayContaining([RISE, SETTLE, CALM]));
    expect(tools?.rareSkillNames).toEqual(['思い出の箱', '熱気']);
  });

  it('風の渓谷：ゼフィラの切り札（真ん中）がウズリオ。祭壇はウズリオのモンスターカード', () => {
    expect(ENCOUNTERS['enc-wind-boss']?.ace).toBe(UZURIO_MONSTER_ID);
    expect(ENCOUNTERS['enc-wind-boss']?.monsters).toEqual(['mon-soramo', UZURIO_MONSTER_ID, 'mon-gauul']);
    expect(DUNGEONS.find((d) => d.id === 'dungeon-08')?.firstClearCards).toEqual([{ cardId: UZURIO_MONSTER_ID, count: 1 }]);
  });
});

/* ---------- 対戦 ---------- */

// 自分：ウズリオ（地上）・ソラモ（地上）・ガウル（空中）。相手：カルシェル（水中）・ソラモ（地上）・ガウル（空中）
const pDeck = { monsters: [UZURIO_MONSTER_ID, 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-03') };
const oDeck = { monsters: ['mon-kalshell', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
const U = 'p-m1';

function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}): BattleState {
  const s = createBattle({ name: 'P', deck: pDeck }, { name: 'O', deck: oDeck }, 7, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 12 }, () => 'skl-soramo14-01'),
  });
  return { ...s, phase: 'main', active: 'player', manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}
const mon = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};
/** 自分（player）が手札 uid を使う */
const use = (s: BattleState, cardUid: string, extra: { userUid?: string; targetUid?: string } = {}): BattleState => applyAction(s, { type: 'useCard', side: 'player', cardUid, ...extra });
/** 守りを使わずに受ける（相手全体の攻撃は全員ぶん） */
const noGuard = (s: BattleState): BattleState => {
  let n = s;
  while (n.phase === 'defense') n = applyAction(n, { type: 'defend', side: 'opponent', cardUid: null });
  return n;
};
/** 場のカードを出した状態（手札の最初のカードがサポートの場のカード） */
const withField = (cardId: string, hand: string[] = []): BattleState => use(scene({ player: [cardId, ...hand] }), 'p0');

describe('うずまきショット（相手がいま空中なら＋2）', () => {
  it('空中の相手（ガウル）には 4、地上（ソラモ）・水中（カルシェル）には 2', () => {
    for (const [target, dmg] of [['o-m3', 4], ['o-m2', 2], ['o-m1', 2]] as const) {
      const s = scene({ player: [SHOT] });
      const before = mon(s, target).life;
      const after = noGuard(use(s, 'p0', { userUid: U, targetUid: target }));
      expect(before - mon(after, target).life, target).toBe(dmg);
    }
  });

  it('まいあがる風が場にあれば、地上の相手も空中なので 4。しずまる大地なら空中の相手も地上なので 2', () => {
    const rise = withField(RISE, [SHOT]);
    expect(habitatOf(rise, mon(rise, 'o-m2'))).toBe('air');
    const a = noGuard(use(rise, 'p1', { userUid: U, targetUid: 'o-m2' }));
    expect(mon(rise, 'o-m2').life - mon(a, 'o-m2').life).toBe(4);
    const settle = withField(SETTLE, [SHOT]);
    expect(habitatOf(settle, mon(settle, 'o-m3'))).toBe('ground');
    const b = noGuard(use(settle, 'p1', { userUid: U, targetUid: 'o-m3' }));
    expect(mon(settle, 'o-m3').life - mon(b, 'o-m3').life).toBe(2);
  });

  it('＋2 は技のダメージに足し、場の増減（熱気 ＋1）はそのあと、防御はさらにそのあと', () => {
    const s = withField('sup-6', [SHOT]); // 熱気
    expect(attackPower(s, getSkill(SHOT), mon(s, U), mon(s, 'o-m3'))).toBe(5);
    expect(attackPower(s, getSkill(SHOT), mon(s, U), mon(s, 'o-m2'))).toBe(3);
    // まいあがる風でソラモも空中：2＋2＝4 → 場の声援 ＋1 で 5 → ソラモの星のまもり（防御 −3）で 2
    let r = withField(RISE, [SHOT, 'sup-10']);
    r = use(r, 'p2', { targetUid: U });
    expect(attackPower(r, getSkill(SHOT), mon(r, U), mon(r, 'o-m2'))).toBe(5);
    let n = use({ ...r, sides: { ...r.sides, opponent: { ...r.sides.opponent, hand: [{ uid: 'g0', cardId: 'skl-soramo14-12' }] } } }, 'p1', { userUid: U, targetUid: 'o-m2' });
    n = applyAction(n, { type: 'defend', side: 'opponent', cardUid: 'g0' });
    n = noGuard(n);
    expect(mon(r, 'o-m2').life - mon(n, 'o-m2').life).toBe(2);
  });
});

describe('おおたつまき（空中の相手全員に 2。守りは1体ずつ）', () => {
  it('空中の相手（ガウル）だけに当たる。地上・水中の相手には当たらない', () => {
    const s = scene({ player: [TORNADO] });
    expect(targetsFor(s, 'player', getSkill(TORNADO)).map((m) => m.uid)).toEqual(['o-m3']);
    const n = noGuard(use(s, 'p0', { userUid: U }));
    expect(mon(s, 'o-m3').life - mon(n, 'o-m3').life).toBe(2);
    expect(mon(n, 'o-m1').life).toBe(mon(s, 'o-m1').life);
    expect(mon(n, 'o-m2').life).toBe(mon(s, 'o-m2').life);
  });

  it('まいあがる風があれば、生きている相手全員に当たる（地ひびきと同じく1体ずつ守りを聞く）', () => {
    const s = withField(RISE, [TORNADO]);
    expect(targetsFor(s, 'player', getSkill(TORNADO))).toHaveLength(3);
    const n = noGuard(use(s, 'p1', { userUid: U }));
    for (const id of ['o-m1', 'o-m2', 'o-m3']) expect(mon(s, id).life - mon(n, id).life, id).toBe(2);
  });

  it('空中の相手がいないとき（ガウルが倒れている・しずまる大地）は使えない。理由の文を出す', () => {
    const settle = withField(SETTLE, [TORNADO]);
    expect(cardUsability(settle, 'player', 'p1')).toEqual({ usable: false, reason: '空中の相手がいません（空中にいる相手だけに当たる技）' });
    const s = scene({ player: [TORNADO] });
    const down = { ...s, sides: { ...s.sides, opponent: { ...s.sides.opponent, monsters: s.sides.opponent.monsters.map((m) => (m.uid === 'o-m3' ? { ...m, life: 0 } : m)) } } };
    expect(cardUsability(down, 'player', 'p0').usable).toBe(false);
  });
});

describe('居場所を変える場のカード（まいあがる風・しずまる大地）', () => {
  it('場にある間、双方のすべてのモンスターをその居場所として扱う（期限なし）', () => {
    const rise = withField(RISE);
    for (const m of [...rise.sides.player.monsters, ...rise.sides.opponent.monsters]) expect(habitatOf(rise, m)).toBe('air');
    expect(activeField(rise)).toMatchObject({ cardId: RISE, owner: 'player', habitat: 'air' });
    expect(activeField(rise)?.untilTurn).toBeUndefined();
    const settle = withField(SETTLE);
    for (const m of [...settle.sides.player.monsters, ...settle.sides.opponent.monsters]) expect(habitatOf(settle, m)).toBe('ground');
  });

  it('居場所で決まる技は、いま扱われている居場所で判定：あらし（空中は回避できない）・急降下（地上だけ）', () => {
    const storm = getSkill('skl-tsumuji-09');
    const s = scene({});
    expect(undodgeableAgainst(s, storm, mon(s, 'o-m2'))).toBe(false);
    const rise = withField(RISE);
    expect(undodgeableAgainst(rise, storm, mon(rise, 'o-m2'))).toBe(true);
    const dive = getSkill('skl-gauul14-04');
    expect(targetsFor(scene({}), 'player', dive, mon(s, 'p-m3')).map((m) => m.uid)).toEqual(['o-m2']);
    const settle = withField(SETTLE);
    expect(targetsFor(settle, 'player', dive, mon(settle, 'p-m3')).map((m) => m.uid)).toEqual(['o-m1', 'o-m2', 'o-m3']);
    expect(targetsFor(rise, 'player', dive, mon(rise, 'p-m3'))).toEqual([]);
  });

  it('新しい場のカードが出たら、前の場のカードは持ち主の捨て札へ（場は1枠）', () => {
    let s = withField(RISE, [SETTLE]);
    s = use(s, 'p1');
    expect(activeField(s)?.cardId).toBe(SETTLE);
    expect(s.sides.player.discard).toContain(RISE);
  });

  it('みちしおとの関係：同じ場の枠を使うので、新しいほうが勝つ（まいあがる風はみちしおを上書き・みちしおはまいあがる風を上書きして捨て札へ）', () => {
    // 相手のカルシェルがみちしお → 自分がまいあがる風
    let s = scene({ player: [RISE], opponent: [TIDE] });
    s = { ...s, active: 'opponent' };
    s = applyAction(s, { type: 'useCard', side: 'opponent', cardUid: 'o0', userUid: 'o-m1' });
    expect(habitatOf(s, mon(s, 'p-m1'))).toBe('water');
    s = { ...s, active: 'player', phase: 'main' };
    s = use(s, 'p0');
    expect(activeField(s)?.cardId).toBe(RISE);
    expect(habitatOf(s, mon(s, 'p-m1'))).toBe('air');
    // そのあと相手がもう一度みちしお → まいあがる風は持ち主（自分）の捨て札へ
    s = { ...s, active: 'opponent', phase: 'main', sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: [{ uid: 'o9', cardId: TIDE }], monsters: s.sides.opponent.monsters.map((m) => ({ ...m, acted: false })) } } };
    s = applyAction(s, { type: 'useCard', side: 'opponent', cardUid: 'o9', userUid: 'o-m1' });
    expect(activeField(s)?.habitat).toBe('water');
    expect(s.sides.player.discard).toContain(RISE);
  });
});

describe('しずめの祈り（場のカードを1枚取りのぞく）', () => {
  it('場に何も無いときは使えない（理由の文）', () => {
    expect(cardUsability(scene({ player: [CALM] }), 'player', 'p0')).toEqual({ usable: false, reason: '場にカードがありません' });
  });

  it('場のサポートの場のカードは、出した人の捨て札へ。居場所はすぐ元に戻る', () => {
    // 相手がまいあがる風を出していた
    let s = scene({ player: [CALM], opponent: [RISE] });
    s = applyAction({ ...s, active: 'opponent' }, { type: 'useCard', side: 'opponent', cardUid: 'o0' });
    s = { ...s, active: 'player', phase: 'main' };
    expect(habitatOf(s, mon(s, 'p-m1'))).toBe('air');
    s = use(s, 'p0');
    expect(activeField(s)).toBeNull();
    expect(s.sides.opponent.discard).toContain(RISE);
    expect(s.sides.player.discard).toContain(CALM);
    expect(habitatOf(s, mon(s, 'p-m1'))).toBe('ground');
  });

  it('みちしおの水中も消す（水がすぐ引く）', () => {
    let s = scene({ player: [CALM], opponent: [TIDE] });
    s = applyAction({ ...s, active: 'opponent' }, { type: 'useCard', side: 'opponent', cardUid: 'o0', userUid: 'o-m1' });
    s = { ...s, active: 'player', phase: 'main' };
    expect(habitatOf(s, mon(s, 'p-m3'))).toBe('water');
    s = use(s, 'p0');
    expect(activeField(s)).toBeNull();
    expect(habitatOf(s, mon(s, 'p-m3'))).toBe('air');
    expect(JSON.stringify(s.log)).toContain('場の水が引いた');
  });
});

describe('CPU（2026-11-02 指示書 AQ）', () => {
  it('うずまきショット：倒せないときは空中の相手をねらう', () => {
    for (let seed = 0; seed < 8; seed++) {
      const s = { ...scene({ player: [SHOT] }), seed };
      expect(chooseAction(s, 'player', 'normal', 'B')).toMatchObject({ type: 'useCard', cardUid: 'p0', targetUid: 'o-m3' });
    }
  });

  it('おおたつまき：空中の相手が1体で倒せないときは使わない。2体以上なら使う。1体でも倒せるなら使う', () => {
    const one = scene({ player: [TORNADO] });
    expect(chooseAction(one, 'player', 'normal', 'B')).toMatchObject({ type: 'endAttack' });
    const low = { ...one, sides: { ...one.sides, opponent: { ...one.sides.opponent, monsters: one.sides.opponent.monsters.map((m) => (m.uid === 'o-m3' ? { ...m, life: 2 } : m)) } } };
    expect(chooseAction(low, 'player', 'normal', 'B')).toMatchObject({ type: 'useCard', cardUid: 'p0' });
    const rise = withField(RISE, [TORNADO]);
    expect(chooseAction(rise, 'player', 'normal', 'B')).toMatchObject({ type: 'useCard', cardUid: 'p1' });
  });

  it('まいあがる風：手札・山札に空中に強い技があり、空中でない相手がいるときに出す。無ければ出さない', () => {
    const yes = scene({ player: [RISE, SHOT] }, { player: 3 });
    expect(chooseAction(yes, 'player', 'normal', 'B')).toMatchObject({ type: 'useCard', cardUid: 'p0' });
    const no = scene({ player: [RISE, 'skl-soramo14-03'] }, { player: 3 });
    expect(chooseAction(no, 'player', 'normal', 'B')).not.toMatchObject({ type: 'useCard', cardUid: 'p0' });
  });

  it('しずまる大地：地上に強い技（急降下アタック）があり、地上でない相手がいるときに出す', () => {
    const yes = scene({ player: [SETTLE, 'skl-gauul14-04'] }, { player: 3 });
    expect(chooseAction(yes, 'player', 'normal', 'B')).toMatchObject({ type: 'useCard', cardUid: 'p0' });
  });

  it('しずめの祈り：相手が出した場のカード（みちしおも）を取りのぞく。自分が出した得な場は残す', () => {
    let s = scene({ player: [CALM], opponent: [TIDE] });
    s = applyAction({ ...s, active: 'opponent' }, { type: 'useCard', side: 'opponent', cardUid: 'o0', userUid: 'o-m1' });
    s = { ...s, active: 'player', phase: 'main' };
    expect(chooseAction(s, 'player', 'normal', 'B')).toMatchObject({ type: 'useCard', cardUid: 'p0' });
    const mine = withField(RISE, [CALM, SHOT]);
    expect(chooseAction(mine, 'player', 'normal', 'B')).not.toMatchObject({ cardUid: 'p1' });
  });
});
