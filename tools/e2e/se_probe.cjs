// 使い方: node tools/e2e/se_probe.cjs URL セーブ.json
// ボタンの音（2026-10-28）：いくつかの画面でボタンを押し、鳴った音（window.__seLog）を書き出す
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => { window.__seLog = []; if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, fs.readFileSync(saveFile, 'utf8'));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const se = () => page.evaluate(() => window.__seLog.splice(0));
  const press = async (label, sel) => {
    const l = page.locator(sel).first();
    if (!(await l.count())) { console.log(`- ${label}：見つからない（${sel}）`); return; }
    await l.click({ force: true });
    await page.waitForTimeout(500);
    console.log(`- ${label}：${(await se()).join('・') || '（なし）'}`);
  };
  await page.goto(base);
  await page.waitForTimeout(800);
  await press('タイトル「設定」', 'button:has-text("設定")');
  await press('設定の画面「戻る」', '.screen-header__back');
  await press('タイトル「最初から」（セーブあり→確認）', 'button:has-text("最初から")');
  await press('確認の窓「いいえ」', '.modal button:has-text("いいえ")');
  await press('タイトル「続きから」', 'button:has-text("続きから")');
  await page.waitForTimeout(2500);
  await se();
  await press('歩く画面「メニュー」', '.world__menu-btn, button:has-text("メニュー")');
  const items = await page.locator('.modal button, .world-menu button').allInnerTexts();
  console.log('  メニューの中：', items.map((s) => s.replace(/\s+/g, '')).join(' / '));
  await press('メニュー「閉じる」', '.modal button:has-text("閉じる"), .world-menu button:has-text("閉じる")');
  await browser.close();
})();
