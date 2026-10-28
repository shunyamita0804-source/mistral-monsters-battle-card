import { battleCardOf } from '../../data/battleCards.ts';
import { cardCatalog } from '../../data/cards.ts';
import type { GachaSeries } from '../../data/economy.ts';
import { resolveCardArt } from '../cardArtSources.ts';
import packSealedArt from '@assets/images/ui/gacha/pack_sealed.webp';

/**
 * ガチャの絵（2026-10-28）。シリーズのパックは assets/images/ui/gacha/pack_{シリーズID}.webp（tools/design/gacha_series_build.py）。
 * 絵が無いシリーズは無地のパック（pack_sealed）
 */
const PACK_URLS = import.meta.glob<string>('/assets/images/ui/gacha/pack_*.webp', { eager: true, query: '?url', import: 'default' });

export function seriesPackUrl(series: GachaSeries): string {
  return PACK_URLS[`/assets/images/ui/gacha/pack_${series.id}.webp`] ?? packSealedArt;
}

/** ラインナップの小さな枠に出す絵（技はイラスト、モンスターはバトル用カードの絵） */
export function cardThumbUrl(cardId: string): string | undefined {
  const card = cardCatalog.get(cardId);
  if (!card) return undefined;
  if (card.kind === 'monster') {
    const spec = battleCardOf(card.id);
    return spec ? resolveCardArt({ category: 'monsterCards', file: spec.art, layout: 'full' }) : resolveCardArt(card.art);
  }
  return resolveCardArt(card.art);
}
