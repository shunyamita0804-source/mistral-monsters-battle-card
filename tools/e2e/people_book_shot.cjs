// 名刺図鑑の画面写真（2026-10-28 で使った）。家の本棚の前（home 19,10 上向き）で「調べる」→ 全ページと、1人の大きな名刺。
// 使い方: node tools/e2e/people_book_shot.cjs URL セーブ.json 出力フォルダ [人物のID]（W・H で画面の大きさ、LANG=en で英語。2026-10-30）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, person = 'balka'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const save = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
  // 名前の入ったセーブはそのまま（名前が無いと名前の窓が出る。2026-10-30）
  save.player = { ...(save.player ?? {}), gender: 'male' };
  save.location = { mapId: 'home', x: 19, y: 10, dir: 'up' };
  const en = process.env.LANG === 'en';
  const suffix = `${en ? '_en' : ''}${process.env.W ? `_${process.env.W}x${process.env.H}` : ''}`;
  const ctx = await browser.newContext({ viewport: { width: +(process.env.W || 390), height: +(process.env.H || 844) }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(([s, lang]) => {
    localStorage.setItem('mistria-battle-card/save', s);
    localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: lang, seVolume: 0, bgmVolume: 0, muted: true }));
  }, [JSON.stringify(save), en ? 'en' : 'ja']);
  const page = await ctx.newPage();
  await page.goto(base);
  await page.waitForTimeout(800);
  await page.locator(en ? 'text=Continue' : 'text=続きから').first().click();
  await page.waitForTimeout(2500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const pages = await page.locator('.people-book__page-no').innerText();
  const total = Number((pages.match(/(\d+)\s*ページ/) || pages.match(/\/\s*(\d+)/) || [0, 8])[1]) || 8;
  for (let p = 0; p < total; p++) {
    await page.screenshot({ path: `${out}/book_p${p + 1}${suffix}.png` });
    if (await page.locator(`[data-person="${person}"]`).count()) {
      await page.locator(`[data-person="${person}"]`).click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${out}/book_detail_${person}${suffix}.png` });
      await page.locator('.modal button').last().click();
      await page.waitForTimeout(400);
    }
    await page.locator('.people-book__turn').last().click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await ctx.close();
  await browser.close();
})();
