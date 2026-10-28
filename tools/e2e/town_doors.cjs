// 街の11か所の入口を全部ためす：扉の前で上キー → 部屋に入る → 下キーで外へ → 扉の前に戻ったかを表示（2026-10-28）。
// 使い方: node tools/e2e/town_doors.cjs URL 出力フォルダ セーブ.json [ARENA,SHOP など]
const { chromium } = require('playwright');
const fs = require('fs');
const [base, outDir, saveFile, onlyArg] = process.argv.slice(2);

const save0 = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
save0.player = { gender: 'male' };
const src = fs.readFileSync(__dirname + '/../../src/data/worldArt.generated.ts', 'utf8');
const ti = src.indexOf('"town"'); const di = src.indexOf('"doors"', ti);
let depth = 0, j = src.indexOf('{', di), start = j;
for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
const doors = JSON.parse(src.slice(start, j + 1));
const only = onlyArg ? onlyArg.split(',') : Object.keys(doors);
(async () => {
  const browser = await chromium.launch();
  for (const id of only) {
    const d = doors[id];
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
    const save = { ...save0, location: { mapId: 'town', x: d.back.x, y: d.back.y, dir: 'up' } };
    await ctx.addInitScript((s) => { if (!sessionStorage.getItem('init')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('init', '1'); } }, JSON.stringify(save));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', id, e.message));
    await page.goto(base);
    await page.waitForTimeout(700);
    await page.locator('text=続きから').first().click();
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${outDir}/door_${id}.png` });
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(500); await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(2200);
    const inside = await page.evaluate(() => document.querySelector('[data-map]')?.getAttribute('data-map'));
    // 出口へ：下へ歩き続ける
    let back = inside;
    for (let i = 0; i < 12 && back !== 'town'; i++) {
      await page.keyboard.down('ArrowDown'); await page.waitForTimeout(700); await page.keyboard.up('ArrowDown');
      await page.waitForTimeout(500);
      back = await page.evaluate(() => document.querySelector('[data-map]')?.getAttribute('data-map'));
    }
    await page.waitForTimeout(1500);
    const loc = await page.evaluate(() => JSON.parse(localStorage.getItem('mistria-battle-card/save')).location);
    await page.screenshot({ path: `${outDir}/door_${id}_out.png` });
    console.log(id, 'in:', inside, 'back:', back, 'loc', JSON.stringify(loc), 'expected', d.back.x, d.back.y);
    await ctx.close();
  }
  await browser.close();
})();
