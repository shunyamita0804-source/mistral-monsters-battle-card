import { GAUUL_MONSTER_ID } from './gauul.ts';
import { KALSHELL_MONSTER_ID } from './kalshell.ts';
import { LAZUCK_MONSTER_ID } from './lazuck.ts';
import { MYUROL_MONSTER_ID } from './myurol.ts';
import { NOBITON_MONSTER_ID } from './nobiton.ts';
import { SORAMO_MONSTER_ID } from './soramo.ts';
import type { OpponentDefinition } from './tournaments.ts';

/**
 * 導入イベントV2「プロのカードバトラーになる試験」のデータ（2026-10-27 ユーザー正式依頼）。
 * 進行のルールは src/game/story/introV2.ts、台詞は src/i18n/messages/introV2.ts。
 *
 * 決定（独断で変えない）：初期デッキ3種のモンスター編成、施設名「カードバトラー管理局」、パックは3種から1つ
 * 2026-10-28 ユーザー決定（design-parts/booster-decision-20261028/00_instructions_for_claude_code.txt）：
 *   ブースターの箱＝初期配布（モンスター3枚＋その3体の初期配布16枚ずつ＝技48枚＋仮サポート12枚＝そのまま1つのデッキ）。
 *   新しく始めたときはカードを持たない（初期デッキ3択はなくした）。試験は先生が「旅立ちのきらめき」と同じデッキを貸す。
 *   管理局で選んだ箱の中身がそのまま使うデッキになる。選ばなかった2箱はカードショップのカウンターで1箱 1,500G・各1回
 * 仮のまま：仮サポート12枚（試験の先生のデッキとライフは 2026-10-28 にユーザー決定）
 */

export type StarterDeckKey = 'balance' | 'attack' | 'defense';

export interface StarterDeckDefinition {
  readonly key: StarterDeckKey;
  /** 名前（日本語。英語は i18n の introV2.deck.*） */
  readonly name: string;
  /** モンスター3体（決定） */
  readonly monsters: readonly [string, string, string];
}

/** 初期デッキ3種（2026-10-27 決定：バランス＝ソラモ・ガウル・ミュロル／攻撃＝ガウル・ラズック・ノビトン／防御＝カルシェル・ミュロル・ノビトン） */
export const STARTER_DECKS: readonly StarterDeckDefinition[] = [
  { key: 'balance', name: 'バランス', monsters: [SORAMO_MONSTER_ID, GAUUL_MONSTER_ID, MYUROL_MONSTER_ID] },
  { key: 'attack', name: '攻撃', monsters: [GAUUL_MONSTER_ID, LAZUCK_MONSTER_ID, NOBITON_MONSTER_ID] },
  { key: 'defense', name: '防御', monsters: [KALSHELL_MONSTER_ID, MYUROL_MONSTER_ID, NOBITON_MONSTER_ID] },
];

export function getStarterDeck(key: string): StarterDeckDefinition | undefined {
  return STARTER_DECKS.find((d) => d.key === key);
}

export const isStarterDeckKey = (v: unknown): v is StarterDeckKey => STARTER_DECKS.some((d) => d.key === v);

/** 【仮】初期デッキの仮サポートの枚数（初期配布 16 枚×3 体＝48 枚と合わせて 60 枚） */
export const STARTER_TEMP_SUPPORTS = 12;

export type BoosterKey = 'booster-1' | 'booster-2' | 'booster-3';

export interface BoosterDefinition {
  readonly key: BoosterKey;
  /** 商品名（2026-10-27 正式デザインの箱の名前。英語は i18n の introV2.pack.name.*） */
  readonly name: string;
  /** 箱の絵（assets/images/ui/booster/。正式デザインの3箱集合から切り出し。src/ui/components/boosterArt.ts） */
  readonly art: 'booster_tabidachi' | 'booster_rekka' | 'booster_soukai';
  /** 種類（バランス・攻撃・防御）と、箱に描かれたモンスター（商品のイメージ。封入の保証・排出率ではない） */
  readonly category: StarterDeckKey;
  readonly monsters: readonly [string, string, string];
}

/**
 * 管理局で選ぶブースターパック3種（2026-10-27 ユーザー承認の箱デザイン「BoosterPack_Claude_Request」）。並び・名前・種類・箱のモンスターは確定。
 * 中身は 2026-10-28 に決定：その種類の初期デッキ（src/game/deck/deck.ts の createStarterDeckFor。モンスター3＋山札60）。
 * 技とサポートの枚数の出典は src/data/official/booster_contents_20261030.json（2026-10-30 指示書 Y：技56枚＋旅の手帳×2・投石×2。前の版 _20261029・_20261028 は残す。
 * src/game/story/introV2.ts の boosterDeck が資料から作る。tests/boosterCounter.test.ts で照合）
 */
export const BOOSTERS: readonly BoosterDefinition[] = [
  { key: 'booster-1', name: '旅立ちのきらめき', art: 'booster_tabidachi', category: 'balance', monsters: [SORAMO_MONSTER_ID, GAUUL_MONSTER_ID, MYUROL_MONSTER_ID] },
  { key: 'booster-2', name: '烈火の猛攻', art: 'booster_rekka', category: 'attack', monsters: [GAUUL_MONSTER_ID, LAZUCK_MONSTER_ID, NOBITON_MONSTER_ID] },
  { key: 'booster-3', name: '蒼海の守り', art: 'booster_soukai', category: 'defense', monsters: [KALSHELL_MONSTER_ID, MYUROL_MONSTER_ID, NOBITON_MONSTER_ID] },
];

/** ショップのカウンターでの値段（2026-10-28 ユーザー決定。1箱 1,500G・各箱1回まで） */
export const BOOSTER_SHOP_PRICE = 1500;

/** 試験で先生が貸すデッキ（2026-10-28 ユーザー決定：「旅立ちのきらめき」と同じ中身。試験のあいだだけ使い、所持カードには入れない） */
export const EXAM_LOAN_BOOSTER: BoosterKey = 'booster-1';

export const isBoosterKey = (v: unknown): v is BoosterKey => BOOSTERS.some((b) => b.key === v);

/**
 * 試験の対戦相手：練習場の先生ガレス。ライフをとても少なくし、負けて再挑戦するたびにさらに少なく（救済）。
 * 2026-10-28 ユーザー決定：編成は「ラズック・カルシェル・ノビトン」（前のソラモ・ラズック・ソラモは同じモンスターが2体いて不具合に見え、
 * 貸しデッキ〔旅立ちのきらめき〕のソラモとも重なるため）。ライフの割合（0.35 → 0.25 → 0.15）はそのまま
 */
export const EXAM_OPPONENT: OpponentDefinition = { id: 'exam-teacher', name: 'ガレス', monsters: [LAZUCK_MONSTER_ID, KALSHELL_MONSTER_ID, NOBITON_MONSTER_ID], lifeScale: 0.35, face: 'teacher' };

/** 何回目の挑戦かで、先生のモンスターのライフの割合（1回目 0.35 → 2回目 0.25 → 3回目以降 0.15。最低でもライフ1） */
export function examLifeScale(attempt: number): number {
  return attempt <= 1 ? 0.35 : attempt === 2 ? 0.25 : 0.15;
}

/** 【仮】カードバトラー管理局（建物の位置・外観・内装は未定。承認までは街に仮の印、中は仮の部屋） */
export const BUREAU_MAP_ID = 'bureau';
