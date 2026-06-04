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
  homeTeamPPG: string | null;
  awayTeamPPG: string | null;
  homeTeamPPGAllowed: string | null;
  awayTeamPPGAllowed: string | null;
  spread: string | null;
  favoriteTeam: string | null;
  gameTime: string;
  status: 'pre' | 'in' | 'post';
  statusType: string | null;
  period: number | null;
  displayClock: string | null;
  winningTeamWinProb: string | null;
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
    mutationFn: ({ gameId, pick }: { gameId: string; pick: 'home' | 'away'; week: number; season: number }) =>
      apiFetch('/api/picks', { method: 'POST', body: JSON.stringify({ gameId, pick }) }, user),
    onMutate: async ({ gameId, pick, week, season }) => {
      const key = ['games', week, season, user?.uid ?? null];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Game[]>(key);
      qc.setQueryData<Game[]>(key, old =>
        old?.map(g => g.id === gameId ? { ...g, myPick: pick } : g) ?? [],
      );
      return { prev };
    },
    onError: (_err, { week, season }, ctx) => {
      if (ctx?.prev) qc.setQueryData(['games', week, season, user?.uid ?? null], ctx.prev);
    },
    onSettled: (_data, _err, { week, season }) => {
      qc.invalidateQueries({ queryKey: ['games', week, season, user?.uid ?? null] });
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
