import { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { getCurrentNFLWeek, getCurrentNFLSeason } from '@/lib/nflSeason';
import { useGames, useTiebreaker, useSubmitPick, useSubmitTiebreaker } from '@/hooks/usePicksData';
import { WeekSelector } from '@/components/WeekSelector';
import { GameCard } from '@/components/GameCard';
import { TiebreakerCard } from '@/components/TiebreakerCard';
import { isWeekCurrentlyLocked } from '@/lib/lockTime';
import type { Game } from '@/hooks/usePicksData';

const CURRENT_SEASON = getCurrentNFLSeason();
const CURRENT_WEEK = getCurrentNFLWeek();
const MIN_SEASON = 2025;
const MAX_SEASON = new Date().getFullYear();

// Default to preseason; switch to regular season on Sept 7 (after last preseason game)
function getDefaultSeasonType(): 'regular' | 'preseason' {
  const now = new Date();
  return now >= new Date(now.getFullYear(), 8, 7) ? 'regular' : 'preseason';
}

export default function PicksScreen() {
  const router = useRouter();
  const [season, setSeason] = useState(MAX_SEASON);
  const [seasonType, setSeasonType] = useState<'regular' | 'preseason'>(getDefaultSeasonType);
  const [selectedWeek, setSelectedWeek] = useState(CURRENT_WEEK);

  // Batch season/type + week changes in one call so React renders
  // the new season and week=1 together — prevents a brief flash of
  // week-18 data (from the old season) before the week resets.
  const changeSeason = (newSeason: number) => { setSeason(newSeason); setSelectedWeek(1); };
  const changeSeasonType = (newType: 'regular' | 'preseason') => { setSeasonType(newType); setSelectedWeek(1); };

  const { data: games, isLoading, isError, refetch, isRefetching } = useGames(selectedWeek, season, seasonType);
  const { data: tiebreaker } = useTiebreaker(selectedWeek, season);
  const submitPick = useSubmitPick();
  const submitTiebreaker = useSubmitTiebreaker();

  const isLocked = isWeekCurrentlyLocked();

  const handlePick = useCallback(async (game: Game, pick: 'home' | 'away') => {
    if (game.myPick === pick) return;
    submitPick.mutate({ gameId: game.id, pick, week: selectedWeek, season, seasonType });
  }, [selectedWeek, season, seasonType, submitPick]);

  const handleTiebreaker = useCallback(async (tiebreakerGameId: string, predictedTotal: number) => {
    await submitTiebreaker.mutateAsync({ tiebreakerGameId, predictedTotal, week: selectedWeek, season });
  }, [selectedWeek, season, submitTiebreaker]);

  const pickedCount = games?.filter(g => g.myPick !== null).length ?? 0;
  const totalGames = games?.length ?? 0;

  return (
    <View className="flex-1 bg-background">
      {/* Season selector */}
      <View className="flex-row items-center justify-center gap-4 pt-3 pb-1">
        <TouchableOpacity
          onPress={() => changeSeason(Math.max(MIN_SEASON, season - 1))}
          disabled={season <= MIN_SEASON}
          className={`w-8 h-8 bg-surface rounded-full items-center justify-center ${season <= MIN_SEASON ? 'opacity-30' : ''}`}
        >
          <Text className="text-white text-base">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-base font-bold">{season} Season</Text>
        <TouchableOpacity
          onPress={() => changeSeason(Math.min(MAX_SEASON, season + 1))}
          disabled={season >= MAX_SEASON}
          className={`w-8 h-8 bg-surface rounded-full items-center justify-center ${season >= MAX_SEASON ? 'opacity-30' : ''}`}
        >
          <Text className="text-white text-base">›</Text>
        </TouchableOpacity>
      </View>

      {/* Preseason / Regular Season toggle */}
      <View className="flex-row bg-surface rounded-xl p-1 mx-4 my-2">
        {(['regular', 'preseason'] as const).map(st => (
          <TouchableOpacity
            key={st}
            onPress={() => changeSeasonType(st)}
            className={`flex-1 py-2 rounded-lg items-center ${seasonType === st ? 'bg-primary' : ''}`}
          >
            <Text className={`text-sm font-semibold ${seasonType === st ? 'text-white' : 'text-muted'}`}>
              {st === 'regular' ? 'Regular Season' : 'Preseason'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <WeekSelector
        currentWeek={season === MAX_SEASON ? CURRENT_WEEK : 18}
        selectedWeek={selectedWeek}
        onSelect={setSelectedWeek}
        seasonType={seasonType}
      />

      {/* Team Central link */}
      <TouchableOpacity
        onPress={() => router.push('/team-central' as any)}
        activeOpacity={0.7}
        className="flex-row items-center mx-4 mb-2 px-4 py-2.5 bg-surface rounded-xl"
      >
        <Text className="text-base mr-2">🏟️</Text>
        <Text className="flex-1 text-white text-sm font-medium">Team Central</Text>
        <Text className="text-muted text-xs mr-1">Stats · Records · Picks</Text>
        <Text className="text-primary text-sm">›</Text>
      </TouchableOpacity>

      {/* Pick progress header */}
      {!isLoading && games && games.length > 0 && (
        <View className="flex-row items-center justify-between px-4 py-2">
          <Text className="text-muted text-xs">
            {seasonType === 'preseason' ? `Pre ${selectedWeek}` : `Week ${selectedWeek}`} · {isLocked ? 'Picks locked' : `${pickedCount}/${totalGames} picked`}
          </Text>
          {!isLocked && pickedCount > 0 && (
            <View className="bg-primary/20 rounded-full px-2 py-0.5">
              <Text className="text-primary text-xs font-semibold">{pickedCount}/{totalGames}</Text>
            </View>
          )}
        </View>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3b82f6" size="large" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">⚠️</Text>
          <Text className="text-white text-lg font-bold text-center mb-2">Couldn't load games</Text>
          <Text className="text-muted text-sm text-center">Check your connection and pull down to retry.</Text>
        </View>
      ) : !games || games.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">🏈</Text>
          <Text className="text-white text-lg font-bold text-center mb-2">No games this week</Text>
          <Text className="text-muted text-sm text-center">Try a different week above.</Text>
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <GameCard
              game={item}
              isLocked={isLocked}
              onPick={pick => handlePick(item, pick)}
              onPress={() => router.push({
                pathname: '/game/[id]' as any,
                params: { id: item.id, week: String(selectedWeek), season: String(season), seasonType },
              })}
              onTeamPress={teamName => router.push({
                pathname: '/team/[name]' as any,
                params: { name: teamName, season: String(season), seasonType },
              })}
            />
          )}
          ListHeaderComponent={<View className="h-2" />}
          ListFooterComponent={
            tiebreaker ? (
              <TiebreakerCard
                data={tiebreaker}
                onSubmit={handleTiebreaker}
                isLocked={isLocked}
              />
            ) : (
              <View className="h-8" />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#3b82f6"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
