import type { MonsterCard } from '../game/cards/cardTypes.ts';

/**
 * タイラント（2026-11-05 指示書 AX【2】）。赤いドラゴン。LIFE 8・**内部ランク A**（画面に出さない）・居場所は地上（src/data/skillRebuildAJ.ts の MONSTER_HABITAT）。
 * 技12枚は届いた tyrant_skills.csv のとおり（src/data/official/tyrant_skills_20261105.csv に無改変。表は skillRebuildAJ.ts の AJ_SKILLS['mon-tyrant']。
 * tests/tyrant.test.ts で CSV と照らし合わせる）。レア＝04 ドラゴンダイブ・08 しんくのごくえん・09 竜のまなざし・12 上空に飛ぶ（指示書）。
 * 新しい効果：09 竜のまなざし（dragonGaze）・10 竜のちから（dragonMight）。決まりは docs/battle-rules.md「タイラントの効果の扱い」
 *
 * **置き場所・入手はまだ決まっていない**：ふつうの一覧（MONSTERS）・図鑑・ガチャ・ショップ・ダンジョンには出さない。
 * 確かめ用（cards.ts の QA_MONSTERS・QA_SKILLS）と確かめ用の画面（?qa=1&lab=tyrant）だけ
 *
 * 絵（原本は design-parts/cards-original/tyrant/ に無改変）：
 * - 技 tyrant_sk_01〜12.webp（届いた 827×937 の PNG を tools/art/card_art_webp.py で WebP に。sk_04 は新しい絵）
 * - 正式モンスターカード tyrant_official.webp（tyrant_official_monstercard_LIFE8.png〔970×1622〕を tools/art/official_card_webp.py で 508×849 に）
 * - バトル用 tyrant_battlecard.png（tyrant_battle_transparent.png〔800×920〕の透明度を tools/art/alpha_binarize.py で 0／255 に。ふちの半透明だけ残す）
 * - パックの窓の絵 tyrant_pack_window_art.png は原本だけ置いた（ガチャに出さないので、パック・販売機の窓は作っていない）
 * 色：真っ赤 #A31523（正式カードの絵の枠の色を測った値。バトル用カードの枠・技カードの枠）
 */
export const TYRANT_MONSTER_ID = 'mon-tyrant';
export const TYRANT_COLOR = '#A31523';

export const TYRANT_MONSTER: MonsterCard = {
  kind: 'monster',
  id: TYRANT_MONSTER_ID,
  name: 'タイラント',
  rarity: null,
  life: 8,
  themeColor: TYRANT_COLOR,
  description: '炎の空を支配する、真紅の竜。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'tyrant_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'tyrant_battlecard.png', layout: 'full' },
};

/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const tyrantArtFile = (no: number): string => `tyrant_sk_${String(no).padStart(2, '0')}.webp`;
export const tyrantSkillId = (no: number): string => `skl-tyrant-${String(no).padStart(2, '0')}`;
