// ダンジョンのボス・バトラーの画面写真（2026-10-28 ダンジョンの人物12人で使った）。
// 使い方: node tools/e2e/dungeon_people_shot.cjs URL セーブのフォルダ 出力フォルダ [win]
// セーブのフォルダには boss_dungeon-0N.json・npc_dungeon-0N.json（主人公をボス・バトラーのとなりに置き、向きを相手に向けたセーブ）を置く。
// 撮るもの：_0map（地図）・_1talk（話しかけた窓：顔とせりふ）・_2battle（対戦の始め）・_5start（対戦中のひと言）。
// win を付けるとボスは QA:即勝利 → _7keeper（守り手のひと言）・_8altar（祭壇とお知らせ）も撮る
const { chromium } = require('playwright');
const fs = require('fs');
const [base, dir, out, mode] = process.argv.slice(2);
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
  const files = fs.readdirSync(dir).filter((f) => /^(boss|npc)_.*\.json$/.test(f)).sort();
  for (const f of files) {
    const name = f.replace('.json', '');
    const save = fs.readFileSync(`${dir}/${f}`, 'utf8');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
    await ctx.addInitScript((s) => { localStorage.setItem('mistria-battle-card/save', s); }, save);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', name, e.message));
    await page.goto(base + '?qa=1');
    // 画面の大きさの診断の文字と、対戦の QA ボタンは写真に写さない（2026-10-29）
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(800);
    await page.locator('text=続きから').first().click();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${out}/${name}_0map.png` });
    await page.keyboard.press('z');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${name}_1talk.png` });
    await page.locator('.modal button').last().click();
    await page.waitForTimeout(4200);
    await page.screenshot({ path: `${out}/${name}_2battle.png` });
    // 先攻・後攻のカードを1枚選ぶと、相手のひと言が出る
    await page.mouse.click(115, 585);
    await waitFor(page, '.battle__talk', 8000);
    await page.waitForTimeout(1800);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.evaluate(() => document.querySelectorAll('.battle__qa').forEach((e) => (e.style.visibility = 'hidden')));
    await page.screenshot({ path: `${out}/${name}_5start.png` });
    await page.evaluate(() => document.querySelectorAll('.battle__qa').forEach((e) => (e.style.visibility = '')));
    if (mode === 'win' && name.startsWith('boss_')) {
      await page.locator('text=QA:即勝利').first().click();
      await page.waitForTimeout(2800);
      await page.locator('button:has-text("続ける")').first().click();
      await waitFor(page, '.drun__talk-visual', 15000);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${out}/${name}_7keeper.png` });
      await page.locator('.modal button').last().click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${out}/${name}_8altar.png` });
    }
    console.log('ok', name);
    await ctx.close();
  }
  await browser.close();
})();
