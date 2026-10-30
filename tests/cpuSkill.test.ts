import { describe, expect, it } from 'vitest';
import { getSkill, SUPPORTS } from '../src/data/cards.ts';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { runBossOpponent, runCpuSkill, runGuardianOpponent, runNpcOpponent } from '../src/data/dungeonRun.ts';
import { FLUNE_SKILLS, fluneSkillId } from '../src/data/flune.ts';
import { EXAM_OPPONENT } from '../src/data/introV2.ts';
import { soramoSkillId } from '../src/data/soramo.ts';
import { TOURNAMENTS } from '../src/data/tournaments.ts';
import { chooseAction, CPU_SKILL, cpuRoll } from '../src/game/battle/ai.ts';
import { applyAction, cardUsability, createBattle, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { skillValue } from '../src/game/cards/cardTypes.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/**
 * CPU の腕前（C 下手・B ふつう・A 上手。2026-10-30 指示書 Z）・フルーネの新しい数字・旅の手帳の CPU の使い方
 */
const sor = (n: number): string => soramoSkillId(n);
const JOURNAL = SUPPORTS.find((c) => c.code === 'S02')?.id ?? '';
const MONS = ['mon-soramo', 'mon-soramo', 'mon-soramo'];

function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}, seed = 11, deckSize = 40): BattleState {
  const deck = { monsters: [...MONS], skills: Array.from({ length: 60 }, () => sor(1)) };
  const s = createBattle({ name: 'P', deck }, { name: 'O', deck }, seed, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 10 }, () => sor(1)),
    deck: Array.from({ length: deckSize }, () => sor(2)),
  });
  return { ...s, turn: 3, phase: 'main', active: 'player', manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const setLife = (s: BattleState, side: Side, lives: number[]): BattleState => ({
  ...s,
  sides: { ...s.sides, [side]: { ...s.sides[side], monsters: s.sides[side].monsters.map((m, i) => ({ ...m, life: lives[i] ?? m.life })) } },
});

describe('CPU の腕前（2026-10-30 指示書 Z）', () => {
  it('腕前ごとの数字（仮）は1か所にまとまっている', () => {
    expect(CPU_SKILL.C).toEqual({ missKill: 0.5, hesitate: 0.15, weakSkill: 0.3, misguard: 0.4, guardKeep: 0, guardFirst: 0.3, forgetRecoil: 0.3 });
    expect(CPU_SKILL.B).toEqual({ missKill: 0.2, hesitate: 0, weakSkill: 0, misguard: 0, guardKeep: 1, guardFirst: 0, forgetRecoil: 0 });
    expect(CPU_SKILL.A).toEqual({ missKill: 0, hesitate: 0, weakSkill: 0, misguard: 0, guardKeep: 2, guardFirst: 0, forgetRecoil: 0 });
  });

  it('ばらばらは対戦の seed から決まる（同じ場面では同じ値・0 以上 1 未満）', () => {
    const s = scene({});
    expect(cpuRoll(s, 'player', 'x')).toBe(cpuRoll(s, 'player', 'x'));
    const values = Array.from({ length: 500 }, (_, i) => cpuRoll({ ...s, turn: i + 1 }, 'opponent', 'kill'));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    // だいたい一様（半分より小さいのが 4〜6 割）
    const low = values.filter((v) => v < 0.5).length / values.length;
    expect(low).toBeGreaterThan(0.4);
    expect(low).toBeLessThan(0.6);
  });

  it('A：倒せる相手は必ず倒し、倒しすぎない技を選ぶ（ライフ2の相手に、しっぽアタック〔3〕ではなく、たいあたり〔2〕）', () => {
    const s = setLife(scene({ player: [sor(4), sor(3)] }), 'opponent', [2, 7, 7]);
    expect(chooseAction(s, 'player', 'normal', 'A')).toMatchObject({ type: 'useCard', cardUid: 'p1', targetUid: 'o-m1' });
  });

  it('B・C：倒せる相手を一部で見のがす（B 約2割・C 約5割）。A は見のがさない', () => {
    const missRate = (skill: 'A' | 'B' | 'C'): number => {
      let miss = 0;
      const n = 400;
      for (let t = 0; t < n; t++) {
        const s = { ...setLife(scene({ player: [sor(4)] }), 'opponent', [3, 7, 7]), turn: t + 3 };
        const a = chooseAction(s, 'player', 'normal', skill);
        if (a?.type === 'useCard' && a.targetUid !== 'o-m1') miss++;
        if (a?.type === 'endAttack') miss++;
      }
      return miss / n;
    };
    expect(missRate('A')).toBe(0);
    // 見のがしたあとの狙いはばらばらなので、たまたま o-m1 を狙うこともある（見のがしの割合 × 2/3 くらい）
    expect(missRate('B')).toBeGreaterThan(0.06);
    expect(missRate('B')).toBeLessThan(0.25);
    expect(missRate('C')).toBeGreaterThan(0.25);
  });

  it('倒せないときの狙い：A はいちばん危ない相手（技の最大ダメージ ÷ 残りライフ）。ライフの少ない相手から狙う、はやめた', () => {
    // 同じソラモ3体なら、危なさ＝残りライフの少ない相手
    const s = setLife(scene({ player: [sor(4)] }), 'opponent', [7, 5, 6]);
    expect(chooseAction(s, 'player', 'normal', 'A')).toMatchObject({ targetUid: 'o-m2' });
    // B はばらばら（3体ともに狙われる）
    const targets = new Set<string>();
    for (let t = 0; t < 60; t++) {
      const a = chooseAction({ ...s, turn: t + 3 }, 'player', 'normal', 'B');
      if (a?.type === 'useCard' && a.targetUid) targets.add(a.targetUid);
    }
    expect([...targets].sort()).toEqual(['o-m1', 'o-m2', 'o-m3']);
  });

  it('C：攻撃できる手番の約15%で攻撃を見送り、記録に「〇〇は迷っている…」。B・A は見送らない', () => {
    setLanguage('ja');
    let hesitate = 0;
    let text = '';
    const n = 400;
    for (let t = 0; t < n; t++) {
      const s = { ...scene({ player: [sor(4)] }), turn: t + 3 };
      const a = chooseAction(s, 'player', 'normal', 'C');
      if (a?.type === 'endAttack') {
        expect(a.note).toBe('hesitate');
        hesitate++;
        text = applyAction(s, a).log.at(-2)?.text ?? '';
      }
      expect(chooseAction(s, 'player', 'normal', 'B')?.type).toBe('useCard');
      expect(chooseAction(s, 'player', 'normal', 'A')?.type).toBe('useCard');
    }
    expect(hesitate / n).toBeGreaterThan(0.08);
    expect(hesitate / n).toBeLessThan(0.22);
    expect(text).toBe('Pは迷っている…');
  });

  it('C：守れるのに約4割で守らず、記録に「〇〇は守りそこねた！」。B・A は守る', () => {
    setLanguage('ja');
    let missed = 0;
    let text = '';
    const n = 300;
    for (let t = 0; t < n; t++) {
      const s0 = { ...scene({ player: [sor(4)], opponent: [sor(11)] }), turn: t + 3 };
      const s = applyAction(s0, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
      expect(s.phase).toBe('defense');
      expect(chooseAction(s, 'opponent', 'normal', 'B')).toEqual({ type: 'defend', side: 'opponent', cardUid: 'o0' });
      expect(chooseAction(s, 'opponent', 'normal', 'A')).toEqual({ type: 'defend', side: 'opponent', cardUid: 'o0' });
      const c = chooseAction(s, 'opponent', 'normal', 'C');
      if (c?.type === 'defend' && c.cardUid === null) {
        expect(c.note).toBe('misguard');
        missed++;
        text = applyAction(s, c).log.find((l) => l.text.includes('守りそこねた'))?.text ?? '';
      }
    }
    expect(missed / n).toBeGreaterThan(0.3);
    expect(missed / n).toBeLessThan(0.5);
    expect(text).toBe('Oは守りそこねた！');
  });

  it('構えは腕前より優先：aggressive は A でも倒されそうなときしか守らない・守りを残さない', () => {
    const s0 = scene({ player: [sor(4)], opponent: [sor(11)] });
    const s = applyAction(s0, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(chooseAction(s, 'opponent', 'aggressive', 'A')).toEqual({ type: 'defend', side: 'opponent', cardUid: null });
  });

  it('hunter の構えは最大ライフの少ないモンスターから（残りライフでは選ばない）', () => {
    const deck = { monsters: ['mon-soramo', 'mon-soramo', 'mon-soramo'], skills: Array.from({ length: 60 }, () => sor(1)) };
    const oppDeck = { monsters: ['mon-kalshell', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, () => sor(1)) };
    const b = createBattle({ name: 'P', deck }, { name: 'O', deck: oppDeck }, 5, 'player');
    let s: BattleState = { ...b, turn: 3, phase: 'main', active: 'player', manaConvertLimit: null };
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, hand: [{ uid: 'p0', cardId: sor(4) }], manaPile: Array.from({ length: 5 }, () => sor(1)) } } };
    const minMax = Math.min(...s.sides.opponent.monsters.map((m) => m.maxLife));
    for (const skill of ['A', 'B'] as const) {
      const a = chooseAction(s, 'player', 'hunter', skill);
      const target = s.sides.opponent.monsters.find((m) => a?.type === 'useCard' && m.uid === a.targetUid);
      expect(target?.maxLife, skill).toBe(minMax);
    }
  });
});

describe('旅の手帳の CPU の使い方（2026-10-30 指示書 Z）', () => {
  it('山札が20枚以上・マナが払える・手札に今のマナで使える攻撃技が無いときに使う', () => {
    // しっぽアタック（マナ3）が払えない（マナ1）
    const s = scene({ player: [JOURNAL, sor(4)] }, { player: 1 });
    expect(chooseAction(s, 'player', 'normal', 'B')).toEqual({ type: 'useCard', side: 'player', cardUid: 'p0' });
    // 山札が19枚なら使わない
    expect(chooseAction(scene({ player: [JOURNAL, sor(4)] }, { player: 1 }, 11, 19), 'player', 'normal', 'B')).toEqual({ type: 'endAttack', side: 'player' });
    // 使える攻撃技があれば、攻撃が先（手帳は使わない）
    expect(chooseAction(scene({ player: [JOURNAL, sor(3)] }, { player: 2 }), 'player', 'normal', 'A')).toMatchObject({ cardUid: 'p1' });
    // 守りの構え（guard）は今までどおり使わない
    expect(chooseAction(s, 'player', 'guard', 'B')).toEqual({ type: 'endAttack', side: 'player' });
  });
});

describe('フルーネの新しい数字（2026-10-30 指示書 Z・ユーザー決定）', () => {
  it('つたはたき 0・1／ねっこづき 2・1／ねっこムチ 3・2／ねっこラッシュ 4・3。ほかの技・LIFE は変えない', () => {
    expect([1, 2, 3, 4].map((n) => [getSkill(fluneSkillId(n)).cost, skillValue(getSkill(fluneSkillId(n)))])).toEqual([[0, 1], [2, 1], [3, 2], [4, 3]]);
    expect(FLUNE_SKILLS).toHaveLength(14);
    expect(getSkill(fluneSkillId(5))).toMatchObject({ cost: 1 });
  });

  it('つたはたき（マナ0）はマナ0で使え、「消費マナ2以上」の回避（ソラモのひらりジャンプ）ではよけられない', () => {
    const deck = { monsters: ['mon-flune', 'mon-soramo', 'mon-soramo'], skills: Array.from({ length: 60 }, () => sor(1)) };
    const b = createBattle({ name: 'P', deck }, { name: 'O', deck: { monsters: [...MONS], skills: deck.skills } }, 3, 'player');
    let s: BattleState = { ...b, turn: 3, phase: 'main', active: 'player', manaConvertLimit: null };
    s = {
      ...s,
      sides: {
        player: { ...s.sides.player, hand: [{ uid: 'p0', cardId: fluneSkillId(1) }], manaPile: [] },
        opponent: { ...s.sides.opponent, hand: [{ uid: 'o0', cardId: sor(13) }], manaPile: Array.from({ length: 5 }, () => sor(1)) },
      },
    };
    expect(cardUsability(s, 'player', 'p0').usable).toBe(true);
    const attacked = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', targetUid: 'o-m1' });
    expect(attacked.phase).toBe('defense');
    expect(cardUsability(attacked, 'opponent', 'o0').usable).toBe(false);
  });
});

describe('腕前の割り当て（2026-10-30 指示書 Z・ユーザー OK の案）', () => {
  it('練習（ガレス先生）・E の大会は C、D の大会は C〜B', () => {
    expect(EXAM_OPPONENT.skill).toBe('C');
    expect(ENCOUNTERS['enc-practice']?.skill).toBe('C');
    const e = TOURNAMENTS.find((x) => x.id === 'tournament-e');
    expect(e?.rounds.map((r) => r.skill)).toEqual(['C', 'C', 'C']);
    expect(TOURNAMENTS.find((x) => x.id === 'tournament-d')?.rounds.map((r) => r.skill)).toEqual(['C', 'C', 'B']);
  });

  it('大会の常連は1人ずつ（構えは今のまま）。一般の出場者は C・B の大会で B、A・S で A', () => {
    const regs = new Map<string, string | undefined>();
    for (const t of TOURNAMENTS) for (const r of t.bracket?.regulars ?? []) regs.set(r.name, r.skill);
    expect(Object.fromEntries(regs)).toMatchObject({ シエナ: 'B', ドルフ: 'C', レナード: 'B', グレタ: 'B', ユリウス: 'A', カミラ: 'A', アルヴィン: 'A' });
    for (const t of TOURNAMENTS) {
      if (!t.bracket) continue;
      const want = ['tournament-c', 'tournament-b'].includes(t.id) ? 'B' : 'A';
      for (const g of t.bracket.pool) expect(g.skill, `${t.id} ${g.name}`).toBe(want);
    }
  });

  it('ダンジョン：森 C・水と風 C と B を半分ずつ・遺跡と氷と火 B・機械と聖域 A。ボスは1つ上', () => {
    expect([1, 2, 3].map((i) => runNpcOpponent(1, i, 'dungeon-02').skill)).toEqual(['C', 'C', 'C']);
    expect([1, 2, 3, 4].map((i) => runNpcOpponent(1, i, 'dungeon-03').skill)).toEqual(['C', 'B', 'C', 'B']);
    expect([1, 2].map((f) => runGuardianOpponent(f, 'dungeon-08').skill)).toEqual(['C', 'B']);
    for (const id of ['dungeon-01', 'dungeon-04', 'dungeon-05']) expect(runCpuSkill(id, 1)).toBe('B');
    for (const id of ['dungeon-06', 'dungeon-07']) expect(runGuardianOpponent(2, id).skill).toBe('A');
    const boss = (id: string): string | undefined => runBossOpponent(id).skill;
    expect(['dungeon-02', 'dungeon-03', 'dungeon-08'].map(boss)).toEqual(['B', 'B', 'B']);
    expect(['dungeon-01', 'dungeon-04', 'dungeon-05', 'dungeon-06', 'dungeon-07'].map(boss)).toEqual(['A', 'A', 'A', 'A', 'A']);
  });
});
