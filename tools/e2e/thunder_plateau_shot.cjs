// 雷の高原（2026-11-01 指示書 AH）の画面写真：ダンジョンを選ぶ所（B で開いている）・入るときの絵と題字・床と飾り・落雷の予告と落ちる所・
// 「雷に打たれた！」から見えない番人との対戦・ルカの地図の姿と会話・ボスの間のステラ（前・対戦のひと言・勝ったあと）・祭壇でハクランを受け取る所。
// 使い方: node tools/e2e/thunder_plateau_shot.cjs URL セーブのフォルダ 出力フォルダ（風の渓谷の wind_valley_shot.cjs と同じ作り）
//   セーブのフォルダ：base.json（B ランク・街）・thunder_safe.json・thunder_strike.json（__dir：予告の無いとなり／予告のあるとなりへの向き）・
//   npc_dungeon-09.json・boss_dungeon-09.json（Vitest の一時テストで作って、終わったら消す）。W・H で画面の大きさ、LANG=en で英語、ONLY=名前,名前 で一部だけ
const { chromium } = require('playwright');
const fs = require('fs');
const [base, dir, outDir] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const suffix = `${LANG === 'en' ? '_en' : ''}${W !== 390 ? `_${W}x${H}` : ''}`;
const want = (name) => !ONLY || ONLY.includes(name);
fs.mkdirSync(outDir, { recursive: true });
const load = (f) => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));

async function open(browser, save, qa = false) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(([s, lang]) => {
    localStorage.setItem('mistria-battle-card/save', s);
    localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: lang, seVolume: 0, bgmVolume: 0, muted: true }));
  }, [JSON.stringify(save), LANG]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base + (qa ? '?qa=1' : ''));
  await page.addStyleTag({ content: '.stage-diag{display:none!important} .world__hint{display:none!important}' }).catch(() => {});
  await page.waitForTimeout(800);
  await page.locator(LANG === 'en' ? 'text=Continue' : 'text=続きから').first().click();
  await page.waitForTimeout(+(process.env.WAIT || 3200));
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: `${outDir}/${name}${suffix}.png` });
const waitFor = async (page, sel, ms) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await page.locator(sel).count()) return true;
    await page.waitForTimeout(150);
  }
  return false;
};

(async () => {
  const browser = await chromium.launch();
  // 1. ダンジョンを選ぶ所：街の南の出口から出る（B ランク：炎の火山と雷の高原が開いている）→ 雷の高原を押す → 入るときの絵と題字
  if (want('select') || want('intro')) {
    const { ctx, page } = await open(browser, { ...load('base.json'), location: { mapId: 'town', x: 100, y: 191, dir: 'down' } });
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(1500);
    await page.keyboard.up('ArrowDown');
    await waitFor(page, '.dungeon-select', 6000);
    await page.waitForTimeout(1200);
    await shot(page, 'select');
    if (want('intro')) {
      await page.locator(`.world-map__pin[aria-label="${LANG === 'en' ? 'Thunder Plateau' : '雷の高原'}"]`).first().click();
      await page.waitForTimeout(500);
      const ok = page.locator('.modal .btn--primary');
      if (await ok.count()) await ok.first().click();
      await page.waitForTimeout(900);
      await shot(page, 'intro_a');
      await page.waitForTimeout(1300);
      await shot(page, 'intro_b');
      await page.waitForTimeout(3500);
      await shot(page, 'intro_c');
    }
    await ctx.close();
  }
  // 2. 落雷：予告の印が出ている所 → 1歩（safe：予告の無いとなりへ。ほかのマスに稲妻が落ちる／strike：予告のマスへ。雷に打たれた！→ 番人）
  for (const name of ['thunder_safe', 'thunder_strike', 'thunder_floor']) {
    if (!want(name)) continue;
    const save = load(`${name}.json`);
    const { ctx, page } = await open(browser, save);
    await shot(page, `${name}_0before`);
    const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[save.__dir];
    await page.keyboard.down(key);
    await page.waitForTimeout(90);
    await page.keyboard.up(key);
    await page.waitForTimeout(40);
    await shot(page, `${name}_1bolt`);
    await page.waitForTimeout(900);
    await shot(page, `${name}_2after`);
    if (name === 'thunder_strike') {
      // 煙玉を持っているので「戦う」か「煙玉」の窓 →「戦う」→ 対戦の始め
      await page.locator(`.modal button:has-text("${LANG === 'en' ? 'Fight' : '戦う'}")`).first().click().catch(() => page.locator('.modal button').last().click());
      await waitFor(page, '.battle-order__card, .battle__talk', 9000);
      await page.waitForTimeout(1200);
      await shot(page, `${name}_3battle`);
    }
    await ctx.close();
  }
  // 3. ルカ・ステラ：地図 → 話しかける → 対戦の始め → ひと言。ステラは QA:即勝利 → 勝ったあとのひと言 → 祭壇
  for (const name of ['npc_dungeon-09', 'boss_dungeon-09']) {
    if (!want(name)) continue;
    const { ctx, page } = await open(browser, load(`${name}.json`), true);
    await shot(page, `${name}_0map`);
    await page.keyboard.press('z');
    await page.waitForTimeout(900);
    await shot(page, `${name}_1talk`);
    await page.locator('.modal button').last().click();
    await page.waitForTimeout(4200);
    await page.mouse.click(115, Math.round(H * 0.693));
    await waitFor(page, '.battle__talk', 8000);
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelectorAll('.battle__qa').forEach((e) => (e.style.visibility = 'hidden')));
    await shot(page, `${name}_2start`);
    await page.evaluate(() => document.querySelectorAll('.battle__qa').forEach((e) => (e.style.visibility = '')));
    if (name.startsWith('boss_')) {
      await page.locator(LANG === 'en' ? 'text=QA: Instant Win' : 'text=QA:即勝利').first().click().catch(async () => page.locator('.battle__qa button').nth(1).click());
      await page.waitForTimeout(2600);
      await page.evaluate(() => document.querySelectorAll('.battle__qa').forEach((e) => (e.style.visibility = 'hidden')));
      await shot(page, `${name}_3win`);
      await page.locator(`button:has-text("${LANG === 'en' ? 'Continue' : '続ける'}")`).first().click();
      await waitFor(page, '.drun__talk-visual', 15000);
      await page.waitForTimeout(800);
      await shot(page, `${name}_4keeper`);
      await page.locator('.modal button').last().click();
      await page.waitForTimeout(1500);
      await shot(page, `${name}_5altar`);
      await page.locator('.modal button').last().click().catch(() => {});
      await page.waitForTimeout(1500);
      await shot(page, `${name}_6altar2`);
    }
    await ctx.close();
  }
  await browser.close();
})();
