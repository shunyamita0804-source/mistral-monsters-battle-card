import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import officialSkills from './official/lazuck_cards_OFFICIAL.json';
import latestSkills from './official/lazuck_cards_LATEST_20261024.json';
import lazuck14 from './official/lazuck14_skills_OFFICIAL_20261026.json';
import themeColors from './official/monster_theme_colors.json';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * ラズック。2026-10-26 から技は正式14種（下の LAZUCK_SKILLS の説明）。ここから下の段落は、それまでの経緯の記録。
 *
 * 【それまでの正式データ】ラズックの技カード16種（2026-10-23 ユーザー確定。Seimon_Razukku_ALL16_Claude_ImplementationPack_20261023）。
 *
 * 正本は src/data/official/lazuck_cards_OFFICIAL.json（届いたファイルを無改変で置いている）。
 * 技名・マナ・ダメージ・種別・効果テキスト・初期/収集の区分は、ここで書き換えずに JSON からそのまま読む。
 *
 * ゲーム内 ID とデザイン ID の対応（docs/card-data-policy.md にも記録）：
 *   mon-lazuck＝ラズック、skl-lazuck-01〜16＝LAZ-SK-01〜16（番号は同じ）
 *
 * まだ決まっていないこと（独断で決めない）：
 * - 用途（2026-10-23 ユーザー「用途はまだ後から決める。登録と、仮置きでソラモしかいない所にラズックも出して」）
 * - 初期・収集の配分：全体の方針は初期8・収集8だが、1枚ずつの指定を足すと初期10・収集6（01〜08・11・14 が初期）。
 *   データは1枚ずつの指定のまま持ち、配布・スターター・パックには使っていない
 * - レアリティ・正式英語・配る枚数・パック・価格・景品・敵の編成
 * - ちょうはつ・ダストキックの細かい裁定（下の SPECIAL_EFFECTS と engine.ts の【要仕様確定】）
 *
 * 2026-10-24 改訂（Seimon_Claude_Gaul16_RazukSoramoPatch_20261024_CONTROL。正本 lazuck_cards_LATEST_20261024.json を無改変で置いた）：
 * - 並び順：01〜06 ちから／07〜08 かしこさ／09〜11 特殊／12〜13 防御／14〜16 回避。表示の番号（displayNo）だけ変え、
 *   ゲーム内 ID・絵のファイル名・デザイン ID は元のまま（例：トリックショットは skl-lazuck-09・laz_sk_09.webp のまま表示は 7）
 * - 新しい技「いたずら」（表示 11・特殊・マナ2）：ゲーム内 ID は skl-lazuck-itazura（番号の ID と取り違えないよう名前の ID）。
 *   絵はユーザーの完成画像（JPEG。原本 design-parts/cards-original/lazuck/）から作った laz_sk_itazura.webp
 * - 旧13「クロスガード」（skl-lazuck-13）：ゲームから削除（2026-10-24 ユーザー決定）。持っていたセーブは version 8 で所持・デッキから外す
 *   （src/game/save/saveData.ts の migrateRemoveCrossGuardV8）。元の JSON・絵（laz_sk_13.webp）は記録として残す
 * - 回避14〜16：マナと条件を承認値に（フェイントステップ＝マナ2・ちから、シャドウスリップ＝マナ2・必要マナ2以上のちから/かしこさ、ミラージュダッシュ＝条件なし）
 * - 初期・収集の区分は LATEST のまま（初期10・収集6。いたずらはクロスガードの収集枠を引き継ぐ）
 */
export const LAZUCK_MONSTER_ID = 'mon-lazuck';
export const lazuckSkillId = (no: number): string => `skl-lazuck-${twoDigits(no)}`;

/**
 * ラズックのモンスターカード。ライフ 6・絵・枠色は、それまで「登録のみ」にしていた正式カードのもの（src/data/registeredMonsters.ts から移した）
 */
export const LAZUCK_MONSTER: MonsterCard = {
  kind: 'monster',
  id: LAZUCK_MONSTER_ID,
  name: officialSkills.monster_name_ja,
  rarity: null,
  life: officialSkills.monster_life,
  themeColor: themeColors.monsters.lazuck.hex,
  description: 'ラズック。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'lazuck_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'lazuck_battle.webp', layout: 'full' },
  pendingSpec: ['rarity'],
};

/** 新しい技「いたずら」のゲーム内 ID（2026-10-24。番号の ID ではない） */
export const LAZUCK_ITAZURA_ID = 'skl-lazuck-itazura';

/**
 * 【古いデータ・2026-10-24 の16技】の ID（表示の順）。2026-10-26 に正式14技へ置き換えた。
 * 古いセーブの変換（version 7 の見分け：src/game/deck/deck.ts の createMixedTestDeck）にだけ使う
 */
export const LAZUCK_OLD16_IDS: readonly string[] = (latestSkills.skill_cards as readonly { readonly game_id: string }[]).map((l) =>
  l.game_id.startsWith('skl-lazuck-') ? l.game_id : LAZUCK_ITAZURA_ID,
);

/** ゲームから削除した旧13「クロスガード」の ID（セーブの変換・バックアップの読み込みで使う） */
export const LAZUCK_CROSS_GUARD_ID = lazuckSkillId(13);
/**
 * 2026-10-26 の正式14技で外れた技（旧05 しっぽアタック・旧16 ミラージュダッシュ）。古いセーブは version 11 で所持・デッキから外す
 * （src/game/save/saveData.ts の migrateLazuck14V11）。絵（laz_sk_05・16.webp）と元の JSON は記録として残す
 */
export const LAZUCK_REMOVED_14_IDS: readonly string[] = [lazuckSkillId(5), lazuckSkillId(16)];

/**
 * 【正式データ・2026-10-26】ラズックの技14種と初期配布16枚（Razuk_Claude_Official14_Starter16_COMPLETE_20261026）。
 * 正本は src/data/official/lazuck14_skills_OFFICIAL_20261026.json（届いた 01_RAZUK_FINAL_14_SKILLS_STARTER16.json を無改変）。
 * ZIP の中身はすべて design-parts/cards-original/lazuck14-20261026/ に無改変で保管。
 * 技名・分類・マナ・ダメージ・効果の文・初期配布の枚数は、ここで書き換えずに JSON からそのまま読む。
 *
 * ゲーム内 ID（依頼文「名前・役割に基づき維持する。表示番号の変更だけを理由に入れ替えない」）：
 *   それまでの同じ名前の技の ID をそのまま使う（例：しっぷうタックル＝skl-lazuck-06、シャドウスリップ＝skl-lazuck-15、いたずら＝skl-lazuck-itazura）。
 *   旧05 しっぽアタック（skl-lazuck-05）の ID は流用しない。旧16 ミラージュダッシュ（skl-lazuck-16）は正式14技の外なので外した
 * 性能が変わった技（同じ ID のまま）：しっぽいなし（マナ1→2）・シャドウガード（−4→−3）・フェイントステップ（ちから技だけ→ちから・かしこさ両方）
 * 絵：laz14_sk_01〜14.png（届いた 827×937 の PNG を1バイトも変えずに置いた。番号は正式の番号）
 * 枠：紫（#844DC5。届いた 06_Razuk_PurpleAccent の色替えの所の色。tools/art/skillcard_v5_monster_color.py・battle_card_frame.py で作った）
 *
 * まだ決まっていないこと（独断で決めない）：レアリティ・正式英語・ちょうはつ／ダストキックの細かい裁定（下の SPECIAL_EFFECTS）
 */
export interface Lazuck14Row {
  readonly number: number;
  readonly name_ja: string;
  readonly category: string;
  readonly mana: number;
  readonly damage: number | null;
  readonly effect_ja: string | null;
  readonly initial_copies: number;
  readonly asset_path: string;
}

export const LAZUCK14_ROWS: readonly Lazuck14Row[] = lazuck14.skill_cards;

/** 正式の番号 → ゲーム内 ID（それまでの同じ名前の技の ID。tests/lazuck.test.ts で名前の一致を確かめる） */
const LAZUCK14_IDS: Readonly<Record<number, string>> = {
  1: lazuckSkillId(1), // ひっかき
  2: lazuckSkillId(2), // かみつき
  3: lazuckSkillId(3), // とびかかり
  4: lazuckSkillId(4), // みだれづめ
  5: lazuckSkillId(6), // しっぷうタックル（旧06）
  6: lazuckSkillId(9), // トリックショット
  7: lazuckSkillId(10), // シャドウバースト
  8: lazuckSkillId(7), // ちょうはつ
  9: lazuckSkillId(8), // ダストキック
  10: LAZUCK_ITAZURA_ID, // いたずら
  11: lazuckSkillId(11), // しっぽいなし
  12: lazuckSkillId(12), // シャドウガード
  13: lazuckSkillId(15), // シャドウスリップ（旧15）
  14: lazuckSkillId(14), // フェイントステップ
};

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す。キーは正式の番号）。
 * 【要仕様確定】08 ちょうはつ：限るのは攻撃の技だけ。相手の場にラズックが1体もいなければ制限なし。09 ダストキック：重ねがけはしない
 */
const SPECIAL_EFFECTS: Readonly<Record<number, SkillEffect>> = {
  4: { type: 'attack', undodgeable: true },
  8: { type: 'taunt' },
  9: { type: 'weaken', stat: 'force', amount: 1, duration: 'nextTurn' },
  10: { type: 'handToDeck' },
  11: { type: 'defense', reduce: 3, against: 'force' },
  12: { type: 'defense', reduce: 3, against: 'wisdom' },
  13: { type: 'evade', against: 'all', minCost: 2 },
  14: { type: 'evade', against: 'all' },
};

/** 技の絵のファイル名。JSON の asset_path（Razuk_ArtV2_Skill_NN.png）の番号どおり */
export function lazuckArtFile(row: Lazuck14Row): string {
  const no = /Razuk_ArtV2_Skill_(\d{2})\.png$/.exec(row.asset_path)?.[1];
  if (!no || Number(no) !== row.number) throw new Error(`ラズックの技の絵の番号が合いません: ${row.number} ${row.asset_path}`);
  return `laz14_sk_${no}.png`;
}

function toSkill(row: Lazuck14Row): SkillCard {
  const id = LAZUCK14_IDS[row.number];
  if (!id) throw new Error(`ラズックの技の ID がありません: ${row.number}`);
  const o: OfficialSkill = {
    design_id: `LAZ14-SK-${twoDigits(row.number)}`,
    number: row.number,
    name_ja: row.name_ja,
    mana: row.mana,
    damage: row.damage,
    category: row.category,
    effect_text_ja: row.effect_ja,
    availability: row.initial_copies > 0 ? 'initial' : 'collect',
  };
  return officialSkill(
    o,
    { label: 'ラズック', monsterId: LAZUCK_MONSTER_ID, skillId: () => id, artFile: () => lazuckArtFile(row), specialEffects: {} },
    { id, displayNo: row.number, ...(SPECIAL_EFFECTS[row.number] ? { effect: SPECIAL_EFFECTS[row.number] } : {}) },
  );
}

/** ラズックの技14種（正式の番号の順。2026-10-26） */
export const LAZUCK_SKILLS: readonly SkillCard[] = LAZUCK14_ROWS.map(toSkill);

/** 初期配布16枚（技の ID と枚数。JSON の initial_copies のまま。0枚の技は入れない） */
export const LAZUCK_STARTER: readonly { readonly id: string; readonly copies: number }[] = LAZUCK14_ROWS.filter((r) => r.initial_copies > 0).map((r) => ({
  id: LAZUCK14_IDS[r.number] as string,
  copies: r.initial_copies,
}));
