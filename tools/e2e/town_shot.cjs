// 街・部屋の好きな場所の画面写真を撮る（2026-10-28 街の作り直しで使った）。
// 使い方: node tools/e2e/town_shot.cjs 公開URLかプレビューのURL 撮る場所.json 出力フォルダ セーブ.json（W・H・DPR で画面の大きさ、qs で ?qa=1 のあとに足す文字〔&hit=1 で当たり判定・&fig=1.15 で人の大きさ〕。2026-10-29）
// 撮る場所.json の例: [{"name":"plaza","loc":{"mapId":"town","x":100,"y":124,"dir":"up"},"keys":["ArrowDown:900"],"after":2000}]
// セーブ.json は Vitest で createNewSave して書き出したもの（docs/handoff.md「画面写真の撮り方」）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, shotsFile, outDir, saveFile] = process.argv.slice(2);
const save0 = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
save0.player = { name: 'ユウ', ...save0.player, gender: 'male' };
const shots = JSON.parse(fs.readFileSync(shotsFile, 'utf8'));
(async () => {
  const browser = await chromium.launch();
  for (const sh of shots) {
    const ctx = await browser.newContext({ viewport: { width: +(process.env.W || 390), height: +(process.env.H || 844) }, deviceScaleFactor: +(process.env.DPR || 2), hasTouch: true });
    const save = { ...save0, location: sh.loc, ...(sh.patch || {}) };
    await ctx.addInitScript((s) => { localStorage.setItem('mistria-battle-card/save', s); }, JSON.stringify(save));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', sh.name, e.message));
    await page.goto(base + (sh.qa ? '?qa=1' + (sh.qs || '') : ''));
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(800);
    const cont = page.locator('text=続きから').first();
    if (await cont.count()) await cont.click();
    await page.waitForTimeout(sh.wait || 2500);
    for (const k of sh.keys || []) {
      if (k.startsWith('wait:')) { await page.waitForTimeout(+k.slice(5)); continue; }
      const [key, ms] = k.split(':');
      await page.keyboard.down(key); await page.waitForTimeout(+(ms || 200)); await page.keyboard.up(key);
      await page.waitForTimeout(300);
    }
    if (sh.after) await page.waitForTimeout(sh.after);
    await page.screenshot({ path: `${outDir}/${sh.name}.png` });
    if (sh.report) {
      const info = await page.evaluate(() => {
        const r = document.querySelector('.world');
        return { map: r?.getAttribute('data-map') };
      });
      console.log(sh.name, JSON.stringify(info));
    }
    await ctx.close();
  }
  await browser.close();
})();
