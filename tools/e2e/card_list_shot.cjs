// 使い方: node tools/e2e/card_list_shot.cjs URL セーブ.json 出力 [幅x高さ]
// 管理局で箱を選ぶ → 「受け取った！」→ 取得カードの画面（一覧・行を押したとき・一覧のスクロール）（2026-10-28）。
// セーブは introV2.state 'packSelection'・location bureau（試験に合格したあと）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, size = '390x844'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => { window.__seLog = []; if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, fs.readFileSync(saveFile, 'utf8'));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const shot = (name) => page.screenshot({ path: `${out}/${size}_${name}.png` });
  const se = () => page.evaluate(() => window.__seLog.splice(0));
  await page.goto(base);
  await page.waitForTimeout(800);
  await page.locator('text=続きから').first().click();
  await page.waitForSelector('.booster-select__box', { timeout: 15000 });
  await page.waitForTimeout(800);
  await se();
  await page.locator('.booster-select__box').nth(1).click();
  await page.waitForTimeout(700);
  console.log('SE 箱1回目', await se());
  await page.locator('.booster-select__box').nth(1).click();
  await page.waitForSelector('.modal', { timeout: 10000 });
  await page.waitForTimeout(800);
  console.log('SE 箱2回目（決定）', await se());
  await shot('cards_0_got');
  await page.locator('.modal .btn--primary').click();
  await page.waitForSelector('.card-list', { timeout: 5000 });
  await page.waitForTimeout(600);
  console.log('SE OK', await se());
  await shot('cards_1_list');
  const rows = await page.locator('.card-list__row').allInnerTexts();
  console.log('一覧', rows.length, '行', rows.map((r) => r.replace(/\s+/g, ' ')).join(' / '));
  console.log('合計', await page.locator('.card-list__total').innerText());
  // 技カードの行を押す
  await page.locator('.card-list__row--skill').nth(2).click();
  await page.waitForTimeout(400);
  console.log('SE 行', await se());
  await shot('cards_2_skill');
  // 一覧だけスクロール（いちばん下のサポートまで）
  await page.locator('.card-list__rows').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.waitForTimeout(300);
  const support = page.locator('.card-list__row--support');
  if (await support.count()) await support.first().click();
  await page.waitForTimeout(400);
  await shot('cards_3_scrolled');
  await page.locator('.card-list__close').click();
  await page.waitForTimeout(800);
  console.log('SE 閉じる', await se(), '取得カードの画面', await page.locator('.card-list').count());
  await page.waitForTimeout(800);
  await shot('cards_4_after');
  await browser.close();
})();
