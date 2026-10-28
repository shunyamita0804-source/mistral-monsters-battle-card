import { describe, expect, it } from 'vitest';
import { monsterId, skillId, supportId } from '../src/data/cards.ts';
import { nobitonSkillId } from '../src/data/nobiton.ts';
import { BATTLE_RULES } from '../src/data/rules.ts';
import { applyAction, createBattle, manaOf, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { buildAutoDeck, createPlaceholderStarterDeck } from '../src/game/deck/deck.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/**
 * 手札は最大9枚（2026-10-28 ユーザー決定）。引く効果で9枚を超える分は、引かずに山札の上からそのままマナにする。
 * ターンのはじめの「5枚まで引く」・山札が足りないときの負けは今のまま
 */
const DRAW2 = supportId(2); // 仮サポート2：2枚引く（マナ1）
const FILLER = skillId('a', 1);
const THINK = nobitonSkillId(8); // 考える

function scene(side: Side, handSize: number, first: string, mana = 5, user?: string): BattleState {
  const deck = createPlaceholderStarterDeck();
  const s = createBattle({ name: 'P', deck }, { name: 'O', deck: buildAutoDeck(['d', 'e', 'f'].map(monsterId)) }, 3, side);
  const hand = [first, ...Array.from({ length: handSize - 1 }, () => FILLER)].map((cardId, i) => ({ uid: `t${i}`, cardId }));
  const monsters = s.sides[side].monsters.map((m, i) => (i === 0 && user ? { ...m, cardId: user } : m));
  return {
    ...s,
    phase: 'main',
    active: side,
    manaConvertLimit: null,
    sides: { ...s.sides, [side]: { ...s.sides[side], hand, monsters, manaPile: Array.from({ length: mana }, () => FILLER) } },
  };
}

describe('手札は最大9枚', () => {
  setLanguage('ja');

  it('上限は9枚。ターンのはじめに引くのは今までどおり5枚まで', () => {
    expect(BATTLE_RULES.maxHand).toBe(9);
    expect(BATTLE_RULES.refillHandTo).toBe(5);
  });

  it('手札が9枚のときに引く効果を使うと、1枚も引かず、引く枚数ぶん山札の上がマナになる', () => {
    // 10枚の中から2枚引くカードを使う → 残り9枚
    const s0 = scene('player', 10, DRAW2);
    const deckTop = s0.sides.player.deck.slice(0, 2);
    const s = applyAction(s0, { type: 'useCard', side: 'player', cardUid: 't0' });
    expect(s.sides.player.hand).toHaveLength(9);
    expect(s.sides.player.deck).toHaveLength(s0.sides.player.deck.length - 2);
    // 支払いの1マナを引いて、山札の2枚が増える
    expect(manaOf(s.sides.player)).toBe(5 - 1 + 2);
    expect(s.sides.player.manaPile.slice(-2)).toEqual(deckTop);
    expect(s.log.at(-1)?.text).toBe('手札がいっぱい（9枚）なので、山札の上から2枚をマナにした。');
    expect(s.log.some((l) => l.text.startsWith('カードを'))).toBe(false);
    expect(s.fx.at(-1)?.kind).toBe('manaGain');
  });

  it('9枚より少なければ9枚まで引き、残りはマナになる（8枚＋2枚引く → 1枚引いて1枚マナ）', () => {
    const s0 = scene('player', 9, DRAW2);
    const deck = s0.sides.player.deck;
    const s = applyAction(s0, { type: 'useCard', side: 'player', cardUid: 't0' });
    expect(s.sides.player.hand).toHaveLength(9);
    expect(s.sides.player.hand.at(-1)?.cardId).toBe(deck[0]);
    expect(s.sides.player.manaPile.at(-1)).toBe(deck[1]);
    expect(manaOf(s.sides.player)).toBe(5 - 1 + 1);
    expect(s.log.slice(-2).map((l) => l.text)).toEqual(['カードを1枚引いた。', '手札がいっぱい（9枚）なので、山札の上から1枚をマナにした。']);
  });

  it('引いても9枚以下なら、今までどおりすべて手札に（マナにはしない）', () => {
    const s0 = scene('player', 8, DRAW2);
    const s = applyAction(s0, { type: 'useCard', side: 'player', cardUid: 't0' });
    expect(s.sides.player.hand).toHaveLength(9);
    expect(manaOf(s.sides.player)).toBe(5 - 1);
    expect(s.log.at(-1)?.text).toBe('カードを2枚引いた。');
  });

  it('山札が引く枚数より少なければ、手札がいっぱいでも今までどおり負け', () => {
    const s0 = scene('player', 10, DRAW2);
    const short = { ...s0, sides: { ...s0.sides, player: { ...s0.sides.player, deck: s0.sides.player.deck.slice(0, 1) } } };
    const s = applyAction(short, { type: 'useCard', side: 'player', cardUid: 't0' });
    expect(s.winner).toBe('opponent');
    expect(s.endReason).toBe('deckOut');
  });

  it('相手（CPU）も同じ決まり', () => {
    const s0 = scene('opponent', 10, DRAW2);
    const s = applyAction(s0, { type: 'useCard', side: 'opponent', cardUid: 't0' });
    expect(s.sides.opponent.hand).toHaveLength(9);
    expect(manaOf(s.sides.opponent)).toBe(5 - 1 + 2);
  });

  it('考える：戻した枚数を引くが、9枚を超える分はマナ（ふつうは超えない。11枚から使うと10枚戻して9枚引き、1枚マナ）', () => {
    const s0 = scene('player', 11, THINK, 5, monsterId('nobiton'));
    const s = applyAction(s0, { type: 'useCard', side: 'player', cardUid: 't0' });
    expect(s.sides.player.hand).toHaveLength(9);
    expect(s.log.slice(-2).map((l) => l.text)).toEqual([
      'あなたは手札9枚を山札に戻してシャッフルし、9枚引いた。',
      '手札がいっぱい（9枚）なので、山札の上から1枚をマナにした。',
    ]);
  });
});
