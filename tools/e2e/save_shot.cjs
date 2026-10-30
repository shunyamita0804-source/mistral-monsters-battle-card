// セーブを入れて「続きから」を押し、そのまま画面を撮る（2026-10-30 指示書 V。ダンジョンの重なりの前後・前のセーブの案内など）。
// 使い方: node tools/e2e/save_shot.cjs URL セーブ.json 出力.png [キー …]（W・H で画面の大きさ、LANG=en で英語、WAIT=ミリ秒、CROP="x,y,w,h" で切り取り）
//   キー：z（調べる）・Enter・ArrowDown など。「wait:ミリ秒」で待つ。「click:セレクタ」でその場所を押す（街では z が効かないので click:.world__action）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, ...keys] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(([s, lang]) => {
    localStorage.setItem('mistria-battle-card/save', s);
    localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: lang, seVolume: 0, bgmVolume: 0, muted: true }));
  }, [fs.readFileSync(saveFile, 'utf8'), LANG]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.addStyleTag({ content: '.stage-diag{display:none!important} .world__hint{display:none!important}' }).catch(() => {});
  await page.waitForTimeout(800);
  await page.locator(LANG === 'en' ? 'text=Continue' : 'text=続きから').first().click();
  await page.waitForTimeout(+(process.env.WAIT || 3200));
  for (const k of keys) {
    if (k.startsWith('wait:')) await page.waitForTimeout(+k.slice(5));
    else if (k.startsWith('click:')) {
      await page.locator(k.slice(6)).first().click();
      await page.waitForTimeout(700);
    }
    else {
      await page.keyboard.press(k);
      await page.waitForTimeout(700);
    }
  }
  const crop = process.env.CROP ? process.env.CROP.split(',').map(Number) : null;
  await page.screenshot({ path: out, ...(crop ? { clip: { x: crop[0], y: crop[1], width: crop[2], height: crop[3] } } : {}) });
  await browser.close();
})();
