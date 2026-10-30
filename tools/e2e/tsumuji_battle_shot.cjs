// ツムジの効果を対戦の画面で撮る（2026-10-30 指示書 U。serephine_battle_shot.cjs と同じ作り）。開発用サーバー（npx vite）で動かす。
// 撮るもの：Wひっかきを2回続けて使う所（1_scratch1・2_scratch_ready・3_scratch2）・かぜのりを使った所（4_windride）・
// かぜのりが効いている手番（5_ridden：ツムジに風の印・手札の攻撃技のマナ −1 が緑）・効いている間にストームブレイド（6_storm）。
// 撮影のときだけ、ブラウザの中で対戦の始まりを「自分の攻撃の手番・手札がツムジの技」に置きかえる（page.route で engine.ts の createBattle を包む。
// ゲームのルール・ファイルは変えない）。相手は風の渓谷のゼフィラ（ソラモ・ツムジ・ガウル）。
// 使い方: node tools/e2e/tsumuji_battle_shot.cjs http://127.0.0.1:5173/ セーブ.json 出力フォルダ（W・H で画面の大きさ、LANG=en で英語）
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
  const start = async (mana, hand, ridden) => {
    await page.goto(base);
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
    await page.evaluate(async ({ mana, hand, ridden }) => {
      const tsu = (n) => `skl-tsumuji-${String(n).padStart(2, '0')}`;
      globalThis.__battlePatch = (s) => {
        const cards = hand.map((n, i) => ({ uid: `x${i}`, cardId: tsu(n) }));
        const filler = s.sides.player.deck.slice(0, mana);
        const monsters = s.sides.player.monsters.map((m) => (ridden && m.cardId === 'mon-tsumuji' ? { ...m, windRide: { discount: 1, turn: s.turn } } : m));
        const player = { ...s.sides.player, monsters, hand: cards, manaPile: filler, deck: s.sides.player.deck.slice(mana) };
        const opponent = { ...s.sides.opponent, hand: [], manaPile: s.sides.opponent.deck.slice(0, 3), deck: s.sides.opponent.deck.slice(3) };
        return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player, opponent } };
      };
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
      const store = GameStore.fromBrowser();
      const deck = { monsters: ['mon-tsumuji', 'mon-soramo', 'mon-nobiton'], skills: Array.from({ length: 60 }, (_, i) => tsu((i % 9) + 1)) };
      store.pendingBattle = { title: '風の渓谷', opponent: ENCOUNTERS['enc-wind-boss'], allowSurrender: false, playerDeck: deck, onFinish: () => {} };
      const root = document.querySelector('#app');
      const stage = mountStage(root, { qa: false });
      const noop = () => {};
      const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = 'battle';
      stage.element.replaceChildren(screen.element);
    }, { mana, hand, ridden });
    await page.waitForSelector('.battle-order__card', { timeout: 15000 });
    await page.waitForTimeout(700);
    await page.locator('.battle-order__card').first().click();
    await page.waitForTimeout(4500);
  };
  const tap = async (loc) => { const b = await loc.boundingBox(); if (b) await page.mouse.click(b.x + 12, b.y + b.height / 2); };
  const useLabel = LANG === 'en' ? 'Use' : '使う';
  const use = async (name, target) => {
    await tap(page.locator(`.battle__hand-card[aria-label="${name}"]`).first());
    await page.waitForTimeout(700);
    await page.locator(`button:has-text("${useLabel}")`).first().click({ timeout: 3000 });
    if (target) {
      await page.waitForTimeout(900);
      await page.locator(`.battle__monster[data-uid="${target}"]`).click({ force: true });
    }
  };
  const name = (ja, en) => (LANG === 'en' ? en : ja);
  // A. Wひっかき → もう1枚の Wひっかき（マナ3）
  await start(3, [2, 2, 5, 8, 1], false);
  await use(name('Wひっかき', 'Double Scratch'), 'o-m1');
  await page.waitForTimeout(1300);
  await shot('1_scratch1');
  await page.waitForTimeout(2600);
  await shot('2_scratch_ready');
  await use(name('Wひっかき', 'Double Scratch'), 'o-m3');
  await page.waitForTimeout(1300);
  await shot('3_scratch2');
  await page.waitForTimeout(2600);
  await shot('3_scratch2_after');
  // B. かぜのり（マナ0）を使う → ツムジに風の印
  await start(2, [8, 10, 5, 2, 7], false);
  await use(name('かぜのり', 'Wind Ride'));
  await page.waitForTimeout(2600);
  await shot('4_windride');
  // C. かぜのりが効いている手番：手札の攻撃技のマナ −1（緑）→ マナ4でストームブレイド（マナ5）
  await start(4, [10, 5, 2, 7, 11], true);
  await shot('5_ridden');
  await use(name('ストームブレイド', 'Storm Blade'), 'o-m2');
  await page.waitForTimeout(1300);
  await shot('6_storm');
  await browser.close();
})();
