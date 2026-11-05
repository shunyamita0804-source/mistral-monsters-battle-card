// 2026-11-05 ユーザー指示：ダンジョンの壁と床の見分け。12のダンジョンの、階の始まりのまわりの写真（直す前・後で同じ所）。開発用サーバーで動かす。
// ランダム生成の9つは、その挑戦の1階のスタート。イベントのダンジョン3つ（霧の廃坑・忘れられた書庫・静かなる祭壇）はまだダンジョンとして入れないので、
// 太古の遺跡の1階の形に、その見た目（.drun--event-*）を付けかえて撮る。見たマスはスタートのまわり 5 マス（歩いたあとのように）。
// 使い方: node tools/e2e/dungeon_wall_shot.cjs URL 出力フォルダ 名前の後ろにつける文字（before／after）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out, tag] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const LIST = [
  ['dungeon-08', 'wind'],
  ['dungeon-03', 'water'],
  ['dungeon-02', 'forest'],
  ['dungeon-04', 'ice'],
  ['dungeon-05', 'fire'],
  ['dungeon-01', 'ruins'],
  ['dungeon-09', 'thunder'],
  ['dungeon-06', 'machine'],
  ['dungeon-07', 'holy'],
  ['event-mist-mine', 'mist_mine'],
  ['event-archive', 'archive'],
  ['event-altar', 'altar'],
];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: 'ja', seVolume: 0, bgmVolume: 0, muted: true })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
  for (const [id, name] of LIST) {
    await page.evaluate(
      async ({ id }) => {
        const event = id.startsWith('event-');
        const dungeonId = event ? 'dungeon-01' : id;
        const { createNewSave } = await import('/src/game/save/saveData.ts');
        const { runFloor, startRun } = await import('/src/game/dungeon/run.ts');
        const s0 = createNewSave(new Date(2026, 10, 5));
        let save = { ...s0, rank: 'S', player: { gender: 'male', name: 'テスト' }, story: { ...s0.story, intro: 'completed', introV2: { ...s0.story.introV2, state: 'legacySkipped' } }, storyFlags: ['story:M09', 'story:M16', 'story:M18', 'story:M24', 'story:M25', 'story:D06'] };
        save = startRun(save, dungeonId, 7919);
        const f = runFloor({ seed: 7919, floor: 0, dungeonId });
        const cells = Array.from({ length: f.width * f.height }, (_, i) => {
          const x = i % f.width;
          const y = Math.floor(i / f.width);
          return Math.max(Math.abs(x - f.start.x), Math.abs(y - f.start.y)) <= 5 ? '1' : '0';
        }).join('');
        save = { ...save, dungeonRun: { ...save.dungeonRun, explored: cells, cooldown: 999 } };
        localStorage.setItem('mistria-battle-card/save', JSON.stringify(save));
        const { GameStore } = await import('/src/ui/gameStore.ts');
        const { SCREENS } = await import('/src/ui/screens/registry.ts');
        const { mountStage } = await import('/src/ui/stage.ts');
        const store = GameStore.fromBrowser();
        const stage = mountStage(document.querySelector('#app'), { qa: false });
        const noop = () => {};
        const screen = SCREENS.dungeonRun.create({ navigate: noop, back: noop, reset: noop, store });
        stage.element.dataset.screen = 'dungeonRun';
        stage.element.replaceChildren(screen.element);
        if (event) {
          const root = document.querySelector('.drun');
          root.classList.remove('drun--dungeon-01');
          root.classList.add(`drun--${id}`);
        }
      },
      { id },
    );
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${out}/wall_${name}_${tag}.png` });
  }
  console.log('walls', tag);
  await browser.close();
})();
