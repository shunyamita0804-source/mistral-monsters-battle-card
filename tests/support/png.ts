import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/** 8bit・インターレースなしの PNG（RGB / RGBA）を読む（テスト用の最小限。tests/soramoBattleCard.test.ts と同じもの。2026-11-05 指示書 AX で分けた） */
export function decodePng(path: string): { w: number; h: number; ch: number; px: Uint8Array } {
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

/** 透明度が 0 と 255 のあいだ（半透明）の画素の割合 */
export function halfAlphaRatio(path: string): number {
  const { w, h, ch, px } = decodePng(path);
  if (ch !== 4) return 0;
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if ((px[i] as number) > 0 && (px[i] as number) < 255) n++;
  return n / (w * h);
}
