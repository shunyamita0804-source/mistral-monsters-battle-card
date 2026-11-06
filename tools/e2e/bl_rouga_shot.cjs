// 2026-11-06 指示書 BL：ロウガの写真（確かめ用の画面・図鑑・大きなカード・手札の枠〔ラズック・クヨウ・セレフィーンと並べて〕・パック・
// 対戦〔とおぼえの印 → 次の攻撃に＋2・期限で消えた・こおりのきばで凍った〕）。開発用サーバー（npx vite）で動かす。
// 使い方: node tools/e2e/bl_rouga_shot.cjs URL 出力フォルダ（W・H で画面の大きさ、LANG=en で英語、ONLY=lab,book,… でしぼる）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const ONLY = (process.env.ONLY || 'lab,book,hand,gacha,howl,howlHit,fade,fang').split(',');
const suffix = `_${LANG}_${W}x${H}`;
fs.mkdirSync(out, { recursive: true });
const rg = (n) => `skl-rouga-${String(n).padStart(2, '0')}`;
const USE = LANG === 'en' ? 'Use' : '使う';
const CLOSE = LANG === 'en' ? 'Close' : '閉じる';
const END_ATTACK = LANG === 'en' ? 'End Attack' : '攻撃終了';
const END_TURN = LANG === 'en' ? 'End Turn' : 'ターン終了';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((l) => localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: l, seVolume: 0, bgmVolume: 0, muted: true })), LANG);
  await ctx.route(/\/src\/game\/battle\/engine\.ts/, async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    body = body.replace('export function createBattle(', 'function createBattle__orig(');
    body += '\nexport function createBattle(...a) { const s = createBattle__orig(...a); return globalThis.__battlePatch ? globalThis.__battlePatch(s) : s; }\n';
    await route.fulfill({ response: res, body });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});

  /** セーブを置く（collection に足すカード）。読み込みを待つ */
  const putSave = (extra) =>
    page.evaluate(async (extra) => {
      const { createNewSave } = await import('/src/game/save/saveData.ts');
      const s0 = createNewSave(new Date(2026, 10, 5));
      const collection = { ...s0.collection, ...extra };
      localStorage.setItem(
        'mistria-battle-card/save',
        JSON.stringify({ ...s0, coins: 3000, collection, player: { gender: 'male', name: 'テスト' }, story: { ...s0.story, intro: 'completed', introV2: { ...s0.story.introV2, state: 'legacySkipped' } } }),
      );
    }, extra);
  /** 画面を1つだけ置く（街を通らない） */
  const mountScreen = (id) =>
    page.evaluate(async (id) => {
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const store = GameStore.fromBrowser();
      globalThis.__store = store;
      const stage = mountStage(document.querySelector('#app'), { qa: false });
      const noop = () => {};
      const screen = SCREENS[id].create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = id;
      stage.element.replaceChildren(screen.element);
    }, id);
  const waitImages = () =>
    page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => console.log('images timeout'));


  const all = { 'mon-rouga': 2, 'mon-lazuck': 1, 'mon-kuyo': 1, 'mon-serephine': 1 };
  for (let n = 1; n <= 12; n++) all[rg(n)] = 2;

  // 1. 確かめ用の画面
  if (ONLY.includes('lab')) {
    await putSave({});
    await page.goto(`${base}?qa=1&lab=rouga`);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(2500);
    await waitImages();
    const body = page.locator('.pukarim-lab__body');
    const total = await body.evaluate((el) => el.scrollHeight);
    for (let i = 0, y = 0; y < total && i < 8; i++, y += H - 160) {
      await body.evaluate((el, y) => (el.scrollTop = y), y);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/rouga_lab_${i + 1}${suffix}.png` });
    }
  }

  const openBook = async () => {
    await page.goto(base);
    await page.waitForTimeout(1200);
    await putSave(all);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await mountScreen('collection');
    await page.waitForTimeout(1500);
  };
  /** 図鑑で名前のカードを押して、大きなカードの説明を撮る（切り出しと画面全体） */
  const bookDetail = async (name, file) => {
    const item = page.locator('.card-book__item').filter({ has: page.locator('.card-grid__name', { hasText: new RegExp(`^${name}$`) }) }).first();
    await item.scrollIntoViewIfNeeded().catch(() => console.log('no item', name));
    await item.click({ timeout: 3000 }).catch(() => console.log('no click', name));
    await page.waitForTimeout(900);
    await waitImages();
    await page.screenshot({ path: `${out}/${file}${suffix}.png` });
    await page.locator('.card-book-detail button').filter({ hasText: CLOSE }).first().click({ timeout: 2000 }).catch(() => console.log('no close'));
    await page.waitForTimeout(500);
  };

  // 2. 図鑑（No.287〜299）とロウガ・技の大きなカード（04・09・10・12）
  if (ONLY.includes('book')) {
    await openBook();
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.card-book__item')].find((e) => /ロウガ|Rouga/.test(e.textContent || ''));
      el?.scrollIntoView({ block: 'start' });
      const sc = el?.closest('.card-book');
      if (sc) sc.scrollTop -= 60;
    });
    await page.waitForTimeout(800);
    await waitImages();
    await page.screenshot({ path: `${out}/rouga_book_grid${suffix}.png` });
    await page.evaluate(() => { const sc = document.querySelector('.card-book'); if (sc) sc.scrollTop += 560; });
    await page.waitForTimeout(800);
    await waitImages();
    await page.screenshot({ path: `${out}/rouga_book_grid2${suffix}.png` });
    await bookDetail(LANG === 'en' ? 'Rouga' : 'ロウガ', 'rouga_book_monster');
    const names = LANG === 'en' ? [[4, 'Ice Fang'], [9, 'Howl'], [10, 'Frost Wolf Strike'], [12, 'Jump']] : [[4, 'こおりのきば'], [9, 'とおぼえ'], [10, 'ひょうろうのいちげき'], [12, 'ジャンプ']];
    for (const [n, name] of names) await bookDetail(name, `rouga_big_${String(n).padStart(2, '0')}`);
  }

  /** 対戦を置く（patch で場面を作る） */
  const battle = async (who, patchSrc, foeMonsters, mine = ['mon-kuyo', 'mon-soramo', 'mon-nobiton']) => {
    await page.goto(base);
    await page.waitForTimeout(1200);
    await putSave({});
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.evaluate(
      async ({ patchSrc, foeMonsters, mine }) => {
        // eslint-disable-next-line no-new-func
        globalThis.__battlePatch = new Function('s', patchSrc);
        const { GameStore } = await import('/src/ui/gameStore.ts');
        const { SCREENS } = await import('/src/ui/screens/registry.ts');
        const { mountStage } = await import('/src/ui/stage.ts');
        const store = GameStore.fromBrowser();
        const filler = Array.from({ length: 60 }, () => 'skl-soramo14-01');
        const deck = { monsters: mine, skills: filler };
        const foe = { monsters: foeMonsters, skills: filler };
        store.pendingBattle = { title: '確認', opponent: { id: 'qa', name: '確認用の相手', monsters: foe.monsters, lifeScale: 1 }, opponentDeck: foe, allowSurrender: false, playerDeck: deck, onFinish: () => {} };
        const stage = mountStage(document.querySelector('#app'), { qa: false });
        const noop = () => {};
        const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
        stage.element.dataset.screen = 'battle';
        stage.element.replaceChildren(screen.element);
      },
      { patchSrc, foeMonsters, mine },
    );
    await page.waitForSelector('.battle-order__card', { timeout: 15000 });
    await page.waitForTimeout(700);
    await page.locator('.battle-order__card').first().click();
    await page.waitForTimeout(4500);
    await waitImages();
  };
  const tapHand = async (uid) => {
    const b = await page.locator(`.battle__hand-card[data-uid="${uid}"]`).boundingBox();
    if (b) await page.mouse.click(b.x + 12, b.y + b.height / 2);
    await page.waitForTimeout(800);
  };
  const useBtn = async () => {
    await page.locator(`button:has-text("${USE}")`).first().click({ timeout: 3000 }).catch(() => console.log('no use button'));
    await page.waitForTimeout(900);
  };
  const openLog = async (name) => {
    await page.waitForTimeout(2500);
    await page.locator('.battle__ticker-hit').first().click({ timeout: 3000 }).catch(() => console.log('no ticker'));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/${name}_log${suffix}.png` });
  };
  // 自分の手番のはじめ（マナ6・相手の手札5枚）
  const head = `
    const t = s.turn;
    const mk = (side, hand) => ({ ...s.sides[side], hand: hand.map((cardId, i) => ({ uid: (side === 'player' ? 'x' : 'y') + i, cardId })), manaPile: s.sides[side].deck.slice(0, 6), deck: s.sides[side].deck.slice(6) });
  `;



  // 3. 手札とバトル用カード：ロウガ・ラズック・クヨウ（自分）とセレフィーン（相手）。手札は4体の技
  if (ONLY.includes('hand')) {
    await battle(
      'hand',
      `${head}
      const player = mk('player', ['${rg(6)}', 'skl-lazuck-03', 'skl-kuyo-03', 'skl-serephine-03', '${rg(2)}', 'skl-lazuck-06']);
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-serephine', 'mon-soramo', 'mon-gauul'],
      ['mon-rouga', 'mon-lazuck', 'mon-kuyo'],
    );
    await page.screenshot({ path: `${out}/hand_compare${suffix}.png` });
  }

  // 4. ガチャ：ロウガのモンスターカードを持っているときだけ並ぶ
  if (ONLY.includes('gacha')) {
    await page.goto(base);
    await page.waitForTimeout(1200);
    await putSave({ 'mon-rouga': 1 });
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await mountScreen('gacha');
    await page.waitForTimeout(1500);
    await waitImages();
    await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('.gacha-select__tile')];
      const k = tiles.find((t) => (t.querySelector('img')?.getAttribute('src') || '').includes('rouga'));
      k?.scrollIntoView({ block: 'center' });
      globalThis.__tile = tiles.indexOf(k);
    });
    await page.waitForTimeout(600);
    const idx = await page.evaluate(() => globalThis.__tile);
    if (idx >= 0) {
      await page.locator('.gacha-select__tile').nth(idx).click();
      await page.waitForTimeout(1000);
      await waitImages();
    } else console.log('no rouga tile');
    await page.screenshot({ path: `${out}/rouga_gacha${suffix}.png` });
  }

  // 5. とおぼえ：使う → ロウガに印（＋2）
  if (ONLY.includes('howl')) {
    await battle(
      'howl',
      `${head}
      const player = mk('player', ['${rg(9)}', '${rg(6)}', '${rg(2)}']);
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-soramo', 'mon-lazuck', 'mon-gauul'],
      ['mon-rouga', 'mon-soramo', 'mon-nobiton'],
    );
    await tapHand('x0');
    await useBtn();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${out}/howl_play${suffix}.png` });
    await page.locator('.battle__monster[data-uid="p-m1"]').click({ timeout: 3000, force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/howl_detail${suffix}.png` });
    await page.locator('.modal button').last().click({ timeout: 2000 }).catch(() => {});
    await openLog('howl');
  }

  // 6. とおぼえの次の自分の手番：ひょうけつのかぎづめ（5）に＋2 → 7 ダメージ
  if (ONLY.includes('howlHit')) {
    await battle(
      'howlHit',
      `${head}
      const p0 = mk('player', ['${rg(6)}', '${rg(2)}']);
      const player = { ...p0, monsters: p0.monsters.map((m, i) => i === 0 ? { ...m, charge: 2, chargeUntil: t } : m) };
      const opponent = mk('opponent', []);
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-nobiton', 'mon-lazuck', 'mon-gauul'],
      ['mon-rouga', 'mon-soramo', 'mon-nobiton'],
    );
    await page.screenshot({ path: `${out}/howlHit_before${suffix}.png` });
    await tapHand('x0');
    await useBtn();
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ timeout: 3000, force: true }).catch((e) => console.log('no target', e.message.slice(0, 120)));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/howlHit_after${suffix}.png` });
    await openLog('howlHit');
  }

  // 7. 期限で消えた：とおぼえの期限の手番（この手番）に攻撃しないで手番を終える → 相手の手番のはじめに消える
  if (ONLY.includes('fade')) {
    await battle(
      'fade',
      `${head}
      const p0 = mk('player', ['${rg(11)}', '${rg(12)}']);
      const player = { ...p0, monsters: p0.monsters.map((m, i) => i === 0 ? { ...m, charge: 2, chargeUntil: t } : m) };
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-soramo', 'mon-lazuck', 'mon-gauul'],
      ['mon-rouga', 'mon-soramo', 'mon-nobiton'],
    );
    await page.screenshot({ path: `${out}/fade_before${suffix}.png` });
    await page.locator(`button:has-text("${END_ATTACK}")`).first().click({ timeout: 3000 }).catch(() => console.log('no end attack'));
    await page.waitForTimeout(900);
    await page.locator(`button:has-text("${END_TURN}")`).first().click({ timeout: 3000 }).catch(() => console.log('no end turn'));
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${out}/fade_after${suffix}.png` });
    await openLog('fade');
  }

  // 8. こおりのきば：相手のソラモが凍る
  if (ONLY.includes('fang')) {
    await battle(
      'fang',
      `${head}
      const player = mk('player', ['${rg(4)}', '${rg(2)}']);
      const opponent = mk('opponent', []);
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-soramo', 'mon-lazuck', 'mon-gauul'],
      ['mon-rouga', 'mon-soramo', 'mon-nobiton'],
    );
    await tapHand('x0');
    await useBtn();
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ timeout: 3000, force: true }).catch((e) => console.log('no target', e.message.slice(0, 120)));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/fang_after${suffix}.png` });
    await openLog('fang');
  }

  await browser.close();
})();
