import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/queryClient';
import type { Game } from './usePicksData';

export type PickEntry = {
  userId: string;
  teamName: string;
  profileImageUrl: string | null;
  pick: 'home' | 'away';
  isCorrect: boolean | null;
};

export type RecentGameEntry = {
  gameId: string;
  week: number;
  gameTime: string | null;
  isHome: boolean;
  opponent: string;
  opponentLogo: string | null;
  teamScore: number | null;
  oppScore: number | null;
  result: 'W' | 'L' | null;
};

export type GameDetail = Game & {
  isLocked: boolean;
  pickBreakdown: {
    homePct: number;
    awayPct: number;
    picks: PickEntry[];
  } | null;
  homeTeamRecentGames: RecentGameEntry[];
  awayTeamRecentGames: RecentGameEntry[];
};

export function useGameDetail(gameId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['game-detail', gameId, user?.uid ?? null],
    queryFn: () => apiFetch<GameDetail>(`/api/games/${gameId}`, undefined, user),
    staleTime: 30_000,
    enabled: !!gameId,
  });
}
