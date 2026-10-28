// 使い方: node tools/e2e/name_places_shot.cjs URL セーブのフォルダ 出力 [幅x高さ] [番号 0|1|2]
// 8文字の名前が出る所の画面写真（2026-10-28）。セーブのフォルダには exam_N・league_N・bracket_N・home_N.json（名前入り。N＝0〜2）。
//   exam：試験の対戦の先攻・後攻の画面（上の VS）／league：大会の受付（総当たり表）と会場の壁の板／bracket：トーナメント表／home：大会の受付（ようこそ）・名刺図鑑
const { chromium } = require('playwright');
const fs = require('fs');
const [base, dir, out, size = '390x844', which = '0'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const screen = (page) => page.evaluate(() => document.querySelector('.stage')?.dataset.screen);
const waitScreen = (page, id, timeout = 20000) => page.waitForFunction((id) => document.querySelector('.stage')?.dataset.screen === id, id, { timeout });

async function open(browser, file, patch = {}) {
  const save = { ...JSON.parse(fs.readFileSync(`${dir}/${file}`, 'utf8')), ...patch };
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(save));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', file, e.message));
  await page.goto(base);
  await page.waitForTimeout(800);
  await page.locator('text=続きから').first().click();
  await page.waitForTimeout(2500);
  return { ctx, page };
}
const act = async (page) => {
  const b = page.locator('.world__action');
  if (await b.count()) await b.first().click();
  else await page.keyboard.press('z');
};
/** 会話を最後まで進めて、screen の画面になるまで待つ */
const talkUntil = async (page, id) => {
  for (let i = 0; i < 40 && (await screen(page)) !== id; i++) {
    if (await page.$('.talk__window')) await page.click('.talk__window').catch(() => {});
    await page.waitForTimeout(400);
  }
  if ((await screen(page)) !== id) console.log('開かない', id, await screen(page));
};

(async () => {
  const browser = await chromium.launch();
  const tag = `${size}_n${which}`;
  const shot = (page, name) => page.screenshot({ path: `${out}/${tag}_${name}.png` });

  // 1. 対戦の VS（試験。会話を進めると対戦が始まる）
  {
    const { ctx, page } = await open(browser, `exam_${which}.json`);
    for (let i = 0; i < 60 && (await screen(page)) !== 'battle'; i++) {
      if (await page.$('.talk__window')) await page.click('.talk__window').catch(() => {});
      else if (await page.$('.modal .btn--primary')) await page.click('.modal .btn--primary').catch(() => {});
      await page.waitForTimeout(400);
    }
    await page.waitForSelector('.battle-order__card', { timeout: 20000 });
    await page.waitForTimeout(900);
    await shot(page, '1_vs');
    await ctx.close();
  }
  // 2. 大会の受付（ようこそ・総当たり表）
  {
    const { ctx, page } = await open(browser, `league_${which}.json`, { location: { mapId: 'hall', x: 41, y: 25, dir: 'right' } });
    await act(page);
    await talkUntil(page, 'tournament');
    await page.waitForTimeout(1200);
    await shot(page, '2_tournament_league');
    await ctx.close();
  }
  // 3. 会場の壁の板（総当たり表を大きく）
  {
    const { ctx, page } = await open(browser, `league_${which}.json`, { location: { mapId: 'hall', x: 10, y: 14, dir: 'left' } });
    await act(page);
    await page.waitForTimeout(1500);
    await shot(page, '3_hall_board');
    await ctx.close();
  }
  // 4. トーナメント表と自分の札
  {
    const { ctx, page } = await open(browser, `bracket_${which}.json`, { location: { mapId: 'hall', x: 41, y: 25, dir: 'right' } });
    await act(page);
    await talkUntil(page, 'tournament');
    await page.waitForTimeout(1200);
    await shot(page, '4_bracket');
    await ctx.close();
  }
  // 4b. 大会の受付（参加する前：ようこそ）
  {
    const { ctx, page } = await open(browser, `home_${which}.json`, { location: { mapId: 'hall', x: 41, y: 25, dir: 'right' } });
    await act(page);
    await talkUntil(page, 'tournament');
    await page.waitForTimeout(1200);
    await shot(page, '5_welcome');
    await ctx.close();
  }
  // 5. 名刺図鑑・ベッド（冒険の記録）
  {
    const { ctx, page } = await open(browser, `home_${which}.json`, { location: { mapId: 'home', x: 19, y: 10, dir: 'up' } });
    await act(page);
    await page.waitForTimeout(1500);
    await shot(page, '6_people_book');
    await ctx.close();
  }
  await browser.close();
})();
