import { LAZUCK_MONSTER_ID } from './lazuck.ts';
import { MYUROL_MONSTER_ID } from './myurol.ts';
import { NOBITON_MONSTER_ID } from './nobiton.ts';
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
 * ソラモ（2026-10-25）・ラズック（2026-10-26）・ノビトン（2026-10-26）・ミュロル（2026-10-27）。ほかのモンスターは素材が届いてから
 * - モンスターの絵が 800×920 と違う縦横比のとき（ノビトン）は、縦横比を保ったままカードの中に収める（引き伸ばさない。cards.css の object-fit）
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
  // ラズック（2026-10-26）：枠は紫（#844DC5。届いた 06_Razuk_PurpleAccent の色）。絵は届いた 02_Razuk_Battle_800x920_RGBA.png を無改変。
  // 0.94：届いた確認用の重ね絵（07_Razuk_BattleCard_Preview）に近い大きさで、しっぽ・足先が枠に隠れない
  [LAZUCK_MONSTER_ID]: { art: 'lazuck_battlecard.png', frame: 'lazuck', scale: 0.94, offsetY: 0.01 },
  // ノビトン（2026-10-26）：枠は黄色（#FFD400。ユーザー指示「外枠は黄色」）。絵はチャットで届いた正式原画（1179×1334・透明つき）を無改変。
  // 0.8・少し上へ：鼻先・しっぽ・足先が枠の飾りと名前の札に隠れない大きさ
  [NOBITON_MONSTER_ID]: { art: 'nobiton_battlecard.png', frame: 'nobiton', scale: 0.8, offsetY: -0.025 },
  // ミュロル（2026-10-27）：枠は水色（#84E5FA。ユーザー確定「水色」・src/data/myurol.ts の MYUROL_COLOR）。絵は届いた MONSTER/Myurol_Battle_800x920_RGBA.png を無改変
  [MYUROL_MONSTER_ID]: { art: 'myurol_battlecard.png', frame: 'myurol', scale: 0.86, offsetY: 0.0 },
};

export function battleCardOf(monsterId: string): BattleCardSpec | undefined {
  return BATTLE_CARDS[monsterId];
}
