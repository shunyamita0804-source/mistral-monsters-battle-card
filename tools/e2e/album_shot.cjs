// 研究所の図鑑（カード図鑑）を開いて、あるモンスターの区切り（15枚）までスクロールして撮る（2026-10-29 セレフィーンの最終）。開発用サーバー（npx vite）で動かす。
// 使い方: node tools/e2e/album_shot.cjs http://127.0.0.1:5173/ セーブ.json 出力フォルダ 図鑑の番号（例 136） [カードID＝詳しい画面も撮る]
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, no, detailId] = process.argv.slice(2);
const save = fs.readFileSync(saveFile, 'utf8');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => localStorage.setItem('mistria-battle-card/save', s), save);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
  await page.evaluate(async () => {
    const { GameStore } = await import('/src/ui/gameStore.ts');
    const { SCREENS } = await import('/src/ui/screens/registry.ts');
    const { mountStage } = await import('/src/ui/stage.ts');
    const store = GameStore.fromBrowser();
    const stage = mountStage(document.querySelector('#app'), { qa: false });
    const noop = () => {};
    const screen = SCREENS.collection.create({ navigate: noop, back: noop, reset: noop, store });
    stage.element.dataset.screen = 'collection';
    stage.element.replaceChildren(screen.element);
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/album_0top.png` });
  const label = `No.${no}`;
  const cell = page.locator('.card-book__no', { hasText: label }).first();
  await cell.evaluate((el) => el.closest('.card-book__items')?.previousElementSibling?.scrollIntoView({ block: 'start' }) ?? el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/album_1section.png` });
  // 続き：6枚あと・12枚あとの行が上に来るように
  for (const [k, plus] of [['2', 6], ['3', 12]]) {
    await page.locator('.card-book__no', { hasText: `No.${+no + plus}` }).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${out}/album_${k}section_more.png` });
  }
  if (detailId) {
    await cell.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/album_4detail.png` });
  }
  await browser.close();
})();
