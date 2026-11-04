import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getPerson } from '../src/data/people.ts';
import { getStoryEvent, SQUARE_PICTURES, STORY_EVENTS, storyEventFlag, type EventStep, type StoryEventId } from '../src/data/storyEvents.ts';
import { createNewSave, FLAG_SIENNA_LEFT, type SaveData } from '../src/game/save/saveData.ts';
import { markStoryEventSeen, pendingStoryEvent, reviewableStoryEvents, siennaPresent } from '../src/game/story/storyEvents.ts';

/** 2026-11-05 指示書 AX【4】イベント第2弾12本・【5】説明の絵4枚 */

const done = (s: SaveData): SaveData => ({ ...s, story: { ...s.story, introV2: { ...s.story.introV2, state: 'completed', boosterClaimed: true, selectedBoosterKey: 'booster-1' } } });
const fresh = (): SaveData => done(createNewSave(new Date('2026-11-05T00:00:00Z')));
const seen = (s: SaveData, ...ids: StoryEventId[]): SaveData => ids.reduce((acc, id) => markStoryEventSeen(acc, id), s);
const EV2 = STORY_EVENTS.filter((e) => e.batch === 2);
const linesOf = (steps: readonly EventStep[]) =>
  steps.flatMap((st) => (st.kind === 'line' ? [st.line] : st.kind === 'choice' ? st.choices.flatMap((c) => c.reply ?? []) : []));

describe('イベント第2弾：データ', () => {
  it('12本（シエナ S01〜S04・町の人 N01〜N08）。どれも任意で、カードを見せない・渡さない', () => {
    expect(EV2.map((e) => e.id).sort()).toEqual(['EV2_N01', 'EV2_N02', 'EV2_N03', 'EV2_N04', 'EV2_N05', 'EV2_N06', 'EV2_N07', 'EV2_N08', 'EV2_S01', 'EV2_S02', 'EV2_S03', 'EV2_S04']);
    for (const ev of EV2) {
      expect(ev.kind, ev.id).toBe('optional');
      expect(ev.steps.some((st) => st.kind === 'cards' || st.kind === 'map' || st.kind === 'objective'), ev.id).toBe(false);
      // 選択肢は返事だけ（画面を開く・バトルを始めるなどの action は無い）
      for (const st of ev.steps) if (st.kind === 'choice') for (const c of st.choices) expect(c.action, ev.id).toBeUndefined();
      for (const l of linesOf(ev.steps)) {
        expect(l.text.ja && l.text.en, ev.id).toBeTruthy();
        if (l.speaker !== 'system') expect(getPerson(l.speaker), ev.id).toBeDefined();
      }
    }
  });

  it('シエナは大会会場に入ったとき、町の人はその人に話しかけたとき', () => {
    for (const id of ['EV2_S01', 'EV2_S02', 'EV2_S03', 'EV2_S04'] as const) expect(getStoryEvent(id).trigger).toBe('hallEnter');
    const npc: Record<string, string> = { EV2_N01: 'mireille', EV2_N02: 'nina', EV2_N03: 'pete', EV2_N04: 'lucas', EV2_N05: 'gareth', EV2_N06: 'celia', EV2_N07: 'martha', EV2_N08: 'rosalie' };
    for (const [id, who] of Object.entries(npc)) {
      const ev = getStoryEvent(id as StoryEventId);
      expect(ev.trigger, id).toBe('talk');
      expect(ev.npc, id).toBe(who);
    }
  });

  it('台本の直し：S01 はプレイヤーがしていないことを言わない・S02 の2行目は差し替え', () => {
    const s01 = JSON.stringify(getStoryEvent('EV2_S01'));
    expect(s01).toContain('この前の大会、最後まで見ていたよ。');
    expect(s01).toContain('どのカードを使って、どのカードを残すか。そこに、その人らしさが出ると思うんだ。');
    expect(s01).not.toContain('手札を一枚だけ残して');
    expect(s01).toContain('考えたこともなかった');
    const s02 = JSON.stringify(getStoryEvent('EV2_S02'));
    expect(s02).toContain('港町と山の町じゃ、好きなモンスターも、大会の空気も、ぜんぜん違うの。');
    expect(s02).not.toContain('同じ聖獣の絵でも');
  });

  it('小挿絵は7本（S01・S02・S04・N02・N03・N07・N08）。シエナの会話の絵は4本・ミレイユは今の会話の絵', () => {
    const withPicture = EV2.filter((e) => e.picture).map((e) => e.id).sort();
    expect(withPicture).toEqual(['EV2_N02', 'EV2_N03', 'EV2_N07', 'EV2_N08', 'EV2_S01', 'EV2_S02', 'EV2_S04']);
    expect(['EV2_S01', 'EV2_S02', 'EV2_S03', 'EV2_S04'].map((id) => getStoryEvent(id as StoryEventId).face)).toEqual(['sienna_smile', 'sienna_happy', 'sienna_normal', 'sienna_worried']);
    expect(getStoryEvent('EV2_N01').face).toBe('mireille_smile');
    for (const ev of EV2) if (ev.picture) expect(existsSync(`assets/images/backgrounds/event_${ev.picture}.webp`), ev.id).toBe(true);
    for (const f of ['smile', 'happy', 'normal', 'worried']) expect(existsSync(`assets/images/characters/talk_sienna_${f}.webp`)).toBe(true);
  });
});

describe('イベント第2弾：起きる条件', () => {
  it('シエナ S01：M13・M14 を見たあと、大会会場に入ったとき（1回だけ）', () => {
    let s = fresh();
    expect(pendingStoryEvent(s, 'hallEnter')).toBeNull();
    s = seen(s, 'M13');
    expect(pendingStoryEvent(s, 'hallEnter')).toBeNull();
    s = seen(s, 'M14');
    expect(pendingStoryEvent(s, 'hallEnter')?.id).toBe('EV2_S01');
    s = markStoryEventSeen(s, 'EV2_S01');
    expect(pendingStoryEvent(s, 'hallEnter')).toBeNull();
  });

  it('S02（M15 のあと・M22 の前）・S03（M22 のあと・C ランク・M26 の前）・S04（M23 のあと・M26 の前）。1回の入場で1つ', () => {
    let s = seen(fresh(), 'M13', 'M14', 'EV2_S01', 'M15');
    expect(pendingStoryEvent(s, 'hallEnter')?.id).toBe('EV2_S02');
    expect(pendingStoryEvent(seen(s, 'M22'), 'hallEnter')).toBeNull();
    s = { ...seen(s, 'M22'), rank: 'C' };
    expect(pendingStoryEvent(s, 'hallEnter')?.id).toBe('EV2_S03');
    s = seen(s, 'M23');
    // S03 と S04 が両方起きうるときは S03 が先（1つだけ）
    expect(pendingStoryEvent(s, 'hallEnter')?.id).toBe('EV2_S03');
    s = markStoryEventSeen(s, 'EV2_S03');
    expect(pendingStoryEvent(s, 'hallEnter')?.id).toBe('EV2_S04');
    expect(pendingStoryEvent(seen(s, 'M26'), 'hallEnter')).toBeNull();
  });

  it('シエナがいなくなったあと（siennaLeft・M28 を見た・C 大会の決着の記録）は、前のセーブで見ていない分も出さない', () => {
    const ready = { ...seen(fresh(), 'M13', 'M14', 'M15', 'M22', 'M23'), rank: 'C' as const };
    expect(pendingStoryEvent(ready, 'hallEnter')?.id).toBe('EV2_S01');
    expect(siennaPresent(ready)).toBe(true);
    const left = { ...ready, storyFlags: [...ready.storyFlags, FLAG_SIENNA_LEFT] };
    const m28 = markStoryEventSeen(ready, 'M28');
    const cDone = { ...ready, tournaments: { ...ready.tournaments, 'tournament-c': { entries: 1, wins: 0 } as never } };
    for (const s of [left, m28, cDone]) {
      expect(siennaPresent(s)).toBe(false);
      expect(pendingStoryEvent(s, 'hallEnter')).toBeNull();
    }
  });

  it('大会の途中（受付から決着まで）は、会場に入ってもシエナの話は出さない', () => {
    const s = seen(fresh(), 'M13', 'M14');
    expect(pendingStoryEvent({ ...s, activeTournament: {} as never }, 'hallEnter')).toBeNull();
  });

  it('町の人：前のイベントを見たあと、その人に次に話しかけたとき1回だけ。前のイベントが残っていれば前のほうが先', () => {
    let s = fresh();
    // ニーナ：M04 → N02
    expect(pendingStoryEvent(s, 'talk', { npc: 'nina' })?.id).toBe('M04');
    s = markStoryEventSeen(s, 'M04');
    expect(pendingStoryEvent(s, 'talk', { npc: 'nina' })?.id).toBe('EV2_N02');
    s = markStoryEventSeen(s, 'EV2_N02');
    expect(pendingStoryEvent(s, 'talk', { npc: 'nina' })).toBeNull();
    // マルタ：O01 → N07、ロザリー：O02 → N08、ガレス：O06 → N05
    expect(pendingStoryEvent(seen(fresh(), 'O01'), 'talk', { npc: 'martha' })?.id).toBe('EV2_N07');
    expect(pendingStoryEvent(seen(fresh(), 'O02'), 'talk', { npc: 'rosalie' })?.id).toBe('EV2_N08');
    expect(pendingStoryEvent(seen(fresh(), 'O06'), 'talk', { npc: 'gareth' })?.id).toBe('EV2_N05');
    expect(pendingStoryEvent(fresh(), 'talk', { npc: 'gareth' })).toBeNull();
    // ピート：M05W のあと
    expect(pendingStoryEvent(seen(fresh(), 'M05', 'M05W'), 'talk', { npc: 'pete' })?.id).toBe('EV2_N03');
    // セリア：M07 と M14 のあと
    expect(pendingStoryEvent(seen(fresh(), 'M07'), 'talk', { npc: 'celia' })).toBeNull();
    expect(pendingStoryEvent(seen(fresh(), 'M07', 'M14'), 'talk', { npc: 'celia' })?.id).toBe('EV2_N06');
  });

  it('ミレイユ N01 は M03 のあと・M11T の前。ルーカス N04 は M06・O05 のあと・D ランク以上', () => {
    expect(pendingStoryEvent(seen(fresh(), 'M03'), 'talk', { npc: 'mireille' })?.id).toBe('EV2_N01');
    expect(pendingStoryEvent(seen(fresh(), 'M03', 'M11T'), 'talk', { npc: 'mireille' })).toBeNull();
    const lucas = seen(fresh(), 'M06', 'O05');
    expect(pendingStoryEvent(lucas, 'talk', { npc: 'lucas' })).toBeNull();
    expect(pendingStoryEvent({ ...lucas, rank: 'D' }, 'talk', { npc: 'lucas' })?.id).toBe('EV2_N04');
  });

  it('研究所の「記録をふり返る」：見た第2弾だけ。見直してもセーブは変わらない（関数は読むだけ）', () => {
    const s = seen(fresh(), 'M04', 'EV2_N02', 'EV2_S01');
    expect(reviewableStoryEvents(s).map((e) => e.id)).toEqual(['EV2_S01', 'EV2_N02']);
    expect(reviewableStoryEvents(fresh())).toEqual([]);
    expect(s.storyFlags).toContain(storyEventFlag('EV2_N02'));
  });
});

describe('説明の絵（指示書 AX【5】）', () => {
  const pictureOf = (id: StoryEventId) => getStoryEvent(id).steps.flatMap((st) => (st.kind === 'line' && st.line.picture ? [{ pic: st.line.picture, text: st.line.text.ja }] : st.kind === 'figure' ? [{ pic: st.picture, text: '' }] : []));
  it('O04・M09・M12 は絵つきの新しい1行、M07 は絵だけ。4枚とも正方形・WebP がある', () => {
    expect(pictureOf('O04')).toEqual([{ pic: 'tutorial_shop_and_packs', text: 'パックを開けると、新しいモンスターや技のカードが手に入りますよ。' }]);
    expect(pictureOf('M09')).toEqual([{ pic: 'tutorial_dungeon_overview', text: '新しいダンジョンは、進むにつれて開きます。どこが開いているかは、世界地図で確かめましょう。' }]);
    expect(pictureOf('M07')).toEqual([{ pic: 'tutorial_tournament_overview', text: '' }]);
    expect(pictureOf('M12')).toEqual([{ pic: 'tutorial_bureau_board', text: 'どこへ行くか迷ったときは、まず掲示板を見てみましょう。' }]);
    for (const p of SQUARE_PICTURES) expect(existsSync(`assets/images/backgrounds/${p}.webp`), p).toBe(true);
  });

  it('入れる位置：O04 は1行目のあと・M09 は2行目のあと・M07 は形式の説明のあと・M12 は1行目のあと', () => {
    const idx = (id: StoryEventId): number => getStoryEvent(id).steps.findIndex((st) => (st.kind === 'line' && !!st.line.picture) || st.kind === 'figure');
    expect(idx('O04')).toBe(1);
    expect(idx('M09')).toBe(2);
    expect(idx('M12')).toBe(1);
    const m07 = getStoryEvent('M07').steps;
    const before = m07[idx('M07') - 1];
    expect(before?.kind === 'line' && before.line.text.ja).toBe('Cランクからは8人のトーナメントです。');
  });

  it('原本は design-parts/ax-events-20261105/ に無改変（小挿絵7・説明の絵4）', () => {
    for (const ev of EV2) if (ev.picture) expect(existsSync(`design-parts/ax-events-20261105/small/event_small_${ev.picture}.png`), ev.id).toBe(true);
    for (const p of SQUARE_PICTURES) expect(existsSync(`design-parts/ax-events-20261105/tutorial/${p}.png`), p).toBe(true);
    expect(readFileSync('design-parts/ax-events-20261105/event_batch02_scripts.md', 'utf8')).toContain('EV2_S01');
  });
});
