import { useQuery, keepPreviousData } from '@tanstack/react-query';
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
  filter?: 'gridirons' | 'global';
  games: WeekPicksGame[];
  users: WeekPicksUser[];
  picksByUser: Record<string, Record<string, { pick: 'home' | 'away'; isCorrect: boolean | null }>>;
};

export function useWeekPicks(
  week: number,
  season: number,
  seasonType: 'regular' | 'preseason' = 'regular',
  filter: 'gridirons' | 'global' = 'global',
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['week-picks', week, season, seasonType, filter, user?.uid ?? null],
    queryFn: () =>
      apiFetch<WeekPicksResponse>(
        `/api/picks/week?week=${week}&season=${season}&seasonType=${seasonType}&filter=${filter}`,
        undefined,
        user,
      ),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
