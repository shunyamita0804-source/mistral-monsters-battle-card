// 技カード・サポートカードの見本を並べて撮る（2026-10-29 技カードの新しい形）。開発用サーバー（npx vite）で動かす。
// 使い方: node tools/e2e/card_gallery_shot.cjs http://127.0.0.1:5173/ 出力.png 幅 'カードID,カードID,...' [size=normal|hand] [カードの幅]
const { chromium } = require('playwright');
const [base, out, W, ids, size = 'normal', cw = '170'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +W, height: 2400 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await page.goto(base);
  await page.waitForTimeout(1500);
  await page.evaluate(async ({ ids, size, cw }) => {
    const { createPlayCard } = await import('/src/ui/components/skillCard.ts');
    const { getPlayCard } = await import('/src/data/cards.ts');
    document.body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.id = 'gal';
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;padding:10px;background:#1f2a24;width:max-content;max-width:100vw;box-sizing:border-box';
    for (const id of ids.split(',')) wrap.append(createPlayCard(getPlayCard(id), { width: +cw, size }));
    document.body.append(wrap);
  }, { ids, size, cw });
  await page.waitForTimeout(1500);
  await page.locator('#gal').screenshot({ path: out });
  await browser.close();
})();
