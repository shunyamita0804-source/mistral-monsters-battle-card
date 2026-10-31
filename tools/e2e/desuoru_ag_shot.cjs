// 指示書 AG（2026-10-31）デスオルの写真。開発用サーバー（npx vite）で動かす（AF のハクランの写真の道具と同じ作り）。
// 撮るもの：図鑑（book_*）・大きなカード（big_mon・big_06・big_07・big_10・big_14）・手札（デスオル・セレフィーン・ラズック・シシエンの枠を並べる。hand_big_*）・
//   技14枚の並び（cards14_*）・対戦（crow_window・crow_choose：プレイヤーがカラスのめで相手の手札を見て1枚選ぶ／crow_after：捨てさせたあと／
//   cpu_crow_*：CPU がカラスのめを使った所〔記録の帯とふきだし〕／spear_noguard：やみのやりに防御のカードが使えない／shadow_*：かげにとけるで回避）・
//   moncard_*（対戦でモンスターを押したとき）・ガチャ・アイコン（portraits）
// 撮影のときだけ、ブラウザの中でセーブを作ってデスオルを持たせる（desuoru-unlocked も立てる）。対戦の始まりは page.route で包んで置きかえる（ゲームのファイルは変えない）
// 使い方: node tools/e2e/desuoru_ag_shot.cjs http://127.0.0.1:5173/ 出力フォルダ（ONLY=book,hand,moncard,crow,cpu,def,gacha,cards14,portraits でしぼれる）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const des = (n) => `skl-desuoru-${String(n).padStart(2, '0')}`;
const ser = (n) => `skl-serephine-${String(n).padStart(2, '0')}`;
const laz = (n) => `skl-lazuck-${String(n).padStart(2, '0')}`;
const shi = (n) => `skl-shishien-${String(n).padStart(2, '0')}`;
const sor = (n) => `skl-soramo14-${String(n).padStart(2, '0')}`;
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
  const seed = async (loc) => {
    await page.goto(base);
    await page.waitForTimeout(800);
    return page.evaluate(async (loc) => {
      const { createNewSave } = await import('/src/game/save/saveData.ts');
      const s = createNewSave(new Date(2026, 9, 31));
      const collection = { ...s.collection, 'mon-desuoru': 1 };
      for (let i = 1; i <= 14; i++) collection[`skl-desuoru-${String(i).padStart(2, '0')}`] = 1;
      const save = { ...s, player: { gender: 'male', name: 'テスト' }, collection, location: loc, money: 5000, storyFlags: [...s.storyFlags, 'desuoru-unlocked'] };
      localStorage.setItem('mistria-battle-card/save', JSON.stringify(save));
      return JSON.stringify(save);
    }, loc);
  };
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
    await page.waitForTimeout(2500);
  };
  const mount = async (screen) => {
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
  const home = { mapId: 'home', x: 12, y: 14, dir: 'down' };
  const center = (id) => page.evaluate((id) => document.querySelector(`.card-book__item[data-id="${id}"]`)?.scrollIntoView({ block: 'center' }), id);
  const closeModal = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.locator('.modal button').last().click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(500); };

  // 図鑑・大きなカード
  if (want('book')) {
    await seed(home);
    await mount('collection');
    await page.waitForTimeout(800);
    await center('mon-desuoru');
    await page.waitForTimeout(700);
    await shot('book_monster');
    await center(des(4));
    await page.waitForTimeout(500);
    await shot('book_skills_1');
    await center(des(12));
    await page.waitForTimeout(500);
    await shot('book_skills_2');
    for (const id of ['mon-desuoru', des(4), des(5), des(6), des(7), des(10), des(14)]) {
      await center(id);
      await page.waitForTimeout(400);
      await page.locator(`.card-book__item[data-id="${id}"]`).first().click();
      await page.waitForTimeout(1200);
      await shot(`big_${id === 'mon-desuoru' ? 'mon' : id.slice(-2)}`);
      await closeModal();
    }
  }

  // 対戦
  /** o：{ first, mana, hand, oppMana, oppHand, lives, wait } */
  const start = async (o) => {
    await page.goto(base);
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
    await page.evaluate(async (o) => {
      globalThis.__battlePatch = (s) => {
        const life = (m) => (o.lives && m.uid in o.lives ? { ...m, life: o.lives[m.uid] } : m);
        const cards = o.hand.map((id, i) => ({ uid: `x${i}`, cardId: id }));
        const player = { ...s.sides.player, monsters: s.sides.player.monsters.map(life), hand: cards, manaPile: s.sides.player.deck.slice(0, o.mana), deck: s.sides.player.deck.slice(o.mana) };
        const oppHand = (o.oppHand ?? []).map((id, i) => ({ uid: `y${i}`, cardId: id }));
        const om = o.oppMana ?? 3;
        const opponent = { ...s.sides.opponent, monsters: s.sides.opponent.monsters.map(life), hand: oppHand, manaPile: s.sides.opponent.deck.slice(0, om), deck: s.sides.opponent.deck.slice(om) };
        const first = o.first ?? 'player';
        return { ...s, seed: 20261031, turn: 3, active: first, first, phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player, opponent } };
      };
      const { createNewSave } = await import('/src/game/save/saveData.ts');
      localStorage.setItem('mistria-battle-card/save', JSON.stringify(createNewSave(new Date(2026, 9, 31))));
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
      const store = GameStore.fromBrowser();
      const deck = { monsters: o.monsters ?? ['mon-desuoru', 'mon-serephine', 'mon-lazuck'], skills: Array.from({ length: 60 }, (_, i) => `skl-desuoru-${String((i % 5) + 1).padStart(2, '0')}`) };
      // 撮影用の相手：ソラモ・デスオル（真ん中）・シシエン（顔は氷の洞窟のイヴァン）
      const opponent = { ...ENCOUNTERS['enc-ice-boss'], name: '撮影用の相手', monsters: ['mon-soramo', 'mon-desuoru', 'mon-shishien'], ace: 'mon-desuoru', lifeScale: 1, ...(o.skill ? { skill: o.skill } : {}) };
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
  const closeTalk = async () => { await page.locator('.battle__talk').first().click({ timeout: 300 }).catch(() => {}); };
  const waitFor = async (fn, arg, ms = 20000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 50 }).then(() => true).catch(() => false);
  const defenseReady = () => !!document.querySelector('.battle__defense-card, .battle__defense-none, .battle__defense-empty');

  if (want('hand')) {
    // 手札：デスオル（紺）・セレフィーン（月の青紫）・ラズック（紫）・シシエン（炭色）の枠を並べる（シシエンは場にいないので薄いが枠の色は見える）
    await start({ mana: 6, hand: [des(6), ser(1), laz(1), des(10), des(14), shi(1)], oppHand: [sor(1)], monsters: ['mon-desuoru', 'mon-serephine', 'mon-lazuck'] });
    await page.evaluate(() => { const h = document.querySelector('.battle__hand'); if (h) h.scrollLeft = 0; });
    await shot('hand');
    for (const [id, n] of [[des(6), '06'], [des(10), '10'], [des(14), '14'], [ser(1), 'serephine_01'], [laz(1), 'lazuck_01'], [shi(1), 'shishien_01']]) {
      const label = await page.evaluate(async (id) => (await import('/src/data/cards.ts')).getSkill(id).name, id);
      await tap(page.locator(`.battle__hand-card[aria-label^="${label}"]`).first());
      await page.waitForTimeout(900);
      await shot(`hand_big_${n}`);
      await page.locator('button:has-text("やめる")').first().click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  if (want('moncard')) {
    await start({ mana: 3, hand: [des(1)] });
    for (const [uid, n] of [['p-m1', 'desuoru'], ['p-m2', 'serephine'], ['p-m3', 'lazuck']]) {
      await page.locator(`.battle__monster[data-uid="${uid}"]`).click({ force: true });
      await page.waitForTimeout(1200);
      await shot(`moncard_${n}`);
      await page.keyboard.press('Escape');
      await page.mouse.click(10, 10);
      await page.waitForTimeout(800);
    }
  }

  if (want('crow')) {
    // プレイヤーがカラスのめ：相手の手札4枚を見て1枚（ヘルのもん）を選ぶ → 捨てさせたあと
    await start({ mana: 6, hand: [des(10), des(1), des(3)], oppHand: [sor(1), sor(11), des(8), sor(13)] });
    const label = await page.evaluate(async (id) => (await import('/src/data/cards.ts')).getSkill(id).name, des(10));
    await tap(page.locator(`.battle__hand-card[aria-label^="${label}"]`).first());
    await page.waitForTimeout(800);
    await shot('crow_detail');
    await page.locator('button:has-text("使う")').first().click({ timeout: 3000 });
    await page.waitForTimeout(900);
    await shot('crow_window');
    await page.locator('.battle-crow__item').nth(2).click();
    await page.waitForTimeout(500);
    await shot('crow_choose');
    await page.locator('.battle-crow button:has-text("これを捨てさせる")').click();
    await page.waitForTimeout(1500);
    await shot('crow_used');
    await page.waitForTimeout(2500);
    await shot('crow_after');
  }

  if (want('cpu')) {
    // 相手（CPU・腕前 A）がカラスのめ：プレイヤーの手札4枚（倒せる攻撃なし・3枚以上）。記録の帯とふきだし
    await start({ first: 'opponent', mana: 2, hand: [des(5), des(11), des(2), des(14)], oppMana: 5, oppHand: [des(10)], wait: 300, skill: 'A' });
    if (await waitFor(() => !!document.querySelector('.battle-spot--opponent:not(.is-idle) .battle-spot__card'))) {
      await page.waitForTimeout(1200);
      await shot('cpu_crow_card');
    } else log('no opponent card');
    await page.waitForTimeout(2200);
    await shot('cpu_crow_talk');
    await page.waitForTimeout(2500);
    await shot('cpu_crow_after');
  }

  if (want('def')) {
    // 相手のデスオル（o-m2）の やみのやり（防御されない）を、自分のデスオル（p-m1。ほかの2体は倒れている）に。防御のカードは使えない
    await start({ first: 'opponent', mana: 5, hand: [des(11), des(13), des(12)], oppMana: 6, oppHand: [des(7)], lives: { 'p-m2': 0, 'p-m3': 0, 'o-m1': 0, 'o-m3': 0 }, wait: 300 });
    if (await waitFor(defenseReady)) {
      await page.waitForTimeout(800);
      await closeTalk();
      await shot('spear_noguard');
      const labels = await page.evaluate(() => [...document.querySelectorAll('.battle__defense-card')].map((b) => b.getAttribute('aria-label')));
      fs.writeFileSync(`${out}/spear_noguard_labels.json`, JSON.stringify(labels, null, 1));
      log('labels', labels.join(' / '));
    } else log('no defense');
    // 相手のデスオルの めいかいのかぜ（かしこさ4）を、かげにとける（マナ1）で回避
    await start({ first: 'opponent', mana: 2, hand: [des(14), des(12)], oppMana: 6, oppHand: [des(5)], lives: { 'p-m2': 0, 'p-m3': 0, 'o-m1': 0, 'o-m3': 0 }, wait: 300 });
    if (await waitFor(defenseReady)) {
      await page.waitForTimeout(800);
      await closeTalk();
      await shot('shadow_choose');
      const ev = page.locator('.battle__defense-card:not(.is-unusable):not([disabled])');
      if (await ev.count()) {
        await ev.first().click();
        await page.waitForTimeout(450);
        await shot('shadow_evade');
        await page.waitForTimeout(2500);
        await shot('shadow_after');
      }
    } else log('no defense 2');
  }

  if (want('gacha')) {
    await boot({ mapId: 'shop', x: 45, y: 20, dir: 'up' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    const tile = page.locator('.gacha-select__tile[data-series="desuoru"]');
    await tile.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    await shot('gacha_select');
    await tile.click(); await page.waitForTimeout(600);
    await shot('gacha_select_picked');
    await tile.click(); await page.waitForTimeout(1200);
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
    // 破って1枚ずつめくる → 一覧
    for (let i = 0; i < 12; i++) {
      await page.mouse.click(W / 2, H / 2);
      await page.waitForTimeout(1100);
      if (i === 1) await shot('gacha_open_1');
    }
    await shot('gacha_open_last');
  }

  if (want('shelf')) {
    for (const [name, loc] of [['shop_shelf_left', { mapId: 'shop', x: 30, y: 26, dir: 'left' }], ['shop_shelf_right', { mapId: 'shop', x: 58, y: 26, dir: 'right' }]]) {
      await boot(loc);
      await shot(name);
    }
  }

  if (want('cards14')) {
    // 技14枚を、大きなカード（normal・幅 140）と手札の形（hand・幅 98）で並べる（技の絵の横の位置を決めるため）
    for (const [size, width, cols] of [['normal', 120, 3], ['hand', 98, 3]]) {
      for (const [part, from] of [[1, 1], [2, 7], [3, 13]]) {
        await seed(home);
        await page.evaluate(async ([size, width, from]) => {
          const { createSkillCard } = await import('/src/ui/components/skillCard.ts');
          const { getSkill } = await import('/src/data/cards.ts');
          await import('/src/ui/styles/cards.css');
          const box = document.createElement('div');
          box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1a2238;display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start;padding:8px;';
          for (let n = from; n < from + 6 && n <= 14; n++) box.append(createSkillCard(getSkill(`skl-desuoru-${String(n).padStart(2, '0')}`), { width, size }));
          document.body.append(box);
        }, [size, width, from]);
        await page.waitForTimeout(1500);
        await shot(`cards14_${size}_${part}`);
      }
    }
  }

  if (want('portraits')) {
    await seed(home);
    await page.evaluate(async () => {
      const { createMonsterPortrait } = await import('/src/ui/components/monsterPortrait.ts');
      const { getMonster } = await import('/src/data/cards.ts');
      await import('/src/ui/styles/battlePs.css');
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1a2238;display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;align-content:flex-start;padding:20px;';
      for (const id of ['mon-desuoru', 'mon-serephine', 'mon-lazuck']) {
        for (const size of [28, 40, 52, 72, 88]) box.append(createMonsterPortrait(getMonster(id), size));
        box.append(Object.assign(document.createElement('div'), { style: 'flex-basis:100%;height:0' }));
      }
      document.body.append(box);
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/portraits.png`, clip: { x: 0, y: 0, width: W, height: 420 } });
    log('shot', 'portraits');
  }
  await browser.close();
})();
