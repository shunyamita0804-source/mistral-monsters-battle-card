import { rankAtLeast } from '../../data/economy.ts';
import { getTournament, type CardReward, type TournamentDefinition } from '../../data/tournaments.ts';
import { t } from '../../i18n/i18n.ts';
import { isDeckValid } from '../deck/deck.ts';
import { addCards, addCoins, unlockPacks, type SaveData, type TournamentRecord } from '../save/saveData.ts';

/**
 * 大会の進行：受付 → 対戦（回戦ごと） → 結果 → 優勝/敗退 → 景品受け取り。
 * 進行状況は save.activeTournament に保存するので、途中でアプリを閉じても次の回戦から再開できる。
 * 景品は参加ID（entryId）ごとに1回だけ受け取れる（claimedEntries で二重受け取りを防ぐ）。
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

export function enterTournament(save: SaveData, tournamentId: string, entryId: string): SaveData {
  const tournament = getTournament(tournamentId);
  if (!tournament) return save;
  if (save.activeTournament) return save; // 参加中なら新しく受け付けない（再開する）
  if (!entryCheck(save, tournament).ok) return save;
  const record = tournamentRecord(save, tournamentId);
  return {
    ...save,
    activeTournament: { tournamentId, entryId, round: 0, status: 'inProgress' },
    tournaments: { ...save.tournaments, [tournamentId]: { ...record, entries: record.entries + 1 } },
  };
}

/** 対戦結果を記録する。matchRound は戦った回戦（同じ結果の二重記録を防ぐ） */
export function recordMatch(save: SaveData, matchRound: number, won: boolean): SaveData {
  const active = save.activeTournament;
  if (!active || active.status !== 'inProgress' || active.round !== matchRound) return save;
  const tournament = getTournament(active.tournamentId);
  if (!tournament) return save;
  if (!won) return { ...save, activeTournament: { ...active, status: 'lost' } };
  const nextRound = active.round + 1;
  if (nextRound >= tournament.rounds.length) {
    return { ...save, activeTournament: { ...active, round: nextRound, status: 'won' } };
  }
  return { ...save, activeTournament: { ...active, round: nextRound } };
}

/** 棄権（途中でやめる）。参加報酬は受け取れる */
export function withdraw(save: SaveData): SaveData {
  const active = save.activeTournament;
  if (!active || active.status !== 'inProgress') return save;
  return { ...save, activeTournament: { ...active, status: 'lost' } };
}

export interface RewardSummary {
  readonly won: boolean;
  readonly firstWin: boolean;
  readonly coins: number;
  readonly unlockedPacks: readonly string[];
  readonly rankUp: string | null;
  readonly cards: readonly CardReward[];
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
    summary: { won, firstWin, coins, unlockedPacks: unlocked, rankUp, cards },
  };
}
