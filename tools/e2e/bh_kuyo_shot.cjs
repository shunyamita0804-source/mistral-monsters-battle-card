// 2026-11-05 指示書 BH：クヨウの写真（確かめ用の画面のカード・図鑑・ガチャのパック・対戦〔おはらい・まよけのふだ・みがわり〕・ミニマップのスイッチ）。
// 開発用サーバー（npx vite）で動かす。
// 使い方: node tools/e2e/bh_kuyo_shot.cjs URL 出力フォルダ（W・H で画面の大きさ、LANG=en で英語、ONLY=lab,book,… でしぼる）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const ONLY = (process.env.ONLY || 'lab,book,logos,gacha,purify,charm,blocked,standin,tower').split(',');
const suffix = `_${LANG}_${W}x${H}`;
fs.mkdirSync(out, { recursive: true });
const ky = (n) => `skl-kuyo-${String(n).padStart(2, '0')}`;
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

  const all = { 'mon-kuyo': 2, 'mon-hakuran': 1, 'mon-desuoru': 1, 'mon-gearos': 1 };
  for (let n = 1; n <= 12; n++) all[ky(n)] = 2;

  // 1. 確かめ用の画面（バトル用カード・技カード12枚）
  if (ONLY.includes('lab')) {
    await putSave({});
    await page.goto(`${base}?qa=1&lab=kuyo`);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(2500);
    await waitImages();
    const body = page.locator('.pukarim-lab__body');
    const total = await body.evaluate((el) => el.scrollHeight);
    for (let i = 0, y = 0; y < total && i < 8; i++, y += H - 160) {
      await body.evaluate((el, y) => (el.scrollTop = y), y);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/kuyo_lab_${i + 1}${suffix}.png` });
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
    const item = page.locator('.card-book__item').filter({ hasText: LANG === 'en' ? 'Kuyo' : 'クヨウ' }).first();
    await item.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.card-book__item')].find((e) => /クヨウ|Kuyo/.test(e.textContent || ''));
      el?.scrollIntoView({ block: 'start' });
      const sc = el?.closest('.card-book');
      if (sc) sc.scrollTop -= 60;
    });
    await page.waitForTimeout(800);
    await waitImages();
    await page.screenshot({ path: `${out}/kuyo_book_grid${suffix}.png` });
    await item.click();
    await page.waitForTimeout(900);
    await waitImages();
    await page.screenshot({ path: `${out}/kuyo_book_monster${suffix}.png` });
  }

  // 2.5 名前のロゴの字の高さ：図鑑の説明の大きなカード（ハクラン・デスオル・ギアロス・クヨウ）を1枚ずつ切り出す
  if (ONLY.includes('logos')) {
    await page.goto(base);
    await page.waitForTimeout(1200);
    await putSave(all);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await mountScreen('collection');
    await page.waitForTimeout(1500);
    const names = LANG === 'en' ? [['hakuran', 'Hakuran'], ['desuoru', 'Desorl'], ['gearos', 'Gearos'], ['kuyo', 'Kuyo']] : [['hakuran', 'ハクラン'], ['desuoru', 'デスオル'], ['gearos', 'ギアロス'], ['kuyo', 'クヨウ']];
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
    await putSave({ 'mon-kuyo': 1 });
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await mountScreen('gacha');
    await page.waitForTimeout(1500);
    await waitImages();
    const tile = page.locator('.gacha-select__tile').last();
    await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('.gacha-select__tile')];
      const k = tiles.find((t) => (t.querySelector('img')?.getAttribute('src') || '').includes('kuyo'));
      k?.scrollIntoView({ block: 'center' });
      globalThis.__kuyoTile = tiles.indexOf(k);
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/kuyo_gacha_list${suffix}.png` });
    const idx = await page.evaluate(() => globalThis.__kuyoTile);
    if (idx >= 0) {
      await page.locator('.gacha-select__tile').nth(idx).click();
      await page.waitForTimeout(1000);
      await waitImages();
      await page.screenshot({ path: `${out}/kuyo_gacha_pack${suffix}.png` });
    } else {
      console.log('no kuyo tile', await tile.count());
    }
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

  // 4. おはらい：ソラモが攻撃できない・ノビトンが行動できない → ソラモを選んで消す
  if (ONLY.includes('purify')) {
    await battle(
      'purify',
      `${head}
      let player = mk('player', ['${ky(8)}', 'skl-soramo14-04', '${ky(3)}', '${ky(10)}', '${ky(11)}']);
      player = { ...player, monsters: player.monsters.map((m, i) => i === 1 ? { ...m, sealedTurn: t } : i === 2 ? { ...m, stunnedTurn: t } : m) };
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-soramo', 'mon-lazuck', 'mon-hyouzuku'],
    );
    await page.screenshot({ path: `${out}/purify_before${suffix}.png` });
    await tapHand('x0');
    await page.screenshot({ path: `${out}/purify_select${suffix}.png` });
    await useBtn();
    await page.screenshot({ path: `${out}/purify_target${suffix}.png` });
    await page.locator('.battle__monster[data-uid="p-m2"]').click({ timeout: 3000, force: true }).catch((e) => console.log('no target', e.message.slice(0, 120)));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/purify_play${suffix}.png` });
    await openLog('purify');
  }

  // 5. まよけのふだ：使う → 味方全員に印
  if (ONLY.includes('charm')) {
    await battle(
      'charm',
      `${head}
      const player = mk('player', ['${ky(9)}', '${ky(3)}', 'skl-soramo14-04', '${ky(10)}', '${ky(12)}']);
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-soramo', 'mon-nobiton', 'mon-hyouzuku'],
    );
    await tapHand('x0');
    await useBtn();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/charm_play${suffix}.png` });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/charm_badges${suffix}.png` });
    await page.locator('.battle__monster[data-uid="p-m2"]').click({ timeout: 3000, force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/charm_detail${suffix}.png` });
    await page.locator('.modal button').last().click({ timeout: 2000 }).catch(() => {});
    await openLog('charm');
  }

  // 6. まよけのふだが防いだ：相手（クヨウ入り）にまよけのふだが効いている → 自分のソラモのすなかけ
  if (ONLY.includes('blocked')) {
    await battle(
      'blocked',
      `${head}
      const player = { ...mk('player', ['skl-soramo14-09', 'skl-soramo14-04', 'skl-soramo14-03']) };
      const opponent = { ...mk('opponent', s.sides.opponent.deck.slice(0, 5)), wardCharm: { untilTurn: t } };
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-kuyo', 'mon-lazuck', 'mon-nobiton'],
      ['mon-soramo', 'mon-gauul', 'mon-myurol'],
    );
    await page.screenshot({ path: `${out}/blocked_before${suffix}.png` });
    await tapHand('x0');
    await useBtn();
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ timeout: 3000, force: true }).catch((e) => console.log('no target', e.message.slice(0, 120)));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/blocked_play${suffix}.png` });
    await openLog('blocked');
  }

  // 7. みがわり：相手のソラモのスターダイブ（5）が自分のソラモ（ライフ2）へ → クヨウが代わりに受ける（−2）
  if (ONLY.includes('standin')) {
    await battle(
      'standin',
      `${head}
      let player = mk('player', ['${ky(11)}', '${ky(10)}', '${ky(3)}']);
      player = { ...player, monsters: player.monsters.map((m, i) => i === 1 ? { ...m, life: 2 } : m) };
      const opponent = mk('opponent', ['skl-soramo14-01', 'skl-soramo14-03']);
      const pending = { attacker: 'opponent', userUid: 'o-m1', targetUid: 'p-m2', cardId: 'skl-soramo14-05', stat: 'force', power: 5, responses: [] };
      return { ...s, active: 'opponent', first: 'opponent', phase: 'defense', pending, manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-soramo', 'mon-lazuck', 'mon-hyouzuku'],
    );
    await page.screenshot({ path: `${out}/standin_before${suffix}.png` });
    // 守りの番は、守りのカード（.battle__defense-card）を押すとすぐ使う
    await page.locator('.battle__defense-card').first().click({ timeout: 3000 }).catch(() => console.log('no defense card'));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/standin_play${suffix}.png` });
    await openLog('standin');
  }

  // 8. 機械の塔のミニマップのスイッチの印（3階。赤が開いている → スイッチを押して青）
  if (ONLY.includes('tower')) {
    await page.goto(base);
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.evaluate(async () => {
      const { createNewSave } = await import('/src/game/save/saveData.ts');
      const { runFloor, startRun } = await import('/src/game/dungeon/run.ts');
      const { isDoorTile, isWalkableTile } = await import('/src/game/dungeon/generate.ts');
      const seed = 7919;
      const floor = 2;
      const s0 = createNewSave(new Date(2026, 10, 5));
      let save = { ...s0, player: { gender: 'male', name: 'テスト' }, rank: 'A', storyFlags: [...s0.storyFlags, 'story:D06'], story: { ...s0.story, intro: 'completed', introV2: { ...s0.story.introV2, state: 'legacySkipped' } } };
      save = startRun(save, 'dungeon-06', seed);
      const f = runFloor({ seed, floor, dungeonId: 'dungeon-06' });
      const sw = f.entities.find((e) => e.kind === 'switch');
      let at = { x: f.start.x, y: f.start.y, dir: 'down' };
      for (const [dir, dx, dy] of [['up', 0, 1], ['down', 0, -1], ['left', 1, 0], ['right', -1, 0]]) {
        const p = { x: sw.x + dx, y: sw.y + dy };
        if (isWalkableTile(f.tiles[p.y]?.[p.x], 'all') && !isDoorTile(f.tiles[p.y]?.[p.x]) && !f.entities.some((e) => e.x === p.x && e.y === p.y)) {
          at = { ...p, dir };
          break;
        }
      }
      save = { ...save, dungeonRun: { ...save.dungeonRun, floor, x: at.x, y: at.y, dir: at.dir, explored: '1'.repeat(f.width * f.height), cooldown: 999, blueDoorFloor: null } };
      localStorage.setItem('mistria-battle-card/save', JSON.stringify(save));
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const store = GameStore.fromBrowser();
      const stage = mountStage(document.querySelector('#app'), { qa: false });
      const noop = () => {};
      const screen = SCREENS.dungeonRun.create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = 'dungeonRun';
      stage.element.replaceChildren(screen.element);
    });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/tower_minimap_red${suffix}.png` });
    const mini = await page.locator('.drun__minimap').boundingBox();
    if (mini) await page.screenshot({ path: `${out}/tower_minimap_red_zoom${suffix}.png`, clip: { x: mini.x - 4, y: mini.y - 4, width: mini.width + 8, height: mini.height + 8 } });
    await page.keyboard.press('z');
    await page.waitForTimeout(900);
    await page.locator('.modal button').last().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/tower_minimap_blue${suffix}.png` });
    if (mini) await page.screenshot({ path: `${out}/tower_minimap_blue_zoom${suffix}.png`, clip: { x: mini.x - 4, y: mini.y - 4, width: mini.width + 8, height: mini.height + 8 } });
  }
  console.log('done', LANG, W, H);
  await browser.close();
})();
