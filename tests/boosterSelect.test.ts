import { describe, expect, it } from 'vitest';
import { BOOSTERS, BOOSTER_SHOP_PRICE, STARTER_DECKS } from '../src/data/introV2.ts';
import { BUREAU, getMap } from '../src/data/maps.ts';
import { INITIAL_BOOSTER_SELECT, tapBooster } from '../src/game/story/boosterSelect.ts';
import { claimBooster, setIntroV2State, beginExam, finishExam, startIntroV2OnTown } from '../src/game/story/introV2.ts';
import { isNpcPresent } from '../src/game/story/intro.ts';
import { createNewSave, type SaveData } from '../src/game/save/saveData.ts';
import type { NpcObject } from '../src/data/maps.ts';

const D = 450;

describe('ブースターパック3種（2026-10-27 正式の箱）', () => {
  it('左から 旅立ちのきらめき・烈火の猛攻・蒼海の守り。種類と箱のモンスターは指示書のとおり。値段は 1,500G', () => {
    expect(BOOSTERS.map((b) => [b.key, b.name, b.art, b.category])).toEqual([
      ['booster-1', '旅立ちのきらめき', 'booster_tabidachi', 'balance'],
      ['booster-2', '烈火の猛攻', 'booster_rekka', 'attack'],
      ['booster-3', '蒼海の守り', 'booster_soukai', 'defense'],
    ]);
    expect(BOOSTERS.map((b) => b.monsters)).toEqual(STARTER_DECKS.map((d) => d.monsters));
    // 2026-10-28 ユーザー決定：1箱 1,500G
    expect(BOOSTER_SHOP_PRICE).toBe(1500);
  });
});

describe('2回タップで決定', () => {
  it('はじめは何も選んでいない。1回目は仮に選ぶだけ、同じ箱をもう一度で決定', () => {
    let s = INITIAL_BOOSTER_SELECT;
    expect(s).toMatchObject({ selected: null, decided: null });
    s = tapBooster(s, 'booster-1', 1000, D);
    expect(s).toMatchObject({ selected: 'booster-1', decided: null });
    s = tapBooster(s, 'booster-1', 1600, D);
    expect(s.decided).toBe('booster-1');
  });

  it('A→B は B の1回目に切り替わるだけ。A→B→C でも決まらない。A→B→B で B だけ決まる', () => {
    for (const [a, b, c] of [['booster-1', 'booster-2', 'booster-3'], ['booster-3', 'booster-1', 'booster-2'], ['booster-2', 'booster-3', 'booster-1']] as const) {
      let s = tapBooster(INITIAL_BOOSTER_SELECT, a, 0, D);
      s = tapBooster(s, b, 1000, D);
      expect(s).toMatchObject({ selected: b, decided: null });
      const abc = tapBooster(s, c, 2000, D);
      expect(abc.decided).toBeNull();
      s = tapBooster(s, b, 2000, D);
      expect(s.decided).toBe(b);
    }
  });

  it('すばやい連打（説明が見える前の2回目）では決まらない。決まったあとは何も変わらない', () => {
    let s = tapBooster(INITIAL_BOOSTER_SELECT, 'booster-2', 0, D);
    expect(tapBooster(s, 'booster-2', 100, D)).toBe(s);
    s = tapBooster(s, 'booster-2', D, D);
    expect(s.decided).toBe('booster-2');
    expect(tapBooster(s, 'booster-1', 9999, D)).toBe(s);
  });

  it('初期デッキが何でも、3箱のどれでも1回だけ受け取れる', () => {
    for (const d of STARTER_DECKS) {
      for (const b of BOOSTERS) {
        let save: SaveData = createNewSave(new Date(), d.key);
        save = setIntroV2State(finishExam(beginExam(setIntroV2State(startIntroV2OnTown(save), 'schoolArrival')), true), 'packSelection');
        const got = claimBooster(save, b.key, 'tx-1');
        expect(got.story.introV2.selectedBoosterKey).toBe(b.key);
        expect(claimBooster(got, BOOSTERS[0]!.key, 'tx-2')).toBe(got);
      }
    }
  });
});

describe('幼馴染は管理局の中で説明する', () => {
  it('パックを選ぶあいだ、受付の前の主人公の右にいる（主人公と同じマスではない）', () => {
    const guide = BUREAU.objects.find((o): o is NpcObject => o.id === 'guide-bureau');
    if (!guide) throw new Error('guide-bureau');
    const s = createNewSave();
    const at = (state: 'packSelection' | 'completed'): SaveData => ({ ...s, story: { ...s.story, introV2: { ...s.story.introV2, state, examPassed: true, boosterClaimed: state === 'completed', selectedBoosterKey: state === 'completed' ? 'booster-1' : null } } });
    expect(isNpcPresent(at('packSelection'), guide)).toBe(true);
    expect(isNpcPresent(at('completed'), guide)).toBe(false);
    expect(getMap('bureau')).toBe(BUREAU);
  });
});
