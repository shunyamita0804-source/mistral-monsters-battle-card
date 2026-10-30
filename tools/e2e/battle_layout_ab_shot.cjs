// 指示書 AB【3】（2026-10-31）バトル画面の改修の前と今をくらべる写真と、段ごとの高さ。開発用サーバー（npx vite）で動かす。
// 撮るもの：1_idle（自分の番・何も選んでいない）・2_tap（手札を押したとき）・3_use（技を使った演出）・
// 4_opp_N（相手の番：画面が寄った所・相手の手札・相手が使った大きなカード）・5_defense（守りの選択）。段ごとの高さは layout.json に書く。
// 撮影のときだけ、ブラウザの中で対戦の始まりを置きかえる（page.route で engine.ts の createBattle を包む。ゲームのルール・ファイルは変えない）。相手は氷の洞窟のイヴァン。
// 使い方: node tools/e2e/battle_layout_ab_shot.cjs http://127.0.0.1:5173/ セーブ.json 出力フォルダ 名前の頭（W・H で画面の大きさ、LANG=en で英語）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, tag = 'now'] = process.argv.slice(2);
const save = fs.readFileSync(saveFile, 'utf8');
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const suffix = `${LANG === 'en' ? '_en' : ''}${W !== 390 || H !== 844 ? `_${W}x${H}` : ''}`;
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const hy = (n) => `skl-hyouzuku-${String(n).padStart(2, '0')}`;
const sor = (n) => `skl-soramo14-${String(n).padStart(2, '0')}`;
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
  const layout = {};
  const measure = async (name) => {
    layout[name] = await page.evaluate(() => {
      const r = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const st = document.querySelector('.stage');
        const k = st ? st.getBoundingClientRect().width / st.offsetWidth : 1;
        const o = st ? st.getBoundingClientRect() : { x: 0, y: 0 };
        return { top: Math.round((b.top - o.y) / k), height: Math.round(b.height / k), left: Math.round((b.left - o.x) / k), width: Math.round(b.width / k) };
      };
      return {
        header: r('.battle__header'),
        oppHand: r('.battle-hand--opponent'),
        oppBack: r('.battle-hand__back'),
        oppRow: r('.battle-row--opponent'),
        playerRow: r('.battle-row--player'),
        monster: r('.battle-row--player .battle__monster'),
        detail: r('.battle-detail'),
        detailCard: r('.battle-detail .battle-card, .battle-detail .skill-card'),
        oppSpot: r('.battle-opp-spot'),
        hand: r('.battle__hand'),
        handCard: r('.battle__hand-card .skill-card'),
        commands: r('.battle__commands'),
      };
    });
  };
  const shot = async (name) => { await page.screenshot({ path: `${out}/${tag}_${name}${suffix}.png` }); await measure(name); log('shot', name); };
  /** o：{ first, turn, mana, hand, oppMana, oppHand } */
  const start = async (o) => {
    await page.goto(base);
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
    await page.evaluate(async (o) => {
      globalThis.__battlePatch = (s) => {
        const cards = o.hand.map((id, i) => ({ uid: `x${i}`, cardId: id }));
        const player = { ...s.sides.player, hand: cards, manaPile: s.sides.player.deck.slice(0, o.mana), deck: s.sides.player.deck.slice(o.mana) };
        const oppHand = (o.oppHand ?? []).map((id, i) => ({ uid: `y${i}`, cardId: id }));
        const om = o.oppMana ?? 3;
        const opponent = { ...s.sides.opponent, hand: oppHand, manaPile: s.sides.opponent.deck.slice(0, om), deck: s.sides.opponent.deck.slice(om) };
        const first = o.first ?? 'player';
        return { ...s, turn: o.turn ?? 1, active: first, first, phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player, opponent } };
      };
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
      const store = GameStore.fromBrowser();
      const tsu = (n) => `skl-hyouzuku-${String(n).padStart(2, '0')}`;
      const deck = { monsters: ['mon-hyouzuku', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, (_, i) => (i % 2 ? 'skl-soramo14-01' : tsu((i % 9) + 1))) };
      store.pendingBattle = { title: '氷の洞窟', opponent: ENCOUNTERS['enc-ice-boss'], allowSurrender: false, playerDeck: deck, onFinish: () => {} };
      const stage = mountStage(document.querySelector('#app'), { qa: false });
      const noop = () => {};
      const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = 'battle';
      stage.element.replaceChildren(screen.element);
    }, o);
    await page.waitForSelector('.battle-order__card', { timeout: 15000 });
    await page.waitForTimeout(700);
    await page.locator('.battle-order__card').first().click();
    await page.waitForTimeout(o.wait ?? 4500);
    // 対戦の始めのあいさつのふきだしは閉じる（盤面を見せる）
    for (let i = 0; i < 2; i++) await page.locator('.battle__talk').first().click({ timeout: 500 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.evaluate(() => { const h = document.querySelector('.battle__hand'); if (h) h.scrollLeft = 0; });
  };
  const tap = async (loc) => { const b = await loc.boundingBox(); if (b) await page.mouse.click(b.x + 12, b.y + b.height / 2); };
  const useLabel = LANG === 'en' ? 'Use' : '使う';
  // 1〜3：自分の番（手札5枚。相手の手札4枚）
  await start({ mana: 5, hand: [hy(2), hy(5), sor(4), hy(12), 'sup-7'], oppHand: [hy(1), hy(3), sor(1), sor(11)] });
  await shot('1_idle');
  await tap(page.locator('.battle__hand-card').nth(0));
  await page.waitForTimeout(900);
  await shot('2_tap');
  await page.locator(`button:has-text("${useLabel}")`).first().click({ timeout: 3000 });
  await page.waitForTimeout(900);
  await page.locator('.battle__monster[data-uid="o-m1"]').click({ force: true });
  await page.waitForTimeout(500);
  await shot('3_use');
  // 4：相手の番（3手番目・相手の手札5枚・マナ5）。寄った所・相手が使ったカード
  await start({ first: 'opponent', turn: 3, mana: 5, hand: [hy(2), hy(5), sor(4), sor(1), 'sup-7'], oppMana: 5, oppHand: [hy(2), hy(1), hy(3), sor(1), sor(11)], wait: 300 });
  for (let i = 0; i < 14; i++) { await page.waitForTimeout(350); await shot(`4_opp_${String(i).padStart(2, '0')}`); }
  // 5：守りの選択（相手のかぎづめ〔ちから〕を、手札のつばさのたてで守れる）
  await start({ first: 'opponent', turn: 3, mana: 5, hand: [hy(12), hy(13), sor(4), sor(1), hy(5)], oppMana: 5, oppHand: [hy(2)], wait: 1200 });
  await page.waitForSelector('.battle.is-defending', { timeout: 20000 }).catch(() => log('no defense'));
  await page.waitForTimeout(600);
  await shot('5_defense');
  fs.writeFileSync(`${out}/${tag}_layout${suffix}.json`, JSON.stringify(layout, null, 1));
  await browser.close();
})();
