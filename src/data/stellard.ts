import type { MonsterCard } from '../game/cards/cardTypes.ts';

/**
 * ステラード（2026-11-07 指示書 BQ）。白銀の鎧の獅子の騎士（中は光の聖獣）。槍と星の盾。アステリア地方（聖獣都市・王道の街）の王者ランスロットの切り札。5地方でいちばん強い。
 * LIFE 8・**内部ランク A**（A の上。タイラントのすぐ下。画面に出さない）・居場所は地上（src/data/skillRebuildAJ.ts の MONSTER_HABITAT）・防御2（どちらもマナ0）・回避0。
 * 戦い方：使いやすい攻撃が多い王道の強さ。
 * 技12枚は指示書の表のとおり（表は skillRebuildAJ.ts の AJ_QA_SKILLS['mon-stellard']。正本 design-parts/bq-stellard-20261107/data/stellard_skills.csv）。
 * レア＝05 ふくつのいちげき・06 きしのとつげき・08 りゅうせいのやり・09 ぎんがのかがやき。
 * 新しい効果：02 あしばらい（空中に使えない notAir）・05 ふくつのいちげき（LIFE 2 以下で使える lowLifeMax）・06 きしのとつげき（回避されると反動 selfDamageOnEvade）・
 * 10 しゅうちゅう（マナを減らされない focus）。決まりは docs/battle-rules.md「ステラードの効果の扱い」
 *
 * **置き場所はまだ無い**（アステリアの招待大会を作るときに入れる。ランスロットのデッキも今は変えない）。今は確かめ用だけ（?qa=1&lab=stellard）。
 * 図鑑には番号だけ付けて出す（ベニオウのあと。手に入れるまで「？？？」）。ガチャのシリーズは準備だけ（モンスターカードを持つまで並ばない）
 *
 * 絵（原本は design-parts/bq-stellard-20261107/art/ に無改変。作り方は tools/art/stellard_assets.py）。色：シルバー #C8CCD4（指示書 BQ【2】で、前のヒョウズクの色）
 */
export const STELLARD_MONSTER_ID = 'mon-stellard';
export const STELLARD_COLOR = '#C8CCD4';

export const STELLARD_MONSTER: MonsterCard = {
  kind: 'monster',
  id: STELLARD_MONSTER_ID,
  name: 'ステラード',
  rarity: null,
  life: 8,
  themeColor: STELLARD_COLOR,
  // 説明の文は仮（英語は contentEnOfficialDraft.ts）
  description: '星の都を守る白銀の騎士。鎧の中には光の聖獣が宿る。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'stellard_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'stellard_battlecard.png', layout: 'full' },
};

export const stellardSkillId = (no: number): string => `skl-stellard-${String(no).padStart(2, '0')}`;
/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const stellardArtFile = (no: number): string => `stellard_sk_${String(no).padStart(2, '0')}.webp`;
