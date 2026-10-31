// 指示書 AC【3】【4】（2026-10-31）ミュロルの正式カード・バトル用の絵・パックの絵と、シシエンの正式カードの差し替えの前と今をくらべる写真。
// 開発用サーバー（npx vite）で動かす。前の版は git worktree で前の main を別のポートの開発用サーバーにして、同じスクリプトで撮る。
// 撮るもの：
//   book_{myurol,shishien}（図鑑のモンスターカード）・big_{myurol,shishien}（大きなカード）・altar_{myurol,shishien}（祭壇で受け取る所）・
//   battle_field（対戦の場：自分＝ミュロル・シシエン・カルシェル、相手＝氷の洞窟のイヴァン〔ミュロル・ヒョウズク・カルシェル〕）・
//   gacha_select（ガチャのシリーズ選び）・gacha_machine（ミュロルの機械の窓）・gacha_pack（開ける前のパック）・
//   shop_machine（店の中の販売機の窓）・shop_shelf_{left,right}（ショップの棚）
// セーブはブラウザの中で createNewSave から作り、ミュロル・シシエンのモンスターカードと技カードを持たせる。
// 使い方: node tools/e2e/card_art_ac_shot.cjs http://127.0.0.1:5173/ 出力フォルダ 名前の頭（W・H で画面の大きさ）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out, tag = 'now'] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: 'ja', seVolume: 0, bgmVolume: 0, muted: true }));
  });
  await ctx.route(/\/src\/game\/battle\/engine\.ts/, async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    body = body.replace('export function createBattle(', 'function createBattle__orig(');
    body += '\nexport function createBattle(...a) { const s = createBattle__orig(...a); return globalThis.__battlePatch ? globalThis.__battlePatch(s) : s; }\n';
    await route.fulfill({ response: res, body });
  });
  let page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  const shot = async (name) => { await page.screenshot({ path: `${out}/${tag}_${name}.png` }); log('shot', name); };
  /** セーブを作って入れる（loc：現在地） */
  const seed = async (loc) => {
    await page.goto(base);
    await page.waitForTimeout(800);
    return page.evaluate(async (loc) => {
      const { createNewSave } = await import('/src/game/save/saveData.ts');
      const s = createNewSave(new Date(2026, 9, 31));
      const collection = { ...s.collection, 'mon-myurol': 1, 'mon-shishien': 1 };
      for (let i = 1; i <= 14; i++) {
        collection[`skl-myurol-${String(i).padStart(2, '0')}`] = 1;
        collection[`skl-shishien-${String(i).padStart(2, '0')}`] = 1;
      }
      const save = { ...s, player: { gender: 'male', name: 'テスト' }, collection, location: loc, money: 5000, storyFlags: [...s.storyFlags, 'pete-beaten', 'barca-beaten'] };
      localStorage.setItem('mistria-battle-card/save', JSON.stringify(save));
      return JSON.stringify(save);
    }, loc);
  };
  /**
   * セーブを入れて、タイトルから「続きから」で始める。開いていた画面を閉じるときに前のセーブが書き戻されることがあるので、
   * 新しいタブで、画面の読み込みの前にセーブを入れる
   */
  const boot = async (loc) => {
    const json = await seed(loc);
    await page.close();
    page = await ctx.newPage();
    page.on('pageerror', (e) => log('PAGEERROR', e.message));
    await page.addInitScript((s) => localStorage.setItem('mistria-battle-card/save', s), json);
    await page.goto(base);
    await page.waitForTimeout(1000);
    const c = page.locator('button:has-text("続きから"):not([disabled])').first();
    if (await c.count()) await c.click();
    else log('no continue', await page.evaluate(() => [...document.querySelectorAll('button')].map((x) => x.textContent + (x.disabled ? '(x)' : '')).join(' | ')));
    await page.waitForTimeout(2500);
  };
  /** 画面を1つ組み立てて出す（screen：画面の ID。before(store)：組み立てる前にストアに入れるもの） */
  const mount = async (screen, before) => {
    await page.evaluate(async ([screen, before]) => {
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const store = GameStore.fromBrowser();
      // 祭壇の場面はお知らせの文と一緒に出る（worldScreen.ts の flashClear・flashMessage）
      if (before === 'altar-myurol') store.flashClear = { cards: ['mon-myurol', 'skl-myurol-01', 'skl-myurol-02'], firstClear: true };
      if (before === 'altar-shishien') store.flashClear = { cards: ['mon-shishien', 'skl-shishien-01', 'skl-shishien-02'], firstClear: true };
      if (String(before).startsWith('altar-')) store.flashMessage = 'ダンジョンをはじめてクリア！（写真用）';
      if (before === 'battle') {
        const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
        globalThis.__battlePatch = (s) => ({ ...s, seed: 20261031 });
        const sk = Array.from({ length: 60 }, (_, i) => `skl-myurol-${String((i % 9) + 1).padStart(2, '0')}`);
        store.pendingBattle = { title: '氷の洞窟', opponent: ENCOUNTERS['enc-ice-boss'], allowSurrender: false, playerDeck: { monsters: ['mon-myurol', 'mon-shishien', 'mon-kalshell'], skills: sk }, onFinish: () => {} };
      }
      const stage = mountStage(document.querySelector('#app'), { qa: false });
      const noop = () => {};
      const view = SCREENS[screen].create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = screen;
      stage.element.replaceChildren(view.element);
    }, [screen, before ?? null]);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
  };
  const home = { mapId: 'home', x: 12, y: 14, dir: 'down' };

  // 図鑑・大きなカード
  for (const m of ['myurol', 'shishien']) {
    await seed(home);
    await mount('collection');
    await page.waitForTimeout(800);
    const item = page.locator(`.card-book__item[data-id="mon-${m}"]`).first();
    await item.scrollIntoViewIfNeeded();
    await page.evaluate((id) => document.querySelector(`.card-book__item[data-id="${id}"]`)?.scrollIntoView({ block: 'center' }), `mon-${m}`);
    await page.waitForTimeout(700);
    await shot(`book_${m}`);
    await item.click();
    await page.waitForTimeout(1200);
    await shot(`big_${m}`);
  }
  // 祭壇で受け取る所
  for (const m of ['myurol', 'shishien']) {
    await seed(home);
    await mount('world', `altar-${m}`);
    await page.waitForTimeout(2500);
    await shot(`altar_${m}`);
  }
  // 対戦の場
  await seed(home);
  await mount('battle', 'battle');
  await page.waitForSelector('.battle-order__card', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.locator('.battle-order__card').first().click();
  await page.waitForTimeout(4500);
  for (let i = 0; i < 2; i++) await page.locator('.battle__talk').first().click({ timeout: 500 }).catch(() => {});
  await page.waitForTimeout(500);
  await shot('battle_field');
  // ガチャ（販売機の前で「しらべる」）
  await boot({ mapId: 'shop', x: 45, y: 20, dir: 'up' });
  await shot('shop_machine');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const tile = page.locator('.gacha-select__tile[data-series="myurol"]');
  await tile.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await shot('gacha_select');
  await tile.click(); await page.waitForTimeout(600); await tile.click(); await page.waitForTimeout(1200);
  await page.locator('.modal button:has-text("はい")').first().click();
  await page.waitForTimeout(2500);
  await shot('gacha_machine');
  await page.locator('button:has-text("自動でまわす")').first().click();
  await page.waitForSelector('.gacha-machine__stage.is-landed', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.locator('.gacha-machine__stage').click();
  await page.waitForSelector('.gacha-open__pack', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await shot('gacha_pack');
  // ショップの棚（左右の壁ぞい）
  for (const [name, loc] of [['shop_shelf_left', { mapId: 'shop', x: 30, y: 26, dir: 'left' }], ['shop_shelf_right', { mapId: 'shop', x: 58, y: 26, dir: 'right' }]]) {
    await boot(loc);
    await shot(name);
  }
  // 対戦などのアイコンの切り抜き（monsterPortraits.ts）：デッキ・名刺図鑑・カードの一覧・対戦の相手の顔のかわりの大きさで
  await seed(home);
  await page.evaluate(async () => {
    const { createMonsterPortrait } = await import('/src/ui/components/monsterPortrait.ts');
    const { getMonster } = await import('/src/data/cards.ts');
    await import('/src/ui/styles/battlePs.css');
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1a2238;display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;padding:20px;';
    for (const size of [28, 32, 40, 44, 52, 72, 88]) box.append(createMonsterPortrait(getMonster('mon-myurol'), size));
    document.body.append(box);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${tag}_portraits.png`, clip: { x: 0, y: 0, width: W, height: 160 } });
  log('shot', 'portraits');
  await browser.close();
})();
