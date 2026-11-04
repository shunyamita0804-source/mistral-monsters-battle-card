// 2026-11-05 指示書 AX：ギアロス（赤銅）の技カードを、ジオル（岩の茶）・ガウル（橙）・タイラント（真っ赤）と並べて撮る。開発用サーバーで動かす。
// 使い方: node tools/e2e/ax_frames_shot.cjs URL 出力フォルダ
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base);
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const { getSkill, getMonster } = await import('/src/data/cards.ts');
    const { createSkillCard } = await import('/src/ui/components/skillCard.ts');
    const { createBattleMonsterCard } = await import('/src/ui/components/battleMonsterCard.ts');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#141a26;padding:8px;display:flex;flex-direction:column;gap:10px;font-family:sans-serif;color:#eee';
    const rows = [
      ['ギアロス', 'mon-gearos', ['skl-gearos-02', 'skl-gearos-06', 'skl-gearos-10']],
      ['ジオル', 'mon-geol', ['skl-geol-03', 'skl-geol-05', 'skl-geol-14']],
      ['ガウル', 'mon-gauul', ['skl-gauul14-03', 'skl-gauul14-07', 'skl-gauul14-13']],
      ['タイラント', 'mon-tyrant', ['skl-tyrant-05', 'skl-tyrant-09', 'skl-tyrant-11']],
    ];
    for (const [name, mon, ids] of rows) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;align-items:flex-end';
      const label = document.createElement('div');
      label.textContent = name;
      label.style.cssText = 'width:52px;font-size:12px';
      row.append(label, createBattleMonsterCard(getMonster(mon), 70), ...ids.map((id) => createSkillCard(getSkill(id), { width: 78 })));
      document.body.append(row);
    }
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/compare_frames.png`, fullPage: true });
  console.log('frames');
  await browser.close();
})();
