import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/queryClient';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  teamName: string;
  profileImageUrl: string | null;
  isLongie: boolean;
  isPremium: boolean;
  wins: number;
  losses: number;
  accuracy: number;
  trophyCount: number;
  isCurrentUser: boolean;
};

export type LeaderboardResponse = {
  type: 'season' | 'weekly';
  week: number | null;
  season: number;
  filter: 'longies' | 'global';
  entries: LeaderboardEntry[];
};

export function useLeaderboard(
  filter: 'longies' | 'global',
  type: 'season' | 'weekly',
  week: number,
  season: number,
  seasonType: 'regular' | 'preseason' = 'regular',
) {
  const params = new URLSearchParams({ filter, type, season: String(season), seasonType });
  if (type === 'weekly') params.set('week', String(week));

  return useQuery({
    queryKey: ['leaderboard', filter, type, type === 'weekly' ? week : null, season, seasonType],
    queryFn: () => apiFetch<LeaderboardResponse>(`/api/leaderboard?${params}`),
    staleTime: 60_000,
  });
}
