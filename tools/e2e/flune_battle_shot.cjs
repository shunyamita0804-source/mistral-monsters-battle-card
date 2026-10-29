// フルーネの効果を対戦の画面で撮る（2026-10-29 フルーネの最終）。開発用サーバー（npx vite）で動かす。
// 撮るもの：手札のフルーネの技（1_hand）・いやしのみつの対象を選ぶ所（2_nectar_target）・回復したあと（3_nectar_done）・
// フラワードレインを使って回復した所（4_drain_a・4_drain_b）。
// 撮影のときだけ、ブラウザの中で対戦の始まりを「自分の攻撃の手番・マナ10・手札がフルーネの技・フルーネのライフ4・ソラモのライフ3」に置きかえる
// （page.route で engine.ts の createBattle を包む。ゲームのルール・ファイルは変えない）。相手は精霊の森のセラ（ラズック・フルーネ・ソラモ）。
// 使い方: node tools/e2e/flune_battle_shot.cjs http://127.0.0.1:5173/ セーブ.json 出力フォルダ
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out] = process.argv.slice(2);
const save = fs.readFileSync(saveFile, 'utf8');
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => localStorage.setItem('mistria-battle-card/save', s), save);
  await ctx.route(/\/src\/game\/battle\/engine\.ts/, async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    body = body.replace('export function createBattle(', 'function createBattle__orig(');
    body += '\nexport function createBattle(...a) { const s = createBattle__orig(...a); return globalThis.__battlePatch ? globalThis.__battlePatch(s) : s; }\n';
    await route.fulfill({ response: res, body });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); log('shot', name); };
  const start = async () => {
    await page.goto(base);
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
    await page.evaluate(async () => {
      const flu = (n) => `skl-flune-${String(n).padStart(2, '0')}`;
      globalThis.__battlePatch = (s) => {
        const hand = [flu(9), flu(10), flu(7), flu(13), flu(1)].map((cardId, i) => ({ uid: `x${i}`, cardId }));
        const filler = s.sides.player.deck.slice(0, 10);
        const player = {
          ...s.sides.player,
          hand,
          manaPile: filler,
          deck: s.sides.player.deck.slice(10),
          monsters: s.sides.player.monsters.map((m) => (m.cardId === 'mon-flune' ? { ...m, life: 4 } : m.cardId === 'mon-soramo' ? { ...m, life: 3 } : m)),
        };
        return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player, opponent: { ...s.sides.opponent, hand: [] } } };
      };
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
      const store = GameStore.fromBrowser();
      const deck = { monsters: ['mon-flune', 'mon-soramo', 'mon-nobiton'], skills: Array.from({ length: 60 }, (_, i) => flu((i % 8) + 1)) };
      store.pendingBattle = { title: '精霊の森', opponent: ENCOUNTERS['enc-forest-boss'], allowSurrender: false, playerDeck: deck, onFinish: () => {} };
      const root = document.querySelector('#app');
      const stage = mountStage(root, { qa: false });
      const noop = () => {};
      const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = 'battle';
      stage.element.replaceChildren(screen.element);
    });
    await page.waitForSelector('.battle-order__card', { timeout: 15000 });
    await page.waitForTimeout(700);
    await page.locator('.battle-order__card').first().click();
    await page.waitForTimeout(4500);
  };
  const tap = async (loc) => { const b = await loc.boundingBox(); if (b) await page.mouse.click(b.x + 12, b.y + b.height / 2); };
  const use = async (name) => {
    await tap(page.locator(`.battle__hand-card[aria-label="${name}"]`).first());
    await page.waitForTimeout(700);
    await page.locator('button:has-text("使う")').first().click({ timeout: 3000 });
  };
  // 技は1体1回なので、いやしのみつとフラワードレインは別の対戦で撮る
  await start();
  await shot('1_hand');
  await use('いやしのみつ');
  await page.waitForTimeout(900);
  await shot('2_nectar_target');
  await page.locator('.battle__monster[data-uid="p-m2"]').click({ force: true });
  await page.waitForTimeout(1300);
  await shot('3_nectar_done');
  await start();
  await use('フラワードレイン');
  await page.waitForTimeout(900);
  await page.locator('.battle__monster[data-uid="o-m3"]').click({ force: true });
  for (const [k, ms] of [['a', 1500], ['b', 900], ['c', 900]]) {
    await page.waitForTimeout(ms);
    await shot(`4_drain_${k}`);
  }
  const lives = await page.evaluate(() => [...document.querySelectorAll('.battle__monster')].map((m) => `${m.dataset.uid}:${m.querySelector('.battle__monster-life-now')?.textContent}`));
  log(lives.join(' '));
  await browser.close();
})();
