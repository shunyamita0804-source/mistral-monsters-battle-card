// 2026-11-02 当たり判定の点検（街・部屋）。開発用サーバー（npx vite --port 5173 --host 127.0.0.1）で動かす。ゲームのファイルは変えない。
// 使い方: node tools/e2e/collision_probe.cjs URL 出力フォルダ 台本.json [名前,名前]
//   台本.json：[{ "name": "bureau_board", "at": { "mapId": "bureau", "x": 30, "y": 20, "dir": "left" },
//                "steps": ["L3", "shot", "E", "shot:after"] }, ...]
//   L・R・U・D＋回数＝その向きへ1マスずつ進む（進めなければそこで止まる。向きは変わる）。E＝調べる（Enter）。W＋ミリ秒＝待つ。
//   shot・shot:名前＝写真。ESC＝窓を閉じる。どの手も、そのあとの位置（地図・x・y）と、出ている窓の文字を記録する（出力フォルダ/log.json）
//   HIT=0 で当たりの網目（?qa=1&hit=1）を出さない。導入は終わったセーブ（すべての建物に入れる）。
//   "intro": { "state": "escortToSchool", ... } で導入の進み具合を、"fresh": true で新しく始めたセーブ（カード無し）を使う
const { chromium } = require('playwright');
const fs = require('fs');
const [base, outDir, scriptFile, onlyArg] = process.argv.slice(2);
const ONLY = onlyArg ? onlyArg.split(',') : null;
const HIT = process.env.HIT !== '0';
fs.mkdirSync(outDir, { recursive: true });
const scenarios = JSON.parse(fs.readFileSync(scriptFile, 'utf8'));
const KEY = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown' };

async function open(browser, at, intro, fresh) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: 'ja', seVolume: 0, bgmVolume: 0, muted: true }));
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(800);
  await page.evaluate(async ([at, intro, fresh]) => {
    const { createNewSave, createNewGameSave } = await import('/src/game/save/saveData.ts');
    const s = fresh ? createNewGameSave(new Date(2026, 10, 2)) : createNewSave(new Date(2026, 10, 2));
    const done = { state: 'completed', selectedBoosterKey: 'booster-1', boosterClaimed: true, boosterGranted: true, examPassed: true };
    const story = { ...s.story, introV2: { ...s.story.introV2, ...(intro ? intro : done) } };
    localStorage.setItem('mistria-battle-card/save', JSON.stringify({ ...s, player: { gender: 'male', name: 'テスト' }, coins: 5000, story, location: at }));
  }, [at, intro || null, !!fresh]);
  await page.goto(base + (HIT ? '?qa=1&hit=1' : '?qa=1'));
  await page.addStyleTag({ content: '.stage-diag{display:none!important} .world__hint{display:none!important}' }).catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('text=続きから').first().click();
  await page.waitForTimeout(2500);
  return { ctx, page };
}
const loc = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('mistria-battle-card/save') || '{}').location);
const dialog = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('.modal, .world__message, .dialog, [role="dialog"]');
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) : null;
  });

async function step(page, key) {
  let l = await loc(page);
  const before = `${l.mapId}:${l.x},${l.y}`;
  await page.keyboard.down(key);
  await page.waitForTimeout(40);
  await page.keyboard.up(key);
  const end = Date.now() + 900;
  while (Date.now() < end) {
    l = await loc(page);
    if (`${l.mapId}:${l.x},${l.y}` !== before) break;
    await page.waitForTimeout(15);
  }
  return `${l.mapId}:${l.x},${l.y}` !== before;
}

(async () => {
  const browser = await chromium.launch();
  const log = {};
  for (const sc of scenarios) {
    if (ONLY && !ONLY.includes(sc.name)) continue;
    const { ctx, page } = await open(browser, sc.at, sc.intro, sc.fresh);
    const rec = [];
    let n = 0;
    for (const s of sc.steps) {
      if (s.startsWith('shot')) {
        n += 1;
        const label = s.split(':')[1] || '';
        await page.screenshot({ path: `${outDir}/${sc.name}_${String(n).padStart(2, '0')}${label ? `_${label}` : ''}.png` });
        continue;
      }
      if (s === 'E') {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(900);
      } else if (s === 'ESC') {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      } else if (s[0] === 'W') {
        await page.waitForTimeout(+s.slice(1));
      } else {
        const count = +(s.slice(1) || 1);
        let moved = 0;
        for (let i = 0; i < count; i++) {
          if (!(await step(page, KEY[s[0]]))) break;
          moved++;
          await page.waitForTimeout(60);
        }
        if (moved < count) await page.waitForTimeout(400); // 進めなかった（向きだけ変わる）
      }
      const l = await loc(page);
      rec.push({ step: s, at: `${l.mapId}:${l.x},${l.y}`, dir: l.dir, dialog: await dialog(page) });
    }
    log[sc.name] = rec;
    console.log(sc.name, rec.map((r) => `${r.step}→${r.at}${r.dialog ? ` [${r.dialog.slice(0, 30)}]` : ''}`).join(' | '));
    await ctx.close();
  }
  fs.writeFileSync(`${outDir}/log.json`, JSON.stringify(log, null, 1));
  await browser.close();
})();
