import type { MonsterCard } from '../game/cards/cardTypes.ts';
import fornData from './official/forn12_skills_OFFICIAL_20261102.json';

/**
 * フォルン（2026-11-02 指示書 AL「新しいモンスター『フォルン』（牧神・最初の箱『蒼海の守り』）を入れて試遊する」）。
 * ヤギ足の小さな森の神。クリーム白の毛に苔・オリーブの緑・長い象牙色の角2本・垂れた耳・葉と花の冠・1本の木の笛（先が広がる）。
 * LIFE 7・**内部ランク C**（画面に出さない）・居場所は地上（src/data/skillRebuildAJ.ts の MONSTER_HABITAT）。
 *
 * 正本は src/data/official/forn12_skills_OFFICIAL_20261102.json（届いた JSON を無改変。同じ内容の CSV も無改変で並べて置く）。
 * 技12枚は指示書 AJ の形（src/data/skillRebuildAJ.ts の AJ_SKILLS['mon-forn']）に書き、JSON と合うかを tests/forn.test.ts で確かめる。
 * 新しい効果は 7 そなえのふえ（ward）・9 もりのたより（drawTo）。決まりは docs/battle-rules.md「フォルンの効果の扱い」
 *
 * ゲーム内 ID：mon-forn（ライフ7）、skl-forn-01〜12（JSON の no）。図鑑はリリルのあと
 * 入手：最初の箱「蒼海の守り」（ミュロル・カルシェル・フォルン。src/data/introV2.ts）・ガチャのシリーズ（モンスターカードを初めて手に入れたら並ぶ）
 * 絵（原本は design-parts/cards-original/forn/ に無改変）：
 * - 技 forn_sk_01〜12.webp（届いた forn_sk_NN.png〔827×937〕を tools/art/card_art_webp.py で WebP に。番号＝技番号）
 * - 正式モンスターカード forn_official.webp（届いた forn_official_monstercard_LIFE7.png〔970×1622〕を tools/art/official_card_webp.py で 508×849 に）
 * - バトル用 forn_battlecard.png（届いた forn_battleart.png を無改変。800×920 透過）
 * - パックの窓の絵 pack_art_forn.png（パック pack_forn.webp・販売機の窓 panel_forn.webp・ショップの棚の商品）
 * 色：濃いオリーブ #7A8B3C（モンスターカード枠・技カード枠・パックの色の表）
 */
export const FORN_MONSTER_ID = 'mon-forn';

/** フォルンの色（JSON の frame_color_hex） */
export const FORN_COLOR: string = fornData.frame_color_hex;

export const FORN_MONSTER: MonsterCard = {
  kind: 'monster',
  id: FORN_MONSTER_ID,
  name: fornData.monster,
  rarity: null,
  life: fornData.life,
  themeColor: FORN_COLOR,
  description: '笛をふく小さな森の神。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'forn_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'forn_battlecard.png', layout: 'full' },
};

export interface FornRow {
  readonly no: number;
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly mana: number;
  readonly damage_or_value: string;
  readonly effect: string;
  readonly gacha_slot: string;
  readonly box_copies: number;
  readonly art: string;
}

/** 届いた JSON の12行（技番号の順） */
export const FORN_ROWS: readonly FornRow[] = fornData.skills;

/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const fornArtFile = (no: number): string => `forn_sk_${String(no).padStart(2, '0')}.webp`;
