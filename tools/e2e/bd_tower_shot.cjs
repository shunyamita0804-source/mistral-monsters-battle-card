// 2026-11-05 指示書 BD：機械の塔の写真。1階・3階・5階（赤が開いている／青が開いている）・スイッチを押す前と後・上の帯の色の印・ミニマップ・
// 初めて入ったときの場面。開発用サーバー（npx vite）で動かす。
// 使い方: node tools/e2e/bd_tower_shot.cjs URL 出力フォルダ（W・H で画面の大きさ、LANG=en で英語、SEED で挑戦のシード）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const SEED = +(process.env.SEED || 7919);
const suffix = `_${LANG}_${W}x${H}`;
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((l) => localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: l, seVolume: 0, bgmVolume: 0, muted: true })), LANG);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => m.text().startsWith('far') && console.log(m.text()));
  await page.goto(base);
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' });

  /** その階で、スイッチのとなりに立つ場所（扉がいちばん近いスイッチ）。explored＝全部見た（ミニマップに全部出す）か、まわりだけか */
  const mount = async ({ floor, explored, intro, seen, door = false, blue = false, stairs = false, far = false, onStairs = false, stairsFar = false, decor = false }) =>
    page.evaluate(
      async ({ floor, explored, intro, seen, seed, door, blue, stairs, far, onStairs, stairsFar, decor }) => {
        const { createNewSave } = await import('/src/game/save/saveData.ts');
        const { runFloor, startRun } = await import('/src/game/dungeon/run.ts');
        const { isDoorTile, isWalkableTile } = await import('/src/game/dungeon/generate.ts');
        const s0 = createNewSave(new Date(2026, 10, 5));
        let save = { ...s0, player: { gender: 'male', name: 'テスト' }, rank: 'A', story: { ...s0.story, introV2: { ...s0.story.introV2, state: 'completed' } } };
        if (seen) save = { ...save, storyFlags: [...save.storyFlags, 'story:D06'] };
        save = startRun(save, 'dungeon-06', seed);
        const f = runFloor({ seed, floor, dungeonId: 'dungeon-06' });
        const doors = [];
        f.tiles.forEach((row, y) => [...row].forEach((ch, x) => isDoorTile(ch) && doors.push({ x, y })));
        const switches = f.entities.filter((e) => e.kind === 'switch');
        const near = (p) => Math.min(...doors.map((d) => Math.abs(d.x - p.x) + Math.abs(d.y - p.y)));
        const sw = [...switches].sort((a, b) => near(a) - near(b))[0];
        const dirs = [['up', 0, 1], ['down', 0, -1], ['left', 1, 0], ['right', -1, 0]];
        let at = { x: f.start.x, y: f.start.y, dir: 'down' };
        // door＝扉のとなりに立つ（扉の方を向く）。ふだんはスイッチのとなり
        // stairs＝上り階段のとなり（2026-11-05 指示書 BF）
        const target = stairs && f.stairs ? f.stairs : door ? doors[Math.floor(doors.length / 2)] : sw;
        for (const [dir, dx, dy] of dirs) {
          const p = { x: target.x + dx, y: target.y + dy };
          if (isWalkableTile(f.tiles[p.y]?.[p.x], 'all') && !isDoorTile(f.tiles[p.y]?.[p.x]) && !f.entities.some((e) => e.x === p.x && e.y === p.y)) {
            at = { ...p, dir };
            break;
          }
        }
        // far＝扉から3〜5マス離れた所（扉は明かりの外＝前に見たマス。BF のあとのユーザー指示）。onStairs＝上り階段の上に乗る
        // far（2026-11-05 ユーザー指示・2回目）：赤の扉と青の扉が両方とも画面に入り、どの扉からも2マス以上離れた所（扉は明かりの外）。
        // 画面に入る範囲は主人公から左右3マス・上6マス・下5マスくらい
        const inView = (p, d) => Math.abs(d.x - p.x) <= 3 && d.y - p.y >= -6 && d.y - p.y <= 4;
        if (far) {
          let best = null;
          for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) {
            if (!isWalkableTile(f.tiles[y]?.[x], 'all') || isDoorTile(f.tiles[y]?.[x]) || f.entities.some((e) => e.x === x && e.y === y)) continue;
            const seenDoors = doors.filter((d) => inView({ x, y }, d));
            const minDist = Math.min(...doors.map((d) => Math.max(Math.abs(d.x - x), Math.abs(d.y - y))));
            if (minDist < 2) continue;
            const colors = new Set(seenDoors.map((d) => f.tiles[d.y][d.x])).size;
            const score = colors * 100 + seenDoors.length * 10 - minDist;
            if (!best || score > best.score) best = { x, y, score };
          }
          if (best) at = { x: best.x, y: best.y, dir: 'down' };
          console.log('far', floor, best && best.score);
        }
        // decor：1・2階の飾りの赤の扉（赤の扉が画面に入り、扉から2マス以上離れた所）
        if (decor) {
          const reds = doors.filter((d) => f.tiles[d.y][d.x] === 'R');
          let best = null;
          for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) {
            if (!isWalkableTile(f.tiles[y]?.[x], 'all') || isDoorTile(f.tiles[y]?.[x]) || f.entities.some((e) => e.x === x && e.y === y)) continue;
            const r = reds.find((d) => inView({ x, y }, d));
            const dist = r ? Math.max(Math.abs(r.x - x), Math.abs(r.y - y)) : 0;
            if (!r || dist < 2) continue;
            const score = -Math.abs(dist - 3);
            if (!best || score > best.score) best = { x, y, score };
          }
          if (best) at = { x: best.x, y: best.y, dir: 'down' };
        }
        // stairsFar：階段から2〜3マス離れた所（人が乗っていない階段を明かりの外から）
        if (stairsFar && f.stairs) {
          for (const [dx, dy] of [[0, 3], [0, 2], [3, 0], [-3, 0], [2, 0], [-2, 0], [0, -2], [2, 2], [-2, 2]]) {
            const p = { x: f.stairs.x + dx, y: f.stairs.y + dy };
            if (isWalkableTile(f.tiles[p.y]?.[p.x], 'all') && !isDoorTile(f.tiles[p.y]?.[p.x]) && !f.entities.some((e) => e.x === p.x && e.y === p.y)) {
              at = { ...p, dir: 'up' };
              break;
            }
          }
        }
        if (onStairs && f.stairs) at = { x: f.stairs.x, y: f.stairs.y, dir: 'up' };
        const run = { ...save.dungeonRun, floor, x: at.x, y: at.y, dir: at.dir, explored: explored ? '1'.repeat(f.width * f.height) : '', cooldown: 999, blueDoorFloor: blue ? floor : null, torchFloor: (door || stairs) && !far ? floor : null };
        save = { ...save, dungeonRun: run };
        localStorage.setItem('mistria-battle-card/save', JSON.stringify(save));
        const { GameStore } = await import('/src/ui/gameStore.ts');
        const { SCREENS } = await import('/src/ui/screens/registry.ts');
        const { mountStage } = await import('/src/ui/stage.ts');
        const store = GameStore.fromBrowser();
        if (intro) store.dungeonIntro = 'dungeon-06';
        const stage = mountStage(document.querySelector('#app'), { qa: false });
        const noop = () => {};
        const screen = SCREENS.dungeonRun.create({ navigate: noop, back: noop, reset: noop, store });
        stage.element.dataset.screen = 'dungeonRun';
        stage.element.replaceChildren(screen.element);
      },
      { floor, explored, intro, seen, seed: SEED, door, blue, stairs, far, onStairs, stairsFar, decor },
    );
  const closeModal = async () => {
    await page.locator('.modal button').last().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
  };

  // 1. 初めて入ったときの場面（入るときの絵 → 地の文3つ）
  await mount({ floor: 0, explored: false, intro: true, seen: false });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/tower_intro_art${suffix}.png` });
  await page.locator('.world__dungeon-intro').first().click({ timeout: 4000 }).catch(() => {});
  for (let i = 1; i <= 3; i++) {
    await page.waitForTimeout(i === 1 ? 3500 : 1500);
    await page.screenshot({ path: `${out}/tower_intro_line${i}${suffix}.png` });
    await page.mouse.click(W / 2, H * 0.8);
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/tower_intro_after${suffix}.png` });

  // 2. 1階・3階・5階：スイッチの前（赤が開いている）→ 押した（お知らせ）→ 押したあと（青が開いている）
  for (const floor of [0, 2, 4]) {
    const n = floor + 1;
    await mount({ floor, explored: true, intro: false, seen: true });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${out}/tower_f${n}_red${suffix}.png` });
    await page.keyboard.press('z');
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/tower_f${n}_switching${suffix}.png` });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/tower_f${n}_message${suffix}.png` });
    await closeModal();
    await page.screenshot({ path: `${out}/tower_f${n}_blue${suffix}.png` });
  }
  // 扉のとなり（たいまつで明るく）：赤が開いている／青が開いている
  for (const floor of [0, 2, 4]) {
    for (const blue of [false, true]) {
      await mount({ floor, explored: true, intro: false, seen: true, door: true, blue });
      await page.waitForTimeout(2200);
      await page.screenshot({ path: `${out}/tower_f${floor + 1}_door_${blue ? 'blue' : 'red'}${suffix}.png` });
    }
  }
  // 明かりの外（前に見たマス）の扉とスイッチ：赤が開いている／青が開いている（BF のあとのユーザー指示）
  for (const floor of [0, 2, 4]) {
    for (const blue of [false, true]) {
      await mount({ floor, explored: true, intro: false, seen: true, far: true, blue });
      await page.waitForTimeout(2200);
      await page.screenshot({ path: `${out}/tower_f${floor + 1}_far_${blue ? 'blue' : 'red'}${suffix}.png` });
    }
  }
  // 1・2階の飾りの赤の扉：赤の状態／青の状態（明かりの外）
  for (const floor of [0, 1]) {
    for (const blue of [false, true]) {
      await mount({ floor, explored: true, intro: false, seen: true, decor: true, blue });
      await page.waitForTimeout(2200);
      await page.screenshot({ path: `${out}/tower_f${floor + 1}_decor_${blue ? 'blue' : 'red'}${suffix}.png` });
    }
  }
  // 人が乗っていない上り階段（明かりの外・1階と3階）
  for (const floor of [0, 2]) {
    await mount({ floor, explored: true, intro: false, seen: true, stairsFar: true });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${out}/tower_f${floor + 1}_stairs_empty${suffix}.png` });
  }
  // 上り階段の上に乗ったとき・上るか聞く窓（BF のあとのユーザー指示）
  await mount({ floor: 0, explored: true, intro: false, seen: true, onStairs: true });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/tower_f1_on_stairs${suffix}.png` });
  await page.keyboard.press('z');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/tower_f1_stairs_confirm${suffix}.png` });
  await closeModal();
  // 上り階段のとなり（1階・3階。指示書 BF）
  for (const floor of [0, 2]) {
    await mount({ floor, explored: true, intro: false, seen: true, stairs: true });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${out}/tower_f${floor + 1}_stairs${suffix}.png` });
  }
  // 3. 上の帯の印とミニマップ（1階の青・赤を大きく切り出す）
  await mount({ floor: 2, explored: true, intro: false, seen: true });
  await page.waitForTimeout(2200);
  const hud = await page.locator('.drun__hud').boundingBox();
  const mini = await page.locator('.drun__minimap').boundingBox();
  if (hud && mini) {
    const clip = { x: 0, y: 0, width: W, height: Math.max(hud.y + hud.height, mini.y + mini.height) + 8 };
    await page.screenshot({ path: `${out}/tower_hud_red${suffix}.png`, clip });
    await page.keyboard.press('z');
    await page.waitForTimeout(900);
    await closeModal();
    await page.screenshot({ path: `${out}/tower_hud_blue${suffix}.png`, clip });
  }
  console.log('tower', LANG, W, H);
  await browser.close();
})();
