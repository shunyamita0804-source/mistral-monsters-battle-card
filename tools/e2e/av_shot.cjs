// 2026-11-02 指示書 AV：カードショップの販売機（大きさ・窓の集合の絵・「新入荷」の札）の写真。開発用サーバーで動かす。
// 使い方: node tools/e2e/av_shot.cjs URL 出力フォルダ 前につける名前（W・H で画面の大きさ。ふだんは 390×844）
//   shop_overview：店の真ん中から販売機の方を見る／machine：販売機の前（機械のアップは切り抜き）
//   NEW の札：new＝プカリムが並んだばかり（まだ開けていない）・opened＝プカリムを開けたあと・start＝最初から並ぶシリーズだけ（ソラモ）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, outDir, prefix = ''] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const size = `_${W}x${H}`;
fs.mkdirSync(outDir, { recursive: true });

async function open(browser, location, shelf) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: 'ja', seVolume: 0, bgmVolume: 0, muted: true }));
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(800);
  await page.evaluate(async ([location, shelf]) => {
    const { createNewSave } = await import('/src/game/save/saveData.ts');
    const { STORY_EVENTS, storyEventFlag } = await import('/src/data/storyEvents.ts');
    const { boosterDeck, boosterCardCounts } = await import('/src/game/story/introV2.ts');
    const s0 = createNewSave(new Date(2026, 10, 2));
    const key = 'booster-1';
    const story = { ...s0.story, introV2: { ...s0.story.introV2, state: 'completed', selectedBoosterKey: key, boosterClaimed: true, boosterGranted: true, examPassed: true } };
    const collection = { ...boosterCardCounts(key) };
    // new・opened：ピートに勝ってプカリムを手に入れた（プカリムのシリーズが並ぶ）
    if (shelf !== 'start') collection['mon-pukarim'] = 1;
    const save = {
      ...s0,
      player: { gender: 'male', name: 'テスト' },
      coins: 5000,
      story,
      deck: boosterDeck(key),
      collection,
      storyFlags: [...s0.storyFlags, ...STORY_EVENTS.map((e) => storyEventFlag(e.id)), ...(shelf !== 'start' ? ['pete-beaten'] : [])],
      location,
      gachaShelf: shelf === 'opened' ? { order: ['pukarim'], opened: ['pukarim'] } : { order: [], opened: [] },
    };
    localStorage.setItem('mistria-battle-card/save', JSON.stringify(save));
  }, [location, shelf]);
  await page.goto(base + '?qa=1');
  await page.addStyleTag({ content: '.stage-diag{display:none!important} .world__hint{display:none!important}' }).catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('text=続きから').first().click();
  await page.waitForTimeout(2800);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();
  for (const shelf of ['new', 'opened', 'start']) {
    // 店の真ん中（販売機・棚・カウンターが入る）
    {
      const { ctx, page } = await open(browser, { mapId: 'shop', x: 38, y: 24, dir: 'up' }, shelf);
      await page.screenshot({ path: `${outDir}/${prefix}shop_${shelf}${size}.png` });
      await ctx.close();
    }
    // 販売機の右前（上を向く。札が主人公にかくれない）と、機械のアップ（機械の絵の範囲を切り抜く）
    {
      const { ctx, page } = await open(browser, { mapId: 'shop', x: 48, y: 21, dir: 'up' }, shelf);
      await page.screenshot({ path: `${outDir}/${prefix}machine_${shelf}${size}.png` });
      const box = await page.evaluate(() => {
        const img = [...document.querySelectorAll('img.world__furniture')].find((i) => i.src.includes('cardshop_gacha_machine'));
        const r = img?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
      });
      if (box) {
        const pad = 12;
        const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad - 20), width: Math.min(W - Math.max(0, box.x - pad), box.width + pad * 2), height: Math.min(H, box.height + pad * 2 + 20) };
        await page.screenshot({ path: `${outDir}/${prefix}machine_zoom_${shelf}${size}.png`, clip });
      }
      await ctx.close();
    }
  }
  await browser.close();
})();
