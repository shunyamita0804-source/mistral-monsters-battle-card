// 使い方: node tools/e2e/pete_shot.cjs URL セーブ.json 出力 幅 高さ 名前 [win|lose|talk]
// ピート（カードショップの前）に話しかける → 勝負する → QA の即勝利／即敗北 → 街に戻ったひと言ともらったカード（2026-10-29 プカリムの最終）。
// セーブの場所はピートの左となり {town,150,96,right} など。talk は話しかけたところまで
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, W, H, tag, mode = 'win'] = process.argv.slice(2);
const save = fs.readFileSync(saveFile, 'utf8');
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, save);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  await page.goto(base + '?qa=1');
  await page.waitForTimeout(1000);
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
  const cont = page.locator('text=続きから').first();
  if (await cont.count()) await cont.click();
  await page.waitForTimeout(2500);
  let n = 0;
  const shot = async (l) => { await page.screenshot({ path: `${out}/${tag}-${String(++n).padStart(2, '0')}-${l}.png` }); log('shot', l); };
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1600);
  await shot('talk');
  // 会話を送って選択肢まで
  for (let i = 0; i < 10 && !(await page.locator('.talk__choices button').count()); i++) {
    if (!(await page.$('.talk'))) break;
    await page.click('.talk__window').catch(() => {});
    await page.waitForTimeout(500);
  }
  if (!(await page.locator('.talk__choices button').count())) { await shot('end'); await browser.close(); return; }
  await shot('choice');
  if (mode === 'talk') { await browser.close(); return; }
  await page.locator('.talk__choices button').first().click();
  await page.waitForSelector('.battle-order__card', { timeout: 20000 });
  await page.waitForTimeout(800);
  await shot('battle-order');
  await page.locator('.battle-order__card').first().click();
  await page.waitForTimeout(3500);
  for (let i = 0; i < 10; i++) { const ok = page.locator('.battle__hint button'); if (!(await ok.count())) break; await ok.first().click(); await page.waitForTimeout(400); }
  await shot('battle');
  await page.locator(`.battle__qa button:has-text("${mode === 'lose' ? 'QA:即敗北' : 'QA:即勝利'}")`).first().click();
  await page.waitForTimeout(2500);
  await shot('battle-end');
  // 結果の窓を閉じて街へ
  for (let i = 0; i < 8; i++) {
    const scr = await page.evaluate(() => document.querySelector('.stage')?.dataset.screen);
    if (scr === 'world') break;
    const b = page.locator('.modal button, .battle-result button, button:has-text("続ける"), button:has-text("街へ"), button:has-text("OK"), button:has-text("もどる"), button:has-text("戻る")');
    if (await b.count()) await b.last().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(2500);
  await shot('back-talk');
  for (let i = 0; i < 8 && (await page.$('.talk')); i++) {
    await page.click('.talk__window').catch(() => {});
    await page.waitForTimeout(700);
    if (i === 0) await shot('back-talk2');
  }
  await page.waitForTimeout(1500);
  await shot('after');
  await browser.close();
})();
