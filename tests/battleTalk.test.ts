import { describe, expect, it } from 'vitest';
import { knockTalk } from '../src/game/battle/talk.ts';

const team = (...lives: number[]) => lives.map((life) => ({ life }));

describe('モンスターが倒れたときの相手のひと言（2026-10-28：2体目・3体目でも「まず1体」と言っていた）', () => {
  it('こちらのモンスターが倒れた：1体目は「まず1体」、2体目は「あと1体」、3体目は言わない（勝ちのひと言が出る）', () => {
    expect(knockTalk('player', team(0, 3, 3))).toBe('knock');
    expect(knockTalk('player', team(0, 0, 3))).toBe('knockLast');
    expect(knockTalk('player', team(0, 0, 0))).toBeNull();
  });

  it('相手のモンスターが倒れた：1体目は「まだまだ」、2体目は「後がない」、3体目は言わない（負けのひと言が出る）', () => {
    expect(knockTalk('opponent', team(2, 0, 1))).toBe('ownDown');
    expect(knockTalk('opponent', team(0, 1, 0))).toBe('ownDownLast');
    expect(knockTalk('opponent', team(0, 0, 0))).toBeNull();
  });
});
