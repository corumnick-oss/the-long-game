import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useGames(week: number, season: number) {
  return useQuery({
    queryKey: ['games', week, season],
    queryFn: () => apiFetch<Game[]>(`/api/games?week=${week}&season=${season}`),
    staleTime: 30_000,
  });
}

export function useTiebreaker(week: number, season: number) {
  return useQuery({
    queryKey: ['tiebreaker', week, season],
    queryFn: () => apiFetch<TiebreakerData>(`/api/tiebreaker?week=${week}&season=${season}`),
    staleTime: 60_000,
  });
}

export function useSubmitPick() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ gameId, pick }: { gameId: string; pick: 'home' | 'away'; week: number; season: number }) =>
      apiFetch('/api/picks', { method: 'POST', body: JSON.stringify({ gameId, pick }) }),
    onMutate: async ({ gameId, pick, week, season }) => {
      const key = ['games', week, season];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Game[]>(key);
      qc.setQueryData<Game[]>(key, old =>
        old?.map(g => g.id === gameId ? { ...g, myPick: pick } : g) ?? [],
      );
      return { prev };
    },
    onError: (_err, { week, season }, ctx) => {
      if (ctx?.prev) qc.setQueryData(['games', week, season], ctx.prev);
    },
    onSettled: (_data, _err, { week, season }) => {
      qc.invalidateQueries({ queryKey: ['games', week, season] });
    },
  });
}

export function useSubmitTiebreaker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tiebreakerGameId, predictedTotal }: { tiebreakerGameId: string; predictedTotal: number; week: number; season: number }) =>
      apiFetch('/api/tiebreaker', { method: 'POST', body: JSON.stringify({ tiebreakerGameId, predictedTotal }) }),
    onSettled: (_data, _err, { week, season }) => {
      qc.invalidateQueries({ queryKey: ['tiebreaker', week, season] });
    },
  });
}
