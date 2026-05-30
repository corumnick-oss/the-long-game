import { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { getCurrentNFLWeek, getCurrentNFLSeason } from '@/lib/nflSeason';
import { useGames, useTiebreaker, useSubmitPick, useSubmitTiebreaker } from '@/hooks/usePicksData';
import { WeekSelector } from '@/components/WeekSelector';
import { GameCard } from '@/components/GameCard';
import { TiebreakerCard } from '@/components/TiebreakerCard';
import { isWeekCurrentlyLocked } from '@/lib/lockTime';
import type { Game } from '@/hooks/usePicksData';

const SEASON = getCurrentNFLSeason();

export default function PicksScreen() {
  const currentWeek = getCurrentNFLWeek();
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  const { data: games, isLoading, isError, refetch, isRefetching } = useGames(selectedWeek, SEASON);
  const { data: tiebreaker } = useTiebreaker(selectedWeek, SEASON);
  const submitPick = useSubmitPick();
  const submitTiebreaker = useSubmitTiebreaker();

  const isLocked = isWeekCurrentlyLocked();

  const handlePick = useCallback(async (game: Game, pick: 'home' | 'away') => {
    // Toggle off if already picked the same team
    if (game.myPick === pick) return;
    submitPick.mutate({ gameId: game.id, pick, week: selectedWeek, season: SEASON });
  }, [selectedWeek, submitPick]);

  const handleTiebreaker = useCallback(async (tiebreakerGameId: string, predictedTotal: number) => {
    await submitTiebreaker.mutateAsync({ tiebreakerGameId, predictedTotal, week: selectedWeek, season: SEASON });
  }, [selectedWeek, submitTiebreaker]);

  const pickedCount = games?.filter(g => g.myPick !== null).length ?? 0;
  const totalGames = games?.length ?? 0;

  return (
    <View className="flex-1 bg-background">
      <WeekSelector
        currentWeek={currentWeek}
        selectedWeek={selectedWeek}
        onSelect={setSelectedWeek}
      />

      {/* Pick progress header */}
      {!isLoading && games && games.length > 0 && (
        <View className="flex-row items-center justify-between px-4 py-2">
          <Text className="text-muted text-xs">
            Week {selectedWeek} · {isLocked ? 'Picks locked' : `${pickedCount}/${totalGames} picked`}
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
