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

export function usePublicProfile(userId: string) {
  const { user } = useAuth();
  const season = getCurrentNFLSeason();
  return useQuery({
    queryKey: ['public-profile', userId, user?.uid ?? null],
    queryFn: () => apiFetch<PublicProfile>(`/api/users/${userId}`, undefined, user),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
