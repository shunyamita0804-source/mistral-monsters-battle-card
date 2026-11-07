import type { MonsterCard } from '../game/cards/cardTypes.ts';

/**
 * ベニオウ（2026-11-07 指示書 BP）。金棒を持つ赤い鬼。オルティガ地方（赤岩の荒野・武闘派）の王者ゼルガンの切り札。
 * LIFE 8・**内部ランク A**（画面に出さない）・居場所は地上（src/data/skillRebuildAJ.ts の MONSTER_HABITAT）・防御2・回避0。
 * 戦い方：力で押し切る。追いつめられるほど強くなる（いかり）・おたけびで次のちから技を2倍・おにのいあつで相手の回避を封じる。
 * 技12枚は指示書の表のとおり（表は skillRebuildAJ.ts の AJ_QA_SKILLS['mon-beniou']。正本 design-parts/bp-beniou-20261107/data/beniou_skills.csv）。
 * レア＝05 かなぼうくだき・06 いかりのかなぼう・07 おにのいちげき・12 ごうりきのはだ。
 * 新しい効果：04・06 いかり（rageBonus）・09 おたけび（roar）・10 おにのいあつ（menace）。決まりは docs/battle-rules.md「ベニオウの効果の扱い」
 *
 * **置き場所はまだ無い**（オルティガの招待大会を作るときに入れる。ゼルガンのデッキも今は変えない）。今は確かめ用だけ（?qa=1&lab=beniou）。
 * 図鑑には番号だけ付けて出す（ノウスのあと。手に入れるまで「？？？」）。ガチャのシリーズは準備だけ（モンスターカードを持つまで並ばない）
 *
 * 絵（原本は design-parts/bp-beniou-20261107/art/ に無改変。作り方は tools/art/beniou_assets.py）。色：深いえんじ #6B1E3A
 */
export const BENIOU_MONSTER_ID = 'mon-beniou';
export const BENIOU_COLOR = '#6B1E3A';

export const BENIOU_MONSTER: MonsterCard = {
  kind: 'monster',
  id: BENIOU_MONSTER_ID,
  name: 'ベニオウ',
  rarity: null,
  life: 8,
  themeColor: BENIOU_COLOR,
  // 説明の文は仮（英語は contentEnOfficialDraft.ts）
  description: '赤岩の峡谷に住む鬼。金棒のひとふりで崖をくだく。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'beniou_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'beniou_battlecard.png', layout: 'full' },
};

export const beniouSkillId = (no: number): string => `skl-beniou-${String(no).padStart(2, '0')}`;
/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const beniouArtFile = (no: number): string => `beniou_sk_${String(no).padStart(2, '0')}.webp`;
