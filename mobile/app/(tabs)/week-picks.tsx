import { useRef, useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentNFLSeason, getCurrentNFLWeek } from '@/lib/nflSeason';
import { useWeekPicks, type WeekPicksGame, type WeekPicksUser } from '@/hooks/useWeekPicks';
import { WeekSelector } from '@/components/WeekSelector';

const SEASON = getCurrentNFLSeason();
const CELL = 52;   // px per game column
const NAME_W = 88; // px for the fixed name column

// ── Game column header ─────────────────────────────────────────────────────

function GameHeader({ game, onPress }: { game: WeekPicksGame; onPress: () => void }) {
  const isFinal = game.status === 'post';
  return (
    <TouchableOpacity style={{ width: CELL }} className="items-center py-1 px-1" onPress={onPress} activeOpacity={0.7}>
      {/* Away logo */}
      <View className="w-9 h-9 items-center justify-center">
        {game.awayTeamLogo ? (
          <Image source={{ uri: game.awayTeamLogo }} style={{ width: 32, height: 32 }} resizeMode="contain" />
        ) : (
          <Text className="text-muted text-xs">{game.awayTeam.slice(0, 3)}</Text>
        )}
      </View>
      {isFinal ? (
        <Text className="text-muted text-xs mt-0.5">
          {game.awayScore}–{game.homeScore}
        </Text>
      ) : (
        <Text className="text-muted text-xs mt-0.5">vs</Text>
      )}
      {/* Home logo */}
      <View className="w-9 h-9 items-center justify-center">
        {game.homeTeamLogo ? (
          <Image source={{ uri: game.homeTeamLogo }} style={{ width: 32, height: 32 }} resizeMode="contain" />
        ) : (
          <Text className="text-muted text-xs">{game.homeTeam.slice(0, 3)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Pick cell ──────────────────────────────────────────────────────────────

function PickCell({
  game,
  entry,
}: {
  game: WeekPicksGame;
  entry: { pick: 'home' | 'away'; isCorrect: boolean | null } | undefined;
}) {
  if (!entry) {
    return (
      <View style={{ width: CELL }} className="items-center justify-center py-2">
        <View className="w-8 h-8 rounded-full bg-surface-2 items-center justify-center">
          <Text className="text-border text-xs">–</Text>
        </View>
      </View>
    );
  }

  const pickedHome = entry.pick === 'home';
  const logo = pickedHome ? game.homeTeamLogo : game.awayTeamLogo;
  const teamName = pickedHome ? game.homeTeam : game.awayTeam;

  const isFinal = game.status === 'post';
  const borderColor = isFinal
    ? entry.isCorrect === true ? '#22c55e' : '#ef4444'
    : '#3b82f6';
  const bgColor = isFinal
    ? entry.isCorrect === true ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'
    : 'rgba(59,130,246,0.15)';

  return (
    <View style={{ width: CELL }} className="items-center justify-center py-2">
      <View
        style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor, backgroundColor: bgColor }}
        className="items-center justify-center"
      >
        {logo ? (
          <Image source={{ uri: logo }} style={{ width: 26, height: 26 }} resizeMode="contain" />
        ) : (
          <Text style={{ fontSize: 8, color: '#fff' }}>{teamName.slice(0, 3).toUpperCase()}</Text>
        )}
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function WeekPicksScreen() {
  const router = useRouter();
  const currentWeek = getCurrentNFLWeek();
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const { data, isLoading, isError, refetch } = useWeekPicks(selectedWeek, SEASON);

  // Synchronized horizontal scroll across header + all user rows
  const headerScrollRef = useRef<ScrollView>(null);
  const rowScrollRefs = useRef<(ScrollView | null)[]>([]);

  const syncScroll = (x: number, sourceIdx: number) => {
    headerScrollRef.current?.scrollTo({ x, animated: false });
    rowScrollRefs.current.forEach((ref, i) => {
      if (i !== sourceIdx) ref?.scrollTo({ x, animated: false });
    });
  };

  const onRowScroll = (e: NativeSyntheticEvent<NativeScrollEvent>, rowIdx: number) => {
    syncScroll(e.nativeEvent.contentOffset.x, rowIdx);
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-white text-lg font-bold mb-2">Couldn't load picks</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text className="text-primary text-sm">Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const games = data?.games ?? [];
  const users = data?.users ?? [];
  const picksByUser = data?.picksByUser ?? {};
  const locked = data?.locked ?? false;

  return (
    <View className="flex-1 bg-background">
      <WeekSelector
        currentWeek={currentWeek}
        selectedWeek={selectedWeek}
        onSelect={setSelectedWeek}
      />

      {/* Before lock: show message for current week, allow browsing past weeks */}
      {!locked ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">🔒</Text>
          <Text className="text-white text-lg font-bold text-center mb-2">
            Picks are hidden
          </Text>
          <Text className="text-muted text-sm text-center">
            Everyone's picks for Week {selectedWeek} will appear here after Wednesday 9 PM lock.
          </Text>
          {selectedWeek > 1 && (
            <Text className="text-muted text-xs text-center mt-4">
              Tap a past week above to see those picks.
            </Text>
          )}
        </View>
      ) : games.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted text-sm">No games found for Week {selectedWeek}</Text>
        </View>
      ) : (
        <View className="flex-1">
          {/* Column headers row */}
          <View
            className="flex-row border-b border-border bg-surface"
            style={{ paddingLeft: NAME_W }}
          >
            <ScrollView
              ref={headerScrollRef}
              horizontal
              scrollEnabled={false}
              bounces={false}
              showsHorizontalScrollIndicator={false}
            >
              {games.map(game => (
                <GameHeader
                  key={game.id}
                  game={game}
                  onPress={() => router.push({
                    pathname: '/game/[id]' as any,
                    params: { id: game.id, week: String(selectedWeek), season: String(SEASON) },
                  })}
                />
              ))}
            </ScrollView>
          </View>

          {/* User rows */}
          <ScrollView showsVerticalScrollIndicator={false}>
            {users.map((user, rowIdx) => (
              <View
                key={user.id}
                className="flex-row items-center border-b border-border"
                style={{ minHeight: 56 }}
              >
                {/* Fixed name column */}
                <View style={{ width: NAME_W }} className="px-3 justify-center">
                  <Text className="text-white text-xs font-semibold" numberOfLines={1}>
                    {user.teamName}
                  </Text>
                  {(() => {
                    const userPicks = picksByUser[user.id] ?? {};
                    const correct = Object.values(userPicks).filter(p => p.isCorrect === true).length;
                    const wrong = Object.values(userPicks).filter(p => p.isCorrect === false).length;
                    if (correct + wrong === 0) return null;
                    return (
                      <Text className="text-muted text-xs mt-0.5">
                        {correct}–{wrong}
                      </Text>
                    );
                  })()}
                </View>

                {/* Scrollable pick cells */}
                <ScrollView
                  ref={ref => { rowScrollRefs.current[rowIdx] = ref; }}
                  horizontal
                  onScroll={e => onRowScroll(e, rowIdx)}
                  scrollEventThrottle={16}
                  bounces={false}
                  overScrollMode="never"
                  showsHorizontalScrollIndicator={false}
                >
                  {games.map(game => (
                    <PickCell
                      key={game.id}
                      game={game}
                      entry={picksByUser[user.id]?.[game.id]}
                    />
                  ))}
                </ScrollView>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
