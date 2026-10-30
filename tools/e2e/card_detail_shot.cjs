// カードの詳しい画面（openCardDetail）を開いて撮る（2026-10-29 文節の改行の確認）。開発用サーバー（npx vite）で動かす。
// 使い方: node tools/e2e/card_detail_shot.cjs http://127.0.0.1:5173/ 出力.png カードID（W・H で画面の大きさ、LANG=en で英語。2026-10-30）
const { chromium } = require('playwright');
const [base, out, id] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +(process.env.W || 390), height: +(process.env.H || 844) }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1500);
  await page.evaluate(async ([id, lang]) => {
    const { setLanguage } = await import('/src/i18n/i18n.ts');
    setLanguage(lang);
    const { openCardDetail } = await import('/src/ui/components/cardDetail.ts');
    const { getPlayCard: getCard } = await import('/src/data/cards.ts');
    openCardDetail(document.body, getCard(id));
  }, [id, process.env.LANG === 'en' ? 'en' : 'ja']);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out });
  await browser.close();
})();
