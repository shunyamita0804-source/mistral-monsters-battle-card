import type { Rarity } from '../../game/cards/cardTypes.ts';
import { rarityLabel } from '../../game/cards/cardTypes.ts';
import { h } from '../dom.ts';
import rarityC from '@assets/images/ui/badges/rarity_c.webp';
import rarityU from '@assets/images/ui/badges/rarity_u.webp';
import rarityR from '@assets/images/ui/badges/rarity_r.webp';

/**
 * レア度の印（2026-10-26 デザイン第8弾。銅＝コモン・銀＝アンコモン・金＝レア）。
 * レア度が決まっていないカード（正式カードはいまはすべて未定）は印を出さない（null）
 */
const RARITY_ART: Readonly<Record<Rarity, string>> = { C: rarityC, U: rarityU, R: rarityR };

export function rarityBadge(rarity: Rarity | null, height: number): HTMLElement | null {
  if (!rarity) return null;
  const el = h('img', { class: 'rarity-badge', attrs: { src: RARITY_ART[rarity], alt: rarityLabel(rarity), draggable: 'false' } });
  el.style.height = `${height}px`;
  return el;
}
