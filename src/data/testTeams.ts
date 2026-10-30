import { LAZUCK_MONSTER_ID } from './lazuck.ts';
import { PUKARIM_MONSTER_ID } from './pukarim.ts';
import { SORAMO_MONSTER_ID } from './soramo.ts';

/**
 * 【テスト用】技を試すための仮の編成（2026-10-23）。正式な編成・スターターの内訳は未定。
 * - それまで：ユーザー指示「技の発動を見るため、仮のカードはすべてソラモに」でソラモ3体（SORAMO_TEAM）
 * - 2026-10-23 ユーザー指示「仮置きで、ソラモしかいない所にラズックも出して」で、ソラモとラズックを混ぜた
 *   TEST_TEAM＝ソラモ・ラズック・ソラモ（主人公のデッキ・練習の相手）、TEST_TEAM_ALT＝ラズック・ソラモ・ラズック（大会・ダンジョンで交互に）
 */
/**
 * 2026-10-30 指示書 V（同じモンスターは1つのデッキに1体まで）：3体ともちがうモンスターに組みかえた。
 * 2体目のソラモ・2体目のラズック → プカリム（ガウル・ミュロル・ノビトン・カルシェルは、前の初期デッキ・練習の相手に入れない決まりのため〔それぞれのテスト〕）。
 * 前の編成（ソラモ・ラズック・ソラモ）は、前のセーブを見分けるためだけに src/game/deck/deck.ts の LEGACY_TEST_TEAM に残す
 */
export const TEST_TEAM: readonly string[] = [SORAMO_MONSTER_ID, LAZUCK_MONSTER_ID, PUKARIM_MONSTER_ID];
export const TEST_TEAM_ALT: readonly string[] = [LAZUCK_MONSTER_ID, SORAMO_MONSTER_ID, PUKARIM_MONSTER_ID];
