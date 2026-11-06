// 2026-11-06 BM の直し：まだガチャに並んでいない子（フギン・クロシオ・ロウガ・クヨウ・ラディエル・ギアロス）のパックと販売機の窓を、ゲームの画面で撮る。
// タイラントはガチャのシリーズが無い（パック・窓の絵も無い）ので撮らない。開発用サーバー（npx vite）で動かす。
// 使い方: node tools/e2e/bm_pack_window_shot.cjs URL 出力フォルダ
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const IDS = ['huginn', 'kuroshio', 'rouga', 'kuyo', 'radiel', 'gearos'];
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: 'ja', seVolume: 0, bgmVolume: 0, muted: true })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1500);
  const waitImages = () => page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => console.log('images timeout'));
  // 6体のモンスターカードを持っているセーブ（パックを選ぶ画面に並ぶ）
  await page.evaluate(async (ids) => {
    const { createNewSave } = await import('/src/game/save/saveData.ts');
    const s0 = createNewSave(new Date(2026, 10, 5));
    const collection = { ...s0.collection, ...Object.fromEntries(ids.map((id) => [`mon-${id}`, 1])) };
    localStorage.setItem('mistria-battle-card/save', JSON.stringify({ ...s0, coins: 3000, collection, player: { gender: 'male', name: 'テスト' }, story: { ...s0.story, intro: 'completed', introV2: { ...s0.story.introV2, state: 'legacySkipped' } } }));
  }, IDS);
  await page.evaluate(async () => {
    const { GameStore } = await import('/src/ui/gameStore.ts');
    const { SCREENS } = await import('/src/ui/screens/registry.ts');
    const { mountStage } = await import('/src/ui/stage.ts');
    const store = GameStore.fromBrowser();
    const stage = mountStage(document.querySelector('#app'), { qa: false });
    const noop = () => {};
    const screen = SCREENS.gacha.create({ navigate: noop, back: noop, reset: noop, store });
    stage.element.dataset.screen = 'gacha';
    stage.element.replaceChildren(screen.element);
  });
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
  await page.waitForTimeout(1500);
  await waitImages();
  // パックを選ぶ画面：6体のパックが見えるところまでスクロールして撮る
  const total = await page.evaluate(() => document.querySelectorAll('.gacha-select__tile').length);
  for (let i = 0; i < Math.ceil(total / 6); i++) {
    await page.evaluate((i) => document.querySelectorAll('.gacha-select__tile')[i * 6]?.scrollIntoView({ block: 'start' }), i);
    await page.waitForTimeout(500);
    await waitImages();
    await page.screenshot({ path: `${out}/select_${i + 1}.png` });
  }
  // 販売機：1体ずつ機械の画面を置いて撮る
  for (const id of IDS) {
    await page.evaluate(async (id) => {
      const { GACHA_SERIES } = await import('/src/data/economy.ts');
      const { showGachaMachine } = await import('/src/ui/components/gachaMachine.ts');
      const series = GACHA_SERIES.find((s) => s.id === id);
      const root = document.querySelector('#app .stage') || document.querySelector('#app');
      document.querySelectorAll('.gacha-machine').forEach((e) => e.remove());
      const noop = () => {};
      showGachaMachine(root, { series, paid: false, collection: {}, onReselect: noop, onRequestPay: noop, onRates: noop, onTake: noop });
    }, id);
    await page.waitForTimeout(1200);
    await waitImages();
    await page.screenshot({ path: `${out}/machine_${id}.png` });
  }
  await browser.close();
})();
