// 2026-11-05 指示書 AY：モンスターカードの名前（ゲームが書く）の写真。開発用サーバーで動かす。
// 使い方: node tools/e2e/ay_names_shot.cjs URL 出力フォルダ モード（W・H で画面の大きさ）
//   compare … 5体（ガウル・ソラモ・ヒョウズク・タイラント・セレフィーン）× 字体3案 × 日本語／英語。左＝前の手描きの名前（design-parts/card-names-20261105/old/）、右＝新しい名前
//   all     … 20体すべて（日本語・英語。FONT=a|b|c）
//   box     … 箱を開けた画面（烈火の3枚。FONT=a|b|c、LANG=en で英語）
//   sizes   … 小さいカード（図鑑の一覧 96px・デッキ 104px・大きなカード）。FONT・LANG
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out, mode = 'compare'] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const FONT = process.env.FONT || 'a';
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
fs.mkdirSync(out, { recursive: true });
const FIVE = ['mon-gauul', 'mon-soramo', 'mon-hyouzuku', 'mon-tyrant', 'mon-serephine'];

async function newPage(browser, w, h, lang) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((l) => localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: l, seVolume: 0, bgmVolume: 0, muted: true })), lang);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  return page;
}

/** 名前の比べる表（左に前の絵・右に新しいカード）を、その場で作る */
async function table(page, ids, font, lang, withOld) {
  await page.goto(base);
  await page.waitForTimeout(1000);
  await page.evaluate(
    async ([ids, font, lang, withOld]) => {
      const { getMonster, QA_MONSTERS } = await import('/src/data/cards.ts');
      const { createCardView } = await import('/src/ui/components/cardView.ts');
      const { setLanguage } = await import('/src/i18n/i18n.ts');
      setLanguage(lang);
      document.documentElement.dataset.cardFont = font;
      const find = (id) => QA_MONSTERS.find((m) => m.id === id) ?? getMonster(id);
      document.body.innerHTML = '';
      document.body.style.cssText = 'margin:0;background:#141a26;color:#eee;font-family:sans-serif;padding:6px';
      const title = document.createElement('div');
      title.textContent = `字体 ${font.toUpperCase()}・${lang === 'en' ? '英語' : '日本語'}`;
      title.style.cssText = 'font-size:14px;margin:2px 0 6px';
      document.body.append(title);
      const grid = document.createElement('div');
      grid.style.cssText = `display:grid;grid-template-columns:repeat(${withOld ? 2 : 4},auto);gap:6px;justify-content:start`;
      document.body.append(grid);
      for (const id of ids) {
        const m = find(id);
        if (withOld) {
          const old = document.createElement('img');
          old.src = `/design-parts/card-names-20261105/old/${m.art.file}`;
          old.style.cssText = 'width:170px;height:auto;border-radius:6px';
          grid.append(old);
        }
        const card = createCardView(m, withOld ? 170 : 92, true);
        grid.append(card);
      }
    },
    [ids, font, lang, withOld],
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
}

(async () => {
  const browser = await chromium.launch();
  if (mode === 'compare') {
    for (const font of ['a', 'b', 'c']) {
      for (const lang of ['ja', 'en']) {
        const page = await newPage(browser, 390, 1560, lang);
        await table(page, FIVE, font, lang, true);
        await page.screenshot({ path: `${out}/compare_${font}_${lang}.png`, fullPage: true });
        await page.close();
        console.log('compare', font, lang);
      }
    }
  } else if (mode === 'all') {
    for (const lang of ['ja', 'en']) {
      const page = await newPage(browser, 390, 844, lang);
      const ids = await (async () => {
        await page.goto(base);
        await page.waitForTimeout(800);
        return page.evaluate(async () => {
          const { NAMELESS_OFFICIAL_ART } = await import('/src/data/cardNames.ts');
          return [...NAMELESS_OFFICIAL_ART];
        });
      })();
      await table(page, ids, FONT, lang, false);
      await page.screenshot({ path: `${out}/all20_${FONT}_${lang}.png`, fullPage: true });
      await page.close();
      console.log('all', lang, ids.length);
    }
  } else if (mode === 'box') {
    const page = await newPage(browser, W, H, LANG);
    await page.goto(base);
    await page.waitForTimeout(800);
    const json = await page.evaluate(async () => {
      const { createNewGameSave } = await import('/src/game/save/saveData.ts');
      const s = createNewGameSave(new Date(2026, 10, 5));
      return JSON.stringify({ ...s, player: { gender: 'male', name: 'テスト' }, location: { mapId: 'bureau', x: 16, y: 19, dir: 'left' }, story: { ...s.story, introV2: { ...s.story.introV2, state: 'packSelection', examPassed: true } } });
    });
    await page.evaluate((s) => localStorage.setItem('mistria-battle-card/save', s), json);
    await page.goto(base);
    await page.waitForTimeout(1000);
    await page.evaluate((f) => (document.documentElement.dataset.cardFont = f), FONT);
    await page.locator(LANG === 'en' ? 'text=Continue' : 'text=続きから').first().click();
    await page.waitForSelector('.booster-select__box', { timeout: 15000 });
    await page.waitForTimeout(800);
    await page.locator('.booster-select__box').nth(1).click();
    await page.waitForTimeout(600);
    await page.locator('.booster-select__box').nth(1).click();
    await page.waitForSelector('.booster-got__monsters', { timeout: 10000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/box_${FONT}_${LANG}_${W}x${H}.png` });
    console.log('box', FONT, LANG);
  } else if (mode === 'sizes') {
    const page = await newPage(browser, W, H, LANG);
    await page.goto(base);
    await page.waitForTimeout(1000);
    await page.evaluate(async ([font, w]) => {
      const { getMonster } = await import('/src/data/cards.ts');
      const { createCardView } = await import('/src/ui/components/cardView.ts');
      const { createMonsterCard } = await import('/src/ui/components/monsterCard.ts');
      document.documentElement.dataset.cardFont = font;
      document.body.innerHTML = '';
      document.body.style.cssText = 'margin:0;background:#141a26;padding:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start';
      for (const id of ['mon-serephine', 'mon-gauul', 'mon-hyouzuku']) document.body.append(createCardView(getMonster(id), 96, false));
      for (const id of ['mon-serephine', 'mon-soramo']) document.body.append(createMonsterCard(getMonster(id), { width: 104 }));
      document.body.append(createCardView(getMonster('mon-serephine'), w > 330 ? 180 : 150, true));
    }, [FONT, W]);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/sizes_${FONT}_${LANG}_${W}x${H}.png` });
    console.log('sizes');
  }
  await browser.close();
})();
