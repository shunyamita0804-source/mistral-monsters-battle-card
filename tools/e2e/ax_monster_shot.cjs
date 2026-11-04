// 2026-11-05 指示書 AX【2】【3】：タイラント・ギアロスの確かめ用の画面（カード）と、対戦の場の写真。開発用サーバーで動かす。
// 使い方: node tools/e2e/ax_monster_shot.cjs URL 出力フォルダ モード（W・H で画面の大きさ）
//   lab:tyrant / lab:gearos … 確かめ用の画面（?qa=1&lab=…）を上から順に撮る
//   battle:tyrant … 自分の場にタイラント（竜のまなざし・竜のちからがかかった印）。相手はソラモ・ソラモ・ノビトン
//   battle:gearos … 自分の場にギアロス（手札にオーバードライブ α・β・γ）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out, mode = 'lab:tyrant'] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const suffix = `_${W}x${H}`;
fs.mkdirSync(out, { recursive: true });
const [kind, who] = mode.split(':');
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
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const { createNewSave } = await import('/src/game/save/saveData.ts');
    const s0 = createNewSave(new Date(2026, 10, 5));
    localStorage.setItem('mistria-battle-card/save', JSON.stringify({ ...s0, player: { gender: 'male', name: 'テスト' }, story: { ...s0.story, introV2: { ...s0.story.introV2, state: 'completed' } } }));
  });
  if (kind === 'lab') {
    await page.goto(`${base}?qa=1&lab=${who}`);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(2500);
    const body = page.locator('.pukarim-lab__body');
    const total = await body.evaluate((el) => el.scrollHeight);
    for (let i = 0, y = 0; y < total && i < 8; i++, y += H - 160) {
      await body.evaluate((el, y) => (el.scrollTop = y), y);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/${who}_lab_${i + 1}${suffix}.png` });
    }
    console.log('lab', who, total);
  } else {
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
    await page.evaluate(async (who) => {
      const ty = (n) => `skl-tyrant-${String(n).padStart(2, '0')}`;
      const ge = (n) => `skl-gearos-${String(n).padStart(2, '0')}`;
      globalThis.__battlePatch = (s) => {
        const t = s.turn;
        const pm = s.sides.player.monsters.map((m, i) => (i === 0 && who === 'tyrant' ? { ...m, dragonGaze: { turn: t + 2 }, dragonMight: { turn: t + 2 } } : m));
        const hand = who === 'tyrant' ? [ty(9), ty(10), ty(7), ty(4), ty(12)] : [ge(5), ge(6), ge(7), ge(8), ge(9)];
        const player = { ...s.sides.player, monsters: pm, hand: hand.map((cardId, i) => ({ uid: `x${i}`, cardId })), manaPile: s.sides.player.deck.slice(0, 6), deck: s.sides.player.deck.slice(6) };
        const opponent = { ...s.sides.opponent, hand: s.sides.opponent.deck.slice(0, 5).map((cardId, i) => ({ uid: `y${i}`, cardId })), manaPile: s.sides.opponent.deck.slice(5, 8), deck: s.sides.opponent.deck.slice(8) };
        return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player, opponent } };
      };
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const store = GameStore.fromBrowser();
      const id = who === 'tyrant' ? 'mon-tyrant' : 'mon-gearos';
      const filler = Array.from({ length: 60 }, () => 'skl-soramo14-01');
      const deck = { monsters: [id, 'mon-soramo', 'mon-nobiton'], skills: filler };
      const foe = { monsters: ['mon-soramo', 'mon-soramo', 'mon-nobiton'], skills: filler };
      store.pendingBattle = { title: '確認', opponent: { id: 'qa', name: '確認用の相手', monsters: foe.monsters, lifeScale: 1 }, opponentDeck: foe, allowSurrender: false, playerDeck: deck, onFinish: () => {} };
      const stage = mountStage(document.querySelector('#app'), { qa: false });
      const noop = () => {};
      const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = 'battle';
      stage.element.replaceChildren(screen.element);
    }, who);
    await page.waitForSelector('.battle-order__card', { timeout: 15000 });
    await page.waitForTimeout(700);
    await page.locator('.battle-order__card').first().click();
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `${out}/${who}_battle${suffix}.png` });
    // 場のカードを押した説明（状態の行）
    await page.locator('.battle__monster--player').first().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${who}_battle_detail${suffix}.png` });
    if (who === 'gearos') {
      // オーバードライブ：α を押す（説明の欄）→「使う」→ 選ぶ窓 →「3枚コンボ」→ 演出と記録
      await page.locator('button:has-text("閉じる")').first().click({ timeout: 3000 });
      await page.waitForTimeout(500);
      const b = await page.locator('.battle__hand-card[data-uid="x0"]').boundingBox();
      if (b) await page.mouse.click(b.x + 12, b.y + b.height / 2);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${out}/${who}_combo_select${suffix}.png` });
      await page.locator('button:has-text("使う")').first().click({ timeout: 3000 });
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${out}/${who}_combo_choice${suffix}.png` });
      await page.locator('button:has-text("3枚コンボ")').first().click({ timeout: 3000 });
      await page.waitForTimeout(1300);
      await page.screenshot({ path: `${out}/${who}_combo_play${suffix}.png` });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `${out}/${who}_combo_defense${suffix}.png` });
      // 記録（ルールの本の横の記録の帯を開かずに、state の記録の最後を出す）
      const logText = await page.evaluate(() => [...document.querySelectorAll('.battle-mid, .battle-log, .battle__log')].map((e) => e.textContent).join(' | '));
      console.log('log', logText.slice(0, 200));
    }
    console.log('battle', who);
  }
  await browser.close();
})();
