// カレンダー（2026-10-30 指示書 R2）の写真：街の左上の日付・ベッドの「寝る」の流れ（季節の挿絵あり・なし）・大会の受付で断られる・掲示板・ダンジョンから戻ったとき。
// 使い方: node tools/e2e/calendar_shot.cjs URL 出力フォルダ セーブ.json [before]
//   W・H で画面の大きさ（既定 390×844）、LANG=en で英語、ONLY=名前,名前 で一部だけ。before を付けると前の版で撮れるものだけ撮る
// セーブ.json は Vitest で createNewSave して書き出したもの（docs/handoff.md「画面写真の撮り方」）。calendar・dungeonRun は撮る場面ごとに足す
const { chromium } = require('playwright');
const fs = require('fs');
const [base, outDir, saveFile, mode] = process.argv.slice(2);
const before = mode === 'before';
const save0 = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG_GAME || process.env.LANG_UI || (process.env.LANG === 'en' ? 'en' : 'ja');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const suffix = `${LANG === 'en' ? '_en' : ''}${W !== 390 ? `_${W}x${H}` : ''}`;
fs.mkdirSync(outDir, { recursive: true });

const HOME_BED = { mapId: 'home', x: 8, y: 10, dir: 'left' };
const HALL_DESK = { mapId: 'hall', x: 44, y: 25, dir: 'right' };
const BUREAU_BOARD = { mapId: 'bureau', x: 54, y: 22, dir: 'up' };
const TOWN = { mapId: 'town', x: 31, y: 185, dir: 'down' };

async function open(browser, patch) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
  // 年と月を入れるときは今の形式（version 29。前の形式だと読み込みで「1年目 4月」に戻る）
  const save = { ...save0, ...patch, ...(patch.calendar ? { version: 29 } : {}) };
  await ctx.addInitScript(([s, lang]) => {
    localStorage.setItem('mistria-battle-card/save', s);
    localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: lang, seVolume: 0, bgmVolume: 0, muted: true }));
  }, [JSON.stringify(save), LANG]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.addStyleTag({ content: '.stage-diag{display:none!important} .world__hint{display:none!important}' }).catch(() => {});
  await page.waitForTimeout(800);
  const cont = page.locator(LANG === 'en' ? 'text=Continue' : 'text=続きから').first();
  if (await cont.count()) await cont.click();
  await page.waitForTimeout(2500);
  return { ctx, page };
}

const shot = (page, name) => page.screenshot({ path: `${outDir}/${name}${suffix}.png` });
const press = async (page, key, ms = 120) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(400);
};
const clickText = async (page, text) => {
  const b = page.locator(`button:has-text("${text}")`).first();
  await b.click();
  await page.waitForTimeout(500);
};
/** 会話を最後まで送る（会話の窓があるあいだ画面をタップ） */
const talkThrough = async (page) => {
  for (let i = 0; i < 12; i++) {
    if (!(await page.locator('.talk').count())) return;
    await page.locator('.talk').first().click({ force: true });
    await page.waitForTimeout(450);
  }
};
const want = (name) => !ONLY || ONLY.includes(name);

(async () => {
  const browser = await chromium.launch();
  const ja = LANG !== 'en';

  // 1. 街の左上の日付
  if (want('town')) {
    const { ctx, page } = await open(browser, { location: TOWN });
    await shot(page, 'town');
    await ctx.close();
  }
  // 2. ベッド：コマンド → 寝る → はい → 夜の挿絵 → 月の帯（4月→5月：季節の挿絵なし）→ 朝
  if (want('bed')) {
    const { ctx, page } = await open(browser, { location: HOME_BED, ...(before ? {} : { calendar: { year: 1, month: 4 } }) });
    await press(page, 'Enter');
    await page.waitForTimeout(700);
    await shot(page, 'bed_menu');
    if (!before) {
      await clickText(page, ja ? '寝る' : 'Sleep');
      await shot(page, 'bed_confirm');
      await clickText(page, ja ? 'はい' : 'Yes');
      await page.waitForTimeout(1300);
      await shot(page, 'bed_night');
      await page.waitForTimeout(2300);
      await shot(page, 'bed_banner_may');
      await page.waitForTimeout(3200);
      await shot(page, 'bed_morning');
    }
    await ctx.close();
  }
  // 3. 寝る（5月→6月：夏の挿絵 → 帯）
  if (want('season') && !before) {
    const { ctx, page } = await open(browser, { location: HOME_BED, calendar: { year: 1, month: 5 } });
    await press(page, 'Enter');
    await page.waitForTimeout(600);
    await clickText(page, ja ? '寝る' : 'Sleep');
    await clickText(page, ja ? 'はい' : 'Yes');
    await page.waitForTimeout(3900);
    await shot(page, 'season_art');
    await page.waitForTimeout(1400);
    await shot(page, 'season_banner');
    await page.waitForTimeout(3000);
    await shot(page, 'season_morning');
    await ctx.close();
  }
  // 4. 大会の受付（4月：次は6月・断られる）
  if (want('desk')) {
    const { ctx, page } = await open(browser, { location: HALL_DESK, ...(before ? {} : { calendar: { year: 1, month: 4 } }) });
    await press(page, 'Enter');
    await page.waitForTimeout(600);
    await talkThrough(page);
    await page.waitForTimeout(1200);
    await shot(page, 'desk');
    await page.locator('.tournament__body').evaluate((el) => el.scrollTo(0, 260)).catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, 'desk_scroll');
    await ctx.close();
  }
  // 5. 大会の受付（6月だがボスを倒していない）
  if (want('deskboss') && !before) {
    const { ctx, page } = await open(browser, { location: HALL_DESK, calendar: { year: 1, month: 6 } });
    await press(page, 'Enter');
    await page.waitForTimeout(600);
    await talkThrough(page);
    await page.waitForTimeout(1200);
    await shot(page, 'desk_june_noboss');
    await ctx.close();
  }
  // 6. 管理局の掲示板（4月・10月）
  for (const [name, month] of [['board', 4], ['board_oct', 10], ['board_jun', 6]]) {
    if (!want(name) || (before && name !== 'board')) continue;
    const patch = { location: BUREAU_BOARD, ...(before ? {} : { calendar: { year: 1, month } }) };
    if (name === 'board_jun') patch.dungeons = { 'dungeon-02': { openedChests: [], bossDefeated: true, clears: 1 } };
    const { ctx, page } = await open(browser, patch);
    await press(page, 'Enter');
    await page.waitForTimeout(900);
    await shot(page, name);
    await ctx.close();
  }
  // 7. ダンジョンから帰還の羽根で戻る（街に戻ったときの月の帯）
  if (want('dungeon') && !before && save0.__run) {
    const { ctx, page } = await open(browser, { dungeonRun: save0.__run, items: { returnFeather: 1 }, location: { mapId: 'town', x: 100, y: 205, dir: 'down' }, calendar: { year: 1, month: 4 } });
    await page.locator('.drun__menu-btn').click();
    await page.waitForTimeout(500);
    await page.locator('.drun__menu-row--button').click();
    await page.waitForTimeout(500);
    await page.locator('.drun__item .btn').first().click();
    await page.waitForTimeout(500);
    await clickText(page, ja ? 'はい' : 'Yes');
    await page.waitForTimeout(2600);
    await shot(page, 'dungeon_back_msg');
    await page.locator('.modal .btn--primary').first().click().catch(() => {});
    await page.waitForTimeout(700);
    await shot(page, 'dungeon_back_banner');
    await page.waitForTimeout(2500);
    await shot(page, 'dungeon_back_town');
    await ctx.close();
  }
  await browser.close();
})();
