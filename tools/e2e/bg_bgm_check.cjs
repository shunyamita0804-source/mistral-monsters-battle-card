// 2026-11-05 指示書 BG（2回目）：結果の曲を「続ける」で止めたあと、戻る先の画面が自分の曲を鳴らすか。開発用サーバーで動かす。
// 対戦の結果画面で「続ける」を押し（bgm.stop）、そのあと戻る先の画面を作って、頼まれている曲（bgm.current）を調べる。
// 戻る先：ダンジョン（ランダム生成・前の手作りの地図）・大会（次の試合の前の画面・大会の終わり）・街・家・練習場・研究所。
// 使い方: node tools/e2e/bg_bgm_check.cjs URL 出力の JSON
const { chromium } = require('playwright');
const fs = require('fs');
const [base, outFile] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1200);
  const rows = await page.evaluate(async () => {
    const { createNewSave, startRun } = await import('/src/game/save/saveData.ts').then(async (m) => ({ ...m, startRun: (await import('/src/game/dungeon/run.ts')).startRun }));
    const { GameStore } = await import('/src/ui/gameStore.ts');
    const { SCREENS } = await import('/src/ui/screens/registry.ts');
    const { mountStage } = await import('/src/ui/stage.ts');
    const { bgm } = await import('/src/ui/bgm.ts');
    const s0 = createNewSave(new Date(2026, 10, 5));
    const base = { ...s0, player: { gender: 'male', name: 'テスト' }, story: { ...s0.story, intro: 'completed', introV2: { ...s0.story.introV2, state: 'legacySkipped' } } };
    const stage = mountStage(document.querySelector('#app'), { qa: false });
    const noop = () => {};
    const mount = (screenId, save) => {
      localStorage.setItem('mistria-battle-card/save', JSON.stringify(save));
      const store = GameStore.fromBrowser();
      const screen = SCREENS[screenId].create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = screenId;
      stage.element.replaceChildren(screen.element);
      return screen;
    };
    const out = [];
    const check = async (place, screenId, save) => {
      // 結果の曲が鳴っている → 「続ける」（0.3 秒で止める）→ 戻る先の画面を作る
      bgm.playAfterStop('battleWinJingle', 0);
      await new Promise((r) => setTimeout(r, 100));
      bgm.stop(0.3);
      const after = bgm.current;
      const screen = mount(screenId, save);
      await new Promise((r) => setTimeout(r, 1500));
      out.push({ place, screen: screenId, afterContinue: after, requested: bgm.current, map: JSON.parse(localStorage.getItem('mistria-battle-card/save') ?? '{}').location?.mapId ?? null, shown: document.querySelector('[data-map]')?.getAttribute('data-map') ?? null });
      screen.destroy?.();
    };
    const at = (mapId, x, y) => ({ ...base, location: { mapId, x, y, dir: 'down' } });
    await check('街（ピート・イベントの対戦・導入の試験のあと）', 'world', at('town', 31, 186));
    await check('練習場（練習試合のあと）', 'world', at('practice', 5, 5));
    await check('家（試験のあと・家に戻ったとき）', 'world', at('home', 5, 5));
    await check('研究所', 'world', at('lab', 5, 5));
    const run = startRun({ ...base, rank: 'A' }, 'dungeon-06', 7);
    await check('ダンジョン（ランダム生成：機械の塔）', 'dungeonRun', run);
    const run2 = startRun(base, 'dungeon-08', 7);
    await check('ダンジョン（ランダム生成：風の渓谷）', 'dungeonRun', run2);
    await check('大会（次の試合の前・大会の終わり：大会の画面に戻る）', 'tournament', { ...base, rank: 'E' });
    return out;
  });
  fs.writeFileSync(outFile, JSON.stringify(rows, null, 2));
  for (const r of rows) console.log(r.place, '→', r.requested);
  await browser.close();
})();
