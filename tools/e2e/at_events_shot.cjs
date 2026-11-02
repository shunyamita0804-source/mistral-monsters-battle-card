// 指示書 AT（2026-11-02）の写真。開発用サーバー（npx vite）で動かす。
// 撮るもの：世界地図（新しく始めたセーブ：風の渓谷だけ・D ランク：水の神殿と精霊の森が光る M15）・イベントの確かめ用の入口から M03・挿絵（M13・M21・M27）・
// M28・カードの見せ方（M04 preview_only・M06 owned・M11 reward）。W・H で画面の大きさ（320×568・375×667・390×844・430×932）
// 使い方: node tools/e2e/at_events_shot.cjs http://127.0.0.1:5173/ 出力フォルダ（ONLY=map,events でしぼれる）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const sfx = W === 390 ? '' : `_${W}x${H}`;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: 'ja', seVolume: 0, bgmVolume: 0, muted: true })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const shot = async (name) => { await page.screenshot({ path: `${out}/${name}${sfx}.png` }); console.log('shot', name); };
  const mount = async (screen, patch) => {
    await page.goto(base);
    await page.waitForTimeout(900);
    await page.evaluate(async ([screen, patch]) => {
      const { createNewSave } = await import('/src/game/save/saveData.ts');
      const s = createNewSave(new Date(2026, 10, 2));
      const story = { ...s.story, introV2: { ...s.story.introV2, state: 'completed', selectedBoosterKey: 'booster-1', boosterClaimed: true, boosterGranted: true, examPassed: true } };
      const save = { ...s, player: { gender: 'male', name: 'テスト' }, story, location: { mapId: 'town', x: 100, y: 190, dir: 'down' }, ...patch };
      localStorage.setItem('mistria-battle-card/save', JSON.stringify(save));
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const store = GameStore.fromBrowser();
      const stage = mountStage(document.querySelector('#app'), { qa: false });
      const noop = () => {};
      const view = SCREENS[screen].create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = screen;
      stage.element.replaceChildren(view.element);
    }, [screen, patch]);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
    await page.waitForTimeout(1200);
  };
  const clickNext = async (n = 1, wait = 450) => {
    for (let i = 0; i < n; i++) {
      await page.locator('.modal .btn--primary').last().click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(wait);
    }
  };

  if (want('map')) {
    await mount('dungeonSelect', {});
    await shot('map_new_game');
    await mount('dungeonSelect', { rank: 'D', unlockedDungeons: ['dungeon-08', 'dungeon-03', 'dungeon-02'], dungeons: { 'dungeon-08': { openedChests: [], bossDefeated: true, clears: 1 } } });
    await shot('map_d_m15_0');
    await clickNext(1, 700);
    await shot('map_d_m15_1');
  }

  if (want('events')) {
    // 確かめ用の入口（セーブは変えない）
    await mount('storyEventLab', {});
    await shot('lab_list');
    const play = async (id, label = '▶') => {
      await mount('storyEventLab', {});
      await page.locator(`.story-event-lab__row[data-id="${id}"] button:has-text("${label}")`).first().click();
      await page.waitForTimeout(900);
    };
    // M03：ミレイユの案内
    await play('M03');
    await shot('m03_0');
    await clickNext(2, 600);
    await shot('m03_map');
    await clickNext(1, 600);
    await shot('m03_2');
    await clickNext(3, 500);
    await shot('m03_choice');
    // 挿絵 M13・M21・M27
    for (const id of ['M13', 'M21', 'M27']) {
      await play(id);
      await page.waitForTimeout(2600);
      await shot(`${id.toLowerCase()}_still`);
      await page.locator('.story-still').click().catch(() => {});
      await page.waitForTimeout(400);
      await page.locator('.story-still').click().catch(() => {});
      await page.waitForTimeout(900);
      await shot(`${id.toLowerCase()}_after`);
    }
    // M28（早く負けたとき）
    await play('M28');
    await shot('m28_0');
    await clickNext(1, 500);
    await shot('m28_1');
    // カードの見せ方：M04 preview_only・M06 owned・M11 reward
    await play('M04');
    await clickNext(3, 500);
    await shot('m04_preview');
    await play('M06');
    await clickNext(1, 600);
    await shot('m06_owned');
    await play('M11');
    await shot('m11_reward');
  }
  await browser.close();
})();
