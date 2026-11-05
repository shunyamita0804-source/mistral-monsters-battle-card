// 2026-11-05 NPC バトルセリフ 43 名（第1弾）：対戦の吹き出しの写真。開発用サーバーで動かす。
// 1. 主な NPC と ？？？（見えない番人）の始めのひと言（そのまま）
// 2. 長いセリフ（ステラ・ゼフィラ）が吹き出しに収まるか：対戦中（始めのひと言の場所）と、勝ち負けが決まった画面
//    （そのひと言だけを出すため、表示用の npcLine を写真のときだけ差しかえる）
// 使い方: node tools/e2e/npc_lines_shot.cjs URL 出力フォルダ（W・H で画面の大きさ、LANG=en で英語）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const suffix = `_${LANG}_${W}x${H}`;
fs.mkdirSync(out, { recursive: true });
const LONG = JSON.parse(fs.readFileSync('design-parts/npc-battle-lines-20261105/data/npc_battle_lines.json', 'utf8'));
const EN = JSON.parse(fs.readFileSync('design-parts/npc-battle-lines-20261105/en_provisional_claude.json', 'utf8')).en;
const textOf = (actor, key) => {
  const ja = LONG.actors.find((a) => a.id === actor)?.lines[key]?.text ?? LONG.extra_lines[actor]?.[key]?.text;
  return { ja, en: EN[actor][key] };
};
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((l) => localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: l, seVolume: 0, bgmVolume: 0, muted: true })), LANG);
  // 写真のときだけ：createBattle のあとに状態を差しかえる・npcLine の文を差しかえる
  await ctx.route(/\/src\/game\/battle\/engine\.ts/, async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    body = body.replace('export function createBattle(', 'function createBattle__orig(');
    body += '\nexport function createBattle(...a) { const s = createBattle__orig(...a); return globalThis.__battlePatch ? globalThis.__battlePatch(s) : s; }\n';
    await route.fulfill({ response: res, body });
  });
  await ctx.route(/\/src\/data\/npcBattleLines\.ts/, async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    body = body.replace('export function npcLine(', 'function npcLine__orig(');
    body += '\nexport function npcLine(a, k) { const o = globalThis.__npcLineOverride; return o !== undefined ? o : npcLine__orig(a, k); }\n';
    await route.fulfill({ response: res, body });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '.stage-diag{display:none!important}' });

  const battle = async (opponent, { line, ended } = {}) => {
    await page.evaluate(
      async ({ opponent, line, ended }) => {
        globalThis.__npcLineOverride = line ?? undefined;
        globalThis.__battlePatch = ended
          ? (s) => ({ ...s, phase: 'ended', winner: 'player', endReason: 'knockout', sides: { ...s.sides, opponent: { ...s.sides.opponent, monsters: s.sides.opponent.monsters.map((m) => ({ ...m, life: 0 })) } } })
          : undefined;
        const { createNewSave } = await import('/src/game/save/saveData.ts');
        const s0 = createNewSave(new Date(2026, 10, 5));
        localStorage.setItem('mistria-battle-card/save', JSON.stringify({ ...s0, player: { gender: 'male', name: 'テスト' }, story: { ...s0.story, introV2: { ...s0.story.introV2, state: 'completed' } } }));
        const { GameStore } = await import('/src/ui/gameStore.ts');
        const { SCREENS } = await import('/src/ui/screens/registry.ts');
        const { mountStage } = await import('/src/ui/stage.ts');
        const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
        const { TOURNAMENTS, tournamentOpponents } = await import('/src/data/tournaments.ts');
        const { runGuardianOpponent, runNpcOpponent } = await import('/src/data/dungeonRun.ts');
        const all = TOURNAMENTS.flatMap((t) => [...tournamentOpponents(t)]);
        const opp =
          opponent === 'guardian' ? runGuardianOpponent(0, 'dungeon-06') : opponent === 'otto' ? runNpcOpponent(0, 1, 'dungeon-06') : (ENCOUNTERS[opponent] ?? all.find((o) => o.id === opponent));
        const store = GameStore.fromBrowser();
        store.pendingBattle = { title: 'QA', opponent: opp, allowSurrender: false, onFinish: () => {} };
        const stage = mountStage(document.querySelector('#app'), { qa: false });
        const noop = () => {};
        const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
        stage.element.dataset.screen = 'battle';
        stage.element.replaceChildren(screen.element);
      },
      { opponent, line, ended },
    );
    await page.waitForSelector('.battle-order__card', { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator('.battle-order__card').first().click();
  };

  // 1. 主な NPC と見えない番人の始めのひと言（文はそのまま）
  for (const [opp, name] of [
    ['enc-thunder-boss', 'stella'],
    ['enc-wind-boss', 'zephyra'],
    ['enc-machine-boss', 'teo'],
    ['e-1', 'noel'],
    ['reg-alvin', 'alvin'],
    ['gen-walter', 'walter'],
    ['otto', 'otto'],
    ['guardian', 'guardian'],
  ]) {
    await battle(opp);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${out}/npc_start_${name}${suffix}.png` });
  }
  // 2. 長いセリフ（いちばん長い行）：対戦中・勝ち負けが決まった画面
  for (const [opp, actor, key] of [
    ['enc-thunder-boss', 'stella', 'ace_down_final'],
    ['enc-thunder-boss', 'stella', 'npc_lose'],
    ['enc-wind-boss', 'zephyra', 'ace_down_final'],
    ['enc-wind-boss', 'zephyra', 'npc_win'],
  ]) {
    const line = textOf(actor, key);
    // 吹き出しは 1.3 秒（先攻・後攻を見せる）のあと、1文字 45ms で出て 2.2 秒残る：全部出たところで撮る
    const wait = 1300 + [...line[LANG]].length * 45 + 500;
    await battle(opp, { line });
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${out}/npc_long_${actor}_${key}_battle${suffix}.png` });
    await battle(opp, { line, ended: true });
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${out}/npc_long_${actor}_${key}_result${suffix}.png` });
  }
  console.log('npc', LANG, W, H);
  await browser.close();
})();
