// セレフィーンの効果を対戦の画面で撮る（2026-10-29 セレフィーンの最終。flune_battle_shot.cjs と同じ作り）。開発用サーバー（npx vite）で動かす。
// 撮るもの：手札のセレフィーンの技（1_hand）・みちしおを使ったあと（2_tide。マナ1→2・山札−1・手札は増えない）・
// 相手（ルシアのセレフィーン）がゆらりとかわすで、こちらのかしこさ技（ルナタイド）をよけた所（3_sway_a〜c）。
// 撮影のときだけ、ブラウザの中で対戦の始まりを「自分の攻撃の手番・手札がセレフィーンの技」に置きかえる
// （page.route で engine.ts の createBattle を包む。ゲームのルール・ファイルは変えない）。相手は水の神殿のルシア（カルシェル・セレフィーン・ミュロル）。
// 使い方: node tools/e2e/serephine_battle_shot.cjs http://127.0.0.1:5173/ セーブ.json 出力フォルダ
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
  const start = async (mana, oppHand) => {
    await page.goto(base);
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
    await page.evaluate(async ({ mana, oppHand }) => {
      const ser = (n) => `skl-serephine-${String(n).padStart(2, '0')}`;
      globalThis.__battlePatch = (s) => {
        const hand = [ser(10), ser(8), ser(7), ser(13), ser(1)].map((cardId, i) => ({ uid: `x${i}`, cardId }));
        const filler = s.sides.player.deck.slice(0, mana);
        const player = { ...s.sides.player, hand, manaPile: filler, deck: s.sides.player.deck.slice(mana) };
        const ofill = s.sides.opponent.deck.slice(0, 5);
        const opponent = { ...s.sides.opponent, hand: oppHand.map((n, i) => ({ uid: `y${i}`, cardId: ser(n) })), manaPile: ofill, deck: s.sides.opponent.deck.slice(5) };
        return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player, opponent } };
      };
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
      const store = GameStore.fromBrowser();
      const deck = { monsters: ['mon-serephine', 'mon-soramo', 'mon-nobiton'], skills: Array.from({ length: 60 }, (_, i) => ser((i % 9) + 1)) };
      store.pendingBattle = { title: '水の神殿', opponent: ENCOUNTERS['enc-water-boss'], allowSurrender: false, playerDeck: deck, onFinish: () => {} };
      const root = document.querySelector('#app');
      const stage = mountStage(root, { qa: false });
      const noop = () => {};
      const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = 'battle';
      stage.element.replaceChildren(screen.element);
    }, { mana, oppHand });
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
  const sideInfo = () => page.evaluate(() => document.querySelector('.battle__side-info, .battle-ps__info')?.textContent ?? '');
  // みちしお：マナ1から
  await start(1, []);
  await shot('1_hand');
  await use('みちしお');
  await page.waitForTimeout(1500);
  await shot('2_tide');
  // ゆらりとかわす：相手のセレフィーン（o-m2）にルナタイド。相手は手札のゆらりとかわすでよける
  await start(10, [13]);
  await use('ルナタイド');
  await page.waitForTimeout(900);
  await page.locator('.battle__monster[data-uid="o-m2"]').click({ force: true });
  for (const [k, ms] of [['a', 1200], ['b', 900], ['c', 1200]]) {
    await page.waitForTimeout(ms);
    await shot(`3_sway_${k}`);
  }
  const lives = await page.evaluate(() => [...document.querySelectorAll('.battle__monster')].map((m) => `${m.dataset.uid}:${m.querySelector('.battle__monster-life-now')?.textContent}`));
  log(lives.join(' '));
  await browser.close();
})();
