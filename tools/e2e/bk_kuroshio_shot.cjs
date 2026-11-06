// 2026-11-06 指示書 BK：クロシオの写真（確かめ用の画面・図鑑・大きなカード・手札の枠〔ガウル・リリルと並べて〕・パック・対戦〔ひきずりこむ・おおうずしお・灰色・おはらい〕）と、
// 防御・回避の文をそろえたカードの写真（長い文のカードの大きなカード・手札）。開発用サーバー（npx vite）で動かす。
// 使い方: node tools/e2e/bk_kuroshio_shot.cjs URL 出力フォルダ（W・H で画面の大きさ、LANG=en で英語、ONLY=lab,book,… でしぼる）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const ONLY = (process.env.ONLY || 'lab,book,big,hand,gacha,drag,whirl,gray,purify,texts').split(',');
const suffix = `_${LANG}_${W}x${H}`;
fs.mkdirSync(out, { recursive: true });
const kr = (n) => `skl-kuroshio-${String(n).padStart(2, '0')}`;
const USE = LANG === 'en' ? 'Use' : '使う';
const CLOSE = LANG === 'en' ? 'Close' : '閉じる';

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


  const all = { 'mon-kuroshio': 2, 'mon-kuyo': 1, 'mon-radiel': 1, 'mon-gearos': 1, 'mon-forn': 1, 'mon-tyrant': 1 };
  for (let n = 1; n <= 12; n++) all[kr(n)] = 2;
  for (const id of ['skl-kalshell-13', 'skl-forn-07', 'skl-forn-12', 'skl-kuyo-11', 'skl-myurol-08', 'skl-gearos-11', 'skl-hakuran-12', 'skl-myurol-14', 'skl-geol-11']) all[id] = 1;

  // 1. 確かめ用の画面（バトル用カード・技カード12枚）
  if (ONLY.includes('lab')) {
    await putSave({});
    await page.goto(`${base}?qa=1&lab=kuroshio`);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(2500);
    await waitImages();
    const body = page.locator('.pukarim-lab__body');
    const total = await body.evaluate((el) => el.scrollHeight);
    for (let i = 0, y = 0; y < total && i < 8; i++, y += H - 160) {
      await body.evaluate((el, y) => (el.scrollTop = y), y);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/kuroshio_lab_${i + 1}${suffix}.png` });
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

  // 2. 図鑑（No.274〜286）とクロシオの大きなカード
  if (ONLY.includes('book')) {
    await openBook();
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.card-book__item')].find((e) => /クロシオ|Kuroshio/.test(e.textContent || ''));
      el?.scrollIntoView({ block: 'start' });
      const sc = el?.closest('.card-book');
      if (sc) sc.scrollTop -= 60;
    });
    await page.waitForTimeout(800);
    await waitImages();
    await page.screenshot({ path: `${out}/kuroshio_book_grid${suffix}.png` });
    await bookDetail(LANG === 'en' ? 'Kuroshio' : 'クロシオ', 'kuroshio_book_monster');
  }

  // 3. 大きなカード（04・07・11・12）
  if (ONLY.includes('big')) {
    await openBook();
    const names = LANG === 'en' ? [[4, 'Drag Under'], [7, 'Great Whirlpool'], [11, 'Dive Dodge'], [12, 'Whirl Turn']] : [[4, 'ひきずりこむ'], [7, 'おおうずしお'], [11, 'もぐってかわす'], [12, 'うずまきターン']];
    for (const [n, name] of names) await bookDetail(name, `kuroshio_big_${String(n).padStart(2, '0')}`);
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


  // 4. 手札とバトル用カード：クロシオ（珊瑚）・ガウル（橙）・リリル（桃）を並べる
  if (ONLY.includes('hand')) {
    await battle(
      'hand',
      `${head}
      const player = mk('player', ['${kr(4)}', 'skl-gauul14-07', 'skl-lilil-01', '${kr(6)}', 'skl-gauul14-03', '${kr(12)}']);
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-soramo', 'mon-lazuck', 'mon-nobiton'],
      ['mon-kuroshio', 'mon-gauul', 'mon-lilil'],
    );
    await page.screenshot({ path: `${out}/hand_compare${suffix}.png` });
    await page.locator('.battle__monster[data-uid="p-m1"]').click({ timeout: 3000, force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await waitImages();
    await page.screenshot({ path: `${out}/hand_kuroshio_detail${suffix}.png` });
    await page.locator('.modal button').last().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
    await tapHand('x5');
    await page.screenshot({ path: `${out}/hand_card_12${suffix}.png` });
  }

  // 5. ガチャ：クロシオのモンスターカードを持っているときだけ並ぶ（今はだれも持っていない）
  if (ONLY.includes('gacha')) {
    await page.goto(base);
    await page.waitForTimeout(1200);
    await putSave({ 'mon-kuroshio': 1 });
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await mountScreen('gacha');
    await page.waitForTimeout(1500);
    await waitImages();
    await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('.gacha-select__tile')];
      const k = tiles.find((t) => (t.querySelector('img')?.getAttribute('src') || '').includes('kuroshio'));
      k?.scrollIntoView({ block: 'center' });
      globalThis.__tile = tiles.indexOf(k);
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/kuroshio_gacha_list${suffix}.png` });
    const idx = await page.evaluate(() => globalThis.__tile);
    if (idx >= 0) {
      await page.locator('.gacha-select__tile').nth(idx).click();
      await page.waitForTimeout(1000);
      await waitImages();
      await page.screenshot({ path: `${out}/kuroshio_gacha_pack${suffix}.png` });
    } else console.log('no kuroshio tile');
  }

  // 6. ひきずりこむ：相手のソラモ（地上）に当てる → ソラモの居場所の印が水中になって光る・状態の印
  if (ONLY.includes('drag')) {
    await battle(
      'drag',
      `${head}
      const player = mk('player', ['${kr(4)}', '${kr(6)}', '${kr(1)}']);
      const opponent = mk('opponent', ['skl-soramo14-01', 'skl-soramo14-03']);
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-soramo', 'mon-lazuck', 'mon-gauul'],
      ['mon-kuroshio', 'mon-kalshell', 'mon-myurol'],
    );
    await page.screenshot({ path: `${out}/drag_before${suffix}.png` });
    await tapHand('x0');
    await useBtn();
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ timeout: 3000, force: true }).catch((e) => console.log('no target', e.message.slice(0, 120)));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/drag_after${suffix}.png` });
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ timeout: 3000, force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await waitImages();
    await page.screenshot({ path: `${out}/drag_detail${suffix}.png` });
    await page.locator('.modal button').last().click({ timeout: 2000 }).catch(() => {});
    await openLog('drag');
  }

  // 7. おおうずしお：相手はミュロル（水中）・ソラモ（ひきずりこまれて水中）・ガウル（空中）→ ミュロルとソラモだけに当たる
  if (ONLY.includes('whirl')) {
    await battle(
      'whirl',
      `${head}
      const player = mk('player', ['${kr(7)}', '${kr(1)}']);
      const o0 = mk('opponent', []);
      const opponent = { ...o0, monsters: o0.monsters.map((m, i) => i === 1 ? { ...m, dragUnder: { untilTurn: t + 1 } } : m) };
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player: { ...player, manaPile: s.sides.player.deck.slice(0, 7) }, opponent } };`,
      ['mon-myurol', 'mon-soramo', 'mon-gauul'],
      ['mon-kuroshio', 'mon-kalshell', 'mon-myurol'],
    );
    await page.screenshot({ path: `${out}/whirl_before${suffix}.png` });
    await tapHand('x0');
    await page.screenshot({ path: `${out}/whirl_select${suffix}.png` });
    await useBtn();
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${out}/whirl_after${suffix}.png` });
    await openLog('whirl');
  }

  // 8. 水中の相手がいないときは、おおうずしおが灰色（押すと理由）
  if (ONLY.includes('gray')) {
    await battle(
      'gray',
      `${head}
      const player = mk('player', ['${kr(7)}', '${kr(4)}', '${kr(1)}']);
      const opponent = mk('opponent', []);
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player: { ...player, manaPile: s.sides.player.deck.slice(0, 7) }, opponent } };`,
      ['mon-soramo', 'mon-lazuck', 'mon-gauul'],
      ['mon-kuroshio', 'mon-kalshell', 'mon-myurol'],
    );
    await page.screenshot({ path: `${out}/gray_hand${suffix}.png` });
    await tapHand('x0');
    await page.screenshot({ path: `${out}/gray_reason${suffix}.png` });
  }

  // 9. おはらい：相手のクロシオにひきずりこまれた自分のソラモ（水中）を、クヨウのおはらいで地上に戻す
  if (ONLY.includes('purify')) {
    await battle(
      'purify',
      `${head}
      const p0 = mk('player', ['skl-kuyo-08', 'skl-soramo14-04', 'skl-kuyo-03']);
      const player = { ...p0, monsters: p0.monsters.map((m, i) => i === 1 ? { ...m, dragUnder: { untilTurn: t + 1 }, life: 5 } : m) };
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-kuroshio', 'mon-kalshell', 'mon-myurol'],
      ['mon-kuyo', 'mon-soramo', 'mon-nobiton'],
    );
    await page.screenshot({ path: `${out}/purify_before${suffix}.png` });
    await tapHand('x0');
    await useBtn();
    await page.locator('.battle__monster[data-uid="p-m2"]').click({ timeout: 3000, force: true }).catch((e) => console.log('no target', e.message.slice(0, 120)));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${out}/purify_after${suffix}.png` });
    await openLog('purify');
  }

  // 10. 防御・回避の文：長い文のカードの大きなカード（図鑑）と、手札（文はアイコンで出る）・押したときの大きなカード
  if (ONLY.includes('texts')) {
    await openBook();
    const names = LANG === 'en'
      ? [['kalshell13', 'Iron Shell'], ['forn07', 'Guard Whistle'], ['kuyo11', 'Stand-In'], ['myurol08', 'Moist Skin'], ['gearos11', 'High-Speed Maneuver'], ['myurol14', 'Slip Guard']]
      : [['kalshell13', 'てっぺきシェル'], ['forn07', 'そなえのふえ'], ['kuyo11', 'みがわり'], ['myurol08', 'しめったはだ'], ['gearos11', '高速機動'], ['myurol14', 'スリップガード']];
    for (const [key, name] of names) await bookDetail(name, `text_book_${key}`);
    await battle(
      'texts',
      `${head}
      const player = mk('player', ['skl-kalshell-13', 'skl-myurol-14', 'skl-kalshell-11', 'skl-myurol-08', '${kr(11)}', 'skl-myurol-16']);
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-soramo', 'mon-lazuck', 'mon-gauul'],
      ['mon-kuroshio', 'mon-kalshell', 'mon-myurol'],
    );
    await page.screenshot({ path: `${out}/text_hand${suffix}.png` });
    for (const [uid, key] of [['x0', 'kalshell13'], ['x3', 'myurol08'], ['x1', 'myurol14']]) {
      await tapHand(uid);
      await page.screenshot({ path: `${out}/text_handbig_${key}${suffix}.png` });
      await page.mouse.click(20, 20);
      await page.waitForTimeout(500);
    }
  }

  await browser.close();
})();
