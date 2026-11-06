// 2026-11-06 指示書 BM：フギンの写真（確かめ用の画面・図鑑・大きなカード・手札の枠〔ハクラン・フルーネ・フォルン・ウズリオと並べて〕・パック・
// 対戦〔ちえのささやきで選ぶ画面と手札・はねやすめの印とかぜよみが0マナ・よみのまなざしで封じた・ひかりものをぬすむでマナが減った〕）。開発用サーバー（npx vite）で動かす。
// 使い方: node tools/e2e/bm_huginn_shot.cjs URL 出力フォルダ（W・H で画面の大きさ、LANG=en で英語、ONLY=lab,book,… でしぼる）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const ONLY = (process.env.ONLY || 'lab,book,hand,gacha,search,rest,restDefend,gaze,steal').split(',');
const suffix = `_${LANG}_${W}x${H}`;
fs.mkdirSync(out, { recursive: true });
const hg = (n) => `skl-huginn-${String(n).padStart(2, '0')}`;
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


  const all = { 'mon-huginn': 2, 'mon-hakuran': 1, 'mon-pukarim': 1, 'mon-uzurio': 1 };
  for (let n = 1; n <= 12; n++) all[hg(n)] = 2;

  // 1. 確かめ用の画面
  if (ONLY.includes('lab')) {
    await putSave({});
    await page.goto(`${base}?qa=1&lab=huginn`);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(2500);
    await waitImages();
    const body = page.locator('.pukarim-lab__body');
    const total = await body.evaluate((el) => el.scrollHeight);
    for (let i = 0, y = 0; y < total && i < 8; i++, y += H - 160) {
      await body.evaluate((el, y) => (el.scrollTop = y), y);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/huginn_lab_${i + 1}${suffix}.png` });
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

  // 2. 図鑑（No.300〜312）とフギン・技の大きなカード（06・07・10・12）
  if (ONLY.includes('book')) {
    await openBook();
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.card-book__item')].find((e) => /フギン|Huginn/.test(e.textContent || ''));
      el?.scrollIntoView({ block: 'start' });
      const sc = el?.closest('.card-book');
      if (sc) sc.scrollTop -= 60;
    });
    await page.waitForTimeout(800);
    await waitImages();
    await page.screenshot({ path: `${out}/huginn_book_grid${suffix}.png` });
    await page.evaluate(() => { const sc = document.querySelector('.card-book'); if (sc) sc.scrollTop += 560; });
    await page.waitForTimeout(800);
    await waitImages();
    await page.screenshot({ path: `${out}/huginn_book_grid2${suffix}.png` });
    await bookDetail(LANG === 'en' ? 'Huginn' : 'フギン', 'huginn_book_monster');
    const names = LANG === 'en' ? [[6, 'Foresight Gaze'], [7, 'Whisper of Wisdom'], [10, 'Wing Rest'], [12, 'Foresee']] : [[6, 'よみのまなざし'], [7, 'ちえのささやき'], [10, 'はねやすめ'], [12, 'さきよみ']];
    for (const [n, name] of names) await bookDetail(name, `huginn_big_${String(n).padStart(2, '0')}`);
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




  const MINE = ['mon-huginn', 'mon-soramo', 'mon-nobiton'];
  const FOES = ['mon-soramo', 'mon-lazuck', 'mon-gauul'];

  // 3. 手札とバトル用カード（BM の直し：枠を #1E6B45 に）：フギン・ハクラン・フルーネ（自分）とフォルン・ウズリオ（相手）。
  //    手札は5体の技（フギン・ハクラン・フルーネ・フォルン・ウズリオ・フギン）。暗い緑の枠が見分けられるか
  if (ONLY.includes('hand')) {
    await battle(
      'hand',
      `${head}
      const player = mk('player', ['${hg(4)}', 'skl-hakuran-03', 'skl-flune-03', 'skl-forn-03', 'skl-uzurio-03', '${hg(2)}']);
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-forn', 'mon-uzurio', 'mon-gauul'],
      ['mon-huginn', 'mon-hakuran', 'mon-flune'],
    );
    await page.screenshot({ path: `${out}/hand_compare${suffix}.png` });
    // フォルン・ウズリオの技も使える色で並べる（自分の場をフギン・フォルン・ウズリオに。相手はハクラン・フルーネ）
    await battle(
      'hand2',
      `${head}
      const player = mk('player', ['${hg(4)}', 'skl-forn-03', 'skl-uzurio-03', 'skl-hakuran-03', 'skl-flune-03', '${hg(2)}']);
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-hakuran', 'mon-flune', 'mon-gauul'],
      ['mon-huginn', 'mon-forn', 'mon-uzurio'],
    );
    await page.screenshot({ path: `${out}/hand_compare2${suffix}.png` });
  }

  // 4. ガチャ：フギンのモンスターカードを持っているときだけ並ぶ
  if (ONLY.includes('gacha')) {
    await page.goto(base);
    await page.waitForTimeout(1200);
    await putSave({ 'mon-huginn': 1 });
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await mountScreen('gacha');
    await page.waitForTimeout(1500);
    await waitImages();
    await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('.gacha-select__tile')];
      const k = tiles.find((t) => (t.querySelector('img')?.getAttribute('src') || '').includes('huginn'));
      k?.scrollIntoView({ block: 'center' });
      globalThis.__tile = tiles.indexOf(k);
    });
    await page.waitForTimeout(600);
    const idx = await page.evaluate(() => globalThis.__tile);
    if (idx >= 0) {
      await page.locator('.gacha-select__tile').nth(idx).click();
      await page.waitForTimeout(1000);
      await waitImages();
    } else console.log('no huginn tile');
    await page.screenshot({ path: `${out}/huginn_gacha${suffix}.png` });
  }

  // 5. ちえのささやき：使う → 山札の回避を選ぶ窓 → 手札に入った所
  if (ONLY.includes('search')) {
    await battle(
      'search',
      `${head}
      const p0 = mk('player', ['${hg(7)}', '${hg(2)}', '${hg(4)}']);
      const player = { ...p0, deck: ['${hg(11)}', 'skl-soramo14-03', '${hg(12)}', 'skl-soramo14-14', ...p0.deck.slice(0, 20)] };
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      FOES,
      MINE,
    );
    await tapHand('x0');
    await useBtn();
    await page.waitForTimeout(900);
    await waitImages();
    await page.screenshot({ path: `${out}/search_pick${suffix}.png` });
    await page.locator('.battle-pick__item').filter({ hasText: LANG === 'en' ? 'Wind Reading' : 'かぜよみ' }).first().click({ timeout: 3000 }).catch(() => console.log('no pick'));
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${out}/search_hand${suffix}.png` });
    await openLog('search');
  }

  // 6. はねやすめ：使う → フギンに印（回避の印に 0）・手札の かぜよみ のマナが 0 に
  if (ONLY.includes('rest')) {
    await battle(
      'rest',
      `${head}
      const player = mk('player', ['${hg(10)}', '${hg(11)}', '${hg(2)}']);
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      FOES,
      MINE,
    );
    await page.screenshot({ path: `${out}/rest_before${suffix}.png` });
    await tapHand('x0');
    await useBtn();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/rest_play${suffix}.png` });
    await page.locator('.battle__monster[data-uid="p-m1"]').click({ timeout: 3000, force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/rest_detail${suffix}.png` });
    await page.locator('.modal button').last().click({ timeout: 2000 }).catch(() => {});
    await openLog('rest');
  }

  // 7. はねやすめの印があるフギンが相手の攻撃を受ける：マナ0でも かぜよみ（0）で回避できる
  if (ONLY.includes('restDefend')) {
    await battle(
      'restDefend',
      `${head}
      const p0 = mk('player', ['${hg(11)}', '${hg(1)}']);
      const player = { ...p0, manaPile: [], monsters: p0.monsters.map((m, i) => i === 0 ? { ...m, featherRest: true } : { ...m, life: 0 }) };
      const o0 = mk('opponent', ['skl-soramo14-04', 'skl-soramo14-04', 'skl-soramo14-01']);
      const opponent = o0;
      return { ...s, turn: t + 1, active: 'opponent', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      FOES,
      MINE,
    );
    await page.waitForSelector('.battle__hand-card[data-uid="x0"]', { timeout: 15000 }).catch(() => {});
    for (let i = 0; i < 20; i++) {
      const defense = await page.evaluate(() => /守|Defen|guard|回避/i.test(document.querySelector('.battle__prompt, .battle__phase, .battle__status')?.textContent || ''));
      if (defense) break;
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${out}/restDefend_before${suffix}.png` });
    // 守りのカードは1回押すと使う
    await page.locator('.battle__defense-card').first().click({ timeout: 3000 }).catch(() => console.log('no defense card'));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/restDefend_select${suffix}.png` });
    await page.locator(`button:has-text("${LANG === 'en' ? 'Done' : '守備を終える'}")`).first().click({ timeout: 2000 }).catch(() => console.log('no done'));
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${out}/restDefend_after${suffix}.png` });
    await openLog('restDefend');
  }

  // 8. よみのまなざし：当たった相手のソラモは次の攻撃を行えない（封じの印）
  if (ONLY.includes('gaze')) {
    await battle(
      'gaze',
      `${head}
      const player = mk('player', ['${hg(6)}', '${hg(2)}']);
      const opponent = mk('opponent', []);
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      FOES,
      MINE,
    );
    await tapHand('x0');
    await useBtn();
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ timeout: 3000, force: true }).catch((e) => console.log('no target', e.message.slice(0, 120)));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/gaze_after${suffix}.png` });
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ timeout: 3000, force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/gaze_detail${suffix}.png` });
    await page.locator('.modal button').last().click({ timeout: 2000 }).catch(() => {});
    await openLog('gaze');
  }

  // 9. ひかりものをぬすむ：相手のマナ 6 → 5
  if (ONLY.includes('steal')) {
    await battle(
      'steal',
      `${head}
      const player = mk('player', ['${hg(8)}', '${hg(2)}']);
      const opponent = mk('opponent', []);
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      FOES,
      MINE,
    );
    await page.screenshot({ path: `${out}/steal_before${suffix}.png` });
    await tapHand('x0');
    await useBtn();
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ timeout: 3000, force: true }).catch((e) => console.log('no target', e.message.slice(0, 120)));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/steal_after${suffix}.png` });
    await openLog('steal');
  }

  await browser.close();
})();
