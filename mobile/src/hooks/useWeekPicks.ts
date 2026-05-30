import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/queryClient';

export type WeekPicksGame = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
};

export type WeekPicksUser = {
  id: string;
  teamName: string;
  profileImageUrl: string | null;
};

export type WeekPicksResponse = {
  locked: boolean;
  week: number;
  season: number;
  games: WeekPicksGame[];
  users: WeekPicksUser[];
  picksByUser: Record<string, Record<string, { pick: 'home' | 'away'; isCorrect: boolean | null }>>;
};

export function useWeekPicks(week: number, season: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['week-picks', week, season, user?.uid ?? null],
    queryFn: () =>
      apiFetch<WeekPicksResponse>(
        `/api/picks/week?week=${week}&season=${season}`,
        undefined,
        user,
      ),
    staleTime: 60_000,
  });
}
