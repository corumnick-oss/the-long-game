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

// ESPN team schedule fetching runs on the mobile device (not Railway) to bypass
// Railway's block on site.api.espn.com/teams/* for future seasons.
const ESPN_NFL_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const NFL_TEAM_IDS = [
  '1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17',
  '18','19','20','21','22','23','24','25','26','27','28','29','30','33','34',
];

async function fetchWeekEventIds(week: number, season: number, seasonType: string): Promise<string[]> {
  const st = seasonType === 'preseason' ? 1 : 2;
  const eventIds = new Set<string>();
  await Promise.all(NFL_TEAM_IDS.map(async (teamId) => {
    try {
      const resp = await fetch(`${ESPN_NFL_BASE}/teams/${teamId}/schedule?season=${season}&seasontype=${st}`);
      if (!resp.ok) return;
      const data = await resp.json();
      for (const ev of (data.events ?? [])) {
        if (ev.week?.number === week && ev.id) eventIds.add(String(ev.id));
      }
    } catch { /* skip */ }
  }));
  return [...eventIds];
}

async function fetchAllWeekEventIds(
  season: number,
  seasonType: string,
  maxWeek: number,
): Promise<{ week: number; eventIds: string[] }[]> {
  const st = seasonType === 'preseason' ? 1 : 2;
  const byWeek = new Map<number, Set<string>>();
  await Promise.all(NFL_TEAM_IDS.map(async (teamId) => {
    try {
      const resp = await fetch(`${ESPN_NFL_BASE}/teams/${teamId}/schedule?season=${season}&seasontype=${st}`);
      if (!resp.ok) return;
      const data = await resp.json();
      for (const ev of (data.events ?? [])) {
        const weekNum: number = ev.week?.number;
        if (weekNum && weekNum <= maxWeek && ev.id) {
          if (!byWeek.has(weekNum)) byWeek.set(weekNum, new Set());
          byWeek.get(weekNum)!.add(String(ev.id));
        }
      }
    } catch { /* skip */ }
  }));
  return [...byWeek.entries()].map(([week, ids]) => ({ week, eventIds: [...ids] }));
}

// Used for future seasons where Railway can't reach ESPN team schedule endpoints.
// Mobile fetches event IDs directly, backend syncs via /summary (which works from Railway).
export function useSyncGamesForFutureSeason() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ week, season, seasonType = 'regular' }: { week: number; season: number; seasonType?: string }) => {
      const eventIds = await fetchWeekEventIds(week, season, seasonType);
      if (eventIds.length === 0) throw new Error(`No games found on ESPN for ${seasonType} week ${week}`);
      return apiFetch<{ synced: number; week: number; season: number }>(
        '/api/admin/games/sync-by-ids',
        { method: 'POST', body: JSON.stringify({ eventIds, week, season, seasonType }) },
        user,
      );
    },
  });
}

export function useSyncFullSeasonForFutureSeason() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ season, seasonType = 'regular' }: { season: number; seasonType?: string }) => {
      const maxWeek = seasonType === 'preseason' ? 4 : 18;
      const weekEvents = await fetchAllWeekEventIds(season, seasonType, maxWeek);
      if (weekEvents.length === 0) throw new Error(`No games found on ESPN for ${season} ${seasonType}`);
      return apiFetch<{ total: number; season: number; seasonType: string; results: { week: number; synced: number }[] }>(
        '/api/admin/games/sync-full-season-by-ids',
        { method: 'POST', body: JSON.stringify({ weekEvents, season, seasonType }) },
        user,
      );
    },
  });
}

export function useSyncTeamStats() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ season, seasonType }: { season: number; seasonType: string }) =>
      apiFetch<{ synced: number; season: number; seasonType: string }>(
        '/api/admin/sync-team-stats',
        { method: 'POST', body: JSON.stringify({ season, seasonType }) },
        user,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['games'] }),
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

export function useSyncFullSeason() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ season, seasonType }: { season: number; seasonType: 'regular' | 'preseason' }) =>
      apiFetch<{ total: number; season: number; seasonType: string; results: { week: number; synced: number }[] }>(
        '/api/admin/games/sync-full-season',
        { method: 'POST', body: JSON.stringify({ season, seasonType }) },
        user,
      ),
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
