import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { gearosSkillId, OVERDRIVE_CHOICE } from '../src/data/gearos.ts';
import { chooseAction, overdriveHold } from '../src/game/battle/ai.ts';
import { applyAction, createBattle, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { buildOpponentDeck, countCards } from '../src/game/deck/deck.ts';

/** 指示書 AY【6】（2026-11-05）：テオ（構え overdrive）だけ、ギアロスの α・β・γ を取っておいて3枚コンボを狙う */

const ge = gearosSkillId;
const sor = (n: number): string => `skl-soramo14-${String(n).padStart(2, '0')}`;

/** 相手（opponent）がテオの3体。手札とマナ・相手（player）のマナを決めて、相手の攻撃の手番に */
function scene(hand: string[], mana: number, playerMana = 0, playerMonsters = ['mon-soramo', 'mon-soramo', 'mon-nobiton']): BattleState {
  const filler = Array.from({ length: 60 }, () => sor(1));
  const s = createBattle({ name: 'P', deck: { monsters: playerMonsters, skills: filler } }, { name: 'O', deck: { monsters: ['mon-nobiton', 'mon-gearos', 'mon-gauul'], skills: filler }, lifeScale: 1.82 }, 11, 'opponent');
  const side = (k: Side, h: string[], m: number) => ({ ...s.sides[k], hand: h.map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })), manaPile: Array.from({ length: m }, () => sor(1)) });
  return { ...s, phase: 'main', active: 'opponent', manaConvertLimit: null, sides: { player: side('player', [], playerMana), opponent: side('opponent', hand, mana) } };
}

describe('テオ：オーバードライブの3枚コンボを狙う', () => {
  it('テオだけ構え overdrive・α・β・γ は2枚ずつ（指示書 AY2）。弱い技を減らし強い攻撃を増やしたデッキ', () => {
    const teo = ENCOUNTERS['enc-machine-boss'];
    if (!teo) throw new Error('teo');
    expect(teo.ai).toBe('overdrive');
    const counts = countCards(buildOpponentDeck(teo).skills);
    expect([ge(5), ge(6), ge(7)].map((id) => counts[id])).toEqual([2, 2, 2]);
    expect(counts[ge(9)]).toBeUndefined();
    expect(counts[ge(1)]).toBe(3);
    expect(counts['skl-nobiton-04']).toBe(3);
    expect(buildOpponentDeck(teo).skills).toHaveLength(60);
    expect(teo.lifeScale).toBe(1.6);
    for (const e of Object.values(ENCOUNTERS)) if (e.id !== 'enc-machine-boss') expect(e.ai).not.toBe('overdrive');
  });

  it('2枚あるときは1枚ずつ使わず、マナ5を残す（ほかの構えはふつうに使う）', () => {
    const s = scene([ge(5), ge(6), ge(4)], 6);
    expect(overdriveHold(s, 'opponent', 'overdrive').size).toBe(2);
    const a = chooseAction(s, 'opponent', 'overdrive', 'A');
    // スパークショット（マナ1）を使うと 5 残る → 使ってよい。α・β は使わない
    expect(a).toMatchObject({ type: 'useCard', cardUid: 'o2' });
    const normal = chooseAction(s, 'opponent', 'normal', 'A');
    expect(normal?.type === 'useCard' && ['o0', 'o1'].includes(normal.cardUid)).toBe(true);
  });

  it('2種類あればマナにもしない（指示書 AY2：1種類だけのときは取っておかない）', () => {
    let s = scene([ge(5), ge(6), sor(1), sor(1)], 2);
    s = { ...s, phase: 'mana' };
    for (let i = 0; i < 5 && s.phase === 'mana'; i++) {
      const a = chooseAction(s, 'opponent', 'overdrive', 'A');
      if (!a || a.type !== 'convertToMana') break;
      expect(a.cardUid).not.toBe('o0');
      s = applyAction(s, a);
    }
    expect(s.sides.opponent.hand.some((c) => c.cardId === ge(5))).toBe(true);
    expect(overdriveHold(scene([ge(5), sor(1)], 2), 'opponent', 'overdrive', 2).size).toBe(0);
  });

  it('同じ札の2枚目は取っておかない（それぞれ1枚まで）', () => {
    const held = overdriveHold(scene([ge(5), ge(5), ge(6)], 6), 'opponent', 'overdrive');
    expect([...held].sort()).toEqual(['o0', 'o2']);
  });

  it('取っておくと使える技が無くなる手番は、ふつうに使う（指示書 AY2）', () => {
    // 手札は α・β だけ・マナ4（取っておくと使える技が0枚）→ どちらかを使う
    const a = chooseAction(scene([ge(5), ge(6)], 4), 'opponent', 'overdrive', 'A');
    expect(a?.type).toBe('useCard');
  });

  it('味方が次の相手の攻撃で倒れそうなら、取っておかない', () => {
    // 相手（player）はマナ10でジオル（5ダメージ以上の攻撃）を持つ。テオのガウルのライフが 4 まで減っている → 倒れそう
    const s0 = scene([ge(5), ge(6)], 6, 10, ['mon-geol', 'mon-soramo', 'mon-nobiton']);
    expect(overdriveHold(s0, 'opponent', 'overdrive').size).toBe(2);
    const s = { ...s0, sides: { ...s0.sides, opponent: { ...s0.sides.opponent, monsters: s0.sides.opponent.monsters.map((m) => (m.cardId === 'mon-gauul' ? { ...m, life: 4 } : m)) } } };
    expect(overdriveHold(s, 'opponent', 'overdrive').size).toBe(0);
  });

  it('3枚そろってマナ5あれば、ほかの技より先にコンボ', () => {
    const s = scene([ge(1), ge(5), ge(6), ge(7)], 6);
    expect(chooseAction(s, 'opponent', 'overdrive', 'A')).toMatchObject({ type: 'useCard', choice: OVERDRIVE_CHOICE });
  });
});
