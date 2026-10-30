// 風の渓谷（2026-10-30 指示書 U）の画面写真：ダンジョンを選ぶ所（D で開いている）・入るときの絵と題字・風のマスと押し流されたところ・
// ニコの地図の姿と会話・ボスの間のゼフィラ（前・対戦のひと言・勝ったあとの口をすべらせる一言）・祭壇でツムジを受け取る所。
// 使い方: node tools/e2e/wind_valley_shot.cjs URL セーブのフォルダ 出力フォルダ
//   セーブのフォルダ：base.json（D ランク・街）・wind_0.json〜（風のマスのとなり。__dir が風のマスの向き）・npc_dungeon-08.json・boss_dungeon-08.json
//   （Vitest の一時テスト tests/zz-*.test.ts で作って、終わったら消す）。W・H で画面の大きさ、LANG=en で英語、ONLY=名前,名前 で一部だけ
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
  // 1. ダンジョンを選ぶ所：街の南の出口から出る（D ランク：水の神殿と風の渓谷が開いている）→ 風の渓谷を押す → 入るときの絵と題字
  if (want('select') || want('intro')) {
    const { ctx, page } = await open(browser, { ...load('base.json'), location: { mapId: 'town', x: 100, y: 191, dir: 'down' } });
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(1500);
    await page.keyboard.up('ArrowDown');
    await waitFor(page, '.dungeon-select', 6000);
    await page.waitForTimeout(1200);
    await shot(page, 'select');
    if (want('intro')) {
      await page.locator(`.world-map__pin[aria-label="${LANG === 'en' ? 'Wind Valley' : '風の渓谷'}"]`).first().click();
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
  // 2. 風のマス：となりに立つ → 風のマスへ1歩 → 押し流されている途中・止まったところ
  for (const f of fs.readdirSync(dir).filter((x) => /^wind_\d+\.json$/.test(x)).sort()) {
    const name = f.replace('.json', '');
    if (!want(name)) continue;
    const save = load(f);
    const { ctx, page } = await open(browser, save);
    await shot(page, `${name}_before`);
    const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[save.__dir];
    await page.keyboard.down(key);
    await page.waitForTimeout(90);
    await page.keyboard.up(key);
    await page.waitForTimeout(260);
    await shot(page, `${name}_push`);
    await page.waitForTimeout(900);
    await shot(page, `${name}_after`);
    await ctx.close();
  }
  // 3. ニコ・ゼフィラ：地図 → 話しかける → 対戦の始め → ひと言。ゼフィラは QA:即勝利 → 勝ったあとのひと言 → 祭壇
  for (const name of ['npc_dungeon-08', 'boss_dungeon-08']) {
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
