// 指示書 AL（2026-11-02）フォルンの写真。開発用サーバー（npx vite）で動かす（lilil_ak_shot.cjs と同じ作り）。
// 撮るもの：
//   book    図鑑（モンスターカード・技12枚）・大きなカード（モンスター・05・07・09・12）
//   hand    手札（フォルンの濃いオリーブの枠をフルーネ〔若葉色〕と並べる）・押して大きく出したカード
//   frames  技カードの枠の並び（17体の1枚目・フォルンとフルーネを並べた大きな形）
//   cards12 技12枚を大きなカード・手札の形で並べる（技の絵の横の位置を決めるため）
//   moncard 居場所の印（地上）・対戦のアイコン・バトル用の大きなカード・アイコンの並び
//   ward    そなえのふえ：かけた味方の印・相手の攻撃のダメージが1減る所
//   forest  もりのたより：引いて1枚捨てる窓・捨てたあと・使えないとき（手札5枚以上）の理由
//   cover   みがわりのふえ：味方への攻撃をフォルンが代わりに受ける所
//   box     箱を選ぶ画面・蒼海の守りを開けた一覧（フォルンのカード）
//   gacha   ガチャ（フォルンを持っているセーブ：シリーズ選び・機械の窓・パックを開ける所）
//   shelf   ショップの棚（左・右）と店の中の販売機
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
    await center('mon-forn');
    await page.waitForTimeout(700);
    await shot('book_monster');
    await center(fo(5));
    await page.waitForTimeout(500);
    await shot('book_skills_1');
    await center(fo(11));
    await page.waitForTimeout(500);
    await shot('book_skills_2');
    for (const id of ['mon-forn', fo(5), fo(7), fo(9), fo(12)]) {
      await center(id);
      await page.waitForTimeout(400);
      await page.locator(`.card-book__item[data-id="${id}"]`).first().click();
      await page.waitForTimeout(1200);
      await shot(`big_${id === 'mon-forn' ? 'mon' : id.slice(-2)}`);
      await closeModal();
    }
  }

  if (want('hand')) {
    // 手札：フォルン（濃いオリーブ）・フルーネ（若葉色）の枠を並べる
    await start({ monsters: ['mon-forn', 'mon-flune', 'mon-myurol'], mana: 6, hand: [fo(4), 'skl-flune-06', fo(8), 'skl-flune-03', fo(10), 'skl-myurol-05'] });
    await page.evaluate(() => { const h = document.querySelector('.battle__hand'); if (h) h.scrollLeft = 0; });
    await shot('hand');
    for (const [id, n] of [[fo(4), '04'], [fo(8), '08'], [fo(10), '10'], ['skl-flune-06', 'flune_06']]) {
      await openCard(id);
      await shot(`hand_big_${n}`);
      await cancel();
    }
  }

  const grid = async (name, ids, size, width) => {
    await page.goto(base);
    await page.waitForTimeout(1000);
    await page.evaluate(async ([ids, size, width]) => {
      const { createSkillCard } = await import('/src/ui/components/skillCard.ts');
      const { getSkill } = await import('/src/data/cards.ts');
      await import('/src/ui/styles/cards.css');
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1a2238;display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;padding:6px;';
      for (const id of ids) box.append(createSkillCard(getSkill(id), { width, size }));
      document.body.append(box);
    }, [ids, size, width]);
    await page.waitForTimeout(1500);
    await shot(name);
  };

  if (want('frames')) {
    const firsts = await (async () => { await page.goto(base); await page.waitForTimeout(800); return page.evaluate(async () => {
      const { AJ_SKILLS } = await import('/src/data/skillRebuildAJ.ts');
      return Object.values(AJ_SKILLS).map((rows) => rows[0].id);
    }); })();
    await grid('frames_hand', firsts, 'hand', 90);
    await grid('frames_forn_flune', [fo(4), 'skl-flune-06', fo(8), 'skl-flune-03', fo(10), 'skl-flune-11'], 'normal', 120);
  }

  if (want('cards12')) {
    for (const [size, width] of [['normal', 120], ['hand', 98]]) {
      await grid(`cards12_${size}_1`, [1, 2, 3, 4, 5, 6].map(fo), size, width);
      await grid(`cards12_${size}_2`, [7, 8, 9, 10, 11, 12].map(fo), size, width);
    }
  }

  if (want('moncard')) {
    await start({ monsters: ['mon-forn', 'mon-flune', 'mon-myurol'], mana: 3, hand: [fo(1)] });
    await shot('battle_icons');
    await page.goto(base);
    await page.waitForTimeout(1000);
    await page.evaluate(async () => {
      const { createMonsterPortrait } = await import('/src/ui/components/monsterPortrait.ts');
      const { createBattleMonsterCard } = await import('/src/ui/components/battleMonsterCard.ts');
      const { getMonster } = await import('/src/data/cards.ts');
      await import('/src/ui/styles/battlePs.css');
      await import('/src/ui/styles/cards.css');
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1a2238;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;align-content:flex-start;padding:14px;';
      for (const id of ['mon-forn', 'mon-flune']) {
        for (const size of [28, 40, 52, 72, 88]) box.append(createMonsterPortrait(getMonster(id), size));
        box.append(Object.assign(document.createElement('div'), { style: 'flex-basis:100%;height:0' }));
      }
      box.append(createBattleMonsterCard(getMonster('mon-forn'), 230));
      box.append(createBattleMonsterCard(getMonster('mon-flune'), 116, { current: 10, max: 10 }));
      document.body.append(box);
    });
    await page.waitForTimeout(1500);
    await shot('portraits_battlecard');
  }

  if (want('ward')) {
    // 自分のフォルンが、ソラモ（p-m2）に そなえのふえ → 印
    await start({ monsters: ['mon-forn', 'mon-soramo', 'mon-myurol'], mana: 6, hand: [fo(7), fo(1)], oppMonsters: ['mon-kalshell', 'mon-soramo', 'mon-gauul'] });
    await openCard(fo(7));
    await shot('ward_detail');
    await page.locator('button:has-text("使う")').first().click({ timeout: 3000 });
    await page.waitForTimeout(900);
    await shot('ward_choose_ally');
    await page.locator('.battle__monster[data-uid="p-m2"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(2600);
    await shot('ward_mark');
    // 相手の番：ソラモ（o-m2）の たいあたり（2）が、そなえのかかったソラモ（p-m2）へ（ほかの味方は倒れている）→ 1 だけ減る
    await start({
      first: 'opponent', wait: 300, skill: 'A',
      monsters: ['mon-forn', 'mon-soramo', 'mon-myurol'], mana: 0, hand: [], lives: { 'p-m1': 0, 'p-m3': 0 }, mons: { 'p-m2': { ward: { reduce: 1, untilTurn: 3 } } },
      oppMonsters: ['mon-kalshell', 'mon-soramo', 'mon-gauul'], oppMana: 4, oppHand: ['skl-soramo14-03'],
    });
    if (await waitFor(defenseReady)) {
      await page.waitForTimeout(800);
      await closeTalk();
      await shot('ward_incoming');
      await page.locator('button:has-text("受ける")').last().click({ timeout: 2000 }).catch(() => {});
    } else log('no defense (ward)');
    for (let i = 0; i < 3; i++) { await page.waitForTimeout(1000); await shot(`ward_after_${i}`); }
  }

  if (want('forest')) {
    // もりのたより：このカードのほかに手札1枚 → 5枚になるまで引いて1枚捨てる
    await start({ monsters: ['mon-forn', 'mon-soramo', 'mon-myurol'], mana: 6, hand: [fo(9), fo(1)] });
    await openCard(fo(9));
    await shot('forest_detail');
    await page.locator('button:has-text("使う")').first().click({ timeout: 3000 });
    await page.waitForTimeout(1000);
    await shot('forest_window');
    await page.locator('.battle-forest .battle-pick__item').last().click().catch(() => {});
    await page.waitForTimeout(500);
    await shot('forest_pick');
    await page.locator('.battle-forest button:has-text("これを捨てる")').click().catch(() => {});
    await page.waitForTimeout(2600);
    await shot('forest_after');
    // 使えないとき：このカードのほかに手札が5枚
    await start({ monsters: ['mon-forn', 'mon-soramo', 'mon-myurol'], mana: 6, hand: [fo(9), fo(1), fo(2), fo(3), fo(4), 'skl-soramo14-03'] });
    await openCard(fo(9));
    await shot('forest_unusable');
  }

  if (want('cover')) {
    // 相手のソラモの たいあたりが、ライフの少ない自分のソラモ（p-m2）へ → みがわりのふえ でフォルンが代わりに受ける
    await start({
      first: 'opponent', wait: 300, skill: 'A',
      monsters: ['mon-forn', 'mon-soramo', 'mon-myurol'], mana: 3, hand: [fo(12)], lives: { 'p-m2': 2, 'p-m3': 0 },
      oppMonsters: ['mon-kalshell', 'mon-soramo', 'mon-gauul'], oppMana: 4, oppHand: ['skl-soramo14-03'],
    });
    if (await waitFor(defenseReady)) {
      await page.waitForTimeout(800);
      await closeTalk();
      await shot('cover_choose');
      const c = page.locator('.battle__defense-card:not(.is-unusable):not([disabled])');
      if (await c.count()) {
        await c.first().click();
        await page.waitForTimeout(500);
        await shot('cover_used');
        await page.locator('.battle__defense-none, button:has-text("受ける"), button:has-text("守備を終える")').first().click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(2500);
        await shot('cover_after');
      }
    } else log('no defense (cover)');
  }

  if (want('box')) {
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
      await shot('box_select');
      await page.locator('.booster-select__box').nth(2).click();
      await page.waitForTimeout(700);
      await shot('box_select_soukai');
      await page.locator('.booster-select__box').nth(2).click();
      await page.waitForSelector('.modal', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(800);
      await shot('box_got');
      await page.locator('.modal .btn--primary').click({ timeout: 3000 }).catch(() => {});
      await page.waitForSelector('.card-list', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
      await shot('box_open_list');
      await page.locator('.card-list__rows').evaluate((el) => (el.scrollTop = el.scrollHeight * 0.5)).catch(() => {});
      await page.waitForTimeout(400);
      await shot('box_open_list_forn');
    } else log('no booster select');
  }

  const openShop = async (loc) => {
    await page.goto(base);
    await page.waitForTimeout(800);
    const json = await seedSave({ location: loc });
    await page.close();
    page = await ctx.newPage();
    page.on('pageerror', (e) => log('PAGEERROR', e.message));
    await page.addInitScript((s) => localStorage.setItem('mistria-battle-card/save', s), json);
    await page.goto(base);
    await page.waitForTimeout(1000);
    const c = page.locator('button:has-text("続きから"):not([disabled])').first();
    if (await c.count()) await c.click();
    await page.waitForTimeout(3000);
  };

  if (want('gacha')) {
    await openShop({ mapId: 'shop', x: 45, y: 20, dir: 'up' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    const tile = page.locator('.gacha-select__tile[data-series="forn"]');
    await tile.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    await shot('gacha_select');
    await tile.click(); await page.waitForTimeout(600);
    await tile.click(); await page.waitForTimeout(1200);
    await page.locator('.modal button:has-text("はい")').first().click().catch(() => {});
    await page.waitForTimeout(2500);
    await shot('gacha_machine');
    await page.locator('button:has-text("自動でまわす")').first().click().catch(() => {});
    if (await page.waitForSelector('.gacha-machine__stage.is-landed', { timeout: 20000 }).then(() => true).catch(() => false)) {
      await page.waitForTimeout(800);
      await page.locator('.gacha-machine__stage').click();
      await page.waitForSelector('.gacha-open__pack', { timeout: 20000 });
      await page.waitForTimeout(1500);
      await shot('gacha_pack');
      for (let i = 0; i < 12; i++) {
        await page.mouse.click(W / 2, H / 2);
        await page.waitForTimeout(1100);
        if (i === 1) await shot('gacha_open_1');
      }
      await shot('gacha_open_last');
    } else log('no gacha landing');
  }

  if (want('shelf')) {
    for (const [name, loc] of [['shop_shelf_left', { mapId: 'shop', x: 30, y: 26, dir: 'left' }], ['shop_shelf_right', { mapId: 'shop', x: 58, y: 26, dir: 'right' }], ['shop_machine', { mapId: 'shop', x: 45, y: 20, dir: 'up' }]]) {
      await openShop(loc);
      await shot(name);
    }
  }

  await browser.close();
})();
