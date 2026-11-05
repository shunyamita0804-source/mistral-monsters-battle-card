// 2026-11-05 指示書 BI：ラディエルの写真（確かめ用の画面のカード・図鑑・名前のロゴ・ガチャのパック・枠の金とノビトンの黄・対戦〔全体攻撃・最後の審判・天の恵み〕・アウレリオの専用セリフ）。
// 開発用サーバー（npx vite）で動かす。
// 使い方: node tools/e2e/bi_radiel_shot.cjs URL 出力フォルダ（W・H で画面の大きさ、LANG=en で英語、ONLY=lab,book,… でしぼる）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const ONLY = (process.env.ONLY || 'lab,book,logos,gacha,frames,halo,judgment,grace,aurelio').split(',');
const suffix = `_${LANG}_${W}x${H}`;
fs.mkdirSync(out, { recursive: true });
const ra = (n) => `skl-radiel-${String(n).padStart(2, '0')}`;
const USE = LANG === 'en' ? 'Use' : '使う';

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

  const all = { 'mon-radiel': 2, 'mon-kuyo': 1, 'mon-hakuran': 1, 'mon-desuoru': 1, 'mon-gearos': 1, 'mon-nobiton': 1 };
  for (let n = 1; n <= 12; n++) all[ra(n)] = 2;

  // 1. 確かめ用の画面（バトル用カード・技カード12枚）
  if (ONLY.includes('lab')) {
    await putSave({});
    await page.goto(`${base}?qa=1&lab=radiel`);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(2500);
    await waitImages();
    const body = page.locator('.pukarim-lab__body');
    const total = await body.evaluate((el) => el.scrollHeight);
    for (let i = 0, y = 0; y < total && i < 8; i++, y += H - 160) {
      await body.evaluate((el, y) => (el.scrollTop = y), y);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/radiel_lab_${i + 1}${suffix}.png` });
    }
  }

  // 2. 図鑑（No.248〜260。ハクラン・デスオル・ギアロスも持っている）・クヨウのカードの説明・技カード1枚の説明
  if (ONLY.includes('book')) {
    await page.goto(base);
    await page.waitForTimeout(1200);
    await putSave(all);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await mountScreen('collection');
    await page.waitForTimeout(1500);
    const item = page.locator('.card-book__item').filter({ hasText: LANG === 'en' ? 'Radiel' : 'ラディエル' }).first();
    await item.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.card-book__item')].find((e) => /ラディエル|Radiel/.test(e.textContent || ''));
      el?.scrollIntoView({ block: 'start' });
      const sc = el?.closest('.card-book');
      if (sc) sc.scrollTop -= 60;
    });
    await page.waitForTimeout(800);
    await waitImages();
    await page.screenshot({ path: `${out}/radiel_book_grid${suffix}.png` });
    await item.click();
    await page.waitForTimeout(900);
    await waitImages();
    await page.screenshot({ path: `${out}/radiel_book_monster${suffix}.png` });
  }

  // 2.5 名前のロゴの字の高さ：図鑑の説明の大きなカード（ハクラン・デスオル・ギアロス・クヨウ）を1枚ずつ切り出す
  if (ONLY.includes('logos')) {
    await page.goto(base);
    await page.waitForTimeout(1200);
    await putSave(all);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await mountScreen('collection');
    await page.waitForTimeout(1500);
    const names = LANG === 'en' ? [['hakuran', 'Hakuran'], ['desuoru', 'Desorl'], ['gearos', 'Gearos'], ['kuyo', 'Kuyo'], ['radiel', 'Radiel'], ['nobiton', 'Nobiton']] : [['hakuran', 'ハクラン'], ['desuoru', 'デスオル'], ['gearos', 'ギアロス'], ['kuyo', 'クヨウ'], ['radiel', 'ラディエル'], ['nobiton', 'ノビトン']];
    for (const [key, name] of names) {
      const item = page.locator('.card-book__item').filter({ has: page.locator('.card-grid__name', { hasText: new RegExp(`^${name}$`) }) }).first();
      await item.scrollIntoViewIfNeeded().catch(() => console.log('no item', name));
      await item.click({ timeout: 3000 }).catch(() => console.log('no click', name));
      await page.waitForTimeout(900);
      await waitImages();
      const card = await page.locator('.card-book-detail__card').boundingBox();
      if (card) await page.screenshot({ path: `${out}/logo_${key}${suffix}.png`, clip: card });
      await page.locator('.card-book-detail button').filter({ hasText: LANG === 'en' ? 'Close' : '閉じる' }).first().click({ timeout: 2000 }).catch(() => console.log('no close'));
      await page.waitForTimeout(500);
    }
  }

  // 3. ガチャ：クヨウのモンスターカードを持っているときだけ並ぶ（今はだれも持っていない）
  if (ONLY.includes('gacha')) {
    await page.goto(base);
    await page.waitForTimeout(1200);
    await putSave({ 'mon-radiel': 1 });
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await mountScreen('gacha');
    await page.waitForTimeout(1500);
    await waitImages();
    const tile = page.locator('.gacha-select__tile').last();
    await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('.gacha-select__tile')];
      const k = tiles.find((t) => (t.querySelector('img')?.getAttribute('src') || '').includes('radiel'));
      k?.scrollIntoView({ block: 'center' });
      globalThis.__radielTile = tiles.indexOf(k);
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/radiel_gacha_list${suffix}.png` });
    const idx = await page.evaluate(() => globalThis.__radielTile);
    if (idx >= 0) {
      await page.locator('.gacha-select__tile').nth(idx).click();
      await page.waitForTimeout(1000);
      await waitImages();
      await page.screenshot({ path: `${out}/radiel_gacha_pack${suffix}.png` });
    } else {
      console.log('no radiel tile', await tile.count());
    }
  }

  /** 対戦を置く（patch で場面を作る） */
  const battle = async (who, patchSrc, foeMonsters, mine = ['mon-radiel', 'mon-soramo', 'mon-nobiton'], opp = { id: 'qa', name: '確認用の相手' }) => {
    await page.goto(base);
    await page.waitForTimeout(1200);
    await putSave({});
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.evaluate(
      async ({ patchSrc, foeMonsters, mine, opp }) => {
        // eslint-disable-next-line no-new-func
        globalThis.__battlePatch = new Function('s', patchSrc);
        const { GameStore } = await import('/src/ui/gameStore.ts');
        const { SCREENS } = await import('/src/ui/screens/registry.ts');
        const { mountStage } = await import('/src/ui/stage.ts');
        const store = GameStore.fromBrowser();
        const filler = Array.from({ length: 60 }, () => 'skl-soramo14-01');
        const deck = { monsters: mine, skills: filler };
        const foe = { monsters: foeMonsters, skills: filler };
        store.pendingBattle = { title: '確認', opponent: { ...opp, monsters: foe.monsters, lifeScale: 1 }, opponentDeck: foe, allowSurrender: false, playerDeck: deck, onFinish: () => {} };
        const stage = mountStage(document.querySelector('#app'), { qa: false });
        const noop = () => {};
        const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
        stage.element.dataset.screen = 'battle';
        stage.element.replaceChildren(screen.element);
      },
      { patchSrc, foeMonsters, mine, opp },
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


  // 4. 枠の金（ラディエル）とノビトンの黄を並べる（対戦の場。自分：ラディエル・ソラモ・ノビトン）
  if (ONLY.includes('frames')) {
    await battle(
      'frames',
      `${head}
      const player = mk('player', ['${ra(3)}', '${ra(2)}']);
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-nobiton', 'mon-radiel', 'mon-gauul'],
    );
    await page.screenshot({ path: `${out}/frames_battle${suffix}.png` });
  }

  // 5. 全体攻撃：こうりんのひかり（相手全員。守りは1体ずつ）
  if (ONLY.includes('halo')) {
    await battle(
      'halo',
      `${head}
      const player = mk('player', ['${ra(4)}', '${ra(3)}', '${ra(10)}']);
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-soramo', 'mon-lazuck', 'mon-hyouzuku'],
    );
    await tapHand('x0');
    await page.screenshot({ path: `${out}/halo_select${suffix}.png` });
    await useBtn();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/halo_play${suffix}.png` });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${out}/halo_after${suffix}.png` });
    await openLog('halo');
  }

  // 6. 最後の審判：自分の手札3枚・相手の手札5枚 → おたがい引き直す
  if (ONLY.includes('judgment')) {
    await battle(
      'judgment',
      `${head}
      const player = mk('player', ['${ra(9)}', '${ra(6)}', '${ra(7)}', '${ra(11)}']);
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-soramo', 'mon-lazuck', 'mon-hyouzuku'],
    );
    await page.screenshot({ path: `${out}/judgment_before${suffix}.png` });
    await tapHand('x0');
    await useBtn();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/judgment_play${suffix}.png` });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${out}/judgment_after${suffix}.png` });
    await openLog('judgment');
  }

  // 7. 天の恵み：捨て札から3枚をマナに（マナ2 → 払って0 → 3）
  if (ONLY.includes('grace')) {
    await battle(
      'grace',
      `${head}
      const p0 = mk('player', ['${ra(12)}', '${ra(7)}', '${ra(3)}']);
      const player = { ...p0, manaPile: p0.manaPile.slice(0, 2), discard: ['${ra(1)}', '${ra(2)}', '${ra(3)}', '${ra(5)}'] };
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-soramo', 'mon-lazuck', 'mon-hyouzuku'],
    );
    await page.screenshot({ path: `${out}/grace_before${suffix}.png` });
    await tapHand('x0');
    await useBtn();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/grace_play${suffix}.png` });
    await openLog('grace');
  }

  // 8. アウレリオの専用セリフ：相手（アウレリオ）の番。ラディエルのせいなるしせん（回避されない）が当たる
  if (ONLY.includes('aurelio')) {
    await battle(
      'aurelio',
      `${head}
      const player = mk('player', ['skl-soramo14-01']);
      const opponent = mk('opponent', ['${ra(5)}', '${ra(3)}']);
      return { ...s, active: 'opponent', first: 'opponent', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-gauul', 'mon-radiel', 'mon-kalshell'],
      ['mon-soramo', 'mon-lazuck', 'mon-nobiton'],
      { id: 'enc-holy-boss', name: 'アウレリオ', ace: 'mon-radiel' },
    );
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(300);
      const text = await page.locator('.battle__talk').first().textContent({ timeout: 300 }).catch(() => '');
      if (text && /ラディエル|Radiel/.test(text)) {
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${out}/aurelio_ace${suffix}.png` });
        break;
      }
      if (i === 39) await page.screenshot({ path: `${out}/aurelio_ace_missing${suffix}.png` });
      const def = page.locator('button').filter({ hasText: LANG === 'en' ? 'Take it' : '受ける' }).first();
      if (await def.count()) await def.click({ timeout: 500 }).catch(() => {});
    }
  }

  console.log('done', LANG, W, H);
  await browser.close();
})();
