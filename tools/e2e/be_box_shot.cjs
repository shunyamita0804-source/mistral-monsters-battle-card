// 2026-11-05 指示書 BE：箱を選ぶ画面・箱を開けた画面（英語の箱の絵・箱の英語名）の写真。開発用サーバーで動かす。
// 使い方: node tools/e2e/be_box_shot.cjs URL 出力フォルダ（LANG=en|ja、W・H で画面の大きさ、BOX=0|1|2 で開ける箱）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const BOX = +(process.env.BOX || 0);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((l) => localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: l, seVolume: 0, bgmVolume: 0, muted: true })), LANG);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(800);
  const json = await page.evaluate(async () => {
    const { createNewGameSave } = await import('/src/game/save/saveData.ts');
    const s = createNewGameSave(new Date(2026, 10, 5));
    return JSON.stringify({ ...s, player: { gender: 'male', name: 'Test' }, location: { mapId: 'bureau', x: 16, y: 19, dir: 'left' }, story: { ...s.story, introV2: { ...s.story.introV2, state: 'packSelection', examPassed: true } } });
  });
  await page.evaluate((s) => localStorage.setItem('mistria-battle-card/save', s), json);
  await page.goto(base);
  await page.waitForTimeout(1000);
  await page.locator(LANG === 'en' ? 'text=Continue' : 'text=続きから').first().click();
  await page.waitForSelector('.booster-select__box', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/select_${LANG}_${W}x${H}.png` });
  await page.locator('.booster-select__box').nth(BOX).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/select_guide${BOX}_${LANG}_${W}x${H}.png` });
  await page.locator('.booster-select__box').nth(BOX).click();
  await page.waitForSelector('.booster-got__monsters', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/open${BOX}_${LANG}_${W}x${H}.png` });
  console.log('be', LANG, W, BOX);
  await browser.close();
})();
