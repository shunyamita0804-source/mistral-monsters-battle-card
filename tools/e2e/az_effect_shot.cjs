// 2026-11-05 指示書 AZ【4】の案（写真だけ。ゲームには入れていない）：技カードの効果の文をアイコンに置き換えた見た目。開発用サーバーで動かす。
// 使い方: node tools/e2e/az_effect_shot.cjs URL 出力フォルダ
//   effect_hand.png … 手札の大きさ5枚（上＝今・下＝案：右上に効果のアイコン）
//   effect_big.png  … 大きく見たとき（左＝今：効果の帯の文・右＝案：帯の文の代わりにアイコン）
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const CARDS = [
  ['skl-gearos-01', 'e01'],
  ['skl-gearos-06', 'e02'],
  ['skl-gearos-07', 'e03'],
  ['skl-tyrant-07', 'e04'],
  ['skl-tyrant-11', 'e05'],
  ['skl-gearos-10', 'e06'],
];
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1200);
  for (const mode of ['hand', 'big']) {
    await page.evaluate(
      async ([mode, cards]) => {
        const { getSkill } = await import('/src/data/cards.ts');
        const { createBattleCard } = await import('/src/ui/components/battleCard.ts');
        const { statusIconUrl } = await import('/src/ui/statusIcons.ts');
        document.body.innerHTML = '';
        document.body.style.cssText = 'margin:0;background:#141a26;color:#eee;font-family:sans-serif;padding:6px';
        const label = (text) => {
          const d = document.createElement('div');
          d.textContent = text;
          d.style.cssText = 'font-size:13px;margin:6px 0 4px';
          return d;
        };
        const icon = (id, css) => {
          const img = document.createElement('img');
          img.src = statusIconUrl(id);
          img.style.cssText = css;
          return img;
        };
        const list = mode === 'hand' ? cards.slice(0, 5) : cards.slice(0, 3);
        for (const proposal of [false, true]) {
          document.body.append(label(proposal ? '案：効果のアイコン' : '今：効果の文'));
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
          for (const [id, ic] of list) {
            const el = createBattleCard(getSkill(id), mode === 'hand' ? { width: 70, size: 'hand' } : { width: 120, size: 'focus' });
            el.style.position = 'relative';
            if (proposal) {
              if (mode === 'hand') el.append(icon(ic, 'position:absolute;right:4%;top:24%;width:30%;filter:drop-shadow(0 1px 2px #000)'));
              else {
                const band = el.querySelector('.skill-card__band');
                if (band) {
                  band.replaceChildren(icon(ic, 'height:190%;margin:-38% auto 0;display:block;filter:drop-shadow(0 1px 2px #000)'));
                }
              }
            }
            row.append(el);
          }
          document.body.append(row);
        }
      },
      [mode, CARDS],
    );
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/effect_${mode}.png`, fullPage: true });
    console.log('effect', mode);
  }
  // 24px で見分けがつくか：B01〜B04・B07・B09・S08・S09・S10・S12・S13
  await page.evaluate(async () => {
    const { statusIconUrl } = await import('/src/ui/statusIcons.ts');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#141a26;color:#eee;font-family:sans-serif;padding:8px';
    for (const bg of ['#141a26', '#e9dcc0']) {
      const row = document.createElement('div');
      row.style.cssText = `display:flex;gap:8px;padding:8px;background:${bg};flex-wrap:wrap`;
      for (const id of ['b01', 'b02', 'b03', 'b04', 'b07', 'b09', 's08', 's09', 's10', 's12', 's13']) {
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;align-items:center;font-size:9px;gap:2px;color:#888';
        const img = document.createElement('img');
        img.src = statusIconUrl(id);
        img.style.cssText = 'width:24px;height:24px';
        box.append(img, id.toUpperCase());
        row.append(box);
      }
      document.body.append(row);
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/icons_24px.png`, clip: { x: 0, y: 0, width: 390, height: 140 } });
  console.log('24px');
  await browser.close();
})();
