import faceE1 from '@assets/images/characters/face_opponent_e1.webp';
import faceE2 from '@assets/images/characters/face_opponent_e2.webp';
import faceE3 from '@assets/images/characters/face_opponent_e3.webp';
import faceD1 from '@assets/images/characters/face_opponent_d1.webp';
import faceD2 from '@assets/images/characters/face_opponent_d2.webp';
import faceD3 from '@assets/images/characters/face_opponent_d3.webp';
import faceBattler1 from '@assets/images/characters/face_battler_1.webp';
import faceBattler2 from '@assets/images/characters/face_battler_2.webp';
import faceBattler3 from '@assets/images/characters/face_battler_3.webp';
import faceGuardian from '@assets/images/characters/face_guardian.webp';
import faceTeacher from '@assets/images/characters/face_teacher.webp';
import type { OpponentDefinition } from '../../data/tournaments.ts';
import { h } from '../dom.ts';

/**
 * 大会の対戦相手の顔の絵（2026-10-23 第5弾。人物像は Claude の仮の案・名前は未定）。
 * キーは大会の相手の ID（src/data/tournaments.ts の rounds）か、相手の定義の face。
 * 2026-10-27 デザイン第12弾：ランダム生成のダンジョンのバトラー3人と見えない番人（人物像は Claude の仮の案・名前は未定）。
 * 固定のダンジョンの魔物・ボスには顔の絵はない
 */
const OPPONENT_FACES: Readonly<Record<string, string>> = {
  'e-1': faceE1,
  'e-2': faceE2,
  'e-3': faceE3,
  'd-1': faceD1,
  'd-2': faceD2,
  'd-3': faceD3,
  'battler-1': faceBattler1,
  'battler-2': faceBattler2,
  'battler-3': faceBattler3,
  guardian: faceGuardian,
  // 導入イベントV2の試験の相手（練習場の先生。2026-10-23 に届いた先生の顔の絵）
  teacher: faceTeacher,
};

/** 相手の顔の絵を探すときのキー（face があればそれ、無ければ ID） */
export function faceKeyOf(opponent: Pick<OpponentDefinition, 'id' | 'face'>): string {
  return opponent.face ?? opponent.id;
}

export function opponentFaceUrl(opponentId: string): string | undefined {
  return OPPONENT_FACES[opponentId];
}

/** 顔の絵の小さな丸（絵が無い相手は null） */
export function opponentFace(opponentId: string, size: number): HTMLElement | null {
  const url = OPPONENT_FACES[opponentId];
  if (!url) return null;
  const el = h('img', { class: 'opponent-face', attrs: { src: url, alt: '', draggable: 'false' } });
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  return el;
}
