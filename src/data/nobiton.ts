import type { MonsterCard, SkillCard, SkillEffect } from '../game/cards/cardTypes.ts';
import officialSkills from './official/nobiton_cards_OFFICIAL_20261025.json';
import nobiton14Csv from './official/nobiton14_skills_OFFICIAL_20261026.csv?raw';
import { officialSkill, twoDigits, type OfficialSkill } from './officialSkills.ts';

/**
 * ノビトン。2026-10-26 から技は正式14種（下の NOBITON_SKILLS の説明）。ここから下の段落は、それまでの経緯の記録。
 *
 * 【それまでの正式データ】ノビトンの技カード16種（2026-10-25 ユーザー正式確定。MistralMonstersBC_Nobiton_FINAL_Part1/Part2_20261025）。
 * 正本は src/data/official/nobiton_skills_OFFICIAL_20261025.tsv と、写した nobiton_cards_OFFICIAL_20261025.json（どちらも記録として残す）。
 * ゲーム内 ID：mon-nobiton＝ノビトン（ライフ8）、skl-nobiton-01〜16＝NOB-SK-01〜16。絵は nob_sk_01〜16.webp（記録として残す）
 */
export const NOBITON_MONSTER_ID = 'mon-nobiton';
export const nobitonSkillId = (no: number): string => `skl-nobiton-${twoDigits(no)}`;

/** 正式カードの絵などで使う枠色の候補（2026-10-25。承認された色ではない。バトル用カードの黄色の枠とは別） */
export const THEME_COLOR_CANDIDATE = '#E8C654';

/** ノビトンのモンスターカード。ライフ 8 は正式モンスターカードの絵の値（LIFE 8）。内部ランク C（画面に出さない） */
export const NOBITON_MONSTER: MonsterCard = {
  kind: 'monster',
  id: NOBITON_MONSTER_ID,
  name: officialSkills.name_ja,
  rarity: null,
  life: officialSkills.monster_life,
  themeColor: THEME_COLOR_CANDIDATE,
  description: 'ノビトン。',
  isPlaceholder: false,
  art: { category: 'monsterCards', file: 'nobiton_official.webp', layout: 'full' },
  battleArt: { category: 'monsterCards', file: 'nobiton_battle.webp', layout: 'full' },
  pendingSpec: ['rarity'],
};

/**
 * 【正式データ・2026-10-26】ノビトンの技14種（Nobiton_14Skills_Claude_Implementation_20261026）。
 * 正本は src/data/official/nobiton14_skills_OFFICIAL_20261026.csv（届いた 02_14技_正式データ_UTF8.csv を無改変）。ZIP の中身は
 * design-parts/cards-original/nobiton14-20261026/ に無改変で保管。技名・分類・マナ・ダメージ・特殊効果の文は CSV からそのまま読む。
 *
 * ゲーム内 ID：それまでの同じ名前の技の ID をそのまま使う（ソラモ・ガウル・ラズックと同じ決まり。セーブの所持カードを守るため）。
 *   正式の番号（表示の番号 displayNo）が変わった技：のびのびガード（旧12→11）・ぐっとがまん（旧13→12）・横によける（旧15→13）・必死によける（旧16→14）
 *   正式14技の外になった技：旧11 サイコガード（skl-nobiton-11）・旧14 ねばりガード（skl-nobiton-14）。古いセーブは version 12 で所持・デッキから外す
 *   （依頼文の「旧09 鼻でまもる→新10…新09 不思議な嗅覚・新12 ぐっとがまんを追加」は、ゲームに入っていた16技より前の番号の話。
 *   ゲームの16技には不思議な嗅覚・ぐっとがまんがもう入っていたので、名前で引き継いだ）
 * 性能はそれまでと同じ（マナ・ダメージ・軽減値・回避の条件。効果の文だけ CSV の新しい書き方）
 * 絵：nob14_sk_01〜14.jpg（届いた 1178×1335 の JPEG を1バイトも変えずに置いた。番号は正式の番号）
 * 初期配布16枚：ユーザーのチャットの指示（design-parts/cards-original/nobiton14-20261026/03_ユーザーの指示_初期配布とバトル用原画_UTF8.txt）。
 *   新しく始めたときの所持カードに入れる（初期デッキ60枚には入れない・モンスターカード本体は配らない・いまのセーブには配らない）
 *
 * まだ決まっていないこと（独断で決めない）：レアリティ・正式英語（仮訳）・効果の細かい裁定（docs/battle-rules.md「正式カード（ノビトン）」）
 */
export interface Nobiton14Row {
  readonly number: number;
  readonly name_ja: string;
  readonly category: string;
  readonly mana: number;
  readonly damage: number | null;
  readonly effect_ja: string | null;
  readonly art: string;
}

const CATEGORY: Readonly<Record<string, string>> = { ちから: 'force', かしこさ: 'wisdom', 特殊: 'special', 防御: 'defense', 回避: 'evade' };

/** 届いた CSV（技番号,技名,分類,消費マナ,ダメージ,特殊効果,画像相対パス）を読む。「なし」は値なし */
export function parseNobiton14Csv(csv: string): Nobiton14Row[] {
  const lines = csv.replace(/^﻿/, '').trim().split(/\r?\n/).slice(1);
  return lines.map((line) => {
    const [no, name, cat, mana, damage, effect, art] = line.split(',');
    const category = CATEGORY[cat ?? ''];
    if (!no || !name || !category || mana === undefined || damage === undefined || effect === undefined || !art) {
      throw new Error(`ノビトンの技の CSV の行が読めません: ${line}`);
    }
    return {
      number: Number(no),
      name_ja: name,
      category,
      mana: Number(mana),
      damage: damage === 'なし' ? null : Number(damage),
      effect_ja: effect === 'なし' ? null : effect,
      art,
    };
  });
}

export const NOBITON14_ROWS: readonly Nobiton14Row[] = parseNobiton14Csv(nobiton14Csv);

/** 正式の番号 → ゲーム内 ID（それまでの同じ名前の技の ID。tests/nobiton.test.ts で名前の一致を確かめる） */
const NOBITON14_IDS: Readonly<Record<number, string>> = {
  1: nobitonSkillId(1), // はなビンタ
  2: nobitonSkillId(2), // ずつき
  3: nobitonSkillId(3), // まきつく
  4: nobitonSkillId(4), // ギガントノーズ
  5: nobitonSkillId(5), // くしゃみ
  6: nobitonSkillId(6), // ミラージュノーズ
  7: nobitonSkillId(7), // ダウナーミスト
  8: nobitonSkillId(8), // 考える
  9: nobitonSkillId(9), // 不思議な嗅覚
  10: nobitonSkillId(10), // 鼻でまもる
  11: nobitonSkillId(12), // のびのびガード（旧12）
  12: nobitonSkillId(13), // ぐっとがまん（旧13）
  13: nobitonSkillId(15), // 横によける（旧15）
  14: nobitonSkillId(16), // 必死によける（旧16）
};

/** 2026-10-26 の正式14技で外れた技（旧11 サイコガード・旧14 ねばりガード）。古いセーブは version 12 で所持・デッキから外す */
export const NOBITON_REMOVED_14_IDS: readonly string[] = [nobitonSkillId(11), nobitonSkillId(14)];

/**
 * 初期配布16枚（2026-10-26 ユーザーのチャットの指示。正式の番号 → 枚数。0枚の技は書かない）。
 * 01・02・05 が3枚、03 が1枚、08・10・13 が2枚
 */
const INITIAL_COPIES: Readonly<Record<number, number>> = { 1: 3, 2: 3, 3: 1, 5: 3, 8: 2, 10: 2, 13: 2 };

/**
 * 効果の文のある技の、ゲームでの動き（効果の文は書き換えず、動きだけをここで表す。キーは正式の番号。動きは 2026-10-25 からと同じ）。
 * - 03 まきつく：回避されなければ、対象は次の手番に技を使えない（攻撃も特殊も。守備のカードは使える）
 * - 05 くしゃみ・07 ダウナーミスト：回避されなければ、相手のマナを減らす（0 より下にはならない）
 * - 06 ミラージュノーズ：回避カードは使えない（防御は使える）
 * - 08 考える：使ったカードを除く手札をすべて山札へ戻してシャッフルし、同じ枚数を引く
 * - 09 不思議な嗅覚：相手の手札をすべて確認（画面に表を見せる。手札は動かさない）
 * - 10〜12 防御：ちから技−2／両方−3／両方−1（マナ0）。13 横によける：ちから技を回避。14 必死によける：両方を回避（条件なし）
 */
const SPECIAL_EFFECTS: Readonly<Record<number, SkillEffect>> = {
  3: { type: 'attack', stunTarget: true },
  5: { type: 'attack', manaDrain: 1 },
  6: { type: 'attack', undodgeable: true },
  7: { type: 'attack', manaDrain: 3 },
  8: { type: 'redrawHand' },
  9: { type: 'revealHand' },
  10: { type: 'defense', reduce: 2, against: 'force' },
  11: { type: 'defense', reduce: 3, against: 'all' },
  12: { type: 'defense', reduce: 1, against: 'all' },
  13: { type: 'evade', against: 'force' },
  14: { type: 'evade', against: 'all' },
};

/** 技の絵のファイル名。CSV の画像相対パス（01_SKILL_ART/Nobiton_SKNN.jpg）の番号どおり */
export function nobitonArtFile(row: Nobiton14Row): string {
  const no = /Nobiton_SK(\d{2})\.jpg$/.exec(row.art)?.[1];
  if (!no || Number(no) !== row.number) throw new Error(`ノビトンの技の絵の番号が合いません: ${row.number} ${row.art}`);
  return `nob14_sk_${no}.jpg`;
}

function toSkill(row: Nobiton14Row): SkillCard {
  const id = NOBITON14_IDS[row.number];
  if (!id) throw new Error(`ノビトンの技の ID がありません: ${row.number}`);
  const o: OfficialSkill = {
    design_id: `NOB14-SK-${twoDigits(row.number)}`,
    number: row.number,
    name_ja: row.name_ja,
    mana: row.mana,
    damage: row.damage,
    category: row.category,
    effect_text_ja: row.effect_ja,
    availability: (INITIAL_COPIES[row.number] ?? 0) > 0 ? 'initial' : 'collect',
  };
  return officialSkill(
    o,
    { label: 'ノビトン', monsterId: NOBITON_MONSTER_ID, skillId: () => id, artFile: () => nobitonArtFile(row), specialEffects: {} },
    { id, displayNo: row.number, ...(SPECIAL_EFFECTS[row.number] ? { effect: SPECIAL_EFFECTS[row.number] } : {}) },
  );
}

/** ノビトンの技14種（正式の番号の順。2026-10-26） */
export const NOBITON_SKILLS: readonly SkillCard[] = NOBITON14_ROWS.map(toSkill);

/** 初期配布16枚（技の ID と枚数。0枚の技は入れない） */
export const NOBITON_STARTER: readonly { readonly id: string; readonly copies: number }[] = NOBITON14_ROWS.filter(
  (r) => (INITIAL_COPIES[r.number] ?? 0) > 0,
).map((r) => ({ id: NOBITON14_IDS[r.number] as string, copies: INITIAL_COPIES[r.number] as number }));
