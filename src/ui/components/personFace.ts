import guideFace from '@assets/images/characters/neighbor_guide_talk_normal.webp';
import clerkFace from '@assets/images/characters/face_clerk.webp';
import researcherFace from '@assets/images/characters/face_researcher.webp';
import receptionistFace from '@assets/images/characters/face_receptionist.webp';
import eleanorFace from '@assets/images/characters/face_eleanor.webp';
import ernstFace from '@assets/images/characters/face_ernst.webp';
import faceDolf from '@assets/images/characters/face_regular_dolf.webp';
import faceLeonard from '@assets/images/characters/face_regular_leonard.webp';
import faceGreta from '@assets/images/characters/face_regular_greta.webp';
import faceJulius from '@assets/images/characters/face_regular_julius.webp';
import faceCamilla from '@assets/images/characters/face_regular_camilla.webp';
import faceAlvin from '@assets/images/characters/face_regular_alvin.webp';
import teacherFace from '@assets/images/characters/face_teacher.webp';
import residentA from '@assets/images/characters/face_resident_a.webp';
import residentB from '@assets/images/characters/face_resident_b.webp';
import residentC from '@assets/images/characters/face_resident_c.webp';
import residentD from '@assets/images/characters/face_resident_d.webp';
import residentE from '@assets/images/characters/face_resident_e.webp';
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
import type { Person } from '../../data/people.ts';
import { h } from '../dom.ts';

/**
 * 人物の顔の絵（名刺図鑑）。2026-10-27 に管理局の職員・常連6人・エルンストの顔が届き、28人すべてそろった。
 * 顔の絵が無いとき（見えない番人など）は仮の人影（CSS の .person-face--none）
 */
const PERSON_FACES: Readonly<Record<string, string>> = {
  // ミレイユ：顔の絵（正方形）は無いので、会話の絵（胸から上）を上の方で切り抜いて使う
  mireille: guideFace,
  nina: clerkFace,
  lucas: researcherFace,
  celia: receptionistFace,
  // 2026-10-27 に届いた顔（ZIP「人物・図鑑・研究所16枚」）：エレノア・常連6人・エルンスト
  eleanor: eleanorFace,
  gareth: teacherFace,
  martha: residentA,
  pete: residentB,
  bruno: residentC,
  rosalie: residentD,
  harold: residentE,
  noel: faceE1,
  viktor: faceE2,
  sienna: faceE3,
  dario: faceD1,
  isabella: faceD2,
  gordon: faceD3,
  flora: faceBattler1,
  oscar: faceBattler2,
  kyle: faceBattler3,
  guardian: faceGuardian,
  dolf: faceDolf,
  leonard: faceLeonard,
  greta: faceGreta,
  julius: faceJulius,
  camilla: faceCamilla,
  alvin: faceAlvin,
  ernst: ernstFace,
};

export function personFaceUrl(person: Person): string | undefined {
  return PERSON_FACES[person.id];
}

/** 顔の絵（無ければ仮の人影）。unknown＝まだ会っていない人（人影） */
export function personFace(person: Person | null, unknown = false): HTMLElement {
  const url = person && !unknown ? personFaceUrl(person) : undefined;
  if (!url) {
    return h(
      'span',
      { class: 'person-face person-face--none', attrs: { 'aria-hidden': 'true' } },
      h('span', { class: 'person-face__head' }),
      h('span', { class: 'person-face__body' }),
    );
  }
  return h(
    'span',
    { class: `person-face${person?.id === 'mireille' ? ' person-face--portrait' : ''}`, attrs: { 'aria-hidden': 'true' } },
    h('img', { class: 'person-face__img', attrs: { src: url, alt: '', draggable: 'false', decoding: 'async' } }),
  );
}
