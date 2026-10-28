import { skillsOf } from '../../data/cards.ts';
import { PUKARIM_MONSTER_ID } from '../../data/pukarim.ts';
import { NOBITON_MONSTER_ID } from '../../data/nobiton.ts';
import { SORAMO_MONSTER_ID } from '../../data/soramo.ts';
import type { OpponentDefinition } from '../../data/tournaments.ts';
import { pickRewardChoices, rewardCandidates } from '../dungeon/run.ts';
import { addCards, hasProcessed, markProcessed, type SaveData } from '../save/saveData.ts';
import { isIntroV2Done } from './introV2.ts';

/**
 * ピート（カードショップの前の住人）との勝負（2026-10-29 指示書「プカリムの最終」3章。design-parts/cards-original/pukarim/final-20261028/）。
 * - 管理局で箱を受け取ったあと（前の形式のセーブ・導入を飛ばしたセーブも）に話しかけると勝負できる。受け取る前は今までの住人の台詞
 * - 初めて勝ったとき：プカリムのモンスターカード1枚。そのあと、カードショップのガチャにプカリムのシリーズが並ぶ
 * - 負けたとき：何も失わない。何度でも挑める
 * - 2回目からの勝ち：プカリムの技カード1枚（ダンジョンで勝ったときと同じ決め方：プカリムの技からランダムに1枚。お金はなし）
 * セーブ：初回の報酬を受け取ったかは storyFlags の PETE_BEATEN_FLAG（前のセーブには無い＝まだ。形式は変えない）
 */
export const PETE_BEATEN_FLAG = 'pete-beaten';

/** ピートのデッキ：プカリム・ソラモ・ノビトン。強さは大会 E の最初の相手（ノエル）と同じくらい（lifeScale 0.6） */
export const PETE_OPPONENT: OpponentDefinition = {
  id: 'town-pete',
  name: 'ピート',
  monsters: [PUKARIM_MONSTER_ID, SORAMO_MONSTER_ID, NOBITON_MONSTER_ID],
  lifeScale: 0.6,
  face: 'pete',
};

/** ピートと勝負できるか（管理局で箱を受け取った。前の形式のセーブ・導入を飛ばしたセーブも） */
export function canChallengePete(save: SaveData): boolean {
  const v = save.story.introV2;
  return v.boosterClaimed || isIntroV2Done(v);
}

/** ピートにもう勝ったか（初回の報酬を受け取ったか） */
export function hasBeatenPete(save: SaveData): boolean {
  return save.storyFlags.includes(PETE_BEATEN_FLAG);
}

export interface PeteWin {
  readonly save: SaveData;
  /** もらったカード */
  readonly cardId: string;
  /** 初めて勝った（モンスターカード） */
  readonly first: boolean;
}

/**
 * ピートに勝った：初回はプカリムのモンスターカード、2回目からはプカリムの技カード1枚。
 * battleId は1回の勝負ごとの ID（同じ勝ちを2回受け取らない）。random は 0 以上 1 未満を返す関数
 */
export function winPete(save: SaveData, battleId: string, random: () => number = Math.random): PeteWin {
  const tx = `pete-win:${battleId}`;
  const first = !hasBeatenPete(save);
  if (hasProcessed(save, tx)) return { save, cardId: '', first };
  if (first) {
    const next = addCards({ ...save, storyFlags: [...save.storyFlags, PETE_BEATEN_FLAG] }, [{ cardId: PUKARIM_MONSTER_ID, count: 1 }]);
    return { save: markProcessed(next, tx), cardId: PUKARIM_MONSTER_ID, first };
  }
  const cardId = pickRewardChoices(rewardCandidates([PUKARIM_MONSTER_ID], skillsOf), 1, random)[0] ?? '';
  const next = cardId ? addCards(save, [{ cardId, count: 1 }]) : save;
  return { save: markProcessed(next, tx), cardId, first };
}
