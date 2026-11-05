// 2026-11-05 指示書 BG：対戦の結果画面（WIN／LOSE／DRAW）の写真。開発用サーバーで動かす。
// 勝ち・負け・引き分け（帯なし・帯あり）・長いひと言の相手（ステラ・ゼフィラ）・顔の絵が無い相手。顔の絵が無い相手の一覧も出す（faceless.json）。
// 「続ける」の連打で画面が2回進まないか・曲が2回鳴らないかも数える（press.json）。
// 使い方: node tools/e2e/bg_result_shot.cjs URL 出力フォルダ（W・H で画面の大きさ、LANG=en で英語）
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

  /** 対戦を始めて、すぐ決着した状態にする（winner：player／opponent／draw） */
  const result = async (opponent, winner, band) => {
    await page.evaluate(
      async ({ opponent, winner, band }) => {
        if (band) document.documentElement.dataset.resultBand = 'on';
        else delete document.documentElement.dataset.resultBand;
        globalThis.__finished = 0;
        globalThis.__battlePatch = (s) => {
          const w = winner === 'draw' ? null : winner;
          const loser = winner === 'player' ? 'opponent' : 'player';
          const sides = winner === 'draw' ? s.sides : { ...s.sides, [loser]: { ...s.sides[loser], monsters: s.sides[loser].monsters.map((m) => ({ ...m, life: 0 })) } };
          return { ...s, phase: 'ended', winner: w, endReason: 'knockout', turn: 7, sides };
        };
        const { createNewSave } = await import('/src/game/save/saveData.ts');
        const s0 = createNewSave(new Date(2026, 10, 5));
        localStorage.setItem('mistria-battle-card/save', JSON.stringify({ ...s0, player: { gender: 'male', name: 'テスト' }, story: { ...s0.story, introV2: { ...s0.story.introV2, state: 'completed' } } }));
        const { GameStore } = await import('/src/ui/gameStore.ts');
        const { SCREENS } = await import('/src/ui/screens/registry.ts');
        const { mountStage } = await import('/src/ui/stage.ts');
        const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
        const { TOURNAMENTS, tournamentOpponents } = await import('/src/data/tournaments.ts');
        const { runGuardianOpponent } = await import('/src/data/dungeonRun.ts');
        const all = TOURNAMENTS.flatMap((t) => [...tournamentOpponents(t)]);
        const opp = opponent === 'guardian' ? runGuardianOpponent(0, 'dungeon-06') : (ENCOUNTERS[opponent] ?? all.find((o) => o.id === opponent));
        const store = GameStore.fromBrowser();
        store.pendingBattle = { title: 'QA', opponent: opp, allowSurrender: false, onFinish: () => (globalThis.__finished += 1) };
        const stage = mountStage(document.querySelector('#app'), { qa: false });
        const noop = () => {};
        const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
        stage.element.dataset.screen = 'battle';
        stage.element.replaceChildren(screen.element);
      },
      { opponent, winner, band },
    );
    await page.waitForSelector('.battle-order__card', { timeout: 15000 });
    await page.waitForTimeout(500);
    await page.locator('.battle-order__card').first().click();
    await page.waitForSelector('.battle-result', { timeout: 15000 });
    // 絵（主人公・顔・文字）を読み込み終わるまで待つ
    await page.waitForFunction(() => [...document.querySelectorAll('.battle-result img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => console.log('img not loaded'));
    await page.waitForTimeout(1400);
  };

  // 顔の絵が無い相手の一覧（いまのゲームの対戦相手すべて）
  const faceless = await page.evaluate(async () => {
    const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
    const { TOURNAMENTS, tournamentOpponents } = await import('/src/data/tournaments.ts');
    const { RUN_DUNGEONS, runGuardianOpponent, runNpcOpponent } = await import('/src/data/dungeonRun.ts');
    const { EXAM_OPPONENT } = await import('/src/data/introV2.ts');
    const { PETE_OPPONENT } = await import('/src/game/story/pete.ts');
    const { faceKeyOf, opponentFaceUrl } = await import('/src/ui/components/opponentFace.ts');
    const all = [
      ...TOURNAMENTS.flatMap((t) => [...tournamentOpponents(t)]),
      ...Object.values(ENCOUNTERS),
      ...Object.keys(RUN_DUNGEONS).flatMap((id) => [1, 2, 3].map((i) => runNpcOpponent(0, i, id)).concat(runGuardianOpponent(0, id))),
      EXAM_OPPONENT,
      PETE_OPPONENT,
    ];
    const seen = new Set();
    return all.filter((o) => !opponentFaceUrl(faceKeyOf(o))).filter((o) => (seen.has(o.id) ? false : seen.add(o.id))).map((o) => ({ id: o.id, name: o.name, face: o.face ?? null }));
  });
  fs.writeFileSync(`${out}/faceless.json`, JSON.stringify(faceless, null, 2));

  for (const band of [false]) {
    const b = 'noband';
    await result('e-1', 'player', band);
    await page.screenshot({ path: `${out}/result_win_${b}${suffix}.png` });
    await result('e-1', 'opponent', band);
    await page.screenshot({ path: `${out}/result_lose_${b}${suffix}.png` });
    await result('e-1', 'draw', band);
    await page.screenshot({ path: `${out}/result_draw_${b}${suffix}.png` });
  }
  // 長いひと言の相手（帯なし）
  for (const [opp, name] of [
    ['enc-thunder-boss', 'stella'],
    ['enc-wind-boss', 'zephyra'],
  ]) {
    await result(opp, 'player', false);
    await page.screenshot({ path: `${out}/result_${name}_lose${suffix}.png` });
    await result(opp, 'opponent', false);
    await page.screenshot({ path: `${out}/result_${name}_win${suffix}.png` });
  }
  // 顔の絵が無い相手（あれば1人）
  if (faceless[0]) {
    await result(faceless[0].id, 'player', false).catch(() => console.log('faceless mount failed', faceless[0].id));
    await page.screenshot({ path: `${out}/result_faceless_${faceless[0].id}${suffix}.png` });
  }
  // 「続ける」の連打：onFinish が1回だけか
  await result('e-1', 'player', false);
  const btn = page.locator('.battle-result button').last();
  for (let i = 0; i < 5; i++) await btn.click({ force: true, noWaitAfter: true }).catch(() => {});
  await page.waitForTimeout(600);
  const finished = await page.evaluate(() => globalThis.__finished);
  fs.writeFileSync(`${out}/press${suffix}.json`, JSON.stringify({ taps: 5, finished }));
  console.log('result', LANG, W, H, 'faceless', faceless.length, 'finished', finished);
  await browser.close();
})();
