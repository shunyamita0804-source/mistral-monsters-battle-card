// 2026-11-06 指示書 BJ：新しい効果のアイコン4つの写真（4枚の技カード・まよけのふだの状態の印・ルールの画面）。
// 開発用サーバー（npx vite）で動かす。
// 使い方: node tools/e2e/bj_icons_shot.cjs URL 出力フォルダ（W・H で画面の大きさ、LANG=en で英語、ONLY=lab,book,… でしぼる）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const ONLY = (process.env.ONLY || 'cards,ward,rules').split(',');
const ky = (n) => `skl-kuyo-${String(n).padStart(2, '0')}`;
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



  // 1. 4枚の技カード：おはらい・まよけのふだ（クヨウ）・最後の審判・天の恵み（ラディエル）。手札と、押したときの大きなカード
  if (ONLY.includes('cards') || ONLY.includes('rules')) {
    await battle(
      'cards',
      `${head}
      const p0 = mk('player', ['${ky(8)}', '${ky(9)}', '${ra(9)}', '${ra(12)}']);
      const player = { ...p0, discard: ['${ra(1)}', '${ra(2)}', '${ra(3)}'], monsters: p0.monsters.map((m, i) => i === 2 ? { ...m, life: 5 } : m) };
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-soramo', 'mon-lazuck', 'mon-hyouzuku'],
      ['mon-kuyo', 'mon-radiel', 'mon-nobiton'],
    );
    if (ONLY.includes('cards')) {
      await page.screenshot({ path: `${out}/cards_hand${suffix}.png` });
      for (const [i, name] of [[0, 'purify'], [1, 'ward'], [2, 'judgment'], [3, 'grace']]) {
        // 手札は重なって並ぶので、カードの右寄り（ほかのカードに隠れていない所）を押す
        const hb = await page.locator(`.battle__hand-card[data-uid="x${i}"]`).boundingBox();
        if (hb) await page.mouse.click(hb.x + hb.width * (i === 3 ? 0.5 : 0.8), hb.y + hb.height / 2);
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${out}/card_${name}${suffix}.png` });
      }
    }
    if (ONLY.includes('rules')) {
      await page.locator(LANG === 'en' ? 'button:has-text("Rules")' : 'button:has-text("ルール")').first().click({ timeout: 3000 }).catch(() => console.log('no rules'));
      await page.waitForTimeout(800);
      await page.evaluate(() => document.querySelector('.icon-guide')?.scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/rules_icons_1${suffix}.png` });
      await page.evaluate(() => [...document.querySelectorAll('.icon-guide')][3]?.scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/rules_icons_2${suffix}.png` });
      // 技カードの効果の表のいちばん下（新しい4つ）まで
      await page.evaluate(() => [...document.querySelectorAll('.icon-guide')][3]?.scrollIntoView({ block: 'end' }));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/rules_icons_3${suffix}.png` });
    }
  }

  // 2. まよけのふだの状態の印（味方3体の上）と、場のカードを押したときの説明
  if (ONLY.includes('ward')) {
    await battle(
      'ward',
      `${head}
      const player = { ...mk('player', ['${ky(3)}', 'skl-soramo14-04']), wardCharm: { untilTurn: t + 1 } };
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      ['mon-soramo', 'mon-lazuck', 'mon-hyouzuku'],
      ['mon-kuyo', 'mon-soramo', 'mon-nobiton'],
    );
    await page.screenshot({ path: `${out}/ward_status${suffix}.png` });
    const m = await page.locator('.battle__monster[data-uid="p-m2"]').boundingBox();
    if (m) await page.screenshot({ path: `${out}/ward_status_zoom${suffix}.png`, clip: { x: 0, y: Math.max(0, m.y - 40), width: W, height: m.height + 80 } });
    await page.locator('.battle__monster[data-uid="p-m2"]').click({ timeout: 3000, force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/ward_detail${suffix}.png` });
  }

  console.log('done', LANG, W, H);
  await browser.close();
})();
