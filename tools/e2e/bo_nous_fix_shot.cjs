// 2026-11-07 指示書 BO：ノウスの直しの写真（枠の色の並び〔場・手札〕・ガウルの技カード・パック・灰色のときをすいとる・からっぽのつぼの記録・ぜんちぜんのうの窓のスクロール）。
// 使い方: node tools/e2e/bo_nous_fix_shot.cjs URL 出力フォルダ（TAG=名前 でファイル名に付ける・ONLY=… でしぼる）。作りは tools/e2e/bn_nous_shot.cjs と同じ
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const ONLY = (process.env.ONLY || 'field,hand,gauulCards,pack,millGray,empty,emptyZero,searchMany').split(',');
const TAG = process.env.TAG ? `_${process.env.TAG}` : '';
const suffix = `${process.env.TAG ? '_' + process.env.TAG : ''}`;
fs.mkdirSync(out, { recursive: true });
const ns = (n) => `skl-nous-${String(n).padStart(2, '0')}`;
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


  const ns = (n) => `skl-nous-${String(n).padStart(2, '0')}`;
  const g = (n) => `skl-gauul14-${String(n).padStart(2, '0')}`;
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




  const FOES = ['mon-soramo', 'mon-lazuck', 'mon-gauul'];
  const MINE = ['mon-nous', 'mon-soramo', 'mon-nobiton'];
  const mainTurn = (hand, foeHand = 's.sides.opponent.deck.slice(0, 5)', extra = '') => `${head}
      const player = mk('player', ${JSON.stringify(hand)});
      const opponent = mk('opponent', ${foeHand});
      ${extra}
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`;

  // 1. 場：ノウス・ガウル・ラディエル（自分）とギアロス・クロシオ・ノビトン（相手）
  if (ONLY.includes('field')) {
    await battle('field', mainTurn([ns(3), g(3), 'skl-radiel-03', 'skl-gearos-03', 'skl-kuroshio-03', 'skl-nobiton-03']), ['mon-gearos', 'mon-kuroshio', 'mon-nobiton'], ['mon-nous', 'mon-gauul', 'mon-radiel']);
    await page.screenshot({ path: `${out}/field${suffix}.png` });
    await battle('field2', mainTurn([ns(3), g(3), 'skl-tyrant-03', 'skl-soramo14-03', 'skl-radiel-03', ns(1)]), ['mon-tyrant', 'mon-soramo', 'mon-radiel'], ['mon-nous', 'mon-gauul', 'mon-kuroshio']);
    await page.screenshot({ path: `${out}/field2${suffix}.png` });
  }
  // 2. ガウルの技カード（手札）
  if (ONLY.includes('gauulCards')) {
    await battle('gauulCards', mainTurn([g(1), g(3), g(5), g(8), g(13), g(14)]), FOES, ['mon-gauul', 'mon-soramo', 'mon-nobiton']);
    await page.screenshot({ path: `${out}/gauul_cards${suffix}.png` });
  }
  // 3. パック（選ぶ画面）
  if (ONLY.includes('pack')) {
    await page.goto(base);
    await page.waitForTimeout(1200);
    await page.evaluate(async () => {
      const { createNewSave } = await import('/src/game/save/saveData.ts');
      const s0 = createNewSave(new Date(2026, 10, 5));
      localStorage.setItem('mistria-battle-card/save', JSON.stringify({ ...s0, coins: 3000, collection: { ...s0.collection, 'mon-nous': 1 }, player: { gender: 'male', name: 'テスト' }, story: { ...s0.story, intro: 'completed', introV2: { ...s0.story.introV2, state: 'legacySkipped' } } }));
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const store = GameStore.fromBrowser();
      const stage = mountStage(document.querySelector('#app'), { qa: false });
      const noop = () => {};
      const screen = SCREENS.gacha.create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.replaceChildren(screen.element);
    });
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(1500);
    await waitImages();
    await page.screenshot({ path: `${out}/pack_select${suffix}.png` });
    await page.evaluate(() => [...document.querySelectorAll('.gacha-select__tile')].find((t) => (t.querySelector('img')?.getAttribute('src') || '').includes('nous'))?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(800);
    await waitImages();
    await page.screenshot({ path: `${out}/pack_select2${suffix}.png` });
  }
  // 4. ときをすいとる：相手の山札0枚で灰色
  if (ONLY.includes('millGray')) {
    await battle('millGray', mainTurn([ns(9), ns(1)], '[]', 'opponent.deck = [];'), FOES, MINE);
    await tapHand('x0');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/mill_gray${suffix}.png` });
  }
  // 5. からっぽのつぼ：相手のマナ 6 → 0（記録「相手のマナが0になった。」）・もともと0（「相手のマナはもう0だった。」）
  const attackShot = async (name, extra) => {
    await battle(name, mainTurn([ns(6), ns(1)], '[]', extra), FOES, MINE);
    await tapHand('x0');
    await useBtn();
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ timeout: 3000, force: true }).catch(() => console.log('no target'));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/${name}_after${suffix}.png` });
    await openLog(name);
  };
  if (ONLY.includes('empty')) await attackShot('empty', '');
  if (ONLY.includes('emptyZero')) await attackShot('emptyZero', 'opponent.manaPile = [];');
  // 6. ぜんちぜんのう：候補が多い（山札に48種類）とき、窓の中だけスクロール
  if (ONLY.includes('searchMany')) {
    await battle(
      'searchMany',
      `${head}
      const p0 = mk('player', ['${ns(10)}', '${ns(2)}']);
      const ids = [];
      for (const pre of ['skl-rouga', 'skl-huginn', 'skl-kuroshio']) for (let n = 1; n <= 12; n++) ids.push(pre + '-' + String(n).padStart(2, '0'));
      for (let n = 1; n <= 12; n++) ids.push('skl-nous-' + String(n).padStart(2, '0'));
      const player = { ...p0, deck: ids };
      const opponent = mk('opponent', s.sides.opponent.deck.slice(0, 5));
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { player, opponent } };`,
      FOES,
      MINE,
    );
    await tapHand('x0');
    await useBtn();
    await page.waitForTimeout(900);
    await waitImages();
    await page.screenshot({ path: `${out}/search_many_top${suffix}.png` });
    await page.locator('.battle-pick__grid--scroll').evaluate((el) => (el.scrollTop = el.scrollHeight)).catch(() => console.log('no scroll grid'));
    await page.waitForTimeout(700);
    await waitImages();
    await page.screenshot({ path: `${out}/search_many_bottom${suffix}.png` });
  }

  await browser.close();
})();
