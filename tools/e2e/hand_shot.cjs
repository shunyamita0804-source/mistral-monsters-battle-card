// 使い方: node tools/e2e/hand_shot.cjs URL 試験のセーブ.json 出力 幅 高さ 名前（手札の大きさ：マナにする印・手札5/7/10枚・選んだ印と大きなカード。?qa=1 の QA:手札+1 を使う）
// 手札の大きさの確認：試験の対戦で、マナにする印・手札5枚（使えない印）・選んだ印と大きなカード・7枚・10枚（10枚で選んだ）
// 使い方: node hand.cjs URL セーブ.json 出力 幅 高さ 名前
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, W, H, tag] = process.argv.slice(2);
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
  const cont = page.locator('text=続きから').first();
  if (await cont.count()) await cont.click();
  let n = 0;
  const shot = async (l) => {
    await page.addStyleTag({ content: '.battle__qa,.stage-diag{display:none!important}' }).then((h) => h.evaluate((el) => el.setAttribute('data-hide', '1')));
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}/${tag}-${String(++n).padStart(2, '0')}-${l}.png` });
    await page.evaluate(() => document.querySelectorAll('style[data-hide]').forEach((e) => e.remove()));
    log('shot', l);
  };
  const closeHints = async () => { for (let i = 0; i < 20; i++) { const ok = page.locator('.battle__hint button'); if (!(await ok.count())) return; await ok.first().click(); await page.waitForTimeout(400); } };
  const phase = () => page.evaluate(() => { const b = document.querySelector('.battle'); return b ? `${b.dataset.phase}/${b.dataset.acting}` : ''; });
  const tapCard = async (loc) => { const b = await loc.boundingBox(); await page.mouse.click(b.x + 12, b.y + b.height / 2); };
  const qa = (i) => page.locator('.battle__qa button').nth(i).click();
  // 会話を進めて対戦へ
  await page.waitForTimeout(2500);
  for (let i = 0; i < 80 && (await page.$('.talk')); i++) { await page.click('.talk__window').catch(() => {}); await page.waitForTimeout(250); }
  await page.waitForSelector('.battle-order__card', { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.locator('.battle-order__card').first().click();
  await page.waitForTimeout(3500);
  await closeHints();
  let manaShot = false, mainShot = false;
  for (let i = 0; i < 120 && !mainShot; i++) {
    await closeHints();
    const ph = await phase();
    if (ph === 'mana/player') {
      const cards = page.locator('.battle__hand-card');
      for (let j = 0; j < 2; j++) { await cards.nth(j).click().catch(() => {}); await page.waitForTimeout(300); }
      if (!manaShot) { await page.waitForTimeout(500); await shot('mana-picked'); manaShot = true; }
      await page.locator('button:has-text("マナにする")').first().click().catch(() => {});
      await page.waitForTimeout(900); await closeHints();
      await page.locator('button:has-text("ターン終了")').first().click().catch(() => {});
      await page.waitForTimeout(900);
      continue;
    }
    if (ph === 'main/player' && (await page.locator('.battle__hand-card.is-usable').count()) && (await page.locator('.battle__hand-card.is-unusable').count())) {
      await page.waitForTimeout(800);
      await shot('hand5');
  log('scroll', await page.evaluate(() => { const out = []; let e = document.querySelector('.battle__hand'); while (e) { if (e.scrollLeft || e.scrollTop) out.push((e.className || e.tagName) + ':' + e.scrollLeft + '/' + e.scrollTop); e = e.parentElement; } const r = document.querySelector('.battle__hand').getBoundingClientRect(); return out.join(' ') + ' row ' + Math.round(r.left) + ' sw ' + document.querySelector('.battle__hand').scrollWidth + ' cw ' + document.querySelector('.battle__hand').clientWidth; }));
      await tapCard(page.locator('.battle__hand-card.is-usable').first());
      await page.waitForTimeout(900);
      await shot('hand5-selected-bigcard');
      mainShot = true;
      break;
    }
    if (ph === 'main/player') {
      await page.locator('button:has-text("攻撃終了")').first().click().catch(() => {});
      await page.waitForTimeout(900);
      continue;
    }
    const skip = page.locator('.battle__defense button').last();
    if (await skip.count()) await skip.click().catch(() => {});
    await page.waitForTimeout(700);
  }
  // 選びをやめてから手札を足す
  await page.locator('button:has-text("やめる")').first().click().catch(() => {});
  await page.waitForTimeout(500);
  for (let k = 0; k < 2; k++) { await qa(3); await page.waitForTimeout(300); }
  await page.waitForTimeout(1800);
  await shot('hand7');
  for (let k = 0; k < 3; k++) { await qa(3); await page.waitForTimeout(300); }
  await page.waitForTimeout(2000);
  await shot('hand10');
  log('scroll', await page.evaluate(() => { const out = []; let e = document.querySelector('.battle__hand'); while (e) { if (e.scrollLeft || e.scrollTop) out.push((e.className || e.tagName) + ':' + e.scrollLeft + '/' + e.scrollTop); e = e.parentElement; } const r = document.querySelector('.battle__hand').getBoundingClientRect(); return out.join(' ') + ' row ' + Math.round(r.left) + ' sw ' + document.querySelector('.battle__hand').scrollWidth + ' cw ' + document.querySelector('.battle__hand').clientWidth; }));
  await tapCard(page.locator('.battle__hand-card').nth(4));
  await page.waitForTimeout(900);
  await shot('hand10-selected');
  log('scroll', await page.evaluate(() => { const out = []; let e = document.querySelector('.battle__hand'); while (e) { if (e.scrollLeft || e.scrollTop) out.push((e.className || e.tagName) + ':' + e.scrollLeft + '/' + e.scrollTop); e = e.parentElement; } const r = document.querySelector('.battle__hand').getBoundingClientRect(); return out.join(' ') + ' row ' + Math.round(r.left) + ' sw ' + document.querySelector('.battle__hand').scrollWidth + ' cw ' + document.querySelector('.battle__hand').clientWidth; }));
  // 並びの数字（1枚ずつの見える幅）
  log(await page.evaluate(() => { const els = [...document.querySelectorAll('.battle__hand-card')]; const xs = els.map((e) => Math.round(e.getBoundingClientRect().left)); const w = els[0]?.getBoundingClientRect().width; const row = document.querySelector('.battle__hand').getBoundingClientRect(); return `cards ${els.length} w ${w?.toFixed(1)} lefts ${xs.join(',')} row ${Math.round(row.left)}-${Math.round(row.right)} stage ${document.querySelector('.stage').style.width}x${document.querySelector('.stage').style.height}`; }));
  // 画面のはみ出し（縦）
  log(await page.evaluate(() => { const b = document.querySelector('.battle'); const r = b.getBoundingClientRect(); const parts = ['.battle__header', '.battle-camera', '.battle__detail, .battle-focus', '.battle__hand', '.battle__commands, .battle__command-bar']; return `battle ${Math.round(r.top)}-${Math.round(r.bottom)} scrollH ${b.scrollHeight} clientH ${b.clientHeight} ` + [...b.children].map((c) => `${c.className.split(' ')[0]}:${Math.round(c.getBoundingClientRect().top)}-${Math.round(c.getBoundingClientRect().bottom)}`).join(' '); }));
  await browser.close();
})();
