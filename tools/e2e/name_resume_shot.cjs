// 使い方: node tools/e2e/name_resume_shot.cjs URL 前のセーブ.json 出力 [幅x高さ]
// 名前の無い前のセーブ（version 21 まで）で「続きから」→ 1回だけ名前の窓 → 決めたら歩く画面へ。もう一度「続きから」では出ないことも確かめる（2026-10-28）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, size = '390x844'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const screen = (page) => page.evaluate(() => document.querySelector('.stage')?.dataset.screen);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const old = fs.readFileSync(saveFile, 'utf8');
  console.log('前のセーブ', JSON.parse(old).version, JSON.stringify(JSON.parse(old).player));
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, old);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(800);
  await page.locator('text=続きから').first().click();
  await page.waitForSelector('.name-prompt', { timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${size}_resume_1_prompt.png` });
  await page.locator('.name-prompt__input').fill('ミレイユの友');
  await page.locator('.name-prompt__ok').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${size}_resume_2_confirm.png` });
  await page.locator('.name-prompt__yes').click();
  await page.waitForFunction(() => document.querySelector('.stage')?.dataset.screen === 'world', null, { timeout: 15000 });
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('mistria-battle-card/save')));
  console.log('決めたあと', save.version, JSON.stringify(save.player), screen && (await screen(page)));
  // もう一度タイトルから「続きから」：名前の窓は出ない
  await page.reload();
  await page.waitForTimeout(800);
  await page.locator('text=続きから').first().click();
  await page.waitForTimeout(1500);
  console.log('2回目の続きから：名前の窓', await page.locator('.name-prompt').count(), '画面', await screen(page));
  await browser.close();
})();
