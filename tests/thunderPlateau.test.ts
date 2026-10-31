import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RANK_BOSS_DUNGEONS, THUNDER_BOSS_WAIVED_FLAG } from '../src/data/calendar.ts';
import { DUNGEONS, ENCOUNTERS, STELLA_BEATEN_FLAG } from '../src/data/dungeons.ts';
import { RUN_DUNGEONS, runBattlerFace, runBossOpponent, runConfig, runCpuSkill } from '../src/data/dungeonRun.ts';
import { DUNGEON_MONEY } from '../src/data/economy.ts';
import { HAKURAN_MONSTER_ID } from '../src/data/hakuran.ts';
import { getPerson, personOfOpponent } from '../src/data/people.ts';
import { getTournament } from '../src/data/tournaments.ts';
import { DUNGEON_SPOTS } from '../src/data/worldMap.ts';
import { missingBosses } from '../src/game/calendar/calendar.ts';
import { isWalkableTile, reachable, type DungeonFloor, type Point } from '../src/game/dungeon/generate.ts';
import { activeEntities, bossRewardCandidates, bossTrumpSkills, descend, move, rollChest, runFloor, startRun, winRunBattle } from '../src/game/dungeon/run.ts';
import { THUNDER_MAX, THUNDER_MIN, thunderForecast, walkableNeighbors } from '../src/game/dungeon/thunder.ts';
import { availableGachaSeriesFor } from '../src/game/economy/gachaSeries.ts';
import { entryCheck } from '../src/game/progress/tournament.ts';
import { createNewSave, normalizeSave, SAVE_VERSION, unlockedDungeonsFor, type Direction, type DungeonRun, type SaveData } from '../src/game/save/saveData.ts';
import { dungeonName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/**
 * 雷の高原（2026-11-01 指示書 AH）：B ランクの2つ目のダンジョン・落雷のマス・守り手ステラ・バトラーのルカ。作りは風の渓谷（tests/windValley.test.ts）とほぼ同じ。
 * 落雷の自動の歩き（1階あたり予告が出た回数・雷に打たれた回数）は PLAYTEST_OUT に書き出す（npm run playtest:thunder）
 */
const ID = 'dungeon-09';
const base = (): SaveData => createNewSave(new Date('2026-11-01T00:00:00Z'), 'balance');
const runOf = (s: SaveData): DungeonRun => {
  if (!s.dungeonRun) throw new Error('挑戦していない');
  return s.dungeonRun;
};
const DIRS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const STEP: Readonly<Record<Direction, Point>> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const key = (p: Point): string => `${p.x},${p.y}`;

describe('雷の高原：ダンジョンの値', () => {
  it('B ランクで開く・地下5階・炎の火山と同じ段（見える範囲 1・番人 0.3・負けられる回数 3・番人のライフ −0.2・お金も同じ）・炎の火山の次に並ぶ', () => {
    expect(DUNGEONS.find((d) => d.id === ID)).toMatchObject({
      name: '雷の高原',
      description: '雷雲のかかる岩の台地。地面が光ったら、次の一歩でそこに雷が落ちる。最奥のボスを倒すとクリア。',
      trumpReward: true,
      bossFlag: STELLA_BEATEN_FLAG,
      firstClearCards: [{ cardId: HAKURAN_MONSTER_ID, count: 1 }],
    });
    expect(STELLA_BEATEN_FLAG).toBe('thunder-boss-beaten');
    expect(runConfig(ID)).toMatchObject({ floors: 5, gimmick: 'thunder', unlockRank: 'B', viewRadius: 1, guardianRate: 0.3, maxLosses: 3, guardianLifeBonus: -0.2, bossId: 'enc-thunder-boss' });
    expect(runConfig(ID).floorLife).toEqual([1, 1.1, 1.2, 1.3, 1.4]);
    expect(runConfig(ID).floorLife).toEqual(runConfig('dungeon-05').floorLife);
    expect(runConfig(ID).npcTeams).toEqual([
      ['mon-nobiton', 'mon-pukarim', 'mon-kalshell'],
      ['mon-pukarim', 'mon-nobiton', 'mon-myurol'],
    ]);
    expect(runConfig(ID).guardianTeam).toEqual(['mon-nobiton', 'mon-kalshell', 'mon-pukarim']);
    expect(JSON.stringify(RUN_DUNGEONS[ID])).not.toContain('hakuran');
    expect(runCpuSkill(ID, 1)).toBe('B');
    expect(DUNGEON_MONEY[ID]).toEqual(DUNGEON_MONEY['dungeon-05']);
    const ids = DUNGEONS.map((d) => d.id);
    expect(ids.indexOf(ID)).toBe(ids.indexOf('dungeon-05') + 1);
    expect(Object.keys(RUN_DUNGEONS).indexOf(ID)).toBe(Object.keys(RUN_DUNGEONS).indexOf('dungeon-05') + 1);
    expect(DUNGEON_SPOTS[ID]).toBeDefined();
  });

  it('C ランクでは開かず、B ランクに上がると開く（前のセーブも読み込むと B なら開く）', () => {
    expect(unlockedDungeonsFor('C', [])).not.toContain(ID);
    expect(unlockedDungeonsFor('B', [])).toContain(ID);
    const old = normalizeSave(JSON.parse(JSON.stringify({ ...base(), version: 31, rank: 'B' })));
    expect(old?.unlockedDungeons).toContain(ID);
  });

  it('英語の名前（仮訳）', () => {
    setLanguage('en');
    try {
      expect(dungeonName(DUNGEONS.find((d) => d.id === ID) as never)).toBe('Thunder Plateau');
    } finally {
      setLanguage('ja');
    }
  });

  it('絵：原本は無改変で保管。床・壁・階段・飾り5つ・落雷の印と稲妻・ボスのしるし・対戦の背景・入るときの絵と輪・題字', () => {
    for (const f of ['tiles', 'parts', 'strike', 'battle_bg', 'boss_mark', 'art', 'overlay', 'title']) {
      expect(readFileSync(`design-parts/dungeons5-20261028/thunder/thunder_plateau_${f}.png`).length, f).toBeGreaterThan(0);
    }
    for (const f of ['floor', 'wall_top', 'wall_face', 'stairs_down', 'pillar', 'rock', 'fallen', 'rod', 'grass', 'mark', 'bolt']) {
      expect(existsSync(`assets/images/maps/dungeon/thunder_${f}.webp`), f).toBe(true);
    }
    expect(existsSync('assets/images/maps/dungeon/boss_mark_thunder.webp')).toBe(true);
    expect(existsSync('assets/images/backgrounds/battle_thunder.webp')).toBe(true);
    for (const f of ['art', 'overlay', 'title']) expect(existsSync(`assets/images/ui/dungeon_intro/thunder_${f}.webp`), f).toBe(true);
    expect(readFileSync('src/ui/screens/dungeonRunScreen.ts', 'utf8')).toMatch(/BOSS_OWN_BG[^;]*'dungeon-09'/);
  });

  it('曲：Dungeon_Tower（通常版）を雷の高原に。クレジット（CC BY 4.0）。レトロ版は保管だけ', () => {
    expect(readFileSync('assets/audio/bgm/bgm_dungeon_thunder.mp3').equals(readFileSync('design-parts/bgm-ah-20261101/PerituneMaterial_Dungeon_Tower_loop.mp3'))).toBe(true);
    for (const ext of ['ogg', 'mp3', 'm4a']) expect(existsSync(`design-parts/bgm-ah-20261101/PerituneMaterial_Dungeon_Tower_Retro_loop.${ext}`)).toBe(true);
    const credit = readFileSync('src/i18n/messages/screens.ts', 'utf8');
    expect(credit).toContain('Dungeon_Tower　作曲：むつき醒（Sei Mutsuki）／PeriTune（https://peritune.com/）　CC BY 4.0');
    expect(readFileSync('docs/audio-credits.md', 'utf8')).toContain('Dungeon_Tower　作曲：むつき醒（Sei Mutsuki）／PeriTune（https://peritune.com/）　CC BY 4.0');
    expect(readFileSync('src/ui/screens/dungeonRunScreen.ts', 'utf8')).toContain("'dungeon-09': 'dungeonThunder'");
  });
});

describe('人：守り手ステラ・バトラーのルカ', () => {
  it('名刺図鑑：ステラ 43・ルカ 44。肩書き・ひとこと・せりふ（進行の案）', () => {
    const s = getPerson('stella');
    const l = getPerson('luka');
    expect(s).toMatchObject({ no: 43, group: 'dungeon', name: { ja: 'ステラ', en: 'Stella' }, title: { ja: '高原の守り手・一族の記録係', en: 'Plateau Keeper, clan archivist' } });
    expect(l).toMatchObject({ no: 44, group: 'dungeon', name: { ja: 'ルカ', en: 'Luka' }, title: { ja: '観測所の見習い', en: 'Observatory Apprentice' } });
    expect(s?.line.ja).toBe('雷は気まぐれじゃないの。計算すれば、ちゃんと当たるわ。');
    expect(l?.line.ja).toBe('雲の形と風の向き、毎日ちゃんと書き留めてます！');
    expect(s?.lines?.start.ja).toBe('勝つ確率は計算済みよ。さあ、始めましょう。');
    expect(s?.lines?.after?.ja).toContain('祭壇は星図の門の先よ。ハクランが待っているわ。');
    expect(l?.lines?.meet.ja).toContain('光った地面には近づかないでくださいね');
    expect(l?.lines?.after).toBeUndefined();
    expect(personOfOpponent(ENCOUNTERS['enc-thunder-boss'] as never)?.id).toBe('stella');
  });

  it('ボス ステラ：ノビトン・ハクラン（真ん中・切り札）・プカリム・腕前 A', () => {
    expect(ENCOUNTERS['enc-thunder-boss']).toMatchObject({ name: 'ステラ', monsters: ['mon-nobiton', HAKURAN_MONSTER_ID, 'mon-pukarim'], ace: HAKURAN_MONSTER_ID, skill: 'A', lifeScale: 1 });
    expect(runBossOpponent(ID).monsters[1]).toBe(HAKURAN_MONSTER_ID);
  });

  it('バトラー：階の中の番号 1 がルカ、2 がオスカー（guest 2）', () => {
    expect(runBattlerFace(1, ID)).toBe('battler-luka');
    expect(runBattlerFace(2, ID)).toBe('battler-2');
    expect(readFileSync('src/ui/components/dungeonPeopleArt.ts', 'utf8')).toContain("'battler-luka': standLuka");
  });
});

describe('入手の流れ', () => {
  it('初回クリア：祭壇でハクランのモンスターカード1枚・thunder-boss-beaten。2回目から：ハクランの技カード1枚。宝箱の技カードもハクランの技', () => {
    let s: SaveData = { ...base(), rank: 'B' };
    s = startRun(s, ID, 4242);
    const first = winRunBattle({ ...s, dungeonRun: { ...runOf(s), floor: 4 } }, { kind: 'boss', id: 'boss' }, null);
    expect(first.firstClear).toBe(true);
    expect(first.clearCards).toEqual([{ cardId: HAKURAN_MONSTER_ID, count: 1 }]);
    expect(first.save.storyFlags).toContain(STELLA_BEATEN_FLAG);
    expect(availableGachaSeriesFor(first.save).map((x) => x.id)).toContain('hakuran');
    expect(bossTrumpSkills(ID).every((id) => id.startsWith('skl-hakuran-'))).toBe(true);
    const again = startRun(first.save, ID, 4243);
    const cands = bossRewardCandidates(again, ID, runBossOpponent(ID).monsters);
    expect(cands.length).toBeGreaterThan(0);
    expect(cands.every((id) => id.startsWith('skl-hakuran-'))).toBe(true);
    for (let i = 0; i < 40; i++) {
      const c = rollChest(ID, 900 + i, `chest-${i}`);
      if (c.kind === 'card') expect(c.card.startsWith('skl-hakuran-')).toBe(true);
    }
  });
});

describe('B の大会の出場条件・セーブ', () => {
  it('B の条件に雷の高原を足した（炎の火山・雷の高原）。受付の理由に出る', () => {
    expect(RANK_BOSS_DUNGEONS.B).toEqual(['dungeon-05', ID]);
    const fire = { 'dungeon-05': { openedChests: [], bossDefeated: true, clears: 1 } };
    const s = { ...base(), rank: 'B' as const, calendar: { year: 1, month: 9 }, dungeons: fire };
    expect(missingBosses(s, 'B')).toEqual([ID]);
    const b = getTournament('tournament-b');
    if (!b) throw new Error('tournament-b');
    expect(entryCheck(s, b).reasons).toEqual(['雷の高原のボスをまだ倒していません']);
  });

  it('前のセーブ（v31）ですでに B・B より上の人は、雷の高原のボスを倒していなくても B の大会に出られる（読み込むと条件からはずす記録が付く）', () => {
    for (const rank of ['B', 'A', 'S'] as const) {
      const old = normalizeSave(
        JSON.parse(JSON.stringify({ ...base(), version: 31, rank, calendar: { year: 1, month: 9 }, dungeons: { 'dungeon-05': { openedChests: [], bossDefeated: true, clears: 1 } } })),
      );
      if (!old) throw new Error('load');
      expect(old.version).toBe(SAVE_VERSION);
      expect(old.storyFlags, rank).toContain(THUNDER_BOSS_WAIVED_FLAG);
      expect(missingBosses(old, 'B'), rank).toEqual([]);
      const b = getTournament('tournament-b');
      if (!b) throw new Error('tournament-b');
      expect(entryCheck(old, b).reasons.some((r) => r.includes('雷の高原')), rank).toBe(false);
    }
  });

  it('前のセーブで C 以下の人・新しいセーブには、はずす記録は付かない（B に上がったら雷の高原のボスも倒す）', () => {
    for (const rank of ['E', 'D', 'C'] as const) {
      const old = normalizeSave(JSON.parse(JSON.stringify({ ...base(), version: 31, rank })));
      expect(old?.storyFlags, rank).not.toContain(THUNDER_BOSS_WAIVED_FLAG);
    }
    expect(base().storyFlags).not.toContain(THUNDER_BOSS_WAIVED_FLAG);
  });

  it('セーブの version は 32（B の大会の条件のため）', () => {
    expect(SAVE_VERSION).toBe(32);
  });
});

/** その階の挑戦（ボスの階も） */
function runAt(seed: number, floor: number): DungeonRun {
  let run = runOf(startRun({ ...base(), rank: 'B' }, ID, seed));
  for (let i = 0; i < floor; i++) run = descend(run);
  return run;
}

/** 予告の決まりを確かめる（ずれていたら理由の文） */
function checkForecast(f: DungeonFloor, run: DungeonRun): string | null {
  const marks = run.thunder?.marks ?? [];
  const set = new Set(marks.map(key));
  if (set.size !== marks.length) return '同じマスを2回予告';
  if (set.has(key(run))) return '主人公のマスに予告';
  if (f.stairs && set.has(key(f.stairs))) return '階段に予告';
  for (const e of activeEntities(run, f)) {
    if (e.kind === 'guardian') continue;
    if (set.has(key(e))) return `${e.kind} のマスに予告`;
    if (e.kind === 'boss') for (const d of DIRS) if (set.has(key({ x: e.x + STEP[d].x, y: e.y + STEP[d].y }))) return 'ボスのとなりに予告';
  }
  for (const p of marks) {
    if (!isWalkableTile(f.tiles[p.y]?.[p.x])) return '床でないマスに予告';
    if (Math.abs(p.x - run.x) > 2 || Math.abs(p.y - run.y) > 2) return '遠いマスに予告';
  }
  const near = walkableNeighbors(f, run, activeEntities(run, f));
  if (near.length > 0 && near.every((p) => set.has(key(p)))) return '安全なとなりのマスが無い';
  if (marks.length > THUNDER_MAX) return '予告が多すぎる';
  return null;
}

describe('落雷のマス（gimmick thunder）', () => {
  it('1歩ごとに「予告 → 次の1歩のあとに落雷」。予告は2〜4マス。前の予告のマスに稲妻が落ちる', () => {
    let run = runAt(11, 0);
    expect(run.thunder ?? null).toBeNull();
    const f = runFloor(run);
    let prev: readonly Point[] = [];
    let steps = 0;
    for (let i = 0; i < 200 && steps < 30; i++) {
      const r = move(run, DIRS[i % 4] as Direction);
      if (!r.moved) {
        run = r.run;
        continue;
      }
      steps++;
      expect(r.strikes).toEqual(prev);
      run = r.run;
      const marks = run.thunder?.marks ?? [];
      expect(marks.length).toBeLessThanOrEqual(THUNDER_MAX);
      prev = marks;
      expect(checkForecast(f, run)).toBeNull();
    }
    expect(steps).toBe(30);
  });

  it('予告のマスへ1歩動いたら「雷に打たれた！」：見えない番人との対戦（番人の体ではない ID。倒しても階の番人は減らない）', () => {
    // 予告のマスがとなりに来るまで歩いて、そこへ踏み込む
    for (let seed = 1; seed < 200; seed++) {
      let run = runAt(seed, 0);
      for (let i = 0; i < 60; i++) {
        const marks = run.thunder?.marks ?? [];
        const d = DIRS.find((dd) => marks.some((p) => p.x === run.x + STEP[dd].x && p.y === run.y + STEP[dd].y));
        if (d) {
          const r = move(run, d);
          if (!r.moved) break;
          expect(r.thunderStruck).toBe(true);
          expect(r.guardian?.kind).toBe('guardian');
          expect(r.guardian?.id).toMatch(/^f0-strike-\d+$/);
          const before = activeEntities(run, runFloor(run)).filter((e) => e.kind === 'guardian').length;
          const won = winRunBattle({ ...base(), dungeonRun: r.run }, { kind: 'guardian', id: r.guardian?.id ?? '' }, null);
          expect(activeEntities(runOf(won.save), runFloor(r.run)).filter((e) => e.kind === 'guardian').length).toBe(before);
          return;
        }
        const r = move(run, DIRS[(i * 7 + seed) % 4] as Direction);
        run = r.run;
        if (r.thunderStruck) return;
      }
    }
    throw new Error('予告のマスへ踏み込めなかった');
  });

  it('同じ階・同じ歩き方なら同じ予告（乱数は挑戦の種・階・歩数・位置から）', () => {
    const walk = (): string => {
      let run = runAt(77, 1);
      const out: string[] = [];
      for (let i = 0; i < 40; i++) {
        run = move(run, DIRS[(i * 3) % 4] as Direction).run;
        out.push(JSON.stringify(run.thunder?.marks ?? []));
      }
      return out.join('|');
    };
    expect(walk()).toBe(walk());
    const f = runFloor(runAt(77, 1));
    expect(thunderForecast(f, f.start, f.entities, 77, 1, 5)).toEqual(thunderForecast(f, f.start, f.entities, 77, 1, 5));
    expect(THUNDER_MIN).toBe(2);
  });

  it('150シード×5階：どこからでも安全な1歩がある（歩けるとなりがあれば、予告していないとなりが1つ以上）・予告の決まり・階段とボスへ行ける', () => {
    const problems: string[] = [];
    for (let seed = 1; seed <= 150; seed++) {
      for (let floor = 0; floor < 5; floor++) {
        const run0 = runAt(seed, floor);
        const f = runFloor(run0);
        // 階段（最後の階はボスのとなり）へ行ける（落雷は通れるマスを変えない）
        const goal = f.stairs ?? f.entities.find((e) => e.kind === 'boss');
        if (!goal) problems.push(`${seed}/${floor} 階段もボスも無い`);
        const reach = reachable(f.tiles, f.start, (x, y) => f.entities.some((e) => e.kind !== 'guardian' && e.kind !== 'boss' && e.x === x && e.y === y), true, f.stairs);
        const ok = f.stairs ? reach.has(key(f.stairs)) : DIRS.some((d) => goal && reach.has(key({ x: goal.x + STEP[d].x, y: goal.y + STEP[d].y })));
        if (!ok) problems.push(`${seed}/${floor} 階段・ボスへ行けない`);
        // 歩いて、毎歩の予告を確かめる
        let run = run0;
        for (let i = 0; i < 40; i++) {
          const r = move(run, DIRS[(i * 5 + seed + floor) % 4] as Direction);
          run = r.run;
          if (!r.moved) continue;
          const bad = checkForecast(f, run);
          if (bad) problems.push(`${seed}/${floor} ${bad}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

/** 階段（最後の階はボスのとなり）へいちばん近い道（落雷の予告を避けるか：avoid） */
function nextDir(run: DungeonRun, f: DungeonFloor, avoid: boolean): Direction | null {
  const goal = f.stairs ?? f.entities.find((e) => e.kind === 'boss') ?? null;
  if (!goal) return null;
  const blocked = new Set(activeEntities(run, f).filter((e) => e.kind !== 'guardian').map(key));
  const marks = new Set((run.thunder?.marks ?? []).map(key));
  const goals = f.stairs ? [key(goal)] : DIRS.map((d) => key({ x: goal.x + STEP[d].x, y: goal.y + STEP[d].y }));
  // 主人公の位置からの幅優先（最初の1歩の向きを覚える）
  const seen = new Map<string, Direction>();
  const queue: { p: Point; first: Direction }[] = [];
  for (const d of DIRS) {
    const p = { x: run.x + STEP[d].x, y: run.y + STEP[d].y };
    if (!isWalkableTile(f.tiles[p.y]?.[p.x]) || blocked.has(key(p)) || (avoid && marks.has(key(p)))) continue;
    seen.set(key(p), d);
    queue.push({ p, first: d });
  }
  while (queue.length > 0) {
    const { p, first } = queue.shift() as { p: Point; first: Direction };
    if (goals.includes(key(p))) return first;
    for (const d of DIRS) {
      const q = { x: p.x + STEP[d].x, y: p.y + STEP[d].y };
      if (seen.has(key(q)) || !isWalkableTile(f.tiles[q.y]?.[q.x]) || (blocked.has(key(q)) && !(f.stairs && key(q) === key(f.stairs)))) continue;
      seen.set(key(q), first);
      queue.push({ p: q, first });
    }
  }
  // 避けられないときは近道のまま
  return avoid ? nextDir(run, f, false) : null;
}

describe('落雷の自動の歩き（1階あたり予告が出た回数・雷に打たれた回数）', () => {
  it('階段（最後の階はボス）へまっすぐ歩く：予告を見ない歩き方と、予告を避ける歩き方', () => {
    const SEEDS = Number(process.env.PLAYTEST ?? 10);
    const result: Record<string, { floors: number; steps: number; forecasts: number; marks: number; struck: number; struckPerFloor: number; stepsPerFloor: number }> = {};
    for (const avoid of [false, true]) {
      let floors = 0;
      let steps = 0;
      let forecasts = 0;
      let marks = 0;
      let struck = 0;
      for (let seed = 1; seed <= SEEDS; seed++) {
        for (let floor = 0; floor < 5; floor++) {
          let run = runAt(seed, floor);
          const f = runFloor(run);
          for (let i = 0; i < 400; i++) {
            const d = nextDir(run, f, avoid);
            if (!d) break;
            const r = move(run, d);
            run = r.run;
            if (!r.moved) break;
            steps++;
            forecasts++;
            marks += run.thunder?.marks.length ?? 0;
            if (r.thunderStruck) struck++;
            if (f.stairs && run.x === f.stairs.x && run.y === f.stairs.y) break;
            const boss = f.entities.find((e) => e.kind === 'boss');
            if (boss && Math.abs(boss.x - run.x) + Math.abs(boss.y - run.y) === 1) break;
          }
          floors++;
        }
      }
      result[avoid ? 'avoid' : 'straight'] = {
        floors,
        steps,
        forecasts,
        marks,
        struck,
        struckPerFloor: Math.round((struck / floors) * 100) / 100,
        stepsPerFloor: Math.round((steps / floors) * 10) / 10,
      };
    }
    if (process.env.PLAYTEST_OUT) {
      mkdirSync(dirname(process.env.PLAYTEST_OUT), { recursive: true });
      writeFileSync(process.env.PLAYTEST_OUT, JSON.stringify({ seeds: SEEDS, result }, null, 1));
    }
    // 予告を避ければ、ほとんど打たれない（避けられないときだけ）
    expect(result.avoid?.struck ?? 0).toBeLessThanOrEqual(result.straight?.struck ?? 0);
  }, 600_000);
});
