/**
 * 技の絵の横の位置（2026-10-29 ユーザー指示「大きなカードで絵が切れる技を、絵の左右の位置をずらして直す。描き直しはしない」）。
 * 技カードの窓は絵より横に細いので、絵の左右がはみ出して切れる。その見せる所を技ごとに決める（CSS の object-position の x）。
 * 0＝左いっぱい・50＝真ん中（決めていない技はこれ）・100＝右いっぱい。大きなカード・手札・ガチャ・図鑑など、技の絵が出る所すべてで同じ値を使う
 * （skillCard.ts の artLayer・gachaMachine.ts のラインナップの枠）
 */
export const SKILL_ART_X: Readonly<Record<string, number>> = {
  // ソラモ 04 しっぽアタック
  'skl-soramo14-04': 100,
  // カルシェル 02 シェルタックル
  'skl-kalshell-02': 75,
  // カルシェル 13 てっぺきシェル
  'skl-kalshell-13': 40,
  // 2026-10-29 点検の一覧の12枚（案の値のままユーザーが決めた）
  // ソラモ 09 すなかけ
  'skl-soramo14-09': 60,
  // ガウル 14 高速飛行
  'skl-gauul14-14': 100,
  // ノビトン 01 はなビンタ・03 まきつく・05 くしゃみ・09 不思議な嗅覚
  'skl-nobiton-01': 65,
  'skl-nobiton-03': 60,
  'skl-nobiton-05': 75,
  'skl-nobiton-09': 60,
  // ミュロル 07 アクアボール
  'skl-myurol-07': 65,
  // プカリム 03 ころがる・05 とっぷう・10 おいかぜ
  'skl-pukarim-03': 70,
  'skl-pukarim-05': 75,
  'skl-pukarim-10': 70,
  // ジオル 06 グランドハンマー・09 じならし
  'skl-geol-06': 65,
  'skl-geol-09': 100,
};

/** 技の絵の横の位置（%）。決めていない技は 50（真ん中） */
export function skillArtX(skillId: string): number {
  return SKILL_ART_X[skillId] ?? 50;
}
