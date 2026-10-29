// ジオルの効果を手で使って撮る（2026-10-29）：エネルギーをためる（場の「ためている」の印）→ 地ひびき（相手全体）→ 相手の攻撃をかばう。
// ?qa=1&lab=geol の「効果を確かめる用」デッキ（自分）と「烈火の猛攻」（相手）で対戦する。約2〜3分。
// 使い方: node tools/e2e/geol_effects_shot.cjs URL セーブ.json 出力フォルダ
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
  await page.goto(base + '?qa=1&lab=geol');
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: style });
  await page.locator('.pukarim-lab__choice', { hasText: /^効果を確かめる用/ }).click();
  await page.locator('.pukarim-lab__choice', { hasText: /^烈火の猛攻$/ }).click();
  await page.locator('.pukarim-lab__start').click();
  await page.waitForSelector('.battle-order__card', { timeout: 15000 });
  await page.waitForTimeout(700);
  await page.locator('.battle-order__card').first().click();
  await page.waitForTimeout(3500);
  await page.addStyleTag({ content: style });
  const done = { charged: false, quake: false, cover: false };
  const tap = async (loc) => { const b = await loc.boundingBox(); if (b) await page.mouse.click(b.x + 12, b.y + b.height / 2); };
  const phase = () => page.evaluate(() => { const b = document.querySelector('.battle'); return b ? `${b.dataset.phase}/${b.dataset.acting}` : ''; });
  const want = () => [!done.charged && 'エネルギーをためる', !done.quake && '地ひびき'].filter(Boolean);
  for (let i = 0; i < 500 && !(done.charged && done.quake && done.cover); i++) {
    await page.waitForTimeout(500);
    if (await page.$('.battle__result')) { log('ended'); break; }
    const confirm = page.locator('button', { hasText: /^(マナ化へ進む|ターンを終える)$/ });
    if (await confirm.count()) { await confirm.first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500); continue; }
    // 相手の攻撃を守る：かばうを使えるときは使う
    if (await page.$('.battle__defense')) {
      const cover = page.locator('.battle__defense-card:not([disabled])[aria-label*="かばう"]');
      if (!done.cover && (await cover.count())) {
        await shot('cover_1_panel');
        await cover.first().click();
        await page.waitForTimeout(1200);
        await shot('cover_2_after');
        done.cover = true;
      }
      await page.locator('button:has-text("守備しない"), button:has-text("守備を終える")').first().click({ timeout: 3000 }).catch(() => {});
      continue;
    }
    const ph = await phase();
    if (ph === 'main/player') {
      let used = false;
      for (const name of want()) {
        const card = page.locator(`.battle__hand-card.is-usable[aria-label="${name}"]`);
        if (!(await card.count())) continue;
        await tap(card.first());
        await page.waitForTimeout(700);
        if (process.env.DEBUG) await shot(`dbg_tap_${name}`);
        await page.locator('button:has-text("使う")').first().click({ timeout: 3000 }).catch(() => {});
        if (process.env.DEBUG) { await page.waitForTimeout(600); await shot(`dbg_use_${name}`); }
        if (name === '地ひびき') {
          for (const [k, ms] of [['a', 900], ['b', 1600]]) { await page.waitForTimeout(ms); await shot(`quake_${k}`); }
          done.quake = true;
        } else {
          await page.waitForTimeout(2500);
          await shot('charged');
          done.charged = true;
        }
        used = true;
        break;
      }
      if (used) continue;
      const hand = await page.locator('.battle__hand-card').count();
      const missing = await Promise.all(want().map((n) => page.locator(`.battle__hand-card[aria-label="${n}"]`).count()));
      if (missing.some((c) => c === 0) && hand < 9) { await page.locator('.battle__qa button', { hasText: 'QA:手札+1' }).first().click(); await page.waitForTimeout(500); continue; }
      await page.locator('button:has-text("攻撃終了")').first().click({ timeout: 3000 }).catch(() => {});
      continue;
    }
    if (ph === 'mana/player') {
      const cards = page.locator('.battle__hand-card');
      const n = await cards.count();
      let picked = 0;
      for (let j = n - 1; j >= 0 && picked < 7; j--) {
        const label = (await cards.nth(j).getAttribute('aria-label')) ?? '';
        if (['エネルギーをためる', '地ひびき', 'かばう', 'クリスタルレイ'].some((x) => label.startsWith(x))) continue;
        await tap(cards.nth(j)); picked++;
        await page.waitForTimeout(250);
      }
      await page.locator('button:has-text("マナにする")').first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
      await page.locator('button:has-text("ターン終了")').first().click({ timeout: 3000 }).catch(() => {});
      continue;
    }
  }
  log('done', JSON.stringify(done));
  await browser.close();
})();
