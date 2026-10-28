// 使い方: STEPS='[{"click":"セレクタ","wait":1000,"shot":"名前"}, {"drag":".gacha-open__pack"}, {"slow":15}, {"burst":3,"every":1500,"shot":"x"}]' PREFIX=G DPR=3 node tools/e2e/screen_steps.cjs URL セーブ.json 出力（画面の大きさは W・H で変えられる。2026-10-29）
// 「続きから」のあと Enter（調べる）を押し、STEPS を順に行う。ガチャ（{shop,45,20,up}）・デッキ編集（{home,8,18,left}）で使った。slow＝setTimeout を何倍に遅くするか（一瞬の演出を撮る）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out] = process.argv.slice(2);
const save = fs.readFileSync(saveFile, 'utf8');
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +(process.env.W || 390), height: +(process.env.H || 844) }, deviceScaleFactor: +(process.env.DPR || 2), isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, save);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1000);
  const cont = page.locator('text=続きから').first();
  if (await cont.count()) await cont.click();
  await page.waitForTimeout(2500);
  let n = 0;
  const shot = async (l) => { await page.screenshot({ path: `${out}/${process.env.PREFIX || "G"}-${String(++n).padStart(2, '0')}-${l}.png` }); log('shot', l); };
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await shot('enter');
  const dump = async () => log(await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => (b.className + ':' + b.textContent.trim().slice(0, 20))).join(' | ')));
  await dump();
  const steps = JSON.parse(process.env.STEPS || '[]');
  for (const st of steps) {
    if (st.slow) await page.evaluate((k) => { const o = window.setTimeout; window.setTimeout = (f, ms, ...a) => o(f, (ms || 0) * k, ...a); }, st.slow);
    if (st.drag) {
      const box = await page.locator(st.drag).first().boundingBox();
      if (box) {
        const y = box.y + box.height * (st.fy ?? 0.1);
        await page.mouse.move(box.x + 8, y); await page.mouse.down();
        for (let k = 1; k <= 12; k++) { await page.mouse.move(box.x + 8 + (box.width - 16) * k / 12, y); await page.waitForTimeout(30); }
        await page.mouse.up();
      } else log('nobox', st.drag);
    }
    if (st.swipe) {
      const box = await page.locator(st.swipe).first().boundingBox();
      if (box) { const cx = box.x + box.width / 2, cy = box.y + box.height / 2; await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 120, cy - 20, { steps: 6 }); await page.mouse.up(); }
    }
    if (st.burst) { for (let k = 0; k < st.burst; k++) { await page.waitForTimeout(st.every || 300); await shot((st.shot || 'b') + k); } continue; }
    if (st.click) await page.locator(st.click).first().click({ timeout: 8000 }).catch((e) => log('miss', st.click));
    await page.waitForTimeout(st.wait || 1200);
    if (st.shot) await shot(st.shot);
    if (st.dump) await dump();
  }
  await browser.close();
})();
