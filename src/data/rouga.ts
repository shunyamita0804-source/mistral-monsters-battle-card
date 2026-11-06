import type { MonsterCard } from '../game/cards/cardTypes.ts';

/**
 * ロウガ（2026-11-06 指示書 BL）。雪原の大狼。ノルディス地方の王者アイゼルの切り札（1体で完結。仲間と組む仕組みは無い）。
 * LIFE 8・**内部ランク B**（B の上。画面に出さない）・居場所は地上（src/data/skillRebuildAJ.ts の MONSTER_HABITAT）・防御1・回避1。
 * 技12枚は指示書の表のとおり（表は skillRebuildAJ.ts の AJ_QA_SKILLS['mon-rouga']。正本 design-parts/bl-rouga-20261106/data/rouga_skills.csv）。
 * レア＝05 ゆきけむりダッシュ・08 ひょうしょうのやいば・10 ひょうろうのいちげき・12 ジャンプ。
 * 少しだけ新しい効果：09 とおぼえ（ほっぺにためると同じ「次の攻撃＋2」に期限：使った次の自分の手番の終わりまで）。決まりは docs/battle-rules.md「ロウガの効果の扱い」
 *
 * **置き場所はまだ無い**（ノルディスの招待大会を作るときに入れる）。今はクロシオと同じく確かめ用だけ（?qa=1&lab=rouga）。
 * 図鑑には番号だけ付けて出す（クロシオのあと。手に入れるまで「？？？」）。ガチャのシリーズは準備だけ（モンスターカードを持つまで並ばない）
 *
 * 絵（原本は design-parts/bl-rouga-20261106/art/ に無改変。作り方は tools/art/rouga_assets.py）。色：淡い藤色 #B7A3DA
 */
export const ROUGA_MONSTER_ID = 'mon-rouga';
export const ROUGA_COLOR = '#B7A3DA';

export const ROUGA_MONSTER: MonsterCard = {
  kind: 'monster',
  id: ROUGA_MONSTER_ID,
  name: 'ロウガ',
  rarity: null,
  life: 8,
  themeColor: ROUGA_COLOR,
  // 説明の文は仮（英語は contentEnOfficialDraft.ts）
  description: '霜をまとう雪原の狼。氷の結晶が背に連なる。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'rouga_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'rouga_battlecard.png', layout: 'full' },
};

export const rougaSkillId = (no: number): string => `skl-rouga-${String(no).padStart(2, '0')}`;
/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const rougaArtFile = (no: number): string => `rouga_sk_${String(no).padStart(2, '0')}.webp`;
