import { describe, expect, it } from 'vitest';
import { BOOSTERS, EXAM_OPPONENT, examLifeScale, STARTER_DECKS } from '../src/data/introV2.ts';
import { BUREAU, BUREAU_DESK_FRONT, getMap, PRACTICE, TOWN, type NpcObject } from '../src/data/maps.ts';
import { SCENES } from '../src/data/storyScenes.ts';
import { createStarterDeckFor, isDeckValid } from '../src/game/deck/deck.ts';
import { createNewSave, normalizeSave, SAVE_VERSION, type SaveData } from '../src/game/save/saveData.ts';
import { applySceneEffects, isNpcPresent } from '../src/game/story/intro.ts';
import {
  beginExam,
  claimBooster,
  finishExam,
  isIntroV2Active,
  isIntroV2Done,
  LEGACY_INTRO_V2,
  normalizeIntroV2,
  setIntroV2State,
  skipIntroV2,
  startIntroV2OnTown,
  type IntroV2State,
} from '../src/game/story/introV2.ts';
import { findPathWhere, isBlocked, STEPS_4 } from '../src/game/world/world.ts';
import { t } from '../src/i18n/i18n.ts';

const fresh = (): SaveData => createNewSave(new Date('2026-10-27T00:00:00Z'), 'balance');
const v2 = (save: SaveData): IntroV2State => save.story.introV2.state;
/** 試験に合格したところまで進めたセーブ */
const passed = (): SaveData => finishExam(beginExam(setIntroV2State(startIntroV2OnTown(fresh()), 'schoolArrival')), true);

describe('導入イベントV2：初期デッキ3種', () => {
  it('3種とも、決まったモンスター3体で山札60枚の正しいデッキになり、所持カードで組める', () => {
    expect(STARTER_DECKS.map((d) => d.key)).toEqual(['balance', 'attack', 'defense']);
    for (const d of STARTER_DECKS) {
      const deck = createStarterDeckFor(d.key);
      expect(deck.monsters, d.key).toEqual(d.monsters);
      expect(deck.skills, d.key).toHaveLength(60);
      const save = createNewSave(new Date(), d.key);
      expect(save.deck, d.key).toEqual(deck);
      expect(isDeckValid(save.deck, save.collection), d.key).toBe(true);
      expect(save.story.introV2.selectedStarterDeckKey).toBe(d.key);
    }
  });
});

describe('導入イベントV2：進み具合', () => {
  it('新しいセーブは notStarted。家から街に出ると1回だけ始まる', () => {
    const s0 = fresh();
    expect(v2(s0)).toBe('notStarted');
    expect(isIntroV2Active(s0.story.introV2)).toBe(false);
    const s1 = startIntroV2OnTown(s0);
    expect(v2(s1)).toBe('introGreeting');
    expect(isIntroV2Active(s1.story.introV2)).toBe(true);
    // もう一度街に出ても最初からにはならない
    const s2 = startIntroV2OnTown(setIntroV2State(s1, 'escortToSchool'));
    expect(v2(s2)).toBe('escortToSchool');
  });

  it('勝つ前に試験より先（管理局・パック・完了）へは進めない', () => {
    const s = setIntroV2State(startIntroV2OnTown(fresh()), 'schoolArrival');
    for (const st of ['escortToBureau', 'bureauReception', 'packSelection', 'packClaimed', 'worldBriefing', 'completed'] as const) {
      expect(v2(setIntroV2State(s, st)), st).toBe('schoolArrival');
    }
  });

  it('パックを受け取る前に案内・完了へは進めない', () => {
    const s = setIntroV2State(passed(), 'packSelection');
    expect(v2(setIntroV2State(s, 'worldBriefing'))).toBe('packSelection');
    expect(v2(setIntroV2State(s, 'completed'))).toBe('packSelection');
  });

  it('負けたら教習所の先生の前に戻って再挑戦。負けるたびに先生のライフを少なくする（救済）', () => {
    let s = setIntroV2State(startIntroV2OnTown(fresh()), 'schoolArrival');
    s = beginExam(s);
    expect(v2(s)).toBe('examBattleActive');
    expect(s.story.introV2.examAttempts).toBe(1);
    s = finishExam(s, false);
    expect(v2(s)).toBe('schoolArrival');
    expect(s.story.introV2.examPassed).toBe(false);
    s = finishExam(beginExam(s), false);
    expect(s.story.introV2.examAttempts).toBe(2);
    expect(examLifeScale(1)).toBeGreaterThan(examLifeScale(2));
    expect(examLifeScale(2)).toBeGreaterThan(examLifeScale(3));
    expect(examLifeScale(9)).toBe(examLifeScale(3));
    s = finishExam(beginExam(s), true);
    expect(v2(s)).toBe('examPassed');
    expect(s.story.introV2.examPassed).toBe(true);
    // 合格のあとに結果が来ても変わらない
    expect(finishExam(s, false)).toBe(s);
  });

  it('試験の相手は先生（ふつうの練習試合とは別の相手）', () => {
    expect(EXAM_OPPONENT.id).toBe('exam-teacher');
    expect(EXAM_OPPONENT.face).toBe('teacher');
    expect(EXAM_OPPONENT.monsters).toHaveLength(3);
  });

  it('場面の効果で、幼馴染→教習所→試験→管理局→パック→案内→完了の順に進む', () => {
    let s = startIntroV2OnTown(fresh());
    s = applySceneEffects(s, SCENES.v2Greeting.effects ?? []);
    expect(v2(s)).toBe('escortToSchool');
    s = applySceneEffects(s, SCENES.v2School.onStart ?? []);
    expect(v2(s)).toBe('schoolArrival');
    s = finishExam(beginExam(s), true);
    s = applySceneEffects(s, SCENES.v2Pass.effects ?? []);
    expect(v2(s)).toBe('escortToBureau');
    s = applySceneEffects(s, SCENES.v2Reception.onStart ?? []);
    expect(v2(s)).toBe('bureauReception');
    s = applySceneEffects(s, SCENES.v2Reception.effects ?? []);
    expect(v2(s)).toBe('packSelection');
    s = claimBooster(s, 'booster-2', 'tx-1');
    expect(v2(s)).toBe('packClaimed');
    s = applySceneEffects(s, SCENES.v2Briefing.onStart ?? []);
    expect(v2(s)).toBe('worldBriefing');
    s = applySceneEffects(s, SCENES.v2Briefing.effects ?? []);
    expect(v2(s)).toBe('completed');
    expect(s.story.introV2.tutorialCompleted).toBe(true);
    expect(isIntroV2Done(s.story.introV2)).toBe(true);
  });

  it('導入イベントの会話はスキップのボタンを出さない（断る・飛ばすはない）', () => {
    for (const id of ['v2Greeting', 'v2Walk', 'v2School', 'v2Resume', 'v2Retry', 'v2Pass', 'v2Reception', 'v2Thanks', 'v2Briefing'] as const) {
      expect(SCENES[id].noSkip, id).toBe(true);
    }
  });
});

describe('導入イベントV2：パックの受け取り（1回だけ）', () => {
  it('2回押しても・同じ ID でも・別のパックでも、1回しか受け取れない', () => {
    const s = setIntroV2State(passed(), 'packSelection');
    const a = claimBooster(s, 'booster-1', 'tx-a');
    expect(a.story.introV2).toMatchObject({ boosterClaimed: true, selectedBoosterKey: 'booster-1', boosterClaimId: 'tx-a', state: 'packClaimed' });
    expect(claimBooster(a, 'booster-1', 'tx-a')).toBe(a);
    expect(claimBooster(a, 'booster-3', 'tx-b')).toBe(a);
    // 中身が決まるまでは、カードは配らない（選んだ記録だけ）
    expect(BOOSTERS.every((b) => b.cards === null)).toBe(true);
    expect(a.collection).toEqual(s.collection);
    expect(a.story.introV2.boosterGranted).toBe(false);
  });

  it('アプリを開き直しても（保存して読み直しても）受け取りは1回だけ', () => {
    const a = claimBooster(setIntroV2State(passed(), 'packSelection'), 'booster-2', 'tx-c');
    const reloaded = normalizeSave(JSON.parse(JSON.stringify(a)));
    if (!reloaded) throw new Error('load');
    expect(reloaded.story.introV2.boosterClaimed).toBe(true);
    expect(claimBooster(reloaded, 'booster-1', 'tx-d')).toBe(reloaded);
  });

  it('合格していなければ受け取れない', () => {
    const s = setIntroV2State(startIntroV2OnTown(fresh()), 'schoolArrival');
    expect(claimBooster(s, 'booster-1', 'tx-e')).toBe(s);
  });
});

describe('導入イベントV2：途中で閉じたとき・前のセーブ', () => {
  it('試験の対戦の最中に閉じたら、先生の前（schoolArrival）から', () => {
    const s = beginExam(setIntroV2State(startIntroV2OnTown(fresh()), 'schoolArrival'));
    const loaded = normalizeSave(JSON.parse(JSON.stringify(s)));
    expect(loaded?.story.introV2.state).toBe('schoolArrival');
    expect(loaded?.story.introV2.examAttempts).toBe(1);
  });

  it('記録が食い違っていたら安全な所に戻す（合格なしで試験より先→先生の前／受け取りなしで受け取り後→パックを選ぶ所）', () => {
    expect(normalizeIntroV2({ ...fresh().story.introV2, state: 'packSelection', examPassed: false }).state).toBe('schoolArrival');
    expect(normalizeIntroV2({ ...passed().story.introV2, state: 'completed', boosterClaimed: false }).state).toBe('packSelection');
    expect(normalizeIntroV2({ state: 'xxx' }).state).toBe('legacySkipped');
    expect(normalizeIntroV2(null)).toEqual(LEGACY_INTRO_V2);
  });

  it('前の形式（version 14）のセーブは legacySkipped になり、突然始まらない', () => {
    const { story, ...rest } = createNewSave();
    const old = { ...rest, version: 14, story: { intro: story.intro } };
    const loaded = normalizeSave(old);
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(loaded?.story.introV2.state).toBe('legacySkipped');
    if (loaded) expect(startIntroV2OnTown(loaded)).toBe(loaded);
  });

  it('【仮】チュートリアルスキップ：どこからでも自由行動に（パックは受け取らない）。終わったあとは何もしない', () => {
    const s = skipIntroV2(beginExam(setIntroV2State(startIntroV2OnTown(fresh()), 'schoolArrival')));
    expect(v2(s)).toBe('skipped');
    expect(isIntroV2Done(s.story.introV2)).toBe(true);
    expect(s.story.introV2.boosterClaimed).toBe(false);
    expect(v2(skipIntroV2(fresh()))).toBe('skipped');
    const done = { ...s, story: { ...s.story, introV2: { ...s.story.introV2, state: 'completed' as const } } };
    expect(skipIntroV2(done)).toBe(done);
  });
});

describe('導入イベントV2：地図', () => {
  const guides = [TOWN, PRACTICE, getMap('neighbor')].flatMap((m) => (m ? m.objects.filter((o): o is NpcObject => o.type === 'npc' && o.npcId === 'neighbor_guide') : []));
  const at = (state: IntroV2State): SaveData => {
    const s = fresh();
    return { ...s, story: { ...s.story, introV2: { ...s.story.introV2, state, examPassed: true, boosterClaimed: true, selectedBoosterKey: 'booster-1' } } };
  };

  it('幼馴染は、教習所の中では試験の前後だけいる。街では一緒に歩く絵（地図の人とは別）。終わったら家', () => {
    const shown = (state: IntroV2State): string[] => guides.filter((g) => isNpcPresent(at(state), g)).map((g) => g.id);
    expect(shown('notStarted')).toEqual([]);
    expect(shown('introGreeting')).toEqual([]);
    expect(shown('schoolArrival')).toEqual(['guide-practice']);
    expect(shown('examPassed')).toEqual(['guide-practice']);
    expect(shown('bureauReception')).toEqual([]);
    expect(shown('completed')).toEqual(['guide-home']);
    expect(shown('skipped')).toEqual(['guide-home']);
  });

  it('【仮】管理局：街の入口から受付の前まで歩け、出口から街の入口の前に戻る', () => {
    const door = TOWN.objects.find((o) => o.id === 'door-bureau');
    if (!door || door.type !== 'warp' || door.target.kind !== 'map') throw new Error('door-bureau');
    expect(door.target.mapId).toBe('bureau');
    expect(isBlocked(TOWN, door.x, door.y, () => true)).toBe(false);
    // 教習所の前から管理局の入口まで、上下左右だけで歩ける
    const school = TOWN.objects.find((o) => o.id === 'door-practice');
    if (!school || school.type !== 'warp') throw new Error('door-practice');
    const fromSchool = findPathWhere(TOWN, { x: school.x + 2, y: school.y + 1 }, (x, y) => x === door.x && y === door.y, (x, y) => isBlocked(TOWN, x, y, () => true), 60000, STEPS_4);
    expect(fromSchool).not.toBeNull();
    // 受付の前へ（受付の人のまわり1マスは通れない）
    const clerk = BUREAU.objects.find((o) => o.type === 'npc' && o.npcId === 'bureau_clerk');
    if (!clerk || clerk.type !== 'npc') throw new Error('bureau-clerk');
    const blocked = (x: number, y: number): boolean => isBlocked(BUREAU, x, y, () => true) || Math.max(Math.abs(clerk.x - x), Math.abs(clerk.y - y)) <= 1;
    const toDesk = findPathWhere(BUREAU, BUREAU.spawn, (x, y) => x === BUREAU_DESK_FRONT.x && y === BUREAU_DESK_FRONT.y, blocked, 4000, STEPS_4);
    expect(toDesk).not.toBeNull();
    // 受付と話せる近さ（2マス以内）
    expect(Math.max(Math.abs(clerk.x - BUREAU_DESK_FRONT.x), Math.abs(clerk.y - BUREAU_DESK_FRONT.y))).toBeLessThanOrEqual(2);
    // 出口から街の入口の前へ
    const exit = BUREAU.objects.find((o) => o.id === 'bureau-exit');
    if (!exit || exit.type !== 'warp' || exit.target.kind !== 'map') throw new Error('bureau-exit');
    expect(exit.target).toMatchObject({ mapId: 'town', x: door.x, y: door.y + 1 });
    expect(findPathWhere(BUREAU, BUREAU.spawn, (x, y) => x >= exit.x && x < exit.x + exit.w && y === exit.y, blocked, 4000, STEPS_4)).not.toBeNull();
  });

  it('台詞の表示名は「プロのカードバトラー」「カードバトラー管理局」だけ（ほかの称号を使わない）', () => {
    const texts = Object.values(SCENES)
      .filter((s) => s.id.startsWith('v2'))
      .flatMap((s) => s.steps.flatMap((st) => (st.kind === 'line' ? [t(st.text)] : [])));
    const all = texts.join('\n');
    expect(all).toContain('プロのカードバトラー');
    expect(all).toContain('カードバトラー管理局');
    for (const ng of ['カードマスター', 'カードマイスター', 'マスターランカー', 'カードランカー']) expect(all).not.toContain(ng);
  });
});
