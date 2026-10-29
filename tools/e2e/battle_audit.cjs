// バトルの画面の点検（2026-10-29 夜「ゲーム全体の点検と直し」）。開発用サーバー（npx vite）で動かす。
// QA のオートで対戦を最後まで進めながら、0.5 秒ごとに画面を調べて写真を撮る：
// - 押せる所（button・role=button）で、見えているのに 44×44 より小さいもの
// - 文字が切れているもの（はみ出して隠れている・… で切れている）
// - 文字どうしが重なっているもの（見えている文字の箱どうしが半分以上重なる）
// 使い方: node tools/e2e/battle_audit.cjs http://127.0.0.1:5173/ セーブ.json 出力フォルダ [回数=1]
const { chromium } = require('playwright');
const fs = require('fs');
const [base, saveFile, out, rounds = '1'] = process.argv.slice(2);
const save = fs.readFileSync(saveFile, 'utf8');
(async () => {
  const browser = await chromium.launch();
  const found = new Map();
  for (let r = 0; r < +rounds; r++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await ctx.addInitScript((s) => localStorage.setItem('mistria-battle-card/save', s), save);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await page.goto(base + '?qa=1');
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
    await page.evaluate(async (seed) => {
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
      const store = GameStore.fromBrowser();
      const opp = [ENCOUNTERS['enc-forest-boss'], ENCOUNTERS['enc-water-boss'], ENCOUNTERS['enc-b3-boss']][seed % 3];
      store.pendingBattle = { title: '点検', opponent: opp, allowSurrender: true, onFinish: () => {} };
      const stage = mountStage(document.querySelector('#app'), { qa: true });
      const noop = () => {};
      const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = 'battle';
      stage.element.replaceChildren(screen.element);
    }, r);
    await page.waitForSelector('.battle-order__card', { timeout: 15000 });
    await page.locator('.battle-order__card').first().click();
    await page.waitForTimeout(3000);
    await page.locator('.battle__qa button').first().click();
    for (let i = 0; i < 400; i++) {
      await page.waitForTimeout(500);
      const issues = await page.evaluate(() => {
        const out = [];
        const vis = (el) => {
          const r = el.getBoundingClientRect();
          const st = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.05 && r.bottom > 0 && r.top < innerHeight;
        };
        const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.className || '').trim().replace(/\s+/g, ' ').slice(0, 30);
        for (const el of document.querySelectorAll('button, [role="button"]')) {
          if (!vis(el) || el.closest('.battle__qa')) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 44 || r.height < 44) out.push(`小さい ${Math.round(r.width)}×${Math.round(r.height)} ${el.className.split(' ')[0]} 「${name(el)}」`);
        }
        for (const el of document.querySelectorAll('.battle *')) {
          if (!vis(el) || el.children.length > 0 || !el.textContent.trim()) continue;
          const st = getComputedStyle(el);
          const clipX = el.scrollWidth > el.clientWidth + 1 && (st.overflow === 'hidden' || st.overflowX === 'hidden' || st.textOverflow === 'ellipsis');
          const clipY = el.scrollHeight > el.clientHeight + 2 && (st.overflow === 'hidden' || st.overflowY === 'hidden');
          if (clipX || clipY) out.push(`切れ ${el.className.split(' ')[0]} 「${name(el)}」`);
        }
        // 説明の枠の中で、文字の行どうしが重なっていないか（Range で実際の文字の箱を測る）
        for (const box of document.querySelectorAll('.battle-spot__info, .battle__defense')) {
          if (!vis(box)) continue;
          const leaves = [...box.querySelectorAll('*')].filter((el) => vis(el) && el.children.length === 0 && el.textContent.trim());
          const rects = leaves.map((el) => { const rg = document.createRange(); rg.selectNodeContents(el); return [el, rg.getBoundingClientRect()]; });
          for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
            const [ea, ra] = rects[a]; const [eb, rb] = rects[b];
            if (ea.contains(eb) || eb.contains(ea)) continue;
            const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
            const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
            if (w > 4 && h > 4) out.push(`重なり 「${name(ea)}」と「${name(eb)}」`);
          }
        }
        return out;
      });
      for (const s of issues) if (!found.has(s)) {
        found.set(s, `r${r}_${String(i).padStart(3, '0')}`);
        console.log('見つけた', found.get(s), s);
        await page.screenshot({ path: `${out}/r${r}_${String(i).padStart(3, '0')}.png` });
      }
      if (await page.$('.battle__result, .battle-result')) break;
    }
    await ctx.close();
  }
  await browser.close();
})();
