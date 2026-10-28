// 使い方: node tools/e2e/money_shot.cjs URL セーブのフォルダ 出力（chest_coins/chest_item/chest_card/npc/boss.json：宝箱・バトラー・ボスのとなりに立ったダンジョンのセーブ。お金の入る側）
// お金の入る側の画面写真：宝箱（お金・道具・技カード）／バトラーに勝った報酬の窓／ボス初回クリア
const { chromium } = require('playwright');
const fs = require('fs');
const [base, dir, out] = process.argv.slice(2);
const waitFor = async (page, sel, ms) => { const end = Date.now() + ms; while (Date.now() < end) { if (await page.locator(sel).count()) return true; await page.waitForTimeout(150); } return false; };
(async () => {
  const browser = await chromium.launch();
  for (const name of ['chest_coins', 'chest_item', 'chest_card', 'npc', 'boss']) {
    const save = fs.readFileSync(`${dir}/${name}.json`, 'utf8');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true });
    await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, save);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', name, e.message));
    await page.goto(base + '?qa=1');
    await page.waitForTimeout(800);
    await page.locator('text=続きから').first().click();
    await page.waitForTimeout(3500);
    const coins0 = await page.evaluate(() => JSON.parse(localStorage.getItem('mistria-battle-card/save')).coins);
    await page.screenshot({ path: `${out}/${name}_0map.png` });
    await page.keyboard.press('z');
    await page.waitForTimeout(1400);
    if (name.startsWith('chest')) {
      await page.screenshot({ path: `${out}/${name}_1open.png` });
    } else {
      await page.locator('.modal button').last().click();
      await page.waitForTimeout(4200);
      await page.mouse.click(115, 585);
      await page.waitForTimeout(2500);
      await page.locator('text=QA:即勝利').first().click();
      await page.waitForTimeout(2800);
      await page.screenshot({ path: `${out}/${name}_2result.png` });
      await page.locator('button:has-text("続ける")').first().click();
      if (name === 'boss') {
        await waitFor(page, '.drun__talk-visual', 15000);
        await page.waitForTimeout(800);
        await page.locator('.modal button').last().click();
        await page.waitForTimeout(1800);
        await page.screenshot({ path: `${out}/${name}_3clear.png` });
      } else {
        await waitFor(page, '.modal', 15000);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${out}/${name}_3reward.png` });
      }
    }
    const coins1 = await page.evaluate(() => JSON.parse(localStorage.getItem('mistria-battle-card/save')).coins);
    const items = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('mistria-battle-card/save')).items));
    console.log(name, 'coins', coins0, '->', coins1, 'items', items);
    await ctx.close();
  }
  await browser.close();
})();
