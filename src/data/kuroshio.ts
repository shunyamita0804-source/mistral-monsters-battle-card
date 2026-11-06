import type { MonsterCard } from '../game/cards/cardTypes.ts';

/**
 * クロシオ（2026-11-06 指示書 BK）。シャチがもとの海の狩人。セイラン地方の王者ナディアの切り札（海のパーティー：クロシオ・カルシェル・ミュロル）。
 * LIFE 7・**内部ランク B**（画面に出さない）・居場所は水中（src/data/skillRebuildAJ.ts の MONSTER_HABITAT）・回避だけ（防御の技は無い）。
 * 技12枚は指示書の表のとおり（表は skillRebuildAJ.ts の AJ_QA_SKILLS['mon-kuroshio']。正本 design-parts/bk-kuroshio-20261106/data/kuroshio_skills.csv）。
 * レア＝06 しおふきキャノン・07 おおうずしお・08 オルカストライク・12 うずまきターン。
 * 新しい効果：04 ひきずりこむ（当たった相手1体を水中に。dragUnder）・07 おおうずしお（水中の相手全員に。allTargets＋waterOnly）。
 * 決まりは docs/battle-rules.md「クロシオの効果の扱い」
 *
 * **置き場所はまだ無い**（セイランの招待大会を作るときに、優勝でパックが開く形にする予定）。今はクヨウの最初と同じく確かめ用だけ
 * （cards.ts の QA_MONSTERS・QA_SKILLS と ?qa=1&lab=kuroshio）。ダンジョン・大会・箱・ショップ・ガチャには出さない。
 * 図鑑にはクヨウと同じく番号だけ付けて出す（手に入れるまで「？？？」）。ガチャのシリーズ（economy.ts）は準備だけ（モンスターカードを持つまで並ばない）
 *
 * 絵（原本は design-parts/bk-kuroshio-20261106/art/ に無改変。作り方は tools/art/kuroshio_assets.py）：
 * - 技 kuroshio_sk_01〜12.webp（827×937。02 だけ大きく届いたので同じ大きさに縮めた）
 * - 正式モンスターカード kuroshio_official.webp（970×1622 を 508×849 に。名前なし。名前はロゴを重ねる）
 * - バトル用 kuroshio_battlecard.png（1169×1345・透明。透明度を 0／255 にそろえた。色は変えていない）
 * - パック pack_kuroshio.webp（窓の絵をほかの子と同じ型に入れた）・販売機の窓 panel_kuroshio.webp
 * 色：珊瑚 #F08A78（バトル用カードの枠・技カードの枠・名前のロゴの帯・パックの縁・図鑑）
 */
export const KUROSHIO_MONSTER_ID = 'mon-kuroshio';
export const KUROSHIO_COLOR = '#F08A78';

export const KUROSHIO_MONSTER: MonsterCard = {
  kind: 'monster',
  id: KUROSHIO_MONSTER_ID,
  name: 'クロシオ',
  rarity: null,
  life: 7,
  themeColor: KUROSHIO_COLOR,
  // 説明の文は指示書の data/kuroshio.json の仮（英語は contentEnOfficialDraft.ts）
  description: '夕暮れの外洋を駆ける、珊瑚の隈取りの海の狩人。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'kuroshio_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'kuroshio_battlecard.png', layout: 'full' },
};

export const kuroshioSkillId = (no: number): string => `skl-kuroshio-${String(no).padStart(2, '0')}`;
/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const kuroshioArtFile = (no: number): string => `kuroshio_sk_${String(no).padStart(2, '0')}.webp`;
