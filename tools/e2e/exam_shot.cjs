// 使い方: node tools/e2e/exam_shot.cjs URL セーブ.json 出力 A|B|C（A＝手で操作して対戦画面・大きなカード・狙う相手／B＝QA オートで最後まで→合格／C＝即敗北→再挑戦）
// セーブは introV2.state 'schoolArrival'・location practice（docs/handoff.md「画面写真の撮り方」）。2026-10-28 試験の先生のデッキで使った
// 試験の対戦を通す（A：手で操作して画面の部品を撮る／B：QA オートで最後まで→合格／C：即敗北→再挑戦）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, which] = process.argv.slice(2);
const save = fs.readFileSync(saveFile, 'utf8');
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

async function open(qa) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, save);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  await page.goto(base + (qa ? '?qa=1' : ''));
  await page.waitForTimeout(1000);
  const cont = page.locator('text=続きから').first();
  if (await cont.count()) await cont.click();
  return { browser, page };
}
const screen = (page) => page.evaluate(() => document.querySelector('.stage')?.dataset.screen);
async function talkThrough(page, shot, label) {
  let first = true;
  for (let i = 0; i < 80; i++) {
    if (!(await page.$('.talk'))) { await page.waitForTimeout(500); if (!(await page.$('.talk'))) return; }
    if (first && label) { await page.waitForTimeout(1200); await shot(label); first = false; }
    await page.click('.talk__window').catch(() => {});
    await page.waitForTimeout(250);
  }
}
async function waitBattle(page, shot) {
  await page.waitForFunction(() => document.querySelector('.stage')?.dataset.screen === 'battle', null, { timeout: 30000 });
  await page.waitForSelector('.battle-order__card', { timeout: 15000 });
  await page.waitForTimeout(800);
  if (shot) await shot('order-cards');
  await page.locator('.battle-order__card').first().click();
  await page.waitForTimeout(700);
  if (shot) await shot('order-open');
}
async function closeHints(page, shot, label) {
  for (let i = 0; i < 30; i++) {
    const ok = page.locator('.battle__hint button');
    if (await ok.count()) { if (label && i === 0) await shot(label); await ok.first().click(); await page.waitForTimeout(400); continue; }
    await page.waitForTimeout(300);
    if (!(await page.locator('.battle__hint button').count())) return;
  }
}

(async () => {
  let n = 0;
  const mk = (page, prefix) => async (label) => { await page.screenshot({ path: `${out}/${prefix}-${String(++n).padStart(2, '0')}-${label}.png` }); log('shot', label); };
  if (which === 'A') {
    const { browser, page } = await open(false);
    const shot = mk(page, 'A');
    await page.waitForTimeout(2500);
    await talkThrough(page, shot, 'teacher-talk');
    await waitBattle(page, shot);
    await page.waitForTimeout(2500);
    await closeHints(page, shot, 'hint');
    await page.waitForTimeout(1500);
    // 相手が先攻なら、こちらの攻撃の番まで待つ（守備の選択が出たら守らない）
    for (let i = 0; i < 80; i++) {
      await closeHints(page);
      if (i % 5 === 0) log('phase', await page.evaluate(() => { const b = document.querySelector('.battle'); return b ? b.dataset.phase + '/' + b.dataset.acting + '/' + b.dataset.active : ''; }));
      const usable = await page.locator('.battle__hand-card.is-usable').count();
      if (usable) break;
      const ph = await page.evaluate(() => { const b = document.querySelector('.battle'); return b ? b.dataset.phase + '/' + b.dataset.acting : ''; });
      if (ph.startsWith('mana') && ph.endsWith('player')) {
        const cards = page.locator('.battle__hand-card');
        const k = Math.min(2, await cards.count());
        for (let j = 0; j < k; j++) { await cards.nth(j).click().catch(() => {}); await page.waitForTimeout(250); }
        await page.locator('button:has-text("マナにする")').first().click().catch(() => {});
        await page.waitForTimeout(800);
        await closeHints(page);
        await page.locator('button:has-text("ターン終了")').first().click().catch(() => {});
        await page.waitForTimeout(800);
        const yes = page.locator('.modal .btn--primary'); if (await yes.count()) await yes.first().click().catch(() => {});
        continue;
      }
      if ((ph.startsWith('attack') || ph.startsWith('main')) && ph.endsWith('player')) {
        await page.locator('button:has-text("攻撃終了")').first().click().catch(() => {});
        await page.waitForTimeout(800);
        const yes = page.locator('.modal .btn--primary'); if (await yes.count()) await yes.first().click().catch(() => {});
        continue;
      }
      const skip = page.locator('.battle__defense button').last();
      if (await skip.count()) await skip.first().click().catch(() => {});
      await page.waitForTimeout(700);
    }
    await shot('battle-hand');
    await page.locator('.battle__hand-card.is-usable').first().click();
    await page.waitForTimeout(900); await shot('big-card');
    const use = page.locator('button:has-text("使う")');
    if (await use.count()) { await use.first().click(); await page.waitForTimeout(900); await shot('targeting'); }
    await browser.close();
  } else if (which === 'B') {
    const { browser, page } = await open(true);
    const shot = mk(page, 'B');
    await page.waitForTimeout(2500);
    await talkThrough(page, shot, 'teacher-talk');
    await waitBattle(page);
    await page.waitForTimeout(2600);
    await closeHints(page);
    await page.waitForTimeout(500);
    await shot('start');
    await page.locator('.battle__qa button').first().click();
    let lastTalk = '';
    for (let i = 0; i < 1500; i++) {
      await page.waitForTimeout(500);
      const talk = await page.evaluate(() => document.querySelector('.battle__talk')?.textContent ?? '');
      if (talk && talk !== lastTalk) { lastTalk = talk; await shot('talk-' + i); log('TALK', talk); }
      if (await page.$('.battle__result')) break;
    }
    await page.waitForTimeout(2500); await shot('result');
    await page.waitForTimeout(2500); await shot('result-2');
    await page.locator('.battle__result button').last().click();
    await page.waitForTimeout(2500);
    await talkThrough(page, shot, 'pass-talk');
    await page.waitForTimeout(1500); await shot('after');
    await browser.close();
  } else {
    const { browser, page } = await open(true);
    const shot = mk(page, 'C');
    await page.waitForTimeout(2500);
    await talkThrough(page, shot, 'teacher-talk');
    await waitBattle(page);
    await page.waitForTimeout(3000);
    await closeHints(page);
    await shot('attempt1');
    await page.locator('.battle__qa button').nth(2).click();
    await page.waitForTimeout(3000); await shot('lose-result');
    await page.locator('.battle__result button').last().click();
    await page.waitForTimeout(2500);
    await talkThrough(page, shot, 'retry-talk');
    await waitBattle(page);
    await page.waitForTimeout(3000);
    await closeHints(page);
    await page.waitForTimeout(800);
    await shot('attempt2');
    await page.locator('.battle__qa button').first().click();
    for (let i = 0; i < 1500; i++) { await page.waitForTimeout(500); if (await page.$('.battle__result')) break; }
    await page.waitForTimeout(2500); await shot('attempt2-result');
    await browser.close();
  }
})();
