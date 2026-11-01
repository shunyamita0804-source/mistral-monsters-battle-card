import type { MonsterCard } from '../game/cards/cardTypes.ts';
import liliData from './official/lilil12_skills_OFFICIAL_20261102.json';

/**
 * リリル（2026-11-02 指示書 AK「新しいモンスター『リリル』（ピンクの枠の小悪魔・最初の箱『旅立ちのきらめき』）を入れて試遊する」）。
 * 約4頭身の小悪魔。ピンクの巻き毛・小さな巻き角2本・耳なし・花びらの毛の体・4枚の悪魔の羽・ハートの先のしっぽ。
 * **ゲームの中では「サキュバス」と呼ばない**（子どもの姿・全年齢）。説明の文は「いたずら好きの小悪魔」。
 * LIFE 5（いちばん低い）・**内部ランク C**（画面に出さない）・居場所は空中（src/data/skillRebuildAJ.ts の MONSTER_HABITAT）。
 *
 * 正本は src/data/official/lilil12_skills_OFFICIAL_20261102.json（届いた JSON を無改変。同じ内容の CSV も無改変で並べて置く）。
 * 技12枚は指示書 AJ の形（src/data/skillRebuildAJ.ts の AJ_SKILLS['mon-lilil']）に書き、JSON と合うかを tests/lilil.test.ts で確かめる。
 * 新しい効果は無い（今ある効果だけ。docs/battle-rules.md「リリルの効果の扱い」）。
 *
 * ゲーム内 ID：mon-lilil（ライフ5）、skl-lilil-01〜12（JSON の no）。図鑑はデスオルのあと
 * 入手：最初の箱「旅立ちのきらめき」（ソラモ・リリル・ラズック。src/data/introV2.ts）・ガチャのシリーズ（モンスターカードを初めて手に入れたら並ぶ）
 * 絵（原本は design-parts/cards-original/lilil/ に無改変）：
 * - 技 lilil_sk_01〜12.webp（届いた lilil_sk_NN.png〔827×937〕を tools/art/card_art_webp.py で WebP に。番号＝技番号）
 * - 正式モンスターカード lilil_official.webp（届いた lilil_official_monstercard_LIFE5.png〔970×1622〕を tools/art/official_card_webp.py で 508×849 に）
 * - バトル用 lilil_battlecard.png（届いた lilil_battleart.png を無改変。1170×1344 透過）
 * - パックの窓の絵はまだ無い（届くまで封をしたパックの絵）
 * 色：やわらかいローズピンク #EE8FB6（モンスターカード枠・技カード枠・パックの色の表）
 */
export const LILIL_MONSTER_ID = 'mon-lilil';

/** リリルの色（JSON の frame_color_hex） */
export const LILIL_COLOR: string = liliData.frame_color_hex;

export const LILIL_MONSTER: MonsterCard = {
  kind: 'monster',
  id: LILIL_MONSTER_ID,
  name: liliData.monster,
  rarity: null,
  life: liliData.life,
  themeColor: LILIL_COLOR,
  description: 'いたずら好きの小悪魔。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'lilil_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'lilil_battlecard.png', layout: 'full' },
};

export interface LililRow {
  readonly no: number;
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly mana: number;
  readonly damage: string;
  readonly effect: string;
  readonly gacha_slot: string;
  readonly box_copies: number;
  readonly art: string;
}

/** 届いた JSON の12行（技番号の順） */
export const LILIL_ROWS: readonly LililRow[] = liliData.skills;

/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const lililArtFile = (no: number): string => `lilil_sk_${String(no).padStart(2, '0')}.webp`;
