// サポートカード11種類を対戦の画面で撮る（2026-10-30 指示書 Y。hyouzuku_battle_shot.cjs と同じ作り）。開発用サーバー（npx vite）で動かす。
// 撮るもの：手札（01・02）・投石の対象えらび／防御された／回避された（03〜05）・思い出の箱と風まかせのえらぶ窓（06〜08）・
// 霧の香（09）・声援の印（10）・守りの陣の前とあと（手札の数字が下がる。11・12）・熱気（13）・記録（14）。
// 撮影のときだけ、ブラウザの中で対戦の始まりを「自分の手番・手札・捨て札・相手の手札」に置きかえる（page.route で engine.ts の createBattle を包む。
// ゲームのルール・ファイルは変えない）。相手は氷の洞窟のイヴァン（ミュロル・ヒョウズク・カルシェル）。
// 使い方: node tools/e2e/support_y_shot.cjs http://127.0.0.1:5173/ セーブ.json 出力フォルダ（LANG=en で英語）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out] = process.argv.slice(2);
const save = fs.readFileSync(saveFile, 'utf8');
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const suffix = LANG === 'en' ? '_en' : '';
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const hy = (n) => `skl-hyouzuku-${String(n).padStart(2, '0')}`;
const sup = (n) => `sup-${n}`;
// ONLY="recall,swap" のように、撮る場面をしぼれる（hand・stone・recall・swap・mist・heat）
const want = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
  /** o：{ mana, hand, discard, oppMana, oppHand, oppLife:{uid:life} } */
  const start = async (o) => {
    await page.goto(base);
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
    await page.evaluate(async (o) => {
      globalThis.__battlePatch = (s) => {
        const cards = o.hand.map((id, i) => ({ uid: `x${i}`, cardId: id }));
        const discard = o.discard ?? [];
        const player = { ...s.sides.player, hand: cards, discard, manaPile: s.sides.player.deck.slice(0, o.mana), deck: s.sides.player.deck.slice(o.mana) };
        const om = o.oppMana ?? 3;
        const oppHand = (o.oppHand ?? []).map((id, i) => ({ uid: `y${i}`, cardId: id }));
        const monsters = s.sides.opponent.monsters.map((m) => (o.oppLife && o.oppLife[m.uid] ? { ...m, life: o.oppLife[m.uid] } : m));
        const opponent = { ...s.sides.opponent, monsters, hand: oppHand, manaPile: s.sides.opponent.deck.slice(0, om), deck: s.sides.opponent.deck.slice(om) };
        return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player, opponent } };
      };
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
      const store = GameStore.fromBrowser();
      const tsu = (n) => `skl-hyouzuku-${String(n).padStart(2, '0')}`;
      const deck = { monsters: ['mon-hyouzuku', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, (_, i) => (i % 2 ? 'skl-soramo14-01' : tsu((i % 9) + 1))) };
      store.pendingBattle = { title: '氷の洞窟', opponent: ENCOUNTERS['enc-ice-boss'], allowSurrender: false, playerDeck: deck, onFinish: () => {} };
      const root = document.querySelector('#app');
      const stage = mountStage(root, { qa: false });
      const noop = () => {};
      const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = 'battle';
      stage.element.replaceChildren(screen.element);
    }, o);
    await page.waitForSelector('.battle-order__card', { timeout: 15000 });
    await page.waitForTimeout(700);
    await page.locator('.battle-order__card').first().click();
    await page.waitForTimeout(4500);
    await page.evaluate(() => { const h = document.querySelector('.battle__hand'); if (h) h.scrollLeft = 0; });
  };
  const tap = async (loc) => { const b = await loc.boundingBox(); if (b) await page.mouse.click(b.x + 12, b.y + b.height / 2); };
  const useLabel = LANG === 'en' ? 'Use' : '使う';
  const name = (ja, en) => (LANG === 'en' ? en : ja);
  const select = async (cardName) => {
    await tap(page.locator(`.battle__hand-card[aria-label="${cardName}"]`).first());
    await page.waitForTimeout(800);
  };
  const use = async (cardName, target, beforeTarget) => {
    await select(cardName);
    await page.locator(`button:has-text("${useLabel}")`).first().click({ timeout: 3000 });
    if (target) {
      await page.waitForTimeout(900);
      if (beforeTarget) await shot(beforeTarget);
      await page.locator(`.battle__monster[data-uid="${target}"]`).click({ force: true });
    }
  };

  if (want('hand')) {
  // 01・02 手札（サポート7種類／場のカード4種類）。01 はカードを押したところ（大きいカード）も
  await start({ mana: 5, hand: [7, 2, 1, 8, 3, 9, 10].map(sup) });
  await shot('01_hand_supports');
  await select(name('投石', 'Stone Throw'));
  await shot('01b_hand_stone_selected');
  await start({ mana: 5, hand: [...[4, 5, 6, 11].map(sup), hy(11), hy(12), hy(13)] });
  await shot('02_hand_fields');

  }
  if (want('stone')) {
  // 03・04 投石：相手のヒョウズク（真ん中）に。相手の手札に防御（はねでつつむ）→ 防御された
  await start({ mana: 3, hand: [sup(7), hy(1), hy(3)], oppMana: 3, oppHand: [hy(11)] });
  await use(name('投石', 'Stone Throw'), 'o-m2', '03_stone_target');
  for (const [i, ms] of [700, 700, 700, 900, 1200].entries()) { await page.waitForTimeout(ms); await shot(`04_stone_defended_${i}`); }
  // 05 投石：相手のミュロル（左）のライフ1・手札にちから技の回避（ひらりよける）→ 回避された
  await start({ mana: 3, hand: [sup(7), hy(1), hy(3)], oppMana: 3, oppHand: ['skl-myurol-15'], oppLife: { 'o-m1': 1 } });
  await use(name('投石', 'Stone Throw'), 'o-m1');
  for (const [i, ms] of [700, 700, 700, 900, 1200].entries()) { await page.waitForTimeout(ms); await shot(`05_stone_evaded_${i}`); }

  }
  if (want('recall')) {
  // 06・07 思い出の箱：捨て札の技カードをえらぶ窓 → 手札に戻る
  await start({ mana: 5, hand: [sup(8), hy(1), sup(2)], discard: [hy(9), hy(5), 'skl-soramo14-01', hy(9), hy(3)] });
  await shot('06a_recall_hand');
  await use(name('思い出の箱', 'Memory Box'));
  await page.waitForTimeout(900);
  await shot('06_recall_picker');
  await page.locator('.battle-pick__item').first().click();
  await page.waitForTimeout(1500);
  await shot('07_recall_after');

  }
  if (want('swap')) {
  // 08 風まかせ：手札1枚をえらぶ窓
  await start({ mana: 3, hand: [sup(3), hy(10), hy(9), hy(1), sup(2)] });
  await use(name('風まかせ', 'Drift'));
  await page.waitForTimeout(900);
  await shot('08_swap_picker');
  await page.locator('.battle-pick__item').first().click();
  await page.waitForTimeout(1500);
  await shot('08b_swap_after');

  }
  if (want('mist')) {
  // 09 霧の香（相手のマナ 2 → 1）。10 声援（味方の印）・11/12 守りの陣（手札の守りの数字が 2 → 1）・14 記録
  await start({ mana: 8, hand: [sup(9), hy(1), hy(3)], oppMana: 2 });
  await shot('09a_mist_before');
  await use(name('霧の香', 'Mist Incense'));
  await page.waitForTimeout(1800);
  await shot('09_mist_after');
  // すぐ効くカードは全部で1ターンに1回なので、声援は対戦を始め直して使う（守りの陣は場のカードなので同じ手番に出せる）
  await start({ mana: 8, hand: [sup(10), sup(11), hy(11), hy(12), hy(13), hy(1)], oppMana: 2 });
  await use(name('声援', 'Cheer'), 'p-m1', '10a_cheer_target');
  await page.waitForTimeout(1800);
  await shot('10_cheer_mark');
  await shot('11_guard_before');
  await use(name('守りの陣', 'Guard Formation'));
  await page.waitForTimeout(1800);
  await page.evaluate(() => { const h = document.querySelector('.battle__hand'); if (h) h.scrollLeft = 0; });
  await shot('12_guard_after');
  await page.locator('.battle__ticker-hit').first().click();
  await page.waitForTimeout(900);
  await shot('14_log');

  }
  if (want('heat')) {
  // 13 熱気（場のカード）
  await start({ mana: 5, hand: [sup(6), hy(1), hy(3)] });
  await use(name('熱気', 'Heat Wave'));
  await page.waitForTimeout(1800);
  await shot('13_field_heat');
  }
  await browser.close();
})();
