import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/queryClient';

export type AdminUser = {
  id: string;
  email: string;
  teamName: string;
  isAdmin: boolean;
  isLongie: boolean;
  isPremium: boolean;
  nflAccess: boolean;
  createdAt: string;
};

export function useAdminUsers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin', 'users', user?.uid ?? null],
    queryFn: () => apiFetch<AdminUser[]>('/api/admin/users', undefined, user),
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useUpdateUser() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; isLongie?: boolean; isAdmin?: boolean; nflAccess?: boolean; teamName?: string }) =>
      apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useSyncGames() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ week, season, seasonType = 'regular' }: { week: number; season: number; seasonType?: string }) =>
      apiFetch<{ synced: number; week: number; season: number }>(
        '/api/admin/games/sync',
        { method: 'POST', body: JSON.stringify({ week, season, seasonType }) },
        user,
      ),
  });
}

export function useSyncProbs() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ week, season }: { week: number; season: number }) =>
      apiFetch('/api/admin/games/sync-probs', { method: 'POST', body: JSON.stringify({ week, season }) }, user),
  });
}

export function useAwardTrophies() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ week, season }: { week: number; season: number }) =>
      apiFetch<{ awarded: unknown[] }>('/api/admin/trophies/award', { method: 'POST', body: JSON.stringify({ week, season }) }, user),
  });
}

export function useUnlockWeek() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ week, season }: { week: number; season: number }) =>
      apiFetch('/api/admin/unlock-week', { method: 'POST', body: JSON.stringify({ week, season }) }, user),
  });
}

export function useSyncScores() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ week, season }: { week: number; season: number }) =>
      apiFetch<{ updated: number; week: number; season: number }>(
        '/api/admin/games/sync-scores',
        { method: 'POST', body: JSON.stringify({ week, season }) },
        user,
      ),
  });
}

export function useCorrectScore() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ id, homeScore, awayScore, status }: { id: string; homeScore: number; awayScore: number; status: 'pre' | 'in' | 'post' }) =>
      apiFetch(
        `/api/admin/games/${id}`,
        { method: 'PATCH', body: JSON.stringify({ homeScore, awayScore, status }) },
        user,
      ),
  });
}

export function useExportWeekPicks() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ week, season }: { week: number; season: number }) =>
      apiFetch<unknown[]>(`/api/admin/picks?week=${week}&season=${season}`, undefined, user),
  });
}

export function useTokenStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin', 'token-status', user?.uid ?? null],
    queryFn: () => apiFetch<{ hasToken: boolean; tokenCount: number; userId: string }>('/api/admin/notifications/token-status', undefined, user),
    enabled: !!user,
    staleTime: 10_000,
  });
}

export function useSendTestNotification() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: () => apiFetch<{ sent: boolean }>('/api/admin/notifications/test', { method: 'POST' }, user),
  });
}

export function useScheduleTestNotification() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ delayMinutes }: { delayMinutes: number }) =>
      apiFetch<{ scheduled: boolean; fireAt: string; delayMinutes: number }>(
        '/api/admin/notifications/schedule-test',
        { method: 'POST', body: JSON.stringify({ delayMinutes }) },
        user,
      ),
  });
}

export function useCancelScheduledTest() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: () => apiFetch('/api/admin/notifications/schedule-test', { method: 'DELETE' }, user),
  });
}

export function useExportData() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: (season: number) =>
      apiFetch<{ users: unknown[]; games: unknown[]; picks: unknown[]; trophies: unknown[] }>(
        `/api/admin/export?season=${season}`,
        undefined,
        user,
      ),
  });
}
