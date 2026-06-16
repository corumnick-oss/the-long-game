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

export type Achievement = {
  id: string;
  type: string;
  name: string;
  description: string;
  week: number;
  season: number;
  earnedAt: string;
};

export function useMyProfile(season?: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', 'me', season ?? null, user?.uid ?? null],
    queryFn: () => apiFetch<MyProfile>(`/api/users/me${season ? `?season=${season}` : ''}`, undefined, user),
    enabled: !!user,
    staleTime: 60_000,
  });
}

export type TeamPickRecord = {
  team: string;
  wins: number;
  losses: number;
  logo: string | null;
  total: number;
  accuracy: number;
};

export function usePicksByTeam(season: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['picks-by-team', season, user?.uid ?? null],
    queryFn: () => apiFetch<TeamPickRecord[]>(`/api/picks/by-team?season=${season}`, undefined, user),
    enabled: !!user,
    staleTime: 120_000,
  });
}

export function useMyAchievements() {
  const { user } = useAuth();
  const season = getCurrentNFLSeason();
  return useQuery({
    queryKey: ['trophies', 'me', season, user?.uid ?? null],
    queryFn: () =>
      apiFetch<Achievement[]>(`/api/trophies?userId=${user!.uid}&season=${season}`, undefined, user),
    enabled: !!user,
    staleTime: 120_000,
  });
}
