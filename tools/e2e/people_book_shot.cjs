// 名刺図鑑の画面写真（2026-10-28 で使った）。家の本棚の前（home 19,10 上向き）で「調べる」→ 全ページと、1人の大きな名刺。
// 使い方: node tools/e2e/people_book_shot.cjs URL セーブ.json 出力フォルダ [人物のID]
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, person = 'balka'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const save = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
  save.player = { gender: 'male' };
  save.location = { mapId: 'home', x: 19, y: 10, dir: 'up' };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript((s) => { localStorage.setItem('mistria-battle-card/save', s); }, JSON.stringify(save));
  const page = await ctx.newPage();
  await page.goto(base);
  await page.waitForTimeout(800);
  await page.locator('text=続きから').first().click();
  await page.waitForTimeout(2500);
  await page.locator('text=調べる').first().click();
  await page.waitForTimeout(1500);
  const pages = await page.locator('.people-book__page-no').innerText();
  const total = Number((pages.match(/(\d+)\s*ページ/) || pages.match(/\/\s*(\d+)/) || [0, 8])[1]) || 8;
  for (let p = 0; p < total; p++) {
    await page.screenshot({ path: `${out}/book_p${p + 1}.png` });
    if (await page.locator(`[data-person="${person}"]`).count()) {
      await page.locator(`[data-person="${person}"]`).click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${out}/book_detail_${person}.png` });
      await page.locator('.modal button').last().click();
      await page.waitForTimeout(400);
    }
    await page.locator('.people-book__turn').last().click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await ctx.close();
  await browser.close();
})();
