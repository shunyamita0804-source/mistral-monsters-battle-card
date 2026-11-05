import { getSkill } from '../../data/cards.ts';
import type { BattleMonster, BattleState, PendingAttack, Side } from './engine.ts';
import { knockTalk } from './talk.ts';

/**
 * 対戦の相手（NPC）のひと言を出す場面（2026-11-05 NPC バトルセリフ 43 名・第1弾）。DOM に依存しない。
 * 場面はいつも NPC から見た言い方（npc_＝相手〔NPC〕が・player_＝主人公が）。文は src/data/npcBattleLines.ts
 * - 戦いのルール（engine.ts）は変えない。1つの操作の前と後の状態を比べて、表示のための場面を決める
 */
export type NpcLineKey =
  | 'start'
  | 'npc_attack_hit'
  | 'player_attack_hit'
  | 'npc_defense_success'
  | 'player_defense_success'
  | 'npc_evade_success'
  | 'player_evade_success'
  | 'npc_knock'
  | 'npc_knock_last'
  | 'npc_own_down'
  | 'npc_own_down_last'
  | 'npc_win'
  | 'npc_lose';

/** 切り札専用（8名×3本＋アウレリオの仮3本）・再戦の始め（ガレス。照合待ち・まだつないでいない） */
export type NpcExtraKey = 'ace_attack_hit' | 'ace_down_continue' | 'ace_down_final' | 'rematch_start';

export const NPC_LINE_KEYS: readonly NpcLineKey[] = [
  'start',
  'npc_attack_hit',
  'player_attack_hit',
  'npc_defense_success',
  'player_defense_success',
  'npc_evade_success',
  'player_evade_success',
  'npc_knock',
  'npc_knock_last',
  'npc_own_down',
  'npc_own_down_last',
  'npc_win',
  'npc_lose',
];

/** 攻撃1回の結果（表示用） */
export interface AttackTalk {
  /** 命中（ライフが実際に減った）・防御成功（守りのカード・かばうで0に）・回避成功（回避で0に） */
  readonly kind: 'hit' | 'defended' | 'evaded';
  readonly attacker: Side;
  /** 攻撃したモンスターのカード ID（切り札の命中を見分ける） */
  readonly userCardId: string | null;
  /** その攻撃で狙われたモンスターが倒れた（撃破のひと言を優先するので、命中のひと言は出さない） */
  readonly knockedOut: boolean;
  /** 対戦が終わった（勝ち・負けのひと言を優先） */
  readonly ended: boolean;
}

const monsterOf = (state: BattleState, uid: string): { side: Side; monster: BattleMonster } | null => {
  for (const side of ['player', 'opponent'] as const) {
    const m = state.sides[side].monsters.find((x) => x.uid === uid);
    if (m) return { side, monster: m };
  }
  return null;
};

/** 攻撃が解決したか（守りが終わって、その攻撃の狙いのダメージが決まった）。全体攻撃は1体ずつ */
function resolvedAttack(before: BattleState, after: BattleState): PendingAttack | null {
  const p = before.pending;
  if (!p) return null;
  const q = after.pending;
  if (q && q.cardId === p.cardId && q.userUid === p.userUid && q.targetUid === p.targetUid) return null;
  return p;
}

/**
 * 1つの操作の前と後から、攻撃1回の結果を決める（攻撃が解決していなければ null）。
 * - 命中：狙われたモンスターのライフが実際に減った（半分の回避・防御で減らしただけのときも命中。反動・回復・状態のダメージは数えない）
 * - 回避成功：回避のカードを使い、ライフが減らなかった
 * - 防御成功：防御・かばうのカードを使い、ライフが減らなかった（威力がもともと0・無効のときは何も言わない）
 */
export function attackTalkOf(before: BattleState, after: BattleState): AttackTalk | null {
  const p = resolvedAttack(before, after);
  if (!p) return null;
  const target = monsterOf(before, p.targetUid);
  const targetAfter = monsterOf(after, p.targetUid);
  if (!target || !targetAfter) return null;
  const lost = target.monster.life - targetAfter.monster.life;
  const user = monsterOf(before, p.userUid);
  const base = { attacker: p.attacker, userCardId: user?.monster.cardId ?? null, knockedOut: target.monster.life > 0 && targetAfter.monster.life <= 0, ended: after.phase === 'ended' };
  if (lost > 0) return { kind: 'hit', ...base };
  if (p.power <= 0) return null;
  const types = p.responses.map((id) => getSkill(id).effect.type);
  if (types.includes('evade')) return { kind: 'evaded', ...base };
  if (types.includes('defense') || types.includes('cover') || p.coveredFrom) return { kind: 'defended', ...base };
  return null;
}

/** 攻撃の結果 → NPC から見た場面 */
export function attackLineKey(a: AttackTalk): NpcLineKey {
  const npc = a.attacker === 'opponent';
  if (a.kind === 'hit') return npc ? 'npc_attack_hit' : 'player_attack_hit';
  // 防御・回避は守った側から見る（攻撃したのが主人公なら、守ったのは NPC）
  if (a.kind === 'defended') return npc ? 'player_defense_success' : 'npc_defense_success';
  return npc ? 'player_evade_success' : 'npc_evade_success';
}

/** モンスターが倒れたとき（side＝倒れた側）。最後の1体が倒れて決着したときは null（勝ち・負けのひと言） */
export function knockLineKey(side: Side, monsters: readonly Pick<BattleMonster, 'life'>[]): NpcLineKey | null {
  const k = knockTalk(side, monsters);
  if (k === 'knock') return 'npc_knock';
  if (k === 'knockLast') return 'npc_knock_last';
  if (k === 'ownDown') return 'npc_own_down';
  if (k === 'ownDownLast') return 'npc_own_down_last';
  return null;
}

/** 決着のひと言：主人公が勝った＝NPC の負け（npc_lose）、それ以外（NPC が勝った・引き分け）＝npc_win（今までと同じ分け方） */
export function resultLineKey(winner: Side | 'draw' | null): NpcLineKey {
  return winner === 'player' ? 'npc_lose' : 'npc_win';
}

/**
 * ひと言の強さ（上の数ほど優先。出ているひと言より弱いひと言は、出ている間は出さない）。
 * 決着・切り札の最後の撃破 ＞ 切り札の撃破（続く）＞ 撃破・残り1体・始め ＞ そのほかの反応
 */
export function npcLinePriority(key: NpcLineKey | NpcExtraKey): number {
  if (key === 'npc_win' || key === 'npc_lose' || key === 'ace_down_final') return 4;
  if (key === 'ace_down_continue') return 3;
  if (key === 'start' || key === 'rematch_start' || key.startsWith('npc_knock') || key.startsWith('npc_own_down')) return 2;
  return 1;
}

/** 途中の反応（命中・防御・回避）か */
export function isMidReaction(key: NpcLineKey | NpcExtraKey): boolean {
  return npcLinePriority(key) === 1;
}

/** 途中の反応の回数の上限（1試合。2026-11-05 指示書の初期値は約3回。人によって少なめ・多め） */
export const MID_REACTIONS_DEFAULT = 3;
const MID_REACTIONS_BY_ACTOR: Readonly<Record<string, number>> = { guardian: 2, ivan: 2, aurelio: 2, claude: 2, pete: 4, mireille: 4, zephyra: 4 };

export function midReactionLimit(actorId: string): number {
  return MID_REACTIONS_BY_ACTOR[actorId] ?? MID_REACTIONS_DEFAULT;
}

/**
 * 途中の反応を出すかどうか（1手番に1回まで・1試合の上限まで。出すときも半分くらいに間引いて、始めの手番ばかりにならないように）。
 * roll は 0〜1 の数（対戦の種と回数から決める。同じ対戦なら同じ）
 */
export function midReactionAllowed(o: { readonly used: number; readonly limit: number; readonly turn: number; readonly lastTurn: number; readonly roll: number }): boolean {
  return o.used < o.limit && o.turn !== o.lastTurn && o.roll < 0.5;
}

/** 0〜1 の数（種と番号から。Math.random を使わない） */
export function talkRoll(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
