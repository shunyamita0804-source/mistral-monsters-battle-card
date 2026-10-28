// 使い方: node tools/e2e/hand_full_shot.cjs URL 試験のセーブ.json 出力 [幅x高さ]
// 手札の上限9枚（2026-10-28）：試験の対戦（?qa=1）で「QA:手札+1」で 2枚引くサポート（仮サポート2）が来るまで引き、
// マナ化で手札を10枚にそろえてターンを終える → 次のターン、手札10枚から仮サポート2 を使う（残り9枚）→
// 「手札がいっぱい（9枚）なので、山札の上から2枚をマナにした。」の記録の文を撮る
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, size = '390x844'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const DRAW2 = '仮サポート2';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, fs.readFileSync(saveFile, 'utf8'));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const shot = (name) => page.screenshot({ path: `${out}/${size}_${name}.png` });
  await page.goto(base + '?qa=1');
  await page.waitForTimeout(800);
  await page.locator('text=続きから').first().click();
  for (let i = 0; i < 60 && !(await page.$('.battle-order__card')); i++) {
    if (await page.$('.talk__window')) await page.click('.talk__window').catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.locator('.battle-order__card').first().click();
  await page.waitForTimeout(3000);
  const closeHints = async () => {
    for (let i = 0; i < 10 && (await page.locator('.battle__hint button').count()); i++) {
      await page.locator('.battle__hint button').first().click().catch(() => {});
      await page.waitForTimeout(400);
    }
  };
  const phase = () => page.evaluate(() => { const b = document.querySelector('.battle'); return b ? `${b.dataset.phase}/${b.dataset.acting}` : ''; });
  const handNames = () => page.locator('.battle__hand-card').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  let done = false;
  for (let i = 0; i < 120 && !done; i++) {
    await closeHints();
    const ph = await phase();
    if (ph.startsWith('main') && ph.endsWith('player')) {
      // 仮サポート2 が来るまで、手札が10枚になるまで QA:手札+1
      for (let k = 0; k < 60; k++) {
        const names = await handNames();
        if (names.length >= 10 && names.some((n) => n.includes(DRAW2))) break;
        await page.locator('.battle__qa button', { hasText: '手札+1' }).click();
        await page.waitForTimeout(120);
      }
      const names = await handNames();
      const idx = names.findIndex((n) => n === DRAW2);
      if (idx >= 0 && names.length === 10) {
        console.log('手札', names.length, '枚。仮サポート2 を使う');
        await shot('hand_1_before');
        await page.locator('.battle__hand-card').nth(idx).evaluate((el) => el.click());
        await page.waitForTimeout(500);
        await page.locator('button:has-text("使う")').first().click();
        await page.waitForTimeout(2500);
        const after = await handNames();
        console.log('使ったあとの手札', after.length, '枚');
        await shot('hand_2_ticker');
        await page.locator('.battle__ticker').click();
        await page.waitForTimeout(700);
        await shot('hand_3_log');
        const lines = await page.locator('.modal').innerText();
        console.log('記録', lines.split('\n').filter((l) => l.includes('手札') || l.includes('引いた')).slice(-4).join(' | '));
        done = true;
        break;
      }
      // マナが無くて使えない：攻撃を終えてマナ化へ
      await page.locator('button:has-text("攻撃終了")').first().click().catch(() => {});
      await page.waitForTimeout(800);
      await page.locator('button:has-text("マナ化へ進む")').first().click().catch(() => {});
      await page.waitForTimeout(800);
      continue;
    }
    if (ph.startsWith('mana') && ph.endsWith('player')) {
      // 手札を10枚にそろえる（多い分をマナに。10枚以下なら1枚だけ）
      const names = await handNames();
      const want = names.length > 10 ? names.length - 10 : 1;
      let picked = 0;
      for (let j = 0; j < names.length && picked < want; j++) {
        if (names[j].includes(DRAW2)) continue;
        await page.locator('.battle__hand-card').nth(j).evaluate((el) => el.click());
        picked++;
        await page.waitForTimeout(200);
      }
      await page.locator('button:has-text("マナにする")').first().click().catch(() => {});
      await page.waitForTimeout(1500);
      await closeHints();
      await page.locator('button:has-text("ターン終了")').first().click().catch(() => {});
      await page.waitForTimeout(800);
      const yes = page.locator('.modal .btn--primary');
      if (await yes.count()) await yes.first().click().catch(() => {});
      continue;
    }
    const skip = page.locator('.battle__defense button').last();
    if (await skip.count()) await skip.click().catch(() => {});
    await page.waitForTimeout(700);
  }
  if (!done) console.log('手札が10枚のときに引く効果を使えなかった', await phase());
  await browser.close();
})();
