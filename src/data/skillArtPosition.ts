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
};

/** 技の絵の横の位置（%）。決めていない技は 50（真ん中） */
export function skillArtX(skillId: string): number {
  return SKILL_ART_X[skillId] ?? 50;
}
