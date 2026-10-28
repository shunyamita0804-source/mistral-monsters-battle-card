import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardCatalog, getSkill } from '../src/data/cards.ts';
import { skillBandText } from '../src/game/cards/cardTypes.ts';

/**
 * 技・サポートカードの枠（2026-10-29 新しい形：平らな名前の帯＋大きな絵の窓。npm run art:skillframes＝tools/art/skillcard_simple_build.py）。
 * 枠はモンスターごとに1枚（frame_{normal,hand}_{モンスター}.webp）とサポートの銀（frame_{normal,hand}_support.webp）
 */
const DIR = 'assets/images/ui/skillcard_simple';
const ORIGINAL = 'design-parts/ui-skillcard-simple-20261028/frames';
const frames = readdirSync(DIR).filter((f) => f.startsWith('frame_'));

/** webp の絵の大きさ（VP8X の見出しから読む） */
function webpSize(path: string): [number, number] {
  const b = readFileSync(path);
  expect(b.toString('ascii', 12, 16)).toBe('VP8X');
  return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
}

/** PNG の大きさ */
function pngSize(path: string): [number, number] {
  const b = readFileSync(path);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('技・サポートカードの枠（新しい形）', () => {
  it('原本は 253×382・208×210 のちょうど4倍（手札は 208×260 に縦にのばして使う）。届いたままの絵も保管してある', () => {
    expect(pngSize(`${ORIGINAL}/frame_normal_simple.png`)).toEqual([1012, 1528]);
    expect(pngSize(`${ORIGINAL}/frame_hand_simple.png`)).toEqual([832, 840]);
    for (const k of ['normal', 'hand']) expect(existsSync(`${ORIGINAL}/original/frame_${k}_simple_as_delivered.png`)).toBe(true);
  });

  it('技を持つモンスターは、すべて自分の色の枠がある（サポート以外のカードに銀の枠が出ない）', () => {
    const monsters = new Set([...cardCatalog.all()].filter((c) => c.kind === 'skill').map((c) => (c.kind === 'skill' ? c.monsterId : '')));
    expect(monsters.size).toBeGreaterThan(6);
    for (const id of monsters) for (const size of ['normal', 'hand']) expect(existsSync(`${DIR}/frame_${size}_${id.replace(/^mon-/, '')}.webp`), `${id} ${size}`).toBe(true);
    for (const size of ['normal', 'hand']) expect(existsSync(`${DIR}/frame_${size}_support.webp`)).toBe(true);
  });

  it('大きさは LAYOUT の2倍（506×764・416×520）', () => {
    for (const f of frames) expect(webpSize(`${DIR}/${f}`)).toEqual(f.startsWith('frame_normal') ? [506, 764] : [416, 520]);
  });

  it('前の枠（v5 の分類の色の枠）は残っていない。マナの球・分類の札・ダメージの欄は前の版の見た目を切り出して使う（2026-10-29 ユーザー指示）', () => {
    expect(readdirSync('assets/images/ui/skillcard_v5').filter((f) => f.startsWith('frame_') || f.startsWith('mana_'))).toEqual([]);
    for (const f of ['mana_ball', 'value_box', 'tile_force', 'tile_wisdom', 'tile_defense', 'tile_evade', 'tile_special']) expect(existsSync(`${DIR}/${f}.webp`), f).toBe(true);
  });

  it('合計の重さは前の枠（約4.6MB）よりずっと小さい', () => {
    const total = frames.reduce((n, f) => n + statSync(`${DIR}/${f}`).size, 0);
    expect(total).toBeLessThan(1_500_000);
  });
});

describe('効果の帯の文字', () => {
  it('ふつうの攻撃技は帯なし（数字の言い直しは出さない）', () => {
    expect(skillBandText(getSkill('skl-soramo14-03'))).toBe('');
  });

  it('効果のある攻撃技は、その部分だけ', () => {
    expect(skillBandText(getSkill('skl-lazuck-04'))).toBe('回避されない');
    expect(skillBandText(getSkill('skl-pukarim-07'))).toBe('ほっぺにためているときに使うと、回避されない');
  });

  it('防御・回避・特殊は今の説明の文', () => {
    for (const id of ['skl-soramo14-11', 'skl-soramo14-13', 'skl-soramo14-09']) expect(skillBandText(getSkill(id))).not.toBe('');
  });
});
