import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/queryClient';

export type TeamSummary = {
  name: string;
  logo: string | null;
  wins: number;
  losses: number;
  ppg: number | null;
  ppgAllowed: number | null;
  pickWins: number;
  pickLosses: number;
  pickTotal: number;
  pickAccuracy: number | null;
};

export type RecentGame = {
  gameId: string;
  week: number;
  gameTime: string | null;
  status: string;
  isHome: boolean;
  opponent: string;
  opponentLogo: string | null;
  myScore: number | null;
  theirScore: number | null;
  result: 'W' | 'L' | null;
};

export type TeamDetail = TeamSummary & {
  ypg: number | null;
  yapg: number | null;
  passYpg: number | null;
  rushYpg: number | null;
  statsSeasonUsed: number | null;
  recentGames: RecentGame[];
};

export function useTeamList(season: number, seasonType: 'regular' | 'preseason' = 'regular') {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['teams', season, seasonType],
    queryFn: () => apiFetch<TeamSummary[]>(`/api/teams?season=${season}&seasonType=${seasonType}`, undefined, user),
    staleTime: 300_000,
  });
}

export function useTeamDetail(name: string, season: number, seasonType: 'regular' | 'preseason' = 'regular') {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['team', name, season, seasonType],
    queryFn: () => apiFetch<TeamDetail>(`/api/teams/${encodeURIComponent(name)}?season=${season}&seasonType=${seasonType}`, undefined, user),
    staleTime: 300_000,
    enabled: !!name,
  });
}
