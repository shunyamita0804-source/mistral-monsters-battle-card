// 指示書 AJ（2026-11-01）の写真。開発用サーバー（npx vite）で動かす（desuoru_ag_shot.cjs と同じ作り）。
// 撮るもの：居場所の印（対戦中のモンスター：置き場所の案 a・b・c／大きなモンスターカード）・場が水中の表示・新しい効果の記録の帯（みちしお・死のレクイエム）・
//   図鑑の番号（13番ずつ）・ガチャの ○/13・箱を開けた一覧（旅立ちのきらめき）
// 使い方: node tools/e2e/aj_shot.cjs http://127.0.0.1:5173/ 出力フォルダ（ONLY=habitat,tide,log,redraw,book,gacha,box でしぼれる。redraw＝追加その2の描き直した絵2枚）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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

  const seedSave = async () => page.evaluate(async () => {
    const { createNewSave } = await import('/src/game/save/saveData.ts');
    const { MONSTERS, SKILLS } = await import('/src/data/cards.ts');
    const s = createNewSave(new Date(2026, 10, 1));
    const collection = { ...s.collection };
    for (const m of MONSTERS) if (!m.isPlaceholder) collection[m.id] = 1;
    for (const k of SKILLS) if (!k.isPlaceholder) collection[k.id] = Math.max(collection[k.id] ?? 0, 1);
    const save = { ...s, player: { gender: 'male', name: 'テスト' }, collection, money: 5000 };
    localStorage.setItem('mistria-battle-card/save', JSON.stringify(save));
  });
  const mount = async (screen, query = '') => {
    await page.goto(base + query);
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

  /** 対戦を始める（o：monsters・oppMonsters・hand・mana・oppHand・lives・tide・query） */
  const start = async (o) => {
    await page.goto(base + (o.query ?? ''));
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
    await page.evaluate(async (o) => {
      globalThis.__battlePatch = (s) => {
        const life = (m) => (o.lives && m.uid in o.lives ? { ...m, life: o.lives[m.uid] } : m);
        const cards = (o.hand ?? []).map((id, i) => ({ uid: `x${i}`, cardId: id }));
        const mana = o.mana ?? 6;
        const player = { ...s.sides.player, monsters: s.sides.player.monsters.map(life), hand: cards, manaPile: s.sides.player.deck.slice(0, mana), deck: s.sides.player.deck.slice(mana) };
        const oppHand = (o.oppHand ?? []).map((id, i) => ({ uid: `y${i}`, cardId: id }));
        const opponent = { ...s.sides.opponent, monsters: s.sides.opponent.monsters.map(life), hand: oppHand, manaPile: s.sides.opponent.deck.slice(0, 3), deck: s.sides.opponent.deck.slice(3) };
        return { ...s, seed: 20261101, turn: 3, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player, opponent }, ...(o.tide ? { field: { cardId: 'skl-serephine-10', owner: 'player', habitat: 'water', untilTurn: 5 } } : {}) };
      };
      const { createNewSave } = await import('/src/game/save/saveData.ts');
      localStorage.setItem('mistria-battle-card/save', JSON.stringify(createNewSave(new Date(2026, 10, 1))));
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
      const store = GameStore.fromBrowser();
      const deck = { monsters: o.monsters, skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
      const opponent = { ...ENCOUNTERS['enc-ice-boss'], name: '写真用の相手', monsters: o.oppMonsters ?? ['mon-geol', 'mon-hyouzuku', 'mon-kalshell'], ace: 'mon-hyouzuku', lifeScale: 1 };
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
  const useCard = async (id) => {
    const label = await page.evaluate(async (id) => (await import('/src/data/cards.ts')).getSkill(id).name, id);
    await tap(page.locator(`.battle__hand-card[aria-label^="${label}"]`).first());
    await page.waitForTimeout(800);
    await page.locator('button:has-text("使う")').first().click({ timeout: 3000 });
  };

  if (want('habitat')) {
    // 居場所の印：自分 ソラモ（地上）・ガウル（空中）・ミュロル（水中）、相手 ジオル・ヒョウズク・カルシェル。置き場所の案 a・b・c
    for (const pos of ['a', 'b', 'c']) {
      await start({ monsters: ['mon-soramo', 'mon-gauul', 'mon-myurol'], hand: ['skl-soramo14-03', 'skl-gauul14-04'], query: `?qa=1&habitatPos=${pos}` });
      await shot(`habitat_battle_${pos}`);
      const el = page.locator('.battle-row--player .battle-side');
      await el.screenshot({ path: `${out}/habitat_row_${pos}.png` });
    }
    // 急降下アタック（地上の相手だけ）を選ぶと、狙えるのはジオルだけ
    await start({ monsters: ['mon-soramo', 'mon-gauul', 'mon-myurol'], hand: ['skl-gauul14-04'] });
    await useCard('skl-gauul14-04');
    await page.waitForTimeout(900);
    await shot('ground_only_targets');
  }

  if (want('tide')) {
    // 場が水中（みちしおのあと）：上の帯に「場が水中 あと3手番」（使った手番。追加その3）・全員の印が水中
    await start({ monsters: ['mon-soramo', 'mon-gauul', 'mon-myurol'], hand: ['skl-soramo14-03'], tide: true });
    await shot('tide_field');
    // 場が水中だと、急降下アタックは使えない（理由が出る）
    await start({ monsters: ['mon-soramo', 'mon-gauul', 'mon-myurol'], hand: ['skl-gauul14-04'], tide: true });
    const label = await page.evaluate(async () => (await import('/src/data/cards.ts')).getSkill('skl-gauul14-04').name);
    await tap(page.locator(`.battle__hand-card[aria-label^="${label}"]`).first());
    await page.waitForTimeout(900);
    await shot('tide_ground_only_unusable');
  }

  if (want('log')) {
    // みちしお（セレフィーン）を使った記録の帯
    await start({ monsters: ['mon-serephine', 'mon-kalshell', 'mon-soramo'], hand: ['skl-serephine-10', 'skl-kalshell-08'], mana: 8 });
    await useCard('skl-serephine-10');
    await page.waitForTimeout(2600);
    await shot('log_tide');
    // 死のレクイエム：ライフ1の相手2体・味方1体（デスオルは残る）
    await start({ monsters: ['mon-desuoru', 'mon-soramo', 'mon-gauul'], hand: ['skl-desuoru-16'], mana: 6, lives: { 'p-m2': 1, 'o-m1': 1, 'o-m2': 1 } });
    await useCard('skl-desuoru-16');
    await page.waitForTimeout(2600);
    await shot('log_requiem');
  }

  if (want('redraw')) {
    // 追加その2：描き直した絵2枚をカードの枠に入れた見た目（手札を押して大きく出す）
    await start({ monsters: ['mon-serephine', 'mon-myurol', 'mon-soramo'], hand: ['skl-serephine-10', 'skl-myurol-03'], mana: 8 });
    await shot('redraw_hand');
    for (const id of ['skl-serephine-10', 'skl-myurol-03']) {
      const label = await page.evaluate(async (id) => (await import('/src/data/cards.ts')).getSkill(id).name, id);
      await tap(page.locator(`.battle__hand-card[aria-label^="${label}"]`).first());
      await page.waitForTimeout(1000);
      await shot(`redraw_${id}`);
      await page.locator('button:has-text("やめる")').first().click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  if (want('book')) {
    await mount('collection');
    await page.waitForTimeout(800);
    for (const id of ['mon-soramo', 'skl-soramo14-14', 'mon-lazuck', 'mon-desuoru', 'skl-desuoru-16']) {
      await page.evaluate((id) => document.querySelector(`.card-book__item[data-id="${id}"]`)?.scrollIntoView({ block: 'center' }), id);
      await page.waitForTimeout(600);
      await shot(`book_${id}`);
    }
    // 大きなモンスターカード（居場所の印）
    for (const id of ['mon-soramo', 'mon-gauul', 'mon-myurol']) {
      await page.evaluate((id) => document.querySelector(`.card-book__item[data-id="${id}"]`)?.scrollIntoView({ block: 'center' }), id);
      await page.waitForTimeout(400);
      await page.locator(`.card-book__item[data-id="${id}"]`).first().click();
      await page.waitForTimeout(1200);
      await shot(`big_${id}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.locator('.modal button').last().click({ timeout: 800 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  if (want('gacha')) {
    await mount('gacha');
    await page.waitForTimeout(1200);
    await shot('gacha_select');
    const tile = page.locator('.gacha-select__tile[data-series="soramo"]');
    if (await tile.count()) {
      await tile.first().click();
      await page.waitForTimeout(800);
      await page.locator('.gacha-select__go, button:has-text("このパックにする")').first().click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await shot('gacha_machine_soramo');
    }
  }

  if (want('box')) {
    // 箱を開けた一覧（管理局で箱を受け取ったときと同じ「取得カード」の一覧）：3箱
    for (const key of ['booster-1', 'booster-2', 'booster-3']) {
      await mount('collection');
      await page.evaluate(async (key) => {
        const { boosterDeck } = await import('/src/game/story/introV2.ts');
        const { openCardList } = await import('/src/ui/components/cardListView.ts');
        const deck = boosterDeck(key);
        openCardList(document.querySelector('#app'), { cardIds: [...deck.monsters, ...deck.skills], onClose: () => {} });
      }, key);
      await page.waitForTimeout(1500);
      await shot(`box_${key}`);
      await page.evaluate(() => { const l = document.querySelector('.card-list__grid, .card-list'); if (l) l.scrollTop = 99999; });
      await page.waitForTimeout(600);
      await shot(`box_${key}_end`);
    }
  }
  await browser.close();
})();
