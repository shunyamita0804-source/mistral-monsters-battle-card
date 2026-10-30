// 同じモンスターは1デッキ1体まで（2026-10-30 指示書 V）の画面写真：家の机でデッキを組む → モンスターを選ぶ → もうデッキにいるモンスターを押す
// 使い方: node tools/e2e/deck_dup_shot.cjs URL セーブ.json 出力.png [モンスターのID=mon-soramo]
//   セーブの場所は家の机の横 {home,8,17,left} にしておく。W・H で画面の大きさ、LANG=en で英語。MENU=1 なら最初のメニュー（デッキの状態）だけ撮る。ISSUES=1 なら状態を押して問題の一覧を出す
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, id = 'mon-soramo'] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(([s, lang]) => {
    localStorage.setItem('mistria-battle-card/save', s);
    localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: lang, seVolume: 0, bgmVolume: 0, muted: true }));
  }, [fs.readFileSync(saveFile, 'utf8'), LANG]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.addStyleTag({ content: '.stage-diag{display:none!important} .world__hint{display:none!important}' }).catch(() => {});
  await page.waitForTimeout(800);
  await page.locator(LANG === 'en' ? 'text=Continue' : 'text=続きから').first().click();
  await page.waitForTimeout(3200);
  await page.locator('.world__action').first().click();
  await page.waitForTimeout(1500);
  if (process.env.ISSUES) {
    await page.locator('.deck__status').first().click();
    await page.waitForTimeout(800);
  } else if (!process.env.MENU) {
    await page.locator('.deck__menu button').first().click();
    await page.waitForTimeout(600);
    await page.locator(`.deck__item[data-id="${id}"]`).first().click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: out });
  await browser.close();
})();
