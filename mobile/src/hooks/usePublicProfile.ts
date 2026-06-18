import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/queryClient';
import { getCurrentNFLSeason } from '../lib/nflSeason';
import type { WeekRecord } from './useProfile';

export type PublicProfile = {
  id: string;
  teamName: string;
  profileImageUrl: string | null;
  isLongie: boolean;
  isPremium: boolean;
  createdAt: string;
  seasonRecord: { wins: number; losses: number };
  accuracy: number;
  bestWeek: { week: number; wins: number } | null;
  trophyCount: number;
  weeklyHistory: WeekRecord[];
  h2hCurrentWeek: { wins: number; losses: number; ties: number } | null;
};

export function usePublicProfile(userId: string, season?: number) {
  const { user } = useAuth();
  const effectiveSeason = season ?? getCurrentNFLSeason();
  return useQuery({
    queryKey: ['public-profile', userId, effectiveSeason, user?.uid ?? null],
    queryFn: () => apiFetch<PublicProfile>(`/api/users/${userId}?season=${effectiveSeason}`, undefined, user),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
