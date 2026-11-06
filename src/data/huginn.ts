import type { MonsterCard } from '../game/cards/cardTypes.ts';

/**
 * フギン（2026-11-06 指示書 BM）。双頭のカラスの聖獣。ネブラシア地方（頭の良い地方）の王者ザイレンの切り札（相棒の聖獣は別に作っている途中。今回は入れない）。
 * LIFE 6・**内部ランク B**（B の上。画面に出さない）・居場所は空中（src/data/skillRebuildAJ.ts の MONSTER_HABITAT）・防御0・回避2。
 * 戦い方：回避の技を山札から探して手札にそろえ、相手の大技をかわし続ける。安い攻撃でけずり、すいりのいちげきで仕留める。
 * 技12枚は指示書の表のとおり（表は skillRebuildAJ.ts の AJ_QA_SKILLS['mon-huginn']。正本 design-parts/bm-huginn-20261106/data/huginn_skills.csv）。
 * レア＝05 ふたつのくちばし・06 よみのまなざし・09 すいりのいちげき・12 さきよみ。
 * 新しい効果：06 よみのまなざし（攻撃＋封じ）・07 ちえのささやき（山札から回避を手札に）・10 はねやすめ（次の回避1回のマナ0）。決まりは docs/battle-rules.md「フギンの効果の扱い」
 *
 * **置き場所はまだ無い**（ネブラシアの招待大会を作るときに入れる）。今はクロシオ・ロウガと同じく確かめ用だけ（?qa=1&lab=huginn）。
 * 図鑑には番号だけ付けて出す（ロウガのあと。手に入れるまで「？？？」）。ガチャのシリーズは準備だけ（モンスターカードを持つまで並ばない）
 *
 * 絵（原本は design-parts/bm-huginn-20261106/art/ に無改変。作り方は tools/art/huginn_assets.py）。色：深い翠の緑 #1E6B45
 */
export const HUGINN_MONSTER_ID = 'mon-huginn';
export const HUGINN_COLOR = '#1E6B45';

export const HUGINN_MONSTER: MonsterCard = {
  kind: 'monster',
  id: HUGINN_MONSTER_ID,
  name: 'フギン',
  rarity: null,
  life: 6,
  themeColor: HUGINN_COLOR,
  // 説明の文は仮（英語は contentEnOfficialDraft.ts）
  description: 'ふたつの頭で先を読む黒いカラス。羽の先は結晶でできている。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'huginn_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'huginn_battlecard.png', layout: 'full' },
};

export const huginnSkillId = (no: number): string => `skl-huginn-${String(no).padStart(2, '0')}`;
/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const huginnArtFile = (no: number): string => `huginn_sk_${String(no).padStart(2, '0')}.webp`;
