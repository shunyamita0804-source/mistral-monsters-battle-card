/**
 * 状態・居場所・場のアイコン（2026-11-05 指示書 AZ。原本 design-parts/status-icons-20261105/〔256×256・数字の札は 128×128〕を
 * 96×96〔数字の札は高さ 48〕の WebP にした assets/images/ui/status/icon_*.webp）。対応表は原本の effect_icon_map.csv
 * - b02 ちからダウン・b03 かしこさアップ・b04 かしこさダウン・b05 防御アップ・b09 攻撃アップ（剣）・b13 マナダウン
 * - s07 行動不能（鎖）・s08 攻撃不可・s09 回避不可・s12 攻撃対象にならない・s13 ちょうはつ（ねらわれる）
 * - e01 回避されない・e02 防御されない・e05 ちから技を軽減・e06 かしこさ技を軽減
 * - t01 地上・t02 空中・t03 水中・n01 効果量の札・n02 残りターンの札
 * - b01・b07・s10・e03・e04 は、写真で比べる・技カードの効果の案（指示書 AZ【4】）に使う
 * - 2026-11-05 指示書 BB：技カードの効果に b11 回復・e13 場の効果・e15 回避・e17 手札が減る・e18 見る・e21 引く／入れかえる・e24 反動、
 *   小さな印 m01 味方に（64×64）を足した（原本 design-parts/effect-icons-20261105/・status-icons-20261105/）
 */
const URLS = import.meta.glob<string>('/assets/images/ui/status/icon_*.webp', { eager: true, query: '?url', import: 'default' });

export type StatusIconId =
  | 'b01' | 'b02' | 'b03' | 'b04' | 'b05' | 'b07' | 'b09' | 'b11' | 'b13'
  | 's07' | 's08' | 's09' | 's10' | 's12' | 's13'
  | 'e01' | 'e02' | 'e03' | 'e04' | 'e05' | 'e06' | 'e13' | 'e15' | 'e17' | 'e18' | 'e21' | 'e24' | 'm01'
  | 't01' | 't02' | 't03' | 'n01' | 'n02';

export function statusIconUrl(id: StatusIconId): string {
  const url = URLS[`/assets/images/ui/status/icon_${id}.webp`];
  if (!url) throw new Error(`状態のアイコンがありません: ${id}`);
  return url;
}
