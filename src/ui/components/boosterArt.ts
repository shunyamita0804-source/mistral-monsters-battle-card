import tabidachi from '@assets/images/ui/booster/booster_tabidachi.png';
import rekka from '@assets/images/ui/booster/booster_rekka.png';
import soukai from '@assets/images/ui/booster/booster_soukai.png';
import type { BoosterDefinition } from '../../data/introV2.ts';

/**
 * ブースターパックの箱の絵（2026-10-27 ユーザー承認の正式デザイン。3箱集合の絵から切り出しただけで描き直していない）。
 * 原本は design-parts/booster-boxes-20261027/（チャットで届いた透明の3箱集合と、指示書 ZIP の JPEG）。差し替えるときはこの3つのファイル
 */
const BOOSTER_ART: Readonly<Record<BoosterDefinition['art'], string>> = {
  booster_tabidachi: tabidachi,
  booster_rekka: rekka,
  booster_soukai: soukai,
};

export function boosterArtUrl(booster: BoosterDefinition): string {
  return BOOSTER_ART[booster.art];
}
