// 2026-11-05 指示書 AX【1】：状態の印を場のモンスターカードの上（カードの外）に出した写真。開発用サーバーで動かす。
// 撮影のときだけ対戦の始まりを置きかえて、印を 0・1・3 個つける（自分・相手。ゲームのルール・ファイルは変えない）。
// 使い方: node tools/e2e/ax_status_shot.cjs URL 出力フォルダ 名前（W・H で画面の大きさ、LANG=en で英語、PLAN=a|b で相手側の並べ方）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out, name = 'status'] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const PLAN = process.env.PLAN || '';
const suffix = `${LANG === 'en' ? '_en' : ''}_${W}x${H}`;
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([lang]) => {
    localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: lang, seVolume: 0, bgmVolume: 0, muted: true }));
  }, [LANG]);
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
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
  await page.evaluate(async ([plan]) => {
    if (plan) document.documentElement.dataset.statusPlan = plan;
    globalThis.__battlePatch = (s) => {
      const t = s.turn;
      // 自分：1体目に3つ・2体目に1つ（＋右上の角の印）・3体目は0
      const pm = s.sides.player.monsters.map((m, i) =>
        i === 0 ? { ...m, weaken: { stat: 'force', amount: 1 }, sealedTurn: t, energy: { turn: t + 2 } } : i === 1 ? { ...m, pinTurn: t, tailwind: { turn: t + 2, amount: 1 } } : m,
      );
      // 相手：1体目は0・2体目に3つ・3体目に1つ
      const om = s.sides.opponent.monsters.map((m, i) =>
        i === 1 ? { ...m, stunnedTurn: t, stunMark: 'frozen', weaken: { stat: 'wisdom', amount: 2 }, shield: { untilTurn: t + 1, against: 'all', reduce: 1 } } : i === 2 ? { ...m, hiddenTurn: t + 1, charge: true } : m,
      );
      const player = { ...s.sides.player, monsters: pm, manaPile: s.sides.player.deck.slice(0, 3), deck: s.sides.player.deck.slice(3) };
      const opponent = { ...s.sides.opponent, monsters: om, hand: s.sides.opponent.deck.slice(0, 5), manaPile: s.sides.opponent.deck.slice(5, 8), deck: s.sides.opponent.deck.slice(8) };
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player, opponent } };
    };
    const { createNewSave } = await import('/src/game/save/saveData.ts');
    const s0 = createNewSave(new Date(2026, 10, 5));
    localStorage.setItem('mistria-battle-card/save', JSON.stringify({ ...s0, player: { gender: 'male', name: 'テスト' }, story: { ...s0.story, introV2: { ...s0.story.introV2, state: 'completed' } } }));
    const { GameStore } = await import('/src/ui/gameStore.ts');
    const { SCREENS } = await import('/src/ui/screens/registry.ts');
    const { mountStage } = await import('/src/ui/stage.ts');
    const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
    const store = GameStore.fromBrowser();
    const deck = { monsters: ['mon-hyouzuku', 'mon-nobiton', 'mon-geol'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
    store.pendingBattle = { title: '氷の洞窟', opponent: ENCOUNTERS['enc-ice-boss'], allowSurrender: false, playerDeck: deck, onFinish: () => {} };
    const stage = mountStage(document.querySelector('#app'), { qa: false });
    const noop = () => {};
    const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
    stage.element.dataset.screen = 'battle';
    stage.element.replaceChildren(screen.element);
  }, [PLAN]);
  await page.waitForSelector('.battle-order__card', { timeout: 15000 });
  await page.waitForTimeout(700);
  await page.locator('.battle-order__card').first().click();
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${out}/${name}${suffix}.png` });
  console.log('shot', `${out}/${name}${suffix}.png`);
  await browser.close();
})();
