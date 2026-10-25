import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS, battleCardOf } from '../src/data/battleCards.ts';
import { MONSTERS } from '../src/data/cards.ts';
import { SORAMO_MONSTER_ID } from '../src/data/soramo.ts';

const ORIGINAL = 'design-parts/cards-original/soramo-battle-20261025';
const sha256 = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

/** 8bit・インターレースなしの PNG（RGB / RGBA）を読む（テスト用の最小限） */
function decodePng(path: string): { w: number; h: number; ch: number; px: Uint8Array } {
  const buf = readFileSync(path);
  let pos = 8;
  let w = 0;
  let h = 0;
  let ch = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error('8bit・インターレースなしだけ読める');
      ch = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0;
      if (!ch) throw new Error('RGB・RGBA だけ読める');
    } else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[y * stride + x - ch] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= ch && y > 0 ? px[(y - 1) * stride + x - ch] : 0;
      let v = src[x] as number;
      if (f === 1) v += a as number;
      else if (f === 2) v += b as number;
      else if (f === 3) v += Math.floor(((a as number) + (b as number)) / 2);
      else if (f === 4) {
        const p = (a as number) + (b as number) - (c as number);
        const pa = Math.abs(p - (a as number));
        const pb = Math.abs(p - (b as number));
        const pc = Math.abs(p - (c as number));
        v += pa <= pb && pa <= pc ? (a as number) : pb <= pc ? (b as number) : (c as number);
      }
      px[y * stride + x] = v & 0xff;
    }
  }
  return { w, h, ch, px };
}

describe('ソラモのバトル用カード（2026-10-25 正式素材）', () => {
  it('届いた素材は照合表どおり。ゲームのモンスターの絵・共通の背景は、届いたものと1バイトも違わない', () => {
    const manifest = readFileSync(`${ORIGINAL}/SHA256_MANIFEST.txt`, 'utf8').trim().split('\n').map((l) => l.split(/\s+/));
    expect(manifest.length).toBeGreaterThanOrEqual(7);
    for (const [hash, file] of manifest) expect(sha256(readFileSync(`${ORIGINAL}/${file}`))).toBe(hash);
    expect(readFileSync('assets/images/cards/monsters/soramo_battlecard.png').equals(readFileSync(`${ORIGINAL}/02_Soramo_Battle_800x920_RGBA.png`))).toBe(true);
    expect(readFileSync('assets/images/backgrounds/battlecard_bg_common.png').equals(readFileSync(`${ORIGINAL}/03_Battle_Common_Background_800x920.png`))).toBe(true);
  }, 30000);

  it('枠：正式採用の枠から、市松模様と外縁の外の粒の透明度だけを変えた（色・形は同じ。透明度は上げていない）', () => {
    const orig = decodePng(`${ORIGINAL}/04_Approved_Battle_Frame_Reference.png`);
    const base = decodePng('assets/images/ui/battlecard/frame_base.png');
    expect([base.w, base.h, base.ch]).toEqual([800, 920, 4]);
    let cleared = 0;
    let raised = 0;
    let recolored = 0;
    for (let i = 0; i < orig.px.length; i += 4) {
      const oa = orig.px[i + 3] as number;
      const ba = base.px[i + 3] as number;
      if (ba > oa) raised++;
      if (ba > 0 && (base.px[i] !== orig.px[i] || base.px[i + 1] !== orig.px[i + 1] || base.px[i + 2] !== orig.px[i + 2])) recolored++;
      if (oa > 0 && ba === 0) cleared++;
    }
    expect(raised).toBe(0);
    expect(recolored).toBe(0);
    // 消したのは市松模様と、枠の外縁の外の粒の分だけ（全体の不透明な画素のおよそ1割）
    expect(cleared).toBeGreaterThan(10000);
    expect(cleared).toBeLessThan(30000);
  }, 30000);

  it('ソラモの枠（クリーム）は、色だけを変えた枠（透明度は市松を消した枠と同じ）', () => {
    const base = decodePng('assets/images/ui/battlecard/frame_base.png');
    const soramo = decodePng('assets/images/ui/battlecard/frame_soramo.png');
    let tinted = 0;
    let alphaDiff = 0;
    for (let i = 0; i < base.px.length; i += 4) {
      if (soramo.px[i + 3] !== base.px[i + 3]) alphaDiff++;
      if (base.px[i + 3] && (soramo.px[i] !== base.px[i] || soramo.px[i + 2] !== base.px[i + 2])) tinted++;
    }
    expect(alphaDiff).toBe(0);
    expect(tinted).toBeGreaterThan(50000);
  }, 30000);

  it('ソラモは縮める割合 0.84 で、耳・しっぽ・足先が枠の不透明な所にほぼ隠れない', () => {
    const spec = battleCardOf(SORAMO_MONSTER_ID);
    expect(spec).toEqual({ art: 'soramo_battlecard.png', frame: 'soramo', scale: 0.84, offsetY: 0.016 });
    const art = decodePng('assets/images/cards/monsters/soramo_battlecard.png');
    const frame = decodePng('assets/images/ui/battlecard/frame_base.png');
    const s = spec?.scale ?? 1;
    const ox = ((1 - s) / 2) * 800;
    const oy = ((1 - s) / 2) * 920 + (spec?.offsetY ?? 0) * 920;
    let body = 0;
    let covered = 0;
    for (let y = 0; y < 920; y += 2) {
      for (let x = 0; x < 800; x += 2) {
        if ((art.px[(y * 800 + x) * 4 + 3] as number) < 200) continue;
        body++;
        const fx = Math.round(ox + x * s);
        const fy = Math.round(oy + y * s);
        if ((frame.px[(fy * 800 + fx) * 4 + 3] as number) > 200) covered++;
      }
    }
    expect(body).toBeGreaterThan(20000);
    // 枠の金の流れの先がわずかに重なるだけ（0.5% 未満）
    expect(covered / body).toBeLessThan(0.005);
  }, 30000);

  it('バトル用カードは、いまはソラモだけ（ほかのモンスターへは承認後）', () => {
    expect(Object.keys(BATTLE_CARDS)).toEqual([SORAMO_MONSTER_ID]);
    expect(MONSTERS.some((m) => m.id === SORAMO_MONSTER_ID)).toBe(true);
  });
});

describe('数値の欄のきまり（2026-10-25：特殊は「効果」・回避は「回避」・防御は盾と軽減値・攻撃はダメージ）', () => {
  it('ソラモ・ノビトン・ミュロルの技で、種類ごとに同じきまり。特殊に数値（0）を出さない', async () => {
    const { getSkill, SKILLS } = await import('../src/data/cards.ts');
    const { skillValueBadge, skillValueBadgeText } = await import('../src/game/cards/cardFace.ts');
    const { skillCategory } = await import('../src/game/cards/cardTypes.ts');
    const { setLanguage } = await import('../src/i18n/i18n.ts');
    setLanguage('ja');
    for (const s of SKILLS.filter((x) => !x.isPlaceholder)) {
      const b = skillValueBadge(s);
      const cat = skillCategory(s);
      if (cat === 'force' || cat === 'wisdom') expect(b).toEqual({ kind: 'damage', value: s.stat?.value });
      else if (cat === 'defense') expect(b.kind).toBe('guard');
      else if (cat === 'evade') expect(skillValueBadgeText(b)).toBe('回避');
      else expect(skillValueBadgeText(b)).toBe('効果');
    }
    // ソラモのすなかけ（特殊）・まるまる（防御 -3）
    expect(skillValueBadgeText(skillValueBadge(getSkill('skl-soramo-08')))).toBe('効果');
    expect(skillValueBadgeText(skillValueBadge(getSkill('skl-soramo-11')))).toBe('-3');
    setLanguage('en');
    expect(skillValueBadgeText(skillValueBadge(getSkill('skl-soramo-08')))).toBe('Effect');
    setLanguage('ja');
  });
});
