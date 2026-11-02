import type { MonsterCard } from '../game/cards/cardTypes.ts';
import uzurioData from './official/uzurio12_and_support3_OFFICIAL_20261102.json';

/**
 * ウズリオ（2026-11-02 指示書 AQ「新しいモンスター『ウズリオ』（風の渓谷の切り札をツムジから交代）と、サポート3枚を入れて試遊する」）。
 * 丸くふわふわした獣。砂のベージュの体に砂岩の赤茶のしま・頭に大きな渦の毛・ほっぺ／脚／しっぽの先に空色の渦。
 * LIFE 6・**内部ランク C**（画面に出さない）・居場所は地上（src/data/skillRebuildAJ.ts の MONSTER_HABITAT）。
 *
 * 正本は src/data/official/uzurio12_and_support3_OFFICIAL_20261102.json（届いた JSON を無改変。同じ内容の CSV も無改変で並べて置く）。
 * 技12枚は指示書 AJ の形（src/data/skillRebuildAJ.ts の AJ_SKILLS['mon-uzurio']）に書き、JSON と合うかを tests/uzurio.test.ts で確かめる。
 * 新しい効果は 4 うずまきショット（airBonus）・6 おおたつまき（allTargets＋airOnly）。決まりは docs/battle-rules.md「ウズリオの効果の扱い」
 *
 * ゲーム内 ID：mon-uzurio（ライフ6）、skl-uzurio-01〜12（JSON の no）。図鑑はフォルンのあと
 * 入手：風の渓谷の守り手ゼフィラの切り札（初回クリアで最奥の祭壇からモンスターカード＋技カード）・ガチャのシリーズ（モンスターカードを初めて手に入れたら並ぶ）。最初の箱には入れない
 * 絵（原本は design-parts/cards-original/uzurio/ に無改変）：
 * - 技 uzurio_sk_01〜12.webp（届いた uzurio_sk_NN.png〔827×937〕を tools/art/card_art_webp.py で WebP に。番号＝技番号）
 * - 正式モンスターカード uzurio_official.webp（届いた uzurio_official_monstercard_LIFE6.png〔970×1622〕を tools/art/official_card_webp.py で 508×849 に）
 * - バトル用 uzurio_battlecard.png（届いた uzurio_battleart.png を無改変。1169×1345 透過）
 * - パックの窓の絵 pack_art_uzurio.png（パック pack_uzurio.webp・販売機の窓 panel_uzurio.webp・ショップの棚の商品）
 * 色：はっきりした空色 #3D8FD6（モンスターカード枠・技カード枠・パックの色の表）
 */
export const UZURIO_MONSTER_ID = 'mon-uzurio';

const monster = uzurioData.monster;

/** ウズリオの色（JSON の frame_color） */
export const UZURIO_COLOR: string = monster.frame_color;

export const UZURIO_MONSTER: MonsterCard = {
  kind: 'monster',
  id: UZURIO_MONSTER_ID,
  name: monster.name_ja,
  rarity: null,
  life: monster.life,
  themeColor: UZURIO_COLOR,
  description: '渦の風をまとう、ふわふわの獣。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'uzurio_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'uzurio_battlecard.png', layout: 'full' },
};

export interface UzurioRow {
  readonly no: number;
  readonly id: string;
  readonly name_ja: string;
  readonly class: string;
  readonly mana: number;
  readonly damage: number | null;
  readonly effect_key: string | null;
  readonly effect_ja: string | null;
  readonly rare: boolean;
  readonly art: string;
}

/** 届いた JSON の12行（技番号の順） */
export const UZURIO_ROWS: readonly UzurioRow[] = monster.skills;

/** 届いた JSON のサポート3枚（まいあがる風・しずまる大地・しずめの祈り） */
export const UZURIO_SUPPORT_ROWS = uzurioData.support_cards;

/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const uzurioArtFile = (no: number): string => `uzurio_sk_${String(no).padStart(2, '0')}.webp`;
