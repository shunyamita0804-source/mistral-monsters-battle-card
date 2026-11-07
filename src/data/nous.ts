import type { MonsterCard } from '../game/cards/cardTypes.ts';

/**
 * ノウス（2026-11-07 指示書 BN）。水晶のドームの頭を持つ、6本腕の聖獣。ネブラシア地方の王者ザイレンの本当の切り札（フギンは相棒）。
 * LIFE 7・**内部ランク B**（B の上。画面に出さない）・居場所は空中（src/data/skillRebuildAJ.ts の MONSTER_HABITAT）・防御1・回避1。
 * 戦い方：かしこさ技で相手のマナを吸って大技を打たせず、ときをすいとるで山札を削って山札切れに追い込む。
 * 技12枚は指示書の表のとおり（表は skillRebuildAJ.ts の AJ_QA_SKILLS['mon-nous']。正本 design-parts/bn-nous-20261107/data/nous_skills.csv）。
 * レア＝05 ろっぽんうでのらんぶ・06 からっぽのつぼ・07 ずのうのせんこう・10 ぜんちぜんのう。
 * 新しい効果：06 からっぽのつぼ（攻撃＋相手のマナを0に manaZero）・09 ときをすいとる（相手の山札の上から2枚を捨て札に millDeck）・
 * 10 ぜんちぜんのう（山札から好きなカードを手札に searchAny）。決まりは docs/battle-rules.md「ノウスの効果の扱い」
 * ユーザーの決まり（2026-11-06）：特殊技でマナは減らさない（マナを減らすのは回避できるかしこさ技だけ）
 *
 * **置き場所はまだ無い**（ネブラシアの招待大会を作るときに入れる）。今はフギンと同じく確かめ用だけ（?qa=1&lab=nous）。
 * 図鑑には番号だけ付けて出す（フギンのあと。手に入れるまで「？？？」）。ガチャのシリーズは準備だけ（モンスターカードを持つまで並ばない）
 *
 * 絵（原本は design-parts/bn-nous-20261107/art/ に無改変。作り方は tools/art/nous_assets.py）。色：茶色 #8C3A10（2026-11-07 指示書 BQ【2】・ユーザー決定。BN の #CC6A1F はガウルと見分けにくかった）
 */
export const NOUS_MONSTER_ID = 'mon-nous';
export const NOUS_COLOR = '#8C3A10';

export const NOUS_MONSTER: MonsterCard = {
  kind: 'monster',
  id: NOUS_MONSTER_ID,
  name: 'ノウス',
  rarity: null,
  life: 7,
  themeColor: NOUS_COLOR,
  // 説明の文は仮（英語は contentEnOfficialDraft.ts）
  description: '星を読む塔に住む聖獣。6本の腕と鼻で、知恵とマナを吸い取る。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'nous_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'nous_battlecard.png', layout: 'full' },
};

export const nousSkillId = (no: number): string => `skl-nous-${String(no).padStart(2, '0')}`;
/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const nousArtFile = (no: number): string => `nous_sk_${String(no).padStart(2, '0')}.webp`;
