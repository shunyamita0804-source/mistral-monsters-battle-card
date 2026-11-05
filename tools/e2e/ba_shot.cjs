// 2026-11-05 指示書 BA【4】：技カードの効果のアイコン（手札・大きく見たとき・押したとき）と、ルールの窓の「アイコンの見方」の写真。開発用サーバーで動かす。
// 使い方: node tools/e2e/ba_shot.cjs URL 出力フォルダ（W・H で画面の大きさ、LANG=en で英語）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const suffix = `_${LANG}_${W}x${H}`;
fs.mkdirSync(out, { recursive: true });
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
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
  // 1. カードだけの表：手札5枚・大きく見たとき（効果1つ・2つ・アイコンの無い効果）
  await page.evaluate(async () => {
    const { getSkill } = await import('/src/data/cards.ts');
    const { createBattleCard } = await import('/src/ui/components/battleCard.ts');
    const app = document.createElement('div');
    app.id = 'ba-cards';
    app.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#141a26;padding:8px;overflow:auto;color:#eee;font:12px sans-serif';
    const row = (ids, size, w) => {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap';
      for (const id of ids) r.append(createBattleCard(getSkill(id), size === 'hand' ? { width: w, size: 'hand' } : { width: w, size: 'focus' }));
      return r;
    };
    app.append(row(['skl-gearos-01', 'skl-geol-02', 'skl-soramo14-02', 'skl-hyouzuku-08', 'skl-soramo14-12'], 'hand', 66));
    app.append(row(['skl-gearos-01', 'skl-soramo14-12', 'skl-nobiton-05'], 'focus', 118));
    document.body.append(app);
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/fx_cards${suffix}.png` });
  // 押したとき（大きいカードのアイコン）
  await page.locator('#ba-cards .skill-card__fx-btn').first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/fx_tap${suffix}.png` });
  await page.locator('#ba-cards .skill-card__fx-btn').nth(2).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/fx_tap2${suffix}.png` });
  await page.evaluate(() => document.getElementById('ba-cards')?.remove());
  // 2. 対戦：手札にアイコンのある技・ルールの窓
  await page.evaluate(async () => {
    globalThis.__battlePatch = (s) => {
      const hand = ['skl-hyouzuku-08', 'skl-hyouzuku-06', 'skl-soramo14-12', 'skl-soramo14-02', 'skl-nobiton-05'];
      const player = { ...s.sides.player, hand: hand.map((cardId, i) => ({ uid: `x${i}`, cardId })), manaPile: s.sides.player.deck.slice(0, 6), deck: s.sides.player.deck.slice(6) };
      return { ...s, active: 'player', first: 'player', phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player } };
    };
    const { createNewSave } = await import('/src/game/save/saveData.ts');
    const s0 = createNewSave(new Date(2026, 10, 5));
    localStorage.setItem('mistria-battle-card/save', JSON.stringify({ ...s0, player: { gender: 'male', name: 'テスト' }, story: { ...s0.story, introV2: { ...s0.story.introV2, state: 'completed' } } }));
    const { GameStore } = await import('/src/ui/gameStore.ts');
    const { SCREENS } = await import('/src/ui/screens/registry.ts');
    const { mountStage } = await import('/src/ui/stage.ts');
    const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
    const store = GameStore.fromBrowser();
    const deck = { monsters: ['mon-hyouzuku', 'mon-soramo', 'mon-nobiton'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
    store.pendingBattle = { title: 'QA', opponent: ENCOUNTERS['enc-ice-boss'], allowSurrender: false, playerDeck: deck, onFinish: () => {} };
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
  await page.screenshot({ path: `${out}/fx_battle_hand${suffix}.png` });
  const b = await page.locator('.battle__hand-card[data-uid="x0"]').boundingBox();
  if (b) await page.mouse.click(b.x + 12, b.y + b.height / 2);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/fx_battle_select${suffix}.png` });
  await page.locator('.battle__hand-card[data-uid="x0"]').click({ timeout: 2000 }).catch(() => {});
  await page.locator(LANG === 'en' ? 'button:has-text("Rules")' : 'button:has-text("ルール")').first().click({ timeout: 3000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('.icon-guide')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/rules_icons_1${suffix}.png` });
  await page.evaluate(() => [...document.querySelectorAll('.icon-guide')].at(-1)?.scrollIntoView({ block: 'end' }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/rules_icons_2${suffix}.png` });
  console.log('ba', LANG, W);
  await browser.close();
})();
