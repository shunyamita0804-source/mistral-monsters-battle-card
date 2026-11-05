// 2026-11-05（指示書 BD と一緒に頼まれた確認）：モンスターカードの居場所の印（地上・空中・水中）が、どの画面でも新しいアイコン（T01〜T03）か。
// 図鑑（一覧・大きく見たとき）・デッキ編集（一覧・大きく見たとき）・対戦の場・場のカードを大きく見たとき・ガチャの開封の写真と、
// 画面にある居場所の印をすべて調べた結果（絵のファイル名・古い印〔コードで描いた svg〕が無いか）を出す。開発用サーバーで動かす。
// 使い方: node tools/e2e/bd_habitat_shot.cjs URL 出力フォルダ（W・H で画面の大きさ、LANG=en で英語）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const suffix = `_${LANG}_${W}x${H}`;
fs.mkdirSync(out, { recursive: true });
const report = [];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((l) => localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: l, seVolume: 0, bgmVolume: 0, muted: true })), LANG);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
  // 画面にある居場所の印を調べる
  const inspect = async (name) => {
    const r = await page.evaluate(() => {
      const marks = [...document.querySelectorAll('.habitat-mark')];
      return {
        marks: marks.length,
        icons: marks.map((m) => (m.querySelector('img')?.getAttribute('src') ?? '').replace(/.*\/(icon_t0\d)[^/]*$/, '$1')).reduce((a, k) => ({ ...a, [k]: (a[k] ?? 0) + 1 }), {}),
        old: marks.filter((m) => !m.classList.contains('habitat-mark--icon') || m.querySelector('svg')).length,
        // 居場所の印の無いモンスターカード（大きく見たときの正式カードの絵など）
        monsterCardsWithout: [...document.querySelectorAll('.monster-card, .battle-card-detail__official')].filter((c) => !c.querySelector('.habitat-mark') && !c.parentElement?.querySelector('.habitat-mark')).length,
      };
    });
    report.push({ screen: name, ...r });
  };
  const shot = async (name) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/${name}${suffix}.png` });
    await inspect(name);
  };
  const mount = async (screenId, extra = {}) => {
    await page.evaluate(
      async ({ screenId, extra }) => {
        const { createNewSave } = await import('/src/game/save/saveData.ts');
        const { CARD_NAME_LOGOS } = await import('/src/data/cardNameLogos.generated.ts');
        const s0 = createNewSave(new Date(2026, 10, 5));
        const collection = { ...s0.collection };
        for (const id of Object.keys(CARD_NAME_LOGOS)) collection[id] = 1;
        localStorage.setItem('mistria-battle-card/save', JSON.stringify({ ...s0, player: { gender: 'male', name: 'テスト' }, collection, story: { ...s0.story, introV2: { ...s0.story.introV2, state: 'completed' } }, ...extra }));
        const { GameStore } = await import('/src/ui/gameStore.ts');
        const { SCREENS } = await import('/src/ui/screens/registry.ts');
        const { mountStage } = await import('/src/ui/stage.ts');
        const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
        const store = GameStore.fromBrowser();
        if (screenId === 'battle') {
          const deck = { monsters: ['mon-soramo', 'mon-gauul', 'mon-myurol'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
          store.pendingBattle = { title: 'QA', opponent: ENCOUNTERS['enc-ice-boss'], allowSurrender: false, playerDeck: deck, onFinish: () => {} };
        }
        const stage = mountStage(document.querySelector('#app'), { qa: false });
        const noop = () => {};
        const screen = SCREENS[screenId].create({ navigate: noop, back: noop, reset: noop, store });
        stage.element.dataset.screen = screenId;
        stage.element.replaceChildren(screen.element);
      },
      { screenId, extra },
    );
    await page.waitForTimeout(1500);
  };
  const closeModal = async () => {
    await page.locator('.modal button').last().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(400);
  };

  // 1. 図鑑：モンスターだけ → 一覧 → 1枚を大きく
  await mount('collection');
  await page.locator('button', { hasText: LANG === 'en' ? 'Monster' : 'モンスター' }).first().click();
  await shot('habitat_book_list');
  await page.locator('.monster-card').first().click({ timeout: 3000 }).catch(() => {});
  await shot('habitat_book_detail');
  await closeModal();

  // 2. デッキ編集：「モンスターを選ぶ」→ 一覧 → 1体を大きく
  await mount('deck');
  await page.locator('button', { hasText: LANG === 'en' ? 'Choose Monsters' : 'モンスターを選ぶ' }).first().click({ timeout: 3000 }).catch(() => {});
  await shot('habitat_deck');
  await page.locator('.monster-card').first().click({ timeout: 3000 }).catch(() => {});
  await shot('habitat_deck_detail');
  await closeModal();

  // 3. 対戦：並びを決める → 場 → 場のカードを大きく
  await mount('battle');
  await page.waitForSelector('.battle-order__card', { timeout: 15000 });
  await shot('habitat_battle_order');
  await page.locator('.battle-order__card').first().click();
  await page.waitForTimeout(4500);
  await shot('habitat_battle_field');
  await page.locator('.battle__monster').first().click({ timeout: 3000 }).catch(() => {});
  await shot('habitat_battle_zoom');
  await closeModal();

  fs.writeFileSync(`${out}/habitat_check${suffix}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await browser.close();
})();
