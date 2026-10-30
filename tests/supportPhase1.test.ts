import { describe, expect, it } from 'vitest';
import { getSkill, getSupport, SUPPORTS } from '../src/data/cards.ts';
import { soramoSkillId } from '../src/data/soramo.ts';
import { supportShortText } from '../src/game/cards/cardTypes.ts';
import {
  applyAction,
  attackPower,
  cardUsability,
  createBattle,
  handSkillCost,
  manaOf,
  recallChoices,
  type BattleMonster,
  type BattleState,
  type Side,
} from '../src/game/battle/engine.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/**
 * サポートカード フェーズ1（2026-10-30 指示書 Y・ユーザー決定）。決まりは docs/battle-rules.md「サポートカード（フェーズ1）」
 */
const sor = (n: number): string => soramoSkillId(n);
const S = (code: string): string => {
  const c = SUPPORTS.find((x) => x.code === code);
  if (!c) throw new Error(code);
  return c.id;
};
// ソラモの技：01 体当たり（ちから1・マナ1）・11 まるまる（ちから技の防御）・12 星のまもり（かしこさ技の防御）・13 ひらりジャンプ（マナ2以上を回避）・14 星影ステップ（マナに関係なく回避）
const MONS = ['mon-soramo', 'mon-soramo', 'mon-soramo'];

function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}, discard: string[] = []): BattleState {
  const deck = { monsters: [...MONS], skills: Array.from({ length: 60 }, () => sor(1)) };
  const s = createBattle({ name: 'P', deck }, { name: 'O', deck }, 11, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 10 }, () => sor(1)),
    deck: Array.from({ length: 40 }, () => sor(2)),
    discard: k === 'player' ? discard : [],
  });
  return { ...s, turn: 3, phase: 'main', active: 'player', manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const monster = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};

/** 守り待ちなら、相手が g0 を出せるか見て、出す（出せなければ守らない）→ 攻撃を終える */
function guard(s: BattleState, use: boolean): { usable: boolean; after: BattleState } {
  if (s.phase !== 'defense') return { usable: false, after: s };
  const usable = cardUsability(s, 'opponent', 'g0').usable;
  let after = applyAction(s, { type: 'defend', side: 'opponent', cardUid: usable && use ? 'g0' : null });
  if (after.phase === 'defense') after = applyAction(after, { type: 'defend', side: 'opponent', cardUid: null });
  return { usable, after };
}
const giveOpponent = (s: BattleState, cards: string[]): BattleState => ({
  ...s,
  sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: cards.map((cardId, i) => ({ uid: `g${i}`, cardId })) } },
});

describe('カードの中身（ユーザー決定の表）', () => {
  it('名前・マナ・種類・効果の文・レア（ID は sup-1〜11。前の sup-1〜6 は中身を置きかえた）', () => {
    const rows = SUPPORTS.map((c) => [c.code, c.id, c.name, c.duration === 'field' ? '場' : 'すぐ', c.cost, supportShortText(c), c.rarity === 'R' ? 'レア' : 'ふつう']);
    expect(rows).toEqual([
      ['S01', 'sup-7', '投石', 'すぐ', 1, '相手1体に1ダメージ', 'ふつう'],
      ['S02', 'sup-2', '旅の手帳', 'すぐ', 1, 'カードを2枚引く', 'ふつう'],
      ['S03', 'sup-1', '薬草', 'すぐ', 2, '味方1体のライフを1回復', 'ふつう'],
      ['S04', 'sup-8', '思い出の箱', 'すぐ', 3, '捨て札の技カード1枚を選んで手札に戻す', 'レア'],
      ['S05', 'sup-3', '風まかせ', 'すぐ', 0, '手札1枚を山札に戻してシャッフルし、1枚引く', 'ふつう'],
      ['S06', 'sup-9', '霧の香', 'すぐ', 1, '相手のマナを1減らす', 'ふつう'],
      ['S07', 'sup-10', '声援', 'すぐ', 1, 'このターン、味方1体が次に使う攻撃のダメージ＋1', 'ふつう'],
      ['F01', 'sup-4', '重い空気', '場', 3, 'ちから技のダメージ−1', 'ふつう'],
      ['F02', 'sup-5', 'ゆらぐ霧', '場', 3, 'かしこさ技のダメージ−1', 'ふつう'],
      ['F03', 'sup-6', '熱気', '場', 3, 'すべての攻撃のダメージ＋1', 'レア'],
      ['F04', 'sup-11', '守りの陣', '場', 3, '防御・回避のカードの消費マナ−1', 'ふつう'],
    ]);
  });

  it('英語の名前（仮訳）', () => {
    setLanguage('en');
    try {
      expect(cardName(S('S01'))).toBe('Stone Throw');
      expect(cardName(S('F04'))).toBe('Guard Formation');
      expect(supportShortText(getSupport(S('S02')))).toBe('Draw 2 cards');
    } finally {
      setLanguage('ja');
    }
  });
});

describe('S01 投石：ちから技（マナ1・ダメージ1）として相手1体に', () => {
  it('当たれば1ダメージ。マナ1を払う。モンスターの行動は使わない', () => {
    let s = scene({ player: [S('S01')] }, { player: 3 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(s.phase).toBe('defense');
    s = guard(s, false).after;
    expect(monster(s, 'o-m1').life).toBe(monster(s, 'o-m1').maxLife - 1);
    expect(manaOf(s.sides.player)).toBe(2);
    expect(s.sides.player.monsters.every((m) => !m.acted)).toBe(true);
    expect(s.phase).toBe('main');
  });

  it('相手は「ちから技に効く」防御・回避を使える。かしこさ技の防御は使えない。「消費マナ2以上」の回避は使えない（投石のマナ1で判定）', () => {
    const base = scene({ player: [S('S01')] });
    const at = (g: string) => guard(applyAction(giveOpponent(base, [g]), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' }), true);
    const blocked = at(sor(11));
    expect(blocked.usable).toBe(true);
    expect(monster(blocked.after, 'o-m1').life).toBe(monster(blocked.after, 'o-m1').maxLife);
    expect(at(sor(12)).usable).toBe(false);
    expect(at(sor(13)).usable).toBe(false);
    const dodged = at(sor(14));
    expect(dodged.usable).toBe(true);
    expect(monster(dodged.after, 'o-m1').life).toBe(monster(dodged.after, 'o-m1').maxLife);
  });

  it('場の増減は今の決まりどおり：重い空気で0、熱気で2', () => {
    const heavy = { ...scene({ player: [S('S01')] }), field: { cardId: S('F01'), owner: 'opponent' as Side } };
    expect(guard(applyAction(heavy, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' }), false).after.sides.opponent.monsters[0]?.life).toBe(monster(heavy, 'o-m1').maxLife);
    const heat = { ...scene({ player: [S('S01')] }), field: { cardId: S('F03'), owner: 'opponent' as Side } };
    expect(guard(applyAction(heat, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' }), false).after.sides.opponent.monsters[0]?.life).toBe(monster(heat, 'o-m1').maxLife - 2);
  });

  it('すなをほるで隠れている相手は選べない', () => {
    let s = scene({ player: [S('S01')] });
    s = { ...s, sides: { ...s.sides, opponent: { ...s.sides.opponent, monsters: s.sides.opponent.monsters.map((m) => (m.uid === 'o-m1' ? { ...m, hiddenTurn: s.turn } : m)) } } };
    expect(applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' })).toBe(s);
  });

  it('すぐ効くカードは全部まとめて1ターンに1回', () => {
    let s = scene({ player: [S('S01'), S('S02')] });
    s = guard(applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' }), false).after;
    expect(cardUsability(s, 'player', 'p1').usable).toBe(false);
  });
});

describe('S04 思い出の箱・S05 風まかせ（選ぶカード）', () => {
  it('思い出の箱：捨て札の技カード（サポートは選べない）を1枚選んで手札へ。無ければ使えない', () => {
    expect(cardUsability(scene({ player: [S('S04')] }, {}, [S('S02')]), 'player', 'p0')).toMatchObject({ usable: false, reason: '捨て札に技カードがありません' });
    let s = scene({ player: [S('S04')] }, { player: 5 }, [sor(4), S('S02'), sor(4)]);
    expect(recallChoices(s, 'player')).toEqual([sor(4)]);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', choice: sor(4) });
    expect(s.sides.player.hand.map((c) => c.cardId)).toEqual([sor(4)]);
    // 捨て札：戻した1枚が減り、使った思い出の箱が入る（ほかは払ったマナのカード）
    expect(s.sides.player.discard.filter((id) => id !== sor(1))).toEqual([sor(4), S('S02'), S('S04')]);
    expect(manaOf(s.sides.player)).toBe(2);
  });

  it('思い出の箱：手札が9枚（このカードのほかに9枚）なら使えない', () => {
    const s = scene({ player: [S('S04'), ...Array.from({ length: 9 }, () => sor(1))] }, {}, [sor(4)]);
    expect(cardUsability(s, 'player', 'p0').usable).toBe(false);
  });

  it('風まかせ：このカード以外の1枚を山札に戻してシャッフルし、1枚引く。ほかの手札が無ければ使えない。山札0枚でも負けない', () => {
    expect(cardUsability(scene({ player: [S('S05')] }), 'player', 'p0').usable).toBe(false);
    let s = scene({ player: [S('S05'), sor(14)] }, { player: 0 });
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, deck: [] } } };
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', choice: 'p1' });
    expect(s.phase).toBe('main');
    expect(s.sides.player.hand.map((c) => c.cardId)).toEqual([sor(14)]);
    expect(s.sides.player.deck).toEqual([]);
  });
});

describe('S06 霧の香・S07 声援・S02 旅の手帳・S03 薬草', () => {
  it('霧の香：相手のマナを1減らす。相手のマナが0なら使えない', () => {
    let s = scene({ player: [S('S06')] }, { opponent: 2 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(manaOf(s.sides.opponent)).toBe(1);
    expect(cardUsability(scene({ player: [S('S06')] }, { opponent: 0 }), 'player', 'p0').usable).toBe(false);
  });

  it('声援：まだ動いていない味方1体の、このターンの次の攻撃＋1。攻撃を1回使ったら消える。動いた味方は選べない', () => {
    let s = scene({ player: [S('S07'), sor(1), sor(1)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'p-m1' });
    expect(monster(s, 'p-m1').cheer).toEqual({ amount: 1, turn: s.turn });
    expect(attackPower(s, getSkill(sor(1)), monster(s, 'p-m1'))).toBe((getSkill(sor(1)).stat?.value ?? 0) + 1);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p1', userUid: 'p-m1', targetUid: 'o-m1' });
    s = guard(s, false).after;
    expect(monster(s, 'o-m1').life).toBe(monster(s, 'o-m1').maxLife - (getSkill(sor(1)).stat?.value ?? 0) - 1);
    expect(monster(s, 'p-m1').cheer).toBeNull();
    const acted = { ...scene({ player: [S('S07')] }) };
    const allActed = { ...acted, sides: { ...acted.sides, player: { ...acted.sides.player, monsters: acted.sides.player.monsters.map((m) => ({ ...m, acted: true })) } } };
    expect(cardUsability(allActed, 'player', 'p0').usable).toBe(false);
  });

  it('旅の手帳：2枚引く。薬草：味方1体のライフを1回復（最大まで）', () => {
    let s = scene({ player: [S('S02')] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(s.sides.player.hand).toHaveLength(2);
    let h = scene({ player: [S('S03')] });
    h = { ...h, sides: { ...h.sides, player: { ...h.sides.player, monsters: h.sides.player.monsters.map((m) => (m.uid === 'p-m1' ? { ...m, life: m.maxLife - 3 } : m)) } } };
    h = applyAction(h, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'p-m1' });
    expect(monster(h, 'p-m1').life).toBe(monster(h, 'p-m1').maxLife - 2);
  });
});

describe('F04 守りの陣：場にある間、双方の防御・回避のカードの必要マナ−1（0より下にならない）', () => {
  it('手札の数字も下がる。払うマナも1少ない', () => {
    let s = scene({ player: [S('F04')] }, { opponent: 1 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(s.field).toEqual({ cardId: S('F04'), owner: 'player' });
    // ひらりジャンプ（マナ2）→ 1。体当たり（攻撃）は変わらない
    expect(getSkill(sor(13)).cost).toBe(2);
    expect(handSkillCost(s, 'opponent', getSkill(sor(13)))).toBe(1);
    expect(handSkillCost(s, 'opponent', getSkill(sor(1)))).toBe(getSkill(sor(1)).cost);
  });

  it('マナ1で、ふだんマナ2の回避を出せる（相手の攻撃に）', () => {
    const fielded = { ...scene({ player: [sor(4)] }, { opponent: 1 }), field: { cardId: S('F04'), owner: 'opponent' as Side } };
    const s = applyAction(giveOpponent(fielded, [sor(14)]), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    const r = guard(s, true);
    expect(r.usable).toBe(true);
    expect(manaOf(r.after.sides.opponent)).toBe(0);
  });
});

describe('入手・デッキ（2026-10-30 指示書 Y）', () => {
  it('最初の箱：技56枚＋旅の手帳×2・投石×2＝60枚', async () => {
    const { boosterDeck } = await import('../src/game/story/introV2.ts');
    const { countCards } = await import('../src/game/deck/deck.ts');
    for (const key of ['booster-1', 'booster-2', 'booster-3'] as const) {
      const d = boosterDeck(key);
      expect(d.skills).toHaveLength(60);
      const sup = countCards(d.skills.filter((id) => id.startsWith('sup-')));
      expect(sup).toEqual({ [S('S02')]: 2, [S('S01')]: 2 });
    }
  });

  it('CPU のデッキ（組み方なし・組み方あり・ボス）：サポートは旅の手帳×2・投石×2 だけ（回復・場のカードは入れない）', async () => {
    const { buildAutoDeck, buildOpponentDeck, countCards, isDeckValid } = await import('../src/game/deck/deck.ts');
    const { ENCOUNTERS } = await import('../src/data/dungeons.ts');
    const decks = [
      buildAutoDeck(['mon-soramo', 'mon-lazuck', 'mon-gauul']),
      buildOpponentDeck({ monsters: ['mon-soramo', 'mon-lazuck', 'mon-gauul'], deckStyle: 'guard' }),
      buildOpponentDeck(ENCOUNTERS['enc-ice-boss'] as never),
    ];
    for (const d of decks) {
      expect(d.skills).toHaveLength(60);
      expect(isDeckValid(d)).toBe(true);
      expect(countCards(d.skills.filter((id) => id.startsWith('sup-')))).toEqual({ [S('S02')]: 2, [S('S01')]: 2 });
    }
  });

  it('おまかせ：持っていれば旅の手帳・投石を2枚ずつまで。強い攻撃と守りを先に3枚ずつ。仮サポートで埋めない', async () => {
    const { buildDeckFromCollection, countCards } = await import('../src/game/deck/deck.ts');
    const { skillsOf } = await import('../src/data/cards.ts');
    const monsters = ['mon-soramo', 'mon-gauul', 'mon-myurol'];
    const collection: Record<string, number> = { [S('S01')]: 3, [S('S02')]: 3, [S('S03')]: 3, [S('F01')]: 3 };
    for (const m of monsters) for (const k of skillsOf(m)) collection[k.id] = 3;
    const d = buildDeckFromCollection(monsters, collection);
    expect(d.skills).toHaveLength(60);
    const c = countCards(d.skills);
    expect(c[S('S01')]).toBe(2);
    expect(c[S('S02')]).toBe(2);
    expect(c[S('S03')] ?? 0).toBe(0);
    expect(c[S('F01')] ?? 0).toBe(0);
    // いちばんダメージの大きい攻撃は3枚入る
    const top = monsters.flatMap((m) => skillsOf(m)).filter((k) => k.effect.type === 'attack').sort((a, b) => (b.stat?.value ?? 0) - (a.stat?.value ?? 0))[0];
    expect(c[top?.id ?? '']).toBe(3);
    // 技が足りなければ、ほかの持っているサポートで埋める
    const few = buildDeckFromCollection(['mon-soramo'], { ...collection, ...Object.fromEntries(skillsOf('mon-soramo').map((k) => [k.id, 1])) });
    expect(few.skills.filter((id) => id === S('S03'))).toHaveLength(3);
  });

  it('道具のパック（仮）：最初から並ぶ。中身はサポート11種類・レアの枠は思い出の箱・熱気。モンスターカードは出ない', async () => {
    const { GACHA_SERIES } = await import('../src/data/economy.ts');
    const { availableGachaSeriesFor, drawSeriesPack, seriesLineup } = await import('../src/game/economy/gachaSeries.ts');
    const { createNewSave } = await import('../src/game/save/saveData.ts');
    const tools = GACHA_SERIES.find((s) => s.id === 'tools');
    if (!tools) throw new Error('tools');
    const lineup = seriesLineup(tools);
    expect(lineup.errors).toEqual([]);
    expect(lineup.all).toEqual(SUPPORTS.map((c) => c.id));
    expect(lineup.rareIds).toEqual([S('S04'), S('F03')]);
    expect(availableGachaSeriesFor(createNewSave()).map((s) => s.id)).toContain('tools');
    for (let seed = 1; seed < 500; seed++) for (const id of drawSeriesPack(tools, seed).cards) expect(id.startsWith('sup-')).toBe(true);
  });
});

describe('CPU の思考（2026-10-30 指示書 Y の仮の思考）', () => {
  it('投石：ライフ1の相手がいれば、その相手に先に使う', async () => {
    const { chooseAction } = await import('../src/game/battle/ai.ts');
    let s = scene({ player: [S('S01'), sor(4)] }, { player: 5 });
    s = { ...s, sides: { ...s.sides, opponent: { ...s.sides.opponent, monsters: s.sides.opponent.monsters.map((m) => (m.uid === 'o-m3' ? { ...m, life: 1 } : m)) } } };
    expect(chooseAction(s, 'player')).toMatchObject({ type: 'useCard', cardUid: 'p0', targetUid: 'o-m3' });
  });

  it('守りのカードを残す枚数（指示書 Y でふつう 1→2、指示書 Z で腕前ごとに C 0・B 1・A 2）', async () => {
    const { chooseAction } = await import('../src/game/battle/ai.ts');
    let s = scene({ player: [sor(11), sor(14), sor(13), sor(4)] }, { player: 3 });
    s = { ...s, phase: 'mana' };
    const keptGuards = (skill: 'C' | 'B' | 'A'): number => {
      let x = s;
      for (let i = 0; i < 6; i++) {
        const a = chooseAction(x, 'player', 'normal', skill);
        if (!a || a.type !== 'convertToMana') break;
        x = applyAction(x, a);
      }
      return x.sides.player.hand.filter((c) => [sor(11), sor(14), sor(13)].includes(c.cardId)).length;
    };
    expect([keptGuards('C'), keptGuards('B'), keptGuards('A')]).toEqual([0, 1, 2]);
  });
});
