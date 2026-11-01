// 指示書 AK（2026-11-02）リリルの写真。開発用サーバー（npx vite）で動かす（aj_shot.cjs・desuoru_ag_shot.cjs と同じ作り）。
// 撮るもの：
//   book    図鑑（モンスターカード・技12枚）・大きなカード（モンスター・06・07・09・12）
//   hand    手札（リリルのピンクの枠をミュロル〔水色〕・ノビトン〔黄色〕・ソラモと並べる）・押して大きく出したカード
//   frames  技カードの枠の並び（16体の1枚目を大きなカード・手札の形で。ピンクの名前の帯がほかと見分けられるか）
//   cards12 技12枚を大きなカード・手札の形で並べる（技の絵の横の位置を決めるため）
//   habitat 居場所の印（空中）。対戦中のモンスター
//   wink    うっとりウインク：CPU が使った所／ウインクされた自分のモンスターは相手のリリルしか狙えない所
//   tears   うそなき：自分が使った所／相手のリリルが隠れていて狙えない所
//   scent   あまいかおり：相手のマナが4減る所（使う前・使ったあと）
//   evade   リリルが回避する所（はねでかわす）
//   moncard 対戦のアイコンの切り抜き・バトル用の大きなカード（対戦でモンスターを押したとき）・アイコンの並び
//   box     箱を選ぶ画面・旅立ちのきらめきを開けた一覧・試験の貸しデッキ
//   gacha   ガチャ（リリルを持っているセーブ：シリーズ選び・封をしたパック）
// 撮影のときだけ、ブラウザの中でセーブを作る。対戦の始まりは page.route で包んで置きかえる（ゲームのファイルは変えない）
// 使い方: node tools/e2e/lilil_ak_shot.cjs http://127.0.0.1:5173/ 出力フォルダ（ONLY=book,hand,... でしぼれる）
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
const lil = (n) => `skl-lilil-${String(n).padStart(2, '0')}`;
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
      const opponent = { ...ENCOUNTERS['enc-ice-boss'], name: '写真用の相手', monsters: o.oppMonsters ?? ['mon-soramo', 'mon-lilil', 'mon-myurol'], ace: 'mon-lilil', lifeScale: 1, ...(o.skill ? { skill: o.skill } : {}) };
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
    await center('mon-lilil');
    await page.waitForTimeout(700);
    await shot('book_monster');
    await center(lil(5));
    await page.waitForTimeout(500);
    await shot('book_skills_1');
    await center(lil(11));
    await page.waitForTimeout(500);
    await shot('book_skills_2');
    for (const id of ['mon-lilil', lil(6), lil(7), lil(8), lil(9), lil(12)]) {
      await center(id);
      await page.waitForTimeout(400);
      await page.locator(`.card-book__item[data-id="${id}"]`).first().click();
      await page.waitForTimeout(1200);
      await shot(`big_${id === 'mon-lilil' ? 'mon' : id.slice(-2)}`);
      await closeModal();
    }
  }

  if (want('hand')) {
    // 手札：リリル（ローズピンク）・ミュロル（水色）・ノビトン（黄色）・ソラモ（ベージュ）の枠を並べる
    await start({ monsters: ['mon-lilil', 'mon-myurol', 'mon-nobiton'], mana: 6, hand: [lil(5), 'skl-myurol-05', 'skl-nobiton-05', lil(8), lil(12), 'skl-soramo14-03'] });
    await page.evaluate(() => { const h = document.querySelector('.battle__hand'); if (h) h.scrollLeft = 0; });
    await shot('hand');
    for (const [id, n] of [[lil(5), '05'], [lil(8), '08'], [lil(12), '12'], ['skl-myurol-05', 'myurol_05'], ['skl-nobiton-05', 'nobiton_05']]) {
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
    // 16体の技カード（各モンスターの1枚目）を並べる：ピンクの名前の帯がほかの枠と見分けられるか
    const firsts = await (async () => { await page.goto(base); await page.waitForTimeout(800); return page.evaluate(async () => {
      const { AJ_SKILLS } = await import('/src/data/skillRebuildAJ.ts');
      return Object.values(AJ_SKILLS).map((rows) => rows[0].id);
    }); })();
    await grid('frames_normal', firsts.slice(0, 9), 'normal', 120);
    await grid('frames_normal_2', firsts.slice(9), 'normal', 120);
    await grid('frames_hand', firsts, 'hand', 90);
  }

  if (want('cards12')) {
    for (const [size, width] of [['normal', 120], ['hand', 98]]) {
      await grid(`cards12_${size}_1`, [1, 2, 3, 4, 5, 6].map(lil), size, width);
      await grid(`cards12_${size}_2`, [7, 8, 9, 10, 11, 12].map(lil), size, width);
    }
  }

  if (want('habitat')) {
    // 居場所の印：自分 リリル（空中）・ソラモ（地上）・ミュロル（水中）
    await start({ monsters: ['mon-lilil', 'mon-soramo', 'mon-myurol'], hand: [lil(1)] });
    await shot('habitat_battle');
    await page.locator('.battle-row--player .battle-side').screenshot({ path: `${out}/habitat_row.png` }).catch(() => {});
  }

  if (want('wink')) {
    // CPU（相手のリリル o-m2）がうっとりウインクを使う
    await start({ first: 'opponent', monsters: ['mon-soramo', 'mon-gauul', 'mon-myurol'], mana: 4, hand: ['skl-soramo14-03', 'skl-soramo14-07'], oppMana: 4, oppHand: [lil(8)], skill: 'A', wait: 300 });
    if (await waitFor(() => !!document.querySelector('.battle-spot--opponent:not(.is-idle) .battle-spot__card'))) {
      await page.waitForTimeout(1200);
      await shot('wink_cpu_card');
    } else log('no opponent card');
    await page.waitForTimeout(2600);
    await shot('wink_cpu_after');
    // ウインクされた自分のソラモ（p-m1。ほかの2体は倒れている）：攻撃を選ぶと、狙えるのは相手のリリル（o-m2）だけ
    await start({ monsters: ['mon-soramo', 'mon-gauul', 'mon-myurol'], mana: 6, hand: ['skl-soramo14-03'], lives: { 'p-m2': 0, 'p-m3': 0 }, mons: { 'p-m1': { taunt: { monsterId: 'mon-lilil', turn: 3 } } } });
    await shot('wink_taunted_before');
    await useCard('skl-soramo14-03');
    await page.waitForTimeout(900);
    await shot('wink_only_lilil');
    log('wink targets', await targets());
    // 自分のリリルが使う所（記録の帯）
    await start({ monsters: ['mon-lilil', 'mon-soramo', 'mon-myurol'], mana: 6, hand: [lil(8), lil(1)], oppMonsters: ['mon-soramo', 'mon-gauul', 'mon-myurol'] });
    await openCard(lil(8));
    await shot('wink_detail');
    await page.locator('button:has-text("使う")').first().click({ timeout: 3000 });
    await page.waitForTimeout(900);
    await shot('wink_choose_target');
    const t = page.locator('.battle__monster--opponent.is-target').first();
    if (await t.count()) { await t.click({ force: true }); await page.waitForTimeout(500); }
    const ok = page.locator('button:has-text("決定"), button:has-text("使う")');
    if (await ok.count()) await ok.first().click({ timeout: 800 }).catch(() => {});
    await page.waitForTimeout(2600);
    await shot('wink_used');
  }

  if (want('tears')) {
    // 自分のリリルがうそなき
    await start({ monsters: ['mon-lilil', 'mon-soramo', 'mon-myurol'], mana: 6, hand: [lil(9), lil(1)], oppMonsters: ['mon-soramo', 'mon-gauul', 'mon-myurol'] });
    await openCard(lil(9));
    await shot('tears_detail');
    await page.locator('button:has-text("使う")').first().click({ timeout: 3000 });
    await page.waitForTimeout(900);
    const ok = page.locator('button:has-text("決定")');
    if (await ok.count()) await ok.first().click({ timeout: 800 }).catch(() => {});
    await page.waitForTimeout(2600);
    await shot('tears_used');
    // 相手のリリル（o-m2）がうそなき中：攻撃を選ぶと、狙えるのはソラモ・ミュロルだけ
    await start({ monsters: ['mon-soramo', 'mon-gauul', 'mon-myurol'], mana: 6, hand: ['skl-soramo14-03'], mons: { 'o-m2': { hiddenTurn: 3 } } });
    await useCard('skl-soramo14-03');
    await page.waitForTimeout(900);
    await shot('tears_cannot_target');
    log('tears targets', await targets());
  }

  if (want('scent')) {
    // あまいかおり：相手のマナ6 → 当たって 2 に
    await start({ monsters: ['mon-lilil', 'mon-soramo', 'mon-myurol'], mana: 6, hand: [lil(7)], oppMana: 6, oppMonsters: ['mon-soramo', 'mon-gauul', 'mon-myurol'] });
    await shot('scent_before');
    await openCard(lil(7));
    await shot('scent_detail');
    await page.locator('button:has-text("使う")').first().click({ timeout: 3000 });
    await page.waitForTimeout(900);
    const t = page.locator('.battle__monster--opponent.is-target').first();
    if (await t.count()) { await t.click({ force: true }); await page.waitForTimeout(500); }
    await page.waitForTimeout(3500);
    await shot('scent_after');
    await page.waitForTimeout(2000);
    await shot('scent_after_2');
  }

  if (want('evade')) {
    // 相手のソラモのたいあたり（ちから）を、自分のリリル（ほかの2体は倒れている）が はねでかわす で回避
    await start({ first: 'opponent', monsters: ['mon-lilil', 'mon-soramo', 'mon-myurol'], mana: 3, hand: [lil(10), lil(11)], oppMana: 6, oppHand: ['skl-soramo14-03'], oppMonsters: ['mon-soramo', 'mon-gauul', 'mon-myurol'], lives: { 'p-m2': 0, 'p-m3': 0 }, wait: 300 });
    if (await waitFor(defenseReady)) {
      await page.waitForTimeout(800);
      await closeTalk();
      await shot('evade_choose');
      const ev = page.locator('.battle__defense-card:not(.is-unusable):not([disabled])');
      if (await ev.count()) {
        await ev.first().click();
        await page.waitForTimeout(450);
        await shot('evade_used');
        await page.waitForTimeout(2500);
        await shot('evade_after');
      }
    } else log('no defense');
  }

  if (want('moncard')) {
    await start({ monsters: ['mon-lilil', 'mon-myurol', 'mon-nobiton'], mana: 3, hand: [lil(1)] });
    await shot('battle_icons');
    await page.locator('.battle__monster[data-uid="p-m1"]').click({ force: true });
    await page.waitForTimeout(1200);
    await shot('moncard_lilil');
    await page.keyboard.press('Escape');
    await page.mouse.click(10, 10);
    await page.waitForTimeout(800);
    await page.goto(base);
    await page.waitForTimeout(1000);
    await page.evaluate(async () => {
      const { createMonsterPortrait } = await import('/src/ui/components/monsterPortrait.ts');
      const { getMonster } = await import('/src/data/cards.ts');
      await import('/src/ui/styles/battlePs.css');
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1a2238;display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;align-content:flex-start;padding:20px;';
      for (const id of ['mon-lilil', 'mon-desuoru', 'mon-myurol']) {
        for (const size of [28, 40, 52, 72, 88]) box.append(createMonsterPortrait(getMonster(id), size));
        box.append(Object.assign(document.createElement('div'), { style: 'flex-basis:100%;height:0' }));
      }
      document.body.append(box);
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/portraits.png`, clip: { x: 0, y: 0, width: W, height: 420 } });
    log('shot', 'portraits');
    // バトル用の大きなカード（リリル・デスオル・ガウル。羽の先が枠に切られていないか）
    await page.goto(base);
    await page.waitForTimeout(1000);
    await page.evaluate(async () => {
      const { createBattleMonsterCard } = await import('/src/ui/components/battleMonsterCard.ts');
      const { getMonster } = await import('/src/data/cards.ts');
      await import('/src/ui/styles/cards.css');
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1a2238;display:flex;flex-wrap:wrap;gap:10px;align-content:flex-start;padding:10px;';
      box.append(createBattleMonsterCard(getMonster('mon-lilil'), 370));
      for (const id of ['mon-lilil', 'mon-desuoru', 'mon-gauul']) box.append(createBattleMonsterCard(getMonster(id), 116, { current: 5, max: 5 }));
      document.body.append(box);
    });
    await page.waitForTimeout(1500);
    await shot('battlecard_big');
  }

  if (want('box')) {
    // 箱を選ぶ画面（試験に合格したあと、管理局で）
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
      await page.locator('.booster-select__box').nth(0).click();
      await page.waitForTimeout(700);
      await shot('box_select_tabidachi');
      await page.locator('.booster-select__box').nth(0).click();
      await page.waitForSelector('.modal', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(800);
      await shot('box_got');
      await page.locator('.modal .btn--primary').click({ timeout: 3000 }).catch(() => {});
      await page.waitForSelector('.card-list', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
      await shot('box_open_list');
      await page.locator('.card-list__rows').evaluate((el) => (el.scrollTop = el.scrollHeight / 3)).catch(() => {});
      await page.waitForTimeout(400);
      await shot('box_open_list_lilil');
    } else log('no booster select');
    // 試験の貸しデッキ（旅立ちと同じ）
    await mount('collection');
    await page.evaluate(async () => {
      const { examLoanDeck } = await import('/src/game/story/introV2.ts');
      const { openCardList } = await import('/src/ui/components/cardListView.ts');
      const deck = examLoanDeck();
      openCardList(document.querySelector('#app'), { cardIds: [...deck.monsters, ...deck.skills], onClose: () => {} });
    });
    await page.waitForTimeout(1500);
    await shot('exam_loan_deck');
    // 試験の対戦（貸しデッキで先生と）
    const deck = await page.evaluate(async () => (await import('/src/game/story/introV2.ts')).examLoanDeck());
    await start({ deck, hand: [lil(1), lil(8), 'skl-soramo14-03'], mana: 4, oppMonsters: ['mon-lazuck', 'mon-kalshell', 'mon-nobiton'] });
    await shot('exam_battle');
  }

  if (want('gacha')) {
    await page.goto(base);
    await page.waitForTimeout(800);
    const json = await seedSave({ location: { mapId: 'shop', x: 45, y: 20, dir: 'up' } });
    await page.close();
    page = await ctx.newPage();
    page.on('pageerror', (e) => log('PAGEERROR', e.message));
    await page.addInitScript((s) => localStorage.setItem('mistria-battle-card/save', s), json);
    await page.goto(base);
    await page.waitForTimeout(1000);
    const c = page.locator('button:has-text("続きから"):not([disabled])').first();
    if (await c.count()) await c.click();
    await page.waitForTimeout(2500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    const tile = page.locator('.gacha-select__tile[data-series="lilil"]');
    await tile.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    await shot('gacha_select');
    await tile.click(); await page.waitForTimeout(600);
    await shot('gacha_select_picked');
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
  await browser.close();
})();
