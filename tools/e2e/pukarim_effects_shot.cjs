// 使い方: node tools/e2e/pukarim_effects_shot.cjs URL セーブ.json 出力（?qa=1&lab=pukarim の「効果を確かめる用」デッキで、おいかぜ→ほっぺにためる→ぷはーっ を手で使って撮る。約2分）
// プカリムの技を手で順に使って撮る：おいかぜ → ほっぺにためる → ぷはーっ（ためている）
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
  const style = '.stage-diag{display:none!important}';
  const shot = async (name) => {
    await page.evaluate(() => document.querySelectorAll('.battle__qa').forEach((e) => (e.style.visibility = 'hidden')));
    await page.screenshot({ path: `${out}/${name}.png` });
    await page.evaluate(() => document.querySelectorAll('.battle__qa').forEach((e) => (e.style.visibility = '')));
    log('shot', name);
  };
  await page.goto(base + '?qa=1&lab=pukarim');
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: style });
  await page.locator('.pukarim-lab__choice', { hasText: /^効果を確かめる用/ }).click();
  await page.waitForTimeout(300);
  await page.locator('.pukarim-lab__choice', { hasText: /^蒼海の守り$/ }).click();
  await page.waitForTimeout(300);
  await page.locator('.pukarim-lab__start').click();
  await page.waitForSelector('.battle-order__card', { timeout: 15000 });
  await page.waitForTimeout(700);
  await page.locator('.battle-order__card').first().click();
  await page.waitForTimeout(3500);
  await page.addStyleTag({ content: style });
  const need = ['おいかぜ', 'ほっぺにためる', 'ぷはーっ'];
  let step = 0;
  const tap = async (loc) => { const b = await loc.boundingBox(); if (b) await page.mouse.click(b.x + 12, b.y + b.height / 2); };
  const phase = () => page.evaluate(() => { const b = document.querySelector('.battle'); return b ? `${b.dataset.phase}/${b.dataset.acting}` : ''; });
  for (let i = 0; i < 400 && step < 3; i++) {
    await page.waitForTimeout(600);
    if (await page.$('.battle__result')) { log('ended'); break; }
    const confirm = page.locator('button', { hasText: /^(マナ化へ進む|ターンを終える)$/ });
    if (await confirm.count()) { await confirm.first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500); continue; }
    const ph = await phase();
    if (i % 5 === 0) log('ph', ph, 'step', step, 'hand', await page.locator('.battle__hand-card').count(), (await page.locator('.battle__hand-card').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).join('/'));
    if (ph === 'main/player') {
      const name = need[step];
      const card = page.locator(`.battle__hand-card.is-usable[aria-label="${name}"]`);
      if (!(await card.count())) {
        const hand = await page.locator('.battle__hand-card').count();
        const has = await page.locator(`.battle__hand-card[aria-label^="${name}"]`).count();
        if (!has && hand < 9) { await page.locator('.battle__qa button').nth(3).click(); await page.waitForTimeout(500); continue; }
        await page.locator('button:has-text("攻撃終了")').first().click({ timeout: 3000 }).catch(() => {});
        continue;
      }
      await tap(card.first());
      await page.waitForTimeout(700);
      await page.locator('button:has-text("使う")').first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(800);
      if (step === 0) {
        await shot('m_tailwind_target');
        await tap(page.locator('.battle__monster--player.is-target').first());
      } else if (step === 2) {
        const tgt = page.locator('.battle__monster--opponent.is-target');
        if (await tgt.count()) await tap(tgt.first());
      }
      if (step === 2) {
        for (const [k, ms] of [['a', 300], ['b', 900], ['c', 1500], ['d', 2000]]) { await page.waitForTimeout(ms); await shot(`m_puhaa_${k}`); }
        await page.waitForTimeout(1500);
        await page.locator('.battle__ticker').click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(900);
        await shot('m_log');
      } else {
        await page.waitForTimeout(2600);
        await shot(step === 0 ? 'm_tailwind' : 'm_charged');
      }
      step++;
      await page.waitForTimeout(800);
      continue;
    }
    if (ph === 'mana/player') {
      const cards = page.locator('.battle__hand-card');
      const n = await cards.count();
      let picked = 0;
      for (let j = n - 1; j >= 0 && picked < 7; j--) {
        const label = (await cards.nth(j).getAttribute('aria-label')) ?? '';
        if (need.some((x) => label.startsWith(x))) continue;
        await tap(cards.nth(j)); picked++;
        await page.waitForTimeout(250);
      }
      await page.locator('button:has-text("マナにする")').first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
      await page.locator('button:has-text("ターン終了")').first().click({ timeout: 3000 }).catch(() => {});
      continue;
    }
    const skip = page.locator('button:has-text("守備しない"), button:has-text("守備を終える")');
    if (await skip.count()) await skip.first().click({ timeout: 3000 }).catch(() => {});
  }
  log('done step', step);
  await browser.close();
})();
