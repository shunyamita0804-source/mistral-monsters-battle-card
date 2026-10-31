// 指示書 AC【1】（2026-10-31）バトル画面の直しの前（AB）と今をくらべる写真と、段ごとの高さ。開発用サーバー（npx vite）で動かす。
// 撮るもの：
//   1_idle（自分の番・何も選んでいない）・2_tap（手札を押したとき）・3_use（技を使った演出）・3b_idle_last（直前のカードを薄く）
//   4a_opp_start（相手の番の始め）・4b_opp_used（相手がカードを使った所）
//   5b_def_mixed（守りの選択：使えないカードもある）・5c_def_spot（守りのカードを使った所）・5d_def_reduced（「いまのダメージ」が減った所）
//   6_back_own（自分の番に戻った所）・4c_opp_start_last（2回目の相手の番の始め：相手が直前に使ったカードを薄く）
//   5a_def_usable（守れるカードだけ）・5e_def_none（守れるカードが無い）・5f_def_many（守りのカードが7枚）
// 撮影のときだけ、ブラウザの中で対戦の始まりを置きかえる（page.route で engine.ts の createBattle を包む。ゲームのルール・ファイルは変えない）。
// 相手の思考が毎回同じになるよう、対戦の乱数の種を決まった値にする。相手は氷の洞窟のイヴァン。
// 使い方: node tools/e2e/battle_layout_ac_shot.cjs http://127.0.0.1:5173/ 出力フォルダ 名前の頭
//   （W・H で画面の大きさ、LANG=en で英語、SCENES=small で 1_idle と 5a_def_usable だけ）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out, tag = 'now'] = process.argv.slice(2);
const W = +(process.env.W || 390);
const H = +(process.env.H || 844);
const LANG = process.env.LANG === 'en' ? 'en' : 'ja';
const SMALL = process.env.SCENES === 'small';
const suffix = `${LANG === 'en' ? '_en' : ''}${W !== 390 || H !== 844 ? `_${W}x${H}` : ''}`;
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const hy = (n) => `skl-hyouzuku-${String(n).padStart(2, '0')}`;
const sor = (n) => `skl-soramo14-${String(n).padStart(2, '0')}`;
const gau = (n) => `skl-gauul14-${String(n).padStart(2, '0')}`;
/** 自分の3体（場の並び順）と、それぞれのちから技の守りのカード */
const MONSTERS = ['mon-hyouzuku', 'mon-soramo', 'mon-gauul'];
const GUARD = { 'mon-hyouzuku': [hy(12), hy(14)], 'mon-soramo': [sor(11), sor(14)], 'mon-gauul': [gau(11), gau(12)] };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((lang) => {
    localStorage.setItem('mistria-battle-card/settings', JSON.stringify({ language: lang, seVolume: 0, bgmVolume: 0, muted: true }));
  }, LANG);
  await ctx.route(/\/src\/game\/battle\/engine\.ts/, async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    body = body.replace('export function createBattle(', 'function createBattle__orig(');
    body += '\nexport function createBattle(...a) { const s = createBattle__orig(...a); return globalThis.__battlePatch ? globalThis.__battlePatch(s) : s; }\n';
    await route.fulfill({ response: res, body });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  const layout = {};
  const measure = async (name) => {
    layout[name] = await page.evaluate(() => {
      const st = document.querySelector('.stage');
      const k = st ? st.getBoundingClientRect().width / st.offsetWidth : 1;
      const o = st ? st.getBoundingClientRect() : { x: 0, y: 0 };
      const box = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) return null;
        return { top: Math.round((b.top - o.y) / k), height: Math.round(b.height / k), left: Math.round((b.left - o.x) / k), width: Math.round(b.width / k) };
      };
      const r = (sel) => box(document.querySelector(sel));
      return {
        focus: document.querySelector('.battle-camera')?.dataset.focus ?? null,
        header: r('.battle__header'),
        camera: r('.battle-camera'),
        oppDetail: r('.battle-opp-detail'),
        oppDetailCard: r('.battle-opp-detail .battle-spot__card .skill-card'),
        oppHand: r('.battle-hand--opponent'),
        oppRow: r('.battle-row--opponent'),
        playerRow: r('.battle-row--player'),
        monster: r('.battle-row--player .battle__monster'),
        detail: r('.battle-camera .battle-detail'),
        detailCard: r('.battle-camera .battle-detail .battle-detail__card .skill-card, .battle-camera .battle-detail .battle-spot__card .skill-card, .battle-camera .battle-detail .battle-card-slot'),
        detailText: r('.battle-camera .battle-detail .battle-detail__left, .battle-camera .battle-detail .battle-spot__info'),
        defenseCard: r('.battle__defense-card .skill-card'),
        hand: r('.battle__hand'),
        handCard: r('.battle__hand-card .skill-card'),
        commands: r('.battle__commands'),
      };
    });
  };
  const shot = async (name) => { await page.screenshot({ path: `${out}/${tag}_${name}${suffix}.png` }); await measure(name); log('shot', name); };
  /** o：{ first, turn, mana, hand, oppMana, oppHand, wait } */
  const start = async (o) => {
    await page.goto(base);
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: '.stage-diag{display:none!important}' });
    await page.evaluate(async (o) => {
      globalThis.__battlePatch = (s) => {
        const cards = o.hand.map((id, i) => ({ uid: `x${i}`, cardId: id }));
        const player = { ...s.sides.player, hand: cards, manaPile: s.sides.player.deck.slice(0, o.mana), deck: s.sides.player.deck.slice(o.mana) };
        const oppHand = (o.oppHand ?? []).map((id, i) => ({ uid: `y${i}`, cardId: id }));
        const om = o.oppMana ?? 3;
        const opponent = { ...s.sides.opponent, hand: oppHand, manaPile: s.sides.opponent.deck.slice(0, om), deck: s.sides.opponent.deck.slice(om) };
        const first = o.first ?? 'player';
        return { ...s, seed: 20261031, turn: o.turn ?? 1, active: first, first, phase: 'main', manaConvertLimit: null, sides: { ...s.sides, player, opponent } };
      };
      const { createNewSave } = await import('/src/game/save/saveData.ts');
      localStorage.setItem('mistria-battle-card/save', JSON.stringify(createNewSave(new Date(2026, 9, 31))));
      const { GameStore } = await import('/src/ui/gameStore.ts');
      const { SCREENS } = await import('/src/ui/screens/registry.ts');
      const { mountStage } = await import('/src/ui/stage.ts');
      const { ENCOUNTERS } = await import('/src/data/dungeons.ts');
      const store = GameStore.fromBrowser();
      const tsu = (n) => `skl-hyouzuku-${String(n).padStart(2, '0')}`;
      const deck = { monsters: o.monsters, skills: Array.from({ length: 60 }, (_, i) => (i % 2 ? 'skl-soramo14-01' : tsu((i % 9) + 1))) };
      store.pendingBattle = { title: '氷の洞窟', opponent: ENCOUNTERS['enc-ice-boss'], allowSurrender: false, playerDeck: deck, onFinish: () => {} };
      const stage = mountStage(document.querySelector('#app'), { qa: false });
      const noop = () => {};
      const screen = SCREENS.battle.create({ navigate: noop, back: noop, reset: noop, store });
      stage.element.dataset.screen = 'battle';
      stage.element.replaceChildren(screen.element);
    }, { ...o, monsters: MONSTERS });
    await page.waitForSelector('.battle-order__card', { timeout: 15000 });
    await page.waitForTimeout(700);
    await page.locator('.battle-order__card').first().click();
    await page.waitForTimeout(o.wait ?? 4500);
    // 対戦の始めのあいさつのふきだしは閉じる（盤面を見せる）
    for (let i = 0; i < 2; i++) await page.locator('.battle__talk').first().click({ timeout: 500 }).catch(() => {});
    await page.waitForTimeout(300);
  };
  const tap = async (loc) => { const b = await loc.boundingBox(); if (b) await page.mouse.click(b.x + 12, b.y + b.height / 2); };
  const closeTalk = async () => { await page.locator('.battle__talk').first().click({ timeout: 300 }).catch(() => {}); };
  /** 真ん中のボタン（攻撃終了・ターン終了・受ける）を押し、確認の窓が出たら「はい」 */
  const pressMain = async () => {
    await page.locator('.battle__commands .is-main:not([disabled])').first().click({ timeout: 8000 });
    await page.waitForTimeout(400);
    const ok = page.locator('.command-confirm__buttons .command-btn:not(.command-btn--cancel), .modal .btn--primary');
    if (await ok.count()) await ok.first().click({ timeout: 1000 }).catch(() => {});
  };
  /** 守りの選択の欄が出たか（相手のカードを見せ終わってから出る。前の版・今の版のどちらでも） */
  const defenseReady = () => !!document.querySelector('.battle__defense-card, .battle__defense-none, .battle__defense-empty');
  const waitFor = async (fn, arg, ms = 20000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 50 }).then(() => true).catch(() => false);
  const useLabel = LANG === 'en' ? 'Use' : '使う';
  const oppB = { first: 'opponent', turn: 3, mana: 5, oppMana: 5, oppHand: [hy(2), sor(11)], wait: 300 };

  // 1〜3：自分の番（手札5枚。相手の手札4枚）
  await start({ mana: 5, hand: [hy(2), hy(5), sor(4), hy(12), 'sup-7'], oppHand: [hy(1), hy(3), sor(1), sor(11)] });
  await shot('1_idle');
  if (!SMALL) {
    await tap(page.locator('.battle__hand-card').nth(0));
    await page.waitForTimeout(900);
    await shot('2_tap');
    await page.locator(`button:has-text("${useLabel}")`).first().click({ timeout: 3000 });
    await page.waitForTimeout(900);
    await page.locator('.battle__monster[data-uid="o-m1"]').click({ force: true });
    await page.waitForTimeout(500);
    await shot('3_use');
    await page.waitForTimeout(3500);
    await closeTalk();
    await page.waitForTimeout(400);
    await shot('3b_idle_last');
  }

  // 守りの選択（狙われるモンスターを先に調べる。乱数の種が同じなので、手札の守りのカードが変わっても狙いは同じ）
  let targetCard = null;
  if (!SMALL) {
    // 4〜6：相手の番 → 守りの選択（使えないカードもある）→ 守りのカードを使う → 自分の番 → 2回目の相手の番
    await start({ ...oppB, hand: [hy(12), gau(11), sor(11), hy(13), sor(4)] });
    await waitFor(() => document.querySelector('.battle')?.dataset.acting !== 'dealing', null, 8000);
    await closeTalk();
    await page.waitForTimeout(150);
    await shot('4a_opp_start');
    if (await waitFor(() => !!document.querySelector('.battle-spot--opponent:not(.is-idle) .battle-spot__card'))) {
      await page.waitForTimeout(1500);
      await shot('4b_opp_used');
    } else log('no opponent card');
    if (await waitFor(defenseReady)) {
      await page.waitForTimeout(700);
      await shot('5b_def_mixed');
      targetCard = await page.evaluate(() => {
        const el = document.querySelector('.battle-row--player .battle__monster.is-attacked');
        return el ? el.dataset.uid : null;
      });
      log('target', targetCard);
      const usable = page.locator('.battle__defense-card:not(.is-unusable):not([disabled])');
      if (await usable.count()) {
        await usable.first().click();
        await page.waitForTimeout(450);
        await shot('5c_def_spot');
        await waitFor(() => !document.querySelector('.battle-spot--player') && !!document.querySelector('.battle__defense-card, .battle__defense-none, .battle__defense-empty'), null, 6000);
        await page.waitForTimeout(500);
        await shot('5d_def_reduced');
      } else log('no usable defense card');
      await pressMain();
    } else log('no defense');
    if (await waitFor(() => { const b = document.querySelector('.battle'); return b?.dataset.active === 'player' && b?.dataset.acting === 'player'; }, null, 30000)) {
      await page.waitForTimeout(800);
      await closeTalk();
      await page.waitForTimeout(400);
      await shot('6_back_own');
      // 攻撃終了 → ターン終了 → 相手の番の始め（相手が直前に使ったカードを薄く）
      await pressMain();
      await waitFor(() => document.querySelector('.battle')?.dataset.phase === 'mana', null, 6000);
      await page.waitForTimeout(500);
      await pressMain();
      if (await waitFor(() => document.querySelector('.battle')?.dataset.active === 'opponent', null, 6000)) {
        await page.waitForTimeout(500);
        await shot('4c_opp_start_last');
      }
    } else log('no player turn');
  }

  // 5a：守れるカードだけ（狙われるモンスターの守りのカード2枚）
  // 自分のモンスターの uid は p-m1〜p-m3（場の並び順）
  const idx = targetCard ? Math.max(0, +String(targetCard).replace(/\D/g, '') - 1) : 2;
  const guard = GUARD[MONSTERS[idx]] ?? GUARD['mon-gauul'];
  await start({ ...oppB, hand: [...guard, sor(4), hy(5), sor(1)] });
  if (await waitFor(defenseReady)) {
    await page.waitForTimeout(700);
    await shot('5a_def_usable');
  } else log('no defense (5a)');
  if (!SMALL) {
    // 5e：守れるカードが無い
    await start({ ...oppB, hand: [hy(2), hy(5), sor(4), sor(1), 'sup-7'] });
    if (await waitFor(defenseReady)) {
      await page.waitForTimeout(700);
      await shot('5e_def_none');
    } else log('no defense (5e)');
  }
  if (!SMALL) {
    // 5f：守りのカードが多いとき（7枚。手札と同じく重ねて並べる）
    await start({ ...oppB, hand: [hy(12), hy(14), sor(11), sor(14), gau(11), gau(12), hy(13)] });
    if (await waitFor(defenseReady)) {
      await page.waitForTimeout(700);
      await shot('5f_def_many');
    } else log('no defense (5f)');
  }
  fs.writeFileSync(`${out}/${tag}_layout${suffix}.json`, JSON.stringify(layout, null, 1));
  await browser.close();
})();
