// 指示書 AB【2】（2026-10-31）：腕前 C の CPU のセリフ（ふきだし）を対戦の画面で撮る。cpu_skill_z_shot.cjs と同じ作り。開発用サーバー（npx vite）で動かす。
// 撮るもの：構えごとに 迷う（hesitate_構え_N）・守りそこねる（misguard_構え_N）と、そのあとの記録（_log：「迷っている」「守りそこねた」の文が出ない）。
// 撮影のときだけ ai.ts の CPU_SKILL の C の割合を 1 にし、相手（E の大会のノエル・腕前 C）の構えを書きかえる（ゲームのファイルは変えない）。
// 使い方: node tools/e2e/cpu_lines_ab_shot.cjs http://127.0.0.1:5173/ セーブ.json 出力フォルダ（LANG=en で英語。STYLES="normal,aggressive" で構えをしぼる・KINDS="hesitate" で種類をしぼる）
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
// ONLY="hand,cpu" のように、撮る場面をしぼれる（hand・mix・cpu）
const hy4name = () => 'かぎづめ';
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
  // 腕前 C の「迷っている」「守りそこねた」を必ず出す（撮影のときだけ。ゲームのファイルは変えない）
  await ctx.route(/\/src\/game\/battle\/ai\.ts/, async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    body = body.replace(/C: \{ missKill: 0\.5, hesitate: 0\.15, weakSkill: 0\.3, misguard: 0\.4/, 'C: { missKill: 0.5, hesitate: 1, weakSkill: 0.3, misguard: 1');
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
        const first = o.first ?? 'player';
        return { ...s, active: first, first, phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player, opponent } };
      };
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
      const { TOURNAMENTS } = await import('/src/data/tournaments.ts');
      const store = GameStore.fromBrowser();
      const tsu = (n) => `skl-hyouzuku-${String(n).padStart(2, '0')}`;
      const deck = { monsters: ['mon-hyouzuku', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, (_, i) => (i % 2 ? 'skl-soramo14-01' : tsu((i % 9) + 1))) };
      // 相手：ふだんは氷の洞窟のイヴァン。o.noel なら E の大会のノエル（腕前 C。プカリム・ソラモ・ミュロル）
      const noel = TOURNAMENTS.find((t) => t.id === 'tournament-e').rounds[0];
      const opponent = o.noel ? { ...noel, ai: o.style ?? 'normal' } : ENCOUNTERS['enc-ice-boss'];
      store.pendingBattle = { title: o.noel ? 'Eランク大会' : '氷の洞窟', opponent, allowSurrender: false, playerDeck: deck, onFinish: () => {} };
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
    await page.waitForTimeout(o.wait ?? 4500);
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

  const STYLES = (process.env.STYLES || 'normal,aggressive,guard,flashy,hunter,disrupt').split(',');
  const KINDS = (process.env.KINDS || 'hesitate,misguard').split(',');
  for (const style of STYLES) {
    if (KINDS.includes('misguard')) {
      // 守りそこねる：こちらがヒョウズクのかぎづめ（ちから・2）でノエルのソラモ（真ん中）を攻撃。ノエルの手札にまるまる（ちから技の防御）
      await start({ noel: true, style, mana: 5, hand: [hy(2), hy(1)], oppMana: 3, oppHand: ['skl-soramo14-11'] });
      await use(hy4name(), 'o-m2');
      for (const [i, ms] of [1200, 1200].entries()) { await page.waitForTimeout(ms); await shot(`misguard_${style}_${i}`); }
      await page.waitForTimeout(2500);
      await page.locator('.battle__ticker-hit').first().click().catch(() => {});
      await page.waitForTimeout(900);
      await shot(`misguard_${style}_log`);
    }
    if (KINDS.includes('hesitate')) {
      // 迷う：ノエルの先攻で始める（攻撃できる技とマナがあるのに、攻撃を見送る）
      await start({ noel: true, style, first: 'opponent', mana: 3, hand: [hy(1)], oppMana: 5, oppHand: ['skl-soramo14-03', 'skl-soramo14-04'], wait: 2500 });
      for (const [i, ms] of [1200, 1200].entries()) { await page.waitForTimeout(ms); await shot(`hesitate_${style}_${i}`); }
      await page.waitForTimeout(2500);
      await page.locator('.battle__ticker-hit').first().click().catch(() => {});
      await page.waitForTimeout(900);
      await shot(`hesitate_${style}_log`);
    }
  }
  await browser.close();
})();
