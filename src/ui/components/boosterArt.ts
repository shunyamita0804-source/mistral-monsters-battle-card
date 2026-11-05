import tabidachi from '@assets/images/ui/booster/booster_tabidachi.png';
import rekka from '@assets/images/ui/booster/booster_rekka.png';
import soukai from '@assets/images/ui/booster/booster_soukai.png';
import tabidachiEn from '@assets/images/ui/booster/booster_tabidachi_en.png';
import rekkaEn from '@assets/images/ui/booster/booster_rekka_en.png';
import soukaiEn from '@assets/images/ui/booster/booster_soukai_en.png';
import type { BoosterDefinition } from '../../data/introV2.ts';
import { getLanguage } from '../../i18n/i18n.ts';

/**
 * ブースターパックの箱の絵。2026-11-02 指示書 AR で、今の中身（旅立ち＝ソラモ・リリル・ノビトン／烈火＝ガウル・ラズック・ツムジ／
 * 蒼海＝ミュロル・カルシェル・フォルン）の新しい箱絵に差し替えた。原本は design-parts/booster-boxes-20261102/box_{tabidachi,rekka,soukai}.png（1060×1750・無改変）。
 * ゲームの絵は、原本のまわりの透明な所だけを切り（箱の絵は変えない）、半分の大きさ（幅 500）に縮めたもの（表示はいちばん大きい所で幅 120px なので、iPhone でもぼやけない）。
 * 前の絵（2026-10-27。3箱集合から切り出し）の原本は design-parts/booster-boxes-20261027/。差し替えるときはこの3つのファイル
 * 2026-11-05 指示書 BE：英語で遊ぶときは英語の箱の絵（文字の所だけ英語。同じ大きさ。原本 design-parts/booster-boxes-20261105-en/）
 */
const BOOSTER_ART: Readonly<Record<BoosterDefinition['art'], string>> = {
  booster_tabidachi: tabidachi,
  booster_rekka: rekka,
  booster_soukai: soukai,
};

const BOOSTER_ART_EN: Readonly<Record<BoosterDefinition['art'], string>> = {
  booster_tabidachi: tabidachiEn,
  booster_rekka: rekkaEn,
  booster_soukai: soukaiEn,
};

/** 箱の絵（英語のときは英語の箱） */
export function boosterArtUrl(booster: BoosterDefinition): string {
  return (getLanguage() === 'en' ? BOOSTER_ART_EN : BOOSTER_ART)[booster.art];
}
