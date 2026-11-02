import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getPerson } from '../src/data/people.ts';
import { LUCIA_BEATEN_FLAG, SERA_BEATEN_FLAG } from '../src/data/dungeons.ts';
import { STORY_EVENTS, storyEventFlag, type StoryEventId } from '../src/data/storyEvents.ts';
import { advanceMonth } from '../src/game/calendar/calendar.ts';
import { claimTournamentRewards, enterTournament, recordMatch } from '../src/game/progress/tournament.ts';
import { createNewSave, FLAG_SIENNA_LEFT, type SaveData } from '../src/game/save/saveData.ts';
import {
  chainedStoryEvent,
  eventText,
  hasSeenStoryEvent,
  lineVisible,
  markStoryEventSeen,
  pendingStoryEvent,
  resolveCards,
  storyEventGoal,
} from '../src/game/story/storyEvents.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/** 指示書 AT（2026-11-02）：序盤〜C大会後のイベント。正本は design-parts/story-events-at-20261102/02_events_scenario_FINAL.md */

const done = (s: SaveData): SaveData => ({ ...s, story: { ...s.story, introV2: { ...s.story.introV2, state: 'completed', boosterClaimed: true, selectedBoosterKey: 'booster-1' } } });
const fresh = (): SaveData => done(createNewSave(new Date('2026-11-02T00:00:00Z')));
const beat = (s: SaveData, ...ids: string[]): SaveData => ({ ...s, dungeons: { ...s.dungeons, ...Object.fromEntries(ids.map((id) => [id, { openedChests: [], bossDefeated: true, clears: 1 }])) } });
const ids = (): string[] => STORY_EVENTS.map((e) => e.id);

describe('イベントのデータ（正本のとおり）', () => {
  it('作るもの：M02〜M19・M21〜M30（M20 は欠番）と任意の O01〜O06・O09〜O11。作らないもの：O07・O08・M20', () => {
    const want: StoryEventId[] = ['M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09', 'M10', 'M11', 'M12', 'M13', 'M14', 'M15', 'M16', 'M17', 'M18', 'M19', 'M21', 'M22', 'M23', 'M24', 'M25', 'M26', 'M27', 'M28', 'M29', 'M30', 'O01', 'O02', 'O03', 'O05', 'O06', 'O09', 'O10'];
    for (const id of want) expect(ids(), id).toContain(id);
    for (const id of ['M00', 'M01', 'M20', 'O07', 'O08']) expect(ids()).not.toContain(id);
    expect(ids().filter((id) => id.startsWith('O11'))).toHaveLength(4);
    expect(new Set(ids()).size).toBe(ids().length);
  });

  it('太古の遺跡・オスカー・石板の場面と、霧の廃坑を開くことは入れない（B ランク用に保留）。広告の話も入れない', () => {
    const text = JSON.stringify(STORY_EVENTS);
    for (const word of ['太古の遺跡', 'オスカー', '石板', 'story_03', 'story_05', '広告']) expect(text, word).not.toContain(word);
    // 霧の廃坑は予告だけ（ルーカスの言い伝えの話）
    expect(text).not.toContain('霧の廃坑');
  });

  it('どの行も日本語と英語がある。話し手は今の人（顔の絵は今の顔の絵）', () => {
    for (const ev of STORY_EVENTS) {
      for (const st of ev.steps) {
        const lines = st.kind === 'line' ? [st.line] : st.kind === 'still' ? st.lines : st.kind === 'choice' ? st.choices.flatMap((c) => c.reply ?? []) : [];
        for (const l of lines) {
          expect(l.text.ja, ev.id).toBeTruthy();
          expect(l.text.en, ev.id).toBeTruthy();
          if (l.speaker !== 'system') expect(getPerson(l.speaker), `${ev.id} ${l.speaker}`).toBeDefined();
        }
      }
    }
  });

  it('守り手の前の場面にはカード・技の絵・パックを出さない（守り手の前の印のあるイベントにカードの場面があれば失敗）', () => {
    const front = STORY_EVENTS.filter((e) => e.guardianFront);
    expect(front.map((e) => e.id).sort()).toEqual(['M10', 'M17', 'M19', 'M24I', 'M25B']);
    for (const ev of front) {
      expect(ev.steps.some((s) => s.kind === 'cards' || s.kind === 'still'), ev.id).toBe(false);
      // 今のせりふだけ（新しいせりふを足さない）
      expect(ev.steps, ev.id).toEqual([]);
    }
    // 守り手の戦う前のせりふは今のもの。ゼフィラの「……あっ、今のなし！」は残っている
    expect(getPerson('zephyra')?.lines?.after?.ja).toContain('今のなし');
    // ダンジョンで守り手と話すときは、切り札（モンスター）の名前も出さない
    expect(readFileSync('src/ui/screens/dungeonRunScreen.ts', 'utf8')).toContain("meet && kind === 'boss'");
  });

  it('カードの見せ方は owned／preview_only／reward の3つだけ。reward は報酬（reward）のきっかけのイベントだけ。新しいカード・お金は渡さない', () => {
    for (const ev of STORY_EVENTS) {
      for (const st of ev.steps) {
        if (st.kind !== 'cards') continue;
        expect(['owned', 'preview_only', 'reward']).toContain(st.show.mode);
        if (st.show.mode === 'reward') expect(ev.trigger, ev.id).toBe('reward');
      }
    }
    expect(STORY_EVENTS.find((e) => e.id === 'M04')?.steps.find((s) => s.kind === 'cards')).toMatchObject({ show: { mode: 'preview_only', cards: ['mon-pukarim'] } });
    expect(STORY_EVENTS.find((e) => e.id === 'M06')?.steps.find((s) => s.kind === 'cards')).toMatchObject({ show: { mode: 'owned' } });
    expect(STORY_EVENTS.find((e) => e.id === 'M11')?.steps.find((s) => s.kind === 'cards')).toMatchObject({ show: { mode: 'reward', cards: ['mon-uzurio'] } });
  });
});

describe('いつ起きるか', () => {
  it('一度見たイベントは自動では二度出ない（印は storyevt:<id>）。印を付けるだけでカード・お金・月は変わらない', () => {
    const s = fresh();
    const ev = pendingStoryEvent(s, 'talk', { npc: 'nina' });
    expect(ev?.id).toBe('M04');
    const seen = markStoryEventSeen(s, 'M04');
    expect(seen.storyFlags).toContain(storyEventFlag('M04'));
    expect(pendingStoryEvent(seen, 'talk', { npc: 'nina' })).toBeNull();
    expect(seen.collection).toEqual(s.collection);
    expect(seen.coins).toBe(s.coins);
    expect(seen.calendar).toEqual(s.calendar);
    expect(markStoryEventSeen(seen, 'M04')).toBe(seen);
  });

  it('preview_only（ニーナ・ピートのプカリム）は持っていなくても見せる。持っている扱い・図鑑・ガチャのシリーズは変えない', () => {
    // 新しく始めたセーブの初期のカードにプカリムが入っていることがあるので、持っていない状態にして確かめる
    const base = fresh();
    const { 'mon-pukarim': _p, ...rest } = base.collection;
    const s = { ...base, collection: rest };
    expect(s.collection['mon-pukarim'] ?? 0).toBe(0);
    expect(resolveCards(s, { mode: 'preview_only', cards: ['mon-pukarim'] })).toEqual(['mon-pukarim']);
    // owned・reward では、持っていないカードは見せない（間違って「持っている」と見せない）
    expect(resolveCards(s, { mode: 'owned', cards: ['mon-pukarim'] })).toEqual([]);
    // 箱を受け取ると3体を持っている（管理局の claimBooster）。持っているカードだけ見せる
    const boxOwned = { ...s, collection: { ...s.collection, 'mon-soramo': 1, 'mon-lilil': 1, 'mon-nobiton': 1 } };
    expect(resolveCards(boxOwned, { mode: 'owned', cards: ['boxMonsters'] })).toEqual(['mon-soramo', 'mon-lilil', 'mon-nobiton']);
    const after = markStoryEventSeen(s, 'M04');
    expect(after.collection['mon-pukarim'] ?? 0).toBe(0);
    expect(after.storyFlags.filter((f) => f.startsWith('gacha-seen-'))).toEqual(s.storyFlags.filter((f) => f.startsWith('gacha-seen-')));
  });

  it('M03：導入が終わった直後（E ランク・風の渓谷をまだ越えていない）。目標「風の渓谷を探検しよう」は見たあと、越えるまで', () => {
    const s = fresh();
    expect(pendingStoryEvent(s, 'introDone')?.id).toBe('M03');
    expect(storyEventGoal(s)).toBeNull();
    const seen = markStoryEventSeen(s, 'M03');
    expect(storyEventGoal(seen)?.ja).toContain('風の渓谷');
    expect(storyEventGoal(beat(seen, 'dungeon-08'))).toBeNull();
    expect(pendingStoryEvent(beat(s, 'dungeon-08'), 'introDone')).toBeNull();
    // 導入の最中は出さない
    const mid = { ...s, story: { ...s.story, introV2: { ...s.story.introV2, state: 'packSelection' as const } } };
    expect(pendingStoryEvent(mid, 'introDone')).toBeNull();
  });

  it('せりふの月・条件はデータから（数字を焼きこまない）', () => {
    const s = fresh();
    const m03 = STORY_EVENTS.find((e) => e.id === 'M03');
    const line = m03?.steps.find((st) => st.kind === 'line' && st.line.text.ja.includes('{nextMonth}'));
    if (!line || line.kind !== 'line') throw new Error('line');
    expect(eventText(line.line.text, s)).toContain('6月');
    expect(eventText(line.line.text, { ...s, calendar: { year: 1, month: 7 } })).toContain('9月');
    const celia = STORY_EVENTS.find((e) => e.id === 'M07')?.steps.at(-1);
    if (!celia || celia.kind !== 'line') throw new Error('celia');
    expect(eventText(celia.line.text, s)).toContain('ゼフィラ（風の渓谷）');
    setLanguage('en');
    try {
      expect(eventText(line.line.text, s)).toContain('June');
    } finally {
      setLanguage('ja');
    }
  });

  it('ダンジョンに初めて入ったとき：風の渓谷 M09・水の神殿 M16・精霊の森 M18・氷の洞窟 M24・炎の火山 M25', () => {
    const s = fresh();
    expect(pendingStoryEvent(s, 'dungeonEnter', { dungeon: 'dungeon-08' })?.id).toBe('M09');
    expect(pendingStoryEvent(s, 'dungeonEnter', { dungeon: 'dungeon-03' })?.id).toBe('M16');
    expect(pendingStoryEvent(s, 'dungeonEnter', { dungeon: 'dungeon-02' })?.id).toBe('M18');
    expect(pendingStoryEvent(s, 'dungeonEnter', { dungeon: 'dungeon-04' })?.id).toBe('M24');
    expect(pendingStoryEvent(s, 'dungeonEnter', { dungeon: 'dungeon-05' })?.id).toBe('M25');
    expect(pendingStoryEvent(s, 'dungeonEnter', { dungeon: 'dungeon-01' })).toBeNull();
  });

  it('切り札のカードの reward は、今の報酬の処理で受け取ったとき（初めてのクリア）だけ', () => {
    const s = fresh();
    expect(pendingStoryEvent(s, 'reward', { dungeon: 'dungeon-08', firstClear: true })?.id).toBe('M11');
    expect(pendingStoryEvent(s, 'reward', { dungeon: 'dungeon-08', firstClear: false })).toBeNull();
    expect(pendingStoryEvent(s, 'reward', { dungeon: 'dungeon-02', firstClear: true })?.id).toBe('M19R');
  });

  it('M21：ルシアとセラのどちらを先に倒しても、両方に勝ったあと街に戻ったとき', () => {
    const d = { ...fresh(), rank: 'D' as const };
    expect(pendingStoryEvent(beat(d, 'dungeon-03'), 'townEnter')?.id).not.toBe('M21');
    expect(pendingStoryEvent(beat(d, 'dungeon-03', 'dungeon-02'), 'townEnter')?.id).toBe('M21');
    expect(pendingStoryEvent({ ...d, storyFlags: [SERA_BEATEN_FLAG, LUCIA_BEATEN_FLAG] }, 'townEnter')?.id).toBe('M21');
  });

  it('街に入ったときに重なったら M28 → M21 → M11T の順に1つずつ（同じ入場で1つ）', () => {
    let s: SaveData = { ...beat(fresh(), 'dungeon-08', 'dungeon-03', 'dungeon-02'), storyFlags: [FLAG_SIENNA_LEFT] };
    // M11T は E のときだけ。ここは E のまま（重なりを作る）
    const order: string[] = [];
    for (let i = 0; i < 5; i++) {
      const ev = pendingStoryEvent(s, 'townEnter');
      if (!ev) break;
      order.push(ev.id);
      s = markStoryEventSeen(s, ev.id);
    }
    expect(order).toEqual(['M28', 'M21', 'M11T']);
  });

  it('E 大会：エントリーで M13（シエナとの出会い・挿絵 story_01）、終わったら M14（勝ち負けで分ける）', () => {
    const s = fresh();
    expect(pendingStoryEvent(s, 'tournamentEntry', { rank: 'E' })?.id).toBe('M13');
    const m14 = pendingStoryEvent(s, 'tournamentEnd', { rank: 'E', won: false });
    expect(m14?.id).toBe('M14');
    const visible = (won: boolean): string[] => (m14?.steps ?? []).flatMap((st) => (st.kind === 'line' && lineVisible(st.line, { won }, s) ? [st.line.text.ja] : []));
    expect(visible(false).some((l) => l.includes('お疲れさま'))).toBe(true);
    expect(visible(false).some((l) => l.includes('優勝なんて'))).toBe(false);
    expect(visible(true).some((l) => l.includes('Dランクだね'))).toBe(true);
    expect(pendingStoryEvent(s, 'tournamentEntry', { rank: 'D' })?.id).toBe('M22');
  });

  it('C 大会：M26 は siennaLeft の前だけ。M27 は決勝の相手が実際にシエナのときだけ。終わったら（勝ち負け問わず）siennaLeft → M28 → M29（ルーカス）→ M30', () => {
    const c = { ...fresh(), rank: 'C' as const };
    expect(pendingStoryEvent(c, 'tournamentEntry', { rank: 'C' })?.id).toBe('M26');
    expect(pendingStoryEvent({ ...c, storyFlags: [FLAG_SIENNA_LEFT] }, 'tournamentEntry', { rank: 'C' })).toBeNull();
    expect(pendingStoryEvent(c, 'final', { rank: 'C', opponent: 'sienna' })?.id).toBe('M27');
    expect(pendingStoryEvent(c, 'final', { rank: 'C', opponent: 'gordon' })).toBeNull();
    // 実際の大会：C 大会が終わると siennaLeft（今の付き方のまま）
    let s: SaveData = { ...beat(c, 'dungeon-04', 'dungeon-05'), calendar: { year: 1, month: 9 } };
    s = enterTournament(s, 'tournament-c', 'c-1', 3);
    s = recordMatch(s, 0, { won: false, remaining: 0, damage: 0 } as never);
    const claimed = claimTournamentRewards(s);
    if (claimed.status !== 'ok') throw new Error('claim');
    s = claimed.save;
    expect(s.storyFlags).toContain(FLAG_SIENNA_LEFT);
    const m28 = pendingStoryEvent(s, 'townEnter', { earlyLoss: true });
    expect(m28?.id).toBe('M28');
    expect(m28?.steps.some((st) => st.kind === 'line' && st.line.when === 'earlyLoss' && lineVisible(st.line, { earlyLoss: true }, s))).toBe(true);
    expect(pendingStoryEvent(s, 'talk', { npc: 'lucas' })?.id).not.toBe('M29');
    s = markStoryEventSeen(s, 'M28');
    expect(pendingStoryEvent(s, 'talk', { npc: 'lucas' })?.id).toBe('M29');
    s = markStoryEventSeen(s, 'M29');
    expect(chainedStoryEvent(s, 'M29')?.id).toBe('M30');
    // M28 のあと、シエナの出る新しいイベント（M26）は起きない
    expect(pendingStoryEvent(s, 'tournamentEntry', { rank: 'C' })).toBeNull();
  });

  it('任意のイベントを見なくても進める（イベントは何も止めない）。イベントだけで月は進まない', () => {
    const s = fresh();
    const next = advanceMonth(s);
    expect(next.calendar.month).toBe(5);
    for (const ev of STORY_EVENTS) expect(markStoryEventSeen(s, ev.id).calendar).toEqual(s.calendar);
    expect(hasSeenStoryEvent(s, 'M04')).toBe(false);
  });

  it('ピート：M05 は勝つ前（今の対戦の前）、M05W は初めて勝ったあと。報酬は今のまま', () => {
    const s = fresh();
    expect(pendingStoryEvent(s, 'talk', { npc: 'pete' })?.id).toBe('M05');
    const won = { ...s, storyFlags: [...s.storyFlags, 'pete-beaten'] };
    expect(pendingStoryEvent(won, 'talk', { npc: 'pete' })).toBeNull();
    expect(chainedStoryEvent(won, 'M05')?.id).toBe('M05W');
  });

  it('ルーカス：M06 → O05（持っている技カードがあるとき）。M29 があれば M29 が先', () => {
    const s = fresh();
    expect(pendingStoryEvent(s, 'talk', { npc: 'lucas' })?.id).toBe('M06');
    const after = markStoryEventSeen(s, 'M06');
    expect(pendingStoryEvent(after, 'talk', { npc: 'lucas' })?.id).toBe('O05');
    expect(resolveCards(after, { mode: 'owned', cards: ['ownedSkill'] })).toHaveLength(1);
    const m28 = markStoryEventSeen({ ...after, storyFlags: [...after.storyFlags, FLAG_SIENNA_LEFT] }, 'M28');
    expect(pendingStoryEvent(m28, 'talk', { npc: 'lucas' })?.id).toBe('M29');
  });

  it('マルタ（O01）の森のせりふは、精霊の森（セラ）を越えたあとだけ', () => {
    const s = fresh();
    const o01 = pendingStoryEvent(s, 'talk', { npc: 'martha' });
    expect(o01?.id).toBe('O01');
    const forest = (o01?.steps ?? []).find((st) => st.kind === 'line' && st.line.when === 'forestCleared');
    if (!forest || forest.kind !== 'line') throw new Error('forest');
    expect(lineVisible(forest.line, {}, s)).toBe(false);
    expect(lineVisible(forest.line, {}, beat(s, 'dungeon-02'))).toBe(true);
  });
});

describe('画面・挿絵', () => {
  it('挿絵は design-parts/story-stills-20261030/ の 01・02・04 を WebP にしたもの。story_02 は字を上に寄せる', () => {
    for (const n of ['01_meet_sienna', '02_silver_clasp', '04_final_sienna']) expect(readFileSync(`assets/images/backgrounds/story_${n}.webp`).length).toBeGreaterThan(1000);
    const m21 = STORY_EVENTS.find((e) => e.id === 'M21')?.steps.find((s) => s.kind === 'still');
    expect(m21).toMatchObject({ still: 'story_02_silver_clasp', textTop: true });
    expect(readFileSync('src/ui/styles/storyEvents.css', 'utf8')).toContain('.story-still--top .story-still__text');
  });

  it('確かめ用の入口（?qa=1&lab=events）は ?qa=1 のときだけ', async () => {
    const { initialScreen } = await import('../src/ui/app.ts');
    expect(initialScreen(true, '?qa=1&lab=events')).toBe('storyEventLab');
    expect(initialScreen(false, '?lab=events')).not.toBe('storyEventLab');
  });
});
