import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { cardCatalog, getMonster, skillsOf } from '../src/data/cards.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { LILIL_COLOR, LILIL_MONSTER_ID, LILIL_ROWS, lililArtFile } from '../src/data/lilil.ts';
import { PORTRAIT_FOCUS } from '../src/data/monsterPortraits.ts';
import ak from '../src/data/official/booster_contents_20261102_AK.json';
import aj from '../src/data/official/booster_contents_20261101_AJ.json';
import { AJ_SKILLS, MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, createBattle, targetsFor, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { countCards } from '../src/game/deck/deck.ts';
import { boosterCardCounts, boosterDeck, examLoanDeck } from '../src/game/story/introV2.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/** 指示書 AK（2026-11-02）：リリル。正本は src/data/official/lilil12_skills_OFFICIAL_20261102.json、カードは src/data/skillRebuildAJ.ts の表 */

const ORIGINAL = 'design-parts/cards-original/lilil';
const CAT: Record<string, string> = { ちから技: 'ち', かしこさ技: 'か', 特殊技: '特', 回避: '避' };

describe('リリルのデータ（届いた JSON のとおり）', () => {
  it('JSON・CSV は届いたものを無改変で置いた', () => {
    for (const f of ['lilil12_skills_OFFICIAL_20261102.json', 'lilil12_skills_OFFICIAL_20261102.csv']) {
      expect(readFileSync(`src/data/official/${f}`).equals(readFileSync(`${ORIGINAL}/${f}`)), f).toBe(true);
    }
  });

  it('LIFE 5・空中・やわらかいローズピンク #EE8FB6。名前はリリル、説明は「いたずら好きの小悪魔」（サキュバスと呼ばない）', () => {
    const m = getMonster(LILIL_MONSTER_ID);
    expect(m.name).toBe('リリル');
    expect(m.life).toBe(5);
    expect(m.habitat).toBe('air');
    expect(MONSTER_HABITAT[LILIL_MONSTER_ID]).toBe('air');
    expect(LILIL_COLOR).toBe('#EE8FB6');
    expect(m.themeColor).toBe('#EE8FB6');
    expect(m.description).toBe('いたずら好きの小悪魔。');
    expect(m.isPlaceholder).toBe(false);
    expect(m.art?.file).toBe('lilil_official.webp');
    // 画面に出る文（カードの表・英語）に「サキュバス」が無い（src/data/lilil.ts の説明コメントは決まりを書いているだけ）
    for (const dir of ['src/data/skillRebuildAJ.ts', 'src/i18n/contentEnOfficialDraft.ts', 'src/i18n/contentEnAJ.ts', 'src/i18n/messages/screens.ts']) {
      expect(readFileSync(dir, 'utf8')).not.toMatch(/サキュバス|succubus/i);
    }
  });

  it('技12枚：名前・分類・マナ・ダメージ・レア（ガチャの枠）・箱の枚数は JSON のとおり。ID は skl-lilil-01〜12', () => {
    const rows = AJ_SKILLS[LILIL_MONSTER_ID] ?? [];
    expect(rows).toHaveLength(12);
    expect(LILIL_ROWS).toHaveLength(12);
    LILIL_ROWS.forEach((j, i) => {
      const r = rows[i];
      if (!r) throw new Error(String(i));
      expect(r.id).toBe(`skl-lilil-${String(j.no).padStart(2, '0')}`);
      expect(r.id).toBe(j.id);
      expect(r.name).toBe(j.name);
      expect(r.cat).toBe(CAT[j.category]);
      expect(r.mana).toBe(j.mana);
      expect(r.damage).toBe(j.damage === '―' ? null : Number(j.damage));
      expect(!!r.rare).toBe(j.gacha_slot === 'レア');
      expect(r.box ?? 0).toBe(j.box_copies);
      expect(r.art).toBe(lililArtFile(j.no));
    });
    expect(rows.reduce((n, r) => n + (r.box ?? 0), 0)).toBe(16);
    const skills = skillsOf(LILIL_MONSTER_ID);
    expect(skills.map((k) => k.displayNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(skills.map((k) => k.art?.file)).toEqual(LILIL_ROWS.map((r) => lililArtFile(r.no)));
  });

  it('効果は今ある効果だけ：4・7 マナ−1・−4、8 おびきよせと同じ、9 すなをほると同じ、10〜12 回避（ちから・かしこさ・両方。マナ1）。防御の技は無い', () => {
    const eff = (n: number) => (AJ_SKILLS[LILIL_MONSTER_ID] ?? [])[n - 1]?.effect;
    expect(eff(4)).toEqual({ type: 'attack', manaDrain: 1 });
    expect(eff(7)).toEqual({ type: 'attack', manaDrain: 4 });
    expect(eff(8)).toEqual({ type: 'taunt' });
    expect(eff(9)).toEqual({ type: 'hide' });
    expect(eff(10)).toEqual({ type: 'evade', against: 'force' });
    expect(eff(11)).toEqual({ type: 'evade', against: 'wisdom' });
    expect(eff(12)).toEqual({ type: 'evade', against: 'all' });
    expect(skillsOf(LILIL_MONSTER_ID).filter((k) => k.category === 'defense')).toEqual([]);
    const text = (n: number) => cardCatalog.get(`skl-lilil-${String(n).padStart(2, '0')}`);
    expect(text(8)?.kind === 'skill' ? text(8) && (text(8) as { effectTextJa?: string }).effectTextJa : null).toBe('相手は次のターン、リリルしか攻撃できない');
    expect((text(9) as { effectTextJa?: string }).effectTextJa).toBe('相手は次のターン、リリルを攻撃できない');
  });

  it('絵：技12枚（WebP）・正式モンスターカード・バトル用（無改変）・枠（モンスターカード・技カード）がある。原本は無改変で保管', () => {
    for (let n = 1; n <= 12; n++) {
      const f = `assets/images/cards/skills/${lililArtFile(n)}`;
      expect(readFileSync(f).toString('ascii', 8, 12), f).toBe('WEBP');
      expect(existsSync(`${ORIGINAL}/lilil_sk_${String(n).padStart(2, '0')}.png`)).toBe(true);
    }
    expect(readFileSync('assets/images/cards/monsters/lilil_official.webp').toString('ascii', 8, 12)).toBe('WEBP');
    expect(readFileSync('assets/images/cards/monsters/lilil_battlecard.png').equals(readFileSync(`${ORIGINAL}/lilil_battleart.png`))).toBe(true);
    for (const f of ['ui/battlecard/frame_lilil.png', 'ui/skillcard_simple/frame_normal_lilil.webp', 'ui/skillcard_simple/frame_hand_lilil.webp']) {
      expect(existsSync(`assets/images/${f}`), f).toBe(true);
    }
    expect(BATTLE_CARDS[LILIL_MONSTER_ID]?.frame).toBe('lilil');
    expect(PORTRAIT_FOCUS[LILIL_MONSTER_ID]).toBeDefined();
  });

  it('英語（仮訳）：Lilil・技名・効果の文', () => {
    setLanguage('en');
    expect(cardName(LILIL_MONSTER_ID)).toBe('Lilil');
    expect(cardName('skl-lilil-08')).toBe('Dreamy Wink');
    setLanguage('ja');
  });

  it('ガチャのシリーズ：カルシェルのあと。レアの枠はデビーム・あまいかおり・うそなき・よつばねのまい。並ぶ条件の記録（unlockFlag）は付けない', () => {
    const ids = GACHA_SERIES.map((s) => s.id);
    expect(ids.indexOf('lilil')).toBe(ids.indexOf('kalshell') + 1);
    const s = GACHA_SERIES.find((x) => x.id === 'lilil');
    expect(s?.monsterId).toBe(LILIL_MONSTER_ID);
    expect(s?.rareSkillNames).toEqual(['デビーム', 'あまいかおり', 'うそなき', 'よつばねのまい']);
    expect(s?.unlockFlag).toBeUndefined();
  });
});

describe('最初の箱「旅立ちのきらめき」（指示書 AK：ソラモ・リリル・ラズック）', () => {
  it('新しい版の資料は旅立ちだけ違う（ノビトンの16枚 → リリルの16枚）。烈火・蒼海とサポートは前の版（AJ）と同じ。前の版は残す', () => {
    const g1 = ak.booster_groups.find((g) => g.booster_key === 'booster-1');
    const old1 = aj.booster_groups.find((g) => g.booster_key === 'booster-1');
    expect(g1?.monsters).toEqual(['ソラモ', 'リリル', 'ラズック']);
    expect(old1?.monsters).toEqual(['ソラモ', 'ノビトン', 'ラズック']);
    expect(g1?.support_cards).toEqual(old1?.support_cards);
    expect(g1?.card_rows.filter((r) => r.monster !== 'リリル')).toEqual(old1?.card_rows.filter((r) => r.monster !== 'ノビトン'));
    for (const key of ['booster-2', 'booster-3']) {
      expect(ak.booster_groups.find((g) => g.booster_key === key)).toEqual(aj.booster_groups.find((g) => g.booster_key === key));
    }
  });

  it('リリルの16枚：しっぽはたき2・つめでひっかく2・こあくまだま2・マナをくすねる2・まどわしのひかり2・うっとりウインク2・はねでかわす2・くるりとかわす1・よつばねのまい1', () => {
    const c = countCards(boosterDeck('booster-1').skills);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => c[`skl-lilil-${String(n).padStart(2, '0')}`] ?? 0)).toEqual([2, 2, 2, 2, 2, 0, 0, 2, 0, 2, 1, 1]);
    expect(Object.keys(c).some((id) => id.startsWith('skl-nobiton-'))).toBe(false);
    expect(boosterDeck('booster-1').monsters).toEqual(['mon-soramo', 'mon-lilil', 'mon-lazuck']);
    expect(boosterCardCounts('booster-1')['mon-lilil']).toBe(1);
  });

  it('試験で先生が貸すデッキも同じ（ソラモ・リリル・ラズック）', () => {
    expect(examLoanDeck()).toEqual(boosterDeck('booster-1'));
    expect(examLoanDeck().monsters).toContain(LILIL_MONSTER_ID);
  });

  it('箱の絵（booster_tabidachi）は変えていない。前の中身（formerMonsters）はソラモ・ノビトン・ラズック', () => {
    const b = BOOSTERS.find((x) => x.key === 'booster-1');
    expect(b?.art).toBe('booster_tabidachi');
    expect(b?.formerMonsters).toEqual(['mon-soramo', 'mon-nobiton', 'mon-lazuck']);
  });
});

/* ---------- 対戦（今ある効果がリリルでも働く） ---------- */

// 自分：リリル・ソラモ・ガウル。相手：カルシェル・ソラモ・ガウル
const pDeck = { monsters: ['mon-lilil', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
const oDeck = { monsters: ['mon-kalshell', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
const ATTACK = 'skl-soramo14-03'; // たいあたり（ちから2）
const WISDOM = 'skl-soramo14-07'; // スターダストレイ（かしこさ4）

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
const manaOf = (s: BattleState, side: Side): number => s.sides[side].manaPile.length;
function opponentTurn(s: BattleState, hand: string[]): BattleState {
  return {
    ...s,
    turn: s.turn + 1,
    phase: 'main',
    active: 'opponent',
    pending: null,
    sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: hand.map((cardId, i) => ({ uid: `x${i}`, cardId })), monsters: s.sides.opponent.monsters.map((m) => ({ ...m, acted: false })) } },
  };
}

describe('リリルの効果（今ある効果のまま）', () => {
  it('うっとりウインク：選んだ相手は次のターン、リリルしか攻撃できない（ほかの相手は自由）', () => {
    let s = scene({ player: ['skl-lilil-08'] });
    expect(mon(s, 'p-m1').cardId).toBe('mon-lilil');
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', targetUid: 'o-m1' });
    expect(mon(s, 'o-m1').taunt).toEqual({ monsterId: 'mon-lilil', turn: s.turn + 1 });
    expect(manaOf(s, 'player')).toBe(12 - 3);
    const next = opponentTurn(s, [ATTACK]);
    const atk = cardCatalog.get(ATTACK) as never;
    expect(targetsFor(next, 'opponent', atk, mon(next, 'o-m1')).map((m) => m.uid)).toEqual(['p-m1']);
    expect(targetsFor(next, 'opponent', atk, mon(next, 'o-m2'))).toHaveLength(3);
  });

  it('うそなき：次の相手のターン、リリルは攻撃の的にならない（ほかの味方は狙える）', () => {
    let s = scene({ player: ['skl-lilil-09'] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1' });
    expect(mon(s, 'p-m1').hiddenTurn).toBe(s.turn + 1);
    const next = opponentTurn(s, [ATTACK]);
    const atk = cardCatalog.get(ATTACK) as never;
    expect(targetsFor(next, 'opponent', atk, mon(next, 'o-m1')).map((m) => m.uid)).toEqual(['p-m2', 'p-m3']);
  });

  it('あまいかおり：当たると相手のマナ−4（0 より下にしない）。マナをくすねる：−1。回避されたら減らない', () => {
    let s = scene({ player: ['skl-lilil-07'] }, { opponent: 6 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', targetUid: 'o-m2' });
    if (s.phase === 'defense') s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(manaOf(s, 'opponent')).toBe(2);
    expect(mon(s, 'o-m2').life).toBe(getMonster('mon-soramo').life - 1);
    let few = scene({ player: ['skl-lilil-07'] }, { opponent: 3 });
    few = applyAction(few, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', targetUid: 'o-m2' });
    if (few.phase === 'defense') few = applyAction(few, { type: 'defend', side: 'opponent', cardUid: null });
    expect(manaOf(few, 'opponent')).toBe(0);
    let pinch = scene({ player: ['skl-lilil-04'] }, { opponent: 6 });
    pinch = applyAction(pinch, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', targetUid: 'o-m2' });
    if (pinch.phase === 'defense') pinch = applyAction(pinch, { type: 'defend', side: 'opponent', cardUid: null });
    expect(manaOf(pinch, 'opponent')).toBe(5);
    // 回避された（ソラモの星影ステップ：両方を回避）ら減らない
    let dodged = scene({ player: ['skl-lilil-07'], opponent: ['skl-soramo14-14'] }, { opponent: 6 });
    dodged = applyAction(dodged, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', targetUid: 'o-m2' });
    expect(dodged.phase).toBe('defense');
    dodged = applyAction(dodged, { type: 'defend', side: 'opponent', cardUid: 'o0' });
    expect(mon(dodged, 'o-m2').life).toBe(getMonster('mon-soramo').life);
    expect(manaOf(dodged, 'opponent')).toBe(6 - 2);
  });

  it('回避：はねでかわす＝ちから技だけ・くるりとかわす＝かしこさ技だけ・よつばねのまい＝両方（マナ1）', () => {
    const hit = (card: string, dodge: string): number => {
      let s = { ...opponentTurn(scene({ player: [dodge] }), [card]) };
      s = applyAction(s, { type: 'useCard', side: 'opponent', cardUid: 'x0', userUid: 'o-m2', targetUid: 'p-m1' });
      if (s.phase !== 'defense') return -1;
      // 効かない回避のカードは出せない（出せないときは守らずに受ける）
      const tried = applyAction(s, { type: 'defend', side: 'player', cardUid: 'p0' });
      s = tried === s ? applyAction(s, { type: 'defend', side: 'player', cardUid: null }) : tried;
      return mon(s, 'p-m1').life;
    };
    expect(hit(ATTACK, 'skl-lilil-10')).toBe(5);
    expect(hit(WISDOM, 'skl-lilil-10')).toBeLessThan(5);
    expect(hit(WISDOM, 'skl-lilil-11')).toBe(5);
    expect(hit(ATTACK, 'skl-lilil-11')).toBeLessThan(5);
    expect(hit(ATTACK, 'skl-lilil-12')).toBe(5);
    expect(hit(WISDOM, 'skl-lilil-12')).toBe(5);
  });

  it('CPU もリリルの技を使える（今の思考のまま。手札がうっとりウインクだけでも止まらない）', () => {
    const s = opponentTurn(scene({}), []);
    const cpu: BattleState = {
      ...s,
      sides: {
        ...s.sides,
        opponent: { ...s.sides.opponent, monsters: s.sides.player.monsters.map((m) => ({ ...m, uid: m.uid.replace('p-', 'o-'), acted: false })), hand: [{ uid: 'x0', cardId: 'skl-lilil-08' }, { uid: 'x1', cardId: 'skl-lilil-05' }] },
      },
    };
    const a = chooseAction(cpu, 'opponent', 'normal', 'A');
    expect(a).not.toBeNull();
  });
});
