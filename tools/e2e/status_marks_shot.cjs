// バトルの状態の印（2026-10-30 指示書 X）を対戦の画面で撮る：凍った（ヒョウズク）・まきつく（つる草のまま）・エネルギーをためた・回避できない。
// 撮影のときだけ、ブラウザの中で対戦の始まりを置きかえて、モンスターに状態を付ける（page.route で engine.ts の createBattle を包む。ゲームのルール・ファイルは変えない）。
// 自分：ヒョウズク（凍った）・ノビトン（まきつく）・ジオル（エネルギー）／相手：イヴァン（ミュロルに回避できない）。開発用サーバー（npx vite）で動かす。
// 使い方: node tools/e2e/status_marks_shot.cjs http://127.0.0.1:5173/ セーブ.json 出力フォルダ（W・H で画面の大きさ、LANG=en で英語）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out] = process.argv.slice(2);
const save = fs.readFileSync(saveFile, 'utf8');
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const suffix = `${LANG === 'en' ? '_en' : ''}${W !== 390 ? `_${W}x${H}` : ''}`;
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([s, lang]) => {
    localStorage.setItem('mistria-battle-card/save', s);
    localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: lang, seVolume: 0, bgmVolume: 0, muted: true }));
  }, [save, LANG]);
  await ctx.route(/\/src\/game\/battle\/engine\.ts/, async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    body = body.replace('export function createBattle(', 'function createBattle__orig(');
    body += '\nexport function createBattle(...a) { const s = createBattle__orig(...a); return globalThis.__battlePatch ? globalThis.__battlePatch(s) : s; }\n';
    await route.fulfill({ response: res, body });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  const shot = async (name) => { await page.screenshot({ path: `${out}/${name}${suffix}.png` }); log('shot', name); };
  await page.goto(base);
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
  await page.evaluate(async () => {
    globalThis.__battlePatch = (s) => {
      const t = s.turn;
      const pm = s.sides.player.monsters.map((m, i) => (i === 0 ? { ...m, stunnedTurn: t, stunMark: 'frozen' } : i === 1 ? { ...m, stunnedTurn: t, stunMark: null } : { ...m, energy: { turn: t + 2 } }));
      const om = s.sides.opponent.monsters.map((m, i) => (i === 0 ? { ...m, pinTurn: t } : m));
      const player = { ...s.sides.player, monsters: pm, manaPile: s.sides.player.deck.slice(0, 3), deck: s.sides.player.deck.slice(3) };
      const opponent = { ...s.sides.opponent, monsters: om, hand: [], manaPile: s.sides.opponent.deck.slice(0, 3), deck: s.sides.opponent.deck.slice(3) };
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player, opponent } };
    };
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
  });
  await page.waitForSelector('.battle-order__card', { timeout: 15000 });
  await page.waitForTimeout(700);
  await page.locator('.battle-order__card').first().click();
  await page.waitForTimeout(4500);
  await shot('status_marks');
  // 印のところを大きく
  await page.screenshot({ path: `${out}/status_marks_zoom${suffix}.png`, clip: { x: 0, y: 80, width: W, height: Math.min(360, H - 80) } });
  await browser.close();
})();
