import type { TournamentDefinition } from '../../data/tournaments.ts';
import { nextInt, shuffle } from '../rng.ts';

/**
 * 大会の出場者と組み合わせ（2026-10-27 指示書「大会の新しい形」）。DOM・セーブに依存しない。
 * - 総当たり（E・D）：[主人公, 相手3人]。n 回目は主人公と rounds[n]、残りの2人どうし
 * - トーナメント（C〜S）：8人を山の順に並べる。0〜3 が左の山、4〜7 が右の山。主人公は左の山のいちばん上（0）
 *   1回戦は (0,1)(2,3)(4,5)(6,7)、準決勝は左右の山の中で、決勝は左右の勝ち残りどうし
 */

/** 出場者の中の主人公 */
export const PLAYER_ENTRANT = 'player';

/** 総当たりの試合数・トーナメントの回戦数（どちらも主人公は3試合） */
export const TOURNAMENT_ROUNDS = 3;

/** 参加ID から決まる seed（前の形式のセーブで seed が無いとき） */
export function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % 0x7fffffff;
}

/**
 * 出場者を決める。トーナメントは常連が毎回出て、一般の出場者は組の中から必要な人数をランダム。
 * 決勝まで必ず勝ち上がる人（C：シエナ、S：アルヴィン）は主人公と反対の山（右）に置く。
 * siennaLeft（「シエナがいなくなった」の記録があるとき）は、シエナの代わりの人が出る（決勝まで勝ち上がる決まりはなくなる）
 */
export function drawEntrants(t: TournamentDefinition, seed: number, siennaLeft = false): string[] {
  const swap = siennaLeft ? t.siennaLeft : undefined;
  const idOf = (id: string): string => (swap && id === swap.replace ? swap.with.id : id);
  if (t.format === 'league' || !t.bracket) return [PLAYER_ENTRANT, ...t.rounds.map((r) => idOf(r.id))];
  const b = t.bracket;
  const finalist = b.finalist && idOf(b.finalist) === b.finalist ? b.finalist : null;
  let s = seed;
  const general = shuffle(b.pool.map((o) => o.id), s);
  s = general.seed;
  const others = [...b.regulars.map((o) => idOf(o.id)), ...general.items.slice(0, b.generalCount)].filter((id) => id !== finalist);
  const mixed = shuffle(others, s);
  s = mixed.seed;
  const slots: (string | null)[] = [PLAYER_ENTRANT, null, null, null, null, null, null, null];
  if (finalist) {
    const r = nextInt(s, 4);
    s = r.seed;
    slots[4 + r.value] = finalist;
  }
  let i = 0;
  return slots.map((x) => x ?? (mixed.items[i++] as string));
}
