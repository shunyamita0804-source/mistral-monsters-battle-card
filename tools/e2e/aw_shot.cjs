// 2026-11-02 指示書 AW：iPhone の試遊で見つかった画面6つの写真（前と後）。開発用サーバー（npx vite --port 5173 --host 127.0.0.1）で動かす。
// 使い方: node tools/e2e/aw_shot.cjs URL 出力フォルダ [前につける名前]（W・H で画面の大きさ。ふだんは 390×844）
//   01 技カードを選ぶ（枚数）・02 技カードを選ぶ（カードをタップ）・03 デッキ編集の表・04 ガチャの機械・05 家の机の前・06 名刺図鑑（一覧と大きな名刺）
//   セーブ：疾風（ガウル・ラズック・ツムジ）の箱の中身とデッキ。導入は終わり、AT のイベントは見たことにする
const { chromium } = require('playwright');
const fs = require('fs');
const [base, outDir, prefix = ''] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const size = `_${W}x${H}`;
fs.mkdirSync(outDir, { recursive: true });

async function open(browser, where) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: 'ja', seVolume: 0, bgmVolume: 0, muted: true }));
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(800);
  await page.evaluate(async (where) => {
    const { createNewSave } = await import('/src/game/save/saveData.ts');
    const { STORY_EVENTS, storyEventFlag } = await import('/src/data/storyEvents.ts');
    const { boosterDeck, boosterCardCounts } = await import('/src/game/story/introV2.ts');
    const { HOME } = await import('/src/data/maps.ts');
    const { PEOPLE } = await import('/src/data/people.ts');
    const s0 = createNewSave(new Date(2026, 10, 2));
    const key = 'booster-2';
    const story = { ...s0.story, introV2: { ...s0.story.introV2, state: 'completed', selectedBoosterKey: key, boosterClaimed: true, boosterGranted: true, examPassed: true } };
    let location = where;
    if (where === 'desk') {
      // 机の真ん中の前（下）の行。主人公は上（机）を向く
      const desk = HOME.objects.find((o) => o.id === 'home-desk');
      location = { mapId: 'home', x: desk.x + Math.floor(desk.w / 2), y: desk.y + desk.h, dir: 'up' };
    }
    const save = {
      ...s0,
      player: { gender: 'male', name: 'テスト' },
      coins: 5000,
      story,
      deck: boosterDeck(key),
      collection: boosterCardCounts(key),
      storyFlags: [...s0.storyFlags, ...STORY_EVENTS.map((e) => storyEventFlag(e.id))],
      // 名刺図鑑：番号 1〜6 の人に会ったことにする（写真のミレイユ・セリア・ガレスなど）
      peopleBook: { ...s0.peopleBook, met: PEOPLE.filter((p) => p.no <= 6).map((p) => p.id) },
      location,
    };
    localStorage.setItem('mistria-battle-card/save', JSON.stringify(save));
  }, where);
  await page.goto(base + '?qa=1');
  await page.addStyleTag({ content: '.stage-diag{display:none!important} .world__hint{display:none!important}' }).catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('text=続きから').first().click();
  await page.waitForTimeout(2500);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();
  const shot = (page, name) => page.screenshot({ path: `${outDir}/${prefix}${name}${size}.png` });

  // 03・01・02：家の机 → デッキ編集 → 技カードを選ぶ → 1枚目をタップ
  {
    const { ctx, page } = await open(browser, 'desk');
    await shot(page, '05_desk');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    await shot(page, '03_deck');
    await page.locator('button:has-text("技カードを選ぶ")').first().click();
    await page.waitForTimeout(1200);
    // ラズックの組（写真と同じ）
    await page.locator('button:has-text("ラズック")').first().click().catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, '01_skills');
    await page.locator('text=ひっかき').first().click();
    await page.waitForTimeout(900);
    await shot(page, '02_preview');
    await ctx.close();
  }
  // 04：販売機の前 → ガウルのパック → 機械
  {
    const { ctx, page } = await open(browser, { mapId: 'shop', x: 45, y: 20, dir: 'up' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    const tile = page.locator('.gacha-select__tile[data-series="gauul"]');
    await tile.click();
    await page.waitForTimeout(600);
    await tile.click();
    await page.waitForTimeout(1200);
    await page.locator('.modal button:has-text("はい")').first().click();
    await page.waitForTimeout(2500);
    await shot(page, '04_gacha');
    await ctx.close();
  }
  // 06：家の本棚 → 名刺図鑑 → ミレイユの大きな名刺
  {
    const { ctx, page } = await open(browser, { mapId: 'home', x: 19, y: 10, dir: 'up' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    await shot(page, '06_list');
    const first = page.locator('[data-person]').first();
    await first.click();
    await page.waitForTimeout(800);
    await shot(page, '06_card');
    await ctx.close();
  }
  await browser.close();
})();
