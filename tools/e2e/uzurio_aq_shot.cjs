// 指示書 AQ（2026-11-02）ウズリオとサポート3枚の写真。開発用サーバー（npx vite）で動かす（forn_al_shot.cjs と同じ作り）。
// 撮るもの：
//   book    図鑑（モンスターカード・技12枚・サポート3枚）・大きなカード（モンスター・04・06・08・12・サポート3枚）
//   hand    手札（ウズリオの空色の枠をミュロル・セレフィーン・ツムジと並べる）
//   frames  技カードの枠の並び（18体の1枚目・ウズリオとミュロル・セレフィーン・ツムジを並べた大きな形）
//   cards12 技12枚を大きなカード・手札の形で並べる（技の絵の横の位置を決めるため）
//   moncard 居場所の印（地上）・対戦のアイコン・バトル用の大きなカード・アイコンの並び
//   shot    うずまきショット：手札で 4 と見える・空中の相手に当たる
//   tornado おおたつまき：空中の相手全員に当たる（まいあがる風あり）・使えないときの理由
//   field   まいあがる風／しずまる大地で居場所の印が変わる・しずめの祈りで場のカード（みちしおも）が消える
//   zephyra 風の渓谷：ゼフィラとの対戦・祭壇でウズリオを受け取る（セーブ SAVES/boss_dungeon-08.json）
//   gacha   ガチャ（ウズリオのシリーズ選び・機械の窓・パックを開ける）・道具のパック（中身の一覧）
//   shelf   ショップの棚（左・右）と店の中の販売機
// 使い方: SAVES=セーブのフォルダ node tools/e2e/uzurio_aq_shot.cjs http://127.0.0.1:5173/ 出力フォルダ（ONLY=book,hand,... でしぼれる）
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
const uz = (n) => `skl-uzurio-${String(n).padStart(2, '0')}`;
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
    const { MONSTERS, SKILLS, SUPPORTS } = await import('/src/data/cards.ts');
    const s = createNewSave(new Date(2026, 10, 2));
    const collection = { ...s.collection };
    for (const m of MONSTERS) if (!m.isPlaceholder) collection[m.id] = 1;
    for (const k of SKILLS) if (!k.isPlaceholder) collection[k.id] = Math.max(collection[k.id] ?? 0, 1);
    for (const k of SUPPORTS) collection[k.id] = Math.max(collection[k.id] ?? 0, 1);
    const story = { ...s.story, introV2: { ...s.story.introV2, state: 'completed', selectedBoosterKey: 'booster-1', boosterClaimed: true, boosterGranted: true, examPassed: true } };
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
        return { ...s, seed: 20261102, turn: 3, active: first, first, phase: 'main', manaConvertLimit: null, ...(o.field ? { field: o.field } : {}), sides: { ...s.sides, player, opponent } };
      };
      const { createNewSave } = await import('/src/game/save/saveData.ts');
      localStorage.setItem('mistria-battle-card/save', JSON.stringify(createNewSave(new Date(2026, 10, 2))));
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
      const store = GameStore.fromBrowser();
      const deck = o.deck ?? { monsters: o.monsters, skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
      const opponent = o.encounter ? ENCOUNTERS[o.encounter] : { ...ENCOUNTERS['enc-ice-boss'], name: '写真用の相手', monsters: o.oppMonsters ?? ['mon-soramo', 'mon-gauul', 'mon-myurol'], ace: 'mon-gauul', lifeScale: 1, ...(o.skill ? { skill: o.skill } : {}) };
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
  const nameOf = (id) => page.evaluate(async (id) => (await import('/src/data/cards.ts')).getPlayCard(id).name, id);
  const openCard = async (id) => { await tap(page.locator(`.battle__hand-card[aria-label^="${await nameOf(id)}"]`).first()); await page.waitForTimeout(900); };
  const useCard = async (id) => { await openCard(id); await page.locator('button:has-text("使う")').first().click({ timeout: 3000 }); };
  const cancel = async () => { await page.locator('button:has-text("やめる")').first().click({ timeout: 1000 }).catch(() => {}); await page.waitForTimeout(500); };
  const closeTalk = async () => { await page.locator('.battle__talk').first().click({ timeout: 300 }).catch(() => {}); };
  const waitFor = async (fn, arg, ms = 20000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 50 }).then(() => true).catch(() => false);
  const defenseReady = () => !!document.querySelector('.battle__defense-card, .battle__defense-none, .battle__defense-empty');
  const targets = () => page.evaluate(() => [...document.querySelectorAll('.battle__monster.is-target')].map((e) => e.getAttribute('data-uid')));



  const RISE = 'sup-12';
  const SETTLE = 'sup-13';
  const CALM = 'sup-14';
  const grid = async (name, ids, size, width) => {
    await page.goto(base);
    await page.waitForTimeout(1000);
    await page.evaluate(async ([ids, size, width]) => {
      const { createSkillCard, createSupportCard } = await import('/src/ui/components/skillCard.ts');
      const { getPlayCard } = await import('/src/data/cards.ts');
      await import('/src/ui/styles/cards.css');
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1a2238;display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;padding:6px;';
      for (const id of ids) { const c = getPlayCard(id); box.append(c.kind === 'skill' ? createSkillCard(c, { width, size }) : createSupportCard(c, { width, size })); }
      document.body.append(box);
    }, [ids, size, width]);
    await page.waitForTimeout(1500);
    await shot(name);
  };
  const bookBig = async (id, name) => {
    await center(id);
    await page.waitForTimeout(400);
    await page.locator(`.card-book__item[data-id="${id}"]`).first().click();
    await page.waitForTimeout(1200);
    await shot(name);
    await closeModal();
  };

  if (want('book')) {
    await mount('collection');
    await page.waitForTimeout(800);
    await center('mon-uzurio');
    await page.waitForTimeout(700);
    await shot('book_monster');
    await center(uz(5));
    await page.waitForTimeout(500);
    await shot('book_skills_1');
    await center(uz(11));
    await page.waitForTimeout(500);
    await shot('book_skills_2');
    await center(CALM);
    await page.waitForTimeout(500);
    await shot('book_supports');
    for (const id of ['mon-uzurio', uz(4), uz(6), uz(8), uz(12), RISE, SETTLE, CALM]) await bookBig(id, `big_${id === 'mon-uzurio' ? 'mon' : id.startsWith('sup') ? id : id.slice(-2)}`);
  }

  if (want('hand')) {
    // 手札：ウズリオ（空色）・ミュロル（水色）・セレフィーン（薄い青紫）・ツムジ（青灰）の枠を並べる（相手にガウル〔空中〕がいるので うずまきショット は 4）
    await start({ monsters: ['mon-uzurio', 'mon-serephine', 'mon-tsumuji'], mana: 6, hand: [uz(4), 'skl-myurol-05', uz(9), 'skl-serephine-12', uz(2), 'skl-tsumuji-06'] });
    await page.evaluate(() => { const h = document.querySelector('.battle__hand'); if (h) h.scrollLeft = 0; });
    await shot('hand');
    for (const [id, n] of [[uz(4), '04'], [uz(9), '09'], ['skl-myurol-05', 'myurol'], ['skl-serephine-12', 'serephine'], ['skl-tsumuji-06', 'tsumuji']]) {
      await openCard(id);
      await shot(`hand_big_${n}`);
      await cancel();
    }
  }

  if (want('frames')) {
    const firsts = await (async () => { await page.goto(base); await page.waitForTimeout(800); return page.evaluate(async () => {
      const { AJ_SKILLS } = await import('/src/data/skillRebuildAJ.ts');
      return Object.values(AJ_SKILLS).map((rows) => rows[0].id);
    }); })();
    await grid('frames_hand', firsts, 'hand', 90);
    await grid('frames_compare_normal', [uz(4), 'skl-myurol-05', 'skl-serephine-04', 'skl-tsumuji-06', uz(11), 'skl-myurol-02'], 'normal', 120);
    await grid('frames_compare_hand', [uz(4), 'skl-myurol-05', 'skl-serephine-04', 'skl-tsumuji-06', uz(11), 'skl-myurol-02', 'skl-serephine-12', 'skl-tsumuji-12'], 'hand', 90);
  }

  if (want('cards12')) {
    for (const [size, width] of [['normal', 120], ['hand', 98]]) {
      await grid(`cards12_${size}_1`, [1, 2, 3, 4, 5, 6].map(uz), size, width);
      await grid(`cards12_${size}_2`, [7, 8, 9, 10, 11, 12].map(uz), size, width);
    }
    await grid('supports3_normal', [RISE, SETTLE, CALM], 'normal', 120);
  }

  if (want('moncard')) {
    await start({ monsters: ['mon-uzurio', 'mon-serephine', 'mon-tsumuji'], mana: 3, hand: [uz(1)] });
    await shot('battle_icons');
    await page.goto(base);
    await page.waitForTimeout(1000);
    await page.evaluate(async () => {
      const { createMonsterPortrait } = await import('/src/ui/components/monsterPortrait.ts');
      const { createBattleMonsterCard } = await import('/src/ui/components/battleMonsterCard.ts');
      const { createMonsterCard } = await import('/src/ui/components/monsterCard.ts');
      const { getMonster } = await import('/src/data/cards.ts');
      await import('/src/ui/styles/battlePs.css');
      await import('/src/ui/styles/cards.css');
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1a2238;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;align-content:flex-start;padding:14px;';
      for (const id of ['mon-uzurio', 'mon-tsumuji']) {
        for (const size of [28, 40, 52, 72, 88]) box.append(createMonsterPortrait(getMonster(id), size));
        box.append(Object.assign(document.createElement('div'), { style: 'flex-basis:100%;height:0' }));
      }
      box.append(createBattleMonsterCard(getMonster('mon-uzurio'), 230));
      box.append(createBattleMonsterCard(getMonster('mon-uzurio'), 116, { current: 6, max: 6 }));
      document.body.append(box);
    });
    await page.waitForTimeout(1500);
    await shot('portraits_battlecard');
  }

  if (want('shot')) {
    // 相手：ソラモ（地上）・ガウル（空中）・ミュロル（水中）。手札の うずまきショット は 4（黄色）
    await start({ monsters: ['mon-uzurio', 'mon-soramo', 'mon-myurol'], mana: 6, hand: [uz(4), uz(3)] });
    await shot('shot_hand');
    await openCard(uz(4));
    await shot('shot_detail');
    await page.locator('button:has-text("使う")').first().click({ timeout: 3000 });
    await page.waitForTimeout(900);
    await shot('shot_choose');
    await page.locator('.battle__monster[data-uid="o-m2"]').click({ force: true }).catch(() => {});
    for (let i = 0; i < 4; i++) { await page.waitForTimeout(900); await shot(`shot_after_${i}`); }
    // しずまる大地が場にあるときは、手札の うずまきショット は 2 のまま
    await start({ monsters: ['mon-uzurio', 'mon-soramo', 'mon-myurol'], mana: 6, hand: [uz(4), uz(3)], field: { cardId: SETTLE, owner: 'opponent', habitat: 'ground' } });
    await shot('shot_hand_settle');
  }

  if (want('tornado')) {
    // 使えないとき：相手に空中の子がいない
    await start({ monsters: ['mon-uzurio', 'mon-soramo', 'mon-myurol'], mana: 6, hand: [uz(6), uz(1)], oppMonsters: ['mon-soramo', 'mon-kalshell', 'mon-myurol'] });
    await openCard(uz(6));
    await shot('tornado_unusable');
    // まいあがる風が場にある：相手全員が空中 → 全員に当たる
    await start({ monsters: ['mon-uzurio', 'mon-soramo', 'mon-myurol'], mana: 6, hand: [uz(6), uz(1)], field: { cardId: RISE, owner: 'player', habitat: 'air' } });
    await shot('tornado_rise_field');
    await useCard(uz(6));
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(900); await shot(`tornado_after_${i}`); }
  }

  if (want('field')) {
    await start({ monsters: ['mon-uzurio', 'mon-gauul', 'mon-myurol'], mana: 9, hand: [RISE, SETTLE, uz(1)] });
    await shot('field_before');
    await openCard(RISE);
    await shot('field_rise_detail');
    await page.locator('button:has-text("使う")').first().click({ timeout: 3000 });
    for (let i = 0; i < 3; i++) { await page.waitForTimeout(900); await shot(`field_rise_${i}`); }
    await useCard(SETTLE);
    for (let i = 0; i < 3; i++) { await page.waitForTimeout(900); await shot(`field_settle_${i}`); }
    // しずめの祈り：場のカード（相手のまいあがる風）を取りのぞく
    await start({ monsters: ['mon-uzurio', 'mon-gauul', 'mon-myurol'], mana: 6, hand: [CALM, uz(1)], field: { cardId: RISE, owner: 'opponent', habitat: 'air' } });
    await shot('calm_before');
    await useCard(CALM);
    for (let i = 0; i < 3; i++) { await page.waitForTimeout(900); await shot(`calm_after_${i}`); }
    // しずめの祈り：みちしおの水中を消す
    await start({ monsters: ['mon-uzurio', 'mon-gauul', 'mon-myurol'], mana: 6, hand: [CALM, uz(1)], oppMonsters: ['mon-kalshell', 'mon-soramo', 'mon-gauul'], field: { cardId: 'skl-kalshell-15', owner: 'opponent', habitat: 'water', untilTurn: 4 } });
    await shot('calm_tide_before');
    await useCard(CALM);
    for (let i = 0; i < 3; i++) { await page.waitForTimeout(900); await shot(`calm_tide_after_${i}`); }
    // 場に何も無いとき
    await start({ monsters: ['mon-uzurio', 'mon-gauul', 'mon-myurol'], mana: 6, hand: [CALM, uz(1)] });
    await openCard(CALM);
    await shot('calm_unusable');
  }

  if (want('zephyra')) {
    // ゼフィラとの対戦（切り札ウズリオ）
    await start({ monsters: ['mon-soramo', 'mon-lilil', 'mon-nobiton'], mana: 3, hand: ['skl-soramo14-03'], encounter: 'enc-wind-boss' });
    await shot('zephyra_battle');
    // 祭壇：ゼフィラのとなりのセーブから、QA の即勝利 → 祭壇
    const save = fs.readFileSync(`${process.env.SAVES}/boss_dungeon-08.json`, 'utf8');
    await page.close();
    page = await ctx.newPage();
    page.on('pageerror', (e) => log('PAGEERROR', e.message));
    await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mistria-battle-card/save', s); sessionStorage.setItem('seeded', '1'); } }, save);
    await page.goto(`${base}?qa=1`);
    await page.addStyleTag({ content: '.stage-diag{display:none!important} .world__hint{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(800);
    await page.locator('text=続きから').first().click();
    await page.waitForTimeout(3200);
    await shot('zephyra_0map');
    await page.keyboard.press('z');
    await page.waitForTimeout(900);
    await shot('zephyra_1talk');
    await page.locator('.modal button').last().click();
    await page.waitForTimeout(4200);
    await page.mouse.click(115, Math.round(H * 0.693));
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelectorAll('.battle__qa').forEach((e) => (e.style.visibility = 'hidden')));
    await shot('zephyra_2start');
    await page.evaluate(() => document.querySelectorAll('.battle__qa').forEach((e) => (e.style.visibility = '')));
    await page.locator('text=QA:即勝利').first().click().catch(async () => page.locator('.battle__qa button').nth(1).click());
    await page.waitForTimeout(2600);
    await page.evaluate(() => document.querySelectorAll('.battle__qa').forEach((e) => (e.style.visibility = 'hidden')));
    await shot('zephyra_3win');
    await page.locator('button:has-text("続ける")').first().click().catch(() => {});
    await page.waitForSelector('.drun__talk-visual', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    await shot('zephyra_4keeper');
    await page.locator('.modal button').last().click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot('zephyra_5altar');
    await page.locator('.modal button').last().click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot('zephyra_6altar2');
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
    const tile = page.locator('.gacha-select__tile[data-series="uzurio"]');
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
      // パックの上のほうを横になぞって開ける
      const box = await page.locator('.gacha-open__pack').boundingBox();
      if (box) {
        const y = box.y + box.height * 0.08;
        await page.mouse.move(box.x + 8, y);
        await page.mouse.down();
        for (let k = 1; k <= 12; k++) await page.mouse.move(box.x + 8 + ((box.width - 16) * k) / 12, y);
        await page.mouse.up();
        await page.waitForTimeout(1800);
        await shot('gacha_torn');
      }
      for (let i = 0; i < 12; i++) {
        await page.mouse.click(W / 2, H / 2);
        await page.waitForTimeout(1100);
        if (i === 1) await shot('gacha_open_1');
      }
      await shot('gacha_open_last');
    } else log('no gacha landing');
  }

  if (want('gacha')) {
    // 道具のパック：シリーズを選ぶ（中身の一覧）
    await openShop({ mapId: 'shop', x: 45, y: 20, dir: 'up' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    const tools = page.locator('.gacha-select__tile[data-series="tools"]');
    await tools.scrollIntoViewIfNeeded().catch(() => {});
    await tools.click(); await page.waitForTimeout(1000);
    await shot('tools_select');
    await tools.click(); await page.waitForTimeout(1200);
    await page.locator('.modal button:has-text("はい")').first().click().catch(() => {});
    await page.waitForTimeout(2500);
    await shot('tools_machine');
  }

  if (want('shelf')) {
    for (const [name, loc] of [['shop_shelf_left', { mapId: 'shop', x: 30, y: 26, dir: 'left' }], ['shop_shelf_right', { mapId: 'shop', x: 58, y: 26, dir: 'right' }], ['shop_machine', { mapId: 'shop', x: 45, y: 20, dir: 'up' }]]) {
      await openShop(loc);
      await shot(name);
    }
  }

  await browser.close();
})();
