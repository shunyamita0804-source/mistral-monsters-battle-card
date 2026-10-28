// 使い方: node tools/e2e/pukarim_lab_shot.cjs URL セーブ.json 出力（プカリムの試遊の画面：カードとデッキの選び方）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out] = process.argv.slice(2);
const save = fs.readFileSync(saveFile, 'utf8');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, save);
  const page = await ctx.newPage();
  await page.goto(base + '?qa=1&lab=pukarim');
  await page.waitForTimeout(1800);
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
  await page.screenshot({ path: `${out}/lab_top.png` });
  await page.locator('.pukarim-lab__body').evaluate((el) => (el.scrollTop = 560));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/lab_cards2.png` });
  await page.locator('.pukarim-lab__body').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/lab_battle.png` });
  await browser.close();
})();
