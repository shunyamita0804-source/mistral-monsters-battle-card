import standPia from '@assets/images/characters/stand_battler_water_pia.webp';
import standHans from '@assets/images/characters/stand_battler_ice_hans.webp';
import standZack from '@assets/images/characters/stand_battler_fire_zack.webp';
import standOtto from '@assets/images/characters/stand_battler_machine_otto.webp';
import standMina from '@assets/images/characters/stand_battler_holy_mina.webp';
import standNiko from '@assets/images/characters/stand_battler_wind.webp';
import { opponentFaceUrl } from './opponentFace.ts';
import { h } from '../dom.ts';

/**
 * 新しいダンジョンのバトラー6人（2026-10-30 に風の渓谷のニコを足した）の立ち姿（地図の上の小さな姿。2026-10-28 指示書「ダンジョンの人物12人」）。
 * キーは顔のキー（src/data/dungeonRun.ts の runBattlerFace）。今の3人（battler-1〜3）は CSS（uiParts12.css の drun__entity--b1〜3）。
 * 守り手7人の立ち姿（stand_guardian_*.webp）も作ってあるが、地図の上のボスのしるしは今のまま（指示書）なので、いまは使っていない
 */
const BATTLER_STANDS: Readonly<Record<string, string>> = {
  'battler-pia': standPia,
  'battler-hans': standHans,
  'battler-zack': standZack,
  'battler-otto': standOtto,
  'battler-mina': standMina,
  // 2026-10-30 指示書 U：風の渓谷のニコ
  'battler-niko': standNiko,
};

export function battlerStandUrl(face: string): string | undefined {
  return BATTLER_STANDS[face];
}

/** 会話の窓に出す顔（対戦のひと言と同じ金とえんじの枠。uiParts12.css の battle__talk-frame） */
export function talkFaceVisual(faceKey: string): HTMLElement | undefined {
  const url = opponentFaceUrl(faceKey);
  if (!url) return undefined;
  return h(
    'div',
    { class: 'drun__talk-visual' },
    h('span', { class: 'battle__talk-frame' }, h('img', { class: 'battle__talk-face', attrs: { src: url, alt: '', draggable: 'false' } })),
  );
}
