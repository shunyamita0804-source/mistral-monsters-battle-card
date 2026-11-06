import { GAUUL_MONSTER_ID } from './gauul.ts';
import { LAZUCK_MONSTER_ID } from './lazuck.ts';
import { KALSHELL_MONSTER_ID } from './kalshell.ts';
import { PUKARIM_MONSTER_ID } from './pukarim.ts';
import { GEOL_MONSTER_ID } from './geol.ts';
import { FLUNE_MONSTER_ID } from './flune.ts';
import { SEREPHINE_MONSTER_ID } from './serephine.ts';
import { TSUMUJI_MONSTER_ID } from './tsumuji.ts';
import { HYOUZUKU_MONSTER_ID } from './hyouzuku.ts';
import { SHISHIEN_MONSTER_ID } from './shishien.ts';
import { HAKURAN_MONSTER_ID } from './hakuran.ts';
import { DESUORU_MONSTER_ID } from './desuoru.ts';
import { LILIL_MONSTER_ID } from './lilil.ts';
import { FORN_MONSTER_ID } from './forn.ts';
import { UZURIO_MONSTER_ID } from './uzurio.ts';
import { TYRANT_MONSTER_ID } from './tyrant.ts';
import { KUYO_MONSTER_ID } from './kuyo.ts';
import { KUROSHIO_MONSTER_ID } from './kuroshio.ts';
import { ROUGA_MONSTER_ID } from './rouga.ts';
import { HUGINN_MONSTER_ID } from './huginn.ts';
import { RADIEL_MONSTER_ID } from './radiel.ts';
import { GEAROS_MONSTER_ID } from './gearos.ts';
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
  // ミュロル（2026-10-27）：枠は水色（#84E5FA。ユーザー確定「水色」・src/data/myurol.ts の MYUROL_COLOR）。絵は届いた MONSTER/Myurol_Battle_800x920_RGBA.png を無改変。
  // 2026-10-31 指示書 AC【3】：足4本・えら片側3本の描き直し（design-parts/cards-original/myurol-official-20261031/myurol_battlecard.png。同じ 800×920・同じポーズ）に差し替え
  [MYUROL_MONSTER_ID]: { art: 'myurol_battlecard.png', frame: 'myurol', scale: 0.86, offsetY: 0.0 },
  // カルシェル（2026-10-27）：枠は淡い氷色（#DFF2F6。src/data/kalshell.ts の KALSHELL_COLOR）。絵は届いた BattleArt/Kalshell_BattleArt_Transparent_Approved.png（1169×1345）を無改変
  // 0.8・少し上へ：絵がキャンバスいっぱいに描かれている（ノビトンと同じくらい）ので、ハサミ・脚が枠の飾りと名前の札に隠れない大きさ
  [KALSHELL_MONSTER_ID]: { art: 'kalshell_battlecard.png', frame: 'kalshell', scale: 0.8, offsetY: -0.02 },
  // プカリム（2026-10-28 試遊中）：枠はミント（#A8DCC4）。絵は届いた art/pukarim_battleart.png（1169×1345。カルシェルと同じ大きさ・縦横比）を無改変
  [PUKARIM_MONSTER_ID]: { art: 'pukarim_battlecard.png', frame: 'pukarim', scale: 0.8, offsetY: -0.02 },
  // ジオル（2026-10-29 試遊中）：枠は岩の茶（#9A7B5C）。絵は届いた geol_battleart.png（1169×1345。プカリムと同じ大きさ・縦横比）を無改変
  [GEOL_MONSTER_ID]: { art: 'geol_battlecard.png', frame: 'geol', scale: 0.8, offsetY: -0.02 },
  // フルーネ（2026-10-29）：枠は若葉色（#9CBF5A）。絵は届いた flune_battleart.png（1169×1346。ジオルとほぼ同じ大きさ・縦横比）を無改変
  [FLUNE_MONSTER_ID]: { art: 'flune_battlecard.png', frame: 'flune', scale: 0.8, offsetY: -0.02 },
  // セレフィーン（2026-10-29）：枠は月の青紫（#8FA6E8）。絵は届いた serephine_battleart.png（1169×1345。フルーネと同じ大きさ・縦横比）を無改変
  [SEREPHINE_MONSTER_ID]: { art: 'serephine_battlecard.png', frame: 'serephine', scale: 0.8, offsetY: -0.02 },
  // ツムジ（2026-10-30 指示書 U）：枠はくすんだ青みの灰（#8FA3B8）。絵は届いた tsumuji_battleart.png（1169×1346。セレフィーンと同じ大きさ・縦横比）を無改変
  [TSUMUJI_MONSTER_ID]: { art: 'tsumuji_battlecard.png', frame: 'tsumuji', scale: 0.8, offsetY: -0.02 },
  // ヒョウズク（2026-10-30 指示書 W）：枠は銀に近い白（#C8CCD4）。絵は届いた hyouzuku_battleart.png（1169×1346。ツムジと同じ大きさ・縦横比）を無改変
  [HYOUZUKU_MONSTER_ID]: { art: 'hyouzuku_battlecard.png', frame: 'hyouzuku', scale: 0.8, offsetY: -0.02 },
  // シシエン（2026-10-31 指示書 AB）：枠は炭色（#3E3A3F）。絵は届いた shishien_battleart.png（1169×1346。ヒョウズクと同じ大きさ・縦横比）を無改変
  [SHISHIEN_MONSTER_ID]: { art: 'shishien_battlecard.png', frame: 'shishien', scale: 0.8, offsetY: -0.02 },
  // ハクラン（2026-10-31 指示書 AF）：枠は青緑（ティール。#237C7A）。絵は届いた hakuran_battleart.png（1169×1346。シシエンと同じ大きさ・縦横比）を無改変
  [HAKURAN_MONSTER_ID]: { art: 'hakuran_battlecard.png', frame: 'hakuran', scale: 0.8, offsetY: -0.02 },
  // デスオル（2026-10-31 指示書 AG）：枠は紺（#1E2B58。暗い色のしかた）。絵は届いた desuoru_battleart.png（1169×1346 透過）を無改変
  [DESUORU_MONSTER_ID]: { art: 'desuoru_battlecard.png', frame: 'desuoru', scale: 0.8, offsetY: -0.02 },
  // リリル（2026-11-02 指示書 AK）：枠はやわらかいローズピンク（#EE8FB6）。絵は届いた lilil_battleart.png（1170×1344 透過。800:920 と同じ縦横比）を無改変。
  // 4枚の羽が絵の幅いっぱいまで広がるので、羽の先が枠に切られず、体が小さくなりすぎない大きさ
  [LILIL_MONSTER_ID]: { art: 'lilil_battlecard.png', frame: 'lilil', scale: 0.8, offsetY: -0.01 },
  // フォルン（2026-11-02 指示書 AL）：枠は濃いオリーブ（#7A8B3C）。絵は届いた forn_battleart.png（800×920 透過）を無改変。角の先と笛が切れない大きさ
  [FORN_MONSTER_ID]: { art: 'forn_battlecard.png', frame: 'forn', scale: 0.9, offsetY: 0.01 },
  // ウズリオ（2026-11-02 指示書 AQ）：枠ははっきりした空色（#3D8FD6）。絵は届いた uzurio_battleart.png（1169×1345 透過）を無改変。
  // 頭の大きな渦の毛（絵の上の端まで）と、しっぽの先（絵の左の端まで）が枠に切られない大きさ
  [UZURIO_MONSTER_ID]: { art: 'uzurio_battlecard.png', frame: 'uzurio', scale: 0.8, offsetY: 0 },
  // タイラント（2026-11-05 指示書 AX）：枠は真っ赤（#A31523）。絵は届いた tyrant_battle_transparent.png（800×920）の透明度を 0／255 にそろえたもの。
  // 翼と角が枠の飾りに隠れない大きさ
  [TYRANT_MONSTER_ID]: { art: 'tyrant_battlecard.png', frame: 'tyrant', scale: 0.86, offsetY: 0.01 },
  // ギアロス（2026-11-05 指示書 AX）：枠は赤銅（#945247。今の絵の枠のまま）。絵は届いた gearos_battle_transparent.png（800×920）の透明度を 0／255 にそろえたもの
  [GEAROS_MONSTER_ID]: { art: 'gearos_battlecard.png', frame: 'gearos', scale: 0.86, offsetY: 0 },
  // クヨウ（2026-11-05 指示書 BH）：枠は霧の藤ねず（#87649C。カードの絵の枠の色）。絵は届いた kuyo_battlecard.png（1169×1346 透過）を無改変（毛先の半透明はそのまま）。ハクランと同じ大きさ・縦横比
  [KUYO_MONSTER_ID]: { art: 'kuyo_battlecard.png', frame: 'kuyo', scale: 0.8, offsetY: -0.02 },
  // クロシオ（2026-11-06 指示書 BK）：枠は珊瑚（#F08A78）。絵は届いた透過 PNG（1169×1345）の透明度を 0／255 にそろえたもの（色は変えていない）。クヨウと同じ大きさ
  [KUROSHIO_MONSTER_ID]: { art: 'kuroshio_battlecard.png', frame: 'kuroshio', scale: 0.8, offsetY: -0.02 },
  // ロウガ（2026-11-06 指示書 BL）：枠は淡い藤色（#B7A3DA）。絵は透明度を 0／255 にそろえたもの（色は変えていない）
  [ROUGA_MONSTER_ID]: { art: 'rouga_battlecard.png', frame: 'rouga', scale: 0.8, offsetY: -0.02 },
  // フギン（2026-11-06 指示書 BM）：枠は深い暗めの青緑（#1F5C58）。絵は透明度を 0／255 にそろえたもの（色は変えていない）
  [HUGINN_MONSTER_ID]: { art: 'huginn_battlecard.png', frame: 'huginn', scale: 0.8, offsetY: -0.02 },
  // ラディエル（2026-11-05 指示書 BI）：枠は金（#BE7410。カードの絵の枠の色）。絵は届いた radiel_battlecard.png（1169×1346 透過）を無改変（光輪と光の尾の半透明はそのまま）。
  // 翼が絵の幅いっぱいまで広がるので、翼の先が枠の飾りに切られすぎない大きさ
  [RADIEL_MONSTER_ID]: { art: 'radiel_battlecard.png', frame: 'radiel', scale: 0.82, offsetY: -0.01 },
  // ガウル（2026-10-27）：枠はオレンジ（#E68A46。技カードの枠と同じ色）。絵はユーザーがチャットで届けた背景なしの絵（1169×1345・透明）を無改変
  // （原本 design-parts/cards-original/gauul-battle-20261027/）。0.9：翼の先と舞う羽根が枠の飾りに少しかかるくらい（体・顔・足の爪は隠れない）
  [GAUUL_MONSTER_ID]: { art: 'gauul_battlecard.png', frame: 'gauul', scale: 0.9, offsetY: 0 },
};

export function battleCardOf(monsterId: string): BattleCardSpec | undefined {
  return BATTLE_CARDS[monsterId];
}
