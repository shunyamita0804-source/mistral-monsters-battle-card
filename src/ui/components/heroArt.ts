import type { Gender } from '../../game/save/saveData.ts';
import heroMale from '@assets/images/characters/hero_male.webp';
import heroFemale from '@assets/images/characters/hero_female.webp';
import faceMale from '@assets/images/characters/face_hero_male.webp';
import faceFemale from '@assets/images/characters/face_hero_female.webp';
import maleWin from '@assets/images/characters/hero_male_win.webp';
import maleLose from '@assets/images/characters/hero_male_lose.webp';
import femaleWin from '@assets/images/characters/hero_female_win.webp';
import femaleLose from '@assets/images/characters/hero_female_lose.webp';

/**
 * 主人公の立ち絵と顔（2026-10-26 デザイン第8弾。原本 design-parts/ui-quality8-20261026/hero_{male,female}.png、切り出し tools/design/ui8_build.py）。
 * 立ち絵＝主人公を選ぶ画面、顔＝対戦の始まりの名札の丸い窓。性別が決まっていないとき（古いセーブ）は男性の絵
 */
export function heroArtUrl(gender: Gender | null): string {
  return gender === 'female' ? heroFemale : heroMale;
}

export function heroFaceUrl(gender: Gender | null): string {
  return gender === 'female' ? faceFemale : faceMale;
}

/** 対戦の結果の主人公（2026-10-27 デザイン第13弾。ひざから上の勝ち・負けの姿。原本 design-parts/ui-quality13-20261027/hero_{male,female}_result.png） */
export function heroResultUrl(gender: Gender | null, won: boolean): string {
  if (gender === 'female') return won ? femaleWin : femaleLose;
  return won ? maleWin : maleLose;
}
