// 2026-11-02 指示書 AM・AN の写真。開発用サーバー（npx vite）で動かす（starter_final_shot.cjs と同じ作り）。
// 撮るもの：
//   book     図鑑：ミュロル（LIFE 6 の絵）の図鑑の並び・大きなカード
//   box      箱を選ぶ画面・3箱それぞれを開けた一覧（BOX=0,1,2 でしぼれる）
//   frames   フォルンの技カード（濃くした名前の帯）とフルーネの技カードを並べた写真
//   credits  設定の素材のクレジット（チュートリアル / いまたく）
// 撮影のときだけ、ブラウザの中でセーブを作る。対戦の始まりは page.route で包んで置きかえる（ゲームのファイルは変えない）
// 使い方: node tools/e2e/forn_al_shot.cjs http://127.0.0.1:5173/ 出力フォルダ（ONLY=book,hand,... でしぼれる）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = 390;
const H = 844;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const fo = (n) => `skl-forn-${String(n).padStart(2, '0')}`;
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
  const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); log('shot', name); };

  /** すべての正式カードを1枚ずつ持つセーブ（旅立ちのきらめきを開けた人） */
  const seedSave = async (extra = {}) => page.evaluate(async (extra) => {
    const { createNewSave } = await import('/src/game/save/saveData.ts');
    const { MONSTERS, SKILLS } = await import('/src/data/cards.ts');
    const s = createNewSave(new Date(2026, 10, 2));
    const collection = { ...s.collection };
    for (const m of MONSTERS) if (!m.isPlaceholder) collection[m.id] = 1;
    for (const k of SKILLS) if (!k.isPlaceholder) collection[k.id] = Math.max(collection[k.id] ?? 0, 1);
    const story = { ...s.story, introV2: { ...s.story.introV2, state: 'completed', selectedBoosterKey: 'booster-3', boosterClaimed: true, boosterGranted: true, examPassed: true } };
    const save = { ...s, player: { gender: 'male', name: 'テスト' }, collection, coins: 5000, story, ...extra };
    localStorage.setItem('mistria-battle-card/save', JSON.stringify(save));
    return JSON.stringify(save);
  }, extra);
  const mount = async (screen) => {
    await page.goto(base);
    await page.waitForTimeout(1200);
    await seedSave();
    await page.evaluate(async (screen) => {
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const store = GameStore.fromBrowser();
      const stage = mountStage(document.querySelector('#app'), { qa: false });
      const noop = () => {};
      const view = SCREENS[screen].create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = screen;
      stage.element.replaceChildren(view.element);
    }, screen);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
  };
  const center = (id) => page.evaluate((id) => document.querySelector(`.card-book__item[data-id="${id}"]`)?.scrollIntoView({ block: 'center' }), id);
  const closeModal = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.locator('.modal button').last().click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(500); };

  /** 対戦を始める（o：monsters・oppMonsters・hand・mana・oppHand・oppMana・lives・mons〔uid ごとに足す値〕・first・skill・deck・wait） */
  const start = async (o) => {
    await page.goto(base);
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
    await page.evaluate(async (o) => {
      globalThis.__battlePatch = (s) => {
        const fix = (m) => ({ ...m, ...(o.lives && m.uid in o.lives ? { life: o.lives[m.uid] } : {}), ...((o.mons ?? {})[m.uid] ?? {}) });
        const mana = o.mana ?? 6;
        const om = o.oppMana ?? 3;
        const player = { ...s.sides.player, monsters: s.sides.player.monsters.map(fix), hand: (o.hand ?? []).map((id, i) => ({ uid: `x${i}`, cardId: id })), manaPile: s.sides.player.deck.slice(0, mana), deck: s.sides.player.deck.slice(mana) };
        const opponent = { ...s.sides.opponent, monsters: s.sides.opponent.monsters.map(fix), hand: (o.oppHand ?? []).map((id, i) => ({ uid: `y${i}`, cardId: id })), manaPile: s.sides.opponent.deck.slice(0, om), deck: s.sides.opponent.deck.slice(om) };
        const first = o.first ?? 'player';
        return { ...s, seed: 20261102, turn: 3, active: first, first, phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player, opponent } };
      };
      const { createNewSave } = await import('/src/game/save/saveData.ts');
      localStorage.setItem('mistria-battle-card/save', JSON.stringify(createNewSave(new Date(2026, 10, 2))));
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
      const store = GameStore.fromBrowser();
      const deck = o.deck ?? { monsters: o.monsters, skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
      const opponent = { ...ENCOUNTERS['enc-ice-boss'], name: '写真用の相手', monsters: o.oppMonsters ?? ['mon-soramo', 'mon-gauul', 'mon-myurol'], ace: 'mon-gauul', lifeScale: 1, ...(o.skill ? { skill: o.skill } : {}) };
      store.pendingBattle = { title: '写真用', opponent, allowSurrender: false, playerDeck: deck, onFinish: () => {} };
      const stage = mountStage(document.querySelector('#app'), { qa: false });
      const noop = () => {};
      const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = 'battle';
      stage.element.replaceChildren(screen.element);
    }, o);
    await page.waitForSelector('.battle-order__card', { timeout: 15000 });
    await page.waitForTimeout(700);
    await page.locator('.battle-order__card').first().click();
    await page.waitForTimeout(o.wait ?? 4500);
    for (let i = 0; i < 2; i++) await page.locator('.battle__talk').first().click({ timeout: 500 }).catch(() => {});
    await page.waitForTimeout(300);
  };
  const tap = async (loc) => { const b = await loc.boundingBox(); if (b) await page.mouse.click(b.x + 12, b.y + b.height / 2); };
  const nameOf = (id) => page.evaluate(async (id) => (await import('/src/data/cards.ts')).getSkill(id).name, id);
  const openCard = async (id) => { await tap(page.locator(`.battle__hand-card[aria-label^="${await nameOf(id)}"]`).first()); await page.waitForTimeout(900); };
  const useCard = async (id) => { await openCard(id); await page.locator('button:has-text("使う")').first().click({ timeout: 3000 }); };
  const cancel = async () => { await page.locator('button:has-text("やめる")').first().click({ timeout: 1000 }).catch(() => {}); await page.waitForTimeout(500); };
  const closeTalk = async () => { await page.locator('.battle__talk').first().click({ timeout: 300 }).catch(() => {}); };
  const waitFor = async (fn, arg, ms = 20000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 50 }).then(() => true).catch(() => false);
  const defenseReady = () => !!document.querySelector('.battle__defense-card, .battle__defense-none, .battle__defense-empty');
  const targets = () => page.evaluate(() => [...document.querySelectorAll('.battle__monster.is-target')].map((e) => e.getAttribute('data-uid')));


  if (want('book')) {
    await mount('collection');
    await page.waitForTimeout(800);
    await center('mon-myurol');
    await page.waitForTimeout(700);
    await shot('book_myurol');
    await page.locator('.card-book__item[data-id="mon-myurol"]').first().click();
    await page.waitForTimeout(1200);
    await shot('big_myurol');
    await closeModal();
  }

  if (want('frames')) {
    await page.goto(base);
    await page.waitForTimeout(1000);
    await page.evaluate(async () => {
      const { createSkillCard } = await import('/src/ui/components/skillCard.ts');
      const { getSkill } = await import('/src/data/cards.ts');
      await import('/src/ui/styles/cards.css');
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1a2238;display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;padding:6px;';
      for (const id of ['skl-forn-04', 'skl-flune-06', 'skl-forn-08', 'skl-flune-03', 'skl-forn-10', 'skl-flune-11']) box.append(createSkillCard(getSkill(id), { width: 120, size: 'normal' }));
      document.body.append(box);
    });
    await page.waitForTimeout(1500);
    await shot('frames_forn_flune');
  }

  if (want('credits')) {
    await mount('options');
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const el = document.querySelector('.credits-scroll');
      el?.scrollIntoView({ block: 'center' });
      const t = document.querySelector('.credits-scroll');
      if (t) t.scrollTop = t.scrollHeight;
    });
    await page.waitForTimeout(500);
    await shot('credits');
  }

  if (want('box')) for (const n of (process.env.BOX ?? '0,1,2').split(',').map(Number)) {
    await page.goto(base);
    await page.waitForTimeout(800);
    const json = await page.evaluate(async () => {
      const { createNewGameSave } = await import('/src/game/save/saveData.ts');
      const s = createNewGameSave(new Date(2026, 10, 2));
      const save = { ...s, player: { gender: 'male', name: 'テスト' }, location: { mapId: 'bureau', x: 16, y: 19, dir: 'left' }, story: { ...s.story, introV2: { ...s.story.introV2, state: 'packSelection', examPassed: true } } };
      return JSON.stringify(save);
    });
    await page.close();
    page = await ctx.newPage();
    page.on('pageerror', (e) => log('PAGEERROR', e.message));
    await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, json);
    await page.goto(base);
    await page.waitForTimeout(1000);
    await page.locator('text=続きから').first().click();
    if (await page.waitForSelector('.booster-select__box', { timeout: 15000 }).then(() => true).catch(() => false)) {
      await page.waitForTimeout(800);
      await shot(`box_${n}_screen`);
      await page.locator('.booster-select__box').nth(n).click();
      await page.waitForTimeout(700);
      await shot(`box_${n}_select`);
      await page.locator('.booster-select__box').nth(n).click();
      await page.waitForSelector('.modal', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(800);
      await shot(`box_${n}_got`);
      await page.locator('.modal .btn--primary').click({ timeout: 3000 }).catch(() => {});
      await page.waitForSelector('.card-list', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
      await shot(`box_${n}_list_1`);
      await page.locator('.card-list__rows').evaluate((el) => (el.scrollTop = el.scrollHeight * 0.5)).catch(() => {});
      await page.waitForTimeout(400);
      await shot(`box_${n}_list_2`);
    } else log('no booster select');
  }

  await browser.close();
})();
