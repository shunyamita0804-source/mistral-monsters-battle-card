// 指示書 AE（2026-10-31）花屋・仕立て屋に足した調べる所5か所を、となりの歩ける床から調べた所の写真（文の窓が出ている所）。
// 開発用サーバー（npx vite）で動かす。rooms_ad_shot.cjs と同じ撮り方（セーブはブラウザの中で createNewSave から作る）。
// 使い方: node tools/e2e/shop_checks_ae_shot.cjs http://127.0.0.1:5173/ 出力フォルダ（W・H で画面の大きさ、ONLY=florist-plant-l などでしぼる）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const suffix = W !== 390 || H !== 844 ? `_${W}x${H}` : '';
fs.mkdirSync(out, { recursive: true });
const TARGETS = [
  ['florist', 'florist-plant-l', 'F1'],
  ['florist', 'florist-plant-stand', 'F2'],
  ['florist', 'florist-plant-r', 'F3'],
  ['tailor', 'tailor-box-cabinet', 'T1'],
  ['tailor', 'tailor-low-cabinet', 'T2'],
];
(async () => {
  const browser = await chromium.launch();
  const probe = await browser.newPage();
  await probe.goto(base);
  await probe.waitForTimeout(800);
  const info = await probe.evaluate(async (targets) => {
    const { getMap } = await import('/src/data/maps.ts');
    const { isBlocked, reachable } = await import('/src/game/world/world.ts');
    const { createNewSave } = await import('/src/game/save/saveData.ts');
    const all = () => true;
    const res = {};
    for (const [mapId, id] of targets) {
      const m = getMap(mapId);
      const a = reachable(m, m.spawn, (x, y) => isBlocked(m, x, y, all));
      const o = m.objects.find((x) => x.id === id);
      let at = null;
      // 上（物の上の行から下を向く）→ 下 → 右 → 左 の順に、となりの歩けるマスを探す（入口から歩いて行ける所）
      for (let x = o.x; x < o.x + o.w && !at; x++) if (a.has(`${x},${o.y - 1}`)) at = { x, y: o.y - 1, dir: 'down' };
      for (let x = o.x; x < o.x + o.w && !at; x++) if (a.has(`${x},${o.y + o.h}`)) at = { x, y: o.y + o.h, dir: 'up' };
      for (let y = o.y; y < o.y + o.h && !at; y++) if (a.has(`${o.x + o.w},${y}`)) at = { x: o.x + o.w, y, dir: 'left' };
      for (let y = o.y; y < o.y + o.h && !at; y++) if (a.has(`${o.x - 1},${y}`)) at = { x: o.x - 1, y, dir: 'right' };
      res[id] = { mapId, at, rect: { x: o.x, y: o.y, w: o.w, h: o.h } };
    }
    const s = createNewSave(new Date(2026, 9, 31));
    return { res, save: JSON.stringify({ ...s, player: { gender: 'male', name: 'ユウ' } }) };
  }, TARGETS);
  await probe.close();
  fs.writeFileSync(`${out}/positions.json`, JSON.stringify(info.res, null, 1));
  const save0 = JSON.parse(info.save);
  for (const [mapId, id, label] of TARGETS) {
    if (ONLY && !ONLY.includes(id)) continue;
    const p = info.res[id];
    if (!p.at) { console.log('近づけない', id); continue; }
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
    await ctx.addInitScript((s) => {
      localStorage.setItem('mistria-battle-card/save', s);
      localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: 'ja', seVolume: 0, bgmVolume: 0, muted: true }));
    }, JSON.stringify({ ...save0, location: { mapId, ...p.at } }));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', id, e.message));
    await page.goto(base);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(800);
    const cont = page.locator('button:has-text("続きから")').first();
    if (await cont.count()) await cont.click();
    await page.waitForTimeout(2200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    const text = await page.evaluate(() => document.querySelector('.world__message, .message, [role="dialog"]')?.textContent ?? '');
    await page.screenshot({ path: `${out}/${label}_${id}${suffix}.png` });
    console.log(label, id, JSON.stringify(p.at), text.trim().slice(0, 60));
    await ctx.close();
  }
  await browser.close();
})();
