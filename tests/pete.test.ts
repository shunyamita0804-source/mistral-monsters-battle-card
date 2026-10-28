import { describe, expect, it } from 'vitest';
import { getTournament } from '../src/data/tournaments.ts';
import { runGuardianOpponent, runNpcOpponent } from '../src/data/dungeonRun.ts';
import { PUKARIM_MONSTER_ID } from '../src/data/pukarim.ts';
import { createNewGameSave, createNewSave, normalizeSave } from '../src/game/save/saveData.ts';
import { LEGACY_INTRO_V2 } from '../src/game/story/introV2.ts';
import { canChallengePete, hasBeatenPete, PETE_BEATEN_FLAG, PETE_OPPONENT, winPete } from '../src/game/story/pete.ts';

/** ピートとの勝負（2026-10-29 指示書「プカリムの最終」3章）と、相手のチームの入れ替え（4章） */
const PUK = PUKARIM_MONSTER_ID;
const SOR = 'mon-soramo';
const NOB = 'mon-nobiton';

const afterBox = () => {
  const s = createNewGameSave();
  return { ...s, story: { ...s.story, introV2: { ...s.story.introV2, state: 'completed' as const, boosterClaimed: true } } };
};

describe('ピートとの勝負', () => {
  it('管理局で箱を受け取る前は勝負できない。受け取ったあと・前の形式のセーブはできる', () => {
    expect(canChallengePete(createNewGameSave())).toBe(false);
    expect(canChallengePete(afterBox())).toBe(true);
    const legacy = createNewSave();
    expect(canChallengePete({ ...legacy, story: { ...legacy.story, introV2: LEGACY_INTRO_V2 } })).toBe(true);
  });

  it('ピートのデッキはプカリム・ソラモ・ノビトン。強さは大会 E のノエルと同じ', () => {
    expect(PETE_OPPONENT.monsters).toEqual([PUK, SOR, NOB]);
    const noel = getTournament('tournament-e')?.rounds.find((r) => r.id === 'e-1');
    expect(PETE_OPPONENT.lifeScale).toBe(noel?.lifeScale);
  });

  it('初めて勝ったら：プカリムのモンスターカード1枚と、勝った記録（同じ勝ちは2回受け取らない）', () => {
    const r = winPete(afterBox(), 'b1');
    expect(r.first).toBe(true);
    expect(r.cardId).toBe(PUK);
    expect(r.save.collection[PUK]).toBe(1);
    expect(hasBeatenPete(r.save)).toBe(true);
    expect(r.save.storyFlags).toContain(PETE_BEATEN_FLAG);
    const again = winPete(r.save, 'b1');
    expect(again.save).toBe(r.save);
  });

  it('2回目からの勝ち：プカリムの技カード1枚（お金はなし）。モンスターカードは増えない', () => {
    const first = winPete(afterBox(), 'b1').save;
    const r = winPete(first, 'b2', () => 0.5);
    expect(r.first).toBe(false);
    expect(r.cardId).toMatch(/^skl-pukarim-\d\d$/);
    expect(r.save.collection[r.cardId]).toBe((first.collection[r.cardId] ?? 0) + 1);
    expect(r.save.collection[PUK]).toBe(1);
    expect(r.save.coins).toBe(first.coins);
  });

  it('セーブの変換：前のセーブ（記録なし）は「まだ勝っていない」。勝った記録は読み込み直しても残る', () => {
    const old = normalizeSave(JSON.parse(JSON.stringify(createNewSave())));
    if (!old) throw new Error('load');
    expect(hasBeatenPete(old)).toBe(false);
    const won = normalizeSave(JSON.parse(JSON.stringify(winPete(afterBox(), 'b1').save)));
    if (!won) throw new Error('load');
    expect(hasBeatenPete(won)).toBe(true);
  });
});

describe('相手のチームの入れ替え（プカリムを入れる）', () => {
  it('太古の遺跡：バトラー［プカリム・ラズック・ソラモ］［ソラモ・プカリム・ガウル］、番人［プカリム・プカリム・ラズック］', () => {
    expect(runNpcOpponent(0, 0, 'dungeon-01').monsters).toEqual([PUK, 'mon-lazuck', SOR]);
    expect(runNpcOpponent(0, 1, 'dungeon-01').monsters).toEqual([SOR, PUK, 'mon-gauul']);
    expect(runGuardianOpponent(0, 'dungeon-01').monsters).toEqual([PUK, PUK, 'mon-lazuck']);
  });

  it('精霊の森：バトラー［プカリム・ミュロル・ノビトン］［ノビトン・プカリム・ソラモ］、番人［プカリム・ラズック・プカリム］', () => {
    expect(runNpcOpponent(0, 0, 'dungeon-02').monsters).toEqual([PUK, 'mon-myurol', NOB]);
    expect(runNpcOpponent(0, 1, 'dungeon-02').monsters).toEqual([NOB, PUK, SOR]);
    expect(runGuardianOpponent(0, 'dungeon-02').monsters).toEqual([PUK, 'mon-lazuck', PUK]);
  });

  it('大会 E・D の相手', () => {
    const team = (t: string, id: string) => getTournament(t)?.rounds.find((r) => r.id === id)?.monsters;
    expect(team('tournament-e', 'e-1')).toEqual([PUK, SOR, 'mon-myurol']);
    expect(team('tournament-e', 'e-2')).toEqual(['mon-gauul', 'mon-lazuck', PUK]);
    expect(team('tournament-e', 'e-3')).toEqual([SOR, 'mon-myurol', PUK]);
    expect(team('tournament-d', 'd-1')).toEqual(['mon-myurol', 'mon-kalshell', PUK]);
    expect(team('tournament-d', 'd-2')).toEqual([SOR, 'mon-myurol', NOB]);
    expect(team('tournament-d', 'd-3')).toEqual(['mon-gauul', NOB, 'mon-lazuck']);
    expect(getTournament('tournament-c')?.siennaLeft?.with.monsters).toEqual(['mon-gauul', NOB, 'mon-lazuck']);
  });
});
