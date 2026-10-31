// 指示書 AD（2026-10-31）研究所・花屋・仕立て屋・家3つの前と今をくらべる写真。開発用サーバー（npx vite）で動かす。
// 前の版は git worktree で前の main を別のポートの開発用サーバーにして、同じスクリプトで撮る（場所は絵の px から、その版の部屋のマスに直す）。
// 撮るもの（部屋ごと）：enter（入った所）・center（部屋の真ん中）・talk（店の人と話す所）・look（調べる所1つ）・behind（家具の後ろを回る所）・grid（当たりの網目）
// 家3つ（home・neighbor・house-b）：enter・left（左のはし）・right（右のはし）・grid
// セーブはブラウザの中で createNewSave から作る。使い方: node tools/e2e/rooms_ad_shot.cjs http://127.0.0.1:5173/ 出力フォルダ 名前の頭（W・H で画面の大きさ、ONLY=lab などで部屋をしぼる）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out, tag = 'now'] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const suffix = W !== 390 || H !== 844 ? `_${W}x${H}` : '';
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
/** 部屋ごとの設定：talk＝話す人の ID、look＝調べる物の ID、behind＝家具の後ろの所（絵の px。1536×1024 の部品） */
const ROOMS = [
  { map: 'lab', talk: 'lab-researcher', look: 'lab-cabinet', behind: [600, 425] },
  { map: 'florist', talk: 'florist-keeper', look: 'florist-steps-l', behind: [580, 400] },
  { map: 'tailor', talk: 'tailor-keeper', look: 'tailor-mirror', behind: [1300, 540] },
];
const HOUSES = ['home', 'neighbor', 'house-b'];
(async () => {
  const browser = await chromium.launch();
  // 部屋の形（マス）をその版のゲームのデータから読む
  const probe = await browser.newPage();
  await probe.goto(base);
  await probe.waitForTimeout(800);
  const info = await probe.evaluate(async ([rooms, houses]) => {
    const { getMap } = await import('/src/data/maps.ts');
    const { isBlocked, reachable } = await import('/src/game/world/world.ts');
    const { createNewSave } = await import('/src/game/save/saveData.ts');
    const all = () => true;
    const res = {};
    const area = (m) => reachable(m, m.spawn, (x, y) => isBlocked(m, x, y, all));
    for (const r of rooms) {
      const m = getMap(r.map);
      const a = area(m);
      const cell = (px, py) => ({ x: Math.floor(px / 25.6), y: Math.floor(py / 25.6) });
      const npc = m.objects.find((o) => o.id === r.talk);
      const item = m.objects.find((o) => o.id === r.look);
      // 調べる物の下（なければ右・左）の歩けるマスから、物の方を向く
      let look = null;
      for (let x = item.x; x < item.x + item.w && !look; x++) if (a.has(`${x},${item.y + item.h}`)) look = { x, y: item.y + item.h, dir: 'up' };
      for (let y = item.y; y < item.y + item.h && !look; y++) {
        if (a.has(`${item.x + item.w},${y}`)) look = { x: item.x + item.w, y, dir: 'left' };
        else if (a.has(`${item.x - 1},${y}`)) look = { x: item.x - 1, y, dir: 'right' };
      }
      // 部屋の真ん中：入口から作業台（机）までのあいだで、真ん中の列に近い歩けるマス
      const cx = Math.floor(m.art.cols / 2);
      let center = null;
      for (let y = npc.y + 2; y <= m.spawn.y && !center; y++) if (a.has(`${cx},${y}`)) center = { x: cx, y: y + 1 };
      const b = cell(...r.behind);
      res[r.map] = { spawn: m.spawn, talk: { x: npc.x, y: npc.y + 1, dir: 'up' }, look, center, behind: { ...b, dir: 'left', ok: a.has(`${b.x},${b.y}`) } };
    }
    for (const id of houses) {
      const m = getMap(id);
      const a = [...area(m)].map((k) => k.split(',').map(Number));
      const row = m.spawn.y - 3;
      const xs = a.filter(([, y]) => y === row).map(([x]) => x);
      const top = Math.min(...a.map(([, y]) => y));
      const topXs = a.filter(([, y]) => y === top).map(([x]) => x);
      res[id] = { spawn: m.spawn, left: { x: Math.min(...xs), y: row, dir: 'left' }, right: { x: Math.max(...xs), y: row, dir: 'right' },
        topLeft: { x: Math.min(...topXs), y: top, dir: 'up' }, topRight: { x: Math.max(...topXs), y: top, dir: 'up' } };
    }
    const s = createNewSave(new Date(2026, 9, 31));
    return { res, save: JSON.stringify({ ...s, player: { gender: 'male', name: 'ユウ' } }) };
  }, [ROOMS, HOUSES]);
  await probe.close();
  fs.writeFileSync(`${out}/${tag}_positions.json`, JSON.stringify(info.res, null, 1));
  const save0 = JSON.parse(info.save);
  const shot = async (name, loc, opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
    await ctx.addInitScript((s) => {
      localStorage.setItem('mistria-battle-card/save', s);
      localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: 'ja', seVolume: 0, bgmVolume: 0, muted: true }));
    }, JSON.stringify({ ...save0, location: loc }));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => log('PAGEERROR', name, e.message));
    await page.goto(base + (opts.hit ? '?qa=1&hit=1' : ''));
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' }).catch(() => {});
    await page.waitForTimeout(800);
    const cont = page.locator('button:has-text("続きから")').first();
    if (await cont.count()) await cont.click();
    await page.waitForTimeout(2200);
    if (opts.enter) { await page.keyboard.press('Enter'); await page.waitForTimeout(900); }
    await page.screenshot({ path: `${out}/${tag}_${name}${suffix}.png` });
    log('shot', name, JSON.stringify(loc));
    await ctx.close();
  };
  for (const r of ROOMS) {
    if (ONLY && !ONLY.includes(r.map)) continue;
    const p = info.res[r.map];
    const at = (c) => ({ mapId: r.map, x: c.x, y: c.y, dir: c.dir ?? 'up' });
    await shot(`${r.map}_enter`, at(p.spawn));
    if (W !== 390 || H !== 844) continue;
    await shot(`${r.map}_center`, at(p.center));
    await shot(`${r.map}_talk`, at(p.talk), { enter: true });
    if (p.look) await shot(`${r.map}_look`, at(p.look), { enter: true });
    if (p.behind.ok) await shot(`${r.map}_behind`, at(p.behind));
    else log('behind not walkable', r.map, JSON.stringify(p.behind));
    await shot(`${r.map}_grid`, at(p.spawn), { hit: true });
  }
  if (W === 390 && H === 844) {
    for (const id of HOUSES) {
      if (ONLY && !ONLY.includes(id)) continue;
      const p = info.res[id];
      const at = (c) => ({ mapId: id, x: c.x, y: c.y, dir: c.dir ?? 'up' });
      await shot(`${id}_enter`, at(p.spawn));
      await shot(`${id}_left`, at(p.left));
      await shot(`${id}_right`, at(p.right));
      await shot(`${id}_topleft`, at(p.topLeft));
      await shot(`${id}_topright`, at(p.topRight));
      await shot(`${id}_grid`, at(p.spawn), { hit: true });
    }
  }
  await browser.close();
})();
