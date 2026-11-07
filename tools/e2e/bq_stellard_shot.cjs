// 2026-11-07 指示書 BQ：ステラードの写真（確かめ用の画面・図鑑・大きなカード〔02・05・06・10・11・12〕・枠の色〔手札と場〕・
// 対戦〔あしばらいで空中の相手が選べない・ふくつのいちげきが LIFE 2 以下で明るい・きしのとつげきが回避されて LIFE−2・しゅうちゅうの印とマナが減らない〕）。開発用サーバー（npx vite）で動かす。
// 使い方: node tools/e2e/bq_stellard_shot.cjs URL 出力フォルダ（TAG=名前 でファイル名に付ける・ONLY=… でしぼる）。作りは tools/e2e/bp_beniou_shot.cjs と同じ
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const ONLY = (process.env.ONLY || 'lab,book,frames,sweep,last,charge,focus').split(',');
const suffix = process.env.TAG ? `_${process.env.TAG}` : '';
fs.mkdirSync(out, { recursive: true });
const st = (n) => `skl-stellard-${String(n).padStart(2, '0')}`;
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


  const all = { 'mon-stellard': 2 };
  for (let n = 1; n <= 12; n++) all[st(n)] = 2;

  if (ONLY.includes('lab')) {
    await putSave({});
    await page.goto(`${base}?qa=1&lab=stellard`);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(2500);
    await waitImages();
    const body = page.locator('.pukarim-lab__body');
    const total = await body.evaluate((el) => el.scrollHeight);
    for (let i = 0, y = 0; y < total && i < 8; i++, y += H - 160) {
      await body.evaluate((el, y) => (el.scrollTop = y), y);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/stellard_lab_${i + 1}${suffix}.png` });
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
      const el = [...document.querySelectorAll('.card-book__item')].find((e) => /ステラード|Stellard/.test(e.textContent || ''));
      el?.scrollIntoView({ block: 'start' });
      const sc = el?.closest('.card-book');
      if (sc) sc.scrollTop -= 60;
    });
    await page.waitForTimeout(800);
    await waitImages();
    await page.screenshot({ path: `${out}/stellard_book_grid${suffix}.png` });
    await page.evaluate(() => { const sc = document.querySelector('.card-book'); if (sc) sc.scrollTop += 560; });
    await page.waitForTimeout(800);
    await waitImages();
    await page.screenshot({ path: `${out}/stellard_book_grid2${suffix}.png` });
    await bookDetail(LANG === 'en' ? 'Stellard' : 'ステラード', 'stellard_book_monster');
    const names = [[2, 'あしばらい'], [5, 'ふくつのいちげき'], [6, 'きしのとつげき'], [10, 'しゅうちゅう'], [11, 'やりでうける'], [12, 'たてでうける']];
    for (const [n, name] of names) await bookDetail(name, `stellard_big_${String(n).padStart(2, '0')}`);
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




  const MINE = ['mon-stellard', 'mon-soramo', 'mon-kuyo'];
  const FOES = ['mon-soramo', 'mon-lazuck', 'mon-gauul'];
  const mainTurn = (hand, foeHand = 's.sides.opponent.deck.slice(0, 5)', extra = '') => `${head}
      let player = mk('player', ${JSON.stringify(hand)});
      let opponent = mk('opponent', ${foeHand});
      ${extra}
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`;
  const setMon = (side, i, patch) => `${side} = { ...${side}, monsters: ${side}.monsters.map((m, k) => k === ${i} ? { ...m, ...${patch} } : m) };`;

  // 1. 枠の色（ゲームの画面）：場と手札。1枚目 ステラード・ヒョウズク・ウズリオ／相手 ノウス・ガウル・ソラモ。2枚目 ジオル・ギアロス・セレフィーン／相手 ミュロル・ラディエル・ソラモ
  if (ONLY.includes('frames')) {
    await battle('frames', mainTurn([st(1), 'skl-hyouzuku-03', 'skl-uzurio-03', 'skl-nous-03', 'skl-gauul14-03', 'skl-soramo14-03']), ['mon-nous', 'mon-gauul', 'mon-soramo'], ['mon-stellard', 'mon-hyouzuku', 'mon-uzurio']);
    await page.screenshot({ path: `${out}/frames_game1${suffix}.png` });
    await battle('frames2', mainTurn(['skl-geol-03', 'skl-gearos-03', 'skl-serephine-03', 'skl-myurol-03', 'skl-radiel-03', 'skl-soramo14-03']), ['mon-myurol', 'mon-radiel', 'mon-soramo'], ['mon-geol', 'mon-gearos', 'mon-serephine']);
    await page.screenshot({ path: `${out}/frames_game2${suffix}.png` });
  }
  // 2. あしばらい：相手のガウル（空中）は選べない
  if (ONLY.includes('sweep')) {
    await battle('sweep', mainTurn([st(2), st(1)], '[]'), FOES, MINE);
    await tapHand('x0');
    await useBtn();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/sweep_targets${suffix}.png` });
    await battle('sweepAir', mainTurn([st(2), st(1)], '[]'), ['mon-gauul', 'mon-pukarim', 'mon-lilil'], MINE);
    await tapHand('x0');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/sweep_all_air${suffix}.png` });
  }
  // 3. ふくつのいちげき：LIFE 8 では暗い・LIFE 2 では明るい
  if (ONLY.includes('last')) {
    await battle('last8', mainTurn([st(5), st(1)], '[]'), FOES, MINE);
    await page.screenshot({ path: `${out}/last_life8${suffix}.png` });
    await battle('last2', mainTurn([st(5), st(1)], '[]', setMon('player', 0, '{ life: 2 }')), FOES, MINE);
    await page.screenshot({ path: `${out}/last_life2${suffix}.png` });
  }
  // 4. きしのとつげき：相手のソラモが回避（CPU）→ ステラードの LIFE−2
  if (ONLY.includes('charge')) {
    await battle('charge', mainTurn([st(6), st(1)], "['skl-soramo14-14', 'skl-soramo14-14']"), FOES, MINE);
    await tapHand('x0');
    await useBtn();
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ timeout: 3000, force: true }).catch(() => console.log('no target'));
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${out}/charge_after${suffix}.png` });
    await openLog('charge');
  }
  // 5. しゅうちゅう：印 → 相手のノウスのからっぽのつぼ（マナ0にする）でもマナが減らない
  if (ONLY.includes('focus')) {
    await battle('focus', mainTurn([st(10), st(1)], '[]'), ['mon-nous', 'mon-lazuck', 'mon-soramo'], MINE);
    await tapHand('x0');
    await useBtn();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/focus_mark${suffix}.png` });
    await page.locator('.battle__monster[data-uid="p-m1"]').click({ timeout: 3000, force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/focus_detail${suffix}.png` });
    await page.locator('.modal button').last().click({ timeout: 2000 }).catch(() => {});
    // 相手の手番：ノウスがからっぽのつぼ（自分のマナ6）。しゅうちゅうがかかっている
    await battle(
      'focusDefend',
      `${head}
      const p0 = mk('player', []);
      const player = { ...p0, focus: { untilTurn: t + 5, ownerUid: 'p-m1' } };
      const opponent = mk('opponent', ['skl-nous-06']);
      return { ...s, turn: t + 1, active: 'opponent', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-nous', 'mon-lazuck', 'mon-soramo'],
      MINE,
    );
    await page.waitForTimeout(6000);
    await page.locator(`button:has-text("${LANG === 'en' ? 'Take' : '受ける'}")`).first().click({ timeout: 3000 }).catch(() => console.log('no take'));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/focus_after${suffix}.png` });
    await openLog('focus');
  }

  await browser.close();
})();
