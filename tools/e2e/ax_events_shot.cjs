// 2026-11-05 指示書 AX【4】【5】の写真。開発用サーバー（npx vite）で動かす。
// 撮るもの：イベント第2弾12本（確かめ用の入口から。1行目＝小挿絵つき・選択肢）・説明の絵4枚（O04・M09・M07・M12）・
// 大会会場に入ったときのシエナ（本物の街の画面。M13・M14 を見たセーブ）・研究所の「記録をふり返る」
// 使い方: node tools/e2e/ax_events_shot.cjs http://127.0.0.1:5174/ 出力フォルダ（W・H で画面の大きさ。ONLY=ev2,tutorial,hall,review でしぼれる）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const sfx = `_${W}x${H}`;
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
  const SEEN = ['M02', 'M03', 'M04', 'M05', 'M05W', 'M06', 'M07', 'M08', 'M09', 'M11', 'M11T', 'M12', 'M13', 'M14', 'O01', 'O02', 'O03', 'O04', 'O05', 'O06'];
  const mount = async (screen, patch, seen = []) => {
    await page.goto(base);
    await page.waitForTimeout(900);
    await page.evaluate(async ([screen, patch, seen]) => {
      const { createNewSave } = await import('/src/game/save/saveData.ts');
      const { storyEventFlag } = await import('/src/data/storyEvents.ts');
      const s = createNewSave(new Date(2026, 10, 5));
      const story = { ...s.story, introV2: { ...s.story.introV2, state: 'completed', selectedBoosterKey: 'booster-1', boosterClaimed: true, boosterGranted: true, examPassed: true, tutorialCompleted: true } };
      // '__siennaLeft' は印ではなく siennaLeft の記録。'__lab' は研究員の1マス下（研究員の方を向く）
      const flags = seen.filter((x) => !x.startsWith('__')).map(storyEventFlag);
      if (seen.includes('__siennaLeft')) flags.push('siennaLeft');
      const extra = {};
      if (seen.includes('__lab')) {
        const { LAB } = await import('/src/data/maps.ts');
        const r = LAB.objects.find((o) => o.type === 'npc' && o.npcId === 'researcher');
        extra.location = { mapId: 'lab', x: r.x, y: r.y + 1, dir: 'up' };
      }
      const save = { ...s, player: { gender: 'male', name: 'テスト' }, story, storyFlags: [...s.storyFlags, ...flags], location: { mapId: 'town', x: 100, y: 190, dir: 'down' }, ...patch, ...extra };
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
    }, [screen, patch, seen]);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
    await page.waitForTimeout(1200);
  };
  const clickNext = async (n = 1, wait = 450) => {
    for (let i = 0; i < n; i++) {
      await page.locator('.modal .btn--primary').last().click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(wait);
    }
  };
  const play = async (id) => {
    await mount('storyEventLab', {});
    await page.locator(`.story-event-lab__row[data-id="${id}"] button`).first().click();
    await page.waitForTimeout(900);
  };

  if (want('ev2')) {
    for (const id of ['EV2_S01', 'EV2_S02', 'EV2_S03', 'EV2_S04', 'EV2_N01', 'EV2_N02', 'EV2_N03', 'EV2_N04', 'EV2_N05', 'EV2_N06', 'EV2_N07', 'EV2_N08']) {
      await play(id);
      await shot(`${id.toLowerCase()}_1`);
      await clickNext(3, 450);
      await shot(`${id.toLowerCase()}_choice`);
    }
  }

  if (want('tutorial')) {
    for (const [id, n, name] of [['O04', 1, 'tutorial_shop_o04'], ['M09', 2, 'tutorial_dungeon_m09'], ['M07', 3, 'tutorial_tournament_m07'], ['M12', 1, 'tutorial_board_m12']]) {
      await play(id);
      await clickNext(n, 500);
      await shot(name);
    }
  }

  if (want('hall')) {
    // 本物の街の画面で、大会会場に入ったところ（M13・M14 を見たあと）
    await mount('world', { location: { mapId: 'hall', x: 49, y: 40, dir: 'up' } }, SEEN);
    await page.waitForTimeout(2500);
    await shot('hall_enter_s01');
    // シエナがいなくなったあと（siennaLeft）は出ない
    await mount('world', { location: { mapId: 'hall', x: 49, y: 40, dir: 'up' } }, [...SEEN, 'M28', '__siennaLeft']);
    await page.waitForTimeout(2500);
    await shot('hall_enter_after_left');
  }

  if (want('review')) {
    // 研究員の前で「調べる」→ ひと言 → 研究所の窓（記録をふり返る）→ 一覧 → 1つ見る
    await mount('world', {}, [...SEEN, 'EV2_S01', 'EV2_N02', 'EV2_N07', '__lab']);
    await page.waitForTimeout(1500);
    await page.locator('.world__action').first().click().catch(() => {});
    await page.waitForTimeout(900);
    for (let i = 0; i < 4 && (await page.locator('.world-researcher, .modal__title:has-text("カード研究所")').count()) === 0; i++) {
      await page.locator('.talk__window').first().click().catch(() => {});
      await page.waitForTimeout(600);
    }
    await shot('review_lab_menu');
    await page.locator('.modal button:has-text("記録をふり返る")').first().click().catch(() => {});
    await page.waitForTimeout(900);
    await shot('review_lab_list');
    await page.locator('.modal button:has-text("マルタの花とカード")').first().click().catch(() => {});
    await page.waitForTimeout(900);
    await shot('review_lab_play');
  }
  await browser.close();
})();
