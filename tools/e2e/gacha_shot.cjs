// 使い方: node tools/e2e/gacha_shot.cjs URL セーブ.json 出力 幅 高さ 名前 [パックの番号=0]
// ガチャ（販売機の前 {shop,45,20,up} のセーブ）でパックを選ぶ → 自動でまわす → 破る → 1枚ずつめくる → 結果の一覧（2026-10-29）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, W, H, tag, nth = '0'] = process.argv.slice(2);
const save = fs.readFileSync(saveFile, 'utf8');
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, save);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1000);
  const cont = page.locator('text=続きから').first();
  if (await cont.count()) await cont.click();
  await page.waitForTimeout(2500);
  let n = 0;
  const shot = async (l) => { await page.screenshot({ path: `${out}/${tag}-${String(++n).padStart(2, '0')}-${l}.png` }); log('shot', l); };
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await shot('select');
  const tile = page.locator('.gacha-select__tile').nth(+nth);
  await tile.click(); await page.waitForTimeout(600); await tile.click(); await page.waitForTimeout(1200);
  await page.locator('.modal button:has-text("はい")').first().click();
  await page.waitForTimeout(2500);
  await shot('machine');
  await page.locator('button:has-text("自動でまわす")').first().click();
  await page.waitForSelector('.gacha-machine__stage.is-landed', { timeout: 20000 });
  await page.waitForTimeout(800);
  await shot('landed');
  await page.locator('.gacha-machine__stage').click();
  await page.waitForSelector('.gacha-open__pack', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await shot('pack');
  const box = await page.locator('.gacha-open__pack').first().boundingBox();
  const y = box.y + box.height * 0.1;
  await page.mouse.move(box.x + 8, y); await page.mouse.down();
  for (let k = 1; k <= 14; k++) { await page.mouse.move(box.x + 8 + (box.width - 16) * k / 14, y); await page.waitForTimeout(30); }
  await page.mouse.up();
  await page.waitForTimeout(3000);
  await shot('torn');
  for (let i = 0; i < 12 && !(await page.locator('.gacha-open__mini').count()); i++) {
    await page.locator('.gacha-open__stack').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(1800);
    if (i === 0 || i === 2) await shot(`card${i + 1}`);
  }
  await page.waitForTimeout(1500);
  await shot('result');
  await page.locator('.gacha-open__mini').nth(1).click().catch(() => {});
  await page.waitForTimeout(1200);
  await shot('detail');
  await browser.close();
})();
