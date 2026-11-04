// 2026-11-05 指示書 AX：図鑑のギアロスの番号（No.235〜247）の写真。開発用サーバーで動かす。
// 使い方: node tools/e2e/ax_book_shot.cjs URL 出力フォルダ（W・H で画面の大きさ）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: 'ja', seVolume: 0, bgmVolume: 0, muted: true })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
  await page.evaluate(async () => {
    const { createNewSave } = await import('/src/game/save/saveData.ts');
    const { skillsOf } = await import('/src/data/cards.ts');
    const s0 = createNewSave(new Date(2026, 10, 5));
    const collection = { ...s0.collection, 'mon-gearos': 1 };
    for (const k of skillsOf('mon-gearos')) collection[k.id] = 1;
    localStorage.setItem('mistria-battle-card/save', JSON.stringify({ ...s0, player: { gender: 'male', name: 'テスト' }, collection, story: { ...s0.story, introV2: { ...s0.story.introV2, state: 'completed' } } }));
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
  await page.evaluate(() => document.querySelector('[data-id="mon-gearos"]')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/book_gearos_${W}x${H}.png` });
  await page.locator('[data-id="mon-gearos"]').first().click().catch(() => console.log('no click'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/book_gearos_detail_${W}x${H}.png` });
  console.log('book');
  await browser.close();
})();
