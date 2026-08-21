import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  isGridiron: boolean;
  profileImageUrl: string | null;
  createdAt: string;
  notifyWeekUnlocked: boolean;
  notifyWeekLocked: boolean;
  notifyWeekSummary: boolean;
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

export function useMyAchievements(season?: number) {
  const { user } = useAuth();
  const effectiveSeason = season ?? getCurrentNFLSeason();
  return useQuery({
    queryKey: ['trophies', 'me', effectiveSeason, user?.uid ?? null],
    queryFn: () =>
      apiFetch<Achievement[]>(`/api/trophies?userId=${user!.uid}&season=${effectiveSeason}`, undefined, user),
    enabled: !!user,
    staleTime: 120_000,
  });
}

export function usePublicAchievements(userId: string | undefined, season: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['trophies', 'public', userId ?? null, season],
    queryFn: () =>
      apiFetch<Achievement[]>(`/api/trophies?userId=${userId}&season=${season}`, undefined, user),
    enabled: !!userId,
    staleTime: 120_000,
  });
}

export type SeasonTrophy = {
  id: string;
  userId: string;
  season: number;
  placement: 'champion' | 'runner_up' | 'third_place' | 'last_place';
  wins: number;
  losses: number;
  awardedAt: string;
};

export function useSeasonTrophies(userId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['trophies', 'season', userId ?? null],
    queryFn: () => apiFetch<SeasonTrophy[]>(`/api/trophies/season?userId=${userId}`, undefined, user),
    enabled: !!userId,
    staleTime: 300_000,
  });
}

export function useSendFeedback() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ subject, message }: { subject?: string; message: string }) =>
      apiFetch<{ ok: boolean }>(
        '/api/feedback',
        { method: 'POST', body: JSON.stringify({ subject, message }) },
        user,
      ),
  });
}

export function useUpdateTeamName() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamName: string) =>
      apiFetch<MyProfile>('/api/users/me', { method: 'PATCH', body: JSON.stringify({ teamName }) }, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', 'me'] }),
  });
}

export type NotificationPrefs = {
  notifyWeekUnlocked: boolean;
  notifyWeekLocked: boolean;
  notifyWeekSummary: boolean;
};

export function useUpdateNotificationPrefs() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: Partial<NotificationPrefs>) =>
      apiFetch<MyProfile>('/api/users/me', { method: 'PATCH', body: JSON.stringify(prefs) }, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', 'me'] }),
  });
}

export function useDeleteAccount() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>('/api/users/me', { method: 'DELETE' }, user),
  });
}
