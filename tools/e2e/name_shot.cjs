// 使い方: node tools/e2e/name_shot.cjs URL 出力 [幅x高さ]
// 名前の画面（2026-10-28）：最初からで主人公を選ぶ → 名前の窓（入力前・キーボードが出たとき・「○○ でいい？」）→ はいで決まる。
// キーボードは自動の確認では出せないので、visualViewport をまねて（下から 300px が隠れたことにして）灰色の板を重ねる（写真用のまね）。
// 鳴らした音は window.__seLog に記録して確かめる
const { chromium } = require('playwright');
const [base, out, size = '390x844'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const KB = Math.round(H * Number(process.env.KB_RATIO ?? 0.36));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    window.__seLog = [];
    // visualViewport のまね（キーボードの高さを __kb(px) で変える）
    const vv = new EventTarget();
    let kb = 0;
    Object.defineProperties(vv, {
      offsetTop: { get: () => 0 },
      offsetLeft: { get: () => 0 },
      width: { get: () => window.innerWidth },
      height: { get: () => window.innerHeight - kb },
      scale: { get: () => 1 },
    });
    Object.defineProperty(window, 'visualViewport', { get: () => vv });
    window.__kb = (px) => {
      kb = px;
      let el = document.getElementById('fake-kb');
      if (!el) {
        el = document.createElement('div');
        el.id = 'fake-kb';
        el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#d1d3d9;color:#555;font:14px sans-serif;display:flex;align-items:center;justify-content:center;border-top:1px solid #999';
        el.textContent = '（ここに iPhone のキーボード。写真用のまね）';
        document.body.append(el);
      }
      el.style.height = `${px}px`;
      el.style.display = px > 0 ? 'flex' : 'none';
      vv.dispatchEvent(new Event('resize'));
    };
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const shot = (name) => page.screenshot({ path: `${out}/${size}_${name}.png` });
  const se = () => page.evaluate(() => window.__seLog.splice(0));
  await page.goto(base);
  await page.waitForTimeout(800);
  await page.locator('text=最初から').first().click();
  await page.waitForTimeout(500);
  console.log('SE 最初から', await se());
  await page.locator('[data-gender="male"]').click();
  await page.waitForTimeout(200);
  console.log('SE 主人公1回目', await se());
  await page.locator('[data-gender="male"]').click();
  await page.waitForSelector('.name-prompt');
  await page.waitForTimeout(400);
  console.log('SE 主人公2回目', await se());
  await shot('1_empty');
  await page.locator('.name-prompt__ok').click({ force: true });
  await page.waitForTimeout(200);
  console.log('SE 空のまま決定', await se(), 'confirm shown?', await page.locator('.name-prompt__window.is-confirm').count());
  // キーボードが出た（まね）
  await page.locator('.name-prompt__input').click();
  await page.evaluate((px) => window.__kb(px), KB);
  await page.waitForTimeout(500);
  await page.locator('.name-prompt__input').fill('ああああああああああ');
  await page.waitForTimeout(300);
  const value = await page.locator('.name-prompt__input').inputValue();
  console.log('10文字入れたあと', value, value.length);
  const box = await page.locator('.name-prompt__ok').boundingBox();
  const inBox = await page.locator('.name-prompt__input').boundingBox();
  console.log('キーボードの上', H - KB, '入力欄の下', Math.round(inBox.y + inBox.height), '決定の下', Math.round(box.y + box.height));
  await shot('2_keyboard');
  // 記号・絵文字は入らない
  await page.locator('.name-prompt__input').fill('  <ミレ>/😀\\ア  ');
  await page.waitForTimeout(200);
  console.log('記号・絵文字を入れたあと', JSON.stringify(await page.locator('.name-prompt__input').inputValue()));
  await page.locator('.name-prompt__input').fill('ああああああああ');
  await page.locator('.name-prompt__input').blur();
  await page.evaluate(() => window.__kb(0));
  await page.waitForTimeout(400);
  await se();
  await page.locator('.name-prompt__ok').click();
  await page.waitForTimeout(300);
  console.log('SE 決定', await se());
  await shot('3_confirm');
  await page.locator('.name-prompt__no').click();
  await page.waitForTimeout(300);
  console.log('SE いいえ', await se(), 'back to input?', await page.locator('.name-prompt__input:visible').count());
  await page.locator('.name-prompt__ok').click();
  await page.waitForTimeout(200);
  await se();
  await page.locator('.name-prompt__yes').click();
  await page.waitForFunction(() => document.querySelector('.stage')?.dataset.screen === 'world', null, { timeout: 15000 });
  console.log('SE はい', await se());
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('mistria-battle-card/save')));
  console.log('セーブ', save.version, JSON.stringify(save.player));
  await page.waitForTimeout(1500);
  await shot('4_after');
  await browser.close();
})();
