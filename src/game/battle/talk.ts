import type { BattleMonster } from './engine.ts';

/**
 * モンスターが倒れたときの相手のひと言（どれを言うか。文は src/i18n/messages/battle.ts の battle.talk.*）。
 * 2026-10-28：2体目・3体目を倒したときも「まず1体」と言っていたので、倒れた数で分ける。
 * - 1体目：knock（こちらを倒した）／ownDown（相手のモンスターが倒れた）
 * - 残り1体になった：knockLast／ownDownLast
 * - 全部倒れた：言わない（対戦が終わり、勝ち・負けのひと言が出る）
 * side は倒れたモンスターの側（'player' ＝主人公のモンスターが倒れた＝相手が倒した）
 */
export type KnockTalk = 'knock' | 'knockLast' | 'ownDown' | 'ownDownLast';

export function knockTalk(side: 'player' | 'opponent', monsters: readonly Pick<BattleMonster, 'life'>[]): KnockTalk | null {
  const left = monsters.filter((m) => m.life > 0).length;
  if (left === 0) return null;
  const last = left === 1;
  if (side === 'player') return last ? 'knockLast' : 'knock';
  return last ? 'ownDownLast' : 'ownDown';
}
