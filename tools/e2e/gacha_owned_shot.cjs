// ガチャのモンスターカードは「まだ持っていないときだけ」（2026-10-30 指示書 V）の画面写真：パックを選ぶ所 → シリーズを決めて買い、販売機の上に出る中身の15枠 → 提供割合
// 使い方: node tools/e2e/gacha_owned_shot.cjs URL セーブ.json 出力フォルダ シリーズのID …（W・H で画面の大きさ、LANG=en で英語）
//   セーブの場所は販売機の前 {shop,45,20,up} に書きかえる。出力：select.png・<ID>.png・rates.png
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, outDir, ...ids] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const save = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
  save.location = { mapId: 'shop', x: 45, y: 20, dir: 'up' };
  const browser = await chromium.launch();
  const open = async () => {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
    await ctx.addInitScript(([s, lang]) => {
      localStorage.setItem('mistria-battle-card/save', s);
      localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: lang, seVolume: 0, bgmVolume: 0, muted: true }));
    }, [JSON.stringify(save), LANG]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await page.goto(base);
    await page.waitForTimeout(800);
    await page.locator(LANG === 'en' ? 'text=Continue' : 'text=続きから').first().click();
    await page.waitForTimeout(3200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    return { ctx, page };
  };
  {
    const { ctx, page } = await open();
    await page.screenshot({ path: `${outDir}/select.png` });
    await page.locator('.gacha-select__rates').first().click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${outDir}/rates.png` });
    await ctx.close();
  }
  // シリーズを決めて買う（はい）→ 販売機の上に中身の15枠が出る
  for (const id of ids) {
    const { ctx, page } = await open();
    const tile = page.locator(`.gacha-select__tile[data-series="${id}"]`).first();
    await tile.click();
    await page.waitForTimeout(600);
    await tile.click();
    await page.waitForTimeout(1200);
    await page.locator('.modal .btn--primary').first().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${outDir}/${id}.png` });
    await ctx.close();
  }
  await browser.close();
})();
