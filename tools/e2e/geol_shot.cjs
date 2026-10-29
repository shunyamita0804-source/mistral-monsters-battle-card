// ジオルの試遊の画面写真（2026-10-29）。?qa=1&lab=geol の確認用の画面のカード15枚と、
// 効果を確かめる用のデッキどうしの対戦（QA:オート）で、地ひびき・かばう・場の「ためている」の印が出た所を撮る（約2〜4分）。
// 使い方: node tools/e2e/geol_shot.cjs URL セーブ.json 出力フォルダ
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out] = process.argv.slice(2);
const save = fs.readFileSync(saveFile, 'utf8');
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, save);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  const hideDiag = () => page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
  const shot = async (name) => {
    await page.evaluate(() => document.querySelectorAll('.battle__qa').forEach((e) => (e.style.visibility = 'hidden')));
    await page.screenshot({ path: `${out}/${name}.png` });
    await page.evaluate(() => document.querySelectorAll('.battle__qa').forEach((e) => (e.style.visibility = '')));
    log('shot', name);
  };
  await page.goto(base + '?qa=1&lab=geol');
  await page.waitForTimeout(2500);
  await hideDiag();
  // 確認用の画面：カード15枚（上から少しずつ送って撮る）
  for (let i = 0; i < 6; i++) {
    await shot(`lab_${i + 1}`);
    const more = await page.evaluate(() => {
      const el = document.querySelector('.pukarim-lab__body') || document.scrollingElement;
      const before = el.scrollTop;
      el.scrollTop += 600;
      return el.scrollTop !== before;
    });
    if (!more) break;
    await page.waitForTimeout(500);
  }
  // 効果を確かめる用どうしで対戦
  await page.locator('.pukarim-lab__choice', { hasText: /^効果を確かめる用/ }).click();
  await page.locator('.pukarim-lab__choice', { hasText: /（効果を確かめる用）$/ }).click();
  await page.locator('.pukarim-lab__start').click();
  await page.waitForSelector('.battle-order__card', { timeout: 15000 });
  await page.waitForTimeout(700);
  await page.locator('.battle-order__card').first().click();
  await page.waitForTimeout(3500);
  await hideDiag();
  await page.locator('.battle__qa button', { hasText: 'QA:オート' }).first().click();
  const want = { quake: 0, cover: 0, charged: 0 };
  for (let i = 0; i < 900 && (want.quake < 2 || want.cover < 2 || want.charged < 1); i++) {
    await page.waitForTimeout(250);
    const info = await page.evaluate(() => ({
      ticker: document.querySelector('.battle__ticker-text')?.textContent ?? '',
      phase: document.querySelector('.battle')?.dataset.phase ?? '',
      charged: document.querySelectorAll('.battle__corner-mark--charged').length,
      ended: !!document.querySelector('.battle__result'),
    }));
    if (info.ended) { log('ended'); break; }
    if (info.ticker.includes('相手全体へ') && want.quake < 2) { await shot(`quake_${++want.quake}`); await page.waitForTimeout(900); }
    if (info.ticker.includes('かばった') && want.cover < 2) { await shot(`cover_${++want.cover}`); await page.waitForTimeout(900); }
    if (info.charged > 0 && want.charged < 1) { await page.waitForTimeout(800); await shot(`charged_${++want.charged}`); }
  }
  log('done', JSON.stringify(want));
  await browser.close();
})();
