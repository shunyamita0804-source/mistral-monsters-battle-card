import type { MonsterCard } from '../game/cards/cardTypes.ts';

/**
 * ラディエル（2026-11-05 指示書 BI）。天の聖域の切り札。脚が無く浮いている、光輪と翼の聖なるモンスター。
 * LIFE 9・**内部ランク A**（画面に出さない）・居場所は空中（src/data/skillRebuildAJ.ts の MONSTER_HABITAT）。
 * 技12枚は指示書の表のとおり（表は skillRebuildAJ.ts の AJ_SKILLS['mon-radiel']。原本 design-parts/bi-radiel-20261105/00_instructions_for_claude_code.md）。
 * レア＝05 せいなるしせん・06 てんのはどう・09 最後の審判・12 天の恵み。回避の技は無い（決まり）。
 * 新しい効果：08 しんぱんのせんこく（すなかけ＋相手のマナ−1）・09 最後の審判（lastJudgment）・12 天の恵み（heavenGrace）。決まりは docs/battle-rules.md「ラディエルの効果の扱い」
 *
 * 入手：天の聖域の守り手アウレリオの切り札（enc-holy-boss の ace。初めてのクリアで祭壇から）・ガチャのシリーズ（モンスターカードを初めて手に入れたら並ぶ）。最初の箱には入れない
 *
 * 絵（原本は design-parts/bi-radiel-20261105/radiel/ に無改変。作り方は tools/art/radiel_assets.py）：
 * - 技 radiel_sk_01〜12.webp・正式モンスターカード radiel_official.webp（名前なし → 名前のロゴを重ねる）・バトル用 radiel_battlecard.png（無改変）
 * - パック pack_radiel.webp（袋のまわりの黒だけ透明に）・販売機の窓 panel_radiel.webp・ショップの棚の商品
 * 色：金 #D9A21B（指示書。バトル用カードの枠・技カードの枠・名前のロゴの帯）
 */
export const RADIEL_MONSTER_ID = 'mon-radiel';
export const RADIEL_COLOR = '#D9A21B';

export const RADIEL_MONSTER: MonsterCard = {
  kind: 'monster',
  id: RADIEL_MONSTER_ID,
  name: 'ラディエル',
  rarity: null,
  life: 9,
  themeColor: RADIEL_COLOR,
  // 説明の文は Claude の仮（英語は contentEnOfficialDraft.ts）
  description: '天の聖域の奥で、光の輪をいただき裁きを告げる者。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'radiel_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'radiel_battlecard.png', layout: 'full' },
};

export const radielSkillId = (no: number): string => `skl-radiel-${String(no).padStart(2, '0')}`;
/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const radielArtFile = (no: number): string => `radiel_sk_${String(no).padStart(2, '0')}.webp`;
