import { describe, expect, it } from 'vitest';
import { getPlayCard } from '../src/data/cards.ts';
import { personOfOpponent } from '../src/data/people.ts';
import { DECK_RULES } from '../src/data/rules.ts';
import { getTournament, TOURNAMENTS, tournamentOpponents, type TournamentDefinition } from '../src/data/tournaments.ts';
import { simulateBattle } from '../src/game/battle/simulate.ts';
import { buildOpponentDeck, countCards } from '../src/game/deck/deck.ts';
import {
  claimTournamentRewards,
  enterTournament,
  leagueStandings,
  nextOpponent,
  pairsOf,
  recordMatch,
  withdraw,
} from '../src/game/progress/tournament.ts';
import { drawEntrants, PLAYER_ENTRANT } from '../src/game/progress/tournamentDraw.ts';
import { createNewSave, FLAG_SIENNA_LEFT, normalizeSave, SAVE_VERSION, type SaveData, type TournamentMatch } from '../src/game/save/saveData.ts';
import { cupReady } from './support/cupReady.ts';

const tour = (id: string): TournamentDefinition => {
  const t = getTournament(id);
  if (!t) throw new Error(id);
  return t;
};
const C = tour('tournament-c');
const B = tour('tournament-b');
const A = tour('tournament-a');
const S = tour('tournament-s');
const E = tour('tournament-e');

const withRank = (rank: SaveData['rank']): SaveData => cupReady({ ...createNewSave(new Date('2026-10-27T00:00:00Z'), 'balance'), rank });
const match = (a: string, b: string, winner: string, aLeft: number, bLeft: number, aDamage: number, bDamage: number): TournamentMatch => ({ round: 0, a, b, winner, aLeft, bLeft, aDamage, bDamage });

describe('大会のデータ（仮）', () => {
  it('E・D は4人の総当たり、C〜S は8人のトーナメント', () => {
    expect(TOURNAMENTS.map((t) => [t.id, t.format, t.requiredRank])).toEqual([
      ['tournament-e', 'league', 'E'],
      ['tournament-d', 'league', 'D'],
      ['tournament-c', 'bracket', 'C'],
      ['tournament-b', 'bracket', 'B'],
      ['tournament-a', 'bracket', 'A'],
      ['tournament-s', 'bracket', 'S'],
    ]);
    expect(E.rounds.map((r) => personOfOpponent(r)?.id)).toEqual(['noel', 'viktor', 'sienna']);
    expect(tour('tournament-d').rounds.map((r) => personOfOpponent(r)?.id)).toEqual(['dario', 'isabella', 'gordon']);
  });

  it('常連はランクごとに指示書のとおり。一般の出場者の組と人数', () => {
    const regulars = (t: TournamentDefinition): (string | undefined)[] => t.bracket?.regulars.map((r) => personOfOpponent(r)?.id) ?? [];
    expect(regulars(C)).toEqual(['sienna', 'dolf', 'leonard']);
    expect(regulars(B)).toEqual(['dolf', 'leonard', 'greta', 'julius']);
    expect(regulars(A)).toEqual(['leonard', 'greta', 'julius', 'camilla']);
    expect(regulars(S)).toEqual(['julius', 'camilla', 'alvin']);
    const cb = ['gen-tobias', 'gen-marie', 'gen-jean', 'gen-helena'];
    const as = ['gen-claude', 'gen-beatrice', 'gen-zara', 'gen-walter'];
    expect([C, B, A, S].map((t) => [t.bracket?.pool.map((p) => p.id), t.bracket?.generalCount])).toEqual([[cb, 4], [cb, 3], [as, 3], [as, 4]]);
    // 一般の出場者は名刺図鑑に載せない
    for (const t of [C, B, A, S]) for (const p of t.bracket?.pool ?? []) expect(personOfOpponent(p)).toBeUndefined();
    expect([C, B, A, S].map((t) => t.bracket?.finalist)).toEqual(['reg-sienna', null, null, 'reg-alvin']);
  });

  it('強さは C＜B＜A＜S。勝率は仮の固定値（カミラ 91%・アルヴィン 100%）', () => {
    const scale = (t: TournamentDefinition): number => t.bracket?.pool[0]?.lifeScale ?? 0;
    expect(scale(C)).toBeLessThan(scale(B));
    expect(scale(B)).toBeLessThan(scale(A));
    expect(scale(A)).toBeLessThan(scale(S));
    const rate = (id: string): number | undefined => S.bracket?.regulars.find((r) => r.id === id)?.winRate;
    expect(rate('reg-camilla')).toBe(91);
    expect(rate('reg-alvin')).toBe(100);
  });

  it('報酬：初優勝 500/600/800/1000G とランクアップ。2回目以降は半分。参加賞 40/50/60/80G。パック・カードの景品なし', () => {
    expect([C, B, A, S].map((t) => [t.rewards.firstWin.coins, t.rewards.firstWin.rankUp, t.rewards.repeatWin.coins, t.rewards.participationCoins])).toEqual([
      [500, 'B', 250, 40],
      [600, 'A', 300, 50],
      [800, 'S', 400, 60],
      [1000, null, 500, 80],
    ]);
    for (const t of [C, B, A, S]) expect([t.rewards.firstWin.unlockPacks, t.rewards.firstWin.cards]).toEqual([[], []]);
  });
});

describe('常連のデッキと考え方（仮）', () => {
  it('どの相手のデッキも60枚・同じカードは上限まで', () => {
    for (const o of TOURNAMENTS.flatMap(tournamentOpponents)) {
      const deck = buildOpponentDeck(o);
      expect(deck.skills.length, o.id).toBe(DECK_RULES.skillCount);
      expect(Math.max(...Object.values(countCards(deck.skills))), o.id).toBeLessThanOrEqual(DECK_RULES.maxCopies);
    }
  });

  it('ドルフは守りを入れない・グレタは守りが多い・レナードは妨害入り・ユリウスは大技が多い', () => {
    const reg = (id: string) => [B, A, S].flatMap((t) => t.bracket?.regulars ?? []).find((r) => r.id === id)!;
    const types = (id: string): string[] => buildOpponentDeck(reg(id)).skills.map((c) => getPlayCard(c).effect.type);
    const guard = (list: string[]): number => list.filter((x) => x === 'defense' || x === 'evade').length;
    expect(guard(types('reg-dolf'))).toBe(0);
    expect(guard(types('reg-greta'))).toBeGreaterThanOrEqual(25);
    expect(types('reg-leonard').filter((x) => ['seal', 'weaken', 'taunt'].includes(x)).length).toBeGreaterThan(0);
    const bigMoves = buildOpponentDeck(reg('reg-julius')).skills.filter((c) => {
      const card = getPlayCard(c);
      return card.effect.type === 'attack' && card.cost >= 4;
    });
    expect(bigMoves.length).toBeGreaterThanOrEqual(15);
  });

  it('相手どうしの自動対戦：どの考え方でも最後まで進み、同じ seed なら同じ結果', () => {
    const regs = S.bracket?.regulars ?? [];
    const all = [...(B.bracket?.regulars ?? []), ...regs];
    for (const a of all) {
      const r = simulateBattle(a, regs[0]!, 42);
      expect(['a', 'b']).toContain(r.winner);
      expect(simulateBattle(a, regs[0]!, 42)).toEqual(r);
    }
  });
});

describe('総当たり（E・D）', () => {
  it('順位：勝ち数 → 勝った試合で残ったモンスター → 与えたダメージ → 抽選', () => {
    const entrants = ['player', 'x', 'y', 'z'];
    // 全員1勝… x と y は2勝で並ぶ。残ったモンスターは y が多い
    const matches = [
      match('player', 'x', 'x', 0, 1, 3, 9),
      match('y', 'z', 'y', 2, 0, 9, 2),
      match('player', 'y', 'player', 1, 0, 9, 5),
      match('x', 'z', 'x', 1, 0, 9, 4),
      match('player', 'z', 'z', 0, 1, 4, 9),
      match('x', 'y', 'y', 0, 1, 6, 9),
    ];
    // x:2勝（残り 1+1=2）、y:2勝（2+1=3）、player:1勝、z:1勝
    const order = leagueStandings({ entrants, matches, seed: 1 }).map((r) => r.id);
    expect(order.slice(0, 2)).toEqual(['y', 'x']);
    // player と z は1勝・残り1で並ぶ → 与えたダメージ（player 3+9+4=16、z 2+4+9=15）
    expect(order.slice(2)).toEqual(['player', 'z']);
  });

  it('すべて同じなら抽選。seed で決まり、同率1位は作らない', () => {
    const entrants = ['player', 'x', 'y', 'z'];
    const tie = [match('player', 'x', 'player', 1, 0, 5, 5), match('y', 'z', 'y', 1, 0, 5, 5)];
    const results = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const order = leagueStandings({ entrants, matches: tie, seed }).map((r) => r.id);
      expect(new Set(order).size).toBe(4);
      expect(leagueStandings({ entrants, matches: tie, seed }).map((r) => r.id)).toEqual(order);
      results.add(order[0]!);
    }
    expect([...results].sort()).toEqual(['player', 'y']);
  });

  it('1回の対戦で主人公が1試合、同じ回のほかの2人の試合は自動で決まる', () => {
    let s = enterTournament(withRank('E'), 'tournament-e', 'entry-l', 7);
    expect(s.activeTournament?.entrants).toEqual(['player', 'e-1', 'e-2', 'e-3']);
    expect(nextOpponent(E, s.activeTournament!)?.id).toBe('e-1');
    s = recordMatch(s, 0, { won: true, playerLeft: 2, opponentLeft: 0, damageDealt: 9, damageTaken: 3 });
    const m = s.activeTournament!.matches;
    expect(m.map((x) => [x.a, x.b])).toEqual([['player', 'e-1'], ['e-2', 'e-3']]);
    expect(m[0]).toMatchObject({ winner: 'player', aLeft: 2, aDamage: 9, bDamage: 3 });
    expect(nextOpponent(E, s.activeTournament!)?.id).toBe('e-2');
    s = recordMatch(s, 1, true);
    expect(s.activeTournament!.matches.slice(2).map((x) => [x.a, x.b])).toEqual([['player', 'e-2'], ['e-1', 'e-3']]);
    s = recordMatch(s, 2, true);
    // 3勝なら1位で優勝。6試合すべてうまる
    expect(s.activeTournament).toMatchObject({ status: 'won', round: 3 });
    expect(s.activeTournament!.matches).toHaveLength(6);
  });
});

describe('トーナメント（C〜S）', () => {
  it('出場者：主人公は左の山のいちばん上、常連は毎回、一般の出場者は組の中からランダム', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const e = drawEntrants(B, seed);
      expect(e).toHaveLength(8);
      expect(new Set(e).size).toBe(8);
      expect(e[0]).toBe(PLAYER_ENTRANT);
      for (const r of B.bracket!.regulars) expect(e).toContain(r.id);
      const general = e.filter((id) => id.startsWith('gen-'));
      expect(general).toHaveLength(3);
      for (const g of general) seen.add(g);
    }
    // 4人の組から3人をランダム（いろいろな人が出る）
    expect(seen.size).toBe(4);
    expect(drawEntrants(B, 5)).toEqual(drawEntrants(B, 5));
  });

  it('C ではシエナ、S ではアルヴィンが主人公と反対の山にいて、決勝まで必ず勝ち上がる', () => {
    for (const [t, finalist] of [[C, 'reg-sienna'], [S, 'reg-alvin']] as const) {
      for (let seed = 0; seed < 12; seed++) {
        let s = enterTournament(withRank(t.requiredRank), t.id, `entry-${seed}`, seed);
        expect(s.activeTournament!.entrants.indexOf(finalist)).toBeGreaterThanOrEqual(4);
        s = recordMatch(s, 0, true);
        s = recordMatch(s, 1, true);
        // 決勝の相手は必ず finalist
        expect(nextOpponent(t, s.activeTournament!)?.id).toBe(finalist);
        s = recordMatch(s, 2, true);
        expect(s.activeTournament?.status).toBe('won');
      }
    }
  });

  it('3連勝で優勝。勝ち上がりは前の回戦の勝者どうし', () => {
    let s = enterTournament(withRank('A'), 'tournament-a', 'entry-a', 3);
    expect(pairsOf(A, s.activeTournament!, 0)).toHaveLength(4);
    s = recordMatch(s, 0, true);
    const r1 = s.activeTournament!.matches.filter((m) => m.round === 0).map((m) => m.winner);
    expect(pairsOf(A, s.activeTournament!, 1)).toEqual([[r1[0], r1[1]], [r1[2], r1[3]]]);
    s = recordMatch(s, 1, true);
    expect(s.activeTournament!.matches.filter((m) => m.round === 1)).toHaveLength(2);
    s = recordMatch(s, 2, true);
    expect(s.activeTournament).toMatchObject({ status: 'won', round: 3 });
    expect(s.activeTournament!.matches).toHaveLength(7);
  });

  it('負けたらそこで終わり。残りの試合は結果だけ出して表を埋める（C で負けてもシエナが優勝）', () => {
    let s = enterTournament(withRank('C'), 'tournament-c', 'entry-c', 11);
    s = recordMatch(s, 0, false);
    const a = s.activeTournament!;
    expect(a.status).toBe('lost');
    expect(a.matches).toHaveLength(7);
    expect(a.matches.find((m) => m.round === 2)?.winner).toBe('reg-sienna');
    // 終わったあとの記録は無視
    expect(recordMatch(s, 1, true)).toBe(s);
  });

  it('棄権：残りは不戦敗にして表を埋める。参加報酬は受け取れる', () => {
    let s = enterTournament(withRank('B'), 'tournament-b', 'entry-w', 2);
    s = recordMatch(s, 0, true);
    s = withdraw(s);
    expect(s.activeTournament?.status).toBe('lost');
    expect(s.activeTournament?.matches).toHaveLength(7);
    const claim = claimTournamentRewards(s);
    if (claim.status !== 'ok') throw new Error('claim');
    expect(claim.summary.coins).toBe(50);
  });
});

describe('シエナがいなくなったあいだ（2026-10-27 ユーザー指示）', () => {
  const gone = (rank: SaveData['rank']): SaveData => ({ ...withRank(rank), storyFlags: [FLAG_SIENNA_LEFT] });

  it('E の総当たり：シエナの代わりに一般の出場者のマリー（E の強さ）', () => {
    const s = enterTournament(gone('E'), 'tournament-e', 'e-gone', 1);
    expect(s.activeTournament?.entrants).toEqual(['player', 'e-1', 'e-2', 'e-marie']);
    const marie = E.siennaLeft?.with;
    expect(marie?.lifeScale).toBe(E.rounds[2]?.lifeScale);
    expect(personOfOpponent(marie!)).toBeUndefined();
    let t = s;
    for (let r = 0; r < 3; r++) t = recordMatch(t, r, true);
    expect(t.activeTournament?.status).toBe('won');
  });

  it('C のトーナメント：シエナの代わりにゴードン（C の一般の出場者の強さ）。決勝まで必ず勝つ人はいない', () => {
    const gordon = C.siennaLeft?.with;
    expect(personOfOpponent(gordon!)?.id).toBe('gordon');
    expect(gordon?.lifeScale).toBe(C.bracket?.pool[0]?.lifeScale);
    const finals = new Set<string>();
    for (let seed = 0; seed < 16; seed++) {
      let s = enterTournament(gone('C'), 'tournament-c', `c-gone-${seed}`, seed);
      const e = s.activeTournament!.entrants;
      expect(e).not.toContain('reg-sienna');
      expect(e).toContain('c-gordon');
      // A・S 組は出ない
      expect(e.filter((id) => id.startsWith('gen-')).sort()).toEqual(['gen-helena', 'gen-jean', 'gen-marie', 'gen-tobias']);
      s = recordMatch(s, 0, true);
      s = recordMatch(s, 1, true);
      finals.add(nextOpponent(C, s.activeTournament!)?.id ?? '');
    }
    expect(finals.size).toBeGreaterThan(1);
  });

  it('記録を消せば元に戻る（シエナが出る）', () => {
    const back = { ...gone('C'), storyFlags: [] };
    expect(enterTournament(back, 'tournament-c', 'c-back', 1).activeTournament?.entrants).toContain('reg-sienna');
    expect(enterTournament({ ...back, rank: 'E' }, 'tournament-e', 'e-back', 1).activeTournament?.entrants).toContain('e-3');
  });
});

describe('報酬・記録・セーブ', () => {
  const winC = (save: SaveData, entryId: string): SaveData => {
    let s = enterTournament(cupReady(save), 'tournament-c', entryId, 1);
    for (let r = 0; r < 3; r++) s = recordMatch(s, r, true);
    return s;
  };

  it('C の初優勝：500G＋参加賞・B に上がる。2回目は半分', () => {
    const start = withRank('C');
    const first = claimTournamentRewards(winC(start, 'c1'));
    if (first.status !== 'ok') throw new Error('claim');
    expect(first.save.coins).toBe(start.coins + 540);
    expect(first.save.rank).toBe('B');
    expect(first.save.tournaments['tournament-c']).toEqual({ entries: 1, wins: 1, firstWinClaimed: true });
    expect(first.summary.unlockedPacks).toEqual([]);
    const second = claimTournamentRewards(winC(first.save, 'c2'));
    if (second.status !== 'ok') throw new Error('claim2');
    expect(second.summary.coins).toBe(250 + 40);
  });

  it('C ランク大会を終えたら（優勝しても負けても）「シエナがいなくなった」の記録。B では立たない', () => {
    let s = enterTournament(withRank('C'), 'tournament-c', 'c-lose', 4);
    s = recordMatch(s, 0, false);
    const lost = claimTournamentRewards(s);
    if (lost.status !== 'ok') throw new Error('claim');
    expect(lost.save.storyFlags).toEqual([FLAG_SIENNA_LEFT]);
    const won = claimTournamentRewards(winC(withRank('C'), 'c-win'));
    if (won.status !== 'ok') throw new Error('claim');
    expect(won.save.storyFlags).toEqual([FLAG_SIENNA_LEFT]);
    let b = enterTournament(withRank('B'), 'tournament-b', 'b-1', 1);
    b = recordMatch(b, 0, false);
    const bc = claimTournamentRewards(b);
    if (bc.status !== 'ok') throw new Error('claim');
    expect(bc.save.storyFlags).toEqual([]);
  });

  it('途中の大会は保存して読み直しても同じ所から（組み合わせ・終わった試合・次の相手）', () => {
    let s = enterTournament(withRank('S'), 'tournament-s', 'entry-s', 9);
    s = recordMatch(s, 0, true);
    const loaded = normalizeSave(JSON.parse(JSON.stringify(s)));
    expect(loaded?.activeTournament).toEqual(s.activeTournament);
    expect(nextOpponent(S, loaded!.activeTournament!)?.id).toBe(nextOpponent(S, s.activeTournament!)?.id);
    expect(loaded && recordMatch(loaded, 1, true).activeTournament?.round).toBe(2);
  });

  it('前の形式（version 17）の途中の大会は、その大会の1試合目からやり直し（参加の回数はそのまま）', () => {
    // ボスを倒した記録のない前のセーブ（cupReady を通さない）
    const { storyFlags: _f, ...rest } = { ...createNewSave(new Date('2026-10-27T00:00:00Z'), 'balance'), rank: 'D' as const };
    const old = {
      ...rest,
      version: 17,
      tournaments: { 'tournament-e': { entries: 2, wins: 1, firstWinClaimed: true } },
      activeTournament: { tournamentId: 'tournament-e', entryId: 'old-1', round: 2, status: 'inProgress' },
    };
    const migrated = normalizeSave(old);
    expect(migrated?.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(18);
    // v28 の変換（2026-10-30 ガチャのシリーズ）で付く「選んだ」記録のほかは、記録は増えない
    expect(migrated?.storyFlags.filter((f) => !f.startsWith('gacha-seen-'))).toEqual([]);
    expect(migrated?.activeTournament).toMatchObject({ tournamentId: 'tournament-e', entryId: 'old-1', round: 0, status: 'inProgress', entrants: ['player', 'e-1', 'e-2', 'e-3'], matches: [] });
    expect(migrated?.tournaments['tournament-e']?.entries).toBe(2);
  });
});
