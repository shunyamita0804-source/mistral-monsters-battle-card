import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WORLD_ART } from '../src/data/worldArt.generated.ts';
import { GACHA } from '../src/data/economy.ts';
import { markGachaShelfOpened, newArrival, purchaseSeriesPack, seedGachaShelf, syncGachaShelf } from '../src/game/economy/gachaSeries.ts';
import { createNewSave, normalizeSave, SAVE_VERSION, type SaveData } from '../src/game/save/saveData.ts';
import { boosterCardCounts, boosterDeck } from '../src/game/story/introV2.ts';

/**
 * 2026-11-02 指示書 AV：カードショップの販売機（7割の大きさ・10体の集合の絵・「新入荷」の札）
 */
const withBox = (extra: Partial<SaveData> = {}): SaveData => {
  const s = createNewSave(new Date('2026-11-02T00:00:00Z'));
  return {
    ...s,
    coins: 5000,
    // 新しく始めて、管理局で旅立ちの箱を受け取った（箱の中身だけを持つ）
    collection: boosterCardCounts('booster-1'),
    deck: boosterDeck('booster-1'),
    story: { ...s.story, introV2: { ...s.story.introV2, state: 'completed', selectedBoosterKey: 'booster-1', boosterClaimed: true, boosterGranted: true, examPassed: true } },
    ...extra,
  };
};
/** ピートに勝ってプカリムを手に入れた（プカリムのシリーズが並ぶ） */
const withPukarim = (s: SaveData): SaveData => ({ ...s, collection: { ...s.collection, 'mon-pukarim': 1 }, storyFlags: [...s.storyFlags, 'pete-beaten'] });

describe('「新入荷」の札（いちばん新しく並んだシリーズ）', () => {
  it('最初から並ぶシリーズしか無いときは、旅立ちの主役（ソラモ）のパックを NEW なしで', () => {
    const r = newArrival(withBox());
    expect(r.series.id).toBe('soramo');
    expect(r.isNew).toBe(false);
  });

  it('新しく並んだシリーズは NEW。そのシリーズのパックを開けると NEW が消え、パックの絵はそのまま', () => {
    const s = syncGachaShelf(withPukarim(withBox()));
    expect(s.gachaShelf.order).toEqual(['pukarim']);
    expect(newArrival(s)).toMatchObject({ series: { id: 'pukarim' }, isNew: true });
    const bought = purchaseSeriesPack(s, 'pukarim', 'tx-av-1', 1);
    expect(bought.status).toBe('ok');
    expect(newArrival(bought.save)).toMatchObject({ series: { id: 'pukarim' }, isNew: false });
    // ほかのシリーズを開けても NEW は消えない
    const other = purchaseSeriesPack(s, 'soramo', 'tx-av-2', 2);
    expect(newArrival(other.save).isNew).toBe(true);
    expect(other.save.coins).toBe(s.coins - GACHA.price);
  });

  it('あとから並んだシリーズが「いちばん新しい」（並んだ順の記録の最後）。道具のパック・最初から並ぶシリーズは記録しない', () => {
    let s = syncGachaShelf(withPukarim(withBox()));
    s = markGachaShelfOpened(s, 'pukarim');
    s = syncGachaShelf({ ...s, collection: { ...s.collection, 'mon-uzurio': 1 } });
    expect(s.gachaShelf.order).toEqual(['pukarim', 'uzurio']);
    expect(newArrival(s)).toMatchObject({ series: { id: 'uzurio' }, isNew: true });
    expect(s.gachaShelf.order).not.toContain('tools');
    expect(s.gachaShelf.order).not.toContain('soramo');
  });

  it('記録の無い前のセーブ（v34）：今並んでいるシリーズの GACHA_SERIES の並びの最後を「いちばん新しい」とし、NEW は付けない', () => {
    const old = withPukarim(withBox({ collection: { ...boosterCardCounts('booster-1'), 'mon-flune': 1 } }));
    const { gachaShelf: _drop, ...raw } = old;
    const loaded = normalizeSave({ ...raw, version: 34 });
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(loaded?.gachaShelf.order).toEqual(['pukarim', 'flune']);
    expect(newArrival(loaded as SaveData)).toMatchObject({ series: { id: 'flune' }, isNew: false });
    // もう一度読みこんでも記録は変わらない（記録がある今の形）
    expect(normalizeSave(JSON.parse(JSON.stringify(loaded)))?.gachaShelf).toEqual(loaded?.gachaShelf);
    expect(seedGachaShelf(withBox()).gachaShelf).toEqual({ order: [], opened: [] });
  });
});

describe('店の中の販売機の絵と置き場', () => {
  const shop = WORLD_ART['shop'];
  it('販売機は前の約7割（絵の 248×380 単位。前は 354×544）。「新入荷」の札を重ねる所（NEW_PLATE）は機械の下の左', () => {
    const machine = shop?.sprites.find((s) => s.file.includes('cardshop_gacha_machine'));
    expect(machine?.h).toBeGreaterThan(544 * 0.65);
    expect(machine?.h).toBeLessThan(544 * 0.75);
    const plate = shop?.slots?.['NEW_PLATE'];
    expect(plate).toBeDefined();
    if (!plate || !machine) return;
    expect(plate.x).toBeGreaterThan(machine.x);
    expect(plate.x + plate.w).toBeLessThan(machine.x + machine.w / 2);
    expect(plate.y).toBeGreaterThan(machine.y + machine.h / 2);
    expect(plate.z).toBeGreaterThan(machine.z ?? 0);
  });

  it('窓の絵は10体の集合の絵（原本は design-parts に手を加えずに保管）。絵の無いシリーズの代わりは 3×2 のまま panel_fallback', () => {
    expect(existsSync('design-parts/av-shop-machine-20261102/panel_shop_group.png')).toBe(true);
    expect(existsSync('assets/images/ui/gacha/panel_shop_group.webp')).toBe(true);
    expect(existsSync('assets/images/ui/gacha/panel_fallback.webp')).toBe(true);
    expect(existsSync('assets/images/ui/gacha/panel_shop.webp')).toBe(false);
    expect(readFileSync('tools/design/cardshop_v2.py', 'utf8')).toContain("'panel_shop_group'");
    expect(readFileSync('src/ui/components/gachaArt.ts', 'utf8')).toContain('panel_fallback.webp');
  });
});
