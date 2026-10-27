import { rankAtLeast } from '../../data/economy.ts';
import { getTournament, tournamentOpponents, type CardReward, type OpponentDefinition, type TournamentDefinition } from '../../data/tournaments.ts';
import { t } from '../../i18n/i18n.ts';
import { simulateBattle } from '../battle/simulate.ts';
import { isDeckValid } from '../deck/deck.ts';
import { shuffle } from '../rng.ts';
import {
  addCards,
  addCoins,
  FLAG_SIENNA_LEFT,
  unlockPacks,
  unlockedDungeonsFor,
  type ActiveTournament,
  type SaveData,
  type TournamentMatch,
  type TournamentRecord,
} from '../save/saveData.ts';
import { drawEntrants, PLAYER_ENTRANT, seedFromId, TOURNAMENT_ROUNDS } from './tournamentDraw.ts';

/**
 * 大会の進行：受付 → 対戦（回戦ごと） → 結果 → 優勝/敗退 → 景品受け取り。
 * 進行状況は save.activeTournament に保存するので、途中でアプリを閉じても次の回戦から再開できる。
 * 景品は参加ID（entryId）ごとに1回だけ受け取れる（claimedEntries で二重受け取りを防ぐ）。
 *
 * 2026-10-27 指示書「大会の新しい形」：
 * - E・D は4人の総当たり。主人公が1試合するたびに、同じ回のほかの2人の試合を自動対戦（simulateBattle）で決める。
 *   3試合が終わったら順位（勝ち数 → 勝った試合で残ったモンスターの数 → 与えたダメージ → 抽選）。1位なら優勝
 * - C〜S は8人のトーナメント。主人公の試合のあと、同じ回戦のほかの試合を自動対戦で決める。負けたらそこで終わり（残りは結果だけ出して表を埋める）。
 *   決勝まで必ず勝ち上がる人（C：シエナ、S：アルヴィン）は、主人公以外には必ず勝つ
 */
const EMPTY_RECORD: TournamentRecord = { entries: 0, wins: 0, firstWinClaimed: false };

export function tournamentRecord(save: SaveData, id: string): TournamentRecord {
  return save.tournaments[id] ?? EMPTY_RECORD;
}

export function entryCheck(save: SaveData, tournament: TournamentDefinition): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!rankAtLeast(save.rank, tournament.requiredRank)) {
    reasons.push(t('tournament.issue.rank', { required: tournament.requiredRank, rank: save.rank }));
  }
  if (!isDeckValid(save.deck, save.collection)) reasons.push(t('tournament.issue.deck'));
  if (save.activeTournament && save.activeTournament.tournamentId !== tournament.id) {
    reasons.push(t('tournament.issue.other'));
  }
  return { ok: reasons.length === 0, reasons };
}

/** seed は組み合わせ・ほかの人の試合・抽選に使う（無ければ参加ID から決める。テストでは固定値） */
export function enterTournament(save: SaveData, tournamentId: string, entryId: string, seed: number = seedFromId(entryId)): SaveData {
  const tournament = getTournament(tournamentId);
  if (!tournament) return save;
  if (save.activeTournament) return save; // 参加中なら新しく受け付けない（再開する）
  if (!entryCheck(save, tournament).ok) return save;
  const record = tournamentRecord(save, tournamentId);
  return {
    ...save,
    activeTournament: { tournamentId, entryId, round: 0, status: 'inProgress', seed, entrants: drawEntrants(tournament, seed, save.storyFlags.includes(FLAG_SIENNA_LEFT)), matches: [] },
    tournaments: { ...save.tournaments, [tournamentId]: { ...record, entries: record.entries + 1 } },
  };
}

/* ---------- 組み合わせ ---------- */

/** 出場者の ID → 相手の定義（主人公は undefined） */
export function entrantOpponent(tournament: TournamentDefinition, id: string): OpponentDefinition | undefined {
  return tournamentOpponents(tournament).find((o) => o.id === id);
}

/** その回の組み合わせ（[a, b] の並び。トーナメントは前の回戦の勝ち残りから。まだ決まらない組は入れない） */
export function pairsOf(tournament: TournamentDefinition, active: Pick<ActiveTournament, 'entrants' | 'matches'>, round: number): [string, string][] {
  const e = active.entrants;
  if (tournament.format === 'league') {
    // n 回目：主人公と n+1 番目、残りの2人どうし
    const rest = [1, 2, 3].filter((i) => i !== round + 1);
    return [
      [e[0] as string, e[round + 1] as string],
      [e[rest[0] as number] as string, e[rest[1] as number] as string],
    ];
  }
  if (round === 0) return [0, 2, 4, 6].map((i) => [e[i] as string, e[i + 1] as string]);
  const winners = active.matches.filter((m) => m.round === round - 1).map((m) => m.winner);
  // 前の回戦の試合は山の順に記録してあるので、勝ち残りを2人ずつ組む
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < winners.length; i += 2) pairs.push([winners[i] as string, winners[i + 1] as string]);
  return pairs;
}

/** 主人公の次の相手（大会が終わっていれば undefined） */
export function nextOpponent(tournament: TournamentDefinition, active: ActiveTournament): OpponentDefinition | undefined {
  if (active.status !== 'inProgress') return undefined;
  const pair = pairsOf(tournament, active, active.round).find((p) => p.includes(PLAYER_ENTRANT));
  const other = pair?.find((id) => id !== PLAYER_ENTRANT);
  return other ? entrantOpponent(tournament, other) : undefined;
}

/** 主人公の試合の結果（対戦の画面から。残ったモンスター・与えたダメージは順位に使う） */
export interface PlayerMatchResult {
  readonly won: boolean;
  readonly playerLeft?: number;
  readonly opponentLeft?: number;
  readonly damageDealt?: number;
  readonly damageTaken?: number;
}

/** 相手どうしの試合を自動対戦で決める。決勝まで必ず勝ち上がる人は、主人公以外には必ず勝つ */
function autoMatch(tournament: TournamentDefinition, active: ActiveTournament, round: number, index: number, a: string, b: string): TournamentMatch {
  const oa = entrantOpponent(tournament, a);
  const ob = entrantOpponent(tournament, b);
  const seed = (active.seed + round * 1009 + index * 101) % 0x7fffffff;
  const r = oa && ob ? simulateBattle(oa, ob, seed) : { winner: 'a' as const, aLeft: 0, bLeft: 0, aDamage: 0, bDamage: 0 };
  const forced = tournament.bracket?.finalist;
  const winner = forced === a ? a : forced === b ? b : r.winner === 'a' ? a : b;
  // 勝ち負けを入れ替えたときは、残ったモンスターも勝った側を1体以上に
  const swap = (r.winner === 'a' ? a : b) !== winner;
  return swap
    ? { round, a, b, winner, aLeft: Math.max(1, r.bLeft), bLeft: 0, aDamage: r.bDamage, bDamage: r.aDamage }
    : { round, a, b, winner, aLeft: r.aLeft, bLeft: r.bLeft, aDamage: r.aDamage, bDamage: r.bDamage };
}

/** その回の試合をすべて記録する（主人公の試合は result、ほかは自動対戦） */
function playRound(tournament: TournamentDefinition, active: ActiveTournament, round: number, result: PlayerMatchResult): ActiveTournament {
  const matches = pairsOf(tournament, active, round).map(([a, b], i): TournamentMatch => {
    if (a !== PLAYER_ENTRANT && b !== PLAYER_ENTRANT) return autoMatch(tournament, active, round, i, a, b);
    const other = a === PLAYER_ENTRANT ? b : a;
    const me = { left: result.won ? Math.max(1, result.playerLeft ?? 1) : 0, damage: result.damageDealt ?? 0 };
    const them = { left: result.won ? 0 : Math.max(1, result.opponentLeft ?? 1), damage: result.damageTaken ?? 0 };
    const [pa, pb] = a === PLAYER_ENTRANT ? [me, them] : [them, me];
    return { round, a, b, winner: result.won ? PLAYER_ENTRANT : other, aLeft: pa.left, bLeft: pb.left, aDamage: pa.damage, bDamage: pb.damage };
  });
  return { ...active, matches: [...active.matches.filter((m) => m.round !== round), ...matches] };
}

/** トーナメントで主人公が負けたあと：残りの回戦を自動対戦で埋める */
function fillRest(tournament: TournamentDefinition, active: ActiveTournament, from: number): ActiveTournament {
  let next = active;
  for (let round = from; round < TOURNAMENT_ROUNDS; round++) {
    const pairs = pairsOf(tournament, next, round);
    const matches = pairs.map(([a, b], i) => autoMatch(tournament, next, round, i, a, b));
    next = { ...next, matches: [...next.matches, ...matches] };
  }
  return next;
}

/** 対戦結果を記録する。matchRound は戦った回戦（同じ結果の二重記録を防ぐ）。won だけ渡しても動く（残り・ダメージは 0 扱い） */
export function recordMatch(save: SaveData, matchRound: number, result: boolean | PlayerMatchResult): SaveData {
  const active = save.activeTournament;
  if (!active || active.status !== 'inProgress' || active.round !== matchRound) return save;
  const tournament = getTournament(active.tournamentId);
  if (!tournament) return save;
  const r: PlayerMatchResult = typeof result === 'boolean' ? { won: result } : result;
  let next = playRound(tournament, active, matchRound, r);
  const nextRound = matchRound + 1;
  if (tournament.format === 'league') {
    if (nextRound < TOURNAMENT_ROUNDS) return { ...save, activeTournament: { ...next, round: nextRound } };
    const won = leagueStandings(next)[0]?.id === PLAYER_ENTRANT;
    return { ...save, activeTournament: { ...next, round: nextRound, status: won ? 'won' : 'lost' } };
  }
  if (!r.won) {
    next = fillRest(tournament, next, nextRound);
    return { ...save, activeTournament: { ...next, status: 'lost' } };
  }
  if (nextRound >= TOURNAMENT_ROUNDS) return { ...save, activeTournament: { ...next, round: nextRound, status: 'won' } };
  return { ...save, activeTournament: { ...next, round: nextRound } };
}

/**
 * 棄権（途中でやめる）。参加報酬は受け取れる。
 * 残りの主人公の試合は負け（不戦敗）にして、ほかの人の試合は自動対戦で埋める（表が最後までうまる）
 */
export function withdraw(save: SaveData): SaveData {
  let next = save;
  for (let i = 0; i < TOURNAMENT_ROUNDS; i++) {
    const active = next.activeTournament;
    if (!active || active.status !== 'inProgress') break;
    next = recordMatch(next, active.round, { won: false, opponentLeft: 3 });
  }
  const active = next.activeTournament;
  if (active?.status === 'inProgress') return { ...next, activeTournament: { ...active, status: 'lost' } };
  return next;
}

/* ---------- 総当たりの順位 ---------- */

export interface Standing {
  readonly id: string;
  readonly wins: number;
  readonly losses: number;
  /** 勝った試合で残った自分のモンスターの数の合計 */
  readonly left: number;
  /** 与えたダメージの合計 */
  readonly damage: number;
}

/**
 * 総当たりの順位：①勝ち数 → ②勝った試合で残った自分のモンスターの数の合計 → ③与えたダメージの合計 → ④抽選（seed で決まる。同率1位は作らない）
 */
export function leagueStandings(active: Pick<ActiveTournament, 'entrants' | 'matches' | 'seed'>): Standing[] {
  const lottery = shuffle(active.entrants, active.seed ^ 0x5bd1e995).items;
  const rows = active.entrants.map((id): Standing => {
    const mine = active.matches.filter((m) => m.a === id || m.b === id);
    const wonMatches = mine.filter((m) => m.winner === id);
    return {
      id,
      wins: wonMatches.length,
      losses: mine.length - wonMatches.length,
      left: wonMatches.reduce((sum, m) => sum + (m.a === id ? m.aLeft : m.bLeft), 0),
      damage: mine.reduce((sum, m) => sum + (m.a === id ? m.aDamage : m.bDamage), 0),
    };
  });
  return rows.sort((x, y) => y.wins - x.wins || y.left - x.left || y.damage - x.damage || lottery.indexOf(x.id) - lottery.indexOf(y.id));
}

/** 総当たりの表のマス：row の人から見た col の人との試合（まだなら undefined） */
export function leagueMatch(active: Pick<ActiveTournament, 'matches'>, row: string, col: string): TournamentMatch | undefined {
  return active.matches.find((m) => (m.a === row && m.b === col) || (m.a === col && m.b === row));
}

export interface RewardSummary {
  readonly won: boolean;
  readonly firstWin: boolean;
  readonly coins: number;
  readonly unlockedPacks: readonly string[];
  readonly rankUp: string | null;
  readonly cards: readonly CardReward[];
  /** ランクが上がって新しく開放したダンジョン（2026-10-27 指示書「ダンジョン7つ」） */
  readonly unlockedDungeons: readonly string[];
}

export type ClaimResult =
  | { readonly status: 'ok'; readonly save: SaveData; readonly summary: RewardSummary }
  | { readonly status: 'nothing'; readonly save: SaveData };

/** 大会終了後の景品受け取り（参加報酬＋優勝景品）。1参加につき1回だけ */
export function claimTournamentRewards(save: SaveData): ClaimResult {
  const active = save.activeTournament;
  if (!active || active.status === 'inProgress') return { status: 'nothing', save };
  const tournament = getTournament(active.tournamentId);
  if (!tournament || save.claimedEntries.includes(active.entryId)) {
    return { status: 'nothing', save: { ...save, activeTournament: null } };
  }
  const record = tournamentRecord(save, tournament.id);
  const won = active.status === 'won';
  const firstWin = won && !record.firstWinClaimed;
  let coins = tournament.rewards.participationCoins;
  let unlocked: readonly string[] = [];
  let rankUp: SaveData['rank'] | null = null;
  let cards: readonly CardReward[] = [];
  if (firstWin) {
    coins += tournament.rewards.firstWin.coins;
    unlocked = tournament.rewards.firstWin.unlockPacks;
    rankUp = tournament.rewards.firstWin.rankUp;
    cards = tournament.rewards.firstWin.cards;
  } else if (won) {
    coins += tournament.rewards.repeatWin.coins;
  }

  let next = addCoins(save, coins);
  next = addCards(next, cards);
  next = unlockPacks(next, unlocked);
  // 道具の解放（内部の設定だけ。報酬の画面には出さないので summary には入れない）
  if (firstWin) {
    const items = tournament.rewards.firstWin.unlockItems.filter((id) => !next.unlockedItems.includes(id));
    if (items.length > 0) next = { ...next, unlockedItems: [...next.unlockedItems, ...items] };
  }
  if (rankUp && !rankAtLeast(next.rank, rankUp)) next = { ...next, rank: rankUp };
  // ランクが上がったら、そのランクのダンジョンを開放する
  const dungeons = unlockedDungeonsFor(next.rank, next.unlockedDungeons);
  const newDungeons = dungeons.filter((id) => !next.unlockedDungeons.includes(id));
  if (newDungeons.length > 0) next = { ...next, unlockedDungeons: dungeons };
  // C ランク大会を終えたら（優勝しても負けても）「シエナがいなくなった」の記録（記録だけ。イベントダンジョンは別の指示書）
  if (tournament.id === 'tournament-c' && !next.storyFlags.includes(FLAG_SIENNA_LEFT)) next = { ...next, storyFlags: [...next.storyFlags, FLAG_SIENNA_LEFT] };
  next = {
    ...next,
    activeTournament: null,
    claimedEntries: [...next.claimedEntries, active.entryId],
    tournaments: {
      ...next.tournaments,
      [tournament.id]: {
        ...record,
        wins: record.wins + (won ? 1 : 0),
        firstWinClaimed: record.firstWinClaimed || firstWin,
      },
    },
  };
  return {
    status: 'ok',
    save: next,
    summary: { won, firstWin, coins, unlockedPacks: unlocked, rankUp, cards, unlockedDungeons: newDungeons },
  };
}
