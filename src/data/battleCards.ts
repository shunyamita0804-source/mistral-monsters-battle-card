import { SORAMO_MONSTER_ID } from './soramo.ts';

/**
 * バトル用カード（800×920・横:縦＝1:1.15。2026-10-25 正式素材）。
 * 対戦中の場のモンスターはこのカードで見せる（2026-10-25 ユーザー指示「ずっと出ているカードが新しいデザインの方。タップすると正式絵」）。
 * タップしたときの窓は正式カードの絵（monster.art。名前・LIFE 入り）。
 *
 * 重ね順（下から）：全モンスター共通の背景 → モンスターの透過 PNG → モンスターの色の枠 → 名前・ライフ（ゲームが描く）。
 * - 背景：assets/images/backgrounds/battlecard_bg_common.png（共通。届いたものを無改変）
 * - 枠：assets/images/ui/battlecard/frame_{色の名前}.png（tools/art/battle_card_frame.py が、正式採用の枠から市松模様だけ透明にし、
 *   色替えマスクの所の色味をモンスターの色にして作る。原本は design-parts/cards-original/soramo-battle-20261025/）
 * - scale：モンスターの絵（800×920 の配置用）をカードに対して縮める割合。耳・しっぽ・足先が枠に隠れない大きさ。
 *   モンスターごとに決め、体の大小の差はこの値で残す（全部を同じ大きさにそろえない）
 * - offsetY：上下のずらし（カードの高さに対する割合。＋で下へ）
 * まだソラモだけ（ほかのモンスターへは承認後に広げる）
 */
export interface BattleCardSpec {
  /** モンスターの透過 PNG（assets/images/cards/monsters/） */
  readonly art: string;
  /** 枠の色の名前（frame_{frame}.png） */
  readonly frame: string;
  readonly scale: number;
  readonly offsetY: number;
}

export const BATTLE_CARDS: Readonly<Record<string, BattleCardSpec>> = {
  // ソラモ：枠はクリーム（#E4D2AC）。0.84 で耳の先・しっぽ・足先が枠の飾りに重ならない
  [SORAMO_MONSTER_ID]: { art: 'soramo_battlecard.png', frame: 'soramo', scale: 0.84, offsetY: 0.016 },
};

export function battleCardOf(monsterId: string): BattleCardSpec | undefined {
  return BATTLE_CARDS[monsterId];
}
