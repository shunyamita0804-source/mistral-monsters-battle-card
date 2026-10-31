// 指示書 AF（2026-10-31）ハクランの写真。開発用サーバー（npx vite）で動かす。
// 撮るもの：
//   book_monster・book_skills_1・book_skills_2（図鑑）・big_mon・big_02・big_08・big_10・big_14（図鑑の大きなカード）・
//   hand（手札：ハクラン・ツムジ・ミュロルの枠を並べる）・hand_big_*（手札から大きなカード）・
//   def_undodgeable（相手のハクランの「回避されない」攻撃：自分の回避のカードは使えない）・def_reason（使えない理由の文）・def_guard（くものころもで守る）・def_after・
//   atk_undodgeable（自分のハクランのせいなるいかずち：相手は回避を持っていても使えない）・def_evade（ハクランがひらりとはねるで回避）・
//   gacha_select・gacha_machine・gacha_pack・shop_shelf_{left,right}・portraits（対戦のアイコンの切り抜き）
// 撮影のときだけ、ブラウザの中でセーブを作ってハクランを持たせる（thunder-boss-beaten も立てる）。対戦の始まりは page.route で包んで置きかえる（ゲームのファイルは変えない）
// 使い方: node tools/e2e/hakuran_af_shot.cjs http://127.0.0.1:5173/ 出力フォルダ（W・H で画面の大きさ）
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
const hak = (n) => `skl-hakuran-${String(n).padStart(2, '0')}`;
const tsu = (n) => `skl-tsumuji-${String(n).padStart(2, '0')}`;
const myu = (n) => `skl-myurol-${String(n).padStart(2, '0')}`;
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
      const collection = { ...s.collection, 'mon-hakuran': 1 };
      for (let i = 1; i <= 14; i++) collection[`skl-hakuran-${String(i).padStart(2, '0')}`] = 1;
      const save = { ...s, player: { gender: 'male', name: 'テスト' }, collection, location: loc, money: 5000, storyFlags: [...s.storyFlags, 'thunder-boss-beaten'] };
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
    await center('mon-hakuran');
    await page.waitForTimeout(700);
    await shot('book_monster');
    await center(hak(4));
    await page.waitForTimeout(500);
    await shot('book_skills_1');
    await center(hak(12));
    await page.waitForTimeout(500);
    await shot('book_skills_2');
    for (const id of ['mon-hakuran', hak(2), hak(8), hak(10), hak(14)]) {
      await center(id);
      await page.waitForTimeout(400);
      await page.locator(`.card-book__item[data-id="${id}"]`).first().click();
      await page.waitForTimeout(1200);
      await shot(`big_${id === 'mon-hakuran' ? 'mon' : id.slice(-2)}`);
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
      const deck = { monsters: ['mon-hakuran', 'mon-tsumuji', 'mon-myurol'], skills: Array.from({ length: 60 }, (_, i) => `skl-hakuran-${String((i % 9) + 1).padStart(2, '0')}`) };
      // 撮影用の相手：ソラモ・ハクラン（真ん中）・ミュロル（顔は氷の洞窟のイヴァン）
      const opponent = { ...ENCOUNTERS['enc-ice-boss'], name: '撮影用の相手', monsters: ['mon-soramo', 'mon-hakuran', 'mon-myurol'], ace: 'mon-hakuran', lifeScale: 1 };
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
    // 手札：ハクラン（青緑）・ツムジ（くすんだ青みの灰）・ミュロル（水色）の枠を並べる
    await start({ mana: 6, hand: [hak(2), tsu(1), myu(1), hak(8), hak(10), hak(14)] });
    await page.evaluate(() => { const h = document.querySelector('.battle__hand'); if (h) h.scrollLeft = 0; });
    await shot('hand');
    // 手札は並べかえられて重なるので、名前（aria-label）でカードを選ぶ
    for (const [id, n] of [[hak(2), '02'], [hak(8), '08'], [hak(10), '10'], [hak(14), '14'], [tsu(1), 'tsumuji_01'], [myu(1), 'myurol_01']]) {
      const label = await page.evaluate(async (id) => (await import('/src/data/cards.ts')).getSkill(id).name, id);
      await tap(page.locator(`.battle__hand-card[aria-label^="${label}"]`).first());
      await page.waitForTimeout(900);
      await shot(`hand_big_${n}`);
      // 選んだカードを戻す（選んだまま別のカードを押すと、選び直しにならないことがある）
      await page.locator('button:has-text("やめる")').first().click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  if (want('moncard')) {
    // 対戦の場でモンスターを押すと出るバトル用カード（枠の色）：自分のハクラン（p-m1）・ツムジ（p-m2）・ミュロル（p-m3）
    await start({ mana: 3, hand: [hak(1)] });
    for (const [uid, n] of [['p-m1', 'hakuran'], ['p-m2', 'tsumuji'], ['p-m3', 'myurol']]) {
      await page.locator(`.battle__monster[data-uid="${uid}"]`).click({ force: true });
      await page.waitForTimeout(1200);
      await shot(`moncard_${n}`);
      await page.keyboard.press('Escape');
      await page.mouse.click(10, 10);
      await page.waitForTimeout(800);
    }
  }

  if (want('def')) {
    // 相手の番：相手のハクラン（o-m2）が つのつき（回避されない）で、自分のハクラン（p-m1。ほかの2体は倒れている）を狙う
    await start({ first: 'opponent', mana: 5, hand: [hak(12), hak(14), hak(11), hak(13)], oppMana: 5, oppHand: [hak(7)], lives: { 'p-m2': 0, 'p-m3': 0, 'o-m1': 0, 'o-m3': 0 }, wait: 300 });
    if (await waitFor(defenseReady)) {
      await page.waitForTimeout(800);
      await closeTalk();
      await shot('def_undodgeable');
      // 使えない理由は、画面では「使えない」の1行で、文はボタンの読み上げ（aria-label）にある。報告のために書き出す
      const labels = await page.evaluate(() => [...document.querySelectorAll('.battle__defense-card')].map((b) => b.getAttribute('aria-label')));
      fs.writeFileSync(`${out}/def_undodgeable_labels.json`, JSON.stringify(labels, null, 1));
      log('labels', labels.join(' / '));
      const usable = page.locator('.battle__defense-card:not(.is-unusable):not([disabled])');
      if (await usable.count()) {
        await usable.first().click();
        await page.waitForTimeout(450);
        await shot('def_guard');
        await page.waitForTimeout(2500);
        await shot('def_after');
      } else log('no usable');
    } else log('no defense');
    // 相手の番：相手のハクランの くもをける（ふつうの攻撃）を、自分のハクランが ひらりとはねる で回避
    await start({ first: 'opponent', mana: 5, hand: [hak(12), hak(11)], oppMana: 5, oppHand: [hak(6)], lives: { 'p-m2': 0, 'p-m3': 0, 'o-m1': 0, 'o-m3': 0 }, wait: 300 });
    if (await waitFor(defenseReady)) {
      await page.waitForTimeout(800);
      await closeTalk();
      await shot('def_evade_choose');
      const ev = page.locator('.battle__defense-card:not(.is-unusable):not([disabled])');
      if (await ev.count()) {
        await ev.first().click();
        await page.waitForTimeout(450);
        await shot('def_evade');
        await page.waitForTimeout(2500);
        await shot('def_evade_after');
      }
    } else log('no defense 2');
  }

  if (want('atk')) {
    // 自分の番：自分のハクランの せいなるいかずち（回避されない）を相手のハクラン（o-m2。手札に回避2枚）に
    await start({ mana: 6, hand: [hak(10), hak(1), hak(3)], oppMana: 5, oppHand: [hak(13), hak(14)] });
    await tap(page.locator('.battle__hand-card').nth(0));
    await page.waitForTimeout(800);
    await page.locator('button:has-text("使う")').first().click({ timeout: 3000 });
    await page.waitForTimeout(900);
    await page.locator('.battle__monster[data-uid="o-m2"]').click({ force: true });
    await page.waitForTimeout(1500);
    await shot('atk_undodgeable');
    await page.waitForTimeout(2500);
    await shot('atk_undodgeable_after');
    const logBtn = page.locator('button:has-text("これまで")').first();
    if (await logBtn.count()) {
      await logBtn.click().catch(() => {});
      await page.waitForTimeout(900);
      await shot('atk_log');
    }
  }

  if (want('gacha')) {
    await boot({ mapId: 'shop', x: 45, y: 20, dir: 'up' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    const tile = page.locator('.gacha-select__tile[data-series="hakuran"]');
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
          for (let n = from; n < from + 6 && n <= 14; n++) box.append(createSkillCard(getSkill(`skl-hakuran-${String(n).padStart(2, '0')}`), { width, size }));
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
      for (const id of ['mon-hakuran', 'mon-shishien', 'mon-tsumuji']) {
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
