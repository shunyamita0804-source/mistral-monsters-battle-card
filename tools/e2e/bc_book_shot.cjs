// 2026-11-05 指示書 BC：図鑑の小さいカード（英語ロゴ）の写真。正式の20体を持っているセーブで撮る。開発用サーバーで動かす。
// 使い方: node tools/e2e/bc_book_shot.cjs URL 出力フォルダ（LANG=ja|en、W・H で画面の大きさ）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'ja' ? 'ja' : 'en';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((l) => localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: l, seVolume: 0, bgmVolume: 0, muted: true })), LANG);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
  await page.evaluate(async () => {
    const { createNewSave } = await import('/src/game/save/saveData.ts');
    const { CARD_NAME_LOGOS_EN } = await import('/src/data/cardNameLogos.generated.ts');
    const s0 = createNewSave(new Date(2026, 10, 5));
    const collection = { ...s0.collection };
    for (const id of Object.keys(CARD_NAME_LOGOS_EN)) collection[id] = 1;
    localStorage.setItem('mistria-battle-card/save', JSON.stringify({ ...s0, player: { gender: 'male', name: 'Test' }, collection, story: { ...s0.story, introV2: { ...s0.story.introV2, state: 'completed' } } }));
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
  // 「モンスター」だけに絞って、上から順に撮る
  await page.locator('button', { hasText: LANG === 'en' ? 'Monster' : 'モンスター' }).first().click();
  await page.waitForTimeout(900);
  for (const k of ['1', '2', '3', '4']) {
    await page.screenshot({ path: `${out}/book${k}_${LANG}_${W}x${H}.png` });
    await page.evaluate((h) => {
      const el = [...document.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== 'visible' && e.clientHeight > 200);
      if (el) el.scrollTop += h;
    }, Math.round(H * 0.5));
    await page.waitForTimeout(700);
  }
  await browser.close();
})();
