import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/queryClient';

export type ActivityItem = {
  id: string;
  type: string;
  message: string;
  visibility: string;
  targetUserId: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

type ActivityPage = {
  tab: string;
  page: number;
  pageSize: number;
  items: ActivityItem[];
};

export function useActivity(tab: 'global' | 'personal', enabled: boolean) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ['activity', tab, user?.uid ?? null],
    queryFn: ({ pageParam }) =>
      apiFetch<ActivityPage>(`/api/activity?tab=${tab}&page=${pageParam}`, undefined, user),
    getNextPageParam: (lastPage) =>
      lastPage.items.length === lastPage.pageSize ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!user && enabled,
    staleTime: 30_000,
  });
}
