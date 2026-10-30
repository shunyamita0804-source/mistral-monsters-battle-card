// ヒョウズクの効果を対戦の画面で撮る（2026-10-30 指示書 W。tsumuji_battle_shot.cjs と同じ作り）。開発用サーバー（npx vite）で動かす。
// 撮るもの：ふぶきが当たって相手が「行動不可」になった所（1_blizzard・2_blizzard_after）・
// こちらが凍らされた手番（3_frozen：ヒョウズクに「行動不可」の印・ヒョウズクの技は使えない・4_frozen_tap：押すと理由）・こおりわり（5_icebreak）。
// 撮影のときだけ、ブラウザの中で対戦の始まりを「自分の攻撃の手番・手札がヒョウズクの技」に置きかえる（page.route で engine.ts の createBattle を包む。
// ゲームのルール・ファイルは変えない）。相手は氷の洞窟のイヴァン（ミュロル・ヒョウズク・カルシェル）。
// 使い方: node tools/e2e/hyouzuku_battle_shot.cjs http://127.0.0.1:5173/ セーブ.json 出力フォルダ（W・H で画面の大きさ、LANG=en で英語）
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
  const start = async (mana, hand, frozen) => {
    await page.goto(base);
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
    await page.evaluate(async ({ mana, hand, frozen }) => {
      const tsu = (n) => `skl-hyouzuku-${String(n).padStart(2, '0')}`;
      globalThis.__battlePatch = (s) => {
        const cards = hand.map((n, i) => ({ uid: `x${i}`, cardId: tsu(n) }));
        const filler = s.sides.player.deck.slice(0, mana);
        const monsters = s.sides.player.monsters.map((m) => (frozen && m.cardId === 'mon-hyouzuku' ? { ...m, stunnedTurn: s.turn } : m));
        const player = { ...s.sides.player, monsters, hand: cards, manaPile: filler, deck: s.sides.player.deck.slice(mana) };
        const opponent = { ...s.sides.opponent, hand: [], manaPile: s.sides.opponent.deck.slice(0, 3), deck: s.sides.opponent.deck.slice(3) };
        return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player, opponent } };
      };
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
      const store = GameStore.fromBrowser();
      const deck = { monsters: ['mon-hyouzuku', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, (_, i) => (i % 2 ? 'skl-soramo14-01' : tsu((i % 9) + 1))) };
      store.pendingBattle = { title: '氷の洞窟', opponent: ENCOUNTERS['enc-ice-boss'], allowSurrender: false, playerDeck: deck, onFinish: () => {} };
      const root = document.querySelector('#app');
      const stage = mountStage(root, { qa: false });
      const noop = () => {};
      const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = 'battle';
      stage.element.replaceChildren(screen.element);
    }, { mana, hand, frozen });
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
  // A. ふぶき（マナ5）を相手の真ん中（イヴァンのヒョウズク）に → 相手は次のターン行動不可
  await start(5, [9, 5, 6, 1, 3], false);
  await use(name('ふぶき', 'Blizzard'), 'o-m2');
  await page.waitForTimeout(1300);
  await shot('1_blizzard');
  await page.waitForTimeout(2600);
  await shot('2_blizzard_after');
  // B. こちらのヒョウズクが凍らされた手番：ヒョウズクの技は使えない（ソラモの技は使える）
  await start(5, [10, 5, 1, 13, 2], true);
  await page.evaluate(() => { const h = document.querySelector('.battle__hand'); if (h) h.scrollLeft = 0; });
  await shot('3_frozen');
  await tap(page.locator('.battle__hand-card').first());
  await page.waitForTimeout(900);
  await shot('4_frozen_tap');
  // C. こおりわり（防御されない）
  await start(3, [6, 1, 3, 2, 4], false);
  await use(name('こおりわり', 'Ice Break'), 'o-m1');
  await page.waitForTimeout(1300);
  await shot('5_icebreak');
  await browser.close();
})();
