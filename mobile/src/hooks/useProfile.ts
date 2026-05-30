import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/queryClient';
import { getCurrentNFLSeason } from '../lib/nflSeason';

export type H2HEntry = {
  opponentId: string;
  teamName: string;
  profileImageUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
};

export type WeekRecord = {
  week: number;
  wins: number;
  losses: number;
};

export type MyProfile = {
  id: string;
  email: string;
  teamName: string;
  isAdmin: boolean;
  isLongie: boolean;
  profileImageUrl: string | null;
  createdAt: string;
  seasonRecord: { wins: number; losses: number };
  accuracy: number;
  bestWeek: { week: number; wins: number } | null;
  trophyCount: number;
  weeklyHistory: WeekRecord[];
  h2h: H2HEntry[];
  insights: {
    bestTeam: { team: string; wins: number; losses: number; accuracy: number } | null;
    worstTeam: { team: string; wins: number; losses: number; accuracy: number } | null;
  };
};

export type Trophy = {
  id: string;
  type: string;
  name: string;
  description: string;
  week: number;
  season: number;
  earnedAt: string;
};

export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', 'me', user?.uid ?? null],
    queryFn: () => apiFetch<MyProfile>('/api/users/me', undefined, user),
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useMyTrophies() {
  const { user } = useAuth();
  const season = getCurrentNFLSeason();
  return useQuery({
    queryKey: ['trophies', 'me', season, user?.uid ?? null],
    queryFn: () =>
      apiFetch<Trophy[]>(`/api/trophies?userId=${user!.uid}&season=${season}`, undefined, user),
    enabled: !!user,
    staleTime: 120_000,
  });
}
