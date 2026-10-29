// ダンジョンの点検の写真（2026-10-29 夜「ゲーム全体の点検と直し」）。開発用サーバー（npx vite）で動かす。
// ダンジョン7つ × 種3つ × すべての階で、階の始まりの場所に立った画面（見た所は全部ひらく）を撮る。
// 使い方: node tools/e2e/dungeon_audit.cjs http://127.0.0.1:5173/ セーブ.json 出力フォルダ [ダンジョンID,…]
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, only] = process.argv.slice(2);
const save0 = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
const SEEDS = [7919, 15838, 23757];
(async () => {
  const browser = await chromium.launch();
  const ctx0 = await browser.newContext();
  const p0 = await ctx0.newPage();
  await p0.goto(base);
  // 各ダンジョンの階の数・始まりの場所を、ゲームの中の関数で調べる
  const plan = await p0.evaluate(async (seeds) => {
    const { RUN_DUNGEON_IDS } = await import('/src/data/dungeonRun.ts');
    const { floorsOf, runFloor } = await import('/src/game/dungeon/run.ts');
    const list = [];
    for (const dungeonId of RUN_DUNGEON_IDS) for (const seed of seeds) for (let floor = 0; floor < floorsOf(dungeonId); floor++) {
      const f = runFloor({ dungeonId, seed, floor });
      list.push({ dungeonId, seed, floor, x: f.start.x, y: f.start.y, cells: f.width * f.height });
    }
    return list;
  }, SEEDS);
  await ctx0.close();
  for (const s of plan) {
    if (only && !only.split(',').includes(s.dungeonId)) continue;
    const name = `${s.dungeonId}_s${SEEDS.indexOf(s.seed) + 1}_f${s.floor + 1}`;
    const run = {
      dungeonId: s.dungeonId, seed: s.seed, floor: s.floor, x: s.x, y: s.y, dir: 'down', explored: '1'.repeat(s.cells),
      defeated: [], opened: [], losses: 0, gained: [], cooldown: 999, rng: 1, torchFloor: null, mapFloor: null, incenseSteps: 0,
      charm: false, charmUsed: false, luckyCoin: false, rewardChoice: null, sealBoxUsed: false, sealedCard: null, switchFloor: null,
    };
    const save = { ...save0, location: { mapId: 'town', x: 31, y: 186, dir: 'down' }, dungeonRun: run };
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
    await ctx.addInitScript((v) => localStorage.setItem('mistria-battle-card/save', v), JSON.stringify(save));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', name, e.message));
    await page.goto(base + '?qa=1');
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(800);
    const cont = page.locator('text=続きから').first();
    if (await cont.count()) await cont.click();
    await page.waitForTimeout(2500);
    // 入ったときの挿絵・窓が出ていたら閉じる
    for (let i = 0; i < 3; i++) {
      const close = page.locator('.drun__intro, .modal button').first();
      if (!(await close.count())) break;
      await close.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: `${out}/${name}.png` });
    await ctx.close();
  }
  await browser.close();
})();
