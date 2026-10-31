import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../src/data/dungeons.ts';
import { RUN_DUNGEON_IDS, runBattlerFace, runBossOpponent, runNpcOpponent } from '../src/data/dungeonRun.ts';
import { getPerson, PEOPLE, personOfOpponent } from '../src/data/people.ts';

/** 2026-10-28 指示書「ダンジョンの人物12人（守り手7人・バトラー5人）」 */
const KEEPERS = ['grant', 'sera', 'lucia', 'ivan', 'balka', 'teo', 'aurelio'];
const BATTLERS = ['pia', 'hans', 'zack', 'otto', 'mina'];
/** RUN_DUNGEON_IDS の並び（風の渓谷〔2026-10-30 指示書 U〕は水の神殿の次）の守り手 */
const KEEPERS_IN_RUN_ORDER = ['grant', 'sera', 'lucia', 'zephyra', 'ivan', 'balka', 'stella', 'teo', 'aurelio'];

describe('ダンジョンの人物12人（2026-10-28）', () => {
  it('名刺図鑑の No. は 29〜40（今の 1〜28 は変えない）。どの人もせりふが日本語と英語の両方', () => {
    [...KEEPERS, ...BATTLERS].forEach((id, i) => {
      const p = getPerson(id);
      expect(p, id).toMatchObject({ no: 29 + i, group: 'dungeon', inGame: true });
      for (const k of ['meet', 'start', 'win', 'lose'] as const) {
        expect(p?.lines?.[k].ja, `${id} ${k}`).toBeTruthy();
        expect(p?.lines?.[k].en, `${id} ${k}`).toBeTruthy();
      }
    });
    expect(getPerson('flora')?.no).toBe(18);
    expect(PEOPLE.find((p) => p.no === 28)?.id).toBe('alvin');
  });

  it('8つのダンジョン（2026-10-30 に風の渓谷）のボスは、そのダンジョンの守り手（編成・強さは変えない）。勝ったあとのひと言（祭壇へ）がある', () => {
    expect(RUN_DUNGEON_IDS).toHaveLength(9); // 2026-11-01 指示書 AH：雷の高原
    RUN_DUNGEON_IDS.forEach((id, i) => {
      const boss = runBossOpponent(id);
      const person = personOfOpponent(boss);
      expect(person?.id, id).toBe(KEEPERS_IN_RUN_ORDER[i]);
      expect(boss.name).toBe(person?.name.ja);
      expect(person?.lines?.after?.ja).toContain('祭壇');
      expect(boss.monsters).toHaveLength(3);
    });
    // 遺跡のボスのモンスターはジオル（2026-10-29 から）、森はフルーネ（2026-10-29 フルーネの最終から）
    expect(runBossOpponent('dungeon-01').monsters[1]).toBe('mon-geol');
    expect(runBossOpponent('dungeon-02').monsters[1]).toBe('mon-flune');
    expect(DUNGEONS).toHaveLength(9);
  });

  it('新しい5つのバトラーは「そのダンジョンの人＋今の3人のうち2人」（1つの階で同じ人は出ない）。遺跡・森は今の3人のまま', () => {
    ['dungeon-03', 'dungeon-04', 'dungeon-05', 'dungeon-06', 'dungeon-07'].forEach((id, i) => {
      // 階の中の番号は 1〜3（generate.ts の npc-1〜3）
      const faces = [1, 2, 3].map((n) => runBattlerFace(n, id));
      const people = faces.map((f) => personOfOpponent({ id: 'enc-run-npc', face: f })?.id);
      expect(people[0], id).toBe(BATTLERS[i]);
      // 2026-10-30 指示書 O3：1つの階では同じ人を出さない（前は 1 と 3 が同じ人）。2・3 は今の3人のうちの別々の人
      expect(['flora', 'oscar', 'kyle']).toContain(people[1]);
      expect(['flora', 'oscar', 'kyle']).toContain(people[2]);
      expect(new Set(people).size, id).toBe(3);
      expect(personOfOpponent(runNpcOpponent(0, 1, id))?.id).toBe(BATTLERS[i]);
    });
    for (const id of ['dungeon-01', 'dungeon-02']) {
      const people = [1, 2, 3].map((n) => personOfOpponent({ id: 'enc-run-npc', face: runBattlerFace(n, id) })?.id);
      expect(new Set(people)).toEqual(new Set(['flora', 'oscar', 'kyle']));
    }
  });
});
