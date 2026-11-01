// 2026-11-01 指示書 AI：歩く様子の連続写真（練習場の自動歩行・大会会場の受付と対戦表）。
// 使い方: node tools/e2e/ai_walk_shot.cjs URL 出力フォルダ base.json escort.json [名前,名前]
//   base.json：導入のあとのセーブ。escort.json：導入の「練習場へ連れて行く」所のセーブ（どちらも Vitest で createNewSave して書き出したもの）
//   HIT=1 で当たりの網目（?qa=1&hit=1）。キーを押し続け、セーブの位置（1歩ごとに書かれる）が決めた所に着いたら離す。そのあいだ STEP_MS ごとに写真
const { chromium } = require('playwright');
const fs = require('fs');
const [base, outDir, baseFile, escortFile, onlyArg] = process.argv.slice(2);
const ONLY = onlyArg ? onlyArg.split(',') : null;
const HIT = process.env.HIT === '1';
const STEP_MS = +(process.env.STEP_MS || 260);
fs.mkdirSync(outDir, { recursive: true });
const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

async function open(browser, save) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript((s) => {
    localStorage.setItem('mistria-battle-card/save', s);
    localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: 'ja', seVolume: 0, bgmVolume: 0, muted: true }));
  }, JSON.stringify(save));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base + (HIT ? '?qa=1&hit=1' : '?qa=1'));
  await page.addStyleTag({ content: '.stage-diag{display:none!important} .world__hint{display:none!important}' }).catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('text=続きから').first().click();
  return { ctx, page };
}
const loc = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('mistria-battle-card/save') || '{}').location);

/** key を押して1マスずつ進み、until(位置) が true になったら止まる（押し続けると止まる所が1〜2マス先にずれるので、1歩ずつ）。1歩ごとに写真 */
async function hold(page, key, until, shots, maxSteps = 40) {
  let l = await loc(page);
  for (let i = 0; i < maxSteps && !until(l); i++) {
    const before = `${l.x},${l.y}`;
    await page.keyboard.down(key);
    await page.waitForTimeout(40);
    await page.keyboard.up(key);
    const end = Date.now() + 1500;
    while (Date.now() < end) {
      l = await loc(page);
      if (`${l.x},${l.y}` !== before) break;
      await page.waitForTimeout(15);
    }
    if (`${l.x},${l.y}` === before) break; // 進めない
    await shots();
  }
  await page.waitForTimeout(150);
  l = await loc(page);
  console.log('  ', key, '→', l && `${l.x},${l.y}`);
  return l;
}

async function run(browser, name, save, steps) {
  if (ONLY && !ONLY.includes(name)) return;
  console.log(name);
  const { ctx, page } = await open(browser, save);
  await page.waitForTimeout(+(process.env.WAIT || 3000));
  let n = 0;
  const shot = async (label = '') => {
    n += 1;
    await page.screenshot({ path: `${outDir}/${name}_${String(n).padStart(2, '0')}${label ? `_${label}` : ''}.png` });
  };
  await shot('start');
  await steps(page, shot);
  await ctx.close();
}

(async () => {
  const b = load(baseFile);
  const e = load(escortFile);
  const browser = await chromium.launch();
  // 1. 練習場：入口から先生の前へ自動で歩く（導入の「練習場へ連れて行く」の続き）
  await run(browser, 'practice_auto', { ...e, location: { mapId: 'practice', x: 29, y: 30, dir: 'up' } }, async (page, shot) => {
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(STEP_MS);
      await shot();
    }
  });
  // 2. 大会会場：入口 → 受付の前（上へ1歩・右へ）→ 入口へ戻る
  await run(browser, 'hall_counter', { ...b, location: { mapId: 'hall', x: 30, y: 31, dir: 'up' } }, async (page, shot) => {
    await hold(page, 'ArrowUp', (l) => l.y <= 29, shot);
    await hold(page, 'ArrowRight', (l) => l.x >= 46, shot);
    await shot('front');
    await hold(page, 'ArrowLeft', (l) => l.x <= 30, shot);
    await hold(page, 'ArrowDown', (l) => l.y >= 33, shot);
    await shot('back');
  });
  // 3. 大会会場：対戦表の前へ、長いすの右（舞台とのあいだ）から
  await run(browser, 'hall_board_right', { ...b, location: { mapId: 'hall', x: 30, y: 31, dir: 'up' } }, async (page, shot) => {
    await hold(page, 'ArrowUp', (l) => l.y <= 23, shot);
    await hold(page, 'ArrowLeft', (l) => l.x <= 15, shot);
    await hold(page, 'ArrowUp', (l) => l.y <= 16, shot);
    await hold(page, 'ArrowLeft', (l) => l.x <= 9, shot);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
    await shot('front');
  });
  // 4. 大会会場：対戦表の前へ、長いすの左（左の壁ぞい）から
  await run(browser, 'hall_board_left', { ...b, location: { mapId: 'hall', x: 2, y: 30, dir: 'up' } }, async (page, shot) => {
    await hold(page, 'ArrowUp', (l) => l.y <= 16, shot);
    await hold(page, 'ArrowRight', (l) => l.x >= 8, shot);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
    await shot('front');
  });
  await browser.close();
})();
