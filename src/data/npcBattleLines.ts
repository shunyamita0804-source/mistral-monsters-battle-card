import type { NpcExtraKey, NpcLineKey } from '../game/battle/npcTalk.ts';
import type { LocalText } from './people.ts';
import { NPC_BATTLE_ACTORS } from './npcBattleLines.generated.ts';
import type { OpponentDefinition } from './tournaments.ts';

/**
 * NPC バトルセリフ 43 名（2026-11-05 第1弾。正本 design-parts/npc-battle-lines-20261105/data/npc_battle_lines.json）。
 * 表は tools/data/npc_battle_lines.py が作る npcBattleLines.generated.ts。日本語はユーザー承認の文そのまま、英語は**仮訳（未承認）**。
 * - status：approved（承認）・approved_silent_no_bubble（無言。吹き出しを出さない）・reconstruction_pending_text_check（ガレス：原文照合待ち）・
 *   proposed_not_approved（ガレスの残り1体の2本：未承認なので出さず、今までの共通のひと言にする）・provisional_ace_pending_replacement（アウレリオの切り札：仮）
 * - 対戦相手との結びつけは、対戦相手の ID（opponentIds）か顔のキー（opponentFaces）。ダンジョンの通常バトラーは ID が共通（enc-run-npc）なので顔を見る。
 *   大会の一般出場者8名（gen-*）・E 大会のマリーの代役（e-marie。顔は gen-marie）・ガレス（exam-teacher）・ピート（town-pete）もここで結びつける
 * - ミレイユは、いまのゲームに対戦が無いので、結びつけていない（未接続）
 */
export interface NpcBattleLine {
  /** null＝無言（吹き出しを出さない） */
  readonly ja: string | null;
  readonly en: string | null;
  readonly status: string;
}

export interface NpcBattleActor {
  readonly id: string;
  readonly opponentIds: readonly string[];
  readonly opponentFaces: readonly string[];
  readonly status: string;
  readonly lines: Readonly<Record<NpcLineKey, NpcBattleLine>>;
  readonly extra?: Partial<Readonly<Record<NpcExtraKey, NpcBattleLine>>>;
}

export { NPC_BATTLE_ACTORS };

/** 表示しない（未承認の）セリフ。今までの共通のひと言にする */
const HIDDEN_STATUS = new Set(['proposed_not_approved']);

/** その対戦相手の人（いなければ undefined。今までの共通のひと言を使う） */
export function npcActorOf(opponent: Pick<OpponentDefinition, 'id' | 'face'>): NpcBattleActor | undefined {
  return (
    NPC_BATTLE_ACTORS.find((a) => a.opponentIds.includes(opponent.id)) ??
    (opponent.face !== undefined ? NPC_BATTLE_ACTORS.find((a) => a.opponentFaces.includes(opponent.face as string)) : undefined)
  );
}

/**
 * その人のその場面のひと言。
 * - LocalText：出すひと言
 * - null：無言（吹き出しを出さない。共通のひと言にもしない）
 * - undefined：その人のひと言が無い・未承認（今までの共通のひと言を使う）
 */
export function npcLine(actor: NpcBattleActor | undefined, key: NpcLineKey | NpcExtraKey): LocalText | null | undefined {
  if (!actor) return undefined;
  const line = (actor.lines as Partial<Record<string, NpcBattleLine>>)[key] ?? actor.extra?.[key as NpcExtraKey];
  if (!line || HIDDEN_STATUS.has(line.status)) return undefined;
  if (line.ja === null) return null;
  return { ja: line.ja, en: line.en ?? line.ja };
}
