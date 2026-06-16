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

export type BoxScore = {
  totalYards: number | null;
  passYards: number | null;
  rushYards: number | null;
  thirdDown: number | null;
  thirdDownRaw: string | null;
  redZone: number | null;
  redZoneRaw: string | null;
  sacks: number | null;
  turnovers: number | null;
  firstDowns: number | null;
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
  homeBoxScore: BoxScore | null;
  awayBoxScore: BoxScore | null;
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
