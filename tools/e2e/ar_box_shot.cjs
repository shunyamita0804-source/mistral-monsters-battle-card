// 指示書 AR（2026-11-02）最初の3箱の箱絵の写真。開発用サーバー（npx vite）で動かす。
// 撮るもの：管理局で箱を選ぶ画面（3箱）・箱を選んだ所・受け取った所（箱を開ける演出の始まり）・カードショップのカウンターの箱の棚と買うときの確かめ
// 使い方: node tools/e2e/ar_box_shot.cjs http://127.0.0.1:5173/ 出力フォルダ
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = 390;
const H = 844;
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: 'ja', seVolume: 0, bgmVolume: 0, muted: true }));
  });
  let page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };

  // 1. 管理局で箱を選ぶ（指示書 AL の写真と同じ入り方）
  await page.goto(base);
  await page.waitForTimeout(800);
  const json = await page.evaluate(async () => {
    const { createNewGameSave } = await import('/src/game/save/saveData.ts');
    const s = createNewGameSave(new Date(2026, 10, 2));
    const save = { ...s, player: { gender: 'male', name: 'テスト' }, location: { mapId: 'bureau', x: 16, y: 19, dir: 'left' }, story: { ...s.story, introV2: { ...s.story.introV2, state: 'packSelection', examPassed: true } } };
    return JSON.stringify(save);
  });
  await page.close();
  page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, json);
  await page.goto(base);
  await page.waitForTimeout(1000);
  await page.locator('text=続きから').first().click();
  if (await page.waitForSelector('.booster-select__box', { timeout: 15000 }).then(() => true).catch(() => false)) {
    await page.waitForTimeout(1200);
    await shot('box_select');
    for (const [i, n] of [[0, 'tabidachi'], [1, 'rekka'], [2, 'soukai']]) {
      await page.locator('.booster-select__box').nth(i).click();
      await page.waitForTimeout(700);
      await shot(`box_select_${n}`);
    }
    await page.locator('.booster-select__box').nth(2).click();
    await page.waitForSelector('.modal', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(300);
    await shot('box_got_0');
    await page.waitForTimeout(900);
    await shot('box_got_1');
  } else console.log('no booster select');

  // 2. カードショップのカウンター：旅立ちを選んだセーブ（烈火・蒼海が棚に並ぶ）
  await page.goto(base);
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    const { createNewSave } = await import('/src/game/save/saveData.ts');
    const s = createNewSave(new Date(2026, 10, 2));
    const story = { ...s.story, introV2: { ...s.story.introV2, state: 'completed', selectedBoosterKey: 'booster-1', boosterClaimed: true, boosterGranted: true, examPassed: true } };
    localStorage.setItem('mistria-battle-card/save', JSON.stringify({ ...s, player: { gender: 'male', name: 'テスト' }, coins: 5000, story }));
    const { GameStore } = await import('/src/ui/gameStore.ts');
    const { SCREENS } = await import('/src/ui/screens/registry.ts');
    const { mountStage } = await import('/src/ui/stage.ts');
    const store = GameStore.fromBrowser();
    const stage = mountStage(document.querySelector('#app'), { qa: false });
    const noop = () => {};
    const view = SCREENS.shopMenu.create({ navigate: noop, back: noop, reset: noop, store });
    stage.element.dataset.screen = 'shopMenu';
    stage.element.replaceChildren(view.element);
  });
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
  await page.waitForTimeout(1200);
  await page.locator('button:has-text("カードを買う")').first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.locator('.shop-boosters').scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await shot('shop_counter');
  await page.locator('.shop-boosters__item button').first().click().catch(() => {});
  await page.waitForTimeout(900);
  await shot('shop_confirm');
  await browser.close();
})();
