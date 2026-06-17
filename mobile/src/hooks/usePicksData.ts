import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/queryClient';

export type Game = {
  id: string;
  week: number;
  season: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  homeTeamRecord: string | null;
  awayTeamRecord: string | null;
  homeScore: number | null;
  awayScore: number | null;
  // Legacy columns on games table (kept for compat, typically null)
  homeTeamPPG: number | null;
  awayTeamPPG: number | null;
  homeTeamPPGAllowed: number | null;
  awayTeamPPGAllowed: number | null;
  // Computed averages from team_game_stats
  homePPG: number | null;
  homePPGA: number | null;
  homeYPG: number | null;
  homeYAPG: number | null;
  homePassYPG: number | null;
  homeRushYPG: number | null;
  homeThirdDownPct: number | null;
  homeRedZonePct: number | null;
  homeSacksPG: number | null;
  homeTurnoversPG: number | null;
  awayPPG: number | null;
  awayPPGA: number | null;
  awayYPG: number | null;
  awayYAPG: number | null;
  awayPassYPG: number | null;
  awayRushYPG: number | null;
  awayThirdDownPct: number | null;
  awayRedZonePct: number | null;
  awaySacksPG: number | null;
  awayTurnoversPG: number | null;
  statsSeasonUsed: number | null;
  spread: number | null;
  favoriteTeam: string | null;
  gameTime: string;
  status: 'pre' | 'in' | 'post';
  statusType: string | null;
  period: number | null;
  displayClock: string | null;
  winningTeamWinProb: number | null;
  myPick: 'home' | 'away' | null;
  homePickPct: number | null;
  awayPickPct: number | null;
};

export type TiebreakerData = {
  tiebreakerGame: { id: string; week: number; season: number; gameId: string; description: string; actualTotal: number | null };
  game: Game | null;
  myPick: { predictedTotal: number } | null;
  isLocked: boolean;
} | null;

export function useGames(week: number, season: number, seasonType: 'regular' | 'preseason' = 'regular') {
  const { user } = useAuth();
  return useQuery({
    // user.uid in the key means the query re-runs with auth as soon as the
    // user is confirmed — no stale unauthenticated result ever shows picks
    queryKey: ['games', week, season, seasonType, user?.uid ?? null],
    queryFn: () => apiFetch<Game[]>(`/api/games?week=${week}&season=${season}&seasonType=${seasonType}`, undefined, user),
    staleTime: 30_000,
    refetchInterval: (query) => {
      const data = query.state.data as Game[] | undefined;
      return data?.some(g => g.status === 'in') ? 30_000 : false;
    },
  });
}

export function useTiebreaker(week: number, season: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['tiebreaker', week, season, user?.uid ?? null],
    queryFn: () => apiFetch<TiebreakerData>(`/api/tiebreaker?week=${week}&season=${season}`, undefined, user),
    staleTime: 60_000,
  });
}

export function useSubmitPick() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ gameId, pick }: { gameId: string; pick: 'home' | 'away'; week: number; season: number; seasonType: string }) =>
      apiFetch('/api/picks', { method: 'POST', body: JSON.stringify({ gameId, pick }) }, user),
    onMutate: async ({ gameId, pick, week, season, seasonType }) => {
      const gamesKey = ['games', week, season, seasonType, user?.uid ?? null];
      const detailKey = ['game-detail', gameId, user?.uid ?? null];
      await qc.cancelQueries({ queryKey: gamesKey });
      await qc.cancelQueries({ queryKey: detailKey });
      const prevGames = qc.getQueryData<Game[]>(gamesKey);
      const prevDetail = qc.getQueryData<unknown>(detailKey);
      qc.setQueryData<Game[]>(gamesKey, old =>
        old?.map(g => g.id === gameId ? { ...g, myPick: pick } : g) ?? [],
      );
      qc.setQueryData(detailKey, (old: any) => old ? { ...old, myPick: pick } : old);
      return { prevGames, prevDetail };
    },
    onError: (_err, { gameId, week, season, seasonType }, ctx) => {
      if (ctx?.prevGames) qc.setQueryData(['games', week, season, seasonType, user?.uid ?? null], ctx.prevGames);
      if (ctx?.prevDetail) qc.setQueryData(['game-detail', gameId, user?.uid ?? null], ctx.prevDetail);
    },
    onSettled: (_data, _err, { gameId, week, season, seasonType }) => {
      qc.invalidateQueries({ queryKey: ['games', week, season, seasonType, user?.uid ?? null] });
      qc.invalidateQueries({ queryKey: ['game-detail', gameId, user?.uid ?? null] });
    },
  });
}

export function useSubmitTiebreaker() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tiebreakerGameId, predictedTotal }: { tiebreakerGameId: string; predictedTotal: number; week: number; season: number }) =>
      apiFetch('/api/tiebreaker', { method: 'POST', body: JSON.stringify({ tiebreakerGameId, predictedTotal }) }, user),
    onSettled: (_data, _err, { week, season }) => {
      qc.invalidateQueries({ queryKey: ['tiebreaker', week, season, user?.uid ?? null] });
    },
  });
}
