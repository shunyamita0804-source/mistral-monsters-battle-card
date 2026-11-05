import type { MonsterCard } from '../game/cards/cardTypes.ts';

/**
 * クヨウ（2026-11-05 指示書 BH）。白澤がもとの、九つ目の霊獣。霧の廃坑の切り札。LIFE 8・**内部ランク B**（画面に出さない）・居場所は地上
 * （src/data/skillRebuildAJ.ts の MONSTER_HABITAT）。技12枚は指示書の表のとおり（表は skillRebuildAJ.ts の AJ_QA_SKILLS['mon-kuyo']。
 * 原本 design-parts/bh-kuyo-20261105/00_instructions_for_claude_code.md）。レア＝06 ここのつのめ・07 はらえのひかり・09 まよけのふだ・12 きりのなかへ。
 * 新しい効果：08 おはらい（purify）・09 まよけのふだ（wardCharm）・11 みがわり（cover の reduce 2）。決まりは docs/battle-rules.md「クヨウの効果の扱い」
 *
 * **入手は霧の廃坑の初めてのクリアの報酬の予定**。霧の廃坑はまだ作っていないので、今はタイラントと同じく確かめ用だけ
 * （cards.ts の QA_MONSTERS・QA_SKILLS と ?qa=1&lab=kuyo）。ガチャ・ショップ・ダンジョン・大会には出さない。
 * 図鑑には番号だけ付けて出す（No.248〜260。手に入れるまでは「？？？」）。ガチャのシリーズ（economy.ts）は、モンスターカードを手に入れるまで並ばない
 *
 * 絵（原本は design-parts/bh-kuyo-20261105/kuyo/ に無改変。作り方は tools/art/kuyo_assets.py）：
 * - 技 kuyo_sk_01〜12.webp（827×937）
 * - 正式モンスターカード kuyo_official.webp（1016×1698 を 508×849 に。名前なし。名前はロゴを重ねる）
 * - バトル用 kuyo_battlecard.png（1169×1346・透明。無改変。毛先の半透明はそのまま）
 * - パック pack_kuyo.webp（袋のまわりの黒だけ透明に）・販売機の窓 panel_kuyo.webp
 * 色：霧の藤ねず #87649C（正式カードの絵の枠の色。2026-11-05 ユーザー指示で指示書の #9B86B8 から合わせた。バトル用カードの枠・技カードの枠・名前のロゴの帯・パックの縁・図鑑）
 */
export const KUYO_MONSTER_ID = 'mon-kuyo';
export const KUYO_COLOR = '#87649C';

export const KUYO_MONSTER: MonsterCard = {
  kind: 'monster',
  id: KUYO_MONSTER_ID,
  name: 'クヨウ',
  rarity: null,
  life: 8,
  themeColor: KUYO_COLOR,
  // 2026-11-05 ユーザー決定の文（英語は contentEnOfficialDraft.ts）
  description: '霧の奥から九つの目で見守る霊獣。悪いものをはらうと伝えられる。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'kuyo_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'kuyo_battlecard.png', layout: 'full' },
};

/** 技の絵のファイル名（assets/images/cards/skills/。番号＝技番号） */
export const kuyoArtFile = (no: number): string => `kuyo_sk_${String(no).padStart(2, '0')}.webp`;
export const kuyoSkillId = (no: number): string => `skl-kuyo-${String(no).padStart(2, '0')}`;
