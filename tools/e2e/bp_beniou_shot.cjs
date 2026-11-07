// 2026-11-07 指示書 BP：ベニオウの写真（確かめ用の画面・図鑑・大きなカード〔04・06・09・10・12〕・手札と場の枠〔タイラント・ギアロス・シシエン・デスオル・クヨウと並べて〕・
// 対戦〔いかりで数字が増えた手札・おたけびの印と2倍のダメージ・おにのいあつの印と回避が使えない所・おはらいで消える所〕）。開発用サーバー（npx vite）で動かす。作りは tools/e2e/bn_nous_shot.cjs と同じ。
// 使い方: node tools/e2e/bp_beniou_shot.cjs URL 出力フォルダ（W・H で画面の大きさ、LANG=en で英語、ONLY=lab,book,… でしぼる）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const ONLY = (process.env.ONLY || 'lab,book,frames,rage,roar,menace,purify').split(',');
const suffix = `_${LANG}_${W}x${H}`;
fs.mkdirSync(out, { recursive: true });
const bn = (n) => `skl-beniou-${String(n).padStart(2, '0')}`;
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


  const all = { 'mon-beniou': 2 };
  for (let n = 1; n <= 12; n++) all[bn(n)] = 2;

  if (ONLY.includes('lab')) {
    await putSave({});
    await page.goto(`${base}?qa=1&lab=beniou`);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(2500);
    await waitImages();
    const body = page.locator('.pukarim-lab__body');
    const total = await body.evaluate((el) => el.scrollHeight);
    for (let i = 0, y = 0; y < total && i < 8; i++, y += H - 160) {
      await body.evaluate((el, y) => (el.scrollTop = y), y);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/beniou_lab_${i + 1}${suffix}.png` });
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

  if (ONLY.includes('book')) {
    await openBook();
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.card-book__item')].find((e) => /ベニオウ|Beniou/.test(e.textContent || ''));
      el?.scrollIntoView({ block: 'start' });
      const sc = el?.closest('.card-book');
      if (sc) sc.scrollTop -= 60;
    });
    await page.waitForTimeout(800);
    await waitImages();
    await page.screenshot({ path: `${out}/beniou_book_grid${suffix}.png` });
    await page.evaluate(() => { const sc = document.querySelector('.card-book'); if (sc) sc.scrollTop += 560; });
    await page.waitForTimeout(800);
    await waitImages();
    await page.screenshot({ path: `${out}/beniou_book_grid2${suffix}.png` });
    await bookDetail(LANG === 'en' ? 'Beniou' : 'ベニオウ', 'beniou_book_monster');
    const names = LANG === 'en' ? [[4, "Ogre's Rage"], [6, 'Raging Club'], [9, 'War Cry'], [10, "Ogre's Menace"], [12, 'Iron Hide']] : [[4, 'おにのいかり'], [6, 'いかりのかなぼう'], [9, 'おたけび'], [10, 'おにのいあつ'], [12, 'ごうりきのはだ']];
    for (const [n, name] of names) await bookDetail(name, `beniou_big_${String(n).padStart(2, '0')}`);
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




  const MINE = ['mon-beniou', 'mon-soramo', 'mon-kuyo'];
  const FOES = ['mon-soramo', 'mon-lazuck', 'mon-gauul'];
  const mainTurn = (hand, foeHand = 's.sides.opponent.deck.slice(0, 5)', extra = '') => `${head}
      let player = mk('player', ${JSON.stringify(hand)});
      let opponent = mk('opponent', ${foeHand});
      ${extra}
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`;
  const setMon = (side, i, patch) => `${side} = { ...${side}, monsters: ${side}.monsters.map((m, k) => k === ${i} ? { ...m, ...${patch} } : m) };`;

  // 1. 枠の色：手札と場（自分 ベニオウ・タイラント・ギアロス／相手 シシエン・デスオル・クヨウ）
  if (ONLY.includes('frames')) {
    await battle('frames', mainTurn([bn(2), 'skl-tyrant-03', 'skl-gearos-03', 'skl-shishien-03', 'skl-desuoru-03', 'skl-kuyo-03']), ['mon-shishien', 'mon-desuoru', 'mon-kuyo'], ['mon-beniou', 'mon-tyrant', 'mon-gearos']);
    await page.screenshot({ path: `${out}/frames_game${suffix}.png` });
  }
  // 2. いかり：ベニオウの LIFE 4（半分）。手札の おにのいかり 3→6・いかりのかなぼう 6→10
  if (ONLY.includes('rage')) {
    await battle('rage', mainTurn([bn(4), bn(6), bn(2)], '[]', setMon('player', 0, '{ life: 4 }')), FOES, MINE);
    await page.screenshot({ path: `${out}/rage_hand${suffix}.png` });
    await tapHand('x0');
    await useBtn();
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ timeout: 3000, force: true }).catch(() => console.log('no target'));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/rage_after${suffix}.png` });
    await openLog('rage');
  }
  // 3. おたけび：印（×2）→ 次の自分の手番に なぎはらい 4 → 8
  if (ONLY.includes('roar')) {
    await battle('roar', mainTurn([bn(9), bn(2)], '[]'), FOES, MINE);
    await tapHand('x0');
    await useBtn();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/roar_mark${suffix}.png` });
    await page.locator('.battle__monster[data-uid="p-m1"]').click({ timeout: 3000, force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/roar_detail${suffix}.png` });
    await page.locator('.modal button').last().click({ timeout: 2000 }).catch(() => {});
    // 次の自分の手番（おたけびの印が付いたまま）で なぎはらい
    await battle('roar2', mainTurn([bn(2), bn(1)], '[]', setMon('player', 0, '{ roar: { untilTurn: s.turn + 1 } }')), FOES, MINE);
    await page.screenshot({ path: `${out}/roar_before_attack${suffix}.png` });
    await tapHand('x0');
    await useBtn();
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ timeout: 3000, force: true }).catch(() => console.log('no target'));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/roar_after${suffix}.png` });
    await openLog('roar');
  }
  // 4. おにのいあつ：相手のソラモにかける（印）→ 自分のソラモにかかった場面で、相手の攻撃を受けるとき回避が使えない
  if (ONLY.includes('menace')) {
    await battle('menace', mainTurn([bn(10), bn(1)], '[]'), FOES, MINE);
    await tapHand('x0');
    await useBtn();
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ timeout: 3000, force: true }).catch(() => console.log('no target'));
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${out}/menace_mark${suffix}.png` });
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ timeout: 3000, force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/menace_detail${suffix}.png` });
    await page.locator('.modal button').last().click({ timeout: 2000 }).catch(() => {});
    await openLog('menace');
    // 守る側：自分のソラモ（p-m2）におにのいあつ。相手の攻撃を受けるとき、星影ステップ（回避）は暗い・星のまもり（防御）は使える
    await battle(
      'menaceDefend',
      `${head}
      let p0 = mk('player', ['skl-soramo14-14', 'skl-soramo14-12']);
      const player = { ...p0, monsters: p0.monsters.map((m, i) => i === 1 ? { ...m, menace: { untilTurn: t + 5 } } : { ...m, life: 0 }) };
      const opponent = mk('opponent', ['skl-soramo14-04', 'skl-soramo14-04']);
      return { ...s, turn: t + 1, active: 'opponent', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      FOES,
      MINE,
    );
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${out}/menace_defend${suffix}.png` });
    await page.locator('.battle__defense-card').first().click({ timeout: 3000 }).catch(() => console.log('no defense card'));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/menace_defend_tap${suffix}.png` });
  }
  // 5. おはらい：自分のソラモ（p-m2）のおにのいあつを、クヨウ（p-m3）のおはらいで消す
  if (ONLY.includes('purify')) {
    await battle('purify', mainTurn(['skl-kuyo-08', bn(1)], '[]', setMon('player', 1, '{ menace: { untilTurn: s.turn + 2 }, life: 5 }')), FOES, MINE);
    await page.screenshot({ path: `${out}/purify_before${suffix}.png` });
    await tapHand('x0');
    await useBtn();
    await page.locator('.battle__monster[data-uid="p-m2"]').click({ timeout: 3000, force: true }).catch(() => console.log('no ally target'));
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${out}/purify_after${suffix}.png` });
    await openLog('purify');
  }

  await browser.close();
})();
